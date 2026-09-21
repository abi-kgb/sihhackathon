import cv2
import time
import json
import asyncio
import threading
import queue
import re
from typing import Dict, List, Optional, Any, Callable
import numpy as np
from datetime import datetime
from pathlib import Path

from .detector import ObjectDetector
from .tracker import SimpleTracker
from .virtual_fence import VirtualFenceEngine
from .frs import FacialRecognitionEngine
from .anpr import ANPREngine
from .activity import ActivityAnalyticsEngine
from .night_vision import NightVisionEnhancer
from .simulator import BorderStreamSimulator
from ..config import settings
from ..database import SessionLocal
from ..models import Camera, VirtualZone, Alert, WatchlistPerson, WatchlistVehicle, SystemLog

# Shared High-Throughput Analytics Singletons (Prevents multi-worker CPU & RAM contention)
_shared_detector = ObjectDetector()
_shared_frs_engine = FacialRecognitionEngine()
_shared_anpr_engine = ANPREngine()
_shared_night_enhancer = NightVisionEnhancer()

class CameraStreamWorker:
    """
    Thread-safe worker that captures, processes, and annotates frames for a single camera feed.
    Releases OpenCV camera handles when in browser webcam mode so the browser has exclusive hardware access.
    """
    def __init__(self, camera_id: int, on_alert_callback: Optional[Callable] = None):
        self.camera_id = camera_id
        self.on_alert_callback = on_alert_callback
        self.is_running = False
        self.thread: Optional[threading.Thread] = None
        self.lock = threading.Lock()

        # Source State
        self.stream_type: str = "simulation"
        self.stream_url: str = ""
        self.source_changed: bool = False
        self.cap: Optional[cv2.VideoCapture] = None

        # Analytics Components (Shared heavy neural models)
        self.detector = _shared_detector
        self.tracker = SimpleTracker()
        self.fence_engine = VirtualFenceEngine()
        self.frs_engine = _shared_frs_engine
        self.anpr_engine = _shared_anpr_engine
        self.activity_engine = ActivityAnalyticsEngine()
        self.night_enhancer = _shared_night_enhancer
        self.simulator = BorderStreamSimulator(camera_id=self.camera_id, scenario_type="perimeter")

        # Alert & Telemetry State
        self.alert_queue: queue.Queue = queue.Queue(maxsize=150)
        self.writer_thread: Optional[threading.Thread] = None
        self.current_raw_frame: Optional[np.ndarray] = None
        self.current_annotated_frame: Optional[np.ndarray] = None
        self.current_telemetry: Dict[str, Any] = {
            "camera_id": camera_id,
            "fps": 25.0,
            "latency_ms": 12.0,
            "tracked_objects_count": 0,
            "stream_type": "simulation",
            "active_alerts": []
        }
        self.last_alert_time: Dict[str, float] = {}
        self.track_plate_cache: Dict[int, Dict[str, Any]] = {}
        self.track_person_cache: Dict[int, Dict[str, Any]] = {}

    def start(self):
        if not self.is_running:
            self.is_running = True
            self.thread = threading.Thread(target=self._run_loop, daemon=True)
            self.thread.start()
            self.writer_thread = threading.Thread(target=self._alert_writer_loop, daemon=True)
            self.writer_thread.start()

    def stop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=1.0)
        if self.writer_thread and self.writer_thread.is_alive():
            self.writer_thread.join(timeout=1.0)
        with self.lock:
            if self.cap:
                self.cap.release()
                self.cap = None

    def _alert_writer_loop(self):
        """Asynchronous background worker for disk I/O & DB logging without throttling video FPS"""
        db = SessionLocal()
        while self.is_running or not self.alert_queue.empty():
            try:
                item = self.alert_queue.get(timeout=0.4)
            except queue.Empty:
                continue

            try:
                cam_id, cam_name, cam_bop, alert_type, severity, title, description, object_type, confidence, snap_frame, plate_number, metadata = item
                clean_plate = re.sub(r'[^A-Za-z0-9]', '', plate_number).upper() if plate_number else ""
                plate_prefix = f"{clean_plate}_" if clean_plate else ""
                now_ms = int(time.time() * 1000)
                snapshot_filename = f"snapshot_cam{cam_id}_{plate_prefix}{now_ms}_{alert_type.lower()}.jpg"
                snapshot_path = settings.SNAPSHOTS_DIR / snapshot_filename

                if snap_frame is not None and snap_frame.size > 0:
                    cv2.imwrite(str(snapshot_path), snap_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                
                relative_snapshot_url = f"/uploads/snapshots/{snapshot_filename}"
                metadata_dict = metadata or {}
                if plate_number:
                    metadata_dict["plate_number"] = plate_number

                alert = Alert(
                    camera_id=cam_id,
                    camera_name=cam_name,
                    bop_location=cam_bop,
                    alert_type=alert_type,
                    severity=severity,
                    title=title,
                    description=description,
                    object_type=object_type,
                    confidence=round(confidence, 3),
                    snapshot_path=relative_snapshot_url,
                    metadata_json=json.dumps(metadata_dict) if metadata_dict else None,
                    status="ACTIVE"
                )
                db.add(alert)
                db.commit()
                db.refresh(alert)

                if self.on_alert_callback:
                    alert_dict = {
                        "id": alert.id,
                        "camera_id": alert.camera_id,
                        "camera_name": alert.camera_name,
                        "bop_location": alert.bop_location,
                        "alert_type": alert.alert_type,
                        "severity": alert.severity,
                        "title": alert.title,
                        "description": alert.description,
                        "object_type": alert.object_type,
                        "confidence": alert.confidence,
                        "snapshot_path": alert.snapshot_path,
                        "status": alert.status,
                        "created_at": alert.created_at.isoformat() if alert.created_at else datetime.now().isoformat()
                    }
                    self.on_alert_callback(alert_dict)
            except Exception as e:
                print(f"[AlertWriter] Error processing alert: {e}")
            finally:
                self.alert_queue.task_done()
        db.close()

    def update_source(self, stream_type: str, stream_url: str):
        with self.lock:
            self.stream_type = stream_type
            self.stream_url = stream_url or ""
            self.source_changed = True

    def _open_capture(self, stream_type: str, stream_url: str) -> Optional[cv2.VideoCapture]:
        cap = None
        # Only open file/rtsp in backend; do NOT lock device index 0 so browser can use webcam!
        if stream_type in ["file", "rtsp"] and stream_url:
            try:
                cap = cv2.VideoCapture(stream_url)
            except Exception as e:
                print(f"[Worker] File/RTSP open error: {e}")
                cap = None
        return cap

    def _run_loop(self):
        db = SessionLocal()
        cam = db.query(Camera).filter(Camera.id == self.camera_id).first()
        if cam:
            self.stream_type = cam.stream_type or "simulation"
            self.stream_url = cam.stream_url or ""
        
        with self.lock:
            self.cap = self._open_capture(self.stream_type, self.stream_url)

        fps_counter = 0
        fps_timer = time.time()
        last_frame_clock = time.time()
        measured_fps = 25.0
        file_fps = 25.0

        cached_zones: List[Any] = []
        cached_person_watchlist: List[Dict[str, Any]] = []
        cached_vehicle_watchlist: List[Dict[str, Any]] = []
        last_detections: List[Dict[str, Any]] = []

        while self.is_running:
            t_start = time.time()

            # Handle dynamic runtime source switch safely
            if self.source_changed:
                with self.lock:
                    if self.cap:
                        self.cap.release()
                        self.cap = None
                    self.cap = self._open_capture(self.stream_type, self.stream_url)
                    self.source_changed = False
                    last_detections = []
                    last_frame_clock = time.time()
                    if self.cap and self.cap.isOpened():
                        raw_fps = self.cap.get(cv2.CAP_PROP_FPS)
                        file_fps = raw_fps if (raw_fps and 5.0 <= raw_fps <= 120.0) else 25.0

            # Refresh DB queries every 15 frames (2x per sec) for maximum throughput
            if fps_counter % 15 == 0 or not cached_zones:
                db.expire_all()
                cam = db.query(Camera).filter(Camera.id == self.camera_id).first()
                cached_zones = db.query(VirtualZone).filter(VirtualZone.camera_id == self.camera_id, VirtualZone.is_active == True).all()
                cached_person_watchlist = [
                    {"id": p.id, "name": p.name, "alias": p.alias, "category": p.category, "threat_level": p.threat_level, "photo_url": p.photo_url, "face_embedding": p.face_embedding}
                    for p in db.query(WatchlistPerson).filter(WatchlistPerson.is_active == True).all()
                ]
                cached_vehicle_watchlist = [
                    {"id": v.id, "plate_number": v.plate_number, "vehicle_type": v.vehicle_type, "category": v.category, "threat_level": v.threat_level, "owner_name": v.owner_name, "notes": v.notes}
                    for v in db.query(WatchlistVehicle).filter(WatchlistVehicle.is_active == True).all()
                ]

            zones = cached_zones
            person_watchlist = cached_person_watchlist
            vehicle_watchlist = cached_vehicle_watchlist

            if self.stream_type == "webcam":
                # In browser webcam mode, live frames are ingested directly via process_browser_webcam_frame.
                # Idle background thread to prevent generating ghost synthetic intruders.
                time.sleep(0.08)
                continue

            frame = None
            if self.cap and self.cap.isOpened():
                try:
                    # Wall-clock real-time sync: skip frames if AI processing took longer than 1 frame duration
                    now_clock = time.time()
                    dt = now_clock - last_frame_clock
                    last_frame_clock = now_clock
                    
                    if self.stream_type == "file" and dt > (1.0 / file_fps):
                        skip_frames = min(int(dt * file_fps) - 1, 4)
                        for _ in range(max(0, skip_frames)):
                            self.cap.grab()

                    ret, frame = self.cap.read()
                    if not ret and self.stream_type == "file":
                        self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        ret, frame = self.cap.read()
                except Exception:
                    frame = None

            # Fallback to simulation frame if not a video file
            if frame is None or frame.size == 0:
                frame = self.simulator.generate_frame()
            else:
                # Fast downscale uploaded video frames to 640x360 for high 30+ FPS throughput
                fh, fw = frame.shape[:2]
                if fw > 640 or fh > 480:
                    new_w = 640
                    new_h = int(fh * (640.0 / fw))
                    frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

            self.current_raw_frame = frame.copy()
            h, w = frame.shape[:2]

            if cam and cam.night_mode_enabled:
                frame_enhanced = self.night_enhancer.enhance_low_light(frame)
            else:
                frame_enhanced = frame

            # Smart Frame Acceleration: For video files on CPU, perform full neural inference every 2nd frame
            if self.stream_type == "file" and (fps_counter % 2 != 0) and last_detections:
                detections = last_detections
            else:
                detections = self.detector.detect(frame_enhanced)
                last_detections = detections

            tracks = self.tracker.update(detections)

            annotated = frame_enhanced.copy()
            self._draw_zones(annotated, zones, w, h)

            active_alerts = []

            for track in tracks:
                tid = track["id"]
                bbox = track["bbox"]
                cname = track["class_name"]
                conf = track["confidence"]
                centroid = track["centroid"]

                x1, y1 = int(bbox[0] * w), int(bbox[1] * h)
                x2, y2 = int(bbox[2] * w), int(bbox[3] * h)
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)

                threat_color = (0, 255, 0)
                is_vehicle = any(v in cname.lower() for v in ["car", "truck", "bus", "motorcycle", "vehicle"])
                is_authorized_friendly_vehicle = False
                matched_vehicle = None
                plate_text = ""

                # 1. ANPR Vehicle Plate Analysis & Whitelist Verification with Persistent Track Memory
                if is_vehicle and (x2 - x1) > 25 and (y2 - y1) > 25:
                    last_scan_frame = 0
                    if tid in self.track_plate_cache:
                        cached = self.track_plate_cache[tid]
                        plate_text = cached.get("plate_text", "")
                        matched_vehicle = cached.get("matched_vehicle")
                        is_authorized_friendly_vehicle = cached.get("is_authorized", False)
                        last_scan_frame = cached.get("last_scan_frame", 0)

                    # Only perform heavy OCR on new tracks or once every 60 frames
                    should_scan_plate = (tid not in self.track_plate_cache) or ((fps_counter - last_scan_frame >= 60) and not matched_vehicle)
                    if should_scan_plate:
                        v_crop = frame[y1:y2, x1:x2]
                        plate_res = self.anpr_engine.detect_plate_region(v_crop)
                        plate_crop = plate_res[0] if plate_res else None
                        extracted_text = self.anpr_engine.extract_plate_text(plate_crop, vehicle_crop=v_crop)
                        if extracted_text:
                            plate_text = extracted_text
                        
                        if plate_text:
                            found_vehicle = self.anpr_engine.match_watchlist(plate_text, vehicle_watchlist)
                            if found_vehicle:
                                matched_vehicle = found_vehicle

                        if matched_vehicle:
                            cat = (matched_vehicle.get("category") or "").lower()
                            threat = (matched_vehicle.get("threat_level") or "").upper()
                            is_hostile_v = any(h in cat for h in ["smuggl", "stolen", "unauthorized", "hostile", "threat", "suspect", "wanted"])
                            is_friendly_v = any(w in cat for w in ["patrol", "whitelist", "auth", "friendly", "safe", "vip", "official", "resident", "registered"])
                            if (not is_hostile_v) and (is_friendly_v or threat in ["AUTHORIZED", "SAFE", "WHITELIST"]):
                                is_authorized_friendly_vehicle = True
                            else:
                                is_authorized_friendly_vehicle = False

                        self.track_plate_cache[tid] = {
                            "plate_text": plate_text,
                            "matched_vehicle": matched_vehicle,
                            "is_authorized": is_authorized_friendly_vehicle,
                            "last_scan_frame": fps_counter
                        }

                is_authorized_friendly_person = False
                matched_person = None
                person_name = ""

                # 2. FRS Person Face Analysis & Whitelist Verification with Persistent Track Memory
                if cname == "person" and (x2 - x1) > 25 and (y2 - y1) > 25:
                    last_p_scan = 0
                    if tid in self.track_person_cache:
                        cached_p = self.track_person_cache[tid]
                        matched_person = cached_p.get("matched_person")
                        is_authorized_friendly_person = cached_p.get("is_authorized", False)
                        person_name = cached_p.get("person_name", "")
                        last_p_scan = cached_p.get("last_scan_frame", 0)

                    # Only perform face recognition on new tracks or once every 45 frames
                    should_scan_person = (tid not in self.track_person_cache) or ((fps_counter - last_p_scan >= 45) and not matched_person)
                    if should_scan_person:
                        p_crop = frame[y1:y2, x1:x2]
                        faces = self.frs_engine.detect_faces(p_crop)
                        found_person = None
                        if faces:
                            fx, fy, fw, fh = faces[0]
                            face_crop = p_crop[fy:fy+fh, fx:fx+fw]
                            found_person = self.frs_engine.match_face(face_crop, person_watchlist)

                        if found_person:
                            matched_person = found_person
                            p_cat = (matched_person.get("category") or "").lower()
                            p_threat = (matched_person.get("threat_level") or "").upper()
                            person_name = matched_person.get("name") or "Authorized Personnel"
                            is_hostile_p = any(h in p_cat for h in ["infiltrator", "terrorist", "smuggler", "wanted", "suspect", "criminal", "poi"])
                            is_friendly_p = any(w in p_cat for w in ["staff", "whitelist", "auth", "friendly", "safe", "vip", "official", "resident", "guard", "patrol", "registered"])
                            if (not is_hostile_p) and (is_friendly_p or p_threat in ["AUTHORIZED", "SAFE", "WHITELIST"]):
                                is_authorized_friendly_person = True
                            else:
                                is_authorized_friendly_person = False

                        self.track_person_cache[tid] = {
                            "matched_person": matched_person,
                            "is_authorized": is_authorized_friendly_person,
                            "person_name": person_name,
                            "last_scan_frame": fps_counter
                        }

                # Helper to create snapshot with highlighted target
                def _get_evidence_snapshot(target_label: str, target_color: Tuple[int, int, int] = (0, 0, 255)):
                    snap = annotated.copy()
                    cv2.rectangle(snap, (x1, y1), (x2, y2), target_color, 3)
                    lbl = f"{target_label} ({conf*100:.0f}%)"
                    cv2.rectangle(snap, (x1, max(0, y1 - 22)), (x1 + len(lbl) * 9 + 12, y1), target_color, -1)
                    cv2.putText(snap, lbl, (x1 + 4, max(14, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
                    return snap

                # 3. Activity & Behavioral Anomaly Check (suppressed for authorized personnel/vehicles)
                if (not is_authorized_friendly_person) and (not is_authorized_friendly_vehicle) and (cname == "person" or is_vehicle) and conf >= 0.45:
                    behavior = self.activity_engine.update_track(tid, bbox, cname)
                    for anomaly in behavior["anomalies"]:
                        threat_color = (0, 0, 255)
                        if cam:
                            snap_frame = _get_evidence_snapshot(anomaly["type"].replace('_', ' '))
                            self._trigger_alert(
                                db=db,
                                cam=cam,
                                alert_type=anomaly["type"],
                                severity=anomaly["severity"],
                                title=f"{anomaly['type'].replace('_', ' ')}",
                                description=anomaly["description"],
                                object_type=cname,
                                confidence=conf,
                                frame=snap_frame
                            )
                        active_alerts.append(anomaly["type"])

                # 4. Virtual Zones Check (Intrusion alerts completely suppressed for registered authorized faces and vehicles)
                if (not is_authorized_friendly_vehicle) and (not is_authorized_friendly_person) and (cname == "person" or is_vehicle):
                    car_tag = plate_text if plate_text else f"CAR-#{tid}"
                    for z in zones:
                        coords = self.fence_engine.parse_coordinates(z.coordinates)
                        if z.zone_type == "polygon_fence":
                            if self.fence_engine.check_polygon_intrusion(centroid, coords, bbox):
                                threat_color = (0, 0, 255)
                                if is_vehicle:
                                    alert_title = f"Unauthorized Vehicle Breach: [{car_tag}] in {z.name}"
                                    alert_desc = f"Unauthorized vehicle (Car Number / Plate: {car_tag}) breached restricted {z.name} (Track #{tid})"
                                    snap_lbl = f"UNAUTHORIZED VEHICLE: {car_tag}"
                                else:
                                    alert_title = f"Virtual Fence Breach: {z.name}"
                                    alert_desc = f"Unauthorized entry by {cname} (Track #{tid})"
                                    snap_lbl = f"INTRUDER: {cname.upper()}"

                                if cam:
                                    snap_frame = _get_evidence_snapshot(snap_lbl)
                                    self._trigger_alert(
                                        db=db,
                                        cam=cam,
                                        alert_type="VIRTUAL_FENCE_BREACH",
                                        severity=z.alert_severity or "CRITICAL",
                                        title=alert_title,
                                        description=alert_desc,
                                        object_type=cname,
                                        confidence=conf,
                                        frame=snap_frame,
                                        min_cooldown=0.3,
                                        plate_number=car_tag if is_vehicle else None,
                                        metadata={"plate_number": car_tag if is_vehicle else None, "zone_name": z.name, "track_id": tid}
                                    )
                                active_alerts.append("VIRTUAL_FENCE_BREACH")

                        elif z.zone_type == "tripwire":
                            if len(track["trajectory"]) >= 2:
                                prev_pos = track["trajectory"][-2]
                                curr_pos = track["trajectory"][-1]
                                crossed, direction = self.fence_engine.check_tripwire_crossing(
                                    prev_pos, curr_pos, coords, allowed_direction=z.direction or "both"
                                )
                                if crossed:
                                    threat_color = (0, 0, 255)
                                    if is_vehicle:
                                        alert_title = f"Tripwire Crossing: [{car_tag}] crossed {z.name}"
                                        alert_desc = f"Vehicle (Car Number: {car_tag}) crossed tripwire {z.name} ({direction.upper()})"
                                        snap_lbl = f"TRIPWIRE: {car_tag}"
                                    else:
                                        alert_title = f"Tripwire Crossing: {z.name} ({direction.upper()})"
                                        alert_desc = f"{cname.capitalize()} (Track #{tid}) crossed tripwire {z.name}"
                                        snap_lbl = f"TRIPWIRE: {cname.upper()}"

                                    if cam:
                                        snap_frame = _get_evidence_snapshot(snap_lbl)
                                        self._trigger_alert(
                                            db=db,
                                            cam=cam,
                                            alert_type="TRIPWIRE_CROSSING",
                                            severity=z.alert_severity or "HIGH",
                                            title=alert_title,
                                            description=alert_desc,
                                            object_type=cname,
                                            confidence=conf,
                                            frame=snap_frame,
                                            min_cooldown=0.3,
                                            plate_number=car_tag if is_vehicle else None,
                                            metadata={"plate_number": car_tag if is_vehicle else None, "zone_name": z.name, "track_id": tid}
                                        )
                                    active_alerts.append("TRIPWIRE_CROSSING")

                # 5. Vehicle & Person Watchlist Alerting & HUD Labeling
                if is_authorized_friendly_vehicle and matched_vehicle:
                    threat_color = (0, 255, 157) # Neon Green / Friendly
                    p_num = matched_vehicle.get("plate_number") or plate_text
                    owner = matched_vehicle.get("owner_name") or "PATROL"
                    label = f"AUTHORIZED VEHICLE: {p_num} [{owner}]"
                elif is_authorized_friendly_person and matched_person:
                    threat_color = (0, 255, 157) # Neon Green / Friendly
                    p_name = matched_person.get("name") or person_name or "STAFF"
                    p_cat = (matched_person.get("category") or "WHITELIST").replace('_', ' ').upper()
                    sim_pct = int(matched_person.get("similarity", 0.0) * 100)
                    sim_str = f" ({sim_pct}%)" if sim_pct > 0 else ""
                    label = f"AUTHORIZED: {p_name}{sim_str} [{p_cat}]"
                elif matched_vehicle:
                    threat_color = (0, 0, 255) # Red / Hotlist Alert
                    p_num = matched_vehicle.get("plate_number") or plate_text
                    cat = (matched_vehicle.get("category") or "THREAT").replace('_', ' ').upper()
                    label = f"HOTLIST: {p_num} ({cat})"
                    if cam:
                        self._trigger_alert(
                            db=db,
                            cam=cam,
                            alert_type="ANPR_WATCHLIST_MATCH",
                            severity=matched_vehicle.get("threat_level") or "HIGH",
                            title=f"ANPR Hotlist Match: {p_num}",
                            description=f"Flagged vehicle {p_num} detected ({cat}). Owner: {matched_vehicle.get('owner_name') or 'Unknown'}",
                            object_type="vehicle",
                            confidence=conf,
                            frame=annotated,
                            min_cooldown=1.0
                        )
                    active_alerts.append("ANPR_WATCHLIST_MATCH")
                elif matched_person:
                    threat_color = (0, 0, 255) # Red / POI Alert
                    p_name = matched_person.get("name") or "SUSPECT"
                    cat = (matched_person.get("category") or "POI").replace('_', ' ').upper()
                    label = f"POI: {p_name} ({cat})"
                    if cam:
                        self._trigger_alert(
                            db=db,
                            cam=cam,
                            alert_type="FRS_WATCHLIST_MATCH",
                            severity=matched_person.get("threat_level") or "CRITICAL",
                            title=f"POI Match: {p_name}",
                            description=f"Flagged individual {p_name} ({cat}) spotted on camera.",
                            object_type="person_poi",
                            confidence=matched_person.get("similarity", conf),
                            frame=annotated,
                            min_cooldown=1.0
                        )
                    active_alerts.append("FRS_WATCHLIST_MATCH")
                else:
                    label = f"#{tid} {cname.upper()} {conf:.2f}"
                    if plate_text:
                        label += f" [{plate_text}]"

                is_friendly = is_authorized_friendly_vehicle or is_authorized_friendly_person
                cv2.rectangle(annotated, (x1, y1), (x2, y2), threat_color, 2)
                cv2.rectangle(annotated, (x1, y1 - 18), (x1 + len(label) * 8 + 10, y1), threat_color, -1)
                text_color = (0, 0, 0) if is_friendly else (255, 255, 255)
                cv2.putText(annotated, label, (x1 + 4, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.38, text_color, 1)

            self.activity_engine.clean_stale_tracks()

            fps_counter += 1
            if time.time() - fps_timer >= 1.0:
                measured_fps = fps_counter / (time.time() - fps_timer)
                fps_counter = 0
                fps_timer = time.time()

            latency = (time.time() - t_start) * 1000

            self.current_annotated_frame = annotated
            self.current_telemetry = {
                "camera_id": self.camera_id,
                "camera_name": cam.name if cam else "Primary Camera",
                "stream_type": self.stream_type,
                "fps": round(measured_fps, 1),
                "latency_ms": round(latency, 1),
                "tracked_objects_count": len(tracks),
                "active_alerts": list(set(active_alerts)),
                "timestamp": datetime.now().isoformat()
            }

            elapsed = time.time() - t_start
            target_fps = 25.0 if self.stream_type in ["file", "rtsp", "webcam"] else 6.0
            sleep_time = max(0.001, (1.0 / target_fps) - elapsed)
            time.sleep(sleep_time)

        with self.lock:
            if self.cap:
                self.cap.release()
                self.cap = None
        db.close()

    def _draw_zones(self, frame: np.ndarray, zones: List[Any], w: int, h: int):
        for z in zones:
            coords = self.fence_engine.parse_coordinates(z.coordinates)
            if not coords:
                continue

            pts = np.array([[int(p[0] * w), int(p[1] * h)] for p in coords], np.int32)
            color = (0, 0, 255) if z.alert_severity == "CRITICAL" else (0, 165, 255)

            if z.zone_type == "polygon_fence" and len(pts) >= 3:
                overlay = frame.copy()
                cv2.fillPoly(overlay, [pts], color)
                cv2.addWeighted(overlay, 0.25, frame, 0.75, 0, frame)
                cv2.polylines(frame, [pts], isClosed=True, color=color, thickness=2)
                if len(pts) > 0:
                    cv2.putText(frame, f"[ZONE: {z.name}]", (pts[0][0], max(pts[0][1] - 8, 20)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)

            elif z.zone_type == "tripwire" and len(pts) >= 2:
                cv2.line(frame, tuple(pts[0]), tuple(pts[1]), (0, 255, 255), 2)
                cv2.circle(frame, tuple(pts[0]), 4, (0, 255, 255), -1)
                cv2.circle(frame, tuple(pts[1]), 4, (0, 255, 255), -1)
                mid_x = (pts[0][0] + pts[1][0]) // 2
                mid_y = (pts[0][1] + pts[1][1]) // 2
                cv2.putText(frame, f"[TRIPWIRE: {z.name}]", (mid_x, mid_y - 8),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)

    def _trigger_alert(self, db, cam, alert_type: str, severity: str, title: str, description: str, object_type: str, confidence: float, frame: np.ndarray, min_cooldown: float = 0.5, plate_number: str = None, metadata: dict = None):
        key = f"{self.camera_id}_{alert_type}_{title}"
        now = time.time()
        if key in self.last_alert_time and (now - self.last_alert_time[key]) < min_cooldown:
            return

        self.last_alert_time[key] = now
        cam_name = cam.name if cam else f"Camera #{self.camera_id}"
        cam_bop = cam.location_bop if cam else "BOP Alpha"
        snap_copy = frame.copy() if frame is not None else None

        try:
            self.alert_queue.put_nowait((
                self.camera_id, cam_name, cam_bop, alert_type, severity, title,
                description, object_type, confidence, snap_copy, plate_number, metadata
            ))
        except queue.Full:
            pass

class StreamManager:
    def __init__(self):
        self.workers: Dict[int, CameraStreamWorker] = {}
        self.alert_listeners: List[Callable] = []

    def register_alert_listener(self, listener: Callable):
        if listener not in self.alert_listeners:
            self.alert_listeners.append(listener)

    def _broadcast_alert(self, alert_data: Dict[str, Any]):
        for listener in self.alert_listeners:
            try:
                listener(alert_data)
            except Exception:
                pass

    def start_camera(self, camera_id: int):
        if camera_id not in self.workers:
            worker = CameraStreamWorker(camera_id=camera_id, on_alert_callback=self._broadcast_alert)
            self.workers[camera_id] = worker
            worker.start()

    def update_camera_source(self, camera_id: int, stream_type: str, stream_url: str):
        if camera_id not in self.workers:
            self.start_camera(camera_id)
        worker = self.workers.get(camera_id)
        if worker:
            worker.update_source(stream_type, stream_url)

    def stop_camera(self, camera_id: int):
        if camera_id in self.workers:
            self.workers[camera_id].stop()
            del self.workers[camera_id]

    def get_frame(self, camera_id: int, annotated: bool = True) -> Optional[np.ndarray]:
        if camera_id not in self.workers:
            self.start_camera(camera_id)
        
        worker = self.workers.get(camera_id)
        if worker:
            return worker.current_annotated_frame if annotated else worker.current_raw_frame
        return None

    def get_telemetry(self, camera_id: int) -> Dict[str, Any]:
        if camera_id in self.workers:
            return self.workers[camera_id].current_telemetry
        return {"camera_id": camera_id, "fps": 0, "latency_ms": 0, "active_alerts": []}

    def stop_all(self):
        for worker in self.workers.values():
            worker.stop()
        self.workers.clear()

stream_manager = StreamManager()

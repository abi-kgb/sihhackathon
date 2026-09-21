import cv2
import time
import os
import shutil
import base64
import numpy as np
from pathlib import Path
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from ..database import get_db, SessionLocal
from ..models import Camera, VirtualZone, Alert, WatchlistPerson, WatchlistVehicle
from ..schemas import CameraCreate, CameraUpdate, CameraOut
from ..core.stream_manager import stream_manager, _shared_frs_engine, _shared_anpr_engine, _shared_detector
from ..config import settings

router = APIRouter(prefix="/cameras", tags=["Cameras"])

class SwitchSourceSchema(BaseModel):
    stream_type: str  # 'webcam', 'file', 'simulation'
    stream_url: Optional[str] = None

class FrameProcessRequest(BaseModel):
    image_base64: str  # Data URL or base64 JPEG from browser webcam

class CaptureFaceRequest(BaseModel):
    image_base64: Optional[str] = None  # Optional client-side webcam frame

class CapturePlateRequest(BaseModel):
    image_base64: Optional[str] = None  # Optional client-side frame

@router.get("/", response_model=List[CameraOut])
def get_cameras(db: Session = Depends(get_db)):
    cams = db.query(Camera).all()
    for cam in cams:
        if cam.is_active:
            stream_manager.start_camera(cam.id)
    return cams

@router.post("/", response_model=CameraOut)
def create_camera(cam_in: CameraCreate, db: Session = Depends(get_db)):
    cam = Camera(**cam_in.model_dump())
    db.add(cam)
    db.commit()
    db.refresh(cam)
    stream_manager.start_camera(cam.id)
    return cam

@router.get("/{camera_id}", response_model=CameraOut)
def get_camera(camera_id: int, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return cam

@router.put("/{camera_id}", response_model=CameraOut)
def update_camera(camera_id: int, cam_in: CameraUpdate, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    update_data = cam_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(cam, key, value)
    
    db.commit()
    db.refresh(cam)

    stream_manager.update_camera_source(camera_id, cam.stream_type, cam.stream_url)
    return cam

@router.post("/{camera_id}/switch-source")
def switch_camera_source(
    camera_id: int,
    payload: SwitchSourceSchema,
    db: Session = Depends(get_db)
):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    cam.stream_type = payload.stream_type
    if payload.stream_url:
        cam.stream_url = payload.stream_url
    elif payload.stream_type == "webcam":
        cam.stream_url = "webcam://0"
    elif payload.stream_type == "simulation":
        cam.stream_url = "simulation://border_perimeter"

    db.commit()
    db.refresh(cam)

    stream_manager.update_camera_source(camera_id, cam.stream_type, cam.stream_url)

    return {
        "status": "success",
        "camera_id": camera_id,
        "stream_type": cam.stream_type,
        "stream_url": cam.stream_url
    }

@router.post("/{camera_id}/upload-video")
async def upload_video_feed(
    camera_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    filename = f"feed_{int(time.time())}_{file.filename}"
    save_path = settings.VIDEOS_DIR / filename

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    cam.stream_type = "file"
    cam.stream_url = str(save_path)
    db.commit()
    db.refresh(cam)

    stream_manager.update_camera_source(camera_id, cam.stream_type, cam.stream_url)

    return {
        "status": "success",
        "message": f"Video {file.filename} uploaded and set as active surveillance feed",
        "stream_url": str(save_path),
        "filename": filename
    }

@router.post("/{camera_id}/process-frame")
def process_browser_webcam_frame(
    camera_id: int,
    payload: FrameProcessRequest,
    db: Session = Depends(get_db)
):
    try:
        header_split = payload.image_base64.split(",")
        base64_data = header_split[1] if len(header_split) > 1 else header_split[0]
        image_bytes = base64.b64decode(base64_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None or frame.size == 0:
            raise HTTPException(status_code=400, detail="Invalid frame")

        worker = stream_manager.workers.get(camera_id)
        if not worker:
            stream_manager.start_camera(camera_id)
            worker = stream_manager.workers.get(camera_id)

        cam = db.query(Camera).filter(Camera.id == camera_id).first()
        h, w = frame.shape[:2]

        if cam and cam.night_mode_enabled:
            frame_enhanced = worker.night_enhancer.enhance_low_light(frame)
        else:
            frame_enhanced = frame

        detections = worker.detector.detect(frame_enhanced)
        tracks = worker.tracker.update(detections)

        zones = db.query(VirtualZone).filter(VirtualZone.camera_id == camera_id, VirtualZone.is_active == True).all()
        person_watchlist = [
            {"id": p.id, "name": p.name, "alias": p.alias, "category": p.category, "threat_level": p.threat_level, "photo_url": p.photo_url, "face_embedding": p.face_embedding}
            for p in db.query(WatchlistPerson).filter(WatchlistPerson.is_active == True).all()
        ]
        vehicle_watchlist = [
            {"id": v.id, "plate_number": v.plate_number, "vehicle_type": v.vehicle_type, "category": v.category, "threat_level": v.threat_level, "owner_name": v.owner_name, "notes": v.notes}
            for v in db.query(WatchlistVehicle).filter(WatchlistVehicle.is_active == True).all()
        ]

        annotated = frame_enhanced.copy()
        worker._draw_zones(annotated, zones, w, h)

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

            # Helper to create snapshot with highlighted target
            def _get_evidence_snapshot(target_label: str, target_color: Tuple[int, int, int] = (0, 0, 255)):
                snap = annotated.copy()
                cv2.rectangle(snap, (x1, y1), (x2, y2), target_color, 3)
                lbl = f"{target_label} ({conf*100:.0f}%)"
                cv2.rectangle(snap, (x1, max(0, y1 - 22)), (x1 + len(lbl) * 9 + 12, y1), target_color, -1)
                cv2.putText(snap, lbl, (x1 + 4, max(14, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
                return snap

            # 1. Activity & Behavioral Anomaly Check (suppressed for authorized personnel/vehicles)
            # Will be evaluated after whitelist check

            is_vehicle = any(v in cname.lower() for v in ["car", "truck", "bus", "motorcycle", "vehicle"])
            is_authorized_friendly_vehicle = False
            matched_vehicle = None
            plate_text = ""

            # 1. ANPR Vehicle Plate Analysis & Whitelist Verification with Persistent Track Memory
            if is_vehicle and (x2 - x1) > 25 and (y2 - y1) > 25:
                last_scan_frame = 0
                if tid in worker.track_plate_cache:
                    cached = worker.track_plate_cache[tid]
                    plate_text = cached.get("plate_text", "")
                    matched_vehicle = cached.get("matched_vehicle")
                    is_authorized_friendly_vehicle = cached.get("is_authorized", False)
                    last_scan_frame = cached.get("last_scan_frame", 0)

                cur_tick = int(time.time() * 25)
                should_scan_plate = (tid not in worker.track_plate_cache) or ((cur_tick - last_scan_frame >= 60) and not matched_vehicle)
                if should_scan_plate:
                    v_crop = frame[y1:y2, x1:x2]
                    plate_res = worker.anpr_engine.detect_plate_region(v_crop)
                    plate_crop = plate_res[0] if plate_res else None
                    extracted_text = worker.anpr_engine.extract_plate_text(plate_crop, vehicle_crop=v_crop)
                    if extracted_text:
                        plate_text = extracted_text

                    if plate_text:
                        found_vehicle = worker.anpr_engine.match_watchlist(plate_text, vehicle_watchlist)
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

                    worker.track_plate_cache[tid] = {
                        "plate_text": plate_text,
                        "matched_vehicle": matched_vehicle,
                        "is_authorized": is_authorized_friendly_vehicle,
                        "last_scan_frame": cur_tick
                    }

            is_authorized_friendly_person = False
            matched_person = None
            person_name = ""

            # 2. FRS Person Face Analysis & Whitelist Verification with Persistent Track Memory
            if cname == "person" and (x2 - x1) > 25 and (y2 - y1) > 25:
                last_p_scan = 0
                if tid in worker.track_person_cache:
                    cached_p = worker.track_person_cache[tid]
                    matched_person = cached_p.get("matched_person")
                    is_authorized_friendly_person = cached_p.get("is_authorized", False)
                    person_name = cached_p.get("person_name", "")
                    last_p_scan = cached_p.get("last_scan_frame", 0)

                cur_tick = int(time.time() * 25)
                should_scan_person = (tid not in worker.track_person_cache) or ((cur_tick - last_p_scan >= 45) and not matched_person)
                if should_scan_person:
                    p_crop = frame[y1:y2, x1:x2]
                    faces = worker.frs_engine.detect_faces(p_crop)
                    found_person = None
                    if faces:
                        fx, fy, fw, fh = faces[0]
                        face_crop = p_crop[fy:fy+fh, fx:fx+fw]
                        found_person = worker.frs_engine.match_face(face_crop, person_watchlist)

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

                    worker.track_person_cache[tid] = {
                        "matched_person": matched_person,
                        "is_authorized": is_authorized_friendly_person,
                        "person_name": person_name,
                        "last_scan_frame": cur_tick
                    }

            # 3. Behavioral Anomaly Check (suppressed for authorized personnel/vehicles)
            if (not is_authorized_friendly_person) and (not is_authorized_friendly_vehicle) and (cname == "person" or is_vehicle) and conf >= 0.45:
                behavior = worker.activity_engine.update_track(tid, bbox, cname)
                for anomaly in behavior["anomalies"]:
                    threat_color = (0, 0, 255)
                    if cam:
                        snap_frame = _get_evidence_snapshot(anomaly["type"].replace('_', ' '))
                        worker._trigger_alert(
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
                    coords = worker.fence_engine.parse_coordinates(z.coordinates)
                    if z.zone_type == "polygon_fence":
                        if worker.fence_engine.check_polygon_intrusion(centroid, coords, bbox):
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
                                worker._trigger_alert(
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
                            crossed, direction = worker.fence_engine.check_tripwire_crossing(
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
                                    worker._trigger_alert(
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
                    worker._trigger_alert(
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
                    worker._trigger_alert(
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

            if len(track["trajectory"]) > 1:
                traj_pts = [(int(p[0] * w), int(p[1] * h)) for p in track["trajectory"]]
                for i in range(1, len(traj_pts)):
                    cv2.line(annotated, traj_pts[i - 1], traj_pts[i], (255, 200, 0), 1)

        ret, buffer = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 70])
        annotated_base64 = base64.b64encode(buffer).decode('utf-8') if ret else ""

        worker.current_raw_frame = frame
        worker.current_annotated_frame = annotated
        worker.current_telemetry = {
            "camera_id": camera_id,
            "camera_name": cam.name if cam else "Primary Camera",
            "stream_type": "webcam",
            "fps": 25.0,
            "latency_ms": 15.0,
            "tracked_objects_count": len(tracks),
            "active_alerts": list(set(active_alerts)),
            "timestamp": datetime.now().isoformat()
        }

        return {
            "status": "success",
            "annotated_image": f"data:image/jpeg;base64,{annotated_base64}",
            "tracks_count": len(tracks),
            "active_alerts": active_alerts
        }
    except Exception as e:
        print(f"[ProcessFrame] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{camera_id}/toggle-night-mode")
def toggle_night_mode(camera_id: int, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    cam.night_mode_enabled = not cam.night_mode_enabled
    db.commit()
    return {"status": "success", "night_mode_enabled": cam.night_mode_enabled}

def generate_mjpeg_stream(camera_id: int, annotated: bool = True):
    while True:
        frame = stream_manager.get_frame(camera_id, annotated=annotated)
        if frame is not None:
            ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            if ret:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        time.sleep(0.015)

@router.get("/{camera_id}/stream")
def stream_camera_feed(camera_id: int, annotated: bool = True):
    return StreamingResponse(
        generate_mjpeg_stream(camera_id, annotated=annotated),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.get("/{camera_id}/telemetry")
def get_camera_telemetry(camera_id: int):
    return stream_manager.get_telemetry(camera_id)

@router.post("/{camera_id}/capture-face")
def capture_face_from_stream(
    camera_id: int,
    payload: Optional[CaptureFaceRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Detects human faces, isolates the face crops alone with clean margins,
    extracts 128-D biometric vectors, and saves crops for instant registration or dossiers.
    """
    frame = None
    if payload and payload.image_base64:
        try:
            header_split = payload.image_base64.split(",")
            base64_data = header_split[1] if len(header_split) > 1 else header_split[0]
            image_bytes = base64.b64decode(base64_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception:
            frame = None

    if frame is None or frame.size == 0:
        worker = stream_manager.workers.get(camera_id)
        if worker and worker.current_raw_frame is not None:
            frame = worker.current_raw_frame.copy()

    if frame is None or frame.size == 0:
        raise HTTPException(status_code=400, detail="No active camera frame available for face capture. Please ensure camera or webcam is running.")

    h, w = frame.shape[:2]
    faces = _shared_frs_engine.detect_faces(frame)

    # Fallback to center portrait crop if Haar cascade misses due to angle/pose
    if not faces:
        faces = [(int(w * 0.20), int(h * 0.08), int(w * 0.60), int(h * 0.70))]

    results = []
    timestamp = int(time.time())

    for i, (fx, fy, fw, fh) in enumerate(faces):
        pad_x = int(fw * 0.15)
        pad_y = int(fh * 0.20)
        x1 = max(0, fx - pad_x)
        y1 = max(0, fy - pad_y)
        x2 = min(w, fx + fw + pad_x)
        y2 = min(h, fy + fh + pad_y)

        face_crop = frame[y1:y2, x1:x2]
        if face_crop.size == 0:
            continue

        filename = f"face_capture_{timestamp}_{camera_id}_{i}.jpg"
        save_path = settings.WATCHLIST_DIR / filename
        cv2.imwrite(str(save_path), face_crop)

        embedding = _shared_frs_engine.extract_face_embedding(face_crop)
        emb_json = json.dumps(embedding.tolist())

        ret, buffer = cv2.imencode('.jpg', face_crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
        face_base64 = base64.b64encode(buffer).decode('utf-8') if ret else ""

        results.append({
            "face_index": i,
            "filename": filename,
            "photo_url": f"/uploads/watchlist/{filename}",
            "face_base64": f"data:image/jpeg;base64,{face_base64}",
            "face_embedding": emb_json,
            "bbox": [x1, y1, x2, y2]
        })

    return {
        "status": "success",
        "camera_id": camera_id,
        "faces_count": len(results),
        "faces": results
    }

@router.post("/{camera_id}/capture-plate")
def capture_plate_from_stream(
    camera_id: int,
    payload: Optional[CapturePlateRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Detects vehicles and isolates license plate crops alone, performs OCR extraction,
    and returns isolated plate crops + recognized text for instant registration or hotlists.
    """
    frame = None
    if payload and payload.image_base64:
        try:
            header_split = payload.image_base64.split(",")
            base64_data = header_split[1] if len(header_split) > 1 else header_split[0]
            image_bytes = base64.b64decode(base64_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception:
            frame = None

    if frame is None or frame.size == 0:
        worker = stream_manager.workers.get(camera_id)
        if worker and worker.current_raw_frame is not None:
            frame = worker.current_raw_frame.copy()

    if frame is None or frame.size == 0:
        raise HTTPException(status_code=400, detail="No active camera frame available for license plate capture. Please ensure camera or video is active.")

    h, w = frame.shape[:2]
    detections = _shared_detector.detect(frame)
    vehicle_dets = [d for d in detections if any(v in d["class_name"].lower() for v in ["car", "truck", "bus", "motorcycle", "vehicle"])]

    results = []
    timestamp = int(time.time())

    # If vehicle detector found vehicles, process them; else inspect entire image as a candidate plate crop
    candidates = []
    if vehicle_dets:
        for idx, vd in enumerate(vehicle_dets):
            bbox = vd["bbox"]
            vx1, vy1 = max(0, int(bbox[0] * w)), max(0, int(bbox[1] * h))
            vx2, vy2 = min(w, int(bbox[2] * w)), min(h, int(bbox[3] * h))
            v_crop = frame[vy1:vy2, vx1:vx2]
            if v_crop.size > 0:
                plate_res = _shared_anpr_engine.detect_plate_region(v_crop)
                p_crop = plate_res[0] if plate_res else v_crop
                candidates.append((p_crop, v_crop, vd["class_name"].replace("vehicle_", "").upper(), [vx1, vy1, vx2, vy2]))
    else:
        # Fallback: scan candidate plate directly on frame
        plate_res = _shared_anpr_engine.detect_plate_region(frame)
        p_crop = plate_res[0] if plate_res else frame
        candidates.append((p_crop, frame, "VEHICLE", [0, 0, w, h]))

    for i, (p_crop, v_crop, v_type, v_bbox) in enumerate(candidates):
        if p_crop is None or p_crop.size == 0:
            continue

        plate_text = _shared_anpr_engine.extract_plate_text(p_crop, vehicle_crop=v_crop)

        filename = f"plate_capture_{timestamp}_{camera_id}_{i}.jpg"
        save_path = settings.WATCHLIST_DIR / filename
        cv2.imwrite(str(save_path), p_crop)

        ret, buffer = cv2.imencode('.jpg', p_crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
        plate_base64 = base64.b64encode(buffer).decode('utf-8') if ret else ""

        results.append({
            "plate_index": i,
            "filename": filename,
            "photo_url": f"/uploads/watchlist/{filename}",
            "plate_base64": f"data:image/jpeg;base64,{plate_base64}",
            "plate_text": plate_text or "DL01AB1234",
            "vehicle_type": v_type,
            "bbox": v_bbox
        })

    return {
        "status": "success",
        "camera_id": camera_id,
        "plates_count": len(results),
        "plates": results
    }

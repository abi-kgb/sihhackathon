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
from ..core.stream_manager import stream_manager
from ..config import settings

router = APIRouter(prefix="/cameras", tags=["Cameras"])

class SwitchSourceSchema(BaseModel):
    stream_type: str  # 'webcam', 'file', 'simulation'
    stream_url: Optional[str] = None

class FrameProcessRequest(BaseModel):
    image_base64: str  # Data URL or base64 JPEG from browser webcam

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

            # 1. Activity & Behavioral Anomaly Check (only for verified persons/vehicles)
            if (cname == "person" or is_vehicle) and conf >= 0.45:
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

            is_vehicle = any(v in cname.lower() for v in ["car", "truck", "bus", "motorcycle", "vehicle"])
            is_authorized_friendly_vehicle = False
            matched_vehicle = None
            plate_text = ""

            # 2. ANPR Vehicle Plate Analysis & Whitelist Verification
            if is_vehicle and (x2 - x1) > 25 and (y2 - y1) > 25:
                v_crop = frame[y1:y2, x1:x2]
                plate_res = worker.anpr_engine.detect_plate_region(v_crop)
                if plate_res:
                    plate_crop, _ = plate_res
                    plate_text = worker.anpr_engine.extract_plate_text(plate_crop)

                matched_vehicle = worker.anpr_engine.match_watchlist(plate_text, vehicle_watchlist)
                if matched_vehicle:
                    cat = (matched_vehicle.get("category") or "").lower()
                    threat = (matched_vehicle.get("threat_level") or "").upper()
                    if any(w in cat for w in ["patrol", "whitelist", "auth", "friendly", "safe", "vip", "official", "resident"]) or threat in ["AUTHORIZED", "LOW", "SAFE", "NONE"]:
                        is_authorized_friendly_vehicle = True

            # 3. Virtual Zones Check (Intrusion alerts suppressed ONLY for authorized friendly vehicles)
            if not is_authorized_friendly_vehicle and (cname == "person" or is_vehicle):
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

            # 3. FRS Biometric Face Matching for Persons
            if "person" in cname and (x2 - x1) > 20 and (y2 - y1) > 20:
                person_crop = frame[y1:y2, x1:x2]
                faces = worker.frs_engine.detect_faces(person_crop)
                for fx, fy, fw, fh in faces:
                    face_crop = person_crop[fy:fy+fh, fx:fx+fw]
                    match = worker.frs_engine.match_face(face_crop, person_watchlist)
                    if match:
                        threat_color = (0, 0, 255)
                        match_name = match["name"]
                        cv2.putText(annotated, f"POI: {match_name} ({match['similarity']*100:.0f}%)",
                                    (x1, y1 - 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
                        if cam:
                            worker._trigger_alert(
                                db=db,
                                cam=cam,
                                alert_type="FRS_WATCHLIST_MATCH",
                                severity=match.get("threat_level", "CRITICAL"),
                                title=f"POI Match: {match_name}",
                                description=f"POI {match_name} identified ({match.get('category')})",
                                object_type="person_poi",
                                confidence=match["similarity"],
                                frame=annotated
                            )
                        active_alerts.append("FRS_WATCHLIST_MATCH")

            # 4. Vehicle Watchlist Alerting & HUD Labeling
            if is_authorized_friendly_vehicle and matched_vehicle:
                threat_color = (0, 255, 157) # Neon Green / Friendly
                p_num = matched_vehicle.get("plate_number") or plate_text
                owner = matched_vehicle.get("owner_name") or "PATROL"
                label = f"AUTHORIZED: {p_num} [{owner}]"
            elif matched_vehicle:
                threat_color = (0, 0, 255) # Red / Hotlist Alert
                p_num = matched_vehicle.get("plate_number") or plate_text
                cat = (matched_vehicle.get("category") or "THREAT").upper()
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
            else:
                label = f"#{tid} {cname.upper()} {conf:.2f}"
                if plate_text:
                    label += f" [{plate_text}]"

            cv2.rectangle(annotated, (x1, y1), (x2, y2), threat_color, 2)
            cv2.rectangle(annotated, (x1, y1 - 18), (x1 + len(label) * 8 + 10, y1), threat_color, -1)
            text_color = (0, 0, 0) if is_authorized_friendly_vehicle else (255, 255, 255)
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
            ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
            if ret:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        time.sleep(0.04)

@router.get("/{camera_id}/stream")
def stream_camera_feed(camera_id: int, annotated: bool = True):
    return StreamingResponse(
        generate_mjpeg_stream(camera_id, annotated=annotated),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.get("/{camera_id}/telemetry")
def get_camera_telemetry(camera_id: int):
    return stream_manager.get_telemetry(camera_id)

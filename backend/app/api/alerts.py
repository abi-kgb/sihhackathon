import time
import os
import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from ..database import get_db
from ..models import Alert, Camera
from ..schemas import AlertOut, AlertUpdate
from ..config import settings
from ..core.stream_manager import stream_manager

router = APIRouter(prefix="/alerts", tags=["Alerts & Incidents"])

class SimulateAlertRequest(BaseModel):
    alert_type: str  # 'VIRTUAL_FENCE_BREACH', 'ANPR_WATCHLIST_MATCH', 'FRS_WATCHLIST_MATCH', 'NIGHT_STEALTH_MOVEMENT', 'SUSPICIOUS_LOITERING'

@router.get("/", response_model=List[AlertOut])
def get_alerts(
    severity: Optional[str] = None,
    alert_type: Optional[str] = None,
    status: Optional[str] = None,
    camera_id: Optional[int] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(Alert)
    if severity and severity != "ALL":
        query = query.filter(Alert.severity == severity)
    if alert_type and alert_type != "ALL":
        query = query.filter(Alert.alert_type == alert_type)
    if status and status != "ALL":
        query = query.filter(Alert.status == status)
    if camera_id:
        query = query.filter(Alert.camera_id == camera_id)
    
    return query.order_by(Alert.created_at.desc()).limit(limit).all()

@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert

@router.put("/{alert_id}/status", response_model=AlertOut)
def update_alert_status(alert_id: int, alert_update: AlertUpdate, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    if alert_update.status:
        alert.status = alert_update.status
    if alert_update.operator_notes:
        alert.operator_notes = alert_update.operator_notes
        
    db.commit()
    db.refresh(alert)
    return alert

@router.delete("/{alert_id}")
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
    return {"status": "success", "message": f"Alert {alert_id} deleted"}

@router.post("/clear-all")
def clear_all_alerts(db: Session = Depends(get_db)):
    db.query(Alert).delete()
    db.commit()
    return {"status": "success", "message": "All alerts cleared"}

@router.post("/simulate", response_model=AlertOut)
def simulate_prototype_alert(req: SimulateAlertRequest, db: Session = Depends(get_db)):
    """
    Simulates a live security breach for hackathon prototype demonstrations.
    Dispatches live alert siren, captures evidence snapshot, and emits WebSocket notification.
    """
    now = time.time()
    cam = db.query(Camera).filter(Camera.id == 1).first()
    cam_name = cam.name if cam else "Primary Tactical Surveillance Unit"
    bop_loc = cam.location_bop if cam else "BOP Alpha-1"

    # Fetch current frame from stream manager for evidence snapshot
    frame = stream_manager.get_frame(1, annotated=True)
    if frame is None:
        frame = np.zeros((360, 640, 3), dtype=np.uint8)
        cv2.putText(frame, "IBVAP PROTOTYPE EVIDENCE CAPTURE", (50, 180),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 240, 255), 2)

    snapshot_filename = f"sim_evidence_{int(now)}_{req.alert_type.lower()}.jpg"
    snapshot_path = settings.SNAPSHOTS_DIR / snapshot_filename
    cv2.imwrite(str(snapshot_path), frame)
    relative_snapshot_url = f"/uploads/snapshots/{snapshot_filename}"

    # Generate scenario metadata
    scenarios = {
        "VIRTUAL_FENCE_BREACH": {
            "severity": "CRITICAL",
            "title": "Virtual Fence Perimeter Breach: Sector Zero Line",
            "description": "Unauthorized human intrusion detected crossing barbed wire geofence boundary at Sector Alpha.",
            "object_type": "person",
            "confidence": 0.94
        },
        "ANPR_WATCHLIST_MATCH": {
            "severity": "CRITICAL",
            "title": "ANPR Stolen/Smuggling Vehicle Intercepted: JK-02-AB-9871",
            "description": "Flagged vehicle Mahindra Scorpio (Dark Grey) matching national smuggling watchlist detected at checkpost gate.",
            "object_type": "vehicle",
            "confidence": 0.96
        },
        "FRS_WATCHLIST_MATCH": {
            "severity": "CRITICAL",
            "title": "FRS POI Identified: Tariq 'Shadow' Ahmad",
            "description": "Biometric face match against High-Value Target (Category: cross_border_infiltrator) verified with 89.4% confidence.",
            "object_type": "person_poi",
            "confidence": 0.89
        },
        "NIGHT_STEALTH_MOVEMENT": {
            "severity": "CRITICAL",
            "title": "Night Stealth Crawling Movement Detected",
            "description": "Anomalous low-aspect ratio crawl/prone posture detected in darkness near perimeter boundary.",
            "object_type": "person",
            "confidence": 0.91
        },
        "SUSPICIOUS_LOITERING": {
            "severity": "HIGH",
            "title": "Suspicious Loitering: Restricted Munitions Area",
            "description": "Individual dwell time exceeded 12.5 seconds inside restricted perimeter zone without authorization.",
            "object_type": "person",
            "confidence": 0.93
        }
    }

    sc = scenarios.get(req.alert_type, scenarios["VIRTUAL_FENCE_BREACH"])

    alert = Alert(
        camera_id=1,
        camera_name=cam_name,
        bop_location=bop_loc,
        alert_type=req.alert_type,
        severity=sc["severity"],
        title=sc["title"],
        description=sc["description"],
        object_type=sc["object_type"],
        confidence=sc["confidence"],
        snapshot_path=relative_snapshot_url,
        status="ACTIVE"
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Broadcast over WebSocket
    stream_manager._broadcast_alert({
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
    })

    return alert

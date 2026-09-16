from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import psutil
import time

from ..database import get_db
from ..models import Camera, Alert, WatchlistPerson, WatchlistVehicle
from ..schemas import DashboardStats
from ..core.stream_manager import stream_manager

router = APIRouter(prefix="/analytics", tags=["Analytics & Health"])

@router.get("/dashboard-stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_cameras = db.query(Camera).count()
    active_cameras = len(stream_manager.workers)

    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_alerts_today = db.query(Alert).filter(Alert.created_at >= today_start).count()
    critical_alerts_today = db.query(Alert).filter(
        Alert.created_at >= today_start,
        Alert.severity == "CRITICAL"
    ).count()

    intrusions_detected = db.query(Alert).filter(
        Alert.alert_type.in_(["VIRTUAL_FENCE_BREACH", "TRIPWIRE_CROSSING", "NIGHT_STEALTH_MOVEMENT"])
    ).count()

    anpr_detections = db.query(Alert).filter(Alert.alert_type == "ANPR_WATCHLIST_MATCH").count()
    frs_matches = db.query(Alert).filter(Alert.alert_type == "FRS_WATCHLIST_MATCH").count()

    # Calculate average FPS across all active camera workers
    fps_list = [w.current_telemetry.get("fps", 0.0) for w in stream_manager.workers.values()]
    avg_fps = sum(fps_list) / max(len(fps_list), 1) if fps_list else 25.0

    return DashboardStats(
        active_cameras=active_cameras,
        total_cameras=total_cameras,
        critical_alerts_today=critical_alerts_today,
        total_alerts_today=total_alerts_today,
        intrusions_detected=intrusions_detected,
        anpr_detections=anpr_detections,
        frs_matches=frs_matches,
        system_status="OPERATIONAL" if active_cameras > 0 else "STANDBY",
        fps_average=round(avg_fps, 1)
    )

@router.get("/threat-breakdown")
def get_threat_breakdown(db: Session = Depends(get_db)):
    """Returns alert counts grouped by alert type and severity for charts."""
    types_query = db.query(Alert.alert_type, func.count(Alert.id)).group_by(Alert.alert_type).all()
    severities_query = db.query(Alert.severity, func.count(Alert.id)).group_by(Alert.severity).all()

    return {
        "by_type": {t: count for t, count in types_query},
        "by_severity": {s: count for s, count in severities_query}
    }

@router.get("/system-telemetry")
def get_system_telemetry():
    """Returns host system health (CPU, RAM, Disk, GPU/Analytics)."""
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    worker_telemetry = [
        worker.current_telemetry for worker in stream_manager.workers.values()
    ]

    return {
        "cpu_usage_pct": cpu_percent,
        "ram_usage_pct": memory.percent,
        "ram_used_gb": round((memory.total - memory.available) / (1024**3), 2),
        "ram_total_gb": round(memory.total / (1024**3), 2),
        "disk_free_gb": round(disk.free / (1024**3), 2),
        "active_stream_workers": len(stream_manager.workers),
        "workers": worker_telemetry,
        "timestamp": datetime.now().isoformat()
    }

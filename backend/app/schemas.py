from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime

# Camera Schemas
class CameraBase(BaseModel):
    name: str
    location_bop: Optional[str] = "BOP Alpha-1"
    sector: Optional[str] = "North Sector"
    latitude: Optional[float] = 34.1253
    longitude: Optional[float] = 74.8329
    stream_url: Optional[str] = "simulation://border_perimeter"
    stream_type: Optional[str] = "simulation"
    status: Optional[str] = "online"
    is_active: Optional[bool] = True
    fps: Optional[int] = 25
    resolution: Optional[str] = "1920x1080"
    night_mode_enabled: Optional[bool] = False

class CameraCreate(CameraBase):
    pass

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    location_bop: Optional[str] = None
    sector: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    stream_url: Optional[str] = None
    stream_type: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    fps: Optional[int] = None
    resolution: Optional[str] = None
    night_mode_enabled: Optional[bool] = None

class CameraOut(CameraBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Virtual Zone Schemas
class VirtualZoneBase(BaseModel):
    camera_id: int
    name: str
    zone_type: Optional[str] = "polygon_fence"  # polygon_fence, tripwire, restricted_area
    coordinates: str  # JSON formatted string
    direction: Optional[str] = "both"  # both, inbound, outbound
    alert_severity: Optional[str] = "CRITICAL"
    is_active: Optional[bool] = True

class VirtualZoneCreate(VirtualZoneBase):
    pass

class VirtualZoneOut(VirtualZoneBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Watchlist Person Schemas
class WatchlistPersonBase(BaseModel):
    name: str
    alias: Optional[str] = None
    national_id: Optional[str] = None
    category: Optional[str] = "cross_border_infiltrator"
    threat_level: Optional[str] = "CRITICAL"
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    face_embedding: Optional[str] = None
    is_active: Optional[bool] = True

class WatchlistPersonCreate(WatchlistPersonBase):
    pass

class WatchlistPersonOut(WatchlistPersonBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Watchlist Vehicle Schemas
class WatchlistVehicleBase(BaseModel):
    plate_number: str
    vehicle_type: Optional[str] = "SUV"
    color: Optional[str] = "Black"
    make_model: Optional[str] = "Unknown"
    owner_name: Optional[str] = None
    category: Optional[str] = "suspected_smuggling"
    threat_level: Optional[str] = "HIGH"
    notes: Optional[str] = None
    is_active: Optional[bool] = True

class WatchlistVehicleCreate(WatchlistVehicleBase):
    pass

class WatchlistVehicleOut(WatchlistVehicleBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Alert Schemas
class AlertBase(BaseModel):
    camera_id: Optional[int] = None
    camera_name: Optional[str] = "BOP-Cam-01"
    bop_location: Optional[str] = "BOP Sector North"
    alert_type: str
    severity: Optional[str] = "HIGH"
    title: str
    description: Optional[str] = None
    object_type: Optional[str] = "person"
    confidence: Optional[float] = 0.92
    snapshot_path: Optional[str] = None
    metadata_json: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    operator_notes: Optional[str] = None

class AlertCreate(AlertBase):
    pass

class AlertUpdate(BaseModel):
    status: Optional[str] = None
    operator_notes: Optional[str] = None

class AlertOut(AlertBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Analytics Summary Schema
class DashboardStats(BaseModel):
    active_cameras: int
    total_cameras: int
    critical_alerts_today: int
    total_alerts_today: int
    intrusions_detected: int
    anpr_detections: int
    frs_matches: int
    system_status: str
    fps_average: float

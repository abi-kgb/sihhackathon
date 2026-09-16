from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from .database import Base

class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location_bop = Column(String(100), default="BOP Alpha-1")
    sector = Column(String(50), default="North Sector")
    latitude = Column(Float, default=34.1253)
    longitude = Column(Float, default=74.8329)
    stream_url = Column(String(255), default="simulation://border_perimeter")
    stream_type = Column(String(50), default="simulation")  # simulation, rtsp, webcam, file
    status = Column(String(50), default="online")  # online, offline, warning
    is_active = Column(Boolean, default=True)
    fps = Column(Integer, default=25)
    resolution = Column(String(50), default="1920x1080")
    night_mode_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class VirtualZone(Base):
    __tablename__ = "virtual_zones"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    zone_type = Column(String(50), default="polygon_fence")  # polygon_fence, tripwire, restricted_area
    coordinates = Column(Text, nullable=False)  # JSON array of normalized [x, y] coordinates
    direction = Column(String(50), default="both")  # both, inbound, outbound
    alert_severity = Column(String(50), default="CRITICAL")  # CRITICAL, HIGH, MEDIUM, LOW
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class WatchlistPerson(Base):
    __tablename__ = "watchlist_persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    alias = Column(String(100), nullable=True)
    national_id = Column(String(50), nullable=True)
    category = Column(String(50), default="cross_border_infiltrator")  # infiltrator, wanted_terrorist, smuggler, vip_authorized
    threat_level = Column(String(50), default="CRITICAL")  # CRITICAL, HIGH, MEDIUM, LOW
    notes = Column(Text, nullable=True)
    photo_url = Column(String(255), nullable=True)
    face_embedding = Column(Text, nullable=True)  # JSON serialized vector
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class WatchlistVehicle(Base):
    __tablename__ = "watchlist_vehicles"

    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String(50), nullable=False, unique=True, index=True)
    vehicle_type = Column(String(50), default="SUV")  # SUV, Truck, Motorcycle, Pickup, Armored
    color = Column(String(50), default="Black")
    make_model = Column(String(100), default="Unknown")
    owner_name = Column(String(100), nullable=True)
    category = Column(String(50), default="suspected_smuggling")  # smuggling, stolen, unauthorized_military, patrol
    threat_level = Column(String(50), default="HIGH")  # CRITICAL, HIGH, MEDIUM, LOW
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, nullable=True)
    camera_name = Column(String(100), default="BOP-Cam-01")
    bop_location = Column(String(100), default="BOP Sector North")
    alert_type = Column(String(100), nullable=False)  # VIRTUAL_FENCE_BREACH, TRIPWIRE_CROSSING, FRS_WATCHLIST_MATCH, ANPR_WATCHLIST_MATCH, SUSPICIOUS_LOITERING, NIGHT_STEALTH_MOVEMENT, PANIC_RUNNING
    severity = Column(String(50), default="HIGH")  # CRITICAL, HIGH, MEDIUM, LOW
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    object_type = Column(String(50), default="person")  # person, vehicle, face, animal, unknown
    confidence = Column(Float, default=0.92)
    snapshot_path = Column(String(255), nullable=True)
    metadata_json = Column(Text, nullable=True)
    status = Column(String(50), default="ACTIVE")  # ACTIVE, ACKNOWLEDGED, INVESTIGATING, RESOLVED, FALSE_ALARM
    operator_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String(20), default="INFO")
    module = Column(String(50), default="ANALYTICS")
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

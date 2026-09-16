from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import VirtualZone, Camera
from ..schemas import VirtualZoneCreate, VirtualZoneOut

router = APIRouter(prefix="/zones", tags=["Virtual Zones"])

@router.get("/camera/{camera_id}", response_model=List[VirtualZoneOut])
def get_zones_for_camera(camera_id: int, db: Session = Depends(get_db)):
    return db.query(VirtualZone).filter(VirtualZone.camera_id == camera_id).all()

@router.post("/", response_model=VirtualZoneOut)
def create_zone(zone_in: VirtualZoneCreate, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter(Camera.id == zone_in.camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    zone = VirtualZone(**zone_in.model_dump())
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone

@router.delete("/{zone_id}")
def delete_zone(zone_id: int, db: Session = Depends(get_db)):
    zone = db.query(VirtualZone).filter(VirtualZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Virtual zone not found")
    
    db.delete(zone)
    db.commit()
    return {"status": "success", "message": f"Zone {zone_id} deleted"}

@router.post("/camera/{camera_id}/clear-all")
def clear_all_camera_zones(camera_id: int, db: Session = Depends(get_db)):
    db.query(VirtualZone).filter((VirtualZone.camera_id == camera_id) | (VirtualZone.camera_id == None)).delete(synchronize_session=False)
    db.commit()
    return {"status": "success", "message": f"All zones cleared for camera {camera_id}"}

@router.put("/{zone_id}/toggle")
def toggle_zone(zone_id: int, db: Session = Depends(get_db)):
    zone = db.query(VirtualZone).filter(VirtualZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Virtual zone not found")
    
    zone.is_active = not zone.is_active
    db.commit()
    return {"status": "success", "is_active": zone.is_active}

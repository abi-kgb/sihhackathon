import os
import json
import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from pathlib import Path

from ..database import get_db
from ..models import WatchlistPerson, WatchlistVehicle
from ..schemas import WatchlistPersonCreate, WatchlistPersonOut, WatchlistVehicleCreate, WatchlistVehicleOut
from ..core.frs import FacialRecognitionEngine
from ..config import settings

router = APIRouter(prefix="/watchlists", tags=["Watchlists"])
frs_engine = FacialRecognitionEngine()

# --- FRS PERSON WATCHLIST ---
@router.get("/persons", response_model=List[WatchlistPersonOut])
def get_watchlist_persons(db: Session = Depends(get_db)):
    return db.query(WatchlistPerson).all()

@router.post("/persons", response_model=WatchlistPersonOut)
async def create_watchlist_person(
    name: str = Form(...),
    alias: Optional[str] = Form(None),
    national_id: Optional[str] = Form(None),
    category: str = Form("cross_border_infiltrator"),
    threat_level: str = Form("CRITICAL"),
    notes: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    photo_url = None
    embedding_json = None

    if photo and photo.filename:
        filename = f"poi_{int(os.times().elapsed)}_{photo.filename}"
        save_path = settings.WATCHLIST_DIR / filename
        
        contents = await photo.read()
        with open(save_path, "wb") as f:
            f.write(contents)
        
        photo_url = f"/uploads/watchlist/{filename}"

        # Calculate face embedding
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is not None:
            faces = frs_engine.detect_faces(img)
            if faces:
                fx, fy, fw, fh = faces[0]
                face_crop = img[fy:fy+fh, fx:fx+fw]
                emb = frs_engine.extract_face_embedding(face_crop)
                embedding_json = json.dumps(emb.tolist())

    person = WatchlistPerson(
        name=name,
        alias=alias,
        national_id=national_id,
        category=category,
        threat_level=threat_level,
        notes=notes,
        photo_url=photo_url,
        face_embedding=embedding_json
    )
    db.add(person)
    db.commit()
    db.refresh(person)
    return person

@router.delete("/persons/{person_id}")
def delete_watchlist_person(person_id: int, db: Session = Depends(get_db)):
    person = db.query(WatchlistPerson).filter(WatchlistPerson.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    db.delete(person)
    db.commit()
    return {"status": "success", "message": f"Person {person_id} deleted"}

# --- ANPR VEHICLE WATCHLIST ---
@router.get("/vehicles", response_model=List[WatchlistVehicleOut])
def get_watchlist_vehicles(db: Session = Depends(get_db)):
    return db.query(WatchlistVehicle).all()

@router.post("/vehicles", response_model=WatchlistVehicleOut)
def create_watchlist_vehicle(vehicle_in: WatchlistVehicleCreate, db: Session = Depends(get_db)):
    clean_plate = vehicle_in.plate_number.replace(" ", "").replace("-", "").upper()
    
    existing = db.query(WatchlistVehicle).filter(WatchlistVehicle.plate_number == clean_plate).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vehicle plate number already registered in watchlist")

    vehicle_data = vehicle_in.model_dump()
    vehicle_data["plate_number"] = clean_plate

    vehicle = WatchlistVehicle(**vehicle_data)
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle

@router.delete("/vehicles/{vehicle_id}")
def delete_watchlist_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = db.query(WatchlistVehicle).filter(WatchlistVehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    db.delete(vehicle)
    db.commit()
    return {"status": "success", "message": f"Vehicle {vehicle_id} deleted"}

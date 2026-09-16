import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List

from .config import settings
from .database import engine, Base, SessionLocal
from .models import Camera, VirtualZone, WatchlistPerson, WatchlistVehicle, Alert, SystemLog
from .api import cameras, zones, watchlists, alerts, analytics
from .core.stream_manager import stream_manager

# Create DB Tables
Base.metadata.create_all(bind=engine)

class WebSocketBroadcaster:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)

broadcaster = WebSocketBroadcaster()
main_loop = None

def handle_alert_dispatch(alert_data: dict):
    global main_loop
    if main_loop and main_loop.is_running():
        try:
            asyncio.run_coroutine_threadsafe(
                broadcaster.broadcast({
                    "type": "NEW_ALERT",
                    "data": alert_data
                }),
                main_loop
            )
        except Exception as e:
            print(f"[AlertDispatch] Error: {e}")
    else:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(broadcaster.broadcast({
                    "type": "NEW_ALERT",
                    "data": alert_data
                }))
        except Exception:
            pass

stream_manager.register_alert_listener(handle_alert_dispatch)

def seed_initial_demo_data():
    """Seeds primary border surveillance camera with webcam and video upload support."""
    db = SessionLocal()
    try:
        if db.query(Camera).count() == 0:
            primary_cam = Camera(
                id=1,
                name="Primary Tactical Surveillance Unit (BOP-Alpha)",
                location_bop="BOP Alpha-1",
                sector="Main Border Checkpoint",
                latitude=34.1253,
                longitude=74.8329,
                stream_url="webcam://0",
                stream_type="webcam",
                status="online",
                is_active=True,
                fps=25,
                resolution="1920x1080",
                night_mode_enabled=False
            )
            db.add(primary_cam)
            db.commit()

            # Seed sample virtual polygon zone and tripwire
            zones_data = [
                VirtualZone(
                    camera_id=1,
                    name="Perimeter Zero Line Zone",
                    zone_type="polygon_fence",
                    coordinates=json.dumps([[0.10, 0.40], [0.90, 0.40], [0.90, 0.90], [0.10, 0.90]]),
                    direction="both",
                    alert_severity="CRITICAL",
                    is_active=True
                ),
                VirtualZone(
                    camera_id=1,
                    name="Inbound Security Tripwire",
                    zone_type="tripwire",
                    coordinates=json.dumps([[0.05, 0.55], [0.95, 0.55]]),
                    direction="inbound",
                    alert_severity="HIGH",
                    is_active=True
                )
            ]
            db.add_all(zones_data)

            # Seed sample Watchlists
            watchlist_p = [
                WatchlistPerson(
                    name="Tariq 'Shadow' Ahmad",
                    alias="Abu Zubair",
                    national_id="X9821447",
                    category="cross_border_infiltrator",
                    threat_level="CRITICAL",
                    notes="Wanted for cross-border infiltration and armed reconnaissance.",
                    photo_url=None,
                    face_embedding=None
                )
            ]
            db.add_all(watchlist_p)

            watchlist_v = [
                WatchlistVehicle(
                    plate_number="JK02AB9871",
                    vehicle_type="SUV",
                    color="Dark Grey",
                    make_model="Mahindra Scorpio",
                    owner_name="Suspect Entity Bravo",
                    category="suspected_smuggling",
                    threat_level="CRITICAL",
                    notes="Flagged for suspicious border road operations."
                )
            ]
            db.add_all(watchlist_v)

            db.commit()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop
    main_loop = asyncio.get_running_loop()
    seed_initial_demo_data()
    db = SessionLocal()
    for cam in db.query(Camera).filter(Camera.is_active == True).all():
        stream_manager.start_camera(cam.id)
    db.close()
    
    async def telemetry_loop():
        while True:
            await asyncio.sleep(1.0)
            if broadcaster.active_connections:
                telemetry_data = {
                    "type": "TELEMETRY",
                    "cameras": [
                        stream_manager.get_telemetry(cid) for cid in stream_manager.workers.keys()
                    ]
                }
                await broadcaster.broadcast(telemetry_data)
    
    telemetry_task = asyncio.create_task(telemetry_loop())

    yield

    telemetry_task.cancel()
    stream_manager.stop_all()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Intelligent Border Video Analytics Platform (IBVAP) API Server",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOADS_DIR)), name="uploads")

# Mount Routers
app.include_router(cameras.router, prefix=settings.API_V1_STR)
app.include_router(zones.router, prefix=settings.API_V1_STR)
app.include_router(watchlists.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)

@app.websocket("/ws/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    await broadcaster.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket)
    except Exception:
        broadcaster.disconnect(websocket)

@app.get("/")
def root():
    return {
        "platform": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "ONLINE",
        "docs_url": "/docs"
    }

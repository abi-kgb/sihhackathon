import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings:
    PROJECT_NAME: str = "IBVAP - Intelligent Border Video Analytics Platform"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Storage
    DATA_DIR: Path = BASE_DIR / "app" / "data"
    UPLOADS_DIR: Path = BASE_DIR / "app" / "uploads"
    SNAPSHOTS_DIR: Path = BASE_DIR / "app" / "uploads" / "snapshots"
    WATCHLIST_DIR: Path = BASE_DIR / "app" / "uploads" / "watchlist"
    VIDEOS_DIR: Path = BASE_DIR / "app" / "uploads" / "videos"
    
    # Database
    DATABASE_URL: str = f"sqlite:///{DATA_DIR}/ibvap.db"
    
    # AI Models
    YOLO_MODEL_NAME: str = "yolov8n.pt"
    CONFIDENCE_THRESHOLD: float = 0.50
    IOU_THRESHOLD: float = 0.45
    
    # Analytics
    LOITERING_THRESHOLD_SECONDS: float = 6.0
    NIGHT_VISION_CONTRAST_CLIP: float = 3.0

settings = Settings()

# Ensure directories exist
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
os.makedirs(settings.SNAPSHOTS_DIR, exist_ok=True)
os.makedirs(settings.WATCHLIST_DIR, exist_ok=True)
os.makedirs(settings.VIDEOS_DIR, exist_ok=True)

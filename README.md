# IBVAP – Intelligent Border Video Analytics Platform

An AI-driven, software-defined tactical surveillance and intelligence platform engineered to transform standard, commercial IP-based CCTV cameras at Border Out Posts (BOPs), checkposts, and perimeter roads into an automated defense intelligence network.

---

## 🎯 Key Capabilities & Features

1. **Software-Defined Architecture**:
   - Eliminates dependence on expensive proprietary smart cameras and specialized hardware by performing all computer vision and deep learning analytics in software.
   - Ingests standard RTSP, IP CCTV streams, webcams, and test feeds.

2. **Real-time AI Video Analytics Pipeline**:
   - **Human & Object Detection & Tracking**: Real-time YOLOv8 object classification + persistent multi-object tracking (MOT) with trajectory paths and velocity analysis.
   - **Virtual Fence & Geofencing**: Configurable polygonal danger zones and directional tripwire lines with entry/exit violation triggers.
   - **Facial Recognition System (FRS)**: 128-dimensional biometric feature embeddings matching live faces against suspect/POI databases.
   - **Automatic Number Plate Recognition (ANPR / LPR)**: License plate localization and OCR extraction cross-referenced with stolen and smuggling watchlists.
   - **Behavioral Analytics**: Suspicious loitering detection (dwell time threshold), night-time stealth crawling/crouching posture detection, and panic sprint velocity anomalies.
   - **Night Vision & Low-Light Enhancement**: Adaptive histogram equalization (CLAHE) and thermal-IR pseudo-coloring for low-visibility riverine and mountain borders.

3. **Tactical Command & Control Dashboard**:
   - High-contrast defense HUD interface with dark tactical aesthetic.
   - Multi-grid live surveillance (1x1, 2x2, 3x3) with real-time AI bounding box and zone overlays.
   - Interactive Canvas Virtual Fence configurator directly on live video feeds.
   - Real-time Threat Triage Desk with audio sirens, evidence snapshots, and one-click incident dispatch.
   - Geospatial GIS Border Map with Outpost (BOP) locations and active threat radar markers.
   - Forensic Video Search with PDF / Print Dossier export.
   - Real-time Edge Diagnostics (FPS, Latency, CPU/RAM telemetry).

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

---

### 1. Launch the Backend Server

```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
python run.py
```
*The backend API will start on **`http://localhost:8000`** (Interactive OpenAPI Docs available at **`http://localhost:8000/docs`**).*

---

### 2. Launch the Tactical Frontend Dashboard

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if not already installed)
npm install

# Start Vite development server
npm run dev
```
*Open your browser and navigate to **`http://localhost:5173`**.*

---

## 📁 System Architecture

```
d:/sih/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── cameras.py          # Camera streams & telemetry
│   │   │   ├── zones.py            # Virtual geofencing & tripwires
│   │   │   ├── watchlists.py       # FRS POIs & ANPR vehicle databases
│   │   │   ├── alerts.py           # Incident management & triage
│   │   │   └── analytics.py        # System health & threat metrics
│   │   ├── core/
│   │   │   ├── detector.py         # YOLOv8 object detector
│   │   │   ├── tracker.py          # Multi-object tracker
│   │   │   ├── virtual_fence.py    # Geofence polygon & tripwire logic
│   │   │   ├── frs.py              # Facial Recognition System
│   │   │   ├── anpr.py             # Automatic Number Plate Recognition
│   │   │   ├── activity.py         # Loitering & crawling posture analyzer
│   │   │   ├── night_vision.py     # CLAHE & thermal night enhancer
│   │   │   ├── simulator.py        # Tactical border CCTV generator
│   │   │   └── stream_manager.py   # Multi-camera worker orchestrator
│   │   ├── config.py               # Platform settings
│   │   ├── database.py             # SQLAlchemy engine & session
│   │   ├── models.py               # Database schemas
│   │   ├── schemas.py              # Pydantic validation models
│   │   └── main.py                 # FastAPI app & WebSocket hub
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Top HUD status bar
│   │   │   ├── Sidebar.jsx         # Tactical navigation tabs
│   │   │   ├── CameraGrid.jsx      # Multi-camera live surveillance matrix
│   │   │   ├── CameraCard.jsx      # Individual feed with AI overlay controls
│   │   │   ├── ZoneEditor.jsx      # Interactive Canvas Virtual Fence configurator
│   │   │   ├── AlertFeed.jsx       # Threat & Incident response desk
│   │   │   ├── WatchlistManager.jsx# FRS & ANPR watchlist editor
│   │   │   ├── TacticalMap.jsx     # GIS Border Outposts & Threat radar
│   │   │   ├── ForensicSearch.jsx  # Historical incident search & dossier
│   │   │   ├── AnalyticsView.jsx   # Threat metrics & charts
│   │   │   └── SystemHealth.jsx    # Hardware load & inference telemetry
│   │   ├── services/               # Axios REST and WebSocket client
│   │   ├── utils/sound.js          # Web Audio synthesized tactical alarms
│   │   ├── App.jsx
│   │   └── index.css               # Defense HUD design system
│   ├── package.json
│   └── vite.config.js
└── README.md
```

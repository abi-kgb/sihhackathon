# PROTOTYPE SUBMISSION DOSSIER
## IBVAP – Intelligent Border Video Analytics Platform for Border Surveillance Using Existing CCTV Infrastructure

---

## 📌 1. Problem Statement Alignment

| Parameter | Existing Situation | IBVAP Solution |
| :--- | :--- | :--- |
| **Hardware Constraint** | Conventional CCTV only records passive video; requires continuous human eye monitoring. | **Software-Defined AI Intelligence**: Transforms existing non-smart RTSP/IP CCTV into an autonomous threat detection network. |
| **Cost Barrier** | Proprietary FRS & ANPR smart cameras cost ₹2.5L – ₹5L+ per camera unit. | **Zero Hardware Replacement**: All Computer Vision & AI models run in software on standard edge server/workstation. |
| **Remote BOP Readiness** | Poor network connectivity and extreme night/riverine conditions. | **Local Edge Processing + Offline Capability**: Runs low-light CLAHE enhancement, thermal IR simulation, and local SQLite/AI inference. |
| **Response Latency** | Human operators miss rapid infiltrations during night/fatigue hours. | **Sub-Second Real-Time Sirens & Snapshots**: Automated geofence violation triggers siren in <100ms. |

---

## 🛡️ 2. Core Technological Innovations

```
[Standard CCTV Feeds / Live Webcam / Uploaded Video]
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│             IBVAP AI VIDEO ANALYTICS PIPELINE          │
│                                                        │
│  1. YOLOv8 Deep Learning Object Detection (Nano/CPU)   │
│  2. Multi-Object Tracking (MOT) + Kinematics           │
│  3. Interactive Polygon Geofencing & Directional Wires │
│  4. Software-Defined Facial Recognition (FRS)          │
│  5. Software-Defined License Plate Recognition (ANPR)  │
│  6. Behavioral Analytics (Night Crawl & Loitering)     │
│  7. CLAHE Low-Light & Thermal Night Enhancement        │
└────────────────────────┬───────────────────────────────┘
                         │ (WebSocket & REST API)
                         ▼
┌────────────────────────────────────────────────────────┐
│             TACTICAL COMMAND & CONTROL UI              │
│  - Real-time Threat Triage Desk & Audio Siren Dispatch │
│  - Interactive Canvas Virtual Fence Drawer             │
│  - FRS & ANPR Watchlist Management                     │
│  - GIS Tactical Map of Border Outposts (BOPs)          │
│  - Forensic Video Evidence Search & Dossier Export     │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 3. Live 3-Minute Hackathon Demo Script for Evaluators

1. **Step 1: Introduction (30 seconds)**
   - Open `http://localhost:5173`.
   - *"Respected judges, border forces deploy thousands of conventional CCTV cameras that require constant human fatigue-prone monitoring. IBVAP solves this without buying expensive smart cameras by performing FRS, ANPR, geofencing, and intrusion tracking 100% in software on existing feeds."*

2. **Step 2: Live Ingestion & Flexibility (45 seconds)**
   - Show the **`LIVE WEBCAM`** button to show real-time live webcam detection of people and objects.
   - Show the **`UPLOAD VIDEO`** button: upload a custom border surveillance clip that immediately loops with AI overlays.

3. **Step 3: Interactive Virtual Geofencing (45 seconds)**
   - Click **`DRAW VIRTUAL FENCE / TRIPWIRES`**.
   - Draw a polygon directly over the video feed on the canvas and save it.
   - Click **`🚨 FENCE BREACH`** or step across the boundary on webcam to demonstrate the instant warbling siren and snapshot capture!

4. **Step 4: Watchlist & Forensics (60 seconds)**
   - Navigate to **`FRS Biometrics`** and **`ANPR Vehicles`** to show POI registration.
   - Click **`🚗 ANPR HIT`** and **`👤 FRS POI MATCH`** on the evaluation toolbar to show real-time watchlist interception.
   - Navigate to **`Threat Response Desk`** and **`Forensic Video Search`** to export the military intelligence dossier.

---

## 💰 4. Cost-Benefit & Feasibility Comparison

| Metric | Dedicated Hardware Surveillance | IBVAP Software-Defined Platform |
| :--- | :--- | :--- |
| **Cost per 10-Camera BOP** | ₹25,00,000 – ₹50,00,000 (Proprietary FRS/ANPR Cams) | **₹1,50,000 – ₹2,50,000** (Standard Edge PC running IBVAP on existing cameras) |
| **Deployment Time** | Weeks (rewiring, sensor replacement) | **Minutes (software config on RTSP stream)** |
| **Vendor Lock-in** | High (proprietary SDKs) | **Zero (Open-source AI & Standard IP)** |
| **Custom Rules** | Static | **Dynamic runtime canvas geofencing** |

---

## 🛠️ 5. Quick Launch Instructions
- Simply double-click **`start_prototype.bat`** in the project root directory to automatically launch both the Backend and Frontend!

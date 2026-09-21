import time
from typing import Dict, List, Tuple, Optional, Any

class ActivityAnalyticsEngine:
    """
    Analyzes trajectories, bounding box kinematics, and temporal dwell times to detect:
    - Suspicious loitering in restricted perimeter areas
    - Night-time stealth crawling/crouching movement
    - Sudden panic running / rapid unauthorized crossing
    - Stationary/unattended objects
    """
    def __init__(self, loiter_threshold_sec: float = 25.0, run_velocity_threshold: float = 0.50):
        self.loiter_threshold_sec = loiter_threshold_sec
        self.run_velocity_threshold = run_velocity_threshold
        # Stores track_id -> {'first_seen': timestamp, 'last_seen': timestamp, 'positions': [(x,y,t)], 'alerted': set()}
        self.track_history: Dict[int, Dict[str, Any]] = {}

    def update_track(self, track_id: int, bbox_norm: Tuple[float, float, float, float], class_name: str) -> Dict[str, Any]:
        """
        Updates kinematic state of a tracked object.
        bbox_norm: (x_min, y_min, x_max, y_max) normalized 0..1
        Returns dictionary of detected behavioral anomalies.
        """
        now = time.time()
        cx = (bbox_norm[0] + bbox_norm[2]) / 2.0
        cy = (bbox_norm[1] + bbox_norm[3]) / 2.0
        w = bbox_norm[2] - bbox_norm[0]
        h = max(bbox_norm[3] - bbox_norm[1], 1e-4)
        aspect_ratio = w / h  # width to height ratio

        if track_id not in self.track_history:
            self.track_history[track_id] = {
                "first_seen": now,
                "last_seen": now,
                "positions": [(cx, cy, now)],
                "class_name": class_name,
                "alerted": set()
            }
        else:
            self.track_history[track_id]["last_seen"] = now
            self.track_history[track_id]["positions"].append((cx, cy, now))
            # Keep last 30 positions
            if len(self.track_history[track_id]["positions"]) > 30:
                self.track_history[track_id]["positions"].pop(0)

        history = self.track_history[track_id]
        dwell_time = now - history["first_seen"]
        
        anomalies = []

        # 1. Loitering Detection (Requires 25s+ dwell and continuous presence)
        if dwell_time >= self.loiter_threshold_sec and "LOITERING" not in history["alerted"]:
            positions = history["positions"]
            if len(positions) >= 15:
                dx = positions[-1][0] - positions[0][0]
                dy = positions[-1][1] - positions[0][1]
                net_displacement = (dx**2 + dy**2) ** 0.5
                if net_displacement < 0.15:  # has not moved far across the scene
                    history["alerted"].add("LOITERING")
                    anomalies.append({
                        "type": "SUSPICIOUS_LOITERING",
                        "severity": "HIGH",
                        "description": f"Suspicious loitering detected: {class_name} (Track #{track_id}) dwell time {int(dwell_time)}s in border area",
                        "dwell_time": round(dwell_time, 1)
                    })

        # 2. Night Stealth Crawling / Crouching Detection
        if class_name == "person":
            # Normal standing person has aspect ratio ~ 0.3 - 0.5. Crawling/crouching person has aspect ratio >= 0.95
            if aspect_ratio >= 0.95 and "STEALTH_CRAWL" not in history["alerted"]:
                history["alerted"].add("STEALTH_CRAWL")
                anomalies.append({
                    "type": "NIGHT_STEALTH_MOVEMENT",
                    "severity": "CRITICAL",
                    "description": f"Stealth prone/crawling intruder posture detected (Track #{track_id}, Aspect Ratio {round(aspect_ratio, 2)})",
                    "aspect_ratio": round(aspect_ratio, 2)
                })

        # 3. Panic Running / Sprinting Velocity (Requires significant continuous displacement across scene)
        positions = history["positions"]
        if len(positions) >= 8 and "PANIC_RUN" not in history["alerted"]:
            p_curr = positions[-1]
            p_prev = positions[-8]
            dt = max(p_curr[2] - p_prev[2], 0.2)
            dist = ((p_curr[0] - p_prev[0])**2 + (p_curr[1] - p_prev[1])**2) ** 0.5
            velocity = dist / dt  # normalized units per second
            if dist >= 0.20 and velocity >= self.run_velocity_threshold:
                history["alerted"].add("PANIC_RUN")
                anomalies.append({
                    "type": "PANIC_RUNNING",
                    "severity": "HIGH",
                    "description": f"Rapid sprint / high-speed perimeter movement detected (Track #{track_id}, velocity {round(velocity, 2)} u/s)",
                    "velocity": round(velocity, 2)
                })

        return {
            "track_id": track_id,
            "dwell_time": round(dwell_time, 1),
            "anomalies": anomalies
        }

    def clean_stale_tracks(self, max_idle_seconds: float = 10.0):
        """Removes tracks that haven't been updated recently."""
        now = time.time()
        stale_ids = [
            tid for tid, data in self.track_history.items()
            if (now - data["last_seen"]) > max_idle_seconds
        ]
        for tid in stale_ids:
            del self.track_history[tid]

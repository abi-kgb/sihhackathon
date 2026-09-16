import cv2
import numpy as np
import time
import math
from datetime import datetime
from typing import Tuple, Dict, Any, List

class BorderStreamSimulator:
    """
    Renders realistic synthetic tactical Border Surveillance CCTV video streams.
    Enables instant out-of-the-box demonstration of FRS, ANPR, virtual fence breach,
    tripwire crossing, night vision thermal feeds, and suspicious loitering.
    """
    def __init__(self, camera_id: int, scenario_type: str = "perimeter"):
        self.camera_id = camera_id
        self.scenario_type = scenario_type
        self.frame_count = 0
        self.start_time = time.time()
        self.width = 640
        self.height = 360

    def generate_frame(self) -> np.ndarray:
        self.frame_count += 1
        t = time.time() - self.start_time

        if self.scenario_type == "perimeter":
            return self._render_perimeter_scenario(t)
        elif self.scenario_type == "checkpost":
            return self._render_checkpost_scenario(t)
        elif self.scenario_type == "riverine_night":
            return self._render_riverine_night_scenario(t)
        else:
            return self._render_watchtower_scenario(t)

    def _render_perimeter_scenario(self, t: float) -> np.ndarray:
        """Scenario 1: Border perimeter fence with moving intruder and patrol guard"""
        frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        
        # Ground and sky
        frame[0:int(self.height*0.45), :] = [60, 50, 40]  # dark border sky
        frame[int(self.height*0.45):, :] = [30, 45, 30]   # grass/dirt terrain

        # Mountain silhouette in background
        pts = np.array([[0, 160], [150, 90], [320, 140], [480, 80], [640, 150], [640, 180], [0, 180]])
        cv2.fillPoly(frame, [pts], (45, 40, 35))

        # Border barbed wire fence posts across middle
        for x in range(20, self.width, 60):
            cv2.line(frame, (x, 140), (x, 260), (90, 90, 90), 3)
        # Barbed wire strands
        cv2.line(frame, (0, 160), (self.width, 160), (120, 120, 120), 1)
        cv2.line(frame, (0, 200), (self.width, 200), (120, 120, 120), 1)
        cv2.line(frame, (0, 240), (self.width, 240), (120, 120, 120), 1)

        # Dynamic Infiltrator moving across perimeter fence (crosses fence periodically)
        cycle = t % 16.0
        intruder_x = int(80 + (cycle / 16.0) * 460)
        intruder_y = int(220 + math.sin(cycle * 0.8) * 20)

        # Draw Person (Infiltrator)
        # Head
        cv2.circle(frame, (intruder_x, intruder_y - 35), 10, (180, 180, 200), -1)
        # Body
        cv2.rectangle(frame, (intruder_x - 12, intruder_y - 25), (intruder_x + 12, intruder_y + 15), (40, 40, 120), -1)
        # Legs
        cv2.line(frame, (intruder_x - 6, intruder_y + 15), (intruder_x - 10 + int(math.sin(t*8)*6), intruder_y + 40), (20, 20, 60), 4)
        cv2.line(frame, (intruder_x + 6, intruder_y + 15), (intruder_x + 10 - int(math.sin(t*8)*6), intruder_y + 40), (20, 20, 60), 4)

        # Patrolling Border Security Guard on right side
        guard_x = int(500 + math.sin(t * 0.5) * 40)
        guard_y = 240
        cv2.circle(frame, (guard_x, guard_y - 35), 10, (190, 200, 190), -1) # Helmet
        cv2.rectangle(frame, (guard_x - 14, guard_y - 25), (guard_x + 14, guard_y + 15), (35, 75, 45), -1) # Camo
        cv2.line(frame, (guard_x - 6, guard_y + 15), (guard_x - 6, guard_y + 40), (25, 45, 30), 4)
        cv2.line(frame, (guard_x + 6, guard_y + 15), (guard_x + 6, guard_y + 40), (25, 45, 30), 4)

        self._draw_hud_watermark(frame, "BOP ALPHA-1 | NORTH FENCE SEC-4")
        return frame

    def _render_checkpost_scenario(self, t: float) -> np.ndarray:
        """Scenario 2: Checkpost vehicle approach with readable license plate and driver"""
        frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        
        # Road and checkpost booth
        frame[0:120, :] = [70, 70, 75] # Sky
        frame[120:, :] = [45, 50, 45]  # Terrain
        
        # Asphalt road
        cv2.fillPoly(frame, [np.array([[120, 360], [240, 120], [400, 120], [520, 360]])], (50, 50, 55))
        # Center lane dashed line
        cv2.line(frame, (320, 130), (320, 350), (220, 220, 220), 2)

        # Security checkpost barrier gate & booth
        cv2.rectangle(frame, (420, 130), (480, 210), (100, 100, 120), -1)
        cv2.rectangle(frame, (430, 140), (470, 170), (180, 210, 230), -1) # window
        # Barrier arm (red/white stripes)
        cv2.line(frame, (230, 200), (430, 200), (0, 0, 200), 4)

        # Vehicle moving towards checkpoint
        v_cycle = (t * 0.4) % 1.0  # 0 to 1 loop
        scale = 0.4 + v_cycle * 0.9 # grows as it gets closer
        vx = int(320 - (100 * scale) / 2)
        vy = int(140 + v_cycle * 130)
        vw = int(120 * scale)
        vh = int(70 * scale)

        # Vehicle Body (Dark SUV)
        cv2.rectangle(frame, (vx, vy), (vx + vw, vy + vh), (30, 35, 45), -1)
        # Windshield
        cv2.rectangle(frame, (vx + int(vw*0.15), vy + int(vh*0.1)), (vx + int(vw*0.85), vy + int(vh*0.45)), (80, 120, 140), -1)
        
        # Driver Face inside windshield
        if scale > 0.6:
            face_cx = vx + int(vw * 0.35)
            face_cy = vy + int(vh * 0.28)
            cv2.circle(frame, (face_cx, face_cy), int(8 * scale), (180, 160, 150), -1)

        # Vehicle Wheels
        cv2.circle(frame, (vx + int(vw*0.2), vy + vh), int(10 * scale), (15, 15, 15), -1)
        cv2.circle(frame, (vx + int(vw*0.8), vy + vh), int(10 * scale), (15, 15, 15), -1)

        # License Plate (White rectangular plate with clear text JK02AB9871)
        plate_w = int(vw * 0.5)
        plate_h = int(vh * 0.22)
        plate_x = vx + int((vw - plate_w) / 2)
        plate_y = vy + int(vh * 0.68)
        
        cv2.rectangle(frame, (plate_x, plate_y), (plate_x + plate_w, plate_y + plate_h), (240, 240, 240), -1)
        cv2.rectangle(frame, (plate_x, plate_y), (plate_x + plate_w, plate_y + plate_h), (0, 0, 0), 1)

        if scale > 0.65:
            plate_text = "JK-02-AB-9871"
            font_scale = 0.35 * (scale / 0.8)
            cv2.putText(frame, plate_text, (plate_x + 2, plate_y + plate_h - 3),
                        cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), 1)

        self._draw_hud_watermark(frame, "CHECKPOST BRAVO | HIGHWAY INBOUND GATE")
        return frame

    def _render_riverine_night_scenario(self, t: float) -> np.ndarray:
        """Scenario 3: Riverine border night vision / thermal IR feed with stealth crawler"""
        frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        
        # Night thermal river scene (green-phosphor or thermal IR hues)
        # Upper river bank
        frame[0:150, :] = [10, 40, 15]
        # River water with wave ripples
        frame[150:280, :] = [15, 55, 25]
        for y in range(160, 280, 15):
            wave_shift = int(math.sin(t * 2 + y) * 12)
            cv2.line(frame, (0, y), (self.width, y + wave_shift), (25, 80, 35), 1)
        # Lower river bank
        frame[280:, :] = [10, 35, 15]

        # Stealth prone infiltrator crawling across riverbank
        crawl_cycle = (t * 0.2) % 1.0
        cx = int(60 + crawl_cycle * 500)
        cy = int(290 + math.sin(t * 3) * 6)

        # Thermal heat signature (Hot bright green / yellow-white)
        # Prone body (horizontal ellipse/rectangle for crawl posture)
        cv2.ellipse(frame, (cx, cy), (28, 10), 0, 0, 360, (60, 240, 90), -1)
        cv2.circle(frame, (cx + 25, cy - 2), 7, (80, 255, 110), -1) # head heat

        self._draw_hud_watermark(frame, "BOP CHARLIE | RIVERINE NIGHT IR CAM-03")
        return frame

    def _render_watchtower_scenario(self, t: float) -> np.ndarray:
        """Scenario 4: Watchtower perimeter with loitering suspect dropping bag"""
        frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        
        # Compound yard & perimeter fence
        frame[0:140, :] = [45, 45, 50]
        frame[140:, :] = [35, 40, 35]

        # Watchtower structure on left
        cv2.rectangle(frame, (40, 60), (100, 110), (70, 75, 80), -1)
        cv2.line(frame, (50, 110), (30, 260), (90, 90, 95), 3)
        cv2.line(frame, (90, 110), (110, 260), (90, 90, 95), 3)

        # Loitering Suspect in center yard
        # Person stays in small circle around (340, 220)
        suspect_x = int(340 + math.cos(t * 0.4) * 25)
        suspect_y = int(220 + math.sin(t * 0.4) * 15)

        cv2.circle(frame, (suspect_x, suspect_y - 35), 10, (190, 175, 160), -1)
        cv2.rectangle(frame, (suspect_x - 12, suspect_y - 25), (suspect_x + 12, suspect_y + 15), (20, 20, 20), -1) # Dark hoodie
        cv2.line(frame, (suspect_x - 6, suspect_y + 15), (suspect_x - 6, suspect_y + 40), (30, 30, 40), 4)
        cv2.line(frame, (suspect_x + 6, suspect_y + 15), (suspect_x + 6, suspect_y + 40), (30, 30, 40), 4)

        # Suspicious stationary backpack on ground
        cv2.rectangle(frame, (370, 240), (395, 260), (25, 25, 110), -1)
        cv2.circle(frame, (382, 238), 5, (25, 25, 110), -1)

        self._draw_hud_watermark(frame, "BOP DELTA | FORWARD WATCHTOWER POST-04")
        return frame

    def _draw_hud_watermark(self, frame: np.ndarray, title: str):
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        # Top HUD bar
        cv2.rectangle(frame, (0, 0), (self.width, 24), (10, 15, 20), -1)
        cv2.putText(frame, f"[SEC-CAM {self.camera_id:02d}] {title}", (8, 16),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 180), 1)
        cv2.putText(frame, f"{now_str} | REC [●]", (self.width - 200, 16),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.40, (0, 220, 255), 1)

        # Tactical Crosshair / Corner Grid markers
        cv2.line(frame, (10, 35), (25, 35), (0, 255, 180), 1)
        cv2.line(frame, (10, 35), (10, 50), (0, 255, 180), 1)
        cv2.line(frame, (self.width - 10, 35), (self.width - 25, 35), (0, 255, 180), 1)
        cv2.line(frame, (self.width - 10, 35), (self.width - 10, 50), (0, 255, 180), 1)

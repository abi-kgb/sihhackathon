import cv2
import numpy as np
import re
from typing import List, Dict, Tuple, Optional, Any

class ANPREngine:
    """
    Software-Based Automatic Number Plate Recognition (ANPR / LPR).
    Extracts license plate regions from vehicles, performs OCR, and queries watchlists.
    """
    def __init__(self):
        self.ocr_reader = None
        self._init_ocr()

    def _init_ocr(self):
        try:
            import easyocr
            self.ocr_reader = easyocr.Reader(['en'], gpu=False)
        except Exception:
            self.ocr_reader = None

    def detect_plate_region(self, vehicle_crop: np.ndarray) -> Optional[Tuple[np.ndarray, Tuple[int, int, int, int]]]:
        """
        Locates candidate license plate within a vehicle image using edge & contour heuristics.
        """
        if vehicle_crop is None or vehicle_crop.size == 0:
            return None

        gray = cv2.cvtColor(vehicle_crop, cv2.COLOR_BGR2GRAY)
        # Bilateral filter to remove noise while keeping edges sharp
        blur = cv2.bilateralFilter(gray, 9, 75, 75)
        # Morphological gradient / Sobel X
        sobelx = cv2.Sobel(blur, cv2.CV_8U, 1, 0, ksize=3)
        _, thresh = cv2.threshold(sobelx, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Morphological close to join characters in license plate
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (17, 3))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(closed, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = float(w) / max(h, 1)
            area = w * h
            # License plates standard aspect ratio between 1.5 and 7.0, flexible area constraints
            if 1.5 <= aspect_ratio <= 7.0 and 100 <= area <= 60000:
                plate_crop = vehicle_crop[y:y+h, x:x+w]
                return plate_crop, (x, y, w, h)

        # Fallback: lower 45% of vehicle crop usually contains plate
        vh, vw = vehicle_crop.shape[:2]
        plate_y = int(vh * 0.55)
        plate_h = int(vh * 0.40)
        plate_x = int(vw * 0.10)
        plate_w = int(vw * 0.80)
        return vehicle_crop[plate_y:plate_y+plate_h, plate_x:plate_x+plate_w], (plate_x, plate_y, plate_w, plate_h)

    def extract_plate_text(self, plate_crop: np.ndarray, vehicle_crop: Optional[np.ndarray] = None) -> str:
        """
        Reads alphanumeric license plate characters from the cropped plate image with high-speed downscaling
        and automatic full-vehicle-crop fallback.
        """
        if not self.ocr_reader:
            return ""

        # Attempt 1: OCR on cropped & CLAHE enhanced plate region
        if plate_crop is not None and plate_crop.size > 0:
            try:
                plate_proc = cv2.resize(plate_crop, (240, 80), interpolation=cv2.INTER_CUBIC)
                gray = cv2.cvtColor(plate_proc, cv2.COLOR_BGR2GRAY)
                clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
                enhanced = clahe.apply(gray)
                
                results = self.ocr_reader.readtext(enhanced)
                text_pieces = []
                for bbox, text, prob in results:
                    clean_text = re.sub(r'[^A-Za-z0-9]', '', text).upper()
                    if len(clean_text) >= 2 and prob > 0.15:
                        text_pieces.append(clean_text)
                if text_pieces:
                    combined = "".join(text_pieces)
                    if len(combined) >= 4:
                        return combined
            except Exception:
                pass

        # Attempt 2: Direct OCR on full vehicle crop (CRAFT text detector locates plate anywhere on car)
        target_img = vehicle_crop if (vehicle_crop is not None and vehicle_crop.size > 0) else plate_crop
        if target_img is not None and target_img.size > 0:
            try:
                results = self.ocr_reader.readtext(target_img)
                candidates = []
                for bbox, text, prob in results:
                    clean_text = re.sub(r'[^A-Za-z0-9]', '', text).upper()
                    # License plates standard alphanumeric format (e.g. KA02MM9091, JK02AB, etc.)
                    if len(clean_text) >= 4 and any(c.isalpha() for c in clean_text) and any(c.isdigit() for c in clean_text):
                        candidates.append((clean_text, prob))
                if candidates:
                    candidates.sort(key=lambda x: len(x[0]), reverse=True)
                    return candidates[0][0]
            except Exception:
                pass

        return ""

    def _normalize_plate_str(self, plate: str) -> str:
        """Strips whitespace and converts common OCR character confusions"""
        clean = re.sub(r'[^A-Za-z0-9]', '', str(plate)).upper()
        return clean

    def match_watchlist(self, plate_text: str, watchlist: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Checks if detected plate text matches any vehicle in the database (whitelist or hotlist).
        Supports exact match, substring match, and 1-character typo tolerance.
        """
        if not plate_text or not watchlist:
            return None

        clean_query = self._normalize_plate_str(plate_text)
        if not clean_query:
            return None

        for vehicle in watchlist:
            saved_plate = self._normalize_plate_str(vehicle.get("plate_number", ""))
            if not saved_plate:
                continue

            # 1. Exact or substring match
            if saved_plate == clean_query or saved_plate in clean_query or clean_query in saved_plate:
                return self._format_vehicle_result(vehicle)

            # 2. Fuzzy match (allow 1 character difference for OCR noise e.g. 0 vs O, 1 vs I, 8 vs B)
            if len(saved_plate) >= 5 and abs(len(saved_plate) - len(clean_query)) <= 1:
                # Calculate simple distance
                diffs = 0
                min_len = min(len(saved_plate), len(clean_query))
                for i in range(min_len):
                    c1, c2 = saved_plate[i], clean_query[i]
                    if c1 != c2:
                        # Check interchangeable character pairs
                        interchangeable = [('0', 'O'), ('0', 'D'), ('1', 'I'), ('1', 'L'), ('8', 'B'), ('5', 'S'), ('2', 'Z')]
                        if (c1, c2) not in interchangeable and (c2, c1) not in interchangeable:
                            diffs += 1
                if diffs <= 1:
                    return self._format_vehicle_result(vehicle)

        return None

    def _format_vehicle_result(self, vehicle: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "vehicle_id": vehicle.get("id"),
            "plate_number": vehicle.get("plate_number"),
            "vehicle_type": vehicle.get("vehicle_type"),
            "category": vehicle.get("category"),
            "threat_level": vehicle.get("threat_level"),
            "owner_name": vehicle.get("owner_name"),
            "notes": vehicle.get("notes")
        }

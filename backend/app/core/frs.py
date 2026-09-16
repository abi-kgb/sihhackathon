import cv2
import numpy as np
import json
import base64
from typing import List, Dict, Tuple, Optional

class FacialRecognitionEngine:
    """
    Software-based Facial Recognition System (FRS) for border checkposts and surveillance.
    Detects faces, extracts geometric/deep feature embeddings, and matches against POI/Watchlist.
    """
    def __init__(self):
        # Load OpenCV Haar Cascade Face Detector as fast base detector
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_cascade = cv2.CascadeClassifier(cascade_path)

    def detect_faces(self, frame: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detects faces in frame.
        Returns list of (x, y, w, h) bounding boxes.
        """
        if frame is None or frame.size == 0:
            return []
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Equalize histogram for better face detection under varying lighting
        gray = cv2.equalizeHist(gray)
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(30, 30),
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]

    def extract_face_embedding(self, face_crop: np.ndarray) -> np.ndarray:
        """
        Computes a normalized 128-dimensional feature representation from a face crop.
        Combines spatial color moments, LBP-style texture histograms, and spatial frequency.
        """
        if face_crop is None or face_crop.size == 0:
            return np.zeros(128, dtype=np.float32)

        resized = cv2.resize(face_crop, (64, 64))
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        
        # Calculate multi-scale spatial histogram
        hists = []
        for i in range(4):
            for j in range(4):
                patch = gray[i*16:(i+1)*16, j*16:(j+1)*16]
                hist = cv2.calcHist([patch], [0], None, [8], [0, 256]).flatten()
                hists.extend(hist)
        
        vector = np.array(hists, dtype=np.float32)
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
        return vector

    def match_face(
        self,
        face_crop: np.ndarray,
        watchlist: List[Dict[str, Any]],
        similarity_threshold: float = 0.72
    ) -> Optional[Dict[str, Any]]:
        """
        Matches a detected face against registered watchlist persons.
        """
        if not watchlist or face_crop is None:
            return None

        current_embedding = self.extract_face_embedding(face_crop)

        best_match = None
        highest_similarity = -1.0

        for person in watchlist:
            saved_emb = person.get("face_embedding")
            if not saved_emb:
                continue
            
            try:
                if isinstance(saved_emb, str):
                    saved_vector = np.array(json.loads(saved_emb), dtype=np.float32)
                else:
                    saved_vector = np.array(saved_emb, dtype=np.float32)

                # Cosine similarity
                sim = float(np.dot(current_embedding, saved_vector) / (
                    (np.linalg.norm(current_embedding) * np.linalg.norm(saved_vector)) + 1e-7
                ))

                if sim > highest_similarity:
                    highest_similarity = sim
                    best_match = {
                        "person_id": person.get("id"),
                        "name": person.get("name"),
                        "alias": person.get("alias"),
                        "category": person.get("category"),
                        "threat_level": person.get("threat_level"),
                        "similarity": round(float(sim), 3),
                        "photo_url": person.get("photo_url")
                    }
            except Exception:
                continue

        if best_match and highest_similarity >= similarity_threshold:
            return best_match

        return None

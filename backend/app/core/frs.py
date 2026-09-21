import cv2
import numpy as np
import json
import base64
from typing import List, Dict, Tuple, Optional, Any

class FacialRecognitionEngine:
    """
    Software-based Facial Recognition System (FRS) for border checkposts and surveillance.
    Detects faces, extracts geometric/deep feature embeddings, and matches against POI/Watchlist.
    """
    def __init__(self):
        # Load OpenCV Haar Cascade Face Detector as fast base detector
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        # HOG descriptor configured for 64x64 standardized face crops
        self.hog = cv2.HOGDescriptor((64, 64), (16, 16), (8, 8), (8, 8), 9)

    def detect_faces(self, frame: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detects frontal faces in frame with adaptive histogram equalization.
        Returns list of (x, y, w, h) bounding boxes.
        """
        if frame is None or frame.size == 0:
            return []
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame.copy()
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)

        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(25, 25),
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]

    def extract_face_embedding(self, face_crop: np.ndarray) -> np.ndarray:
        """
        Computes a normalized discriminative HOG feature representation from a face crop.
        Zero-mean unit-variance normalized so non-matching faces produce near-zero cosine similarity.
        """
        if face_crop is None or face_crop.size == 0:
            return np.zeros(1764, dtype=np.float32)

        try:
            resized = cv2.resize(face_crop, (64, 64))
            gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY) if len(resized.shape) == 3 else resized.copy()
            gray = cv2.equalizeHist(gray)
            
            desc = self.hog.compute(gray).flatten().astype(np.float32)
            desc = desc - np.mean(desc)
            norm = np.linalg.norm(desc)
            if norm > 0:
                desc = desc / norm
            return desc
        except Exception:
            return np.zeros(1764, dtype=np.float32)

    def match_face(
        self,
        face_crop: np.ndarray,
        watchlist: List[Dict[str, Any]],
        similarity_threshold: float = 0.65
    ) -> Optional[Dict[str, Any]]:
        """
        Matches a detected face crop against registered watchlist persons.
        Only matches if face is clearly detected and feature similarity meets high threshold.
        """
        if not watchlist or face_crop is None or face_crop.size == 0:
            return None

        current_embedding = self.extract_face_embedding(face_crop)
        if np.linalg.norm(current_embedding) == 0:
            return None

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

                # If dimensions don't match, re-standardize or skip
                if saved_vector.shape != current_embedding.shape:
                    continue

                saved_vector = saved_vector - np.mean(saved_vector)
                s_norm = np.linalg.norm(saved_vector)
                if s_norm > 0:
                    saved_vector = saved_vector / s_norm

                # Cosine similarity
                sim = float(np.dot(current_embedding, saved_vector))

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

    def match_person_crop(
        self,
        person_crop: np.ndarray,
        watchlist: List[Dict[str, Any]],
        similarity_threshold: float = 0.65
    ) -> Optional[Dict[str, Any]]:
        """
        Matches face ONLY if an actual face is detected within the person crop.
        Never blindly matches arbitrary back/torso regions.
        """
        if person_crop is None or person_crop.size == 0 or not watchlist:
            return None

        faces = self.detect_faces(person_crop)
        if not faces:
            return None

        candidates = []
        for fx, fy, fw, fh in faces:
            fc = person_crop[fy:fy+fh, fx:fx+fw]
            m = self.match_face(fc, watchlist, similarity_threshold=similarity_threshold)
            if m:
                candidates.append(m)

        if not candidates:
            return None

        candidates.sort(key=lambda c: c.get("similarity", 0.0), reverse=True)
        return candidates[0]

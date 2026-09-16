import cv2
import numpy as np
from typing import List, Dict, Any, Tuple
from ..config import settings

class ObjectDetector:
    """
    Real-time object detection module for border surveillance.
    Supports YOLOv8 (ultralytics) with automatic fallback to HOG + Cascade / Motion detectors.
    """
    def __init__(self, conf_threshold: float = settings.CONFIDENCE_THRESHOLD):
        self.conf_threshold = conf_threshold
        self.yolo_model = None
        self.hog_pedestrian = cv2.HOGDescriptor()
        self.hog_pedestrian.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        self._init_model()

    def _init_model(self):
        try:
            from ultralytics import YOLO
            # Lightweight nano model for ultra-low latency border surveillance inference
            self.yolo_model = YOLO("yolov8n.pt")
        except Exception as e:
            print(f"[Detector] Note: YOLOv8 dynamic loader fallback enabled: {e}")
            self.yolo_model = None

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Runs object detection on input frame.
        Returns list of detections with normalized bboxes [xmin, ymin, xmax, ymax], class_name, confidence.
        """
        if frame is None or frame.size == 0:
            return []

        h, w = frame.shape[:2]
        detections: List[Dict[str, Any]] = []

        if self.yolo_model is not None:
            try:
                results = self.yolo_model(frame, conf=self.conf_threshold, verbose=False)
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        cls_id = int(box.cls[0])
                        cls_name = r.names[cls_id]
                        conf = float(box.conf[0])

                        # Target classes for border surveillance: person, car, motorcycle, truck, bus, animal
                        relevant_classes = {
                            "person": "person",
                            "car": "vehicle_car",
                            "motorcycle": "vehicle_motorcycle",
                            "bus": "vehicle_bus",
                            "truck": "vehicle_truck",
                            "dog": "wildlife",
                            "horse": "wildlife",
                            "sheep": "wildlife",
                            "cow": "wildlife",
                            "backpack": "suspicious_object",
                            "suitcase": "suspicious_object"
                        }

                        if cls_name in relevant_classes and conf >= self.conf_threshold:
                            xyxy = box.xyxy[0].cpu().numpy()
                            # Normalize bbox to [0..1]
                            norm_box = [
                                float(xyxy[0] / w),
                                float(xyxy[1] / h),
                                float(xyxy[2] / w),
                                float(xyxy[3] / h)
                            ]
                            detections.append({
                                "bbox": norm_box,
                                "class_name": relevant_classes[cls_name],
                                "raw_class": cls_name,
                                "confidence": round(conf, 3)
                            })
                return detections
            except Exception as e:
                # If YOLO inference fails temporarily, fall back
                pass

        # Fallback Detector: OpenCV HOG People Detector
        rects, weights = self.hog_pedestrian.detectMultiScale(
            frame, winStride=(8, 8), padding=(4, 4), scale=1.05
        )
        for (rx, ry, rw, rh), weight in zip(rects, weights):
            if weight > 0.2:
                detections.append({
                    "bbox": [float(rx / w), float(ry / h), float((rx + rw) / w), float((ry + rh) / h)],
                    "class_name": "person",
                    "raw_class": "person",
                    "confidence": round(float(weight), 3)
                })

        return detections

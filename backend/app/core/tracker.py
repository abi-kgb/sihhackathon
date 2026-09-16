import numpy as np
from typing import List, Dict, Tuple, Any

class SimpleTracker:
    """
    Centroid and IoU-based multi-object tracker for real-time video surveillance.
    Assigns persistent tracking IDs and maintains motion history.
    """
    def __init__(self, max_disappeared: int = 15, iou_threshold: float = 0.3):
        self.next_object_id = 101
        self.objects: Dict[int, Dict[str, Any]] = {}  # id -> {bbox, centroid, class_name, conf, disappeared, trajectory}
        self.max_disappeared = max_disappeared
        self.iou_threshold = iou_threshold

    @staticmethod
    def compute_iou(boxA: List[float], boxB: List[float]) -> float:
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])

        interArea = max(0, xB - xA) * max(0, yB - yA)
        boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
        boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

        iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
        return iou

    def update(self, detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        detections: list of {'bbox': [xmin, ymin, xmax, ymax], 'class_name': str, 'confidence': float}
        Returns list of active tracked objects with IDs and trajectories.
        """
        if len(detections) == 0:
            for obj_id in list(self.objects.keys()):
                self.objects[obj_id]["disappeared"] += 1
                if self.objects[obj_id]["disappeared"] > self.max_disappeared:
                    del self.objects[obj_id]
            return []

        if len(self.objects) == 0:
            for det in detections:
                box = det["bbox"]
                cx = (box[0] + box[2]) / 2.0
                cy = (box[1] + box[3]) / 2.0
                self.objects[self.next_object_id] = {
                    "id": self.next_object_id,
                    "bbox": box,
                    "centroid": (cx, cy),
                    "class_name": det["class_name"],
                    "confidence": det["confidence"],
                    "disappeared": 0,
                    "trajectory": [(cx, cy)]
                }
                self.next_object_id += 1
        else:
            object_ids = list(self.objects.keys())
            existing_boxes = [self.objects[oid]["bbox"] for oid in object_ids]
            
            # Match using IoU matrix
            iou_matrix = np.zeros((len(object_ids), len(detections)), dtype=np.float32)
            for i, oid in enumerate(object_ids):
                for j, det in enumerate(detections):
                    iou_matrix[i, j] = self.compute_iou(existing_boxes[i], det["bbox"])

            used_rows = set()
            used_cols = set()

            # Greedily match highest IoU
            while True:
                max_iou = 0.0
                best_r, best_c = -1, -1
                for r in range(len(object_ids)):
                    if r in used_rows:
                        continue
                    for c in range(len(detections)):
                        if c in used_cols:
                            continue
                        if iou_matrix[r, c] > max_iou:
                            max_iou = iou_matrix[r, c]
                            best_r, best_c = r, c

                if max_iou >= self.iou_threshold and best_r != -1:
                    oid = object_ids[best_r]
                    det = detections[best_c]
                    box = det["bbox"]
                    cx = (box[0] + box[2]) / 2.0
                    cy = (box[1] + box[3]) / 2.0

                    self.objects[oid]["bbox"] = box
                    self.objects[oid]["centroid"] = (cx, cy)
                    self.objects[oid]["class_name"] = det["class_name"]
                    self.objects[oid]["confidence"] = det["confidence"]
                    self.objects[oid]["disappeared"] = 0
                    self.objects[oid]["trajectory"].append((cx, cy))
                    if len(self.objects[oid]["trajectory"]) > 25:
                        self.objects[oid]["trajectory"].pop(0)

                    used_rows.add(best_r)
                    used_cols.add(best_c)
                else:
                    break

            # Handle unmatched detections (new objects)
            for c in range(len(detections)):
                if c not in used_cols:
                    box = detections[c]["bbox"]
                    cx = (box[0] + box[2]) / 2.0
                    cy = (box[1] + box[3]) / 2.0
                    self.objects[self.next_object_id] = {
                        "id": self.next_object_id,
                        "bbox": box,
                        "centroid": (cx, cy),
                        "class_name": detections[c]["class_name"],
                        "confidence": detections[c]["confidence"],
                        "disappeared": 0,
                        "trajectory": [(cx, cy)]
                    }
                    self.next_object_id += 1

            # Handle unmatched existing objects (disappeared frames)
            for r in range(len(object_ids)):
                if r not in used_rows:
                    oid = object_ids[r]
                    self.objects[oid]["disappeared"] += 1
                    if self.objects[oid]["disappeared"] > self.max_disappeared:
                        del self.objects[oid]

        # Return list of active tracked objects
        results = []
        for oid, data in self.objects.items():
            if data["disappeared"] == 0:
                results.append({
                    "id": oid,
                    "bbox": data["bbox"],
                    "centroid": data["centroid"],
                    "class_name": data["class_name"],
                    "confidence": data["confidence"],
                    "trajectory": data["trajectory"]
                })
        return results

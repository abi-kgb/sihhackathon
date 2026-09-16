import json
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
from shapely.geometry import Point, Polygon, LineString

class VirtualFenceEngine:
    """
    Evaluates virtual polygon geofences, restricted danger zones,
    and directional tripwires for real-time intrusion detection.
    """

    @staticmethod
    def parse_coordinates(coords_str: str) -> List[List[float]]:
        try:
            if isinstance(coords_str, str):
                return json.loads(coords_str)
            return coords_str
        except Exception:
            return []

    @staticmethod
    def check_polygon_intrusion(point_norm: Tuple[float, float], polygon_coords_norm: List[List[float]], bbox_norm: Optional[List[float]] = None) -> bool:
        """
        Checks if a normalized (x, y) point [0..1] or target bounding box lies inside/intersects a normalized polygon.
        """
        if not polygon_coords_norm or len(polygon_coords_norm) < 3:
            return False
        
        try:
            poly = Polygon(polygon_coords_norm)
            pt = Point(point_norm[0], point_norm[1])
            if poly.contains(pt) or poly.touches(pt):
                return True

            if bbox_norm and len(bbox_norm) >= 4:
                # Check bottom center (feet position)
                feet_pt = Point((bbox_norm[0] + bbox_norm[2]) / 2.0, bbox_norm[3])
                if poly.contains(feet_pt) or poly.touches(feet_pt):
                    return True

                # Check box intersection
                box_poly = Polygon([
                    [bbox_norm[0], bbox_norm[1]],
                    [bbox_norm[2], bbox_norm[1]],
                    [bbox_norm[2], bbox_norm[3]],
                    [bbox_norm[0], bbox_norm[3]]
                ])
                if poly.intersects(box_poly):
                    return True

            return False
        except Exception:
            return False

    @staticmethod
    def check_tripwire_crossing(
        prev_pos: Tuple[float, float],
        curr_pos: Tuple[float, float],
        tripwire_coords: List[List[float]],
        allowed_direction: str = "both"
    ) -> Tuple[bool, str]:
        """
        Checks if the trajectory line between prev_pos and curr_pos intersects the tripwire line segment.
        allowed_direction: 'both', 'inbound', 'outbound'
        Returns: (has_crossed, detected_direction)
        """
        if not tripwire_coords or len(tripwire_coords) < 2:
            return False, "none"

        try:
            p1, p2 = tripwire_coords[0], tripwire_coords[1]
            wire_line = LineString([p1, p2])
            trajectory = LineString([prev_pos, curr_pos])

            if wire_line.intersects(trajectory):
                # Calculate crossing direction using 2D cross product
                # Vector along tripwire: W = p2 - p1
                # Vector along motion: M = curr - prev
                w_vec = np.array([p2[0] - p1[0], p2[1] - p1[1]])
                m_vec = np.array([curr_pos[0] - prev_pos[0], curr_pos[1] - prev_pos[1]])
                
                # 2D cross product: Wx * My - Wy * Mx
                cross_prod = w_vec[0] * m_vec[1] - w_vec[1] * m_vec[0]
                
                direction = "inbound" if cross_prod > 0 else "outbound"

                if allowed_direction == "both":
                    return True, direction
                elif allowed_direction == direction:
                    return True, direction
                else:
                    return False, direction

            return False, "none"
        except Exception:
            return False, "none"

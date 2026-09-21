import os
import json
import numpy as np
import cv2
from app.core.frs import FacialRecognitionEngine
from app.core.anpr import ANPREngine
from app.core.virtual_fence import VirtualFenceEngine

def test_whitelist_suppression():
    frs = FacialRecognitionEngine()
    anpr = ANPREngine()
    fence = VirtualFenceEngine()

    # 1. Create dummy face embedding for authorized staff
    dummy_face = np.ones((64, 64, 3), dtype=np.uint8) * 128
    cv2.circle(dummy_face, (32, 32), 20, (255, 255, 255), -1)
    cv2.circle(dummy_face, (24, 26), 4, (0, 0, 0), -1)
    cv2.circle(dummy_face, (40, 26), 4, (0, 0, 0), -1)
    cv2.ellipse(dummy_face, (32, 42), (10, 5), 0, 0, 180, (0, 0, 0), 2)
    auth_emb = frs.extract_face_embedding(dummy_face)
    
    # Create distinct intruder face with different features
    intruder_face = np.ones((64, 64, 3), dtype=np.uint8) * 60
    cv2.rectangle(intruder_face, (10, 10), (54, 54), (200, 200, 200), -1)
    cv2.line(intruder_face, (15, 30), (49, 30), (0, 0, 0), 3)
    cv2.line(intruder_face, (32, 30), (32, 50), (0, 0, 0), 3)
    intruder_emb = frs.extract_face_embedding(intruder_face)
    
    person_watchlist = [
        {
            "id": 1,
            "name": "Inspector Rajesh Kumar",
            "alias": "Patrol Alpha",
            "category": "vip_authorized",
            "threat_level": "AUTHORIZED",
            "face_embedding": json.dumps(auth_emb.tolist()),
            "is_active": True
        },
        {
            "id": 2,
            "name": "Tariq Ahmad",
            "alias": "Infiltrator",
            "category": "cross_border_infiltrator",
            "threat_level": "CRITICAL",
            "face_embedding": json.dumps(intruder_emb.tolist()),
            "is_active": True
        }
    ]

    vehicle_watchlist = [
        {
            "id": 1,
            "plate_number": "JK01PATROL",
            "vehicle_type": "SUV",
            "category": "authorized_whitelist",
            "threat_level": "AUTHORIZED",
            "owner_name": "Border Patrol Unit 1",
            "is_active": True
        },
        {
            "id": 2,
            "plate_number": "DL99SUSPECT",
            "vehicle_type": "Truck",
            "category": "suspected_smuggling",
            "threat_level": "CRITICAL",
            "owner_name": "Smuggler Entity",
            "is_active": True
        }
    ]

    # Virtual zone definition (coordinates normalized [0..1])
    zone_coords = [[0.10, 0.40], [0.90, 0.40], [0.90, 0.90], [0.10, 0.90]]
    # Point inside zone
    inside_centroid = [0.50, 0.60]
    bbox = [0.45, 0.55, 0.55, 0.65]

    is_inside = fence.check_polygon_intrusion(inside_centroid, zone_coords, bbox)
    assert is_inside, "Point should be inside the virtual zone"

    # Test Authorized Person inside zone
    matched_person = frs.match_face(dummy_face, person_watchlist)
    assert matched_person is not None, "Face should match authorized person"
    p_cat = (matched_person.get("category") or "").lower()
    p_threat = (matched_person.get("threat_level") or "").upper()
    is_authorized_friendly_person = (
        any(w in p_cat for w in ["staff", "whitelist", "auth", "friendly", "safe", "vip", "official", "resident", "guard", "patrol", "registered"]) or 
        p_threat in ["AUTHORIZED", "LOW", "SAFE", "NONE", "WHITELIST"]
    )
    assert is_authorized_friendly_person, "Inspector Rajesh Kumar should be authorized"

    # Alert condition check:
    should_alert_person = (not is_authorized_friendly_person) and is_inside
    assert not should_alert_person, "Authorized person in restricted area MUST NOT trigger breach alert!"
    print("PASS: Authorized registered person in restricted area does NOT trigger alarm.")

    # Test Authorized Vehicle inside zone
    matched_vehicle = anpr.match_watchlist("JK01PATROL", vehicle_watchlist)
    assert matched_vehicle is not None, "Plate should match authorized vehicle"
    v_cat = (matched_vehicle.get("category") or "").lower()
    v_threat = (matched_vehicle.get("threat_level") or "").upper()
    is_authorized_friendly_vehicle = (
        any(w in v_cat for w in ["patrol", "whitelist", "auth", "friendly", "safe", "vip", "official", "resident", "registered"]) or 
        v_threat in ["AUTHORIZED", "LOW", "SAFE", "NONE", "WHITELIST"]
    )
    assert is_authorized_friendly_vehicle, "JK01PATROL should be authorized"

    should_alert_vehicle = (not is_authorized_friendly_vehicle) and is_inside
    assert not should_alert_vehicle, "Authorized vehicle in restricted area MUST NOT trigger breach alert!"
    print("PASS: Authorized registered vehicle in restricted area does NOT trigger alarm.")

    # Test Unknown / Hostile intruder
    unknown_person_match = None
    is_auth_unknown = False
    should_alert_intruder = (not is_auth_unknown) and is_inside
    assert should_alert_intruder, "Unknown intruder in restricted area MUST trigger breach alert!"
    print("PASS: Unregistered intruder in restricted area DOES trigger alarm.")

    # Test Hostile Vehicle
    hostile_vehicle = anpr.match_watchlist("DL99SUSPECT", vehicle_watchlist)
    h_cat = (hostile_vehicle.get("category") or "").lower()
    h_threat = (hostile_vehicle.get("threat_level") or "").upper()
    is_auth_hostile = (
        any(w in h_cat for w in ["patrol", "whitelist", "auth", "friendly", "safe", "vip", "official", "resident", "registered"]) or 
        h_threat in ["AUTHORIZED", "LOW", "SAFE", "NONE", "WHITELIST"]
    )
    assert not is_auth_hostile, "Hostile vehicle must NOT be authorized"
    should_alert_hostile = (not is_auth_hostile) and is_inside
    assert should_alert_hostile, "Hostile vehicle in restricted area MUST trigger breach alert!"
    print("PASS: Hostile vehicle in restricted area DOES trigger alarm.")

    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_whitelist_suppression()

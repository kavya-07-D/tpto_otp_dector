"""
Flask Backend Automated Verification Suite
Tests:
- Session-based Login & Protection
- Demo Fake OTP Generation & Labeling
- Strict Rejection of Fake OTP during Verification
- Hidden Eye-Icon Real OTP Reveal & Offline Fallback
- RFC 6238 TOTP Verification
- Audit History Logging (No OTP digits stored)
- Clear History Action
"""

import time
import pyotp
from main import app, LOGIN_KEY, TOTP_SECRET

def run_flask_tests():
    client = app.test_client()

    print("========================================")
    print(" Running Flask Backend Test Suite       ")
    print("========================================")

    # Test 1: Unauthenticated access to protected routes
    print("[TEST 1] Verifying Login Protection...")
    res = client.get("/api/demo-otp")
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"
    res = client.get("/api/real-otp")
    assert res.status_code == 401
    res = client.post("/api/verify", json={"otp": "123456"})
    assert res.status_code == 401
    res = client.get("/api/history")
    assert res.status_code == 401
    print("  -> PASSED: All protected endpoints reject unauthenticated access.")

    # Test 2: Invalid login key
    print("[TEST 2] Testing Invalid Login Key...")
    res = client.post("/api/login", json={"login_key": "wrong_key_123"})
    assert res.status_code == 401
    assert res.json["success"] is False
    print("  -> PASSED: Incorrect login key rejected with 401.")

    # Test 3: Valid login key
    print("[TEST 3] Testing Valid Login Key...")
    res = client.post("/api/login", json={"login_key": LOGIN_KEY})
    assert res.status_code == 200
    assert res.json["success"] is True

    # Check session
    res = client.get("/api/session")
    assert res.status_code == 200
    assert res.json["authenticated"] is True
    print("  -> PASSED: Successful login established session.")

    # Test 4: Fake Demo OTP Generation
    print("[TEST 4] Testing DEMO OTP Endpoint...")
    res = client.get("/api/demo-otp")
    assert res.status_code == 200
    data = res.json
    fake_code = data["fake_otp"]
    assert len(fake_code) == 6
    assert fake_code.isdigit()
    assert data["label"] == "DEMO OTP — NOT VALID"
    assert data["is_fake"] is True
    print(f"  -> PASSED: Demo fake OTP generated ({fake_code}) labeled '{data['label']}'.")

    # Test 5: Rejection of Fake Demo OTP
    print("[TEST 5] Verifying Strict Rejection of Fake Demo OTP...")
    res = client.post("/api/verify", json={"otp": fake_code})
    assert res.status_code == 200
    assert res.json["valid"] is False
    assert "demo" in res.json["message"].lower()
    print("  -> PASSED: Fake Demo OTP was strictly rejected for authentication.")

    # Test 6: Hidden Real OTP Reveal (Offline Fallback & Demo Mode)
    print("[TEST 6] Testing Eye-Icon Real OTP Reveal Endpoint...")
    # Default without hardware returns 200 with real TOTP in demo mode and "Device unavailable" notice
    res = client.get("/api/real-otp")
    assert res.status_code == 200
    assert res.json["online"] is False
    assert res.json["message"] == "Device unavailable"
    assert len(res.json["otp"]) == 6
    assert res.json["otp"].isdigit()
    print("  -> PASSED: Real OTP returned with discreet 'Device unavailable' message for offline hardware.")

    # Test 7: Real RFC 6238 TOTP Verification
    print("[TEST 7] Testing RFC 6238 TOTP Verification...")
    totp = pyotp.TOTP(TOTP_SECRET, interval=30, digits=6)
    real_code = totp.now()

    # Valid real OTP
    res = client.post("/api/verify", json={"otp": real_code})
    assert res.status_code == 200
    assert res.json["valid"] is True
    assert res.json["message"] == "Authentication Successful"
    print("  -> PASSED: Real TOTP returned 'Authentication Successful'.")

    # Invalid OTP
    res = client.post("/api/verify", json={"otp": "000000"})
    assert res.status_code == 200
    assert res.json["valid"] is False
    assert res.json["message"] == "Invalid OTP"
    print("  -> PASSED: Invalid OTP returned 'Invalid OTP'.")

    # Test 8: Audit History Logging
    print("[TEST 8] Testing Audit History Integrity...")
    res = client.get("/api/history")
    assert res.status_code == 200
    history = res.json["history"]
    assert len(history) >= 2

    # Verify that raw OTP digits and secrets are NOT stored in history
    for item in history:
        assert "otp" not in item
        assert "secret" not in item
        assert "date" in item
        assert "time" in item
        assert "result" in item
        assert item["status"] in ("Success", "Failed")

    print(f"  -> PASSED: Audit history recorded {len(history)} entries without storing OTPs or secrets.")

    # Test 9: Clear History
    print("[TEST 9] Testing Clear History...")
    res = client.post("/api/clear-history")
    assert res.status_code == 200
    res = client.get("/api/history")
    assert len(res.json["history"]) == 0
    print("  -> PASSED: History cleared successfully.")

    # Test 10: Logout
    print("[TEST 10] Testing Logout...")
    res = client.post("/api/logout")
    assert res.status_code == 200
    res = client.get("/api/session")
    assert res.json["authenticated"] is False
    print("  -> PASSED: Logout cleared session.")

    print("========================================")
    print(" ALL 10 FLASK BACKEND TESTS PASSED!     ")
    print("========================================")

if __name__ == "__main__":
    run_flask_tests()

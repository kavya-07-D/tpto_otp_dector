"""
SecureOTP — ESP32 Time-Based OTP Authentication System
Flask Backend Server with Session Authentication, Real/Fake OTP Handling,
ESP32 Hardware Bridge, and Non-Sensitive Audit History.
"""

import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from functools import wraps

from flask import Flask, request, jsonify, session, send_from_directory
from dotenv import load_dotenv
import pyotp
import requests

# Load environment configuration
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

LOGIN_KEY = os.getenv("LOGIN_KEY", "admin123")
SECRET_KEY = os.getenv("SECRET_KEY", "secureotp_flask_session_secret_key_change_in_prod")
TOTP_SECRET = os.getenv("TOTP_SECRET", "JBSWY3DPEHPK3PXP")
ESP32_IP = os.getenv("ESP32_IP", "").strip()
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")
APP_HOST = os.getenv("APP_HOST", "0.0.0.0")
APP_PORT = int(os.getenv("PORT", os.getenv("APP_PORT", "5000")))

WEBSITE_DIR = PROJECT_DIR / "website"

# Initialize Flask
app = Flask(__name__, static_folder=str(WEBSITE_DIR), static_url_path="")
app.secret_key = SECRET_KEY

# In-memory audit history store (DO NOT store OTP codes or secrets)
history_records = []
known_fake_otps = set()


def login_required(f):
    """Decorator to enforce session-based login on API routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("authenticated"):
            return jsonify({
                "error": "Unauthorized",
                "message": "Login required to access this resource."
            }), 401
        return f(*args, **kwargs)
    return decorated_function


# =====================================================================
# Authentication & Session Routes
# =====================================================================

@app.route("/api/login", methods=["POST"])
def api_login():
    """Validates the login key and initiates a session."""
    data = request.get_json(silent=True) or {}
    key_attempt = str(data.get("login_key", "")).strip()

    if not key_attempt:
        return jsonify({"success": False, "error": "Login key is required."}), 400

    if key_attempt == LOGIN_KEY:
        session["authenticated"] = True
        return jsonify({"success": True, "message": "Login successful."})
    else:
        return jsonify({"success": False, "error": "Incorrect login key. Please try again."}), 401


@app.route("/api/logout", methods=["POST"])
def api_logout():
    """Terminates user session."""
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully."})


@app.route("/api/session", methods=["GET"])
def api_session():
    """Checks current session authentication state."""
    return jsonify({
        "authenticated": bool(session.get("authenticated")),
        "demo_mode": DEMO_MODE,
        "esp32_configured": bool(ESP32_IP)
    })


# =====================================================================
# OTP Endpoints (Fake Demo & Hidden Real OTP)
# =====================================================================

@app.route("/api/demo-otp", methods=["GET"])
@login_required
def api_demo_otp():
    """
    Returns a randomly generated fake 6-digit OTP labeled 'DEMO OTP — NOT VALID'.
    Stored in blacklist so it can never be verified as valid.
    """
    fake_code = f"{random.randint(100000, 999999)}"
    known_fake_otps.add(fake_code)
    session["last_fake_otp"] = fake_code

    return jsonify({
        "fake_otp": fake_code,
        "label": "DEMO OTP — NOT VALID",
        "is_fake": True
    })


@app.route("/api/real-otp", methods=["GET"])
@login_required
def api_real_otp():
    """
    Triggered when user clicks the subtle eye icon.
    Attempts to fetch the real OTP from the ESP32 hardware endpoint.
    If the device is offline/not reachable, uses a clearly identified demo mode
    and provides a discreet 'Device unavailable' message.
    """
    now = int(time.time())
    totp = pyotp.TOTP(TOTP_SECRET, interval=30, digits=6)
    remaining = 30 - (now % 30)

    # 1. Attempt ESP32 communication if IP is configured
    if ESP32_IP:
        try:
            esp_url = f"http://{ESP32_IP}/api/otp"
            resp = requests.get(esp_url, timeout=1.5)
            if resp.status_code == 200:
                data = resp.json()
                return jsonify({
                    "online": True,
                    "otp": data.get("otp", totp.now()),
                    "time_remaining": data.get("time_remaining", remaining),
                    "source": "ESP32 Hardware",
                    "mode": "hardware",
                    "message": "ESP32 Connected"
                })
        except Exception:
            pass  # ESP32 connection failed, fall through to demo mode

    # 2. ESP32 is offline or not configured: Return clearly identified demo mode
    # with the discreet 'Device unavailable' message as required
    return jsonify({
        "online": False,
        "otp": totp.now(),
        "time_remaining": remaining,
        "source": "Demo Mode (ESP32 Offline)",
        "mode": "demo",
        "message": "Device unavailable"
    })


# =====================================================================
# OTP Verification & Audit History
# =====================================================================

@app.route("/api/verify", methods=["POST"])
@login_required
def api_verify():
    """
    Verifies a 6-digit OTP code against the RFC 6238 standard.
    Strictly rejects any fake DEMO OTP.
    Logs authentication result (Date, Time, Result, Status) without storing OTP values.
    """
    data = request.get_json(silent=True) or {}
    candidate_otp = str(data.get("otp", "")).strip()

    now_utc = datetime.now(timezone.utc)
    date_str = now_utc.strftime("%Y-%m-%d")
    time_str = now_utc.strftime("%H:%M:%S UTC")

    # Rejection Rule 1: Reject fake DEMO OTPs
    if candidate_otp in known_fake_otps or candidate_otp == session.get("last_fake_otp"):
        history_entry = {
            "id": len(history_records) + 1,
            "date": date_str,
            "time": time_str,
            "result": "Invalid OTP (Demo code cannot be verified)",
            "status": "Failed"
        }
        history_records.insert(0, history_entry)
        return jsonify({
            "valid": False,
            "message": "Invalid OTP. Demo OTP cannot be used for authentication."
        }), 200

    # Rejection Rule 2: Must be exactly 6 numeric digits
    if not candidate_otp.isdigit() or len(candidate_otp) != 6:
        history_entry = {
            "id": len(history_records) + 1,
            "date": date_str,
            "time": time_str,
            "result": "Malformed OTP (Must be 6 digits)",
            "status": "Failed"
        }
        history_records.insert(0, history_entry)
        return jsonify({
            "valid": False,
            "message": "Invalid OTP format. Please enter exactly 6 numeric digits."
        }), 400

    # Real RFC 6238 TOTP verification (30s time step, +/- 1 step skew tolerance)
    totp = pyotp.TOTP(TOTP_SECRET, interval=30, digits=6)
    is_valid = totp.verify(candidate_otp, valid_window=1)

    result_text = "Authentication Successful" if is_valid else "Invalid OTP"
    status_text = "Success" if is_valid else "Failed"

    # Save to history (DO NOT store candidate_otp or secrets!)
    history_entry = {
        "id": len(history_records) + 1,
        "date": date_str,
        "time": time_str,
        "result": result_text,
        "status": status_text
    }
    history_records.insert(0, history_entry)

    return jsonify({
        "valid": is_valid,
        "message": result_text
    })


@app.route("/api/history", methods=["GET"])
@login_required
def api_get_history():
    """Returns the authentication history list."""
    return jsonify({
        "history": history_records,
        "count": len(history_records)
    })


@app.route("/api/clear-history", methods=["POST"])
@login_required
def api_clear_history():
    """Clears all audit history records."""
    history_records.clear()
    return jsonify({
        "success": True,
        "message": "History cleared successfully."
    })


# =====================================================================
# Serve Frontend Static Assets
# =====================================================================

@app.route("/")
def serve_index():
    return send_from_directory(str(WEBSITE_DIR), "index.html")


@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory(str(WEBSITE_DIR), filename)


if __name__ == "__main__":
    print(f"Starting SecureOTP Flask Backend on http://localhost:{APP_PORT} (Host: {APP_HOST})...")
    app.run(host=APP_HOST, port=APP_PORT, debug=False)

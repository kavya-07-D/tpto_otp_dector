
"""
SecureOTP — ESP32 Time-Based OTP Authentication System
Flask Backend with Session Authentication, TOTP Verification,
ESP32 Hardware Bridge, CORS and Audit History.
"""

import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from functools import wraps

import pyotp
import requests
from dotenv import load_dotenv
from flask import Flask, request, jsonify, session
from flask_cors import CORS

# =========================================================
# CONFIGURATION
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

load_dotenv(BASE_DIR / ".env")

LOGIN_KEY = os.getenv("LOGIN_KEY", "admin123")

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "SecureOTP_2026_Session_Key_Change_In_Production"
)

TOTP_SECRET = os.getenv(
    "TOTP_SECRET",
    "JBSWY3DPEHPK3PXP"
)

ESP32_IP = os.getenv("ESP32_IP", "").strip()

DEMO_MODE = os.getenv(
    "DEMO_MODE", "false"
).lower() in ("true", "1", "yes")

APP_HOST = "0.0.0.0"
APP_PORT = int(os.getenv("PORT", "5000"))

# =========================================================
# FLASK INITIALIZATION
# =========================================================

app = Flask(__name__)

app.secret_key = SECRET_KEY

# GitHub Pages to Render CORS configuration
CORS(
    app,
    origins=[
        "https://kavya-07-d.github.io"
    ],
    supports_credentials=True
)

# Cross-origin session cookies
app.config.update(
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    PERMANENT_SESSION_LIFETIME=1800
)

# In-memory storage
history_records = []
known_fake_otps = set()

# =========================================================
# AUTHENTICATION DECORATOR
# =========================================================

def login_required(function):

    @wraps(function)
    def decorated_function(*args, **kwargs):

        if not session.get("authenticated"):

            return jsonify({
                "success": False,
                "error": "Unauthorized",
                "message": "Please login first."
            }), 401

        return function(*args, **kwargs)

    return decorated_function


# =========================================================
# HISTORY HELPER
# =========================================================

def add_history(date, time_value, result, status):

    history_entry = {
        "id": int(time.time() * 1000),
        "date": date,
        "time": time_value,
        "result": result,
        "status": status
    }

    history_records.insert(0, history_entry)

    del history_records[500:]


# =========================================================
# LOGIN ROUTE
# =========================================================

@app.route("/api/login", methods=["POST"])
def api_login():

    data = request.get_json(silent=True) or {}

    key_attempt = str(
        data.get("login_key", "")
    ).strip()

    if not key_attempt:

        return jsonify({
            "success": False,
            "error": "Login key is required."
        }), 400

    if key_attempt == LOGIN_KEY:

        session.clear()
        session.permanent = True
        session["authenticated"] = True

        return jsonify({
            "success": True,
            "message": "Login successful."
        })

    return jsonify({
        "success": False,
        "error": "Incorrect login key."
    }), 401


# =========================================================
# LOGOUT ROUTE
# =========================================================

@app.route("/api/logout", methods=["POST"])
def api_logout():

    session.clear()

    return jsonify({
        "success": True,
        "message": "Logged out successfully."
    })


# =========================================================
# SESSION CHECK
# =========================================================

@app.route("/api/session", methods=["GET"])
def api_session():

    return jsonify({
        "authenticated": bool(
            session.get("authenticated")
        ),
        "demo_mode": DEMO_MODE,
        "esp32_configured": bool(ESP32_IP)
    })


# =========================================================
# DEMO OTP GENERATION
# =========================================================

@app.route("/api/demo-otp", methods=["GET"])
@login_required
def api_demo_otp():

    fake_code = f"{random.randint(100000, 999999)}"

    known_fake_otps.add(fake_code)

    session["last_fake_otp"] = fake_code

    return jsonify({
        "fake_otp": fake_code,
        "label": "DEMO OTP — NOT VALID",
        "is_fake": True
    })


# =========================================================
# REAL OTP GENERATION
# =========================================================

@app.route("/api/real-otp", methods=["GET"])
@login_required
def api_real_otp():

    now = int(time.time())

    totp = pyotp.TOTP(
        TOTP_SECRET,
        interval=30,
        digits=6
    )

    remaining = 30 - (now % 30)

    # Check ESP32 hardware
    if ESP32_IP:

        try:

            esp_url = f"http://{ESP32_IP}/api/otp"

            response = requests.get(
                esp_url,
                timeout=2
            )

            response.raise_for_status()

            data = response.json()

            device_otp = str(data.get("otp", ""))

            if (
                len(device_otp) == 6
                and device_otp.isdigit()
            ):

                return jsonify({
                    "online": True,
                    "otp": device_otp,
                    "time_remaining": data.get(
                        "time_remaining", remaining
                    ),
                    "source": "ESP32 Hardware",
                    "mode": "hardware",
                    "message": "ESP32 Connected"
                })

        except (requests.RequestException, ValueError):
            pass

    # Software TOTP fallback
    return jsonify({
        "online": False,
        "otp": totp.now(),
        "time_remaining": remaining,
        "source": "Demo Mode (ESP32 Offline)",
        "mode": "demo",
        "message": "Device unavailable"
    })


# =========================================================
# OTP VERIFICATION
# =========================================================

@app.route("/api/verify", methods=["POST"])
@login_required
def api_verify():

    data = request.get_json(silent=True) or {}

    candidate_otp = str(
        data.get("otp", "")
    ).strip()

    now_utc = datetime.now(timezone.utc)

    date_str = now_utc.strftime("%Y-%m-%d")

    time_str = now_utc.strftime("%H:%M:%S UTC")

    # Reject fake demo OTP
    if (
        candidate_otp in known_fake_otps
        or candidate_otp == session.get("last_fake_otp")
    ):

        add_history(
            date_str,
            time_str,
            "Invalid OTP (Demo code)",
            "Failed"
        )

        return jsonify({
            "valid": False,
            "message": "Demo OTP cannot be used for authentication."
        })

    # Check OTP format
    if (
        not candidate_otp.isdigit()
        or len(candidate_otp) != 6
    ):

        add_history(
            date_str,
            time_str,
            "Malformed OTP",
            "Failed"
        )

        return jsonify({
            "valid": False,
            "message": "Enter exactly 6 numeric digits."
        }), 400

    # RFC 6238 TOTP verification
    totp = pyotp.TOTP(
        TOTP_SECRET,
        interval=30,
        digits=6
    )

    is_valid = totp.verify(
        candidate_otp,
        valid_window=1
    )

    result_text = (
        "Authentication Successful"
        if is_valid else "Invalid OTP"
    )

    status_text = (
        "Success" if is_valid else "Failed"
    )

    add_history(
        date_str,
        time_str,
        result_text,
        status_text
    )

    return jsonify({
        "valid": is_valid,
        "message": result_text
    })


# =========================================================
# HISTORY ROUTE
# =========================================================

@app.route("/api/history", methods=["GET"])
@login_required
def api_get_history():

    return jsonify({
        "history": history_records,
        "count": len(history_records)
    })


# =========================================================
# CLEAR HISTORY
# =========================================================

@app.route("/api/clear-history", methods=["POST"])
@login_required
def api_clear_history():

    history_records.clear()

    return jsonify({
        "success": True,
        "message": "History cleared successfully."
    })


# =========================================================
# HEALTH CHECK
# =========================================================

@app.route("/api/health", methods=["GET"])
def api_health():

    return jsonify({
        "status": "running",
        "service": "SecureOTP Backend",
        "version": "1.0"
    })


# =========================================================
# SERVER START
# =========================================================

if __name__ == "__main__":

    print(
        f"SecureOTP Backend running on port {APP_PORT}"
    )

    app.run(
        host=APP_HOST,
        port=APP_PORT,
        debug=False
    )

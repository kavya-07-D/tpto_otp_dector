
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

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

load_dotenv(BASE_DIR / ".env")

LOGIN_KEY = os.getenv("LOGIN_KEY", "change-this-login-key")
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key")
TOTP_SECRET = os.getenv("TOTP_SECRET", "JBSWY3DPEHPK3PXP")

ESP32_IP = os.getenv("ESP32_IP", "").strip()
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in (
    "true", "1", "yes"
)

APP_HOST = "0.0.0.0"
APP_PORT = int(os.getenv("PORT", "5000"))

# ---------------------------------------------------------
# Flask Initialization
# ---------------------------------------------------------

app = Flask(__name__)
app.secret_key = SECRET_KEY

# GitHub Pages frontend to Render backend
CORS(
    app,
    origins=["https://kavya-07-d.github.io"],
    supports_credentials=True
)

# Session cookie settings for cross-origin requests
app.config.update(
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True
)

# In-memory history
history_records = []
known_fake_otps = set()

# ---------------------------------------------------------
# Authentication Decorator
# ---------------------------------------------------------

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("authenticated"):
            return jsonify({
                "error": "Unauthorized",
                "message": "Login required."
            }), 401

        return f(*args, **kwargs)

    return decorated_function


# ---------------------------------------------------------
# Login and Session Routes
# ---------------------------------------------------------

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
        session["authenticated"] = True

        return jsonify({
            "success": True,
            "message": "Login successful."
        })

    return jsonify({
        "success": False,
        "error": "Incorrect login key."
    }), 401


@app.route("/api/logout", methods=["POST"])
def api_logout():

    session.clear()

    return jsonify({
        "success": True,
        "message": "Logged out successfully."
    })


@app.route("/api/session", methods=["GET"])
def api_session():

    return jsonify({
        "authenticated": bool(
            session.get("authenticated")
        ),
        "demo_mode": DEMO_MODE,
        "esp32_configured": bool(ESP32_IP)
    })


# ---------------------------------------------------------
# Demo OTP Generation
# ---------------------------------------------------------

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


# ---------------------------------------------------------
# Real OTP Generation
# ---------------------------------------------------------

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

    # Try ESP32 hardware first
    if ESP32_IP:

        try:
            esp_url = f"http://{ESP32_IP}/api/otp"

            response = requests.get(
                esp_url,
                timeout=2
            )

            if response.status_code == 200:

                data = response.json()

                return jsonify({
                    "online": True,
                    "otp": data.get("otp"),
                    "time_remaining": data.get(
                        "time_remaining", remaining
                    ),
                    "source": "ESP32 Hardware",
                    "mode": "hardware",
                    "message": "ESP32 Connected"
                })

        except requests.RequestException:
            pass

        except ValueError:
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


# ---------------------------------------------------------
# OTP Verification
# ---------------------------------------------------------

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

    # Reject demo OTP
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
            "message": "Demo OTP cannot be used."
        })

    # Validate format
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

    result = (
        "Authentication Successful"
        if is_valid else "Invalid OTP"
    )

    status = "Success" if is_valid else "Failed"

    add_history(
        date_str,
        time_str,
        result,
        status
    )

    return jsonify({
        "valid": is_valid,
        "message": result
    })


# ---------------------------------------------------------
# Audit History Helper
# ---------------------------------------------------------

def add_history(date, time_value, result, status):

    history_entry = {
        "id": len(history_records) + 1,
        "date": date,
        "time": time_value,
        "result": result,
        "status": status
    }

    history_records.insert(0, history_entry)

    # Limit memory usage
    del history_records[500:]


# ---------------------------------------------------------
# History Routes
# ---------------------------------------------------------

@app.route("/api/history", methods=["GET"])
@login_required
def api_get_history():

    return jsonify({
        "history": history_records,
        "count": len(history_records)
    })


@app.route("/api/clear-history", methods=["POST"])
@login_required
def api_clear_history():

    history_records.clear()

    return jsonify({
        "success": True,
        "message": "History cleared successfully."
    })


# ---------------------------------------------------------
# Health Check
# ---------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def api_health():

    return jsonify({
        "status": "running",
        "service": "SecureOTP Backend"
    })


# ---------------------------------------------------------
# Run Server
# ---------------------------------------------------------

if __name__ == "__main__":

    print(
        f"Starting SecureOTP Backend on port {APP_PORT}"
    )

    app.run(
        host=APP_HOST,
        port=APP_PORT,
        debug=False
    )

# Deploying SecureOTP to Render (Step-by-Step Guide)

This guide walks you through deploying your **SecureOTP** Flask backend and web portal to **Render** for free.

---

## 1. Files Prepared for Render

Your repository already contains the required configuration files:
- **`render.yaml`**: Render Blueprint configuration defining the service, Python runtime, build command, and environment variables.
- **`Procfile`**: Specifies `web: gunicorn backend.main:app`.
- **`backend/requirements.txt`**: Includes `gunicorn` for production WSGI serving.
- **`wsgi.py`**: Root WSGI entry point.

---

## 2. Push Your Code to GitHub

Open your terminal and run:

```powershell
git add .
git commit -m "Configure project for Render cloud deployment"
git push origin main
```

---

## 3. Deploy on Render (Free Tier)

### Method A: Blueprint 1-Click (Recommended)
1. Go to **[dashboard.render.com](https://dashboard.render.com/)** and sign in with your GitHub account.
2. Click **New +** in the top right and select **Blueprint**.
3. Select your repository: `kavya-07-D/tpto_otp_dector`.
4. Render will automatically detect `render.yaml` and configure:
   - **Service Name**: `secureotp-auth`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `gunicorn backend.main:app`
5. Click **Apply**.
6. Wait 1–2 minutes for the build to finish. Your live URL will be:
   `https://secureotp-auth.onrender.com`

---

### Method B: Manual Web Service Setup
If you prefer setting it up manually:
1. In Render Dashboard, click **New +** > **Web Service**.
2. Connect your GitHub repository: `kavya-07-D/tpto_otp_dector`.
3. Fill in the fields:
   - **Name**: `secureotp-auth`
   - **Region**: Closest to you (e.g. *Singapore* or *Frankfurt*)
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `gunicorn backend.main:app`
   - **Instance Type**: `Free`
4. Expand **Environment Variables** and add:
   | Key | Value | Notes |
   |:---|:---|:---|
   | `LOGIN_KEY` | `admin123` | Login key for dashboard |
   | `SECRET_KEY` | *(Click Generate)* | Session encryption key |
   | `TOTP_SECRET` | `JBSWY3DPEHPK3PXP` | Must match ESP32 secret |
   | `DEMO_MODE` | `true` | Allows cloud TOTP generation when ESP32 is on private LAN |
5. Click **Create Web Service**.

---

## 4. How the ESP32 Interacts with the Cloud Website

Because your ESP32 is on your local home Wi-Fi and Render is on the public cloud:
1. **Shared TOTP Secret**: Both the website on Render and your ESP32 use the **exact same `TOTP_SECRET`** (`JBSWY3DPEHPK3PXP`) and UTC internet time.
2. **Synchronized Verification**: The OTP shown on your live Render website matches the OTP your ESP32 keypad calculates locally.
3. You can view the live OTP on your phone or PC anywhere via your Render URL and type it into the ESP32 keypad to get **ACCESS GRANTED**!

# SecureOTP — ESP32 Time-Based OTP Authentication System (Flask Edition)

A complete, modern, responsive Time-Based One-Time Password (TOTP) Authentication System adhering to **RFC 6238** (HMAC-SHA1, 6 digits, 30-second time step) with a **light blue and white theme with solid black text**, a **Python Flask backend**, session-based login, a hidden OTP reveal via a subtle eye icon (👁), non-sensitive history tracking, and **ESP32 DevKit V1 embedded firmware** with a 16x2 LCD and 4x3 matrix keypad.

---

## 1. System Features & Workflows

### 1. Login Page
- Clean, centered login card with a Login Key input field and visibility toggle.
- OTP Authentication and OTP History pages remain **strictly hidden** until login succeeds.
- Rejection banner displayed on incorrect login key.
- Default development key: `admin123` (configured via `LOGIN_KEY` in `backend/.env`).

### 2. OTP Dashboard
- Accessible only after login.
- Navigation bar with two primary tabs: **OTP Authentication** and **OTP History**, plus a **Logout** button.
- Initially generates and displays a random fake 6-digit OTP clearly labeled **“DEMO OTP — NOT VALID”**.
- Real OTP is **never revealed automatically**.

### 3. Hidden OTP Reveal Option (Subtle Eye Icon 👁)
- No visible button text such as “Show Real OTP” or “Reveal OTP”.
- Small, subtle **eye icon (👁)** next to the OTP display, styled as a standard visibility toggle.
- **Zero tooltips or revealing explanatory text** prior to clicking.
- When clicked: requests the actual active OTP from the ESP32 backend.
- When clicked again: hides the OTP and masks characters with `••••••`.
- If the ESP32 is offline: discreetly displays **“Device unavailable”**.
- The fake demo OTP is **strictly rejected** by the backend if entered for authentication.

### 4. OTP Verification
- 6-digit OTP input field with numeric keypad support.
- Backend verification using RFC 6238 (30-second window with $\pm 1$ step clock skew tolerance).
- Clear outcome banner: **“Authentication Successful”** (green) or **“Invalid OTP”** (red).

### 5. OTP History
- Accessible only under the **OTP History** tab.
- Data table listing: `Date`, `Time (UTC)`, `Authentication Result`, and `Status` (`Success` / `Failed`).
- **Zero raw OTPs or secret keys stored** in history to prevent replay attacks and respect privacy.
- **Clear History** button with modal confirmation dialog.

### 6. Design Theme
- **Light Blue and White Theme**: Soft light blue gradient background (`#e0f2fe` to `#f0f7ff`) and pure white cards with light blue borders.
- **Solid Black Text**: Headings, body text, table cells, and buttons use crisp solid black (`#000000`) and dark slate (`#0f172a`) for maximum readability and high contrast.

---

## 2. Directory Structure

```
esp32/
├── backend/
│   ├── main.py                  # Python Flask server (session login, demo OTP, verification, history)
│   ├── generate_secret.py       # Cryptographic Base32 secret generator
│   ├── requirements.txt         # Flask dependencies
│   ├── .env.example             # Configuration template
│   ├── .env                     # Local configuration (LOGIN_KEY, TOTP_SECRET, ESP32_IP)
│   └── test_backend.py          # 10-point automated test suite
├── website/
│   ├── index.html               # Semantic HTML: Login view, OTP dashboard, history table, modal
│   ├── styles.css               # Light blue & white theme with solid black text
│   └── app.js                   # Client controller: session gate, eye toggle, verification, history
├── esp32/
│   ├── esp32_totp_auth.ino      # ESP32 sketch: LCD, 4x3 keypad, NTP sync, WebServer bridge
│   ├── secrets_config.example.h # Hardware secrets template
│   └── secrets_config.h         # Local Wi-Fi & Base32 secret
└── documentation/
    ├── README.md                # System documentation
    ├── wiring_guide.md          # Hardware pinout & wiring instructions
    ├── testing_guide.md         # 10 comprehensive test cases & verification matrix
    └── troubleshooting.md       # Diagnostic guide for LCD, keypad, & time sync
```

---

## 3. Windows Setup & Run Instructions

### Step 1: Install Python Dependencies
Open PowerShell or Command Prompt in the project directory:
```powershell
py -m pip install -r backend/requirements.txt
```

### Step 2: Configure Environment
Open `backend/.env` (pre-created with development defaults):
```ini
LOGIN_KEY=admin123
SECRET_KEY=secureotp_flask_session_secret_key_change_in_prod
TOTP_SECRET=JBSWY3DPEHPK3PXP
ESP32_IP=
DEMO_MODE=false
APP_HOST=0.0.0.0
APP_PORT=5000
```
- If your ESP32 is running on your Wi-Fi, enter its IP address in `ESP32_IP` (e.g. `ESP32_IP=192.168.1.105`).
- If ESP32 is offline, clicking the eye icon will display *"Device unavailable"*. To test demo mode without hardware, set `DEMO_MODE=true`.

### Step 3: Start the Flask Backend Server
```powershell
py backend/main.py
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

### Step 4: Login & Authenticate
1. Enter the login key: `admin123`.
2. Notice the initial OTP is a random fake code labeled **“DEMO OTP — NOT VALID”**.
3. Try verifying the demo OTP: notice it is rejected as invalid.
4. Click the small **eye icon (👁)** next to the OTP to reveal the real code or view the *"Device unavailable"* status.
5. Enter the real OTP into the verification form and click **Verify OTP**.
6. Switch to the **OTP History** tab to view your logged attempt.

---

## 4. ESP32 Hardware Integration

### Hardware Requirements
- **ESP32 DevKit V1**
- **16x2 HD44780 LCD**:
  - `RS` -> GPIO 13
  - `E`  -> GPIO 14
  - `D4` -> GPIO 18, `D5` -> GPIO 19, `D6` -> GPIO 21, `D7` -> GPIO 22
- **4x3 Matrix Keypad (7 connections)**:
  - Rows: `GPIO 23, 25, 26, 27`
  - Columns: `GPIO 32, 33, 16`
  *(If your keypad has 8 pins, it is a 4x4 keypad; leave pin 8 unconnected).*

### Flashing Firmware
1. Open `esp32/esp32_totp_auth.ino` in Arduino IDE.
2. In `esp32/secrets_config.h`, set your Wi-Fi SSID and Password.
3. Upload to the ESP32.
4. Open Serial Monitor at **115200 baud** to see the assigned IP address (also displayed on LCD line 2).
5. Put this IP into `backend/.env` under `ESP32_IP`.

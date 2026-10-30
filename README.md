# SecureOTP — ESP32 Time-Based OTP Authentication System

A modern, responsive Time-Based One-Time Password (TOTP) Authentication System adhering to **RFC 6238** (HMAC-SHA1, 6 digits, 30-second time step) with a **light blue and white theme with solid black text**, a **Python Flask backend**, session-based login, a hidden OTP reveal via a subtle eye icon (👁), non-sensitive history tracking, and **ESP32 DevKit V1 embedded firmware** with a 16x2 LCD and 4x3 matrix keypad.

---

## Fast Start

### 1. Launch Backend Server
```powershell
py -m pip install -r backend/requirements.txt
py backend/main.py
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

- **Default Login Key:** `admin123`
- **Initial State:** Displays a random fake 6-digit OTP labeled **DEMO OTP — NOT VALID**.
- **Hidden Reveal:** Click the small subtle **eye icon (👁)** next to the OTP to reveal the actual code or view *"Device unavailable"* if the ESP32 is offline.
- **Verification:** Enter 6 digits to verify; fake demo OTP is strictly rejected.
- **History:** Click **OTP History** to view timestamps and results (zero OTP values stored).

### 2. Flash ESP32
1. Open `esp32/esp32_totp_auth.ino` in Arduino IDE.
2. Update Wi-Fi credentials in `esp32/secrets_config.h`.
3. Wire the 16x2 LCD (`RS=13, E=14, D4=18, D5=19, D6=21, D7=22`) and 4x3 Keypad (Rows `23, 25, 26, 27`, Cols `32, 33, 16`).
4. Select board **ESP32 Dev Module** and upload.
5. Note the IP address displayed on the LCD and set it in `backend/.env` under `ESP32_IP`.

For full documentation, see [documentation/README.md](documentation/README.md).

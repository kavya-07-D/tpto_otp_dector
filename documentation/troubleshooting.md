# Troubleshooting & Diagnosis Guide

This guide provides targeted diagnostic workflows for issues encountered during backend operation, ESP32 flashing, LCD display setup, and keypad input.

---

## 1. 16x2 LCD Issues

### Symptom: LCD displays solid white/black rectangles on Row 1, blank on Row 2
- **Root Cause**: Contrast voltage ($V_O$) is miscalibrated, or the LCD controller has not received the 4-bit initialization sequence.
- **Remedy**:
  1. Turn the center wiper of the 10k potentiometer slowly with a flathead screwdriver until text characters emerge.
  2. Check connections on `RS` (GPIO 13) and `E` (GPIO 14).
  3. Verify that `RW` (LCD Pin 5) is grounded directly to `GND`.
  4. Ensure `VDD` is supplied with 5V from the ESP32 `VIN` pin when powered via USB.

### Symptom: LCD remains completely dark (no backlight)
- **Remedy**:
  - Connect Pin 15 ($A$) to $5V$ or $3.3V$ through a $220\Omega$ resistor.
  - Connect Pin 16 ($K$) to `GND`.

---

## 2. 4x3 Matrix Keypad Issues

### Symptom: Keypad presses register wrong characters (e.g. typing '1' displays '4' or '*')
- **Root Cause**: Row and column wires are swapped or reversed.
- **Remedy**:
  1. Verify the 7 wires on the keypad header from left to right:
     - Pins 1–4 are Rows: `GPIO 23`, `GPIO 25`, `GPIO 26`, `GPIO 27`.
     - Pins 5–7 are Columns: `GPIO 32`, `GPIO 33`, `GPIO 16`.
  2. If the physical keypad has 8 pins, verify that the 8th pin is left disconnected.

### Symptom: Keypad does not respond at all
- **Remedy**:
  1. Inspect header crimp joints. Membrane ribbon cables often have delicate silver conductors.
  2. Ensure the `Keypad` library by Mark Stanley & Alexander Brevig is installed in Arduino IDE (`Tools > Manage Libraries...`).

---

## 3. Wi-Fi & NTP Time Synchronization Issues

### Symptom: Serial Monitor reports `[WIFI WARNING] Wi-Fi connection timeout`
- **Root Cause**: Incorrect SSID/password or attempting to connect to a 5 GHz-only network.
- **Remedy**:
  1. ESP32 DevKit V1 supports **2.4 GHz Wi-Fi only** (802.11 b/g/n). Ensure your router broadcasts on 2.4 GHz.
  2. Open `esp32/secrets_config.h` and verify `WIFI_SSID` and `WIFI_PASSWORD`.
  3. Ensure the ESP32 is within reliable signal range.

### Symptom: LCD shows `Clock Not Synced / ACCESS DENIED`
- **Root Cause**: The ESP32 connected to Wi-Fi, but UDP port 123 (NTP) is blocked by the router or firewall.
- **Remedy**:
  1. Check if the router permits outbound UDP packets on port 123 to `pool.ntp.org` and `time.nist.gov`.
  2. In university or corporate Wi-Fi with captive portals, the ESP32 cannot resolve NTP. Use a mobile Wi-Fi hotspot for testing.

---

## 4. TOTP Mismatch ("ACCESS DENIED" on valid OTP)

### Symptom: The OTP shown on the website is rejected by the ESP32
- **Check 1: Shared Secret Equality**
  - Verify `TOTP_SECRET` in `backend/.env` is identical character-for-character to `TOTP_BASE32_SECRET` in `esp32/secrets_config.h`.
- **Check 2: Base32 Padding / Whitespace**
  - Ensure there are no trailing spaces or newline characters in the secret string.
- **Check 3: Time Skew**
  - Verify your computer clock is synchronized with internet time (Windows Settings > Time & Language > Date & Time > "Sync now").
  - The ESP32 and backend both use UTC Unix epoch time. A difference of more than 30 seconds will cause the code to expire prematurely.

---

## 5. Backend Server Errors

### Symptom: `HTTP 401 Unauthorized` on `/api/otp`
- **Remedy**:
  - The backend guards the OTP generation endpoint. Click the **Auth Token** button in the top navigation bar and ensure the token matches `ACCESS_TOKEN` in `backend/.env` (default: `secureotp_local_dev_token_2024`).

### Symptom: `HTTP 429 Too Many Requests`
- **Remedy**:
  - Rate limiting is actively defending `/api/verify` (limit: 5 attempts/minute). Wait 60 seconds before making another attempt.

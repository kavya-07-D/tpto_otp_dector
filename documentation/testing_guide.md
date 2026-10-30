# Testing & Verification Guide

This guide provides step-by-step test plans to validate the **SecureOTP** backend and ESP32 hardware authentication system.

---

## 1. Prerequisites Checklist

Before executing the test suite, ensure:
- [ ] Backend is running (`py backend/main.py`) on `http://127.0.0.1:8000`.
- [ ] The web portal is accessible at `http://localhost:8000`.
- [ ] Both `backend/.env` and `esp32/secrets_config.h` use the **identical Base32 secret**.
- [ ] ESP32 is powered, connected to Wi-Fi, and shows `NTP Time Synced` on the LCD.

---

## 2. Comprehensive Test Cases

### Test Case 1: Backend Health Check
- **Procedure**:
  Send a GET request to `/api/health`:
  ```bash
  curl http://127.0.0.1:8000/api/health
  ```
- **Expected Result**:
  HTTP 200 with JSON payload containing `{"status": "operational", "totp_configured": true, ...}`. Secrets are not returned.

---

### Test Case 2: Protected OTP Generation
- **Procedure**:
  1. Open the website at `http://localhost:8000#generate`.
  2. Verify that a 6-digit code is visible in large font.
  3. Verify the circular timer and numeric countdown tick downward every second from 30 towards 0.
- **Expected Result**:
  Active 6-digit code matches the backend's PyOTP generation; timer seamlessly resets at 0 seconds with a newly generated OTP.

---

### Test Case 3: Valid Physical Keypad Authentication
- **Procedure**:
  1. Note the current 6-digit OTP displayed on the web portal.
  2. Before the countdown drops below 5 seconds, type the 6 digits onto the 4x3 matrix keypad.
  3. Observe LCD updating each digit (`_` replaced by the digit).
  4. Press `#` to submit.
- **Expected Result**:
  LCD line 1 displays `ACCESS GRANTED` and line 2 displays `Welcome Authorized` for 3 seconds, then automatically returns to the prompt.

---

### Test Case 4: Invalid OTP Entry
- **Procedure**:
  1. Type an intentionally incorrect 6-digit sequence (e.g. `000000` or `123456`) on the keypad.
  2. Press `#` to submit.
- **Expected Result**:
  LCD line 1 displays `ACCESS DENIED` and line 2 displays `Invalid/Expired ` for 3 seconds.

---

### Test Case 5: Expired OTP Entry (Skew Exceeded)
- **Procedure**:
  1. Note the current OTP.
  2. Wait until the website generates a new OTP, and wait an additional 40 seconds so that the old OTP is outside the $\pm 30\text{s}$ tolerance window.
  3. Enter the old OTP on the keypad and press `#`.
- **Expected Result**:
  LCD displays `ACCESS DENIED`.

---

### Test Case 6: Incomplete Code Submission (< 6 Digits)
- **Procedure**:
  1. Type only 3 or 4 digits (e.g. `123`).
  2. Press `#`.
- **Expected Result**:
  LCD line 2 displays `Incomplete OTP  ` and rejects verification.

---

### Test Case 7: Keypad Buffer Clear (*)
- **Procedure**:
  1. Type 4 digits (e.g. `7890`).
  2. Press `*`.
- **Expected Result**:
  The entered digits are cleared, buffer length resets to 0, and the LCD displays `OTP: ______`.

---

### Test Case 8: Fail-Safe on Unsynchronized Clock
- **Procedure**:
  1. Disconnect the ESP32 from Wi-Fi or configure an invalid Wi-Fi SSID in `secrets_config.h`.
  2. Boot the ESP32.
  3. Attempt to enter an OTP and press `#`.
- **Expected Result**:
  LCD displays `Clock Not Synced / ACCESS DENIED`. The device refuses to grant access without an authenticated time reference.

---

### Test Case 9: Rate Limiting & Anti-Brute Force
- **Procedure**:
  1. Navigate to the **Test System** tab on the website.
  2. Submit 6 verification attempts within 60 seconds using the simulator form.
- **Expected Result**:
  The 6th attempt is blocked with HTTP 429: *"Rate limit exceeded! Maximum 5 attempts per minute."*

---

## 3. Test Results Verification Matrix

| # | Test Case | Expected Result | Actual Result | Status |
|:---|:---|:---|:---|:---|
| 1 | Backend Operational | HTTP 200 via `/api/health` | *(Record upon test)* | Pending |
| 2 | Secure OTP Generation | 6-digit code received via `/api/otp` | *(Record upon test)* | Pending |
| 3 | Valid Keypad Auth | LCD displays `ACCESS GRANTED` | *(Record upon test)* | Pending |
| 4 | Invalid Keypad Auth | LCD displays `ACCESS DENIED` | *(Record upon test)* | Pending |
| 5 | Expired OTP Entry | LCD displays `ACCESS DENIED` outside window | *(Record upon test)* | Pending |
| 6 | Incomplete Input (<6 Digits) | Rejects with `Incomplete OTP` | *(Record upon test)* | Pending |
| 7 | Buffer Reset Key (*) | Clears all input to `OTP: ______` | *(Record upon test)* | Pending |
| 8 | Clock Fail-Safe Mode | Fails safe with `Clock Not Synced` | *(Record upon test)* | Pending |
| 9 | Wi-Fi Reconnect | Re-establishes connection in background | *(Record upon test)* | Pending |
| 10 | API Rate Limiter | HTTP 429 triggered on >5 requests/min | *(Record upon test)* | Pending |

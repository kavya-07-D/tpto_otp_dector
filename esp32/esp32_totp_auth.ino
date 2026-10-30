/**
 * =====================================================================
 * Project: SecureOTP — ESP32 Time-Based OTP Authentication System
 * Firmware: esp32_totp_auth.ino
 * Target Hardware: ESP32 DevKit V1
 * Standard: RFC 6238 (HMAC-SHA1, 6 Digits, 30-Second Step)
 * =====================================================================
 *
 * Hardware Wiring Specification:
 *
 * 1. 16x2 LCD Display (HD44780 Parallel 4-Bit Mode):
 *    - VSS        -> GND
 *    - VDD        -> 5V / VIN
 *    - VO         -> Center pin of 10k potentiometer (Contrast)
 *    - RS         -> GPIO 13
 *    - RW         -> GND (Permanent Write mode)
 *    - E          -> GPIO 14
 *    - D0..D3     -> NC (Unconnected in 4-bit mode)
 *    - D4         -> GPIO 18
 *    - D5         -> GPIO 19
 *    - D6         -> GPIO 21
 *    - D7         -> GPIO 22
 *    - A (LED+)   -> 5V or 3.3V via 220 Ohm resistor
 *    - K (LED-)   -> GND
 *
 * 2. 4x3 Matrix Keypad (7 Connections):
 *    - R1         -> GPIO 23
 *    - R2         -> GPIO 25
 *    - R3         -> GPIO 26
 *    - R4         -> GPIO 27
 *    - C1         -> GPIO 32
 *    - C2         -> GPIO 33
 *    - C3         -> GPIO 16
 *
 * NOTE: These pins are for a 4x3 keypad (7 pins). If your keypad
 * has 8 pins, it is a 4x4 keypad; leave the 8th pin unconnected.
 *
 * Network & Web Bridge:
 * - Runs a lightweight WebServer on port 80.
 * - Endpoints: GET /api/otp, GET /api/status, POST /api/verify
 * - Allows the Flask web portal to query the actual hardware OTP.
 * =====================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <time.h>
#include <LiquidCrystal.h>
#include <Keypad.h>
#include "mbedtls/md.h"

// Load Wi-Fi credentials and shared Base32 secret
#include "secrets_config.h"

// =====================================================================
// Pin Definitions & Hardware Objects
// =====================================================================

// LCD Pin Mapping: RS=13, E=14, D4=18, D5=19, D6=21, D7=22
const int PIN_LCD_RS = 13;
const int PIN_LCD_E  = 14;
const int PIN_LCD_D4 = 18;
const int PIN_LCD_D5 = 19;
const int PIN_LCD_D6 = 21;
const int PIN_LCD_D7 = 22;

LiquidCrystal lcd(PIN_LCD_RS, PIN_LCD_E, PIN_LCD_D4, PIN_LCD_D5, PIN_LCD_D6, PIN_LCD_D7);

// 4x3 Matrix Keypad Configuration
const byte KEYPAD_ROWS = 4;
const byte KEYPAD_COLS = 3;

char keypadKeys[KEYPAD_ROWS][KEYPAD_COLS] = {
  {'1', '2', '3'},
  {'4', '5', '6'},
  {'7', '8', '9'},
  {'*', '0', '#'}
};

// Rows: R1=23, R2=25, R3=26, R4=27
byte keypadRowPins[KEYPAD_ROWS] = {23, 25, 26, 27};

// Columns: C1=32, C2=33, C3=16
byte keypadColPins[KEYPAD_COLS] = {32, 33, 16};

Keypad keypad = Keypad(makeKeymap(keypadKeys), keypadRowPins, keypadColPins, KEYPAD_ROWS, KEYPAD_COLS);

// Web Server on port 80 for LAN bridge
WebServer server(80);

// =====================================================================
// State Variables & Buffers
// =====================================================================

const char* NTP_SERVER_1 = "pool.ntp.org";
const char* NTP_SERVER_2 = "time.nist.gov";
const long  GMT_OFFSET_SEC = 0;       // UTC Unix Epoch for RFC 6238
const int   DAYLIGHT_OFFSET_SEC = 0;

const int OTP_LENGTH = 6;
char enteredOtp[OTP_LENGTH + 1];
int enteredDigitsCount = 0;

enum SystemState {
  STATE_READY_PROMPT,
  STATE_SHOW_RESULT
};

SystemState currentState = STATE_READY_PROMPT;
unsigned long stateTimer = 0;
unsigned long lastWifiRetry = 0;
bool isTimeSynchronized = false;

// =====================================================================
// Cryptographic Helper Functions (RFC 6238 TOTP via mbedtls)
// =====================================================================

int decodeBase32(const char* input, uint8_t* output, size_t maxOutputLen) {
  int buffer = 0;
  int bitsLeft = 0;
  size_t count = 0;

  for (size_t i = 0; input[i] != '\0'; i++) {
    char ch = input[i];
    if (ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n' || ch == '=') {
      continue;
    }

    int val = -1;
    if (ch >= 'A' && ch <= 'Z') {
      val = ch - 'A';
    } else if (ch >= 'a' && ch <= 'z') {
      val = ch - 'a';
    } else if (ch >= '2' && ch <= '7') {
      val = ch - '2' + 26;
    } else {
      return -1;
    }

    buffer = (buffer << 5) | val;
    bitsLeft += 5;

    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      if (count < maxOutputLen) {
        output[count++] = (uint8_t)((buffer >> bitsLeft) & 0xFF);
      } else {
        return -1;
      }
    }
  }

  return count;
}

bool generateTotpForCounter(uint64_t counter, const uint8_t* keyBytes, size_t keyLen, char* outputOtp) {
  uint8_t counterBytes[8];
  for (int i = 7; i >= 0; i--) {
    counterBytes[i] = (uint8_t)(counter & 0xFF);
    counter >>= 8;
  }

  uint8_t hmacResult[20];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);

  if (mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA1), 1) != 0) {
    mbedtls_md_free(&ctx);
    return false;
  }

  if (mbedtls_md_hmac_starts(&ctx, keyBytes, keyLen) != 0 ||
      mbedtls_md_hmac_update(&ctx, counterBytes, 8) != 0 ||
      mbedtls_md_hmac_finish(&ctx, hmacResult) != 0) {
    mbedtls_md_free(&ctx);
    return false;
  }
  mbedtls_md_free(&ctx);

  // Dynamic Truncation
  int offset = hmacResult[19] & 0x0F;
  uint32_t binaryCode =
    ((hmacResult[offset] & 0x7F) << 24) |
    ((hmacResult[offset + 1] & 0xFF) << 16) |
    ((hmacResult[offset + 2] & 0xFF) << 8) |
    (hmacResult[offset + 3] & 0xFF);

  uint32_t otpValue = binaryCode % 1000000;
  snprintf(outputOtp, 7, "%06u", otpValue);
  return true;
}

bool getCurrentTotp(char* currentOtp, int* remainingSec) {
  time_t now;
  time(&now);
  if (now < 1672531199) return false;

  uint8_t secretKey[64];
  int keyLen = decodeBase32(TOTP_BASE32_SECRET, secretKey, sizeof(secretKey));
  if (keyLen <= 0) return false;

  uint64_t counter = (uint64_t)(now / 30);
  bool ok = generateTotpForCounter(counter, secretKey, keyLen, currentOtp);
  memset(secretKey, 0, sizeof(secretKey));

  if (remainingSec) {
    *remainingSec = 30 - (now % 30);
  }
  return ok;
}

bool verifyOtpLocally(const char* candidateOtp) {
  if (!isTimeSynchronized) return false;

  time_t now;
  time(&now);
  if (now < 1672531199) return false;

  uint8_t secretKey[64];
  int keyLen = decodeBase32(TOTP_BASE32_SECRET, secretKey, sizeof(secretKey));
  if (keyLen <= 0) return false;

  uint64_t currentCounter = (uint64_t)(now / 30);
  char expectedOtp[7];
  bool matchFound = false;

  // Check windows -1, 0, +1 (skew tolerance +/- 30s)
  for (int skew = -1; skew <= 1; skew++) {
    uint64_t testCounter = currentCounter + skew;
    if (generateTotpForCounter(testCounter, secretKey, keyLen, expectedOtp)) {
      if (strncmp(candidateOtp, expectedOtp, OTP_LENGTH) == 0) {
        matchFound = true;
        break;
      }
    }
  }

  memset(secretKey, 0, sizeof(secretKey));
  return matchFound;
}

// =====================================================================
// LCD Display Helpers
// =====================================================================

void displayPrompt() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Enter 6-digit OTP");
  lcd.setCursor(0, 1);
  lcd.print("OTP: ");
  for (int i = 0; i < enteredDigitsCount; i++) {
    lcd.print(enteredOtp[i]);
  }
  for (int i = enteredDigitsCount; i < OTP_LENGTH; i++) {
    lcd.print("_");
  }
}

void showResultScreen(bool granted, const char* message) {
  lcd.clear();
  lcd.setCursor(0, 0);
  if (granted) {
    lcd.print(" ACCESS GRANTED ");
  } else {
    lcd.print(" ACCESS DENIED  ");
  }

  lcd.setCursor(0, 1);
  lcd.print(message);

  currentState = STATE_SHOW_RESULT;
  stateTimer = millis();
}

void resetOtpBuffer() {
  enteredDigitsCount = 0;
  memset(enteredOtp, 0, sizeof(enteredOtp));
}

// =====================================================================
// WebServer HTTP API Handlers
// =====================================================================

void handleHttpOtp() {
  char otpStr[7];
  int remaining = 0;

  if (getCurrentTotp(otpStr, &remaining)) {
    String json = "{\"otp\":\"" + String(otpStr) + "\",\"time_remaining\":" + String(remaining) + ",\"status\":\"online\"}";
    server.send(200, "application/json", json);
  } else {
    server.send(503, "application/json", "{\"error\":\"Clock not synchronized\",\"status\":\"offline\"}");
  }
}

void handleHttpStatus() {
  server.send(200, "application/json", "{\"device\":\"ESP32 DevKit V1\",\"status\":\"online\"}");
}

void setupHttpServer() {
  server.on("/api/otp", HTTP_GET, handleHttpOtp);
  server.on("/api/status", HTTP_GET, handleHttpStatus);
  server.begin();
  Serial.println(F("[HTTP] ESP32 WebServer listening on port 80"));
}

// =====================================================================
// Keypad Input Handler
// =====================================================================

void handleKeypadInput(char key) {
  if (key == '#') {
    if (enteredDigitsCount < OTP_LENGTH) {
      showResultScreen(false, "Incomplete OTP  ");
      resetOtpBuffer();
      return;
    }

    enteredOtp[OTP_LENGTH] = '\0';
    Serial.println(F("[AUTH] Verifying submitted OTP on local ESP32..."));

    if (!isTimeSynchronized) {
      showResultScreen(false, "Clock Not Synced");
      resetOtpBuffer();
      return;
    }

    bool isValid = verifyOtpLocally(enteredOtp);

    if (isValid) {
      Serial.println(F("[AUTH RESULT] ACCESS GRANTED."));
      showResultScreen(true, " Welcome Authorized");
    } else {
      Serial.println(F("[AUTH RESULT] ACCESS DENIED."));
      showResultScreen(false, "Invalid/Expired ");
    }

    resetOtpBuffer();

  } else if (key == '*') {
    resetOtpBuffer();
    displayPrompt();

  } else if (key >= '0' && key <= '9') {
    if (enteredDigitsCount < OTP_LENGTH) {
      enteredOtp[enteredDigitsCount++] = key;
      enteredOtp[enteredDigitsCount] = '\0';
      displayPrompt();
    }
  }
}

// =====================================================================
// Time & Wi-Fi Management
// =====================================================================

void checkTimeSync() {
  time_t now;
  time(&now);
  if (now > 1672531199) {
    if (!isTimeSynchronized) {
      isTimeSynchronized = true;
      Serial.println(F("[NTP] UTC Time successfully synchronized with NTP."));
    }
  }
}

void maintainWifi() {
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWifiRetry > 10000) {
      lastWifiRetry = millis();
      Serial.println(F("[WIFI] Reconnecting..."));
      WiFi.reconnect();
    }
  } else {
    checkTimeSync();
  }
}

// =====================================================================
// Arduino Setup & Main Loop
// =====================================================================

void setup() {
  Serial.begin(115200);
  delay(400);

  Serial.println(F("\n=============================================="));
  Serial.println(F(" SecureOTP — ESP32 Hardware Web Bridge       "));
  Serial.println(F("=============================================="));

  lcd.begin(16, 2);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SecureOTP System");
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(F("."));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("\n[WIFI] Connected!"));
    Serial.print(F("[WIFI] IP Address: "));
    Serial.println(WiFi.localIP());

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(1500);

    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);

    int ntpAttempts = 0;
    while (!isTimeSynchronized && ntpAttempts < 20) {
      checkTimeSync();
      if (isTimeSynchronized) break;
      delay(500);
      ntpAttempts++;
    }

    setupHttpServer();

  } else {
    Serial.println(F("\n[WIFI] Timeout. Running in offline standalone mode."));
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Timeout");
    lcd.setCursor(0, 1);
    lcd.print("Offline Mode");
    delay(2000);
  }

  currentState = STATE_READY_PROMPT;
  displayPrompt();
}

void loop() {
  maintainWifi();
  server.handleClient();

  char key = keypad.getKey();

  if (currentState == STATE_SHOW_RESULT) {
    if (millis() - stateTimer > 3000) {
      currentState = STATE_READY_PROMPT;
      displayPrompt();
    }
  } else {
    if (key != NO_KEY) {
      handleKeypadInput(key);
    }
  }
}

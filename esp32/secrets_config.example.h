/**
 * SecureOTP — ESP32 Hardware Secrets Configuration
 * 
 * IMPORTANT:
 * 1. Copy this file to "secrets_config.h" in the same folder.
 * 2. Replace the Wi-Fi credentials with your network details.
 * 3. Replace TOTP_BASE32_SECRET with the EXACT same secret configured
 *    in backend/.env (generate via: py backend/generate_secret.py).
 * 4. Never commit your real secrets_config.h to public source control.
 */

#ifndef SECRETS_CONFIG_H
#define SECRETS_CONFIG_H

// Wi-Fi Configuration
#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Shared RFC 6238 Base32 Secret Key
// Must match TOTP_SECRET in backend/.env exactly!
// Standard 160-bit Base32 secret consists of 32 uppercase characters (A-Z, 2-7).
#define TOTP_BASE32_SECRET "JBSWY3DPEHPK3PXP"

#endif // SECRETS_CONFIG_H

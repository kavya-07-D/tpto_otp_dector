/**
 * SecureOTP — ESP32 Hardware Secrets Configuration (Default Development Copy)
 * 
 * Replace with your local Wi-Fi credentials before uploading.
 */

#ifndef SECRETS_CONFIG_H
#define SECRETS_CONFIG_H

// Wi-Fi Configuration
#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Shared RFC 6238 Base32 Secret Key
// Matches the default backend development secret:
#define TOTP_BASE32_SECRET "JBSWY3DPEHPK3PXP"

#endif // SECRETS_CONFIG_H

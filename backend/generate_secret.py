#!/usr/bin/env python3
"""
Secure Base32 Secret Generator for RFC 6238 TOTP
Generates a cryptographically secure 160-bit (32 Base32 characters) secret
compatible with PyOTP and the ESP32 firmware.
"""

import secrets
import base64
import pyotp

def generate_totp_secret() -> str:
    """Generate a random 32-character Base32 secret string."""
    # 20 bytes = 160 bits (recommended for HMAC-SHA1 RFC 6238)
    random_bytes = secrets.token_bytes(20)
    # Encode to Base32 without padding
    b32_secret = base64.b32encode(random_bytes).decode('utf-8').rstrip('=')
    return b32_secret

if __name__ == "__main__":
    secret = generate_totp_secret()
    print("=" * 60)
    print("  SecureOTP — RFC 6238 Shared Secret Generator")
    print("=" * 60)
    print(f"\nGenerated Base32 Secret:\n  {secret}\n")
    print("Instructions:")
    print("1. Set in backend/.env:")
    print(f"   TOTP_SECRET={secret}")
    print("\n2. Set in esp32/secrets_config.h:")
    print(f'   #define TOTP_BASE32_SECRET "{secret}"')
    print("\n[WARNING] Keep this secret confidential! Never commit it to git.")
    print("=" * 60)

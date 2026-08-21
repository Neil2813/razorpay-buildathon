"""
Security and JWT authentication helper functions.
Uses standard library cryptographic primitives (PBKDF2-HMAC-SHA256 & HMAC-SHA256 JWT).
"""

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

# JWT Secret Key (from env or fallback for local dev)
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "glassbox_jwt_secret_key_change_in_production_32bytes")
JWT_ALGORITHM = "HS256"
DEFAULT_TOKEN_EXPIRY_SECONDS = 86400 * 7  # 7 days expiration


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def hash_password(password: str) -> tuple[str, str]:
    """
    Hash password using PBKDF2-HMAC-SHA256 with 100,000 iterations.
    Returns (password_hash, salt_hex).
    """
    salt = os.urandom(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        100000
    )
    return password_hash.hex(), salt.hex()


def verify_password(password: str, stored_hash: str, salt_hex: str) -> bool:
    """Verify password against stored PBKDF2-HMAC-SHA256 hash and salt."""
    salt = bytes.fromhex(salt_hex)
    computed_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        100000
    ).hex()
    return hmac.compare_digest(computed_hash, stored_hash)


def create_access_token(payload: dict[str, Any], expires_in_seconds: int = DEFAULT_TOKEN_EXPIRY_SECONDS) -> str:
    """
    Generate an HS256 signed JWT token string.
    """
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    now = int(time.time())
    
    token_payload = dict(payload)
    token_payload["iat"] = now
    token_payload["exp"] = now + expires_in_seconds

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(token_payload, separators=(",", ":")).encode("utf-8"))

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(JWT_SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_b64 = _b64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_access_token(token: str) -> dict[str, Any] | None:
    """
    Decode and verify an HS256 JWT token string.
    Returns payload dictionary if valid, or None if invalid or expired.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, signature_b64 = parts

        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(JWT_SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual_sig = _b64url_decode(signature_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        exp = payload.get("exp")
        if exp and int(time.time()) > int(exp):
            return None  # Token expired

        return payload
    except Exception:
        return None

"""
auth.py — JWT + PBKDF2 password hashing for xCSG Value Tracker
"""
import os
import hashlib
import secrets
import time
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ── Env config ────────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("SECRET_KEY", "xCSG-Value-Tracker-dev-key-change-in-production-2026")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_HOURS = int(os.environ.get("JWT_EXPIRY_HOURS", "8"))

security = HTTPBearer()


# ── Password hashing ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a password with PBKDF2-SHA256, 100K iterations, 32-byte hex salt.
    Format: {salt}${hash_hex}
    """
    salt = secrets.token_hex(32)
    hash_hex = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    ).hex()
    return f"{salt}${hash_hex}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored hash."""
    try:
        salt, expected_hex = stored_hash.split("$", 1)
        actual_hex = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            100_000,
        ).hex()
        return secrets.compare_digest(actual_hex, expected_hex)
    except Exception:
        return False


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_token(user_id: int, username: str, role: str) -> str:
    """Create a signed JWT token."""
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "iat": now,
        "exp": now + JWT_EXPIRY_HOURS * 3600,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token. Returns payload dict or None."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


# ── FastAPI dependencies ──────────────────────────────────────────────────────

def _get_payload(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def get_current_user(payload: dict = Depends(_get_payload)) -> dict:
    """Any authenticated user."""
    return payload


def get_current_user_admin(payload: dict = Depends(_get_payload)) -> dict:
    """Admin role required."""
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return payload


def get_current_user_analyst(payload: dict = Depends(_get_payload)) -> dict:
    """Admin or analyst role required."""
    if payload.get("role") not in ("admin", "analyst"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Analyst or admin access required",
        )
    return payload


# get_current_user_writer is an alias for get_current_user_analyst — both
# names are used in different parts of the codebase. They have identical
# semantics: admin or analyst required.
get_current_user_writer = get_current_user_analyst

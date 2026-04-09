"""auth.py — JWT + PBKDF2 password hashing for xCSG Value Tracker V2."""
import os
import hashlib
import secrets
import time
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.environ.get("SECRET_KEY", "xCSG-Value-Tracker-dev-key-change-in-production-2026")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_HOURS = int(os.environ.get("JWT_EXPIRY_HOURS", "8"))

security = HTTPBearer()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(32)
    hash_hex = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000,
    ).hex()
    return f"{salt}${hash_hex}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected_hex = stored_hash.split("$", 1)
        actual_hex = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000,
        ).hex()
        return secrets.compare_digest(actual_hex, expected_hex)
    except Exception:
        return False


def create_token(user_id: int, username: str, role: str) -> str:
    now = int(time.time())
    payload = {"sub": str(user_id), "username": username, "role": role, "iat": now, "exp": now + JWT_EXPIRY_HOURS * 3600}
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def _get_payload(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    return payload


def get_current_user(payload: dict = Depends(_get_payload)) -> dict:
    return payload


def get_current_user_admin(payload: dict = Depends(_get_payload)) -> dict:
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return payload


def get_current_user_analyst(payload: dict = Depends(_get_payload)) -> dict:
    if payload.get("role") not in ("admin", "analyst"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Analyst or admin access required")
    return payload

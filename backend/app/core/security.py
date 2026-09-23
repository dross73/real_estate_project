"""Password hashing and JWT utilities."""

from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError

from app.core.config import get_settings


BCRYPT_MAX_PASSWORD_BYTES = 72
settings = get_settings()


def get_password_hash(password: str) -> str:
    """Hash a plaintext password with bcrypt for database storage."""
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password must be {BCRYPT_MAX_PASSWORD_BYTES} UTF-8 bytes or fewer"
        )

    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an existing bcrypt hash."""
    password_bytes = plain_password.encode("utf-8")

    if len(password_bytes) > BCRYPT_MAX_PASSWORD_BYTES:
        return False

    try:
        return bcrypt.checkpw(
            password_bytes,
            hashed_password.encode("utf-8"),
        )
    except (TypeError, ValueError):
        return False


def _create_token(
    *,
    subject: str,
    role: str,
    purpose: str,
    expires_minutes: int,
    extra_claims: dict | None = None,
) -> str:
    """Create a signed JWT whose purpose is explicit and independently checked."""
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=expires_minutes)

    payload = {
        "sub": subject,
        "role": role,
        "purpose": purpose,
        "iat": issued_at,
        "exp": expires_at,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_access_token(
    subject: str,
    role: str,
    expires_delta: int | None = None,
) -> str:
    """Create a signed JWT that can authorize normal application requests."""
    return _create_token(
        subject=subject,
        role=role,
        purpose="access",
        expires_minutes=expires_delta or settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )


def create_mfa_enrollment_token(
    *,
    subject: str,
    role: str,
    secret: str,
    expires_minutes: int = 10,
) -> str:
    """Sign a short-lived enrollment payload without granting application access."""
    return _create_token(
        subject=subject,
        role=role,
        purpose="mfa_enrollment",
        expires_minutes=expires_minutes,
        extra_claims={"mfa_secret": secret},
    )


def verify_access_token(token: str) -> dict:
    """Decode and validate an incoming JWT."""
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
        )
    except ExpiredSignatureError:
        raise ExpiredSignatureError("Token has expired")
    except JWTError:
        raise JWTError("Token is invalid or corrupted")

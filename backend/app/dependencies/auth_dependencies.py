"""Reusable JWT and role-based authentication dependencies."""

from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from jose.exceptions import ExpiredSignatureError, JWTError
from sqlalchemy.orm import Session

from app.core.security import verify_access_token
from app.db.models import SiteSetting, User
from app.db.session import get_db


oauth2_scheme = HTTPBearer()


def _decode_bearer_token(token: Any) -> dict:
    """Decode a bearer token and translate JWT errors into HTTP responses."""
    raw_token: str = getattr(token, "credentials", token)

    try:
        return verify_access_token(raw_token)
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or corrupted token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def _require_access_purpose(payload: dict) -> None:
    """Reject signed tokens that were issued for enrollment or another purpose."""
    if payload.get("purpose") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token required",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _internal_mfa_required(db: Session) -> bool:
    record = db.query(SiteSetting).filter(SiteSetting.id == 1).first()
    return bool(record.require_internal_mfa) if record is not None else False


def _require_internal_mfa_policy(
    payload: dict,
    db: Session,
    *,
    email: str,
) -> None:
    """Enforce a newly enabled MFA policy even against older access tokens."""
    if payload.get("role") not in ("admin", "staff") or not _internal_mfa_required(db):
        return

    user = db.query(User).filter(User.email == email).first()
    if (
        user is None
        or not user.mfa_enabled
        or payload.get("mfa_verified") is not True
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="MFA verification required",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _require_subject(payload: dict) -> str:
    """Return the token subject or reject malformed authenticated requests."""
    subject = payload.get("sub")
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return str(subject)


def get_current_user(token: Any = Depends(oauth2_scheme)) -> str:
    """Return the authenticated user's email from a valid JWT."""
    payload = _decode_bearer_token(token)
    _require_access_purpose(payload)
    return _require_subject(payload)


def require_admin(
    token: Any = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> str:
    """Restrict an endpoint to an administrator satisfying current MFA policy."""
    payload = _decode_bearer_token(token)
    _require_access_purpose(payload)

    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )

    email = _require_subject(payload)
    _require_internal_mfa_policy(payload, db, email=email)
    return email


def require_staff_or_admin(
    token: Any = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> str:
    """Restrict an endpoint to internal users satisfying current MFA policy."""
    payload = _decode_bearer_token(token)
    _require_access_purpose(payload)

    if payload.get("role") not in ("admin", "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff or admin privileges required",
        )

    email = _require_subject(payload)
    _require_internal_mfa_policy(payload, db, email=email)
    return email


def require_verified_public_user(
    token: Any = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Require an active public user whose email ownership is verified."""
    payload = _decode_bearer_token(token)
    _require_access_purpose(payload)

    if payload.get("role") != "public_user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public user account required",
        )

    email = _require_subject(payload)
    user = db.query(User).filter(User.email == email).first()

    if user is None or not user.is_active or user.archived_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is unavailable",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check the current database role rather than trusting only an older JWT.
    if user.role != "public_user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public user account required",
        )

    if user.email_verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required",
        )

    return user



def require_staff_or_admin_user(
    token: Any = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Return the active current internal user from a normal access token."""
    payload = _decode_bearer_token(token)
    _require_access_purpose(payload)

    if payload.get("role") not in ("admin", "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff or admin privileges required",
        )

    email = _require_subject(payload)
    _require_internal_mfa_policy(payload, db, email=email)
    user = db.query(User).filter(User.email == email).first()
    if (
        user is None
        or user.role not in ("admin", "staff")
        or not user.is_active
        or user.archived_at is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is unavailable",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

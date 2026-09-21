"""Secure single-use token helpers for public-account password recovery."""

from datetime import datetime, timedelta
import hashlib
import secrets

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import PasswordResetToken, User
from app.services.email_verification import utc_now


settings = get_settings()
TOKEN_BYTES = 32


def hash_password_reset_token(token: str) -> str:
    """Hash a raw reset token before database lookup/storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_password_reset_token(
    db: Session,
    user: User,
    *,
    now: datetime | None = None,
) -> tuple[str, PasswordResetToken]:
    """Invalidate older unused reset links and create a fresh expiring token."""
    issued_at = now or utc_now()

    outstanding = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .all()
    )
    for token in outstanding:
        token.used_at = issued_at

    raw_token = secrets.token_urlsafe(TOKEN_BYTES)
    token_record = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_password_reset_token(raw_token),
        expires_at=issued_at
        + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
    )
    db.add(token_record)
    return raw_token, token_record


def invalidate_password_reset_tokens(
    db: Session,
    user_id: int,
    *,
    now: datetime | None = None,
) -> None:
    """Mark every outstanding reset token for one user as consumed."""
    used_at = now or utc_now()
    outstanding = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None),
        )
        .all()
    )
    for token in outstanding:
        token.used_at = used_at

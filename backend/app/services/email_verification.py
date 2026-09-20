"""Secure token creation helpers for public email verification."""

from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import EmailVerificationToken, User


settings = get_settings()
TOKEN_BYTES = 32


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


def ensure_utc(value: datetime) -> datetime:
    """Normalize database timestamps that may be naive in SQLite tests."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def hash_verification_token(token: str) -> str:
    """Hash a raw verification token before database lookup/storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_verification_token(
    db: Session,
    user: User,
    *,
    now: datetime | None = None,
) -> tuple[str, EmailVerificationToken]:
    """Invalidate older unused tokens and issue a new expiring token."""
    issued_at = now or utc_now()

    active_tokens = (
        db.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used_at.is_(None),
        )
        .all()
    )
    for token in active_tokens:
        token.used_at = issued_at

    raw_token = secrets.token_urlsafe(TOKEN_BYTES)
    token_record = EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_verification_token(raw_token),
        expires_at=issued_at
        + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES),
    )

    db.add(token_record)
    return raw_token, token_record


def latest_verification_token(
    db: Session,
    user_id: int,
) -> EmailVerificationToken | None:
    """Return the most recently issued verification token for a user."""
    return (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.user_id == user_id)
        .order_by(
            EmailVerificationToken.created_at.desc(),
            EmailVerificationToken.id.desc(),
        )
        .first()
    )


def resend_is_allowed(
    latest_token: EmailVerificationToken | None,
    *,
    now: datetime | None = None,
) -> bool:
    """Enforce the configured cooldown between verification-email sends."""
    if latest_token is None:
        return True

    current_time = now or utc_now()
    created_at = ensure_utc(latest_token.created_at)
    elapsed = (current_time - created_at).total_seconds()

    return elapsed >= settings.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS

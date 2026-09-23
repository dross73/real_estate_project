"""TOTP, recovery-code, encryption, and login-challenge helpers."""

import base64
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
import struct
from urllib.parse import quote, urlencode

from cryptography.fernet import Fernet, InvalidToken
from jose.exceptions import JWTError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_mfa_enrollment_token, verify_access_token
from app.db.models import MfaLoginChallenge, SiteSetting, User


settings = get_settings()
INTERNAL_ROLES = ("admin", "staff")
MFA_CHALLENGE_MINUTES = 5
MFA_CHALLENGE_MAX_ATTEMPTS = 5
TOTP_PERIOD_SECONDS = 30
TOTP_DIGITS = 6
TOTP_WINDOW = 1
RECOVERY_CODE_COUNT = 8


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def internal_mfa_required(db: Session) -> bool:
    record = db.query(SiteSetting).filter(SiteSetting.id == 1).first()
    return bool(record.require_internal_mfa) if record is not None else False


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _decode_secret(secret: str) -> bytes:
    padding = "=" * ((8 - len(secret) % 8) % 8)
    return base64.b32decode(secret + padding, casefold=True)


def totp_code(secret: str, *, at_time: datetime | None = None) -> str:
    current = at_time or utc_now()
    counter = int(current.timestamp()) // TOTP_PERIOD_SECONDS
    digest = hmac.new(
        _decode_secret(secret),
        struct.pack(">Q", counter),
        hashlib.sha1,
    ).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % (10 ** TOTP_DIGITS)).zfill(TOTP_DIGITS)


def verify_totp(secret: str, code: str, *, at_time: datetime | None = None) -> bool:
    normalized = code.strip().replace(" ", "")
    if len(normalized) != TOTP_DIGITS or not normalized.isdigit():
        return False

    current = at_time or utc_now()
    for offset in range(-TOTP_WINDOW, TOTP_WINDOW + 1):
        candidate_time = current + timedelta(seconds=offset * TOTP_PERIOD_SECONDS)
        if hmac.compare_digest(totp_code(secret, at_time=candidate_time), normalized):
            return True
    return False


def provisioning_uri(email: str, secret: str) -> str:
    issuer = "Juniper & Lane Realty"
    label = f"{issuer}:{email}"
    query = urlencode(
        {
            "secret": secret,
            "issuer": issuer,
            "algorithm": "SHA1",
            "digits": TOTP_DIGITS,
            "period": TOTP_PERIOD_SECONDS,
        }
    )
    return f"otpauth://totp/{quote(label, safe='')}?{query}"


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(
        hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    )
    return Fernet(key)


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode("utf-8")).decode("ascii")


def decrypt_secret(encrypted: str) -> str | None:
    try:
        return _fernet().decrypt(encrypted.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        return None


def _normalize_recovery_code(code: str) -> str:
    return "".join(character for character in code.upper() if character.isalnum())


def hash_recovery_code(code: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        _normalize_recovery_code(code).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def generate_recovery_codes() -> list[str]:
    codes: list[str] = []
    for _ in range(RECOVERY_CODE_COUNT):
        raw = secrets.token_hex(8).upper()
        codes.append(f"{raw[:8]}-{raw[8:]}")
    return codes


def verify_user_mfa_code(user: User, code: str) -> tuple[bool, bool]:
    """Return (valid, recovery_code_used) without mutating the user."""
    if not user.mfa_enabled or not user.mfa_secret_encrypted:
        return False, False

    secret = decrypt_secret(user.mfa_secret_encrypted)
    if secret and verify_totp(secret, code):
        return True, False

    candidate_hash = hash_recovery_code(code)
    if any(
        hmac.compare_digest(candidate_hash, stored_hash)
        for stored_hash in (user.mfa_recovery_code_hashes or [])
    ):
        return True, True

    return False, False


def consume_recovery_code(user: User, code: str) -> None:
    candidate_hash = hash_recovery_code(code)
    user.mfa_recovery_code_hashes = [
        stored_hash
        for stored_hash in (user.mfa_recovery_code_hashes or [])
        if not hmac.compare_digest(candidate_hash, stored_hash)
    ]


def enroll_user(user: User, secret: str) -> list[str]:
    recovery_codes = generate_recovery_codes()
    user.mfa_secret_encrypted = encrypt_secret(secret)
    user.mfa_recovery_code_hashes = [
        hash_recovery_code(code) for code in recovery_codes
    ]
    user.mfa_enabled = True
    user.mfa_enrolled_at = utc_now()
    return recovery_codes


def clear_user_mfa(user: User) -> None:
    user.mfa_enabled = False
    user.mfa_secret_encrypted = None
    user.mfa_recovery_code_hashes = []
    user.mfa_enrolled_at = None


def issue_login_challenge(
    db: Session,
    user: User,
    *,
    reason: str,
) -> str:
    now = utc_now()

    # A newer password login supersedes older unused challenges for the account.
    (
        db.query(MfaLoginChallenge)
        .filter(
            MfaLoginChallenge.user_id == user.id,
            MfaLoginChallenge.used_at.is_(None),
        )
        .update({MfaLoginChallenge.used_at: now}, synchronize_session=False)
    )

    raw_token = secrets.token_urlsafe(32)
    record = MfaLoginChallenge(
        user_id=user.id,
        token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
        reason=reason,
        attempts=0,
        expires_at=now + timedelta(minutes=MFA_CHALLENGE_MINUTES),
    )
    db.add(record)
    db.commit()
    return raw_token


def get_login_challenge(
    db: Session,
    raw_token: str,
    *,
    expected_reason: str | None = None,
) -> tuple[MfaLoginChallenge, User] | None:
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    challenge = (
        db.query(MfaLoginChallenge)
        .filter(MfaLoginChallenge.token_hash == token_hash)
        .first()
    )
    if (
        challenge is None
        or challenge.used_at is not None
        or challenge.attempts >= MFA_CHALLENGE_MAX_ATTEMPTS
        or _ensure_utc(challenge.expires_at) <= utc_now()
        or (expected_reason is not None and challenge.reason != expected_reason)
    ):
        return None

    user = db.query(User).filter(User.id == challenge.user_id).first()
    if (
        user is None
        or user.role not in INTERNAL_ROLES
        or not user.is_active
        or user.archived_at is not None
    ):
        return None

    return challenge, user


def fail_login_challenge(db: Session, challenge: MfaLoginChallenge) -> None:
    challenge.attempts += 1
    if challenge.attempts >= MFA_CHALLENGE_MAX_ATTEMPTS:
        challenge.used_at = utc_now()
    db.commit()


def consume_login_challenge(db: Session, challenge: MfaLoginChallenge) -> None:
    challenge.used_at = utc_now()
    db.commit()


def start_enrollment(user: User) -> tuple[str, str, str]:
    secret = generate_totp_secret()
    token = create_mfa_enrollment_token(
        subject=user.email,
        role=user.role,
        secret=secret,
    )
    return secret, provisioning_uri(user.email, secret), token


def enrollment_secret(
    token: str,
    *,
    expected_email: str,
    expected_role: str,
) -> str | None:
    try:
        payload = verify_access_token(token)
    except JWTError:
        return None

    if (
        payload.get("purpose") != "mfa_enrollment"
        or payload.get("sub") != expected_email
        or payload.get("role") != expected_role
    ):
        return None

    secret = payload.get("mfa_secret")
    return str(secret) if secret else None

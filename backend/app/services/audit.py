"""Reusable append-only audit logging helpers."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import AuditLog


SENSITIVE_KEY_PARTS = (
    "password",
    "token",
    "secret",
    "authorization",
    "credential",
    "cookie",
    "private_key",
    "access_key",
    "smtp_password",
)


def _is_sensitive_key(key: str) -> bool:
    """Return whether a metadata key could contain authentication material."""
    normalized = key.strip().lower()
    return any(part in normalized for part in SENSITIVE_KEY_PARTS)


def sanitize_audit_details(value: Any) -> Any:
    """Recursively redact secret-bearing keys before audit persistence."""
    if isinstance(value, Mapping):
        sanitized: dict[str, Any] = {}
        for raw_key, raw_value in value.items():
            key = str(raw_key)
            if _is_sensitive_key(key):
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = sanitize_audit_details(raw_value)
        return sanitized

    if isinstance(value, Sequence) and not isinstance(
        value,
        (str, bytes, bytearray),
    ):
        return [sanitize_audit_details(item) for item in value]

    if isinstance(value, (str, int, float, bool)) or value is None:
        return value

    # Keep audit JSON serializable without relying on arbitrary object reprs.
    return str(value)


def record_audit_event(
    db: Session,
    *,
    actor_email: str,
    action: str,
    target_type: str,
    target_id: int | str,
    details: Mapping[str, Any] | None = None,
) -> AuditLog:
    """Stage one sanitized audit event in the caller's database transaction."""
    entry = AuditLog(
        actor_email=actor_email.strip().lower(),
        action=action.strip(),
        target_type=target_type.strip(),
        target_id=str(target_id),
        details=sanitize_audit_details(details or {}),
    )
    db.add(entry)
    return entry

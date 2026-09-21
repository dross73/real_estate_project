"""Reusable notification preferences and transactional email templates."""

from dataclasses import dataclass
from typing import Final

from sqlalchemy.orm import Session

from app.db.models import NotificationSetting
from app.services.email_service import TransactionalEmailService


LEAD_ASSIGNMENT: Final = "lead_assignment"
SHOWING_REQUEST_ASSIGNMENT: Final = "showing_request_assignment"
CONTACT_REQUEST_ASSIGNMENT: Final = "contact_request_assignment"
TESTIMONIAL_SUBMISSION: Final = "testimonial_submission"


@dataclass(frozen=True)
class NotificationDefinition:
    """Known admin-configurable notification behavior."""

    key: str
    description: str
    default_enabled: bool


NOTIFICATION_DEFINITIONS: Final[tuple[NotificationDefinition, ...]] = (
    NotificationDefinition(
        key=LEAD_ASSIGNMENT,
        description="Email the assigned agent/staff member when a new lead is assigned.",
        default_enabled=True,
    ),
    NotificationDefinition(
        key=SHOWING_REQUEST_ASSIGNMENT,
        description="Email the assigned agent/staff member for a new showing request.",
        default_enabled=True,
    ),
    NotificationDefinition(
        key=CONTACT_REQUEST_ASSIGNMENT,
        description="Email the assigned recipient for a general contact request.",
        default_enabled=True,
    ),
    NotificationDefinition(
        key=TESTIMONIAL_SUBMISSION,
        description="Email administrators when a testimonial awaits moderation.",
        default_enabled=False,
    ),
)

NOTIFICATION_BY_KEY: Final = {
    definition.key: definition for definition in NOTIFICATION_DEFINITIONS
}


def get_notification_definition(key: str) -> NotificationDefinition | None:
    """Return a known notification definition without accepting arbitrary keys."""
    return NOTIFICATION_BY_KEY.get(key)


def is_notification_enabled(db: Session, key: str) -> bool:
    """Return the persisted value or the safe product default."""
    definition = get_notification_definition(key)
    if definition is None:
        raise ValueError(f"Unknown notification key: {key}")

    setting = (
        db.query(NotificationSetting)
        .filter(NotificationSetting.key == key)
        .first()
    )

    return setting.enabled if setting is not None else definition.default_enabled


def set_notification_enabled(
    db: Session,
    *,
    key: str,
    enabled: bool,
    commit: bool = True,
) -> NotificationSetting:
    """Upsert one known admin-level notification preference.

    The API can defer commit so the preference and its audit entry are atomic.
    Other callers keep the existing auto-commit behavior by default.
    """
    definition = get_notification_definition(key)
    if definition is None:
        raise ValueError(f"Unknown notification key: {key}")

    setting = (
        db.query(NotificationSetting)
        .filter(NotificationSetting.key == key)
        .first()
    )

    if setting is None:
        setting = NotificationSetting(key=key, enabled=enabled)
        db.add(setting)
    else:
        setting.enabled = enabled

    if commit:
        db.commit()
        db.refresh(setting)
    else:
        db.flush()

    return setting


def send_lead_assignment_notification(
    db: Session,
    *,
    recipient_email: str,
    contact_name: str,
    listing_title: str | None = None,
    lead_id: int | None = None,
    email_service: TransactionalEmailService | None = None,
) -> bool:
    """Send the reusable high-value new-lead assignment notification."""
    if not is_notification_enabled(db, LEAD_ASSIGNMENT):
        return False

    service = email_service or TransactionalEmailService()

    listing_line = (
        f"Listing: {listing_title}\n"
        if listing_title
        else "Listing: General brokerage inquiry\n"
    )
    id_line = f"Lead ID: {lead_id}\n" if lead_id is not None else ""

    service.send(
        to_email=recipient_email,
        subject="New real estate lead assigned",
        text_body=(
            "A new lead has been assigned to you.\n\n"
            f"Contact: {contact_name}\n"
            f"{listing_line}"
            f"{id_line}"
            "\nOpen the admin lead workspace for full contact details and history."
        ),
    )

    return True


def send_showing_assignment_notification(
    db: Session,
    *,
    recipient_email: str,
    contact_name: str,
    listing_title: str,
    requested_time: str | None = None,
    lead_id: int | None = None,
    email_service: TransactionalEmailService | None = None,
) -> bool:
    """Send the reusable high-value showing-request assignment notification."""
    if not is_notification_enabled(db, SHOWING_REQUEST_ASSIGNMENT):
        return False

    service = email_service or TransactionalEmailService()

    time_line = (
        f"Requested time: {requested_time}\n"
        if requested_time
        else "Requested time: Not specified\n"
    )
    id_line = f"Lead ID: {lead_id}\n" if lead_id is not None else ""

    service.send(
        to_email=recipient_email,
        subject="New showing request assigned",
        text_body=(
            "A showing request has been assigned to you.\n\n"
            f"Contact: {contact_name}\n"
            f"Listing: {listing_title}\n"
            f"{time_line}"
            f"{id_line}"
            "\nOpen the admin lead workspace for full contact details and history."
        ),
    )

    return True

"""Tests for provider-neutral transactional email and notification templates."""

import logging
import smtplib

import pytest

from app.core.config import Settings
from app.db.models import NotificationSetting
from app.services.email_service import (
    EmailDeliveryError,
    TransactionalEmailService,
)
from app.services.notification_service import (
    LEAD_ASSIGNMENT,
    SHOWING_REQUEST_ASSIGNMENT,
    TESTIMONIAL_SUBMISSION,
    is_notification_enabled,
    send_lead_assignment_notification,
    send_showing_assignment_notification,
    set_notification_enabled,
)


BASE_SETTINGS = {
    "DATABASE_URL": "postgresql+psycopg2://user:pass@example.com:5432/database",
    "SECRET_KEY": "test-secret",
    "ACCESS_TOKEN_EXPIRE_MINUTES": 30,
    "JWT_ALGORITHM": "HS256",
    "JWT_ISSUER": "test-issuer",
    "JWT_AUDIENCE": "test-audience",
}


class FakeEmailService:
    """Capture notification messages without network delivery."""

    def __init__(self) -> None:
        self.messages: list[dict[str, str]] = []

    def send(self, *, to_email: str, subject: str, text_body: str) -> None:
        self.messages.append(
            {
                "to_email": to_email,
                "subject": subject,
                "text_body": text_body,
            }
        )


def _settings(**overrides) -> Settings:
    return Settings(
        _env_file=None,
        **BASE_SETTINGS,
        **overrides,
    )


def test_log_mode_suppresses_real_delivery_without_logging_message_body(
    caplog,
):
    """Local/test mode must not call SMTP or expose security-sensitive bodies."""
    smtp_called = False

    def smtp_factory(*args, **kwargs):
        nonlocal smtp_called
        smtp_called = True
        raise AssertionError("SMTP should not be called in log mode")

    service = TransactionalEmailService(
        settings=_settings(EMAIL_DELIVERY_MODE="log"),
        smtp_factory=smtp_factory,
    )

    secret_body = "Verification token: super-secret-token"
    with caplog.at_level(logging.INFO):
        service.send(
            to_email="person@example.com",
            subject="Verify your account",
            text_body=secret_body,
        )

    assert smtp_called is False
    assert "super-secret-token" not in caplog.text
    assert "suppressed by local/test mode" in caplog.text


def test_smtp_failure_raises_safe_delivery_error(caplog):
    """Provider failures should not leak SMTP passwords or message bodies."""
    class FailingSmtp:
        def __init__(self, *args, **kwargs):
            raise smtplib.SMTPConnectError(421, "provider unavailable")

    service = TransactionalEmailService(
        settings=_settings(
            EMAIL_DELIVERY_MODE="smtp",
            SMTP_HOST="smtp.example.com",
            SMTP_USERNAME="smtp-user",
            SMTP_PASSWORD="smtp-super-secret",
        ),
        smtp_factory=FailingSmtp,
    )

    with caplog.at_level(logging.ERROR), pytest.raises(EmailDeliveryError):
        service.send(
            to_email="person@example.com",
            subject="Sensitive subject",
            text_body="password-reset-token=do-not-log",
        )

    assert "smtp-super-secret" not in caplog.text
    assert "password-reset-token" not in caplog.text


def test_high_value_notifications_default_on(isolated_api_factory):
    """Lead/showing events remain enabled if no persisted row exists."""
    api = isolated_api_factory([])

    assert is_notification_enabled(api.db, LEAD_ASSIGNMENT) is True
    assert is_notification_enabled(api.db, SHOWING_REQUEST_ASSIGNMENT) is True
    assert is_notification_enabled(api.db, TESTIMONIAL_SUBMISSION) is False


def test_admin_level_preference_can_disable_and_reenable_notification(
    isolated_api_factory,
):
    """Persisted settings override the product default."""
    api = isolated_api_factory([])

    set_notification_enabled(
        api.db,
        key=LEAD_ASSIGNMENT,
        enabled=False,
    )
    assert is_notification_enabled(api.db, LEAD_ASSIGNMENT) is False

    set_notification_enabled(
        api.db,
        key=LEAD_ASSIGNMENT,
        enabled=True,
    )
    assert is_notification_enabled(api.db, LEAD_ASSIGNMENT) is True

    rows = api.db.query(NotificationSetting).all()
    assert len(rows) == 1


def test_lead_assignment_template_sends_when_enabled(isolated_api_factory):
    """Lead code can call one service without knowing provider details."""
    api = isolated_api_factory([])
    email = FakeEmailService()

    sent = send_lead_assignment_notification(
        api.db,
        recipient_email="agent@example.com",
        contact_name="Buyer Name",
        listing_title="123 Main Street",
        lead_id=42,
        email_service=email,
    )

    assert sent is True
    assert len(email.messages) == 1
    assert email.messages[0]["to_email"] == "agent@example.com"
    assert "123 Main Street" in email.messages[0]["text_body"]
    assert "Lead ID: 42" in email.messages[0]["text_body"]


def test_disabled_lead_assignment_does_not_send(isolated_api_factory):
    """Admin preference should suppress lower-level delivery calls."""
    api = isolated_api_factory([])
    email = FakeEmailService()
    set_notification_enabled(
        api.db,
        key=LEAD_ASSIGNMENT,
        enabled=False,
    )

    sent = send_lead_assignment_notification(
        api.db,
        recipient_email="agent@example.com",
        contact_name="Buyer Name",
        email_service=email,
    )

    assert sent is False
    assert email.messages == []


def test_showing_assignment_template_includes_request_context(
    isolated_api_factory,
):
    """Showing-request code can provide assignment-specific context."""
    api = isolated_api_factory([])
    email = FakeEmailService()

    sent = send_showing_assignment_notification(
        api.db,
        recipient_email="agent@example.com",
        contact_name="Buyer Name",
        listing_title="456 Oak Avenue",
        requested_time="Saturday at 2:00 PM",
        lead_id=17,
        email_service=email,
    )

    assert sent is True
    assert "456 Oak Avenue" in email.messages[0]["text_body"]
    assert "Saturday at 2:00 PM" in email.messages[0]["text_body"]
    assert "Lead ID: 17" in email.messages[0]["text_body"]

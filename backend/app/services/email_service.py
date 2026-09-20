"""Provider-neutral transactional email delivery."""

from email.message import EmailMessage
import logging
import smtplib
from urllib.parse import quote

from app.core.config import get_settings


logger = logging.getLogger(__name__)
settings = get_settings()


class EmailDeliveryError(RuntimeError):
    """Raised when a configured email provider cannot deliver a message."""


def build_verification_url(token: str) -> str:
    """Build the public frontend URL used by the verification email."""
    base_url = settings.PUBLIC_APP_URL.rstrip("/")
    encoded_token = quote(token, safe="")
    return f"{base_url}/verify-email?token={encoded_token}"


def send_email(to_email: str, subject: str, text_body: str) -> None:
    """Send an email through the configured local-log or SMTP transport."""
    if settings.EMAIL_DELIVERY_MODE == "log":
        logger.info(
            "Local email delivery: to=%s subject=%s body=%s",
            to_email,
            subject,
            text_body,
        )
        return

    if not settings.SMTP_HOST:
        raise EmailDeliveryError("SMTP_HOST is required for SMTP delivery")

    message = EmailMessage()
    message["From"] = settings.EMAIL_FROM_ADDRESS
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text_body)

    try:
        with smtplib.SMTP(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=settings.SMTP_TIMEOUT_SECONDS,
        ) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()

            if settings.SMTP_USERNAME:
                smtp.login(
                    settings.SMTP_USERNAME,
                    settings.SMTP_PASSWORD or "",
                )

            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise EmailDeliveryError("Email delivery failed") from exc


def send_verification_email(to_email: str, token: str) -> None:
    """Send a public-account verification link."""
    verification_url = build_verification_url(token)

    body = (
        "Verify your email address for your real estate account.\n\n"
        f"{verification_url}\n\n"
        "If you did not create this account, you can ignore this email."
    )

    send_email(
        to_email=to_email,
        subject="Verify your email address",
        text_body=body,
    )

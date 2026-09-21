"""Provider-neutral transactional email delivery."""

from collections.abc import Callable
from email.message import EmailMessage
import logging
import smtplib
from urllib.parse import quote

from app.core.config import Settings, get_settings


logger = logging.getLogger(__name__)


class EmailDeliveryError(RuntimeError):
    """Raised when a configured email provider cannot deliver a message."""


class TransactionalEmailService:
    """Send transactional messages without coupling features to one provider."""

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        smtp_factory: Callable[..., smtplib.SMTP] | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.smtp_factory = smtp_factory or smtplib.SMTP

    def send(
        self,
        *,
        to_email: str,
        subject: str,
        text_body: str,
    ) -> None:
        """Send one message or safely suppress it in local/test log mode."""
        if self.settings.EMAIL_DELIVERY_MODE == "log":
            # Never log message bodies because they may contain verification,
            # reset, invitation, or other security-sensitive links.
            logger.info(
                "Transactional email suppressed by local/test mode: "
                "recipient=%s subject=%s",
                to_email,
                subject,
            )
            return

        if not self.settings.SMTP_HOST:
            raise EmailDeliveryError("SMTP_HOST is required for SMTP delivery")

        message = EmailMessage()
        message["From"] = self.settings.EMAIL_FROM_ADDRESS
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(text_body)

        try:
            with self.smtp_factory(
                self.settings.SMTP_HOST,
                self.settings.SMTP_PORT,
                timeout=self.settings.SMTP_TIMEOUT_SECONDS,
            ) as smtp:
                if self.settings.SMTP_USE_TLS:
                    smtp.starttls()

                if self.settings.SMTP_USERNAME:
                    smtp.login(
                        self.settings.SMTP_USERNAME,
                        self.settings.SMTP_PASSWORD or "",
                    )

                smtp.send_message(message)
        except (OSError, smtplib.SMTPException) as exc:
            # Do not log recipient content, body, credentials, or security tokens.
            logger.exception("Transactional SMTP delivery failed")
            raise EmailDeliveryError("Email delivery failed") from exc


def build_verification_url(
    token: str,
    *,
    settings: Settings | None = None,
) -> str:
    """Build the public frontend URL used by the verification email."""
    runtime_settings = settings or get_settings()
    base_url = runtime_settings.PUBLIC_APP_URL.rstrip("/")
    encoded_token = quote(token, safe="")
    return f"{base_url}/verify-email?token={encoded_token}"


def send_email(to_email: str, subject: str, text_body: str) -> None:
    """Backward-compatible wrapper around the reusable email service."""
    TransactionalEmailService().send(
        to_email=to_email,
        subject=subject,
        text_body=text_body,
    )


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

"""Tests for public-account email verification behavior."""

from collections.abc import Generator
from datetime import timedelta

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.api.auth as auth_api
from app.api.auth import router as auth_router
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.models import EmailVerificationToken, User
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_verified_public_user
from app.services.email_verification import (
    hash_verification_token,
    issue_verification_token,
    latest_verification_token,
    utc_now,
)


settings = get_settings()


@pytest.fixture()
def verification_test_app(
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[tuple[TestClient, Session, list[tuple[str, str]]], None, None]:
    """Provide an isolated app, database, and captured verification messages."""
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )

    Base.metadata.create_all(bind=engine)
    db = testing_session()
    sent_messages: list[tuple[str, str]] = []

    def capture_verification_email(email: str, token: str) -> None:
        sent_messages.append((email, token))

    monkeypatch.setattr(
        auth_api,
        "send_verification_email",
        capture_verification_email,
    )

    app = FastAPI()
    app.include_router(auth_router)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    @app.get("/test/verified-only")
    def verified_only(
        user: User = Depends(require_verified_public_user),
    ):
        return {"email": user.email}

    try:
        yield TestClient(app), db, sent_messages
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _register(client: TestClient, email: str = "public@example.com"):
    """Register a public user through the real API."""
    return client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Public User",
        },
    )


def _login(client: TestClient, email: str = "public@example.com") -> str:
    """Log in and return the bearer token."""
    response = client.post(
        "/auth/login",
        data={
            "username": email,
            "password": "Password123!",
        },
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _create_public_user(
    db: Session,
    *,
    email: str,
    verified: bool = False,
) -> User:
    """Insert a public user for token-state tests."""
    user = User(
        email=email,
        full_name="Public User",
        hashed_password=get_password_hash("Password123!"),
        is_active=True,
        role="public_user",
        email_verified_at=utc_now() if verified else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_registration_starts_unverified_and_emails_hashed_token(
    verification_test_app,
):
    """Registration should persist only a token hash and send the raw token."""
    client, db, sent_messages = verification_test_app

    response = _register(client)

    assert response.status_code == 201

    user = db.query(User).filter(User.email == "public@example.com").one()
    assert user.email_verified_at is None

    assert len(sent_messages) == 1
    sent_email, raw_token = sent_messages[0]
    assert sent_email == "public@example.com"

    token_record = db.query(EmailVerificationToken).one()
    assert token_record.token_hash == hash_verification_token(raw_token)
    assert token_record.token_hash != raw_token
    assert token_record.used_at is None


def test_valid_token_verifies_user_and_cannot_be_reused(verification_test_app):
    """A valid token verifies once and becomes unusable afterward."""
    client, db, sent_messages = verification_test_app
    _register(client)
    raw_token = sent_messages[0][1]

    first_response = client.post(
        "/auth/email-verification/verify",
        json={"token": raw_token},
    )

    assert first_response.status_code == 200
    assert first_response.json()["status"] == "verified"

    user = db.query(User).filter(User.email == "public@example.com").one()
    db.refresh(user)
    assert user.email_verified_at is not None

    second_response = client.post(
        "/auth/email-verification/verify",
        json={"token": raw_token},
    )

    assert second_response.status_code == 400
    assert second_response.json()["detail"] == (
        "Verification link has already been used"
    )


def test_invalid_verification_token_is_rejected(verification_test_app):
    """Unknown token values should not reveal account information."""
    client, _, _ = verification_test_app

    response = client.post(
        "/auth/email-verification/verify",
        json={"token": "invalid-token-value-that-is-long-enough"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid verification link"


def test_expired_verification_token_is_rejected(verification_test_app):
    """Expired tokens should be consumed and rejected."""
    client, db, _ = verification_test_app
    user = _create_public_user(db, email="expired@example.com")

    raw_token, _ = issue_verification_token(
        db,
        user,
        now=utc_now() - timedelta(days=2),
    )
    db.commit()

    response = client.post(
        "/auth/email-verification/verify",
        json={"token": raw_token},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Verification link has expired"


def test_token_for_already_verified_user_is_handled_idempotently(
    verification_test_app,
):
    """A token for an already-verified account should not reapply verification."""
    client, db, _ = verification_test_app
    user = _create_public_user(
        db,
        email="verified@example.com",
        verified=True,
    )

    raw_token, token_record = issue_verification_token(db, user)
    db.commit()

    response = client.post(
        "/auth/email-verification/verify",
        json={"token": raw_token},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "already_verified"

    db.refresh(token_record)
    assert token_record.used_at is not None


def test_resend_uses_generic_response_and_enforces_cooldown(
    verification_test_app,
):
    """Immediate repeat requests should not generate another token/email."""
    client, db, sent_messages = verification_test_app
    _register(client)

    first_resend = client.post(
        "/auth/email-verification/resend",
        json={"email": "PUBLIC@EXAMPLE.COM"},
    )

    assert first_resend.status_code == 202
    assert len(sent_messages) == 1

    latest = latest_verification_token(
        db,
        db.query(User).filter(User.email == "public@example.com").one().id,
    )
    assert latest is not None

    latest.created_at = utc_now() - timedelta(
        seconds=settings.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS + 1,
    )
    db.commit()

    second_resend = client.post(
        "/auth/email-verification/resend",
        json={"email": "public@example.com"},
    )

    assert second_resend.status_code == 202
    assert second_resend.json() == first_resend.json()
    assert len(sent_messages) == 2

    token_records = db.query(EmailVerificationToken).all()
    assert len(token_records) == 2
    assert sum(token.used_at is None for token in token_records) == 1


def test_resend_does_not_reveal_unknown_account(verification_test_app):
    """Unknown emails receive the same generic accepted response."""
    client, _, sent_messages = verification_test_app

    response = client.post(
        "/auth/email-verification/resend",
        json={"email": "missing@example.com"},
    )

    assert response.status_code == 202
    assert response.json()["message"] == auth_api.GENERIC_RESEND_MESSAGE
    assert sent_messages == []


def test_verified_public_user_dependency_blocks_then_allows_account(
    verification_test_app,
):
    """Future favorites/inquiries/etc. can depend on verified ownership."""
    client, _, sent_messages = verification_test_app
    _register(client)
    raw_token = sent_messages[0][1]
    access_token = _login(client)

    headers = {"Authorization": f"Bearer {access_token}"}

    blocked_response = client.get(
        "/test/verified-only",
        headers=headers,
    )
    assert blocked_response.status_code == 403
    assert blocked_response.json()["detail"] == "Email verification required"

    verify_response = client.post(
        "/auth/email-verification/verify",
        json={"token": raw_token},
    )
    assert verify_response.status_code == 200

    allowed_response = client.get(
        "/test/verified-only",
        headers=headers,
    )
    assert allowed_response.status_code == 200
    assert allowed_response.json()["email"] == "public@example.com"

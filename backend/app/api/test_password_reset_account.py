"""Tests for public-account password recovery and self-service settings."""

from collections.abc import Generator
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.auth import router as auth_router
from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.db.base import Base
from app.db.models import PasswordResetToken, SavedSearch, User
from app.db.session import get_db
from app.services.password_reset import issue_password_reset_token


@pytest.fixture()
def account_app() -> Generator[tuple[TestClient, Session], None, None]:
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

    app = FastAPI()
    app.include_router(auth_router)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    try:
        yield TestClient(app), db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _user(
    db: Session,
    *,
    email: str,
    role: str = "public_user",
    verified: bool = True,
    password: str = "Password123!",
) -> User:
    user = User(
        email=email,
        full_name="Original Name",
        phone=None,
        hashed_password=get_password_hash(password),
        is_active=True,
        role=role,
        email_verified_at=(
            datetime.now(timezone.utc) if verified else None
        ),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token(
        subject=user.email,
        role=user.role,
    )
    return {"Authorization": f"Bearer {token}"}


def test_password_reset_request_uses_generic_response_and_creates_token(
    account_app,
):
    client, db = account_app
    user = _user(db, email="reset@example.com")

    response = client.post(
        "/auth/password-reset/request",
        json={"email": user.email},
    )

    assert response.status_code == 202
    assert "If an eligible account exists" in response.json()["message"]

    tokens = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.user_id == user.id)
        .all()
    )
    assert len(tokens) == 1
    assert len(tokens[0].token_hash) == 64

    unknown = client.post(
        "/auth/password-reset/request",
        json={"email": "unknown@example.com"},
    )
    assert unknown.status_code == 202
    assert unknown.json() == response.json()
    assert db.query(PasswordResetToken).count() == 1


def test_password_reset_request_does_not_issue_tokens_for_internal_users(
    account_app,
):
    client, db = account_app
    user = _user(
        db,
        email="staff@example.com",
        role="staff",
    )

    response = client.post(
        "/auth/password-reset/request",
        json={"email": user.email},
    )

    assert response.status_code == 202
    assert db.query(PasswordResetToken).count() == 0


def test_password_reset_token_is_single_use_and_changes_password(account_app):
    client, db = account_app
    user = _user(db, email="single-use@example.com")
    raw_token, token_record = issue_password_reset_token(db, user)
    db.commit()
    db.refresh(token_record)

    assert token_record.token_hash != raw_token

    response = client.post(
        "/auth/password-reset/confirm",
        json={
            "token": raw_token,
            "new_password": "NewPassword456!",
        },
    )

    assert response.status_code == 200
    db.refresh(user)
    db.refresh(token_record)
    assert verify_password("NewPassword456!", user.hashed_password)
    assert token_record.used_at is not None

    reused = client.post(
        "/auth/password-reset/confirm",
        json={
            "token": raw_token,
            "new_password": "AnotherPassword789!",
        },
    )
    assert reused.status_code == 400


def test_expired_password_reset_token_is_rejected_and_consumed(account_app):
    client, db = account_app
    user = _user(db, email="expired@example.com")
    raw_token, token_record = issue_password_reset_token(
        db,
        user,
        now=datetime.now(timezone.utc) - timedelta(hours=2),
    )
    db.commit()

    response = client.post(
        "/auth/password-reset/confirm",
        json={
            "token": raw_token,
            "new_password": "NewPassword456!",
        },
    )

    assert response.status_code == 400
    assert "expired" in response.json()["detail"].lower()
    db.refresh(token_record)
    assert token_record.used_at is not None


def test_verified_public_user_can_update_only_own_profile(account_app):
    client, db = account_app
    user = _user(db, email="profile@example.com")
    other = _user(db, email="other@example.com")

    response = client.put(
        "/auth/account",
        headers=_headers(user),
        json={
            "full_name": " Updated Person ",
            "phone": " 515-555-0110 ",
        },
    )

    assert response.status_code == 200
    assert response.json()["full_name"] == "Updated Person"
    assert response.json()["phone"] == "515-555-0110"

    db.refresh(user)
    db.refresh(other)
    assert user.full_name == "Updated Person"
    assert user.phone == "515-555-0110"
    assert other.full_name == "Original Name"
    assert other.phone is None


def test_account_settings_reject_privileged_fields(account_app):
    client, db = account_app
    user = _user(db, email="safe@example.com")

    response = client.put(
        "/auth/account",
        headers=_headers(user),
        json={
            "full_name": "Safe User",
            "role": "admin",
        },
    )

    assert response.status_code == 422
    db.refresh(user)
    assert user.role == "public_user"


def test_verified_public_user_can_change_password(account_app):
    client, db = account_app
    user = _user(db, email="change@example.com")

    wrong = client.post(
        "/auth/account/change-password",
        headers=_headers(user),
        json={
            "current_password": "wrong-password",
            "new_password": "NewPassword456!",
        },
    )
    assert wrong.status_code == 400

    changed = client.post(
        "/auth/account/change-password",
        headers=_headers(user),
        json={
            "current_password": "Password123!",
            "new_password": "NewPassword456!",
        },
    )

    assert changed.status_code == 200
    db.refresh(user)
    assert verify_password("NewPassword456!", user.hashed_password)
    assert not verify_password("Password123!", user.hashed_password)


def test_unverified_public_user_cannot_access_account_settings(account_app):
    client, db = account_app
    user = _user(
        db,
        email="unverified@example.com",
        verified=False,
    )

    response = client.get(
        "/auth/account",
        headers=_headers(user),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Email verification required"



def test_public_user_can_archive_account_without_deleting_history(account_app):
    client, db = account_app
    user = _user(db, email="archive@example.com")
    saved_search = SavedSearch(
        user_id=user.id,
        name="Ames homes",
        criteria={"location": "Ames"},
        alert_frequency="daily",
        alerts_enabled=True,
    )
    db.add(saved_search)
    db.commit()
    db.refresh(saved_search)

    response = client.post(
        "/auth/account/archive",
        headers=_headers(user),
        json={"current_password": "Password123!"},
    )

    assert response.status_code == 200
    assert "Historical records may be retained" in response.json()["message"]

    db.refresh(user)
    db.refresh(saved_search)
    assert user.is_active is False
    assert user.archived_at is not None
    assert saved_search.id is not None
    assert saved_search.alerts_enabled is False

    login_response = client.post(
        "/auth/login",
        data={
            "username": user.email,
            "password": "Password123!",
        },
    )
    assert login_response.status_code == 403


def test_public_account_archive_requires_current_password(account_app):
    client, db = account_app
    user = _user(db, email="archive-safe@example.com")

    response = client.post(
        "/auth/account/archive",
        headers=_headers(user),
        json={"current_password": "incorrect"},
    )

    assert response.status_code == 400
    db.refresh(user)
    assert user.is_active is True
    assert user.archived_at is None

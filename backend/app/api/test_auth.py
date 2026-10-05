"""Integration-style tests for authentication and role boundaries."""

from collections.abc import Generator
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.api.auth as auth_api
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.core.security import get_password_hash, verify_access_token
from app.db.base import Base
from app.db.models import User
from app.db.session import get_db


@pytest.fixture()
def auth_test_app() -> Generator[tuple[TestClient, Session], None, None]:
    """Provide an isolated in-memory database and FastAPI app for each test."""
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
    app.include_router(users_router)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    try:
        yield TestClient(app), db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _create_user(
    db: Session,
    *,
    email: str,
    role: str,
    is_active: bool = True,
    password: str = "Password123!",
    verified: bool = False,
) -> User:
    """Insert a test user with a real password hash."""
    user = User(
        email=email,
        full_name="Test User",
        hashed_password=get_password_hash(password),
        is_active=is_active,
        role=role,
        email_verified_at=datetime.now(timezone.utc) if verified else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _login(client: TestClient, email: str, password: str = "Password123!"):
    """Submit credentials using the form format expected by OAuth2 login."""
    return client.post(
        "/auth/login",
        data={"username": email, "password": password},
    )


def test_public_registration_normalizes_email_and_forces_public_role(auth_test_app):
    """Self-registration should always create an active public user."""
    client, db = auth_test_app

    response = client.post(
        "/auth/register",
        json={
            "email": "New.User@Example.COM",
            "password": "Password123!",
            "full_name": "New User",
        },
    )

    assert response.status_code == 201
    assert response.json()["email"] == "new.user@example.com"
    assert response.json()["role"] == "public_user"
    assert response.json()["is_active"] is True

    user = db.query(User).filter(User.email == "new.user@example.com").one()
    assert user.role == "public_user"


@pytest.mark.parametrize(
    ("field_name", "field_value"),
    [
        ("role", "admin"),
        ("role_ids", [1]),
        ("is_active", False),
    ],
)
def test_public_registration_rejects_privileged_fields(
    auth_test_app,
    field_name,
    field_value,
):
    """Public callers cannot submit role or activation controls."""
    client, _ = auth_test_app

    payload = {
        "email": "public@example.com",
        "password": "Password123!",
        field_name: field_value,
    }

    response = client.post("/auth/register", json=payload)

    assert response.status_code == 422


def test_public_registration_enforces_normalized_email_uniqueness(auth_test_app):
    """Case differences must not create duplicate public accounts."""
    client, _ = auth_test_app

    first_response = client.post(
        "/auth/register",
        json={
            "email": "person@example.com",
            "password": "Password123!",
        },
    )
    duplicate_response = client.post(
        "/auth/register",
        json={
            "email": "PERSON@EXAMPLE.COM",
            "password": "Password123!",
        },
    )

    assert first_response.status_code == 201
    assert duplicate_response.status_code == 409


@pytest.mark.parametrize("role", ["admin", "staff", "public_user"])
def test_inactive_user_cannot_log_in(auth_test_app, role):
    """Inactive accounts must not receive new JWTs."""
    client, db = auth_test_app
    _create_user(
        db,
        email="inactive@example.com",
        role=role,
        is_active=False,
    )

    response = _login(client, "INACTIVE@EXAMPLE.COM")

    assert response.status_code == 403
    assert response.json()["detail"] == "Account is inactive"


@pytest.mark.parametrize("role", ["admin", "staff", "public_user"])
def test_supported_roles_can_log_in_when_active(auth_test_app, role):
    """Verified customers and internal users without email verification can log in."""
    client, db = auth_test_app
    _create_user(
        db,
        email=f"{role}@example.com",
        role=role,
        verified=role == "public_user",
    )

    response = _login(client, f"{role.upper()}@EXAMPLE.COM")

    assert response.status_code == 200
    payload = verify_access_token(response.json()["access_token"])
    assert payload["role"] == role


def test_unverified_public_user_cannot_receive_access_token(auth_test_app, monkeypatch):
    """Correct credentials cannot bypass public email verification."""
    client, db = auth_test_app
    _create_user(db, email="unverified@example.com", role="public_user")

    def unexpected_token(*args, **kwargs):
        pytest.fail("Unverified public login must not mint an access token")

    monkeypatch.setattr(auth_api, "create_access_token", unexpected_token)
    response = _login(client, "UNVERIFIED@EXAMPLE.COM")

    assert response.status_code == 403
    assert response.json() == {"detail": "Email verification required"}


@pytest.mark.parametrize("email", ["unverified@example.com", "missing@example.com"])
def test_invalid_credentials_do_not_disclose_email_verification(auth_test_app, email):
    """Check the password before revealing verification state."""
    client, db = auth_test_app
    _create_user(db, email="unverified@example.com", role="public_user")

    response = _login(client, email, password="wrong-password")

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials"}


def test_archived_unverified_public_user_cannot_log_in(auth_test_app):
    """Archival takes precedence even if the active flag remains set."""
    client, db = auth_test_app
    user = _create_user(db, email="archived@example.com", role="public_user")
    user.archived_at = datetime.now(timezone.utc)
    db.commit()

    response = _login(client, user.email)

    assert response.status_code == 403
    assert response.json() == {"detail": "Account is inactive"}


def test_public_user_cannot_access_admin_user_api(auth_test_app):
    """A public-user JWT must be rejected from admin-only user management."""
    client, db = auth_test_app
    _create_user(db, email="public@example.com", role="public_user", verified=True)

    login_response = _login(client, "public@example.com")
    token = login_response.json()["access_token"]

    response = client.get(
        "/users/",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_admin_can_still_access_admin_user_api(auth_test_app):
    """Existing administrator login and user-management access must continue."""
    client, db = auth_test_app
    _create_user(db, email="admin@example.com", role="admin")

    login_response = _login(client, "admin@example.com")
    token = login_response.json()["access_token"]

    response = client.get(
        "/users/",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200


def test_public_registration_rejects_password_over_bcrypt_byte_limit(auth_test_app):
    """Oversized passwords should fail validation instead of crashing bcrypt."""
    client, _ = auth_test_app

    response = client.post(
        "/auth/register",
        json={
            "email": "long-password@example.com",
            "password": "a" * 73,
        },
    )

    assert response.status_code == 422



def test_admin_can_identify_archived_public_accounts(auth_test_app):
    """Archived public accounts remain visible to admins but are not active."""
    client, db = auth_test_app
    admin = _create_user(
        db,
        email="admin-archive@example.com",
        role="admin",
    )
    archived = _create_user(
        db,
        email="closed@example.com",
        role="public_user",
        is_active=False,
    )
    archived.archived_at = datetime.now(timezone.utc)
    db.commit()

    token = _login(client, admin.email).json()["access_token"]
    response = client.get(
        "/users/",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    archived_payload = next(
        user for user in response.json() if user["id"] == archived.id
    )
    assert archived_payload["is_active"] is False
    assert archived_payload["archived_at"] is not None


def test_admin_cannot_reactivate_archived_account(auth_test_app):
    """Archived accounts require a separate restoration policy, not active toggle."""
    client, db = auth_test_app
    admin = _create_user(
        db,
        email="admin-reactivate@example.com",
        role="admin",
    )
    archived = _create_user(
        db,
        email="closed-reactivate@example.com",
        role="public_user",
        is_active=False,
    )
    archived.archived_at = datetime.now(timezone.utc)
    db.commit()

    token = _login(client, admin.email).json()["access_token"]
    response = client.put(
        f"/users/{archived.id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"is_active": True},
    )

    assert response.status_code == 409
    db.refresh(archived)
    assert archived.is_active is False
    assert archived.archived_at is not None

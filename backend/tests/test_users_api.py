"""Integration coverage for administrator-managed users and role boundaries."""

from collections.abc import Callable

import pytest

from app.api.users import router as users_router
from app.core.security import create_access_token, verify_password
from app.db.models import User


def _headers(role: str, email: str | None = None) -> dict[str, str]:
    """Create a bearer token for one test role."""
    subject = email or f"{role}@example.com"
    token = create_access_token(subject=subject, role=role)
    return {"Authorization": f"Bearer {token}"}


def _seed_user(
    db,
    *,
    email: str,
    role: str = "staff",
    is_active: bool = True,
) -> User:
    """Insert one user without coupling CRUD tests to the registration endpoint."""
    from app.core.security import get_password_hash

    user = User(
        email=email,
        full_name="Existing User",
        hashed_password=get_password_hash("Password123!"),
        is_active=is_active,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_users_api_requires_admin(isolated_api_factory):
    """Unauthenticated, staff, and public users cannot enter user management."""
    api = isolated_api_factory([users_router])

    unauthenticated = api.client.get("/users/")
    staff = api.client.get("/users/", headers=_headers("staff"))
    public_user = api.client.get(
        "/users/",
        headers=_headers("public_user"),
    )

    assert unauthenticated.status_code in (401, 403)
    assert staff.status_code == 403
    assert public_user.status_code == 403


def test_admin_can_create_normalized_internal_user(isolated_api_factory):
    """Admin creation normalizes email and stores only a bcrypt password hash."""
    api = isolated_api_factory([users_router])

    response = api.client.post(
        "/users/",
        headers=_headers("admin"),
        json={
            "email": "New.Staff@Example.COM",
            "password": "Password123!",
            "full_name": "  New Staff  ",
            "is_active": True,
            "role": "staff",
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["email"] == "new.staff@example.com"
    assert payload["full_name"] == "New Staff"
    assert payload["role"] == "staff"
    assert "hashed_password" not in payload
    assert "password" not in payload

    stored = (
        api.db.query(User)
        .filter(User.email == "new.staff@example.com")
        .one()
    )
    assert stored.hashed_password != "Password123!"
    assert verify_password("Password123!", stored.hashed_password) is True


def test_admin_create_rejects_duplicate_email_case_insensitively(
    isolated_api_factory,
):
    """Normalized email uniqueness should apply to administrator-created users."""
    api = isolated_api_factory([users_router])
    _seed_user(api.db, email="person@example.com")

    response = api.client.post(
        "/users/",
        headers=_headers("admin"),
        json={
            "email": "PERSON@EXAMPLE.COM",
            "password": "Password123!",
            "full_name": "Duplicate",
            "is_active": True,
            "role": "staff",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Email already registered"


def test_admin_create_cannot_assign_public_user_role(isolated_api_factory):
    """The internal-create endpoint remains limited to admin/staff accounts."""
    api = isolated_api_factory([users_router])

    response = api.client.post(
        "/users/",
        headers=_headers("admin"),
        json={
            "email": "public@example.com",
            "password": "Password123!",
            "full_name": "Public User",
            "is_active": True,
            "role": "public_user",
        },
    )

    assert response.status_code == 422


def test_admin_can_read_update_and_delete_user(isolated_api_factory):
    """The complete current administrator CRUD path should remain functional."""
    api = isolated_api_factory([users_router])
    user = _seed_user(api.db, email="managed@example.com")

    read_response = api.client.get(
        f"/users/{user.id}",
        headers=_headers("admin"),
    )
    assert read_response.status_code == 200
    assert read_response.json()["email"] == "managed@example.com"

    update_response = api.client.put(
        f"/users/{user.id}",
        headers=_headers("admin"),
        json={
            "full_name": "  Managed User Updated  ",
            "is_active": False,
            "role": "admin",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["full_name"] == "Managed User Updated"
    assert update_response.json()["is_active"] is False
    assert update_response.json()["role"] == "admin"

    delete_response = api.client.delete(
        f"/users/{user.id}",
        headers=_headers("admin"),
    )
    assert delete_response.status_code == 204
    assert api.db.query(User).filter(User.id == user.id).first() is None


@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_user_by_id_operations_return_404_for_missing_user(
    isolated_api_factory,
    method,
):
    """Missing users return a consistent not-found response."""
    api = isolated_api_factory([users_router])
    request = getattr(api.client, method)

    kwargs = {"headers": _headers("admin")}
    if method == "put":
        kwargs["json"] = {"full_name": "Nobody"}

    response = request("/users/9999", **kwargs)

    assert response.status_code == 404
    assert response.json()["detail"] == "User with ID 9999 not found"


@pytest.mark.parametrize("method", ["post", "put", "delete"])
def test_staff_cannot_mutate_users(
    isolated_api_factory,
    method,
):
    """Staff authorization must block every user-management write operation."""
    api = isolated_api_factory([users_router])
    existing = _seed_user(api.db, email="existing@example.com")
    request = getattr(api.client, method)

    if method == "post":
        response = request(
            "/users/",
            headers=_headers("staff"),
            json={
                "email": "new@example.com",
                "password": "Password123!",
                "full_name": "New User",
                "is_active": True,
                "role": "staff",
            },
        )
    elif method == "put":
        response = request(
            f"/users/{existing.id}",
            headers=_headers("staff"),
            json={"full_name": "Changed"},
        )
    else:
        response = request(
            f"/users/{existing.id}",
            headers=_headers("staff"),
        )

    assert response.status_code == 403

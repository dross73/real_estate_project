"""Focused authorization error-path tests for JWT dependencies."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from jose import jwt

from app.core.config import get_settings
from app.core.security import create_access_token
from app.dependencies.auth_dependencies import require_admin, require_staff_or_admin


settings = get_settings()
router = APIRouter()


@router.get("/test/admin-only")
def admin_only(_: str = Depends(require_admin)):
    return {"status": "ok"}


@router.get("/test/staff-or-admin")
def staff_or_admin(_: str = Depends(require_staff_or_admin)):
    return {"status": "ok"}


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_corrupted_token_returns_401(isolated_api_factory):
    """Malformed bearer tokens should be authentication failures, not 500s."""
    api = isolated_api_factory([router])

    response = api.client.get(
        "/test/admin-only",
        headers=_headers("not-a-valid-jwt"),
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or corrupted token"


def test_expired_token_returns_401(isolated_api_factory):
    """Expired credentials should return a clear unauthorized response."""
    api = isolated_api_factory([router])
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": "admin@example.com",
            "role": "admin",
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
        },
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    response = api.client.get(
        "/test/admin-only",
        headers=_headers(token),
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Token has expired"


def test_token_missing_subject_returns_401(isolated_api_factory):
    """Role alone is insufficient; authenticated tokens require a subject."""
    api = isolated_api_factory([router])
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "role": "admin",
            "iat": now,
            "exp": now + timedelta(minutes=30),
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
        },
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    response = api.client.get(
        "/test/admin-only",
        headers=_headers(token),
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Token missing subject claim"


def test_public_user_is_forbidden_from_internal_staff_endpoint(
    isolated_api_factory,
):
    """A valid public JWT must still fail internal role authorization."""
    api = isolated_api_factory([router])
    token = create_access_token(
        subject="public@example.com",
        role="public_user",
    )

    response = api.client.get(
        "/test/staff-or-admin",
        headers=_headers(token),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Staff or admin privileges required"

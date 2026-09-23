"""Integration coverage for internal TOTP MFA and recovery paths."""

from datetime import datetime, timezone

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.core.security import get_password_hash, verify_access_token
from app.db.models import SiteSetting, User
from app.services.mfa import enroll_user, totp_code


PASSWORD = "Password123!"


def _create_user(db, *, email: str, role: str) -> User:
    user = User(
        email=email,
        full_name="MFA Test User",
        hashed_password=get_password_hash(PASSWORD),
        is_active=True,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _login(client, email: str):
    return client.post(
        "/auth/login",
        data={"username": email, "password": PASSWORD},
    )


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_totp_matches_rfc_reference_value():
    """Use a known SHA-1 TOTP vector to guard the hand-rolled implementation."""
    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    at_time = datetime.fromtimestamp(59, tz=timezone.utc)

    assert totp_code(secret, at_time=at_time) == "287082"


def test_internal_user_can_enroll_and_login_with_totp(isolated_api_factory):
    api = isolated_api_factory([auth_router])
    user = _create_user(
        api.db,
        email="staff-mfa@example.com",
        role="staff",
    )

    password_login = _login(api.client, user.email)
    assert password_login.status_code == 200
    assert password_login.json()["status"] == "authenticated"

    initial_token = password_login.json()["access_token"]
    initial_payload = verify_access_token(initial_token)
    assert initial_payload["mfa_verified"] is False

    start = api.client.post(
        "/auth/mfa/enrollment/start",
        headers=_headers(initial_token),
        json={},
    )
    assert start.status_code == 200
    secret = start.json()["secret"]
    assert start.json()["provisioning_uri"].startswith("otpauth://totp/")

    confirm = api.client.post(
        "/auth/mfa/enrollment/confirm",
        headers=_headers(initial_token),
        json={
            "enrollment_token": start.json()["enrollment_token"],
            "code": totp_code(secret),
        },
    )
    assert confirm.status_code == 200
    assert len(confirm.json()["recovery_codes"]) == 8
    assert confirm.json()["access_token"]

    api.db.refresh(user)
    assert user.mfa_enabled is True
    assert user.mfa_secret_encrypted
    assert user.mfa_secret_encrypted != secret
    assert len(user.mfa_recovery_code_hashes) == 8

    refreshed_payload = verify_access_token(confirm.json()["access_token"])
    assert refreshed_payload["mfa_verified"] is True

    second_login = _login(api.client, user.email)
    assert second_login.status_code == 200
    assert second_login.json()["status"] == "mfa_required"
    assert second_login.json()["access_token"] is None

    verify = api.client.post(
        "/auth/mfa/challenge/verify",
        json={
            "challenge_token": second_login.json()["challenge_token"],
            "code": totp_code(secret),
        },
    )
    assert verify.status_code == 200
    assert verify.json()["status"] == "authenticated"
    final_payload = verify_access_token(verify.json()["access_token"])
    assert final_payload["mfa_verified"] is True


def test_recovery_code_is_single_use(isolated_api_factory):
    api = isolated_api_factory([auth_router])
    user = _create_user(
        api.db,
        email="recovery@example.com",
        role="admin",
    )

    initial = _login(api.client, user.email)
    token = initial.json()["access_token"]
    start = api.client.post(
        "/auth/mfa/enrollment/start",
        headers=_headers(token),
        json={},
    )
    secret = start.json()["secret"]
    confirm = api.client.post(
        "/auth/mfa/enrollment/confirm",
        headers=_headers(token),
        json={
            "enrollment_token": start.json()["enrollment_token"],
            "code": totp_code(secret),
        },
    )
    recovery_code = confirm.json()["recovery_codes"][0]

    first_login = _login(api.client, user.email)
    first_verify = api.client.post(
        "/auth/mfa/challenge/verify",
        json={
            "challenge_token": first_login.json()["challenge_token"],
            "code": recovery_code,
        },
    )
    assert first_verify.status_code == 200

    api.db.refresh(user)
    assert len(user.mfa_recovery_code_hashes) == 7

    second_login = _login(api.client, user.email)
    reused = api.client.post(
        "/auth/mfa/challenge/verify",
        json={
            "challenge_token": second_login.json()["challenge_token"],
            "code": recovery_code,
        },
    )
    assert reused.status_code == 401


def test_required_policy_guides_unenrolled_internal_user_before_access(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router, users_router])
    admin = _create_user(
        api.db,
        email="required-admin@example.com",
        role="admin",
    )
    api.db.add(SiteSetting(id=1, require_internal_mfa=True))
    api.db.commit()

    login = _login(api.client, admin.email)
    assert login.status_code == 200
    assert login.json()["status"] == "mfa_enrollment_required"
    assert login.json()["access_token"] is None

    challenge = login.json()["challenge_token"]
    start = api.client.post(
        "/auth/mfa/challenge/enrollment-start",
        json={"challenge_token": challenge},
    )
    assert start.status_code == 200

    # The signed enrollment token contains setup state but is never an access token.
    protected = api.client.get(
        "/users/",
        headers=_headers(start.json()["enrollment_token"]),
    )
    assert protected.status_code == 401

    confirm = api.client.post(
        "/auth/mfa/challenge/enrollment-confirm",
        json={
            "challenge_token": challenge,
            "enrollment_token": start.json()["enrollment_token"],
            "code": totp_code(start.json()["secret"]),
        },
    )
    assert confirm.status_code == 200
    assert len(confirm.json()["recovery_codes"]) == 8
    access_token = confirm.json()["access_token"]
    assert verify_access_token(access_token)["mfa_verified"] is True

    protected = api.client.get(
        "/users/",
        headers=_headers(access_token),
    )
    assert protected.status_code == 200


def test_public_login_remains_password_only_when_internal_mfa_is_required(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router])
    public_user = _create_user(
        api.db,
        email="public-mfa@example.com",
        role="public_user",
    )
    api.db.add(SiteSetting(id=1, require_internal_mfa=True))
    api.db.commit()

    response = _login(api.client, public_user.email)

    assert response.status_code == 200
    assert response.json()["status"] == "authenticated"
    assert response.json()["access_token"]


def test_enabling_policy_blocks_older_internal_token_until_mfa(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router, users_router])
    admin = _create_user(
        api.db,
        email="policy-change@example.com",
        role="admin",
    )

    login = _login(api.client, admin.email)
    old_token = login.json()["access_token"]
    assert verify_access_token(old_token)["mfa_verified"] is False

    api.db.add(SiteSetting(id=1, require_internal_mfa=True))
    api.db.commit()

    response = api.client.get(
        "/users/",
        headers=_headers(old_token),
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "MFA verification required"


def test_admin_reset_requires_password_and_clears_internal_mfa(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router])
    admin = _create_user(
        api.db,
        email="reset-admin@example.com",
        role="admin",
    )
    target = _create_user(
        api.db,
        email="reset-staff@example.com",
        role="staff",
    )
    recovery_codes = enroll_user(target, "JBSWY3DPEHPK3PXP")
    api.db.commit()
    assert recovery_codes

    login = _login(api.client, admin.email)
    token = login.json()["access_token"]

    wrong = api.client.post(
        f"/auth/mfa/admin-reset/{target.id}",
        headers=_headers(token),
        json={"current_password": "wrong-password"},
    )
    assert wrong.status_code == 400

    reset = api.client.post(
        f"/auth/mfa/admin-reset/{target.id}",
        headers=_headers(token),
        json={"current_password": PASSWORD},
    )
    assert reset.status_code == 200

    api.db.refresh(target)
    assert target.mfa_enabled is False
    assert target.mfa_secret_encrypted is None
    assert target.mfa_recovery_code_hashes == []

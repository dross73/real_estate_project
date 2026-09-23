"""Integration tests for internal TOTP MFA and recovery boundaries."""

from datetime import datetime, timezone

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.core.security import get_password_hash, verify_access_token
from app.db.models import AuditLog, SiteSetting, User
from app.services.mfa import enroll_user, totp_code


PASSWORD = "Password123!"


def _user(db, *, email: str, role: str) -> User:
    user = User(
        email=email,
        full_name="Internal User",
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


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _enroll_directly(db, user: User) -> tuple[str, list[str]]:
    # Test helper uses the same production enrollment routine so secrets remain
    # encrypted and recovery codes remain hashed in the database.
    secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"
    recovery_codes = enroll_user(user, secret)
    db.commit()
    db.refresh(user)
    return secret, recovery_codes


def test_public_and_unenrolled_internal_login_remain_direct_when_policy_is_off(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router])
    _user(api.db, email="staff@example.com", role="staff")
    _user(api.db, email="public@example.com", role="public_user")

    staff = _login(api.client, "staff@example.com")
    public = _login(api.client, "public@example.com")

    assert staff.status_code == 200
    assert staff.json()["status"] == "authenticated"
    assert public.status_code == 200
    assert public.json()["status"] == "authenticated"

    assert verify_access_token(staff.json()["access_token"])["purpose"] == "access"
    assert verify_access_token(public.json()["access_token"])["purpose"] == "access"


def test_authenticated_enrollment_requires_verified_totp_before_activation(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router, users_router])
    user = _user(api.db, email="admin@example.com", role="admin")

    login = _login(api.client, user.email)
    access_token = login.json()["access_token"]

    start = api.client.post(
        "/auth/mfa/enrollment/start",
        headers=_bearer(access_token),
    )

    assert start.status_code == 200
    setup = start.json()
    assert setup["secret"] in setup["provisioning_uri"]
    assert setup["provisioning_uri"].startswith("otpauth://totp/")
    assert user.mfa_enabled is False

    # A signed enrollment token carries setup data but is not authorization.
    protected = api.client.get(
        "/users/",
        headers=_bearer(setup["enrollment_token"]),
    )
    assert protected.status_code == 401
    assert protected.json()["detail"] == "Access token required"

    wrong = api.client.post(
        "/auth/mfa/enrollment/confirm",
        headers=_bearer(access_token),
        json={
            "enrollment_token": setup["enrollment_token"],
            "code": "000000",
        },
    )
    assert wrong.status_code == 400
    assert user.mfa_enabled is False

    confirm = api.client.post(
        "/auth/mfa/enrollment/confirm",
        headers=_bearer(access_token),
        json={
            "enrollment_token": setup["enrollment_token"],
            "code": totp_code(setup["secret"]),
        },
    )

    assert confirm.status_code == 200
    assert len(confirm.json()["recovery_codes"]) == 8

    api.db.refresh(user)
    assert user.mfa_enabled is True
    assert user.mfa_secret_encrypted
    assert setup["secret"] not in user.mfa_secret_encrypted
    assert len(user.mfa_recovery_code_hashes) == 8
    assert all(
        code not in user.mfa_recovery_code_hashes
        for code in confirm.json()["recovery_codes"]
    )


def test_enrolled_internal_login_requires_second_factor_before_access(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router, users_router])
    user = _user(api.db, email="admin@example.com", role="admin")
    secret, _ = _enroll_directly(api.db, user)

    login = _login(api.client, user.email)

    assert login.status_code == 200
    assert login.json()["status"] == "mfa_required"
    assert login.json()["access_token"] is None
    challenge_token = login.json()["challenge_token"]

    # The opaque password-only challenge cannot be used as a bearer token.
    protected_before_mfa = api.client.get(
        "/users/",
        headers=_bearer(challenge_token),
    )
    assert protected_before_mfa.status_code == 401

    verified = api.client.post(
        "/auth/mfa/challenge/verify",
        json={
            "challenge_token": challenge_token,
            "code": totp_code(secret),
        },
    )

    assert verified.status_code == 200
    assert verified.json()["status"] == "authenticated"
    token = verified.json()["access_token"]
    assert verify_access_token(token)["purpose"] == "access"

    protected_after_mfa = api.client.get(
        "/users/",
        headers=_bearer(token),
    )
    assert protected_after_mfa.status_code == 200

    reused = api.client.post(
        "/auth/mfa/challenge/verify",
        json={
            "challenge_token": challenge_token,
            "code": totp_code(secret),
        },
    )
    assert reused.status_code == 401


def test_recovery_code_is_one_time_and_is_removed_after_login(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router])
    user = _user(api.db, email="staff@example.com", role="staff")
    _, recovery_codes = _enroll_directly(api.db, user)
    recovery_code = recovery_codes[0]

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


def test_mfa_challenge_stops_accepting_attempts_after_retry_limit(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router])
    user = _user(api.db, email="staff@example.com", role="staff")
    _enroll_directly(api.db, user)
    login = _login(api.client, user.email)
    challenge_token = login.json()["challenge_token"]

    for _ in range(5):
        response = api.client.post(
            "/auth/mfa/challenge/verify",
            json={
                "challenge_token": challenge_token,
                "code": "000000",
            },
        )
        assert response.status_code == 401

    locked = api.client.post(
        "/auth/mfa/challenge/verify",
        json={
            "challenge_token": challenge_token,
            "code": "000000",
        },
    )

    assert locked.status_code == 401
    assert "no longer available" in locked.json()["detail"]


def test_policy_required_internal_user_can_bootstrap_enrollment_before_access(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router])
    staff = _user(api.db, email="staff@example.com", role="staff")
    _user(api.db, email="public@example.com", role="public_user")
    api.db.add(SiteSetting(id=1, require_internal_mfa=True))
    api.db.commit()

    staff_login = _login(api.client, staff.email)
    public_login = _login(api.client, "public@example.com")

    assert staff_login.json()["status"] == "mfa_enrollment_required"
    assert staff_login.json()["access_token"] is None
    assert public_login.json()["status"] == "authenticated"

    challenge_token = staff_login.json()["challenge_token"]
    start = api.client.post(
        "/auth/mfa/challenge/enrollment-start",
        json={"challenge_token": challenge_token},
    )
    assert start.status_code == 200

    setup = start.json()
    confirm = api.client.post(
        "/auth/mfa/challenge/enrollment-confirm",
        json={
            "challenge_token": challenge_token,
            "enrollment_token": setup["enrollment_token"],
            "code": totp_code(setup["secret"]),
        },
    )

    assert confirm.status_code == 200
    assert len(confirm.json()["recovery_codes"]) == 8
    access_token = confirm.json()["access_token"]
    assert verify_access_token(access_token)["purpose"] == "access"

    api.db.refresh(staff)
    assert staff.mfa_enabled is True

    next_login = _login(api.client, staff.email)
    assert next_login.json()["status"] == "mfa_required"


def test_voluntary_mfa_disable_requires_password_and_second_factor(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router])
    user = _user(api.db, email="staff@example.com", role="staff")
    secret, _ = _enroll_directly(api.db, user)

    login = _login(api.client, user.email)
    verified = api.client.post(
        "/auth/mfa/challenge/verify",
        json={
            "challenge_token": login.json()["challenge_token"],
            "code": totp_code(secret),
        },
    )
    access_token = verified.json()["access_token"]

    wrong_password = api.client.post(
        "/auth/mfa/disable",
        headers=_bearer(access_token),
        json={
            "current_password": "WrongPassword!",
            "code": totp_code(secret),
        },
    )
    assert wrong_password.status_code == 400

    disabled = api.client.post(
        "/auth/mfa/disable",
        headers=_bearer(access_token),
        json={
            "current_password": PASSWORD,
            "code": totp_code(secret),
        },
    )
    assert disabled.status_code == 200

    api.db.refresh(user)
    assert user.mfa_enabled is False
    assert user.mfa_secret_encrypted is None
    assert user.mfa_recovery_code_hashes == []


def test_required_mfa_cannot_be_disabled_by_the_user(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router])
    user = _user(api.db, email="admin@example.com", role="admin")
    secret, _ = _enroll_directly(api.db, user)

    login = _login(api.client, user.email)
    verified = api.client.post(
        "/auth/mfa/challenge/verify",
        json={
            "challenge_token": login.json()["challenge_token"],
            "code": totp_code(secret),
        },
    )
    access_token = verified.json()["access_token"]

    api.db.add(SiteSetting(id=1, require_internal_mfa=True))
    api.db.commit()

    response = api.client.post(
        "/auth/mfa/disable",
        headers=_bearer(access_token),
        json={
            "current_password": PASSWORD,
            "code": totp_code(secret),
        },
    )

    assert response.status_code == 409
    assert "required" in response.json()["detail"].lower()


def test_admin_can_reset_internal_mfa_after_password_reauthentication(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router])
    admin = _user(api.db, email="admin@example.com", role="admin")
    staff = _user(api.db, email="staff@example.com", role="staff")
    _enroll_directly(api.db, staff)

    admin_login = _login(api.client, admin.email)
    admin_token = admin_login.json()["access_token"]

    wrong_password = api.client.post(
        f"/auth/mfa/admin-reset/{staff.id}",
        headers=_bearer(admin_token),
        json={"current_password": "WrongPassword!"},
    )
    assert wrong_password.status_code == 400

    reset = api.client.post(
        f"/auth/mfa/admin-reset/{staff.id}",
        headers=_bearer(admin_token),
        json={"current_password": PASSWORD},
    )

    assert reset.status_code == 200
    api.db.refresh(staff)
    assert staff.mfa_enabled is False

    audit = (
        api.db.query(AuditLog)
        .filter(AuditLog.action == "mfa.admin_reset")
        .one()
    )
    assert audit.actor_email == admin.email
    assert audit.target_id == str(staff.id)


def test_admin_reset_under_required_policy_forces_reenrollment_next_login(
    isolated_api_factory,
):
    api = isolated_api_factory([auth_router])
    admin = _user(api.db, email="admin@example.com", role="admin")
    staff = _user(api.db, email="staff@example.com", role="staff")
    _enroll_directly(api.db, staff)

    admin_token = _login(api.client, admin.email).json()["access_token"]
    api.db.add(SiteSetting(id=1, require_internal_mfa=True))
    api.db.commit()

    reset = api.client.post(
        f"/auth/mfa/admin-reset/{staff.id}",
        headers=_bearer(admin_token),
        json={"current_password": PASSWORD},
    )
    assert reset.status_code == 200

    login = _login(api.client, staff.email)
    assert login.json()["status"] == "mfa_enrollment_required"

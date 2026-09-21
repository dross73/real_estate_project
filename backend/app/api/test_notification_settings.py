"""Integration tests for administrator notification settings."""

from app.api.notification_settings import router as notification_settings_router
from app.core.security import create_access_token
from app.db.models import AuditLog, NotificationSetting


def _headers(role: str) -> dict[str, str]:
    token = create_access_token(
        subject=f"{role}@example.com",
        role=role,
    )
    return {"Authorization": f"Bearer {token}"}


def test_admin_can_read_effective_notification_defaults(isolated_api_factory):
    """Known defaults are available before any administrator override exists."""
    api = isolated_api_factory([notification_settings_router])

    response = api.client.get(
        "/notification-settings",
        headers=_headers("admin"),
    )

    assert response.status_code == 200
    settings = {item["key"]: item for item in response.json()}

    assert settings["lead_assignment"]["enabled"] is True
    assert settings["showing_request_assignment"]["enabled"] is True
    assert settings["testimonial_submission"]["enabled"] is False
    assert settings["lead_assignment"]["default_enabled"] is True


def test_admin_can_update_notification_setting(isolated_api_factory):
    """An administrator override persists and is reflected on later reads."""
    api = isolated_api_factory([notification_settings_router])

    update_response = api.client.put(
        "/notification-settings/lead_assignment",
        headers=_headers("admin"),
        json={"enabled": False},
    )

    assert update_response.status_code == 200
    assert update_response.json()["enabled"] is False

    stored = (
        api.db.query(NotificationSetting)
        .filter(NotificationSetting.key == "lead_assignment")
        .one()
    )
    assert stored.enabled is False

    read_response = api.client.get(
        "/notification-settings",
        headers=_headers("admin"),
    )
    lead = next(
        item for item in read_response.json()
        if item["key"] == "lead_assignment"
    )
    assert lead["enabled"] is False
    assert lead["default_enabled"] is True


def test_unknown_notification_key_returns_404(isolated_api_factory):
    """The API cannot be used to create arbitrary unsupported settings."""
    api = isolated_api_factory([notification_settings_router])

    response = api.client.put(
        "/notification-settings/not-real",
        headers=_headers("admin"),
        json={"enabled": True},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Notification setting not found"
    assert api.db.query(NotificationSetting).count() == 0


def test_staff_cannot_read_or_update_notification_settings(
    isolated_api_factory,
):
    """Notification configuration remains an administrator-only operation."""
    api = isolated_api_factory([notification_settings_router])
    headers = _headers("staff")

    read_response = api.client.get(
        "/notification-settings",
        headers=headers,
    )
    update_response = api.client.put(
        "/notification-settings/lead_assignment",
        headers=headers,
        json={"enabled": False},
    )

    assert read_response.status_code == 403
    assert update_response.status_code == 403


def test_notification_setting_update_is_audited(isolated_api_factory):
    """Site notification changes should record actor and before/after state."""
    api = isolated_api_factory([notification_settings_router])
    token = create_access_token(
        subject="Owner@Example.COM",
        role="admin",
    )
    headers = {"Authorization": f"Bearer {token}"}

    response = api.client.put(
        "/notification-settings/lead_assignment",
        headers=headers,
        json={"enabled": False},
    )

    assert response.status_code == 200

    entry = (
        api.db.query(AuditLog)
        .filter(AuditLog.action == "settings.notification_updated")
        .one()
    )
    assert entry.actor_email == "owner@example.com"
    assert entry.target_type == "notification_setting"
    assert entry.target_id == "lead_assignment"
    assert entry.details == {
        "previous_enabled": True,
        "enabled": False,
    }


def test_unknown_notification_setting_does_not_create_audit_entry(
    isolated_api_factory,
):
    """Rejected settings changes should leave no audit history behind."""
    api = isolated_api_factory([notification_settings_router])

    response = api.client.put(
        "/notification-settings/not-real",
        headers=_headers("admin"),
        json={"enabled": True},
    )

    assert response.status_code == 404
    assert api.db.query(AuditLog).count() == 0

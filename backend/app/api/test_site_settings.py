"""Integration tests for admin-managed public site settings."""

from app.api.site_settings import admin_router, public_router
from app.core.security import create_access_token
from app.db.models import AuditLog, SiteSetting


def _headers(role: str = "admin") -> dict[str, str]:
    token = create_access_token(
        subject=f"{role}@example.com",
        role=role,
    )
    return {"Authorization": f"Bearer {token}"}


def _payload(**overrides):
    values = {
        "site_name": "Juniper & Lane",
        "site_descriptor": "Realty",
        "tagline": "A brighter tomorrow belongs here.",
        "logo_url": "https://cdn.example.com/logo.svg",
        "phone": "515-555-0100",
        "email": "hello@example.com",
        "address_line1": "100 Main Street",
        "city": "Ames",
        "state": "Iowa",
        "postal_code": "50010",
        "homepage_eyebrow": "Local expertise",
        "homepage_title": "Find Your Place.",
        "homepage_intro": "Thoughtful real estate guidance close to home.",
        "homepage_story_title": "Rooted in community.",
        "homepage_story_copy": "We put local relationships first.",
        "primary_color": "#123456",
        "secondary_color": "#789abc",
        "show_about": True,
        "show_contact": False,
        "show_testimonials": False,
        "listing_photo_max_count": 24,
    }
    values.update(overrides)
    return values


def test_public_settings_return_safe_defaults_without_auth(isolated_api_factory):
    api = isolated_api_factory([public_router])

    response = api.client.get("/public/site-settings")

    assert response.status_code == 200
    payload = response.json()
    assert payload["site_name"] == "Juniper & Lane"
    assert payload["primary_color"] == "#13382b"
    assert payload["show_about"] is True
    assert payload["listing_photo_max_count"] <= payload[
        "hard_listing_photo_max_count"
    ]


def test_admin_can_persist_settings_visible_to_public(isolated_api_factory):
    api = isolated_api_factory([admin_router, public_router])

    response = api.client.put(
        "/site-settings",
        headers=_headers(),
        json=_payload(),
    )

    assert response.status_code == 200
    assert response.json()["site_name"] == "Juniper & Lane"
    assert response.json()["homepage_title"] == "Find Your Place."
    assert response.json()["show_contact"] is False
    assert response.json()["listing_photo_max_count"] == 24

    stored = api.db.query(SiteSetting).one()
    assert stored.homepage_title == "Find Your Place."
    assert stored.listing_photo_max_count == 24

    public_response = api.client.get("/public/site-settings")
    assert public_response.status_code == 200
    assert public_response.json()["homepage_title"] == "Find Your Place."
    assert public_response.json()["show_contact"] is False


def test_staff_cannot_manage_site_settings(isolated_api_factory):
    api = isolated_api_factory([admin_router])

    read_response = api.client.get(
        "/site-settings",
        headers=_headers("staff"),
    )
    update_response = api.client.put(
        "/site-settings",
        headers=_headers("staff"),
        json=_payload(),
    )

    assert read_response.status_code == 403
    assert update_response.status_code == 403
    assert api.db.query(SiteSetting).count() == 0


def test_site_settings_validate_brand_colors_and_photo_limit(isolated_api_factory):
    api = isolated_api_factory([admin_router])

    bad_color = api.client.put(
        "/site-settings",
        headers=_headers(),
        json=_payload(primary_color="forest"),
    )
    too_many_photos = api.client.put(
        "/site-settings",
        headers=_headers(),
        json=_payload(listing_photo_max_count=51),
    )

    assert bad_color.status_code == 422
    assert too_many_photos.status_code == 422
    assert api.db.query(SiteSetting).count() == 0


def test_site_settings_update_is_audited(isolated_api_factory):
    api = isolated_api_factory([admin_router])

    response = api.client.put(
        "/site-settings",
        headers=_headers(),
        json=_payload(
            show_contact=False,
            listing_photo_max_count=18,
        ),
    )

    assert response.status_code == 200

    entry = (
        api.db.query(AuditLog)
        .filter(AuditLog.action == "settings.site_updated")
        .one()
    )
    assert entry.actor_email == "admin@example.com"
    assert entry.target_type == "site_settings"
    assert entry.target_id == "1"
    assert entry.details["show_contact"] is False
    assert entry.details["listing_photo_max_count"] == 18

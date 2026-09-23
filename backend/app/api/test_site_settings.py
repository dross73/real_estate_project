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
        "about_title": "Local roots. Thoughtful guidance.",
        "about_intro": "A local brokerage built around clear guidance.",
        "about_mission_title": "Our mission",
        "about_mission_copy": "Help people make confident real estate decisions.",
        "about_history_title": "Our history",
        "about_history_copy": "Built around long-term local relationships.",
        "about_image_url": "https://cdn.example.com/about.jpg",
        "about_team_title": "Our team",
        "about_team_copy": "Local people with practical market knowledge.",
        "contact_hours": "Monday-Friday, 9:00 AM-5:00 PM",
        "show_privacy": False,
        "privacy_title": "Privacy Policy",
        "privacy_body": None,
        "show_terms": False,
        "terms_title": "Terms of Use",
        "terms_body": None,
        "privacy_consent_enabled": False,
        "privacy_analytics_category_enabled": False,
        "privacy_marketing_category_enabled": False,
        "primary_color": "#123456",
        "secondary_color": "#789abc",
        "show_about": True,
        "show_contact": False,
        "show_testimonials": False,
        "enable_testimonial_submissions": False,
        "enable_contact_requests": True,
        "enable_showing_requests": True,
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
    assert payload["privacy_consent_enabled"] is False
    assert payload["privacy_analytics_category_enabled"] is False
    assert payload["privacy_marketing_category_enabled"] is False
    assert payload["enable_testimonial_submissions"] is False
    assert payload["enable_contact_requests"] is True
    assert payload["enable_showing_requests"] is True
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
    assert response.json()["about_title"] == "Local roots. Thoughtful guidance."
    assert response.json()["contact_hours"] == "Monday-Friday, 9:00 AM-5:00 PM"
    assert response.json()["show_privacy"] is False
    assert response.json()["show_terms"] is False
    assert response.json()["show_contact"] is False
    assert response.json()["enable_testimonial_submissions"] is False
    assert response.json()["listing_photo_max_count"] == 24

    stored = api.db.query(SiteSetting).one()
    assert stored.homepage_title == "Find Your Place."
    assert stored.about_team_title == "Our team"
    assert stored.contact_hours == "Monday-Friday, 9:00 AM-5:00 PM"
    assert stored.listing_photo_max_count == 24

    public_response = api.client.get("/public/site-settings")
    assert public_response.status_code == 200
    assert public_response.json()["homepage_title"] == "Find Your Place."
    assert public_response.json()["show_contact"] is False
    assert public_response.json()["about_title"] == "Local roots. Thoughtful guidance."
    assert public_response.json()["privacy_title"] is None
    assert public_response.json()["privacy_body"] is None
    assert public_response.json()["terms_title"] is None
    assert public_response.json()["terms_body"] is None


def test_admin_can_configure_privacy_consent_categories(isolated_api_factory):
    api = isolated_api_factory([admin_router, public_router])

    response = api.client.put(
        "/site-settings",
        headers=_headers(),
        json=_payload(
            privacy_consent_enabled=True,
            privacy_analytics_category_enabled=True,
            privacy_marketing_category_enabled=True,
        ),
    )

    assert response.status_code == 200
    assert response.json()["privacy_consent_enabled"] is True
    assert response.json()["privacy_analytics_category_enabled"] is True
    assert response.json()["privacy_marketing_category_enabled"] is True

    public_response = api.client.get("/public/site-settings")
    assert public_response.status_code == 200
    assert public_response.json()["privacy_consent_enabled"] is True
    assert public_response.json()["privacy_analytics_category_enabled"] is True
    assert public_response.json()["privacy_marketing_category_enabled"] is True


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


def test_disabled_about_content_is_not_exposed_publicly(isolated_api_factory):
    api = isolated_api_factory([admin_router, public_router])

    saved = api.client.put(
        "/site-settings",
        headers=_headers(),
        json=_payload(
            show_about=False,
            about_title="Draft About Title",
            about_intro="Draft About Copy",
        ),
    )
    assert saved.status_code == 200
    assert saved.json()["about_title"] == "Draft About Title"

    public = api.client.get("/public/site-settings")
    assert public.status_code == 200
    assert public.json()["show_about"] is False
    assert public.json()["about_title"] is None
    assert public.json()["about_intro"] is None


def test_enabled_legal_pages_require_body_content(isolated_api_factory):
    api = isolated_api_factory([admin_router])

    missing_privacy = api.client.put(
        "/site-settings",
        headers=_headers(),
        json=_payload(show_privacy=True, privacy_body=None),
    )
    missing_terms = api.client.put(
        "/site-settings",
        headers=_headers(),
        json=_payload(show_terms=True, terms_body=""),
    )

    assert missing_privacy.status_code == 422
    assert missing_terms.status_code == 422
    assert api.db.query(SiteSetting).count() == 0

    published = api.client.put(
        "/site-settings",
        headers=_headers(),
        json=_payload(
            show_privacy=True,
            privacy_body="We collect only the information needed to provide site services.",
            show_terms=True,
            terms_body="Use this website lawfully and verify listing details independently.",
        ),
    )

    assert published.status_code == 200
    assert published.json()["show_privacy"] is True
    assert published.json()["show_terms"] is True


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
    assert entry.details["show_privacy"] is False
    assert entry.details["show_terms"] is False
    assert entry.details["privacy_consent_enabled"] is False
    assert entry.details["privacy_analytics_category_enabled"] is False
    assert entry.details["privacy_marketing_category_enabled"] is False
    assert entry.details["enable_contact_requests"] is True
    assert entry.details["enable_showing_requests"] is True
    assert entry.details["listing_photo_max_count"] == 18

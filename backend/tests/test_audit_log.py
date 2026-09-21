"""Integration tests for append-only audit history and current mutations."""

from app.api.audit_log import router as audit_router
from app.api.listings import router as listings_router
from app.api.users import router as users_router
from app.core.security import create_access_token
from app.db.models import AuditLog
from app.services.audit import record_audit_event


def _headers(role: str, email: str | None = None) -> dict[str, str]:
    """Create a test bearer token."""
    subject = email or f"{role}@example.com"
    token = create_access_token(subject=subject, role=role)
    return {"Authorization": f"Bearer {token}"}


def _listing_payload() -> dict:
    """Return a complete listing suitable for lifecycle audit tests."""
    return {
        "title": "Audit Trail Home",
        "status": "Active",
        "is_public": True,
        "is_featured": False,
        "hide_exact_address": False,
        "price": 425000,
        "property_type": "Single Family",
        "address": "123 Audit Lane",
        "city": "Ames",
        "state": "IA",
        "description": "Audit test listing",
        "sqft": 2100,
        "acreage": 0.3,
        "year_built": 2015,
        "bedrooms": 4,
        "bathrooms": 2.5,
        "annual_property_taxes": 6200,
        "hoa_fee": None,
        "hoa_fee_frequency": None,
        "school_district": "Ames Community School District",
        "amenities": ["Garage"],
        "mls_number": "AUDIT-1",
        "source_attribution": "Test Brokerage",
        "cover_image": None,
    }


def test_listing_lifecycle_actions_are_audited(isolated_api_factory):
    """Create, publish, hide, archive, edit, and delete actions are preserved."""
    api = isolated_api_factory([listings_router, audit_router])
    staff_headers = _headers("staff", "Agent@Example.COM")

    create_response = api.client.post(
        "/listings",
        headers=staff_headers,
        json=_listing_payload(),
    )
    assert create_response.status_code == 201
    listing_id = create_response.json()["id"]

    create_actions = [
        row.action
        for row in api.db.query(AuditLog)
        .filter(AuditLog.target_id == str(listing_id))
        .order_by(AuditLog.id)
        .all()
    ]
    assert create_actions == [
        "listing.created",
        "listing.published",
        "listing.shown_publicly",
    ]

    update_response = api.client.put(
        f"/listings/{listing_id}",
        headers=staff_headers,
        json={
            "status": "Archived",
            "is_public": False,
            "price": 430000,
        },
    )
    assert update_response.status_code == 200

    delete_response = api.client.delete(
        f"/listings/{listing_id}",
        headers=staff_headers,
    )
    assert delete_response.status_code == 204

    entries = (
        api.db.query(AuditLog)
        .filter(AuditLog.target_id == str(listing_id))
        .order_by(AuditLog.id)
        .all()
    )
    actions = [entry.action for entry in entries]

    assert actions == [
        "listing.created",
        "listing.published",
        "listing.shown_publicly",
        "listing.updated",
        "listing.archived",
        "listing.hidden",
        "listing.deleted",
    ]
    assert all(entry.actor_email == "agent@example.com" for entry in entries)
    assert entries[3].details["changed_fields"] == [
        "is_public",
        "price",
        "status",
    ]


def test_user_management_actions_are_audited_without_passwords(
    isolated_api_factory,
):
    """Admin user CRUD records safe metadata but never password material."""
    api = isolated_api_factory([users_router, audit_router])
    admin_headers = _headers("admin", "Owner@Example.COM")

    create_response = api.client.post(
        "/users/",
        headers=admin_headers,
        json={
            "email": "staff@example.com",
            "password": "Password123!",
            "full_name": "Staff Member",
            "is_active": True,
            "role": "staff",
        },
    )
    assert create_response.status_code == 201
    user_id = create_response.json()["id"]

    update_response = api.client.put(
        f"/users/{user_id}",
        headers=admin_headers,
        json={
            "full_name": "Updated Staff",
            "is_active": False,
        },
    )
    assert update_response.status_code == 200

    delete_response = api.client.delete(
        f"/users/{user_id}",
        headers=admin_headers,
    )
    assert delete_response.status_code == 204

    entries = (
        api.db.query(AuditLog)
        .filter(AuditLog.target_type == "user")
        .order_by(AuditLog.id)
        .all()
    )

    assert [entry.action for entry in entries] == [
        "user.created",
        "user.updated",
        "user.deleted",
    ]
    assert all(entry.actor_email == "owner@example.com" for entry in entries)

    serialized_details = str([entry.details for entry in entries]).lower()
    assert "password123" not in serialized_details
    assert "hashed_password" not in serialized_details


def test_audit_service_redacts_secret_bearing_keys(isolated_api_factory):
    """The shared audit service protects future lead/settings integrations too."""
    api = isolated_api_factory([audit_router])

    entry = record_audit_event(
        api.db,
        actor_email="ADMIN@EXAMPLE.COM",
        action="settings.updated",
        target_type="site_settings",
        target_id="global",
        details={
            "safe": "visible",
            "password": "never-store-this",
            "nested": {
                "access_token": "never-store-this-either",
                "smtp_password": "also-secret",
                "enabled": True,
            },
        },
    )
    api.db.commit()
    api.db.refresh(entry)

    assert entry.actor_email == "admin@example.com"
    assert entry.details == {
        "safe": "visible",
        "password": "[REDACTED]",
        "nested": {
            "access_token": "[REDACTED]",
            "smtp_password": "[REDACTED]",
            "enabled": True,
        },
    }


def test_only_admin_can_review_audit_history(isolated_api_factory):
    """Audit history is read-only and unavailable to staff/public users."""
    api = isolated_api_factory([audit_router])

    record_audit_event(
        api.db,
        actor_email="admin@example.com",
        action="listing.updated",
        target_type="listing",
        target_id=12,
        details={"changed_fields": ["price"]},
    )
    api.db.commit()

    staff_response = api.client.get(
        "/audit-log",
        headers=_headers("staff"),
    )
    public_response = api.client.get(
        "/audit-log",
        headers=_headers("public_user"),
    )
    admin_response = api.client.get(
        "/audit-log",
        headers=_headers("admin"),
    )
    mutation_response = api.client.delete(
        "/audit-log/1",
        headers=_headers("admin"),
    )

    assert staff_response.status_code == 403
    assert public_response.status_code == 403
    assert admin_response.status_code == 200
    assert admin_response.json()["total"] == 1
    assert admin_response.json()["items"][0]["action"] == "listing.updated"
    assert mutation_response.status_code == 405


def test_audit_history_filters_and_paginates(isolated_api_factory):
    """Admins can narrow audit history without exposing mutation operations."""
    api = isolated_api_factory([audit_router])

    for index, action in enumerate(
        ["listing.updated", "user.updated", "listing.updated"],
        start=1,
    ):
        record_audit_event(
            api.db,
            actor_email="admin@example.com",
            action=action,
            target_type=action.split(".")[0],
            target_id=index,
            details={},
        )
    api.db.commit()

    response = api.client.get(
        "/audit-log",
        headers=_headers("admin"),
        params={
            "action": "listing.updated",
            "page": 1,
            "per_page": 1,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 2
    assert payload["page"] == 1
    assert payload["per_page"] == 1
    assert len(payload["items"]) == 1

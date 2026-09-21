"""Integration tests for the launch-ready internal listing CRUD API."""

from collections.abc import Generator
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.listings import router as listings_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db


@pytest.fixture()
def listing_test_app() -> Generator[tuple[TestClient, Session], None, None]:
    """Provide an isolated listing API with a clean SQLite database."""
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
    app.include_router(listings_router)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    try:
        yield TestClient(app), db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _staff_headers() -> dict[str, str]:
    """Return a valid staff bearer token for internal listing operations."""
    token = create_access_token(
        subject="staff@example.com",
        role="staff",
    )
    return {"Authorization": f"Bearer {token}"}


def _valid_listing_payload() -> dict:
    """Return a representative launch-ready listing payload."""
    return {
        "title": "Prairie View Home",
        "status": "Active",
        "is_public": True,
        "is_featured": True,
        "hide_exact_address": False,
        "price": 3_000_000_000,
        "property_type": "Single Family",
        "address": "123 Prairie View Drive",
        "city": "Ames",
        "state": "ia",
        "description": "A complete listing used for API validation.",
        "sqft": 3200,
        "acreage": 1.75,
        "year_built": 2020,
        "bedrooms": 4,
        "bathrooms": 3.5,
        "annual_property_taxes": 8200,
        "hoa_fee": 125,
        "hoa_fee_frequency": "Monthly",
        "school_district": "Ames Community School District",
        "amenities": ["Garage", " Fireplace ", "garage"],
        "mls_number": "MLS-12345",
        "source_attribution": "Example Brokerage",
        "cover_image": "https://example.com/listing.jpg",
    }


def test_internal_listing_reads_require_staff_or_admin(listing_test_app):
    """The MVP listing CRUD API should no longer expose internal rows anonymously."""
    client, _ = listing_test_app

    response = client.get("/listings")

    assert response.status_code in (401, 403)


def test_create_and_read_launch_ready_listing(listing_test_app):
    """Staff can create and read the expanded listing payload."""
    client, _ = listing_test_app
    headers = _staff_headers()

    create_response = client.post(
        "/listings",
        headers=headers,
        json=_valid_listing_payload(),
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["price"] == 3_000_000_000
    assert created["state"] == "IA"
    assert created["status"] == "Active"
    assert created["is_public"] is True
    assert created["is_featured"] is True
    assert created["property_type"] == "Single Family"
    assert created["acreage"] == 1.75
    assert created["amenities"] == ["Garage", "Fireplace"]

    read_response = client.get(
        f"/listings/{created['id']}",
        headers=headers,
    )

    assert read_response.status_code == 200
    assert read_response.json()["mls_number"] == "MLS-12345"


def test_listing_update_supports_lifecycle_and_visibility(listing_test_app):
    """Status and public visibility remain independent editable fields."""
    client, _ = listing_test_app
    headers = _staff_headers()

    created = client.post(
        "/listings",
        headers=headers,
        json=_valid_listing_payload(),
    ).json()

    update_response = client.put(
        f"/listings/{created['id']}",
        headers=headers,
        json={
            "status": "Sold",
            "is_public": True,
            "is_featured": False,
        },
    )

    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["status"] == "Sold"
    assert updated["is_public"] is True
    assert updated["is_featured"] is False


@pytest.mark.parametrize(
    ("field_name", "field_value"),
    [
        ("status", "Coming Soon"),
        ("price", 10_000_000_001),
        ("bedrooms", 101),
        ("bathrooms", 2.25),
        ("acreage", -1),
    ],
)
def test_listing_numeric_and_enum_validation(
    listing_test_app,
    field_name,
    field_value,
):
    """Invalid lifecycle or numeric values should fail before reaching the DB."""
    client, _ = listing_test_app
    payload = _valid_listing_payload()
    payload[field_name] = field_value

    response = client.post(
        "/listings",
        headers=_staff_headers(),
        json=payload,
    )

    assert response.status_code == 422


def test_year_built_cannot_be_far_in_the_future(listing_test_app):
    """Construction year validation should follow the current calendar year."""
    client, _ = listing_test_app
    payload = _valid_listing_payload()
    payload["year_built"] = datetime.now(timezone.utc).year + 2

    response = client.post(
        "/listings",
        headers=_staff_headers(),
        json=payload,
    )

    assert response.status_code == 422


def _public_headers() -> dict[str, str]:
    """Return a valid public-user token that must not enter internal listing CRUD."""
    token = create_access_token(
        subject="public@example.com",
        role="public_user",
    )
    return {"Authorization": f"Bearer {token}"}


def test_public_user_cannot_access_internal_listing_crud(listing_test_app):
    """Public accounts cannot read or mutate the internal listing endpoints."""
    client, _ = listing_test_app
    payload = _valid_listing_payload()
    headers = _public_headers()

    list_response = client.get("/listings", headers=headers)
    create_response = client.post(
        "/listings",
        headers=headers,
        json=payload,
    )
    get_response = client.get("/listings/1", headers=headers)
    update_response = client.put(
        "/listings/1",
        headers=headers,
        json={"status": "Sold"},
    )
    delete_response = client.delete("/listings/1", headers=headers)

    assert list_response.status_code == 403
    assert create_response.status_code == 403
    assert get_response.status_code == 403
    assert update_response.status_code == 403
    assert delete_response.status_code == 403


def test_listing_not_found_paths_are_consistent(listing_test_app):
    """Read/update/delete operations return 404 for an unknown listing."""
    client, _ = listing_test_app
    headers = _staff_headers()

    read_response = client.get("/listings/9999", headers=headers)
    update_response = client.put(
        "/listings/9999",
        headers=headers,
        json={"status": "Sold"},
    )
    delete_response = client.delete("/listings/9999", headers=headers)

    assert read_response.status_code == 404
    assert update_response.status_code == 404
    assert delete_response.status_code == 404


def test_staff_can_delete_listing(listing_test_app):
    """Delete removes the listing and subsequent reads return not found."""
    client, _ = listing_test_app
    headers = _staff_headers()

    created = client.post(
        "/listings",
        headers=headers,
        json=_valid_listing_payload(),
    ).json()

    delete_response = client.delete(
        f"/listings/{created['id']}",
        headers=headers,
    )
    read_response = client.get(
        f"/listings/{created['id']}",
        headers=headers,
    )

    assert delete_response.status_code == 204
    assert read_response.status_code == 404


@pytest.mark.parametrize(
    "query",
    [
        "?page=0",
        "?per_page=0",
        "?per_page=101",
    ],
)
def test_internal_listing_pagination_validation(listing_test_app, query):
    """Unsafe pagination values should fail before querying the database."""
    client, _ = listing_test_app

    response = client.get(
        f"/listings{query}",
        headers=_staff_headers(),
    )

    assert response.status_code == 422



def test_staff_can_preview_hidden_draft_listing(listing_test_app):
    """Staff preview uses the public-safe presentation without requiring publication."""
    client, _ = listing_test_app
    payload = _valid_listing_payload()
    payload["status"] = "Draft"
    payload["is_public"] = True

    created = client.post(
        "/listings",
        headers=_staff_headers(),
        json=payload,
    ).json()

    # Draft is normalized to internal-only even if a client asks for public visibility.
    assert created["is_public"] is False

    preview = client.get(
        f"/listings/{created['id']}/preview",
        headers=_staff_headers(),
    )

    assert preview.status_code == 200
    body = preview.json()
    assert body["id"] == created["id"]
    assert body["status"] == "Draft"
    assert body["title"] == created["title"]
    assert "is_public" not in body


def test_listing_preview_enforces_address_privacy(listing_test_app):
    """Preview mirrors the same exact-address privacy rule as public responses."""
    client, _ = listing_test_app
    payload = _valid_listing_payload()
    payload["status"] = "Draft"
    payload["is_public"] = False
    payload["hide_exact_address"] = True

    created = client.post(
        "/listings",
        headers=_staff_headers(),
        json=payload,
    ).json()

    preview = client.get(
        f"/listings/{created['id']}/preview",
        headers=_staff_headers(),
    )

    assert preview.status_code == 200
    assert preview.json()["address"] is None
    assert preview.json()["city"] == "Ames"


def test_public_user_cannot_access_listing_preview(listing_test_app):
    """Public accounts must never gain the unpublished preview path."""
    client, _ = listing_test_app
    payload = _valid_listing_payload()
    payload["status"] = "Draft"
    payload["is_public"] = False

    created = client.post(
        "/listings",
        headers=_staff_headers(),
        json=payload,
    ).json()

    response = client.get(
        f"/listings/{created['id']}/preview",
        headers=_public_headers(),
    )

    assert response.status_code == 403


def test_preview_unknown_listing_returns_not_found(listing_test_app):
    """Preview should use the same clear missing-listing behavior as internal reads."""
    client, _ = listing_test_app

    response = client.get(
        "/listings/9999/preview",
        headers=_staff_headers(),
    )

    assert response.status_code == 404


def test_archived_listing_is_forced_internal_only(listing_test_app):
    """Moving a visible listing to Archived must also hide it from public visibility."""
    client, _ = listing_test_app
    headers = _staff_headers()

    created = client.post(
        "/listings",
        headers=headers,
        json=_valid_listing_payload(),
    ).json()
    assert created["is_public"] is True

    response = client.put(
        f"/listings/{created['id']}",
        headers=headers,
        json={
            "status": "Archived",
            "is_public": True,
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "Archived"
    assert response.json()["is_public"] is False

"""Tests for anonymous public-safe listing queries."""

from collections.abc import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.listings import router as internal_listings_router
from app.api.public_listings import router as public_listings_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models import Listing
from app.db.session import get_db


@pytest.fixture()
def public_listing_test_app() -> Generator[tuple[TestClient, Session], None, None]:
    """Provide isolated public and internal listing APIs."""
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
    app.include_router(internal_listings_router)
    app.include_router(public_listings_router)

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
    """Return an internal staff bearer token."""
    token = create_access_token(
        subject="staff@example.com",
        role="staff",
    )
    return {"Authorization": f"Bearer {token}"}


def _add_listing(
    db: Session,
    *,
    title: str,
    status: str,
    is_public: bool,
    is_featured: bool = False,
    hide_exact_address: bool = False,
) -> Listing:
    """Insert a listing with only the required data needed by these tests."""
    listing = Listing(
        title=title,
        status=status,
        is_public=is_public,
        is_featured=is_featured,
        hide_exact_address=hide_exact_address,
        price=350000,
        property_type="Single Family",
        address="123 Test Street",
        city="Ames",
        state="IA",
        description=None,
        sqft=1800,
        acreage=None,
        year_built=2005,
        bedrooms=3,
        bathrooms=2.0,
        annual_property_taxes=None,
        hoa_fee=None,
        hoa_fee_frequency=None,
        school_district=None,
        amenities=["Garage"],
        mls_number=None,
        source_attribution=None,
        cover_image=None,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


@pytest.mark.parametrize("listing_status", ["Active", "Pending", "Sold"])
def test_public_list_returns_each_eligible_status(
    public_listing_test_app,
    listing_status,
):
    """Active, Pending, and Sold rows can be public when visibility is enabled."""
    client, db = public_listing_test_app
    listing = _add_listing(
        db,
        title=f"{listing_status} Home",
        status=listing_status,
        is_public=True,
    )

    response = client.get("/public/listings")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == listing.id
    assert payload["items"][0]["status"] == listing_status


@pytest.mark.parametrize("listing_status", ["Draft", "Archived"])
def test_public_list_never_returns_internal_only_statuses(
    public_listing_test_app,
    listing_status,
):
    """Draft and Archived listings stay internal even when is_public is true."""
    client, db = public_listing_test_app
    _add_listing(
        db,
        title=f"{listing_status} Home",
        status=listing_status,
        is_public=True,
    )

    response = client.get("/public/listings")

    assert response.status_code == 200
    assert response.json()["total"] == 0
    assert response.json()["items"] == []


def test_public_list_excludes_visibility_disabled_listing(public_listing_test_app):
    """Eligible lifecycle status alone must not make a listing public."""
    client, db = public_listing_test_app
    _add_listing(
        db,
        title="Hidden Active Home",
        status="Active",
        is_public=False,
    )

    response = client.get("/public/listings")

    assert response.status_code == 200
    assert response.json()["total"] == 0


@pytest.mark.parametrize(
    ("listing_status", "is_public"),
    [
        ("Draft", True),
        ("Archived", True),
        ("Active", False),
        ("Pending", False),
        ("Sold", False),
    ],
)
def test_public_detail_returns_404_for_ineligible_listing(
    public_listing_test_app,
    listing_status,
    is_public,
):
    """Detail queries enforce the same public rules as list queries."""
    client, db = public_listing_test_app
    listing = _add_listing(
        db,
        title="Not Public",
        status=listing_status,
        is_public=is_public,
    )

    response = client.get(f"/public/listings/{listing.id}")

    assert response.status_code == 404


def test_public_detail_hides_exact_address_at_api_boundary(public_listing_test_app):
    """Hidden street addresses must not leak in the anonymous API payload."""
    client, db = public_listing_test_app
    listing = _add_listing(
        db,
        title="Private Address Home",
        status="Active",
        is_public=True,
        hide_exact_address=True,
    )

    response = client.get(f"/public/listings/{listing.id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["address"] is None
    assert payload["city"] == "Ames"
    assert payload["state"] == "IA"
    assert payload["hide_exact_address"] is True
    assert "is_public" not in payload


def test_featured_endpoint_returns_only_public_eligible_featured_rows(
    public_listing_test_app,
):
    """Homepage featured results must satisfy all public rules."""
    client, db = public_listing_test_app
    eligible = _add_listing(
        db,
        title="Featured Public Home",
        status="Active",
        is_public=True,
        is_featured=True,
    )
    _add_listing(
        db,
        title="Featured Hidden Home",
        status="Active",
        is_public=False,
        is_featured=True,
    )
    _add_listing(
        db,
        title="Featured Draft Home",
        status="Draft",
        is_public=True,
        is_featured=True,
    )
    _add_listing(
        db,
        title="Normal Public Home",
        status="Active",
        is_public=True,
        is_featured=False,
    )

    response = client.get("/public/listings/featured")

    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload] == [eligible.id]


def test_internal_api_can_still_read_draft_and_archived_rows(
    public_listing_test_app,
):
    """Staff/admin APIs retain access to internal lifecycle states."""
    client, db = public_listing_test_app
    draft = _add_listing(
        db,
        title="Internal Draft",
        status="Draft",
        is_public=False,
    )
    archived = _add_listing(
        db,
        title="Internal Archive",
        status="Archived",
        is_public=False,
    )

    response = client.get(
        "/listings",
        headers=_staff_headers(),
    )

    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert draft.id in ids
    assert archived.id in ids


def test_public_list_pagination_counts_only_eligible_rows(public_listing_test_app):
    """Pagination totals should not count hidden/internal listings."""
    client, db = public_listing_test_app

    for index in range(3):
        _add_listing(
            db,
            title=f"Public {index}",
            status="Active",
            is_public=True,
        )

    _add_listing(
        db,
        title="Hidden",
        status="Active",
        is_public=False,
    )

    response = client.get("/public/listings?page=2&per_page=2")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 3
    assert payload["page"] == 2
    assert payload["per_page"] == 2
    assert len(payload["items"]) == 1

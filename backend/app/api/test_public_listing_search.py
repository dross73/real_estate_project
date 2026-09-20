"""Tests for advanced public real-estate listing filters."""

from collections.abc import Generator
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.public_listings import router as public_listings_router
from app.db.base import Base
from app.db.models import Listing
from app.db.session import get_db


@pytest.fixture()
def search_test_app() -> Generator[tuple[TestClient, Session], None, None]:
    """Provide an isolated public search API."""
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


def _add_listing(
    db: Session,
    *,
    title: str,
    price: int,
    city: str = "Ames",
    state: str = "IA",
    property_type: str = "Single Family",
    sqft: int | None = 1800,
    acreage: float | None = 0.25,
    year_built: int | None = 2000,
    bedrooms: int = 3,
    bathrooms: float = 2.0,
    listing_status: str = "Active",
    is_public: bool = True,
) -> Listing:
    """Insert a search fixture listing."""
    listing = Listing(
        title=title,
        status=listing_status,
        is_public=is_public,
        is_featured=False,
        hide_exact_address=False,
        price=price,
        property_type=property_type,
        address="123 Test Street",
        city=city,
        state=state,
        description=None,
        sqft=sqft,
        acreage=acreage,
        year_built=year_built,
        bedrooms=bedrooms,
        bathrooms=bathrooms,
        annual_property_taxes=None,
        hoa_fee=None,
        hoa_fee_frequency=None,
        school_district=None,
        amenities=[],
        mls_number=None,
        source_attribution=None,
        cover_image=None,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def _seed_search_data(db: Session) -> dict[str, Listing]:
    """Create distinct properties so each filter can be verified."""
    return {
        "ames": _add_listing(
            db,
            title="Ames Family Home",
            price=300000,
            city="Ames",
            property_type="Single Family",
            sqft=2000,
            acreage=0.30,
            year_built=2010,
            bedrooms=4,
            bathrooms=2.5,
            listing_status="Active",
        ),
        "des_moines": _add_listing(
            db,
            title="Downtown Condo",
            price=450000,
            city="Des Moines",
            property_type="Condo",
            sqft=1200,
            acreage=0.05,
            year_built=2022,
            bedrooms=2,
            bathrooms=2.0,
            listing_status="Pending",
        ),
        "story_city": _add_listing(
            db,
            title="Story City Acreage",
            price=525000,
            city="Story City",
            property_type="Farm/Ranch",
            sqft=2600,
            acreage=8.50,
            year_built=1995,
            bedrooms=5,
            bathrooms=3.5,
            listing_status="Sold",
        ),
        "hidden": _add_listing(
            db,
            title="Hidden Ames Home",
            price=325000,
            city="Ames",
            bedrooms=4,
            bathrooms=2.5,
            is_public=False,
        ),
    }


def test_combined_filters_return_only_matching_public_listing(search_test_app):
    """Common real-estate filters should compose into one query."""
    client, db = search_test_app
    listings = _seed_search_data(db)

    response = client.get(
        "/public/listings",
        params={
            "min_price": 250000,
            "max_price": 350000,
            "min_bedrooms": 3,
            "min_bathrooms": 2.5,
            "location": "ames",
            "property_type": "Single Family",
            "min_sqft": 1800,
            "max_sqft": 2200,
            "min_acreage": 0.20,
            "max_acreage": 0.50,
            "min_year_built": 2005,
            "max_year_built": 2015,
            "status": "Active",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert [item["id"] for item in payload["items"]] == [listings["ames"].id]


@pytest.mark.parametrize(
    ("params", "expected_key"),
    [
        ({"location": "des moines"}, "des_moines"),
        ({"property_type": "Farm/Ranch"}, "story_city"),
        ({"status": "Pending"}, "des_moines"),
        ({"min_bedrooms": 5}, "story_city"),
        ({"min_bathrooms": 3.5}, "story_city"),
        ({"min_sqft": 2500}, "story_city"),
        ({"min_acreage": 5}, "story_city"),
        ({"min_year_built": 2020}, "des_moines"),
    ],
)
def test_individual_filters(
    search_test_app,
    params,
    expected_key,
):
    """Each supported filter should independently narrow public results."""
    client, db = search_test_app
    listings = _seed_search_data(db)

    response = client.get("/public/listings", params=params)

    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["items"]]
    assert ids == [listings[expected_key].id]


def test_location_filter_can_match_state_case_insensitively(search_test_app):
    """Location search should support state codes as well as city names."""
    client, db = search_test_app
    _seed_search_data(db)

    response = client.get("/public/listings", params={"location": "ia"})

    assert response.status_code == 200
    assert response.json()["total"] == 3


def test_price_sorting_works_with_pagination(search_test_app):
    """Sorting happens before pagination and keeps totals filter-aware."""
    client, db = search_test_app
    listings = _seed_search_data(db)

    response = client.get(
        "/public/listings",
        params={
            "sort": "price_asc",
            "page": 1,
            "per_page": 2,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 3
    assert [item["id"] for item in payload["items"]] == [
        listings["ames"].id,
        listings["des_moines"].id,
    ]


def test_descending_price_sort(search_test_app):
    """Descending price sort should put the highest public price first."""
    client, db = search_test_app
    listings = _seed_search_data(db)

    response = client.get(
        "/public/listings",
        params={"sort": "price_desc"},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == listings["story_city"].id


@pytest.mark.parametrize(
    ("params", "expected_detail"),
    [
        (
            {"min_price": 500000, "max_price": 100000},
            "min_price cannot be greater than max_price",
        ),
        (
            {"min_sqft": 3000, "max_sqft": 1000},
            "min_sqft cannot be greater than max_sqft",
        ),
        (
            {"min_acreage": 10, "max_acreage": 1},
            "min_acreage cannot be greater than max_acreage",
        ),
        (
            {"min_year_built": 2020, "max_year_built": 1990},
            "min_year_built cannot be greater than max_year_built",
        ),
    ],
)
def test_invalid_ranges_return_clear_validation_error(
    search_test_app,
    params,
    expected_detail,
):
    """Contradictory ranges should return explicit 422 messages."""
    client, _ = search_test_app

    response = client.get("/public/listings", params=params)

    assert response.status_code == 422
    assert response.json()["detail"] == expected_detail


@pytest.mark.parametrize(
    "params",
    [
        {"min_price": -1},
        {"min_bathrooms": 2.25},
        {"property_type": "Castle"},
        {"status": "Draft"},
        {"sort": "random"},
        {"page": 0},
        {"per_page": 101},
    ],
)
def test_invalid_filter_values_return_422(search_test_app, params):
    """FastAPI/Pydantic should reject unsupported or unsafe query values."""
    client, _ = search_test_app

    response = client.get("/public/listings", params=params)

    assert response.status_code == 422


def test_future_year_filter_is_rejected(search_test_app):
    """Year-built filters use the same sensible calendar bound as listings."""
    client, _ = search_test_app
    future_year = datetime.now(timezone.utc).year + 2

    response = client.get(
        "/public/listings",
        params={"min_year_built": future_year},
    )

    assert response.status_code == 422
    assert "min_year_built cannot be greater than" in response.json()["detail"]

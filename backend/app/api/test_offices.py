"""Integration tests for office management and independent associations."""

from collections.abc import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.agents import admin_router as agents_router, public_router as public_agents_router
from app.api.listings import router as listings_router
from app.api.offices import admin_router as offices_router, public_router as public_offices_router
from app.api.public_listings import router as public_listings_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models import AgentProfile, Listing
from app.db.session import get_db


@pytest.fixture()
def office_app() -> Generator[tuple[TestClient, Session], None, None]:
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
    app.include_router(offices_router)
    app.include_router(public_offices_router)
    app.include_router(agents_router)
    app.include_router(public_agents_router)
    app.include_router(listings_router)
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


def _headers(role: str = "admin") -> dict[str, str]:
    token = create_access_token(
        subject=f"{role}@example.com",
        role=role,
    )
    return {"Authorization": f"Bearer {token}"}


def _office_payload(
    *,
    name: str = "Story City Office",
    active: bool = True,
    public: bool = True,
) -> dict:
    return {
        "name": name,
        "address_line1": "100 Broad Street",
        "city": "Story City",
        "state": "ia",
        "postal_code": "50248",
        "phone": "515-555-0100",
        "email": "office@example.com",
        "hours": "Monday-Friday 9:00 AM-5:00 PM",
        "is_active": active,
        "is_public": public,
    }


def _agent_payload(*, office_id: int | None = None) -> dict:
    return {
        "full_name": "Jane Morgan",
        "professional_title": "REALTOR",
        "email": "jane@example.com",
        "phone": "515-555-0110",
        "photo_url": None,
        "bio": "Local real estate guidance.",
        "office_id": office_id,
        "is_active": True,
        "is_public": True,
    }


def _listing_payload(
    *,
    agent_id: int | None = None,
    office_id: int | None = None,
) -> dict:
    return {
        "title": "Office Associated Home",
        "status": "Active",
        "is_public": True,
        "is_featured": False,
        "hide_exact_address": False,
        "agent_id": agent_id,
        "office_id": office_id,
        "price": 425000,
        "property_type": "Single Family",
        "address": "123 Main St",
        "city": "Ames",
        "state": "IA",
        "description": "A well-kept home.",
        "sqft": 1900,
        "acreage": None,
        "year_built": 2008,
        "bedrooms": 3,
        "bathrooms": 2.0,
        "annual_property_taxes": None,
        "hoa_fee": None,
        "hoa_fee_frequency": None,
        "school_district": "Ames",
        "amenities": [],
        "mls_number": None,
        "source_attribution": None,
        "cover_image": None,
    }


def test_admin_manages_offices_and_staff_can_list_them(office_app):
    client, _ = office_app

    created = client.post(
        "/offices",
        headers=_headers(),
        json=_office_payload(),
    )
    assert created.status_code == 201
    assert created.json()["state"] == "IA"

    staff = client.get(
        "/offices?active_only=true",
        headers=_headers("staff"),
    )
    assert staff.status_code == 200
    assert [office["id"] for office in staff.json()] == [created.json()["id"]]

    forbidden = client.post(
        "/offices",
        headers=_headers("staff"),
        json=_office_payload(name="Staff Office"),
    )
    assert forbidden.status_code == 403


def test_agent_and_listing_office_associations_are_independent(office_app):
    client, _ = office_app

    agent_office = client.post(
        "/offices",
        headers=_headers(),
        json=_office_payload(name="Ames Office"),
    ).json()
    listing_office = client.post(
        "/offices",
        headers=_headers(),
        json={
            **_office_payload(name="Story City Office"),
            "email": "story@example.com",
        },
    ).json()

    agent = client.post(
        "/agents",
        headers=_headers(),
        json=_agent_payload(office_id=agent_office["id"]),
    )
    assert agent.status_code == 201

    listing = client.post(
        "/listings",
        headers=_headers(),
        json=_listing_payload(
            agent_id=agent.json()["id"],
            office_id=listing_office["id"],
        ),
    )
    assert listing.status_code == 201
    assert listing.json()["agent_id"] == agent.json()["id"]
    assert listing.json()["office_id"] == listing_office["id"]

    public_listing = client.get(f"/public/listings/{listing.json()['id']}")
    assert public_listing.status_code == 200
    body = public_listing.json()
    assert body["agent"]["office"]["id"] == agent_office["id"]
    assert body["office"]["id"] == listing_office["id"]


def test_public_agent_profile_shows_only_enabled_office_information(office_app):
    client, _ = office_app

    office = client.post(
        "/offices",
        headers=_headers(),
        json=_office_payload(),
    ).json()
    agent = client.post(
        "/agents",
        headers=_headers(),
        json=_agent_payload(office_id=office["id"]),
    ).json()

    visible = client.get(f"/public/agents/{agent['id']}")
    assert visible.status_code == 200
    assert visible.json()["office"]["name"] == "Story City Office"
    assert visible.json()["office"]["hours"] is not None

    hidden_update = client.put(
        f"/offices/{office['id']}",
        headers=_headers(),
        json={"is_public": False},
    )
    assert hidden_update.status_code == 200

    hidden = client.get(f"/public/agents/{agent['id']}")
    assert hidden.status_code == 200
    assert hidden.json()["office"] is None
    assert hidden.json()["office_name"] is None


def test_inactive_office_cannot_be_newly_assigned(office_app):
    client, _ = office_app

    office = client.post(
        "/offices",
        headers=_headers(),
        json=_office_payload(active=False),
    ).json()

    agent = client.post(
        "/agents",
        headers=_headers(),
        json=_agent_payload(office_id=office["id"]),
    )
    listing = client.post(
        "/listings",
        headers=_headers(),
        json=_listing_payload(office_id=office["id"]),
    )

    assert agent.status_code == 422
    assert listing.status_code == 422


def test_deleting_office_clears_agent_and_listing_associations(office_app):
    client, db = office_app

    office = client.post(
        "/offices",
        headers=_headers(),
        json=_office_payload(),
    ).json()
    agent = client.post(
        "/agents",
        headers=_headers(),
        json=_agent_payload(office_id=office["id"]),
    ).json()
    listing = client.post(
        "/listings",
        headers=_headers(),
        json=_listing_payload(
            agent_id=agent["id"],
            office_id=office["id"],
        ),
    ).json()

    response = client.delete(
        f"/offices/{office['id']}",
        headers=_headers(),
    )
    assert response.status_code == 204

    db.expire_all()
    stored_agent = db.query(AgentProfile).filter(AgentProfile.id == agent["id"]).first()
    stored_listing = db.query(Listing).filter(Listing.id == listing["id"]).first()
    assert stored_agent is not None and stored_agent.office_id is None
    assert stored_listing is not None and stored_listing.office_id is None

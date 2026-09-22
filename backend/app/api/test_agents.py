"""Integration tests for agent profiles and listing assignment."""

from collections.abc import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.agents import admin_router as agents_router, public_router as public_agents_router
from app.api.listings import router as listings_router
from app.api.public_listings import router as public_listings_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db


@pytest.fixture()
def agent_app() -> Generator[tuple[TestClient, Session], None, None]:
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


def _agent_payload(
    *,
    name: str = "Jane Morgan",
    public: bool = True,
    active: bool = True,
) -> dict:
    return {
        "full_name": name,
        "professional_title": "REALTOR",
        "email": f"{name.lower().replace(' ', '.')}@example.com",
        "phone": "515-555-0110",
        "photo_url": "https://example.com/agent.jpg",
        "bio": "Local real estate guidance with a community-first approach.",
        "office_name": "Juniper & Lane Realty",
        "is_active": active,
        "is_public": public,
    }


def _listing_payload(*, agent_id: int | None = None) -> dict:
    return {
        "title": "Agent Assigned Home",
        "status": "Active",
        "is_public": True,
        "is_featured": False,
        "hide_exact_address": False,
        "agent_id": agent_id,
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


def test_admin_manages_agents_while_staff_can_read_assignable_profiles(agent_app):
    client, _ = agent_app

    created = client.post(
        "/agents",
        headers=_headers("admin"),
        json=_agent_payload(),
    )
    assert created.status_code == 201
    agent_id = created.json()["id"]

    staff_list = client.get(
        "/agents?active_only=true",
        headers=_headers("staff"),
    )
    assert staff_list.status_code == 200
    assert [agent["id"] for agent in staff_list.json()] == [agent_id]

    staff_create = client.post(
        "/agents",
        headers=_headers("staff"),
        json=_agent_payload(name="Staff Created"),
    )
    assert staff_create.status_code == 403


def test_public_profile_honors_agent_visibility(agent_app):
    client, _ = agent_app

    visible = client.post(
        "/agents",
        headers=_headers(),
        json=_agent_payload(name="Visible Agent"),
    ).json()
    hidden = client.post(
        "/agents",
        headers=_headers(),
        json=_agent_payload(name="Hidden Agent", public=False),
    ).json()

    public_response = client.get(f"/public/agents/{visible['id']}")
    hidden_response = client.get(f"/public/agents/{hidden['id']}")

    assert public_response.status_code == 200
    assert public_response.json()["bio"] is not None
    assert hidden_response.status_code == 404


def test_public_listing_includes_only_public_active_assigned_agent(agent_app):
    client, _ = agent_app

    visible = client.post(
        "/agents",
        headers=_headers(),
        json=_agent_payload(name="Listing Agent"),
    ).json()

    listing = client.post(
        "/listings",
        headers=_headers(),
        json=_listing_payload(agent_id=visible["id"]),
    )
    assert listing.status_code == 201

    public_listing = client.get(f"/public/listings/{listing.json()['id']}")
    assert public_listing.status_code == 200
    assert public_listing.json()["agent"]["id"] == visible["id"]
    assert public_listing.json()["agent"]["full_name"] == "Listing Agent"


def test_hidden_agent_assignment_falls_back_without_public_identity_leak(agent_app):
    client, _ = agent_app

    hidden = client.post(
        "/agents",
        headers=_headers(),
        json=_agent_payload(name="Hidden Listing Agent", public=False),
    ).json()

    listing = client.post(
        "/listings",
        headers=_headers(),
        json=_listing_payload(agent_id=hidden["id"]),
    )
    assert listing.status_code == 201

    public_listing = client.get(f"/public/listings/{listing.json()['id']}")
    assert public_listing.status_code == 200
    assert public_listing.json()["agent"] is None

    filtered = client.get(f"/public/listings?agent_id={hidden['id']}")
    assert filtered.status_code == 200
    assert filtered.json()["items"] == []


def test_inactive_agent_cannot_be_newly_assigned(agent_app):
    client, _ = agent_app

    inactive = client.post(
        "/agents",
        headers=_headers(),
        json=_agent_payload(name="Inactive Agent", active=False),
    ).json()

    response = client.post(
        "/listings",
        headers=_headers(),
        json=_listing_payload(agent_id=inactive["id"]),
    )

    assert response.status_code == 422
    assert "active agent profile" in response.json()["detail"]

"""Integration tests for internal lead and inquiry management."""

from collections.abc import Generator
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.leads import router as leads_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models import AgentProfile, Lead, Listing, User
from app.db.session import get_db


@pytest.fixture()
def lead_app() -> Generator[tuple[TestClient, Session], None, None]:
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
    app.include_router(leads_router)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    try:
        yield TestClient(app), db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _headers(role: str = "admin", email: str | None = None) -> dict[str, str]:
    subject = email or f"{role}@example.com"
    token = create_access_token(subject=subject, role=role)
    return {"Authorization": f"Bearer {token}"}


def _listing(db: Session) -> Listing:
    listing = Listing(
        title="Lead Test Home",
        status="Active",
        is_public=True,
        is_featured=False,
        hide_exact_address=False,
        price=350000,
        property_type="Single Family",
        address="123 Main St",
        city="Ames",
        state="IA",
        bedrooms=3,
        bathrooms=2.0,
        amenities=[],
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def _agent(db: Session) -> AgentProfile:
    agent = AgentProfile(
        full_name="Jane Morgan",
        professional_title="REALTOR",
        email="jane@example.com",
        is_active=True,
        is_public=True,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


def _staff(db: Session) -> User:
    staff = User(
        role="staff",
        email="staff@example.com",
        full_name="Staff Member",
        hashed_password="not-used",
        is_active=True,
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


def _public_user(db: Session) -> User:
    user = User(
        role="public_user",
        email="buyer@example.com",
        full_name="Buyer Person",
        hashed_password="not-used",
        is_active=True,
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_staff_can_create_and_view_consistent_inquiry_record(lead_app):
    client, db = lead_app
    listing = _listing(db)
    requester = _public_user(db)

    response = client.post(
        "/leads",
        headers=_headers("staff", "staff@example.com"),
        json={
            "inquiry_type": "showing",
            "requester_user_id": requester.id,
            "contact_name": "Buyer Person",
            "contact_email": "buyer@example.com",
            "contact_phone": "515-555-0199",
            "listing_id": listing.id,
            "message": "Could I see this Saturday?",
            "preferred_at": "2026-09-26T15:00:00Z",
            "source": "internal_test",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "New"
    assert body["inquiry_type"] == "showing"
    assert body["listing_title"] == "Lead Test Home"
    assert body["activities"][0]["activity_type"] == "created"

    stored = db.query(Lead).filter(Lead.id == body["id"]).first()
    assert stored is not None
    assert stored.requester_user_id == requester.id


def test_public_users_cannot_access_internal_lead_management(lead_app):
    client, _ = lead_app

    response = client.get(
        "/leads",
        headers=_headers("public_user", "buyer@example.com"),
    )

    assert response.status_code == 403


def test_status_assignment_and_note_mutations_append_activity_history(lead_app):
    client, db = lead_app
    agent = _agent(db)
    staff = _staff(db)

    created = client.post(
        "/leads",
        headers=_headers("admin"),
        json={
            "inquiry_type": "contact",
            "contact_name": "Taylor Morgan",
            "contact_email": "taylor@example.com",
            "message": "I have a question about buying.",
        },
    ).json()

    assigned = client.put(
        f"/leads/{created['id']}",
        headers=_headers("admin"),
        json={
            "status": "Contacted",
            "assigned_agent_id": agent.id,
        },
    )
    assert assigned.status_code == 200
    assigned_body = assigned.json()
    assert assigned_body["status"] == "Contacted"
    assert assigned_body["assigned_agent_id"] == agent.id
    assert assigned_body["assigned_user_id"] is None
    assert assigned_body["assigned_to_label"] == "Jane Morgan"

    reassigned = client.put(
        f"/leads/{created['id']}",
        headers=_headers("admin"),
        json={"assigned_user_id": staff.id},
    )
    assert reassigned.status_code == 200
    reassigned_body = reassigned.json()
    assert reassigned_body["assigned_agent_id"] is None
    assert reassigned_body["assigned_user_id"] == staff.id
    assert reassigned_body["assigned_to_label"] == "Staff Member"

    noted = client.post(
        f"/leads/{created['id']}/notes",
        headers=_headers("staff", "staff@example.com"),
        json={"note": "Left a voicemail and sent a follow-up email."},
    )
    assert noted.status_code == 200

    activity_types = [
        activity["activity_type"]
        for activity in noted.json()["activities"]
    ]
    assert activity_types == [
        "created",
        "status_changed",
        "assignment_changed",
        "assignment_changed",
        "note",
    ]
    assert noted.json()["activities"][-1]["note"].startswith("Left a voicemail")


def test_assignment_options_include_active_agents_and_internal_users(lead_app):
    client, db = lead_app
    active_agent = _agent(db)
    inactive_agent = AgentProfile(
        full_name="Inactive Agent",
        email="inactive@example.com",
        is_active=False,
        is_public=True,
    )
    db.add(inactive_agent)
    staff = _staff(db)
    admin = User(
        role="admin",
        email="manager@example.com",
        full_name="Manager",
        hashed_password="not-used",
        is_active=True,
    )
    public_user = _public_user(db)
    db.add(admin)
    db.commit()

    response = client.get(
        "/leads/assignment-options",
        headers=_headers("staff", "staff@example.com"),
    )

    assert response.status_code == 200
    items = response.json()["items"]

    assert any(
        item["kind"] == "agent" and item["id"] == active_agent.id
        for item in items
    )
    assert not any(
        item["kind"] == "agent" and item["id"] == inactive_agent.id
        for item in items
    )
    assert any(
        item["kind"] == "staff" and item["id"] == staff.id
        for item in items
    )
    assert any(
        item["kind"] == "staff" and item["id"] == admin.id
        for item in items
    )
    assert not any(
        item["kind"] == "staff" and item["id"] == public_user.id
        for item in items
    )


def test_open_house_type_and_filters_are_supported(lead_app):
    client, _ = lead_app

    created = client.post(
        "/leads",
        headers=_headers(),
        json={
            "inquiry_type": "open_house",
            "contact_name": "Open House Guest",
            "contact_email": "guest@example.com",
            "source": "future_open_house",
        },
    )
    assert created.status_code == 201

    filtered = client.get(
        "/leads?inquiry_type=open_house&status=New&q=Guest",
        headers=_headers(),
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["inquiry_type"] == "open_house"

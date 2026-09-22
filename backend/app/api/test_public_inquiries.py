"""Integration tests for verified public contact and showing requests."""

from collections.abc import Generator
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.public_inquiries import router as public_inquiries_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models import AgentProfile, Lead, Listing, SiteSetting, User
from app.db.session import get_db


@pytest.fixture()
def inquiry_app() -> Generator[tuple[TestClient, Session], None, None]:
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
    app.include_router(public_inquiries_router)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    try:
        yield TestClient(app), db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _headers(email: str) -> dict[str, str]:
    token = create_access_token(subject=email, role="public_user")
    return {"Authorization": f"Bearer {token}"}


def _public_user(
    db: Session,
    *,
    email: str = "buyer@example.com",
    verified: bool = True,
) -> User:
    user = User(
        role="public_user",
        email=email,
        full_name="Buyer Person",
        phone="515-555-0199",
        hashed_password="not-used",
        is_active=True,
        email_verified_at=(
            datetime.now(timezone.utc)
            if verified
            else None
        ),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _listing(
    db: Session,
    *,
    agent_id: int | None = None,
) -> Listing:
    listing = Listing(
        title="Public Inquiry Home",
        status="Active",
        is_public=True,
        is_featured=False,
        hide_exact_address=False,
        agent_id=agent_id,
        price=425000,
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


def _agent(
    db: Session,
    *,
    public: bool = True,
    active: bool = True,
) -> AgentProfile:
    agent = AgentProfile(
        full_name="Jane Morgan",
        professional_title="REALTOR",
        email="jane@example.com",
        is_active=active,
        is_public=public,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


def test_verified_user_showing_routes_to_active_listing_agent(inquiry_app):
    client, db = inquiry_app
    user = _public_user(db)
    agent = _agent(db)
    listing = _listing(db, agent_id=agent.id)

    response = client.post(
        "/public/account/inquiries",
        headers=_headers(user.email),
        json={
            "inquiry_type": "showing",
            "listing_id": listing.id,
            "message": "Saturday afternoon would be ideal.",
            "preferred_at": "2026-09-26T15:00:00Z",
            "submission_key": "showing-request-0001",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["inquiry_type"] == "showing"
    assert body["listing_id"] == listing.id
    assert body["destination_label"] == "Jane Morgan"

    stored = db.query(Lead).filter(Lead.id == body["id"]).first()
    assert stored is not None
    assert stored.requester_user_id == user.id
    assert stored.assigned_agent_id == agent.id
    assert stored.contact_email == user.email
    assert stored.contact_phone == user.phone


def test_general_contact_falls_back_to_brokerage_and_is_idempotent(inquiry_app):
    client, db = inquiry_app
    user = _public_user(db)

    payload = {
        "inquiry_type": "contact",
        "listing_id": None,
        "message": "I am starting a home search in Ames.",
        "preferred_at": None,
        "submission_key": "contact-request-000001",
    }

    first = client.post(
        "/public/account/inquiries",
        headers=_headers(user.email),
        json=payload,
    )
    second = client.post(
        "/public/account/inquiries",
        headers=_headers(user.email),
        json=payload,
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]
    assert first.json()["destination_label"] == "Juniper & Lane Realty"
    assert db.query(Lead).count() == 1


def test_unverified_user_cannot_submit_public_inquiry(inquiry_app):
    client, db = inquiry_app
    user = _public_user(db, verified=False)

    response = client.post(
        "/public/account/inquiries",
        headers=_headers(user.email),
        json={
            "inquiry_type": "contact",
            "listing_id": None,
            "message": "Please contact me.",
            "preferred_at": None,
            "submission_key": "contact-request-unverified",
        },
    )

    assert response.status_code == 403
    assert db.query(Lead).count() == 0


def test_site_settings_can_disable_contact_and_showing_requests(inquiry_app):
    client, db = inquiry_app
    user = _public_user(db)
    listing = _listing(db)

    db.add(
        SiteSetting(
            id=1,
            enable_contact_requests=False,
            enable_showing_requests=False,
        )
    )
    db.commit()

    contact = client.post(
        "/public/account/inquiries",
        headers=_headers(user.email),
        json={
            "inquiry_type": "contact",
            "listing_id": None,
            "message": "Please contact me.",
            "preferred_at": None,
            "submission_key": "disabled-contact-0001",
        },
    )
    showing = client.post(
        "/public/account/inquiries",
        headers=_headers(user.email),
        json={
            "inquiry_type": "showing",
            "listing_id": listing.id,
            "message": None,
            "preferred_at": None,
            "submission_key": "disabled-showing-0001",
        },
    )

    assert contact.status_code == 403
    assert showing.status_code == 403
    assert db.query(Lead).count() == 0


def test_hidden_active_agent_still_receives_internal_routing_without_identity_leak(
    inquiry_app,
):
    client, db = inquiry_app
    user = _public_user(db)
    agent = _agent(db, public=False, active=True)
    listing = _listing(db, agent_id=agent.id)

    response = client.post(
        "/public/account/inquiries",
        headers=_headers(user.email),
        json={
            "inquiry_type": "contact",
            "listing_id": listing.id,
            "message": "Is this home still available?",
            "preferred_at": None,
            "submission_key": "hidden-agent-request-01",
        },
    )

    assert response.status_code == 201
    assert response.json()["destination_label"] == "Juniper & Lane Realty"

    stored = db.query(Lead).filter(Lead.id == response.json()["id"]).first()
    assert stored is not None
    assert stored.assigned_agent_id == agent.id


def test_account_history_returns_only_current_users_public_request_types(inquiry_app):
    client, db = inquiry_app
    user = _public_user(db)
    other = _public_user(db, email="other@example.com")

    own_contact = Lead(
        inquiry_type="contact",
        status="New",
        requester_user_id=user.id,
        contact_name="Buyer Person",
        contact_email=user.email,
        source="public_contact",
    )
    own_open_house = Lead(
        inquiry_type="open_house",
        status="New",
        requester_user_id=user.id,
        contact_name="Buyer Person",
        contact_email=user.email,
        source="future_open_house",
    )
    other_contact = Lead(
        inquiry_type="contact",
        status="New",
        requester_user_id=other.id,
        contact_name="Other Buyer",
        contact_email=other.email,
        source="public_contact",
    )
    db.add_all([own_contact, own_open_house, other_contact])
    db.commit()

    response = client.get(
        "/public/account/inquiries",
        headers=_headers(user.email),
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == own_contact.id

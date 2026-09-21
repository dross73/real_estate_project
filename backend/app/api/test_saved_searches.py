"""Tests for saved-search ownership, lifecycle, and alert delivery."""

from collections.abc import Generator
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.saved_searches import router as saved_searches_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models import Listing, SavedSearch, SavedSearchAlertDelivery, User
from app.db.session import get_db
from app.services.saved_search_alerts import process_saved_search_alerts


class RecordingEmailService:
    def __init__(self) -> None:
        self.messages: list[dict[str, str]] = []

    def send(self, *, to_email: str, subject: str, text_body: str) -> None:
        self.messages.append(
            {
                "to_email": to_email,
                "subject": subject,
                "text_body": text_body,
            }
        )


@pytest.fixture()
def saved_search_app() -> Generator[tuple[TestClient, Session], None, None]:
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
    app.include_router(saved_searches_router)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    try:
        yield TestClient(app), db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _user(db: Session, email: str) -> User:
    user = User(
        email=email,
        full_name="Saved Search User",
        hashed_password="unused",
        is_active=True,
        role="public_user",
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers(email: str) -> dict[str, str]:
    token = create_access_token(subject=email, role="public_user")
    return {"Authorization": f"Bearer {token}"}


def _listing(
    db: Session,
    *,
    title: str,
    price: int,
    city: str = "Ames",
    created_at: datetime | None = None,
) -> Listing:
    listing = Listing(
        title=title,
        status="Active",
        is_public=True,
        is_featured=False,
        hide_exact_address=False,
        price=price,
        property_type="Single Family",
        address="123 Test St",
        city=city,
        state="IA",
        description=None,
        sqft=1800,
        acreage=None,
        year_built=2000,
        bedrooms=3,
        bathrooms=2.0,
        annual_property_taxes=None,
        hoa_fee=None,
        hoa_fee_frequency=None,
        school_district=None,
        amenities=[],
        mls_number=None,
        source_attribution=None,
        cover_image=None,
        created_at=created_at or datetime.now(timezone.utc),
        updated_at=created_at or datetime.now(timezone.utc),
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def test_saved_search_crud_is_scoped_to_owner(saved_search_app):
    client, db = saved_search_app
    owner = _user(db, "owner@example.com")
    other = _user(db, "other@example.com")

    created = client.post(
        "/public/account/saved-searches",
        headers=_headers(owner.email),
        json={
            "name": "Ames under 500k",
            "criteria": {
                "location": "Ames",
                "max_price": 500000,
                "min_bedrooms": 3,
            },
            "alert_frequency": "daily",
            "alerts_enabled": True,
        },
    )
    assert created.status_code == 201
    search_id = created.json()["id"]

    owner_list = client.get(
        "/public/account/saved-searches",
        headers=_headers(owner.email),
    )
    assert [item["id"] for item in owner_list.json()["items"]] == [search_id]

    other_list = client.get(
        "/public/account/saved-searches",
        headers=_headers(other.email),
    )
    assert other_list.json()["items"] == []

    forbidden_update = client.put(
        f"/public/account/saved-searches/{search_id}",
        headers=_headers(other.email),
        json={"name": "Not yours"},
    )
    assert forbidden_update.status_code == 404

    updated = client.put(
        f"/public/account/saved-searches/{search_id}",
        headers=_headers(owner.email),
        json={
            "name": "Ames favorites",
            "alert_frequency": "weekly",
            "alerts_enabled": False,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Ames favorites"
    assert updated.json()["alert_frequency"] == "weekly"
    assert updated.json()["alerts_enabled"] is False

    deleted = client.delete(
        f"/public/account/saved-searches/{search_id}",
        headers=_headers(owner.email),
    )
    assert deleted.status_code == 204


def test_saved_search_rejects_contradictory_ranges(saved_search_app):
    client, db = saved_search_app
    user = _user(db, "ranges@example.com")

    response = client.post(
        "/public/account/saved-searches",
        headers=_headers(user.email),
        json={
            "name": "Bad price range",
            "criteria": {
                "min_price": 700000,
                "max_price": 400000,
            },
        },
    )
    assert response.status_code == 422


def test_alert_processor_matches_filters_and_deduplicates(saved_search_app):
    _, db = saved_search_app
    user = _user(db, "alerts@example.com")
    search_time = datetime.now(timezone.utc) - timedelta(minutes=5)

    saved_search = SavedSearch(
        user_id=user.id,
        name="Ames under 500k",
        criteria={"location": "Ames", "max_price": 500000},
        alert_frequency="immediate",
        alerts_enabled=True,
        created_at=search_time,
        updated_at=search_time,
    )
    db.add(saved_search)
    db.commit()
    db.refresh(saved_search)

    matching = _listing(
        db,
        title="Matching Home",
        price=425000,
        city="Ames",
    )
    _listing(
        db,
        title="Too Expensive",
        price=725000,
        city="Ames",
    )
    _listing(
        db,
        title="Wrong City",
        price=350000,
        city="Des Moines",
    )

    email = RecordingEmailService()

    first_count = process_saved_search_alerts(
        db,
        email_service=email,
        only_immediate=True,
    )
    second_count = process_saved_search_alerts(
        db,
        email_service=email,
        only_immediate=True,
    )

    assert first_count == 1
    assert second_count == 0
    assert len(email.messages) == 1
    assert "Matching Home" in email.messages[0]["text_body"]
    assert "Too Expensive" not in email.messages[0]["text_body"]

    deliveries = db.query(SavedSearchAlertDelivery).all()
    assert [delivery.listing_id for delivery in deliveries] == [matching.id]


def test_daily_alert_respects_frequency_window(saved_search_app):
    _, db = saved_search_app
    user = _user(db, "daily@example.com")
    now = datetime.now(timezone.utc)
    search_time = now - timedelta(days=2)

    saved_search = SavedSearch(
        user_id=user.id,
        name="Daily Ames",
        criteria={"location": "Ames"},
        alert_frequency="daily",
        alerts_enabled=True,
        last_alerted_at=now - timedelta(hours=6),
        created_at=search_time,
        updated_at=search_time,
    )
    db.add(saved_search)
    db.commit()

    _listing(
        db,
        title="New Today",
        price=350000,
        city="Ames",
        created_at=now - timedelta(hours=1),
    )

    email = RecordingEmailService()

    not_due = process_saved_search_alerts(
        db,
        now=now,
        email_service=email,
    )
    due = process_saved_search_alerts(
        db,
        now=now + timedelta(days=1),
        email_service=email,
    )

    assert not_due == 0
    assert due == 1
    assert len(email.messages) == 1


def test_paused_search_does_not_send(saved_search_app):
    _, db = saved_search_app
    user = _user(db, "paused@example.com")
    search_time = datetime.now(timezone.utc) - timedelta(minutes=5)

    db.add(
        SavedSearch(
            user_id=user.id,
            name="Paused",
            criteria={},
            alert_frequency="immediate",
            alerts_enabled=False,
            created_at=search_time,
            updated_at=search_time,
        )
    )
    db.commit()
    _listing(db, title="Should Not Send", price=300000)

    email = RecordingEmailService()
    sent = process_saved_search_alerts(
        db,
        email_service=email,
    )

    assert sent == 0
    assert email.messages == []

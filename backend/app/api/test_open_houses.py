"""Integration tests for listing open-house scheduling."""

from collections.abc import Generator
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.open_houses import router as open_houses_router
from app.api.public_listings import router as public_listings_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models import AuditLog, Listing, OpenHouseEvent
from app.db.session import get_db


@pytest.fixture()
def open_house_app() -> Generator[tuple[TestClient, Session], None, None]:
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
    app.include_router(open_houses_router)
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


def _listing(
    db: Session,
    *,
    is_public: bool = True,
    status: str = "Active",
) -> Listing:
    listing = Listing(
        title="Open House Test Home",
        status=status,
        is_public=is_public,
        is_featured=False,
        hide_exact_address=False,
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


def test_staff_can_create_update_list_and_delete_open_house(open_house_app):
    client, db = open_house_app
    listing = _listing(db)
    start = datetime.now(timezone.utc) + timedelta(days=5)
    end = start + timedelta(hours=2)

    created = client.post(
        f"/listings/{listing.id}/open-houses",
        headers=_headers("staff"),
        json={
            "starts_at": start.isoformat(),
            "ends_at": end.isoformat(),
        },
    )

    assert created.status_code == 201
    event_id = created.json()["id"]
    assert created.json()["listing_id"] == listing.id

    listed = client.get(
        f"/listings/{listing.id}/open-houses",
        headers=_headers("staff"),
    )
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [event_id]

    updated_end = end + timedelta(hours=1)
    updated = client.put(
        f"/listings/{listing.id}/open-houses/{event_id}",
        headers=_headers(),
        json={"ends_at": updated_end.isoformat()},
    )
    assert updated.status_code == 200

    deleted = client.delete(
        f"/listings/{listing.id}/open-houses/{event_id}",
        headers=_headers(),
    )
    assert deleted.status_code == 204
    assert db.query(OpenHouseEvent).count() == 0

    actions = [
        row.action
        for row in db.query(AuditLog).order_by(AuditLog.id.asc()).all()
    ]
    assert actions == [
        "open_house.created",
        "open_house.updated",
        "open_house.deleted",
    ]


def test_open_house_times_must_be_future_and_end_after_start(open_house_app):
    client, db = open_house_app
    listing = _listing(db)
    now = datetime.now(timezone.utc)

    past = client.post(
        f"/listings/{listing.id}/open-houses",
        headers=_headers(),
        json={
            "starts_at": (now - timedelta(hours=2)).isoformat(),
            "ends_at": (now - timedelta(hours=1)).isoformat(),
        },
    )
    backwards = client.post(
        f"/listings/{listing.id}/open-houses",
        headers=_headers(),
        json={
            "starts_at": (now + timedelta(days=3)).isoformat(),
            "ends_at": (now + timedelta(days=3, hours=-1)).isoformat(),
        },
    )
    timezone_missing = client.post(
        f"/listings/{listing.id}/open-houses",
        headers=_headers(),
        json={
            "starts_at": "2026-10-10T13:00:00",
            "ends_at": "2026-10-10T15:00:00",
        },
    )

    assert past.status_code == 422
    assert backwards.status_code == 422
    assert timezone_missing.status_code == 422
    assert db.query(OpenHouseEvent).count() == 0


def test_public_users_cannot_manage_open_house_schedule(open_house_app):
    client, db = open_house_app
    listing = _listing(db)

    response = client.get(
        f"/listings/{listing.id}/open-houses",
        headers=_headers("public_user"),
    )

    assert response.status_code == 403


def test_public_listing_includes_only_current_or_upcoming_open_houses(
    open_house_app,
):
    client, db = open_house_app
    listing = _listing(db)
    now = datetime.now(timezone.utc)

    past = OpenHouseEvent(
        listing_id=listing.id,
        starts_at=now - timedelta(days=2),
        ends_at=now - timedelta(days=2, hours=-2),
    )
    later = OpenHouseEvent(
        listing_id=listing.id,
        starts_at=now + timedelta(days=8),
        ends_at=now + timedelta(days=8, hours=2),
    )
    sooner = OpenHouseEvent(
        listing_id=listing.id,
        starts_at=now + timedelta(days=3),
        ends_at=now + timedelta(days=3, hours=2),
    )
    db.add_all([past, later, sooner])
    db.commit()

    response = client.get(f"/public/listings/{listing.id}")

    assert response.status_code == 200
    open_houses = response.json()["open_houses"]
    assert len(open_houses) == 2
    assert [item["id"] for item in open_houses] == [sooner.id, later.id]


def test_non_public_listing_does_not_expose_open_house_schedule(open_house_app):
    client, db = open_house_app
    listing = _listing(db, is_public=False)
    start = datetime.now(timezone.utc) + timedelta(days=2)
    db.add(
        OpenHouseEvent(
            listing_id=listing.id,
            starts_at=start,
            ends_at=start + timedelta(hours=2),
        )
    )
    db.commit()

    response = client.get(f"/public/listings/{listing.id}")

    assert response.status_code == 404

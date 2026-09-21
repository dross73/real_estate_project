"""Integration tests for verified public-user listing engagement."""

from collections.abc import Generator
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.public_engagement import router as engagement_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models import Listing, ListingFavorite, RecentlyViewedListing, User
from app.db.session import get_db


@pytest.fixture()
def engagement_app() -> Generator[tuple[TestClient, Session], None, None]:
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
    app.include_router(engagement_router)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    try:
        yield TestClient(app), db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _user(
    db: Session,
    *,
    email: str,
    verified: bool = True,
) -> User:
    user = User(
        email=email,
        full_name="Public User",
        hashed_password="unused-in-these-tests",
        is_active=True,
        role="public_user",
        email_verified_at=(
            datetime.now(timezone.utc) if verified else None
        ),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers(email: str, role: str = "public_user") -> dict[str, str]:
    token = create_access_token(subject=email, role=role)
    return {"Authorization": f"Bearer {token}"}


def _listing(
    db: Session,
    *,
    title: str,
    is_public: bool = True,
    listing_status: str = "Active",
) -> Listing:
    listing = Listing(
        title=title,
        status=listing_status,
        is_public=is_public,
        is_featured=False,
        hide_exact_address=False,
        price=350000,
        property_type="Single Family",
        address="123 Test Street",
        city="Ames",
        state="IA",
        description="Test listing",
        sqft=1800,
        acreage=None,
        year_built=2005,
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
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def test_verified_user_can_favorite_and_unfavorite_own_listing(engagement_app):
    client, db = engagement_app
    user = _user(db, email="one@example.com")
    listing = _listing(db, title="Favorite Me")

    add = client.put(
        f"/public/account/favorites/{listing.id}",
        headers=_headers(user.email),
    )
    assert add.status_code == 200
    assert add.json()["is_favorite"] is True

    state = client.get(
        f"/public/account/favorites/{listing.id}",
        headers=_headers(user.email),
    )
    assert state.status_code == 200
    assert state.json()["is_favorite"] is True

    remove = client.delete(
        f"/public/account/favorites/{listing.id}",
        headers=_headers(user.email),
    )
    assert remove.status_code == 204

    state_after = client.get(
        f"/public/account/favorites/{listing.id}",
        headers=_headers(user.email),
    )
    assert state_after.json()["is_favorite"] is False


def test_favorites_are_scoped_to_authenticated_user(engagement_app):
    client, db = engagement_app
    user_one = _user(db, email="one@example.com")
    user_two = _user(db, email="two@example.com")
    listing = _listing(db, title="Private Favorite")

    db.add(ListingFavorite(user_id=user_one.id, listing_id=listing.id))
    db.commit()

    response = client.get(
        "/public/account/favorites",
        headers=_headers(user_two.email),
    )
    assert response.status_code == 200
    assert response.json()["items"] == []

    state = client.get(
        f"/public/account/favorites/{listing.id}",
        headers=_headers(user_two.email),
    )
    assert state.json()["is_favorite"] is False


def test_hidden_or_archived_favorites_are_not_returned_as_public_saved_homes(
    engagement_app,
):
    client, db = engagement_app
    user = _user(db, email="one@example.com")
    visible = _listing(db, title="Visible")
    archived = _listing(db, title="Archived", listing_status="Archived")
    private = _listing(db, title="Private", is_public=False)

    db.add_all(
        [
            ListingFavorite(user_id=user.id, listing_id=visible.id),
            ListingFavorite(user_id=user.id, listing_id=archived.id),
            ListingFavorite(user_id=user.id, listing_id=private.id),
        ]
    )
    db.commit()

    response = client.get(
        "/public/account/favorites",
        headers=_headers(user.email),
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [visible.id]


def test_recently_viewed_is_owned_and_ordered_by_latest_view(engagement_app):
    client, db = engagement_app
    user = _user(db, email="one@example.com")
    other = _user(db, email="two@example.com")
    first = _listing(db, title="First")
    second = _listing(db, title="Second")

    assert client.post(
        f"/public/account/recently-viewed/{first.id}",
        headers=_headers(user.email),
    ).status_code == 204
    assert client.post(
        f"/public/account/recently-viewed/{second.id}",
        headers=_headers(user.email),
    ).status_code == 204

    db.add(
        RecentlyViewedListing(
            user_id=other.id,
            listing_id=first.id,
            viewed_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    response = client.get(
        "/public/account/recently-viewed",
        headers=_headers(user.email),
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [
        second.id,
        first.id,
    ]


def test_unverified_public_user_cannot_use_engagement_endpoints(engagement_app):
    client, db = engagement_app
    user = _user(db, email="unverified@example.com", verified=False)
    listing = _listing(db, title="Protected")

    response = client.put(
        f"/public/account/favorites/{listing.id}",
        headers=_headers(user.email),
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Email verification required"


def test_non_public_listing_cannot_be_newly_favorited_or_recorded(engagement_app):
    client, db = engagement_app
    user = _user(db, email="one@example.com")
    listing = _listing(db, title="Hidden", is_public=False)

    favorite = client.put(
        f"/public/account/favorites/{listing.id}",
        headers=_headers(user.email),
    )
    viewed = client.post(
        f"/public/account/recently-viewed/{listing.id}",
        headers=_headers(user.email),
    )

    assert favorite.status_code == 404
    assert viewed.status_code == 404

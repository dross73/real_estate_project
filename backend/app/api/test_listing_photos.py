"""Integration tests for listing-photo upload API behavior."""

from collections.abc import Generator
from io import BytesIO

import pytest
from fastapi import FastAPI, UploadFile
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.api.listing_photos as listing_photos_api
from app.api.listing_photos import router as listing_photos_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models import Listing, ListingPhoto
from app.db.session import get_db
from app.services.image_processing import (
    ImageProcessingError,
    ProcessedListingImage,
)


class FakeStorage:
    """Return deterministic URLs and capture cleanup calls."""

    def __init__(self) -> None:
        self.deleted: list[str] = []

    def get_reference_url(self, key: str, *, expires_in=None) -> str:
        return f"https://media.example/{key}"

    def delete_object(self, key: str) -> None:
        self.deleted.append(key)


class FakeProcessor:
    """Return deterministic optimized keys without running Pillow."""

    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.calls: list[tuple[int, str | None]] = []

    def process_upload(self, *, listing_id, upload, storage):
        self.calls.append((listing_id, upload.filename))

        if self.error is not None:
            raise self.error

        suffix = len(self.calls)
        prefix = f"listings/{listing_id}/photos/fake-{suffix}"

        return ProcessedListingImage(
            original_filename=upload.filename or "upload",
            source_format="JPEG",
            width=1600,
            height=1000,
            thumbnail_key=f"{prefix}/thumbnail.webp",
            medium_key=f"{prefix}/medium.webp",
            large_key=f"{prefix}/large.webp",
        )


@pytest.fixture()
def photo_test_app() -> Generator[
    tuple[TestClient, Session, FakeStorage, FakeProcessor],
    None,
    None,
]:
    """Provide an isolated listing-photo API."""
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
    storage = FakeStorage()
    processor = FakeProcessor()

    app = FastAPI()
    app.include_router(listing_photos_router)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[listing_photos_api.get_object_storage] = lambda: storage
    app.dependency_overrides[listing_photos_api.get_image_processor] = (
        lambda: processor
    )

    try:
        yield TestClient(app), db, storage, processor
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _staff_headers() -> dict[str, str]:
    token = create_access_token(
        subject="staff@example.com",
        role="staff",
    )
    return {"Authorization": f"Bearer {token}"}


def _add_listing(db: Session) -> Listing:
    listing = Listing(
        title="Photo Test Listing",
        status="Draft",
        is_public=False,
        is_featured=False,
        hide_exact_address=False,
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
        amenities=[],
        mls_number=None,
        source_attribution=None,
        cover_image=None,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def _upload(client: TestClient, listing_id: int, filename: str = "photo.jpg"):
    return client.post(
        f"/listings/{listing_id}/photos",
        headers=_staff_headers(),
        files={"file": (filename, b"fake-image-bytes", "image/jpeg")},
    )


def test_first_successful_upload_becomes_primary(photo_test_app):
    """The gallery gets deterministic position zero and a default primary photo."""
    client, db, _, processor = photo_test_app
    listing = _add_listing(db)

    response = _upload(client, listing.id)

    assert response.status_code == 201
    payload = response.json()
    assert payload["position"] == 0
    assert payload["is_primary"] is True
    assert payload["thumbnail_url"].endswith("/thumbnail.webp")
    assert payload["medium_url"].endswith("/medium.webp")
    assert payload["large_url"].endswith("/large.webp")
    assert processor.calls == [(listing.id, "photo.jpg")]

    photo = db.query(ListingPhoto).one()
    assert photo.original_filename == "photo.jpg"
    assert photo.is_primary is True


def test_later_uploads_append_without_replacing_primary(photo_test_app):
    """Each request adds one photo and leaves primary selection independent."""
    client, db, _, _ = photo_test_app
    listing = _add_listing(db)

    first = _upload(client, listing.id, "one.jpg")
    second = _upload(client, listing.id, "two.jpg")

    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json()["position"] == 1
    assert second.json()["is_primary"] is False

    photos = (
        db.query(ListingPhoto)
        .filter(ListingPhoto.listing_id == listing.id)
        .order_by(ListingPhoto.position)
        .all()
    )
    assert [photo.position for photo in photos] == [0, 1]
    assert [photo.is_primary for photo in photos] == [True, False]


def test_gallery_endpoint_returns_photos_in_position_order(photo_test_app):
    """Frontend photo management can reload the current optimized gallery."""
    client, db, _, _ = photo_test_app
    listing = _add_listing(db)
    _upload(client, listing.id, "one.jpg")
    _upload(client, listing.id, "two.jpg")

    response = client.get(
        f"/listings/{listing.id}/photos",
        headers=_staff_headers(),
    )

    assert response.status_code == 200
    assert [item["position"] for item in response.json()] == [0, 1]


def test_missing_listing_is_rejected_before_processing(photo_test_app):
    """Bad listing IDs should not spend CPU/storage on image processing."""
    client, _, _, processor = photo_test_app

    response = _upload(client, 999)

    assert response.status_code == 404
    assert processor.calls == []


def test_invalid_image_error_is_returned_without_photo_record(photo_test_app):
    """Processor validation errors should become clear client errors."""
    client, db, _, processor = photo_test_app
    listing = _add_listing(db)
    processor.error = ImageProcessingError("Uploaded file is not a valid image")

    response = _upload(client, listing.id)

    assert response.status_code == 400
    assert response.json()["detail"] == "Uploaded file is not a valid image"
    assert db.query(ListingPhoto).count() == 0


def test_backend_enforces_hard_listing_photo_limit(photo_test_app):
    """The frontend count check is helpful, but the backend is authoritative."""
    client, db, _, processor = photo_test_app
    listing = _add_listing(db)

    for position in range(listing_photos_api.settings.LISTING_PHOTO_MAX_COUNT):
        db.add(
            ListingPhoto(
                listing_id=listing.id,
                original_filename=f"{position}.jpg",
                source_format="JPEG",
                width=1000,
                height=700,
                thumbnail_key=f"photos/{position}/thumbnail.webp",
                medium_key=f"photos/{position}/medium.webp",
                large_key=f"photos/{position}/large.webp",
                position=position,
                is_primary=position == 0,
            )
        )
    db.commit()

    response = _upload(client, listing.id)

    assert response.status_code == 409
    assert "photo limit reached" in response.json()["detail"].lower()
    assert processor.calls == []

"""Integration tests for listing documents, virtual tours, and privacy."""

from collections.abc import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.api.listing_documents as listing_documents_api
from app.api.listing_documents import (
    admin_router as listing_documents_router,
    public_router as public_listing_documents_router,
)
from app.api.public_listings import router as public_listings_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models import Listing, ListingDocument
from app.db.session import get_db


class FakeStorage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.deleted: list[str] = []

    def upload_fileobj(
        self,
        key,
        fileobj,
        *,
        content_type,
        cache_control=None,
        metadata=None,
    ):
        self.objects[key] = fileobj.read()
        return key

    def get_reference_url(self, key, *, expires_in=None):
        return f"https://media.example/{key}"

    def delete_object(self, key):
        self.deleted.append(key)
        self.objects.pop(key, None)


@pytest.fixture()
def document_app() -> Generator[tuple[TestClient, Session, FakeStorage], None, None]:
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

    app = FastAPI()
    app.include_router(listing_documents_router)
    app.include_router(public_listing_documents_router)
    app.include_router(public_listings_router)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[
        listing_documents_api.get_object_storage
    ] = lambda: storage

    try:
        yield TestClient(app), db, storage
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _headers(role: str = "staff") -> dict[str, str]:
    token = create_access_token(
        subject=f"{role}@example.com",
        role=role,
    )
    return {"Authorization": f"Bearer {token}"}


def _listing(
    db: Session,
    *,
    hide_exact_address: bool = False,
    virtual_tour_url: str | None = None,
) -> Listing:
    listing = Listing(
        title="Media Test Home",
        status="Active",
        is_public=True,
        is_featured=False,
        hide_exact_address=hide_exact_address,
        price=425000,
        property_type="Single Family",
        address="123 Main St",
        city="Ames",
        state="IA",
        bedrooms=3,
        bathrooms=2.0,
        amenities=[],
        virtual_tour_url=virtual_tour_url,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def _upload_pdf(
    client: TestClient,
    listing_id: int,
    *,
    title: str = "Feature Sheet",
    public: bool = True,
):
    return client.post(
        f"/listings/{listing_id}/documents",
        headers=_headers(),
        data={
            "title": title,
            "is_public": str(public).lower(),
        },
        files={
            "file": (
                "feature-sheet.pdf",
                b"%PDF-1.4\nfake document",
                "application/pdf",
            )
        },
    )


def test_staff_can_upload_publish_and_delete_pdf(document_app):
    client, db, storage = document_app
    listing = _listing(db)

    created = _upload_pdf(client, listing.id)

    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "Feature Sheet"
    assert body["is_public"] is True
    assert body["download_url"].startswith("https://media.example/")
    assert len(storage.objects) == 1

    internal = client.get(
        f"/listings/{listing.id}/documents",
        headers=_headers(),
    )
    assert internal.status_code == 200
    assert [item["id"] for item in internal.json()] == [body["id"]]

    public = client.get(f"/public/listings/{listing.id}/documents")
    assert public.status_code == 200
    assert public.json()[0]["title"] == "Feature Sheet"
    assert "is_public" not in public.json()[0]

    hidden = client.patch(
        f"/listings/{listing.id}/documents/{body['id']}",
        headers=_headers("admin"),
        json={"is_public": False},
    )
    assert hidden.status_code == 200
    assert hidden.json()["is_public"] is False

    public_after_hide = client.get(
        f"/public/listings/{listing.id}/documents",
    )
    assert public_after_hide.status_code == 200
    assert public_after_hide.json() == []

    deleted = client.delete(
        f"/listings/{listing.id}/documents/{body['id']}",
        headers=_headers(),
    )
    assert deleted.status_code == 204
    assert db.query(ListingDocument).count() == 0
    assert len(storage.deleted) == 1


def test_document_upload_rejects_non_pdf_content(document_app):
    client, db, storage = document_app
    listing = _listing(db)

    response = client.post(
        f"/listings/{listing.id}/documents",
        headers=_headers(),
        data={"title": "Not really a PDF", "is_public": "true"},
        files={
            "file": (
                "fake.pdf",
                b"plain text",
                "application/pdf",
            )
        },
    )

    assert response.status_code == 400
    assert db.query(ListingDocument).count() == 0
    assert storage.objects == {}


def test_public_listing_keeps_tour_but_hides_exact_address(document_app):
    client, db, _ = document_app
    listing = _listing(
        db,
        hide_exact_address=True,
        virtual_tour_url="https://my.matterport.com/show/?m=example",
    )

    response = client.get(f"/public/listings/{listing.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["address"] is None
    assert body["city"] == "Ames"
    assert body["state"] == "IA"
    assert body["virtual_tour_url"].startswith(
        "https://my.matterport.com/"
    )


def test_public_documents_require_an_eligible_public_listing(document_app):
    client, db, _ = document_app
    listing = _listing(db)
    document = ListingDocument(
        listing_id=listing.id,
        title="Brochure",
        original_filename="brochure.pdf",
        content_type="application/pdf",
        file_size=100,
        object_key=f"listings/{listing.id}/documents/brochure.pdf",
        is_public=True,
    )
    db.add(document)
    listing.is_public = False
    db.commit()

    response = client.get(f"/public/listings/{listing.id}/documents")

    assert response.status_code == 404

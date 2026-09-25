"""Listing-document upload, visibility, and public download metadata."""

from pathlib import PurePath
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Listing, ListingDocument
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_staff_or_admin
from app.schemas.listing_document import (
    ListingDocumentRead,
    ListingDocumentUpdate,
    PublicListingDocumentRead,
)
from app.services.audit import record_audit_event
from app.services.object_storage import (
    ObjectStorageConfigurationError,
    ObjectStorageError,
    ObjectStorageService,
    create_media_storage,
)


admin_router = APIRouter(
    prefix="/listings",
    tags=["Listing Documents"],
    dependencies=[Depends(require_staff_or_admin)],
)
public_router = APIRouter(
    prefix="/public/listings",
    tags=["Public Listing Documents"],
)
settings = get_settings()
PUBLIC_LISTING_STATUSES = ("Active", "Pending", "Sold")


def get_object_storage() -> ObjectStorageService:
    return create_media_storage()


def _get_listing(db: Session, listing_id: int) -> Listing:
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )
    return listing


def _get_document(
    db: Session,
    listing_id: int,
    document_id: int,
) -> ListingDocument:
    document = (
        db.query(ListingDocument)
        .filter(
            ListingDocument.id == document_id,
            ListingDocument.listing_id == listing_id,
        )
        .first()
    )
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing document not found",
        )
    return document


def _file_size(upload: UploadFile) -> int:
    current = upload.file.tell()
    upload.file.seek(0, 2)
    size = upload.file.tell()
    upload.file.seek(current)
    return size


def _validate_pdf(upload: UploadFile) -> int:
    filename = (upload.filename or "").strip()
    extension = PurePath(filename).suffix.lower()
    if extension != ".pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Listing documents must be PDF files",
        )

    if upload.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Listing document content type must be PDF",
        )

    size = _file_size(upload)
    if size <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Listing document cannot be empty",
        )
    if size > settings.DOCUMENT_UPLOAD_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Listing document exceeds the upload size limit",
        )

    upload.file.seek(0)
    signature = upload.file.read(5)
    upload.file.seek(0)
    if signature != b"%PDF-":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Listing document content is not a valid PDF",
        )

    return size


def _document_response(
    document: ListingDocument,
    storage: ObjectStorageService,
) -> ListingDocumentRead:
    return ListingDocumentRead(
        id=document.id,
        listing_id=document.listing_id,
        title=document.title,
        original_filename=document.original_filename,
        content_type=document.content_type,
        file_size=document.file_size,
        is_public=document.is_public,
        download_url=storage.get_reference_url(document.object_key),
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def _public_document_response(
    document: ListingDocument,
    storage: ObjectStorageService,
) -> PublicListingDocumentRead:
    return PublicListingDocumentRead(
        id=document.id,
        title=document.title,
        original_filename=document.original_filename,
        content_type=document.content_type,
        file_size=document.file_size,
        download_url=storage.get_reference_url(document.object_key),
    )


@admin_router.get(
    "/{listing_id}/documents",
    response_model=list[ListingDocumentRead],
)
def list_listing_documents(
    listing_id: int,
    db: Session = Depends(get_db),
    storage: ObjectStorageService = Depends(get_object_storage),
) -> list[ListingDocumentRead]:
    _get_listing(db, listing_id)
    documents = (
        db.query(ListingDocument)
        .filter(ListingDocument.listing_id == listing_id)
        .order_by(ListingDocument.created_at.asc(), ListingDocument.id.asc())
        .all()
    )

    try:
        return [_document_response(document, storage) for document in documents]
    except ObjectStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing document storage is unavailable",
        ) from exc


@admin_router.post(
    "/{listing_id}/documents",
    response_model=ListingDocumentRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_listing_document(
    listing_id: int,
    title: str = Form(..., min_length=1, max_length=160),
    is_public: bool = Form(True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    storage: ObjectStorageService = Depends(get_object_storage),
    actor_email: str = Depends(require_staff_or_admin),
) -> ListingDocumentRead:
    _get_listing(db, listing_id)
    file_size = _validate_pdf(file)
    normalized_title = title.strip()
    if not normalized_title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document title cannot be blank",
        )

    filename = PurePath(
        (file.filename or "document.pdf").strip()
    ).name[:255]
    key = f"listings/{listing_id}/documents/{uuid4().hex}.pdf"

    try:
        stored_key = storage.upload_fileobj(
            key,
            file.file,
            content_type="application/pdf",
            metadata={
                "listing_id": str(listing_id),
                "original_filename": filename,
            },
        )
    except ObjectStorageConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing document storage is not configured",
        ) from exc
    except ObjectStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing document storage is unavailable",
        ) from exc

    document = ListingDocument(
        listing_id=listing_id,
        title=normalized_title,
        original_filename=filename,
        content_type="application/pdf",
        file_size=file_size,
        object_key=stored_key,
        is_public=is_public,
    )

    try:
        db.add(document)
        db.flush()
        record_audit_event(
            db,
            actor_email=actor_email,
            action="listing.document_uploaded",
            target_type="listing",
            target_id=listing_id,
            details={
                "document_id": document.id,
                "title": document.title,
                "is_public": document.is_public,
            },
        )
        db.commit()
        db.refresh(document)
    except SQLAlchemyError as exc:
        db.rollback()
        try:
            storage.delete_object(stored_key)
        except ObjectStorageError:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save listing document",
        ) from exc

    try:
        return _document_response(document, storage)
    except ObjectStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing document storage is unavailable",
        ) from exc


@admin_router.patch(
    "/{listing_id}/documents/{document_id}",
    response_model=ListingDocumentRead,
)
def update_listing_document(
    listing_id: int,
    document_id: int,
    payload: ListingDocumentUpdate,
    db: Session = Depends(get_db),
    storage: ObjectStorageService = Depends(get_object_storage),
    actor_email: str = Depends(require_staff_or_admin),
) -> ListingDocumentRead:
    _get_listing(db, listing_id)
    document = _get_document(db, listing_id, document_id)
    changes = payload.model_dump(exclude_unset=True)

    if "title" in changes and changes["title"] is not None:
        document.title = changes["title"].strip()
    if "is_public" in changes and changes["is_public"] is not None:
        document.is_public = changes["is_public"]

    record_audit_event(
        db,
        actor_email=actor_email,
        action="listing.document_updated",
        target_type="listing",
        target_id=listing_id,
        details={
            "document_id": document.id,
            "changed_fields": sorted(changes.keys()),
        },
    )
    db.commit()
    db.refresh(document)

    try:
        return _document_response(document, storage)
    except ObjectStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing document storage is unavailable",
        ) from exc


@admin_router.delete(
    "/{listing_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_listing_document(
    listing_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    storage: ObjectStorageService = Depends(get_object_storage),
    actor_email: str = Depends(require_staff_or_admin),
) -> None:
    _get_listing(db, listing_id)
    document = _get_document(db, listing_id, document_id)
    object_key = document.object_key

    record_audit_event(
        db,
        actor_email=actor_email,
        action="listing.document_deleted",
        target_type="listing",
        target_id=listing_id,
        details={
            "document_id": document.id,
            "title": document.title,
        },
    )
    db.delete(document)
    db.commit()

    try:
        storage.delete_object(object_key)
    except ObjectStorageError:
        pass


@public_router.get(
    "/{listing_id}/documents",
    response_model=list[PublicListingDocumentRead],
)
def list_public_listing_documents(
    listing_id: int,
    db: Session = Depends(get_db),
    storage: ObjectStorageService = Depends(get_object_storage),
) -> list[PublicListingDocumentRead]:
    listing = (
        db.query(Listing)
        .filter(
            Listing.id == listing_id,
            Listing.is_public.is_(True),
            Listing.status.in_(PUBLIC_LISTING_STATUSES),
        )
        .first()
    )
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    documents = (
        db.query(ListingDocument)
        .filter(
            ListingDocument.listing_id == listing_id,
            ListingDocument.is_public.is_(True),
        )
        .order_by(ListingDocument.created_at.asc(), ListingDocument.id.asc())
        .all()
    )

    try:
        return [
            _public_document_response(document, storage)
            for document in documents
        ]
    except ObjectStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing document storage is unavailable",
        ) from exc

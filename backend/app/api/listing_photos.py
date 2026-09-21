"""Internal listing-photo upload, read, and management endpoints."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Listing, ListingPhoto
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_staff_or_admin
from app.schemas.photo import (
    ListingPhotoRead,
    ListingPhotoReorder,
    ListingPhotoUploadSettingsRead,
)
from app.services.image_processing import (
    ImageProcessingError,
    ListingImageProcessor,
)
from app.services.audit import record_audit_event
from app.services.object_storage import (
    ObjectStorageConfigurationError,
    ObjectStorageError,
    ObjectStorageService,
)


router = APIRouter(
    prefix="/listings",
    tags=["Listing Photos"],
    dependencies=[Depends(require_staff_or_admin)],
)
settings = get_settings()


def get_object_storage() -> ObjectStorageService:
    """Create the configured durable object-storage service."""
    return ObjectStorageService()


def get_image_processor() -> ListingImageProcessor:
    """Create the configured one-at-a-time listing image processor."""
    return ListingImageProcessor()


def _photo_response(
    photo: ListingPhoto,
    storage: ObjectStorageService,
) -> ListingPhotoRead:
    """Build API photo metadata without exposing raw storage credentials."""
    return ListingPhotoRead(
        id=photo.id,
        listing_id=photo.listing_id,
        original_filename=photo.original_filename,
        source_format=photo.source_format,
        width=photo.width,
        height=photo.height,
        position=photo.position,
        is_primary=photo.is_primary,
        thumbnail_url=storage.get_reference_url(photo.thumbnail_key),
        medium_url=storage.get_reference_url(photo.medium_key),
        large_url=storage.get_reference_url(photo.large_key),
        created_at=photo.created_at,
        updated_at=photo.updated_at,
    )


@router.get(
    "/photo-upload-settings",
    response_model=ListingPhotoUploadSettingsRead,
    status_code=status.HTTP_200_OK,
)
def get_listing_photo_upload_settings() -> ListingPhotoUploadSettingsRead:
    """Return non-secret upload limits used by the admin photo queue."""
    return ListingPhotoUploadSettingsRead(
        max_photos=settings.LISTING_PHOTO_MAX_COUNT,
        max_file_bytes=settings.IMAGE_UPLOAD_MAX_BYTES,
        accepted_extensions=[".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"],
    )


@router.get(
    "/{listing_id}/photos",
    response_model=list[ListingPhotoRead],
    status_code=status.HTTP_200_OK,
)
def list_listing_photos(
    listing_id: int,
    db: Session = Depends(get_db),
    storage: ObjectStorageService = Depends(get_object_storage),
) -> list[ListingPhotoRead]:
    """Return the current optimized photo gallery for one listing."""
    listing_exists = (
        db.query(Listing.id)
        .filter(Listing.id == listing_id)
        .first()
    )
    if listing_exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    photos = (
        db.query(ListingPhoto)
        .filter(ListingPhoto.listing_id == listing_id)
        .order_by(ListingPhoto.position.asc(), ListingPhoto.id.asc())
        .all()
    )

    try:
        return [_photo_response(photo, storage) for photo in photos]
    except ObjectStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing media storage is unavailable",
        ) from exc


@router.post(
    "/{listing_id}/photos",
    response_model=ListingPhotoRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_listing_photo(
    listing_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    storage: ObjectStorageService = Depends(get_object_storage),
    processor: ListingImageProcessor = Depends(get_image_processor),
    actor_email: str = Depends(require_staff_or_admin),
) -> ListingPhotoRead:
    """Process and persist one photo; clients can queue several requests."""
    # Serialize photo writes per listing so concurrent client uploads cannot
    # claim the same position or exceed the configured count together.
    listing = (
        db.query(Listing)
        .filter(Listing.id == listing_id)
        .with_for_update()
        .first()
    )
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    current_count = (
        db.query(ListingPhoto)
        .filter(ListingPhoto.listing_id == listing_id)
        .count()
    )
    if current_count >= settings.LISTING_PHOTO_MAX_COUNT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Listing photo limit reached "
                f"({settings.LISTING_PHOTO_MAX_COUNT})"
            ),
        )

    try:
        processed = processor.process_upload(
            listing_id=listing_id,
            upload=file,
            storage=storage,
        )
    except ImageProcessingError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except ObjectStorageConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing media storage is not configured",
        ) from exc
    except ObjectStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing media storage is unavailable",
        ) from exc

    max_position = (
        db.query(func.max(ListingPhoto.position))
        .filter(ListingPhoto.listing_id == listing_id)
        .scalar()
    )
    next_position = 0 if max_position is None else int(max_position) + 1

    photo = ListingPhoto(
        listing_id=listing_id,
        original_filename=processed.original_filename,
        source_format=processed.source_format,
        width=processed.width,
        height=processed.height,
        thumbnail_key=processed.thumbnail_key,
        medium_key=processed.medium_key,
        large_key=processed.large_key,
        position=next_position,
        is_primary=current_count == 0,
    )

    try:
        db.add(photo)
        db.flush()

        record_audit_event(
            db,
            actor_email=actor_email,
            action="listing.photo_uploaded",
            target_type="listing",
            target_id=listing_id,
            details={
                "photo_id": photo.id,
                "filename": photo.original_filename,
                "position": photo.position,
                "is_primary": photo.is_primary,
            },
        )

        db.commit()
        db.refresh(photo)
    except SQLAlchemyError as exc:
        db.rollback()

        # Database failure must not leave permanent media without a record.
        for key in processed.object_keys:
            try:
                storage.delete_object(key)
            except ObjectStorageError:
                pass

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save listing photo",
        ) from exc

    try:
        return _photo_response(photo, storage)
    except ObjectStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing media storage is unavailable",
        ) from exc


@router.put(
    "/{listing_id}/photos/order",
    response_model=list[ListingPhotoRead],
    status_code=status.HTTP_200_OK,
)
def reorder_listing_photos(
    listing_id: int,
    payload: ListingPhotoReorder,
    db: Session = Depends(get_db),
    storage: ObjectStorageService = Depends(get_object_storage),
    actor_email: str = Depends(require_staff_or_admin),
) -> list[ListingPhotoRead]:
    """Persist a complete gallery order while keeping primary selection separate."""
    listing = (
        db.query(Listing)
        .filter(Listing.id == listing_id)
        .with_for_update()
        .first()
    )
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    photos = (
        db.query(ListingPhoto)
        .filter(ListingPhoto.listing_id == listing_id)
        .order_by(ListingPhoto.position.asc(), ListingPhoto.id.asc())
        .with_for_update()
        .all()
    )

    current_ids = [photo.id for photo in photos]
    if len(payload.photo_ids) != len(current_ids) or set(payload.photo_ids) != set(current_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo order must contain every current listing photo exactly once",
        )

    by_id = {photo.id: photo for photo in photos}

    try:
        # Move every row to a temporary unique position first so swapping two
        # positions never violates the listing/position unique constraint.
        for temporary_position, photo in enumerate(photos, start=1):
            photo.position = -temporary_position
        db.flush()

        ordered = [by_id[photo_id] for photo_id in payload.photo_ids]
        for position, photo in enumerate(ordered):
            photo.position = position
        db.flush()

        record_audit_event(
            db,
            actor_email=actor_email,
            action="listing.photos_reordered",
            target_type="listing",
            target_id=listing_id,
            details={"photo_ids": payload.photo_ids},
        )
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to reorder listing photos",
        ) from exc

    try:
        return [_photo_response(photo, storage) for photo in ordered]
    except ObjectStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing media storage is unavailable",
        ) from exc


@router.patch(
    "/{listing_id}/photos/{photo_id}/primary",
    response_model=ListingPhotoRead,
    status_code=status.HTTP_200_OK,
)
def set_primary_listing_photo(
    listing_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    storage: ObjectStorageService = Depends(get_object_storage),
    actor_email: str = Depends(require_staff_or_admin),
) -> ListingPhotoRead:
    """Select one primary photo without changing gallery order."""
    listing = (
        db.query(Listing)
        .filter(Listing.id == listing_id)
        .with_for_update()
        .first()
    )
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    photos = (
        db.query(ListingPhoto)
        .filter(ListingPhoto.listing_id == listing_id)
        .with_for_update()
        .all()
    )
    target = next((photo for photo in photos if photo.id == photo_id), None)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing photo not found",
        )

    try:
        for photo in photos:
            photo.is_primary = photo.id == photo_id

        record_audit_event(
            db,
            actor_email=actor_email,
            action="listing.photo_primary_changed",
            target_type="listing",
            target_id=listing_id,
            details={"photo_id": photo_id},
        )
        db.commit()
        db.refresh(target)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update primary listing photo",
        ) from exc

    try:
        return _photo_response(target, storage)
    except ObjectStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing media storage is unavailable",
        ) from exc


@router.delete(
    "/{listing_id}/photos/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_listing_photo(
    listing_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    storage: ObjectStorageService = Depends(get_object_storage),
    actor_email: str = Depends(require_staff_or_admin),
) -> None:
    """Delete one photo and keep gallery positions/primary selection valid."""
    listing = (
        db.query(Listing)
        .filter(Listing.id == listing_id)
        .with_for_update()
        .first()
    )
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    photos = (
        db.query(ListingPhoto)
        .filter(ListingPhoto.listing_id == listing_id)
        .order_by(ListingPhoto.position.asc(), ListingPhoto.id.asc())
        .with_for_update()
        .all()
    )
    target = next((photo for photo in photos if photo.id == photo_id), None)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing photo not found",
        )

    old_keys = (target.thumbnail_key, target.medium_key, target.large_key)
    was_primary = target.is_primary
    remaining = [photo for photo in photos if photo.id != photo_id]

    try:
        db.delete(target)
        db.flush()

        for temporary_position, photo in enumerate(remaining, start=1):
            photo.position = -temporary_position
        db.flush()

        for position, photo in enumerate(remaining):
            photo.position = position
            if was_primary:
                photo.is_primary = position == 0
        db.flush()

        record_audit_event(
            db,
            actor_email=actor_email,
            action="listing.photo_deleted",
            target_type="listing",
            target_id=listing_id,
            details={"photo_id": photo_id, "was_primary": was_primary},
        )
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to delete listing photo",
        ) from exc

    # Database state is authoritative. Cleanup afterward avoids leaving a
    # database record pointing to objects that were deleted before commit.
    for key in old_keys:
        try:
            storage.delete_object(key)
        except ObjectStorageError:
            pass


@router.put(
    "/{listing_id}/photos/{photo_id}/replace",
    response_model=ListingPhotoRead,
    status_code=status.HTTP_200_OK,
)
def replace_listing_photo(
    listing_id: int,
    photo_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    storage: ObjectStorageService = Depends(get_object_storage),
    processor: ListingImageProcessor = Depends(get_image_processor),
    actor_email: str = Depends(require_staff_or_admin),
) -> ListingPhotoRead:
    """Process a replacement before retiring the old optimized objects."""
    listing = (
        db.query(Listing)
        .filter(Listing.id == listing_id)
        .with_for_update()
        .first()
    )
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    photo = (
        db.query(ListingPhoto)
        .filter(
            ListingPhoto.listing_id == listing_id,
            ListingPhoto.id == photo_id,
        )
        .with_for_update()
        .first()
    )
    if photo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing photo not found",
        )

    old_keys = (photo.thumbnail_key, photo.medium_key, photo.large_key)

    try:
        processed = processor.process_upload(
            listing_id=listing_id,
            upload=file,
            storage=storage,
        )
    except ImageProcessingError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except ObjectStorageConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing media storage is not configured",
        ) from exc
    except ObjectStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing media storage is unavailable",
        ) from exc

    photo.original_filename = processed.original_filename
    photo.source_format = processed.source_format
    photo.width = processed.width
    photo.height = processed.height
    photo.thumbnail_key = processed.thumbnail_key
    photo.medium_key = processed.medium_key
    photo.large_key = processed.large_key

    try:
        record_audit_event(
            db,
            actor_email=actor_email,
            action="listing.photo_replaced",
            target_type="listing",
            target_id=listing_id,
            details={
                "photo_id": photo_id,
                "filename": processed.original_filename,
                "position": photo.position,
                "is_primary": photo.is_primary,
            },
        )
        db.commit()
        db.refresh(photo)
    except SQLAlchemyError as exc:
        db.rollback()

        # A failed metadata swap must not leak the newly processed objects.
        for key in processed.object_keys:
            try:
                storage.delete_object(key)
            except ObjectStorageError:
                pass

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to replace listing photo",
        ) from exc

    # Only after the new metadata is committed is it safe to retire old files.
    for key in old_keys:
        try:
            storage.delete_object(key)
        except ObjectStorageError:
            pass

    try:
        return _photo_response(photo, storage)
    except ObjectStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Listing media storage is unavailable",
        ) from exc

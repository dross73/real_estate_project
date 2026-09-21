"""Internal listing CRUD API used by authenticated staff and administrators."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.models import Listing
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_staff_or_admin
from app.schemas.listing import (
    ListingCreate,
    ListingPreviewRead,
    ListingRead,
    ListingUpdate,
    PaginatedListingRead,
)
from app.services.audit import record_audit_event
from app.services.saved_search_alerts import process_saved_search_alerts


router = APIRouter(prefix="/listings", tags=["Listings"])
internal_access = [Depends(require_staff_or_admin)]
INTERNAL_ONLY_LISTING_STATUSES = ("Draft", "Archived")


@router.get(
    "",
    response_model=PaginatedListingRead,
    status_code=status.HTTP_200_OK,
    dependencies=internal_access,
)
def list_listings(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedListingRead:
    """Return a paginated internal listing directory."""
    offset = (page - 1) * per_page

    rows = db.query(Listing).offset(offset).limit(per_page).all()
    items = [ListingRead.model_validate(row) for row in rows]
    total = db.query(Listing).count()

    return PaginatedListingRead(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get(
    "/{listing_id}",
    response_model=ListingRead,
    status_code=status.HTTP_200_OK,
    dependencies=internal_access,
)
def get_listing(
    listing_id: int,
    db: Session = Depends(get_db),
) -> ListingRead:
    """Return one listing for the internal admin application."""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()

    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    return ListingRead.model_validate(listing)


@router.get(
    "/{listing_id}/preview",
    response_model=ListingPreviewRead,
    status_code=status.HTTP_200_OK,
    dependencies=internal_access,
)
def preview_listing(
    listing_id: int,
    db: Session = Depends(get_db),
) -> ListingPreviewRead:
    """Return a public-facing preview even when a listing is internal-only."""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()

    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    data = ListingRead.model_validate(listing).model_dump()
    data.pop("is_public", None)

    if listing.hide_exact_address:
        data["address"] = None

    return ListingPreviewRead.model_validate(data)


@router.post(
    "",
    response_model=ListingRead,
    status_code=status.HTTP_201_CREATED,
)
def create_listing(
    payload: ListingCreate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_staff_or_admin),
) -> ListingRead:
    """Create a validated real estate listing and record the action."""
    now = datetime.now(timezone.utc)
    listing = Listing(
        **payload.model_dump(),
        created_at=now,
        updated_at=now,
    )

    if listing.status in INTERNAL_ONLY_LISTING_STATUSES:
        listing.is_public = False

    db.add(listing)
    db.flush()

    record_audit_event(
        db,
        actor_email=actor_email,
        action="listing.created",
        target_type="listing",
        target_id=listing.id,
        details={
            "title": listing.title,
            "status": listing.status,
            "is_public": listing.is_public,
        },
    )

    if listing.status == "Active":
        record_audit_event(
            db,
            actor_email=actor_email,
            action="listing.published",
            target_type="listing",
            target_id=listing.id,
            details={"status": listing.status},
        )

    if listing.is_public:
        record_audit_event(
            db,
            actor_email=actor_email,
            action="listing.shown_publicly",
            target_type="listing",
            target_id=listing.id,
            details={"is_public": True},
        )

    db.commit()
    db.refresh(listing)

    if listing.is_public and listing.status in ("Active", "Pending", "Sold"):
        process_saved_search_alerts(
            db,
            only_immediate=True,
            listing_id=listing.id,
        )

    return ListingRead.model_validate(listing)


@router.put(
    "/{listing_id}",
    response_model=ListingRead,
    status_code=status.HTTP_200_OK,
)
def update_listing(
    listing_id: int,
    payload: ListingUpdate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_staff_or_admin),
) -> ListingRead:
    """Update supplied listing fields and record lifecycle/visibility changes."""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()

    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    changes = payload.model_dump(exclude_unset=True)
    previous_status = listing.status
    previous_public = listing.is_public
    was_publicly_eligible = (
        previous_public and previous_status in ("Active", "Pending", "Sold")
    )

    for key, value in changes.items():
        setattr(listing, key, value)

    if listing.status in INTERNAL_ONLY_LISTING_STATUSES:
        listing.is_public = False

    listing.updated_at = datetime.now(timezone.utc)

    record_audit_event(
        db,
        actor_email=actor_email,
        action="listing.updated",
        target_type="listing",
        target_id=listing.id,
        details={"changed_fields": sorted(changes.keys())},
    )

    if previous_status != listing.status and listing.status == "Active":
        record_audit_event(
            db,
            actor_email=actor_email,
            action="listing.published",
            target_type="listing",
            target_id=listing.id,
            details={
                "from_status": previous_status,
                "to_status": listing.status,
            },
        )

    if previous_status != listing.status and listing.status == "Archived":
        record_audit_event(
            db,
            actor_email=actor_email,
            action="listing.archived",
            target_type="listing",
            target_id=listing.id,
            details={
                "from_status": previous_status,
                "to_status": listing.status,
            },
        )

    if previous_public is False and listing.is_public is True:
        record_audit_event(
            db,
            actor_email=actor_email,
            action="listing.shown_publicly",
            target_type="listing",
            target_id=listing.id,
            details={"is_public": True},
        )

    if previous_public is True and listing.is_public is False:
        record_audit_event(
            db,
            actor_email=actor_email,
            action="listing.hidden",
            target_type="listing",
            target_id=listing.id,
            details={"is_public": False},
        )

    db.commit()
    db.refresh(listing)

    is_publicly_eligible = (
        listing.is_public and listing.status in ("Active", "Pending", "Sold")
    )
    if not was_publicly_eligible and is_publicly_eligible:
        process_saved_search_alerts(
            db,
            only_immediate=True,
            listing_id=listing.id,
        )

    return ListingRead.model_validate(listing)


@router.delete(
    "/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_staff_or_admin),
) -> Response:
    """Delete a listing and preserve its audit record."""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()

    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    record_audit_event(
        db,
        actor_email=actor_email,
        action="listing.deleted",
        target_type="listing",
        target_id=listing.id,
        details={
            "title": listing.title,
            "status": listing.status,
        },
    )

    db.delete(listing)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)

"""Internal listing CRUD API used by authenticated staff and administrators."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.models import Listing
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_staff_or_admin
from app.schemas.listing import (
    ListingCreate,
    ListingRead,
    ListingUpdate,
    PaginatedListingRead,
)


router = APIRouter(prefix="/listings", tags=["Listings"])
internal_access = [Depends(require_staff_or_admin)]


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


@router.post(
    "",
    response_model=ListingRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=internal_access,
)
def create_listing(
    payload: ListingCreate,
    db: Session = Depends(get_db),
) -> ListingRead:
    """Create a validated real estate listing."""
    now = datetime.now(timezone.utc)
    listing = Listing(
        **payload.model_dump(),
        created_at=now,
        updated_at=now,
    )

    db.add(listing)
    db.commit()
    db.refresh(listing)

    return ListingRead.model_validate(listing)


@router.put(
    "/{listing_id}",
    response_model=ListingRead,
    status_code=status.HTTP_200_OK,
    dependencies=internal_access,
)
def update_listing(
    listing_id: int,
    payload: ListingUpdate,
    db: Session = Depends(get_db),
) -> ListingRead:
    """Update only the listing fields supplied by staff/admin."""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()

    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(listing, key, value)

    listing.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(listing)

    return ListingRead.model_validate(listing)


@router.delete(
    "/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=internal_access,
)
def delete_listing(
    listing_id: int,
    db: Session = Depends(get_db),
) -> Response:
    """Delete a listing from the internal management system."""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()

    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    db.delete(listing)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)

"""Anonymous public-safe listing read endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Query as SqlAlchemyQuery
from sqlalchemy.orm import Session

from app.db.models import Listing
from app.db.session import get_db
from app.schemas.listing import (
    ListingRead,
    PaginatedPublicListingRead,
    PublicListingRead,
)


router = APIRouter(prefix="/public/listings", tags=["Public Listings"])

PUBLIC_LISTING_STATUSES = ("Active", "Pending", "Sold")


def _eligible_public_listings(db: Session) -> SqlAlchemyQuery:
    """Return the shared visibility/lifecycle query for every public endpoint."""
    return db.query(Listing).filter(
        Listing.is_public.is_(True),
        Listing.status.in_(PUBLIC_LISTING_STATUSES),
    )


def _serialize_public_listing(listing: Listing) -> PublicListingRead:
    """Convert an internal listing into a response safe for anonymous visitors."""
    data = ListingRead.model_validate(listing).model_dump()

    # Public callers never need the internal visibility switch itself.
    data.pop("is_public", None)

    # Address privacy is enforced by the API, not left to frontend presentation.
    if listing.hide_exact_address:
        data["address"] = None

    return PublicListingRead.model_validate(data)


@router.get(
    "",
    response_model=PaginatedPublicListingRead,
    status_code=status.HTTP_200_OK,
)
def list_public_listings(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedPublicListingRead:
    """Return only listings currently eligible for anonymous public browsing."""
    query = _eligible_public_listings(db)
    total = query.count()
    offset = (page - 1) * per_page

    rows = (
        query.order_by(Listing.id.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )

    return PaginatedPublicListingRead(
        items=[_serialize_public_listing(row) for row in rows],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get(
    "/featured",
    response_model=list[PublicListingRead],
    status_code=status.HTTP_200_OK,
)
def list_featured_public_listings(
    limit: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db),
) -> list[PublicListingRead]:
    """Return eligible featured listings for homepage placement."""
    rows = (
        _eligible_public_listings(db)
        .filter(Listing.is_featured.is_(True))
        .order_by(Listing.id.desc())
        .limit(limit)
        .all()
    )

    return [_serialize_public_listing(row) for row in rows]


@router.get(
    "/{listing_id}",
    response_model=PublicListingRead,
    status_code=status.HTTP_200_OK,
)
def get_public_listing(
    listing_id: int,
    db: Session = Depends(get_db),
) -> PublicListingRead:
    """Return one listing only when it is currently public-eligible."""
    listing = (
        _eligible_public_listings(db)
        .filter(Listing.id == listing_id)
        .first()
    )

    if listing is None:
        # Use the same response for nonexistent and non-public listings.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    return _serialize_public_listing(listing)

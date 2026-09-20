"""Anonymous public listing queries and real-estate search filters."""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Query as SqlAlchemyQuery
from sqlalchemy.orm import Session

from app.db.models import Listing
from app.db.session import get_db
from app.schemas.listing import (
    MAX_ACREAGE,
    MAX_BATHROOMS,
    MAX_BEDROOMS,
    MAX_PRICE,
    MAX_SQFT,
    ListingRead,
    PaginatedPublicListingRead,
    PropertyType,
    PublicListingRead,
    PublicListingStatus,
)


router = APIRouter(prefix="/public/listings", tags=["Public Listings"])

PUBLIC_LISTING_STATUSES = ("Active", "Pending", "Sold")
PublicSort = Literal[
    "newest",
    "price_asc",
    "price_desc",
    "beds_desc",
    "baths_desc",
    "sqft_desc",
]


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


def _validate_range(
    minimum: int | float | None,
    maximum: int | float | None,
    *,
    minimum_name: str,
    maximum_name: str,
) -> None:
    """Reject contradictory range filters with a clear 422 response."""
    if minimum is not None and maximum is not None and minimum > maximum:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{minimum_name} cannot be greater than {maximum_name}",
        )


def _apply_sort(query: SqlAlchemyQuery, sort_by: PublicSort) -> SqlAlchemyQuery:
    """Apply deterministic public listing ordering."""
    if sort_by == "price_asc":
        return query.order_by(Listing.price.asc(), Listing.id.desc())
    if sort_by == "price_desc":
        return query.order_by(Listing.price.desc(), Listing.id.desc())
    if sort_by == "beds_desc":
        return query.order_by(Listing.bedrooms.desc(), Listing.id.desc())
    if sort_by == "baths_desc":
        return query.order_by(Listing.bathrooms.desc(), Listing.id.desc())
    if sort_by == "sqft_desc":
        # Null square-footage values sort after populated values on PostgreSQL.
        return query.order_by(Listing.sqft.desc().nullslast(), Listing.id.desc())

    return query.order_by(Listing.created_at.desc(), Listing.id.desc())


@router.get(
    "",
    response_model=PaginatedPublicListingRead,
    status_code=status.HTTP_200_OK,
)
def list_public_listings(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=100),
    min_price: int | None = Query(None, ge=0, le=MAX_PRICE),
    max_price: int | None = Query(None, ge=0, le=MAX_PRICE),
    min_bedrooms: int | None = Query(None, ge=0, le=MAX_BEDROOMS),
    min_bathrooms: float | None = Query(
        None,
        ge=0,
        le=MAX_BATHROOMS,
        multiple_of=0.5,
    ),
    location: str | None = Query(None, min_length=1, max_length=100),
    property_type: PropertyType | None = Query(None),
    min_sqft: int | None = Query(None, ge=0, le=MAX_SQFT),
    max_sqft: int | None = Query(None, ge=0, le=MAX_SQFT),
    min_acreage: float | None = Query(None, ge=0, le=MAX_ACREAGE),
    max_acreage: float | None = Query(None, ge=0, le=MAX_ACREAGE),
    min_year_built: int | None = Query(None, ge=1600),
    max_year_built: int | None = Query(None, ge=1600),
    listing_status: PublicListingStatus | None = Query(None, alias="status"),
    sort: PublicSort = Query("newest"),
    db: Session = Depends(get_db),
) -> PaginatedPublicListingRead:
    """Search public listings with common real-estate filters."""
    latest_year = datetime.now(timezone.utc).year + 1

    if min_year_built is not None and min_year_built > latest_year:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"min_year_built cannot be greater than {latest_year}",
        )
    if max_year_built is not None and max_year_built > latest_year:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"max_year_built cannot be greater than {latest_year}",
        )

    _validate_range(
        min_price,
        max_price,
        minimum_name="min_price",
        maximum_name="max_price",
    )
    _validate_range(
        min_sqft,
        max_sqft,
        minimum_name="min_sqft",
        maximum_name="max_sqft",
    )
    _validate_range(
        min_acreage,
        max_acreage,
        minimum_name="min_acreage",
        maximum_name="max_acreage",
    )
    _validate_range(
        min_year_built,
        max_year_built,
        minimum_name="min_year_built",
        maximum_name="max_year_built",
    )

    query = _eligible_public_listings(db)

    if min_price is not None:
        query = query.filter(Listing.price >= min_price)
    if max_price is not None:
        query = query.filter(Listing.price <= max_price)

    if min_bedrooms is not None:
        query = query.filter(Listing.bedrooms >= min_bedrooms)
    if min_bathrooms is not None:
        query = query.filter(Listing.bathrooms >= min_bathrooms)

    if location is not None:
        term = location.strip()
        if not term:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="location cannot be blank",
            )
        pattern = f"%{term}%"
        query = query.filter(
            or_(
                Listing.city.ilike(pattern),
                Listing.state.ilike(pattern),
            )
        )

    if property_type is not None:
        query = query.filter(Listing.property_type == property_type)

    if min_sqft is not None:
        query = query.filter(Listing.sqft >= min_sqft)
    if max_sqft is not None:
        query = query.filter(Listing.sqft <= max_sqft)

    if min_acreage is not None:
        query = query.filter(Listing.acreage >= min_acreage)
    if max_acreage is not None:
        query = query.filter(Listing.acreage <= max_acreage)

    if min_year_built is not None:
        query = query.filter(Listing.year_built >= min_year_built)
    if max_year_built is not None:
        query = query.filter(Listing.year_built <= max_year_built)

    if listing_status is not None:
        query = query.filter(Listing.status == listing_status)

    total = query.count()
    offset = (page - 1) * per_page

    rows = (
        _apply_sort(query, sort)
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    return _serialize_public_listing(listing)

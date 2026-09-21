"""Verified public-user favorites and recently viewed listing endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.public_listings import _eligible_public_listings, _serialize_public_listing
from app.db.models import Listing, ListingFavorite, RecentlyViewedListing, User
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_verified_public_user
from app.schemas.engagement import FavoriteStateRead, ListingCollectionRead


router = APIRouter(
    prefix="/public/account",
    tags=["Public Account Listing Engagement"],
)


def _public_listing_or_404(db: Session, listing_id: int) -> Listing:
    """Return only a currently public-eligible listing."""
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
    return listing


@router.get(
    "/favorites",
    response_model=ListingCollectionRead,
    status_code=status.HTTP_200_OK,
)
def list_favorites(
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> ListingCollectionRead:
    """Return the caller's favorites that are still publicly eligible."""
    rows = (
        _eligible_public_listings(db)
        .join(ListingFavorite, ListingFavorite.listing_id == Listing.id)
        .filter(ListingFavorite.user_id == user.id)
        .order_by(ListingFavorite.created_at.desc(), ListingFavorite.id.desc())
        .all()
    )
    return ListingCollectionRead(
        items=[_serialize_public_listing(row) for row in rows],
    )


@router.get(
    "/favorites/{listing_id}",
    response_model=FavoriteStateRead,
    status_code=status.HTTP_200_OK,
)
def get_favorite_state(
    listing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> FavoriteStateRead:
    """Return whether the caller has saved one currently public listing."""
    _public_listing_or_404(db, listing_id)
    favorite = (
        db.query(ListingFavorite)
        .filter(
            ListingFavorite.user_id == user.id,
            ListingFavorite.listing_id == listing_id,
        )
        .first()
    )
    return FavoriteStateRead(
        listing_id=listing_id,
        is_favorite=favorite is not None,
    )


@router.put(
    "/favorites/{listing_id}",
    response_model=FavoriteStateRead,
    status_code=status.HTTP_200_OK,
)
def add_favorite(
    listing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> FavoriteStateRead:
    """Idempotently save one public listing for the caller."""
    _public_listing_or_404(db, listing_id)

    favorite = (
        db.query(ListingFavorite)
        .filter(
            ListingFavorite.user_id == user.id,
            ListingFavorite.listing_id == listing_id,
        )
        .first()
    )
    if favorite is None:
        db.add(ListingFavorite(user_id=user.id, listing_id=listing_id))
        db.commit()

    return FavoriteStateRead(listing_id=listing_id, is_favorite=True)


@router.delete(
    "/favorites/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_favorite(
    listing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> Response:
    """Remove only the caller's saved-listing row."""
    favorite = (
        db.query(ListingFavorite)
        .filter(
            ListingFavorite.user_id == user.id,
            ListingFavorite.listing_id == listing_id,
        )
        .first()
    )
    if favorite is not None:
        db.delete(favorite)
        db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/recently-viewed/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def record_recent_view(
    listing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> Response:
    """Upsert the caller's latest view timestamp for one public listing."""
    _public_listing_or_404(db, listing_id)

    viewed = (
        db.query(RecentlyViewedListing)
        .filter(
            RecentlyViewedListing.user_id == user.id,
            RecentlyViewedListing.listing_id == listing_id,
        )
        .first()
    )
    now = datetime.now(timezone.utc)

    if viewed is None:
        db.add(
            RecentlyViewedListing(
                user_id=user.id,
                listing_id=listing_id,
                viewed_at=now,
            )
        )
    else:
        viewed.viewed_at = now

    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/recently-viewed",
    response_model=ListingCollectionRead,
    status_code=status.HTTP_200_OK,
)
def list_recently_viewed(
    limit: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> ListingCollectionRead:
    """Return the caller's recent public listings, newest view first."""
    rows = (
        _eligible_public_listings(db)
        .join(
            RecentlyViewedListing,
            RecentlyViewedListing.listing_id == Listing.id,
        )
        .filter(RecentlyViewedListing.user_id == user.id)
        .order_by(
            RecentlyViewedListing.viewed_at.desc(),
            RecentlyViewedListing.id.desc(),
        )
        .limit(limit)
        .all()
    )
    return ListingCollectionRead(
        items=[_serialize_public_listing(row) for row in rows],
    )

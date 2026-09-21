"""Schemas for verified public-user listing engagement."""

from pydantic import BaseModel

from app.schemas.listing import PublicListingRead


class FavoriteStateRead(BaseModel):
    """Favorite state for one public listing."""

    listing_id: int
    is_favorite: bool


class ListingCollectionRead(BaseModel):
    """Simple public-safe collection used by saved and recently viewed pages."""

    items: list[PublicListingRead]

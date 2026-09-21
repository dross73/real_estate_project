"""API schemas for optimized listing photos."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ListingPhotoRead(BaseModel):
    """Listing photo metadata with usable optimized variant URLs."""

    id: int
    listing_id: int
    original_filename: str
    source_format: str
    width: int
    height: int
    position: int
    is_primary: bool

    thumbnail_url: str
    medium_url: str
    large_url: str

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ListingPhotoUploadSettingsRead(BaseModel):
    """Safe upload limits the admin UI can use for client-side guidance."""

    max_photos: int
    max_file_bytes: int
    accepted_extensions: list[str]

"""API schemas for optimized listing photos."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class ListingPhotoReorder(BaseModel):
    """Complete ordered list of photo IDs for one listing gallery."""

    photo_ids: list[int] = Field(min_length=1, max_length=50)

    @field_validator("photo_ids")
    @classmethod
    def photo_ids_must_be_unique(cls, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise ValueError("photo_ids must not contain duplicates")
        return value

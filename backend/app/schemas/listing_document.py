"""Schemas for downloadable listing documents."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ListingDocumentRead(BaseModel):
    id: int
    listing_id: int
    title: str
    original_filename: str
    content_type: str
    file_size: int
    is_public: bool
    download_url: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublicListingDocumentRead(BaseModel):
    id: int
    title: str
    original_filename: str
    content_type: str
    file_size: int
    download_url: str


class ListingDocumentUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=160)
    is_public: bool | None = None

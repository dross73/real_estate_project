# Purpose: Define request/response schemas for Listings that routers use.
# Fields follow our spec: price, address, city, state, description, sqft,
# bedrooms, bathrooms (half-increments), and a single cover image URL.

# Ensures type annotations are treated as strings until evaluated
# (helps with forward references and circular imports).
from __future__ import annotations

# For timestamp fields (created_at, updated_at).
from datetime import datetime

# Standard typing helpers: Optional for nullable fields, List for collections.
from typing import Optional, List

# Pydantic: FastAPI's schema and validation layer.
# BaseModel: parent class for all schemas
# Field: attach metadata and validation rules
# ConfigDict: control schema behavior (e.g., ORM mode)
# HttpUrl: validates that a string is a proper URL
from pydantic import BaseModel, Field, ConfigDict


# Shared base schema: foundation for create/read/update variants.
class ListingBase(BaseModel):
    price: int = Field(..., ge=0, description="Price in whole USD")
    address: str = Field(..., min_length=1, description="Street address")
    city: str = Field(..., min_length=1, description="City name")
    state: str = Field(
        ..., min_length=2, max_length=2, description="Two-letter state code (e.g., IA)"
    )
    description: Optional[str] = Field(
        None, description="Free-form property description"
    )
    sqft: Optional[int] = Field(None, ge=0, description="Square footage, non-negative")
    bedrooms: int = Field(..., ge=0, description="Number of bedrooms, non-negative")
    bathrooms: float = Field(
        ...,
        ge=0,
        multiple_of=0.5,
        description="Number of bathrooms, in half increments",
    )
    cover_image: Optional[str] = Field(
        None, description="Public URL to the cover image"
    )


# Schema for creating a new listing.
class ListingCreate(ListingBase):
    model_config = ConfigDict(from_attributes=True)


# Schema for updating an existing listing: all fields optional to allow partial updates.
class ListingUpdate(BaseModel):
    price: Optional[int] = Field(None, ge=0)
    address: Optional[str] = Field(None, min_length=1)
    city: Optional[str] = Field(None, min_length=1)
    state: Optional[str] = Field(None, min_length=2, max_length=2)
    description: Optional[str] = None
    sqft: Optional[int] = Field(None, ge=0)
    bedrooms: Optional[int] = Field(None, ge=0)
    bathrooms: Optional[float] = Field(None, ge=0, multiple_of=0.5)
    cover_image: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Schema for reading a listing: includes server-managed fields.
class ListingRead(ListingBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Schema for paginated responses: includes listings plus paging metadata.
class PaginatedListingRead(BaseModel):
    items: List[ListingRead]
    total: int
    page: int
    per_page: int

    model_config = ConfigDict(from_attributes=True)

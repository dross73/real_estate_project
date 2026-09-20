"""Pydantic request/response schemas for real estate listings."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


ListingStatus = Literal["Draft", "Active", "Pending", "Sold", "Archived"]
PropertyType = Literal[
    "Single Family",
    "Condo",
    "Townhouse",
    "Multi-Family",
    "Land",
    "Commercial",
    "Farm/Ranch",
    "Manufactured Home",
    "Other",
]
HoaFeeFrequency = Literal["Monthly", "Quarterly", "Annually"]

MAX_PRICE = 10_000_000_000
MAX_SQFT = 10_000_000
MAX_ACREAGE = 100_000_000
MAX_MONEY_FIELD = 100_000_000
MAX_BEDROOMS = 100
MAX_BATHROOMS = 100
MAX_AMENITIES = 100
MAX_AMENITY_LENGTH = 100


def _normalize_state(value: str) -> str:
    """Normalize a two-letter state code."""
    normalized = value.strip().upper()
    if len(normalized) != 2 or not normalized.isalpha():
        raise ValueError("State must be a two-letter code")
    return normalized


def _validate_year_built(value: int | None) -> int | None:
    """Keep construction years within a realistic historical/future range."""
    if value is None:
        return None

    latest_year = datetime.now(timezone.utc).year + 1
    if value < 1600 or value > latest_year:
        raise ValueError(f"Year built must be between 1600 and {latest_year}")

    return value


def _normalize_amenities(values: list[str] | None) -> list[str]:
    """Trim, validate, and de-duplicate structured amenity names."""
    if not values:
        return []

    if len(values) > MAX_AMENITIES:
        raise ValueError(f"No more than {MAX_AMENITIES} amenities are allowed")

    normalized: list[str] = []
    seen: set[str] = set()

    for value in values:
        amenity = value.strip()
        if not amenity:
            continue
        if len(amenity) > MAX_AMENITY_LENGTH:
            raise ValueError(
                f"Each amenity must be {MAX_AMENITY_LENGTH} characters or fewer"
            )

        key = amenity.casefold()
        if key not in seen:
            seen.add(key)
            normalized.append(amenity)

    return normalized


class ListingBase(BaseModel):
    """Shared validated fields used when creating and reading listings."""

    title: str = Field(..., min_length=1, max_length=150)
    status: ListingStatus = "Draft"
    is_public: bool = False
    is_featured: bool = False
    hide_exact_address: bool = False

    price: int = Field(..., ge=0, le=MAX_PRICE)
    property_type: PropertyType | None = None

    address: str = Field(..., min_length=1, max_length=255)
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=2, max_length=2)

    description: str | None = Field(None, max_length=20_000)
    sqft: int | None = Field(None, ge=0, le=MAX_SQFT)
    acreage: float | None = Field(None, ge=0, le=MAX_ACREAGE)
    year_built: int | None = None

    bedrooms: int = Field(..., ge=0, le=MAX_BEDROOMS)
    bathrooms: float = Field(
        ...,
        ge=0,
        le=MAX_BATHROOMS,
        multiple_of=0.5,
    )

    annual_property_taxes: float | None = Field(
        None,
        ge=0,
        le=MAX_MONEY_FIELD,
    )
    hoa_fee: float | None = Field(None, ge=0, le=MAX_MONEY_FIELD)
    hoa_fee_frequency: HoaFeeFrequency | None = None

    school_district: str | None = Field(None, max_length=150)
    amenities: list[str] = Field(default_factory=list)

    mls_number: str | None = Field(None, max_length=100)
    source_attribution: str | None = Field(None, max_length=255)
    cover_image: str | None = Field(None, max_length=2048)

    @field_validator("state")
    @classmethod
    def normalize_state(cls, value: str) -> str:
        return _normalize_state(value)

    @field_validator("year_built")
    @classmethod
    def validate_year_built(cls, value: int | None) -> int | None:
        return _validate_year_built(value)

    @field_validator("amenities")
    @classmethod
    def normalize_amenities(cls, values: list[str]) -> list[str]:
        return _normalize_amenities(values)


class ListingCreate(ListingBase):
    """Payload accepted when staff/admin creates a listing."""

    model_config = ConfigDict(from_attributes=True)


class ListingUpdate(BaseModel):
    """Partial listing update payload."""

    title: str | None = Field(None, min_length=1, max_length=150)
    status: ListingStatus | None = None
    is_public: bool | None = None
    is_featured: bool | None = None
    hide_exact_address: bool | None = None

    price: int | None = Field(None, ge=0, le=MAX_PRICE)
    property_type: PropertyType | None = None

    address: str | None = Field(None, min_length=1, max_length=255)
    city: str | None = Field(None, min_length=1, max_length=100)
    state: str | None = Field(None, min_length=2, max_length=2)

    description: str | None = Field(None, max_length=20_000)
    sqft: int | None = Field(None, ge=0, le=MAX_SQFT)
    acreage: float | None = Field(None, ge=0, le=MAX_ACREAGE)
    year_built: int | None = None

    bedrooms: int | None = Field(None, ge=0, le=MAX_BEDROOMS)
    bathrooms: float | None = Field(
        None,
        ge=0,
        le=MAX_BATHROOMS,
        multiple_of=0.5,
    )

    annual_property_taxes: float | None = Field(
        None,
        ge=0,
        le=MAX_MONEY_FIELD,
    )
    hoa_fee: float | None = Field(None, ge=0, le=MAX_MONEY_FIELD)
    hoa_fee_frequency: HoaFeeFrequency | None = None

    school_district: str | None = Field(None, max_length=150)
    amenities: list[str] | None = None

    mls_number: str | None = Field(None, max_length=100)
    source_attribution: str | None = Field(None, max_length=255)
    cover_image: str | None = Field(None, max_length=2048)

    @field_validator("state")
    @classmethod
    def normalize_state(cls, value: str | None) -> str | None:
        return _normalize_state(value) if value is not None else None

    @field_validator("year_built")
    @classmethod
    def validate_year_built(cls, value: int | None) -> int | None:
        return _validate_year_built(value)

    @field_validator("amenities")
    @classmethod
    def normalize_amenities(cls, values: list[str] | None) -> list[str] | None:
        return _normalize_amenities(values) if values is not None else None

    model_config = ConfigDict(from_attributes=True)


class ListingRead(ListingBase):
    """Listing returned by internal APIs."""

    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedListingRead(BaseModel):
    """Paginated internal listing response."""

    items: list[ListingRead]
    total: int
    page: int
    per_page: int

    model_config = ConfigDict(from_attributes=True)

"""Schemas for verified public-user saved searches."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.listing import (
    MAX_ACREAGE,
    MAX_BATHROOMS,
    MAX_BEDROOMS,
    MAX_PRICE,
    MAX_SQFT,
    PropertyType,
    PublicListingStatus,
)

AlertFrequency = Literal["immediate", "daily", "weekly"]


class SavedSearchCriteria(BaseModel):
    min_price: int | None = Field(None, ge=0, le=MAX_PRICE)
    max_price: int | None = Field(None, ge=0, le=MAX_PRICE)
    min_bedrooms: int | None = Field(None, ge=0, le=MAX_BEDROOMS)
    min_bathrooms: float | None = Field(None, ge=0, le=MAX_BATHROOMS, multiple_of=0.5)
    location: str | None = Field(None, min_length=1, max_length=100)
    property_type: PropertyType | None = None
    min_sqft: int | None = Field(None, ge=0, le=MAX_SQFT)
    max_sqft: int | None = Field(None, ge=0, le=MAX_SQFT)
    min_acreage: float | None = Field(None, ge=0, le=MAX_ACREAGE)
    max_acreage: float | None = Field(None, ge=0, le=MAX_ACREAGE)
    min_year_built: int | None = Field(None, ge=1600)
    max_year_built: int | None = Field(None, ge=1600)
    status: PublicListingStatus | None = None

    @model_validator(mode="after")
    def validate_ranges(self):
        ranges = (
            (self.min_price, self.max_price, "price"),
            (self.min_sqft, self.max_sqft, "square footage"),
            (self.min_acreage, self.max_acreage, "acreage"),
            (self.min_year_built, self.max_year_built, "year built"),
        )
        for minimum, maximum, label in ranges:
            if minimum is not None and maximum is not None and minimum > maximum:
                raise ValueError(f"Minimum {label} cannot exceed maximum {label}")
        return self


class SavedSearchCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    criteria: SavedSearchCriteria
    alert_frequency: AlertFrequency = "daily"
    alerts_enabled: bool = True


class SavedSearchUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    criteria: SavedSearchCriteria | None = None
    alert_frequency: AlertFrequency | None = None
    alerts_enabled: bool | None = None


class SavedSearchRead(BaseModel):
    id: int
    name: str
    criteria: SavedSearchCriteria
    alert_frequency: AlertFrequency
    alerts_enabled: bool
    last_alerted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class SavedSearchListRead(BaseModel):
    items: list[SavedSearchRead]

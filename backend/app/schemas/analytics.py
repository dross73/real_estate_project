"""Schemas for privacy-conscious listing and lead analytics."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


AnalyticsGranularity = Literal["daily", "weekly", "monthly"]
AnalyticsSourceCategory = Literal["direct", "search", "social", "referral"]


class ListingViewCreate(BaseModel):
    """Minimal anonymous public-listing view payload."""

    referrer_host: str | None = Field(default=None, max_length=255)

    @field_validator("referrer_host", mode="before")
    @classmethod
    def normalize_referrer_host(cls, value):
        if value is None:
            return None
        if not isinstance(value, str):
            return value

        host = value.strip().lower().rstrip(".")
        if not host:
            return None
        if host.startswith("www."):
            host = host[4:]

        # The client sends only URL.hostname. Reject full URLs, paths, queries,
        # ports, spaces, and other data we do not need for reporting.
        if (
            "://" in host
            or "/" in host
            or "?" in host
            or "#" in host
            or ":" in host
            or " " in host
            or not all(
                character.isalnum() or character in ".-"
                for character in host
            )
        ):
            raise ValueError("referrer_host must be a hostname only")

        return host


class AnalyticsMetrics(BaseModel):
    listing_views: int
    current_favorites: int
    inquiries: int
    showings: int


class AnalyticsTrendPoint(BaseModel):
    period_start: date
    listing_views: int
    inquiries: int


class AnalyticsListingInterest(BaseModel):
    listing_id: int
    title: str
    city: str
    state: str
    views: int
    favorites: int
    inquiries: int


class AnalyticsSourceCount(BaseModel):
    category: AnalyticsSourceCategory
    count: int


class AnalyticsReferrerCount(BaseModel):
    host: str
    count: int


class AnalyticsOverview(BaseModel):
    days: int
    start_at: datetime
    end_at: datetime
    granularity: AnalyticsGranularity
    metrics: AnalyticsMetrics
    trend: list[AnalyticsTrendPoint]
    top_listings: list[AnalyticsListingInterest]
    sources: list[AnalyticsSourceCount]
    referring_sites: list[AnalyticsReferrerCount]

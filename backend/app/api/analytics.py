"""Privacy-conscious listing and lead analytics APIs."""

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Iterable

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.models import (
    Lead,
    Listing,
    ListingFavorite,
    ListingViewEvent,
)
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_staff_or_admin
from app.schemas.analytics import (
    AnalyticsGranularity,
    AnalyticsListingInterest,
    AnalyticsMetrics,
    AnalyticsOverview,
    AnalyticsReferrerCount,
    AnalyticsSourceCount,
    AnalyticsTrendPoint,
    ListingViewCreate,
)


PUBLIC_LISTING_STATUSES = ("Active", "Pending", "Sold")
SOURCE_ORDER = ("direct", "search", "social", "referral")
SEARCH_HOSTS = (
    "bing.com",
    "duckduckgo.com",
    "ecosia.org",
    "search.yahoo.com",
    "yahoo.com",
    "brave.com",
)
SOCIAL_HOSTS = (
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "x.com",
    "twitter.com",
    "pinterest.com",
    "tiktok.com",
    "threads.net",
    "reddit.com",
)

public_router = APIRouter(
    prefix="/public/analytics",
    tags=["Public Analytics"],
)
admin_router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    dependencies=[Depends(require_staff_or_admin)],
)


def _as_utc(value: datetime) -> datetime:
    """Normalize SQLite-naive and PostgreSQL-aware timestamps."""
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _host_matches(host: str, domains: Iterable[str]) -> bool:
    return any(host == domain or host.endswith(f".{domain}") for domain in domains)


def classify_referrer(host: str | None) -> str:
    """Map a minimized referrer hostname into a stable reporting category."""
    if not host:
        return "direct"
    if host.startswith("google.") or _host_matches(host, SEARCH_HOSTS):
        return "search"
    if _host_matches(host, SOCIAL_HOSTS):
        return "social"
    return "referral"


def _granularity(days: int) -> AnalyticsGranularity:
    if days <= 31:
        return "daily"
    if days <= 120:
        return "weekly"
    return "monthly"


def _bucket_start(value: datetime, granularity: AnalyticsGranularity) -> date:
    value = _as_utc(value)
    current = value.date()

    if granularity == "weekly":
        return current - timedelta(days=current.weekday())
    if granularity == "monthly":
        return current.replace(day=1)
    return current


def _next_bucket(value: date, granularity: AnalyticsGranularity) -> date:
    if granularity == "daily":
        return value + timedelta(days=1)
    if granularity == "weekly":
        return value + timedelta(days=7)

    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def _trend_points(
    *,
    start_at: datetime,
    end_at: datetime,
    granularity: AnalyticsGranularity,
    views: list[ListingViewEvent],
    leads: list[Lead],
) -> list[AnalyticsTrendPoint]:
    view_counts: Counter[date] = Counter(
        _bucket_start(event.viewed_at, granularity)
        for event in views
    )
    inquiry_counts: Counter[date] = Counter(
        _bucket_start(lead.created_at, granularity)
        for lead in leads
        if lead.created_at is not None
    )

    points: list[AnalyticsTrendPoint] = []
    cursor = _bucket_start(start_at, granularity)
    final_bucket = _bucket_start(end_at, granularity)

    while cursor <= final_bucket:
        points.append(
            AnalyticsTrendPoint(
                period_start=cursor,
                listing_views=view_counts[cursor],
                inquiries=inquiry_counts[cursor],
            )
        )
        cursor = _next_bucket(cursor, granularity)

    return points


@public_router.post(
    "/listing-views/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def record_listing_view(
    listing_id: int,
    payload: ListingViewCreate,
    db: Session = Depends(get_db),
) -> None:
    """Count one anonymous public listing view without storing visitor identity."""
    listing = (
        db.query(Listing)
        .filter(
            Listing.id == listing_id,
            Listing.is_public.is_(True),
            Listing.status.in_(PUBLIC_LISTING_STATUSES),
        )
        .first()
    )
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Public listing not found",
        )

    db.add(
        ListingViewEvent(
            listing_id=listing.id,
            source_category=classify_referrer(payload.referrer_host),
            referrer_host=payload.referrer_host,
        )
    )
    db.commit()


@admin_router.get(
    "/overview",
    response_model=AnalyticsOverview,
    status_code=status.HTTP_200_OK,
)
def get_analytics_overview(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
) -> AnalyticsOverview:
    """Return operational analytics without exposing public-user identities."""
    end_at = datetime.now(timezone.utc)
    start_at = end_at - timedelta(days=days)
    granularity = _granularity(days)

    views = (
        db.query(ListingViewEvent)
        .filter(ListingViewEvent.viewed_at >= start_at)
        .all()
    )
    leads = (
        db.query(Lead)
        .filter(Lead.created_at >= start_at)
        .all()
    )
    favorites = db.query(ListingFavorite).all()

    favorite_counts: Counter[int] = Counter(
        favorite.listing_id for favorite in favorites
    )
    view_counts: Counter[int] = Counter(event.listing_id for event in views)
    inquiry_counts: Counter[int] = Counter(
        lead.listing_id
        for lead in leads
        if lead.listing_id is not None
    )

    listing_ids = set(view_counts) | set(favorite_counts) | set(inquiry_counts)
    listings_by_id = {
        listing.id: listing
        for listing in (
            db.query(Listing)
            .filter(Listing.id.in_(listing_ids))
            .all()
            if listing_ids
            else []
        )
    }

    interest_rows = [
        AnalyticsListingInterest(
            listing_id=listing_id,
            title=listings_by_id[listing_id].title,
            city=listings_by_id[listing_id].city,
            state=listings_by_id[listing_id].state,
            views=view_counts[listing_id],
            favorites=favorite_counts[listing_id],
            inquiries=inquiry_counts[listing_id],
        )
        for listing_id in listing_ids
        if listing_id in listings_by_id
    ]
    interest_rows.sort(
        key=lambda row: (
            -row.views,
            -row.inquiries,
            -row.favorites,
            row.title.lower(),
            row.listing_id,
        )
    )

    source_counts: Counter[str] = Counter(
        event.source_category for event in views
    )
    sources = [
        AnalyticsSourceCount(
            category=category,
            count=source_counts[category],
        )
        for category in SOURCE_ORDER
    ]

    referrer_counts: Counter[str] = Counter(
        event.referrer_host
        for event in views
        if event.source_category == "referral" and event.referrer_host
    )
    referring_sites = [
        AnalyticsReferrerCount(host=host, count=count)
        for host, count in sorted(
            referrer_counts.items(),
            key=lambda item: (-item[1], item[0]),
        )[:10]
    ]

    return AnalyticsOverview(
        days=days,
        start_at=start_at,
        end_at=end_at,
        granularity=granularity,
        metrics=AnalyticsMetrics(
            listing_views=len(views),
            current_favorites=len(favorites),
            inquiries=len(leads),
            showings=sum(
                1 for lead in leads if lead.inquiry_type == "showing"
            ),
        ),
        trend=_trend_points(
            start_at=start_at,
            end_at=end_at,
            granularity=granularity,
            views=views,
            leads=leads,
        ),
        top_listings=interest_rows[:10],
        sources=sources,
        referring_sites=referring_sites,
    )

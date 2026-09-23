"""Integration tests for privacy-conscious operational analytics."""

from datetime import datetime, timedelta, timezone

from app.api.analytics import admin_router, public_router
from app.core.security import create_access_token
from app.db.models import (
    Lead,
    Listing,
    ListingFavorite,
    ListingViewEvent,
    User,
)


def _headers(role: str = "admin") -> dict[str, str]:
    token = create_access_token(
        subject=f"{role}@example.com",
        role=role,
    )
    return {"Authorization": f"Bearer {token}"}


def _listing(
    db,
    *,
    title: str = "Analytics Home",
    public: bool = True,
) -> Listing:
    listing = Listing(
        title=title,
        status="Active",
        is_public=public,
        is_featured=False,
        hide_exact_address=False,
        price=425000,
        property_type="Single Family",
        address="123 Main St",
        city="Ames",
        state="IA",
        bedrooms=3,
        bathrooms=2.0,
        amenities=[],
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def _user(db) -> User:
    user = User(
        role="public_user",
        email="buyer@example.com",
        full_name="Buyer Person",
        hashed_password="not-used",
        is_active=True,
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_public_view_tracking_stores_only_minimized_referrer_data(
    isolated_api_factory,
):
    api = isolated_api_factory([public_router])
    listing = _listing(api.db)

    cases = [
        (None, "direct"),
        ("www.google.com", "search"),
        ("m.facebook.com", "social"),
        ("homes.example.com", "referral"),
    ]

    for host, expected_category in cases:
        response = api.client.post(
            f"/public/analytics/listing-views/{listing.id}",
            json={"referrer_host": host},
        )
        assert response.status_code == 204

        event = (
            api.db.query(ListingViewEvent)
            .order_by(ListingViewEvent.id.desc())
            .first()
        )
        assert event is not None
        assert event.source_category == expected_category
        assert event.referrer_host == (
            None
            if host is None
            else host.removeprefix("www.")
        )

    columns = set(ListingViewEvent.__table__.columns.keys())
    assert columns == {
        "id",
        "listing_id",
        "source_category",
        "referrer_host",
        "viewed_at",
    }


def test_public_view_tracking_rejects_hidden_listing_and_full_referrer_url(
    isolated_api_factory,
):
    api = isolated_api_factory([public_router])
    hidden = _listing(api.db, title="Hidden", public=False)

    hidden_response = api.client.post(
        f"/public/analytics/listing-views/{hidden.id}",
        json={"referrer_host": None},
    )
    full_url_response = api.client.post(
        f"/public/analytics/listing-views/{hidden.id + 1}",
        json={"referrer_host": "https://example.com/private/path?q=1"},
    )

    assert hidden_response.status_code == 404
    assert full_url_response.status_code == 422
    assert api.db.query(ListingViewEvent).count() == 0


def test_staff_and_admin_can_read_analytics_but_public_users_cannot(
    isolated_api_factory,
):
    api = isolated_api_factory([admin_router])

    assert api.client.get(
        "/analytics/overview",
        headers=_headers("admin"),
    ).status_code == 200
    assert api.client.get(
        "/analytics/overview",
        headers=_headers("staff"),
    ).status_code == 200
    assert api.client.get(
        "/analytics/overview",
        headers=_headers("public_user"),
    ).status_code == 403


def test_overview_reports_range_metrics_top_listings_and_sources(
    isolated_api_factory,
):
    api = isolated_api_factory([admin_router])
    first = _listing(api.db, title="First Home")
    second = _listing(api.db, title="Second Home")
    user = _user(api.db)
    now = datetime.now(timezone.utc)

    api.db.add_all(
        [
            ListingViewEvent(
                listing_id=first.id,
                source_category="search",
                referrer_host="google.com",
                viewed_at=now - timedelta(days=1),
            ),
            ListingViewEvent(
                listing_id=first.id,
                source_category="referral",
                referrer_host="broker.example.com",
                viewed_at=now - timedelta(days=2),
            ),
            ListingViewEvent(
                listing_id=second.id,
                source_category="direct",
                referrer_host=None,
                viewed_at=now - timedelta(days=3),
            ),
            ListingViewEvent(
                listing_id=second.id,
                source_category="direct",
                referrer_host=None,
                viewed_at=now - timedelta(days=45),
            ),
            ListingFavorite(
                user_id=user.id,
                listing_id=first.id,
            ),
            Lead(
                inquiry_type="showing",
                status="New",
                contact_name="Buyer",
                contact_email="buyer@example.com",
                listing_id=first.id,
                created_at=now - timedelta(days=1),
            ),
            Lead(
                inquiry_type="contact",
                status="New",
                contact_name="Another Buyer",
                contact_email="another@example.com",
                listing_id=second.id,
                created_at=now - timedelta(days=2),
            ),
            Lead(
                inquiry_type="contact",
                status="New",
                contact_name="General Inquiry",
                contact_email="general@example.com",
                listing_id=None,
                created_at=now - timedelta(days=2),
            ),
        ]
    )
    api.db.commit()

    response = api.client.get(
        "/analytics/overview?days=30",
        headers=_headers("staff"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["granularity"] == "daily"
    assert body["metrics"] == {
        "listing_views": 3,
        "current_favorites": 1,
        "inquiries": 3,
        "showings": 1,
    }
    assert body["top_listings"][0]["listing_id"] == first.id
    assert body["top_listings"][0]["views"] == 2
    assert body["top_listings"][0]["favorites"] == 1
    assert body["top_listings"][0]["inquiries"] == 1

    sources = {
        item["category"]: item["count"]
        for item in body["sources"]
    }
    assert sources == {
        "direct": 1,
        "search": 1,
        "social": 0,
        "referral": 1,
    }
    assert body["referring_sites"] == [
        {"host": "broker.example.com", "count": 1}
    ]
    assert any(
        point["listing_views"] > 0
        for point in body["trend"]
    )
    assert any(
        point["inquiries"] > 0
        for point in body["trend"]
    )


def test_current_favorites_exclude_archived_accounts_and_hidden_listings(
    isolated_api_factory,
):
    api = isolated_api_factory([admin_router])
    visible = _listing(api.db, title="Visible")
    hidden = _listing(api.db, title="Hidden", public=False)
    active_user = _user(api.db)
    archived_user = User(
        role="public_user",
        email="archived@example.com",
        full_name="Archived Buyer",
        hashed_password="not-used",
        is_active=True,
        email_verified_at=datetime.now(timezone.utc),
        archived_at=datetime.now(timezone.utc),
    )
    api.db.add(archived_user)
    api.db.commit()
    api.db.refresh(archived_user)

    api.db.add_all(
        [
            ListingFavorite(
                user_id=active_user.id,
                listing_id=visible.id,
            ),
            ListingFavorite(
                user_id=active_user.id,
                listing_id=hidden.id,
            ),
            ListingFavorite(
                user_id=archived_user.id,
                listing_id=visible.id,
            ),
        ]
    )
    api.db.commit()

    response = api.client.get(
        "/analytics/overview?days=30",
        headers=_headers(),
    )

    assert response.status_code == 200
    assert response.json()["metrics"]["current_favorites"] == 1
    assert response.json()["top_listings"][0]["favorites"] == 1


def test_range_selects_daily_weekly_and_monthly_trend_granularity(
    isolated_api_factory,
):
    api = isolated_api_factory([admin_router])

    daily = api.client.get(
        "/analytics/overview?days=30",
        headers=_headers(),
    )
    weekly = api.client.get(
        "/analytics/overview?days=90",
        headers=_headers(),
    )
    monthly = api.client.get(
        "/analytics/overview?days=365",
        headers=_headers(),
    )

    assert daily.json()["granularity"] == "daily"
    assert weekly.json()["granularity"] == "weekly"
    assert monthly.json()["granularity"] == "monthly"
    assert len(daily.json()["trend"]) >= 30
    assert 12 <= len(weekly.json()["trend"]) <= 15
    assert 12 <= len(monthly.json()["trend"]) <= 14

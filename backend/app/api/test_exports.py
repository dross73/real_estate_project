"""Integration tests for authorized CSV exports."""

import csv
from datetime import datetime, timedelta, timezone
import io

from app.api.exports import router
from app.core.security import create_access_token
from app.db.models import Lead, Listing, ListingViewEvent


def _headers(role: str = "admin") -> dict[str, str]:
    token = create_access_token(
        subject=f"{role}@example.com",
        role=role,
    )
    return {"Authorization": f"Bearer {token}"}


def _listing(db, title: str = "Export Home") -> Listing:
    listing = Listing(
        title=title,
        status="Active",
        is_public=True,
        is_featured=False,
        hide_exact_address=False,
        price=350000,
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


def _csv_rows(response) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(response.text)))


def test_staff_can_export_filtered_leads_with_documented_column_order(
    isolated_api_factory,
):
    api = isolated_api_factory([router])
    listing = _listing(api.db)
    now = datetime.now(timezone.utc)

    api.db.add_all(
        [
            Lead(
                inquiry_type="showing",
                status="New",
                contact_name="Taylor Morgan",
                contact_email="taylor@example.com",
                contact_phone="515-555-0101",
                listing_id=listing.id,
                message="Saturday afternoon works.",
                preferred_at=now + timedelta(days=2),
                source="public_site",
                created_at=now,
                updated_at=now,
            ),
            Lead(
                inquiry_type="contact",
                status="Closed",
                contact_name="Other Person",
                contact_email="other@example.com",
                message="Different lead",
                created_at=now,
                updated_at=now,
            ),
        ]
    )
    api.db.commit()

    response = api.client.get(
        "/exports/leads.csv?status=New&inquiry_type=showing&q=Taylor",
        headers=_headers("staff"),
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment;" in response.headers["content-disposition"]

    reader = csv.reader(io.StringIO(response.text))
    header = next(reader)
    assert header == [
        "lead_id",
        "inquiry_type",
        "status",
        "contact_name",
        "contact_email",
        "contact_phone",
        "listing_id",
        "listing_title",
        "message",
        "preferred_at_utc",
        "source",
        "assigned_to",
        "created_at_utc",
        "updated_at_utc",
    ]

    rows = _csv_rows(response)
    assert len(rows) == 1
    assert rows[0]["contact_name"] == "Taylor Morgan"
    assert rows[0]["listing_title"] == "Export Home"
    assert rows[0]["created_at_utc"].endswith("Z")
    assert "requester_user_id" not in rows[0]
    assert "activities" not in rows[0]


def test_lead_export_neutralizes_spreadsheet_formula_cells(
    isolated_api_factory,
):
    api = isolated_api_factory([router])
    now = datetime.now(timezone.utc)
    api.db.add(
        Lead(
            inquiry_type="contact",
            status="New",
            contact_name="=HYPERLINK(\"https://bad.example\")",
            contact_email="safe@example.com",
            message="+SUM(1,1)",
            created_at=now,
            updated_at=now,
        )
    )
    api.db.commit()

    response = api.client.get(
        "/exports/leads.csv",
        headers=_headers(),
    )
    rows = _csv_rows(response)

    assert rows[0]["contact_name"].startswith("'=")
    assert rows[0]["message"].startswith("'+")


def test_analytics_export_contains_summary_trend_listing_and_source_rows(
    isolated_api_factory,
):
    api = isolated_api_factory([router])
    listing = _listing(api.db)
    now = datetime.now(timezone.utc)

    api.db.add_all(
        [
            ListingViewEvent(
                listing_id=listing.id,
                source_category="search",
                referrer_host="google.com",
                viewed_at=now - timedelta(days=1),
            ),
            Lead(
                inquiry_type="showing",
                status="New",
                contact_name="Buyer",
                contact_email="buyer@example.com",
                listing_id=listing.id,
                created_at=now - timedelta(days=1),
                updated_at=now - timedelta(days=1),
            ),
        ]
    )
    api.db.commit()

    response = api.client.get(
        "/exports/analytics.csv?days=30",
        headers=_headers("staff"),
    )

    assert response.status_code == 200
    rows = _csv_rows(response)
    record_types = {row["record_type"] for row in rows}

    assert {"summary", "trend", "listing", "source"}.issubset(record_types)

    summary = next(row for row in rows if row["record_type"] == "summary")
    assert summary["listing_views"] == "1"
    assert summary["inquiries"] == "1"
    assert summary["showings"] == "1"
    assert summary["range_days"] == "30"
    assert summary["range_start_utc"].endswith("Z")
    assert summary["range_end_utc"].endswith("Z")

    listing_row = next(row for row in rows if row["record_type"] == "listing")
    assert listing_row["title"] == "Export Home"
    assert "contact_email" not in listing_row
    assert "user_id" not in listing_row


def test_public_users_cannot_export_internal_data(isolated_api_factory):
    api = isolated_api_factory([router])

    leads = api.client.get(
        "/exports/leads.csv",
        headers=_headers("public_user"),
    )
    analytics = api.client.get(
        "/exports/analytics.csv",
        headers=_headers("public_user"),
    )

    assert leads.status_code == 403
    assert analytics.status_code == 403

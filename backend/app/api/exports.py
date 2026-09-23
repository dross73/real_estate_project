"""Authorized CSV exports for leads and operational analytics."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session, aliased

from app.api.analytics import get_analytics_overview
from app.db.models import AgentProfile, Lead, Listing, User
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_staff_or_admin
from app.schemas.lead import LeadStatus, LeadType
from app.services.csv_exports import build_spooled_csv, stream_text_file


router = APIRouter(
    prefix="/exports",
    tags=["Exports"],
    dependencies=[Depends(require_staff_or_admin)],
)


def _download_response(file_obj, filename: str) -> StreamingResponse:
    return StreamingResponse(
        stream_text_file(file_obj),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/leads.csv")
def export_leads_csv(
    lead_status: LeadStatus | None = Query(None, alias="status"),
    inquiry_type: LeadType | None = Query(None),
    q: str | None = Query(None, max_length=120),
    db: Session = Depends(get_db),
):
    """Export the filtered lead list without internal activity or user IDs."""
    assigned_user = aliased(User)

    query = (
        db.query(
            Lead,
            Listing.title.label("listing_title"),
            AgentProfile.full_name.label("agent_name"),
            assigned_user.full_name.label("staff_name"),
            assigned_user.email.label("staff_email"),
        )
        .outerjoin(Listing, Lead.listing_id == Listing.id)
        .outerjoin(AgentProfile, Lead.assigned_agent_id == AgentProfile.id)
        .outerjoin(assigned_user, Lead.assigned_user_id == assigned_user.id)
    )

    if lead_status is not None:
        query = query.filter(Lead.status == lead_status)
    if inquiry_type is not None:
        query = query.filter(Lead.inquiry_type == inquiry_type)
    if q is not None and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Lead.contact_name.ilike(pattern),
                Lead.contact_email.ilike(pattern),
            )
        )

    rows = query.order_by(Lead.created_at.desc(), Lead.id.desc()).yield_per(500)

    def csv_rows():
        for lead, listing_title, agent_name, staff_name, staff_email in rows:
            assigned_to = agent_name or staff_name or staff_email or ""
            yield (
                lead.id,
                lead.inquiry_type,
                lead.status,
                lead.contact_name,
                lead.contact_email,
                lead.contact_phone,
                lead.listing_id,
                listing_title,
                lead.message,
                lead.preferred_at,
                lead.source,
                assigned_to,
                lead.created_at,
                lead.updated_at,
            )

    output = build_spooled_csv(
        [
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
        ],
        csv_rows(),
    )

    date_stamp = datetime.now(timezone.utc).date().isoformat()
    return _download_response(output, f"leads-{date_stamp}.csv")


@router.get("/analytics.csv")
def export_analytics_csv(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """Export the complete analytics overview in one normalized CSV."""
    overview = get_analytics_overview(days=days, db=db)

    headers = [
        "record_type",
        "period_start_utc",
        "listing_id",
        "title",
        "city",
        "state",
        "listing_views",
        "current_favorites",
        "inquiries",
        "showings",
        "source_category",
        "referrer_host",
        "count",
        "range_days",
        "range_start_utc",
        "range_end_utc",
    ]

    def csv_rows():
        yield (
            "summary",
            "",
            "",
            "",
            "",
            "",
            overview.metrics.listing_views,
            overview.metrics.current_favorites,
            overview.metrics.inquiries,
            overview.metrics.showings,
            "",
            "",
            "",
            overview.days,
            overview.start_at,
            overview.end_at,
        )

        for point in overview.trend:
            yield (
                "trend",
                point.period_start.isoformat(),
                "",
                "",
                "",
                "",
                point.listing_views,
                "",
                point.inquiries,
                "",
                "",
                "",
                "",
                overview.days,
                overview.start_at,
                overview.end_at,
            )

        for listing in overview.top_listings:
            yield (
                "listing",
                "",
                listing.listing_id,
                listing.title,
                listing.city,
                listing.state,
                listing.views,
                listing.favorites,
                listing.inquiries,
                "",
                "",
                "",
                "",
                overview.days,
                overview.start_at,
                overview.end_at,
            )

        for source in overview.sources:
            yield (
                "source",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                source.category,
                "",
                source.count,
                overview.days,
                overview.start_at,
                overview.end_at,
            )

        for referrer in overview.referring_sites:
            yield (
                "referrer",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "referral",
                referrer.host,
                referrer.count,
                overview.days,
                overview.start_at,
                overview.end_at,
            )

    output = build_spooled_csv(headers, csv_rows())
    date_stamp = datetime.now(timezone.utc).date().isoformat()
    return _download_response(
        output,
        f"analytics-{days}-days-{date_stamp}.csv",
    )

"""Business helpers for consistent lead creation and activity history."""

from sqlalchemy.orm import Session

from app.db.models import Lead, LeadActivity
from app.schemas.lead import LeadCreate


def record_lead_activity(
    db: Session,
    lead: Lead,
    *,
    activity_type: str,
    actor_email: str,
    note: str | None = None,
    details: dict | None = None,
) -> LeadActivity:
    activity = LeadActivity(
        lead_id=lead.id,
        activity_type=activity_type,
        actor_email=actor_email.strip().lower(),
        note=note,
        details=details or {},
    )
    db.add(activity)
    return activity


def create_lead(
    db: Session,
    payload: LeadCreate,
    *,
    actor_email: str,
) -> Lead:
    """Create one inquiry and stage its initial business-history event."""
    data = payload.model_dump()
    data["contact_name"] = payload.contact_name.strip()
    data["contact_email"] = str(payload.contact_email).strip().lower()
    data["contact_phone"] = (
        payload.contact_phone.strip() if payload.contact_phone else None
    )
    data["message"] = payload.message.strip() if payload.message else None
    data["source"] = payload.source.strip() if payload.source else None

    lead = Lead(
        **data,
        status="New",
    )
    db.add(lead)
    db.flush()

    record_lead_activity(
        db,
        lead,
        activity_type="created",
        actor_email=actor_email,
        details={
            "inquiry_type": lead.inquiry_type,
            "listing_id": lead.listing_id,
            "source": lead.source,
        },
    )
    return lead

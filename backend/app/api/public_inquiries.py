"""Verified public-user contact and showing request flows."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import AgentProfile, Lead, Listing, User
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_verified_public_user
from app.schemas.lead import LeadCreate
from app.schemas.public_inquiry import (
    PublicInquiryCreate,
    PublicInquiryList,
    PublicInquiryRead,
)
from app.services.leads import create_lead
from app.services.site_settings import read_site_settings


router = APIRouter(
    prefix="/public/account/inquiries",
    tags=["Public Inquiries"],
)

PUBLIC_LISTING_STATUSES = ("Active", "Pending", "Sold")


def _public_listing_or_404(db: Session, listing_id: int) -> Listing:
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
            detail="Listing not found",
        )
    return listing


def _destination_label(db: Session, lead: Lead) -> str:
    if lead.assigned_agent_id is not None:
        agent = (
            db.query(AgentProfile)
            .filter(AgentProfile.id == lead.assigned_agent_id)
            .first()
        )
        if agent is not None and agent.is_active and agent.is_public:
            return agent.full_name
    return "Juniper & Lane Realty"


def _serialize_public_inquiry(db: Session, lead: Lead) -> PublicInquiryRead:
    listing_title = None
    if lead.listing_id is not None:
        listing = db.query(Listing).filter(Listing.id == lead.listing_id).first()
        listing_title = listing.title if listing is not None else None

    return PublicInquiryRead(
        id=lead.id,
        inquiry_type=lead.inquiry_type,
        status=lead.status,
        listing_id=lead.listing_id,
        listing_title=listing_title,
        message=lead.message,
        preferred_at=lead.preferred_at,
        destination_label=_destination_label(db, lead),
        created_at=lead.created_at,
    )


@router.get("", response_model=PublicInquiryList)
def list_my_inquiries(
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> PublicInquiryList:
    rows = (
        db.query(Lead)
        .filter(
            Lead.requester_user_id == user.id,
            Lead.inquiry_type.in_(("contact", "showing")),
        )
        .order_by(Lead.created_at.desc(), Lead.id.desc())
        .all()
    )
    return PublicInquiryList(
        items=[_serialize_public_inquiry(db, lead) for lead in rows],
        total=len(rows),
    )


@router.post(
    "",
    response_model=PublicInquiryRead,
    status_code=status.HTTP_201_CREATED,
)
def submit_inquiry(
    payload: PublicInquiryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> PublicInquiryRead:
    settings = read_site_settings(db)

    if payload.inquiry_type == "contact" and not settings.enable_contact_requests:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contact requests are currently disabled",
        )
    if payload.inquiry_type == "showing" and not settings.enable_showing_requests:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Showing requests are currently disabled",
        )

    existing = (
        db.query(Lead)
        .filter(Lead.public_submission_key == payload.submission_key)
        .first()
    )
    if existing is not None:
        if (
            existing.requester_user_id == user.id
            and existing.inquiry_type == payload.inquiry_type
            and existing.listing_id == payload.listing_id
        ):
            return _serialize_public_inquiry(db, existing)

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Submission key already used",
        )

    listing = (
        _public_listing_or_404(db, payload.listing_id)
        if payload.listing_id is not None
        else None
    )

    assigned_agent_id = None
    if listing is not None and listing.agent_id is not None:
        assigned_agent = (
            db.query(AgentProfile)
            .filter(
                AgentProfile.id == listing.agent_id,
                AgentProfile.is_active.is_(True),
            )
            .first()
        )
        if assigned_agent is not None:
            assigned_agent_id = assigned_agent.id

    lead_payload = LeadCreate(
        inquiry_type=payload.inquiry_type,
        requester_user_id=user.id,
        contact_name=(user.full_name or user.email).strip(),
        contact_email=user.email,
        contact_phone=user.phone,
        listing_id=listing.id if listing is not None else None,
        message=payload.message,
        preferred_at=payload.preferred_at,
        source="public_listing" if listing is not None else "public_contact",
        assigned_agent_id=assigned_agent_id,
        assigned_user_id=None,
    )
    lead = create_lead(
        db,
        lead_payload,
        actor_email=user.email,
    )
    lead.public_submission_key = payload.submission_key
    db.commit()
    db.refresh(lead)

    return _serialize_public_inquiry(db, lead)

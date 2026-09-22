"""Internal lead and inquiry management for staff and administrators."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models import AgentProfile, Lead, Listing, User
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_staff_or_admin
from app.schemas.lead import (
    AssignmentOption,
    AssignmentOptionsRead,
    LeadCreate,
    LeadListRead,
    LeadNoteCreate,
    LeadRead,
    LeadStatus,
    LeadType,
    LeadUpdate,
)
from app.services.audit import record_audit_event
from app.services.leads import create_lead, record_lead_activity


router = APIRouter(prefix="/leads", tags=["Leads"])


def _lead_or_404(db: Session, lead_id: int) -> Lead:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )
    return lead


def _validate_listing(db: Session, listing_id: int | None) -> None:
    if listing_id is None:
        return
    if db.query(Listing).filter(Listing.id == listing_id).first() is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Listing not found",
        )


def _validate_requester(db: Session, user_id: int | None) -> None:
    if user_id is None:
        return
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or user.role != "public_user":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Requester must reference a public user",
        )


def _validate_assignment(
    db: Session,
    *,
    agent_id: int | None,
    user_id: int | None,
) -> None:
    if agent_id is not None and user_id is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Lead can be assigned to an agent or staff user, not both",
        )

    if agent_id is not None:
        agent = (
            db.query(AgentProfile)
            .filter(
                AgentProfile.id == agent_id,
                AgentProfile.is_active.is_(True),
            )
            .first()
        )
        if agent is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Assigned agent must be active",
            )

    if user_id is not None:
        user = (
            db.query(User)
            .filter(
                User.id == user_id,
                User.is_active.is_(True),
                User.archived_at.is_(None),
                User.role.in_(("admin", "staff")),
            )
            .first()
        )
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Assigned staff user must be active",
            )


def _serialize_lead(db: Session, lead: Lead, *, include_activity: bool) -> LeadRead:
    listing_title = None
    if lead.listing_id is not None:
        listing = db.query(Listing).filter(Listing.id == lead.listing_id).first()
        listing_title = listing.title if listing else None

    assigned_label = None
    if lead.assigned_agent_id is not None:
        agent = (
            db.query(AgentProfile)
            .filter(AgentProfile.id == lead.assigned_agent_id)
            .first()
        )
        assigned_label = agent.full_name if agent else None
    elif lead.assigned_user_id is not None:
        user = db.query(User).filter(User.id == lead.assigned_user_id).first()
        assigned_label = (
            user.full_name or user.email
            if user is not None
            else None
        )

    activities = []
    if include_activity:
        activities = [
            {
                "id": item.id,
                "activity_type": item.activity_type,
                "actor_email": item.actor_email,
                "note": item.note,
                "details": item.details,
                "created_at": item.created_at,
            }
            for item in lead.activities
        ]

    return LeadRead.model_validate(
        {
            "id": lead.id,
            "inquiry_type": lead.inquiry_type,
            "status": lead.status,
            "requester_user_id": lead.requester_user_id,
            "contact_name": lead.contact_name,
            "contact_email": lead.contact_email,
            "contact_phone": lead.contact_phone,
            "listing_id": lead.listing_id,
            "listing_title": listing_title,
            "message": lead.message,
            "preferred_at": lead.preferred_at,
            "source": lead.source,
            "assigned_agent_id": lead.assigned_agent_id,
            "assigned_user_id": lead.assigned_user_id,
            "assigned_to_label": assigned_label,
            "created_at": lead.created_at,
            "updated_at": lead.updated_at,
            "activities": activities,
        }
    )


@router.get("/assignment-options", response_model=AssignmentOptionsRead)
def assignment_options(
    db: Session = Depends(get_db),
    _: str = Depends(require_staff_or_admin),
) -> AssignmentOptionsRead:
    agents = (
        db.query(AgentProfile)
        .filter(AgentProfile.is_active.is_(True))
        .order_by(AgentProfile.full_name.asc())
        .all()
    )
    users = (
        db.query(User)
        .filter(
            User.is_active.is_(True),
            User.archived_at.is_(None),
            User.role.in_(("admin", "staff")),
        )
        .order_by(User.full_name.asc(), User.email.asc())
        .all()
    )

    items = [
        AssignmentOption(
            kind="agent",
            id=agent.id,
            name=agent.full_name,
            subtitle=agent.professional_title,
        )
        for agent in agents
    ]
    items.extend(
        AssignmentOption(
            kind="staff",
            id=user.id,
            name=user.full_name or user.email,
            subtitle=user.role,
        )
        for user in users
    )
    return AssignmentOptionsRead(items=items)


@router.get("", response_model=LeadListRead)
def list_leads(
    lead_status: LeadStatus | None = Query(None, alias="status"),
    inquiry_type: LeadType | None = Query(None),
    q: str | None = Query(None, max_length=120),
    db: Session = Depends(get_db),
    _: str = Depends(require_staff_or_admin),
) -> LeadListRead:
    query = db.query(Lead)

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

    rows = query.order_by(Lead.created_at.desc(), Lead.id.desc()).all()
    return LeadListRead(
        items=[_serialize_lead(db, lead, include_activity=False) for lead in rows],
        total=len(rows),
    )


@router.get("/{lead_id}", response_model=LeadRead)
def get_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_staff_or_admin),
) -> LeadRead:
    return _serialize_lead(
        db,
        _lead_or_404(db, lead_id),
        include_activity=True,
    )


@router.post("", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
def create_internal_lead(
    payload: LeadCreate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_staff_or_admin),
) -> LeadRead:
    _validate_listing(db, payload.listing_id)
    _validate_requester(db, payload.requester_user_id)
    _validate_assignment(
        db,
        agent_id=payload.assigned_agent_id,
        user_id=payload.assigned_user_id,
    )

    lead = create_lead(db, payload, actor_email=actor_email)
    record_audit_event(
        db,
        actor_email=actor_email,
        action="lead.created",
        target_type="lead",
        target_id=lead.id,
        details={"inquiry_type": lead.inquiry_type},
    )
    db.commit()
    db.refresh(lead)
    return _serialize_lead(db, lead, include_activity=True)


@router.put("/{lead_id}", response_model=LeadRead)
def update_lead(
    lead_id: int,
    payload: LeadUpdate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_staff_or_admin),
) -> LeadRead:
    lead = _lead_or_404(db, lead_id)
    changes = payload.model_dump(exclude_unset=True)

    new_agent_id = changes.get("assigned_agent_id", lead.assigned_agent_id)
    new_user_id = changes.get("assigned_user_id", lead.assigned_user_id)

    # Explicitly choosing one assignee clears the other assignment type.
    if "assigned_agent_id" in changes and changes["assigned_agent_id"] is not None:
        new_user_id = None
        changes["assigned_user_id"] = None
    if "assigned_user_id" in changes and changes["assigned_user_id"] is not None:
        new_agent_id = None
        changes["assigned_agent_id"] = None

    assignment_changed = (
        new_agent_id != lead.assigned_agent_id
        or new_user_id != lead.assigned_user_id
    )

    if assignment_changed:
        _validate_assignment(
            db,
            agent_id=new_agent_id,
            user_id=new_user_id,
        )

    if "status" in changes and changes["status"] != lead.status:
        record_lead_activity(
            db,
            lead,
            activity_type="status_changed",
            actor_email=actor_email,
            details={"from": lead.status, "to": changes["status"]},
        )

    if assignment_changed:
        record_lead_activity(
            db,
            lead,
            activity_type="assignment_changed",
            actor_email=actor_email,
            details={
                "from_agent_id": lead.assigned_agent_id,
                "to_agent_id": new_agent_id,
                "from_user_id": lead.assigned_user_id,
                "to_user_id": new_user_id,
            },
        )

    for key, value in changes.items():
        setattr(lead, key, value)

    if "assigned_agent_id" not in changes:
        lead.assigned_agent_id = new_agent_id
    if "assigned_user_id" not in changes:
        lead.assigned_user_id = new_user_id

    record_audit_event(
        db,
        actor_email=actor_email,
        action="lead.updated",
        target_type="lead",
        target_id=lead.id,
        details={"changed_fields": sorted(changes.keys())},
    )
    db.commit()
    db.refresh(lead)
    return _serialize_lead(db, lead, include_activity=True)


@router.post("/{lead_id}/notes", response_model=LeadRead)
def add_lead_note(
    lead_id: int,
    payload: LeadNoteCreate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_staff_or_admin),
) -> LeadRead:
    lead = _lead_or_404(db, lead_id)
    note = payload.note.strip()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Note cannot be blank",
        )

    record_lead_activity(
        db,
        lead,
        activity_type="note",
        actor_email=actor_email,
        note=note,
    )
    record_audit_event(
        db,
        actor_email=actor_email,
        action="lead.note_added",
        target_type="lead",
        target_id=lead.id,
        details={"note_length": len(note)},
    )
    db.commit()
    db.refresh(lead)
    return _serialize_lead(db, lead, include_activity=True)

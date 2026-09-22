"""Agent profile administration and anonymous public profiles."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.models import AgentProfile, Listing, Office
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_admin, require_staff_or_admin
from app.schemas.agent import (
    AgentProfileCreate,
    AgentProfileRead,
    AgentProfileUpdate,
    PublicAgentProfile,
    PublicAgentSummary,
)
from app.services.audit import record_audit_event


admin_router = APIRouter(prefix="/agents", tags=["Agents"])
public_router = APIRouter(prefix="/public/agents", tags=["Public Agents"])


def _validate_office_assignment(db: Session, office_id: int | None) -> None:
    if office_id is None:
        return

    office = (
        db.query(Office)
        .filter(
            Office.id == office_id,
            Office.is_active.is_(True),
        )
        .first()
    )
    if office is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assigned office must reference an active office",
        )


def _serialize_public_agent(agent: AgentProfile) -> PublicAgentProfile:
    office = agent.office
    office_is_public = (
        office is not None and office.is_active and office.is_public
    )

    data = {
        "id": agent.id,
        "full_name": agent.full_name,
        "professional_title": agent.professional_title,
        "email": agent.email,
        "phone": agent.phone,
        "photo_url": agent.photo_url,
        "office_name": (
            office.name
            if office_is_public
            else agent.office_name if agent.office_id is None else None
        ),
        "office": office if office_is_public else None,
        "bio": agent.bio,
    }
    return PublicAgentProfile.model_validate(data)


def _agent_or_404(db: Session, agent_id: int) -> AgentProfile:
    agent = db.query(AgentProfile).filter(AgentProfile.id == agent_id).first()
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    return _serialize_public_agent(agent)


@admin_router.get("", response_model=list[AgentProfileRead])
def list_agents(
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
    _: str = Depends(require_staff_or_admin),
) -> list[AgentProfile]:
    query = db.query(AgentProfile)
    if active_only:
        query = query.filter(AgentProfile.is_active.is_(True))
    return query.order_by(AgentProfile.full_name.asc(), AgentProfile.id.asc()).all()


@admin_router.get("/{agent_id}", response_model=AgentProfileRead)
def get_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
) -> AgentProfile:
    return _agent_or_404(db, agent_id)


@admin_router.post(
    "",
    response_model=AgentProfileRead,
    status_code=status.HTTP_201_CREATED,
)
def create_agent(
    payload: AgentProfileCreate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_admin),
) -> AgentProfile:
    _validate_office_assignment(db, payload.office_id)
    agent = AgentProfile(**payload.model_dump())
    db.add(agent)
    db.flush()

    record_audit_event(
        db,
        actor_email=actor_email,
        action="agent.created",
        target_type="agent",
        target_id=agent.id,
        details={
            "full_name": agent.full_name,
            "is_public": agent.is_public,
            "is_active": agent.is_active,
        },
    )
    db.commit()
    db.refresh(agent)
    return agent


@admin_router.put("/{agent_id}", response_model=AgentProfileRead)
def update_agent(
    agent_id: int,
    payload: AgentProfileUpdate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_admin),
) -> AgentProfile:
    agent = _agent_or_404(db, agent_id)
    changes = payload.model_dump(exclude_unset=True)
    if "office_id" in changes:
        _validate_office_assignment(db, changes["office_id"])

    if "full_name" in changes and changes["full_name"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assigned agent full name is required",
        )
    if "email" in changes and changes["email"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assigned agent email is required",
        )

    for key, value in changes.items():
        setattr(agent, key, value)

    record_audit_event(
        db,
        actor_email=actor_email,
        action="agent.updated",
        target_type="agent",
        target_id=agent.id,
        details={"changed_fields": sorted(changes.keys())},
    )
    db.commit()
    db.refresh(agent)
    return agent


@admin_router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_admin),
) -> Response:
    agent = _agent_or_404(db, agent_id)

    db.query(Listing).filter(Listing.agent_id == agent.id).update(
        {Listing.agent_id: None},
        synchronize_session=False,
    )
    record_audit_event(
        db,
        actor_email=actor_email,
        action="agent.deleted",
        target_type="agent",
        target_id=agent.id,
        details={"full_name": agent.full_name},
    )
    db.delete(agent)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@public_router.get("/{agent_id}", response_model=PublicAgentProfile)
def get_public_agent(
    agent_id: int,
    db: Session = Depends(get_db),
) -> PublicAgentProfile:
    agent = (
        db.query(AgentProfile)
        .filter(
            AgentProfile.id == agent_id,
            AgentProfile.is_active.is_(True),
            AgentProfile.is_public.is_(True),
        )
        .first()
    )
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    return agent

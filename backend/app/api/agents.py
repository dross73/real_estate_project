"""Agent profile administration and anonymous public profiles."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.models import AgentProfile, Listing
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_admin
from app.schemas.agent import (
    AgentProfileCreate,
    AgentProfileRead,
    AgentProfileUpdate,
    PublicAgentSummary,
)
from app.services.audit import record_audit_event


admin_router = APIRouter(prefix="/agents", tags=["Agents"])
public_router = APIRouter(prefix="/public/agents", tags=["Public Agents"])


def _agent_or_404(db: Session, agent_id: int) -> AgentProfile:
    agent = db.query(AgentProfile).filter(AgentProfile.id == agent_id).first()
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    return agent


@admin_router.get("", response_model=list[AgentProfileRead])
def list_agents(
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
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


@public_router.get("/{agent_id}", response_model=PublicAgentSummary)
def get_public_agent(
    agent_id: int,
    db: Session = Depends(get_db),
) -> AgentProfile:
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

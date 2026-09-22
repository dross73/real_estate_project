"""Office administration and public office presentation."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.models import AgentProfile, Listing, Office
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_admin, require_staff_or_admin
from app.schemas.office import OfficeCreate, OfficeRead, OfficeUpdate, PublicOfficeSummary
from app.services.audit import record_audit_event


admin_router = APIRouter(prefix="/offices", tags=["Offices"])
public_router = APIRouter(prefix="/public/offices", tags=["Public Offices"])


def _office_or_404(db: Session, office_id: int) -> Office:
    office = db.query(Office).filter(Office.id == office_id).first()
    if office is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Office not found",
        )
    return office


@admin_router.get("", response_model=list[OfficeRead])
def list_offices(
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
    _: str = Depends(require_staff_or_admin),
) -> list[Office]:
    query = db.query(Office)
    if active_only:
        query = query.filter(Office.is_active.is_(True))
    return query.order_by(Office.name.asc(), Office.id.asc()).all()


@admin_router.get("/{office_id}", response_model=OfficeRead)
def get_office(
    office_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_staff_or_admin),
) -> Office:
    return _office_or_404(db, office_id)


@admin_router.post("", response_model=OfficeRead, status_code=status.HTTP_201_CREATED)
def create_office(
    payload: OfficeCreate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_admin),
) -> Office:
    office = Office(**payload.model_dump())
    db.add(office)
    db.flush()

    record_audit_event(
        db,
        actor_email=actor_email,
        action="office.created",
        target_type="office",
        target_id=office.id,
        details={"name": office.name, "is_public": office.is_public},
    )
    db.commit()
    db.refresh(office)
    return office


@admin_router.put("/{office_id}", response_model=OfficeRead)
def update_office(
    office_id: int,
    payload: OfficeUpdate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_admin),
) -> Office:
    office = _office_or_404(db, office_id)
    changes = payload.model_dump(exclude_unset=True)

    for key, value in changes.items():
        setattr(office, key, value)

    record_audit_event(
        db,
        actor_email=actor_email,
        action="office.updated",
        target_type="office",
        target_id=office.id,
        details={"changed_fields": sorted(changes.keys())},
    )
    db.commit()
    db.refresh(office)
    return office


@admin_router.delete("/{office_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_office(
    office_id: int,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_admin),
) -> Response:
    office = _office_or_404(db, office_id)

    db.query(AgentProfile).filter(AgentProfile.office_id == office.id).update(
        {AgentProfile.office_id: None},
        synchronize_session=False,
    )
    db.query(Listing).filter(Listing.office_id == office.id).update(
        {Listing.office_id: None},
        synchronize_session=False,
    )

    record_audit_event(
        db,
        actor_email=actor_email,
        action="office.deleted",
        target_type="office",
        target_id=office.id,
        details={"name": office.name},
    )
    db.delete(office)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@public_router.get("/{office_id}", response_model=PublicOfficeSummary)
def get_public_office(
    office_id: int,
    db: Session = Depends(get_db),
) -> Office:
    office = (
        db.query(Office)
        .filter(
            Office.id == office_id,
            Office.is_active.is_(True),
            Office.is_public.is_(True),
        )
        .first()
    )
    if office is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Office not found",
        )
    return office

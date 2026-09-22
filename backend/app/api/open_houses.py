"""Staff/admin CRUD endpoints for listing open-house schedules."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.models import Listing, OpenHouseEvent
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_staff_or_admin
from app.schemas.open_house import (
    OpenHouseCreate,
    OpenHouseRead,
    OpenHouseUpdate,
)
from app.services.audit import record_audit_event


router = APIRouter(
    prefix="/listings/{listing_id}/open-houses",
    tags=["Open Houses"],
)


def _get_listing(db: Session, listing_id: int) -> Listing:
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )
    return listing


def _get_event(db: Session, listing_id: int, event_id: int) -> OpenHouseEvent:
    event = (
        db.query(OpenHouseEvent)
        .filter(
            OpenHouseEvent.id == event_id,
            OpenHouseEvent.listing_id == listing_id,
        )
        .first()
    )
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Open house not found",
        )
    return event


def _as_utc(value: datetime) -> datetime:
    """Normalize database datetimes for reliable comparisons in every backend."""
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _validate_schedule(starts_at: datetime, ends_at: datetime) -> None:
    starts_at = _as_utc(starts_at)
    ends_at = _as_utc(ends_at)
    now = datetime.now(timezone.utc)
    if starts_at <= now:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Open house must start in the future",
        )
    if ends_at <= starts_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Open house end time must be after its start time",
        )


@router.get("", response_model=list[OpenHouseRead])
def list_open_houses(
    listing_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_staff_or_admin),
) -> list[OpenHouseRead]:
    _get_listing(db, listing_id)
    rows = (
        db.query(OpenHouseEvent)
        .filter(OpenHouseEvent.listing_id == listing_id)
        .order_by(OpenHouseEvent.starts_at.asc(), OpenHouseEvent.id.asc())
        .all()
    )
    return [OpenHouseRead.model_validate(row) for row in rows]


@router.post(
    "",
    response_model=OpenHouseRead,
    status_code=status.HTTP_201_CREATED,
)
def create_open_house(
    listing_id: int,
    payload: OpenHouseCreate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_staff_or_admin),
) -> OpenHouseRead:
    listing = _get_listing(db, listing_id)

    event = OpenHouseEvent(
        listing_id=listing.id,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
    )
    db.add(event)
    db.flush()

    record_audit_event(
        db,
        actor_email=actor_email,
        action="open_house.created",
        target_type="listing",
        target_id=listing.id,
        details={
            "open_house_id": event.id,
            "starts_at": event.starts_at.isoformat(),
            "ends_at": event.ends_at.isoformat(),
        },
    )

    db.commit()
    db.refresh(event)
    return OpenHouseRead.model_validate(event)


@router.put("/{event_id}", response_model=OpenHouseRead)
def update_open_house(
    listing_id: int,
    event_id: int,
    payload: OpenHouseUpdate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_staff_or_admin),
) -> OpenHouseRead:
    _get_listing(db, listing_id)
    event = _get_event(db, listing_id, event_id)

    changes = payload.model_dump(exclude_unset=True)
    starts_at = changes.get("starts_at", event.starts_at)
    ends_at = changes.get("ends_at", event.ends_at)
    _validate_schedule(starts_at, ends_at)

    for key, value in changes.items():
        setattr(event, key, value)
    event.updated_at = datetime.now(timezone.utc)

    record_audit_event(
        db,
        actor_email=actor_email,
        action="open_house.updated",
        target_type="listing",
        target_id=listing_id,
        details={
            "open_house_id": event.id,
            "changed_fields": sorted(changes.keys()),
        },
    )

    db.commit()
    db.refresh(event)
    return OpenHouseRead.model_validate(event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_open_house(
    listing_id: int,
    event_id: int,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_staff_or_admin),
) -> Response:
    _get_listing(db, listing_id)
    event = _get_event(db, listing_id, event_id)

    record_audit_event(
        db,
        actor_email=actor_email,
        action="open_house.deleted",
        target_type="listing",
        target_id=listing_id,
        details={"open_house_id": event.id},
    )

    db.delete(event)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

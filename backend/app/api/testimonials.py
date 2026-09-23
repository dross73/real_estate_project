"""Internal testimonial moderation and verified public submission."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.models import Testimonial, User
from app.db.session import get_db
from app.dependencies.auth_dependencies import (
    require_staff_or_admin,
    require_verified_public_user,
)
from app.schemas.testimonial import (
    PublicTestimonialCreate,
    PublicTestimonialRead,
    TestimonialCreate,
    TestimonialRead,
    TestimonialSource,
    TestimonialStatus,
    TestimonialUpdate,
)
from app.services.audit import record_audit_event
from app.services.site_settings import read_site_settings


admin_router = APIRouter(prefix="/testimonials", tags=["Testimonials"])
public_router = APIRouter(prefix="/public/testimonials", tags=["Public Testimonials"])


def _testimonial_or_404(db: Session, testimonial_id: int) -> Testimonial:
    testimonial = (
        db.query(Testimonial)
        .filter(Testimonial.id == testimonial_id)
        .first()
    )
    if testimonial is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Testimonial not found",
        )
    return testimonial


def _apply_moderation(
    testimonial: Testimonial,
    *,
    new_status: str,
    actor_email: str,
) -> None:
    testimonial.status = new_status

    if new_status in ("Approved", "Rejected"):
        testimonial.moderated_by_email = actor_email.strip().lower()
        testimonial.moderated_at = datetime.now(timezone.utc)
    else:
        testimonial.moderated_by_email = None
        testimonial.moderated_at = None


@admin_router.get("", response_model=list[TestimonialRead])
def list_testimonials(
    testimonial_status: TestimonialStatus | None = Query(None, alias="status"),
    source: TestimonialSource | None = Query(None),
    db: Session = Depends(get_db),
    _: str = Depends(require_staff_or_admin),
) -> list[Testimonial]:
    query = db.query(Testimonial)

    if testimonial_status is not None:
        query = query.filter(Testimonial.status == testimonial_status)
    if source is not None:
        query = query.filter(Testimonial.source == source)

    return (
        query
        .order_by(Testimonial.created_at.desc(), Testimonial.id.desc())
        .all()
    )


@admin_router.get("/{testimonial_id}", response_model=TestimonialRead)
def get_testimonial(
    testimonial_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_staff_or_admin),
) -> Testimonial:
    return _testimonial_or_404(db, testimonial_id)


@admin_router.post(
    "",
    response_model=TestimonialRead,
    status_code=status.HTTP_201_CREATED,
)
def create_testimonial(
    payload: TestimonialCreate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_staff_or_admin),
) -> Testimonial:
    testimonial = Testimonial(
        author_name=payload.author_name,
        body=payload.body,
        rating=payload.rating,
        source="internal",
        status=payload.status,
    )

    if payload.status in ("Approved", "Rejected"):
        testimonial.moderated_by_email = actor_email.strip().lower()
        testimonial.moderated_at = datetime.now(timezone.utc)

    db.add(testimonial)
    db.flush()

    record_audit_event(
        db,
        actor_email=actor_email,
        action="testimonial.created",
        target_type="testimonial",
        target_id=testimonial.id,
        details={
            "source": testimonial.source,
            "status": testimonial.status,
        },
    )
    db.commit()
    db.refresh(testimonial)
    return testimonial


@admin_router.put("/{testimonial_id}", response_model=TestimonialRead)
def update_testimonial(
    testimonial_id: int,
    payload: TestimonialUpdate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_staff_or_admin),
) -> Testimonial:
    testimonial = _testimonial_or_404(db, testimonial_id)
    changes = payload.model_dump(exclude_unset=True)
    previous_status = testimonial.status

    for key in ("author_name", "body", "rating"):
        if key in changes:
            setattr(testimonial, key, changes[key])

    if "status" in changes and changes["status"] != testimonial.status:
        _apply_moderation(
            testimonial,
            new_status=changes["status"],
            actor_email=actor_email,
        )

    record_audit_event(
        db,
        actor_email=actor_email,
        action="testimonial.updated",
        target_type="testimonial",
        target_id=testimonial.id,
        details={
            "changed_fields": sorted(changes.keys()),
            "from_status": previous_status,
            "to_status": testimonial.status,
        },
    )
    db.commit()
    db.refresh(testimonial)
    return testimonial


@admin_router.delete(
    "/{testimonial_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_testimonial(
    testimonial_id: int,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_staff_or_admin),
) -> Response:
    testimonial = _testimonial_or_404(db, testimonial_id)

    record_audit_event(
        db,
        actor_email=actor_email,
        action="testimonial.deleted",
        target_type="testimonial",
        target_id=testimonial.id,
        details={
            "source": testimonial.source,
            "status": testimonial.status,
        },
    )
    db.delete(testimonial)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@public_router.get("", response_model=list[PublicTestimonialRead])
def list_public_testimonials(
    limit: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db),
) -> list[Testimonial]:
    settings = read_site_settings(db)
    if not settings.show_testimonials:
        return []

    return (
        db.query(Testimonial)
        .filter(Testimonial.status == "Approved")
        .order_by(Testimonial.created_at.desc(), Testimonial.id.desc())
        .limit(limit)
        .all()
    )


@public_router.post(
    "",
    response_model=PublicTestimonialRead,
    status_code=status.HTTP_201_CREATED,
)
def submit_public_testimonial(
    payload: PublicTestimonialCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> Testimonial:
    settings = read_site_settings(db)

    if not settings.enable_testimonial_submissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public testimonial submission is currently disabled",
        )

    testimonial = Testimonial(
        author_user_id=user.id,
        author_name=(user.full_name or "Verified customer").strip(),
        body=payload.body,
        rating=payload.rating,
        source="public",
        status="Pending",
    )
    db.add(testimonial)
    db.flush()

    record_audit_event(
        db,
        actor_email=user.email,
        action="testimonial.submitted",
        target_type="testimonial",
        target_id=testimonial.id,
        details={"source": "public", "status": "Pending"},
    )
    db.commit()
    db.refresh(testimonial)
    return testimonial

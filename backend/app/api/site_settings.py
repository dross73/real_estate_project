"""Admin and public APIs for brokerage/site settings."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_admin
from app.schemas.site_settings import SiteSettingsRead, SiteSettingsUpdate
from app.services.audit import record_audit_event
from app.services.site_settings import (
    read_site_settings,
    update_site_settings,
)


settings = get_settings()

admin_router = APIRouter(
    prefix="/site-settings",
    tags=["Site Settings"],
    dependencies=[Depends(require_admin)],
)

public_router = APIRouter(
    prefix="/public/site-settings",
    tags=["Public Site Settings"],
)


@admin_router.get(
    "",
    response_model=SiteSettingsRead,
    status_code=status.HTTP_200_OK,
)
def get_admin_site_settings(
    db: Session = Depends(get_db),
) -> SiteSettingsRead:
    """Return the effective site configuration for administrators."""
    return read_site_settings(db)


@admin_router.put(
    "",
    response_model=SiteSettingsRead,
    status_code=status.HTTP_200_OK,
)
def replace_site_settings(
    payload: SiteSettingsUpdate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_admin),
) -> SiteSettingsRead:
    """Validate, persist, and audit the complete admin-managed settings form."""
    if payload.listing_photo_max_count > settings.LISTING_PHOTO_MAX_COUNT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Listing photo maximum cannot exceed the server maximum "
                f"of {settings.LISTING_PHOTO_MAX_COUNT}"
            ),
        )

    update_site_settings(db, payload)

    record_audit_event(
        db,
        actor_email=actor_email,
        action="settings.site_updated",
        target_type="site_settings",
        target_id=1,
        details={
            "show_about": payload.show_about,
            "show_contact": payload.show_contact,
            "show_testimonials": payload.show_testimonials,
            "listing_photo_max_count": payload.listing_photo_max_count,
        },
    )

    db.commit()
    return read_site_settings(db)


@public_router.get(
    "",
    response_model=SiteSettingsRead,
    status_code=status.HTTP_200_OK,
)
def get_public_site_settings(
    db: Session = Depends(get_db),
) -> SiteSettingsRead:
    """Return public-safe branding, content, and feature visibility settings."""
    return read_site_settings(db)

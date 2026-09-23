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
            "show_privacy": payload.show_privacy,
            "show_terms": payload.show_terms,
            "privacy_consent_enabled": payload.privacy_consent_enabled,
            "privacy_analytics_category_enabled": (
                payload.privacy_analytics_category_enabled
            ),
            "privacy_marketing_category_enabled": (
                payload.privacy_marketing_category_enabled
            ),
            "require_internal_mfa": payload.require_internal_mfa,
            "show_testimonials": payload.show_testimonials,
            "enable_testimonial_submissions": payload.enable_testimonial_submissions,
            "enable_contact_requests": payload.enable_contact_requests,
            "enable_showing_requests": payload.enable_showing_requests,
            "listing_photo_max_count": payload.listing_photo_max_count,
        },
    )

    db.commit()
    return read_site_settings(db)


@public_router.get(
    "",
    response_model=SiteSettingsRead,
    response_model_exclude={"require_internal_mfa"},
    status_code=status.HTTP_200_OK,
)
def get_public_site_settings(
    db: Session = Depends(get_db),
) -> SiteSettingsRead:
    """Return only settings and content currently eligible for public use."""
    public_settings = read_site_settings(db)
    hidden_updates: dict[str, str | None] = {}

    if not public_settings.show_about:
        for field_name in (
            "about_title",
            "about_intro",
            "about_mission_title",
            "about_mission_copy",
            "about_history_title",
            "about_history_copy",
            "about_image_url",
            "about_team_title",
            "about_team_copy",
        ):
            hidden_updates[field_name] = None

    if not public_settings.show_privacy:
        hidden_updates["privacy_title"] = None
        hidden_updates["privacy_body"] = None

    if not public_settings.show_terms:
        hidden_updates["terms_title"] = None
        hidden_updates["terms_body"] = None

    return public_settings.model_copy(update=hidden_updates)

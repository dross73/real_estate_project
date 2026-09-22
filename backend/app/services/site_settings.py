"""Helpers for singleton brokerage/site settings and safe defaults."""

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import SiteSetting
from app.schemas.site_settings import SiteSettingsRead, SiteSettingsUpdate


settings = get_settings()

DEFAULT_SITE_SETTINGS = {
    "site_name": "Juniper & Lane",
    "site_descriptor": "Realty",
    "tagline": "A brighter tomorrow belongs here.",
    "logo_url": None,
    "phone": None,
    "email": None,
    "address_line1": None,
    "city": None,
    "state": None,
    "postal_code": None,
    "homepage_eyebrow": "Homes rooted in a brighter tomorrow",
    "homepage_title": "Local People. Lasting Places.",
    "homepage_intro": (
        "We help you find more than a house. We help you find your place "
        "in the community."
    ),
    "homepage_story_title": "We’re Invested in What Makes This Place Home.",
    "homepage_story_copy": (
        "From local expertise to lasting relationships, we’re here for the "
        "people, places, and possibilities that make strong communities "
        "worth calling home."
    ),
    "primary_color": "#13382b",
    "secondary_color": "#738c78",
    "show_about": True,
    "show_contact": True,
    "show_testimonials": False,
    "enable_testimonial_submissions": False,
    "enable_contact_requests": True,
    "enable_showing_requests": True,
    "listing_photo_max_count": 50,
}


def get_site_settings_record(db: Session) -> SiteSetting | None:
    """Return the singleton persisted row when it exists."""
    return db.query(SiteSetting).filter(SiteSetting.id == 1).first()


def effective_listing_photo_max_count(db: Session) -> int:
    """Apply the admin preference without exceeding the hard server ceiling."""
    record = get_site_settings_record(db)
    configured = (
        record.listing_photo_max_count
        if record is not None
        else DEFAULT_SITE_SETTINGS["listing_photo_max_count"]
    )
    return min(int(configured), settings.LISTING_PHOTO_MAX_COUNT)


def read_site_settings(db: Session) -> SiteSettingsRead:
    """Return persisted settings or safe Juniper & Lane defaults."""
    record = get_site_settings_record(db)

    if record is None:
        values = dict(DEFAULT_SITE_SETTINGS)
        values["listing_photo_max_count"] = min(
            int(values["listing_photo_max_count"]),
            settings.LISTING_PHOTO_MAX_COUNT,
        )
        return SiteSettingsRead(
            **values,
            hard_listing_photo_max_count=settings.LISTING_PHOTO_MAX_COUNT,
            updated_at=None,
        )

    payload = {
        key: getattr(record, key)
        for key in DEFAULT_SITE_SETTINGS
    }
    payload["listing_photo_max_count"] = effective_listing_photo_max_count(db)

    return SiteSettingsRead(
        **payload,
        hard_listing_photo_max_count=settings.LISTING_PHOTO_MAX_COUNT,
        updated_at=record.updated_at,
    )


def update_site_settings(
    db: Session,
    payload: SiteSettingsUpdate,
) -> SiteSetting:
    """Persist a complete validated settings payload into the singleton row."""
    record = get_site_settings_record(db)

    if record is None:
        record = SiteSetting(id=1)
        db.add(record)

    for field_name, value in payload.model_dump(mode="json").items():
        setattr(record, field_name, value)

    db.flush()
    return record

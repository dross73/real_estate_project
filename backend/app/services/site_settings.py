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
    "about_title": "Local roots. Thoughtful guidance.",
    "about_intro": (
        "Juniper & Lane pairs neighborhood knowledge with a practical, "
        "people-first approach to real estate."
    ),
    "about_mission_title": "A better real estate experience starts locally.",
    "about_mission_copy": (
        "We believe good guidance should feel clear, personal, and grounded "
        "in the communities our clients are choosing to call home."
    ),
    "about_history_title": "Built around the places we know.",
    "about_history_copy": (
        "Our work is centered on long-term relationships, local context, and "
        "helping people make confident decisions at every stage of a move."
    ),
    "about_image_url": None,
    "about_team_title": "People who know the community.",
    "about_team_copy": (
        "Our team brings together local market knowledge and responsive "
        "service without losing the personal feel of a neighborhood brokerage."
    ),
    "contact_hours": None,
    "show_privacy": False,
    "privacy_title": "Privacy Policy",
    "privacy_body": None,
    "show_terms": False,
    "terms_title": "Terms of Use",
    "terms_body": None,
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
    # Existing settings rows predate KAN-80, so keep the approved About copy
    # as a graceful fallback until an administrator customizes those fields.
    for field_name in (
        "about_title",
        "about_intro",
        "about_mission_title",
        "about_mission_copy",
        "about_history_title",
        "about_history_copy",
        "about_team_title",
        "about_team_copy",
    ):
        if payload[field_name] is None:
            payload[field_name] = DEFAULT_SITE_SETTINGS[field_name]

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

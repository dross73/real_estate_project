"""Schemas for admin-managed brokerage and public-site settings."""

from datetime import datetime
import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    return cleaned or None


class SiteSettingsBase(BaseModel):
    """Validated site settings shared by admin and public responses."""

    site_name: str = Field(min_length=1, max_length=120)
    site_descriptor: str | None = Field(default=None, max_length=80)
    tagline: str | None = Field(default=None, max_length=200)
    logo_url: str | None = Field(default=None, max_length=500)

    phone: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = None
    address_line1: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=50)
    postal_code: str | None = Field(default=None, max_length=20)

    homepage_eyebrow: str | None = Field(default=None, max_length=160)
    homepage_title: str | None = Field(default=None, max_length=180)
    homepage_intro: str | None = Field(default=None, max_length=1200)
    homepage_story_title: str | None = Field(default=None, max_length=180)
    homepage_story_copy: str | None = Field(default=None, max_length=1800)

    about_title: str | None = Field(default=None, max_length=180)
    about_intro: str | None = Field(default=None, max_length=2400)
    about_mission_title: str | None = Field(default=None, max_length=180)
    about_mission_copy: str | None = Field(default=None, max_length=4000)
    about_history_title: str | None = Field(default=None, max_length=180)
    about_history_copy: str | None = Field(default=None, max_length=4000)
    about_image_url: str | None = Field(default=None, max_length=2048)
    about_team_title: str | None = Field(default=None, max_length=180)
    about_team_copy: str | None = Field(default=None, max_length=4000)

    contact_hours: str | None = Field(default=None, max_length=2000)

    show_privacy: bool = False
    privacy_title: str | None = Field(default=None, max_length=180)
    privacy_body: str | None = Field(default=None, max_length=20000)
    show_terms: bool = False
    terms_title: str | None = Field(default=None, max_length=180)
    terms_body: str | None = Field(default=None, max_length=20000)

    privacy_consent_enabled: bool = False
    privacy_analytics_category_enabled: bool = False
    privacy_marketing_category_enabled: bool = False

    require_internal_mfa: bool = False

    primary_color: str = "#13382b"
    secondary_color: str = "#738c78"

    show_about: bool = True
    show_contact: bool = True
    show_testimonials: bool = False
    enable_testimonial_submissions: bool = False
    enable_contact_requests: bool = True
    enable_showing_requests: bool = True

    listing_photo_max_count: int = Field(default=50, ge=1, le=50)

    @field_validator(
        "site_name",
        "site_descriptor",
        "tagline",
        "logo_url",
        "phone",
        "address_line1",
        "city",
        "state",
        "postal_code",
        "homepage_eyebrow",
        "homepage_title",
        "homepage_intro",
        "homepage_story_title",
        "homepage_story_copy",
        "about_title",
        "about_intro",
        "about_mission_title",
        "about_mission_copy",
        "about_history_title",
        "about_history_copy",
        "about_image_url",
        "about_team_title",
        "about_team_copy",
        "contact_hours",
        "privacy_title",
        "privacy_body",
        "terms_title",
        "terms_body",
        mode="before",
    )
    @classmethod
    def normalize_text(cls, value):
        if isinstance(value, str):
            return _clean_optional(value)
        return value

    @model_validator(mode="after")
    def validate_enabled_legal_pages_have_content(self):
        """Do not publish an enabled legal page with no body content."""
        if self.show_privacy and not self.privacy_body:
            raise ValueError("Privacy Policy content is required when the page is enabled")
        if self.show_terms and not self.terms_body:
            raise ValueError("Terms of Use content is required when the page is enabled")
        return self

    @field_validator("primary_color", "secondary_color")
    @classmethod
    def validate_hex_color(cls, value: str) -> str:
        value = value.strip()
        if not HEX_COLOR_PATTERN.fullmatch(value):
            raise ValueError("Color must be a six-digit hex value such as #13382b")
        return value.lower()


class SiteSettingsUpdate(SiteSettingsBase):
    """Full admin update payload for the singleton settings record."""

    model_config = ConfigDict(extra="forbid")


class SiteSettingsRead(SiteSettingsBase):
    """Public-safe site settings plus the immutable server photo ceiling."""

    model_config = ConfigDict(from_attributes=True)

    hard_listing_photo_max_count: int = 50
    updated_at: datetime | None = None

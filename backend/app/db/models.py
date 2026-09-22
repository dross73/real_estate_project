# backend/app/db/models.py

"""
SQLAlchemy models for the project.

Models define the database tables and attach them to SQLAlchemy's metadata.
Importing this file does not connect to the database by itself.

"""

from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    JSON,
    String,
    Text,
    Numeric,
    DateTime,
    Boolean,
    ForeignKey,
    Table,
    UniqueConstraint,
)

from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

# Base is the SQLAlchemy declarative base defined in your session setup
# Importing Base ensures this model is registered in the same metadata.
from app.db.base import Base


class Listing(Base):
    """Real estate listing record used by internal and public experiences."""

    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Core listing identity and lifecycle.
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="Draft",
        index=True,
    )
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    hide_exact_address: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    agent_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("agent_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Property and pricing information.
    price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    property_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sqft: Mapped[int | None] = mapped_column(Integer, nullable=True)
    acreage: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    year_built: Mapped[int | None] = mapped_column(Integer, nullable=True)
    annual_property_taxes: Mapped[float | None] = mapped_column(
        Numeric(12, 2),
        nullable=True,
    )
    hoa_fee: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    hoa_fee_frequency: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Location and school information.
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(2), nullable=False)
    school_district: Mapped[str | None] = mapped_column(String(150), nullable=True)

    # Property characteristics.
    bedrooms: Mapped[int] = mapped_column(Integer, nullable=False)
    bathrooms: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)
    amenities: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    # Public content and optional attribution.
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mls_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source_attribution: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Audit fields.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True,
    )

    agent: Mapped["AgentProfile"] = relationship(
        "AgentProfile",
        back_populates="listings",
    )

    # Optimized photos belonging to this listing.
    photos: Mapped[list["ListingPhoto"]] = relationship(
        "ListingPhoto",
        back_populates="listing",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ListingPhoto.position",
    )


class AgentProfile(Base):
    """Admin-managed real estate agent profile used for optional listing assignment."""

    __tablename__ = "agent_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    professional_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    office_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    listings: Mapped[list["Listing"]] = relationship(
        "Listing",
        back_populates="agent",
    )


class ListingPhoto(Base):
    """Optimized listing-photo metadata; originals are never persisted."""

    __tablename__ = "listing_photos"
    __table_args__ = (
        UniqueConstraint(
            "listing_id",
            "position",
            name="uq_listing_photos_listing_position",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    listing_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_format: Mapped[str] = mapped_column(String(20), nullable=False)

    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)

    thumbnail_key: Mapped[str] = mapped_column(String(512), nullable=False)
    medium_key: Mapped[str] = mapped_column(String(512), nullable=False)
    large_key: Mapped[str] = mapped_column(String(512), nullable=False)

    position: Mapped[int] = mapped_column(Integer, nullable=False)
    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    listing: Mapped["Listing"] = relationship(
        "Listing",
        back_populates="photos",
    )


class AuditLog(Base):
    """Append-oriented record of meaningful internal actions."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    actor_email: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    target_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    target_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    # Details intentionally hold only sanitized, non-secret metadata.
    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )


# Association table linking users to roles (many-to-many)
# Each row connects one user to one role. The composite primary key
# prevents duplicate assignments. Cascade deletes clean up automatically.
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column(
        "user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    ),
    Column(
        "role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    ),
)


# Role catalog (e.g. 'admin', 'staff'); can be extended later if needed
class Role(Base):
    """
    Database model for user roles.

    Roles define permission levels (e.g., 'admin', 'staff').
    Users are linked to roles through the user_roles table.
    """

    __tablename__ = "roles"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Role name (e.g., 'admin', 'staff')
    name: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )

    # Optional description of the role
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Timestamp set when record is created
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    # Users assigned to this role
    users: Mapped[list["User"]] = relationship(
        "User",
        secondary="user_roles",
        back_populates="roles",
    )


class User(Base):
    """
    Database model for application users.

    Stores authentication data (hashed password) and profile info.
    Each user can be linked to one or more roles through the user_roles table.
    """

    __tablename__ = "users"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Authoritative fixed role for current access control (admin, staff, public_user)
    role: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="public_user",
    )
    
    # Email address (must be unique)
    email: Mapped[str] = mapped_column(
        String(320), unique=True, nullable=False, index=True
    )

    # Full name of the user
    full_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # Optional public-account contact phone number.
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # Hashed password (never store in plaintext)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Active flag for quick enable/disable without deleting
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="1")

    # Timestamp set once a public user verifies ownership of their email.
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Soft-delete marker for closed public accounts. Historical relationships
    # continue to reference the user row after closure.
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # Timestamp set when record is created
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True,
    )

    # Roles assigned to this user
    roles: Mapped[list["Role"]] = relationship(
        "Role",
        secondary="user_roles",
        back_populates="users",
    )

    # Verification tokens issued for this public account.
    email_verification_tokens: Mapped[list["EmailVerificationToken"]] = relationship(
        "EmailVerificationToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        "PasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class EmailVerificationToken(Base):
    """Single-use token used to verify ownership of a public user's email."""

    __tablename__ = "email_verification_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Only a SHA-256 hash is persisted; the raw token exists only in the email link.
    token_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="email_verification_tokens",
    )



class ListingFavorite(Base):
    """One saved public listing owned by one verified public user."""

    __tablename__ = "listing_favorites"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "listing_id",
            name="uq_listing_favorites_user_listing",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    listing_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class RecentlyViewedListing(Base):
    """Latest view timestamp for one listing per verified public user."""

    __tablename__ = "recently_viewed_listings"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "listing_id",
            name="uq_recently_viewed_user_listing",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    listing_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    viewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )



class SavedSearch(Base):
    """One verified public user's reusable public-listing search."""

    __tablename__ = "saved_searches"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "name",
            name="uq_saved_searches_user_name",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    criteria: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    alert_frequency: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="daily",
    )
    alerts_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    last_alerted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SavedSearchAlertDelivery(Base):
    """Dedupe record proving a listing was already emailed for a saved search."""

    __tablename__ = "saved_search_alert_deliveries"
    __table_args__ = (
        UniqueConstraint(
            "saved_search_id",
            "listing_id",
            name="uq_saved_search_alert_delivery_search_listing",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    saved_search_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("saved_searches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    listing_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    delivered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )



class NotificationSetting(Base):
    """Admin-controlled switch for one known transactional notification."""

    __tablename__ = "notification_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )



class PasswordResetToken(Base):
    """Single-use, expiring token for public-user password recovery."""

    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="password_reset_tokens",
    )



class SiteSetting(Base):
    """Singleton admin-managed brokerage and public-site configuration."""

    __tablename__ = "site_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    site_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        default="Juniper & Lane",
    )
    site_descriptor: Mapped[str | None] = mapped_column(String(80), nullable=True)
    tagline: Mapped[str | None] = mapped_column(String(200), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)

    homepage_eyebrow: Mapped[str | None] = mapped_column(String(160), nullable=True)
    homepage_title: Mapped[str | None] = mapped_column(String(180), nullable=True)
    homepage_intro: Mapped[str | None] = mapped_column(Text, nullable=True)
    homepage_story_title: Mapped[str | None] = mapped_column(
        String(180),
        nullable=True,
    )
    homepage_story_copy: Mapped[str | None] = mapped_column(Text, nullable=True)

    primary_color: Mapped[str] = mapped_column(
        String(7),
        nullable=False,
        default="#13382b",
    )
    secondary_color: Mapped[str] = mapped_column(
        String(7),
        nullable=False,
        default="#738c78",
    )

    show_about: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_contact: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_testimonials: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    listing_photo_max_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=50,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

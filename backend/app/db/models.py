# backend/app/db/models.py

"""
SQLAlchemy models for the project.

Models define the database tables and attach them to SQLAlchemy's metadata.
Importing this file does not connect to the database by itself.

"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Numeric,
    DateTime,
    Boolean,
    ForeignKey,
    Table,
)

from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

# Base is the SQLAlchemy declarative base defined in your session setup
# Importing Base ensures this model is registered in the same metadata.
from app.db.base import Base


class Listing(Base):
    """
    Real estate listing record.
    """

    __tablename__ = "listings"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Business fields
    # Short display title for the property listing
    title: Mapped[str] = mapped_column(String(150), nullable=False)

    # Listing workflow status shown in the admin UI
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Draft")

    # Whole dollar only
    price: Mapped[int] = mapped_column(Integer, nullable=False)

    # Street address
    address: Mapped[str] = mapped_column(String(255), nullable=False)

    # City name
    city: Mapped[str] = mapped_column(String(100), nullable=False)

    # Two-letter US state code
    state: Mapped[str] = mapped_column(String(2), nullable=False)

    # Freeform property description
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Square footage
    sqft: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Number of bedrooms
    bedrooms: Mapped[int] = mapped_column(Integer, nullable=False)

    # Number of bathrooms, stored with one decimal place (e.g., 1.5, 2.0)
    bathrooms: Mapped[float] = mapped_column(Numeric(3, 1), nullable=False)

    # Public URL to the cover image
    cover_image: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Audit fields
    # Timestamp set when record is created
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=True,
    )

    # Timestamp updated automatically when record is modified
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True,
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

    # Hashed password (never store in plaintext)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Active flag for quick enable/disable without deleting
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="1")

    # Timestamp set once a public user verifies ownership of their email.
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
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

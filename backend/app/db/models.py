# backend/app/db/models.py

"""
SQLAlchemy models for the project.

Models define the database tables and attach them to SQLAlchemy's metadata.
Importing this file does not connect to the database by itself.

"""

from sqlalchemy import String, Text, Numeric, DateTime, Integer
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column
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

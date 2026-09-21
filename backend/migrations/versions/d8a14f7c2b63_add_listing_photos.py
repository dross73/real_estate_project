"""add optimized listing photo metadata

Revision ID: d8a14f7c2b63
Revises: 7b2f6d1c9a47
Create Date: 2026-09-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d8a14f7c2b63"
down_revision: Union[str, Sequence[str], None] = "7b2f6d1c9a47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add metadata for optimized listing-photo variants."""
    op.create_table(
        "listing_photos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("source_format", sa.String(length=20), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("thumbnail_key", sa.String(length=512), nullable=False),
        sa.Column("medium_key", sa.String(length=512), nullable=False),
        sa.Column("large_key", sa.String(length=512), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "is_primary",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["listing_id"],
            ["listings.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "listing_id",
            "position",
            name="uq_listing_photos_listing_position",
        ),
    )
    op.create_index(
        "ix_listing_photos_id",
        "listing_photos",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_listing_photos_listing_id",
        "listing_photos",
        ["listing_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove optimized listing-photo metadata."""
    op.drop_index(
        "ix_listing_photos_listing_id",
        table_name="listing_photos",
    )
    op.drop_index(
        "ix_listing_photos_id",
        table_name="listing_photos",
    )
    op.drop_table("listing_photos")

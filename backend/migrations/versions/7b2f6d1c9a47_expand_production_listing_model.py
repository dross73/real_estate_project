"""expand production listing model

Revision ID: 7b2f6d1c9a47
Revises: f41a6d0e54a2
Create Date: 2026-09-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7b2f6d1c9a47"
down_revision: Union[str, Sequence[str], None] = "f41a6d0e54a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Expand listings for launch-ready real-estate data."""
    # BIGINT resolves the earlier PostgreSQL integer-overflow failure.
    op.alter_column(
        "listings",
        "price",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )

    op.add_column(
        "listings",
        sa.Column(
            "is_public",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "listings",
        sa.Column(
            "is_featured",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "listings",
        sa.Column(
            "hide_exact_address",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "listings",
        sa.Column("property_type", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "listings",
        sa.Column("acreage", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "listings",
        sa.Column("year_built", sa.Integer(), nullable=True),
    )
    op.add_column(
        "listings",
        sa.Column("annual_property_taxes", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "listings",
        sa.Column("hoa_fee", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "listings",
        sa.Column("hoa_fee_frequency", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "listings",
        sa.Column("school_district", sa.String(length=150), nullable=True),
    )
    op.add_column(
        "listings",
        sa.Column(
            "amenities",
            sa.JSON(),
            server_default=sa.text("'[]'::json"),
            nullable=False,
        ),
    )
    op.add_column(
        "listings",
        sa.Column("mls_number", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "listings",
        sa.Column("source_attribution", sa.String(length=255), nullable=True),
    )

    op.create_index(
        "ix_listings_public_status",
        "listings",
        ["is_public", "status"],
        unique=False,
    )
    op.create_index(
        "ix_listings_property_type",
        "listings",
        ["property_type"],
        unique=False,
    )
    op.create_index(
        "ix_listings_is_featured",
        "listings",
        ["is_featured"],
        unique=False,
    )


def downgrade() -> None:
    """Restore the MVP listing schema."""
    op.drop_index("ix_listings_is_featured", table_name="listings")
    op.drop_index("ix_listings_property_type", table_name="listings")
    op.drop_index("ix_listings_public_status", table_name="listings")

    op.drop_column("listings", "source_attribution")
    op.drop_column("listings", "mls_number")
    op.drop_column("listings", "amenities")
    op.drop_column("listings", "school_district")
    op.drop_column("listings", "hoa_fee_frequency")
    op.drop_column("listings", "hoa_fee")
    op.drop_column("listings", "annual_property_taxes")
    op.drop_column("listings", "year_built")
    op.drop_column("listings", "acreage")
    op.drop_column("listings", "property_type")
    op.drop_column("listings", "hide_exact_address")
    op.drop_column("listings", "is_featured")
    op.drop_column("listings", "is_public")

    op.alter_column(
        "listings",
        "price",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=False,
    )

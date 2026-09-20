"""baseline: initial schema

Revision ID: c080cac4a405
Revises:
Create Date: 2025-09-25 20:43:05.799703
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c080cac4a405"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the initial listings table."""

    op.create_table(
        "listings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("state", sa.String(length=2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sqft", sa.Integer(), nullable=True),
        sa.Column("bedrooms", sa.Integer(), nullable=False),
        sa.Column("bathrooms", sa.Numeric(precision=3, scale=1), nullable=False),
        sa.Column("cover_image", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_listings_id"), "listings", ["id"], unique=False)


def downgrade() -> None:
    """Remove the initial listings table."""

    op.drop_index(op.f("ix_listings_id"), table_name="listings")
    op.drop_table("listings")

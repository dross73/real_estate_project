"""add title and status to listings

Revision ID: cce98cfa8fa2
Revises: ca97a72c1210
Create Date: 2026-05-15 10:39:33.438504

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "cce98cfa8fa2"
down_revision: Union[str, Sequence[str], None] = "ca97a72c1210"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add title and status columns to listings."""

    op.add_column(
        "listings",
        sa.Column(
            "title",
            sa.String(length=150),
            nullable=False,
            server_default="Untitled Listing",
        ),
    )

    op.add_column(
        "listings",
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="Draft",
        ),
    )


def downgrade() -> None:
    """Remove title and status columns from listings."""

    op.drop_column("listings", "status")
    op.drop_column("listings", "title")

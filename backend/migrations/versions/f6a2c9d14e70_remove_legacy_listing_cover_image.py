"""Remove the legacy listing cover image column.

Revision ID: f6a2c9d14e70
Revises: c9f4d7a2e851
Create Date: 2026-10-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6a2c9d14e70"
down_revision: Union[str, Sequence[str], None] = "c9f4d7a2e851"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove the URL field superseded by managed listing photos."""
    op.drop_column("listings", "cover_image")


def downgrade() -> None:
    """Restore the legacy nullable cover-image URL column."""
    op.add_column(
        "listings",
        sa.Column("cover_image", sa.String(length=255), nullable=True),
    )

"""add public account archive timestamp

Revision ID: e7a2c94f1138
Revises: c4d1f8a72e90
Create Date: 2026-09-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7a2c94f1138"
down_revision: Union[str, Sequence[str], None] = "c4d1f8a72e90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        op.f("ix_users_archived_at"),
        "users",
        ["archived_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_archived_at"), table_name="users")
    op.drop_column("users", "archived_at")

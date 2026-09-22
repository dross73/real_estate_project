"""add public inquiry settings and idempotency

Revision ID: a7d4e9c31b62
Revises: f8a6b1c42d53
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7d4e9c31b62"
down_revision: Union[str, Sequence[str], None] = "f8a6b1c42d53"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "site_settings",
        sa.Column(
            "enable_contact_requests",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "site_settings",
        sa.Column(
            "enable_showing_requests",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )

    op.add_column(
        "leads",
        sa.Column("public_submission_key", sa.String(length=64), nullable=True),
    )
    op.create_index(
        op.f("ix_leads_public_submission_key"),
        "leads",
        ["public_submission_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_leads_public_submission_key"), table_name="leads")
    op.drop_column("leads", "public_submission_key")
    op.drop_column("site_settings", "enable_showing_requests")
    op.drop_column("site_settings", "enable_contact_requests")

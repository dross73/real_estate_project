"""add listing open house events

Revision ID: c3f6d9a84e21
Revises: a7d4e9c31b62
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3f6d9a84e21"
down_revision: Union[str, Sequence[str], None] = "a7d4e9c31b62"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "open_house_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
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
    )
    op.create_index(
        op.f("ix_open_house_events_id"),
        "open_house_events",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_open_house_events_listing_id"),
        "open_house_events",
        ["listing_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_open_house_events_starts_at"),
        "open_house_events",
        ["starts_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_open_house_events_ends_at"),
        "open_house_events",
        ["ends_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_open_house_events_ends_at"), table_name="open_house_events")
    op.drop_index(op.f("ix_open_house_events_starts_at"), table_name="open_house_events")
    op.drop_index(op.f("ix_open_house_events_listing_id"), table_name="open_house_events")
    op.drop_index(op.f("ix_open_house_events_id"), table_name="open_house_events")
    op.drop_table("open_house_events")

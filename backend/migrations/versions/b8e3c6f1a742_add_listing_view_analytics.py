"""Add privacy-minimized public listing view events.

Revision ID: b8e3c6f1a742
Revises: a4c7e1d9b203
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8e3c6f1a742"
down_revision: Union[str, Sequence[str], None] = "a4c7e1d9b203"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "listing_view_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("source_category", sa.String(length=20), nullable=False),
        sa.Column("referrer_host", sa.String(length=255), nullable=True),
        sa.Column(
            "viewed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
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
        op.f("ix_listing_view_events_id"),
        "listing_view_events",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_listing_view_events_listing_id"),
        "listing_view_events",
        ["listing_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_listing_view_events_source_category"),
        "listing_view_events",
        ["source_category"],
        unique=False,
    )
    op.create_index(
        op.f("ix_listing_view_events_referrer_host"),
        "listing_view_events",
        ["referrer_host"],
        unique=False,
    )
    op.create_index(
        op.f("ix_listing_view_events_viewed_at"),
        "listing_view_events",
        ["viewed_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_listing_view_events_viewed_at"),
        table_name="listing_view_events",
    )
    op.drop_index(
        op.f("ix_listing_view_events_referrer_host"),
        table_name="listing_view_events",
    )
    op.drop_index(
        op.f("ix_listing_view_events_source_category"),
        table_name="listing_view_events",
    )
    op.drop_index(
        op.f("ix_listing_view_events_listing_id"),
        table_name="listing_view_events",
    )
    op.drop_index(
        op.f("ix_listing_view_events_id"),
        table_name="listing_view_events",
    )
    op.drop_table("listing_view_events")

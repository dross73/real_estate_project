"""add saved searches and alert delivery dedupe

Revision ID: b72a5c8d19ef
Revises: e3c4a9b102de
Create Date: 2026-09-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b72a5c8d19ef"
down_revision: Union[str, Sequence[str], None] = "e3c4a9b102de"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "saved_searches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("criteria", sa.JSON(), nullable=False),
        sa.Column("alert_frequency", sa.String(length=20), nullable=False),
        sa.Column("alerts_enabled", sa.Boolean(), nullable=False),
        sa.Column("last_alerted_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_saved_searches_user_name"),
    )
    op.create_index(op.f("ix_saved_searches_id"), "saved_searches", ["id"], unique=False)
    op.create_index(op.f("ix_saved_searches_user_id"), "saved_searches", ["user_id"], unique=False)

    op.create_table(
        "saved_search_alert_deliveries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("saved_search_id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column(
            "delivered_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["saved_search_id"], ["saved_searches.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "saved_search_id",
            "listing_id",
            name="uq_saved_search_alert_delivery_search_listing",
        ),
    )
    op.create_index(
        op.f("ix_saved_search_alert_deliveries_id"),
        "saved_search_alert_deliveries",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_saved_search_alert_deliveries_listing_id"),
        "saved_search_alert_deliveries",
        ["listing_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_saved_search_alert_deliveries_saved_search_id"),
        "saved_search_alert_deliveries",
        ["saved_search_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_saved_search_alert_deliveries_saved_search_id"),
        table_name="saved_search_alert_deliveries",
    )
    op.drop_index(
        op.f("ix_saved_search_alert_deliveries_listing_id"),
        table_name="saved_search_alert_deliveries",
    )
    op.drop_index(
        op.f("ix_saved_search_alert_deliveries_id"),
        table_name="saved_search_alert_deliveries",
    )
    op.drop_table("saved_search_alert_deliveries")
    op.drop_index(op.f("ix_saved_searches_user_id"), table_name="saved_searches")
    op.drop_index(op.f("ix_saved_searches_id"), table_name="saved_searches")
    op.drop_table("saved_searches")

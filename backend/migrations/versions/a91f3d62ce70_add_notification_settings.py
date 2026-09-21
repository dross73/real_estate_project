"""add notification settings

Revision ID: a91f3d62ce70
Revises: d8a14f7c2b63
Create Date: 2026-09-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a91f3d62ce70"
down_revision: Union[str, Sequence[str], None] = "d8a14f7c2b63"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add persisted admin-level transactional notification switches."""
    op.create_table(
        "notification_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column(
            "enabled",
            sa.Boolean(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_notification_settings_id",
        "notification_settings",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_notification_settings_key",
        "notification_settings",
        ["key"],
        unique=True,
    )

    notification_settings = sa.table(
        "notification_settings",
        sa.column("key", sa.String),
        sa.column("enabled", sa.Boolean),
    )
    op.bulk_insert(
        notification_settings,
        [
            {"key": "lead_assignment", "enabled": True},
            {"key": "showing_request_assignment", "enabled": True},
            {"key": "contact_request_assignment", "enabled": True},
            {"key": "testimonial_submission", "enabled": False},
        ],
    )


def downgrade() -> None:
    """Remove transactional notification settings."""
    op.drop_index(
        "ix_notification_settings_key",
        table_name="notification_settings",
    )
    op.drop_index(
        "ix_notification_settings_id",
        table_name="notification_settings",
    )
    op.drop_table("notification_settings")

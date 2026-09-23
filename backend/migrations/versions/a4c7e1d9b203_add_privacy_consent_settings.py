"""Add configurable visitor privacy consent settings.

Revision ID: a4c7e1d9b203
Revises: f2c4a8b7d901
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4c7e1d9b203"
down_revision: Union[str, Sequence[str], None] = "f2c4a8b7d901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "site_settings",
        sa.Column(
            "privacy_consent_enabled",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.add_column(
        "site_settings",
        sa.Column(
            "privacy_analytics_category_enabled",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.add_column(
        "site_settings",
        sa.Column(
            "privacy_marketing_category_enabled",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("site_settings", "privacy_marketing_category_enabled")
    op.drop_column("site_settings", "privacy_analytics_category_enabled")
    op.drop_column("site_settings", "privacy_consent_enabled")

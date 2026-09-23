"""Add editable public content and legal page settings.

Revision ID: f2c4a8b7d901
Revises: d7b2f4a91c30
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2c4a8b7d901"
down_revision: Union[str, Sequence[str], None] = "d7b2f4a91c30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("site_settings", sa.Column("about_title", sa.String(length=180), nullable=True))
    op.add_column("site_settings", sa.Column("about_intro", sa.Text(), nullable=True))
    op.add_column("site_settings", sa.Column("about_mission_title", sa.String(length=180), nullable=True))
    op.add_column("site_settings", sa.Column("about_mission_copy", sa.Text(), nullable=True))
    op.add_column("site_settings", sa.Column("about_history_title", sa.String(length=180), nullable=True))
    op.add_column("site_settings", sa.Column("about_history_copy", sa.Text(), nullable=True))
    op.add_column("site_settings", sa.Column("about_image_url", sa.String(length=2048), nullable=True))
    op.add_column("site_settings", sa.Column("about_team_title", sa.String(length=180), nullable=True))
    op.add_column("site_settings", sa.Column("about_team_copy", sa.Text(), nullable=True))
    op.add_column("site_settings", sa.Column("contact_hours", sa.Text(), nullable=True))
    op.add_column(
        "site_settings",
        sa.Column("show_privacy", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column("site_settings", sa.Column("privacy_title", sa.String(length=180), nullable=True))
    op.add_column("site_settings", sa.Column("privacy_body", sa.Text(), nullable=True))
    op.add_column(
        "site_settings",
        sa.Column("show_terms", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column("site_settings", sa.Column("terms_title", sa.String(length=180), nullable=True))
    op.add_column("site_settings", sa.Column("terms_body", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("site_settings", "terms_body")
    op.drop_column("site_settings", "terms_title")
    op.drop_column("site_settings", "show_terms")
    op.drop_column("site_settings", "privacy_body")
    op.drop_column("site_settings", "privacy_title")
    op.drop_column("site_settings", "show_privacy")
    op.drop_column("site_settings", "contact_hours")
    op.drop_column("site_settings", "about_team_copy")
    op.drop_column("site_settings", "about_team_title")
    op.drop_column("site_settings", "about_image_url")
    op.drop_column("site_settings", "about_history_copy")
    op.drop_column("site_settings", "about_history_title")
    op.drop_column("site_settings", "about_mission_copy")
    op.drop_column("site_settings", "about_mission_title")
    op.drop_column("site_settings", "about_intro")
    op.drop_column("site_settings", "about_title")

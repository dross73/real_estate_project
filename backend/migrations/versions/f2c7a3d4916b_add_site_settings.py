"""add singleton site settings

Revision ID: f2c7a3d4916b
Revises: e7a2c94f1138
Create Date: 2026-09-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2c7a3d4916b"
down_revision: Union[str, Sequence[str], None] = "e7a2c94f1138"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    site_settings = op.create_table(
        "site_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("site_name", sa.String(length=120), nullable=False),
        sa.Column("site_descriptor", sa.String(length=80), nullable=True),
        sa.Column("tagline", sa.String(length=200), nullable=True),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("address_line1", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("state", sa.String(length=50), nullable=True),
        sa.Column("postal_code", sa.String(length=20), nullable=True),
        sa.Column("homepage_eyebrow", sa.String(length=160), nullable=True),
        sa.Column("homepage_title", sa.String(length=180), nullable=True),
        sa.Column("homepage_intro", sa.Text(), nullable=True),
        sa.Column("homepage_story_title", sa.String(length=180), nullable=True),
        sa.Column("homepage_story_copy", sa.Text(), nullable=True),
        sa.Column("primary_color", sa.String(length=7), nullable=False),
        sa.Column("secondary_color", sa.String(length=7), nullable=False),
        sa.Column("show_about", sa.Boolean(), nullable=False),
        sa.Column("show_contact", sa.Boolean(), nullable=False),
        sa.Column("show_testimonials", sa.Boolean(), nullable=False),
        sa.Column("listing_photo_max_count", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.bulk_insert(
        site_settings,
        [
            {
                "id": 1,
                "site_name": "Juniper & Lane",
                "site_descriptor": "Realty",
                "tagline": "A brighter tomorrow belongs here.",
                "logo_url": None,
                "phone": None,
                "email": None,
                "address_line1": None,
                "city": None,
                "state": None,
                "postal_code": None,
                "homepage_eyebrow": "Homes rooted in a brighter tomorrow",
                "homepage_title": "Local People. Lasting Places.",
                "homepage_intro": (
                    "We help you find more than a house. We help you find "
                    "your place in the community."
                ),
                "homepage_story_title": (
                    "We’re Invested in What Makes This Place Home."
                ),
                "homepage_story_copy": (
                    "From local expertise to lasting relationships, we’re "
                    "here for the people, places, and possibilities that make "
                    "strong communities worth calling home."
                ),
                "primary_color": "#13382b",
                "secondary_color": "#738c78",
                "show_about": True,
                "show_contact": True,
                "show_testimonials": False,
                "listing_photo_max_count": 50,
            }
        ],
    )


def downgrade() -> None:
    op.drop_table("site_settings")

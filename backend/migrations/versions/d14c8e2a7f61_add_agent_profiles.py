"""add agent profiles and listing assignment

Revision ID: d14c8e2a7f61
Revises: f2c7a3d4916b
Create Date: 2026-09-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d14c8e2a7f61"
down_revision: Union[str, Sequence[str], None] = "f2c7a3d4916b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("professional_title", sa.String(length=120), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("photo_url", sa.String(length=2048), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("office_name", sa.String(length=160), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_agent_profiles_id"), "agent_profiles", ["id"], unique=False)
    op.create_index(
        op.f("ix_agent_profiles_email"),
        "agent_profiles",
        ["email"],
        unique=False,
    )

    op.add_column("listings", sa.Column("agent_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_listings_agent_id"), "listings", ["agent_id"], unique=False)
    op.create_foreign_key(
        "fk_listings_agent_id_agent_profiles",
        "listings",
        "agent_profiles",
        ["agent_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_listings_agent_id_agent_profiles",
        "listings",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_listings_agent_id"), table_name="listings")
    op.drop_column("listings", "agent_id")
    op.drop_index(op.f("ix_agent_profiles_email"), table_name="agent_profiles")
    op.drop_index(op.f("ix_agent_profiles_id"), table_name="agent_profiles")
    op.drop_table("agent_profiles")

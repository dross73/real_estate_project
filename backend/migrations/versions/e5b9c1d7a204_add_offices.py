"""add offices and office associations

Revision ID: e5b9c1d7a204
Revises: d14c8e2a7f61
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5b9c1d7a204"
down_revision: Union[str, Sequence[str], None] = "d14c8e2a7f61"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "offices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("address_line1", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("state", sa.String(length=2), nullable=False),
        sa.Column("postal_code", sa.String(length=20), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("hours", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_offices_id"), "offices", ["id"], unique=False)

    op.add_column("agent_profiles", sa.Column("office_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_agent_profiles_office_id"), "agent_profiles", ["office_id"], unique=False)
    op.create_foreign_key(
        "fk_agent_profiles_office_id_offices",
        "agent_profiles",
        "offices",
        ["office_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("listings", sa.Column("office_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_listings_office_id"), "listings", ["office_id"], unique=False)
    op.create_foreign_key(
        "fk_listings_office_id_offices",
        "listings",
        "offices",
        ["office_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_listings_office_id_offices", "listings", type_="foreignkey")
    op.drop_index(op.f("ix_listings_office_id"), table_name="listings")
    op.drop_column("listings", "office_id")
    op.drop_constraint("fk_agent_profiles_office_id_offices", "agent_profiles", type_="foreignkey")
    op.drop_index(op.f("ix_agent_profiles_office_id"), table_name="agent_profiles")
    op.drop_column("agent_profiles", "office_id")
    op.drop_index(op.f("ix_offices_id"), table_name="offices")
    op.drop_table("offices")

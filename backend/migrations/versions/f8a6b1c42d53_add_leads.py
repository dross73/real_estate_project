"""add lead inquiry management tables

Revision ID: f8a6b1c42d53
Revises: e5b9c1d7a204
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f8a6b1c42d53"
down_revision: Union[str, Sequence[str], None] = "e5b9c1d7a204"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("inquiry_type", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("requester_user_id", sa.Integer(), nullable=True),
        sa.Column("contact_name", sa.String(length=120), nullable=False),
        sa.Column("contact_email", sa.String(length=320), nullable=False),
        sa.Column("contact_phone", sa.String(length=40), nullable=True),
        sa.Column("listing_id", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("preferred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(length=100), nullable=True),
        sa.Column("assigned_agent_id", sa.Integer(), nullable=True),
        sa.Column("assigned_user_id", sa.Integer(), nullable=True),
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
        sa.ForeignKeyConstraint(["requester_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assigned_agent_id"], ["agent_profiles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assigned_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in (
        "id",
        "inquiry_type",
        "status",
        "requester_user_id",
        "contact_email",
        "listing_id",
        "assigned_agent_id",
        "assigned_user_id",
        "created_at",
    ):
        op.create_index(op.f(f"ix_leads_{column}"), "leads", [column], unique=False)

    op.create_table(
        "lead_activities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lead_id", sa.Integer(), nullable=False),
        sa.Column("activity_type", sa.String(length=40), nullable=False),
        sa.Column("actor_email", sa.String(length=320), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("id", "lead_id", "activity_type", "created_at"):
        op.create_index(
            op.f(f"ix_lead_activities_{column}"),
            "lead_activities",
            [column],
            unique=False,
        )


def downgrade() -> None:
    for column in ("created_at", "activity_type", "lead_id", "id"):
        op.drop_index(op.f(f"ix_lead_activities_{column}"), table_name="lead_activities")
    op.drop_table("lead_activities")

    for column in (
        "created_at",
        "assigned_user_id",
        "assigned_agent_id",
        "listing_id",
        "contact_email",
        "requester_user_id",
        "status",
        "inquiry_type",
        "id",
    ):
        op.drop_index(op.f(f"ix_leads_{column}"), table_name="leads")
    op.drop_table("leads")

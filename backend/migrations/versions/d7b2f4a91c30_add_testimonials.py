"""add testimonial moderation

Revision ID: d7b2f4a91c30
Revises: c3f6d9a84e21
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7b2f4a91c30"
down_revision: Union[str, Sequence[str], None] = "c3f6d9a84e21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "site_settings",
        sa.Column(
            "enable_testimonial_submissions",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.create_table(
        "testimonials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("author_user_id", sa.Integer(), nullable=True),
        sa.Column("author_name", sa.String(length=120), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("moderated_by_email", sa.String(length=320), nullable=True),
        sa.Column("moderated_at", sa.DateTime(timezone=True), nullable=True),
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
            ["author_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    for column in (
        "id",
        "author_user_id",
        "source",
        "status",
        "created_at",
    ):
        op.create_index(
            op.f(f"ix_testimonials_{column}"),
            "testimonials",
            [column],
            unique=False,
        )


def downgrade() -> None:
    for column in (
        "created_at",
        "status",
        "source",
        "author_user_id",
        "id",
    ):
        op.drop_index(op.f(f"ix_testimonials_{column}"), table_name="testimonials")

    op.drop_table("testimonials")
    op.drop_column("site_settings", "enable_testimonial_submissions")

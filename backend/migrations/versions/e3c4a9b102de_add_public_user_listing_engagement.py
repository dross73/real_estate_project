"""add public-user listing engagement

Revision ID: e3c4a9b102de
Revises: a6e5c3198d42
Create Date: 2026-09-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e3c4a9b102de"
down_revision: Union[str, Sequence[str], None] = "a6e5c3198d42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "listing_favorites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "listing_id",
            name="uq_listing_favorites_user_listing",
        ),
    )
    op.create_index(op.f("ix_listing_favorites_id"), "listing_favorites", ["id"], unique=False)
    op.create_index(op.f("ix_listing_favorites_listing_id"), "listing_favorites", ["listing_id"], unique=False)
    op.create_index(op.f("ix_listing_favorites_user_id"), "listing_favorites", ["user_id"], unique=False)

    op.create_table(
        "recently_viewed_listings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column(
            "viewed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "listing_id",
            name="uq_recently_viewed_user_listing",
        ),
    )
    op.create_index(op.f("ix_recently_viewed_listings_id"), "recently_viewed_listings", ["id"], unique=False)
    op.create_index(op.f("ix_recently_viewed_listings_listing_id"), "recently_viewed_listings", ["listing_id"], unique=False)
    op.create_index(op.f("ix_recently_viewed_listings_user_id"), "recently_viewed_listings", ["user_id"], unique=False)
    op.create_index(op.f("ix_recently_viewed_listings_viewed_at"), "recently_viewed_listings", ["viewed_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_recently_viewed_listings_viewed_at"), table_name="recently_viewed_listings")
    op.drop_index(op.f("ix_recently_viewed_listings_user_id"), table_name="recently_viewed_listings")
    op.drop_index(op.f("ix_recently_viewed_listings_listing_id"), table_name="recently_viewed_listings")
    op.drop_index(op.f("ix_recently_viewed_listings_id"), table_name="recently_viewed_listings")
    op.drop_table("recently_viewed_listings")
    op.drop_index(op.f("ix_listing_favorites_user_id"), table_name="listing_favorites")
    op.drop_index(op.f("ix_listing_favorites_listing_id"), table_name="listing_favorites")
    op.drop_index(op.f("ix_listing_favorites_id"), table_name="listing_favorites")
    op.drop_table("listing_favorites")

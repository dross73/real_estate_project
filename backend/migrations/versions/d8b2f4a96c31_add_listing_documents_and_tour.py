"""add virtual tour and listing documents

Revision ID: d8b2f4a96c31
Revises: c3f6d9a84e21
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d8b2f4a96c31"
down_revision: Union[str, Sequence[str], None] = "c3f6d9a84e21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "listings",
        sa.Column("virtual_tour_url", sa.String(length=2048), nullable=True),
    )

    op.create_table(
        "listing_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("object_key", sa.String(length=512), nullable=False),
        sa.Column(
            "is_public",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
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
            ["listing_id"],
            ["listings.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("object_key"),
    )
    op.create_index(
        op.f("ix_listing_documents_id"),
        "listing_documents",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_listing_documents_listing_id"),
        "listing_documents",
        ["listing_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_listing_documents_is_public"),
        "listing_documents",
        ["is_public"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_listing_documents_is_public"), table_name="listing_documents")
    op.drop_index(op.f("ix_listing_documents_listing_id"), table_name="listing_documents")
    op.drop_index(op.f("ix_listing_documents_id"), table_name="listing_documents")
    op.drop_table("listing_documents")
    op.drop_column("listings", "virtual_tour_url")

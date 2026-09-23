"""Add internal TOTP MFA and MFA policy settings.

Revision ID: c9f4d7a2e851
Revises: b8e3c6f1a742
Create Date: 2026-09-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9f4d7a2e851"
down_revision: Union[str, Sequence[str], None] = "b8e3c6f1a742"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "mfa_enabled",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column("mfa_secret_encrypted", sa.Text(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "mfa_recovery_code_hashes",
            sa.JSON(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "mfa_enrolled_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "site_settings",
        sa.Column(
            "require_internal_mfa",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )

    op.create_table(
        "mfa_login_challenges",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_mfa_login_challenges_id"),
        "mfa_login_challenges",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_mfa_login_challenges_user_id"),
        "mfa_login_challenges",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_mfa_login_challenges_token_hash"),
        "mfa_login_challenges",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        op.f("ix_mfa_login_challenges_expires_at"),
        "mfa_login_challenges",
        ["expires_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_mfa_login_challenges_expires_at"),
        table_name="mfa_login_challenges",
    )
    op.drop_index(
        op.f("ix_mfa_login_challenges_token_hash"),
        table_name="mfa_login_challenges",
    )
    op.drop_index(
        op.f("ix_mfa_login_challenges_user_id"),
        table_name="mfa_login_challenges",
    )
    op.drop_index(
        op.f("ix_mfa_login_challenges_id"),
        table_name="mfa_login_challenges",
    )
    op.drop_table("mfa_login_challenges")

    op.drop_column("site_settings", "require_internal_mfa")
    op.drop_column("users", "mfa_enrolled_at")
    op.drop_column("users", "mfa_recovery_code_hashes")
    op.drop_column("users", "mfa_secret_encrypted")
    op.drop_column("users", "mfa_enabled")

"""Add optional stored listing coordinates."""
from alembic import op
import sqlalchemy as sa

revision = "b7e31c8a902d"
down_revision = "f6a2c9d14e70"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("listings", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("listings", sa.Column("longitude", sa.Float(), nullable=True))


def downgrade():
    op.drop_column("listings", "longitude")
    op.drop_column("listings", "latitude")

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

import app.db.models as models
from app.core.config import get_settings

# Alembic configuration from backend/alembic.ini.
config = context.config
settings = get_settings()

# Use the same runtime database configuration as the FastAPI application.
# ConfigParser treats percent signs specially, so escape encoded URL values.
config.set_main_option(
    "sqlalchemy.url",
    settings.effective_database_url.replace("%", "%%"),
)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Importing models registers every mapped table with this metadata.
target_metadata = models.Base.metadata


def run_migrations_offline() -> None:
    """Run migrations without opening a live database connection."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against the configured database."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

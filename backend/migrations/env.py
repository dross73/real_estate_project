from logging.config import fileConfig
import os
import app.db.models as models # Ensure models are imported for Alembic

from dotenv import load_dotenv



from sqlalchemy import engine_from_config, pool
from alembic import context

# Import your SQLAlchemy Base so Alembic knows about your models


# -------------------------------------------------------------
# Alembic Config object
# Provides access to the settings in alembic.ini
# -------------------------------------------------------------
config = context.config

# -------------------------------------------------------------
# Database URL override
# Alembic may not expand ${DATABASE_URL} correctly on Windows.
# This reads DATABASE_URL directly from the environment and
# sets it so migrations always connect consistently.
# -------------------------------------------------------------
load_dotenv()  # Load variables from .env before reading DATABASE_URL

database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

# -------------------------------------------------------------
# Logging configuration
# Reads logging settings from alembic.ini so migration
# operations can be logged to the console or file.
# -------------------------------------------------------------
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# -------------------------------------------------------------
# Target metadata
# This is the collection of model definitions that Alembic
# will compare against the database to autogenerate migrations.
# -------------------------------------------------------------
# Explicitly touch Base.metadata through models so linters
# recognize the import as used.
target_metadata = models.Base.metadata


# -------------------------------------------------------------
# Offline migrations
# Runs migrations without a live database connection by
# emitting raw SQL statements to the migration script.
# Useful for generating SQL files that can be run separately.
# -------------------------------------------------------------
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# -------------------------------------------------------------
# Online migrations
# Connects to the database and runs migrations directly.
# This is the common mode when you want Alembic to apply
# schema changes straight to your development or test DB.
# -------------------------------------------------------------
def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


# -------------------------------------------------------------
# Entrypoint
# Decides whether to run in offline or online mode
# based on how Alembic was invoked.
# -------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

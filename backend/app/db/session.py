"""
Database session and engine setup.

This module builds the SQLAlchemy engine and session factory using the
configuration loaded from backend/app/core/config.py. It respects the
DATABASE_URL from the .env file, or falls back to individual Postgres parts.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings

# Load settings once (cached by lru_cache in config)
settings = get_settings()

# --- Debug: verify effective DB URL (mask password) ---
try:
    masked_url = settings.effective_database_url.replace(settings.POSTGRES_PASSWORD, "******")
except Exception:
    masked_url = "<unavailable>"
print(f"[config] effective_database_url = {masked_url}")


# Create the engine using the effective DB URL (honors .env DATABASE_URL)
engine = create_engine(
    settings.effective_database_url,
    pool_pre_ping=True,  # helps recover dropped connections
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    FastAPI dependency that provides a DB session and ensures it’s closed.
    Usage in routes:
        from app.db.session import get_db
        def handler(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

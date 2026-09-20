"""Database engine, session factory, and FastAPI session dependency."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings

settings = get_settings()

# pool_pre_ping helps recover cleanly from stale database connections.
engine = create_engine(
    settings.effective_database_url,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Provide a database session to a request and always close it afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

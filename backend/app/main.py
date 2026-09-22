"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.audit_log import router as audit_log_router
from app.api.auth import router as auth_router
from app.api.example import router as example_router
from app.api.listings import router as listings_router
from app.api.listing_photos import router as listing_photos_router
from app.api.notification_settings import router as notification_settings_router
from app.api.public_engagement import router as public_engagement_router
from app.api.public_listings import router as public_listings_router
from app.api.saved_searches import router as saved_searches_router
from app.api.site_settings import (
    admin_router as site_settings_router,
    public_router as public_site_settings_router,
)
from app.api.users import router as users_router
from app.core.config import get_settings
from app.db.session import engine

settings = get_settings()


def _check_database_connection() -> None:
    """Run a lightweight database query and raise if connectivity is unavailable."""
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Fail fast at startup when the configured database is unreachable."""
    _check_database_connection()
    yield


app = FastAPI(
    title="Real Estate API",
    lifespan=lifespan,
)

# Allow only configured frontend origins to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Application routers.
app.include_router(audit_log_router)
app.include_router(example_router)
app.include_router(listings_router)
app.include_router(listing_photos_router)
app.include_router(notification_settings_router)
app.include_router(public_engagement_router)
app.include_router(public_listings_router)
app.include_router(saved_searches_router)
app.include_router(site_settings_router)
app.include_router(public_site_settings_router)
app.include_router(auth_router)
app.include_router(users_router)


@app.get("/")
def read_root():
    """Return a simple API status response."""
    return {"status": "ok", "message": "Real Estate API up"}


@app.get("/health")
def health_check():
    """Return 200 when the API can reach its database, otherwise 503."""
    try:
        _check_database_connection()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from exc

    return {"status": "ok"}

"""
Main application entrypoint.

- Creates the FastAPI app instance.
- Ensures database connectivity at startup.
- Includes API routers (example + listings).
- Provides a simple root endpoint for health checks.
"""

from fastapi import FastAPI
from sqlalchemy import text

# --- Internal imports ---
# Base class for all SQLAlchemy models (used to create tables)
from app.db.base import Base

# Engine + session setup (engine built from .env via config.py)
from app.db.session import engine

# Importing models ensures they are registered with Base.metadata
# Even if not directly used here, this is important so migrations / create_all
# know about your tables.
from app.db import models  # noqa: F401

# API routers
from app.api.example import router as example_router
from app.api.listings import router as listings_router

# --- Database setup ---
# Creates tables in the database on app startup.
# Note: This is temporary — we’ll replace with Alembic migrations.
Base.metadata.create_all(bind=engine)

# --- FastAPI app instance ---
app = FastAPI()


# --- Startup event ---
@app.on_event("startup")
def _db_connectivity_check() -> None:
    """
    On app startup, run a simple SQL query (`SELECT 1`) against Postgres.
    If this fails, it means the app cannot connect to the database.
    """
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))


# --- Routers ---
# Example endpoint (hardcoded listing)
app.include_router(example_router)

# Listings CRUD endpoints
app.include_router(listings_router)


# --- Root endpoint ---
@app.get("/")
def read_root():
    """
    Basic health check endpoint.
    Returns a JSON payload confirming the API is online.
    """
    return {"status": "ok", "message": "Real Estate API up"}

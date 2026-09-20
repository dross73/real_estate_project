"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.auth import router as auth_router
from app.api.example import router as example_router
from app.api.listings import router as listings_router
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
app.include_router(example_router)
app.include_router(listings_router)
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

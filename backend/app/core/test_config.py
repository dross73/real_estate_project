"""Unit tests for environment-driven application configuration."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings


BASE_SETTINGS = {
    "SECRET_KEY": "test-secret",
    "ACCESS_TOKEN_EXPIRE_MINUTES": 30,
    "JWT_ALGORITHM": "HS256",
    "JWT_ISSUER": "test-issuer",
    "JWT_AUDIENCE": "test-audience",
}


def test_database_url_can_be_used_without_individual_postgres_fields():
    """A platform-provided DATABASE_URL should be sufficient by itself."""
    settings = Settings(
        _env_file=None,
        DATABASE_URL="postgresql+psycopg2://user:pass@example.com:5432/database",
        **BASE_SETTINGS,
    )

    assert settings.effective_database_url.endswith("/database")


def test_individual_postgres_fields_build_safe_database_url():
    """Individual database fields should build a properly encoded SQLAlchemy URL."""
    settings = Settings(
        _env_file=None,
        POSTGRES_HOST="localhost",
        POSTGRES_PORT=5432,
        POSTGRES_DB="realestate",
        POSTGRES_USER="admin@example.com",
        POSTGRES_PASSWORD="p@ss/word",
        **BASE_SETTINGS,
    )

    assert "admin%40example.com" in settings.effective_database_url
    assert "p%40ss%2Fword" in settings.effective_database_url


def test_database_configuration_is_required():
    """Missing both URL and Postgres parts should fail fast."""
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            DATABASE_URL=None,
            POSTGRES_HOST=None,
            POSTGRES_PORT=None,
            POSTGRES_DB=None,
            POSTGRES_USER=None,
            POSTGRES_PASSWORD=None,
            **BASE_SETTINGS,
        )


def test_cors_origins_are_trimmed_deduplicated_and_empty_values_removed():
    """CORS configuration should produce a clean list for FastAPI middleware."""
    settings = Settings(
        _env_file=None,
        DATABASE_URL="postgresql+psycopg2://user:pass@example.com:5432/database",
        CORS_ORIGINS=(
            "http://localhost:4200, https://example.com, "
            "http://localhost:4200, "
        ),
        **BASE_SETTINGS,
    )

    assert settings.cors_origins == [
        "http://localhost:4200",
        "https://example.com",
    ]

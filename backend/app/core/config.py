"""
Application configuration.

This file loads environment variables from the .env file and exposes them
through a Pydantic BaseSettings class. Centralizing config this way avoids
hardcoding values in the codebase.
"""

from pathlib import Path
from typing import ClassVar, Optional
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# Project root = three levels up from this file (backend/app/core/config.py → project root)
# core → app (1), app → backend (2), backend → real_estate_project (3)
PROJECT_ROOT = Path(__file__).resolve().parents[3]

# Load .env file once at import time so environment variables are available
ENV_FILE = PROJECT_ROOT / ".env"
load_dotenv(ENV_FILE)


class Settings(BaseSettings):
    """
    Settings pulled strictly from environment (.env or OS-level env vars).
    DB settings are required (no defaults). If any are missing, initialization
    will raise a ValidationError — intentional for professional setups.
    """

    # Path to .env (not a runtime field, used by model_config only)
    env_path: ClassVar[Path] = ENV_FILE

    # Optional full SQLAlchemy URL (overrides individual parts if present)
    DATABASE_URL: Optional[str] = None

    # Individual Postgres connection parts (required, no defaults)
    POSTGRES_HOST: str = Field(..., description="Database host, from .env")
    POSTGRES_PORT: int = Field(..., description="Database port, from .env")
    POSTGRES_DB: str = Field(..., description="Database name, from .env")
    POSTGRES_USER: str = Field(..., description="Database user, from .env")
    POSTGRES_PASSWORD: str = Field(
        ..., repr=False, description="Database password, from .env"
    )


    # JWT / Auth settings
    SECRET_KEY: str = Field(..., description="Secrete key for signing JWTs")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(..., description="JWT access token lifetime in minutes")
    JWT_ALGORITHM: str = Field(..., description="JWT signing algorithm, e.g. HS256")
    JWT_ISSUER: str = Field(..., description="Token issuer identifier")
    JWT_AUDIENCE: str = Field(..., description="Token audience identifier") 



    # Application environment (safe default for non-critical behavior)
    ENV: str = Field("dev", description="Runtime environment")

    # Pydantic Settings configuration
    model_config = SettingsConfigDict(
        env_file=env_path,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Helper that returns a usable SQLAlchemy URL
    @property
    def effective_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    # Pydantic loads from env; static analyzers can't infer this constructor pattern.
    return Settings()  # type: ignore[call-arg]
settings = get_settings()
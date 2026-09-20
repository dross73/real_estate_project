"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import ClassVar, Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

# Project root = backend/app/core/config.py -> real_estate_project
PROJECT_ROOT = Path(__file__).resolve().parents[3]
ENV_FILE = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    """Central runtime settings for local and production environments."""

    # Keep local development convenient while allowing production OS env vars.
    env_path: ClassVar[Path] = ENV_FILE

    # A full SQLAlchemy URL may be supplied by the deployment platform.
    DATABASE_URL: str | None = None

    # Individual Postgres values are an alternative to DATABASE_URL.
    POSTGRES_HOST: str | None = None
    POSTGRES_PORT: int | None = Field(default=None, gt=0, le=65535)
    POSTGRES_DB: str | None = None
    POSTGRES_USER: str | None = None
    POSTGRES_PASSWORD: str | None = Field(default=None, repr=False)

    # JWT / authentication settings.
    SECRET_KEY: str = Field(..., repr=False, description="Secret key for signing JWTs")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        ..., gt=0, description="JWT access token lifetime in minutes"
    )
    JWT_ALGORITHM: str = Field(..., description="JWT signing algorithm, e.g. HS256")
    JWT_ISSUER: str = Field(..., description="Token issuer identifier")
    JWT_AUDIENCE: str = Field(..., description="Token audience identifier")

    # Comma-separated origins keep environment configuration simple on hosts.
    CORS_ORIGINS: str = Field(
        "http://localhost:4200,http://127.0.0.1:4200",
        description="Comma-separated frontend origins allowed to call the API",
    )

    # Application environment label such as dev, test, staging, or production.
    ENV: str = Field("dev", description="Runtime environment")

    model_config = SettingsConfigDict(
        env_file=env_path,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_database_configuration(self) -> Self:
        """Require either DATABASE_URL or a complete set of Postgres parts."""
        if self.DATABASE_URL:
            return self

        database_parts = {
            "POSTGRES_HOST": self.POSTGRES_HOST,
            "POSTGRES_PORT": self.POSTGRES_PORT,
            "POSTGRES_DB": self.POSTGRES_DB,
            "POSTGRES_USER": self.POSTGRES_USER,
            "POSTGRES_PASSWORD": self.POSTGRES_PASSWORD,
        }
        missing = [name for name, value in database_parts.items() if value in (None, "")]

        if missing:
            raise ValueError(
                "Set DATABASE_URL or provide all Postgres settings. "
                f"Missing: {', '.join(missing)}"
            )

        return self

    @property
    def effective_database_url(self) -> str:
        """Return the SQLAlchemy database URL used by the app and Alembic."""
        if self.DATABASE_URL:
            return self.DATABASE_URL

        # Validation guarantees these values exist when DATABASE_URL is absent.
        return URL.create(
            "postgresql+psycopg2",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_HOST,
            port=self.POSTGRES_PORT,
            database=self.POSTGRES_DB,
        ).render_as_string(hide_password=False)

    @property
    def cors_origins(self) -> list[str]:
        """Return normalized CORS origins from the comma-separated setting."""
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return list(dict.fromkeys(origin for origin in origins if origin))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()  # type: ignore[call-arg]


settings = get_settings()

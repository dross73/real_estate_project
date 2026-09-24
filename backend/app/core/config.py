"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import ClassVar, Literal, Self
from urllib.parse import urlparse

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

    # Public URL used to build links sent in transactional emails.
    PUBLIC_APP_URL: str = Field(
        "http://localhost:4200",
        description="Public frontend base URL",
    )

    # Provider-neutral email configuration. Local development logs messages;
    # production can use any SMTP-compatible provider.
    EMAIL_DELIVERY_MODE: Literal["log", "smtp"] = "log"
    EMAIL_FROM_ADDRESS: str = "no-reply@example.com"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = Field(587, gt=0, le=65535)
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = Field(default=None, repr=False)
    SMTP_USE_TLS: bool = True
    SMTP_TIMEOUT_SECONDS: int = Field(10, gt=0, le=60)

    # Public-account verification policy.
    EMAIL_VERIFICATION_EXPIRE_MINUTES: int = Field(1440, gt=0)
    EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: int = Field(60, ge=0)

    # Public-account password-recovery policy.
    PASSWORD_RESET_EXPIRE_MINUTES: int = Field(60, gt=0)

    # S3-compatible object storage. Production can use R2, S3, B2, or another
    # compatible provider; local development can point these values at MinIO.
    OBJECT_STORAGE_BUCKET: str | None = None
    OBJECT_STORAGE_REGION: str = "us-east-1"
    OBJECT_STORAGE_ENDPOINT_URL: str | None = None
    OBJECT_STORAGE_ACCESS_KEY_ID: str | None = None
    OBJECT_STORAGE_SECRET_ACCESS_KEY: str | None = Field(default=None, repr=False)
    OBJECT_STORAGE_PUBLIC_BASE_URL: str | None = None
    OBJECT_STORAGE_ADDRESSING_STYLE: Literal["auto", "path", "virtual"] = "auto"
    OBJECT_STORAGE_PRESIGNED_URL_EXPIRE_SECONDS: int = Field(900, gt=0, le=604800)

    # Listing-photo processing safety limits and normalized output sizes.
    IMAGE_UPLOAD_MAX_BYTES: int = Field(75 * 1024 * 1024, gt=0)
    IMAGE_UPLOAD_MAX_PIXELS: int = Field(100_000_000, gt=0)
    LISTING_PHOTO_MAX_COUNT: int = Field(50, gt=0, le=50)

    # Listing-document safety limits. Launch scope accepts PDFs only.
    DOCUMENT_UPLOAD_MAX_BYTES: int = Field(20 * 1024 * 1024, gt=0)

    IMAGE_THUMBNAIL_MAX_EDGE: int = Field(480, gt=0)
    IMAGE_MEDIUM_MAX_EDGE: int = Field(960, gt=0)
    IMAGE_LARGE_MAX_EDGE: int = Field(1800, gt=0)
    IMAGE_WEBP_QUALITY: int = Field(84, ge=1, le=100)

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

    @model_validator(mode="after")
    def validate_object_storage_credentials(self) -> Self:
        """Require access-key credentials as a pair when either is supplied."""
        has_access_key = bool(self.OBJECT_STORAGE_ACCESS_KEY_ID)
        has_secret_key = bool(self.OBJECT_STORAGE_SECRET_ACCESS_KEY)

        if has_access_key != has_secret_key:
            raise ValueError(
                "OBJECT_STORAGE_ACCESS_KEY_ID and "
                "OBJECT_STORAGE_SECRET_ACCESS_KEY must be provided together"
            )

        return self

    @model_validator(mode="after")
    def validate_production_configuration(self) -> Self:
        """Reject development-only or incomplete settings in production."""
        if self.ENV.strip().lower() != "production":
            return self

        errors: list[str] = []

        if len(self.SECRET_KEY) < 32:
            errors.append("SECRET_KEY must contain at least 32 characters")

        public_app = urlparse(self.PUBLIC_APP_URL)
        if (
            public_app.scheme != "https"
            or not public_app.hostname
            or public_app.hostname in {"localhost", "127.0.0.1"}
        ):
            errors.append("PUBLIC_APP_URL must be a public HTTPS URL")

        if not self.cors_origins:
            errors.append("CORS_ORIGINS must include the production frontend origin")
        else:
            for origin in self.cors_origins:
                parsed = urlparse(origin)
                if (
                    parsed.scheme != "https"
                    or not parsed.hostname
                    or parsed.hostname in {"localhost", "127.0.0.1"}
                    or "*" in origin
                ):
                    errors.append(
                        "CORS_ORIGINS must contain only explicit public HTTPS origins"
                    )
                    break

        if self.EMAIL_DELIVERY_MODE != "smtp":
            errors.append("EMAIL_DELIVERY_MODE must be smtp in production")
        elif not self.SMTP_HOST:
            errors.append("SMTP_HOST is required for production email delivery")

        if not self.OBJECT_STORAGE_BUCKET:
            errors.append("OBJECT_STORAGE_BUCKET is required in production")
        if not self.OBJECT_STORAGE_ACCESS_KEY_ID:
            errors.append("OBJECT_STORAGE_ACCESS_KEY_ID is required in production")
        if not self.OBJECT_STORAGE_SECRET_ACCESS_KEY:
            errors.append("OBJECT_STORAGE_SECRET_ACCESS_KEY is required in production")

        if errors:
            raise ValueError("Production configuration invalid: " + "; ".join(errors))

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

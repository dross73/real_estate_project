"""S3-compatible object storage used for durable listing media."""

from dataclasses import dataclass
from io import BytesIO
from pathlib import PurePosixPath
from typing import BinaryIO, Mapping
from urllib.parse import quote

import boto3
from botocore.client import BaseClient
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import Settings, get_settings


class ObjectStorageError(RuntimeError):
    """Base exception for storage operations."""


class ObjectStorageConfigurationError(ObjectStorageError):
    """Raised when required object-storage configuration is missing."""


@dataclass(frozen=True)
class StoredObjectReference:
    """Stable object identifier plus a usable read URL."""

    key: str
    url: str


def normalize_object_key(key: str) -> str:
    """Validate a provider-independent POSIX object key."""
    candidate = key.strip()

    if not candidate:
        raise ValueError("Object key cannot be blank")
    if "\x00" in candidate:
        raise ValueError("Object key cannot contain null bytes")
    if "\\" in candidate:
        raise ValueError("Object key must use forward slashes")
    if candidate.startswith("/"):
        raise ValueError("Object key must be relative")

    path = PurePosixPath(candidate)
    if any(part in ("", ".", "..") for part in path.parts):
        raise ValueError("Object key cannot contain traversal segments")

    return path.as_posix()


class ObjectStorageService:
    """Small backend boundary around S3-compatible storage operations."""

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        client: BaseClient | None = None,
    ) -> None:
        self.settings = settings or get_settings()

        if not self.settings.OBJECT_STORAGE_BUCKET:
            raise ObjectStorageConfigurationError(
                "OBJECT_STORAGE_BUCKET must be configured before using media storage"
            )

        self.bucket = self.settings.OBJECT_STORAGE_BUCKET
        self.client = client or self._build_client()

    def _build_client(self) -> BaseClient:
        """Create a boto3 S3 client using standard or explicit credentials."""
        kwargs: dict[str, object] = {
            "service_name": "s3",
            "region_name": self.settings.OBJECT_STORAGE_REGION,
            "config": Config(
                signature_version="s3v4",
                s3={
                    "addressing_style": self.settings.OBJECT_STORAGE_ADDRESSING_STYLE
                },
            ),
        }

        if self.settings.OBJECT_STORAGE_ENDPOINT_URL:
            kwargs["endpoint_url"] = self.settings.OBJECT_STORAGE_ENDPOINT_URL

        if self.settings.OBJECT_STORAGE_ACCESS_KEY_ID:
            kwargs["aws_access_key_id"] = self.settings.OBJECT_STORAGE_ACCESS_KEY_ID
            kwargs["aws_secret_access_key"] = (
                self.settings.OBJECT_STORAGE_SECRET_ACCESS_KEY
            )

        return boto3.client(**kwargs)

    def upload_fileobj(
        self,
        key: str,
        fileobj: BinaryIO,
        *,
        content_type: str,
        cache_control: str | None = None,
        metadata: Mapping[str, str] | None = None,
    ) -> str:
        """Stream one object to durable storage without buffering the full file."""
        normalized_key = normalize_object_key(key)

        extra_args: dict[str, object] = {
            "ContentType": content_type,
        }
        if cache_control:
            extra_args["CacheControl"] = cache_control
        if metadata:
            extra_args["Metadata"] = dict(metadata)

        try:
            self.client.upload_fileobj(
                fileobj,
                self.bucket,
                normalized_key,
                ExtraArgs=extra_args,
            )
        except (BotoCoreError, ClientError, OSError) as exc:
            raise ObjectStorageError(
                f"Unable to upload object: {normalized_key}"
            ) from exc

        return normalized_key

    def upload_bytes(
        self,
        key: str,
        data: bytes,
        *,
        content_type: str,
        cache_control: str | None = None,
        metadata: Mapping[str, str] | None = None,
    ) -> str:
        """Convenience wrapper for small generated objects and tests."""
        return self.upload_fileobj(
            key,
            BytesIO(data),
            content_type=content_type,
            cache_control=cache_control,
            metadata=metadata,
        )

    def download_fileobj(self, key: str, fileobj: BinaryIO) -> None:
        """Stream one stored object into a writable file-like object."""
        normalized_key = normalize_object_key(key)

        try:
            self.client.download_fileobj(
                self.bucket,
                normalized_key,
                fileobj,
            )
        except (BotoCoreError, ClientError, OSError) as exc:
            raise ObjectStorageError(
                f"Unable to download object: {normalized_key}"
            ) from exc

    def replace_fileobj(
        self,
        key: str,
        fileobj: BinaryIO,
        *,
        content_type: str,
        cache_control: str | None = None,
        metadata: Mapping[str, str] | None = None,
    ) -> str:
        """Atomically replace one object key using the provider's PUT semantics."""
        return self.upload_fileobj(
            key,
            fileobj,
            content_type=content_type,
            cache_control=cache_control,
            metadata=metadata,
        )

    def delete_object(self, key: str) -> None:
        """Delete one stored object."""
        normalized_key = normalize_object_key(key)

        try:
            self.client.delete_object(
                Bucket=self.bucket,
                Key=normalized_key,
            )
        except (BotoCoreError, ClientError) as exc:
            raise ObjectStorageError(
                f"Unable to delete object: {normalized_key}"
            ) from exc

    def object_exists(self, key: str) -> bool:
        """Return whether a stored object currently exists."""
        normalized_key = normalize_object_key(key)

        try:
            self.client.head_object(
                Bucket=self.bucket,
                Key=normalized_key,
            )
            return True
        except ClientError as exc:
            response = getattr(exc, "response", {})
            status_code = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            error_code = response.get("Error", {}).get("Code")

            if status_code == 404 or error_code in ("404", "NoSuchKey", "NotFound"):
                return False

            raise ObjectStorageError(
                f"Unable to inspect object: {normalized_key}"
            ) from exc
        except BotoCoreError as exc:
            raise ObjectStorageError(
                f"Unable to inspect object: {normalized_key}"
            ) from exc

    def get_reference_url(
        self,
        key: str,
        *,
        expires_in: int | None = None,
    ) -> str:
        """Return a public/CDN URL or a short-lived signed read URL."""
        normalized_key = normalize_object_key(key)

        if self.settings.OBJECT_STORAGE_PUBLIC_BASE_URL:
            base_url = self.settings.OBJECT_STORAGE_PUBLIC_BASE_URL.rstrip("/")
            encoded_key = quote(normalized_key, safe="/")
            return f"{base_url}/{encoded_key}"

        expiration = (
            expires_in
            if expires_in is not None
            else self.settings.OBJECT_STORAGE_PRESIGNED_URL_EXPIRE_SECONDS
        )

        if expiration <= 0 or expiration > 604800:
            raise ValueError("expires_in must be between 1 and 604800 seconds")

        try:
            return self.client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": normalized_key,
                },
                ExpiresIn=expiration,
            )
        except (BotoCoreError, ClientError) as exc:
            raise ObjectStorageError(
                f"Unable to create object reference: {normalized_key}"
            ) from exc

    def upload_reference(
        self,
        key: str,
        fileobj: BinaryIO,
        *,
        content_type: str,
        cache_control: str | None = None,
        metadata: Mapping[str, str] | None = None,
    ) -> StoredObjectReference:
        """Upload one object and immediately return its usable reference."""
        normalized_key = self.upload_fileobj(
            key,
            fileobj,
            content_type=content_type,
            cache_control=cache_control,
            metadata=metadata,
        )

        return StoredObjectReference(
            key=normalized_key,
            url=self.get_reference_url(normalized_key),
        )

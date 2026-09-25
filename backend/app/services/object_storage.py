"""S3-compatible object storage used for durable listing media."""

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path, PurePosixPath
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


class LocalFileStorageService(ObjectStorageService):
    """Development storage that writes media beneath a local project directory."""

    def __init__(self, *, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.root = self.settings.local_media_root_path.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _local_path(self, key: str) -> tuple[str, Path]:
        """Return a normalized storage key and its safe local filesystem path."""
        normalized_key = normalize_object_key(key)
        path = self.root.joinpath(*PurePosixPath(normalized_key).parts)
        return normalized_key, path

    def upload_fileobj(
        self,
        key: str,
        fileobj: BinaryIO,
        *,
        content_type: str,
        cache_control: str | None = None,
        metadata: Mapping[str, str] | None = None,
    ) -> str:
        """Write one uploaded object to the local development media directory."""
        del content_type, cache_control, metadata
        normalized_key, path = self._local_path(key)

        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("wb") as destination:
                while chunk := fileobj.read(1024 * 1024):
                    destination.write(chunk)
        except OSError as exc:
            raise ObjectStorageError(
                f"Unable to upload local object: {normalized_key}"
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
        """Write generated bytes through the same local-storage path."""
        return self.upload_fileobj(
            key,
            BytesIO(data),
            content_type=content_type,
            cache_control=cache_control,
            metadata=metadata,
        )

    def download_fileobj(self, key: str, fileobj: BinaryIO) -> None:
        """Stream one locally stored object into a writable file-like object."""
        normalized_key, path = self._local_path(key)

        try:
            with path.open("rb") as source:
                while chunk := source.read(1024 * 1024):
                    fileobj.write(chunk)
        except OSError as exc:
            raise ObjectStorageError(
                f"Unable to download local object: {normalized_key}"
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
        """Replace a local object while preserving its storage key."""
        return self.upload_fileobj(
            key,
            fileobj,
            content_type=content_type,
            cache_control=cache_control,
            metadata=metadata,
        )

    def delete_object(self, key: str) -> None:
        """Delete one local object when it exists."""
        normalized_key, path = self._local_path(key)

        try:
            path.unlink(missing_ok=True)
        except OSError as exc:
            raise ObjectStorageError(
                f"Unable to delete local object: {normalized_key}"
            ) from exc

    def object_exists(self, key: str) -> bool:
        """Return whether a local object exists."""
        _, path = self._local_path(key)
        return path.is_file()

    def get_reference_url(
        self,
        key: str,
        *,
        expires_in: int | None = None,
    ) -> str:
        """Return the FastAPI-served development URL for a local object."""
        del expires_in
        normalized_key = normalize_object_key(key)
        base_url = self.settings.LOCAL_MEDIA_BASE_URL.rstrip("/")
        encoded_key = quote(normalized_key, safe="/")
        return f"{base_url}/{encoded_key}"

    def upload_reference(
        self,
        key: str,
        fileobj: BinaryIO,
        *,
        content_type: str,
        cache_control: str | None = None,
        metadata: Mapping[str, str] | None = None,
    ) -> StoredObjectReference:
        """Upload a local object and return its browser-readable URL."""
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


def create_media_storage(
    settings: Settings | None = None,
) -> ObjectStorageService:
    """Create the configured media-storage backend for this environment."""
    effective_settings = settings or get_settings()

    if effective_settings.MEDIA_STORAGE_BACKEND == "local":
        return LocalFileStorageService(settings=effective_settings)

    return ObjectStorageService(settings=effective_settings)

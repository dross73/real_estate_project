"""Unit tests for the S3-compatible object-storage boundary."""

from io import BytesIO

import pytest
from botocore.exceptions import ClientError
from pydantic import ValidationError

from app.core.config import Settings
from app.services.object_storage import (
    LocalFileStorageService,
    ObjectStorageConfigurationError,
    ObjectStorageService,
    create_media_storage,
    normalize_object_key,
)


BASE_SETTINGS = {
    "DATABASE_URL": "postgresql+psycopg2://user:pass@example.com:5432/database",
    "SECRET_KEY": "test-secret",
    "ACCESS_TOKEN_EXPIRE_MINUTES": 30,
    "JWT_ALGORITHM": "HS256",
    "JWT_ISSUER": "test-issuer",
    "JWT_AUDIENCE": "test-audience",
}


class FakeS3Client:
    """Minimal in-memory stand-in for the boto3 methods the service uses."""

    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], bytes] = {}
        self.uploads: list[dict] = []
        self.downloads: list[tuple[str, str]] = []
        self.deletes: list[tuple[str, str]] = []

    def upload_fileobj(self, fileobj, bucket, key, ExtraArgs):
        data = fileobj.read()
        self.objects[(bucket, key)] = data
        self.uploads.append(
            {
                "bucket": bucket,
                "key": key,
                "extra_args": ExtraArgs,
                "data": data,
            }
        )

    def download_fileobj(self, bucket, key, fileobj):
        self.downloads.append((bucket, key))
        fileobj.write(self.objects[(bucket, key)])

    def delete_object(self, *, Bucket, Key):
        self.deletes.append((Bucket, Key))
        self.objects.pop((Bucket, Key), None)

    def head_object(self, *, Bucket, Key):
        if (Bucket, Key) in self.objects:
            return {"ContentLength": len(self.objects[(Bucket, Key)])}

        raise ClientError(
            {
                "Error": {"Code": "NoSuchKey", "Message": "missing"},
                "ResponseMetadata": {"HTTPStatusCode": 404},
            },
            "HeadObject",
        )

    def generate_presigned_url(self, client_method, Params, ExpiresIn):
        return (
            f"https://signed.example/{Params['Bucket']}/{Params['Key']}"
            f"?expires={ExpiresIn}"
        )


def _settings(**overrides) -> Settings:
    """Build isolated settings without inheriting host environment variables."""
    values = {
        **BASE_SETTINGS,
        "OBJECT_STORAGE_BUCKET": "test-media",
        "OBJECT_STORAGE_REGION": "us-east-1",
        "OBJECT_STORAGE_ACCESS_KEY_ID": None,
        "OBJECT_STORAGE_SECRET_ACCESS_KEY": None,
        **overrides,
    }
    return Settings(_env_file=None, **values)


def test_upload_download_replace_and_delete_object():
    """Core storage operations should use one stable object key."""
    client = FakeS3Client()
    service = ObjectStorageService(
        settings=_settings(),
        client=client,
    )

    key = service.upload_fileobj(
        "listings/42/photo.webp",
        BytesIO(b"first"),
        content_type="image/webp",
        cache_control="public, max-age=31536000",
        metadata={"variant": "large"},
    )

    assert key == "listings/42/photo.webp"
    assert service.object_exists(key) is True
    assert client.uploads[0]["extra_args"] == {
        "ContentType": "image/webp",
        "CacheControl": "public, max-age=31536000",
        "Metadata": {"variant": "large"},
    }

    downloaded = BytesIO()
    service.download_fileobj(key, downloaded)
    assert downloaded.getvalue() == b"first"

    service.replace_fileobj(
        key,
        BytesIO(b"replacement"),
        content_type="image/webp",
    )

    replaced = BytesIO()
    service.download_fileobj(key, replaced)
    assert replaced.getvalue() == b"replacement"

    service.delete_object(key)
    assert service.object_exists(key) is False


def test_public_base_url_is_used_for_stable_listing_media_reference():
    """Configured CDN/public origins should produce stable encoded URLs."""
    service = ObjectStorageService(
        settings=_settings(
            OBJECT_STORAGE_PUBLIC_BASE_URL="https://media.example.com/base/",
        ),
        client=FakeS3Client(),
    )

    url = service.get_reference_url("listings/42/front photo.webp")

    assert url == "https://media.example.com/base/listings/42/front%20photo.webp"


def test_presigned_url_is_used_when_no_public_base_url_exists():
    """Private/local storage should fall back to a short-lived signed URL."""
    service = ObjectStorageService(
        settings=_settings(
            OBJECT_STORAGE_PUBLIC_BASE_URL=None,
            OBJECT_STORAGE_PRESIGNED_URL_EXPIRE_SECONDS=600,
        ),
        client=FakeS3Client(),
    )

    url = service.get_reference_url("listings/42/private.pdf")

    assert url.endswith("?expires=600")


@pytest.mark.parametrize(
    "key",
    [
        "",
        "   ",
        "/absolute/path.webp",
        "../outside.webp",
        "listings/../outside.webp",
        "listings\\42\\photo.webp",
    ],
)
def test_invalid_object_keys_are_rejected(key):
    """Storage keys must not contain traversal or filesystem-style paths."""
    with pytest.raises(ValueError):
        normalize_object_key(key)


def test_bucket_configuration_is_required_when_service_is_used():
    """Application startup can work without media, but storage use requires a bucket."""
    with pytest.raises(ObjectStorageConfigurationError):
        ObjectStorageService(
            settings=_settings(OBJECT_STORAGE_BUCKET=None),
            client=FakeS3Client(),
        )


def test_storage_credentials_must_be_configured_as_a_pair():
    """A half-configured explicit credential pair should fail settings validation."""
    with pytest.raises(ValidationError):
        _settings(
            OBJECT_STORAGE_ACCESS_KEY_ID="access-key-only",
            OBJECT_STORAGE_SECRET_ACCESS_KEY=None,
        )



def test_local_storage_upload_read_replace_and_delete(tmp_path):
    """Local development storage should mirror the core S3 operations."""
    settings = _settings(
        MEDIA_STORAGE_BACKEND="local",
        LOCAL_MEDIA_ROOT=tmp_path,
        LOCAL_MEDIA_BASE_URL="http://localhost:8000/media",
    )
    storage = LocalFileStorageService(settings=settings)
    key = "listings/7/photos/example.webp"

    stored_key = storage.upload_bytes(
        key,
        b"first",
        content_type="image/webp",
    )

    assert stored_key == key
    assert storage.object_exists(key) is True

    downloaded = BytesIO()
    storage.download_fileobj(key, downloaded)
    assert downloaded.getvalue() == b"first"

    storage.replace_fileobj(
        key,
        BytesIO(b"second"),
        content_type="image/webp",
    )

    replaced = BytesIO()
    storage.download_fileobj(key, replaced)
    assert replaced.getvalue() == b"second"

    storage.delete_object(key)
    assert storage.object_exists(key) is False


def test_local_storage_returns_fastapi_media_url(tmp_path):
    """Local browser references should use the FastAPI media mount."""
    storage = LocalFileStorageService(
        settings=_settings(
            MEDIA_STORAGE_BACKEND="local",
            LOCAL_MEDIA_ROOT=tmp_path,
            LOCAL_MEDIA_BASE_URL="http://localhost:8000/media",
        )
    )

    assert storage.get_reference_url("listings/7/My Photo.webp") == (
        "http://localhost:8000/media/listings/7/My%20Photo.webp"
    )


def test_media_storage_factory_uses_local_backend(tmp_path):
    """Local configuration should not require S3-compatible infrastructure."""
    storage = create_media_storage(
        _settings(
            MEDIA_STORAGE_BACKEND="local",
            LOCAL_MEDIA_ROOT=tmp_path,
        )
    )

    assert isinstance(storage, LocalFileStorageService)

"""Tests for listing image validation, normalization, and variant storage."""

from io import BytesIO
from pathlib import Path

import pytest
from fastapi import UploadFile
from PIL import Image
from pillow_heif import register_heif_opener

from app.core.config import Settings
from app.services.image_processing import (
    ImageProcessingError,
    ImageUploadTooLargeError,
    ListingImageProcessor,
)


register_heif_opener(thumbnails=False)


BASE_SETTINGS = {
    "DATABASE_URL": "postgresql+psycopg2://user:pass@example.com:5432/database",
    "SECRET_KEY": "test-secret",
    "ACCESS_TOKEN_EXPIRE_MINUTES": 30,
    "JWT_ALGORITHM": "HS256",
    "JWT_ISSUER": "test-issuer",
    "JWT_AUDIENCE": "test-audience",
}


class FakeStorage:
    """Capture optimized objects without requiring a real S3 provider."""

    def __init__(self, fail_on_variant: str | None = None) -> None:
        self.objects: dict[str, bytes] = {}
        self.deleted: list[str] = []
        self.fail_on_variant = fail_on_variant

    def upload_fileobj(
        self,
        key,
        fileobj,
        *,
        content_type,
        cache_control=None,
        metadata=None,
    ):
        if self.fail_on_variant and key.endswith(
            f"/{self.fail_on_variant}.webp"
        ):
            raise RuntimeError("simulated storage failure")
        self.objects[key] = fileobj.read()
        return key

    def delete_object(self, key):
        self.deleted.append(key)
        self.objects.pop(key, None)


def _settings(**overrides) -> Settings:
    values = {
        **BASE_SETTINGS,
        "IMAGE_UPLOAD_MAX_BYTES": 75 * 1024 * 1024,
        "IMAGE_UPLOAD_MAX_PIXELS": 100_000_000,
        "IMAGE_THUMBNAIL_MAX_EDGE": 480,
        "IMAGE_MEDIUM_MAX_EDGE": 960,
        "IMAGE_LARGE_MAX_EDGE": 1800,
        "IMAGE_WEBP_QUALITY": 84,
        **overrides,
    }
    return Settings(_env_file=None, **values)


def _image_bytes(
    image_format: str,
    *,
    size: tuple[int, int] = (1200, 800),
    exif_orientation: int | None = None,
) -> bytes:
    image = Image.new("RGB", size, (120, 160, 200))
    buffer = BytesIO()

    save_kwargs = {}
    if exif_orientation is not None:
        exif = Image.Exif()
        exif[274] = exif_orientation
        save_kwargs["exif"] = exif

    image.save(buffer, format=image_format, **save_kwargs)
    return buffer.getvalue()


@pytest.mark.parametrize(
    ("image_format", "filename"),
    [
        ("JPEG", "photo.jpg"),
        ("PNG", "photo.png"),
        ("WEBP", "photo.webp"),
        ("HEIF", "photo.heic"),
    ],
)
def test_supported_camera_formats_become_three_webp_variants(
    tmp_path,
    image_format,
    filename,
):
    """Every accepted source format should normalize to optimized WebP files."""
    processor = ListingImageProcessor(
        settings=_settings(),
        temp_dir=tmp_path,
    )
    storage = FakeStorage()
    upload = UploadFile(
        filename=filename,
        file=BytesIO(_image_bytes(image_format)),
    )

    result = processor.process_upload(
        listing_id=42,
        upload=upload,
        storage=storage,
    )

    assert result.source_format in {"JPEG", "PNG", "WEBP", "HEIF", "HEIC"}
    assert result.width == 1200
    assert result.height == 800
    assert len(storage.objects) == 3
    assert set(result.object_keys) == set(storage.objects)

    expected_max_edges = {
        "thumbnail": 480,
        "medium": 960,
        "large": 1800,
    }

    for key, data in storage.objects.items():
        with Image.open(BytesIO(data)) as output:
            assert output.format == "WEBP"
            assert output.getexif() == {}
            variant = Path(key).stem
            assert max(output.size) <= expected_max_edges[variant]

    assert list(tmp_path.iterdir()) == []


def test_exif_orientation_is_applied_before_variant_generation(tmp_path):
    """Portrait rotation metadata should become real pixel orientation."""
    processor = ListingImageProcessor(
        settings=_settings(),
        temp_dir=tmp_path,
    )
    storage = FakeStorage()
    upload = UploadFile(
        filename="rotated.jpg",
        file=BytesIO(
            _image_bytes(
                "JPEG",
                size=(1200, 800),
                exif_orientation=6,
            )
        ),
    )

    result = processor.process_upload(
        listing_id=1,
        upload=upload,
        storage=storage,
    )

    assert (result.width, result.height) == (800, 1200)


def test_corrupt_file_is_rejected_and_temp_file_is_removed(tmp_path):
    """Filename/content-type claims must not bypass actual image validation."""
    processor = ListingImageProcessor(
        settings=_settings(),
        temp_dir=tmp_path,
    )

    with pytest.raises(ImageProcessingError):
        processor.process_upload(
            listing_id=1,
            upload=UploadFile(
                filename="fake.jpg",
                file=BytesIO(b"this is not an image"),
            ),
            storage=FakeStorage(),
        )

    assert list(tmp_path.iterdir()) == []


def test_byte_safety_limit_is_enforced_while_streaming(tmp_path):
    """Very large source uploads should stop before image decoding."""
    processor = ListingImageProcessor(
        settings=_settings(IMAGE_UPLOAD_MAX_BYTES=1024),
        temp_dir=tmp_path,
    )

    with pytest.raises(ImageUploadTooLargeError):
        processor.process_upload(
            listing_id=1,
            upload=UploadFile(
                filename="too-large.jpg",
                file=BytesIO(b"x" * 2048),
            ),
            storage=FakeStorage(),
        )

    assert list(tmp_path.iterdir()) == []


def test_pixel_safety_limit_rejects_absurd_dimensions(tmp_path):
    """Pixel ceilings protect the decoder independently of file byte size."""
    processor = ListingImageProcessor(
        settings=_settings(IMAGE_UPLOAD_MAX_PIXELS=100),
        temp_dir=tmp_path,
    )

    with pytest.raises(ImageProcessingError):
        processor.process_upload(
            listing_id=1,
            upload=UploadFile(
                filename="too-many-pixels.png",
                file=BytesIO(_image_bytes("PNG", size=(20, 20))),
            ),
            storage=FakeStorage(),
        )

    assert list(tmp_path.iterdir()) == []


def test_partial_storage_failure_removes_already_uploaded_variants(tmp_path):
    """A failed photo must not leave orphaned optimized objects."""
    processor = ListingImageProcessor(
        settings=_settings(),
        temp_dir=tmp_path,
    )
    storage = FakeStorage(fail_on_variant="medium")

    with pytest.raises(RuntimeError, match="simulated storage failure"):
        processor.process_upload(
            listing_id=7,
            upload=UploadFile(
                filename="photo.jpg",
                file=BytesIO(_image_bytes("JPEG")),
            ),
            storage=storage,
        )

    assert storage.objects == {}
    assert len(storage.deleted) == 1
    assert storage.deleted[0].endswith("/thumbnail.webp")
    assert list(tmp_path.iterdir()) == []

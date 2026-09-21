"""Safe one-at-a-time processing for listing photo uploads."""

from dataclasses import dataclass
from pathlib import Path
import tempfile
from typing import BinaryIO
from uuid import uuid4
import warnings

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener

from app.core.config import Settings, get_settings
from app.services.object_storage import ObjectStorageService


# Register HEIC/HEIF decoding with Pillow without extracting embedded thumbnails.
register_heif_opener(thumbnails=False)

ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP", "HEIF", "HEIC"}
CHUNK_SIZE = 1024 * 1024
WEBP_CONTENT_TYPE = "image/webp"
PUBLIC_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable"


class ImageProcessingError(ValueError):
    """Raised when an uploaded image cannot be safely processed."""


class ImageUploadTooLargeError(ImageProcessingError):
    """Raised when the upload exceeds the technical safety ceiling."""


@dataclass(frozen=True)
class ProcessedListingImage:
    """Optimized storage keys and metadata produced from one source image."""

    original_filename: str
    source_format: str
    width: int
    height: int
    thumbnail_key: str
    medium_key: str
    large_key: str

    @property
    def object_keys(self) -> tuple[str, str, str]:
        """Return every permanent object belonging to this processed image."""
        return (
            self.thumbnail_key,
            self.medium_key,
            self.large_key,
        )


class ListingImageProcessor:
    """Validate, normalize, resize, and store one listing photo at a time."""

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        temp_dir: str | Path | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.temp_dir = Path(temp_dir) if temp_dir is not None else None

    def process_upload(
        self,
        *,
        listing_id: int,
        upload: UploadFile,
        storage: ObjectStorageService,
    ) -> ProcessedListingImage:
        """Process one uploaded camera image into three optimized WebP variants."""
        source_path = self._copy_upload_to_temp(upload)
        stored_keys: list[str] = []

        try:
            source_format, prepared = self._open_and_normalize(source_path)
            width, height = prepared.size
            object_prefix = (
                f"listings/{listing_id}/photos/{uuid4().hex}"
            )

            variant_specs = (
                (
                    "thumbnail",
                    self.settings.IMAGE_THUMBNAIL_MAX_EDGE,
                    max(1, self.settings.IMAGE_WEBP_QUALITY - 4),
                ),
                (
                    "medium",
                    self.settings.IMAGE_MEDIUM_MAX_EDGE,
                    max(1, self.settings.IMAGE_WEBP_QUALITY - 2),
                ),
                (
                    "large",
                    self.settings.IMAGE_LARGE_MAX_EDGE,
                    self.settings.IMAGE_WEBP_QUALITY,
                ),
            )

            keys: dict[str, str] = {}

            for variant_name, max_edge, quality in variant_specs:
                variant_path = self._write_variant_temp(
                    prepared,
                    max_edge=max_edge,
                    quality=quality,
                )

                try:
                    key = f"{object_prefix}/{variant_name}.webp"
                    with variant_path.open("rb") as variant_file:
                        storage.upload_fileobj(
                            key,
                            variant_file,
                            content_type=WEBP_CONTENT_TYPE,
                            cache_control=PUBLIC_IMAGE_CACHE_CONTROL,
                            metadata={
                                "variant": variant_name,
                                "source-format": source_format.lower(),
                            },
                        )
                    stored_keys.append(key)
                    keys[variant_name] = key
                finally:
                    variant_path.unlink(missing_ok=True)

            return ProcessedListingImage(
                original_filename=self._safe_filename(upload.filename),
                source_format=source_format,
                width=width,
                height=height,
                thumbnail_key=keys["thumbnail"],
                medium_key=keys["medium"],
                large_key=keys["large"],
            )
        except Exception:
            # A partially processed photo should never leave orphaned variants.
            for key in reversed(stored_keys):
                try:
                    storage.delete_object(key)
                except Exception:
                    # Cleanup is best-effort; preserve the original failure.
                    pass
            raise
        finally:
            source_path.unlink(missing_ok=True)

    def _copy_upload_to_temp(self, upload: UploadFile) -> Path:
        """Stream an upload to a temporary file while enforcing a byte ceiling."""
        suffix = Path(upload.filename or "").suffix[:16]
        temp_file = tempfile.NamedTemporaryFile(
            prefix="listing-upload-",
            suffix=suffix,
            dir=self.temp_dir,
            delete=False,
        )
        temp_path = Path(temp_file.name)
        total_bytes = 0

        try:
            upload.file.seek(0)

            while True:
                chunk = upload.file.read(CHUNK_SIZE)
                if not chunk:
                    break

                total_bytes += len(chunk)
                if total_bytes > self.settings.IMAGE_UPLOAD_MAX_BYTES:
                    raise ImageUploadTooLargeError(
                        "Image exceeds the technical upload size limit"
                    )

                temp_file.write(chunk)

            if total_bytes == 0:
                raise ImageProcessingError("Uploaded image is empty")

            temp_file.flush()
            return temp_path
        except Exception:
            temp_path.unlink(missing_ok=True)
            raise
        finally:
            temp_file.close()

    def _open_and_normalize(self, source_path: Path) -> tuple[str, Image.Image]:
        """Validate actual image bytes, fix orientation, and strip metadata."""
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)

                with Image.open(source_path) as probe:
                    source_format = (probe.format or "").upper()
                    if source_format not in ALLOWED_IMAGE_FORMATS:
                        raise ImageProcessingError(
                            "Supported image formats are JPEG, PNG, WebP, and HEIC/HEIF"
                        )

                    width, height = probe.size
                    if width <= 0 or height <= 0:
                        raise ImageProcessingError("Image dimensions are invalid")
                    if width * height > self.settings.IMAGE_UPLOAD_MAX_PIXELS:
                        raise ImageProcessingError(
                            "Image exceeds the technical pixel safety limit"
                        )

                    probe.verify()

                with Image.open(source_path) as image:
                    image.load()
                    oriented = ImageOps.exif_transpose(image)
                    prepared = self._strip_metadata_to_rgb(oriented)

            return source_format, prepared
        except ImageProcessingError:
            raise
        except (
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
            UnidentifiedImageError,
            OSError,
            SyntaxError,
            ValueError,
        ) as exc:
            raise ImageProcessingError(
                "Uploaded file is not a valid supported image"
            ) from exc

    @staticmethod
    def _strip_metadata_to_rgb(image: Image.Image) -> Image.Image:
        """Create a fresh RGB image so EXIF/XMP/ICC metadata is not carried forward."""
        if image.mode in ("RGBA", "LA") or "transparency" in image.info:
            rgba = image.convert("RGBA")
            background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            background.alpha_composite(rgba)
            rgb_source = background.convert("RGB")
        else:
            rgb_source = image.convert("RGB")

        clean = Image.new("RGB", rgb_source.size, (255, 255, 255))
        clean.paste(rgb_source)
        return clean

    def _write_variant_temp(
        self,
        image: Image.Image,
        *,
        max_edge: int,
        quality: int,
    ) -> Path:
        """Write one resized WebP variant to temporary storage."""
        variant = image.copy()
        variant.thumbnail(
            (max_edge, max_edge),
            Image.Resampling.LANCZOS,
        )

        temp_file = tempfile.NamedTemporaryFile(
            prefix="listing-variant-",
            suffix=".webp",
            dir=self.temp_dir,
            delete=False,
        )
        variant_path = Path(temp_file.name)
        temp_file.close()

        try:
            variant.save(
                variant_path,
                format="WEBP",
                quality=quality,
                method=6,
                optimize=True,
                exif=b"",
            )
            return variant_path
        except Exception:
            variant_path.unlink(missing_ok=True)
            raise

    @staticmethod
    def _safe_filename(filename: str | None) -> str:
        """Keep only a bounded basename for display/audit metadata."""
        clean_name = Path(filename or "upload").name.strip() or "upload"
        return clean_name[:255]

"""CSV export helpers with spreadsheet-injection protection."""

import csv
from datetime import datetime, timezone
import io
from tempfile import SpooledTemporaryFile
from typing import Iterable, Iterator


CSV_SPOOL_BYTES = 2_000_000


def csv_safe(value) -> str:
    """Render one cell safely for spreadsheet applications."""
    if value is None:
        return ""

    if isinstance(value, datetime):
        timestamp = value
        if timestamp.tzinfo is None or timestamp.utcoffset() is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        return timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    text = str(value)
    if text.startswith(("=", "+", "-", "@")):
        return f"'{text}"
    return text


def build_spooled_csv(
    headers: list[str],
    rows: Iterable[Iterable[object]],
) -> SpooledTemporaryFile:
    """Write CSV incrementally and spill larger exports to temporary disk."""
    output = SpooledTemporaryFile(
        max_size=CSV_SPOOL_BYTES,
        mode="w+",
        newline="",
        encoding="utf-8",
    )
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(headers)

    for row in rows:
        writer.writerow([csv_safe(value) for value in row])

    output.flush()
    output.seek(0)
    return output


def stream_text_file(file_obj, chunk_size: int = 64 * 1024) -> Iterator[str]:
    """Yield a prepared temporary text file in bounded chunks."""
    try:
        while True:
            chunk = file_obj.read(chunk_size)
            if not chunk:
                break
            yield chunk
    finally:
        file_obj.close()

"""Public SEO resources backed by current public site/listing data."""

from datetime import datetime, timezone
from urllib.parse import urljoin
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import AgentProfile, Listing
from app.db.session import get_db
from app.services.site_settings import read_site_settings


settings = get_settings()
PUBLIC_LISTING_STATUSES = ("Active", "Pending", "Sold")

router = APIRouter(
    prefix="/public/seo",
    tags=["Public SEO"],
)


def _public_base_url() -> str:
    """Return the configured public frontend origin/base with one trailing slash."""
    return settings.PUBLIC_APP_URL.rstrip("/") + "/"


def _absolute_url(path: str) -> str:
    return urljoin(_public_base_url(), path.lstrip("/"))


def _last_modified(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).date().isoformat()


def _url_entry(
    location: str,
    *,
    last_modified: datetime | None = None,
) -> str:
    lastmod = _last_modified(last_modified)
    parts = [f"    <loc>{escape(location)}</loc>"]
    if lastmod:
        parts.append(f"    <lastmod>{lastmod}</lastmod>")
    return "  <url>\n" + "\n".join(parts) + "\n  </url>"


@router.get(
    "/sitemap.xml",
    status_code=status.HTTP_200_OK,
)
def sitemap_xml(db: Session = Depends(get_db)) -> Response:
    """Return only canonical, currently public routes for sitemap generation."""
    site = read_site_settings(db)
    entries: list[str] = []

    # Static public pages follow the same visibility settings as navigation.
    static_paths = ["/", "/listings"]
    if site.show_about:
        static_paths.append("/about")
    if site.show_contact:
        static_paths.append("/contact")
    if site.show_privacy:
        static_paths.append("/privacy")
    if site.show_terms:
        static_paths.append("/terms")

    for path in static_paths:
        entries.append(
            _url_entry(
                _absolute_url(path),
                last_modified=site.updated_at,
            )
        )

    # Only active/public agent profiles are intentionally indexable.
    agents = (
        db.query(AgentProfile)
        .filter(
            AgentProfile.is_active.is_(True),
            AgentProfile.is_public.is_(True),
        )
        .order_by(AgentProfile.id.asc())
        .all()
    )
    for agent in agents:
        entries.append(
            _url_entry(
                _absolute_url(f"/agents/{agent.id}"),
                last_modified=agent.updated_at,
            )
        )

    # Reuse the same lifecycle and visibility boundary as the public listing API.
    listings = (
        db.query(Listing)
        .filter(
            Listing.is_public.is_(True),
            Listing.status.in_(PUBLIC_LISTING_STATUSES),
        )
        .order_by(Listing.id.asc())
        .all()
    )
    for listing in listings:
        entries.append(
            _url_entry(
                _absolute_url(f"/listings/{listing.id}"),
                last_modified=listing.updated_at or listing.created_at,
            )
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    return Response(
        content=xml,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=300"},
    )

"""Offline approximate coordinates shared by demo seeding and backfill."""
from app.db.models import Listing

CITY_CENTERS = {
    "ames": (42.0308, -93.6319), "story city": (42.1872, -93.5958),
    "huxley": (41.8953, -93.6008), "ankeny": (41.7318, -93.6001),
    "gilbert": (42.1069, -93.6497), "nevada": (42.0228, -93.4523),
    "boone": (42.0597, -93.8802),
}


def approximate_demo_coordinates(listing: Listing) -> tuple[float, float] | None:
    """Preserve existing/partial coordinates; only locate recognized Iowa demos."""
    is_demo = (listing.mls_number or "").startswith("DEMO-") or "fictional portfolio" in (listing.source_attribution or "").lower()
    center = CITY_CENTERS.get(listing.city.strip().lower())
    if not is_demo or listing.state.upper() != "IA" or not center:
        return None
    if listing.latitude is not None or listing.longitude is not None:
        return None
    # Stable small offsets avoid stacking every fictional home on city hall.
    return (
        round(center[0] + ((listing.id % 5) - 2) * .002, 6),
        round(center[1] + (((listing.id // 5) % 5) - 2) * .002, 6),
    )

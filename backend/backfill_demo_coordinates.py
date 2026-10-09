"""One-time, offline demo location backfill; dry-run unless --apply is supplied.

These are approximate city-area locations for fictional homes, not geocoded
street addresses. Existing coordinates and non-demo listings are untouched.
Run after Alembic upgrade head, from backend: python backfill_demo_coordinates.py --apply
"""
import argparse
from app.db.models import Listing
from app.db.session import SessionLocal

CITY_CENTERS = {
    "ames": (42.0308, -93.6319), "story city": (42.1872, -93.5958),
    "huxley": (41.8953, -93.6008), "ankeny": (41.7318, -93.6001),
    "gilbert": (42.1069, -93.6497), "nevada": (42.0228, -93.4523),
    "boone": (42.0597, -93.8802),
}


def backfill(db, apply=False):
    changed = 0
    for listing in db.query(Listing).order_by(Listing.id):
        is_demo = (listing.mls_number or "").startswith("DEMO-") or "fictional portfolio" in (listing.source_attribution or "").lower()
        center = CITY_CENTERS.get(listing.city.strip().lower())
        if not is_demo or listing.state.upper() != "IA" or not center:
            continue
        if listing.latitude is not None or listing.longitude is not None:
            continue
        # Stable small offsets avoid stacking every fictional home on city hall.
        latitude = round(center[0] + ((listing.id % 5) - 2) * .002, 6)
        longitude = round(center[1] + (((listing.id // 5) % 5) - 2) * .002, 6)
        print(f"Demo listing {listing.id}: {listing.city} ({latitude}, {longitude})")
        if apply:
            listing.latitude, listing.longitude = latitude, longitude
        changed += 1
    if apply:
        db.commit()
    return changed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db:
        print(f"{backfill(db, args.apply)} demo listings {'updated' if args.apply else 'eligible (dry run)' }.")

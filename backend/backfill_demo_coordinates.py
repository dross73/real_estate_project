"""One-time, offline demo location backfill; dry-run unless --apply is supplied.

These are approximate city-area locations for fictional homes, not geocoded
street addresses. Existing coordinates and non-demo listings are untouched.
Run after Alembic upgrade head, from backend: python backfill_demo_coordinates.py --apply
"""
import argparse
from app.cli.demo_coordinates import CITY_CENTERS, approximate_demo_coordinates
from app.db.models import Listing
from app.db.session import SessionLocal


def backfill(db, apply=False):
    changed = 0
    for listing in db.query(Listing).order_by(Listing.id):
        coordinates = approximate_demo_coordinates(listing)
        if coordinates is None:
            continue
        latitude, longitude = coordinates
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

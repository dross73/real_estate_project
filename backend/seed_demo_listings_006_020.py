"""Seed fictional portfolio demo listings DEMO-006 through DEMO-020.

Run from the backend directory:
    python seed_demo_listings_006_020.py

The script is idempotent: it skips an existing listing when either its
MLS/demo number matches or its title and address already match.
"""

from app.cli.demo_listing_data import DEMO_LISTINGS as FULL_DEMO_LISTINGS
from app.db.models import Listing
from app.db.session import SessionLocal
from app.schemas.listing import ListingCreate


# Keep this legacy script limited to its original DEMO-006 through DEMO-020 set.
DEMO_LISTINGS = [row for row in FULL_DEMO_LISTINGS if row["mls_number"] in {f"DEMO-{i:03d}" for i in range(6, 21)}]


def main() -> None:
    """Insert missing demo listings and print the created database IDs."""
    db = SessionLocal()
    created: list[tuple[str, int]] = []
    skipped: list[tuple[str, int]] = []

    try:
        for raw_listing in DEMO_LISTINGS:
            payload = ListingCreate.model_validate(raw_listing)

            existing = (
                db.query(Listing)
                .filter(
                    (Listing.mls_number == payload.mls_number)
                    | (
                        (Listing.title == payload.title)
                        & (Listing.address == payload.address)
                    )
                )
                .first()
            )
            if existing is not None:
                skipped.append((payload.mls_number or payload.title, existing.id))
                continue

            listing = Listing(**payload.model_dump())
            if listing.status in ("Draft", "Archived"):
                listing.is_public = False

            db.add(listing)
            db.flush()
            created.append((payload.mls_number or payload.title, listing.id))

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    if created:
        print("Created listings:")
        for mls_number, listing_id in created:
            print(f"  {mls_number}: listing id {listing_id}")
    else:
        print("No new listings created.")

    if skipped:
        print("Skipped existing listings:")
        for mls_number, listing_id in skipped:
            print(f"  {mls_number}: existing listing id {listing_id}")


if __name__ == "__main__":
    main()

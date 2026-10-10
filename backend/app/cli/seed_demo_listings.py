"""Dry-run-first seeding of the fictional DEMO-001 through DEMO-020 catalog."""
import argparse
from dataclasses import dataclass, field
import sys

from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.cli.demo_coordinates import approximate_demo_coordinates
from app.cli.demo_listing_data import DEMO_LISTINGS
from app.db.models import Listing
from app.schemas.listing import ListingCreate


class DemoSeedError(RuntimeError):
    """Existing data is ambiguous and must be reviewed before writing."""


@dataclass
class SeedSummary:
    created: int = 0
    skipped: int = 0
    updated: int = 0
    details: list[str] = field(default_factory=list)


def seed_demo_listings(db: Session, *, apply: bool = False) -> SeedSummary:
    """Plan without writes, or atomically create demos/backfill missing coordinates.

    Counts are exclusive: updated means an existing matching demo whose two
    missing coordinates are backfilled; skipped means an unchanged existing row.
    PostgreSQL apply runs serialize with each other to prevent concurrent CLI
    invocations from creating duplicates in the absence of a unique MLS index.
    """
    summary = SeedSummary()
    try:
        payloads = [ListingCreate.model_validate(raw) for raw in DEMO_LISTINGS]
        if apply and db.get_bind().dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(736020)"))

        for payload in payloads:
            with db.no_autoflush:
                matches = db.query(Listing).filter(
                    (Listing.mls_number == payload.mls_number)
                    | ((Listing.title == payload.title) & (Listing.address == payload.address))
                ).order_by(Listing.id).all()
            if len(matches) > 1:
                raise DemoSeedError(
                    f"Multiple listings match {payload.mls_number}; resolve duplicates before seeding."
                )
            if matches:
                listing = matches[0]
                coordinates = approximate_demo_coordinates(listing)
                if coordinates is None:
                    summary.skipped += 1
                    summary.details.append(f"SKIP {payload.mls_number}: existing listing {listing.id}")
                else:
                    if apply:
                        listing.latitude, listing.longitude = coordinates
                    summary.updated += 1
                    summary.details.append(f"UPDATE {payload.mls_number}: coordinates for existing listing {listing.id}")
                continue

            if apply:
                listing = Listing(**payload.model_dump())
                if listing.status in ("Draft", "Archived"):
                    listing.is_public = False
                db.add(listing)
                db.flush()  # IDs are needed for the existing coordinate-offset formula.
                coordinates = approximate_demo_coordinates(listing)
                if coordinates is not None:
                    listing.latitude, listing.longitude = coordinates
            summary.created += 1
            summary.details.append(f"CREATE {payload.mls_number}: {payload.title} ({payload.city})")

        if apply:
            db.commit()
    except Exception:
        db.rollback()
        raise
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write the planned changes in one transaction; default is a read-only dry run.")
    args = parser.parse_args(argv)
    # Import only after argument parsing: --help needs no database configuration.
    try:
        from app.db.session import SessionLocal

        with SessionLocal() as db:
            summary = seed_demo_listings(db, apply=args.apply)
    except DemoSeedError as exc:
        print(f"Demo seed aborted: {exc} No changes committed.", file=sys.stderr)
        return 1
    except (SQLAlchemyError, ValidationError):
        # Do not print connection strings, SQL parameters, or credentials.
        print("Demo seed operation failed. Verify database state before retrying; commit acknowledgement may be uncertain. Check database connectivity, migrations and demo-data validation.", file=sys.stderr)
        return 1

    print("APPLY complete." if args.apply else "DRY RUN: no changes written. Run with --apply to write these changes.")
    for detail in summary.details:
        print(f"  {detail}")
    print(f"{'Applied' if args.apply else 'Would change'}: created={summary.created}, skipped={summary.skipped}, updated={summary.updated}")
    print("Updated counts are existing coordinate-only backfills; newly created demos include approximate coordinates.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

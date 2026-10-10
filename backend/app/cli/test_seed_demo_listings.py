"""Demo CLI tests use isolated SQLite only, never configured deployment databases."""
import hashlib
import json
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.cli.demo_coordinates import CITY_CENTERS, approximate_demo_coordinates
from app.cli.demo_listing_data import DEMO_LISTINGS
from app.cli.seed_demo_listings import DemoSeedError, main, seed_demo_listings
from app.db.base import Base
from app.db.models import Listing
from app.schemas.listing import ListingCreate


@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine, autoflush=False) as session:
        yield session
    engine.dispose()


def test_catalog_preserves_every_original_demo_value():
    # Fingerprint of the original script's literal data, recorded before moving it.
    fingerprint = hashlib.sha256(json.dumps(DEMO_LISTINGS[5:], sort_keys=True).encode()).hexdigest()
    assert fingerprint == "3434265e9a354f28f4b58a7ed537dc61a9d00b5b66a84b6bfee157ed7499c556"
    assert [raw["mls_number"] for raw in DEMO_LISTINGS] == [f"DEMO-{i:03d}" for i in range(1, 21)]


def test_default_dry_run_has_no_dml_or_pending_changes(db):
    statements = []
    event.listen(db.get_bind(), "before_cursor_execute", lambda conn, cursor, statement, params, context, many: statements.append(statement))
    summary = seed_demo_listings(db)
    assert (summary.created, summary.skipped, summary.updated) == (20, 0, 0)
    assert db.query(Listing).count() == 0
    assert not db.new and not db.dirty
    assert all(statement.lstrip().upper().startswith("SELECT") for statement in statements)


def test_apply_creates_original_catalog_with_original_coordinate_offsets(db):
    summary = seed_demo_listings(db, apply=True)
    assert (summary.created, summary.skipped, summary.updated) == (20, 0, 0)
    listings = {listing.mls_number: listing for listing in db.query(Listing)}
    assert len(listings) == 20
    for raw in DEMO_LISTINGS:
        listing = listings[raw["mls_number"]]
        for key, value in raw.items():
            stored = getattr(listing, key)
            assert stored == (Decimal(str(value)) if isinstance(stored, Decimal) else value)
        center = CITY_CENTERS[listing.city.lower()]
        assert listing.latitude == round(center[0] + ((listing.id % 5) - 2) * .002, 6)
        assert listing.longitude == round(center[1] + (((listing.id // 5) % 5) - 2) * .002, 6)


def test_repeated_apply_is_idempotent(db):
    seed_demo_listings(db, apply=True)
    before = [(l.id, l.latitude, l.longitude) for l in db.query(Listing).order_by(Listing.id)]
    summary = seed_demo_listings(db, apply=True)
    assert (summary.created, summary.skipped, summary.updated) == (0, 20, 0)
    assert [(l.id, l.latitude, l.longitude) for l in db.query(Listing).order_by(Listing.id)] == before


def test_existing_mls_match_preserves_edited_content_and_backfills_only_coordinates(db):
    seed_demo_listings(db, apply=True)
    listing = db.query(Listing).filter_by(mls_number="DEMO-006").one()
    listing.title = "Previously edited title"
    listing.price = 123456
    listing.latitude = listing.longitude = None
    db.commit()
    planned = seed_demo_listings(db)
    assert (planned.created, planned.skipped, planned.updated) == (0, 19, 1)
    assert listing.latitude is None and listing.longitude is None
    assert not db.dirty
    applied = seed_demo_listings(db, apply=True)
    assert applied.updated == 1 and db.query(Listing).count() == 20
    assert listing.title == "Previously edited title" and listing.price == 123456
    assert listing.latitude is not None and listing.longitude is not None


def test_title_address_match_does_not_duplicate_or_backfill_non_demo(db):
    listing = Listing(**ListingCreate.model_validate(DEMO_LISTINGS[0]).model_dump())
    listing.mls_number = "REAL-123"
    listing.source_attribution = "Independent real listing"
    db.add(listing)
    db.commit()
    summary = seed_demo_listings(db, apply=True)
    assert (summary.created, summary.skipped, summary.updated) == (19, 1, 0)
    assert db.query(Listing).count() == 20
    assert listing.latitude is None and listing.longitude is None
    assert listing.mls_number == "REAL-123"


@pytest.mark.parametrize("latitude,longitude", [(42.5, -93.5), (42.5, None), (None, -93.5)])
def test_preserves_existing_complete_or_partial_coordinates(db, latitude, longitude):
    seed_demo_listings(db, apply=True)
    listing = db.query(Listing).filter_by(mls_number="DEMO-006").one()
    listing.latitude, listing.longitude = latitude, longitude
    db.commit()
    summary = seed_demo_listings(db, apply=True)
    assert summary.updated == 0
    assert (listing.latitude, listing.longitude) == (latitude, longitude)


@pytest.mark.parametrize("changes", [{"city": "Unknown city"}, {"state": "MN"}, {"mls_number": "REAL-123", "source_attribution": None}])
def test_coordinate_helper_omits_unknown_or_non_demo_locations(changes):
    listing = Listing(id=27, city="Ames", state="IA", mls_number="DEMO-999", latitude=None, longitude=None)
    for field, value in changes.items():
        setattr(listing, field, value)
    assert approximate_demo_coordinates(listing) is None


def test_ambiguous_matches_abort_and_rollback_prior_creates(db):
    for _ in range(2):
        db.add(Listing(**ListingCreate.model_validate(DEMO_LISTINGS[1]).model_dump()))
    db.commit()
    with pytest.raises(DemoSeedError, match="Multiple listings match DEMO-002"):
        seed_demo_listings(db, apply=True)
    assert db.query(Listing).count() == 2
    assert db.query(Listing).filter_by(mls_number="DEMO-001").count() == 0


def test_database_failure_rolls_back_all_changes(db, monkeypatch):
    commit = MagicMock(side_effect=SQLAlchemyError("failure"))
    monkeypatch.setattr(db, "commit", commit)
    with pytest.raises(SQLAlchemyError):
        seed_demo_listings(db, apply=True)
    assert db.query(Listing).count() == 0


def test_postgres_apply_runs_are_serialized():
    db = MagicMock()
    db.get_bind.return_value.dialect.name = "postgresql"
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        Listing(id=1, city="Ames", state="IA", mls_number="DEMO-006", latitude=42, longitude=-93)
    ]
    seed_demo_listings(db, apply=True)
    assert str(db.execute.call_args.args[0]) == "SELECT pg_advisory_xact_lock(736020)"
    db.commit.assert_called_once()
    db.reset_mock()
    seed_demo_listings(db)
    db.execute.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.parametrize("apply", [False, True])
def test_cli_flags_and_summary_are_correct_and_use_only_test_session(db, monkeypatch, capsys, apply):
    # Replace the configured factory before invoking main; never open its engine.
    from app.db import session
    monkeypatch.setattr(session, "SessionLocal", lambda: db)
    assert main(["--apply"] if apply else []) == 0
    output = capsys.readouterr().out
    assert "created=20, skipped=0, updated=0" in output
    assert ("APPLY complete." if apply else "DRY RUN: no changes written.") in output
    assert db.query(Listing).count() == (20 if apply else 0)


def test_cli_help_does_not_open_a_database(monkeypatch, capsys):
    from app.db import session
    factory = MagicMock(side_effect=AssertionError("No database access allowed"))
    monkeypatch.setattr(session, "SessionLocal", factory)
    with pytest.raises(SystemExit) as exit_info:
        main(["--help"])
    assert exit_info.value.code == 0
    assert "--apply" in capsys.readouterr().out
    factory.assert_not_called()


def test_cli_database_error_is_sanitized(db, monkeypatch, capsys):
    from app.db import session
    monkeypatch.setattr(session, "SessionLocal", MagicMock(side_effect=SQLAlchemyError("postgres://secret-credentials")))
    assert main(["--apply"]) == 1
    error = capsys.readouterr().err
    assert "Verify database state before retrying" in error
    assert "no changes committed" not in error
    assert "secret-credentials" not in error


def test_legacy_seed_and_backfill_still_work_and_new_cli_completes_the_catalog(db, monkeypatch):
    import seed_demo_listings_006_020 as legacy_seed
    from backfill_demo_coordinates import backfill

    monkeypatch.setattr(legacy_seed, "SessionLocal", lambda: db)
    legacy_seed.main()
    assert db.query(Listing).count() == 15
    assert backfill(db, apply=True) == 15
    summary = seed_demo_listings(db, apply=True)
    assert (summary.created, summary.skipped, summary.updated) == (5, 15, 0)
    assert db.query(Listing).count() == 20


def test_recovered_first_five_are_exact_and_exclude_runtime_fields():
    fingerprint = hashlib.sha256(json.dumps(DEMO_LISTINGS[:5], sort_keys=True).encode()).hexdigest()
    assert fingerprint == "4625b6725653d19ab0012040b22acd964f860c92b8cf8e7711e6becd056a19a7"
    assert len(DEMO_LISTINGS) == 20
    forbidden = {"id", "created_at", "updated_at", "agent_id", "office_id", "latitude", "longitude"}
    assert all(not (set(raw) & forbidden) for raw in DEMO_LISTINGS)
    condo = DEMO_LISTINGS[2]
    assert condo["bathrooms"] == 3.0
    assert condo["hoa_fee"] is None and condo["hoa_fee_frequency"] == "Monthly"


def test_cli_commit_acknowledgement_failure_warns_to_verify_persisted_state(db, monkeypatch, capsys):
    from app.db import session

    real_commit = db.commit

    def commit_then_fail_acknowledgement():
        real_commit()
        raise SQLAlchemyError("Commit acknowledgement lost")

    monkeypatch.setattr(session, "SessionLocal", lambda: db)
    monkeypatch.setattr(db, "commit", commit_then_fail_acknowledgement)
    assert main(["--apply"]) == 1
    assert db.query(Listing).count() == 20
    error = capsys.readouterr().err
    assert "Verify database state before retrying" in error
    assert "no changes committed" not in error

# Packaged demo seed command

The Dockerfile already copies `app/`, including this CLI, its catalog and its
offline coordinate helper. No Dockerfile or Render configuration change is needed.
The deployment must include this code and the coordinate migration before use.

In the deployed Render shell (Docker working directory `/app`):

```sh
python -m app.cli.seed_demo_listings          # read-only preview
python -m app.cli.seed_demo_listings --apply  # explicitly write after review
```

The command uses the application's existing database configuration; it accepts
no connection string argument and never prints credentials. `--help` does not
open a database. It does not migrate the database or run on application startup.

Only the complete twenty fictional DEMO-001 through DEMO-020 records are seeded.
Matching uses demo MLS number OR exact title/address, just like the original
script. Matching listing content is not overwritten. An ambiguous match aborts
the entire operation for review. Counts are exclusive: `created` means missing
listings, `updated` means existing recognized demos receiving missing coordinates,
and `skipped` means unchanged matching listings. New listings include coordinates
without increasing the `updated` count.

Dry run performs reads only: no inserts, updates, flushes, commits or allocated
listing IDs. Apply writes in one transaction and rolls back on failure.
PostgreSQL transaction-scoped advisory locking serializes concurrent runs of
this CLI. Other writers do not share that lock; avoid concurrently importing or
editing matching demo rows while applying. No database uniqueness or schema
changes are introduced by this command.

Coordinates use the original Iowa city centers and ID-based offsets, with no
network requests or external geocoding. They illustrate fictional city-area
locations, not exact property addresses. Existing full or partial coordinates
are preserved; unknown cities/states and non-demo matches are not backfilled.
Database IDs can differ across databases, so approximate offsets can differ.
Hidden-address flags and public API coordinate privacy remain unchanged.

These are public portfolio demonstration listings with their original prices,
statuses, descriptions and attribution, not real inventory. The seed command
does not supply listing photos, agents, offices, or users. The existing top-level
scripts remain compatible for local use, sharing the same packaged data/helper;
their original execution behavior is unchanged.

DEMO-001 through DEMO-005 come from the authoritative original database export.
Runtime IDs, timestamps, agent/office associations and exported coordinates are
not copied. Unusual original bathroom and HOA values are deliberately preserved.
The legacy 006–020 script still seeds only its original subset.
If a database failure occurs, verify database state before retrying: a commit
may succeed on the server even when its acknowledgement fails.

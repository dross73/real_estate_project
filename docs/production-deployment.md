# Production Deployment

This document is the launch runbook for Juniper & Lane Realty.

## Architecture

Production is intentionally split into durable managed services:

- Angular public/admin frontend: Render static site and CDN.
- FastAPI backend: Render paid Docker web service.
- PostgreSQL: paid Render Postgres in the same Ohio region as the API.
- Listing photos/documents: private S3-compatible object storage, with Cloudflare
  R2 recommended for the portfolio deployment.
- Transactional email: an SMTP provider configured through Render secrets.

The public URLs are:

- Frontend: `https://realestate.dan-ross.dev`
- API: `https://api.realestate.dan-ross.dev`

Using dedicated custom domains removes production localhost assumptions and gives
CORS and account-email links stable HTTPS origins.

## Why the backend/database use paid Render instances

The launch configuration deliberately does not use Render's Free compute plans.
The backend needs a pre-deploy migration command and outbound SMTP, while the
database needs durable recovery features. Render's Free web service does not
support pre-deploy commands and blocks common SMTP ports, and Free Postgres
expires after 30 days and has no managed backups.

The smallest paid web/database plans are sufficient for this portfolio launch and
can be scaled later without changing application architecture.

## Required secrets

Do not commit these values. Render prompts for every `sync: false` value in
`render.yaml` when the Blueprint is created.

### Email

- `EMAIL_FROM_ADDRESS`
- `SMTP_HOST`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`

The Blueprint currently uses port 587 with TLS. Change the port/TLS settings in
Render if the selected provider requires different values.

### Object storage

Create one private S3-compatible bucket and restricted application credentials.

For Cloudflare R2:

- `OBJECT_STORAGE_BUCKET`: bucket name.
- `OBJECT_STORAGE_ENDPOINT_URL`: account-specific S3 endpoint.
- `OBJECT_STORAGE_ACCESS_KEY_ID`: R2 access key.
- `OBJECT_STORAGE_SECRET_ACCESS_KEY`: R2 secret key.

`OBJECT_STORAGE_REGION=auto` and `OBJECT_STORAGE_ADDRESSING_STYLE=auto` are
already supplied by the Blueprint. A public bucket is not required; the backend
can return short-lived signed read URLs.

## Render deployment

1. Merge a green launch commit to `master`.
2. In Render, create a new Blueprint from this repository's `render.yaml`.
3. Enter the SMTP and object-storage secret values when prompted.
4. Approve creation of the API service, static site, and Postgres database.
5. Render injects the database's internal connection string into
   `DATABASE_URL`.
6. Before every backend release, Render runs
   `python -m alembic upgrade head`. A migration failure stops the deploy.
7. Render considers the API healthy only when `GET /health` succeeds, which
   also verifies PostgreSQL connectivity.
8. Auto-deploy is configured for `checksPass`, so deployment waits for the
   linked GitHub checks to succeed.

## Initial administrator

A new production database intentionally contains no default credentials. After
the API has deployed successfully, open the paid Render web service's Dashboard
Shell and run:

```text
python -m app.cli.bootstrap_admin --email YOUR_EMAIL --name "YOUR NAME"
```

The command prompts for the password twice using hidden terminal input. The
password is never accepted as a command-line flag and does not need to be stored
in a Render environment variable.

The bootstrap path locks itself after the first administrator exists. Create any
later staff or administrator accounts through the normal admin Users page.

After bootstrap, sign in at `/admin/login` and configure MFA from
**Admin > Security**. If site-wide internal MFA will be required, enroll the first
administrator before enabling that policy.

## DNS and HTTPS

The Blueprint registers these custom domains with Render:

- `realestate.dan-ross.dev` on the static site.
- `api.realestate.dan-ross.dev` on the API web service.

In the DNS provider for `dan-ross.dev`, add the exact CNAME/verification
records Render displays for each service. Do not guess Render hostnames because
they are assigned by Render.

After DNS verification, confirm both URLs receive managed HTTPS certificates.
Do not run the final smoke test until both custom domains are serving HTTPS.

The static site publishes `robots.txt` and redirects
`https://realestate.dan-ross.dev/sitemap.xml` to the live database-backed sitemap
endpoint on the API service. Verify both paths after DNS/TLS is active.

## Production configuration safety

When `ENV=production`, FastAPI refuses to start if:

- `SECRET_KEY` is shorter than 32 characters;
- the public frontend URL is not HTTPS or points to localhost;
- CORS contains localhost, wildcards, or non-HTTPS origins;
- SMTP delivery is disabled or lacks a host;
- object-storage bucket/access credentials are missing.

The Angular production build generates `runtime-config.js` from
`PUBLIC_API_BASE_URL`. The generated file contains only the public API URL and
must never contain secrets. Local development continues to use
`http://localhost:8000` only when the browser itself is on localhost.

## Launch smoke test

After DNS and TLS are healthy, run:

```text
node scripts/production-smoke.mjs
```

The script verifies:

- frontend homepage loads;
- an Angular client-side route rewrites to the SPA correctly;
- API health succeeds and can reach PostgreSQL;
- public site settings respond;
- public listing search responds.

Then complete the manual authenticated smoke pass:

- Admin login, including MFA if required.
- Admin dashboard loads.
- Create/edit a draft listing.
- Upload, reorder, replace, and delete a listing photo.
- Publish/unpublish a test listing and confirm public visibility changes.
- Public registration/email verification/password reset.
- Customer login, favorite, saved search, inquiry, and account settings.
- CSV export from the admin area.

Use test records and clean them up after verification.

## Logs and monitoring

Render service logs are the primary production application log stream. During
launch, check API logs after every failed smoke-test request and confirm startup
contains no configuration errors.

The `/health` endpoint is the platform health check. It intentionally checks the
database so Render does not route traffic to an API instance that cannot reach
PostgreSQL.

Object-storage and SMTP provider dashboards should also be checked for failed
requests during the launch smoke pass.

## Backup and recovery

The paid Render Postgres plan provides continuous point-in-time recovery. On a
Hobby workspace the recovery window is currently three days. Render also allows
on-demand logical exports, which should be downloaded before risky schema/data
changes and retained outside Render when long-term recovery is important.

Launch policy:

- Use Alembic as the only production schema-change path.
- Create/download a logical export before any destructive migration.
- Use point-in-time recovery first for accidental production data loss.
- Restore into a new database, verify it, then repoint `DATABASE_URL`; do not
  overwrite the damaged database before validation.
- Keep object storage independent from the web-service filesystem.
- Treat storage-bucket deletion/versioning policy as a separate backup concern;
  database recovery does not restore media objects.

## Rollback

If application code deploys badly without a schema incompatibility, use Render's
rollback to the previous successful service release.

If a migration caused data loss, restore PostgreSQL to a new recovery instance,
validate it, update the backend database reference, and redeploy. Do not assume
rolling application code back also rolls the database back.

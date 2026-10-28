# Production Deployment and Operations

The deployed Juniper & Lane Realty portfolio runs on Render, with custom HTTPS domains and environment-based configuration. This is a maintainer-facing reference, not a public installation or hosting service.

## Running services

| Component | Production service |
| --- | --- |
| Angular application | Render static site/CDN at `https://realestate.dan-ross.dev` |
| FastAPI backend | Render Docker web service at `https://api.realestate.dan-ross.dev` |
| Database | Existing paid Render PostgreSQL (`juniper-lane-db-prod`) |
| Listing media | Private S3-compatible storage (Cloudflare R2 for this deployment) |
| Transactional email | SMTP provider, configured through server environment settings |

`render.yaml` defines the API and static site. It **references** the existing PostgreSQL resource using `fromDatabase`; it does not provision a new database. No production credentials belong in the repository.

## Deployment path

- GitHub Actions runs frontend and backend checks on pull requests and pushes to `master`.
- Render service auto-deployment uses `checksPass` and the configured `master` branch.
- Backend pre-deploy runs `python -m alembic upgrade head` before releasing code.
- Render health checks target `GET /health`, which also checks PostgreSQL connectivity.
- Angular's production build generates public-only `runtime-config.js` from `PUBLIC_API_BASE_URL`.
- The frontend static site handles SPA route rewrites and redirects `/sitemap.xml` to the API's database-backed sitemap.

## Configuration

Backend secrets are managed outside GitHub. The main required groups are:

- `DATABASE_URL` (injected from the paid Render database)
- `SECRET_KEY`, JWT issuer/audience settings, and CORS/public HTTPS origins
- SMTP host, port, sender, and credentials
- Object-storage endpoint, bucket, access keys, and private read configuration

Production configuration validation rejects incomplete or unsafe settings. Never paste complete database connection strings, JWT signing secrets, or storage credentials into public issues or logs.

## Verification

From the repository root, `node scripts/production-smoke.mjs` checks the public homepage, client-side routing, robots/sitemap behavior, API health, settings, and listing search. It does **not** replace manual checks of authenticated workflows, uploaded media, or email delivery.

Use non-sensitive demonstration records when checking admin listing edits, publication, customer registration, and inquiry flows.

## Recovery and rollback

- Keep database exports outside Render before risky migrations and periodically review the provider's current recovery/retention terms.
- Treat database recovery and object-storage recovery as separate concerns: restoring PostgreSQL does not restore deleted media objects.
- For application-only problems, Render can roll back a prior release when its schema remains compatible.
- For destructive schema/data incidents, restore into a separate database, validate the recovered data, then redirect the application. Do not assume rolling application code back also rolls back the database.

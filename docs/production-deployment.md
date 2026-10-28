# Production Deployment

Juniper & Lane Realty is deployed as an Angular static site and a FastAPI Docker service on Render, with a separately provisioned paid PostgreSQL database. `render.yaml` defines the web and API services and references the existing `juniper-lane-db-prod` database.

- Website: https://realestate.dan-ross.dev
- API: https://api.realestate.dan-ross.dev

## Deployment layout

- Render serves the Angular production bundle over HTTPS.
- FastAPI runs as a Docker service in Render's Ohio region alongside managed PostgreSQL.
- Listing media is held in private S3-compatible object storage (Cloudflare R2 for this deployment).
- Application mail uses an SMTP service configured through Render environment settings.
- Angular's production build injects only the public API origin into `runtime-config.js`, never credentials.

## Release process

Both services are configured to deploy after successful linked GitHub checks (`autoDeployTrigger: checksPass`). Before API deployment, Render runs `python -m alembic upgrade head`.

The `GET /health` endpoint verifies database availability as well as application startup. CI tests migrations against PostgreSQL and builds the API Docker image.

Deployment settings and credentials are managed in Render; never commit `.env` or copy connection strings into documentation.

## Local and deployment checks

```bash
# From the repository root, after both public services are deployed:
node scripts/production-smoke.mjs
```

The smoke test checks the public frontend, SPA routing, robots/sitemap resources, API health, site settings and listing search. Authenticated admin/customer workflows and accessibility still require appropriate browser-based testing.

## Operations and recovery

Render service logs are the main application log source. Alembic is the only supported database migration mechanism. Before destructive schema/data changes, make an independent logical database export and verify that it can be restored. Application rollback does **not** roll back database migrations.

Database backup and recovery coverage depends on the active Render PostgreSQL plan. Media storage requires its own retention and recovery policy independent of database backups.

For local installation and database setup, see [local development](local-development.md).

# Real Estate Portfolio Project

This is a full-stack real estate web application built as a portfolio project to demonstrate backend API development, frontend admin UI development, authentication, role-based access control, and full-stack data flow.

The project uses FastAPI for the backend, PostgreSQL for the database, Docker for local services, and Angular with Tailwind CSS for the frontend.

## Project Status

This project is actively in development.

Current focus areas include:

- Backend API structure
- Database-backed listing data
- JWT authentication
- Role-based access control
- Angular admin interface
- Full-stack frontend-to-backend integration

## Project Walkthrough Videos

I recorded short milestone videos to show the development process and explain the major backend and frontend pieces.

The playlist currently includes walkthroughs for FastAPI setup, CRUD API development, PostgreSQL-backed data, JWT authentication, role-based access control, Angular admin pages, and Angular-to-FastAPI integration.

More videos will be added as additional project milestones are completed.

[Watch the Real Estate Portfolio Project video playlist](https://www.youtube.com/playlist?list=PLgIdtA2WYegux__WIeeSRhu7x0h3X6LTE)

## Tech Stack

### Backend

- Python
- FastAPI
- PostgreSQL
- SQLAlchemy
- Pydantic
- JWT authentication
- pytest
- Docker

### Frontend

- Angular
- TypeScript
- Tailwind CSS
- Angular services
- Angular routing
- Responsive admin UI

## Backend Configuration

Backend runtime settings come from environment variables. For local development,
Pydantic Settings also reads the project-root `.env` file.

Start by copying `.env.example` to `.env` and update any values that should be
different on your machine.

Database configuration supports either:

- one `DATABASE_URL`, or
- the full set of `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`,
  `POSTGRES_USER`, and `POSTGRES_PASSWORD`.

`CORS_ORIGINS` is a comma-separated list of frontend origins that may call the
API. Local Angular origins are used by default, while production deployments
should explicitly set their deployed frontend origin.

### Local Backend Startup

Start PostgreSQL:

```text
docker compose up -d
```

Then, from the `backend` directory, apply migrations before starting FastAPI:

```text
alembic upgrade head
uvicorn app.main:app --reload
```

Alembic is the authoritative database schema path. FastAPI does not create or
modify tables automatically during application startup.

The API exposes `GET /health` for deployment health checks. It returns success
only when the API can reach PostgreSQL.

### Backend Container

The backend Dockerfile is located at `backend/Dockerfile`. Build it with the
backend directory as the build context:

```text
docker build -t real-estate-backend ./backend
```

The container listens on the platform-provided `PORT` environment variable and
falls back to port 8000 locally. Production deployments must provide runtime
environment variables and should run `alembic upgrade head` before starting a
new application version.

## Listing Media Storage

Listing photos and documents use an S3-compatible object-storage boundary rather
than the application server filesystem. This keeps permanent media safe from
ephemeral hosts such as Render and lets production use providers such as
Cloudflare R2, AWS S3, Backblaze B2, or another compatible service.

Local development uses MinIO from `docker-compose.yml`:

```text
docker compose up -d
```

The local S3 API is available at `http://localhost:9000` and the MinIO console
at `http://localhost:9001`. The `minio-init` service creates the
`real-estate-media` development bucket automatically.

The backend storage service streams uploads/downloads, supports replacement and
deletion, validates provider-independent object keys, and returns either a
configured public/CDN URL or a short-lived signed read URL. Production storage
credentials are supplied only through environment variables.


## Privacy and Consent Configuration

The public site does not show a privacy/cookie banner by default. Essential browser
storage is used for authenticated sessions and, when privacy controls are enabled,
for remembering visitor privacy choices.

Optional analytics and marketing/advertising categories are deployment settings.
When visitor consent controls are enabled, non-essential integrations must use the
shared privacy-consent service before initializing.

See `docs/privacy-deployment.md` for the current storage inventory, configuration
rules, and the integration gate expected for future analytics or advertising tools.

## Project Management

This project is tracked using Jira to simulate a production-style development workflow.

The Jira board uses a simple Kanban process:

```text
To Do → In Progress → In Review → Done
```

Completed project milestones were backfilled into Jira so the board reflects the full history of the project. New work is tracked going forward with ticket titles, descriptions, and acceptance criteria.

Ticket prefixes are used to organize work by area:

```text
[Backend]
[Frontend]
[Auth]
[Full Stack]
[Docs]
```

Example upcoming ticket:

```text
[Frontend] Create admin listing form
```

This helps keep the project organized and closer to how work is tracked on a real development team.

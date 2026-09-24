# Real Estate Portfolio Project

Juniper & Lane Realty is a full-stack real estate web application built as a
portfolio project. It goes beyond a CRUD demo by combining a public property
experience, customer accounts, an internal brokerage/admin application,
production-oriented security and testing, and a documented deployment
architecture.

The application uses Angular and TypeScript on the frontend, FastAPI and Python
on the backend, PostgreSQL for relational data, and S3-compatible object storage
for durable listing media.

## Project Status

The application is in launch hardening.

The major application features and repository-side production configuration are
implemented. Production provisioning, DNS/TLS verification, final smoke testing,
and the launch accessibility/manual QA pass are tracked separately before the
project is presented as live.

Planned production URLs:

- Public/admin frontend: `https://realestate.dan-ross.dev`
- API: `https://api.realestate.dan-ross.dev`

These URLs should be treated as deployment targets until the production launch
checklist is completed.

## What the Application Includes

### Public real estate experience

- Responsive homepage and property-browsing experience.
- Public listing search, filters, sorting, pagination, and listing details.
- Featured listings and public-safe listing previews.
- Agent profiles, brokerage offices, About, Contact, Privacy, and Terms content.
- Open-house information and public listing documents.
- SEO metadata, canonical URLs, Open Graph metadata, structured data, and a
  dynamic sitemap source.
- Optional first-party listing-view analytics with a privacy-minimized data
  model.

### Customer accounts

- Registration, email verification, login, password reset, and password change.
- Saved homes/favorites and recently viewed listings.
- Reusable saved searches and alert preferences.
- Contact/showing inquiries tied to the customer account.
- Account settings and account closure.
- Customer testimonial submission.

### Staff and administrator application

- Role-protected admin area with separate administrator and staff permissions.
- Listing create/read/update/delete workflow.
- Listing status/publication controls, open houses, documents, and public
  previews.
- Listing-photo upload, optimization, reorder, primary-photo selection,
  replacement, and deletion.
- Agent and office management.
- Lead/inquiry workflow and internal notes/assignment.
- Testimonial moderation.
- Operational analytics and CSV exports.
- Site/content/privacy settings.
- Administrator user management.
- TOTP multi-factor authentication for internal accounts, recovery codes, and
  administrator MFA reset.
- Audit logging for sensitive administrative actions.

## Architecture

The application is intentionally split into clear boundaries:

```text
Angular public + admin application
              |
              | HTTPS / JSON
              v
          FastAPI API
        /      |       \
       v       v        v
 PostgreSQL  S3 media  SMTP
```

Angular owns presentation, routing, form state, and browser interactions.
FastAPI owns authentication, authorization, validation, business rules, and
public/admin API boundaries. PostgreSQL is the authoritative relational store.
Photos and documents live in S3-compatible object storage rather than the web
server filesystem.

See [docs/architecture.md](docs/architecture.md) for data flows, authorization
boundaries, deployment topology, and interview/demo talking points.

## Tech Stack

### Frontend

- Angular 19
- TypeScript
- Angular Router and Reactive Forms
- Angular Material/CDK where appropriate
- Tailwind CSS
- Jasmine/Karma tests
- Custom static accessibility checks

### Backend

- Python 3.13
- FastAPI
- SQLAlchemy
- Pydantic v2 / Pydantic Settings
- PostgreSQL
- Alembic migrations
- JWT authentication
- bcrypt password hashing
- pytest
- Pillow / HEIF image processing
- boto3-compatible object storage
- Docker

### Development and delivery

- Git and GitHub
- GitHub Actions CI
- Jira Kanban workflow
- Docker Compose for local PostgreSQL and MinIO
- Render Blueprint for production infrastructure
- S3-compatible production media storage

## Local Development

See [docs/local-development.md](docs/local-development.md) for the complete
first-time setup.

The local stack uses:

- Angular at `http://localhost:4200`
- FastAPI at `http://localhost:8000`
- PostgreSQL at `localhost:5432`
- MinIO for local S3-compatible media storage

A new database intentionally contains no default administrator. The documented
one-time bootstrap command creates the first admin interactively without storing
a reusable bootstrap password in source control or environment variables.

## Configuration and Database Migrations

Backend runtime settings come from environment variables. For local development,
Pydantic Settings also reads the project-root `.env` file. Start with
`.env.example`.

Database configuration supports either a complete `DATABASE_URL` or individual
PostgreSQL connection values.

Alembic is the authoritative schema path. Application startup does not create or
mutate tables automatically. CI and the production deployment both run
migrations explicitly.

The API exposes `GET /health`, which returns success only when the application
can also reach PostgreSQL.

## Media Storage

Listing photos and documents use an S3-compatible storage abstraction rather
than local application storage.

Local development uses MinIO. Production is designed for a private
S3-compatible bucket such as Cloudflare R2. The backend validates object keys,
streams storage operations, and returns either configured public/CDN references
or short-lived signed read URLs.

Image uploads are validated and normalized into optimized image variants before
their metadata is committed to PostgreSQL.

## Authentication and Security

The application has three fixed application roles:

- `admin`
- `staff`
- `public_user`

Internal routes use role-aware guards in Angular and authorization dependencies
in FastAPI. Backend enforcement is authoritative.

Security-related launch work includes:

- bcrypt password hashing and password-size validation;
- signed JWTs with explicit issuer, audience, expiry, and token purpose;
- TOTP MFA for staff/admin accounts;
- encrypted stored TOTP secrets and hashed single-use recovery codes;
- short-lived, hashed MFA login challenges;
- administrator MFA recovery/reset with audit logging;
- production configuration validation that rejects localhost/wildcard origins,
  weak secrets, missing SMTP, and missing durable object storage;
- formula-injection protection in CSV exports;
- validated media/document upload limits;
- one-time initial administrator bootstrap with hidden password entry.

See [docs/internal-mfa.md](docs/internal-mfa.md) and
[docs/production-deployment.md](docs/production-deployment.md).

## Testing and CI

GitHub Actions validates both application halves on pull requests and pushes to
`master`.

Frontend CI:

- installs dependencies with `npm ci`;
- builds the Angular application;
- runs the accessibility template audit;
- runs the Angular unit test suite in headless Chrome;
- performs a production-style Angular build with an HTTPS API origin.

Backend CI:

- starts an isolated PostgreSQL service;
- validates the Render Blueprint syntax;
- applies every Alembic migration;
- runs the pytest suite;
- starts FastAPI and verifies `/health`;
- builds the production Docker image.

Service/component tests mock external HTTP dependencies where appropriate rather
than requiring a manually running API.

## Accessibility

The launch target is WCAG 2.2 AA for the public and internal web experiences.

The application includes shared visible keyboard focus, skip navigation,
semantic landmarks, accessible data-table relationships, form validation/status
messaging, modal focus management, reduced-motion handling, and keyboard
alternatives for upload controls.

CI enforces a focused set of stable template rules. Browser zoom/reflow,
contrast, screen-reader phrasing, and complete keyboard flows remain part of the
manual launch checklist.

See [docs/accessibility.md](docs/accessibility.md).

## Privacy and Analytics

The baseline application does not initialize third-party advertising or
analytics integrations.

First-party listing-view analytics intentionally avoid storing visitor IP
addresses, user identities, user agents, full referring URLs, query strings, or
page paths. Optional analytics/marketing categories are controlled through the
shared privacy-consent system.

See [docs/analytics.md](docs/analytics.md) and
[docs/privacy-deployment.md](docs/privacy-deployment.md).

## SEO

Public pages support route-specific titles/descriptions, canonical URLs, Open
Graph metadata, and index/noindex boundaries. Listing detail pages emit
Schema.org real-estate structured data.

The backend provides a database-backed sitemap source that includes only
currently public-eligible content.

See [docs/seo.md](docs/seo.md).

## Production Deployment

Production infrastructure is defined in `render.yaml`.

The planned launch architecture is:

- Render static site/CDN for Angular.
- Paid Render Docker web service for FastAPI.
- Paid Render PostgreSQL in the same region as the API.
- Private S3-compatible object storage for listing media.
- SMTP-compatible transactional email provider.

The deployment uses pre-deploy Alembic migrations, database-aware health checks,
CI-gated auto-deploys, runtime-configured frontend API routing, custom HTTPS
domains, and documented backup/recovery and rollback procedures.

See [docs/production-deployment.md](docs/production-deployment.md).

## Project Walkthrough Videos

The video series documents the application as it was built rather than presenting
only a finished result. Each milestone captures a meaningful stage of the
project, so the playlist shows the progression from the first FastAPI endpoints
through database-backed CRUD, authentication, role protection, Angular admin
work, and full-stack integration.

Additional milestone videos can be added as later launch milestones are completed.

[Watch the Real Estate Portfolio Project video playlist](https://www.youtube.com/playlist?list=PLgIdtA2WYegux__WIeeSRhu7x0h3X6LTE)

The launch walkthrough plan is documented in
[docs/milestone-walkthrough.md](docs/milestone-walkthrough.md). It starts with
the relevant Jira work, then demonstrates the public application, customer and
admin workflows, architecture, automated testing, and deployment decisions.

## Project Management

Development is tracked in Jira using a Kanban workflow:

```text
To Do -> In Progress -> In Review -> Done
```

Tickets use focused acceptance criteria and are implemented on matching Git
branches/pull requests. Major feature, quality, security, testing, deployment,
and documentation work is represented on the board so the repository history
and Jira workflow tell the same development story.

## Documentation

- [Local development](docs/local-development.md)
- [Architecture and data flow](docs/architecture.md)
- [Production deployment](docs/production-deployment.md)
- [Accessibility launch audit](docs/accessibility.md)
- [Internal MFA](docs/internal-mfa.md)
- [SEO and sitemap strategy](docs/seo.md)
- [Operational analytics](docs/analytics.md)
- [CSV exports](docs/csv-exports.md)
- [Privacy and consent deployment](docs/privacy-deployment.md)
- [Launch milestone walkthrough](docs/milestone-walkthrough.md)

# Juniper & Lane Realty

A deployed full-stack real estate application with a responsive property-search experience, customer accounts, and an internal brokerage management system. Built to demonstrate end-to-end software engineering, from UI and API design to security, testing, and production operations.

**[Live website](https://realestate.dan-ross.dev/)** · **[Admin demo sign-in](https://realestate.dan-ross.dev/admin/login)** · **[GitHub Actions](https://github.com/dross73/real_estate_project/actions)**

The admin demo uses an administrator-provisioned **read-only viewer account**. Reviewers can explore management screens and interact with forms without persisting changes. Demo access is available on request; credentials are not published in this repository.

> Portfolio demonstration: property listings and brokerage information are illustrative, not real estate offers.

## Features

- **Property discovery:** responsive listing search, filters, sorting, pagination, galleries, agent profiles, open houses, documents, and optional on-demand maps.
- **Customer accounts:** registration, email verification, favorites, recently viewed properties, saved searches, inquiries, and account management.
- **Brokerage administration:** listing and photo management, publishing controls, agents, offices, leads, testimonials, site settings, analytics, and CSV exports.

## Technology

| Layer | Tools |
| --- | --- |
| Frontend | Angular 20, TypeScript, Angular Material/CDK, Tailwind CSS |
| API | Python 3.13, FastAPI, Pydantic, SQLAlchemy |
| Data and media | PostgreSQL, Alembic, S3-compatible object storage (Cloudflare R2) |
| Delivery | Docker, GitHub Actions, Render |
| Tests | pytest, Jasmine/Karma, automated accessibility template checks |

## Engineering highlights

- **Backend-enforced authorization:** JWT-based roles and internal TOTP MFA. The demo viewer can read administration data, but FastAPI rejects mutations even if browser controls are bypassed.
- **Query correctness:** filtering and search execute in SQLAlchemy before pagination, so matching records aren't limited to the current page.
- **Public data boundaries:** API queries exclude unpublished or ineligible listings; sensitive internal fields are not exposed through public listing responses.
- **Durable media:** uploaded listing photos are validated, optimized, and stored independently of the API container; related database metadata is managed through PostgreSQL.
- **Privacy and performance:** consent-aware analytics, privacy-minimized first-party listing reporting, and maps that load only when requested.
- **Repeatable delivery:** CI checks frontend/backend builds, tests, dependency audits, database migrations, API health, and the backend Docker image. Production deployments use Render with managed PostgreSQL and HTTPS domains.

Accessibility work targets WCAG 2.2 AA through keyboard-friendly interaction patterns and automated checks; this is **not** a claim of independent certification.

## Architecture

```text
Angular SPA (public site + administration)
                 |
              HTTPS API
                 |
               FastAPI
            /     |      \
     PostgreSQL  R2 media  SMTP
```

Angular handles routing and presentation. FastAPI enforces business rules and authorization. PostgreSQL stores relational records; object storage holds listing media.

See the [architecture and data-flow notes](docs/architecture.md) for the underlying design decisions.

## Run locally

Requirements: Python 3.13, Node.js 22, and Docker Compose. Follow the [local development guide](docs/local-development.md) for environment setup, PostgreSQL migrations, and starting the frontend and backend.

Additional references: [security](docs/security.md) · [deployment](docs/production-deployment.md) · [development video playlist](https://www.youtube.com/playlist?list=PLgIdtA2WYegux__WIeeSRhu7x0h3X6LTE).

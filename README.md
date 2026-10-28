# Juniper & Lane Realty

[![CI](https://github.com/dross73/real_estate_project/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/dross73/real_estate_project/actions/workflows/ci.yml)

A deployed full-stack real estate application with public property search, customer accounts, and a role-protected brokerage administration system. Built as an independent portfolio project using fictional demonstration listings.

**[Live website](https://realestate.dan-ross.dev/)** · **[Admin sign-in](https://realestate.dan-ross.dev/admin/login)** · [API health](https://api.realestate.dan-ross.dev/health) · [Development videos](https://www.youtube.com/playlist?list=PLgIdtA2WYegux__WIeeSRhu7x0h3X6LTE)

![Juniper & Lane Realty homepage](docs/assets/juniper-lane-homepage.webp)

## Features

- **Property discovery:** Responsive listing search, filtering, sorting, pagination, galleries, agent profiles, and optional maps.
- **Customer experience:** Registration and email verification, saved homes and searches, inquiry requests, account settings, and password recovery.
- **Brokerage administration:** Listing and photo management, publication controls, leads, agents, offices, site settings, operational analytics, and CSV exports.
- **Read-only admin demo:** A dedicated viewer role can explore administrative screens without saving changes. Demo access is provisioned privately; no credentials are embedded in the repository.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | Angular 20, TypeScript, Tailwind CSS, Angular Material/CDK |
| Backend | Python 3.13, FastAPI, SQLAlchemy, Pydantic, Alembic |
| Data and media | PostgreSQL, Cloudflare R2 / S3-compatible object storage |
| Delivery | Docker, Render, GitHub Actions |
| Testing | Jasmine/Karma, pytest, accessibility template checks, dependency audits |

## Engineering highlights

- **Backend-enforced access:** JWT authentication, role-based API authorization, TOTP MFA for internal accounts, and independent HTTP 403 enforcement for read-only demo users.
- **Data boundaries:** Public endpoints exclude unpublished listings. Search and status filters run in the database *before* pagination.
- **Durable media:** Uploaded photos are validated and optimized; storage objects remain separate from database records and application containers.
- **Deliberate client performance:** Maps load on demand rather than with every listing page. SEO metadata and sitemap content reflect eligible public routes.
- **Repeatable delivery:** CI runs frontend/backend tests, builds, dependency checks, PostgreSQL migrations, API health verification, and a Docker build. Render deploys from passing checks.

The project includes keyboard and screen-reader-oriented accessibility improvements, as well as consent-aware analytics. WCAG 2.2 AA is a design target, **not** a claim of formal certification.

## Architecture

```text
Angular (public site + admin)
           |
        HTTPS API
           |
        FastAPI -------- SMTP
         /   \
 PostgreSQL  Object storage
```

FastAPI owns business rules, validation, authorization, and persistence. Angular handles presentation and browser interactions; it is not trusted as a security boundary.

## Run locally and learn more

Start with **[local development](docs/local-development.md)**. For the implementation decisions, see [architecture](docs/architecture.md), [security](docs/security.md), [accessibility](docs/accessibility.md), and [deployment](docs/production-deployment.md).

This project is a working software demonstration, not an operating real estate brokerage or a source of real property listings.

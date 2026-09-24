# Juniper & Lane Realty Frontend

This directory contains the Angular 19 frontend for the Real Estate Portfolio
Project.

The same Angular application serves two route areas:

- public real-estate/customer experience at `/`;
- internal staff/admin application at `/admin`.

For the full project architecture, backend setup, production deployment, and
portfolio walkthrough notes, start with the repository-root
[README](../README.md).

## Local development

Install dependencies:

```text
npm ci
```

Start the Angular development server:

```text
npm start
```

Open `http://localhost:4200`.

When the frontend itself is running on localhost, API requests default to the
local FastAPI service at `http://localhost:8000`.

The complete local stack instructions, including PostgreSQL, MinIO, migrations,
and initial administrator setup, are in
[docs/local-development.md](../docs/local-development.md).

## Tests

Run the CI-equivalent frontend checks:

```text
npm run test:ci
```

This runs:

1. the static accessibility template audit;
2. the Angular unit tests in headless Chrome.

Run a normal application build with:

```text
npm run build
```

## Production build

Production deployments inject the public API origin at build time instead of
hard-coding a localhost URL.

Example:

```text
PUBLIC_API_BASE_URL=https://api.example.com npm run build:render
```

The build command generates `public/runtime-config.js` and then performs the
Angular production build. The generated runtime configuration may contain only
public deployment values, never secrets.

Render deployment details are documented in
[docs/production-deployment.md](../docs/production-deployment.md).

## Frontend structure

Key application areas:

```text
src/app/
  admin/       internal staff/admin pages and layout
  public/      public site and customer-account pages
  guards/      route-access helpers
  interceptors/
  models/
  services/
```

Angular route guards improve client-side navigation, but FastAPI remains the
authoritative security boundary for protected operations.

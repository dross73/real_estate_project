# Angular Frontend

This directory contains the Angular 19 frontend for the Real Estate Portfolio
Project.

The same Angular application serves two route areas:

- public real-estate and customer-account pages;
- the protected `/admin` brokerage application.

Project-wide architecture, backend setup, deployment, and feature documentation
live in the repository root README and `docs/`.

## Local development

Complete the repository first-time setup in
[`docs/local-development.md`](../docs/local-development.md), then from this
directory run:

```text
npm ci
npm start
```

The development server runs at `http://localhost:4200`.

When the browser is running on localhost, the frontend API helper uses the local
FastAPI origin at `http://localhost:8000`.

## Build

Standard optimized build:

```text
npm run build
```

Production/Render build:

```text
PUBLIC_API_BASE_URL=https://api.example.com npm run build:render
```

On PowerShell:

```text
$env:PUBLIC_API_BASE_URL="https://api.example.com"
npm run build:render
```

The production command writes a public `runtime-config.js` containing only the
public API origin, then creates the optimized Angular bundle. Secrets must never
be placed in frontend build/runtime configuration.

## Tests

Interactive Angular tests:

```text
npm test
```

CI-style frontend checks:

```text
npm run test:ci
```

The CI command runs the template accessibility audit and the Angular unit suite
in headless Chrome.

The repository GitHub Actions workflow also performs a normal build and a
production-style build with an HTTPS API origin.

## Main source areas

- `src/app/public/` - public site, customer-account pages, and public services.
- `src/app/admin/` - internal brokerage/admin pages.
- `src/app/services/` - shared/internal HTTP services.
- `src/app/guards/` - Angular navigation guards.
- `src/app/interceptors/` - authenticated HTTP request behavior.
- `src/app/core/api-base-url.ts` - local/production API-origin resolution.
- `src/styles/` and component styles - shared/public visual system.

Authorization is enforced by FastAPI. Angular guards are navigation controls and
are not treated as the security boundary.

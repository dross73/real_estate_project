# Juniper & Lane Realty: Angular Frontend

The Angular 20 / TypeScript application contains the public real estate site, customer-account pages, and internal administration interface.

## Local development

From `frontend/`:

```bash
npm ci
npm start
```

Open `http://localhost:4200`. For a complete local stack, including FastAPI, PostgreSQL, migrations, and account bootstrap, see [local development](../docs/local-development.md).

## Quality checks

```bash
npm run test:ci
npm run build
```

`test:ci` runs the accessibility template audit and Jasmine/Karma unit tests in headless Chrome.

## Production

The Render build uses `npm run build:render`, which injects the public API origin through `PUBLIC_API_BASE_URL`. It does not embed server secrets.

See the [project overview](../README.md), [architecture](../docs/architecture.md), and [deployment guide](../docs/production-deployment.md).

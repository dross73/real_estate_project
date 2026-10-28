# Juniper & Lane Realty Frontend

Angular 20 application providing the public real estate experience, customer accounts, and the internal brokerage/admin interface.

For the deployed application, architecture, and engineering highlights, see the [main project README](../README.md).

## Development

With Node.js 22 and npm installed:

```bash
npm ci
npm start
```

Open `http://localhost:4200`. The local frontend uses the FastAPI development API at `http://localhost:8000`.

To run tests and a production build:

```bash
npm run test:ci
npm run build:render
```

The CI test command runs the accessibility template audit and Angular unit tests in headless Chrome.

See [local development](../docs/local-development.md) for the full backend/database setup. Production builds generate a public API URL configuration; no credentials are bundled into the frontend.

The public and admin route trees live in `src/app/public` and `src/app/admin`. Angular guards are not security boundaries: FastAPI authorizes protected API operations.

# Local Development

## Prerequisites

- Python 3.13
- Node.js 22 and npm
- Docker Desktop or another Docker Compose-compatible runtime

## First-time setup

From the repository root, copy the example environment file.

Windows PowerShell:

```text
Copy-Item .env.example .env
```

macOS/Linux:

```text
cp .env.example .env
```

Start PostgreSQL:

```text
docker compose up -d
```

The default development service is:

- PostgreSQL: `localhost:5432`

Local listing photos and documents are written to `backend/uploads` by
default. FastAPI serves those files at `http://localhost:8000/media`, so no
separate object-storage service is required for local development. Production
still uses an S3-compatible storage provider.

## Backend

From `backend`:

```text
python -m venv .venv
```

Activate the environment.

Windows PowerShell:

```text
.venv\Scripts\Activate
```

macOS/Linux:

```text
source .venv/bin/activate
```

Install dependencies, migrate the database, and start FastAPI:

```text
python -m pip install -r requirements-dev.txt
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

FastAPI is available at `http://localhost:8000`. The `GET /health` endpoint
also verifies that the API can reach PostgreSQL.

### Create the first local administrator

A fresh database has no default admin credentials. While the backend virtual
environment is active, run:

```text
python -m app.cli.bootstrap_admin --email you@example.com --name "Your Name"
```

Enter and confirm the password when prompted. The password is hidden and is not
passed as a command-line argument.

The bootstrap command can create only the first administrator. After one admin
exists, create later internal accounts from the admin Users page.

## Frontend

In a second terminal, from `frontend`:

```text
npm ci
npm start
```

Open `http://localhost:4200`. A frontend running on localhost automatically uses
the FastAPI development origin at `http://localhost:8000`.

## Tests

Backend:

```text
cd backend
python -m pytest
```

Frontend:

```text
cd frontend
npm run test:ci
```

The frontend CI command runs the template accessibility audit before the Angular
unit suite. GitHub Actions additionally builds the Angular production bundle,
applies migrations to an isolated PostgreSQL service, verifies API health,
validates the Render Blueprint syntax, and builds the backend Docker image.

## Resetting local services

Stop containers without deleting data:

```text
docker compose down
```

To deliberately remove local PostgreSQL data and start clean:

```text
docker compose down -v
```

The second command is destructive. Run migrations and bootstrap the first admin
again after recreating the database volume.

Local uploaded media is separate from Docker data. Delete `backend/uploads`
only when you intentionally want to remove locally uploaded listing photos and
documents.

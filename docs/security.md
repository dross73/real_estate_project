# Authentication and Security

Juniper & Lane Realty uses FastAPI as its authoritative authorization boundary. Angular route guards improve navigation but do not grant permissions.

## Roles

- `public_user`: customer account features, saved homes and searches, inquiries and settings.
- `viewer`: read-only administrative demo. Administrator-created accounts can inspect admin pages and exercise client-side forms without saving.
- `staff`: operational listing, lead, analytics and testimonial workflows.
- `admin`: staff capabilities plus users, agents, offices, and site/security settings.

The viewer's mutating requests (POST, PUT, PATCH, DELETE) are rejected by FastAPI with HTTP 403 even if Angular controls are bypassed. Active account status and current roles are checked rather than relying on old JWT claims alone.

## Authentication controls

- Password hashing uses bcrypt; access tokens are signed JWTs with explicit issuer, audience, purpose and expiration.
- Internal staff/admin accounts support TOTP MFA and one-time recovery codes. MFA secrets are encrypted at rest and recovery codes are stored as keyed hashes.
- Login challenges are short-lived and hashed. Administrator-initiated MFA resets require reauthentication and are audited.
- Fresh databases have no reusable default administrator password; the initial admin is created through an interactive bootstrap command.

## Data and operational safeguards

Public listing endpoints enforce publication eligibility in database queries. Public responses use intentionally limited schemas. File uploads validate sizes and formats, and media object keys are handled through the storage abstraction. CSV exports escape spreadsheet formula prefixes.

Production configuration rejects weak application secrets, insecure origins, and missing required mail or durable-storage configuration. Secrets live in deployment environment settings, not the Angular bundle.

The demo viewer can read administrative records, including potentially sensitive contact and lead information. Provision demo accounts **only on installations with approved demo-safe data**, and share credentials privately.

Security measures reduce risk; they do not substitute for a formal independent security assessment.

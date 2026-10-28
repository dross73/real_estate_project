# Security and Privacy Design

This document describes controls implemented in the repository. It is not a claim of an independent security assessment.

## Identity and authorization

- FastAPI verifies JWT purpose, issuer, audience, expiry, active account state, and role before protected operations.
- Passwords are hashed with bcrypt. Fresh databases contain no default administrator; an interactive one-time bootstrap creates the initial account.
- The application has four roles: `public_user`, `staff`, `admin`, and `viewer`. Angular navigation guards do not replace server authorization.
- Public APIs restrict private/unpublished listing records and only expose public-safe fields. Customer endpoints revalidate account ownership and listing eligibility.

### Read-only administrative demo

Administrators can create a `viewer` account for an interactive demo of existing admin screens. In the browser, saving, deleting, and uploading are disabled with explicit feedback. The API also rejects authenticated viewer writes with HTTP 403, even if client controls are bypassed.

Viewers **can read** internal administrative information (such as leads and contact details). This role must only be provisioned where that data access is appropriate. Demo access is not enabled through hard-coded credentials; an administrator creates and can revoke the account.

## Multi-factor authentication

Internal staff/admin accounts support TOTP enrollment, an optional site-wide required-MFA policy, recovery codes, and audited administrator resets. Enrollment requires proof of an authenticator code. TOTP secrets are encrypted at rest; recovery codes and short-lived login challenges are stored as hashes. Existing tokens are rechecked against current internal MFA policy.

## Validation and production configuration

- Backend validation enforces photo/document upload constraints, and the media layer validates object keys and processes image variants.
- CSV exports defend against spreadsheet formula injection.
- Production startup rejects unsafe configuration, including weak signing secrets, invalid CORS/public origins, and missing required storage/email settings.
- Credentials remain server-side in environment settings. Frontend runtime configuration contains only the public API origin.
- CI audits production npm dependencies and Python runtime requirements, runs application tests and migrations, and builds the production image.

## Privacy and analytics

First-party listing-view analytics intentionally avoid collecting visitor IP addresses, account identities, user agents, full referring URLs, query strings, or page paths. Public view events record listing identity, source category, optional referrer hostname, and time.

Visitor analytics choices are stored locally in the browser. The live site's optional Cloudflare Web Analytics integration checks the configured analytics category and consent preferences before loading; it does not represent an advertising integration. Privacy preferences are not synchronized across devices.

## Scope

Automated tests and configuration checks reduce risk; they do not replace a penetration test, a formal accessibility audit, or ongoing operational monitoring. See [architecture](architecture.md) and [accessibility](accessibility.md) for other implementation boundaries.

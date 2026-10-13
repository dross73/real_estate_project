# Full interactive admin demo (KAN-107)

The `viewer` role signs in through the existing `/admin/login` flow and can explore
all existing admin pages, including listings, photos/documents, open houses,
users, agents, offices, leads, testimonials, analytics, site settings and security.
The persistent banner reads **Demo Mode — Changes will not be saved**.

Forms, file selectors and confirmation dialogs remain available. Viewers can edit
local form values, but attempted saves, uploads, deletes and other mutations show
**Demo Mode — Changes are disabled.** No mutation request is sent by Angular.
FastAPI independently rejects authenticated viewer POST/PUT/PATCH/DELETE requests
with 403 before application side effects. Admin/staff permissions and MFA remain
unchanged. Viewer security settings are readable, but enrollment/reset operations
cannot generate real secrets or recovery credentials. No fake success is shown.

## Deployment and data policy

No additional environment configuration is required. An administrator-created
viewer can sign in immediately. Only provision viewer accounts on installations
whose access policy permits reading administrative data: viewers can read user
contact information, leads, internal documents and audit information. Do not
provision viewers on deployments containing real customer data unless that access
is explicitly permitted. Password hashes, MFA secrets and deployment credentials
are excluded from API response schemas; viewer CSV exports stay in memory.

No Alembic migration is needed: the user role column is an unconstrained string.
Deploy compatible frontend and backend versions together. No accounts are created
automatically and no credentials are supplied by this implementation.

Fresh login, registration, email verification, password reset and login-time MFA
challenge requests do not carry a previous bearer token. Account switching works
without clearing browser storage. Protected account/MFA management and all other
viewer mutations remain blocked independently by Angular and FastAPI.

## Secure account setup and revocation

1. As an administrator, open **Users → Add User**.
2. Enter a unique email/name and strong unique password; choose **viewer**.
3. Share access privately with the intended reviewer. Never publish credentials.
4. Sign in at `/admin/login`; no environment setup is required.

Passwords use the existing hashing service. Public registration cannot grant
viewer access. A viewer cannot change their own role or account. Administrators
can deactivate/delete the account or change its role; current database role and
active/archive status are checked on viewer requests, revoking old tokens.

## Verify before sharing

- Confirm the banner and access to every admin navigation item/create/edit form.
- Edit fields, select a photo, attempt save and confirm delete: expect the exact
  disabled message, retained local input, no success message and no mutation API
  request. Reload to confirm persisted data has not changed.
- Direct API writes with a viewer token must return 403 with unchanged DB/media.
- Deactivate/delete the viewer; login and old-token reads must be rejected.
- Switch from viewer to admin/staff with an old viewer token in storage; verify
  login reaches the backend without an old Authorization header.
- Retest staff/admin editing and their existing MFA flow.

Automated tests enumerate application GET/write routes using isolated SQLite and
mocked storage, and check token revocation, role escalation and account switching.
Browser checks use isolated temporary fixtures only; no live demo credentials,
production database, storage, email or infrastructure are touched.

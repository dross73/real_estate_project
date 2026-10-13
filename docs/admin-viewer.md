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

## Explicitly enable only on a demo installation

`ENABLE_ADMIN_DEMO_VIEWER` defaults to `false`. When disabled, viewer login and all
requests authenticated with existing viewer tokens are rejected. Do not enable it
on an installation containing real customer data: enabled viewers can read admin
user contact information, leads, internal documents and audit information.
Password hashes, MFA secrets and deployment credentials are not exposed by API
response schemas. Viewer CSV exports use memory rather than temporary disk files.

For an isolated local demo, start the backend with:

```sh
ENABLE_ADMIN_DEMO_VIEWER=true uvicorn app.main:app --reload
```

After review, an operator may explicitly opt in on a dedicated portfolio/demo
installation using its normal deployment configuration. This implementation does
not change deployment configuration or create any accounts automatically.
No Alembic migration is needed: the user role column is an unconstrained string.
Deploy compatible frontend and backend versions together.

## Secure account setup and revocation

1. As an administrator, open **Users → Add User**.
2. Enter a unique email/name and strong unique password; choose **viewer**.
3. Share access privately with the intended reviewer. Never publish credentials.
4. Sign in at `/admin/login` after the demo switch has been explicitly enabled.

Passwords use the existing hashing service. Public registration cannot grant
viewer access. A viewer cannot change their own role or account. Administrators
can deactivate/delete the account or change its role; current database role and
active/archive status are checked on viewer requests, revoking old tokens.
Disable `ENABLE_ADMIN_DEMO_VIEWER` to revoke all viewer access (including old JWTs).
Restart backend processes after changing this server configuration.

## Verify before sharing

- Confirm the banner and access to every admin navigation item/create/edit form.
- Edit fields, select a photo, attempt save and confirm delete: expect the exact
  disabled message, retained local input, no success message and no mutation API
  request. Reload to confirm persisted data has not changed.
- Direct API writes with a viewer token must return 403 with unchanged DB/media.
- Disable the switch; both login and reads with an old viewer JWT must return 403.
- Retest staff/admin editing and their existing MFA flow.

Automated tests enumerate application GET/write routes using isolated SQLite and
mocked storage, and check disabled mode, token revocation and role escalation.
Browser checks use isolated temporary fixtures only; no live demo credentials,
production database, storage, email or infrastructure are touched.

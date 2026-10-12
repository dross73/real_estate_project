# Read-only portfolio reviewer access (KAN-107)

The `viewer` role uses the existing password/JWT sign-in at `/admin/login`.
Viewers see **Demo Access — Read Only** throughout the admin layout.

| Capability | Viewer |
| --- | --- |
| Dashboard listing counts/snapshot | Allowed; no user counts or account data |
| Listing search, filters, sorting, pagination and details | Allowed |
| Listing photo gallery and public-page preview | Allowed |
| Upcoming/past open-house details | Allowed |
| Listing, photo, document or open-house mutations | Forbidden |
| Users, agents/offices management, settings, leads, testimonials, analytics, exports, audit and MFA administration | Forbidden |
| Internal listing documents | Forbidden; may contain private information |

Only approved read endpoints explicitly accept viewers. Existing admin/staff
write dependencies remain restricted. A global API dependency rejects viewer
access tokens on all mutation methods, including public anonymous-write APIs.
The Angular child guard defaults new admin routes to restricted, and the UI
hides write controls. An interceptor also stops accidental viewer mutation
requests; backend enforcement is independent of the UI.

Viewer reads check the current database role and active/archive status on every
request. Deactivation, deletion or role changes revoke an existing viewer token;
demoting an existing administrator/staff member also invalidates their older
privileged token. Admin/staff MFA remains unchanged and required according to
the existing policy; viewers cannot enter the MFA administration flow.

## Create an account after deployment

1. Sign in as an administrator and open **Users → Add User**.
2. Enter a unique email/name and a strong, unique password; select **viewer**.
3. Share credentials privately with the intended reviewer. Do not put credentials
   in repository files, Jira, PR descriptions or public portfolio documentation.
4. Have the reviewer sign in at `/admin/login`.

No account is automatically created, no password is hardcoded, and public
registration cannot assign the viewer role. Passwords use the existing hashing
service. Only administrators can create/manage viewers. To revoke access, edit
the user and disable **Active**, or delete the account. Updating the role is also
admin-only; require a fresh sign-in after a role change. Viewer self-service
profile/password/MFA mutations are intentionally unavailable; use administrator
account management for access changes.

No new environment variables or Alembic migration are required: `users.role`
is an unconstrained string column, and the legacy role-catalog table is not
the authorization source. Both API and frontend must include this implementation.

## Review verification

- With a reviewer account, confirm the banner and only Dashboard/Listings links.
- Search, filter, sort, paginate, open a listing, view photos and open houses.
- Check that Add/Edit/Delete, photo management, document management and open-house
  forms/actions are absent. Direct create/edit/settings/user URLs return to the
  dashboard before loading restricted components.
- Use the viewer bearer token in a direct listing/photo/open-house/user write
  request: expect 403 and unchanged data/media. Sensitive GETs also return 403.
- Disable the account as an administrator, then retry an approved GET with the
  old token: expect 401. Retest normal staff/admin editing and MFA.

Automated API tests enumerate every write operation and every sensitive internal
GET from the actual application OpenAPI schema, using isolated SQLite and mocked
storage. No live accounts, production databases or storage are used by these tests.

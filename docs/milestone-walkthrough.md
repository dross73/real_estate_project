# Launch Milestone Walkthrough

This is the recording plan for the launch-stage project walkthrough. It is meant
to feel like a developer explaining a real project, not a scripted feature
commercial.

Target length: about 10–15 minutes.

## Before recording

Use demo/test data only.

Have these ready:

- Jira board with the launch ticket visible.
- Public homepage in a desktop browser.
- One polished public listing with several photos.
- One verified public-user demo account.
- One staff/admin demo account with MFA already configured if MFA is enabled.
- Admin listing, leads, analytics, site settings, and security pages.
- GitHub repository on the README or Actions page.
- Production architecture diagram from `docs/architecture.md`.

Do not show passwords, MFA recovery codes, environment values, storage
credentials, private customer information, or production secrets.

## 1. Open with Jira and the milestone

Start on the active/completed Jira work for this milestone.

Keep this short, around 30–45 seconds.

Explain that the project has been developed in small tickets with acceptance
criteria and a simple workflow:

```text
To Do -> In Progress -> In Review -> Done
```

Show the current launch/documentation ticket and briefly point out nearby launch
work such as accessibility, testing, deployment, or security. The point is to
show that Jira is part of the development workflow, not to tour the board.

Suggested transition:

> The earlier videos showed individual backend and frontend milestones. At this
> point the pieces have grown into a complete public site, customer account area,
> and internal brokerage application, so this walkthrough focuses on how the
> finished areas work together.

## 2. Public homepage and visual system

Open the public homepage.

Show:

- navigation and brokerage identity;
- featured listings;
- community-oriented content;
- responsive/public visual system;
- footer and optional privacy choices.

Mention that public content and branding are driven by backend site settings
rather than being scattered through Angular templates.

## 3. Listing browse and detail flow

Open Browse Listings.

Demonstrate:

- search/filtering;
- sorting;
- pagination;
- listing cards;
- one listing detail page;
- gallery/photos;
- property facts;
- agent/open-house/document information where present.

Explain the important backend boundary: only public-eligible listings are
returned by the public API. Draft/private records are not merely hidden by the
frontend.

## 4. Customer account workflow

Sign in with the demo public-user account.

Show a short path through:

- account dashboard;
- saving a home;
- recently viewed listings;
- saved searches and alert preferences;
- inquiry/showing request;
- account settings.

Do not spend time filling every form. Demonstrate one representative action and
explain that registration, email verification, password recovery, and account
closure are also implemented.

## 5. Admin and staff workflow

Switch to the internal application.

Briefly show:

- dashboard;
- listings;
- one listing edit/detail flow;
- photo management;
- leads;
- analytics;
- site settings.

For listing photos, point out that files are processed by FastAPI and stored in
S3-compatible object storage instead of the application server filesystem.

For leads, connect the workflow back to the public inquiry shown earlier.

For analytics, mention that first-party view tracking is intentionally
privacy-minimized.

## 6. Security and role boundaries

Open the Security page or internal account area.

Explain:

- three roles: admin, staff, public user;
- FastAPI performs the authoritative authorization checks;
- staff/admin can use TOTP MFA and recovery codes;
- Angular route guards improve navigation but are not trusted as the security
  boundary;
- a fresh production database has no default admin password and uses the
  one-time bootstrap command.

If showing MFA, do not expose the setup secret or recovery codes.

## 7. Architecture

Open `docs/architecture.md` or the README architecture section.

Explain the path in plain language:

```text
Angular -> FastAPI -> PostgreSQL
                    -> S3-compatible media storage
                    -> SMTP
```

Call out two or three decisions rather than every technology:

- public/admin data boundaries are enforced server-side;
- Alembic owns database schema changes;
- object storage keeps media independent from ephemeral compute;
- environment-driven configuration keeps secrets and production URLs out of
  source code.

## 8. Automated quality checks

Open the latest successful GitHub Actions run.

Show that CI performs both frontend and backend checks.

Mention:

- Angular build and tests;
- accessibility template audit;
- production-style frontend build;
- Alembic migration run against PostgreSQL;
- backend pytest suite;
- live API health check;
- Docker image build;
- Render Blueprint validation.

This section should be brief. The green workflow is evidence that the launch
checks are repeatable rather than a manual one-time test.

## 9. Production deployment

Show `render.yaml` or the production deployment diagram, not secret settings.

Explain the planned/active production topology:

- Angular static site/CDN on Render;
- FastAPI Docker service on Render;
- managed PostgreSQL;
- private S3-compatible media storage;
- SMTP transactional email;
- custom HTTPS frontend/API domains.

If the production deployment is live by recording time, show the verified live
URL and run a short public smoke test. If it is not live yet, say that production
provisioning is the remaining launch step and do not imply otherwise.

## 10. Close with the development progression

Return to the README video section or Jira.

Close by connecting this walkthrough to the earlier milestone videos:

- earlier videos captured individual pieces while they were being built;
- this walkthrough shows how those pieces now work as one application;
- future videos, if any, should represent meaningful new milestones rather than
  minor UI changes.

A concise closing line is enough. Avoid a long recap of every feature.

## Editing notes

- Keep terminal output readable and zoom in when showing code or CI.
- Cut waiting/loading time.
- Avoid showing browser bookmarks, email inboxes, account settings, or unrelated
  tabs.
- Keep Jira on screen only long enough to establish the workflow.
- Prefer showing a working feature over reading source code.
- When discussing code, use one representative file or architecture diagram.
- If a feature has a known launch follow-up, state it plainly instead of
  presenting it as complete.

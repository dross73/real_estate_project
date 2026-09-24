# Dependency Security

KAN-102 adds repeatable dependency-vulnerability gates to the launch CI pipeline.

## Launch gates

The frontend and backend are audited separately so development tooling is not
mistaken for code shipped to production.

### Frontend production dependencies

CI runs:

```text
npm audit --omit=dev --audit-level=high
```

This command is a launch gate. A high or critical vulnerability in a production
dependency fails CI.

During KAN-102 the Angular 19 runtime line reported multiple high-severity
security advisories. The frontend was migrated with Angular's official update
tooling to Angular 20 LTS. The production-only audit now reports zero
vulnerabilities, and the Angular build, accessibility audit, unit suite, and
production-style build pass on the upgraded dependency set.

### Backend runtime dependencies

CI installs the development requirements and then audits only
`backend/requirements.txt`:

```text
python -m pip_audit -r requirements.txt
```

The initial audit found vulnerable runtime pins including Pillow, AnyIO, Click,
Cryptography, Starlette, IDNA, Mako, python-dotenv, python-multipart, and the
legacy `python-jose` dependency chain.

KAN-102 upgrades the affected runtime packages and replaces `python-jose` with
PyJWT. Removing `python-jose` also removes its obsolete
`ecdsa`/`rsa`/`pyasn1` chain rather than suppressing an advisory with no
clean in-place fix.

The backend runtime audit now passes with no known findings in the pinned
runtime requirements.

## Development-only frontend findings

CI also runs a full `npm audit` as a non-blocking report. This intentionally
keeps development-tooling risk visible without treating it as browser runtime
exposure.

At the KAN-102 launch audit, the full install reports 20 findings
(1 low, 7 moderate, 12 high) in transitive development/build/test packages,
while `npm audit --omit=dev` reports zero production vulnerabilities.

The reported development-only packages are:

- `brace-expansion`
- `engine.io`
- `fast-uri`
- `flatted`
- `follow-redirects`
- `immutable`
- `js-yaml`
- `lodash`
- `minimatch`
- `picomatch`
- `postcss-selector-parser`
- `socket.io-parser`
- `tmp`
- `uuid`
- `ws`

These packages are transitive dependencies of the Angular CLI/build tooling,
Karma/dev-server tooling, or related development utilities. They are not part of
the deployed browser dependency set reported by npm's production-only audit.

Several have non-breaking transitive fixes that npm can adopt as upstream
dependency ranges move. One remaining `uuid` path currently requires a
breaking Angular build-tool upgrade according to npm's remediation output. The
project does not force that unrelated major upgrade solely to make the raw
development audit count zero.

Follow-up policy:

1. Keep the full audit visible in every CI run.
2. Keep high/critical production findings blocking.
3. Re-run normal dependency updates regularly so transitive development fixes
   are adopted as compatible versions become available.
4. Re-evaluate any remaining development finding before changing CI/build
   infrastructure or exposing those tools outside the trusted development/CI
   environment.
5. Do not add audit ignore flags for runtime findings without a documented Jira
   follow-up and a concrete risk assessment.

## Why the two npm audits differ

`npm ci` installs both runtime dependencies and developer tooling because CI
must compile and test the Angular application. Its summary therefore includes
vulnerabilities in packages used only while building or testing.

The deployed Render static site contains compiled HTML/CSS/JavaScript assets, not
the local Angular CLI, Karma server, webpack development server, or their
transitive Node packages. For launch exposure, the production-only audit is the
correct blocking boundary; the full audit remains useful maintenance
information.

## Update discipline

Dependency-security changes must still pass the normal application checks.
Auditing does not replace regression testing.

A dependency remediation is ready to merge only when CI also confirms:

- Angular application build;
- accessibility template audit;
- Angular unit tests;
- production-style Angular build;
- Alembic migrations;
- backend pytest suite;
- API startup and database health;
- backend Docker image build.

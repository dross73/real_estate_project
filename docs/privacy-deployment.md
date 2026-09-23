# Privacy and Consent Deployment Notes

## Baseline behavior

The application is intentionally able to run without a cookie/consent banner.

The launch baseline currently uses browser storage only for functionality the
application needs to provide requested features:

- `access_token` in localStorage keeps an authenticated browser session available
  to Angular so protected API requests can include the JWT.
- `juniper_lane_privacy_preferences_v1` in localStorage remembers a visitor's
  privacy choices when optional consent controls are enabled.

No third-party analytics or advertising integration is initialized by the current
baseline implementation.

The Contact page also uses an ordinary OpenStreetMap link instead of an embedded
third-party map. The visitor chooses whether to open that external map service.

## Admin settings

Site Settings exposes three deployment-level privacy controls:

- **Enable visitor consent controls** — turns the public preference UI on when at
  least one optional category is configured.
- **Analytics category** — identifies analytics/measurement as an optional
  integration category used by the deployment.
- **Marketing / advertising category** — identifies advertising, remarketing, or
  similar optional integrations used by the deployment.

All three settings default to off. With the defaults, no privacy banner is shown.

## Visitor choices

When consent controls are enabled and at least one optional category is configured,
a visitor who has not yet chosen sees the privacy-choice banner.

Visitors can:

- accept all configured optional categories;
- reject all optional categories;
- choose analytics and marketing independently;
- reopen **Privacy Choices** from the public footer and change the stored choice.

Essential storage is not presented as optional because the application uses it for
authentication, security-related session behavior, and storing the privacy choice
itself.

Clearing browser storage removes the saved preference, so the site asks again the
next time consent controls are applicable.

## Integration enforcement

Future non-essential integrations must not read the localStorage record directly.
They should use `PrivacyConsentService` as the single frontend gate:

- `allowsAnalytics(settings)` before starting analytics or measurement code;
- `allowsMarketing(settings)` before starting advertising or remarketing code.

When the matching category is disabled, the service returns false.

When visitor consent controls are enabled, the service returns true only after the
visitor has granted that category.

When consent controls are disabled but a category is intentionally enabled for a
deployment, the gate permits the configured integration without showing the
preference UI. Deployment owners should configure these switches to match the
actual integrations and requirements for the environment where the site is used.

## Legal-page relationship

Privacy Policy and Terms of Use publishing remain separate Site Settings controls.
The consent UI links to the Privacy Policy only when that page is published.

Unpublished legal-page draft content is withheld by the public API rather than
being hidden only in Angular.

## Current limitation

Privacy preferences are browser-local and are not recorded server-side. If a
future deployment requires server-side consent receipts, cross-device preference
sync, or consent-version history, that should be added as a separate data model
and migration rather than overloading site settings.

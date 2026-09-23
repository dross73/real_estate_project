# Internal MFA

KAN-85 adds TOTP-based multi-factor authentication for internal administrator and
staff accounts. Public customer accounts are intentionally outside the launch MFA
scope.

## Enrollment

An authenticated staff or administrator can open **Admin > Security** and choose
**Set Up MFA**.

The server generates a random TOTP secret and returns a short-lived signed
enrollment token. The secret is not persisted until the user proves possession of
the authenticator by submitting a valid 6-digit TOTP code.

After verification:

- the TOTP secret is encrypted before database storage;
- eight one-time recovery codes are generated;
- only keyed hashes of recovery codes are stored;
- the plaintext recovery codes are shown once to the user;
- a refreshed access token records that MFA was verified for the session.

## Required policy

An administrator can enable **Require MFA for admin and staff** in Site Settings.

When the policy is enabled:

- an internal user who already has MFA receives a second-factor challenge after a
  correct password;
- an internal user who has not enrolled receives a limited enrollment challenge
  after a correct password;
- the limited challenge cannot be used as an application access token;
- signed enrollment tokens have an explicit non-access purpose and are rejected
  by protected API dependencies;
- protected internal endpoints also check the current MFA policy, the user's
  current MFA enrollment state, and the access token's MFA-verification claim.

The last check matters when policy changes while someone is already signed in.
An older password-only internal token stops authorizing protected internal API
calls after the required-MFA setting is enabled.

## Login challenge

MFA login challenges are random bearer values stored only as SHA-256 hashes in
the database. They expire after five minutes, are single-use, and are invalidated
after five failed verification attempts.

A valid authenticator code or unused recovery code completes the challenge and
issues the normal application access token.

## Recovery codes

Each enrollment creates eight recovery codes. Each recovery code can be used once
in place of the authenticator code during login.

Using a recovery code removes its stored hash immediately. The Security page shows
the number of remaining recovery codes but never displays old plaintext recovery
codes again.

## User-controlled disable

When MFA is optional, an internal user can disable their own MFA from the Security
page only after providing:

1. their current password; and
2. a valid authenticator or recovery code.

When the site-wide internal MFA policy is enabled, self-service disable is blocked.

## Administrator reset

If a staff/admin user loses the authenticator and all recovery codes, an
administrator can open that user's **Edit User** page and use **MFA Recovery**.

The administrator must re-enter their own current password. The reset action:

- is admin-only;
- is audited;
- clears the target user's encrypted TOTP secret and recovery hashes;
- never reveals the old secret or old recovery codes;
- forces the target user through enrollment after the next password sign-in when
  required MFA is enabled.

If required MFA is enabled, clearing a user's MFA also causes their existing
internal access token to fail the protected API policy check.

## Secret and key handling

TOTP secrets are encrypted at rest with a Fernet key deterministically derived
from the application's `SECRET_KEY`. Recovery codes use an HMAC-SHA256 keyed hash
with the same server secret.

Because encrypted MFA secrets depend on `SECRET_KEY`, rotating that application
secret requires an explicit MFA-secret migration or a planned MFA reset for
internal users. It should not be changed casually in a running deployment.

## Accessibility

The internal login page uses distinct password, MFA challenge, enrollment, and
recovery-code steps. Form controls have visible labels, errors use alert roles,
authenticator inputs support one-time-code autocomplete, and setup does not depend
on scanning a QR code because the manual setup key is always visible.

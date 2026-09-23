# Operational Analytics

KAN-82 adds first-party operational reporting for listing interest and lead activity.

## What is counted

The analytics overview reports:

- listing-detail views within the selected date range;
- current favorites for active public users and currently public-eligible listings;
- inquiries created within the selected date range;
- showing requests within the selected date range;
- top listings using range-scoped views and inquiries plus the current-favorite snapshot;
- source categories and external referring hostnames for listing views.

"Current favorites" is intentionally labeled as a snapshot rather than a historical
range metric. Removing a saved home removes that relationship, so the application
does not pretend it has a complete favorite-event history.

## Privacy boundaries

Anonymous listing-view events store only:

- listing ID;
- normalized source category;
- optional external referrer hostname;
- timestamp.

They do **not** store an IP address, user ID, browser/user-agent string, full
referring URL, query string, or page path.

The browser reduces `document.referrer` to a hostname before sending it. The API
then classifies the view as direct, search, social, or referral. Referring-site
reporting preserves only the hostname.

Public listing preview routes do not record views.

If a deployment enables visitor consent controls and marks analytics as an optional
category, listing-view recording waits for the analytics preference. If site
settings cannot be loaded, the listing remains usable and the view is skipped.

## Date ranges and trends

The admin Analytics page supports 7, 30, 90, and 365 day ranges.

The backend chooses a reporting granularity that keeps the trend readable:

- 1–31 days: daily;
- 32–120 days: weekly;
- 121–365 days: monthly.

Empty periods are returned as zero-count rows so the table remains an accessible
and stable source of truth.

## Authorization

`GET /analytics/overview` requires an internal staff or admin role. Public users
cannot access operational reports.

`POST /public/analytics/listing-views/{listing_id}` is anonymous by design and
accepts only currently public-eligible listings.

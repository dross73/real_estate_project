# SEO and Sitemap Strategy

KAN-86 adds dynamic page metadata, canonical URLs, structured data, and a
database-backed sitemap source.

## Canonical URLs

The Angular SEO service builds canonical URLs from the browser's current origin
plus the public route path. Query strings are intentionally omitted from
canonicals so filter/sort combinations do not create duplicate canonical pages.

Production must serve the Angular application from its final public domain before
launch validation. The same service then emits canonical and Open Graph URLs for
that production origin without hard-coding a portfolio/development hostname.

## Sitemap

The backend exposes:

`GET /public/seo/sitemap.xml`

The XML uses `PUBLIC_APP_URL` for every public frontend URL and reads current
database state each time (with a short cache header).

It includes:

- the homepage and public listings browse page;
- About, Contact, Privacy, and Terms only when those pages are enabled;
- active/public agent profiles;
- only listings with `is_public = true` and status Active, Pending, or Sold.

It intentionally excludes admin/account routes, previews, Draft listings,
Archived listings, visibility-disabled listings, and hidden/inactive agents.

Because the frontend and API are hosted separately, the production Render static
site defines a higher-priority `/sitemap.xml` redirect to the backend
`/public/seo/sitemap.xml` endpoint before the Angular SPA catch-all route. This
keeps the sitemap database-backed and current without requiring a new frontend
deployment when listings or agents change.

The static frontend also publishes `robots.txt`. It allows normal public routes,
disallows the admin/account/preview route groups, and advertises the public
`https://realestate.dan-ross.dev/sitemap.xml` URL.

## Structured data

The Angular frontend emits JSON-LD for public pages. Listing details use
Schema.org `RealEstateListing` with an `Offer` plus property/location facts.
The homepage uses `RealEstateAgent` organization data from live Site Settings.

Structured data is removed when navigating to a page that does not define it, so
SPA navigation cannot leave stale listing markup behind.

## Indexing boundaries

Public listing metadata is created only after the public listing endpoint returns
an eligible listing. A public 404 therefore never receives indexable listing
metadata.

Preview, account, authentication, and admin routes are marked `noindex,nofollow`
by the application shell. They are also omitted from the sitemap.

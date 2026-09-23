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

Because the frontend and API may be hosted separately, production deployment must
publish this sitemap from the public site's own `/sitemap.xml` location. KAN-90
deployment should do one of the following:

1. route/rewrite the public site's `/sitemap.xml` request to the backend
   `/public/seo/sitemap.xml` endpoint; or
2. fetch that endpoint during deployment and publish the returned XML as the
   frontend's static `sitemap.xml`.

The first option keeps listing changes current without a new frontend deployment.

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

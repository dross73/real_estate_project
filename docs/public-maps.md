# Public listing maps

Maps use MapLibre GL JS and OpenFreeMap; no API key or runtime geocoder is required.
The renderer JavaScript and `/vendor/maplibre-gl.css` are requested only after
Show Map opens a map with public coordinates. The standard attribution control
retains provider/data credits. Map styles are configured in `map-loader.service.ts`:

- Light: https://tiles.openfreemap.org/styles/liberty
- Dark: https://tiles.openfreemap.org/styles/dark, with a local navy paint
  transformation and cool-light labels/halos for readable contrast. Sources,
  sprites, fonts and attribution are unchanged.

Styles, vector/raster tiles, glyphs and sprites need network access to
`https://tiles.openfreemap.org`. MapLibre uses a same-origin static module worker (and its shared module) in
`/vendor`; if deployment adds
a Content Security Policy, allow the provider in connect/img sources and
`worker-src 'self'`. No map service is contacted until Show Map is selected.
Map failures leave Grid/List and ordinary listing links usable.

## One-time database setup

From `backend`, with the target database configured:

```sh
alembic upgrade head
python backfill_demo_coordinates.py         # inspect dry run
python backfill_demo_coordinates.py --apply
```

Migration `b7e31c8a902d` adds nullable floating-point latitude/longitude fields.
Internal create/update schemas accept optional finite coordinates in valid
latitude/longitude ranges. Both coordinates are needed for a marker.

The offline backfill uses documented city centers for Ames, Story City, Huxley,
Ankeny, Gilbert, Nevada and Boone in Iowa, with small deterministic offsets.
These are illustrative city-area positions for fictional portfolio homes, not
surveyed or geocoded street locations. It only matches `DEMO-` MLS numbers or
the existing fictional portfolio attribution, preserves existing/partial
coordinates, skips unknown cities and is safe to repeat. Seed new demo listings
with the existing seed script before running the backfill if needed.
Real listings need verified coordinates entered through existing listing APIs.

Public serialization withholds **both coordinates and street address** when
`hide_exact_address` is set. Hidden-address homes remain in listing results but
have no public marker; detail maps explain that the location is withheld.
This deliberately avoids guessing a privacy-safe radius for private addresses.

The results map uses only the current filtered/paginated response and fits its
mappable homes. Numbered marker buttons correspond to the ordered linked list;
selecting one shows the title, normal/last-listed price and detail link.
Opening a detail map shows one marker. Missing coordinates show an unavailable
message without downloading MapLibre. Site theme changes update an open map's
style without resetting bounds. Components remove maps, markers and resize
observers when closed or navigated away from.

Before release, apply migration/backfill to the intended deployment database
and review the approximate demo positions. OpenFreeMap is an external public
service; verify its availability and your deployment's CSP/network policy.

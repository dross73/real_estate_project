# CSV Export Columns

KAN-83 provides staff/admin CSV exports for operational lead and analytics data.

Exports are generated incrementally into a spooled temporary file. Small exports
remain in memory; larger exports spill to temporary disk before the response is
streamed in bounded chunks. This avoids building one large CSV string in memory.

Text cells beginning with spreadsheet formula markers (`=`, `+`, `-`, or
`@`) are prefixed with an apostrophe to reduce CSV/spreadsheet formula injection
risk.

All exported timestamps use UTC ISO-8601 values ending in `Z`.

## Lead export

Endpoint: `GET /exports/leads.csv`

The endpoint accepts the same `status`, `inquiry_type`, and `q` filters used by
the admin lead list.

Columns are always written in this order:

1. `lead_id`
2. `inquiry_type`
3. `status`
4. `contact_name`
5. `contact_email`
6. `contact_phone`
7. `listing_id`
8. `listing_title`
9. `message`
10. `preferred_at_utc`
11. `source`
12. `assigned_to`
13. `created_at_utc`
14. `updated_at_utc`

Internal activity history, requester user IDs, password/authentication data, and
other unrelated user fields are not exported.

## Analytics export

Endpoint: `GET /exports/analytics.csv?days=30`

The `days` range accepts 1 through 365. The admin UI uses 7, 30, 90, and 365.

The file is normalized so one fixed header can represent the complete report.
`record_type` identifies the meaning of each row:

- `summary`: overall listing views, current favorites, inquiries, and showings;
- `trend`: one daily/weekly/monthly trend bucket;
- `listing`: one top-listing interest row;
- `source`: one direct/search/social/referral count;
- `referrer`: one external referring-host count.

Columns are always written in this order:

1. `record_type`
2. `period_start_utc`
3. `listing_id`
4. `title`
5. `city`
6. `state`
7. `listing_views`
8. `current_favorites`
9. `inquiries`
10. `showings`
11. `source_category`
12. `referrer_host`
13. `count`
14. `range_days`
15. `range_start_utc`
16. `range_end_utc`

Analytics CSVs preserve the KAN-82 privacy boundary. They do not include visitor
IP addresses, user identities, user agents, full referrer URLs, or lead contact
information.

# KAN-72 - Lead and Site-Management Admin Mockups

Figma MCP is currently unavailable because the connected Starter plan reached its tool-call limit. These repo mockups use the existing admin shell, card, table, form, responsive, and accessibility patterns. They are the reviewable implementation source of truth until they can be synchronized to Figma.

Existing related mockups:
- Site settings / branding: `docs/mockups/KAN-66-admin-site-settings.md`
- Agent profiles: `docs/mockups/KAN-67-agent-profiles.md`
- Offices: `docs/mockups/KAN-68-offices.md`

## Lead / inquiry list

```
Admin Panel
┌────────────────────────────────────────────────────────────────────────┐
│ Leads & Inquiries                                      [Export later] │
│ Review contact, showing, and future registration requests.            │
└────────────────────────────────────────────────────────────────────────┘

[Search...] [Status: All ▼] [Type: All ▼] [Assigned: All ▼]

Name / Contact       Type         Listing          Status      Assigned
Taylor Morgan        Showing      123 Main St      New         Jane Morgan
Alex Rivera          Contact      General          Contacted   Unassigned

                                                [Open]
```

Behavior:
- Default newest first.
- Filters are URL-friendly when practical.
- Status badges use the existing admin semantic colors.
- Empty state explains that new public inquiries will appear here.
- Staff/admin access follows backend role rules.

## Lead / inquiry detail

```
┌──────────────────────────────── Lead ──────────────────────────────────┐
│ Taylor Morgan                              Status [New ▼]             │
│ taylor@example.com · 515-555-0101          Assigned [Jane Morgan ▼]   │
│ Showing request · 123 Main St                                       │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────── Request Details ───────────────────────────┐
│ Preferred date/time, message, listing context, source, created time. │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────── Internal Notes ────────────────────────────┐
│ [Add internal note.................................................]  │
│                                                     [Add Note]        │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────── Activity History ────────────────────────────┐
│ 10:42 AM  Request created                                            │
│ 10:48 AM  Assigned to Jane Morgan                                    │
│ 11:05 AM  Status changed New → Contacted                             │
│ 11:08 AM  Internal note added                                        │
└────────────────────────────────────────────────────────────────────────┘
```

Behavior:
- Assignment is optional so solo-agent deployments are not forced through extra workflow.
- Every status, assignment, and note mutation appears in activity history.
- Notes are visually labeled internal and never appear publicly.
- Mobile stacks request details, controls, notes, then history.

## Photo management / upload states

```
Listing Photos                                      7 of 20 allowed

[ Drop photos here or choose files ]

Uploading
┌ image ┐  kitchen.jpg          ███████░░░   Uploading...
┌ image ┐  exterior.jpg         Queued

Uploaded
[★ Primary] [photo] Front exterior       [Make Primary] [Remove]
            [photo] Kitchen              [Make Primary] [Remove]
            [photo] Living room          [Make Primary] [Remove]

Error
garage.tiff  Unsupported file type.        [Remove]
```

Behavior:
- Reuse existing listing-photo uploader and configured site maximum.
- Show queued, uploading, success, and per-file error states distinctly.
- Primary image control is keyboard accessible.
- Reordering remains explicit and does not rely on drag-only interaction.
- Mobile uses full-width rows/cards with large touch targets.

## Analytics overview

```
Admin Panel
┌────────────────────────────────────────────────────────────────────────┐
│ Analytics                                      [Last 30 days ▼]      │
│ Understand listing interest and lead activity.                       │
└────────────────────────────────────────────────────────────────────────┘

[ 1,248 Listing views ] [ 42 Favorites ] [ 18 Inquiries ] [ 7 Showings ]

Lead funnel
New  8  →  Contacted 6  →  Qualified 3  →  Closed 1 / Lost 2

Top listing interest
123 Main St         220 views      12 favorites      5 inquiries
88 Oak Avenue       178 views       8 favorites      3 inquiries

Recent activity
- Showing request received for 123 Main St
- Listing 88 Oak Avenue saved by 3 users
```

Behavior:
- Date range is explicit.
- Metrics state what they count; no ambiguous vanity score.
- Empty datasets show zeros and explanatory copy rather than broken charts.
- Tables remain the accessible source of truth if charts are later added.
- Responsive layout collapses KPI cards and tables cleanly.

## Shared admin design rules

- Existing admin header/sidebar remain unchanged.
- White cards, neutral borders, blue primary actions, restrained semantic status colors.
- Labels remain visible; placeholders never replace labels.
- Keyboard focus states stay visible.
- Confirmation is required for destructive actions.
- Loading, error, empty, and success states are represented on every data-driven screen.
- No new admin screen should require hover, color alone, or drag-only interaction.

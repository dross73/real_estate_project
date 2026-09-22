# KAN-71 - Public User Dashboard Mockup

Figma MCP remains rate-limited. This implementation mockup uses the approved Juniper & Lane public design system and is the temporary source of truth.

## Desktop

```
Your Account
Welcome back, Taylor.

[ 4 Saved homes ] [ 2 Saved searches ] [ 2 Alerts on ] [ Account settings ]

Saved homes                                             [View all]
┌ listing ┐  ┌ listing ┐  ┌ listing ┐

Saved searches                                          [Manage]
Ames under $500k          Daily alerts on          [View results]
3+ beds in Story City     Weekly alerts on         [View results]

Contact & showing requests
No requests yet. Requests will appear here after the inquiry workflow is enabled.

Recently viewed                                          [View all]
┌ listing ┐  ┌ listing ┐  ┌ listing ┐
```

## Mobile

- Summary cards stack into two columns, then one column at narrow widths.
- Listing cards use the existing single-column public listing pattern.
- Saved-search rows stack with actions below.
- Account settings and password actions stay one tap away.
- Empty/loading/error states use the existing public state-card pattern.

## Data rules

- All loaded collections come from authenticated public-user endpoints.
- Only the current user's favorites, saved searches, and recent activity are shown.
- Alert summary is derived from the current user's saved searches.
- Contact/showing requests use a clear empty integration state until KAN-74 supplies the request API.
- Missing optional sections never block the rest of the dashboard.

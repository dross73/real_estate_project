# KAN-67 - Agent Profiles and Listing Assignment Mockup

Figma MCP remains unavailable because the connected Starter plan reached its tool-call limit. This implementation mockup follows the existing admin shell and approved Juniper & Lane public listing-detail design. It is the KAN-67 source of truth until the screens can be synced to Figma.

## Admin agent directory

```
Admin Panel
┌──────────────────────────────────────────────────────────────────────┐
│ Agents                                             [Create Agent]   │
│ Manage public agent profiles and listing assignment availability.   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────── Agent Directory ─────────────────────────────┐
│ Search agents...                                                     │
│                                                                      │
│ Agent              Contact                Public profile   Actions   │
│ Jane Morgan        jane@... / 515...      Visible          Edit      │
│ Alex Rivera        alex@... / 515...      Hidden           Edit      │
└──────────────────────────────────────────────────────────────────────┘
```

## Admin create/edit profile

```
┌──────────────────────── Agent Profile ───────────────────────────────┐
│ Full name                  Professional title                        │
│ [                         ][                                        ]│
│ Email                      Phone                                     │
│ [                         ][                                        ]│
│ Photo URL                                                            │
│ [                                                                  ] │
│ Office / team                                                        │
│ [                                                                  ] │
│ Bio                                                                   │
│ [                                                                  ] │
│ [                                                                  ] │
│                                                                      │
│ [x] Active for listing assignment                                   │
│ [x] Show this profile publicly                                      │
│                                                     [Save Changes]   │
└──────────────────────────────────────────────────────────────────────┘
```

## Listing create/edit assignment

Add one optional field to listing administration:

```
Assigned agent
[ Brokerage / general contact ▼ ]

No assigned agent routes public assistance to the brokerage. An assigned agent
appears on the listing only when the agent profile is active and public.
```

## Public listing detail

Replace the static brokerage advisor card only when a public assigned agent exists:

```
┌──────────────────── Your listing agent ──────────────────────────────┐
│ [photo]  Jane Morgan                                                │
│          REALTOR® · Juniper & Lane Realty                           │
│          515-555-0110 · jane@example.com                            │
│          [View Agent Profile]                                       │
└──────────────────────────────────────────────────────────────────────┘
```

When no eligible assigned agent exists, keep the current Juniper & Lane brokerage fallback card. This keeps solo-agent and brokerage deployments clean without requiring assignment.

## Public agent profile

- Photo, name, professional title, office/team when configured
- Bio, phone, email
- Active public listings assigned to the agent
- Hidden or inactive agents return 404 anonymously
- No internal-only agent state is exposed publicly

## Responsive/accessibility notes

- Admin tables retain horizontal overflow behavior on narrow screens.
- Forms collapse to one column on mobile.
- Public agent card uses real text alternatives and does not require a photo.
- Email/phone remain selectable links.
- Profile visibility and active-assignment status are separate concepts.

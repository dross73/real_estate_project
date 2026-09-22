# KAN-68 - Offices and Associations Mockup

This follows the existing admin shell and Juniper & Lane public profile patterns while Figma MCP remains rate-limited.

## Office directory

```
Admin Panel
┌──────────────────────────────────────────────────────────────────────┐
│ Offices                                            [Create Office]  │
│ Manage brokerage locations used by agents and listings.             │
└──────────────────────────────────────────────────────────────────────┘

Office                 Location               Public   Active   Actions
Story City Office      Story City, IA         Yes      Yes      Edit
Ames Office            Ames, IA               Yes      Yes      Edit
```

## Office create/edit

Fields:
- Office name
- Street address
- City / state / postal code
- Phone
- Email
- Optional office hours
- Active for assignment
- Publicly visible

## Assignment behavior

Agent and listing office associations are independent.

When there is exactly one active office:
- Create forms automatically select that office.
- The association can still be cleared with the "No office" option.
- No extra confirmation step is required.

When there are multiple active offices:
- Show the same optional select field.
- The user may choose any office or leave it unassigned.

Public agent profiles show the structured office details only when the office is both active and public. Public listing responses may also expose a directly assigned public office independently from the agent assignment.

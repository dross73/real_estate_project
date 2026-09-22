# KAN-66 - Admin Site Settings Mockup

Figma MCP is temporarily unavailable because the connected Starter plan reached its tool-call limit. This implementation mockup follows the existing admin-shell patterns and the approved Juniper & Lane public visual system. It is the source of truth for KAN-66 until the screen can be synced back to Figma.

## Desktop layout

```
Admin Panel
┌──────────────────────────────────────────────────────────────────────┐
│ Site Settings                                      [Save Changes]   │
│ Manage brokerage identity, public content, and site behavior.       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────── Brokerage Identity ──────────────────────────┐
│ Site / brokerage name     Descriptor                                 │
│ [Juniper & Lane       ]   [Realty                ]                  │
│                                                                      │
│ Tagline                    Logo URL                                   │
│ [A brighter tomorrow...]   [https://...          ]                  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────── Contact Information ─────────────────────────┐
│ Phone                      Email                                      │
│ [                     ]    [                         ]                │
│                                                                      │
│ Street address                                                        │
│ [                                                                  ] │
│                                                                      │
│ City                       State             Postal code              │
│ [                     ]    [              ]  [                     ]  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────── Homepage Content ────────────────────────────┐
│ Hero eyebrow                                                         │
│ [                                                                  ] │
│ Hero title                                                           │
│ [                                                                  ] │
│ Hero intro                                                           │
│ [                                                                  ] │
│ [                                                                  ] │
│                                                                      │
│ Story title                                                          │
│ [                                                                  ] │
│ Story copy                                                           │
│ [                                                                  ] │
│ [                                                                  ] │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────── Brand Settings ──────────────────────────────┐
│ Primary color              Secondary color                           │
│ [#13382b              ]    [#738c78             ]                   │
│ Keep customization intentionally limited so contrast and layout     │
│ remain consistent with the approved public design system.           │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────── Public Features ─────────────────────────────┐
│ [x] Show About page/navigation                                      │
│ [x] Show Contact page/navigation                                    │
│ [ ] Show Testimonials when testimonial feature is available         │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────── Listing Settings ────────────────────────────┐
│ Maximum listing photos                                               │
│ [20]  Must be between 1 and the hard system maximum of 50.          │
└──────────────────────────────────────────────────────────────────────┘
```

## Interaction and responsive notes

- Use the existing admin card, form, validation, spacing, and button conventions.
- Show a page-level loading state before the form is ready.
- Keep failed loads visible with a retry action.
- Show a non-blocking success message after a successful save.
- Keep field-level validation close to the affected input.
- On narrow screens, two- and three-column field groups collapse to one column.
- Optional public values fall back to Juniper & Lane defaults rather than leaving broken or blank branding.
- Logo URL is optional; text branding remains the fallback.
- Brand color fields accept six-digit hex values only.
- Feature switches affect public navigation/content visibility but do not delete routes or data.
- The photo limit is a business setting below the hard server maximum; the server remains authoritative.

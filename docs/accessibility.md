# Accessibility Launch Audit

KAN-87 is the launch-focused accessibility hardening pass for the Angular public
site and admin application.

## Target

The implementation target is WCAG 2.2 AA. This is a practical launch target, not
a claim of formal conformance or third-party certification.

The audit covers:

- keyboard access and visible focus;
- logical focus order and skip navigation;
- headings and page landmarks;
- labels, instructions, validation, alerts, and status messages;
- tables and data relationships;
- dialogs and focus containment;
- file-upload and gallery controls without drag-and-drop or mouse input;
- reduced-motion preferences;
- responsive layout and browser zoom;
- color contrast and non-color status cues.

## Automated CI checks

`npm run test:a11y` runs before the Angular unit suite in CI. The static
template audit intentionally checks a small set of high-value rules that are
stable enough to enforce without a browser extension:

- routed public page templates cannot create a second/nested `<main>` landmark;
- every data table must have a caption;
- every table header must declare `scope`;
- every image must have an `alt` or bound `[alt]`;
- every button must declare an explicit `type`;
- every ARIA dialog must declare `aria-modal="true"` and
  `aria-labelledby`.

Angular unit tests additionally cover modal semantics/Escape handling and mobile
admin navigation state.

These checks complement, rather than replace, browser and assistive-technology
testing.

## Launch hardening completed in code

The KAN-87 implementation adds or strengthens:

- one public main landmark, with a focusable skip-link destination;
- an admin skip link and focusable main-content destination;
- visible global `:focus-visible` treatment;
- reduced-motion handling for animation and transitions;
- mobile admin navigation state with `aria-controls`,
  `aria-expanded`, keyboard Escape close behavior, and removal of the closed
  mobile menu from the tab sequence;
- privacy-preference dialog labeling, modal semantics, focus trapping,
  Escape close behavior, and focus return;
- keyboard-operable photo chooser/replacement buttons as alternatives to drag
  and drop;
- upload progress/status announcements;
- captions and scoped headers for admin data tables;
- visible labels for previously placeholder-only admin search fields;
- public account form validation connected to controls with
  `aria-invalid`, `aria-describedby`, alerts, and status regions.

## Manual critical-flow checklist

Run these checks in the launch candidate after KAN-87 is green and again against
the deployed production candidate. Record browser/OS and any defects found.

### Keyboard only

- [ ] From the public homepage, press Tab: the skip link becomes visible and
      moves focus to main content.
- [ ] Tab through public header navigation, homepage search, listing filters,
      listing cards, pagination, footer, and privacy controls without a mouse.
- [ ] Open/close the mobile public menu and verify no hidden controls receive
      focus.
- [ ] Open Privacy Preferences, verify focus moves inside the dialog, Tab and
      Shift+Tab stay inside, Escape closes it, and focus returns to the opener.
- [ ] Sign in to a customer account and complete account settings, saved homes,
      saved searches, contact/showing, testimonial, password-change, and account
      closure flows using only the keyboard.
- [ ] In admin, use the skip link, mobile navigation, tables, forms, listing
      document controls, photo upload/reorder/replace/delete controls, and MFA
      screens using only the keyboard.
- [ ] Verify the closed mobile admin navigation is not reachable by Tab.

### Zoom and reflow

- [ ] At 200% browser zoom, no required control or message is clipped or hidden.
- [ ] At 400% zoom / roughly 320 CSS-pixel width, core public and admin flows
      reflow without two-dimensional scrolling except intentionally scrollable
      data tables.
- [ ] Long validation messages and status text wrap without covering controls.

### Contrast and non-color cues

- [ ] Use browser accessibility/contrast tooling to verify body text, muted text,
      links, buttons, badges, focus indicators, form borders, and error text meet
      WCAG AA contrast requirements.
- [ ] Verify Active/Pending/Sold, visibility, errors, success, and upload states
      remain understandable without relying on color alone.

### Screen-reader smoke test

Use NVDA + Firefox/Chrome on Windows or VoiceOver + Safari on macOS/iOS.

- [ ] Page title, main landmark, headings, navigation landmarks, and skip link
      are announced logically.
- [ ] Listing filters and account/admin forms announce labels, required/error
      state, hints, and submission status.
- [ ] Admin data tables announce captions, column headers, and cell values.
- [ ] Privacy dialog is announced as a modal dialog with its title and
      description.
- [ ] File upload status/progress and failures are announced.
- [ ] Listing images have useful alternative text; decorative images are silent.

## Known limits

Static checks cannot prove reading order, visual contrast, responsive reflow,
screen-reader phrasing, or real keyboard focus behavior across browsers. Those
items stay in the manual checklist and must be rechecked after deployment-level
CSS, content, analytics, maps, or third-party widgets change.

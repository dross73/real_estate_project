# Accessibility

Juniper & Lane Realty targets accessible public and admin experiences, with **WCAG 2.2 AA as an implementation goal, not a formal conformance claim**.

## Implemented patterns

- Skip navigation, semantic page landmarks, visible keyboard focus, and reduced-motion handling.
- Explicit labels and associated validation/error messaging for forms.
- Admin tables with captions and scoped column headers.
- Dialog labeling, focus containment and return, and Escape behavior.
- Keyboard-accessible photo selection/replacement and mobile admin navigation.
- Status messaging for upload and form operations.

## Automated checks

`npm run test:a11y` checks a focused set of Angular template rules: landmarks, table relationships, image alternatives, explicit button types, and modal dialog semantics. The command is part of `npm run test:ci` and GitHub Actions. Angular unit tests additionally exercise selected modal and navigation behaviors.

These checks are deliberately narrower than WCAG conformance. They do not prove contrast ratios, reflow at 200–400% zoom, assistive-technology announcements, or all keyboard journeys. Those areas require manual browser and screen-reader evaluation, especially after changes to content, maps, analytics, or shared components.

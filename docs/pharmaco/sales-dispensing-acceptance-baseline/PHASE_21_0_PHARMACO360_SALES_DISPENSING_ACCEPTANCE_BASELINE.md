# Phase 21.0 — PharmaCo360 Sales/Dispensing Acceptance Baseline

## Status

The PharmaCo360 sales/dispensing acceptance baseline has been prepared.

This phase is acceptance/evidence only.

## Completion Tracking

Overall system completion: approximately 95%.

Controlled package-generation readiness: approximately 96%.

Final package generation authorization: 0%.

## Purpose

Phase 21.0 consolidates the completed PharmaCo360 sales/dispensing work into an acceptance baseline.

The goal is to confirm what is now ready for owner review before any final package-generation discussion can happen.

This phase does not authorize package generation, deployment, migration, or production dependency installation.

## Source Baseline

This acceptance baseline is based on:

- Phase 20.4 — Sales/dispensing dashboard queue and filter improvements.
- Hotfix PR #104 — Admin dashboard login/home runtime fixes.
- Phase 20.5 — Sales/dispensing dashboard preview and responsive review evidence.
- Phase 20.6 — Manual QA findings register.
- Phase 20.7 — QA finding resolution plan.
- Phase 20.8 — Frontend UX strengthening.
- Phase 20.9 — Post-UX preview evidence.

## Accepted Working Baseline

The following areas are accepted as the current review baseline:

### 1. Login and Home Landing

- Local login credentials were reset and verified.
- Login reaches the admin dashboard home page.
- Blank page after login was fixed.
- Runtime profile rendering was stabilized.
- The login/home baseline remains part of regression review.

### 2. PharmaCo360 Command Center

- Command center runtime crash from undefined summary values was fixed.
- Dashboard renders with defensive fallback values.
- Executive operating summary remains part of the current review baseline.

### 3. Sales/Dispensing Queues

- Sales queues are available for draft, ready-to-dispense, dispensed, unpaid, partially paid, and paid states.
- Queue cards now include active state feedback.
- Queue cards include accessibility feedback through pressed state handling.
- Queue cards were strengthened for responsive layout.

### 4. Sales/Dispensing Filters

- Sale status filter is available.
- Payment status filter is available.
- Sale type filter is available.
- Branch filter is available.
- Apply and reset actions are clear.
- Existing backend API filter contract is preserved.

### 5. Selected-Sale Review

- Selected-sale details are visible.
- Payment status guidance is clearer.
- Prescription guidance is clearer.
- Dispensing readiness guidance is clearer.
- Selected-sale insight cards reduce reliance on color-only status communication.

### 6. Payment and Prescription Workflow

- Payment guidance cards are present.
- Prescription guidance cards are present.
- Unpaid, partially paid, paid, and refunded payment states have human-readable guidance.
- Prescription-required states have human-readable guidance.
- Existing payment recording flow is preserved.

### 7. Responsive Review Baseline

Required review sizes:

- 360px small mobile
- 430px mobile
- 768px tablet
- 1280px laptop
- 1440px desktop
- 1920px wide screen

Expected baseline:

- No blank page after login.
- Queue cards wrap cleanly.
- Filters remain usable.
- Selected-sale panel remains readable.
- Payment and prescription guidance cards remain readable.
- Buttons remain reachable.

## Acceptance Criteria

This baseline is considered ready for owner review when:

- Admin dashboard build passes.
- Backend tests pass in GitHub quality gate.
- Public website build passes in GitHub quality gate.
- Login lands on the dashboard home page.
- Sales/dispensing dashboard renders without runtime crash.
- Queue cards and filters are reviewable.
- Selected-sale payment, prescription, and dispensing guidance is visible.
- No backend, database, or migration changes are included in this phase.
- No package archive or checksum is generated.
- No production deployment is attempted.

## Known Critical Blockers

No known critical blockers are recorded at this baseline stage.

## Owner Review Notes

The owner should review:

- sales queue card clarity;
- filter usability;
- selected-sale detail readability;
- payment guidance clarity;
- prescription guidance clarity;
- mobile/tablet responsiveness;
- whether pharmacy staff can understand what action is required without developer assistance.

## Not Included

This phase does not include:

- new frontend implementation;
- backend controller changes;
- backend route changes;
- backend model changes;
- database migration changes;
- package archive generation;
- checksum generation;
- production deployment;
- production migration;
- production dependency installation.

## Safety Boundary

No production action is approved by this phase.

Package generation remains locked.

Final package generation authorization remains 0%.

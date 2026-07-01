# Phase 20.7 — PharmaCo360 Sales/Dispensing QA Finding Resolution Plan

## Status

The PharmaCo360 sales/dispensing QA finding resolution plan has been prepared.

This phase is planning/evidence only.

## Completion Tracking

Overall system completion: approximately 93.5%.

Controlled package-generation readiness: approximately 96%.

Final package generation authorization: 0%.

## Purpose

Phase 20.7 converts the open Phase 20.6 manual QA findings into a prioritized resolution plan before any new implementation work is added.

The goal is to keep normal development controlled, reviewable, and safe.

## Source QA Baseline

Source phase:

Phase 20.6 — PharmaCo360 Sales/Dispensing Manual QA Findings Register

Confirmed baseline:

- Login reaches the dashboard home page.
- Hotfix PR #104 is merged.
- Phase 20.5 preview/review evidence is merged.
- Phase 20.6 manual QA findings register is merged.
- No known critical blockers are recorded.
- Package generation remains locked.
- Production action remains locked.

## Open QA Findings to Resolve

| Finding ID | Area | Current Finding | Resolution Direction | Priority | Implementation Phase |
| --- | --- | --- | --- | --- | --- |
| QA-20-6-003 | Sales Queues | Queue cards need responsive visual confirmation across required screen sizes. | Strengthen layout spacing, wrapping behavior, and mobile readability if review shows weakness. | Medium | Future implementation phase |
| QA-20-6-004 | Filters | Sales filters need usability confirmation on mobile/tablet. | Improve filter grouping, action button placement, and reset/apply clarity if review shows weakness. | Medium | Future implementation phase |
| QA-20-6-005 | Selected Sale Panel | Selected-sale insight cards need review with real sale data. | Improve selected-sale information hierarchy and empty/loading states if review shows confusion. | Medium | Future implementation phase |
| QA-20-6-006 | Payment/Prescription | Payment and prescription verification states need workflow confirmation. | Make verification states more explicit and reduce reliance on color-only indicators if needed. | High | Future implementation phase |

## Proposed Resolution Sequence

### Step 1 — Responsive Sales Queue Review

Review:

- 360px small mobile
- 430px mobile
- 768px tablet
- 1280px laptop
- 1440px desktop
- 1920px wide screen

Expected outcome:

- Queue cards wrap cleanly.
- Queue text remains readable.
- No horizontal overflow appears.
- Counts and labels remain understandable.

### Step 2 — Filter Usability Review

Review:

- sale status filter;
- payment status filter;
- sale type filter;
- branch filter;
- apply filters action;
- reset filters action.

Expected outcome:

- Filters are understandable for pharmacy staff.
- Buttons are easy to reach.
- Mobile layout does not feel cramped.
- Reset action is visible but not destructive.

### Step 3 — Selected-Sale Review Panel Review

Review with sale types:

- draft sale;
- ready-to-dispense sale;
- dispensed sale;
- unpaid sale;
- partially paid sale;
- paid sale;
- prescription-related sale.

Expected outcome:

- Staff can understand the selected sale without opening developer tools.
- Payment status is clear.
- Prescription status is clear.
- Dispensing state is clear.
- Empty state is human-readable.

### Step 4 — Payment and Prescription State Review

Review:

- payment pending;
- payment partially completed;
- payment completed;
- prescription required;
- prescription verified;
- prescription missing or pending.

Expected outcome:

- Important verification states are visible.
- Risk states are not communicated by color alone.
- Pharmacy staff can decide whether a sale is safe to dispense.

## Recommended Next Implementation Focus

The next implementation phase should focus only on frontend UX strengthening unless manual review reveals backend data gaps.

Recommended implementation direction:

- Improve mobile spacing for queue cards.
- Improve filter action layout.
- Strengthen selected-sale empty/loading states.
- Add clearer status text for payment and prescription states.
- Preserve the existing API contract.
- Avoid database and migration changes.

## Acceptance Criteria for Future Implementation

Future implementation should be accepted only when:

- Admin dashboard build passes.
- Login still lands on home page.
- Sales/dispensing dashboard renders without runtime crashes.
- Queue cards are responsive at all required screen sizes.
- Filters remain usable on mobile/tablet.
- Selected-sale panel remains readable.
- Payment and prescription states are clear.
- No production action is included.
- No package generation is included.
- Owner authorization remains required for final package generation.

## Safety Boundary

This phase does not include:

- frontend implementation changes;
- backend controller changes;
- backend route changes;
- backend model changes;
- database migration changes;
- package archive generation;
- checksum generation;
- production deployment;
- production migration;
- production dependency installation.

## Production Safety

No production action is approved by this phase.

Package generation remains locked.

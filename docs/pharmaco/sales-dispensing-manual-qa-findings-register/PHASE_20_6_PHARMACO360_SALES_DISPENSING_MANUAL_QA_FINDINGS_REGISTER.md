# Phase 20.6 — PharmaCo360 Sales/Dispensing Manual QA Findings Register

## Status

The PharmaCo360 sales/dispensing manual QA findings register has been prepared.

This phase is review/evidence only.

## Completion Tracking

Overall system completion: approximately 93%.

Controlled package-generation readiness: approximately 96%.

Final package generation authorization: 0%.

## Purpose

Phase 20.6 captures real manual QA findings after the dashboard login/home-page issue was fixed and Phase 20.5 preview review evidence was merged.

The goal is to separate confirmed working areas, minor review observations, and future improvement candidates before adding more implementation changes.

## Verified Baseline

- Hotfix PR #104 fixed the admin dashboard blank page after login.
- Phase 20.5 preview/review evidence was merged.
- Login reaches the dashboard home page.
- Admin dashboard build passed.
- No production action is approved.
- Package generation remains locked.

## Manual QA Review Areas

1. Login and home landing
2. PharmaCo360 command center
3. Sales/dispensing queue cards
4. Sales/dispensing filters
5. Selected sale review panel
6. Payment and prescription verification
7. Responsive review

## Required Responsive Review Sizes

- 360px small mobile
- 430px mobile
- 768px tablet
- 1280px laptop
- 1440px desktop
- 1920px wide screen

## Findings Register

| ID | Area | Finding | Severity | Status | Recommended Action |
| --- | --- | --- | --- | --- | --- |
| QA-20-6-001 | Login/Home | Login reaches home page after hotfix #104. | None | Verified | Keep regression check in future dashboard reviews. |
| QA-20-6-002 | Command Center | Previous blank-page crash from undefined totalSales is fixed. | None | Verified | Keep defensive rendering for summary metrics. |
| QA-20-6-003 | Sales Queues | Queue cards need responsive visual confirmation across required screen sizes. | Review | Open | Capture screenshots or manual notes during preview. |
| QA-20-6-004 | Filters | Sales filters need usability confirmation on mobile/tablet. | Review | Open | Test apply/reset behavior and layout wrapping. |
| QA-20-6-005 | Selected Sale Panel | Selected-sale insight cards need review with real sale data. | Review | Open | Test draft, ready, dispensed, unpaid, partial, and paid sales. |
| QA-20-6-006 | Payment/Prescription | Payment and prescription verification states need workflow confirmation. | Review | Open | Test with sales requiring payment review and prescription review. |

## Manual QA Commands

Backend local server:

cd ~/UbuzimaPlus-Solution/backend
php artisan serve --host=127.0.0.1 --port=8000

Frontend local server:

cd ~/UbuzimaPlus-Solution
npm --prefix web/admin-dashboard run dev -- --host 127.0.0.1

Frontend production-style build:

cd ~/UbuzimaPlus-Solution
npm --prefix web/admin-dashboard run build

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

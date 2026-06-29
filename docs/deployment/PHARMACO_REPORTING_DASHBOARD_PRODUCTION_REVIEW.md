# PharmaCo360 Reporting Dashboard Production Review

This checklist prepares the reporting dashboard for safe review before any production deployment.

## Purpose

The reporting dashboard gives pharmacy operators and managers a read-only business view of:

- stock valuation
- sales and collection
- purchase orders
- customer credit risk
- supplier payables

The dashboard must help the operator understand the business without changing pharmacy records.

## Operator review notes

Before approval, the reviewer should confirm:

- the page title is understandable for a pharmacy manager
- KPI wording is business-readable, not technical
- empty states explain what action to take next
- loading state makes it clear that reports are read-only
- customer credit risk is visible without overwhelming other cards
- customer credit CSV export is easy to find
- export success notice is visible after download
- dates and period filters are clear
- the layout is usable on mobile, tablet, laptop, desktop, and wide screen

## Required preview sizes

Review these screen sizes:

- 360px small mobile
- 430px mobile
- 768px tablet
- 1280px laptop
- 1440px desktop
- 1920px wide screen

## Production approval evidence

Capture or confirm:

- local guardrail script passed
- full Phase 0 local check passed
- desktop preview checked
- tablet preview checked
- mobile preview checked
- customer credit CSV downloaded successfully
- export notice shown after download
- no data mutation happened during reporting review

## cPanel production deployment checklist

Use GitHub as the source of truth and cPanel as the runtime.

Before deployment:

- confirm main branch is validated and pushed
- confirm no migration is required for this phase
- confirm no .env change is required for this phase
- confirm admin dashboard build passed
- confirm public website build passed
- confirm backend tests passed
- confirm the reporting dashboard QA guide is updated

During deployment:

- pull the approved main branch only
- build frontend assets if cPanel deployment requires it
- do not run destructive database commands
- do not run migrate:fresh on production
- clear and rebuild safe Laravel caches only when needed
- verify document root still points to public
- verify storage link and permissions if touched by deployment

After deployment:

- open health endpoint
- log in with a tenant admin account
- open reporting dashboard
- refresh reports
- download customer credit CSV
- confirm export notice is visible
- check application logs
- remove temporary public test files if any were used

## Rollback note

Because this phase is documentation and checklist focused, rollback should only require reverting the documentation/checklist commit if needed.

## Release handover evidence

Phase 13.5 requires the release note and stakeholder handover summary to be available before production approval.

Required documents:

- docs/releases/PHARMACO_REPORTING_DASHBOARD_RELEASE_NOTE.md
- docs/handover/PHARMACO_REPORTING_DASHBOARD_HANDOVER.md

Required validation:

- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/pharmaco-reporting-production-review-check.sh
- ./scripts/pharmaco-reporting-release-check.sh
- ./scripts/phase0-check.sh


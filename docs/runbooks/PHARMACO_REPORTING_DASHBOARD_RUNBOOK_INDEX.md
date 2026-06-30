# PharmaCo360 Reporting Dashboard Runbook Index

## Purpose

This runbook index closes the reporting dashboard release package by connecting the operating notes, QA guide, production checklist, release note, and handover summary.

The reporting dashboard remains a read-only business view for pharmacy operators and managers.

## Documentation map

Use these documents together:

- docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md
- docs/qa/PHARMACO_REPORTING_DASHBOARD_QA.md
- docs/deployment/PHARMACO_REPORTING_DASHBOARD_PRODUCTION_REVIEW.md
- docs/releases/PHARMACO_REPORTING_DASHBOARD_RELEASE_NOTE.md
- docs/handover/PHARMACO_REPORTING_DASHBOARD_HANDOVER.md
- docs/runbooks/PHARMACO_REPORTING_DASHBOARD_RUNBOOK_INDEX.md

## Validation scripts

Use these local scripts before release closure:

- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/pharmaco-reporting-production-review-check.sh
- ./scripts/pharmaco-reporting-release-check.sh
- ./scripts/pharmaco-reporting-release-closure-check.sh
- ./scripts/phase0-check.sh

## Release closure checklist

Before closing the reporting dashboard release, confirm:

- main branch is the source of truth
- development branch is fast-forwarded from main
- reporting UI guardrail check passed
- production review checklist check passed
- release handover check passed
- release closure check passed
- full Phase 0 local check passed
- backend tests passed
- public website build passed
- admin dashboard build passed
- no production migration is required for this phase
- no .env change is required for this phase
- no destructive database command is required
- customer credit CSV download remains available
- reporting dashboard review remains read-only
- mobile, tablet, desktop, and wide-screen preview notes are available

## Production readiness statement

This release package is ready for production review when all scripts pass and the operator, QA, deployment, and handover documents are available.

## Closure decision

Close the reporting dashboard release only after:

1. development and main are aligned
2. all validation scripts pass
3. the deployment reviewer confirms cPanel will use GitHub main as the source of truth
4. the operator confirms the dashboard wording and flow are understandable
5. no unresolved reporting dashboard blocker remains

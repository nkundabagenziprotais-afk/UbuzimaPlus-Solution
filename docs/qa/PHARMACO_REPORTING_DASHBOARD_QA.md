# PharmaCo360 Reporting Dashboard QA Guide

This guide protects the reporting dashboard from becoming generic, confusing, or risky during future UI improvements.

Scope:
- stock valuation
- sales and collection
- purchase orders
- customer credit risk
- supplier payables

QA guardrails:
- figures remain read-only
- tenant context is required before report loading
- refresh is disabled when tenant context is missing
- customer credit CSV export is disabled when tenant context is missing
- loading state explains that pharmacy records are not changed
- empty states explain what the user should do next
- customer credit CSV still uses the existing export endpoint
- no backend, API, migration, auth, or dependency changes are hidden inside UI polish work

Manual preview checklist:
- 360px: filters, loading state, and empty messages do not overflow
- 430px: Customer credit risk card and CSV action remain tappable
- 768px: reporting cards remain balanced in tablet layout
- 1280px: KPI labels and card summaries feel executive-ready
- 1440px: report cards have enough spacing without looking empty
- 1920px: dashboard remains readable and not stretched

Functional checks:
1. Open the admin dashboard.
2. Navigate to the reporting dashboard.
3. Confirm the heading says Business reporting.
4. Confirm the title says PharmaCo360 operating view.
5. Refresh reports with a valid tenant context.
6. Confirm loading state appears briefly.
7. Confirm stock, sales, procurement, credit, and payables cards still render.
8. Download the customer credit CSV.
9. Confirm the export notice is visible after download.
10. Confirm no sale, payment, stock, supplier, or receivable data is changed.

Local validation:
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

## Operator production review

Phase 13.4 adds an operator-facing production review checklist.

Before production approval, confirm:

- reporting dashboard language feels natural for a pharmacy operator
- figures remain read-only
- customer credit CSV download remains available after reports load
- no reporting review step mutates pharmacy records
- cPanel deployment uses GitHub main as the source of truth
- no destructive production database command is required

## Release handover summary

Phase 13.5 adds release and stakeholder handover documentation.

Before closing the reporting dashboard release, confirm:

- release note is available
- handover summary is available
- QA scripts pass
- production checklist passes
- Phase 0 local check passes
- preview evidence is collected for the required screen sizes

## Release closure QA

Phase 13.6 adds the final release closure QA requirement.

QA closure requires:

- reporting UI guardrail check passed
- production review checklist check passed
- release handover check passed
- release closure check passed
- full Phase 0 local check passed


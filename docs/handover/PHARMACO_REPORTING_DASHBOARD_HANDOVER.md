# PharmaCo360 Reporting Dashboard Handover Summary

## Audience

This handover is for product owners, pharmacy operators, QA reviewers, deployment reviewers, and future developers.

## Dashboard purpose

The reporting dashboard gives a read-only operating view for PharmaCo360.

It helps users understand stock, sales, procurement, customer credit, and supplier payables without changing pharmacy records.

## Key user flows

1. Open the admin dashboard.
2. Navigate to Business reporting.
3. Review the PharmaCo360 operating view.
4. Select or confirm the reporting period.
5. Refresh reports.
6. Review stock valuation, sales and collection, purchase orders, customer credit risk, and supplier payables.
7. Download the customer credit CSV when needed.
8. Confirm the export notice appears after download.

## Operator acceptance checklist

Before handover is accepted, confirm:

- wording feels natural for pharmacy operators
- KPI labels are business-readable
- empty states explain what to do next
- loading state confirms reports are read-only
- customer credit risk is easy to find
- CSV export is easy to use
- dashboard works on 360px, 430px, 768px, 1280px, 1440px, and 1920px screens

## QA handover checklist

QA should run:

- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/pharmaco-reporting-production-review-check.sh
- ./scripts/pharmaco-reporting-release-check.sh
- ./scripts/phase0-check.sh

QA should also manually verify tenant-safe access and confirm no reporting action mutates stock, sales, receivables, payments, suppliers, or invoices.

## Deployment handover checklist

Deployment reviewer should confirm:

- GitHub main is the source of truth
- cPanel is treated as runtime only
- no migrate:fresh command is used on production
- no migration is required for this phase
- no .env change is required for this phase
- frontend builds are validated
- health endpoint is checked after deployment
- logs are checked after deployment

## Future improvement notes

Possible future phases may include:

- printable reporting summary
- scheduled reporting export
- role-specific report visibility
- branch-level reporting filters
- date-range presets
- audit trail for report exports

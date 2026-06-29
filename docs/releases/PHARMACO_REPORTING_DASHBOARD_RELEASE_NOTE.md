# PharmaCo360 Reporting Dashboard Release Note

## Release purpose

This release improves the PharmaCo360 reporting dashboard so pharmacy operators, managers, and reviewers can understand business performance with more confidence.

The dashboard remains read-only and tenant-safe.

## What changed

The reporting dashboard now has:

- clearer business wording
- improved report card summaries
- better loading guidance
- better empty-state guidance
- customer credit exposure visibility
- customer credit aging buckets
- customer credit CSV download
- export success notice
- responsive review checklist
- local QA guardrail script
- production review checklist

## Business value

This release helps pharmacy teams review:

- stock value at cost
- estimated sale value
- sales generated
- purchase order value
- customer credit risk
- supplier payable exposure

The release makes the dashboard easier to explain to non-technical users and safer to review before production deployment.

## Safety notes

This release does not introduce:

- new database migrations
- destructive commands
- new dependencies
- authentication changes
- permission changes
- production data mutation

Reporting review must remain read-only.

## Validation evidence

Required validation before production approval:

- reporting UI guardrail check passed
- production review checklist passed
- full Phase 0 local check passed
- backend tests passed
- public website build passed
- admin dashboard build passed
- mobile preview checked
- tablet preview checked
- desktop preview checked
- customer credit CSV downloaded successfully

## Release readiness

The dashboard can be considered release-ready when the operator review, QA guide, production checklist, and local validation evidence are complete.

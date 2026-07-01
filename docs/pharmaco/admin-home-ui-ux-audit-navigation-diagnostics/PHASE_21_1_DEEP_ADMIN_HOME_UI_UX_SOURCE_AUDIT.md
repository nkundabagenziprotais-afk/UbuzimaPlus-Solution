# Phase 21.1 Deep Admin Home UI/UX Source Audit

This audit is generated from the actual Admin Dashboard source files and is used to guide the Phase 21.1 UX corrections.

## Component Files Reviewed

- `web/admin-dashboard/src/App.tsx`
  - className references: 114
  - forms: 1
  - tables: 1
  - buttons: 12
  - inputs/selects/textareas: 2
- `web/admin-dashboard/src/components/PayablesWorkflow.tsx`
  - className references: 33
  - forms: 0
  - tables: 0
  - buttons: 5
  - inputs/selects/textareas: 17
- `web/admin-dashboard/src/components/ProcurementWorkflow.tsx`
  - className references: 38
  - forms: 0
  - tables: 0
  - buttons: 9
  - inputs/selects/textareas: 22
- `web/admin-dashboard/src/components/ReceivablesWorkflow.tsx`
  - className references: 21
  - forms: 3
  - tables: 1
  - buttons: 5
  - inputs/selects/textareas: 12
- `web/admin-dashboard/src/components/ReportingDashboard.tsx`
  - className references: 48
  - forms: 0
  - tables: 0
  - buttons: 2
  - inputs/selects/textareas: 2
- `web/admin-dashboard/src/components/SalesDispensingReview.tsx`
  - className references: 71
  - forms: 0
  - tables: 0
  - buttons: 12
  - inputs/selects/textareas: 10
- `web/admin-dashboard/src/components/PharmacoOperationsCommandCenter.tsx`
  - className references: 29
  - forms: 0
  - tables: 0
  - buttons: 1
  - inputs/selects/textareas: 0
- `web/admin-dashboard/src/components/ProductInventoryPreview.tsx`
  - className references: 22
  - forms: 0
  - tables: 0
  - buttons: 1
  - inputs/selects/textareas: 0
- `web/admin-dashboard/src/components/ProductInventoryActions.tsx`
  - className references: 19
  - forms: 3
  - tables: 0
  - buttons: 4
  - inputs/selects/textareas: 29
- `web/admin-dashboard/src/components/PharmaCoreEditor.tsx`
  - className references: 10
  - forms: 2
  - tables: 0
  - buttons: 4
  - inputs/selects/textareas: 10

## Audit Corrections Applied

- Tenant-aware Main Website routing was added.
- Supplier Payables received page-level alignment, form-grid, list, queue, and table protections.
- Dense finance workflows received overflow-safe table/list presentation rules.
- Admin module pages received consistent panel spacing, form control width, and card fit rules.
- The fixed top action area was separated from the scrollable workspace region.
- Overview card columns remain capped at four on large screens.
- Left menu category titles remain compact with icons and no summary noise.

## Website Routing Rule

- Vita Pharma users are routed to `https://www.vitapharmaafrica.com`.
- Ubuzima Plus/default users are routed to `https://www.ubuzimaplus.com`.

## Safety Boundary

- Frontend-only UI/UX changes.
- No backend route changes.
- No model changes.
- No database migrations.
- No package generation.
- No production deployment.

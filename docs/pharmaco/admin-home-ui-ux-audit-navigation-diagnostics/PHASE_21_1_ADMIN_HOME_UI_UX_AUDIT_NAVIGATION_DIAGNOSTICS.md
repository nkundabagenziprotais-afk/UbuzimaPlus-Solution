# Phase 21.1 — Admin Home UI/UX Audit and Navigation Diagnostics

## Status

The Admin Home UI/UX audit and navigation diagnostics phase has been prepared.

This phase addresses the Admin Home page before owner review resumes.

## Root Cause

The left sidebar menu rendered static anchor items. Only Overview appeared active, and Sign out worked because Sign out had a real button handler.

The admin modules already existed, but the sidebar did not navigate to them.

## Areas Audited

- Admin Home sidebar navigation.
- PharmaCo360 command center.
- PharmaCo360 operating view.
- Invoice and accounts payable workflow.
- Stock valuation.
- Sales and collection.
- Supplier invoice from purchase order.
- Supplier invoices.
- Purchase orders.
- Customer credit risk.
- Create payables.
- Customer Credit & Receivables.
- Inventory sections.
- Access and security checks.
- Tenant assignments.
- Responsive layout behavior.

## Fixes Included

- Replaced static sidebar anchors with working button navigation.
- Added section-aware active navigation state.
- Added accessible active section feedback.
- Added lightweight text icons for the left menu without adding a new package.
- Added scroll targets for Admin Home sections.
- Added an orientation strip that explains the active section.
- Added layout wrappers for large modules.
- Improved compatibility for reporting, payables, receivables, sales, and command center sections.
- Added horizontal overflow protection for dense operational tables.
- Added mobile and tablet responsive adjustments.

## Safety Boundary

This phase includes frontend Admin Dashboard changes only.

This phase does not include:

- backend controller changes;
- backend route changes;
- backend model changes;
- database migration changes;
- package archive generation;
- checksum generation;
- production deployment;
- production migration;
- production dependency installation.

Package generation remains locked.

Final package generation authorization remains 0%.


## UX Refinement After Owner Feedback

Additional owner feedback was applied before PR submission.

### Feedback Addressed

- Restored the original Admin Home menu areas that appeared removed.
- Changed the Admin Home behavior so only the selected section is visible.
- Removed automatic scroll-to-section behavior from menu clicks.
- Preserved active section selection during the browser session.
- Kept hidden module sections mounted so users do not lose in-progress form state simply by switching menu sections.
- Added a Back quick action.
- Added a Main Website quick action.
- Added a Company Email quick action.
- Kept the Overview section focused on relevant profile, scope, role, permission, and access summary information.
- Added practical placeholder views for Solutions, Modules, AI Center, Audit Logs, and Settings without creating unsupported backend assumptions.

### Updated Interaction Principle

The Admin Home now behaves like a controlled workspace:

- the left menu changes the visible section;
- menu clicks do not refresh the page;
- menu clicks do not force the page back to the top;
- operational modules remain mounted while hidden to preserve local user work;
- production and package-generation boundaries remain locked.


## Additional UX Refinement — Folded Navigation and Independent Scroll

The Admin Home refinement now includes:

- independent scrolling for the left menu;
- independent scrolling for the main workspace;
- folded tree-style menu groups;
- exclusion of unavailable modules such as ERP;
- grouping of real modules under practical categories;
- a clearer Modules directory;
- a Supplier Payables workspace guide before the multi-form payables component;
- preservation of selected-section behavior.

### Navigation Groups

The left menu is organized into:

- Platform workspace;
- PharmaCo360 operations;
- Sales and stock;
- Finance workflows;
- Governance.

### UX Principle

Only real modules are shown. Unimplemented modules are not exposed as clickable items because that creates user confusion and weakens trust.

Large workflow pages with several actions should either:

- provide a clear action map before the forms; or
- be split into child pages in a later implementation phase if the workflow remains too dense after review.


## Permanent UX Refinement — Sticky Action Bar and Commercial Interface

Owner feedback was applied on top of the working Admin Home state.

### Refinements Added

- Sticky top action bar with Back, Customer Website, Company Email, and signed-in user context.
- Wider left menu to improve title fitting.
- Left menu summaries hidden to reduce visual noise.
- Folded tree navigation retained for efficiency.
- Commercial-grade transparent card styling added across dashboard cards.
- Customer-facing website access added in the top action bar and Overview card.
- Independent sidebar and main workspace scrolling retained.

### Customer Website Integration

The dashboard now exposes a direct customer-facing website link. The link is environment-configurable through `VITE_PUBLIC_WEBSITE_URL` and defaults to the owner-provided reference website when no environment value is available.

### Design Direction

The visual direction is cleaner, more commercial, and more suitable for a banking/pharmacy operations interface, using calm cards, stronger spacing, transparent surfaces, and clearer action positioning.


## Deep UI/UX Audit Refinement

The following details were corrected after owner review:

- The top action bar is fixed outside the workspace scroll region.
- The main workspace now has its own scrollable content area below the fixed action bar.
- Welcome-back heading size was reduced for better fit.
- Summary cards are constrained to a maximum of four columns.
- Sidebar width was increased and menu title fitting improved.
- Sidebar descriptions are hidden so the menu stays clean and scannable.
- Category icons were strengthened for the folded tree menu.
- Supplier Payables action guidance was changed from loose cards to a proper table.
- Supplier Payables layout received overflow and alignment protections for dense finance content.

### UI/UX Standard Applied

Small alignment, spacing, overflow, typography, and scroll-behavior details are treated as core product quality items, not decoration.


## Corrective Deep UI/UX Audit

A corrective audit was added after owner feedback that the previous refinement did not sufficiently affect the actual workflow pages.

### Corrected Items

- Main Website routing is now tenant-aware.
- Ubuzima Plus/default users route to the Ubuzima+ website.
- Vita Pharma users route to the Vita Pharma website.
- Supplier Payables received actual workflow-level layout, list, form, table, and overflow corrections.
- Procurement, Receivables, Sales & Dispensing, Reporting, Inventory, and Pharma Core received shared workflow fit protections.
- The top action area is separated from the scrollable workspace using a fixed shell layout.
- The audit now includes a source-level component review document generated from real admin-dashboard files.

### Owner UX Standard

Minor-looking details are treated as product-quality requirements: alignment, overflow, table readability, form spacing, menu scanability, tenant-aware links, and commercial interface polish are all part of the acceptance standard.


## Supplier Payables Source Refactor

Owner feedback identified that the previous deep-audit pass did not materially change the actual Supplier Payables workflow.

### Actual Source Changes

`PayablesWorkflow.tsx` was refactored from one dense demonstration page into child workspaces:

- Overview
- Create payable
- Supplier invoices
- Approval queue
- Record payment

### UX Correction

The old "Invoice and accounts payable workflow" presentation placed too many unrelated actions on the same page. The corrected structure separates finance tasks so users can focus on one job at a time.

### Acceptance Notes

- Supplier invoice creation is separated from approval.
- Supplier invoice register is table-based.
- Draft invoice approval has its own queue.
- Payment recording has its own workspace.
- Payment history is table-based.
- Form state remains in the component, so switching child workspaces does not require page refresh.


## Supplier Payables KPI Readability Correction

Owner review identified that the Payables KPI cards visually read as compressed or duplicated text.

### Correction Applied

- Checked for duplicate Payables KPI grid rendering.
- Kept only one Payables KPI grid if duplication was present.
- Added stronger KPI spacing, line-height, and card layout controls.
- Constrained Payables KPI cards to a clean responsive grid.


## Operating View Credit-Risk Readability Refinement

Owner review identified compressed finance text in the Operating View customer credit risk section.

### Corrections Applied

- Credit-risk metric rows now separate label and value clearly.
- Aging buckets now render as a table-like ladder.
- Amounts use tabular/numeric alignment for easier finance review.
- Row spacing, borders, hover state, and overflow handling were improved.
- Mobile behavior keeps the section readable without horizontal page overflow.

### Example Issue Addressed

Before refinement, rows could visually read as compressed text such as:

`Credit limit enabledRF 0`

The refined UI separates:

- label;
- amount;
- count/status context.


## Inventory Source-Level UI/UX Refinement

Owner review identified that Inventory still needed deeper alignment before commit.

### Actual Source Changes

- Product master preview was changed into a table-based register.
- Inventory actions were separated into child workspaces:
  - Product master / Create product
  - Product settings / Update product
  - Stock receiving / Receive stock
- The dense three-form inventory action grid was replaced by focused child navigation.
- Stock receiving is now visually separated from product setup and product updates.
- Inventory KPI readability was strengthened and capped responsively.

### UX Correction

Inventory should not force product creation, product update, and stock receiving into the same visual area. These are different user tasks and should be reviewed as separate workspaces.

# PharmaCo360 Sales and Dispensing Foundation

## Phase 4.1 scope

Phase 4.1 introduces the sales and dispensing data foundation for PharmaCo360.

It creates the structures needed for future controlled pharmacy transactions, but it does not deduct stock yet.

## Data structures

Phase 4.1 adds:

- `pharmaco_customers`
- `pharmaco_prescriptions`
- `pharmaco_sales`
- `pharmaco_sale_items`
- `pharmaco_payments`

## Foundation behaviour

The seeded VitaPharma draft sale links:

- tenant
- branch
- customer/patient
- prescription
- sale items
- product snapshots
- payment status

## Stock safety

Phase 4.1 intentionally does not deduct stock.

Stock deduction must happen only through a later controlled dispensing workflow that writes to the `stock_movements` ledger.

## Seeded review data

The seed data includes:

- demo patient/customer
- demo prescription
- draft prescription sale
- two sale items
- no payment
- no stock movement deduction

## Next phase

Phase 4.2 should introduce tenant-scoped sales read APIs.

Phase 4.3 should introduce controlled sale confirmation/dispensing, where stock deduction happens through the movement ledger.


## Phase 4.2 sales and dispensing read APIs

Phase 4.2 adds tenant-scoped read APIs for sales and dispensing review.

### Endpoints

- `GET /api/v1/pharmaco/customers`
- `GET /api/v1/pharmaco/prescriptions`
- `GET /api/v1/pharmaco/sales`
- `GET /api/v1/pharmaco/sales/{sale}`

### Access controls

All sales read endpoints require:

- authenticated Sanctum token
- `X-Tenant-Slug`
- `pharmaco.sales.manage` permission
- active `pharmaco.sales` module for the tenant

### Safety

These endpoints are read-only. They do not confirm sales, deduct stock, create payments or write movement ledger entries.


## Phase 4.3 controlled sale confirmation and dispensing

Phase 4.3 introduces the first controlled sales mutation workflow.

### Endpoint

- `POST /api/v1/pharmaco/sales/{sale}/confirm`

### Behaviour

The confirmation workflow:

- validates tenant context
- validates sale ownership
- confirms only draft sales
- requires every sale item to be assigned to a stock batch
- validates selected batch belongs to the same tenant, product and branch
- verifies prescription-required items before dispensing
- deducts stock from `stock_batches.quantity_on_hand`
- writes `sale_dispensed` stock movement records
- marks sale items as `dispensed`
- marks the sale as `dispensed`
- records a `pharmaco.sale.dispensed` audit log
- prevents double confirmation and double stock deduction

### Safety

This workflow is intentionally strict. It does not allow partial confirmation, cross-tenant dispensing, cross-branch dispensing or confirmation without batch assignment.


## Phase 4.4 dashboard sales and dispensing review panel

Phase 4.4 adds a read-only dashboard review panel for the sales and dispensing workflow.

### Dashboard scope

The dashboard can review:

- customers / patients
- prescriptions
- sales list
- selected sale detail
- sale item prescription status
- batch/location assignment status
- confirmation readiness

### Safety

The panel is intentionally read-only. It does not call the sale confirmation endpoint and does not deduct stock.

Controlled dashboard confirmation should be added later after visual review.


## Phase 4.5 dashboard-controlled sale confirmation

Phase 4.5 exposes the controlled confirmation workflow in the dashboard.

### Dashboard behaviour

The dashboard now allows an authorized user to:

- review a draft sale
- select an eligible stock batch for each sale item
- verify prescription-required sale items
- confirm and dispense stock
- see the sale status update after confirmation

### Safety

The dashboard does not bypass backend controls.

The backend still enforces:

- authenticated access
- `X-Tenant-Slug`
- `pharmaco.sales.manage`
- active `pharmaco.sales`
- sale tenant ownership
- draft-only confirmation
- prescription verification
- batch/product/branch matching
- stock availability
- double-confirmation prevention
- `sale_dispensed` stock movement logging
- `pharmaco.sale.dispensed` audit logging


## Phase 5.1 payment recording and receipt foundation

Phase 5.1 introduces controlled payment recording for dispensed PharmaCo360 sales.

### Endpoint

- `POST /api/v1/pharmaco/sales/{sale}/payments`

### Supported payment methods

- `cash`
- `momo`
- `card`
- `insurance`
- `credit`
- `bank_transfer`

### Behaviour

The payment workflow:

- validates tenant context
- validates sale ownership
- rejects payment on draft sales
- rejects payment on cancelled or voided sales
- rejects overpayment
- generates a tenant-scoped receipt number
- records a completed payment
- updates sale `paid_amount`
- updates sale `balance_amount`
- updates sale `payment_status` to `partially_paid` or `paid`
- records `pharmaco.payment.recorded` audit logs

### Safety

Payments do not bypass dispensing controls. A sale must already be confirmed and dispensed before payment can be recorded in this foundation step.


## Phase 5.2 dashboard payment recording panel

Phase 5.2 adds dashboard payment recording for dispensed PharmaCo360 sales.

### Dashboard behaviour

The dashboard can now:

- display sale paid amount, balance and payment status
- prevent payment recording on draft sales
- enter a payment amount
- select a payment method
- capture payment reference number
- capture payment notes
- submit payment to the backend
- display generated receipt number
- refresh sale payment status and balance
- show sale payment history

### Safety

The dashboard does not calculate final payment state independently. The backend remains the source of truth for receipt generation, balance calculation, payment status, overpayment protection, tenant boundary checks and audit logging.


## Phase 6.1 customer, prescription and draft sale creation APIs

Phase 6.1 introduces the backend creation workflow that starts the PharmaCo360 operating cycle.

### Endpoints

- `POST /api/v1/pharmaco/customers`
- `POST /api/v1/pharmaco/prescriptions`
- `POST /api/v1/pharmaco/sales`

### Behaviour

The creation workflow supports:

- creating tenant-scoped customers / patients
- generating prescription numbers where not provided
- creating tenant-scoped prescriptions
- creating draft sales
- linking sales to a branch, customer and prescription
- adding sale line items
- calculating line totals
- calculating sale subtotal, discount, tax, total and balance
- setting new sales to `draft`
- setting initial payment status to `unpaid`

### Safety

The backend enforces:

- authenticated access
- `X-Tenant-Slug`
- active `pharmaco.sales`
- `pharmaco.sales.manage`
- tenant ownership of customers, prescriptions, branches and products
- active branch and customer checks
- active product checks
- prescription requirement for prescription-controlled products
- audit logs for customer, prescription and sale creation

### Audit actions

- `pharmaco.customer.created`
- `pharmaco.prescription.created`
- `pharmaco.sale.created`


## Phase 6.2 dashboard creation workflow

Phase 6.2 adds a dashboard workflow for creating the beginning of a PharmaCo360 transaction.

### Dashboard behaviour

The dashboard can now:

- create a tenant-scoped customer / patient
- create a prescription
- create a draft sale
- select branch, customer and prescription
- add draft sale line items
- select products
- enter quantity, unit price, discount and tax
- preview draft sale total
- submit to the backend creation APIs
- select the newly created draft sale for dispensing review

### Safety

The dashboard does not bypass backend rules. The backend remains responsible for tenant boundaries, branch ownership, product ownership, active product validation, prescription-required product validation, total calculation and audit logging.


## Phase 7.1 supplier and purchase order backend foundation

Phase 7.1 introduces the upstream procurement foundation for PharmaCo360.

### Tables

- `pharmaco_suppliers`
- `pharmaco_purchase_orders`
- `pharmaco_purchase_order_items`

### Endpoints

- `POST /api/v1/pharmaco/suppliers`
- `GET /api/v1/pharmaco/suppliers`
- `POST /api/v1/pharmaco/purchase-orders`
- `GET /api/v1/pharmaco/purchase-orders`
- `GET /api/v1/pharmaco/purchase-orders/{purchaseOrder}`

### Supplier categories

- wholesaler
- manufacturer
- distributor
- importer
- other

### Behaviour

The procurement foundation supports:

- creating tenant-scoped suppliers
- listing suppliers
- creating draft purchase orders
- linking purchase orders to supplier and branch
- adding purchase order line items
- calculating line totals and purchase order totals
- listing purchase orders
- reading purchase order detail

### Safety

The backend enforces:

- authenticated access
- `X-Tenant-Slug`
- active `pharmaco.suppliers`
- `pharmaco.suppliers.manage`
- tenant ownership of suppliers, products and branches
- active supplier validation
- active branch validation
- active product validation
- duplicate supplier code protection
- duplicate purchase order number protection
- audit logs for supplier and purchase order creation

### Audit actions

- `pharmaco.supplier.created`
- `pharmaco.purchase_order.created`

### Phase boundary

This phase does not yet receive stock against purchase orders. Purchase-order-linked stock receiving will be handled in Phase 7.2.


## Phase 7.2 purchase-order-linked stock receiving

Phase 7.2 connects the existing stock receiving API to the procurement foundation.

### Updated endpoint

- `POST /api/v1/pharmaco/inventory/receive`

The endpoint still supports manual receiving. It now also accepts:

- `pharmaco_purchase_order_item_id`

### Behaviour

When a purchase order item is supplied, the backend:

- validates that the purchase order item belongs to the current tenant
- validates that the received product matches the purchase order item product
- validates that the stock location belongs to the purchase order branch
- rejects quantities above the remaining ordered quantity
- creates or updates the stock batch
- creates a `stock_received` movement
- links the movement to the purchase order through `reference_type = pharmaco_purchase_order`
- updates the purchase order item received quantity
- marks the item as `partially_received` or `received`
- marks the purchase order as `partially_received` or `received`
- records `pharmaco.purchase_order.stock_received`

### Manual receiving compatibility

Manual receiving remains available without `pharmaco_purchase_order_item_id` and continues to record:

- `reference_type = stock_receipt`
- `pharmaco.stock.received`


## Phase 8.1 procurement dashboard workflow

Phase 8.1 exposes the procurement backend in the admin dashboard.

### Dashboard capabilities

- load supplier, branch, product, location and purchase-order data
- create suppliers
- list active suppliers
- create draft purchase orders
- build purchase order line items
- preview purchase order totals
- list purchase orders
- open purchase order detail
- receive stock against a purchase order item
- preserve manual receiving through the existing inventory action panel

### API helpers

The dashboard now includes typed client helpers for:

- `GET /api/v1/pharmaco/suppliers`
- `POST /api/v1/pharmaco/suppliers`
- `GET /api/v1/pharmaco/purchase-orders`
- `GET /api/v1/pharmaco/purchase-orders/{purchaseOrder}`
- `POST /api/v1/pharmaco/purchase-orders`
- `POST /api/v1/pharmaco/inventory/receive` with `pharmaco_purchase_order_item_id`

### Safety

The dashboard remains a client only. Backend validation still owns tenant boundaries, product ownership, supplier ownership, branch/location rules, over-receipt protection and audit logging.


## Phase 8.2 procurement polish and approval controls

Phase 8.2 adds approval and cancellation controls to the procurement foundation.

### Backend additions

- `PATCH /api/v1/pharmaco/suppliers/{supplier}`
- `POST /api/v1/pharmaco/purchase-orders/{purchaseOrder}/approve`
- `POST /api/v1/pharmaco/purchase-orders/{purchaseOrder}/cancel`

### Dashboard additions

- supplier row selection
- purchase order approval action
- purchase order cancellation action
- cancellation reason field
- status-aware action disabling

### Audit actions

- `pharmaco.supplier.updated`
- `pharmaco.purchase_order.approved`
- `pharmaco.purchase_order.cancelled`

### Safety

The backend prevents:

- duplicate supplier codes inside the same tenant
- supplier updates across tenant boundaries
- approval of non-draft purchase orders
- cancellation of received purchase orders
- cancellation of purchase orders with received quantities
- cross-tenant approval/cancellation


## Phase 9.1 supplier invoice and accounts payable foundation

Phase 9.1 adds supplier invoice and payable tracking after procurement.

### Backend tables

- `pharmaco_supplier_invoices`
- `pharmaco_supplier_invoice_items`
- `pharmaco_supplier_payments`

### API endpoints

- `GET /api/v1/pharmaco/supplier-invoices`
- `POST /api/v1/pharmaco/supplier-invoices`
- `GET /api/v1/pharmaco/supplier-invoices/{supplierInvoice}`
- `POST /api/v1/pharmaco/supplier-invoices/{supplierInvoice}/approve`
- `POST /api/v1/pharmaco/supplier-invoices/{supplierInvoice}/payments`

### Workflow

- supplier invoices can be created manually or from approved/received purchase orders
- invoice items can reference purchase order items
- invoices start as `draft`
- draft invoices can be approved
- supplier payments can be recorded only after approval
- invoice balances are updated after each payment
- invoices move to `partially_paid` or `paid`

### Audit actions

- `pharmaco.supplier_invoice.created`
- `pharmaco.supplier_invoice.approved`
- `pharmaco.supplier_payment.recorded`

### Safety

The backend protects tenant boundaries, supplier/PO matching, duplicate invoice numbers, invoice approval state, overpayment, and cross-tenant access.


## Phase 9.2 supplier invoice and payables dashboard workflow

Phase 9.2 adds the dashboard workflow for supplier invoices and accounts payable management.

### Dashboard additions

- supplier invoice list
- create supplier invoice from approved purchase order
- invoice item builder populated from purchase order items
- payable balance cards
- AP aging indicator for overdue invoices
- supplier invoice detail panel
- supplier invoice approval action
- supplier payment recording form
- supplier payment history

### API usage

The dashboard consumes the Phase 9.1 backend endpoints:

- `GET /api/v1/pharmaco/supplier-invoices`
- `POST /api/v1/pharmaco/supplier-invoices`
- `GET /api/v1/pharmaco/supplier-invoices/{supplierInvoice}`
- `POST /api/v1/pharmaco/supplier-invoices/{supplierInvoice}/approve`
- `POST /api/v1/pharmaco/supplier-invoices/{supplierInvoice}/payments`

### Safety

The dashboard keeps the backend as the source of truth for tenant boundaries, supplier/PO matching, invoice state transitions, and overpayment protection.


## Phase 10.1 reporting and analytics foundation

Phase 10.1 adds tenant-safe reporting APIs for operational analytics.

### API endpoints

- `GET /api/v1/pharmaco/reports/overview`
- `GET /api/v1/pharmaco/reports/inventory-valuation`
- `GET /api/v1/pharmaco/reports/sales-summary`
- `GET /api/v1/pharmaco/reports/procurement-summary`
- `GET /api/v1/pharmaco/reports/payables-summary`

### Reports

- inventory valuation report
- sales summary report
- procurement summary report
- supplier payable summary
- combined reporting overview

### Filters

The time-based reports support:

- `start_date`
- `end_date`

### Safety

The reporting endpoints reuse existing Sanctum authentication, tenant headers, tenant module middleware, and existing module permissions.
No new RBAC seed changes are required in this phase.


## Phase 10.2 reporting dashboard workflow

Phase 10.2 adds the frontend reporting dashboard for the Phase 10.1 reporting APIs.

### Dashboard additions

- reporting date filter bar
- operational KPI cards
- inventory valuation cards and location table
- sales summary cards and payment method table
- procurement summary cards and status table
- supplier payables cards and invoice status table

### API usage

The dashboard consumes:

- `GET /api/v1/pharmaco/reports/overview`
- `GET /api/v1/pharmaco/reports/inventory-valuation`
- `GET /api/v1/pharmaco/reports/sales-summary`
- `GET /api/v1/pharmaco/reports/procurement-summary`
- `GET /api/v1/pharmaco/reports/payables-summary`

### Safety

The dashboard does not calculate tenant boundaries locally.
It relies on the backend reporting APIs, Sanctum authentication, tenant headers, and existing module permissions.


## Phase 11.1 customer credit and receivables foundation

Phase 11.1 adds the customer-side credit and accounts receivable foundation.

### Backend additions

- customer credit limit
- customer credit balance
- customer credit terms
- customer credit status
- customer receivables
- customer receivable payments

### API endpoints

- `GET /api/v1/pharmaco/receivables`
- `POST /api/v1/pharmaco/receivables`
- `GET /api/v1/pharmaco/receivables/{receivable}`
- `POST /api/v1/pharmaco/receivables/{receivable}/payments`
- `PATCH /api/v1/pharmaco/customers/{customer}/credit`

### Audit actions

- `pharmaco.customer_credit.updated`
- `pharmaco.customer_receivable.created`
- `pharmaco.customer_receivable.payment_recorded`

### Safety

The backend protects tenant boundaries, customer credit status, customer credit limit, overpayment, and cross-tenant receivable access.



## Phase 11.2 customer receivables dashboard workflow

Phase 11.2 adds a clean dashboard workflow for customer credit and accounts receivable management.

### Dashboard sections

- Customer Credit & Receivables header
- open balance, overdue balance, customers on credit, and collected accounts KPIs
- customer credit update form
- customer receivable creation form
- receivables register
- selected receivable collection form

### Style direction

The interface follows the current PharmaCo360 dashboard style:

- white cards
- subtle borders
- restrained spacing
- no decorative gradients
- practical finance wording
- responsive layout for mobile, tablet, laptop, desktop, and wide screens

### Review checklist

Review these screen sizes before production approval:

- 360px small mobile
- 430px mobile
- 768px tablet
- 1280px laptop
- 1440px desktop
- 1920px wide screen

Confirm that credit updates, receivable creation, and payment recording remain readable and usable at each size.



## Phase 12.1 customer credit exposure report

Phase 12.1 adds a small backend report for customer credit exposure.

### Endpoint

- `GET /api/v1/pharmaco/reports/customer-credit-exposure`

### Purpose

The report helps pharmacy finance teams see how much customer credit is open, how much is overdue, and how many customers are currently using credit.

### Response sections

- tenant
- period
- customer_credit_exposure


### Customer credit exposure export

Phase 12.5 through Phase 12.8 add an export-ready customer credit exposure flow.

- `GET /api/v1/pharmaco/reports/customer-credit-exposure/export`
- returns tenant-scoped open receivable rows as of the report date
- includes customer, reference, status, original amount, collected amount, balance amount, due date, days overdue, and aging bucket fields
- supports the admin dashboard CSV download action
- intended for review, follow-up, and audit-friendly credit control evidence
- read-only export; no customer, sale, payment, or receivable data is changed

### Customer credit exposure summary

- open balance
- overdue balance
- current balance
- enabled customer credit limit total
- customers on credit
- open receivables count
- overdue receivables count

### Safety

- follows the existing `ReportingController` pattern
- uses the existing `/reports/...` route style
- requires tenant context
- requires authentication
- read-only report; no customer, sale, payment, or receivable data is changed

### Reporting dashboard UI review checklist

Phase 13.1B improves reporting dashboard readability without changing backend logic, API contracts, migrations, authentication, or dependencies.

Review these screen sizes before production approval:

- 360px: filters stack cleanly and the CSV action remains tappable
- 430px: Customer credit risk card does not overflow
- 768px: reporting cards remain readable in tablet layout
- 1280px: KPI labels and card summaries feel executive-ready
- 1440px: report cards have balanced spacing
- 1920px: dashboard does not look sparse or stretched

Expected behavior:

- report figures remain read-only
- date filters continue to refresh the same reports
- Customer Credit CSV still downloads the same export rows
- export notice is easier to see after download

### Reporting dashboard empty and loading states

Phase 13.2 improves the reporting dashboard review experience without changing reporting APIs or database behavior.

Included UI behavior:

- shows a clear tenant-context message when reporting context is missing
- disables refresh and customer credit export actions until tenant context exists
- shows a loading message while figures refresh
- shows an initial empty overview before reports are loaded
- replaces plain empty table text with more helpful business guidance
- keeps all reporting data read-only

Review these screen sizes before production approval:

- 360px: loading and empty messages fit without horizontal scrolling
- 430px: disabled actions remain understandable
- 768px: empty-state boxes align with card spacing
- 1280px: dashboard feels clear before and after data loads
- 1440px: messages do not visually overpower report cards
- 1920px: empty/loading states remain readable and not stretched

### Reporting dashboard QA guardrails

Phase 13.3 adds QA guardrails for reporting dashboard review.

Included guardrails:

- a dedicated reporting dashboard QA guide
- a local script that checks important UI copy, tenant-context guards, empty states, and export visibility markers
- manual preview notes for 360px, 430px, 768px, 1280px, 1440px, and 1920px review
- confirmation that reporting UI polish must not hide backend, API, migration, auth, or dependency changes

Expected approval evidence:

- `./scripts/pharmaco-reporting-ui-check.sh`
- `./scripts/phase0-check.sh`
- desktop/tablet/mobile preview review before production deployment

### Reporting dashboard production review checklist

Phase 13.4 adds operator review and production deployment checklist guidance.

Included:

- dedicated production review checklist for the reporting dashboard
- cPanel-safe deployment checks
- approval evidence requirements for mobile, tablet, desktop, and wide-screen preview
- reminder that reporting dashboard review is read-only and must not mutate pharmacy records
- local checklist guardrail script

Expected approval evidence:

- `./scripts/pharmaco-reporting-ui-check.sh`
- `./scripts/pharmaco-reporting-production-review-check.sh`
- `./scripts/phase0-check.sh`

### Reporting dashboard release handover

Phase 13.5 adds release handover documentation for the reporting dashboard.

Included:

- release note for business and product stakeholders
- handover summary for operators, QA, deployment reviewers, and future developers
- release readiness evidence requirements
- local release guardrail script

Expected approval evidence:

- `./scripts/pharmaco-reporting-ui-check.sh`
- `./scripts/pharmaco-reporting-production-review-check.sh`
- `./scripts/pharmaco-reporting-release-check.sh`
- `./scripts/phase0-check.sh`

### Reporting dashboard release closure

Phase 13.6 adds the deployment runbook index and final release closure checklist.

Included:

- runbook index for reporting dashboard documentation
- release closure checklist
- final evidence list for QA, deployment, and operator review
- local release closure guardrail script

Expected approval evidence:

- `./scripts/pharmaco-reporting-ui-check.sh`
- `./scripts/pharmaco-reporting-production-review-check.sh`
- `./scripts/pharmaco-reporting-release-check.sh`
- `./scripts/pharmaco-reporting-release-closure-check.sh`
- `./scripts/phase0-check.sh`

### PharmaCo360 operations command center

Phase 14.1 introduces a read-only operations command center near the top of the admin workspace.

The command center reuses existing tenant-safe reporting APIs to summarize:

- stock at cost
- sales generated
- collection rate
- customer credit risk
- supplier balance
- purchase follow-up
- manager review notes

The feature is UI-only and does not introduce database migrations, backend changes, dependency changes, or data mutation.

Expected approval evidence:

- `./scripts/pharmaco-operations-command-center-check.sh`
- `./scripts/pharmaco-reporting-ui-check.sh`
- `./scripts/phase0-check.sh`


### PharmaCo360 command center alerts and review queues

Phase 14.2 adds read-only operational alerts and manager review queues to the PharmaCo360 operations command center.

Included:

- customer credit alert
- supplier payables alert
- sales collection alert
- purchasing alert
- stock visibility alert
- credit collection queue
- supplier payment queue
- purchase receiving queue
- sales collection queue

The feature continues to reuse existing tenant-safe reporting APIs and does not introduce backend changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- `./scripts/pharmaco-operations-command-center-check.sh`
- `./scripts/pharmaco-operations-alerts-check.sh`
- `./scripts/pharmaco-reporting-ui-check.sh`
- `./scripts/phase0-check.sh`

### PharmaCo360 command center responsive polish and operator review

Phase 14.3 improves the command center approval experience by adding an operator review checklist and additional responsive polish.

Included:

- operator review checklist inside the command center
- small-mobile polish at 360px and 430px
- tablet and laptop layout polish
- wide-screen readability guardrails
- standalone operator review QA document
- local operator review guardrail script

The feature is UI and QA documentation only. It does not introduce backend changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- `./scripts/pharmaco-operations-command-center-check.sh`
- `./scripts/pharmaco-operations-alerts-check.sh`
- `./scripts/pharmaco-operations-operator-review-check.sh`
- `./scripts/pharmaco-reporting-ui-check.sh`
- `./scripts/phase0-check.sh`

### PharmaCo360 command center executive operating summary

Phase 14.4 adds an executive operating summary and decision notes to the PharmaCo360 operations command center.

Included:

- operating position summary
- credit discipline summary
- supplier exposure summary
- stock investment summary
- daily close decision note
- collection follow-up decision note
- purchasing control decision note
- manager handover decision note
- standalone executive summary QA document
- local executive summary guardrail script

The feature is UI and QA documentation only. It uses existing tenant-safe reporting data and does not introduce backend changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- `./scripts/pharmaco-operations-command-center-check.sh`
- `./scripts/pharmaco-operations-alerts-check.sh`
- `./scripts/pharmaco-operations-operator-review-check.sh`
- `./scripts/pharmaco-operations-executive-summary-check.sh`
- `./scripts/pharmaco-reporting-ui-check.sh`
- `./scripts/phase0-check.sh`

### PharmaCo360 command center release closure

Phase 14.5 adds release closure and deployment evidence documentation for the PharmaCo360 operations command center.

Included:

- release closure checklist
- stakeholder review checklist
- technical review checklist
- deployment review checklist
- production evidence checklist
- cPanel deployment notes
- local release closure guardrail script

The phase is documentation and validation only. It does not introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- `./scripts/pharmaco-operations-command-center-check.sh`
- `./scripts/pharmaco-operations-alerts-check.sh`
- `./scripts/pharmaco-operations-operator-review-check.sh`
- `./scripts/pharmaco-operations-executive-summary-check.sh`
- `./scripts/pharmaco-operations-release-closure-check.sh`
- `./scripts/pharmaco-reporting-ui-check.sh`
- `./scripts/phase0-check.sh`

### PharmaCo360 command center production deployment runbook

Phase 14.6 adds production deployment and post-deployment verification documentation for the PharmaCo360 operations command center.

Included:

- production deployment runbook
- GitHub source-of-truth deployment flow
- cPanel production runtime checklist
- safe migration warning
- frontend deployment checklist
- post-deployment verification checklist
- responsive production review checklist
- rollback checklist
- deployment evidence archive checklist
- local production deployment guardrail script

The phase is documentation and validation only. It does not introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center release evidence package

Phase 14.7 adds a release evidence index and deployment package for the PharmaCo360 operations command center.

Included:

- release evidence index
- production deployment package
- validation evidence register
- approval evidence register
- responsive evidence checklist
- post-deployment evidence checklist
- rollback evidence checklist
- local release evidence guardrail script

The phase is documentation and validation only. It does not introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-operations-release-evidence-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center live verification pack

Phase 14.8 adds deployment execution and live production verification documentation for the PharmaCo360 operations command center.

Included:

- deployment execution checklist
- live verification pack
- health verification checklist
- authentication verification checklist
- dashboard verification checklist
- read-only verification checklist
- responsive live verification checklist
- production log verification checklist
- rollback trigger checklist
- local live verification guardrail script

The phase is documentation and validation only. It does not introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-operations-release-evidence-check.sh
- ./scripts/pharmaco-operations-live-verification-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center go-live approval dossier

Phase 14.9 adds go-live approval and readiness sign-off documentation for the PharmaCo360 operations command center.

Included:

- go-live approval dossier
- go-live readiness sign-off checklist
- business approval evidence
- operations approval evidence
- technical approval evidence
- deployment approval evidence
- rollback readiness evidence
- live verification readiness evidence
- go / no-go decision register
- local go-live approval guardrail script

The phase is documentation and validation only. It does not introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-operations-release-evidence-check.sh
- ./scripts/pharmaco-operations-live-verification-check.sh
- ./scripts/pharmaco-operations-go-live-approval-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center controlled production preparation and cPanel dry-run

Phase 15.0 adds controlled production deployment preparation and cPanel dry-run readiness documentation for the PharmaCo360 operations command center.

Included:

- controlled production deployment preparation checklist
- cPanel dry-run checklist
- cPanel readiness checklist
- production backup readiness checklist
- deployment package readiness checklist
- dry-run boundary checklist
- not-approved production command list
- dry-run evidence register
- local cPanel dry-run guardrail script

The phase is documentation and validation only. It does not deploy to production, copy production files, execute production commands, introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-operations-release-evidence-check.sh
- ./scripts/pharmaco-operations-live-verification-check.sh
- ./scripts/pharmaco-operations-go-live-approval-check.sh
- ./scripts/pharmaco-operations-cpanel-dry-run-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center production package build and deployment handoff

Phase 15.1 adds controlled production package build and deployment handoff documentation for the PharmaCo360 operations command center.

Included:

- production package build checklist
- package source control requirements
- package exclusion rules
- environment protection requirements
- package build evidence register
- deployment handoff checklist
- operator readiness checklist
- backup and rollback handoff checklist
- live verification handoff checklist
- local package handoff guardrail script

The phase is documentation and validation only. It does not deploy to production, copy production files, execute production commands, introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-operations-release-evidence-check.sh
- ./scripts/pharmaco-operations-live-verification-check.sh
- ./scripts/pharmaco-operations-go-live-approval-check.sh
- ./scripts/pharmaco-operations-cpanel-dry-run-check.sh
- ./scripts/pharmaco-operations-package-handoff-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center package manifest and checksum evidence

Phase 15.2 adds production package manifest and checksum evidence documentation for the PharmaCo360 operations command center.

Included:

- package manifest checklist
- source traceability requirements
- package content group verification
- protected-file exclusion evidence
- protected production asset warning
- checksum evidence checklist
- checksum method requirements
- integrity verification checklist
- local package manifest guardrail script

The phase is documentation and validation only. It does not build a production package, deploy to production, copy production files, execute production commands, introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-operations-release-evidence-check.sh
- ./scripts/pharmaco-operations-live-verification-check.sh
- ./scripts/pharmaco-operations-go-live-approval-check.sh
- ./scripts/pharmaco-operations-cpanel-dry-run-check.sh
- ./scripts/pharmaco-operations-package-handoff-check.sh
- ./scripts/pharmaco-operations-package-manifest-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center package dry-run and protected-file inspection

Phase 15.3 adds production package dry-run and protected-file inspection controls for the PharmaCo360 operations command center.

Included:

- package dry-run checklist
- local package readiness controls
- file inventory verification requirements
- package exclusion simulation
- protected-file inspection checklist
- special-review file controls
- protected production asset warnings
- local package dry-run guardrail script

The phase is documentation and validation only. It does not create a production package, upload a production package, deploy to production, copy production files, execute production commands, introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-operations-release-evidence-check.sh
- ./scripts/pharmaco-operations-live-verification-check.sh
- ./scripts/pharmaco-operations-go-live-approval-check.sh
- ./scripts/pharmaco-operations-cpanel-dry-run-check.sh
- ./scripts/pharmaco-operations-package-handoff-check.sh
- ./scripts/pharmaco-operations-package-manifest-check.sh
- ./scripts/pharmaco-operations-package-dry-run-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center package generation dry-run and checksum register

Phase 15.4 adds controlled production package generation dry-run and checksum register controls for the PharmaCo360 operations command center.

Included:

- package generation dry-run document
- inventory-only package readiness evidence
- protected tracked source inspection requirement
- checksum register template
- checksum generation rules
- checksum verification rules
- package integrity evidence fields
- local package generation dry-run guardrail script

The phase is documentation and validation only. It does not create a production package archive, upload a production package, deploy to production, copy production files, execute production commands, introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-operations-release-evidence-check.sh
- ./scripts/pharmaco-operations-live-verification-check.sh
- ./scripts/pharmaco-operations-go-live-approval-check.sh
- ./scripts/pharmaco-operations-cpanel-dry-run-check.sh
- ./scripts/pharmaco-operations-package-handoff-check.sh
- ./scripts/pharmaco-operations-package-manifest-check.sh
- ./scripts/pharmaco-operations-package-dry-run-check.sh
- ./scripts/pharmaco-operations-package-generation-dry-run-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center deployment approval freeze and release candidate sign-off

Phase 15.5 adds deployment approval freeze and final release candidate sign-off controls for the PharmaCo360 operations command center.

Included:

- deployment approval freeze document
- release candidate sign-off checklist
- freeze no-change boundary
- final go/no-go evidence register
- release owner checklist
- deployment operator checklist
- rollback owner checklist
- local release candidate freeze guardrail script

The phase is documentation and validation only. It does not create a production package archive, upload a production package, deploy to production, copy production files, execute production commands, introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-operations-release-evidence-check.sh
- ./scripts/pharmaco-operations-live-verification-check.sh
- ./scripts/pharmaco-operations-go-live-approval-check.sh
- ./scripts/pharmaco-operations-cpanel-dry-run-check.sh
- ./scripts/pharmaco-operations-package-handoff-check.sh
- ./scripts/pharmaco-operations-package-manifest-check.sh
- ./scripts/pharmaco-operations-package-dry-run-check.sh
- ./scripts/pharmaco-operations-package-generation-dry-run-check.sh
- ./scripts/pharmaco-operations-release-candidate-freeze-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center package approval ledger and release freeze evidence index

Phase 15.6 adds the production package approval ledger and release freeze evidence index for the PharmaCo360 operations command center.

Included:

- production package approval ledger
- release freeze evidence index
- approval role traceability
- evidence location index
- final go/no-go evidence reference
- release freeze evidence guardrail script

The phase is documentation and validation only. It does not create a production package archive, upload a production package, deploy to production, copy production files, execute production commands, introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-operations-release-evidence-check.sh
- ./scripts/pharmaco-operations-live-verification-check.sh
- ./scripts/pharmaco-operations-go-live-approval-check.sh
- ./scripts/pharmaco-operations-cpanel-dry-run-check.sh
- ./scripts/pharmaco-operations-package-handoff-check.sh
- ./scripts/pharmaco-operations-package-manifest-check.sh
- ./scripts/pharmaco-operations-package-dry-run-check.sh
- ./scripts/pharmaco-operations-package-generation-dry-run-check.sh
- ./scripts/pharmaco-operations-release-candidate-freeze-check.sh
- ./scripts/pharmaco-operations-release-freeze-evidence-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center final approval decision log and deployment authorization checklist

Phase 15.7 adds the final approval decision log and deployment authorization checklist for the PharmaCo360 operations command center.

Included:

- final approval decision log
- deployment authorization checklist
- go/no-go decision options
- authorization scope controls
- final go/no-go owner controls
- rollback confirmation controls
- local final approval guardrail script

The phase is documentation and validation only. It does not create a production package archive, upload a production package, deploy to production, copy production files, execute production commands, introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-operations-release-evidence-check.sh
- ./scripts/pharmaco-operations-live-verification-check.sh
- ./scripts/pharmaco-operations-go-live-approval-check.sh
- ./scripts/pharmaco-operations-cpanel-dry-run-check.sh
- ./scripts/pharmaco-operations-package-handoff-check.sh
- ./scripts/pharmaco-operations-package-manifest-check.sh
- ./scripts/pharmaco-operations-package-dry-run-check.sh
- ./scripts/pharmaco-operations-package-generation-dry-run-check.sh
- ./scripts/pharmaco-operations-release-candidate-freeze-check.sh
- ./scripts/pharmaco-operations-release-freeze-evidence-check.sh
- ./scripts/pharmaco-operations-final-approval-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center deployment execution authorization packet and operator evidence capture

Phase 15.8 adds the deployment execution authorization packet and operator evidence capture checklist for the PharmaCo360 operations command center.

Included:

- deployment execution authorization packet
- operator evidence capture document
- execution decision options
- execution scope controls
- pre-execution evidence capture
- during-execution evidence capture
- post-execution evidence capture
- local deployment execution authorization guardrail script

The phase is documentation and validation only. It does not create a production package archive, upload a production package, deploy to production, copy production files, execute production commands, introduce backend changes, frontend product changes, migrations, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-operations-release-evidence-check.sh
- ./scripts/pharmaco-operations-live-verification-check.sh
- ./scripts/pharmaco-operations-go-live-approval-check.sh
- ./scripts/pharmaco-operations-cpanel-dry-run-check.sh
- ./scripts/pharmaco-operations-package-handoff-check.sh
- ./scripts/pharmaco-operations-package-manifest-check.sh
- ./scripts/pharmaco-operations-package-dry-run-check.sh
- ./scripts/pharmaco-operations-package-generation-dry-run-check.sh
- ./scripts/pharmaco-operations-release-candidate-freeze-check.sh
- ./scripts/pharmaco-operations-release-freeze-evidence-check.sh
- ./scripts/pharmaco-operations-final-approval-check.sh
- ./scripts/pharmaco-operations-deployment-execution-authorization-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center deployment runbook command sequence and rollback evidence placeholders

Phase 15.9 adds the deployment runbook command sequence and rollback evidence placeholders for the PharmaCo360 operations command center.

Included:

- deployment runbook command sequence
- command sequence categories
- command execution rules
- explicit prohibited production command boundary
- rollback evidence placeholders
- rollback readiness register
- rollback decision table
- rollback command placeholder rules
- local deployment runbook guardrail script

The phase is documentation and validation only. It does not create a production package archive, upload a production package, deploy to production, copy production files, execute production commands, run migrations, introduce backend changes, frontend product changes, dependency changes, or data mutation.

Expected approval evidence:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-operations-release-evidence-check.sh
- ./scripts/pharmaco-operations-live-verification-check.sh
- ./scripts/pharmaco-operations-go-live-approval-check.sh
- ./scripts/pharmaco-operations-cpanel-dry-run-check.sh
- ./scripts/pharmaco-operations-package-handoff-check.sh
- ./scripts/pharmaco-operations-package-manifest-check.sh
- ./scripts/pharmaco-operations-package-dry-run-check.sh
- ./scripts/pharmaco-operations-package-generation-dry-run-check.sh
- ./scripts/pharmaco-operations-release-candidate-freeze-check.sh
- ./scripts/pharmaco-operations-release-freeze-evidence-check.sh
- ./scripts/pharmaco-operations-final-approval-check.sh
- ./scripts/pharmaco-operations-deployment-execution-authorization-check.sh
- ./scripts/pharmaco-operations-deployment-runbook-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

### PharmaCo360 command center deployment runbook and rollback evidence

Phase 15.9 adds a clean deployment runbook and rollback evidence structure for the PharmaCo360 operations command center.

Included:

- deployment runbook command sequence
- operator evidence placeholders
- prohibited production action boundary
- rollback trigger register
- rollback readiness register
- protected-file, `.env`, storage, migration, and database boundaries
- local deployment runbook guardrail script

This phase is documentation and validation only. It does not create a package archive, upload a package, deploy to production, copy production files, execute production commands, run migrations, introduce backend changes, frontend product changes, dependency changes, or data mutation.

### PharmaCo360 controlled package generation authorization gate

Phase 16.0 adds a controlled authorization gate before any future production package generation.

Included:

- package generation authorization gate
- package generation decision evidence
- required gate owners
- required authorization checks
- pre-generation evidence register
- post-generation evidence register
- package exclusion rules
- local package generation authorization guardrail script

This phase is documentation and validation only. It does not create a package archive, upload a package, deploy to production, copy production files, execute production commands, run migrations, introduce backend changes, frontend product changes, dependency changes, or data mutation.

### PharmaCo360 package generation dry-run command binder

Phase 16.1 adds a controlled package generation dry-run command binder for the PharmaCo360 operations command center.

Included:

- dry-run command preview register
- required binder owners
- dry-run command categories
- stop conditions
- dry-run evidence capture placeholders
- package exclusion preview
- protected-file inspection boundary
- local dry-run binder guardrail script

This phase is documentation and validation only. It does not create a package archive, upload a package, deploy to production, copy production files, execute production commands, run migrations, introduce backend changes, frontend product changes, dependency changes, or data mutation.

### PharmaCo360 package generation dry-run evidence manifest

Phase 16.2 adds a dry-run evidence manifest for the PharmaCo360 operations command center.

Included:

- dry-run evidence manifest
- dry-run evidence index
- evidence naming rules
- evidence ownership placeholders
- storage reference placeholders
- review checkpoints
- missing evidence handling
- local evidence manifest guardrail script

This phase is documentation and validation only. It does not create a package archive, execute package generation, upload a package, deploy to production, copy production files, execute production commands, run migrations, introduce backend changes, frontend product changes, dependency changes, or data mutation.

### PharmaCo360 dry-run package manifest preview ledger

Phase 16.3 adds dry-run package manifest and exclusion preview ledgers for the PharmaCo360 operations command center.

Included:

- dry-run package manifest preview ledger
- dry-run package exclusion preview ledger
- inclusion category placeholders
- exclusion category placeholders
- preview ownership placeholders
- stop conditions
- local manifest preview ledger guardrail script

This phase is documentation and validation only. It does not create a package archive, execute package generation, upload a package, deploy to production, copy production files, execute production commands, run migrations, introduce backend changes, frontend product changes, dependency changes, or data mutation.

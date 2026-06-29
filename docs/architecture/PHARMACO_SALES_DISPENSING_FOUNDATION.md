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

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

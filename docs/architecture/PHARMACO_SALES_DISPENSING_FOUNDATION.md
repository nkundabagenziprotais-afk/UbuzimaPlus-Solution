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

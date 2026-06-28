# PharmaCo360 Product Master and Inventory Foundation

Phase 3.1 introduces the first inventory foundation for PharmaCo360.

## Scope

This foundation adds:

- Product categories
- Product master
- Stock locations
- Stock batches
- Stock movement ledger
- VitaPharma opening product and stock seed data

## Seeded categories

- Antibiotics
- Analgesics
- Hypertension
- Diabetes
- Consumables

## Seeded products

- Amoxicillin 500mg Capsules
- Paracetamol 500mg Tablets
- Amlodipine 5mg Tablets
- Metformin 500mg Tablets
- Blood Glucose Test Strips

## Seeded locations

- HQ Main Store
- HQ Dispensary Shelf

## Controls

Inventory data is tenant-scoped and branch-scoped.

The stock movement ledger records opening stock balances and becomes the foundation for future stock receiving, dispensing, adjustment, transfer and expiry workflows.

## Next phases

- Tenant-scoped product APIs
- Tenant-scoped inventory APIs
- Stock movement APIs
- Expiry and reorder intelligence
- Dashboard product and inventory snapshot


## Phase 3.2 read APIs

Phase 3.2 exposes read-only product and inventory APIs.

### Endpoints

- `GET /api/v1/pharmaco/products`
- `GET /api/v1/pharmaco/products/{product}`
- `GET /api/v1/pharmaco/inventory/locations`
- `GET /api/v1/pharmaco/inventory/batches`
- `GET /api/v1/pharmaco/inventory/summary`

### Controls

All endpoints require:

- Authenticated Sanctum token
- `X-Tenant-Slug`
- `pharmaco.inventory.manage` permission
- Active `pharmaco.inventory` module for the tenant

The APIs are read-only in this phase. Stock receiving, transfer, adjustment, dispensing and audit-linked mutation workflows will be added in later phases.


## Phase 3.4 product mutation APIs

Phase 3.4 adds controlled product master mutation endpoints.

### Endpoints

- `POST /api/v1/pharmaco/products`
- `PATCH /api/v1/pharmaco/products/{product}`

### Controls

All mutation endpoints require:

- Authenticated Sanctum token
- `X-Tenant-Slug`
- `pharmaco.inventory.manage` permission
- Active `pharmaco.inventory` module for the tenant
- Tenant-scoped SKU uniqueness
- Tenant-owned product category validation
- Audit logs for create and update actions

### Out of scope

Stock quantity changes remain out of scope for Phase 3.4. Stock receiving, transfer, dispensing, adjustment and reversal workflows must use the stock movement ledger in a later phase.

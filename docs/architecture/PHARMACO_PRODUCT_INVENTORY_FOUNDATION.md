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

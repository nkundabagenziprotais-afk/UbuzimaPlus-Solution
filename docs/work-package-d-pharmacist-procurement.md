# Work Package D — Pharmacist Procurement Access

## Business outcome

The VitaPharma Pharmacist can perform operational Procurement work without
receiving administrative, approval, invoicing, or payment authority.

## Granted permissions

- `pharmaco.procurement.view`
- `pharmaco.procurement.purchase_order.create`
- `pharmaco.procurement.purchase_order.receive`

The existing operational permission contract expands these permissions into
the granular frontend permissions required to:

- Open Procurement
- View suppliers
- View purchase orders and outstanding orders
- Create or submit purchase orders
- View receiving history
- Receive approved or partially received stock

## Explicitly excluded permissions

- Supplier creation or supplier-master management
- Purchase-order approval
- Supplier invoice management or approval
- Supplier payment viewing or recording
- Tenant administration
- User and role management
- System configuration

## Separation of duties

Purchase-order approval, invoice approval, and payment authority remain
governed by their existing permissions and approval workflows.

## Navigation

No unconditional Pharmacist navigation entry is introduced. The existing
permission aliases and menu maps continue to control visibility. A user
without the granted permissions must not see or open Procurement.

## Functional review sizes

- 360 px small mobile
- 430 px mobile
- 768 px tablet
- 1280 px laptop
- 1440 px desktop
- 1920 px wide screen

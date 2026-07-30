# POS and Inventory Improvement Status

Last updated: 20260730T130322Z
Production corrective release: `fix/restore-approved-admin-ui-20260730T130322Z`

| ID | Requirement | Engineering | Production status |
|---|---|---|---|
| POS-01 | One sale line across multiple stock batches | Pending | Pending |
| INV-02 | Supplier-directory-only stock receiving | Pending | Pending |
| INV-03 | Decimal receiving unit cost | Pending | Pending |
| POS-04 | Invoice print and audited reprint | Pending | Pending |
| POS-05A | Backend sale-item hydration for Recent Sales | Closed | Retained in production |
| POS-05B | Products column in Recent Sales UI | Reopened | Frontend reverted with approved UI |
| POS-05C | Products in Sales Register | Pending | Pending |
| INV-06 | Permanent inventory-to-POS hydration | Pending | Pending |
| POS-07 | Flexible live and historical POS sessions | Pending | Pending |
| AUTH-08 | Taskbar after authentication only | Pending | Pending |
| POS-09A | Populated customer receipt frontend | Reopened | Frontend reverted with approved UI |
| POS-09B | 80 mm thermal receipt frontend | Reopened | Frontend reverted with approved UI |
| POS-09C | Sale return/refund receipt | Pending | Pending |
| FIN-UI | Accounting UI | Canary implemented | Human review pending |

## Corrective release decision

- The approved Admin UI that existed before the POS frontend deployment has been restored.
- The backend sales-list item and product hydration change remains in production.
- App.tsx and styles.css match the approved UI baseline commit.
- thermalPrint.ts has been removed from the production source baseline.
- The Finance runtime is not changed by this corrective release.
- No database migration or database modification is included.

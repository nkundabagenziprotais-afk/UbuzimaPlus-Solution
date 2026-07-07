# Inventory, User Management, Permission Dashboards, Receipt and Module UX Workstream

## Objective
Deliver a professional, permission-safe operating experience across Product Inventory, User Management, dashboards, POS, receipts and module navigation.

## Implementation order

### 1. Product Inventory transaction integrity
- Add a dedicated inventory-record search field and explicit Search/Clear controls.
- Surface two distinct receiving journeys:
  - Manual Product Master Entry.
  - Receive from Purchase Code / Purchase Order.
- Persist transaction origin in batch metadata.
- Display origin as a visible badge in the Product Inventory register and detail view.
- Permit editing only for manual Product Master entries.
- Enforce the edit restriction both in the frontend and the backend.
- Keep purchase-code records immutable; corrections should follow a controlled reversal or purchase-order correction workflow.
- Record audit metadata for quantity, unit cost, selling price, batch, location and expiry updates.

### 2. User Management and access control
- Replace the current information-heavy screen with a focused staff register and guided user form.
- Support create, edit, role update, permission update, deactivate/reactivate and delete/deprovision actions.
- Preserve historical transactions and audit records when a user is deactivated.
- Reserve permanent deletion for users without protected operational history.
- Add a dedicated Insurance permission group covering configuration, memberships, eligibility, claims, adjudication, payments and reconciliation.
- Ensure tenant administrators inherit all current and future tenant module permissions.
- Refresh the authenticated profile after permission changes so changes take effect without stale navigation.

### 3. Permission-driven dashboard
- Build each user home dashboard from effective permissions, role and tenant scope.
- Admin users receive the complete dashboard and all modules.
- Cashiers receive POS, receipts, customers and permitted sales information.
- Inventory users receive inventory, receiving, expiry and stock-management information.
- Finance users receive payables, receivables, reconciliation and authorised reporting.
- Insurance users receive insurance configuration, eligibility, claims and reconciliation workspaces.
- Hide inaccessible cards, menus, submenus, actions and API operations.

### 4. Full-page module workspace pattern
- Use the POS workspace as the shared module-shell standard.
- Each module should have:
  - a compact overview card on the dashboard;
  - an Open Module action;
  - a full-page header with module title, context, status and primary actions;
  - internal tabs or contextual navigation inside the workspace.
- Remove duplicate left-menu submenus where the module workspace already provides navigation.
- Keep the left menu focused on top-level modules.

### 5. Customer receipt
- Add a professional thermal and A4-friendly receipt layout.
- Include tenant identity, branch, contact details, receipt number, sale number, cashier, date/time and customer details.
- Include product, batch where appropriate, selling unit, quantity, unit price, discount, tax and line total.
- Show payment method, customer contribution, insurer contribution, amount paid, balance and change.
- Include return policy, verification code/QR placeholder and thank-you message.
- Support print, PDF/save, reprint and permission-controlled correction.

### 6. Left-menu order
1. POS and Sales
2. Inventory
3. Insurance
4. Suppliers and Procurement
5. Finance
6. Reports
7. Remaining administration and platform modules

### 7. POS quantity dialog
- Retain one primary quantity input only.
- Display the selected product and selling-unit definition prominently.
- Show pack/unit conversion information as read-only supporting information.
- Keep price, stock, batch and expiry details visible but secondary.
- Improve spacing, hierarchy, keyboard focus, confirmation action and mobile responsiveness.

## Non-negotiable controls
- UI permission checks must never replace backend authorisation.
- Admin authority must be explicit, tenant-scoped and auditable.
- Purchase-linked inventory must not be silently editable as manual stock.
- Deactivation must preserve operational history.
- Every new module must be registered in the central permission catalogue and admin-all-access policy.

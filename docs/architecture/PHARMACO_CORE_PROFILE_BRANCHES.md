# PharmaCo360 Core Profile and Branch Foundation

Phase 2.1 introduces the operational identity layer for pharmacy tenants.

## Scope

This foundation covers:

- Pharmacy profile details
- Regulatory and license identifiers
- Tenant-level pharmacy capabilities
- Insurance partner references
- Branch department and counter structure
- Seeded VitaPharma operational profile

## Seeded VitaPharma structure

The seeded VitaPharma profile includes:

- Legal name: VitaPharma Africa Ltd
- Trading name: VitaPharma
- Category: retail pharmacy
- Regulator: Rwanda FDA
- Main branch: HQ
- Departments:
  - Dispensary
  - Cashier
  - Store
  - Procurement
  - Customer Care

## Governance

This layer remains tenant-scoped. It does not expose other tenants and does not activate AI automatically.

The profile and departments provide the foundation for:

- Inventory
- POS
- Supplier ordering
- Insurance dispensing
- Customer follow-up
- AI analytics


## Phase 2.2 API endpoints

Tenant-scoped API endpoints:

- `GET /api/v1/pharmaco/profile`
- `GET /api/v1/pharmaco/branches`
- `GET /api/v1/pharmaco/branches/{branch}/departments`

Required headers:

- `Authorization: Bearer <token>`
- `X-Tenant-Slug: vitapharma`

Access controls:

- Profile endpoint requires `pharmaco.profile.manage`.
- Branch endpoints require `pharmaco.branches.manage`.
- Profile endpoint requires active `pharmaco.profile` module for the tenant.
- Branch endpoints require active `pharmaco.branches` module for the tenant.
- Branch departments cannot be read across tenant boundaries.


## Phase 2.4 editable branch and department APIs

Controlled mutation endpoints:

- PATCH /api/v1/pharmaco/branches/{branch}
- POST /api/v1/pharmaco/branches/{branch}/departments
- PATCH /api/v1/pharmaco/branches/{branch}/departments/{department}

Controls:

- Requires authenticated Sanctum token.
- Requires X-Tenant-Slug.
- Requires pharmaco.branches.manage permission.
- Requires active pharmaco.branches tenant module.
- Blocks branch and department access outside the active tenant.
- Records audit logs for branch update, department creation, and department update.
- Validates duplicate department code per branch.

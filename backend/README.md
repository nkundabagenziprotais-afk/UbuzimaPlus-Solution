# Ubuzima+ Backend

The backend will be built as a Laravel API-first modular monolith.

## Main Areas

- Core
- Tenancy
- Solutions
- Modules
- Security
- AI
- PharmaCo360
- ERP
- Integrations

## Foundation Rules

- No hardcoded tenant IDs
- No secrets in code
- Every tenant-owned record must be tenant-aware
- Module access must be checked before feature access
- Admin scope must be resolved before data access
- Sensitive actions must be audited
- AI access must be governed by scope, permission, approval and audit logs

## Admin Levels

1. Ubuzima+ Admin
2. Solution Admin
3. Tenant Admin

## First Solution

PharmaCo360

## First Tenant

VitaPharma

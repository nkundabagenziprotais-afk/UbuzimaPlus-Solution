# Auth, Tenancy and RBAC Foundation

This phase introduces the first authenticated API layer for Ubuzima+.

## Authentication model

- Laravel Sanctum is used for API token authentication.
- Login returns a Bearer token.
- Protected endpoints use `auth:sanctum`.
- Tokens are generated with permission codes as abilities.
- Users seeded in development must change password before production use.

## Seeded admin users

Development-only seeded users:

- `admin@ubuzimaplus.local`
- `pharmaco.admin@ubuzimaplus.local`
- `admin@vitapharmaafrica.com`

The default development seed password is `ChangeThisPassword123!`.

This is not a production secret. Production must use controlled user invitation, password reset, or secure environment-based seeding.

## Access response

The authenticated profile response includes:

- user identity
- resolved admin scope
- active roles
- active permissions
- tenant assignments
- admin scopes

Sensitive tenant configuration, AI secrets, internal settings, and private identifiers are not exposed in the public tenant endpoint.

## Security rules

- Suspended users cannot log in.
- Tenant admins do not receive platform-level permissions.
- Token abilities are derived from active role permissions.
- AI Center remains controlled unless explicitly activated.
- All future sensitive actions must be audited.

# Ubuzima+ Coding Rules

## Non-Negotiable Rules

1. Do not push directly to main.
2. Do not place secrets in GitHub.
3. Do not hardcode tenant IDs.
4. Do not return data without resolving user scope.
5. Do not activate modules without audit logs.
6. Do not allow AI to access data without scope and permission checks.
7. Do not expose tenant data across tenants.
8. Do not make destructive production migrations without explicit approval.
9. Do not use generic AI-template interface patterns.
10. Do not skip preview and review for major UI changes.

## Required Access Questions

Every sensitive request must answer:

- Who is the user?
- What admin level do they have?
- Which solution are they accessing?
- Which tenant are they accessing?
- Which branch are they accessing?
- Which module are they using?
- Is the module active?
- Do they have permission?
- Is the data classified?
- Should this be audited?

## Planned Services

- ScopeResolver
- TenantResolver
- SolutionResolver
- ModuleAccessService
- PermissionService
- ConfigurationService
- VisibilityPolicyService
- AuditLogService
- AIContextGuard

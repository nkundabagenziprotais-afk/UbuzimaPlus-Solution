# Phase 0 Review Checklist

This checklist must be completed before merging `feature/platform-foundation` into `development`.

## Branch

- Current working branch is `feature/platform-foundation`.
- Branch is pushed to GitHub.
- Local branch is clean before moving to the next phase.
- Pull request should target `development`, not `main`.

## Backend

- Laravel is installed inside `backend/`.
- `.env` exists locally but is not committed.
- `backend/.env.example` is committed.
- SQLite local test database exists only for local testing.
- `php artisan migrate:fresh --seed` succeeds locally.
- `php artisan test` passes.
- API routes exist:
  - `/api/v1/health`
  - `/api/v1/platform/status`
  - `/api/v1/solutions`
  - `/api/v1/tenants/{slug}/public-status`

## Data Foundation

- PharmaCo360 is seeded as active solution.
- ClinicCo360 is seeded as planned solution.
- VetCo360 is seeded as planned solution.
- VitaPharma is seeded as first active tenant.
- VitaPharma AI Center status remains controlled.
- Tenant-sensitive settings are not exposed in public endpoints.

## Web Public Website

- Public website builds successfully.
- Public website is reviewed at:
  - 360px
  - 430px
  - 768px
  - 1280px
  - 1440px
  - 1920px
- Website follows Ubuzima+ identity and does not copy another brand's exact design, assets, text, colors, or trade dress.

## Admin Dashboard

- Admin dashboard builds successfully.
- Dashboard shows:
  - Ubuzima+ Admin
  - PharmaCo360 Solution Admin
  - VitaPharma Tenant Admin
  - Module activation direction
  - AI Center controlled status
  - Security and audit direction
- Dashboard is reviewed at:
  - 360px
  - 430px
  - 768px
  - 1280px
  - 1440px
  - 1920px

## AI Governance

- AI provider placeholder remains disabled.
- AI Center for VitaPharma remains controlled.
- AI guard service blocks tenant AI usage until activation becomes active.
- High-risk AI actions require human approval.

## Security

- No secrets are committed.
- No tenant data is exposed across tenants.
- Shared functionality respects data separation.
- Audit service foundation exists.
- Scope resolver foundation exists.
- Module access service foundation exists.

## CI

GitHub Actions must pass:

- Backend Laravel Tests
- Public Website Build
- Admin Dashboard Build

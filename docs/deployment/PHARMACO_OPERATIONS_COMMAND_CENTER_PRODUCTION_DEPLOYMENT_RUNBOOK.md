# PharmaCo360 Operations Command Center Production Deployment Runbook

## Purpose

This runbook guides safe production deployment review for the PharmaCo360 operations command center.

The command center is a read-only management layer. It uses existing tenant-safe reporting data and does not create, update, approve, delete, submit, or mutate operational records.

## Source of truth

GitHub is the source of truth.

Production cPanel must be treated as runtime only. Do not edit production files manually as the long-term source of truth.

Preferred flow:

1. Merge reviewed work into development.
2. Validate development.
3. Promote to main.
4. Validate main.
5. Final-sync development from main.
6. Deploy the approved main state to production.
7. Verify logs, health, authentication, dashboard behavior, and responsiveness.

## Production pre-deployment checklist

Before deploying, confirm:

- final commit hash is recorded
- main is clean and pushed
- development is final-synced from main
- all command center guardrail scripts passed
- backend tests passed
- public website build passed
- admin dashboard build passed
- deployment reviewer approved the release
- rollback point is identified
- production backup is available where applicable

## Required local validation before deployment

Run these checks before production approval:

- ./scripts/pharmaco-operations-command-center-check.sh
- ./scripts/pharmaco-operations-alerts-check.sh
- ./scripts/pharmaco-operations-operator-review-check.sh
- ./scripts/pharmaco-operations-executive-summary-check.sh
- ./scripts/pharmaco-operations-release-closure-check.sh
- ./scripts/pharmaco-operations-production-deployment-check.sh
- ./scripts/pharmaco-reporting-ui-check.sh
- ./scripts/phase0-check.sh

## cPanel production checklist

For Laravel/cPanel production runtime, verify:

- PHP version is compatible with the project
- document root points to /public
- .env is correct for production
- application key is present
- database credentials are correct
- storage link exists
- storage and cache permissions are correct
- caches are cleared and rebuilt safely
- health endpoint works
- Laravel logs are checked after deployment
- temporary public test files are removed

Do not run destructive production commands such as php artisan migrate:fresh --force or php artisan db:wipe.

For this Phase 14.6 documentation release, no new migration is introduced.

## Safe migration note

Only run php artisan migrate --force after backup, approval, and migration review.

## Frontend deployment checklist

For the admin dashboard:

- confirm production build completed successfully
- confirm new build assets are deployed
- confirm browser cache behavior is reviewed
- confirm the admin dashboard loads without blocking errors
- confirm the PharmaCo360 dashboard opens for the correct authenticated tenant
- confirm the command center appears before detailed workflows

## Post-deployment verification

After deployment, verify:

1. Health endpoint returns OK.
2. Login works for an authorized VitaPharma tenant admin.
3. PharmaCo360 dashboard opens.
4. Operations command center appears.
5. Refresh command center works.
6. Operational alerts are visible.
7. Review queues are visible.
8. Operator review checklist is visible.
9. Executive operating summary is visible.
10. Decision notes are visible.
11. No create, update, approve, delete, submit, or mutation action is triggered by the command center.
12. Logs show no new production errors.

## Responsive production review

Review these screen sizes:

- 360px small mobile
- 430px mobile
- 768px tablet
- 1280px laptop
- 1440px desktop
- 1920px wide screen

Approve only when the command center remains readable, balanced, and useful across all reviewed screen sizes.

## Rollback checklist

Before deployment, identify:

- previous production commit or release package
- backup location
- database backup status where applicable
- person responsible for rollback approval
- expected rollback verification steps

If rollback is required:

1. Stop further changes.
2. Restore the previous approved production package or commit.
3. Do not wipe production data.
4. Re-check health endpoint.
5. Re-check login.
6. Re-check logs.
7. Record rollback evidence.

## Deployment evidence to archive

Archive:

- final commit hash
- branch name
- PR or merge reference
- validation command outputs
- backend test summary
- public website build summary
- admin dashboard build summary
- deployment reviewer approval
- post-deployment health check result
- post-deployment log review result
- responsive screenshots or notes
- rollback point

## Closure decision

Approve production deployment only when the command center is validated, read-only, tenant-safe, responsive, operationally useful, and post-deployment evidence is captured.

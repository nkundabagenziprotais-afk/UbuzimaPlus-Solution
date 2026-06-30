# PharmaCo360 Operations Command Center Deployment Execution Checklist

## Purpose

This checklist supports controlled production deployment execution for the PharmaCo360 operations command center.

It should be used together with the production deployment runbook, deployment package, release evidence index, and live verification pack.

## Pre-execution confirmation

Before deployment execution, confirm:

- main is the approved source branch
- development is final-synced from main
- final commit hash is recorded
- release evidence package is complete
- production backup is available where applicable
- rollback point is identified
- deployment reviewer has approved
- deployment operator is assigned

## Approved validation before execution

Confirm these passed before deployment:

- command center guardrail
- operational alerts guardrail
- operator review guardrail
- executive summary guardrail
- release closure guardrail
- production deployment guardrail
- release evidence guardrail
- reporting UI guardrail
- backend tests
- public website build
- admin dashboard build

## cPanel execution checklist

During cPanel deployment, confirm:

- deployment package matches approved main commit
- document root points to /public
- .env production values are unchanged unless approved
- storage link exists
- permissions are correct
- production build assets are deployed
- caches are rebuilt safely
- temporary public test files are removed
- health endpoint is checked after deployment

## Commands not approved

Do not run:

- php artisan migrate:fresh --force
- php artisan db:wipe
- any command that wipes production data
- any unreviewed destructive command

For this Phase 14.8 documentation release, no new migration is introduced.

## Immediate post-execution checklist

After deployment, confirm:

- production site loads
- health endpoint returns OK
- authorized login works
- PharmaCo360 dashboard opens
- operations command center appears
- refresh command center works
- no new critical log entry appears

## Evidence to capture during execution

Capture:

- deployment start time
- deployment end time
- deployed commit hash
- deployment operator
- reviewer
- health endpoint result
- dashboard screenshot
- log review result
- rollback point
- final decision

## Execution decision

The deployment execution is complete only when the approved source was deployed, production health was verified, logs were reviewed, and rollback evidence is recorded.

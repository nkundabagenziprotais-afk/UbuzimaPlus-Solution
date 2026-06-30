# PharmaCo360 Operations Command Center Release Closure

## Purpose

This release closure confirms that the PharmaCo360 operations command center is ready for controlled deployment review.

The command center is a read-only management layer. It summarizes existing tenant-safe reporting data and does not create, update, approve, delete, submit, or mutate records.

## Release scope covered

- operations command center
- operational alerts
- manager review queues
- operator review checklist
- executive operating summary
- decision notes
- responsive QA evidence
- architecture notes
- local guardrail scripts

## Approval evidence required

Run and capture evidence for:

- `./scripts/pharmaco-operations-command-center-check.sh`
- `./scripts/pharmaco-operations-alerts-check.sh`
- `./scripts/pharmaco-operations-operator-review-check.sh`
- `./scripts/pharmaco-operations-executive-summary-check.sh`
- `./scripts/pharmaco-operations-release-closure-check.sh`
- `./scripts/pharmaco-reporting-ui-check.sh`
- `./scripts/phase0-check.sh`

## Stakeholder review checklist

Business owner:

- confirms the command center supports daily pharmacy decision-making
- confirms language is practical and humanized
- confirms dashboard does not look generic
- confirms the release is useful before detailed workflows

Operations reviewer:

- confirms alerts are understandable
- confirms queues are useful for daily follow-up
- confirms operator checklist supports branch-level review
- confirms decision notes support management handover

Technical reviewer:

- confirms tenant-safe reporting data is reused
- confirms no new backend behavior is introduced
- confirms no migration is introduced
- confirms no dependency is introduced
- confirms no mutation behavior is introduced

Deployment reviewer:

- confirms validation passed on development
- confirms validation passed on main after promotion
- confirms development was final-synced from main
- confirms logs and health checks are reviewed after deployment

## Production deployment evidence to capture

Before production approval, capture:

- final commit hash
- branch name
- PR or merge reference
- command output for each guardrail script
- backend test summary
- public website build summary
- admin dashboard build summary
- dashboard screenshot at 360px
- dashboard screenshot at 430px
- dashboard screenshot at 768px
- dashboard screenshot at 1280px
- dashboard screenshot at 1440px
- dashboard screenshot at 1920px

## cPanel deployment notes

For cPanel deployment, verify:

- PHP version is compatible
- document root points to `/public`
- `.env` is correct
- storage link exists
- permissions are correct
- migrations are safe
- caches are cleared and rebuilt
- health endpoint works
- logs are checked
- temporary public test files are removed

## Closure decision

Approve release closure only when the command center is validated, read-only, responsive, tenant-safe, operationally useful, and deployment evidence is captured.

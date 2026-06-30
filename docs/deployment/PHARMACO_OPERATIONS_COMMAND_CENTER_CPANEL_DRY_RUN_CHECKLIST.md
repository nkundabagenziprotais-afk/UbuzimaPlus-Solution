# PharmaCo360 Operations Command Center cPanel Dry-Run Checklist

## Purpose

This checklist supports a non-destructive cPanel dry-run for the PharmaCo360 operations command center.

It verifies readiness only. It must not deploy files, modify production, or run destructive commands.

## Dry-run identity

Product: PharmaCo360  
Area: Operations command center  
Dry-run type: cPanel production deployment readiness review  
Source branch: main  
Baseline before Phase 15.0: 50d7b71  

## Dry-run evidence register

Record:

- dry-run date
- dry-run reviewer
- approved main commit
- cPanel username
- hosting server
- live application path
- document root path
- backup path
- rollback point
- dry-run decision
- issues found
- actions required before deployment

## GitHub readiness

Confirm:

- main is approved
- development is aligned with main
- latest validation passed
- release evidence index is complete
- go-live approval dossier is complete
- go-live readiness sign-off checklist is complete

## Local package readiness

Confirm:

- backend tests pass locally
- public website build passes locally
- admin dashboard build passes locally
- command center guardrails pass locally
- production package excludes `.env`
- production package excludes local cache
- production package excludes test database files
- production package excludes node_modules unless intentionally packaged

## cPanel path readiness

Confirm:

- production application path is known
- production public path is known
- document root points to public directory
- live `.env` location is known
- storage path is writable
- bootstrap cache path is writable
- log path is writable
- current live application backup path is known

## Environment readiness

Confirm:

- live `.env` is preserved
- APP_ENV is production
- APP_DEBUG is false
- database credentials are not overwritten
- app key is not regenerated without approval
- queue/cache/session drivers are known
- mail settings are not changed without approval

## Database readiness

Confirm:

- no new migration exists in this phase
- no migrate fresh command is approved
- database backup method is confirmed
- production database name is known
- rollback database restore method is known

## Post-deployment verification readiness

Confirm the reviewer is ready to check:

- health endpoint
- login
- PharmaCo360 dashboard
- operations command center
- operational alerts
- review queues
- command center read-only behavior
- production logs
- responsive views

## Dry-run pass criteria

Dry-run passes only if:

- cPanel paths are known
- backup and rollback are ready
- approved commit is recorded
- environment protection is confirmed
- no destructive command is required
- post-deployment verification plan is ready
- open issues are documented

## Dry-run fail criteria

Dry-run fails if:

- production path is uncertain
- backup is not ready
- rollback is unclear
- `.env` protection is unclear
- approved commit is unclear
- production document root is unclear
- destructive commands are required
- validation evidence is incomplete

## Dry-run decision

Dry-run status: pending  
Reviewer: pending  
Approved commit: pending  
Decision date: pending  
Issues: pending  
Next action: pending  

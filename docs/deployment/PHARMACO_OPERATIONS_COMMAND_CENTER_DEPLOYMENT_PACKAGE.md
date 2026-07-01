# PharmaCo360 Operations Command Center Deployment Package

## Purpose

This package summarizes the production deployment evidence required for the PharmaCo360 operations command center.

It should be completed before production approval and updated after deployment with actual evidence references.

## Release identity

Product: PharmaCo360  
Area: Operations command center  
Release type: Read-only dashboard and release documentation  
Current baseline before Phase 14.7: a5cc729  
Production source branch: main  
Working branch for this package: docs/pharmaco-command-center-release-evidence  

## Scope included

- operations command center
- operational alerts
- manager review queues
- operator review checklist
- executive operating summary
- decision notes
- release closure checklist
- production deployment runbook
- release evidence index
- deployment package checklist

## Scope excluded

- backend feature changes
- frontend product behavior changes
- database migration changes
- dependency changes
- production data changes
- destructive production commands

## Deployment readiness checklist

Before deployment, confirm:

- main is approved
- main is pushed
- development is final-synced from main
- all guardrail scripts passed
- backend tests passed
- public website build passed
- admin dashboard build passed
- production backup is available where applicable
- rollback point is known
- deployment reviewer has approved

## Production deployment checklist

During deployment, confirm:

- source commit matches approved main
- cPanel document root points to /public
- .env production values are correct
- storage link exists
- permissions are correct
- production build assets are deployed
- caches are rebuilt safely
- health endpoint is checked
- logs are checked after deployment

## Commands explicitly not approved

Do not use:

- php artisan migrate:fresh --force
- php artisan db:wipe
- any command that wipes production data

For this package, no new migration is introduced.

## Post-deployment verification checklist

After deployment, confirm:

- health endpoint returns OK
- authorized login works
- PharmaCo360 dashboard opens
- operations command center is visible
- command center refresh works
- alerts are readable
- review queues are readable
- operator checklist is readable
- executive summary is readable
- decision notes are readable
- no mutation action is triggered
- logs show no new production errors

## Screenshot evidence checklist

Capture or review:

- 360px small mobile
- 430px mobile
- 768px tablet
- 1280px laptop
- 1440px desktop
- 1920px wide screen

## Rollback evidence checklist

Record:

- previous production release reference
- backup location
- rollback approver
- rollback operator
- rollback verification steps
- health check after rollback
- log check after rollback

## Sign-off table

Business owner: pending  
Operations reviewer: pending  
Technical reviewer: pending  
Deployment reviewer: pending  

## Final decision

Approve deployment only when validation evidence, approval evidence, rollback evidence, and post-deployment evidence are available.

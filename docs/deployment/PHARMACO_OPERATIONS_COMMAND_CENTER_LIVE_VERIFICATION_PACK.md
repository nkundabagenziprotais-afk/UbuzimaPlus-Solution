# PharmaCo360 Operations Command Center Live Verification Pack

## Purpose

This pack guides live production verification for the PharmaCo360 operations command center after an approved deployment.

It is not a deployment script. It is an evidence checklist for confirming that the live environment is healthy, tenant-safe, readable, responsive, and read-only.

## Live verification identity

Product: PharmaCo360  
Area: Operations command center  
Verification type: Live production review  
Source branch: main  
Baseline before Phase 14.8: 1d7202d  

## Live verification principles

Confirm:

- GitHub main remains the source of truth
- cPanel is production runtime only
- production data is not wiped
- no destructive production command is used
- the command center remains read-only
- the dashboard is useful for operations users
- logs are checked after deployment

## Required live evidence

Capture or record:

- production URL checked
- deployment commit hash
- deployment date
- deployment operator
- verification reviewer
- health endpoint result
- login result
- dashboard load result
- command center load result
- browser console review result
- Laravel log review result
- responsive screen review result
- rollback point

## Health verification

Confirm:

- health endpoint returns OK
- platform status endpoint responds where applicable
- no 500 error appears
- no maintenance screen appears unexpectedly
- no route error appears

## Authentication verification

Confirm:

- authorized user can log in
- unauthorized user cannot access protected dashboard pages
- VitaPharma tenant context is respected
- user can log out safely

## Dashboard verification

Confirm:

- PharmaCo360 dashboard opens
- operations command center appears
- command center refresh works
- operational alerts are visible
- review queues are visible
- operator checklist is visible
- executive operating summary is visible
- decision notes are visible

## Read-only verification

Confirm the command center does not trigger:

- create action
- update action
- approve action
- delete action
- submit action
- payment action
- stock movement action
- supplier invoice action
- customer receivable action
- data wipe action

## Responsive live verification

Review:

- 360px small mobile
- 430px mobile
- 768px tablet
- 1280px laptop
- 1440px desktop
- 1920px wide screen

Confirm the command center remains readable, balanced, useful, and not visually broken.

## Log verification

Review production logs after deployment and record:

- no new Laravel critical error
- no new dashboard-blocking API error
- no authentication error caused by deployment
- no tenant context error caused by deployment
- no reporting endpoint failure caused by deployment

## Rollback triggers

Rollback review is required if:

- health endpoint fails
- login fails for authorized users
- dashboard cannot load
- command center causes production error
- tenant isolation appears broken
- command center triggers mutation unexpectedly
- production logs show critical new errors
- deployed package does not match approved main

## Live verification decision

Approve live verification only when health, authentication, dashboard, read-only behavior, logs, responsiveness, and rollback evidence have been reviewed and recorded.

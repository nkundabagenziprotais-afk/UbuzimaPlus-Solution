# PharmaCo360 Operations Command Center Release Evidence Index

## Purpose

This document is the evidence index for the PharmaCo360 operations command center release.

It gives reviewers one place to confirm what was delivered, what was validated, what evidence must be archived, and what must be checked after production deployment.

## Release baseline

Baseline before Phase 14.7: a5cc729

The command center release is read-only. It does not create, update, approve, delete, submit, or mutate operational records.

## Evidence documents

Required release evidence documents:

- docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md
- docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_RELEASE_CLOSURE.md
- docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PRODUCTION_DEPLOYMENT_RUNBOOK.md
- docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_RELEASE_EVIDENCE_INDEX.md
- docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_PACKAGE.md

## Evidence scripts

Required validation scripts:

- scripts/pharmaco-operations-command-center-check.sh
- scripts/pharmaco-operations-alerts-check.sh
- scripts/pharmaco-operations-operator-review-check.sh
- scripts/pharmaco-operations-executive-summary-check.sh
- scripts/pharmaco-operations-release-closure-check.sh
- scripts/pharmaco-operations-production-deployment-check.sh
- scripts/pharmaco-operations-release-evidence-check.sh
- scripts/pharmaco-reporting-ui-check.sh
- scripts/phase0-check.sh

## Validation evidence register

Archive evidence for:

- command center guardrail result
- operational alerts guardrail result
- operator review guardrail result
- executive summary guardrail result
- release closure guardrail result
- production deployment guardrail result
- release evidence guardrail result
- reporting UI guardrail result
- backend test result
- public website build result
- admin dashboard build result

## Backend validation evidence

Required backend evidence:

- tests passed count
- assertions count
- migration preparation result
- seeding result
- health endpoint test result
- tenant-scope test result
- reporting endpoint test result
- mutation safety test result

## Frontend validation evidence

Required frontend evidence:

- public website production build result
- admin dashboard production build result
- command center UI loads
- operational alerts are visible
- review queues are visible
- operator checklist is visible
- executive summary is visible
- decision notes are visible

## Responsive evidence

Review or capture:

- 360px small mobile
- 430px mobile
- 768px tablet
- 1280px laptop
- 1440px desktop
- 1920px wide screen

## Production deployment evidence

Archive:

- final commit hash
- branch name
- pull request reference
- merge reference
- deployment date
- deployment reviewer
- deployment operator
- production backup reference
- rollback reference
- post-deployment health check result
- post-deployment log review result
- production dashboard review result

## Approval evidence

Required approval evidence:

- business owner approval
- operations reviewer approval
- technical reviewer approval
- deployment reviewer approval

## Read-only safety evidence

Confirm:

- no new backend mutation was introduced
- no new migration was introduced
- no dependency change was introduced
- no data mutation was introduced
- no destructive production command is required
- command center remains read-only

## Closure decision

The release evidence package is complete only when the release is validated, read-only, tenant-safe, responsive, operationally useful, and deployment evidence is archived.

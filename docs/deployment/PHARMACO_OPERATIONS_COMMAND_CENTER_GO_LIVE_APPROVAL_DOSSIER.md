# PharmaCo360 Operations Command Center Go-Live Approval Dossier

## Purpose

This dossier supports the formal go-live approval decision for the PharmaCo360 operations command center.

It consolidates the required business, operations, technical, deployment, validation, rollback, and live verification evidence before production go-live approval.

## Release identity

Product: PharmaCo360  
Area: Operations command center  
Release type: Read-only operations dashboard and deployment documentation  
Source of truth: GitHub main  
Baseline before Phase 14.9: 3456356  

## Go-live principle

The command center is read-only. It uses existing tenant-safe reporting data and does not create, update, approve, delete, submit, pay, receive stock, invoice, wipe, or mutate operational records.

## Approval documents to review

Review these documents before go-live approval:

- docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md
- docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_RELEASE_CLOSURE.md
- docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PRODUCTION_DEPLOYMENT_RUNBOOK.md
- docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_PACKAGE.md
- docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_RELEASE_EVIDENCE_INDEX.md
- docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_EXECUTION_CHECKLIST.md
- docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_LIVE_VERIFICATION_PACK.md
- docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_GO_LIVE_APPROVAL_DOSSIER.md
- docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_GO_LIVE_READINESS_SIGN_OFF.md

## Required validation evidence

Confirm these checks passed before go-live approval:

- command center guardrail
- operational alerts guardrail
- operator review guardrail
- executive summary guardrail
- release closure guardrail
- production deployment guardrail
- release evidence guardrail
- live verification guardrail
- go-live approval guardrail
- reporting UI guardrail
- backend tests
- public website build
- admin dashboard build

## Business approval evidence

Business owner confirms:

- command center supports daily pharmacy operating decisions
- executive summary is understandable
- decision notes are useful for management handover
- dashboard language is practical and humanized
- release is acceptable for controlled go-live

## Operations approval evidence

Operations reviewer confirms:

- alerts are clear
- review queues are useful
- operator checklist supports branch-level review
- command center supports daily follow-up
- go-live risks are acceptable

## Technical approval evidence

Technical reviewer confirms:

- GitHub main is the source of truth
- cPanel is production runtime only
- no backend mutation was introduced
- no new migration was introduced
- no dependency change was introduced
- no data mutation was introduced
- tenant-safe reporting data is reused
- destructive production commands are not approved

## Deployment approval evidence

Deployment reviewer confirms:

- approved main commit is identified
- production backup is available where applicable
- rollback point is identified
- deployment execution checklist is ready
- live verification pack is ready
- post-deployment log review is required

## Go / no-go decision register

Record the final decision:

- Go-live decision: pending
- Decision date: pending
- Approved commit: pending
- Business owner: pending
- Operations reviewer: pending
- Technical reviewer: pending
- Deployment reviewer: pending
- Deployment operator: pending
- Rollback owner: pending

## No-go triggers

Do not approve go-live if:

- validation fails
- approved main commit is unclear
- backup or rollback point is unclear
- health endpoint fails
- login fails
- command center triggers mutation
- tenant isolation appears broken
- production logs show critical new errors
- deployment package does not match approved source

## Final approval decision

Approve go-live only when validation evidence, approval evidence, rollback evidence, deployment execution readiness, and live verification readiness are complete.

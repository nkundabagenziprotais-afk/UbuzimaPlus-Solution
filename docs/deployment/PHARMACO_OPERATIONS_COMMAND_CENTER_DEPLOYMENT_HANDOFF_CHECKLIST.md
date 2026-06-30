# PharmaCo360 Operations Command Center Deployment Handoff Checklist

## Purpose

This checklist supports formal handoff of the approved PharmaCo360 operations command center production package to the deployment operator.

It confirms that the operator receives source, package, rollback, backup, verification, and escalation evidence before any approved production deployment.

## Handoff identity

Product: PharmaCo360  
Area: Operations command center  
Handoff type: Controlled deployment package handoff  
Source branch: main  
Baseline before Phase 15.1: eae1e9c  

## Handoff evidence register

Record:

- handoff date
- handoff owner
- deployment operator
- approved main commit
- package filename
- package location
- package checksum where applicable
- backup location
- rollback point
- deployment window
- approver
- handoff decision

## Required documents handed over

Confirm the deployment operator has access to:

- production deployment runbook
- deployment package document
- release evidence index
- deployment execution checklist
- live verification pack
- go-live approval dossier
- go-live readiness sign-off
- controlled production preparation checklist
- cPanel dry-run checklist
- production package build checklist
- deployment handoff checklist

## Operator readiness

Deployment operator confirms:

- approved main commit is known
- package source is known
- production path is known
- document root is known
- `.env` must not be overwritten
- production backup is available where applicable
- rollback point is known
- live verification steps are known
- escalation contact is known
- deployment is not approved until final go decision is recorded

## Backup and rollback handoff

Confirm:

- backup owner is assigned
- backup location is recorded
- rollback owner is assigned
- rollback package is identified
- rollback steps are documented
- rollback verification steps are known

## Live verification handoff

Confirm operator can verify:

- health endpoint
- login
- PharmaCo360 dashboard
- operations command center
- operational alerts
- review queues
- read-only behavior
- responsive views
- production logs

## No-deployment boundary

This handoff does not execute production deployment.

The operator must not:

- copy files to production before approval
- overwrite `.env`
- run destructive production commands
- run migrate:fresh
- wipe production data
- change DNS
- change production permissions without approval
- restart services without approval

## Handoff pass criteria

Handoff passes when:

- approved source is identified
- package is traceable to approved main
- validation evidence is complete
- backup and rollback evidence is complete
- cPanel readiness is complete
- live verification plan is complete
- deployment operator accepts the package
- final deployment approval remains pending or recorded separately

## Handoff fail criteria

Handoff fails when:

- package source is unclear
- package contents are unclear
- package contains protected files
- rollback is unclear
- backup is unclear
- deployment operator lacks required documents
- final approval is assumed without sign-off

## Handoff decision

Handoff status: pending  
Deployment operator: pending  
Approved commit: pending  
Package filename: pending  
Decision owner: pending  
Decision date: pending  
Open issues: pending  

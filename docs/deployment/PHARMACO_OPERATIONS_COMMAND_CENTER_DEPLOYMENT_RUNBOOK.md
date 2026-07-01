# PharmaCo360 Operations Command Center Deployment Runbook

## Purpose

Defines the command-by-command evidence structure for a future authorized deployment.

This is not a deployment script. It does not create a package, upload files, copy production files, run cPanel commands, run migrations, or deploy to production.

## Identity

Product: PharmaCo360  
Area: Operations command center  
Baseline before Phase 15.9: 368af4b  
Status: pending authorization

## Runbook principle

Every future deployment action must be authorized, assigned, executed by the named operator, captured as evidence, verified, and stopped if a rollback trigger appears.

## Command sequence register

| Step | Category | Action | Owner | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Source identity | Confirm GitHub main commit | Pending | Pending | Pending |
| 2 | Release candidate | Confirm approved release candidate | Pending | Pending | Pending |
| 3 | Package generation | Confirm package generation authorization | Pending | Pending | Pending |
| 4 | Checksum | Confirm package checksum evidence | Pending | Pending | Pending |
| 5 | Protected files | Confirm protected-file inspection | Pending | Pending | Pending |
| 6 | Transfer | Confirm package transfer authorization | Pending | Pending | Pending |
| 7 | cPanel | Confirm cPanel execution authorization | Pending | Pending | Pending |
| 8 | Pre-check | Capture production pre-check evidence | Pending | Pending | Pending |
| 9 | File operation | Capture authorized production file action | Pending | Pending | Pending |
| 10 | Post-check | Capture production post-check evidence | Pending | Pending | Pending |
| 11 | Rollback | Confirm rollback readiness remains active | Pending | Pending | Pending |
| 12 | Verification | Capture live verification evidence | Pending | Pending | Pending |
| 13 | Closure | Capture release owner closure | Pending | Pending | Pending |

## Required controls

- execution authorization must be complete
- operator must be assigned
- rollback owner must be assigned
- evidence recorder must be assigned
- each step must have evidence
- rollback trigger status must be checked before each action
- no destructive database command may be used
- no protected production file may be overwritten without explicit approval

## Prohibited unless separately authorized

- package archive creation
- package upload
- production file copy
- production `.env` edit
- production storage overwrite
- production migration execution
- destructive database command
- DNS change
- permission change
- service restart

## Pass criteria

The runbook passes when command sequence, owner, evidence, authorization, prohibited-command, and rollback trigger controls are present.

## Status

Runbook status: pending  
Deployment operator: pending  
Evidence recorder: pending  
Rollback owner: pending  
Release owner: pending  

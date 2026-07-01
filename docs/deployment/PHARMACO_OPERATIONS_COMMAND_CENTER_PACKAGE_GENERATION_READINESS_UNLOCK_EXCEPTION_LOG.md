# PharmaCo360 Operations Command Center Package Generation Readiness Unlock Exception Log

## Purpose

Defines the exception log required before any package generation readiness lock can be changed from locked to unlocked for controlled dry-run review.

This document does not create a package archive, execute package generation, generate checksums, execute approval, upload files, copy production files, run cPanel commands, run migrations, deploy to production, or mutate data.

This document does not execute package generation.

## Identity

Product: PharmaCo360  
Area: Operations command center  
Baseline before Phase 16.6: e608282  
Unlock exception log status: pending authorization

## Unlock exception principle

Any unlock exception must be documented, assigned, reviewed, corrected, and closed before a future package generation dry-run can be considered.

The default decision for unresolved unlock exceptions is stop.

## Unlock exception log

| Exception ID | Readiness area | Exception type | Owner | Required correction | Status |
| --- | --- | --- | --- | --- | --- |
| UNLOCK-EXC-001 | Source identity | Missing or inconsistent source identity | Pending | Confirm approved branch and commit | Pending |
| UNLOCK-EXC-002 | Protected-file inspection | Protected tracked source finding | Pending | Remove or resolve protected tracked source finding | Pending |
| UNLOCK-EXC-003 | Manifest preview | Missing manifest preview closure | Pending | Complete manifest preview closure | Pending |
| UNLOCK-EXC-004 | Exclusion preview | Missing exclusion preview closure | Pending | Complete exclusion preview closure | Pending |
| UNLOCK-EXC-005 | Checksum preview | Missing checksum preview closure | Pending | Complete checksum preview closure | Pending |
| UNLOCK-EXC-006 | Approval evidence | Missing approval evidence closure | Pending | Complete approval evidence closure | Pending |
| UNLOCK-EXC-007 | Evidence manifest | Missing evidence manifest review | Pending | Complete evidence manifest review | Pending |
| UNLOCK-EXC-008 | Command binder | Missing command binder review | Pending | Complete command binder review | Pending |
| UNLOCK-EXC-009 | Authorization gate | Missing authorization gate review | Pending | Complete authorization gate review | Pending |
| UNLOCK-EXC-010 | Final readiness decision | Missing lock or unlock decision | Pending | Record final readiness decision | Pending |

## Required exception types

Unlock exception handling must support:

- missing evidence
- incomplete evidence
- conflicting evidence
- unresolved finding
- protected-file finding
- missing owner
- missing reviewer
- missing storage placeholder
- missing decision
- unapproved unlock request

## Exception outcomes

Allowed exception outcomes:

- corrected
- accepted with observation
- deferred
- rejected
- escalated
- stopped

## Escalation rules

The readiness unlock process must escalate if:

- source identity is unclear
- protected-file inspection is not clean
- package inclusion evidence is incomplete
- package exclusion evidence is incomplete
- checksum evidence is incomplete
- approval closure evidence is incomplete
- command binder evidence is incomplete
- authorization gate evidence is incomplete
- any exception remains unresolved
- final readiness decision is missing

## Prohibited action boundary

This unlock exception log does not authorize package archive creation, package generation execution, checksum generation, approval execution, package upload, cPanel execution, production file copy, production deployment, production migration, database rollback, environment overwrite, storage overwrite, DNS change, permission change, or service restart.

## Pass criteria

The package generation readiness unlock exception log passes when exception rows, exception types, exception outcomes, escalation rules, default stop decision, and prohibited action boundary are present.

## Status

Unlock exception log status: pending  
Default unresolved exception decision: stop  
Exception owner: pending  
Reviewer: pending  
Final readiness decision: pending  
Open findings: pending  

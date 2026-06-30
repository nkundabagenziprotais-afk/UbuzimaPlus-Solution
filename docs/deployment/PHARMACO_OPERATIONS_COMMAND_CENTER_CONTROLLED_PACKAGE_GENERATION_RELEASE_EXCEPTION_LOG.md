# PharmaCo360 Operations Command Center Controlled Package Generation Release Exception Log

## Purpose

Defines the exception log required before any controlled package generation authorization release decision can be recorded.

This document does not create a package archive.  
This document does not execute package generation.  
This document does not generate checksums.  
This document does not execute approval.  
This document does not upload files, copy production files, run cPanel commands, run migrations, deploy to production, or mutate data.

## Identity

Product: PharmaCo360  
Area: Operations command center  
Baseline before Phase 16.7: 64e3aea  
Controlled release exception log status: pending  
Default unresolved exception decision: stop

## Controlled release exception principle

Any exception affecting package generation authorization release must be documented, assigned, reviewed, corrected, escalated, or stopped before a future controlled package generation authorization review can proceed.

The default decision for unresolved release exceptions is stop.

## Controlled release exception log

| Exception ID | Release area | Exception type | Owner | Required correction | Status |
| --- | --- | --- | --- | --- | --- |
| RELEASE-EXC-001 | Source identity | Missing or inconsistent source identity | Pending | Confirm approved branch and commit | Pending |
| RELEASE-EXC-002 | Readiness lock | Readiness lock unresolved | Pending | Complete readiness lock review | Pending |
| RELEASE-EXC-003 | Unlock exceptions | Unresolved unlock exception | Pending | Close or escalate unlock exception | Pending |
| RELEASE-EXC-004 | Approval evidence | Missing approval evidence closure | Pending | Complete approval evidence closure | Pending |
| RELEASE-EXC-005 | Manifest preview | Missing manifest preview closure | Pending | Complete manifest preview closure | Pending |
| RELEASE-EXC-006 | Exclusion preview | Missing exclusion preview closure | Pending | Complete exclusion preview closure | Pending |
| RELEASE-EXC-007 | Checksum preview | Missing checksum preview closure | Pending | Complete checksum preview closure | Pending |
| RELEASE-EXC-008 | Protected-file inspection | Protected tracked source finding | Pending | Resolve protected tracked source finding | Pending |
| RELEASE-EXC-009 | Command binder | Missing command binder review | Pending | Complete command binder review | Pending |
| RELEASE-EXC-010 | Authorization gate | Missing authorization gate review | Pending | Complete authorization gate review | Pending |
| RELEASE-EXC-011 | Final decision | Missing authorization release decision | Pending | Record final authorization release decision | Pending |

## Required exception types

Controlled release exception handling must support:

- missing evidence
- incomplete evidence
- conflicting evidence
- unresolved readiness lock
- unresolved unlock exception
- unresolved approval exception
- protected-file finding
- missing owner
- missing reviewer
- missing storage placeholder
- missing final release decision
- unapproved release request

## Exception outcomes

Allowed exception outcomes:

- corrected
- accepted with observation
- deferred
- rejected
- escalated
- stopped

## Escalation rules

The controlled authorization release process must escalate if:

- source identity is unclear
- readiness lock remains unresolved
- unlock exception remains unresolved
- approval evidence is incomplete
- package inclusion evidence is incomplete
- package exclusion evidence is incomplete
- checksum evidence is incomplete
- protected-file inspection is not clean
- command binder evidence is incomplete
- authorization gate evidence is incomplete
- final authorization release decision is missing

## Prohibited action boundary

This release exception log does not authorize package archive creation, package generation execution, checksum generation, approval execution, package upload, cPanel execution, production file copy, production deployment, production migration, database rollback, environment overwrite, storage overwrite, DNS change, permission change, or service restart.

## Pass criteria

The controlled package generation release exception log passes when exception rows, exception types, exception outcomes, escalation rules, default stop decision, and prohibited action boundary are present.

## Status

Controlled release exception log status: pending  
Default unresolved exception decision: stop  
Exception owner: pending  
Reviewer: pending  
Final authorization release decision: pending  
Open findings: pending  

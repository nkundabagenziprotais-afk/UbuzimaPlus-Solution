# PharmaCo360 Operations Command Center Controlled Package Generation Execution Decision Exception Log

## Purpose

Defines the exception log required before any controlled package generation execution decision hold can be reviewed.

This document does not create a package archive.  
This document does not execute package generation.  
This document does not generate checksums.  
This document does not execute approval.  
This document does not release a package generation command.  
This document does not authorize final execution.  
This document does not upload files, copy production files, run cPanel commands, run migrations, deploy to production, or mutate data.

## Identity

Product: PharmaCo360  
Area: Operations command center  
Baseline before Phase 17.1: 0c56ac6  
Execution decision exception log status: pending  
Default unresolved exception decision: stop

## Execution decision exception principle

Any exception affecting the execution decision hold must be documented, assigned, reviewed, corrected, escalated, or stopped before a future controlled package generation execution approval review can proceed.

The default decision for unresolved execution decision exceptions is stop.

## Execution decision exception log

| Exception ID | Decision area | Exception type | Owner | Required correction | Status |
| --- | --- | --- | --- | --- | --- |
| DEC-EXC-001 | Source branch | Missing or inconsistent source branch | Pending | Confirm approved source branch | Pending |
| DEC-EXC-002 | Source commit | Missing or inconsistent source commit | Pending | Confirm approved source commit | Pending |
| DEC-EXC-003 | Main alignment | Missing main promotion evidence | Pending | Confirm main promotion evidence | Pending |
| DEC-EXC-004 | Development alignment | Missing development final sync evidence | Pending | Confirm development final sync evidence | Pending |
| DEC-EXC-005 | Final authorization packet | Missing final execution authorization packet closure | Pending | Complete final authorization packet review | Pending |
| DEC-EXC-006 | Final authorization exceptions | Unresolved final authorization exceptions | Pending | Resolve final authorization exceptions | Pending |
| DEC-EXC-007 | Command release hold | Missing command release hold closure | Pending | Complete command release hold review | Pending |
| DEC-EXC-008 | Execution preflight | Missing execution evidence preflight closure | Pending | Complete execution evidence preflight review | Pending |
| DEC-EXC-009 | Authorization release | Missing controlled authorization release closure | Pending | Complete authorization release review | Pending |
| DEC-EXC-010 | Readiness lock | Readiness lock unresolved | Pending | Complete readiness lock review | Pending |
| DEC-EXC-011 | Approval evidence | Missing approval evidence closure | Pending | Complete approval evidence closure | Pending |
| DEC-EXC-012 | Manifest preview | Missing manifest preview closure | Pending | Complete manifest preview closure | Pending |
| DEC-EXC-013 | Exclusion preview | Missing exclusion preview closure | Pending | Complete exclusion preview closure | Pending |
| DEC-EXC-014 | Checksum preview | Missing checksum preview closure | Pending | Complete checksum preview closure | Pending |
| DEC-EXC-015 | Protected-file inspection | Protected tracked source finding | Pending | Resolve protected tracked source finding | Pending |
| DEC-EXC-016 | Rollback reference | Missing rollback reference placeholder | Pending | Record rollback reference placeholder | Pending |
| DEC-EXC-017 | Operator identity | Missing command operator identity | Pending | Record operator identity placeholder | Pending |
| DEC-EXC-018 | Execution decision | Missing execution decision | Pending | Record execution decision | Pending |

## Required exception types

Execution decision exception handling must support:

- missing evidence
- incomplete evidence
- conflicting evidence
- unresolved final execution authorization
- unresolved command release hold
- unresolved execution evidence preflight
- unresolved authorization release
- unresolved readiness lock
- unresolved approval evidence
- protected-file finding
- missing command identity
- missing command operator
- missing evidence recorder
- missing rollback reference
- missing output placeholder
- missing checksum placeholder
- missing evidence storage placeholder
- missing execution decision
- unapproved execution decision request

## Exception outcomes

Allowed exception outcomes:

- corrected
- accepted with observation
- deferred
- rejected
- escalated
- stopped

## Escalation rules

The controlled execution decision hold process must escalate if:

- source identity is unclear
- main promotion evidence is missing
- development final sync evidence is missing
- final execution authorization packet is incomplete
- final execution authorization exceptions are unresolved
- command release hold remains unresolved
- execution evidence preflight remains unresolved
- authorization release remains unresolved
- readiness lock remains unresolved
- approval evidence is incomplete
- package inclusion evidence is incomplete
- package exclusion evidence is incomplete
- checksum evidence is incomplete
- protected-file inspection is not clean
- command identity is missing
- operator identity is missing
- rollback reference is missing
- evidence storage placeholder is missing
- execution decision is missing

## Prohibited action boundary

This execution decision exception log does not authorize package archive creation, package generation execution, checksum generation, approval execution, package command release, final execution authorization, package upload, cPanel execution, production file copy, production deployment, production migration, database rollback, environment overwrite, storage overwrite, DNS change, permission change, or service restart.

## Pass criteria

The controlled package generation execution decision exception log passes when exception rows, exception types, exception outcomes, escalation rules, default stop decision, and prohibited action boundary are present.

## Status

Execution decision exception log status: pending  
Default unresolved exception decision: stop  
Exception owner: pending  
Reviewer: pending  
Execution decision: pending  
Open findings: pending  

# PharmaCo360 Operations Command Center Dry-Run Approval Evidence Exception Log

## Purpose

Defines the exception log required when approval evidence is missing, unclear, unowned, unreviewed, or inconsistent before a future package generation dry-run.

This document does not execute approval, generate checksums, create a package archive, execute package generation, upload files, copy production files, run cPanel commands, run migrations, deploy to production, or mutate data.

## Identity

Product: PharmaCo360  
Area: Operations command center  
Baseline before Phase 16.5: 0932b7e  
Exception log status: pending authorization

## Exception principle

Any missing or incomplete evidence must be recorded before a future package generation command is executed.

The default decision for unresolved exceptions is stop.

## Exception log

| Exception ID | Evidence area | Exception type | Owner | Required correction | Status |
| --- | --- | --- | --- | --- | --- |
| APPROVAL-EXC-001 | Source identity | Missing or inconsistent source evidence | Pending | Record approved branch and commit | Pending |
| APPROVAL-EXC-002 | Manifest preview | Missing or incomplete manifest preview | Pending | Complete manifest preview review | Pending |
| APPROVAL-EXC-003 | Exclusion preview | Missing or incomplete exclusion preview | Pending | Complete exclusion preview review | Pending |
| APPROVAL-EXC-004 | Checksum preview | Missing or incomplete checksum preview | Pending | Complete checksum preview review | Pending |
| APPROVAL-EXC-005 | Checksum review | Missing or incomplete checksum review index | Pending | Complete checksum review index | Pending |
| APPROVAL-EXC-006 | Evidence manifest | Missing or incomplete evidence manifest | Pending | Complete evidence manifest review | Pending |
| APPROVAL-EXC-007 | Command binder | Missing or incomplete command binder review | Pending | Complete command binder review | Pending |
| APPROVAL-EXC-008 | Authorization gate | Missing or incomplete authorization gate review | Pending | Complete authorization gate review | Pending |
| APPROVAL-EXC-009 | Owner assignment | Missing owner or reviewer | Pending | Assign owner and reviewer | Pending |
| APPROVAL-EXC-010 | Closure decision | Missing stop-or-continue decision | Pending | Record closure decision | Pending |

## Required exception types

Exception handling must support:

- missing evidence
- incomplete evidence
- conflicting evidence
- unclear source identity
- missing owner
- missing reviewer
- missing storage placeholder
- missing decision
- unapproved correction
- unresolved finding

## Exception outcomes

Allowed exception outcomes:

- corrected
- accepted with observation
- deferred
- rejected
- escalated
- stopped

## Escalation rules

The dry-run process must escalate if:

- an exception remains unresolved
- the correction owner is missing
- the reviewer is missing
- the evidence area affects source identity
- the evidence area affects package inclusion
- the evidence area affects package exclusion
- the evidence area affects checksum preview
- the evidence area affects approval closure

## Prohibited action boundary

This exception log does not authorize approval execution, checksum generation, package archive creation, package generation execution, package upload, cPanel execution, production file copy, production deployment, production migration, database rollback, environment overwrite, storage overwrite, DNS change, permission change, or service restart.

## Pass criteria

The approval evidence exception log passes when exception rows, exception types, exception outcomes, escalation rules, and prohibited action boundary are present.

## Status

Approval evidence exception log status: pending  
Exception owner: pending  
Reviewer: pending  
Closure decision: pending  
Open findings: pending  

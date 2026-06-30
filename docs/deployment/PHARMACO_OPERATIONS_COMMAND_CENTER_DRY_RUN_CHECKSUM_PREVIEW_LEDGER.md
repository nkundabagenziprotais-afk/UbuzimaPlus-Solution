# PharmaCo360 Operations Command Center Dry-Run Checksum Preview Ledger

## Purpose

Defines the checksum preview ledger required before a future package generation dry-run.

This document does not generate checksums, create a package archive, execute package generation, upload files, copy production files, run cPanel commands, run migrations, deploy to production, or mutate data.

## Identity

Product: PharmaCo360  
Area: Operations command center  
Baseline before Phase 16.4: 227da72  
Ledger status: pending authorization

## Checksum preview principle

Checksum evidence must be planned before any future package generation command is executed.

The preview must identify the checksum method, expected checksum evidence, reviewer, storage reference, and closure decision without generating an actual checksum.

## Required checksum owners

- release owner
- dry-run owner
- checksum preview owner
- evidence recorder
- package generation owner
- technical reviewer
- final go/no-go owner

## Checksum preview ledger

| Checksum ID | Preview area | Expected evidence | Owner | Status |
| --- | --- | --- | --- | --- |
| CHECKSUM-PREV-001 | Source branch | Approved branch name | Pending | Pending |
| CHECKSUM-PREV-002 | Source commit | Approved commit hash | Pending | Pending |
| CHECKSUM-PREV-003 | Package name placeholder | Future package naming convention | Pending | Pending |
| CHECKSUM-PREV-004 | Checksum method | Future checksum command and algorithm | Pending | Pending |
| CHECKSUM-PREV-005 | Checksum output location | Future storage reference | Pending | Pending |
| CHECKSUM-PREV-006 | Manifest alignment | Link to manifest preview ledger | Pending | Pending |
| CHECKSUM-PREV-007 | Exclusion alignment | Link to exclusion preview ledger | Pending | Pending |
| CHECKSUM-PREV-008 | Reviewer assignment | Technical reviewer and release owner | Pending | Pending |
| CHECKSUM-PREV-009 | Evidence capture | Screenshot or command output placeholder | Pending | Pending |
| CHECKSUM-PREV-010 | Closure decision | Stop or continue decision | Pending | Pending |

## Allowed checksum preview methods

Allowed preview methods:

- SHA256 command preview
- SHA256 evidence placeholder
- package name placeholder
- checksum register placeholder
- reviewer confirmation placeholder

The actual checksum must not be generated in this phase.

## Review checkpoints

The checksum preview must be reviewed for:

- source branch correctness
- source commit correctness
- package naming convention
- checksum method clarity
- evidence storage placeholder
- reviewer assignment
- manifest preview alignment
- exclusion preview alignment
- closure decision capture

## Stop conditions

The future dry-run process must stop if:

- checksum method is unclear
- package name placeholder is missing
- reviewer is not assigned
- evidence storage is not assigned
- checksum preview is not aligned with manifest preview
- checksum preview is not aligned with exclusion preview
- closure decision is not recorded

## Prohibited action boundary

This ledger does not authorize checksum generation, package archive creation, package generation execution, package upload, cPanel execution, production file copy, production deployment, production migration, database rollback, environment overwrite, storage overwrite, DNS change, permission change, or service restart.

## Pass criteria

The checksum preview ledger passes when required owners, checksum preview rows, allowed preview methods, review checkpoints, stop conditions, and prohibited action boundary are present.

## Status

Checksum preview ledger status: pending  
Checksum preview owner: pending  
Evidence recorder: pending  
Closure decision: pending  
Open findings: pending  

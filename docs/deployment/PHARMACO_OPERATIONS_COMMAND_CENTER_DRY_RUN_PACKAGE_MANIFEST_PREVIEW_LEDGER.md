# PharmaCo360 Operations Command Center Dry-Run Package Manifest Preview Ledger

## Purpose

Defines the ledger required to preview what a future package generation dry-run would include.

This document does not create a package archive, execute package generation, upload files, copy production files, run cPanel commands, run migrations, deploy to production, or mutate data.

## Identity

Product: PharmaCo360  
Area: Operations command center  
Baseline before Phase 16.3: b5704ef  
Ledger status: pending authorization

## Manifest preview principle

A package manifest preview must be reviewed before any future package generation command is executed.

The preview must confirm the expected source identity, approved tracked source inventory, inclusion categories, review owner, and closure decision.

## Required preview owners

- release owner
- dry-run owner
- manifest preview owner
- evidence recorder
- technical reviewer
- package generation owner
- final go/no-go owner

## Manifest preview ledger

| Preview ID | Preview area | Expected evidence | Owner | Status |
| --- | --- | --- | --- | --- |
| MANIFEST-PREV-001 | Source branch | Approved branch name | Pending | Pending |
| MANIFEST-PREV-002 | Source commit | Approved commit hash | Pending | Pending |
| MANIFEST-PREV-003 | Working tree | Clean working tree status | Pending | Pending |
| MANIFEST-PREV-004 | Tracked source inventory | Tracked source file count | Pending | Pending |
| MANIFEST-PREV-005 | Inclusion categories | Application source categories | Pending | Pending |
| MANIFEST-PREV-006 | Documentation inclusion | Required deployment docs | Pending | Pending |
| MANIFEST-PREV-007 | Script inclusion | Required guardrail scripts | Pending | Pending |
| MANIFEST-PREV-008 | Frontend build source | Source only, not generated archive | Pending | Pending |
| MANIFEST-PREV-009 | Backend source | Source only, not generated archive | Pending | Pending |
| MANIFEST-PREV-010 | Preview closure | Stop or continue decision | Pending | Pending |

## Required inclusion categories

The future dry-run manifest preview must identify:

- backend source files
- frontend source files
- deployment documentation
- guardrail scripts
- package evidence templates
- QA documentation
- architecture documentation
- configuration examples only where safe
- public assets that are intentionally tracked
- release control documents

## Review checkpoints

The manifest preview must be reviewed for:

- branch correctness
- commit correctness
- clean working tree status
- tracked source count consistency
- inclusion category clarity
- protected-file absence
- evidence owner assignment
- closure decision capture

## Prohibited action boundary

This ledger does not authorize package archive creation, package generation execution, package upload, cPanel execution, production file copy, production deployment, production migration, database rollback, environment overwrite, storage overwrite, DNS change, permission change, or service restart.

## Pass criteria

The manifest preview ledger passes when required owners, preview rows, inclusion categories, review checkpoints, and prohibited action boundary are present.

## Status

Manifest preview ledger status: pending  
Manifest preview owner: pending  
Evidence recorder: pending  
Closure decision: pending  
Open findings: pending  

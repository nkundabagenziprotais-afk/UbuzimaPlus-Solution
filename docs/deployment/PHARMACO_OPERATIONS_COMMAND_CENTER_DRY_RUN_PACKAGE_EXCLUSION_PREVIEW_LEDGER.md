# PharmaCo360 Operations Command Center Dry-Run Package Exclusion Preview Ledger

## Purpose

Defines the ledger required to preview what a future package generation dry-run must exclude.

This document does not create a package archive, execute package generation, upload files, copy production files, run cPanel commands, run migrations, deploy to production, or mutate data.

## Identity

Product: PharmaCo360  
Area: Operations command center  
Baseline before Phase 16.3: b5704ef  
Ledger status: pending authorization

## Exclusion preview principle

A package exclusion preview must confirm that protected files, local runtime files, generated archives, and unsafe production materials are excluded before any future package generation command is executed.

## Required exclusion owners

- release owner
- dry-run owner
- exclusion preview owner
- evidence recorder
- technical reviewer
- package generation owner
- final go/no-go owner

## Exclusion preview ledger

| Exclusion ID | Exclusion area | Expected exclusion | Owner | Status |
| --- | --- | --- | --- | --- |
| EXCLUSION-PREV-001 | Environment files | .env and production env files | Pending | Pending |
| EXCLUSION-PREV-002 | Local database files | SQLite and local database files | Pending | Pending |
| EXCLUSION-PREV-003 | Storage logs | Runtime logs and local storage logs | Pending | Pending |
| EXCLUSION-PREV-004 | Dependencies | node_modules and vendor runtime rebuilds where applicable | Pending | Pending |
| EXCLUSION-PREV-005 | System files | .DS_Store and local OS files | Pending | Pending |
| EXCLUSION-PREV-006 | Archives | zip, tar, tar.gz, and previous package files | Pending | Pending |
| EXCLUSION-PREV-007 | Backups | backup folders and backup archives | Pending | Pending |
| EXCLUSION-PREV-008 | Secrets | keys, credentials, tokens, and unapproved secrets | Pending | Pending |
| EXCLUSION-PREV-009 | Production runtime | production-only runtime files | Pending | Pending |
| EXCLUSION-PREV-010 | Preview closure | Stop or continue decision | Pending | Pending |

## Required exclusion categories

The future dry-run exclusion preview must identify:

- environment files
- local database files
- storage logs
- dependency directories
- generated archives
- previous release archives
- backup files
- local OS files
- unapproved credentials
- production-only runtime files

## Stop conditions

The dry-run process must stop if:

- any protected file is tracked
- exclusion rules are missing
- exclusion owner is not assigned
- evidence recorder is not assigned
- manifest preview and exclusion preview do not align
- closure decision is not recorded

## Prohibited action boundary

This ledger does not authorize package archive creation, package generation execution, package upload, cPanel execution, production file copy, production deployment, production migration, database rollback, environment overwrite, storage overwrite, DNS change, permission change, or service restart.

## Pass criteria

The exclusion preview ledger passes when required owners, exclusion rows, exclusion categories, stop conditions, and prohibited action boundary are present.

## Status

Exclusion preview ledger status: pending  
Exclusion preview owner: pending  
Evidence recorder: pending  
Closure decision: pending  
Open findings: pending  

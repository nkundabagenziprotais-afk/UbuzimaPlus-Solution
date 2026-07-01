# PharmaCo360 Operations Command Center Package Generation Dry-Run Command Binder

## Purpose

Defines the command binder required before any future package generation dry-run.

This document does not generate a package archive, upload files, copy production files, run cPanel commands, run migrations, deploy to production, or mutate data.

## Identity

Product: PharmaCo360  
Area: Operations command center  
Baseline before Phase 16.1: f86b401  
Binder status: pending authorization

## Dry-run principle

A package generation dry-run must be reviewed as a command preview before any command is executed.

The dry-run binder must prove that the command intent, source branch, source commit, exclusions, destination, evidence owner, and stop conditions are understood before execution.

## Required binder owners

- release owner
- dry-run owner
- package generation owner
- evidence recorder
- technical reviewer
- rollback owner
- final go/no-go owner

## Command preview register

| Step | Command intent | Owner | Evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | Confirm source branch | Pending | Pending | Pending |
| 2 | Confirm source commit | Pending | Pending | Pending |
| 3 | Confirm working tree status | Pending | Pending | Pending |
| 4 | Confirm package exclusions | Pending | Pending | Pending |
| 5 | Confirm protected-file scan | Pending | Pending | Pending |
| 6 | Confirm dry-run destination | Pending | Pending | Pending |
| 7 | Confirm manifest preview | Pending | Pending | Pending |
| 8 | Confirm checksum method preview | Pending | Pending | Pending |
| 9 | Confirm stop conditions | Pending | Pending | Pending |
| 10 | Confirm dry-run decision | Pending | Pending | Pending |

## Required dry-run command categories

- source identity check
- branch status check
- tracked source inventory check
- protected-file inspection check
- package exclusion preview
- package destination preview
- manifest preview
- checksum method preview
- evidence capture preview
- stop decision checkpoint

## Stop conditions

The dry-run must stop if:

- source branch is not approved
- source commit does not match the approved release commit
- working tree is dirty
- protected files are detected
- package exclusions are unclear
- package destination is unclear
- evidence recorder is not assigned
- rollback owner is not assigned
- authorization decision is missing

## Prohibited command boundary

This binder does not authorize:

- archive creation
- package upload
- production file copy
- cPanel execution
- production migration execution
- production environment overwrite
- production storage overwrite
- destructive database command
- DNS change
- permission change
- service restart

## Pass criteria

The binder passes when command preview, owners, stop conditions, package exclusions, protected-file inspection, manifest preview, checksum preview, and prohibited command boundary are present.

## Status

Dry-run binder status: pending  
Dry-run owner: pending  
Evidence recorder: pending  
Authorization decision: pending  
Open findings: pending  

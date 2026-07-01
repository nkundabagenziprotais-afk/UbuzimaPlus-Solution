# PharmaCo360 Operations Command Center Package Dry-Run Checklist

## Purpose

This checklist defines the local dry-run controls required before creating any approved PharmaCo360 operations command center production package.

This document does not create, copy, upload, or deploy a production package. It defines the dry-run verification steps that must happen before package generation is approved.

## Dry-run identity

Product: PharmaCo360  
Area: Operations command center  
Evidence type: Local package dry-run readiness  
Source of truth: GitHub main  
Baseline before Phase 15.3: bb51430  

## Dry-run principle

Before a production package is created, the team must simulate package readiness locally and confirm:

- approved source branch is known
- approved source commit is known
- working tree is clean before final package generation
- package contents are predictable
- protected files are excluded
- build outputs are ready
- validation evidence is complete
- manifest and checksum evidence can be completed after final package creation

## Required dry-run checks

Confirm:

- source branch is main for approved package generation
- source commit matches approved release commit
- package manifest checklist exists
- checksum evidence checklist exists
- deployment handoff checklist exists
- protected-file inspection checklist exists
- backend tests passed after latest merge
- public website build passed after latest merge
- admin dashboard build passed after latest merge
- package handoff guardrail passed
- package manifest guardrail passed
- dry-run guardrail passed

## Required file inventory checks

Dry-run inventory must inspect:

- tracked application files
- deployment documentation
- validation scripts
- public website build path
- admin dashboard build path
- Laravel public directory
- package exclusion candidates
- protected-file candidates

## Required package exclusion simulation

Dry-run must simulate exclusion of:

- `.env`
- `.env` backups
- local database files
- SQLite databases
- logs
- cache files
- `node_modules`
- temporary files
- OS metadata files
- production user uploads
- production backups

## Dry-run pass criteria

Dry-run passes when:

- source is traceable to approved GitHub main
- required deployment documents exist
- required guardrail scripts exist
- package exclusions are documented
- protected-file inspection is documented
- no protected file is approved for package inclusion
- validation evidence is complete

## Dry-run fail criteria

Dry-run fails when:

- source branch is unclear
- source commit is unclear
- protected-file inspection is missing
- package manifest is missing
- checksum checklist is missing
- deployment handoff checklist is missing
- protected files are approved for package inclusion
- validation evidence is missing

## Dry-run decision

Dry-run status: pending  
Approved commit: pending  
Dry-run operator: pending  
Reviewer: pending  
Decision date: pending  
Open issues: pending  

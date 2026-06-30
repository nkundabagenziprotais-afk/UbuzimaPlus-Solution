# PharmaCo360 Operations Command Center Package Generation Dry-Run

## Purpose

This document defines the controlled local dry-run process for future PharmaCo360 operations command center production package generation.

This phase does not create a production package archive, upload a package, copy production files, or deploy to production. It only confirms that the future package generation process can be reviewed safely before execution.

## Dry-run identity

Product: PharmaCo360  
Area: Operations command center  
Evidence type: Controlled package generation dry-run  
Source of truth: GitHub main  
Baseline before Phase 15.4: 9f7d4ca  

## Dry-run principle

Before any real production package is generated, the team must confirm:

- approved source commit is known
- package generation source is GitHub main
- local working tree is clean
- deployment documents exist
- package manifest checklist exists
- checksum evidence checklist exists
- package dry-run checklist exists
- protected-file inspection checklist exists
- protected tracked source inspection passes
- expected package inventory can be reviewed without producing an archive

## Dry-run boundary

This dry-run must not:

- create a production zip file
- create a production tar file
- upload any package
- copy files to cPanel
- execute commands on production
- overwrite `.env`
- overwrite production storage
- run production migrations
- run destructive commands
- change DNS
- change server permissions

## Required generation dry-run checks

Confirm:

- current branch is a controlled review branch or approved main
- source commit is recorded
- git status is reviewed
- tracked file inventory is available
- protected-file scan passes
- deployment handoff document exists
- package manifest checklist exists
- checksum checklist exists
- package dry-run checklist exists
- protected-file inspection checklist exists
- production deployment runbook exists
- cPanel dry-run checklist exists
- validation scripts pass

## Inventory-only dry-run evidence

The dry-run inventory must show:

- tracked source files can be listed
- package documentation can be identified
- guardrail scripts can be identified
- frontend build paths are known
- backend application paths are known
- protected files are excluded from approved package inclusion

The inventory is for review only and is not a package.

## Future real package generation prerequisites

A future real package may only be generated after:

- final approval is recorded
- approved main commit is recorded
- validation evidence is complete
- protected-file inspection passes
- package manifest is ready
- checksum register is ready
- backup and rollback evidence is ready
- deployment operator is assigned

## Dry-run pass criteria

Generation dry-run passes when:

- no protected tracked files are found
- required deployment documents exist
- required guardrail scripts exist
- source commit can be identified
- inventory-only evidence can be produced
- no archive or upload is created
- reviewer can confirm readiness

## Dry-run fail criteria

Generation dry-run fails when:

- protected tracked files are found
- required deployment documents are missing
- required guardrail scripts are missing
- source commit is unclear
- git status is unclear
- archive creation is attempted
- package upload is attempted
- production commands are attempted

## Dry-run decision

Dry-run status: pending  
Source commit: pending  
Dry-run operator: pending  
Reviewer: pending  
Decision date: pending  
Open findings: pending  

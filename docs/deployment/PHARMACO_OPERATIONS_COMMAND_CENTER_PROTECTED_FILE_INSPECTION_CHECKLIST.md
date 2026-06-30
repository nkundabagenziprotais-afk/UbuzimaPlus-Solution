# PharmaCo360 Operations Command Center Protected-File Inspection Checklist

## Purpose

This checklist defines protected-file inspection controls for the PharmaCo360 operations command center production package.

It prevents secrets, local databases, logs, caches, temporary files, and production-only assets from being included in any package.

## Inspection identity

Product: PharmaCo360  
Area: Operations command center  
Evidence type: Protected-file inspection  
Source branch: main  
Baseline before Phase 15.3: bb51430  

## Protected-file principle

No production package should include files that expose secrets, local state, production data, temporary development artifacts, or runtime-only server content.

## Files that must not be packaged

Confirm exclusion of:

- `.env`
- `.env.local`
- `.env.production`
- `.env.backup`
- `.env.bak`
- `.env.old`
- local SQLite database files
- `database/database.sqlite`
- test database files
- storage logs
- Laravel cache files
- compiled local cache
- `node_modules`
- `.DS_Store`
- temporary archives
- local screenshots not required for deployment
- production backups
- production user uploads
- production runtime logs

## Files requiring special review

Review before inclusion:

- `.env.example`
- deployment notes
- generated build assets
- local package manifests
- screenshots used as evidence
- backup or rollback documentation
- scripts with server paths
- scripts with credentials or tokens

## Protected production assets

Package must not overwrite or replace:

- production `.env`
- production app key
- production database credentials
- production storage uploads
- production logs
- production backups
- production generated files
- production user-uploaded documents

## Inspection evidence to capture

Record:

- inspection date
- source commit
- inspector
- protected-file scan result
- package exclusion result
- reviewer
- decision
- unresolved findings

## Inspection pass criteria

Inspection passes when:

- protected-file scan is complete
- no protected files are approved for package inclusion
- special-review files are reviewed
- exclusions are documented
- reviewer is identified
- decision is recorded

## Inspection fail criteria

Inspection fails when:

- `.env` or backup secrets are present
- local database files are present
- logs or cache are present
- node_modules is included without explicit approval
- source commit is unclear
- reviewer is missing
- unresolved protected-file findings remain

## Inspection decision

Inspection status: pending  
Source commit: pending  
Inspector: pending  
Reviewer: pending  
Decision date: pending  
Open findings: pending  

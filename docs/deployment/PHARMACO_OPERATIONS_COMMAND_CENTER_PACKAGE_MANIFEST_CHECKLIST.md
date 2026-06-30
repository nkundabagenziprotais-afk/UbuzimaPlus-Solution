# PharmaCo360 Operations Command Center Package Manifest Checklist

## Purpose

This checklist defines the manifest evidence required for any approved PharmaCo360 operations command center production package.

This document does not build, copy, upload, or deploy a production package. It defines the required manifest controls before a package can be handed over for approved deployment.

## Release identity

Product: PharmaCo360  
Area: Operations command center  
Release type: Read-only operations dashboard and deployment documentation  
Source of truth: GitHub main  
Baseline before Phase 15.2: f453e81  

## Manifest principle

Every production package must have a manifest that proves:

- the package was created from the approved main commit
- the package contents are known
- protected files are excluded
- build outputs are traceable
- validation evidence is complete
- checksum evidence is recorded
- handoff owner and reviewer are identified

## Required manifest fields

Record:

- package name
- package version or release label
- approved main commit
- package build date
- package builder
- package reviewer
- source branch
- source repository
- package destination
- package filename
- package size
- checksum method
- checksum value
- handoff recipient
- approval reference
- rollback reference

## Required source traceability

Confirm:

- source branch is main
- source commit matches approved release
- working tree was clean before package build
- development branch was aligned with main before handoff
- validation was run after latest merge
- package was not created from local uncommitted work
- package was not created from production server files

## Required content groups

Manifest must identify whether the package contains:

- backend application source
- public directory assets
- public website build output
- admin dashboard build output
- deployment documentation
- release evidence documentation
- validation scripts
- package handoff documentation
- rollback documentation

## Required exclusion evidence

Manifest must confirm exclusion of:

- .env
- .env backup files
- local database files
- local SQLite databases
- test database files
- storage logs
- local cache files
- node_modules
- development screenshots not required for deployment
- temporary files
- OS metadata files such as .DS_Store

## Protected production assets

The package manifest must clearly state that the package must not overwrite:

- production `.env`
- production app key
- production database credentials
- production storage uploads
- production logs
- production backups
- production user-generated files

## Manifest pass criteria

Manifest passes when:

- approved source commit is recorded
- package filename is recorded
- package size is recorded
- checksum method and value are recorded
- required content groups are listed
- protected exclusions are confirmed
- backup and rollback references are recorded
- reviewer has signed off separately

## Manifest fail criteria

Manifest fails when:

- approved source commit is missing
- package filename is missing
- checksum evidence is missing
- package includes protected files
- package source is unclear
- validation evidence is missing
- rollback reference is missing
- reviewer is not identified

## Manifest decision

Manifest status: pending  
Approved commit: pending  
Package filename: pending  
Checksum method: pending  
Checksum value: pending  
Reviewer: pending  
Decision date: pending  

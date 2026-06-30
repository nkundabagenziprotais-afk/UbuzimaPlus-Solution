# PharmaCo360 Operations Command Center Production Package Build Checklist

## Purpose

This checklist defines how the PharmaCo360 operations command center production package must be prepared before any approved deployment handoff.

This document does not deploy to production. It defines package readiness, source control, exclusions, validation, and handoff evidence.

## Release identity

Product: PharmaCo360  
Area: Operations command center  
Release type: Read-only operations dashboard and deployment documentation  
Source of truth: GitHub main  
Baseline before Phase 15.1: eae1e9c  

## Package build principle

The production package must be generated only from the approved GitHub main commit.

The package must not be created from uncommitted local changes, development-only branches, local experiments, temporary files, or production server edits.

## Approved source register

Record before package build:

- approved main commit
- package build date
- package builder
- source branch
- validation evidence location
- package destination
- deployment operator
- reviewer
- handoff decision

## Required local validation before package build

Confirm these pass before packaging:

- command center guardrail
- operational alerts guardrail
- operator review guardrail
- executive summary guardrail
- release closure guardrail
- production deployment guardrail
- release evidence guardrail
- live verification guardrail
- go-live approval guardrail
- cPanel dry-run guardrail
- package handoff guardrail
- reporting UI guardrail
- backend tests
- public website build
- admin dashboard build

## Required package contents

Package should include:

- Laravel application source required for production
- public directory assets
- built public website assets where applicable
- built admin dashboard assets where applicable
- deployment documentation
- release evidence documentation
- command center verification scripts
- package handoff documentation

## Required package exclusions

Package must exclude:

- .env
- .env backups
- local database files
- local test databases
- node_modules
- vendor if Composer install will be performed separately by approved process
- storage logs
- local cache files
- development-only artifacts
- screenshots not required for deployment
- temporary files
- OS files such as .DS_Store

## Environment protection

The production package must not overwrite:

- production `.env`
- production database credentials
- production app key
- production storage files
- production user uploads
- production backups
- production logs

## Build evidence to capture

Capture:

- approved commit hash
- git status before package build
- backend test result
- public website build result
- admin dashboard build result
- package filename
- package checksum where applicable
- package size
- package location
- package reviewer
- handoff recipient

## Package failure triggers

Do not hand off the package if:

- source commit is unclear
- local working tree is dirty
- validation fails
- package includes `.env`
- package includes local database files
- package includes unwanted node_modules
- package includes logs or cache
- package is not traceable to approved main
- rollback evidence is missing

## Package approval decision

Package status: pending  
Approved commit: pending  
Package filename: pending  
Package checksum: pending  
Package builder: pending  
Reviewer: pending  
Decision date: pending  

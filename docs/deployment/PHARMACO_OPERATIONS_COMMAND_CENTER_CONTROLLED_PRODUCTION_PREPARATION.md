# PharmaCo360 Operations Command Center Controlled Production Deployment Preparation

## Purpose

This document prepares the PharmaCo360 operations command center for controlled production deployment review.

It does not authorize deployment. It confirms what must be ready before any approved cPanel production deployment is executed.

## Release identity

Product: PharmaCo360  
Area: Operations command center  
Release type: Read-only operations dashboard and deployment documentation  
Source of truth: GitHub main  
Baseline before Phase 15.0: 50d7b71  

## Controlled deployment principles

Production deployment must follow these principles:

- GitHub main remains the source of truth
- cPanel remains production runtime only
- no production data is wiped
- no destructive production command is used
- no deployment is executed without explicit approval
- deployment package must match approved main
- rollback point must be identified before execution
- production logs must be checked after execution

## Required readiness before deployment approval

Confirm:

- go-live approval dossier exists
- go-live readiness sign-off exists
- deployment execution checklist exists
- live verification pack exists
- release evidence index exists
- production deployment runbook exists
- rollback point is documented
- backup location is known
- production document root is known
- environment file is protected
- cPanel account and SSH access are confirmed

## cPanel readiness checklist

Before deployment, confirm:

- cPanel username is known
- hosting server is known
- SSH access is available where applicable
- production path is confirmed
- document root points to the Laravel public directory
- current live files are backed up
- current `.env` is backed up and not overwritten
- storage directory is writable
- cache directories are writable
- PHP version is compatible
- Composer is available where applicable
- Node build is completed locally or on build environment
- no temporary test files remain public

## Production backup readiness

Confirm:

- live application files backup location is prepared
- database backup method is confirmed
- `.env` backup is prepared
- rollback package is identified
- rollback owner is assigned
- restore commands are documented but not executed during dry-run

## Deployment package readiness

Confirm:

- approved main commit is recorded
- release package is generated from approved main
- package excludes local development files
- package excludes `.env`
- package excludes test artifacts
- package includes production build assets where applicable
- package preserves Laravel public directory structure

## Dry-run boundary

The dry-run may verify readiness, paths, checklists, and evidence.

The dry-run must not:

- copy files to production
- overwrite production files
- run production migrations
- clear production data
- change DNS
- change `.env`
- change file permissions on production
- restart production services
- trigger live deployment

## Not approved commands

Do not run these during dry-run:

- php artisan migrate:fresh --force
- php artisan db:wipe
- rm -rf on production paths
- cp or rsync into production document root
- composer install on production without approval
- npm build on production without approval
- any destructive database command

## Readiness decision

The deployment may proceed to an approved execution stage only after preparation evidence, backup readiness, rollback readiness, cPanel readiness, and go-live approval are complete.

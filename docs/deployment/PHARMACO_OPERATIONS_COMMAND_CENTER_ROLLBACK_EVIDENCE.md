# PharmaCo360 Operations Command Center Rollback Evidence

## Purpose

Defines rollback evidence placeholders for a future authorized deployment.

This document does not perform rollback, deploy, upload files, copy production files, run cPanel commands, run migrations, or change production data.

## Identity

Product: PharmaCo360  
Area: Operations command center  
Baseline before Phase 15.9: 368af4b  
Status: pending authorization

## Rollback principle

Rollback readiness must be confirmed before deployment execution starts and must remain available until post-deployment verification is complete.

## Required rollback roles

- rollback owner
- deployment operator
- evidence recorder
- release owner
- technical reviewer
- communication owner
- final go/no-go owner

## Rollback trigger register

| Trigger | Decision owner | Evidence | Status |
| --- | --- | --- | --- |
| Checksum mismatch | Pending | Pending | Pending |
| Protected-file inspection failure | Pending | Pending | Pending |
| Package transfer failure | Pending | Pending | Pending |
| Production pre-check failure | Pending | Pending | Pending |
| Production file operation failure | Pending | Pending | Pending |
| Production post-check failure | Pending | Pending | Pending |
| Public website verification failure | Pending | Pending | Pending |
| Admin dashboard verification failure | Pending | Pending | Pending |
| API health verification failure | Pending | Pending | Pending |
| Authentication verification failure | Pending | Pending | Pending |
| Reporting verification failure | Pending | Pending | Pending |
| Operator stop decision | Pending | Pending | Pending |
| Stakeholder no-go decision | Pending | Pending | Pending |

## Rollback readiness register

| Evidence item | Owner | Evidence | Status |
| --- | --- | --- | --- |
| Rollback owner assigned | Pending | Pending | Pending |
| Previous known-good commit recorded | Pending | Pending | Pending |
| Previous known-good package recorded | Pending | Pending | Pending |
| Protected-file boundary confirmed | Pending | Pending | Pending |
| Production `.env` exclusion confirmed | Pending | Pending | Pending |
| Production storage exclusion confirmed | Pending | Pending | Pending |
| Database rollback boundary confirmed | Pending | Pending | Pending |
| Rollback closure confirmation captured | Pending | Pending | Pending |

## Rollback command rule

Rollback commands remain placeholders until execution authorization, rollback scope, previous known-good reference, protected-file boundary, and rollback decision owner approval are complete.

## Boundary

This document does not authorize rollback execution, package upload, production file copy, production migration, database rollback, environment overwrite, storage overwrite, DNS change, permission change, or service restart.

## Pass criteria

Rollback evidence passes when roles, triggers, readiness register, protected-file boundary, environment exclusion, storage exclusion, and authorization boundary are present.

## Status

Rollback evidence status: pending  
Rollback owner: pending  
Previous known-good reference: pending  
Rollback decision owner: pending  

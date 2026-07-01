# Phase 18.6 — Controlled Package Generation Dry-Run Evidence

## Status

Dry-run evidence verification only.

No production migration is authorized.
No dependency installation on production is authorized.
No live deployment is authorized.
No final package generation is authorized until owner approval is explicitly granted.

## Required Dry-Run Evidence

Before package generation can proceed, the following must be verified:

1. Source branch is not a production branch.
2. Source branch is based on the latest development.
3. Protected tracked files are blocked.
4. Safe .env.example files are allowed.
5. Real .env files are blocked.
6. Private keys are blocked.
7. Credential files are blocked.
8. Secret files are blocked.
9. Production SQLite/database SQLite files are blocked.
10. Required Phase 18.5 guardrails pass.
11. Reporting UI guardrail passes.
12. Phase 0 local check passes.
13. Final owner authorization remains locked until explicitly granted.

## Evidence Capture Method

Evidence is captured through these local guardrail checks:

- scripts/pharmaco-operations-controlled-package-generation-dry-run-evidence-check.sh
- scripts/pharmaco-operations-controlled-package-generation-execution-package-contents-quarantine-ledger-check.sh
- scripts/pharmaco-reporting-ui-check.sh
- scripts/phase0-check.sh

## Owner Authorization Lock

The final owner authorization remains locked by default.

The dry-run evidence script checks the environment variable PHARMACO_CONTROLLED_PACKAGE_OWNER_AUTHORIZATION.

Any granted, authorized, yes, or true value fails the dry-run evidence check.

## Production Safety Boundary

This phase does not:

- run production migrations;
- install production dependencies;
- deploy live code;
- generate final production packages;
- copy real .env files;
- copy credentials;
- copy private keys;
- copy secret files;
- copy SQLite/database files.

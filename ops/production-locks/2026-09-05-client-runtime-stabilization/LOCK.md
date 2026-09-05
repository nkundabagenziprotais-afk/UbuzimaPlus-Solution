# Ubuzima+ Client Runtime Stabilization — CLOSED / LOCKED

Incident date: 2026-09-05

Status: CLOSED / LOCKED

Browser UAT:
- Previously affected desktop: PASS
- Previously affected phone: PASS

Validated Production runtime:

- Public bundle: index-runtime-55802496afdf.js
- Public SHA256: 55802496afdfa9dd5027a83dbf3d6abfa9182334d6057bfb05348de9d022d45e
- Admin bundle: admin-main-runtime-a026bbdf5432.js
- Admin SHA256: a026bbdf5432d4365c08137e2ad97392a40f5781d7eb6e085d7ac145b10692c6
- Root service worker SHA256: e2a1beaa7d23482b370b53cf3bf1a39e87e2556a241eb770adc137d34f4bac59
- Admin service worker SHA256: 8f153790006b2a40c1a599c25b415728d2b19e6678f71f9e0d5a721f218be5ec

Validated TEST state:

- Public runtime synchronized: PASS
- Admin runtime synchronized: PASS
- TEST public HTTP: PASS
- TEST Admin HTTP: PASS
- TEST API health: PASS

Runtime stabilization:

- Removed public whole-page continuous translation observation.
- Replaced public translation refresh with bounded passes.
- Removed redundant Admin 1200ms generic layout polling.
- Removed Admin shared analytics 5-second permanent polling.
- Removed Admin shared analytics whole-body characterData observation.

Protected systems:

- Authentication/session unchanged.
- Backend unchanged.
- Production database unchanged.
- Root and Admin service workers unchanged.
- POS/Sales extensions unchanged.
- Expenses unchanged.
- Finance business logic unchanged.
- Inventory business logic unchanged.

Production rollback backup:

/home/inzoeqqx/ubuzimaplus.com/_deploy_backups/client-runtime-stabilization-final-20260905_102137

Lock rule:

This validated runtime must not be replaced by an unrelated deployment.

Any future change affecting these runtime behaviors requires:
1. explicit incident reopen,
2. TEST verification,
3. browser UAT,
4. reviewed GitHub change.

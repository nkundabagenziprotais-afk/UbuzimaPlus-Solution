# Ubuzima+ Admin Stable Foundation

Established: 2026-07-25T13:18:39Z

## Foundation branch

`foundation/ubuzimaplus-admin-stable-20260725`

## Foundation base

This foundation starts from the verified repair commit:

`0bc862b0dd36452ac2b9cfe73c237110353d63a5`

Subject:

`fix(pos): restore historical date picker and product card flows`

## Successful work harmonized into this foundation

| Area | Commit |
|---|---|
| POS handover frontend operations | `9c155f0529efa908198f41f4e6747e6fd82ce1fb` |
| User Management B2-V3 | `d9fb69613089b30e3a0409774d8747e6082a0ad9` |
| Mobile/PWA shell and later POS work lineage | `3a8d2d7a1ca7d49ccb31273674363a70d7b8f4d4` |
| Preserved cPanel source state before POS repair | `c3f08fdb583a18e7f7f880bf888f73150ea682c8` |
| POS regression repair | `0bc862b0dd36452ac2b9cfe73c237110353d63a5` |

## Deployed admin assets

| Asset | Path | SHA256 |
|---|---|---|
| App JS | `/admin/assets/index-BPYoYWfW.js` | `7aa1705f8484975ec855d75369e9e67f30d53a3caca0039f242c572b76ef1025` |
| App CSS | `/admin/assets/index-atdd7ZHi.css` | `94ca72ba304603a96256caa8dff319f3b8c65cc687056b1321ccb3db84a456cd` |

## Included functional baseline

- POS checkout flow.
- POS Product Cards.
- Historical POS date picker and business-date preservation.
- Prescription and RX markers.
- Stock batch / inventory hydration markers.
- User Management B2-V3.
- Admin Reset Password UI.
- Business analytics and recent transaction helper markers in source.
- Mobile/PWA shell lineage.

## Production safety rule

All future work must branch from this foundation branch or the printed foundation commit. Do not continue production work from older hotfix, codex, or scattered deployment branches unless explicitly reconciling them into this foundation.

## Deployment safety

- migrations_run=NO
- database_changed=NO
- source_changed=YES
- assets_changed=YES
- rollback_admin=`/home/inzoeqqx/deployment_releases/stable-foundation-20260725-20260725T131801Z/admin-before.live-swap`

---

## Foundation V2 correction

Established: 2026-07-25T13:27:46Z

Foundation V2 repairs the incomplete Foundation V1 validation by restoring the missing inventory loading and POS card name/price rendering pieces from the preserved pre-R3 cPanel source snapshot.

### Foundation V2 source

- Foundation V1 base: `8e5853a900a32135618c6a4285c3e8abc699c7da`
- Selective restore source: `c3f08fdb583a18e7f7f880bf888f73150ea682c8`

### Files selectively restored

- `backend/app/Http/Controllers/Api/V1/PharmaCo360/ProductInventoryController.php`
- `backend/app/Http/Controllers/Api/V1/PharmaCo360/SalesDispensingController.php`
- `web/admin-dashboard/src/components/SalesCreationPanel.tsx`
- `web/admin-dashboard/src/styles.css`

### Historical POS preservation

The following files were preserved from Foundation V1 to avoid losing the restored Historical POS date picker:

- `web/admin-dashboard/src/App.tsx`
- `web/admin-dashboard/src/components/HistoricalPosWorkflow.tsx`
- `web/admin-dashboard/src/lib/api.ts`

### Foundation V2 deployed assets

| Asset | Path | SHA256 |
|---|---|---|
| App JS | `/admin/assets/index-B8gNYKv8.js` | `7aa1705f8484975ec855d75369e9e67f30d53a3caca0039f242c572b76ef1025` |
| App CSS | `/admin/assets/index-CdwuW59V.css` | `a002c053bf95b11fd0411e59817a3b7f3e9636081f2cef5cdd6a1c663c34062a` |

### Foundation V2 safety result

- php_syntax=PASSED
- typecheck=PASSED
- build=PASSED
- migrations_run=NO
- database_changed=NO
- source_changed=YES
- assets_changed=YES

# Ubuzima+ Admin Mobile PWA Deployment Handoff

## Status

- Prepared branch: `codex/mobile-pwa-app-shell`
- Deployment status: not deployed
- Production upload authorization: required before any live action
- Admin app base path: `/admin/`

## What This Release Contains

- Phone-sized screens open the mobile app shell automatically.
- Desktop admin experience is preserved outside the mobile breakpoint.
- Home uses Business Overview as the primary dashboard.
- Business Position uses a two-card horizontal metric rail and an all-metrics
  sheet from the `More` control.
- Mobile dashboard action cards use compact icon and label controls.
- PWA support includes manifest, service worker, install event flow, standalone
  display, theme color, safe-area layout, and offline shell cache.
- Native packaging path is prepared through Capacitor, but native Android/iOS
  projects are not generated yet.

## Recommended Deployment Path

Deploy from GitHub or the hosting server after review, not directly from the
local development browser session.

1. Push branch `codex/mobile-pwa-app-shell` to GitHub.
2. Open a pull request against the protected release branch.
3. Confirm CI passes for `web/admin-dashboard`.
4. Run the local release preflight:

   ```bash
   scripts/ubuzima-admin-mobile-pwa-release-preflight.sh
   ```

5. Confirm production backup and rollback owner.
6. Deploy only the approved `web/admin-dashboard/dist` output to the live
   `/admin/` web root.
7. Do not overwrite production `.env`, uploaded files, storage folders, or
   database files.
8. Verify `/admin/manifest.webmanifest`, `/admin/sw.js`, and `/admin/` load
   from the live domain.
9. Test desktop admin, mobile browser, installed PWA, login, POS/Sales,
   Inventory, Procurement, General Stock, and More.

## ChatGPT/Codex Handoff Prompt

Use this prompt only after the branch is pushed:

```text
Open repository nkundabagenziprotais-afk/ubuzimaplus-solution.
Review branch codex/mobile-pwa-app-shell. Do not deploy yet.
Run web/admin-dashboard checks and scripts/ubuzima-admin-mobile-pwa-release-preflight.sh.
Confirm the build output is web/admin-dashboard/dist and the app is served under /admin/.
Prepare a deployment plan that backs up current production /admin, uploads only the approved dist files, does not touch .env/storage/database, verifies PWA manifest/service worker/install behavior, and includes rollback steps.
Wait for explicit owner authorization before any production upload or server command.
```

## Go/No-Go Checks

- `npm --prefix web/admin-dashboard run typecheck`
- `npm --prefix web/admin-dashboard run build`
- `npm --prefix web/admin-dashboard run native:doctor`
- `scripts/ubuzima-admin-mobile-pwa-release-preflight.sh`
- Mobile smoke test at phone width
- Desktop smoke test at normal desktop width
- Owner approval captured
- Rollback path confirmed

## Rollback

Before upload, archive the current production `/admin/` folder. If login, core
navigation, POS/Sales, Inventory, or service worker behavior fails after
deployment, restore the archived `/admin/` folder and clear the live service
worker cache by reverting `/admin/sw.js` to the previous approved version.

## Native Store Notes

- Android APK/AAB and iOS IPA are not produced by this PWA deployment.
- Native store builds require confirming bundle ID, signing accounts, privacy
  policy URL, store icons, screenshots, and SMS reconciliation strategy.
- SMS inbox access is not part of the PWA. Android reconciliation should prefer
  user-consented single-message flows or provider APIs. iPhone needs provider
  APIs, uploads, or manual/secure import flows.

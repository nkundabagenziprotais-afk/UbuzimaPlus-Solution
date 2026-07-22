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

## cPanel Git Deployment Scripts

Use these scripts on cPanel after the branch is available in the server-side Git
repository. They do not require sharing cPanel credentials with ChatGPT.

Known cPanel values from the existing hosting script:

- Repository path: `/home/inzoeqqx/ubuzimaplus.com`
- Admin web root: `/home/inzoeqqx/ubuzimaplus.com/public_html/admin`
- cPanel npm binary: `/home/inzoeqqx/nodevenv/ubuzima-node-app/22/bin/npm`

First, open the repository and check out the approved branch:

```bash
cd /home/inzoeqqx/ubuzimaplus.com || exit 1
git fetch origin
git switch codex/mobile-pwa-app-shell || git switch -c codex/mobile-pwa-app-shell --track origin/codex/mobile-pwa-app-shell
git pull --ff-only origin codex/mobile-pwa-app-shell
```

Audit only:

```bash
NPM_BIN=/home/inzoeqqx/nodevenv/ubuzima-node-app/22/bin/npm \
EXPECTED_COMMIT=<approved_commit> \
scripts/cpanel-admin-mobile-pwa-audit.sh
```

Deploy to the static admin web root:

```bash
NPM_BIN=/home/inzoeqqx/nodevenv/ubuzima-node-app/22/bin/npm \
CONFIRM_DEPLOY=DEPLOY_UBUZIMA_ADMIN \
EXPECTED_COMMIT=<approved_commit> \
ADMIN_WEB_ROOT=/home/inzoeqqx/ubuzimaplus.com/public_html/admin \
PUBLIC_ADMIN_URL=https://ubuzimaplus.com/admin \
scripts/cpanel-admin-mobile-pwa-deploy.sh
```

Rollback from the backup path printed by the deploy script:

```bash
CONFIRM_ROLLBACK=ROLLBACK_UBUZIMA_ADMIN \
ADMIN_WEB_ROOT=/home/inzoeqqx/ubuzimaplus.com/public_html/admin \
BACKUP_DIR=/home/inzoeqqx/ubuzima-admin-backups/admin-YYYYMMDD-HHMMSS \
scripts/cpanel-admin-mobile-pwa-rollback.sh
```

Replace `<approved_commit>` with the approved Git commit. The deploy script
refuses to run unless `ADMIN_WEB_ROOT` ends with `/admin`.

The older cPanel script style that edits files, commits directly to `main`, and
deploys immediately should not be used for this release unless the PR is
reviewed and the owner explicitly authorizes it. This handoff keeps production
safer by auditing first, backing up the live `/admin` folder, and deploying only
the built admin app files.

## ChatGPT/Codex Handoff Prompt

Use this prompt for any deployment assistant or cPanel operator. Do not include
the cPanel password in the prompt.

```text
We are deploying the approved Ubuzima+ Admin Mobile PWA update from GitHub PR #154.
Repository: nkundabagenziprotais-afk/UbuzimaPlus-Solution
Branch: codex/mobile-pwa-app-shell
cPanel repository path: /home/inzoeqqx/ubuzimaplus.com
Admin production web root: /home/inzoeqqx/ubuzimaplus.com/public_html/admin
cPanel npm binary: /home/inzoeqqx/nodevenv/ubuzima-node-app/22/bin/npm
Public admin URL: https://ubuzimaplus.com/admin

Requirements:
- Do not ask me to paste cPanel passwords, tokens, .env values, or database credentials in chat.
- Do not edit production source files directly on main.
- Do not overwrite .env, storage, database, uploaded files, backend runtime files, or public_html outside /admin.
- Audit first, then deploy only after explicit owner approval.
- Back up current /admin before upload and provide rollback command.
- Verify desktop admin, mobile app layout, manifest, service worker, installability, login, POS/Sales, Inventory, Procurement, General Stock, and More after deployment.

Use these commands after confirming the approved commit:

cd /home/inzoeqqx/ubuzimaplus.com || exit 1
git fetch origin
git switch codex/mobile-pwa-app-shell || git switch -c codex/mobile-pwa-app-shell --track origin/codex/mobile-pwa-app-shell
git pull --ff-only origin codex/mobile-pwa-app-shell

NPM_BIN=/home/inzoeqqx/nodevenv/ubuzima-node-app/22/bin/npm \
EXPECTED_COMMIT=<approved_commit> \
scripts/cpanel-admin-mobile-pwa-audit.sh

Only after the audit passes and I approve production upload, run:

NPM_BIN=/home/inzoeqqx/nodevenv/ubuzima-node-app/22/bin/npm \
CONFIRM_DEPLOY=DEPLOY_UBUZIMA_ADMIN \
EXPECTED_COMMIT=<approved_commit> \
ADMIN_WEB_ROOT=/home/inzoeqqx/ubuzimaplus.com/public_html/admin \
PUBLIC_ADMIN_URL=https://ubuzimaplus.com/admin \
scripts/cpanel-admin-mobile-pwa-deploy.sh
```

## Go/No-Go Checks

- `npm --prefix web/admin-dashboard run typecheck`
- `npm --prefix web/admin-dashboard run build`
- `npm --prefix web/admin-dashboard run native:doctor`
- `scripts/ubuzima-admin-mobile-pwa-release-preflight.sh`
- `scripts/cpanel-admin-mobile-pwa-audit.sh`
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

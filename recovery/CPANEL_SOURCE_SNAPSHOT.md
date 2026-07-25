# cPanel Source Snapshot

This branch is an archival preservation branch.

**Do not merge this branch directly into main.**

It preserves:

- The local cPanel branch history at commit `3a8d2d7a1ca7d49ccb31273674363a70d7b8f4d4`.
- Dirty backend source changes.
- Dirty admin application source changes.
- Untracked admin launch modules.
- Untracked dock icon assets.

It deliberately excludes:

- Generated admin distribution files.
- Production database files.
- Environment files.
- Runtime logs and marker files.
- Deployment and patch scripts.
- Live `public_html` assets.

Audit source:

`/home/inzoeqqx/deployment-backups/cpanel-reconciliation-20260725-040439`

Snapshot created:

`20260725-042028`

Current main at capture:

`a049fd6463a93f1c10fcefd802b983d7c93dcd89`

The preserved work must be reviewed and moved into separate clean branches based on current `main`.

# UbuzimaPlus Solution

Clean development baseline reconstructed from the validated live application.

## Active structure

- `public_html/` — active public website and compiled admin UI
- `backend/` — active Laravel application source
- `web/` — current editable frontend source
- `docs/LIVE_BASELINE.md` — baseline validation record

## Development policy

1. GitHub is the source of truth.
2. Development uses review branches and pull requests.
3. Production secrets, databases, uploads, logs and caches are never committed.
4. Database migrations must preserve existing production data.
5. UI changes require responsive preview review.
6. cPanel is the production runtime, not the development source.

Incomplete repository-only phases, historical deployment evidence, abandoned
experiments, rollback builds and server backups were removed from the active
working tree. They remain recoverable through Git history and the recovery
bundle.

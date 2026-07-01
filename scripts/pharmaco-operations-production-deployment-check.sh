#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
DEPLOYMENT_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PRODUCTION_DEPLOYMENT_RUNBOOK.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$QA_DOC" "Phase 14.6 production deployment runbook and post-deployment verification"
require_text "$QA_DOC" "Post-deployment evidence checklist"

require_text "$DEPLOYMENT_DOC" "PharmaCo360 Operations Command Center Production Deployment Runbook"
require_text "$DEPLOYMENT_DOC" "GitHub is the source of truth"
require_text "$DEPLOYMENT_DOC" "Production cPanel must be treated as runtime only"
require_text "$DEPLOYMENT_DOC" "Do not run destructive production commands"
require_text "$DEPLOYMENT_DOC" "php artisan migrate:fresh --force"
require_text "$DEPLOYMENT_DOC" "For this Phase 14.6 documentation release, no new migration is introduced"
require_text "$DEPLOYMENT_DOC" "Post-deployment verification"
require_text "$DEPLOYMENT_DOC" "Responsive production review"
require_text "$DEPLOYMENT_DOC" "Rollback checklist"
require_text "$DEPLOYMENT_DOC" "Deployment evidence to archive"
require_text "$DEPLOYMENT_DOC" "Approve production deployment only when"

require_text "$ARCHITECTURE" "PharmaCo360 command center production deployment runbook"
require_text "$ARCHITECTURE" "The phase is documentation and validation only"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations production deployment check passed."

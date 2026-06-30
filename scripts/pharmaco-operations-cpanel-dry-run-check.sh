#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
PREP_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PRODUCTION_PREPARATION.md"
DRY_RUN_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CPANEL_DRY_RUN_CHECKLIST.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$QA_DOC" "Phase 15.0 controlled production deployment preparation and cPanel dry-run checklist"
require_text "$QA_DOC" "Dry-run evidence checklist"

require_text "$PREP_DOC" "PharmaCo360 Operations Command Center Controlled Production Deployment Preparation"
require_text "$PREP_DOC" "Controlled deployment principles"
require_text "$PREP_DOC" "cPanel readiness checklist"
require_text "$PREP_DOC" "Production backup readiness"
require_text "$PREP_DOC" "Deployment package readiness"
require_text "$PREP_DOC" "Dry-run boundary"
require_text "$PREP_DOC" "Not approved commands"
require_text "$PREP_DOC" "The dry-run must not"
require_text "$PREP_DOC" "php artisan migrate:fresh --force"
require_text "$PREP_DOC" "php artisan db:wipe"

require_text "$DRY_RUN_DOC" "PharmaCo360 Operations Command Center cPanel Dry-Run Checklist"
require_text "$DRY_RUN_DOC" "Dry-run evidence register"
require_text "$DRY_RUN_DOC" "GitHub readiness"
require_text "$DRY_RUN_DOC" "Local package readiness"
require_text "$DRY_RUN_DOC" "cPanel path readiness"
require_text "$DRY_RUN_DOC" "Environment readiness"
require_text "$DRY_RUN_DOC" "Database readiness"
require_text "$DRY_RUN_DOC" "Post-deployment verification readiness"
require_text "$DRY_RUN_DOC" "Dry-run pass criteria"
require_text "$DRY_RUN_DOC" "Dry-run fail criteria"
require_text "$DRY_RUN_DOC" "Dry-run status: pending"

require_text "$ARCHITECTURE" "PharmaCo360 command center controlled production preparation and cPanel dry-run"
require_text "$ARCHITECTURE" "It does not deploy to production"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations cPanel dry-run check passed."

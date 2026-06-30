#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
LIVE_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_LIVE_VERIFICATION_PACK.md"
EXEC_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_EXECUTION_CHECKLIST.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$QA_DOC" "Phase 14.8 production deployment execution checklist and live verification pack"
require_text "$QA_DOC" "Live verification evidence checklist"

require_text "$LIVE_DOC" "PharmaCo360 Operations Command Center Live Verification Pack"
require_text "$LIVE_DOC" "GitHub main remains the source of truth"
require_text "$LIVE_DOC" "Health verification"
require_text "$LIVE_DOC" "Authentication verification"
require_text "$LIVE_DOC" "Dashboard verification"
require_text "$LIVE_DOC" "Read-only verification"
require_text "$LIVE_DOC" "Responsive live verification"
require_text "$LIVE_DOC" "Log verification"
require_text "$LIVE_DOC" "Rollback triggers"
require_text "$LIVE_DOC" "Approve live verification only when"

require_text "$EXEC_DOC" "PharmaCo360 Operations Command Center Deployment Execution Checklist"
require_text "$EXEC_DOC" "Pre-execution confirmation"
require_text "$EXEC_DOC" "cPanel execution checklist"
require_text "$EXEC_DOC" "Commands not approved"
require_text "$EXEC_DOC" "php artisan migrate:fresh --force"
require_text "$EXEC_DOC" "For this Phase 14.8 documentation release, no new migration is introduced"
require_text "$EXEC_DOC" "Immediate post-execution checklist"
require_text "$EXEC_DOC" "Evidence to capture during execution"

require_text "$ARCHITECTURE" "PharmaCo360 command center live verification pack"
require_text "$ARCHITECTURE" "The phase is documentation and validation only"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations live verification check passed."

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
DOSSIER_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_GO_LIVE_APPROVAL_DOSSIER.md"
SIGN_OFF_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_GO_LIVE_READINESS_SIGN_OFF.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$QA_DOC" "Phase 14.9 production deployment approval dossier and go-live readiness sign-off"
require_text "$QA_DOC" "Go-live evidence checklist"

require_text "$DOSSIER_DOC" "PharmaCo360 Operations Command Center Go-Live Approval Dossier"
require_text "$DOSSIER_DOC" "Go-live principle"
require_text "$DOSSIER_DOC" "Business approval evidence"
require_text "$DOSSIER_DOC" "Operations approval evidence"
require_text "$DOSSIER_DOC" "Technical approval evidence"
require_text "$DOSSIER_DOC" "Deployment approval evidence"
require_text "$DOSSIER_DOC" "Go / no-go decision register"
require_text "$DOSSIER_DOC" "No-go triggers"
require_text "$DOSSIER_DOC" "Approve go-live only when"

require_text "$SIGN_OFF_DOC" "PharmaCo360 Operations Command Center Go-Live Readiness Sign-Off"
require_text "$SIGN_OFF_DOC" "Readiness confirmation"
require_text "$SIGN_OFF_DOC" "Validation sign-off"
require_text "$SIGN_OFF_DOC" "Business sign-off"
require_text "$SIGN_OFF_DOC" "Operations sign-off"
require_text "$SIGN_OFF_DOC" "Technical sign-off"
require_text "$SIGN_OFF_DOC" "Deployment sign-off"
require_text "$SIGN_OFF_DOC" "Rollback readiness sign-off"
require_text "$SIGN_OFF_DOC" "Live verification readiness sign-off"
require_text "$SIGN_OFF_DOC" "Go-live status: pending"

require_text "$ARCHITECTURE" "PharmaCo360 command center go-live approval dossier"
require_text "$ARCHITECTURE" "The phase is documentation and validation only"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations go-live approval check passed."

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RELEASE_DOC="docs/releases/PHARMACO_REPORTING_DASHBOARD_RELEASE_NOTE.md"
HANDOVER_DOC="docs/handover/PHARMACO_REPORTING_DASHBOARD_HANDOVER.md"
QA_DOC="docs/qa/PHARMACO_REPORTING_DASHBOARD_QA.md"
DEPLOYMENT_DOC="docs/deployment/PHARMACO_REPORTING_DASHBOARD_PRODUCTION_REVIEW.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$RELEASE_DOC" "PharmaCo360 Reporting Dashboard Release Note"
require_text "$RELEASE_DOC" "Release purpose"
require_text "$RELEASE_DOC" "Business value"
require_text "$RELEASE_DOC" "Safety notes"
require_text "$RELEASE_DOC" "Validation evidence"
require_text "$RELEASE_DOC" "Reporting review must remain read-only"

require_text "$HANDOVER_DOC" "PharmaCo360 Reporting Dashboard Handover Summary"
require_text "$HANDOVER_DOC" "Operator acceptance checklist"
require_text "$HANDOVER_DOC" "QA handover checklist"
require_text "$HANDOVER_DOC" "Deployment handover checklist"
require_text "$HANDOVER_DOC" "Future improvement notes"

require_text "$QA_DOC" "Release handover summary"
require_text "$DEPLOYMENT_DOC" "Release handover evidence"
require_text "$ARCHITECTURE" "Reporting dashboard release handover"

echo "Reporting dashboard release handover check passed."

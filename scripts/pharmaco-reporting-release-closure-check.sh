#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RUNBOOK_DOC="docs/runbooks/PHARMACO_REPORTING_DASHBOARD_RUNBOOK_INDEX.md"
RELEASE_DOC="docs/releases/PHARMACO_REPORTING_DASHBOARD_RELEASE_NOTE.md"
HANDOVER_DOC="docs/handover/PHARMACO_REPORTING_DASHBOARD_HANDOVER.md"
DEPLOYMENT_DOC="docs/deployment/PHARMACO_REPORTING_DASHBOARD_PRODUCTION_REVIEW.md"
QA_DOC="docs/qa/PHARMACO_REPORTING_DASHBOARD_QA.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$RUNBOOK_DOC" "PharmaCo360 Reporting Dashboard Runbook Index"
require_text "$RUNBOOK_DOC" "Documentation map"
require_text "$RUNBOOK_DOC" "Validation scripts"
require_text "$RUNBOOK_DOC" "Release closure checklist"
require_text "$RUNBOOK_DOC" "Production readiness statement"
require_text "$RUNBOOK_DOC" "Close the reporting dashboard release only after"

require_text "$RELEASE_DOC" "Release closure"
require_text "$HANDOVER_DOC" "Release closure handover"
require_text "$DEPLOYMENT_DOC" "Release closure checklist"
require_text "$QA_DOC" "Release closure QA"
require_text "$ARCHITECTURE" "Reporting dashboard release closure"

echo "Reporting dashboard release closure check passed."

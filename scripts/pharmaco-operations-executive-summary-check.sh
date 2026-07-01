#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPONENT="web/admin-dashboard/src/components/PharmacoOperationsCommandCenter.tsx"
STYLES="web/admin-dashboard/src/styles.css"
QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
EXECUTIVE_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_EXECUTIVE_SUMMARY.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$COMPONENT" "Executive operating summary"
require_text "$COMPONENT" "Decision notes"
require_text "$COMPONENT" "executiveSummaryItems"
require_text "$COMPONENT" "decisionNotes"
require_text "$COMPONENT" "Operating position"
require_text "$COMPONENT" "Credit discipline"
require_text "$COMPONENT" "Supplier exposure"
require_text "$COMPONENT" "Stock investment"
require_text "$COMPONENT" "Approve daily position"
require_text "$COMPONENT" "Prioritize collection follow-up"
require_text "$COMPONENT" "Control purchasing pressure"
require_text "$COMPONENT" "Prepare manager handover"

require_text "$STYLES" "operations-executive-section"
require_text "$STYLES" "operations-executive-grid"
require_text "$STYLES" "operations-decision-section"
require_text "$STYLES" "operations-decision-grid"
require_text "$STYLES" "operations-executive-card--warning"

require_text "$QA_DOC" "Phase 14.4 executive operating summary and decision notes"
require_text "$EXECUTIVE_DOC" "PharmaCo360 Operations Command Center Executive Summary Review"
require_text "$EXECUTIVE_DOC" "Approve when the executive summary helps management"
require_text "$ARCHITECTURE" "PharmaCo360 command center executive operating summary"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations executive summary check passed."

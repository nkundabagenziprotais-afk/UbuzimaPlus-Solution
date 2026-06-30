#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPONENT="web/admin-dashboard/src/components/PharmacoOperationsCommandCenter.tsx"
STYLES="web/admin-dashboard/src/styles.css"
QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
OPERATOR_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_OPERATOR_REVIEW.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$COMPONENT" "Operator review checklist"
require_text "$COMPONENT" "operatorChecklist"
require_text "$COMPONENT" "Cash and collections"
require_text "$COMPONENT" "Credit control"
require_text "$COMPONENT" "Supplier exposure"
require_text "$COMPONENT" "Stock attention"

require_text "$STYLES" "operations-operator-section"
require_text "$STYLES" "operations-operator-grid"
require_text "$STYLES" "@media (max-width: 430px)"
require_text "$STYLES" "@media (max-width: 360px)"

require_text "$QA_DOC" "Phase 14.3 responsive polish and operator review checklist"
require_text "$QA_DOC" "360px: command center cards stack without horizontal scrolling"
require_text "$OPERATOR_DOC" "PharmaCo360 Operations Command Center Operator Review"
require_text "$OPERATOR_DOC" "Approve only when the command center is readable"
require_text "$ARCHITECTURE" "PharmaCo360 command center responsive polish and operator review"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations operator review check passed."

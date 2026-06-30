#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPONENT="web/admin-dashboard/src/components/PharmacoOperationsCommandCenter.tsx"
STYLES="web/admin-dashboard/src/styles.css"
QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$COMPONENT" "Operational alerts"
require_text "$COMPONENT" "Review queues"
require_text "$COMPONENT" "operationalAlerts"
require_text "$COMPONENT" "reviewQueues"
require_text "$COMPONENT" "Credit collection queue"
require_text "$COMPONENT" "Supplier payment queue"
require_text "$COMPONENT" "Purchase receiving queue"
require_text "$COMPONENT" "Sales collection queue"

require_text "$STYLES" "operations-alerts-section"
require_text "$STYLES" "operations-alert-grid"
require_text "$STYLES" "operations-review-grid"
require_text "$STYLES" "operations-alert-card--warning"

require_text "$QA_DOC" "Phase 14.2 operational alerts and review queues"
require_text "$QA_DOC" "alerts and queues are generated from existing read-only reporting data"
require_text "$ARCHITECTURE" "PharmaCo360 command center alerts and review queues"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations alerts and review queues check passed."

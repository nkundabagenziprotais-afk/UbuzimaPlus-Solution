#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPONENT="web/admin-dashboard/src/components/PharmacoOperationsCommandCenter.tsx"
APP="web/admin-dashboard/src/App.tsx"
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

require_text "$COMPONENT" "PharmaCo360 command center"
require_text "$COMPONENT" "Today’s operating picture"
require_text "$COMPONENT" "Refresh command center"
require_text "$COMPONENT" "Customer credit risk"
require_text "$COMPONENT" "Manager review notes"
require_text "$COMPONENT" "getPharmaReportingOverview"
require_text "$COMPONENT" "getPharmaCustomerCreditExposureReport"

require_text "$APP" "PharmacoOperationsCommandCenter"
require_text "$STYLES" "operations-command-center"
require_text "$STYLES" "operations-kpi-grid"
require_text "$QA_DOC" "PharmaCo360 Operations Command Center QA"
require_text "$QA_DOC" "The command center must remain read-only"
require_text "$ARCHITECTURE" "PharmaCo360 operations command center"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations command center check passed."

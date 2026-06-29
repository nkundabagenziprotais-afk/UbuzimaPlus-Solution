#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPONENT="web/admin-dashboard/src/components/ReportingDashboard.tsx"
STYLES="web/admin-dashboard/src/styles.css"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"
QA_DOC="docs/qa/PHARMACO_REPORTING_DASHBOARD_QA.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$COMPONENT" "Business reporting"
require_text "$COMPONENT" "PharmaCo360 operating view"
require_text "$COMPONENT" "hasTenantContext"
require_text "$COMPONENT" "hasLoadedReports"
require_text "$COMPONENT" "reporting-loading-state"
require_text "$COMPONENT" "reporting-empty-overview"
require_text "$COMPONENT" "report-empty-state"
require_text "$COMPONENT" "Customer credit risk"
require_text "$COMPONENT" "Download CSV"
require_text "$COMPONENT" "report-export-notice"

require_text "$STYLES" "PharmaCo360 reporting dashboard readability bundle"
require_text "$STYLES" "PharmaCo360 reporting dashboard empty and loading states"
require_text "$STYLES" "report-card-intro"
require_text "$STYLES" "report-status-list--aging"

require_text "$ARCHITECTURE" "Reporting dashboard UI review checklist"
require_text "$ARCHITECTURE" "Reporting dashboard empty and loading states"
require_text "$ARCHITECTURE" "Reporting dashboard QA guardrails"

require_text "$QA_DOC" "PharmaCo360 Reporting Dashboard QA Guide"
require_text "$QA_DOC" "Manual preview checklist"
require_text "$QA_DOC" "Functional checks"

cd web/admin-dashboard
npm run build

echo "Reporting dashboard UI guardrail check passed."

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

require_text "$DEPLOYMENT_DOC" "PharmaCo360 Reporting Dashboard Production Review"
require_text "$DEPLOYMENT_DOC" "Operator review notes"
require_text "$DEPLOYMENT_DOC" "Required preview sizes"
require_text "$DEPLOYMENT_DOC" "Production approval evidence"
require_text "$DEPLOYMENT_DOC" "cPanel production deployment checklist"
require_text "$DEPLOYMENT_DOC" "do not run migrate:fresh on production"
require_text "$DEPLOYMENT_DOC" "GitHub as the source of truth"
require_text "$DEPLOYMENT_DOC" "download customer credit CSV"

require_text "$QA_DOC" "Operator production review"
require_text "$QA_DOC" "figures remain read-only"
require_text "$QA_DOC" "no reporting review step mutates pharmacy records"

require_text "$ARCHITECTURE" "Reporting dashboard production review checklist"
require_text "$ARCHITECTURE" "cPanel-safe deployment checks"
require_text "$ARCHITECTURE" "pharmaco-reporting-production-review-check.sh"

echo "Reporting dashboard production review checklist passed."

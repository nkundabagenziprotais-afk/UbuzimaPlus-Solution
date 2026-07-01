#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
PACKAGE_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PRODUCTION_PACKAGE_BUILD.md"
HANDOFF_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_HANDOFF_CHECKLIST.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$QA_DOC" "Phase 15.1 controlled production package build and deployment handoff checklist"
require_text "$QA_DOC" "Package handoff evidence checklist"

require_text "$PACKAGE_DOC" "PharmaCo360 Operations Command Center Production Package Build Checklist"
require_text "$PACKAGE_DOC" "Package build principle"
require_text "$PACKAGE_DOC" "Approved source register"
require_text "$PACKAGE_DOC" "Required local validation before package build"
require_text "$PACKAGE_DOC" "Required package contents"
require_text "$PACKAGE_DOC" "Required package exclusions"
require_text "$PACKAGE_DOC" "Environment protection"
require_text "$PACKAGE_DOC" "Build evidence to capture"
require_text "$PACKAGE_DOC" "Package failure triggers"
require_text "$PACKAGE_DOC" "Package status: pending"

require_text "$HANDOFF_DOC" "PharmaCo360 Operations Command Center Deployment Handoff Checklist"
require_text "$HANDOFF_DOC" "Handoff evidence register"
require_text "$HANDOFF_DOC" "Required documents handed over"
require_text "$HANDOFF_DOC" "Operator readiness"
require_text "$HANDOFF_DOC" "Backup and rollback handoff"
require_text "$HANDOFF_DOC" "Live verification handoff"
require_text "$HANDOFF_DOC" "No-deployment boundary"
require_text "$HANDOFF_DOC" "Handoff pass criteria"
require_text "$HANDOFF_DOC" "Handoff fail criteria"
require_text "$HANDOFF_DOC" "Handoff status: pending"

require_text "$ARCHITECTURE" "PharmaCo360 command center production package build and deployment handoff"
require_text "$ARCHITECTURE" "It does not deploy to production"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations package handoff check passed."

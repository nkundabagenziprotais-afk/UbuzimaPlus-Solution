#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
EVIDENCE_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_RELEASE_EVIDENCE_INDEX.md"
PACKAGE_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_PACKAGE.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$QA_DOC" "Phase 14.7 production deployment package and release evidence index"
require_text "$QA_DOC" "Release evidence archive checklist"

require_text "$EVIDENCE_DOC" "PharmaCo360 Operations Command Center Release Evidence Index"
require_text "$EVIDENCE_DOC" "Validation evidence register"
require_text "$EVIDENCE_DOC" "Production deployment evidence"
require_text "$EVIDENCE_DOC" "Approval evidence"
require_text "$EVIDENCE_DOC" "Read-only safety evidence"
require_text "$EVIDENCE_DOC" "release is validated, read-only, tenant-safe, responsive"

require_text "$PACKAGE_DOC" "PharmaCo360 Operations Command Center Deployment Package"
require_text "$PACKAGE_DOC" "Deployment readiness checklist"
require_text "$PACKAGE_DOC" "Commands explicitly not approved"
require_text "$PACKAGE_DOC" "php artisan migrate:fresh --force"
require_text "$PACKAGE_DOC" "For this package, no new migration is introduced"
require_text "$PACKAGE_DOC" "Post-deployment verification checklist"
require_text "$PACKAGE_DOC" "Rollback evidence checklist"
require_text "$PACKAGE_DOC" "Sign-off table"

require_text "$ARCHITECTURE" "PharmaCo360 command center release evidence package"
require_text "$ARCHITECTURE" "The phase is documentation and validation only"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations release evidence check passed."

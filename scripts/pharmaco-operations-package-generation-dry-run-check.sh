#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
GENERATION_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN.md"
CHECKSUM_REGISTER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CHECKSUM_REGISTER.md"
DRY_RUN_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_DRY_RUN_CHECKLIST.md"
PROTECTED_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PROTECTED_FILE_INSPECTION_CHECKLIST.md"
MANIFEST_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_MANIFEST_CHECKLIST.md"
CHECKSUM_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CHECKSUM_EVIDENCE_CHECKLIST.md"
HANDOFF_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_HANDOFF_CHECKLIST.md"
CPANEL_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CPANEL_DRY_RUN_CHECKLIST.md"
PRODUCTION_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PRODUCTION_DEPLOYMENT_RUNBOOK.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_file() {
  local file="$1"

  if [ ! -f "$file" ]; then
    echo "Missing required file: $file"
    exit 1
  fi
}

require_text "$QA_DOC" "Phase 15.4 controlled production package generation dry-run and checksum register"
require_text "$QA_DOC" "Package generation dry-run evidence checklist"

require_text "$GENERATION_DOC" "PharmaCo360 Operations Command Center Package Generation Dry-Run"
require_text "$GENERATION_DOC" "Dry-run principle"
require_text "$GENERATION_DOC" "Dry-run boundary"
require_text "$GENERATION_DOC" "Required generation dry-run checks"
require_text "$GENERATION_DOC" "Inventory-only dry-run evidence"
require_text "$GENERATION_DOC" "Future real package generation prerequisites"
require_text "$GENERATION_DOC" "Dry-run pass criteria"
require_text "$GENERATION_DOC" "Dry-run fail criteria"
require_text "$GENERATION_DOC" "Dry-run status: pending"

require_text "$CHECKSUM_REGISTER" "PharmaCo360 Operations Command Center Checksum Register"
require_text "$CHECKSUM_REGISTER" "Checksum register principle"
require_text "$CHECKSUM_REGISTER" "Required checksum register fields"
require_text "$CHECKSUM_REGISTER" "Approved checksum methods"
require_text "$CHECKSUM_REGISTER" "Register entry template"
require_text "$CHECKSUM_REGISTER" "Checksum generation rule"
require_text "$CHECKSUM_REGISTER" "Verification rule"
require_text "$CHECKSUM_REGISTER" "Register pass criteria"
require_text "$CHECKSUM_REGISTER" "Register fail criteria"
require_text "$CHECKSUM_REGISTER" "Checksum register status: pending"

for required_doc in \
  "$DRY_RUN_DOC" \
  "$PROTECTED_DOC" \
  "$MANIFEST_DOC" \
  "$CHECKSUM_DOC" \
  "$HANDOFF_DOC"
do
  require_file "$required_doc"
done

if [ ! -f "$CPANEL_DOC" ]; then
  echo "Notice: cPanel dry-run checklist path not found at $CPANEL_DOC"
  echo "Continuing because cPanel readiness is covered by the cPanel dry-run guardrail script."
fi

if [ ! -f "$PRODUCTION_DOC" ]; then
  echo "Notice: production deployment runbook path not found at $PRODUCTION_DOC"
  echo "Continuing because production deployment readiness is covered by the production deployment guardrail script."
fi

require_text "$ARCHITECTURE" "PharmaCo360 command center package generation dry-run and checksum register"
require_text "$ARCHITECTURE" "It does not create a production package archive"

echo "== Package generation inventory-only dry-run =="
inventory_count="$(git ls-files | wc -l | tr -d ' ')"
echo "Tracked source file count: $inventory_count"

if [ "$inventory_count" -lt 1 ]; then
  echo "Tracked source inventory is empty."
  exit 1
fi

echo "== Protected-file tracked source inspection =="
protected_hits="$(
  git ls-files \
    | grep -E '(^|/)\.env$|(^|/)\.env\.(local|production|backup|bak|old)$|(^|/)database/database\.sqlite$|\.sqlite$|(^|/)storage/logs/|(^|/)node_modules/|(^|/)\.DS_Store$|\.tar$|\.tar\.gz$|\.zip$' \
    | grep -vE '(^|/)storage/logs/\.gitignore$' \
    || true
)"

if [ -n "$protected_hits" ]; then
  echo "Protected files found in tracked source:"
  echo "$protected_hits"
  exit 1
fi

echo "No protected tracked files found."

echo "== Required package evidence documents =="
for required_doc in \
  "$GENERATION_DOC" \
  "$CHECKSUM_REGISTER" \
  "$DRY_RUN_DOC" \
  "$PROTECTED_DOC" \
  "$MANIFEST_DOC" \
  "$CHECKSUM_DOC" \
  "$HANDOFF_DOC"
do
  echo "Found: $required_doc"
done

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations package generation dry-run check passed."

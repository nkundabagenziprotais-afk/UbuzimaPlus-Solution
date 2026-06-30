#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
DRY_RUN_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_DRY_RUN_CHECKLIST.md"
PROTECTED_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PROTECTED_FILE_INSPECTION_CHECKLIST.md"
MANIFEST_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_MANIFEST_CHECKLIST.md"
CHECKSUM_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CHECKSUM_EVIDENCE_CHECKLIST.md"
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

require_file() {
  local file="$1"

  if [ ! -f "$file" ]; then
    echo "Missing required file: $file"
    exit 1
  fi
}

require_text "$QA_DOC" "Phase 15.3 production package dry-run generator and protected-file inspection checklist"
require_text "$QA_DOC" "Package dry-run evidence checklist"

require_text "$DRY_RUN_DOC" "PharmaCo360 Operations Command Center Package Dry-Run Checklist"
require_text "$DRY_RUN_DOC" "Dry-run principle"
require_text "$DRY_RUN_DOC" "Required dry-run checks"
require_text "$DRY_RUN_DOC" "Required file inventory checks"
require_text "$DRY_RUN_DOC" "Required package exclusion simulation"
require_text "$DRY_RUN_DOC" "Dry-run pass criteria"
require_text "$DRY_RUN_DOC" "Dry-run fail criteria"
require_text "$DRY_RUN_DOC" "Dry-run status: pending"

require_text "$PROTECTED_DOC" "PharmaCo360 Operations Command Center Protected-File Inspection Checklist"
require_text "$PROTECTED_DOC" "Protected-file principle"
require_text "$PROTECTED_DOC" "Files that must not be packaged"
require_text "$PROTECTED_DOC" "Files requiring special review"
require_text "$PROTECTED_DOC" "Protected production assets"
require_text "$PROTECTED_DOC" "Inspection evidence to capture"
require_text "$PROTECTED_DOC" "Inspection pass criteria"
require_text "$PROTECTED_DOC" "Inspection fail criteria"
require_text "$PROTECTED_DOC" "Inspection status: pending"

require_file "$MANIFEST_DOC"
require_file "$CHECKSUM_DOC"
require_file "$HANDOFF_DOC"

require_text "$ARCHITECTURE" "PharmaCo360 command center package dry-run and protected-file inspection"
require_text "$ARCHITECTURE" "It does not create a production package"

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

echo "== Required deployment documents =="
for required_doc in \
  "$DRY_RUN_DOC" \
  "$PROTECTED_DOC" \
  "$MANIFEST_DOC" \
  "$CHECKSUM_DOC" \
  "$HANDOFF_DOC"
do
  echo "Found: $required_doc"
done

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations package dry-run check passed."

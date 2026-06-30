#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
LEDGER_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_APPROVAL_LEDGER.md"
INDEX_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_RELEASE_FREEZE_EVIDENCE_INDEX.md"
FREEZE_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_APPROVAL_FREEZE.md"
SIGNOFF_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_RELEASE_CANDIDATE_SIGN_OFF.md"
PACKAGE_BUILD_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PRODUCTION_PACKAGE_BUILD.md"
HANDOFF_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_HANDOFF_CHECKLIST.md"
MANIFEST_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_MANIFEST_CHECKLIST.md"
CHECKSUM_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CHECKSUM_EVIDENCE_CHECKLIST.md"
DRY_RUN_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_DRY_RUN_CHECKLIST.md"
PROTECTED_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PROTECTED_FILE_INSPECTION_CHECKLIST.md"
GENERATION_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN.md"
CHECKSUM_REGISTER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CHECKSUM_REGISTER.md"
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

require_text "$QA_DOC" "Phase 15.6 production package approval ledger and release freeze evidence index"
require_text "$QA_DOC" "Release freeze evidence checklist"

require_text "$LEDGER_DOC" "PharmaCo360 Operations Command Center Package Approval Ledger"
require_text "$LEDGER_DOC" "Approval ledger principle"
require_text "$LEDGER_DOC" "Required approval roles"
require_text "$LEDGER_DOC" "Required approval evidence"
require_text "$LEDGER_DOC" "Package approval register"
require_text "$LEDGER_DOC" "Approval boundary"
require_text "$LEDGER_DOC" "Ledger pass criteria"
require_text "$LEDGER_DOC" "Ledger fail criteria"
require_text "$LEDGER_DOC" "Ledger status: pending"

require_text "$INDEX_DOC" "PharmaCo360 Operations Command Center Release Freeze Evidence Index"
require_text "$INDEX_DOC" "Evidence index principle"
require_text "$INDEX_DOC" "Required evidence groups"
require_text "$INDEX_DOC" "Evidence location index"
require_text "$INDEX_DOC" "Required validation evidence"
require_text "$INDEX_DOC" "Evidence index boundary"
require_text "$INDEX_DOC" "Evidence index pass criteria"
require_text "$INDEX_DOC" "Evidence index fail criteria"
require_text "$INDEX_DOC" "Evidence index status: pending"

for required_doc in \
  "$FREEZE_DOC" \
  "$SIGNOFF_DOC" \
  "$PACKAGE_BUILD_DOC" \
  "$HANDOFF_DOC" \
  "$MANIFEST_DOC" \
  "$CHECKSUM_DOC" \
  "$DRY_RUN_DOC" \
  "$PROTECTED_DOC" \
  "$GENERATION_DOC" \
  "$CHECKSUM_REGISTER"
do
  require_file "$required_doc"
done

require_text "$ARCHITECTURE" "PharmaCo360 command center package approval ledger and release freeze evidence index"
require_text "$ARCHITECTURE" "It does not create a production package archive"

echo "== Release freeze evidence source identity =="
current_commit="$(git rev-parse --short HEAD)"
current_branch="$(git branch --show-current)"
echo "Current branch: $current_branch"
echo "Current commit: $current_commit"

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

echo "== Required release freeze evidence documents =="
for required_doc in \
  "$LEDGER_DOC" \
  "$INDEX_DOC" \
  "$FREEZE_DOC" \
  "$SIGNOFF_DOC" \
  "$PACKAGE_BUILD_DOC" \
  "$HANDOFF_DOC" \
  "$MANIFEST_DOC" \
  "$CHECKSUM_DOC" \
  "$DRY_RUN_DOC" \
  "$PROTECTED_DOC" \
  "$GENERATION_DOC" \
  "$CHECKSUM_REGISTER"
do
  echo "Found: $required_doc"
done

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations release freeze evidence check passed."

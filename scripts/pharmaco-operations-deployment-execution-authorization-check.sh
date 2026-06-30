#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
EXECUTION_PACKET="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_EXECUTION_AUTHORIZATION_PACKET.md"
OPERATOR_CAPTURE="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_OPERATOR_EVIDENCE_CAPTURE.md"
FINAL_DECISION="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_FINAL_APPROVAL_DECISION_LOG.md"
AUTHORIZATION_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_AUTHORIZATION_CHECKLIST.md"
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

require_text "$QA_DOC" "Phase 15.8 deployment execution authorization packet and operator evidence capture"
require_text "$QA_DOC" "Deployment execution evidence checklist"

require_text "$EXECUTION_PACKET" "PharmaCo360 Operations Command Center Deployment Execution Authorization Packet"
require_text "$EXECUTION_PACKET" "Execution authorization principle"
require_text "$EXECUTION_PACKET" "Required execution authorization fields"
require_text "$EXECUTION_PACKET" "Execution decision options"
require_text "$EXECUTION_PACKET" "Execution authorization register"
require_text "$EXECUTION_PACKET" "Execution scope options"
require_text "$EXECUTION_PACKET" "Required pre-execution evidence"
require_text "$EXECUTION_PACKET" "Execution boundary"
require_text "$EXECUTION_PACKET" "Execution authorization pass criteria"
require_text "$EXECUTION_PACKET" "Execution authorization fail criteria"
require_text "$EXECUTION_PACKET" "Execution authorization packet status: pending"

require_text "$OPERATOR_CAPTURE" "PharmaCo360 Operations Command Center Operator Evidence Capture"
require_text "$OPERATOR_CAPTURE" "Evidence capture principle"
require_text "$OPERATOR_CAPTURE" "Required operator roles"
require_text "$OPERATOR_CAPTURE" "Pre-execution evidence capture"
require_text "$OPERATOR_CAPTURE" "During-execution evidence capture"
require_text "$OPERATOR_CAPTURE" "Post-execution evidence capture"
require_text "$OPERATOR_CAPTURE" "Evidence capture register"
require_text "$OPERATOR_CAPTURE" "Evidence capture boundary"
require_text "$OPERATOR_CAPTURE" "Evidence capture pass criteria"
require_text "$OPERATOR_CAPTURE" "Evidence capture fail criteria"
require_text "$OPERATOR_CAPTURE" "Operator evidence capture status: pending"

for required_doc in \
  "$FINAL_DECISION" \
  "$AUTHORIZATION_DOC" \
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
  require_file "$required_doc"
done

require_text "$ARCHITECTURE" "PharmaCo360 command center deployment execution authorization packet and operator evidence capture"
require_text "$ARCHITECTURE" "It does not create a production package archive"

echo "== Deployment execution authorization source identity =="
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

echo "== Required deployment execution authorization documents =="
for required_doc in \
  "$EXECUTION_PACKET" \
  "$OPERATOR_CAPTURE" \
  "$FINAL_DECISION" \
  "$AUTHORIZATION_DOC" \
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

echo "PharmaCo360 operations deployment execution authorization check passed."

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
DECISION_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_FINAL_APPROVAL_DECISION_LOG.md"
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

require_text "$QA_DOC" "Phase 15.7 production package final approval decision log and deployment authorization checklist"
require_text "$QA_DOC" "Final approval authorization evidence checklist"

require_text "$DECISION_LOG" "PharmaCo360 Operations Command Center Final Approval Decision Log"
require_text "$DECISION_LOG" "Decision principle"
require_text "$DECISION_LOG" "Required decision fields"
require_text "$DECISION_LOG" "Decision options"
require_text "$DECISION_LOG" "Decision register"
require_text "$DECISION_LOG" "Go decision requirements"
require_text "$DECISION_LOG" "No-go decision requirements"
require_text "$DECISION_LOG" "Conditional go requirements"
require_text "$DECISION_LOG" "Decision boundary"
require_text "$DECISION_LOG" "Decision log pass criteria"
require_text "$DECISION_LOG" "Decision log fail criteria"
require_text "$DECISION_LOG" "Decision log status: pending"

require_text "$AUTHORIZATION_DOC" "PharmaCo360 Operations Command Center Deployment Authorization Checklist"
require_text "$AUTHORIZATION_DOC" "Authorization principle"
require_text "$AUTHORIZATION_DOC" "Required authorization evidence"
require_text "$AUTHORIZATION_DOC" "Authorization checklist"
require_text "$AUTHORIZATION_DOC" "Authorization scope"
require_text "$AUTHORIZATION_DOC" "Authorization boundary"
require_text "$AUTHORIZATION_DOC" "Authorization pass criteria"
require_text "$AUTHORIZATION_DOC" "Authorization fail criteria"
require_text "$AUTHORIZATION_DOC" "Authorization checklist status: pending"

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
  require_file "$required_doc"
done

require_text "$ARCHITECTURE" "PharmaCo360 command center final approval decision log and deployment authorization checklist"
require_text "$ARCHITECTURE" "It does not create a production package archive"

echo "== Final approval source identity =="
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

echo "== Required final approval documents =="
for required_doc in \
  "$DECISION_LOG" \
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

echo "PharmaCo360 operations final approval check passed."

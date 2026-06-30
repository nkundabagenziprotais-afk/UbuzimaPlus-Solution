#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
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

require_text "$QA_DOC" "Phase 15.5 production deployment approval freeze and final release candidate sign-off"
require_text "$QA_DOC" "Release candidate freeze evidence checklist"

require_text "$FREEZE_DOC" "PharmaCo360 Operations Command Center Deployment Approval Freeze"
require_text "$FREEZE_DOC" "Freeze principle"
require_text "$FREEZE_DOC" "Freeze boundary"
require_text "$FREEZE_DOC" "Required freeze checks"
require_text "$FREEZE_DOC" "Required freeze documents"
require_text "$FREEZE_DOC" "Change control during freeze"
require_text "$FREEZE_DOC" "Freeze pass criteria"
require_text "$FREEZE_DOC" "Freeze fail criteria"
require_text "$FREEZE_DOC" "Freeze status: pending"

require_text "$SIGNOFF_DOC" "PharmaCo360 Operations Command Center Release Candidate Sign-Off"
require_text "$SIGNOFF_DOC" "Sign-off principle"
require_text "$SIGNOFF_DOC" "Required sign-off evidence"
require_text "$SIGNOFF_DOC" "Technical readiness sign-off"
require_text "$SIGNOFF_DOC" "Deployment readiness sign-off"
require_text "$SIGNOFF_DOC" "Safety sign-off"
require_text "$SIGNOFF_DOC" "Final go/no-go register"
require_text "$SIGNOFF_DOC" "Sign-off pass criteria"
require_text "$SIGNOFF_DOC" "Sign-off fail criteria"
require_text "$SIGNOFF_DOC" "Sign-off status: pending"

for required_doc in \
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

require_text "$ARCHITECTURE" "PharmaCo360 command center deployment approval freeze and release candidate sign-off"
require_text "$ARCHITECTURE" "It does not create a production package archive"

echo "== Release candidate source identity =="
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

echo "== Required release candidate freeze documents =="
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
  echo "Found: $required_doc"
done

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations release candidate freeze check passed."

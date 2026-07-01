#!/usr/bin/env bash
set -euo pipefail

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

PREFLIGHT_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_EVIDENCE_PREFLIGHT_LEDGER.md"
PREFLIGHT_EXCEPTION_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_PREFLIGHT_EXCEPTION_LOG.md"
RELEASE_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_AUTHORIZATION_RELEASE_LEDGER.md"
RELEASE_EXCEPTION_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_RELEASE_EXCEPTION_LOG.md"
READINESS_LOCK="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_READINESS_LOCK_LEDGER.md"
READINESS_UNLOCK_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_READINESS_UNLOCK_EXCEPTION_LOG.md"
CLOSURE_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_APPROVAL_EVIDENCE_CLOSURE_LEDGER.md"
APPROVAL_EXCEPTION_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_APPROVAL_EVIDENCE_EXCEPTION_LOG.md"
CHECKSUM_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_CHECKSUM_PREVIEW_LEDGER.md"
CHECKSUM_INDEX="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_CHECKSUM_REVIEW_INDEX.md"
MANIFEST_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_PACKAGE_MANIFEST_PREVIEW_LEDGER.md"
EXCLUSION_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_PACKAGE_EXCLUSION_PREVIEW_LEDGER.md"
EVIDENCE_MANIFEST="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_EVIDENCE_MANIFEST.md"
BINDER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_COMMAND_BINDER.md"
AUTH_GATE="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_AUTHORIZATION_GATE.md"
QA="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
ARCH="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

for file in "$PREFLIGHT_LEDGER" "$PREFLIGHT_EXCEPTION_LOG" "$RELEASE_LEDGER" "$RELEASE_EXCEPTION_LOG" "$READINESS_LOCK" "$READINESS_UNLOCK_LOG" "$CLOSURE_LEDGER" "$APPROVAL_EXCEPTION_LOG" "$CHECKSUM_LEDGER" "$CHECKSUM_INDEX" "$MANIFEST_LEDGER" "$EXCLUSION_LEDGER" "$EVIDENCE_MANIFEST" "$BINDER" "$AUTH_GATE" "$QA" "$ARCH"; do
  require_file "$file"
done

require_text "$QA" "Phase 16.8 controlled package generation execution evidence preflight ledger"
require_text "$ARCH" "PharmaCo360 controlled package generation execution evidence preflight ledger"

require_text "$PREFLIGHT_LEDGER" "Controlled Package Generation Execution Evidence Preflight Ledger"
require_text "$PREFLIGHT_LEDGER" "This document does not create a package archive"
require_text "$PREFLIGHT_LEDGER" "This document does not execute package generation"
require_text "$PREFLIGHT_LEDGER" "Required execution evidence preflight owners"
require_text "$PREFLIGHT_LEDGER" "Execution evidence preflight ledger"
require_text "$PREFLIGHT_LEDGER" "Required execution evidence"
require_text "$PREFLIGHT_LEDGER" "Allowed preflight decisions"
require_text "$PREFLIGHT_LEDGER" "Preflight requirements"
require_text "$PREFLIGHT_LEDGER" "Stop conditions"
require_text "$PREFLIGHT_LEDGER" "Prohibited action boundary"
require_text "$PREFLIGHT_LEDGER" "Default state: not ready for execution"

require_text "$PREFLIGHT_EXCEPTION_LOG" "Controlled Package Generation Execution Preflight Exception Log"
require_text "$PREFLIGHT_EXCEPTION_LOG" "This document does not create a package archive"
require_text "$PREFLIGHT_EXCEPTION_LOG" "This document does not execute package generation"
require_text "$PREFLIGHT_EXCEPTION_LOG" "Execution preflight exception log"
require_text "$PREFLIGHT_EXCEPTION_LOG" "Required exception types"
require_text "$PREFLIGHT_EXCEPTION_LOG" "Exception outcomes"
require_text "$PREFLIGHT_EXCEPTION_LOG" "Escalation rules"
require_text "$PREFLIGHT_EXCEPTION_LOG" "Default unresolved exception decision: stop"
require_text "$PREFLIGHT_EXCEPTION_LOG" "Prohibited action boundary"

echo "== Controlled package generation execution evidence preflight ledger source identity =="
echo "Current branch: $(git branch --show-current)"
echo "Current commit: $(git rev-parse --short HEAD)"

echo "== Protected-file tracked source inspection =="
protected_hits="$(
  git ls-files     | grep -E '(^|/)\.env$|(^|/)\.env\.(local|production|backup|bak|old)$|(^|/)database/database\.sqlite$|\.sqlite$|(^|/)storage/logs/|(^|/)node_modules/|(^|/)\.DS_Store$|\.tar$|\.tar\.gz$|\.zip$'     | grep -vE '(^|/)storage/logs/\.gitignore$'     || true
)"

if [ -n "$protected_hits" ]; then
  echo "Protected files found in tracked source:"
  echo "$protected_hits"
  exit 1
fi

echo "No protected tracked files found."

echo "== Required Phase 16.8 documents =="
echo "Found: $PREFLIGHT_LEDGER"
echo "Found: $PREFLIGHT_EXCEPTION_LOG"
echo "Found: $RELEASE_LEDGER"
echo "Found: $RELEASE_EXCEPTION_LOG"
echo "Found: $READINESS_LOCK"
echo "Found: $READINESS_UNLOCK_LOG"
echo "Found: $CLOSURE_LEDGER"
echo "Found: $APPROVAL_EXCEPTION_LOG"
echo "Found: $CHECKSUM_LEDGER"
echo "Found: $CHECKSUM_INDEX"
echo "Found: $MANIFEST_LEDGER"
echo "Found: $EXCLUSION_LEDGER"
echo "Found: $EVIDENCE_MANIFEST"
echo "Found: $BINDER"
echo "Found: $AUTH_GATE"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations controlled package generation execution evidence preflight ledger check passed."

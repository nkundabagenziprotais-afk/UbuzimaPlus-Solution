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

DECISION_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_DECISION_HOLD_LEDGER.md"
DECISION_EXCEPTION_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_DECISION_EXCEPTION_LOG.md"
AUTH_PACKET="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_FINAL_EXECUTION_AUTHORIZATION_PACKET.md"
AUTH_EXCEPTION_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_FINAL_EXECUTION_AUTHORIZATION_EXCEPTION_LOG.md"
HOLD_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_COMMAND_RELEASE_HOLD_LEDGER.md"
HOLD_EXCEPTION_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_COMMAND_RELEASE_HOLD_EXCEPTION_LOG.md"
PREFLIGHT_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_EVIDENCE_PREFLIGHT_LEDGER.md"
PREFLIGHT_EXCEPTION_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_PREFLIGHT_EXCEPTION_LOG.md"
RELEASE_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_AUTHORIZATION_RELEASE_LEDGER.md"
RELEASE_EXCEPTION_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_RELEASE_EXCEPTION_LOG.md"
READINESS_LOCK="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_READINESS_LOCK_LEDGER.md"
READINESS_UNLOCK_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_READINESS_UNLOCK_EXCEPTION_LOG.md"
CLOSURE_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_APPROVAL_EVIDENCE_CLOSURE_LEDGER.md"
CHECKSUM_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_CHECKSUM_PREVIEW_LEDGER.md"
MANIFEST_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_PACKAGE_MANIFEST_PREVIEW_LEDGER.md"
EXCLUSION_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_PACKAGE_EXCLUSION_PREVIEW_LEDGER.md"
EVIDENCE_MANIFEST="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_EVIDENCE_MANIFEST.md"
BINDER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_COMMAND_BINDER.md"
AUTH_GATE="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_AUTHORIZATION_GATE.md"
QA="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
ARCH="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

for file in "$DECISION_LEDGER" "$DECISION_EXCEPTION_LOG" "$AUTH_PACKET" "$AUTH_EXCEPTION_LOG" "$HOLD_LEDGER" "$HOLD_EXCEPTION_LOG" "$PREFLIGHT_LEDGER" "$PREFLIGHT_EXCEPTION_LOG" "$RELEASE_LEDGER" "$RELEASE_EXCEPTION_LOG" "$READINESS_LOCK" "$READINESS_UNLOCK_LOG" "$CLOSURE_LEDGER" "$CHECKSUM_LEDGER" "$MANIFEST_LEDGER" "$EXCLUSION_LEDGER" "$EVIDENCE_MANIFEST" "$BINDER" "$AUTH_GATE" "$QA" "$ARCH"; do
  require_file "$file"
done

require_text "$QA" "Phase 17.1 controlled package generation execution decision hold ledger"
require_text "$ARCH" "PharmaCo360 controlled package generation execution decision hold ledger"

require_text "$DECISION_LEDGER" "Controlled Package Generation Execution Decision Hold Ledger"
require_text "$DECISION_LEDGER" "This document does not create a package archive"
require_text "$DECISION_LEDGER" "This document does not execute package generation"
require_text "$DECISION_LEDGER" "This document does not authorize final execution"
require_text "$DECISION_LEDGER" "Required execution decision owners"
require_text "$DECISION_LEDGER" "Execution decision hold ledger"
require_text "$DECISION_LEDGER" "Required execution decision evidence"
require_text "$DECISION_LEDGER" "Allowed execution decision outcomes"
require_text "$DECISION_LEDGER" "Execution decision requirements"
require_text "$DECISION_LEDGER" "Stop conditions"
require_text "$DECISION_LEDGER" "Prohibited action boundary"
require_text "$DECISION_LEDGER" "Default state: execution decision held"

require_text "$DECISION_EXCEPTION_LOG" "Controlled Package Generation Execution Decision Exception Log"
require_text "$DECISION_EXCEPTION_LOG" "This document does not create a package archive"
require_text "$DECISION_EXCEPTION_LOG" "This document does not execute package generation"
require_text "$DECISION_EXCEPTION_LOG" "This document does not authorize final execution"
require_text "$DECISION_EXCEPTION_LOG" "Execution decision exception log"
require_text "$DECISION_EXCEPTION_LOG" "Required exception types"
require_text "$DECISION_EXCEPTION_LOG" "Exception outcomes"
require_text "$DECISION_EXCEPTION_LOG" "Escalation rules"
require_text "$DECISION_EXCEPTION_LOG" "Default unresolved exception decision: stop"
require_text "$DECISION_EXCEPTION_LOG" "Prohibited action boundary"

echo "== Controlled package generation execution decision hold ledger source identity =="
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

echo "== Required Phase 17.1 documents =="
echo "Found: $DECISION_LEDGER"
echo "Found: $DECISION_EXCEPTION_LOG"
echo "Found: $AUTH_PACKET"
echo "Found: $AUTH_EXCEPTION_LOG"
echo "Found: $HOLD_LEDGER"
echo "Found: $HOLD_EXCEPTION_LOG"
echo "Found: $PREFLIGHT_LEDGER"
echo "Found: $PREFLIGHT_EXCEPTION_LOG"
echo "Found: $RELEASE_LEDGER"
echo "Found: $RELEASE_EXCEPTION_LOG"
echo "Found: $READINESS_LOCK"
echo "Found: $READINESS_UNLOCK_LOG"
echo "Found: $CLOSURE_LEDGER"
echo "Found: $CHECKSUM_LEDGER"
echo "Found: $MANIFEST_LEDGER"
echo "Found: $EXCLUSION_LEDGER"
echo "Found: $EVIDENCE_MANIFEST"
echo "Found: $BINDER"
echo "Found: $AUTH_GATE"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations controlled package generation execution decision hold ledger check passed."

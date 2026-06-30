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

LOCK_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_READINESS_LOCK_LEDGER.md"
UNLOCK_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_READINESS_UNLOCK_EXCEPTION_LOG.md"
CLOSURE_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_APPROVAL_EVIDENCE_CLOSURE_LEDGER.md"
EXCEPTION_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_APPROVAL_EVIDENCE_EXCEPTION_LOG.md"
CHECKSUM_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_CHECKSUM_PREVIEW_LEDGER.md"
CHECKSUM_INDEX="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_CHECKSUM_REVIEW_INDEX.md"
MANIFEST_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_PACKAGE_MANIFEST_PREVIEW_LEDGER.md"
EXCLUSION_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_PACKAGE_EXCLUSION_PREVIEW_LEDGER.md"
EVIDENCE_MANIFEST="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_EVIDENCE_MANIFEST.md"
BINDER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_COMMAND_BINDER.md"
AUTH_GATE="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_AUTHORIZATION_GATE.md"
QA="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
ARCH="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

for file in "$LOCK_LEDGER" "$UNLOCK_LOG" "$CLOSURE_LEDGER" "$EXCEPTION_LOG" "$CHECKSUM_LEDGER" "$CHECKSUM_INDEX" "$MANIFEST_LEDGER" "$EXCLUSION_LEDGER" "$EVIDENCE_MANIFEST" "$BINDER" "$AUTH_GATE" "$QA" "$ARCH"; do
  require_file "$file"
done

require_text "$QA" "Phase 16.6 package generation readiness lock ledger"
require_text "$ARCH" "PharmaCo360 package generation readiness lock ledger"

require_text "$LOCK_LEDGER" "Package Generation Readiness Lock Ledger"
require_text "$LOCK_LEDGER" "This document does not create a package archive"
require_text "$LOCK_LEDGER" "Required readiness lock owners"
require_text "$LOCK_LEDGER" "Readiness lock ledger"
require_text "$LOCK_LEDGER" "Required lock evidence"
require_text "$LOCK_LEDGER" "Allowed lock decisions"
require_text "$LOCK_LEDGER" "Unlock requirements"
require_text "$LOCK_LEDGER" "Stop conditions"
require_text "$LOCK_LEDGER" "Prohibited action boundary"
require_text "$LOCK_LEDGER" "Default state: locked"

require_text "$UNLOCK_LOG" "Package Generation Readiness Unlock Exception Log"
require_text "$UNLOCK_LOG" "This document does not create a package archive"
require_text "$UNLOCK_LOG" "does not execute package generation"
require_text "$UNLOCK_LOG" "Unlock exception log"
require_text "$UNLOCK_LOG" "Required exception types"
require_text "$UNLOCK_LOG" "Exception outcomes"
require_text "$UNLOCK_LOG" "Escalation rules"
require_text "$UNLOCK_LOG" "Default unresolved exception decision: stop"
require_text "$UNLOCK_LOG" "Prohibited action boundary"

echo "== Package generation readiness lock ledger source identity =="
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

echo "== Required Phase 16.6 documents =="
echo "Found: $LOCK_LEDGER"
echo "Found: $UNLOCK_LOG"
echo "Found: $CLOSURE_LEDGER"
echo "Found: $EXCEPTION_LOG"
echo "Found: $CHECKSUM_LEDGER"
echo "Found: $CHECKSUM_INDEX"
echo "Found: $MANIFEST_LEDGER"
echo "Found: $EXCLUSION_LEDGER"
echo "Found: $EVIDENCE_MANIFEST"
echo "Found: $BINDER"
echo "Found: $AUTH_GATE"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations package generation readiness lock ledger check passed."

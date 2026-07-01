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

for file in "$CLOSURE_LEDGER" "$EXCEPTION_LOG" "$CHECKSUM_LEDGER" "$CHECKSUM_INDEX" "$MANIFEST_LEDGER" "$EXCLUSION_LEDGER" "$EVIDENCE_MANIFEST" "$BINDER" "$AUTH_GATE" "$QA" "$ARCH"; do
  require_file "$file"
done

require_text "$QA" "Phase 16.5 dry-run approval evidence closure ledger"
require_text "$ARCH" "PharmaCo360 dry-run approval evidence closure ledger"

require_text "$CLOSURE_LEDGER" "Dry-Run Approval Evidence Closure Ledger"
require_text "$CLOSURE_LEDGER" "This document does not execute approval"
require_text "$CLOSURE_LEDGER" "Required closure owners"
require_text "$CLOSURE_LEDGER" "Approval evidence closure ledger"
require_text "$CLOSURE_LEDGER" "Required closure evidence"
require_text "$CLOSURE_LEDGER" "Review outcomes"
require_text "$CLOSURE_LEDGER" "Stop conditions"
require_text "$CLOSURE_LEDGER" "Prohibited action boundary"
require_text "$CLOSURE_LEDGER" "Approval evidence closure ledger status: pending"

require_text "$EXCEPTION_LOG" "Dry-Run Approval Evidence Exception Log"
require_text "$EXCEPTION_LOG" "This document does not execute approval"
require_text "$EXCEPTION_LOG" "Exception log"
require_text "$EXCEPTION_LOG" "Required exception types"
require_text "$EXCEPTION_LOG" "Exception outcomes"
require_text "$EXCEPTION_LOG" "Escalation rules"
require_text "$EXCEPTION_LOG" "Prohibited action boundary"
require_text "$EXCEPTION_LOG" "Approval evidence exception log status: pending"

echo "== Dry-run approval evidence closure ledger source identity =="
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

echo "== Required Phase 16.5 documents =="
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

echo "PharmaCo360 operations dry-run approval evidence closure ledger check passed."

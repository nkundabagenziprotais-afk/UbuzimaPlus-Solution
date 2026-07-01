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

CHECKSUM_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_CHECKSUM_PREVIEW_LEDGER.md"
CHECKSUM_INDEX="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_CHECKSUM_REVIEW_INDEX.md"
MANIFEST_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_PACKAGE_MANIFEST_PREVIEW_LEDGER.md"
EXCLUSION_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_PACKAGE_EXCLUSION_PREVIEW_LEDGER.md"
EVIDENCE_MANIFEST="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_EVIDENCE_MANIFEST.md"
QA="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
ARCH="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

for file in "$CHECKSUM_LEDGER" "$CHECKSUM_INDEX" "$MANIFEST_LEDGER" "$EXCLUSION_LEDGER" "$EVIDENCE_MANIFEST" "$QA" "$ARCH"; do
  require_file "$file"
done

require_text "$QA" "Phase 16.4 dry-run checksum preview ledger"
require_text "$ARCH" "PharmaCo360 dry-run checksum preview ledger"

require_text "$CHECKSUM_LEDGER" "Dry-Run Checksum Preview Ledger"
require_text "$CHECKSUM_LEDGER" "This document does not generate checksums"
require_text "$CHECKSUM_LEDGER" "Required checksum owners"
require_text "$CHECKSUM_LEDGER" "Checksum preview ledger"
require_text "$CHECKSUM_LEDGER" "Allowed checksum preview methods"
require_text "$CHECKSUM_LEDGER" "The actual checksum must not be generated in this phase"
require_text "$CHECKSUM_LEDGER" "Review checkpoints"
require_text "$CHECKSUM_LEDGER" "Stop conditions"
require_text "$CHECKSUM_LEDGER" "Prohibited action boundary"
require_text "$CHECKSUM_LEDGER" "Checksum preview ledger status: pending"

require_text "$CHECKSUM_INDEX" "Dry-Run Checksum Review Index"
require_text "$CHECKSUM_INDEX" "This document does not generate checksums"
require_text "$CHECKSUM_INDEX" "Checksum review index"
require_text "$CHECKSUM_INDEX" "Required review outcomes"
require_text "$CHECKSUM_INDEX" "Missing review handling"
require_text "$CHECKSUM_INDEX" "Closure checklist"
require_text "$CHECKSUM_INDEX" "Prohibited action boundary"
require_text "$CHECKSUM_INDEX" "Checksum review index status: pending"

echo "== Dry-run checksum preview ledger source identity =="
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

echo "== Required Phase 16.4 documents =="
echo "Found: $CHECKSUM_LEDGER"
echo "Found: $CHECKSUM_INDEX"
echo "Found: $MANIFEST_LEDGER"
echo "Found: $EXCLUSION_LEDGER"
echo "Found: $EVIDENCE_MANIFEST"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations dry-run checksum preview ledger check passed."

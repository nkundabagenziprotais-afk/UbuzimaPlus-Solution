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

MANIFEST_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_PACKAGE_MANIFEST_PREVIEW_LEDGER.md"
EXCLUSION_LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DRY_RUN_PACKAGE_EXCLUSION_PREVIEW_LEDGER.md"
EVIDENCE_MANIFEST="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_EVIDENCE_MANIFEST.md"
EVIDENCE_INDEX="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_EVIDENCE_INDEX.md"
BINDER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_COMMAND_BINDER.md"
QA="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
ARCH="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

for file in "$MANIFEST_LEDGER" "$EXCLUSION_LEDGER" "$EVIDENCE_MANIFEST" "$EVIDENCE_INDEX" "$BINDER" "$QA" "$ARCH"; do
  require_file "$file"
done

require_text "$QA" "Phase 16.3 dry-run package manifest preview ledger"
require_text "$ARCH" "PharmaCo360 dry-run package manifest preview ledger"

require_text "$MANIFEST_LEDGER" "Dry-Run Package Manifest Preview Ledger"
require_text "$MANIFEST_LEDGER" "This document does not create a package archive"
require_text "$MANIFEST_LEDGER" "execute package generation"
require_text "$MANIFEST_LEDGER" "Required preview owners"
require_text "$MANIFEST_LEDGER" "Manifest preview ledger"
require_text "$MANIFEST_LEDGER" "Required inclusion categories"
require_text "$MANIFEST_LEDGER" "Review checkpoints"
require_text "$MANIFEST_LEDGER" "Prohibited action boundary"
require_text "$MANIFEST_LEDGER" "Manifest preview ledger status: pending"

require_text "$EXCLUSION_LEDGER" "Dry-Run Package Exclusion Preview Ledger"
require_text "$EXCLUSION_LEDGER" "This document does not create a package archive"
require_text "$EXCLUSION_LEDGER" "Required exclusion owners"
require_text "$EXCLUSION_LEDGER" "Exclusion preview ledger"
require_text "$EXCLUSION_LEDGER" "Required exclusion categories"
require_text "$EXCLUSION_LEDGER" "Stop conditions"
require_text "$EXCLUSION_LEDGER" "Prohibited action boundary"
require_text "$EXCLUSION_LEDGER" "Exclusion preview ledger status: pending"

echo "== Dry-run package manifest preview ledger source identity =="
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

echo "== Required Phase 16.3 documents =="
echo "Found: $MANIFEST_LEDGER"
echo "Found: $EXCLUSION_LEDGER"
echo "Found: $EVIDENCE_MANIFEST"
echo "Found: $EVIDENCE_INDEX"
echo "Found: $BINDER"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations dry-run package manifest preview ledger check passed."

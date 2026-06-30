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

MANIFEST="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_EVIDENCE_MANIFEST.md"
INDEX="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_EVIDENCE_INDEX.md"
BINDER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_COMMAND_BINDER.md"
CAPTURE="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_EVIDENCE_CAPTURE.md"
AUTH_GATE="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_AUTHORIZATION_GATE.md"
QA="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
ARCH="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

for file in "$MANIFEST" "$INDEX" "$BINDER" "$CAPTURE" "$AUTH_GATE" "$QA" "$ARCH"; do
  require_file "$file"
done

require_text "$QA" "Phase 16.2 package generation dry-run evidence manifest"
require_text "$ARCH" "PharmaCo360 package generation dry-run evidence manifest"

require_text "$MANIFEST" "Package Generation Dry-Run Evidence Manifest"
require_text "$MANIFEST" "This document does not generate a package archive"
require_text "$MANIFEST" "execute package generation"
require_text "$MANIFEST" "Required evidence owners"
require_text "$MANIFEST" "Evidence naming rules"
require_text "$MANIFEST" "Dry-run evidence manifest"
require_text "$MANIFEST" "Evidence storage placeholders"
require_text "$MANIFEST" "Review checkpoints"
require_text "$MANIFEST" "Prohibited action boundary"
require_text "$MANIFEST" "Dry-run evidence manifest status: pending"

require_text "$INDEX" "Package Generation Dry-Run Evidence Index"
require_text "$INDEX" "Evidence index register"
require_text "$INDEX" "Required review outcomes"
require_text "$INDEX" "Missing evidence handling"
require_text "$INDEX" "Evidence closure checklist"
require_text "$INDEX" "Prohibited action boundary"
require_text "$INDEX" "Dry-run evidence index status: pending"

echo "== Package generation dry-run evidence manifest source identity =="
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

echo "== Required Phase 16.2 documents =="
echo "Found: $MANIFEST"
echo "Found: $INDEX"
echo "Found: $BINDER"
echo "Found: $CAPTURE"
echo "Found: $AUTH_GATE"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations package generation dry-run evidence manifest check passed."

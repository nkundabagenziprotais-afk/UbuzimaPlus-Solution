#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
MANIFEST_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_MANIFEST_CHECKLIST.md"
CHECKSUM_DOC="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CHECKSUM_EVIDENCE_CHECKLIST.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$QA_DOC" "Phase 15.2 production package manifest and checksum evidence checklist"
require_text "$QA_DOC" "Package manifest evidence checklist"

require_text "$MANIFEST_DOC" "PharmaCo360 Operations Command Center Package Manifest Checklist"
require_text "$MANIFEST_DOC" "Manifest principle"
require_text "$MANIFEST_DOC" "Required manifest fields"
require_text "$MANIFEST_DOC" "Required source traceability"
require_text "$MANIFEST_DOC" "Required content groups"
require_text "$MANIFEST_DOC" "Required exclusion evidence"
require_text "$MANIFEST_DOC" "Protected production assets"
require_text "$MANIFEST_DOC" "Manifest pass criteria"
require_text "$MANIFEST_DOC" "Manifest fail criteria"
require_text "$MANIFEST_DOC" "Manifest status: pending"

require_text "$CHECKSUM_DOC" "PharmaCo360 Operations Command Center Checksum Evidence Checklist"
require_text "$CHECKSUM_DOC" "Checksum principle"
require_text "$CHECKSUM_DOC" "Required checksum evidence"
require_text "$CHECKSUM_DOC" "Recommended checksum methods"
require_text "$CHECKSUM_DOC" "Required verification steps"
require_text "$CHECKSUM_DOC" "Integrity verification"
require_text "$CHECKSUM_DOC" "Protected-file checksum caution"
require_text "$CHECKSUM_DOC" "Checksum pass criteria"
require_text "$CHECKSUM_DOC" "Checksum fail criteria"
require_text "$CHECKSUM_DOC" "Checksum status: pending"

require_text "$ARCHITECTURE" "PharmaCo360 command center package manifest and checksum evidence"
require_text "$ARCHITECTURE" "It does not build a production package"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations package manifest check passed."

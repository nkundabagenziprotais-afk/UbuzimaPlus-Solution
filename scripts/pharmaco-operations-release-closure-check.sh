#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QA_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
RELEASE_DOC="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_RELEASE_CLOSURE.md"
ARCHITECTURE="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

require_text() {
  local file="$1"
  local text="$2"

  if ! grep -Fq "$text" "$file"; then
    echo "Missing expected text in $file: $text"
    exit 1
  fi
}

require_text "$QA_DOC" "Phase 14.5 release closure and deployment evidence checklist"
require_text "$QA_DOC" "Deployment evidence checklist"

require_text "$RELEASE_DOC" "PharmaCo360 Operations Command Center Release Closure"
require_text "$RELEASE_DOC" "The command center is a read-only management layer"
require_text "$RELEASE_DOC" "Stakeholder review checklist"
require_text "$RELEASE_DOC" "Technical reviewer"
require_text "$RELEASE_DOC" "Deployment reviewer"
require_text "$RELEASE_DOC" "Production deployment evidence to capture"
require_text "$RELEASE_DOC" "cPanel deployment notes"
require_text "$RELEASE_DOC" "Approve release closure only when"

require_text "$ARCHITECTURE" "PharmaCo360 command center release closure"
require_text "$ARCHITECTURE" "The phase is documentation and validation only"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations release closure check passed."

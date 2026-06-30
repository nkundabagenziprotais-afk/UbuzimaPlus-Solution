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

BINDER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_COMMAND_BINDER.md"
EVIDENCE="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_DRY_RUN_EVIDENCE_CAPTURE.md"
AUTH_GATE="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_AUTHORIZATION_GATE.md"
AUTH_EVIDENCE="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_AUTHORIZATION_EVIDENCE.md"
RUNBOOK="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_RUNBOOK.md"
ROLLBACK="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_ROLLBACK_EVIDENCE.md"
QA="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
ARCH="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

for file in "$BINDER" "$EVIDENCE" "$AUTH_GATE" "$AUTH_EVIDENCE" "$RUNBOOK" "$ROLLBACK" "$QA" "$ARCH"; do
  require_file "$file"
done

require_text "$QA" "Phase 16.1 controlled package generation dry-run command binder"
require_text "$ARCH" "PharmaCo360 package generation dry-run command binder"

require_text "$BINDER" "Package Generation Dry-Run Command Binder"
require_text "$BINDER" "This document does not generate a package archive"
require_text "$BINDER" "Dry-run principle"
require_text "$BINDER" "Required binder owners"
require_text "$BINDER" "Command preview register"
require_text "$BINDER" "Required dry-run command categories"
require_text "$BINDER" "Stop conditions"
require_text "$BINDER" "Prohibited command boundary"
require_text "$BINDER" "Dry-run binder status: pending"

require_text "$EVIDENCE" "Package Generation Dry-Run Evidence Capture"
require_text "$EVIDENCE" "Pre-dry-run evidence register"
require_text "$EVIDENCE" "Dry-run result evidence register"
require_text "$EVIDENCE" "Required exclusion preview"
require_text "$EVIDENCE" "Evidence boundary"
require_text "$EVIDENCE" "Dry-run evidence status: pending"

echo "== Package generation dry-run binder source identity =="
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

echo "== Required Phase 16.1 documents =="
echo "Found: $BINDER"
echo "Found: $EVIDENCE"
echo "Found: $AUTH_GATE"
echo "Found: $AUTH_EVIDENCE"
echo "Found: $RUNBOOK"
echo "Found: $ROLLBACK"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations package generation dry-run binder check passed."

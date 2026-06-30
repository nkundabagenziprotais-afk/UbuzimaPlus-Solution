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

GATE="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_AUTHORIZATION_GATE.md"
EVIDENCE="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_PACKAGE_GENERATION_AUTHORIZATION_EVIDENCE.md"
RUNBOOK="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_RUNBOOK.md"
ROLLBACK="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_ROLLBACK_EVIDENCE.md"
EXECUTION="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_EXECUTION_AUTHORIZATION_PACKET.md"
QA="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
ARCH="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

for file in "$GATE" "$EVIDENCE" "$RUNBOOK" "$ROLLBACK" "$EXECUTION" "$QA" "$ARCH"; do
  require_file "$file"
done

require_text "$QA" "Phase 16.0 controlled package generation authorization gate"
require_text "$ARCH" "PharmaCo360 controlled package generation authorization gate"

require_text "$GATE" "Package Generation Authorization Gate"
require_text "$GATE" "Production package generation must not happen automatically"
require_text "$GATE" "Required gate owners"
require_text "$GATE" "Required authorization checks"
require_text "$GATE" "Authorization decisions"
require_text "$GATE" "Package generation boundary"
require_text "$GATE" "Package generation gate status: pending"

require_text "$EVIDENCE" "Package Generation Authorization Evidence"
require_text "$EVIDENCE" "Pre-generation evidence register"
require_text "$EVIDENCE" "Post-generation evidence register"
require_text "$EVIDENCE" "Required exclusions"
require_text "$EVIDENCE" "Package generation evidence status: pending"

echo "== Package generation authorization source identity =="
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

echo "== Required Phase 16.0 documents =="
echo "Found: $GATE"
echo "Found: $EVIDENCE"
echo "Found: $RUNBOOK"
echo "Found: $ROLLBACK"
echo "Found: $EXECUTION"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations package generation authorization check passed."

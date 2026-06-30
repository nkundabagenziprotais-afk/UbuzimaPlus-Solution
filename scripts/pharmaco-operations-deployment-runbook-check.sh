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

RUNBOOK="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_DEPLOYMENT_RUNBOOK.md"
ROLLBACK="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_ROLLBACK_EVIDENCE.md"
QA="docs/qa/PHARMACO_OPERATIONS_COMMAND_CENTER_QA.md"
ARCH="docs/architecture/PHARMACO_SALES_DISPENSING_FOUNDATION.md"

for file in "$RUNBOOK" "$ROLLBACK" "$QA" "$ARCH"; do
  require_file "$file"
done

require_text "$QA" "Phase 15.9 deployment runbook and rollback evidence"
require_text "$ARCH" "PharmaCo360 command center deployment runbook and rollback evidence"

require_text "$RUNBOOK" "This is not a deployment script"
require_text "$RUNBOOK" "Command sequence register"
require_text "$RUNBOOK" "Prohibited unless separately authorized"
require_text "$RUNBOOK" "package archive creation"
require_text "$RUNBOOK" "production migration execution"
require_text "$RUNBOOK" "destructive database command"

require_text "$ROLLBACK" "Rollback trigger register"
require_text "$ROLLBACK" "Rollback readiness register"
require_text "$ROLLBACK" 'Production `.env` exclusion confirmed'
require_text "$ROLLBACK" "Production storage exclusion confirmed"
require_text "$ROLLBACK" "Database rollback boundary confirmed"
require_text "$ROLLBACK" "This document does not authorize rollback execution"

echo "== Deployment runbook source identity =="
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

echo "== Required Phase 15.9 documents =="
echo "Found: $RUNBOOK"
echo "Found: $ROLLBACK"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations deployment runbook check passed."

#!/usr/bin/env bash
set -euo pipefail

echo "== Controlled package generation execution package contents quarantine ledger source identity =="
echo "Current branch: $(git branch --show-current)"
echo "Current commit: $(git rev-parse --short HEAD)"

LEDGER="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_PACKAGE_CONTENTS_QUARANTINE_LEDGER.md"
EXCEPTION_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_PACKAGE_CONTENTS_QUARANTINE_EXCEPTION_LOG.md"

PACKAGE_MANIFEST="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_PACKAGE_MANIFEST_QUARANTINE_LEDGER.md"
PACKAGE_MANIFEST_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_PACKAGE_MANIFEST_QUARANTINE_EXCEPTION_LOG.md"

CHECKSUM_TARGET="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_CHECKSUM_TARGET_QUARANTINE_LEDGER.md"
CHECKSUM_TARGET_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_CHECKSUM_TARGET_QUARANTINE_EXCEPTION_LOG.md"

ARCHIVE_TARGET="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_ARCHIVE_TARGET_QUARANTINE_LEDGER.md"
ARCHIVE_TARGET_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_ARCHIVE_TARGET_QUARANTINE_EXCEPTION_LOG.md"

PACKAGE_BUILD="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_PACKAGE_BUILD_COMMAND_QUARANTINE_LEDGER.md"
PACKAGE_BUILD_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_PACKAGE_BUILD_COMMAND_QUARANTINE_EXCEPTION_LOG.md"

FINAL_GO="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_FINAL_GO_NO_GO_HOLD_LEDGER.md"
FINAL_GO_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_FINAL_GO_NO_GO_HOLD_EXCEPTION_LOG.md"

FINAL_AUTH="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_FINAL_AUTHORIZATION_EVIDENCE_LEDGER.md"
FINAL_AUTH_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_FINAL_AUTHORIZATION_EVIDENCE_EXCEPTION_LOG.md"

OWNER_LOCK="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_OWNER_AUTHORIZATION_LOCK_LEDGER.md"
OWNER_LOCK_LOG="docs/deployment/PHARMACO_OPERATIONS_COMMAND_CENTER_CONTROLLED_PACKAGE_GENERATION_EXECUTION_OWNER_AUTHORIZATION_LOCK_EXCEPTION_LOG.md"

echo "== Protected-file tracked source inspection =="
if git ls-files | grep -E '(^|/)\.env$|(^|/)\.env\.|id_rsa|id_dsa|\.pem$|\.key$|secrets|credentials|production\.sqlite|database\.sqlite' | grep -vE '(^|/)\.env\.example$'; then
  echo "Protected tracked file detected."
  exit 1
else
  echo "No protected tracked files found."
fi

echo "== Required Phase 18.5 documents =="
for required in   "$LEDGER"   "$EXCEPTION_LOG"   "$PACKAGE_MANIFEST"   "$PACKAGE_MANIFEST_LOG"   "$CHECKSUM_TARGET"   "$CHECKSUM_TARGET_LOG"   "$ARCHIVE_TARGET"   "$ARCHIVE_TARGET_LOG"   "$PACKAGE_BUILD"   "$PACKAGE_BUILD_LOG"   "$FINAL_GO"   "$FINAL_GO_LOG"   "$FINAL_AUTH"   "$FINAL_AUTH_LOG"   "$OWNER_LOCK"   "$OWNER_LOCK_LOG"
do
  if [ ! -f "$required" ]; then
    echo "Missing required document: $required"
    exit 1
  fi
  echo "Found: $required"
done

grep -q "No package contents list was released" "$LEDGER"
grep -q "No package contents list was executed" "$LEDGER"
grep -q "No package manifest was created" "$LEDGER"
grep -q "No checksum was generated" "$LEDGER"
grep -q "No package archive was created" "$LEDGER"
grep -q "No package-build command was released" "$LEDGER"
grep -q "No package-build command was executed" "$LEDGER"
grep -q "No package generation was executed" "$LEDGER"
grep -q "No cPanel execution occurred" "$LEDGER"
grep -q "No live deployment occurred" "$LEDGER"
grep -q "No data mutation occurred" "$LEDGER"
grep -q "The system remains in controlled package contents quarantine hold status" "$LEDGER"

npm --prefix web/admin-dashboard run build

echo "PharmaCo360 operations controlled package generation execution package contents quarantine ledger check passed."

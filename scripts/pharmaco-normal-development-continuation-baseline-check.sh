#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

FAILURES=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAILURES=$((FAILURES + 1)); }

section() {
  echo ""
  echo "============================================================"
  echo "$1"
  echo "============================================================"
}

tracked_files() {
  git ls-files
}

read_status_value() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "$file" | cut -d= -f2- || true
}

section "Phase 20.0 Normal Development Continuation Baseline Check"

BRANCH="$(git branch --show-current 2>/dev/null || true)"
echo "Current branch: ${BRANCH:-UNKNOWN}"

section "1. Source branch is not a production branch"

case "$BRANCH" in
  main|master|production|prod|release|release/*|hotfix/production|hotfix/production/*)
    fail "Current branch '$BRANCH' is protected."
    ;;
  "")
    fail "Unable to determine current branch."
    ;;
  *)
    pass "Current branch '$BRANCH' is not a production branch."
    ;;
esac

section "2. Source branch is based on latest development"

if git fetch origin development --quiet; then
  if git merge-base --is-ancestor origin/development HEAD; then
    pass "Current branch contains latest origin/development."
  else
    fail "Current branch does not contain latest origin/development."
  fi
else
  fail "Unable to fetch origin/development."
fi

section "3. Phase 19.5 package lock evidence exists and passed"

PHASE_19_5="docs/pharmaco/controlled-package-generation/authorization-blocked-package-readiness-snapshot/PHASE_19_5_AUTHORIZATION_BLOCKED_PACKAGE_READINESS_SNAPSHOT_EVIDENCE_OUTPUT.txt"

if [ -f "$PHASE_19_5" ] && grep -q "PHASE 19.5 AUTHORIZATION-BLOCKED PACKAGE READINESS SNAPSHOT CHECK PASSED" "$PHASE_19_5"; then
  pass "Phase 19.5 evidence exists and passed."
else
  fail "Phase 19.5 evidence missing or failed."
fi

section "4. Phase 20.0 baseline files exist"

DOC_FILE="docs/pharmaco/normal-development-continuation-baseline/PHASE_20_0_NORMAL_DEVELOPMENT_CONTINUATION_BASELINE.md"
STATUS_FILE="docs/pharmaco/normal-development-continuation-baseline/PHASE_20_0_NORMAL_DEVELOPMENT_CONTINUATION_BASELINE_STATUS.env"

if [ -f "$DOC_FILE" ]; then
  pass "Phase 20.0 baseline document exists."
else
  fail "Missing Phase 20.0 baseline document."
fi

if [ -f "$STATUS_FILE" ]; then
  pass "Phase 20.0 baseline status file exists."
else
  fail "Missing Phase 20.0 baseline status file."
fi

section "5. Normal development is allowed while package generation remains locked"

if [ -f "$STATUS_FILE" ]; then
  NORMAL_DEVELOPMENT_STATUS="$(read_status_value "$STATUS_FILE" "NORMAL_DEVELOPMENT_STATUS")"
  PACKAGE_GENERATION_STATUS="$(read_status_value "$STATUS_FILE" "PACKAGE_GENERATION_STATUS")"
  OWNER_GRANTED="$(read_status_value "$STATUS_FILE" "OWNER_AUTHORIZATION_GRANTED")"
  FINAL_AUTH_PERCENT="$(read_status_value "$STATUS_FILE" "FINAL_PACKAGE_GENERATION_AUTHORIZATION_PERCENT")"

  if [ "$NORMAL_DEVELOPMENT_STATUS" = "ALLOWED" ]; then
    pass "Normal development status is ALLOWED."
  else
    fail "Normal development status is not ALLOWED. Current value: ${NORMAL_DEVELOPMENT_STATUS:-MISSING}"
  fi

  if [ "$PACKAGE_GENERATION_STATUS" = "LOCKED" ]; then
    pass "Package generation status remains LOCKED."
  else
    fail "Package generation status is not LOCKED. Current value: ${PACKAGE_GENERATION_STATUS:-MISSING}"
  fi

  if [ "$OWNER_GRANTED" = "NO" ]; then
    pass "Owner authorization remains not granted."
  else
    fail "Owner authorization is not NO. Current value: ${OWNER_GRANTED:-MISSING}"
  fi

  if [ "$FINAL_AUTH_PERCENT" = "0" ]; then
    pass "Final package generation authorization remains 0%."
  else
    fail "Final package generation authorization is not 0%. Current value: ${FINAL_AUTH_PERCENT:-MISSING}"
  fi
fi

section "6. Package generation and production actions remain blocked"

if [ -f "$STATUS_FILE" ]; then
  for KEY in \
    PACKAGE_GENERATION_ALLOWED \
    PACKAGE_ARCHIVE_CREATION_ALLOWED \
    CHECKSUM_GENERATION_ALLOWED \
    PRODUCTION_DEPLOYMENT_ALLOWED \
    PRODUCTION_MIGRATION_ALLOWED \
    PRODUCTION_DEPENDENCY_INSTALLATION_ALLOWED
  do
    VALUE="$(read_status_value "$STATUS_FILE" "$KEY")"

    if [ "$VALUE" = "NO" ]; then
      pass "$KEY remains NO."
    else
      fail "$KEY is not NO. Current value: ${VALUE:-MISSING}"
    fi
  done
fi

section "7. Overall system completion is tracked separately"

if [ -f "$STATUS_FILE" ]; then
  OVERALL="$(read_status_value "$STATUS_FILE" "OVERALL_SYSTEM_COMPLETION_PERCENT")"
  PACKAGE_READY="$(read_status_value "$STATUS_FILE" "CONTROLLED_PACKAGE_GENERATION_READINESS_PERCENT")"

  if [ "$OVERALL" = "90" ]; then
    pass "Overall system completion is recorded as 90%."
  else
    fail "Overall system completion is not 90%. Current value: ${OVERALL:-MISSING}"
  fi

  if [ "$PACKAGE_READY" = "96" ]; then
    pass "Controlled package-generation readiness is recorded separately as 96%."
  else
    fail "Controlled package-generation readiness is not 96%. Current value: ${PACKAGE_READY:-MISSING}"
  fi
fi

section "8. Baseline document confirms development boundary"

if [ -f "$DOC_FILE" ]; then
  if grep -q "Normal product development is allowed to continue" "$DOC_FILE" \
    && grep -q "Controlled package generation remains locked" "$DOC_FILE" \
    && grep -q "No production action is approved by this phase" "$DOC_FILE"; then
    pass "Baseline document confirms normal development while preserving package lock."
  else
    fail "Baseline document missing required development/package-lock statements."
  fi
fi

section "9. Environment authorization overrides are blocked"

ENV_VALUES="$(
  printf '%s\n' \
    "PHARMACO_OWNER_AUTHORIZATION_GRANTED=${PHARMACO_OWNER_AUTHORIZATION_GRANTED:-NO}" \
    "PHARMACO_PACKAGE_GENERATION_ALLOWED=${PHARMACO_PACKAGE_GENERATION_ALLOWED:-NO}" \
    "PHARMACO_PACKAGE_ARCHIVE_CREATION_ALLOWED=${PHARMACO_PACKAGE_ARCHIVE_CREATION_ALLOWED:-NO}" \
    "PHARMACO_CHECKSUM_GENERATION_ALLOWED=${PHARMACO_CHECKSUM_GENERATION_ALLOWED:-NO}" \
    "PHARMACO_PRODUCTION_DEPLOYMENT_ALLOWED=${PHARMACO_PRODUCTION_DEPLOYMENT_ALLOWED:-NO}" \
    "PHARMACO_PRODUCTION_MIGRATION_ALLOWED=${PHARMACO_PRODUCTION_MIGRATION_ALLOWED:-NO}" \
    "PHARMACO_PRODUCTION_DEPENDENCY_INSTALLATION_ALLOWED=${PHARMACO_PRODUCTION_DEPENDENCY_INSTALLATION_ALLOWED:-NO}"
)"

echo "$ENV_VALUES"

if echo "$ENV_VALUES" | grep -Eiq '=(GRANTED|AUTHORIZED|YES|TRUE|ALLOW|ALLOWED|GO|APPROVED|CAPTURED)$'; then
  fail "Environment-based authorization override detected."
else
  pass "No environment-based authorization override detected."
fi

section "10. No premature package archive/checksum artifacts are tracked"

PREMATURE_PACKAGE_ARTIFACTS="$(tracked_files | grep -Ei '(^|/)(release|releases|package|packages|deployment-package|deployment-packages|artifacts|build-artifacts)/.*\.(zip|tar|tar\.gz|tgz|sha256|sha512|checksum|checksums|manifest)$' || true)"

if [ -n "$PREMATURE_PACKAGE_ARTIFACTS" ]; then
  echo "$PREMATURE_PACKAGE_ARTIFACTS"
  fail "Premature package archive/checksum artifacts are tracked."
else
  pass "No premature package archive/checksum artifacts are tracked."
fi

section "11. Protected tracked files remain blocked"

REAL_ENV_FILES="$(tracked_files | grep -E '(^|/)\.env($|\.)' | grep -v -E '(^|/)\.env\.example$' || true)"
PRIVATE_KEYS="$(tracked_files | grep -Ei '(^|/)(id_rsa|id_dsa|id_ed25519|.*\.(pem|key|p12|pfx))$' || true)"
CREDENTIAL_FILES="$(tracked_files | grep -Ei '(^|/)(credentials|credential|service-account|service_account|client_secret|google-services|firebase.*service.*account).*\.(json|yml|yaml|ini)$' || true)"
SECRET_FILES="$(tracked_files | grep -Ei '(^|/)(secrets?|.*secret.*)\.(json|yml|yaml|env|txt)$' || true)"
SQLITE_FILES="$(tracked_files | grep -Ei '(^|/)(database\.sqlite|.*\.sqlite|.*\.sqlite3|.*\.db)$' || true)"

PROTECTED_FILES="$(
  printf '%s\n%s\n%s\n%s\n%s\n' \
    "$REAL_ENV_FILES" \
    "$PRIVATE_KEYS" \
    "$CREDENTIAL_FILES" \
    "$SECRET_FILES" \
    "$SQLITE_FILES" | sed '/^$/d' | sort -u
)"

if [ -n "$PROTECTED_FILES" ]; then
  echo "$PROTECTED_FILES"
  fail "Protected tracked files detected."
else
  pass "No protected tracked files detected."
fi

section "Completion Summary"

echo "Overall system completion: approximately 90%"
echo "Phase 20.0 normal development continuation baseline check: $([ "$FAILURES" -eq 0 ] && echo "100%" || echo "blocked")"
echo "Controlled package-generation readiness: approximately 96%"
echo "Final package generation authorization: 0% — still locked"
echo "Normal development: allowed"

section "Final Result"

if [ "$FAILURES" -eq 0 ]; then
  echo "PHASE 20.0 NORMAL DEVELOPMENT CONTINUATION BASELINE CHECK PASSED"
  exit 0
fi

echo "PHASE 20.0 NORMAL DEVELOPMENT CONTINUATION BASELINE CHECK FAILED with $FAILURES failure(s)."
exit 1

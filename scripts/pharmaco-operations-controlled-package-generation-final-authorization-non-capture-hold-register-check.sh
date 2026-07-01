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

section "Phase 19.4 Final Authorization Non-Capture Hold Register Check"

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

section "3. Previous evidence chain exists and passed"

PHASE_18_6="docs/pharmaco/controlled-package-generation/dry-run-evidence/PHASE_18_6_DRY_RUN_EVIDENCE_OUTPUT.txt"
PHASE_18_7="docs/pharmaco/controlled-package-generation/owner-authorization-gate/PHASE_18_7_OWNER_AUTHORIZATION_GATE_EVIDENCE_OUTPUT.txt"
PHASE_18_8="docs/pharmaco/controlled-package-generation/final-owner-authorization-evidence-packet/PHASE_18_8_FINAL_OWNER_AUTHORIZATION_EVIDENCE_OUTPUT.txt"
PHASE_18_9="docs/pharmaco/controlled-package-generation/final-authorization-decision-hold/PHASE_18_9_FINAL_AUTHORIZATION_DECISION_HOLD_EVIDENCE_OUTPUT.txt"
PHASE_19_0="docs/pharmaco/controlled-package-generation/owner-authorization-request-ledger/PHASE_19_0_OWNER_AUTHORIZATION_REQUEST_LEDGER_EVIDENCE_OUTPUT.txt"
PHASE_19_1="docs/pharmaco/controlled-package-generation/owner-authorization-response-capture-hold/PHASE_19_1_OWNER_AUTHORIZATION_RESPONSE_CAPTURE_HOLD_EVIDENCE_OUTPUT.txt"
PHASE_19_2="docs/pharmaco/controlled-package-generation/owner-authorization-approval-criteria-template/PHASE_19_2_OWNER_AUTHORIZATION_APPROVAL_CRITERIA_TEMPLATE_EVIDENCE_OUTPUT.txt"
PHASE_19_3="docs/pharmaco/controlled-package-generation/explicit-owner-authorization-capture-gate/PHASE_19_3_EXPLICIT_OWNER_AUTHORIZATION_CAPTURE_GATE_EVIDENCE_OUTPUT.txt"

if [ -f "$PHASE_18_6" ] && grep -q "PHASE 18.6 DRY-RUN EVIDENCE CHECK PASSED" "$PHASE_18_6"; then pass "Phase 18.6 evidence exists and passed."; else fail "Phase 18.6 evidence missing or failed."; fi
if [ -f "$PHASE_18_7" ] && grep -q "PHASE 18.7 OWNER AUTHORIZATION GATE CHECK PASSED" "$PHASE_18_7"; then pass "Phase 18.7 evidence exists and passed."; else fail "Phase 18.7 evidence missing or failed."; fi
if [ -f "$PHASE_18_8" ] && grep -q "PHASE 18.8 FINAL OWNER AUTHORIZATION EVIDENCE PACKET CHECK PASSED" "$PHASE_18_8"; then pass "Phase 18.8 evidence exists and passed."; else fail "Phase 18.8 evidence missing or failed."; fi
if [ -f "$PHASE_18_9" ] && grep -q "PHASE 18.9 FINAL AUTHORIZATION DECISION HOLD CHECK PASSED" "$PHASE_18_9"; then pass "Phase 18.9 evidence exists and passed."; else fail "Phase 18.9 evidence missing or failed."; fi
if [ -f "$PHASE_19_0" ] && grep -q "PHASE 19.0 OWNER AUTHORIZATION REQUEST LEDGER CHECK PASSED" "$PHASE_19_0"; then pass "Phase 19.0 evidence exists and passed."; else fail "Phase 19.0 evidence missing or failed."; fi
if [ -f "$PHASE_19_1" ] && grep -q "PHASE 19.1 OWNER AUTHORIZATION RESPONSE CAPTURE HOLD CHECK PASSED" "$PHASE_19_1"; then pass "Phase 19.1 evidence exists and passed."; else fail "Phase 19.1 evidence missing or failed."; fi
if [ -f "$PHASE_19_2" ] && grep -q "PHASE 19.2 OWNER AUTHORIZATION APPROVAL CRITERIA TEMPLATE CHECK PASSED" "$PHASE_19_2"; then pass "Phase 19.2 evidence exists and passed."; else fail "Phase 19.2 evidence missing or failed."; fi
if [ -f "$PHASE_19_3" ] && grep -q "PHASE 19.3 EXPLICIT OWNER AUTHORIZATION CAPTURE GATE CHECK PASSED" "$PHASE_19_3"; then pass "Phase 19.3 evidence exists and passed."; else fail "Phase 19.3 evidence missing or failed."; fi

section "4. Phase 19.4 hold register files exist"

DOC_FILE="docs/pharmaco/controlled-package-generation/final-authorization-non-capture-hold-register/PHASE_19_4_FINAL_AUTHORIZATION_NON_CAPTURE_HOLD_REGISTER.md"
STATUS_FILE="docs/pharmaco/controlled-package-generation/final-authorization-non-capture-hold-register/PHASE_19_4_FINAL_AUTHORIZATION_NON_CAPTURE_HOLD_REGISTER_STATUS.env"

if [ -f "$DOC_FILE" ]; then
  pass "Phase 19.4 hold register document exists."
else
  fail "Missing Phase 19.4 hold register document."
fi

if [ -f "$STATUS_FILE" ]; then
  pass "Phase 19.4 hold register status file exists."
else
  fail "Missing Phase 19.4 hold register status file."
fi

section "5. Final authorization remains not captured"

if [ -f "$STATUS_FILE" ]; then
  HOLD_STATUS="$(read_status_value "$STATUS_FILE" "FINAL_AUTHORIZATION_HOLD_STATUS")"
  OWNER_GRANTED="$(read_status_value "$STATUS_FILE" "OWNER_AUTHORIZATION_GRANTED")"
  OWNER_CAPTURED="$(read_status_value "$STATUS_FILE" "OWNER_APPROVAL_CAPTURED")"
  FINAL_AUTH_PERCENT="$(read_status_value "$STATUS_FILE" "FINAL_PACKAGE_GENERATION_AUTHORIZATION_PERCENT")"

  if [ "$HOLD_STATUS" = "NO_VALID_FINAL_AUTHORIZATION_CAPTURED" ]; then
    pass "Final authorization hold status is NO_VALID_FINAL_AUTHORIZATION_CAPTURED."
  else
    fail "Final authorization hold status is not safe. Current value: ${HOLD_STATUS:-MISSING}"
  fi

  if [ "$OWNER_GRANTED" = "NO" ]; then
    pass "Owner authorization remains not granted."
  else
    fail "Owner authorization is not NO. Current value: ${OWNER_GRANTED:-MISSING}"
  fi

  if [ "$OWNER_CAPTURED" = "NO" ]; then
    pass "Owner approval remains uncaptured."
  else
    fail "Owner approval captured value is not NO. Current value: ${OWNER_CAPTURED:-MISSING}"
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

  if [ "$OVERALL" = "89" ]; then
    pass "Overall system completion is recorded as 89%."
  else
    fail "Overall system completion is not 89%. Current value: ${OVERALL:-MISSING}"
  fi

  if [ "$PACKAGE_READY" = "96" ]; then
    pass "Controlled package-generation readiness is recorded separately as 96%."
  else
    fail "Controlled package-generation readiness is not 96%. Current value: ${PACKAGE_READY:-MISSING}"
  fi
fi

section "8. Hold register documents non-actionable authorization state"

if [ -f "$DOC_FILE" ]; then
  if grep -q "No valid final package-generation authorization has been captured" "$DOC_FILE" \
    && grep -q "not captured, not granted, and not actionable" "$DOC_FILE" \
    && grep -q "No production action is approved by this phase" "$DOC_FILE"; then
    pass "Hold register documents the locked non-actionable authorization state."
  else
    fail "Hold register missing required locked authorization statements."
  fi
fi

section "9. Environment authorization overrides are blocked"

ENV_VALUES="$(
  printf '%s\n' \
    "PHARMACO_OWNER_AUTHORIZATION_GRANTED=${PHARMACO_OWNER_AUTHORIZATION_GRANTED:-NO}" \
    "PHARMACO_OWNER_APPROVAL_CAPTURED=${PHARMACO_OWNER_APPROVAL_CAPTURED:-NO}" \
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

echo "Overall system completion: approximately 89%"
echo "Phase 19.4 final authorization non-capture hold register check: $([ "$FAILURES" -eq 0 ] && echo "100%" || echo "blocked")"
echo "Controlled package-generation readiness: approximately 96%"
echo "Final package generation authorization: 0% — still locked"

section "Final Result"

if [ "$FAILURES" -eq 0 ]; then
  echo "PHASE 19.4 FINAL AUTHORIZATION NON-CAPTURE HOLD REGISTER CHECK PASSED"
  exit 0
fi

echo "PHASE 19.4 FINAL AUTHORIZATION NON-CAPTURE HOLD REGISTER CHECK FAILED with $FAILURES failure(s)."
exit 1

#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

FAILURES=0

pass() {
  echo "PASS: $1"
}

fail() {
  echo "FAIL: $1"
  FAILURES=$((FAILURES + 1))
}

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

section "Phase 18.9 Controlled Package Generation Final Authorization Decision Hold Check"

BRANCH="$(git branch --show-current 2>/dev/null || true)"
echo "Current branch: ${BRANCH:-UNKNOWN}"

section "1. Source branch is not a production branch"

case "$BRANCH" in
  main|master|production|prod|release|release/*|hotfix/production|hotfix/production/*)
    fail "Current branch '$BRANCH' is protected and cannot be used for final authorization decision hold work."
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

section "3. Phase 18.6 dry-run evidence exists and passed"

PHASE_18_6_EVIDENCE="docs/pharmaco/controlled-package-generation/dry-run-evidence/PHASE_18_6_DRY_RUN_EVIDENCE_OUTPUT.txt"

if [ -f "$PHASE_18_6_EVIDENCE" ] && grep -q "PHASE 18.6 DRY-RUN EVIDENCE CHECK PASSED" "$PHASE_18_6_EVIDENCE"; then
  pass "Phase 18.6 dry-run evidence exists and contains pass marker."
else
  fail "Phase 18.6 dry-run evidence is missing or does not contain pass marker."
fi

section "4. Phase 18.7 owner authorization gate evidence exists and passed"

PHASE_18_7_EVIDENCE="docs/pharmaco/controlled-package-generation/owner-authorization-gate/PHASE_18_7_OWNER_AUTHORIZATION_GATE_EVIDENCE_OUTPUT.txt"
PHASE_18_7_STATUS="docs/pharmaco/controlled-package-generation/owner-authorization-gate/PHASE_18_7_OWNER_AUTHORIZATION_GATE_STATUS.env"

if [ -f "$PHASE_18_7_EVIDENCE" ] && grep -q "PHASE 18.7 OWNER AUTHORIZATION GATE CHECK PASSED" "$PHASE_18_7_EVIDENCE"; then
  pass "Phase 18.7 owner authorization gate evidence exists and contains pass marker."
else
  fail "Phase 18.7 owner authorization gate evidence is missing or does not contain pass marker."
fi

section "5. Phase 18.8 final owner authorization evidence packet exists and passed"

PHASE_18_8_EVIDENCE="docs/pharmaco/controlled-package-generation/final-owner-authorization-evidence-packet/PHASE_18_8_FINAL_OWNER_AUTHORIZATION_EVIDENCE_OUTPUT.txt"
PHASE_18_8_STATUS="docs/pharmaco/controlled-package-generation/final-owner-authorization-evidence-packet/PHASE_18_8_FINAL_OWNER_AUTHORIZATION_STATUS.env"

if [ -f "$PHASE_18_8_EVIDENCE" ] && grep -q "PHASE 18.8 FINAL OWNER AUTHORIZATION EVIDENCE PACKET CHECK PASSED" "$PHASE_18_8_EVIDENCE"; then
  pass "Phase 18.8 final owner authorization evidence packet exists and contains pass marker."
else
  fail "Phase 18.8 final owner authorization evidence packet is missing or does not contain pass marker."
fi

section "6. Phase 18.7 owner authorization remains LOCKED"

if [ -f "$PHASE_18_7_STATUS" ]; then
  OWNER_STATUS="$(read_status_value "$PHASE_18_7_STATUS" "OWNER_AUTHORIZATION_STATUS")"
  PACKAGE_AUTH="$(read_status_value "$PHASE_18_7_STATUS" "PACKAGE_GENERATION_AUTHORIZED")"

  if [ "$OWNER_STATUS" = "LOCKED" ]; then
    pass "Phase 18.7 owner authorization remains LOCKED."
  else
    fail "Phase 18.7 owner authorization is not LOCKED. Current value: ${OWNER_STATUS:-MISSING}"
  fi

  if [ "$PACKAGE_AUTH" = "NO" ]; then
    pass "Phase 18.7 package generation remains unauthorized."
  else
    fail "Phase 18.7 package generation authorization is not NO. Current value: ${PACKAGE_AUTH:-MISSING}"
  fi
else
  fail "Missing Phase 18.7 status file."
fi

section "7. Phase 18.8 final owner authorization remains NOT_GRANTED"

if [ -f "$PHASE_18_8_STATUS" ]; then
  FINAL_OWNER_STATUS="$(read_status_value "$PHASE_18_8_STATUS" "FINAL_OWNER_AUTHORIZATION_STATUS")"
  FINAL_PACKAGE_AUTH="$(read_status_value "$PHASE_18_8_STATUS" "FINAL_PACKAGE_GENERATION_AUTHORIZED")"

  if [ "$FINAL_OWNER_STATUS" = "NOT_GRANTED" ]; then
    pass "Phase 18.8 final owner authorization remains NOT_GRANTED."
  else
    fail "Phase 18.8 final owner authorization is not NOT_GRANTED. Current value: ${FINAL_OWNER_STATUS:-MISSING}"
  fi

  if [ "$FINAL_PACKAGE_AUTH" = "NO" ]; then
    pass "Phase 18.8 final package generation remains unauthorized."
  else
    fail "Phase 18.8 final package generation authorization is not NO. Current value: ${FINAL_PACKAGE_AUTH:-MISSING}"
  fi
else
  fail "Missing Phase 18.8 status file."
fi

section "8. Phase 18.9 final authorization decision remains HOLD"

PHASE_18_9_STATUS="docs/pharmaco/controlled-package-generation/final-authorization-decision-hold/PHASE_18_9_FINAL_AUTHORIZATION_DECISION_HOLD_STATUS.env"

if [ -f "$PHASE_18_9_STATUS" ]; then
  DECISION="$(read_status_value "$PHASE_18_9_STATUS" "FINAL_AUTHORIZATION_DECISION")"
  OWNER_GRANTED="$(read_status_value "$PHASE_18_9_STATUS" "OWNER_AUTHORIZATION_GRANTED")"

  if [ "$DECISION" = "HOLD" ]; then
    pass "Final authorization decision remains HOLD."
  else
    fail "Final authorization decision is not HOLD. Current value: ${DECISION:-MISSING}"
  fi

  if [ "$OWNER_GRANTED" = "NO" ]; then
    pass "Owner authorization remains not granted."
  else
    fail "Owner authorization is not NO. Current value: ${OWNER_GRANTED:-MISSING}"
  fi
else
  fail "Missing Phase 18.9 status file: $PHASE_18_9_STATUS"
fi

section "9. Package generation and production actions remain blocked"

if [ -f "$PHASE_18_9_STATUS" ]; then
  for KEY in \
    PACKAGE_GENERATION_ALLOWED \
    PACKAGE_ARCHIVE_CREATION_ALLOWED \
    CHECKSUM_GENERATION_ALLOWED \
    PRODUCTION_DEPLOYMENT_ALLOWED \
    PRODUCTION_MIGRATION_ALLOWED \
    PRODUCTION_DEPENDENCY_INSTALLATION_ALLOWED
  do
    VALUE="$(read_status_value "$PHASE_18_9_STATUS" "$KEY")"

    if [ "$VALUE" = "NO" ]; then
      pass "$KEY remains NO."
    else
      fail "$KEY is not NO. Current value: ${VALUE:-MISSING}"
    fi
  done
fi

section "10. Overall system completion percentage is recorded correctly"

if [ -f "$PHASE_18_9_STATUS" ]; then
  OVERALL_SYSTEM_COMPLETION="$(read_status_value "$PHASE_18_9_STATUS" "OVERALL_SYSTEM_COMPLETION_PERCENT")"
  PACKAGE_READINESS="$(read_status_value "$PHASE_18_9_STATUS" "CONTROLLED_PACKAGE_GENERATION_READINESS_PERCENT")"

  if [ "$OVERALL_SYSTEM_COMPLETION" = "86.5" ]; then
    pass "Overall system completion is recorded as 86.5%."
  else
    fail "Overall system completion is not recorded as 86.5%. Current value: ${OVERALL_SYSTEM_COMPLETION:-MISSING}"
  fi

  if [ "$PACKAGE_READINESS" = "96" ]; then
    pass "Controlled package-generation readiness is recorded separately as 96%."
  else
    fail "Controlled package-generation readiness is not recorded as 96%. Current value: ${PACKAGE_READINESS:-MISSING}"
  fi
fi

section "11. Environment-based authorization overrides are blocked"

ENV_VALUES="$(
  printf '%s\n' \
    "PHARMACO_FINAL_AUTHORIZATION_DECISION=${PHARMACO_FINAL_AUTHORIZATION_DECISION:-HOLD}" \
    "PHARMACO_OWNER_AUTHORIZATION_GRANTED=${PHARMACO_OWNER_AUTHORIZATION_GRANTED:-NO}" \
    "PHARMACO_PACKAGE_GENERATION_ALLOWED=${PHARMACO_PACKAGE_GENERATION_ALLOWED:-NO}" \
    "PHARMACO_PRODUCTION_DEPLOYMENT_ALLOWED=${PHARMACO_PRODUCTION_DEPLOYMENT_ALLOWED:-NO}" \
    "PHARMACO_PRODUCTION_MIGRATION_ALLOWED=${PHARMACO_PRODUCTION_MIGRATION_ALLOWED:-NO}" \
    "PHARMACO_PRODUCTION_DEPENDENCY_INSTALLATION_ALLOWED=${PHARMACO_PRODUCTION_DEPENDENCY_INSTALLATION_ALLOWED:-NO}"
)"

echo "$ENV_VALUES"

if echo "$ENV_VALUES" | grep -Eiq '=(GRANTED|AUTHORIZED|YES|TRUE|ALLOW|ALLOWED|GO)$'; then
  fail "Environment-based authorization override detected."
else
  pass "No environment-based authorization override detected."
fi

section "12. No premature package archive/checksum artifacts are tracked"

PREMATURE_PACKAGE_ARTIFACTS="$(tracked_files | grep -Ei '(^|/)(release|releases|package|packages|deployment-package|deployment-packages|artifacts|build-artifacts)/.*\.(zip|tar|tar\.gz|tgz|sha256|sha512|checksum|checksums|manifest)$' || true)"

if [ -n "$PREMATURE_PACKAGE_ARTIFACTS" ]; then
  echo "$PREMATURE_PACKAGE_ARTIFACTS"
  fail "Premature package archive/checksum artifacts are tracked."
else
  pass "No premature package archive/checksum artifacts are tracked."
fi

section "13. Protected tracked files remain blocked"

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

echo "Overall system completion: approximately 86.5%"
echo "Phase 18.9 decision-hold check: $([ "$FAILURES" -eq 0 ] && echo "100%" || echo "blocked")"
echo "Controlled package-generation readiness: approximately 96%"
echo "Final package generation authorization: 0% — still locked"

section "Final Result"

if [ "$FAILURES" -eq 0 ]; then
  echo "PHASE 18.9 FINAL AUTHORIZATION DECISION HOLD CHECK PASSED"
  exit 0
fi

echo "PHASE 18.9 FINAL AUTHORIZATION DECISION HOLD CHECK FAILED with $FAILURES failure(s)."
exit 1

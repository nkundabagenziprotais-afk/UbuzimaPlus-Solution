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

section "Phase 18.8 Controlled Package Generation Final Owner Authorization Evidence Packet Check"

BRANCH="$(git branch --show-current 2>/dev/null || true)"
echo "Current branch: ${BRANCH:-UNKNOWN}"

section "1. Source branch is not a production branch"

case "$BRANCH" in
  main|master|production|prod|release|release/*|hotfix/production|hotfix/production/*)
    fail "Current branch '$BRANCH' is protected and cannot be used for final owner authorization evidence packet work."
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

section "3. Phase 18.6 dry-run evidence exists"

PHASE_18_6_EVIDENCE="docs/pharmaco/controlled-package-generation/dry-run-evidence/PHASE_18_6_DRY_RUN_EVIDENCE_OUTPUT.txt"
PHASE_18_6_SCRIPT="./scripts/pharmaco-operations-controlled-package-generation-dry-run-evidence-check.sh"

if [ -f "$PHASE_18_6_EVIDENCE" ]; then
  pass "Phase 18.6 dry-run evidence exists."
else
  fail "Missing Phase 18.6 dry-run evidence: $PHASE_18_6_EVIDENCE"
fi

section "4. Phase 18.6 dry-run evidence passed"

if [ -f "$PHASE_18_6_EVIDENCE" ]; then
  if grep -q "PHASE 18.6 DRY-RUN EVIDENCE CHECK PASSED" "$PHASE_18_6_EVIDENCE"; then
    pass "Phase 18.6 committed evidence contains pass marker."
  else
    fail "Phase 18.6 committed evidence does not contain pass marker."
  fi

  if [ -x "$PHASE_18_6_SCRIPT" ]; then
    if bash "$PHASE_18_6_SCRIPT"; then
      pass "Phase 18.6 guardrail re-run passed."
    else
      fail "Phase 18.6 guardrail re-run failed."
    fi
  else
    fail "Phase 18.6 guardrail script missing or not executable."
  fi
fi

section "5. Phase 18.7 owner authorization gate evidence exists"

PHASE_18_7_EVIDENCE="docs/pharmaco/controlled-package-generation/owner-authorization-gate/PHASE_18_7_OWNER_AUTHORIZATION_GATE_EVIDENCE_OUTPUT.txt"
PHASE_18_7_SCRIPT="./scripts/pharmaco-operations-controlled-package-generation-owner-authorization-gate-check.sh"
PHASE_18_7_STATUS="docs/pharmaco/controlled-package-generation/owner-authorization-gate/PHASE_18_7_OWNER_AUTHORIZATION_GATE_STATUS.env"

if [ -f "$PHASE_18_7_EVIDENCE" ]; then
  pass "Phase 18.7 owner authorization gate evidence exists."
else
  fail "Missing Phase 18.7 owner authorization gate evidence: $PHASE_18_7_EVIDENCE"
fi

section "6. Phase 18.7 owner authorization gate passed"

if [ -f "$PHASE_18_7_EVIDENCE" ]; then
  if grep -q "PHASE 18.7 OWNER AUTHORIZATION GATE CHECK PASSED" "$PHASE_18_7_EVIDENCE"; then
    pass "Phase 18.7 committed evidence contains pass marker."
  else
    fail "Phase 18.7 committed evidence does not contain pass marker."
  fi

  if [ -x "$PHASE_18_7_SCRIPT" ]; then
    if bash "$PHASE_18_7_SCRIPT"; then
      pass "Phase 18.7 guardrail re-run passed."
    else
      fail "Phase 18.7 guardrail re-run failed."
    fi
  else
    fail "Phase 18.7 guardrail script missing or not executable."
  fi
fi

section "7. Phase 18.7 owner authorization status remains LOCKED"

if [ -f "$PHASE_18_7_STATUS" ]; then
  OWNER_STATUS="$(read_status_value "$PHASE_18_7_STATUS" "OWNER_AUTHORIZATION_STATUS")"
  PACKAGE_AUTH="$(read_status_value "$PHASE_18_7_STATUS" "PACKAGE_GENERATION_AUTHORIZED")"

  if [ "$OWNER_STATUS" = "LOCKED" ]; then
    pass "Phase 18.7 owner authorization status remains LOCKED."
  else
    fail "Phase 18.7 owner authorization status is not LOCKED. Current value: ${OWNER_STATUS:-MISSING}"
  fi

  if [ "$PACKAGE_AUTH" = "NO" ]; then
    pass "Phase 18.7 package generation remains unauthorized."
  else
    fail "Phase 18.7 package generation authorization is not NO. Current value: ${PACKAGE_AUTH:-MISSING}"
  fi
else
  fail "Missing Phase 18.7 owner authorization status file: $PHASE_18_7_STATUS"
fi

section "8. Final owner authorization status remains NOT_GRANTED"

PHASE_18_8_STATUS="docs/pharmaco/controlled-package-generation/final-owner-authorization-evidence-packet/PHASE_18_8_FINAL_OWNER_AUTHORIZATION_STATUS.env"

if [ -f "$PHASE_18_8_STATUS" ]; then
  FINAL_OWNER_STATUS="$(read_status_value "$PHASE_18_8_STATUS" "FINAL_OWNER_AUTHORIZATION_STATUS")"

  if [ "$FINAL_OWNER_STATUS" = "NOT_GRANTED" ]; then
    pass "Final owner authorization status remains NOT_GRANTED."
  else
    fail "Final owner authorization status is not NOT_GRANTED. Current value: ${FINAL_OWNER_STATUS:-MISSING}"
  fi
else
  fail "Missing Phase 18.8 final owner authorization status file: $PHASE_18_8_STATUS"
fi

section "9. Final package generation remains unauthorized"

if [ -f "$PHASE_18_8_STATUS" ]; then
  FINAL_PACKAGE_AUTH="$(read_status_value "$PHASE_18_8_STATUS" "FINAL_PACKAGE_GENERATION_AUTHORIZED")"

  if [ "$FINAL_PACKAGE_AUTH" = "NO" ]; then
    pass "Final package generation remains unauthorized."
  else
    fail "Final package generation authorization is not NO. Current value: ${FINAL_PACKAGE_AUTH:-MISSING}"
  fi
fi

section "10. Final package archive creation remains unauthorized"

if [ -f "$PHASE_18_8_STATUS" ]; then
  FINAL_ARCHIVE_AUTH="$(read_status_value "$PHASE_18_8_STATUS" "FINAL_PACKAGE_ARCHIVE_AUTHORIZED")"

  if [ "$FINAL_ARCHIVE_AUTH" = "NO" ]; then
    pass "Final package archive creation remains unauthorized."
  else
    fail "Final package archive authorization is not NO. Current value: ${FINAL_ARCHIVE_AUTH:-MISSING}"
  fi
fi

section "11. Final checksum generation remains unauthorized"

if [ -f "$PHASE_18_8_STATUS" ]; then
  FINAL_CHECKSUM_AUTH="$(read_status_value "$PHASE_18_8_STATUS" "FINAL_CHECKSUM_GENERATION_AUTHORIZED")"

  if [ "$FINAL_CHECKSUM_AUTH" = "NO" ]; then
    pass "Final checksum generation remains unauthorized."
  else
    fail "Final checksum generation authorization is not NO. Current value: ${FINAL_CHECKSUM_AUTH:-MISSING}"
  fi
fi

section "12. Production deployment remains unauthorized"

if [ -f "$PHASE_18_8_STATUS" ]; then
  DEPLOY_AUTH="$(read_status_value "$PHASE_18_8_STATUS" "PRODUCTION_DEPLOYMENT_AUTHORIZED")"

  if [ "$DEPLOY_AUTH" = "NO" ]; then
    pass "Production deployment remains unauthorized."
  else
    fail "Production deployment authorization is not NO. Current value: ${DEPLOY_AUTH:-MISSING}"
  fi
fi

section "13. Production migration remains unauthorized"

if [ -f "$PHASE_18_8_STATUS" ]; then
  MIGRATION_AUTH="$(read_status_value "$PHASE_18_8_STATUS" "PRODUCTION_MIGRATION_AUTHORIZED")"

  if [ "$MIGRATION_AUTH" = "NO" ]; then
    pass "Production migration remains unauthorized."
  else
    fail "Production migration authorization is not NO. Current value: ${MIGRATION_AUTH:-MISSING}"
  fi
fi

section "14. Production dependency installation remains unauthorized"

if [ -f "$PHASE_18_8_STATUS" ]; then
  DEPENDENCY_AUTH="$(read_status_value "$PHASE_18_8_STATUS" "PRODUCTION_DEPENDENCY_INSTALLATION_AUTHORIZED")"

  if [ "$DEPENDENCY_AUTH" = "NO" ]; then
    pass "Production dependency installation remains unauthorized."
  else
    fail "Production dependency installation authorization is not NO. Current value: ${DEPENDENCY_AUTH:-MISSING}"
  fi
fi

section "15. Owner approval evidence remains uncaptured"

if [ -f "$PHASE_18_8_STATUS" ]; then
  OWNER_EVIDENCE="$(read_status_value "$PHASE_18_8_STATUS" "OWNER_APPROVAL_EVIDENCE_CAPTURED")"

  if [ "$OWNER_EVIDENCE" = "NO" ]; then
    pass "Owner approval evidence remains uncaptured."
  else
    fail "Owner approval evidence is not NO. Current value: ${OWNER_EVIDENCE:-MISSING}"
  fi
fi

section "16. Environment-based authorization overrides are blocked"

ENV_VALUES="$(
  printf '%s\n' \
    "PHARMACO_FINAL_OWNER_AUTHORIZATION=${PHARMACO_FINAL_OWNER_AUTHORIZATION:-NOT_GRANTED}" \
    "PHARMACO_FINAL_PACKAGE_GENERATION_AUTHORIZED=${PHARMACO_FINAL_PACKAGE_GENERATION_AUTHORIZED:-NO}" \
    "PHARMACO_FINAL_PACKAGE_ARCHIVE_AUTHORIZED=${PHARMACO_FINAL_PACKAGE_ARCHIVE_AUTHORIZED:-NO}" \
    "PHARMACO_FINAL_CHECKSUM_GENERATION_AUTHORIZED=${PHARMACO_FINAL_CHECKSUM_GENERATION_AUTHORIZED:-NO}" \
    "PHARMACO_PRODUCTION_DEPLOYMENT_AUTHORIZED=${PHARMACO_PRODUCTION_DEPLOYMENT_AUTHORIZED:-NO}" \
    "PHARMACO_PRODUCTION_MIGRATION_AUTHORIZED=${PHARMACO_PRODUCTION_MIGRATION_AUTHORIZED:-NO}" \
    "PHARMACO_PRODUCTION_DEPENDENCY_INSTALLATION_AUTHORIZED=${PHARMACO_PRODUCTION_DEPENDENCY_INSTALLATION_AUTHORIZED:-NO}"
)"

echo "$ENV_VALUES"

if echo "$ENV_VALUES" | grep -Eiq '=(GRANTED|AUTHORIZED|YES|TRUE)$'; then
  fail "Environment-based authorization override detected."
else
  pass "No environment-based authorization override detected."
fi

section "17. No premature package archive/checksum artifacts are tracked"

PREMATURE_PACKAGE_ARTIFACTS="$(tracked_files | grep -Ei '(^|/)(release|releases|package|packages|deployment-package|deployment-packages|artifacts|build-artifacts)/.*\.(zip|tar|tar\.gz|tgz|sha256|sha512|checksum|checksums|manifest)$' || true)"

if [ -n "$PREMATURE_PACKAGE_ARTIFACTS" ]; then
  echo "$PREMATURE_PACKAGE_ARTIFACTS"
  fail "Premature package archive/checksum artifacts are tracked."
else
  pass "No premature package archive/checksum artifacts are tracked."
fi

section "18. Protected tracked files remain blocked"

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

echo "Phase 18.8 evidence packet script execution: $([ "$FAILURES" -eq 0 ] && echo "100%" || echo "blocked")"
echo "Overall controlled package-generation readiness after successful Phase 18.8 evidence: approximately 96%"
echo "Final package generation authorization: 0% — still locked"

section "Final Result"

if [ "$FAILURES" -eq 0 ]; then
  echo "PHASE 18.8 FINAL OWNER AUTHORIZATION EVIDENCE PACKET CHECK PASSED"
  exit 0
fi

echo "PHASE 18.8 FINAL OWNER AUTHORIZATION EVIDENCE PACKET CHECK FAILED with $FAILURES failure(s)."
exit 1

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

section "Phase 18.6 Controlled Package Generation Dry-Run Evidence Check"

BRANCH="$(git branch --show-current 2>/dev/null || true)"
echo "Current branch: ${BRANCH:-UNKNOWN}"

section "1. Source branch is not a production branch"

case "$BRANCH" in
  main|master|production|prod|release|release/*|hotfix/production|hotfix/production/*)
    fail "Current branch '$BRANCH' is protected and cannot be used for package generation dry-run evidence."
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

section "3. Protected tracked files are blocked"

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

section "4. Safe .env.example files are allowed"

SAFE_ENV_EXAMPLES="$(tracked_files | grep -E '(^|/)\.env\.example$' || true)"

if [ -n "$SAFE_ENV_EXAMPLES" ]; then
  echo "$SAFE_ENV_EXAMPLES"
  pass "Safe .env.example files are allowed."
else
  pass "No .env.example file found; no unsafe tracked .env file detected."
fi

section "5. Real .env files are blocked"

if [ -n "$REAL_ENV_FILES" ]; then
  echo "$REAL_ENV_FILES"
  fail "Real .env files are tracked."
else
  pass "No real .env files are tracked."
fi

section "6. Private keys are blocked"

if [ -n "$PRIVATE_KEYS" ]; then
  echo "$PRIVATE_KEYS"
  fail "Private key files are tracked."
else
  pass "No private key files are tracked."
fi

section "7. Credential files are blocked"

if [ -n "$CREDENTIAL_FILES" ]; then
  echo "$CREDENTIAL_FILES"
  fail "Credential files are tracked."
else
  pass "No credential files are tracked."
fi

section "8. Secret files are blocked"

if [ -n "$SECRET_FILES" ]; then
  echo "$SECRET_FILES"
  fail "Secret files are tracked."
else
  pass "No secret files are tracked."
fi

section "9. Production SQLite/database SQLite files are blocked"

if [ -n "$SQLITE_FILES" ]; then
  echo "$SQLITE_FILES"
  fail "SQLite/database files are tracked."
else
  pass "No SQLite/database files are tracked."
fi

section "10. Required Phase 18.5 guardrails pass"

PHASE_18_5_SCRIPT="./scripts/pharmaco-operations-controlled-package-generation-execution-package-contents-quarantine-ledger-check.sh"

if [ -f "$PHASE_18_5_SCRIPT" ]; then
  if bash "$PHASE_18_5_SCRIPT"; then
    pass "Phase 18.5 guardrail passed."
  else
    fail "Phase 18.5 guardrail failed."
  fi
else
  fail "Missing Phase 18.5 guardrail script: $PHASE_18_5_SCRIPT"
fi

section "11. Reporting UI guardrail passes"

REPORTING_UI_SCRIPT="./scripts/pharmaco-reporting-ui-check.sh"

if [ -f "$REPORTING_UI_SCRIPT" ]; then
  if bash "$REPORTING_UI_SCRIPT"; then
    pass "Reporting UI guardrail passed."
  else
    fail "Reporting UI guardrail failed."
  fi
else
  fail "Missing reporting UI guardrail script: $REPORTING_UI_SCRIPT"
fi

section "12. Phase 0 local check passes"

PHASE0_SCRIPT="./scripts/phase0-check.sh"

if [ -f "$PHASE0_SCRIPT" ]; then
  if bash "$PHASE0_SCRIPT"; then
    pass "Phase 0 local check passed."
  else
    fail "Phase 0 local check failed."
  fi
else
  fail "Missing Phase 0 local check script: $PHASE0_SCRIPT"
fi

section "13. Final owner authorization remains locked until explicitly granted"

OWNER_AUTH="${PHARMACO_CONTROLLED_PACKAGE_OWNER_AUTHORIZATION:-LOCKED}"

case "$OWNER_AUTH" in
  GRANTED|Granted|granted|AUTHORIZED|Authorized|authorized|YES|Yes|yes|TRUE|True|true)
    fail "Owner authorization is not locked. Current value: $OWNER_AUTH"
    ;;
  *)
    pass "Owner authorization remains locked. Current value: $OWNER_AUTH"
    ;;
esac

section "Final Result"

if [ "$FAILURES" -eq 0 ]; then
  echo "PHASE 18.6 DRY-RUN EVIDENCE CHECK PASSED"
  exit 0
fi

echo "PHASE 18.6 DRY-RUN EVIDENCE CHECK FAILED with $FAILURES failure(s)."
exit 1

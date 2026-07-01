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

section "Phase 18.7 Controlled Package Generation Owner Authorization Gate Check"

BRANCH="$(git branch --show-current 2>/dev/null || true)"
echo "Current branch: ${BRANCH:-UNKNOWN}"

section "1. Source branch is not a production branch"

case "$BRANCH" in
  main|master|production|prod|release|release/*|hotfix/production|hotfix/production/*)
    fail "Current branch '$BRANCH' is protected and cannot be used for owner authorization gate work."
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

if [ -f "$PHASE_18_6_EVIDENCE" ]; then
  pass "Phase 18.6 dry-run evidence output exists."
else
  fail "Missing Phase 18.6 dry-run evidence output: $PHASE_18_6_EVIDENCE"
fi

section "4. Phase 18.6 dry-run evidence passed"

PHASE_18_6_SCRIPT="./scripts/pharmaco-operations-controlled-package-generation-dry-run-evidence-check.sh"

if [ -f "$PHASE_18_6_EVIDENCE" ]; then
  if grep -q "PHASE 18.6 DRY-RUN EVIDENCE CHECK PASSED" "$PHASE_18_6_EVIDENCE"; then
    pass "Phase 18.6 committed evidence contains pass marker."
  else
    fail "Phase 18.6 committed evidence does not contain pass marker."
  fi

  if grep -q "Phase 18.6 dry-run evidence exit code: 0" "$PHASE_18_6_EVIDENCE"; then
    pass "Phase 18.6 committed evidence includes exit code 0."
  elif [ -x "$PHASE_18_6_SCRIPT" ]; then
    echo "Phase 18.6 committed evidence does not include stored exit-code line; re-running Phase 18.6 guardrail to verify exit code."
    if bash "$PHASE_18_6_SCRIPT"; then
      pass "Phase 18.6 guardrail re-run exited with code 0."
    else
      fail "Phase 18.6 guardrail re-run failed."
    fi
  else
    fail "Cannot re-run Phase 18.6 guardrail because script is missing or not executable."
  fi
else
  fail "Cannot verify Phase 18.6 pass result because evidence file is missing."
fi

section "5. Owner authorization status file exists"

OWNER_GATE_STATUS="docs/pharmaco/controlled-package-generation/owner-authorization-gate/PHASE_18_7_OWNER_AUTHORIZATION_GATE_STATUS.env"

if [ -f "$OWNER_GATE_STATUS" ]; then
  pass "Owner authorization status file exists."
else
  fail "Missing owner authorization status file: $OWNER_GATE_STATUS"
fi

section "6. Owner authorization status remains LOCKED"

if [ -f "$OWNER_GATE_STATUS" ]; then
  OWNER_STATUS="$(grep -E '^OWNER_AUTHORIZATION_STATUS=' "$OWNER_GATE_STATUS" | cut -d= -f2- || true)"
  if [ "$OWNER_STATUS" = "LOCKED" ]; then
    pass "Owner authorization status remains LOCKED."
  else
    fail "Owner authorization status is not LOCKED. Current value: ${OWNER_STATUS:-MISSING}"
  fi
fi

section "7. Package generation remains unauthorized"

if [ -f "$OWNER_GATE_STATUS" ]; then
  PACKAGE_AUTH="$(grep -E '^PACKAGE_GENERATION_AUTHORIZED=' "$OWNER_GATE_STATUS" | cut -d= -f2- || true)"
  if [ "$PACKAGE_AUTH" = "NO" ]; then
    pass "Package generation remains unauthorized."
  else
    fail "Package generation authorization is not NO. Current value: ${PACKAGE_AUTH:-MISSING}"
  fi
fi

section "8. Production deployment remains unauthorized"

if [ -f "$OWNER_GATE_STATUS" ]; then
  DEPLOY_AUTH="$(grep -E '^PRODUCTION_DEPLOYMENT_AUTHORIZED=' "$OWNER_GATE_STATUS" | cut -d= -f2- || true)"
  if [ "$DEPLOY_AUTH" = "NO" ]; then
    pass "Production deployment remains unauthorized."
  else
    fail "Production deployment authorization is not NO. Current value: ${DEPLOY_AUTH:-MISSING}"
  fi
fi

section "9. Production migration remains unauthorized"

if [ -f "$OWNER_GATE_STATUS" ]; then
  MIGRATION_AUTH="$(grep -E '^PRODUCTION_MIGRATION_AUTHORIZED=' "$OWNER_GATE_STATUS" | cut -d= -f2- || true)"
  if [ "$MIGRATION_AUTH" = "NO" ]; then
    pass "Production migration remains unauthorized."
  else
    fail "Production migration authorization is not NO. Current value: ${MIGRATION_AUTH:-MISSING}"
  fi
fi

section "10. Production dependency installation remains unauthorized"

if [ -f "$OWNER_GATE_STATUS" ]; then
  DEPENDENCY_AUTH="$(grep -E '^PRODUCTION_DEPENDENCY_INSTALLATION_AUTHORIZED=' "$OWNER_GATE_STATUS" | cut -d= -f2- || true)"
  if [ "$DEPENDENCY_AUTH" = "NO" ]; then
    pass "Production dependency installation remains unauthorized."
  else
    fail "Production dependency installation authorization is not NO. Current value: ${DEPENDENCY_AUTH:-MISSING}"
  fi
fi

section "11. Environment-based authorization override is blocked"

ENV_OWNER_AUTH="${PHARMACO_CONTROLLED_PACKAGE_OWNER_AUTHORIZATION:-LOCKED}"
ENV_PACKAGE_AUTH="${PHARMACO_CONTROLLED_PACKAGE_GENERATION_AUTHORIZED:-NO}"

case "$ENV_OWNER_AUTH" in
  GRANTED|Granted|granted|AUTHORIZED|Authorized|authorized|YES|Yes|yes|TRUE|True|true)
    fail "Environment owner authorization override detected: PHARMACO_CONTROLLED_PACKAGE_OWNER_AUTHORIZATION=$ENV_OWNER_AUTH"
    ;;
  *)
    pass "No environment owner authorization override detected."
    ;;
esac

case "$ENV_PACKAGE_AUTH" in
  GRANTED|Granted|granted|AUTHORIZED|Authorized|authorized|YES|Yes|yes|TRUE|True|true)
    fail "Environment package generation override detected: PHARMACO_CONTROLLED_PACKAGE_GENERATION_AUTHORIZED=$ENV_PACKAGE_AUTH"
    ;;
  *)
    pass "No environment package generation override detected."
    ;;
esac

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

section "Final Result"

if [ "$FAILURES" -eq 0 ]; then
  echo "PHASE 18.7 OWNER AUTHORIZATION GATE CHECK PASSED"
  exit 0
fi

echo "PHASE 18.7 OWNER AUTHORIZATION GATE CHECK FAILED with $FAILURES failure(s)."
exit 1

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

section "Phase 20.3 PharmaCo360 Sales/Dispensing Gap Analysis Check"

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

section "3. Phase 20.2 code inventory evidence exists and passed"

PHASE_20_2="docs/pharmaco/sales-dispensing-code-inventory/PHASE_20_2_PHARMACO360_SALES_DISPENSING_CODE_INVENTORY_EVIDENCE_OUTPUT.txt"

if [ -f "$PHASE_20_2" ] && grep -q "PHASE 20.2 PHARMACO360 SALES/DISPENSING CODE INVENTORY CHECK PASSED" "$PHASE_20_2"; then
  pass "Phase 20.2 evidence exists and passed."
else
  fail "Phase 20.2 evidence missing or failed."
fi

section "4. Phase 20.3 gap analysis files exist"

DOC_FILE="docs/pharmaco/sales-dispensing-gap-analysis/PHASE_20_3_PHARMACO360_SALES_DISPENSING_GAP_ANALYSIS.md"
STATUS_FILE="docs/pharmaco/sales-dispensing-gap-analysis/PHASE_20_3_PHARMACO360_SALES_DISPENSING_GAP_ANALYSIS_STATUS.env"

if [ -f "$DOC_FILE" ]; then
  pass "Phase 20.3 gap analysis document exists."
else
  fail "Missing Phase 20.3 gap analysis document."
fi

if [ -f "$STATUS_FILE" ]; then
  pass "Phase 20.3 gap analysis status file exists."
else
  fail "Missing Phase 20.3 gap analysis status file."
fi

section "5. Gap analysis is prepared"

if [ -f "$STATUS_FILE" ]; then
  GAP_STATUS="$(read_status_value "$STATUS_FILE" "GAP_ANALYSIS_STATUS")"
  TARGET_MODULE="$(read_status_value "$STATUS_FILE" "TARGET_MODULE")"
  ANALYSIS_SCOPE="$(read_status_value "$STATUS_FILE" "ANALYSIS_SCOPE")"
  PACKAGE_STATUS="$(read_status_value "$STATUS_FILE" "PACKAGE_GENERATION_STATUS")"
  OWNER_GRANTED="$(read_status_value "$STATUS_FILE" "OWNER_AUTHORIZATION_GRANTED")"
  FINAL_AUTH_PERCENT="$(read_status_value "$STATUS_FILE" "FINAL_PACKAGE_GENERATION_AUTHORIZATION_PERCENT")"

  if [ "$GAP_STATUS" = "PREPARED" ]; then
    pass "Gap analysis status is PREPARED."
  else
    fail "Gap analysis status is not PREPARED. Current value: ${GAP_STATUS:-MISSING}"
  fi

  if [ "$TARGET_MODULE" = "PHARMACO360_SALES_DISPENSING" ]; then
    pass "Target module is PHARMACO360_SALES_DISPENSING."
  else
    fail "Target module is not PHARMACO360_SALES_DISPENSING. Current value: ${TARGET_MODULE:-MISSING}"
  fi

  if [ "$ANALYSIS_SCOPE" = "BACKEND_FRONTEND_TESTS_UI_UX_AUDIT_RESPONSIVENESS" ]; then
    pass "Analysis scope covers backend, frontend, tests, UI/UX, audit, and responsiveness."
  else
    fail "Analysis scope is not correct. Current value: ${ANALYSIS_SCOPE:-MISSING}"
  fi

  if [ "$PACKAGE_STATUS" = "LOCKED" ]; then
    pass "Package generation status remains LOCKED."
  else
    fail "Package generation status is not LOCKED. Current value: ${PACKAGE_STATUS:-MISSING}"
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

section "6. Implementation and production changes are excluded"

if [ -f "$STATUS_FILE" ]; then
  for KEY in \
    IMPLEMENTATION_INCLUDED \
    UI_CHANGES_INCLUDED \
    API_CHANGES_INCLUDED \
    DATABASE_CHANGES_INCLUDED \
    MIGRATION_CHANGES_INCLUDED \
    PRODUCTION_CHANGES_INCLUDED
  do
    VALUE="$(read_status_value "$STATUS_FILE" "$KEY")"

    if [ "$VALUE" = "NO" ]; then
      pass "$KEY remains NO."
    else
      fail "$KEY is not NO. Current value: ${VALUE:-MISSING}"
    fi
  done
fi

section "7. Package generation and production actions remain blocked"

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

section "8. Overall system completion is tracked separately"

if [ -f "$STATUS_FILE" ]; then
  OVERALL="$(read_status_value "$STATUS_FILE" "OVERALL_SYSTEM_COMPLETION_PERCENT")"
  PACKAGE_READY="$(read_status_value "$STATUS_FILE" "CONTROLLED_PACKAGE_GENERATION_READINESS_PERCENT")"

  if [ "$OVERALL" = "91.5" ]; then
    pass "Overall system completion is recorded as 91.5%."
  else
    fail "Overall system completion is not 91.5%. Current value: ${OVERALL:-MISSING}"
  fi

  if [ "$PACKAGE_READY" = "96" ]; then
    pass "Controlled package-generation readiness is recorded separately as 96%."
  else
    fail "Controlled package-generation readiness is not 96%. Current value: ${PACKAGE_READY:-MISSING}"
  fi
fi

section "9. Gap analysis document includes existing strengths"

if [ -f "$DOC_FILE" ]; then
  if grep -q "tenant-scoped sales listing and sale detail review" "$DOC_FILE" \
    && grep -q "backend filters for sale status, payment status, sale type, and branch" "$DOC_FILE" \
    && grep -q "sale confirmation with stock deduction" "$DOC_FILE" \
    && grep -q "audit logging for dispensed sales" "$DOC_FILE" \
    && grep -q "admin dashboard sales summary" "$DOC_FILE"; then
    pass "Gap analysis document includes existing strengths."
  else
    fail "Gap analysis document missing required existing strengths."
  fi
fi

section "10. Gap analysis document includes identified gaps"

if [ -f "$DOC_FILE" ]; then
  if grep -q "Operational sales queues" "$DOC_FILE" \
    && grep -q "Dashboard filters" "$DOC_FILE" \
    && grep -q "Audit trail visibility" "$DOC_FILE" \
    && grep -q "Payment and receipt timeline visibility" "$DOC_FILE" \
    && grep -q "Responsive layout review" "$DOC_FILE"; then
    pass "Gap analysis document includes identified gaps."
  else
    fail "Gap analysis document missing required identified gaps."
  fi
fi

section "11. Phase 20.4 implementation target is documented"

if [ -f "$DOC_FILE" ]; then
  if grep -q "Phase 20.4 should focus on dashboard-level improvements first" "$DOC_FILE" \
    && grep -q "add better sales queue sections" "$DOC_FILE" \
    && grep -q "expose existing backend filters in the UI" "$DOC_FILE" \
    && grep -q "preserve tenant safety and existing tests" "$DOC_FILE"; then
    pass "Phase 20.4 implementation target is documented."
  else
    fail "Phase 20.4 implementation target is incomplete."
  fi
fi

section "12. UI/UX responsiveness checklist is present"

if [ -f "$DOC_FILE" ]; then
  if grep -q "360px small mobile" "$DOC_FILE" \
    && grep -q "430px mobile" "$DOC_FILE" \
    && grep -q "768px tablet" "$DOC_FILE" \
    && grep -q "1280px laptop" "$DOC_FILE" \
    && grep -q "1440px desktop" "$DOC_FILE" \
    && grep -q "1920px wide screen" "$DOC_FILE"; then
    pass "UI/UX responsiveness checklist is present."
  else
    fail "UI/UX responsiveness checklist is incomplete."
  fi
fi

section "13. Gap analysis document confirms inspection-only boundary"

if [ -f "$DOC_FILE" ]; then
  if grep -q "inspection and planning only" "$DOC_FILE" \
    && grep -q "does not implement UI, API, database, route, migration, or production changes" "$DOC_FILE" \
    && grep -q "No production action is approved by this phase" "$DOC_FILE"; then
    pass "Gap analysis document confirms inspection-only boundary."
  else
    fail "Gap analysis document missing required inspection-only boundary statements."
  fi
fi

section "14. Only allowed Phase 20.3 files are changed"

CHANGED_FILES="$(
  {
    git diff --name-only origin/development...HEAD 2>/dev/null || true
    git diff --name-only 2>/dev/null || true
    git diff --cached --name-only 2>/dev/null || true
    git status --short --untracked-files=all | sed 's/^...//' || true
  } | sed '/^$/d' | sort -u
)"

DISALLOWED_FILES="$(
  echo "$CHANGED_FILES" | grep -Ev \
    '^(docs/pharmaco/sales-dispensing-gap-analysis/PHASE_20_3_PHARMACO360_SALES_DISPENSING_GAP_ANALYSIS\.md|docs/pharmaco/sales-dispensing-gap-analysis/PHASE_20_3_PHARMACO360_SALES_DISPENSING_GAP_ANALYSIS_STATUS\.env|docs/pharmaco/sales-dispensing-gap-analysis/PHASE_20_3_PHARMACO360_SALES_DISPENSING_GAP_ANALYSIS_EVIDENCE_OUTPUT\.txt|scripts/pharmaco-sales-dispensing-gap-analysis-check\.sh)$' || true
)"

if [ -n "$DISALLOWED_FILES" ]; then
  echo "$DISALLOWED_FILES"
  fail "Files outside the allowed Phase 20.3 documentation/check scope are changed."
else
  pass "Only allowed Phase 20.3 documentation/check files are changed."
fi

section "15. Environment authorization overrides are blocked"

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

section "16. No premature package archive/checksum artifacts are tracked"

PREMATURE_PACKAGE_ARTIFACTS="$(tracked_files | grep -Ei '(^|/)(release|releases|package|packages|deployment-package|deployment-packages|artifacts|build-artifacts)/.*\.(zip|tar|tar\.gz|tgz|sha256|sha512|checksum|checksums|manifest)$' || true)"

if [ -n "$PREMATURE_PACKAGE_ARTIFACTS" ]; then
  echo "$PREMATURE_PACKAGE_ARTIFACTS"
  fail "Premature package archive/checksum artifacts are tracked."
else
  pass "No premature package archive/checksum artifacts are tracked."
fi

section "17. Protected tracked files remain blocked"

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

echo "Overall system completion: approximately 91.5%"
echo "Phase 20.3 PharmaCo360 sales/dispensing gap analysis check: $([ "$FAILURES" -eq 0 ] && echo "100%" || echo "blocked")"
echo "Controlled package-generation readiness: approximately 96%"
echo "Final package generation authorization: 0% — still locked"
echo "Normal development: allowed"

section "Final Result"

if [ "$FAILURES" -eq 0 ]; then
  echo "PHASE 20.3 PHARMACO360 SALES/DISPENSING GAP ANALYSIS CHECK PASSED"
  exit 0
fi

echo "PHASE 20.3 PHARMACO360 SALES/DISPENSING GAP ANALYSIS CHECK FAILED with $FAILURES failure(s)."
exit 1

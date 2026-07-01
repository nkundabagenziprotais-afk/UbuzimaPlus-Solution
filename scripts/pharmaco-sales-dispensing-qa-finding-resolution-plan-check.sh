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

section "Phase 20.7 PharmaCo360 Sales/Dispensing QA Finding Resolution Plan Check"

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

section "3. Phase 20.6 evidence exists and passed"

PHASE_20_6="docs/pharmaco/sales-dispensing-manual-qa-findings-register/PHASE_20_6_PHARMACO360_SALES_DISPENSING_MANUAL_QA_FINDINGS_REGISTER_EVIDENCE_OUTPUT.txt"

if [ -f "$PHASE_20_6" ] && grep -q "PHASE 20.6 PHARMACO360 SALES/DISPENSING MANUAL QA FINDINGS REGISTER CHECK PASSED" "$PHASE_20_6"; then
  pass "Phase 20.6 evidence exists and passed."
else
  fail "Phase 20.6 evidence missing or failed."
fi

section "4. Phase 20.7 files exist"

DOC_FILE="docs/pharmaco/sales-dispensing-qa-finding-resolution-plan/PHASE_20_7_PHARMACO360_SALES_DISPENSING_QA_FINDING_RESOLUTION_PLAN.md"
STATUS_FILE="docs/pharmaco/sales-dispensing-qa-finding-resolution-plan/PHASE_20_7_PHARMACO360_SALES_DISPENSING_QA_FINDING_RESOLUTION_PLAN_STATUS.env"

if [ -f "$DOC_FILE" ]; then
  pass "Phase 20.7 QA finding resolution plan document exists."
else
  fail "Missing Phase 20.7 QA finding resolution plan document."
fi

if [ -f "$STATUS_FILE" ]; then
  pass "Phase 20.7 QA finding resolution plan status file exists."
else
  fail "Missing Phase 20.7 QA finding resolution plan status file."
fi

section "5. Phase 20.7 status values are correct"

if [ -f "$STATUS_FILE" ]; then
  if [ "$(read_status_value "$STATUS_FILE" "QA_RESOLUTION_PLAN_STATUS")" = "PREPARED" ]; then
    pass "QA resolution plan status is PREPARED."
  else
    fail "QA resolution plan status is not PREPARED."
  fi

  if [ "$(read_status_value "$STATUS_FILE" "TARGET_MODULE")" = "PHARMACO360_SALES_DISPENSING" ]; then
    pass "Target module is PHARMACO360_SALES_DISPENSING."
  else
    fail "Target module is incorrect."
  fi

  if [ "$(read_status_value "$STATUS_FILE" "SOURCE_QA_PHASE")" = "PHASE_20_6_MANUAL_QA_FINDINGS_REGISTER" ]; then
    pass "Source QA phase is Phase 20.6."
  else
    fail "Source QA phase is incorrect."
  fi

  if [ "$(read_status_value "$STATUS_FILE" "IMPLEMENTATION_STATUS")" = "NOT_STARTED" ]; then
    pass "Implementation status is NOT_STARTED."
  else
    fail "Implementation status is not NOT_STARTED."
  fi
fi

section "6. No new implementation is included"

if [ -f "$STATUS_FILE" ]; then
  for KEY in \
    NEW_IMPLEMENTATION_INCLUDED \
    FRONTEND_CHANGES_INCLUDED \
    BACKEND_CHANGES_INCLUDED \
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

  if [ "$(read_status_value "$STATUS_FILE" "PACKAGE_GENERATION_STATUS")" = "LOCKED" ]; then
    pass "Package generation status remains LOCKED."
  else
    fail "Package generation status is not LOCKED."
  fi

  if [ "$(read_status_value "$STATUS_FILE" "OWNER_AUTHORIZATION_GRANTED")" = "NO" ]; then
    pass "Owner authorization remains not granted."
  else
    fail "Owner authorization is not NO."
  fi

  if [ "$(read_status_value "$STATUS_FILE" "FINAL_PACKAGE_GENERATION_AUTHORIZATION_PERCENT")" = "0" ]; then
    pass "Final package generation authorization remains 0%."
  else
    fail "Final package generation authorization is not 0%."
  fi
fi

section "8. Overall system completion is tracked separately"

if [ -f "$STATUS_FILE" ]; then
  OVERALL="$(read_status_value "$STATUS_FILE" "OVERALL_SYSTEM_COMPLETION_PERCENT")"
  PACKAGE_READY="$(read_status_value "$STATUS_FILE" "CONTROLLED_PACKAGE_GENERATION_READINESS_PERCENT")"

  if [ "$OVERALL" = "93.5" ]; then
    pass "Overall system completion is recorded as 93.5%."
  else
    fail "Overall system completion is not 93.5%. Current value: ${OVERALL:-MISSING}"
  fi

  if [ "$PACKAGE_READY" = "96" ]; then
    pass "Controlled package-generation readiness is recorded separately as 96%."
  else
    fail "Controlled package-generation readiness is not 96%. Current value: ${PACKAGE_READY:-MISSING}"
  fi
fi

section "9. Resolution plan references Phase 20.6 baseline"

if [ -f "$DOC_FILE" ]; then
  if grep -q "Phase 20.6 — PharmaCo360 Sales/Dispensing Manual QA Findings Register" "$DOC_FILE" \
    && grep -q "Hotfix PR #104 is merged" "$DOC_FILE" \
    && grep -q "Phase 20.5 preview/review evidence is merged" "$DOC_FILE" \
    && grep -q "Phase 20.6 manual QA findings register is merged" "$DOC_FILE" \
    && grep -q "No known critical blockers are recorded" "$DOC_FILE"; then
    pass "Phase 20.6 source baseline is documented."
  else
    fail "Phase 20.6 source baseline is incomplete."
  fi
fi

section "10. Open QA findings are mapped"

if [ -f "$DOC_FILE" ]; then
  if grep -q "QA-20-6-003" "$DOC_FILE" \
    && grep -q "QA-20-6-004" "$DOC_FILE" \
    && grep -q "QA-20-6-005" "$DOC_FILE" \
    && grep -q "QA-20-6-006" "$DOC_FILE" \
    && grep -q "Resolution Direction" "$DOC_FILE" \
    && grep -q "Implementation Phase" "$DOC_FILE"; then
    pass "Open QA findings are mapped to resolution direction."
  else
    fail "Open QA finding mapping is incomplete."
  fi
fi

section "11. Resolution sequence is documented"

if [ -f "$DOC_FILE" ]; then
  if grep -q "Step 1 — Responsive Sales Queue Review" "$DOC_FILE" \
    && grep -q "Step 2 — Filter Usability Review" "$DOC_FILE" \
    && grep -q "Step 3 — Selected-Sale Review Panel Review" "$DOC_FILE" \
    && grep -q "Step 4 — Payment and Prescription State Review" "$DOC_FILE"; then
    pass "Resolution sequence is documented."
  else
    fail "Resolution sequence is incomplete."
  fi
fi

section "12. Future implementation focus is constrained"

if [ -f "$DOC_FILE" ]; then
  if grep -q "Improve mobile spacing for queue cards" "$DOC_FILE" \
    && grep -q "Improve filter action layout" "$DOC_FILE" \
    && grep -q "Strengthen selected-sale empty/loading states" "$DOC_FILE" \
    && grep -q "Add clearer status text for payment and prescription states" "$DOC_FILE" \
    && grep -q "Preserve the existing API contract" "$DOC_FILE" \
    && grep -q "Avoid database and migration changes" "$DOC_FILE"; then
    pass "Future implementation focus is constrained."
  else
    fail "Future implementation focus is incomplete."
  fi
fi

section "13. Acceptance criteria are documented"

if [ -f "$DOC_FILE" ]; then
  if grep -q "Admin dashboard build passes" "$DOC_FILE" \
    && grep -q "Login still lands on home page" "$DOC_FILE" \
    && grep -q "Sales/dispensing dashboard renders without runtime crashes" "$DOC_FILE" \
    && grep -q "Queue cards are responsive at all required screen sizes" "$DOC_FILE" \
    && grep -q "Filters remain usable on mobile/tablet" "$DOC_FILE" \
    && grep -q "Payment and prescription states are clear" "$DOC_FILE"; then
    pass "Acceptance criteria are documented."
  else
    fail "Acceptance criteria are incomplete."
  fi
fi

section "14. Safety boundary is documented"

if [ -f "$DOC_FILE" ]; then
  if grep -q "No production action is approved by this phase" "$DOC_FILE" \
    && grep -q "Package generation remains locked" "$DOC_FILE" \
    && grep -q "database migration changes" "$DOC_FILE" \
    && grep -q "production dependency installation" "$DOC_FILE"; then
    pass "Safety boundary is documented."
  else
    fail "Safety boundary is incomplete."
  fi
fi

section "15. Only allowed Phase 20.7 files are changed"

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
    '^(docs/pharmaco/sales-dispensing-qa-finding-resolution-plan/PHASE_20_7_PHARMACO360_SALES_DISPENSING_QA_FINDING_RESOLUTION_PLAN\.md|docs/pharmaco/sales-dispensing-qa-finding-resolution-plan/PHASE_20_7_PHARMACO360_SALES_DISPENSING_QA_FINDING_RESOLUTION_PLAN_STATUS\.env|docs/pharmaco/sales-dispensing-qa-finding-resolution-plan/PHASE_20_7_PHARMACO360_SALES_DISPENSING_QA_FINDING_RESOLUTION_PLAN_EVIDENCE_OUTPUT\.txt|scripts/pharmaco-sales-dispensing-qa-finding-resolution-plan-check\.sh)$' || true
)"

if [ -n "$DISALLOWED_FILES" ]; then
  echo "$DISALLOWED_FILES"
  fail "Files outside the allowed Phase 20.7 plan/evidence scope are changed."
else
  pass "Only allowed Phase 20.7 plan/evidence files are changed."
fi

section "16. Backend and database files are not changed"

BACKEND_OR_DATABASE_CHANGES="$(echo "$CHANGED_FILES" | grep -E '^(backend/app|backend/routes|backend/database|backend/tests|database/|routes/|app/)' || true)"

if [ -n "$BACKEND_OR_DATABASE_CHANGES" ]; then
  echo "$BACKEND_OR_DATABASE_CHANGES"
  fail "Backend or database files are changed."
else
  pass "No backend or database files are changed."
fi

section "17. Admin dashboard build passes"

if npm --prefix web/admin-dashboard run build; then
  pass "Admin dashboard build passes."
else
  fail "Admin dashboard build failed."
fi

section "18. Environment authorization overrides are blocked"

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

section "19. No premature package archive/checksum artifacts are tracked"

PREMATURE_PACKAGE_ARTIFACTS="$(tracked_files | grep -Ei '(^|/)(release|releases|package|packages|deployment-package|deployment-packages|artifacts|build-artifacts)/.*\.(zip|tar|tar\.gz|tgz|sha256|sha512|checksum|checksums|manifest)$' || true)"

if [ -n "$PREMATURE_PACKAGE_ARTIFACTS" ]; then
  echo "$PREMATURE_PACKAGE_ARTIFACTS"
  fail "Premature package archive/checksum artifacts are tracked."
else
  pass "No premature package archive/checksum artifacts are tracked."
fi

section "20. Protected tracked files remain blocked"

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

echo "Overall system completion: approximately 93.5%"
echo "Phase 20.7 PharmaCo360 sales/dispensing QA finding resolution plan check: $([ "$FAILURES" -eq 0 ] && echo "100%" || echo "blocked")"
echo "Controlled package-generation readiness: approximately 96%"
echo "Final package generation authorization: 0% — still locked"
echo "Normal development: allowed"

section "Final Result"

if [ "$FAILURES" -eq 0 ]; then
  echo "PHASE 20.7 PHARMACO360 SALES/DISPENSING QA FINDING RESOLUTION PLAN CHECK PASSED"
  exit 0
fi

echo "PHASE 20.7 PHARMACO360 SALES/DISPENSING QA FINDING RESOLUTION PLAN CHECK FAILED with $FAILURES failure(s)."
exit 1

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

section "Phase 20.5 PharmaCo360 Sales/Dispensing Dashboard Preview Review Check"

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

section "3. Phase 20.4 evidence exists and passed"

PHASE_20_4="docs/pharmaco/sales-dispensing-dashboard-improvements/PHASE_20_4_PHARMACO360_SALES_DISPENSING_DASHBOARD_IMPROVEMENTS_EVIDENCE_OUTPUT.txt"

if [ -f "$PHASE_20_4" ] && grep -q "PHASE 20.4 PHARMACO360 SALES/DISPENSING DASHBOARD IMPROVEMENTS CHECK PASSED" "$PHASE_20_4"; then
  pass "Phase 20.4 evidence exists and passed."
else
  fail "Phase 20.4 evidence missing or failed."
fi

section "4. Login hotfix is included in development history"

RECENT_HISTORY="$(git log --format='%h %s' -80)"

if echo "$RECENT_HISTORY" | grep -Eq "Merge pull request #104|Fix admin dashboard runtime errors after login|hotfix/admin-dashboard-login-home-runtime-fixes"; then
  pass "Login/home runtime hotfix is present in recent history."
else
  echo "$RECENT_HISTORY" | head -20
  fail "Login/home runtime hotfix not found in recent history."
fi

section "5. Phase 20.5 preview review files exist"

DOC_FILE="docs/pharmaco/sales-dispensing-dashboard-preview-review/PHASE_20_5_PHARMACO360_SALES_DISPENSING_DASHBOARD_PREVIEW_REVIEW.md"
STATUS_FILE="docs/pharmaco/sales-dispensing-dashboard-preview-review/PHASE_20_5_PHARMACO360_SALES_DISPENSING_DASHBOARD_PREVIEW_REVIEW_STATUS.env"

if [ -f "$DOC_FILE" ]; then
  pass "Phase 20.5 preview review document exists."
else
  fail "Missing Phase 20.5 preview review document."
fi

if [ -f "$STATUS_FILE" ]; then
  pass "Phase 20.5 preview review status file exists."
else
  fail "Missing Phase 20.5 preview review status file."
fi

section "6. Phase 20.5 status values are correct"

if [ -f "$STATUS_FILE" ]; then
  if [ "$(read_status_value "$STATUS_FILE" "PREVIEW_REVIEW_STATUS")" = "PREPARED" ]; then
    pass "Preview review status is PREPARED."
  else
    fail "Preview review status is not PREPARED."
  fi

  if [ "$(read_status_value "$STATUS_FILE" "TARGET_MODULE")" = "PHARMACO360_SALES_DISPENSING" ]; then
    pass "Target module is PHARMACO360_SALES_DISPENSING."
  else
    fail "Target module is incorrect."
  fi

  if [ "$(read_status_value "$STATUS_FILE" "LOGIN_HOME_VERIFIED")" = "YES" ]; then
    pass "Login home verification is YES."
  else
    fail "Login home verification is not YES."
  fi

  if [ "$(read_status_value "$STATUS_FILE" "ADMIN_DASHBOARD_BUILD_STATUS")" = "PASSED" ]; then
    pass "Admin dashboard build status is PASSED."
  else
    fail "Admin dashboard build status is not PASSED."
  fi

  if [ "$(read_status_value "$STATUS_FILE" "FRONTEND_RUNTIME_HOTFIX_INCLUDED")" = "YES" ]; then
    pass "Frontend runtime hotfix is included."
  else
    fail "Frontend runtime hotfix is not marked YES."
  fi
fi

section "7. Backend, database, migration, package, and production changes remain blocked"

if [ -f "$STATUS_FILE" ]; then
  for KEY in \
    BACKEND_CHANGES_INCLUDED \
    DATABASE_CHANGES_INCLUDED \
    MIGRATION_CHANGES_INCLUDED \
    PRODUCTION_CHANGES_INCLUDED \
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

  if [ "$OVERALL" = "92.7" ]; then
    pass "Overall system completion is recorded as 92.7%."
  else
    fail "Overall system completion is not 92.7%. Current value: ${OVERALL:-MISSING}"
  fi

  if [ "$PACKAGE_READY" = "96" ]; then
    pass "Controlled package-generation readiness is recorded separately as 96%."
  else
    fail "Controlled package-generation readiness is not 96%. Current value: ${PACKAGE_READY:-MISSING}"
  fi
fi

section "9. Preview review document includes runtime verification notes"

if [ -f "$DOC_FILE" ]; then
  if grep -q "Local login credentials were reset and verified" "$DOC_FILE" \
    && grep -q "Backend login/profile API returned a valid VitaPharma tenant admin profile" "$DOC_FILE" \
    && grep -q "Admin dashboard blank page after login was fixed" "$DOC_FILE" \
    && grep -q "User confirmed the dashboard now lands on the home page" "$DOC_FILE" \
    && grep -q "Hotfix PR #104 was merged into development" "$DOC_FILE"; then
    pass "Runtime verification notes are documented."
  else
    fail "Runtime verification notes are incomplete."
  fi
fi

section "10. Preview review document includes dashboard review scope"

if [ -f "$DOC_FILE" ]; then
  if grep -q "sales/dispensing dashboard queue cards" "$DOC_FILE" \
    && grep -q "sales/dispensing filters" "$DOC_FILE" \
    && grep -q "selected-sale insight cards" "$DOC_FILE" \
    && grep -q "payment and prescription verification sections" "$DOC_FILE" \
    && grep -q "responsive behavior across approved screen sizes" "$DOC_FILE"; then
    pass "Dashboard review scope is documented."
  else
    fail "Dashboard review scope is incomplete."
  fi
fi

section "11. Responsive review checklist is present"

if [ -f "$DOC_FILE" ]; then
  if grep -q "360px small mobile" "$DOC_FILE" \
    && grep -q "430px mobile" "$DOC_FILE" \
    && grep -q "768px tablet" "$DOC_FILE" \
    && grep -q "1280px laptop" "$DOC_FILE" \
    && grep -q "1440px desktop" "$DOC_FILE" \
    && grep -q "1920px wide screen" "$DOC_FILE"; then
    pass "Responsive review checklist is present."
  else
    fail "Responsive review checklist is incomplete."
  fi
fi

section "12. Safety boundary is documented"

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

section "13. Only allowed Phase 20.5 files are changed"

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
    '^(docs/pharmaco/sales-dispensing-dashboard-preview-review/PHASE_20_5_PHARMACO360_SALES_DISPENSING_DASHBOARD_PREVIEW_REVIEW\.md|docs/pharmaco/sales-dispensing-dashboard-preview-review/PHASE_20_5_PHARMACO360_SALES_DISPENSING_DASHBOARD_PREVIEW_REVIEW_STATUS\.env|docs/pharmaco/sales-dispensing-dashboard-preview-review/PHASE_20_5_PHARMACO360_SALES_DISPENSING_DASHBOARD_PREVIEW_REVIEW_EVIDENCE_OUTPUT\.txt|scripts/pharmaco-sales-dispensing-dashboard-preview-review-check\.sh)$' || true
)"

if [ -n "$DISALLOWED_FILES" ]; then
  echo "$DISALLOWED_FILES"
  fail "Files outside the allowed Phase 20.5 review/evidence scope are changed."
else
  pass "Only allowed Phase 20.5 review/evidence files are changed."
fi

section "14. Backend and database files are not changed"

BACKEND_OR_DATABASE_CHANGES="$(echo "$CHANGED_FILES" | grep -E '^(backend/app|backend/routes|backend/database|backend/tests|database/|routes/|app/)' || true)"

if [ -n "$BACKEND_OR_DATABASE_CHANGES" ]; then
  echo "$BACKEND_OR_DATABASE_CHANGES"
  fail "Backend or database files are changed."
else
  pass "No backend or database files are changed."
fi

section "15. Admin dashboard build passes"

if npm --prefix web/admin-dashboard run build; then
  pass "Admin dashboard build passes."
else
  fail "Admin dashboard build failed."
fi

section "16. Environment authorization overrides are blocked"

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

echo "Overall system completion: approximately 92.7%"
echo "Phase 20.5 PharmaCo360 sales/dispensing dashboard preview review check: $([ "$FAILURES" -eq 0 ] && echo "100%" || echo "blocked")"
echo "Controlled package-generation readiness: approximately 96%"
echo "Final package generation authorization: 0% — still locked"
echo "Normal development: allowed"

section "Final Result"

if [ "$FAILURES" -eq 0 ]; then
  echo "PHASE 20.5 PHARMACO360 SALES/DISPENSING DASHBOARD PREVIEW REVIEW CHECK PASSED"
  exit 0
fi

echo "PHASE 20.5 PHARMACO360 SALES/DISPENSING DASHBOARD PREVIEW REVIEW CHECK FAILED with $FAILURES failure(s)."
exit 1

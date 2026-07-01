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

section "Phase 20.2 PharmaCo360 Sales/Dispensing Code Inventory Check"

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

section "3. Phase 20.1 normal development workplan evidence exists and passed"

PHASE_20_1="docs/pharmaco/normal-development-workplan/PHASE_20_1_PHARMACO360_NORMAL_DEVELOPMENT_WORKPLAN_EVIDENCE_OUTPUT.txt"

if [ -f "$PHASE_20_1" ] && grep -q "PHASE 20.1 PHARMACO360 NORMAL DEVELOPMENT WORKPLAN CHECK PASSED" "$PHASE_20_1"; then
  pass "Phase 20.1 evidence exists and passed."
else
  fail "Phase 20.1 evidence missing or failed."
fi

section "4. Phase 20.2 inventory files exist"

DOC_FILE="docs/pharmaco/sales-dispensing-code-inventory/PHASE_20_2_PHARMACO360_SALES_DISPENSING_CODE_INVENTORY.md"
STATUS_FILE="docs/pharmaco/sales-dispensing-code-inventory/PHASE_20_2_PHARMACO360_SALES_DISPENSING_CODE_INVENTORY_STATUS.env"
INVENTORY_FILE="docs/pharmaco/sales-dispensing-code-inventory/PHASE_20_2_PHARMACO360_SALES_DISPENSING_CODE_INVENTORY_FILES.txt"

if [ -f "$DOC_FILE" ]; then
  pass "Phase 20.2 inventory document exists."
else
  fail "Missing Phase 20.2 inventory document."
fi

if [ -f "$STATUS_FILE" ]; then
  pass "Phase 20.2 inventory status file exists."
else
  fail "Missing Phase 20.2 inventory status file."
fi

if [ -f "$INVENTORY_FILE" ]; then
  pass "Phase 20.2 inventory file list exists."
else
  fail "Missing Phase 20.2 inventory file list."
fi

section "5. Code inventory is prepared"

if [ -f "$STATUS_FILE" ]; then
  CODE_INVENTORY_STATUS="$(read_status_value "$STATUS_FILE" "CODE_INVENTORY_STATUS")"
  TARGET_MODULE="$(read_status_value "$STATUS_FILE" "TARGET_MODULE")"
  INVENTORY_SCOPE="$(read_status_value "$STATUS_FILE" "INVENTORY_SCOPE")"
  PACKAGE_STATUS="$(read_status_value "$STATUS_FILE" "PACKAGE_GENERATION_STATUS")"
  OWNER_GRANTED="$(read_status_value "$STATUS_FILE" "OWNER_AUTHORIZATION_GRANTED")"
  FINAL_AUTH_PERCENT="$(read_status_value "$STATUS_FILE" "FINAL_PACKAGE_GENERATION_AUTHORIZATION_PERCENT")"

  if [ "$CODE_INVENTORY_STATUS" = "PREPARED" ]; then
    pass "Code inventory status is PREPARED."
  else
    fail "Code inventory status is not PREPARED. Current value: ${CODE_INVENTORY_STATUS:-MISSING}"
  fi

  if [ "$TARGET_MODULE" = "PHARMACO360_SALES_DISPENSING" ]; then
    pass "Target module is PHARMACO360_SALES_DISPENSING."
  else
    fail "Target module is not PHARMACO360_SALES_DISPENSING. Current value: ${TARGET_MODULE:-MISSING}"
  fi

  if [ "$INVENTORY_SCOPE" = "BACKEND_FRONTEND_TESTS_ROUTES_MODELS_MIGRATIONS" ]; then
    pass "Inventory scope covers backend, frontend, tests, routes, models, and migrations."
  else
    fail "Inventory scope is not correct. Current value: ${INVENTORY_SCOPE:-MISSING}"
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

section "6. Inventory exclusions are confirmed"

if [ -f "$STATUS_FILE" ]; then
  for KEY in \
    VENDOR_FILES_INCLUDED \
    NODE_MODULES_INCLUDED \
    DIST_BUILD_FILES_INCLUDED \
    ENV_FILES_INCLUDED \
    PRODUCTION_CHANGES_INCLUDED \
    UI_IMPLEMENTATION_INCLUDED \
    API_IMPLEMENTATION_INCLUDED \
    DATABASE_MIGRATION_INCLUDED
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

  if [ "$OVERALL" = "91" ]; then
    pass "Overall system completion is recorded as 91%."
  else
    fail "Overall system completion is not 91%. Current value: ${OVERALL:-MISSING}"
  fi

  if [ "$PACKAGE_READY" = "96" ]; then
    pass "Controlled package-generation readiness is recorded separately as 96%."
  else
    fail "Controlled package-generation readiness is not 96%. Current value: ${PACKAGE_READY:-MISSING}"
  fi
fi

section "9. Inventory includes required sales/dispensing backend files"

if [ -f "$INVENTORY_FILE" ]; then
  for REQUIRED_FILE in \
    "backend/app/Http/Controllers/Api/V1/PharmaCo360/SalesDispensingController.php" \
    "backend/app/Models/PharmacoSale.php" \
    "backend/app/Models/PharmacoSaleItem.php" \
    "backend/app/Models/PharmacoPayment.php" \
    "backend/app/Models/PharmacoPrescription.php" \
    "backend/app/Models/StockBatch.php" \
    "backend/app/Models/StockMovement.php" \
    "backend/database/migrations/2026_06_29_000060_create_pharmaco_sales_dispensing_tables.php" \
    "backend/tests/Feature/PharmaCo360/PharmacoSalesDispensingApiTest.php" \
    "backend/tests/Feature/PharmaCo360/PharmacoSalesDispensingFoundationTest.php" \
    "backend/tests/Feature/PharmaCo360/PharmacoSalesCreationApiTest.php" \
    "backend/tests/Feature/PharmaCo360/PharmacoSaleConfirmationApiTest.php"
  do
    if grep -Fxq "$REQUIRED_FILE" "$INVENTORY_FILE"; then
      pass "Inventory includes $REQUIRED_FILE."
    else
      fail "Inventory missing $REQUIRED_FILE."
    fi
  done
fi

section "10. Inventory includes required admin dashboard files"

if [ -f "$INVENTORY_FILE" ]; then
  for REQUIRED_FILE in \
    "web/admin-dashboard/src/App.tsx" \
    "web/admin-dashboard/src/components/SalesCreationPanel.tsx" \
    "web/admin-dashboard/src/components/SalesDispensingReview.tsx" \
    "web/admin-dashboard/src/lib/api.ts" \
    "web/admin-dashboard/src/styles.css" \
    "web/admin-dashboard/package.json" \
    "web/admin-dashboard/vite.config.ts"
  do
    if grep -Fxq "$REQUIRED_FILE" "$INVENTORY_FILE"; then
      pass "Inventory includes $REQUIRED_FILE."
    else
      fail "Inventory missing $REQUIRED_FILE."
    fi
  done
fi

section "11. Inventory excludes noisy/generated/protected files"

if [ -f "$INVENTORY_FILE" ]; then
  NOISY_FILES="$(grep -E '(^|/)(vendor|node_modules|dist|build|storage|bootstrap/cache)/|(^|/)\.env($|\.)|docs/deployment|^scripts/' "$INVENTORY_FILE" || true)"

  if [ -n "$NOISY_FILES" ]; then
    echo "$NOISY_FILES"
    fail "Inventory includes noisy/generated/protected files."
  else
    pass "Inventory excludes noisy/generated/protected files."
  fi
fi

section "12. Inventory document confirms inspection-only boundary"

if [ -f "$DOC_FILE" ]; then
  if grep -q "inspection and documentation phase only" "$DOC_FILE" \
    && grep -q "does not implement UI, API, database, route, migration, or production changes" "$DOC_FILE" \
    && grep -q "No production action is approved by this phase" "$DOC_FILE"; then
    pass "Inventory document confirms inspection-only boundary."
  else
    fail "Inventory document missing required inspection-only boundary statements."
  fi
fi

section "13. Environment authorization overrides are blocked"

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

section "14. No premature package archive/checksum artifacts are tracked"

PREMATURE_PACKAGE_ARTIFACTS="$(tracked_files | grep -Ei '(^|/)(release|releases|package|packages|deployment-package|deployment-packages|artifacts|build-artifacts)/.*\.(zip|tar|tar\.gz|tgz|sha256|sha512|checksum|checksums|manifest)$' || true)"

if [ -n "$PREMATURE_PACKAGE_ARTIFACTS" ]; then
  echo "$PREMATURE_PACKAGE_ARTIFACTS"
  fail "Premature package archive/checksum artifacts are tracked."
else
  pass "No premature package archive/checksum artifacts are tracked."
fi

section "15. Protected tracked files remain blocked"

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

echo "Overall system completion: approximately 91%"
echo "Phase 20.2 PharmaCo360 sales/dispensing code inventory check: $([ "$FAILURES" -eq 0 ] && echo "100%" || echo "blocked")"
echo "Controlled package-generation readiness: approximately 96%"
echo "Final package generation authorization: 0% — still locked"
echo "Normal development: allowed"

section "Final Result"

if [ "$FAILURES" -eq 0 ]; then
  echo "PHASE 20.2 PHARMACO360 SALES/DISPENSING CODE INVENTORY CHECK PASSED"
  exit 0
fi

echo "PHASE 20.2 PHARMACO360 SALES/DISPENSING CODE INVENTORY CHECK FAILED with $FAILURES failure(s)."
exit 1

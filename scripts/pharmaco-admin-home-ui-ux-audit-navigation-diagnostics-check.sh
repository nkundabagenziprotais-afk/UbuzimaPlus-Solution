#!/usr/bin/env bash
set -euo pipefail

pass() {
  echo "PASS: $1"
}

fail() {
  echo "FAIL: $1"
  exit 1
}

section() {
  echo ""
  echo "===== $1 ====="
}

tracked_files() {
  git status --short | sed 's/^...//'
}

section "PHASE 21.1 BRANCH SAFETY"
CURRENT_BRANCH="$(git branch --show-current)"
echo "Current branch: ${CURRENT_BRANCH}"

if [ "${CURRENT_BRANCH}" = "main" ] || [ "${CURRENT_BRANCH}" = "master" ] || [ "${CURRENT_BRANCH}" = "production" ]; then
  fail "Refusing to run Phase 21.1 evidence on protected branch ${CURRENT_BRANCH}"
fi

case "${CURRENT_BRANCH}" in
  feature/phase-21-1-admin-home-ui-ux-audit-navigation-diagnostics)
    pass "Running on expected Phase 21.1 feature branch"
    ;;
  *)
    fail "Expected feature/phase-21-1-admin-home-ui-ux-audit-navigation-diagnostics"
    ;;
esac

section "PHASE 21.1 FILE PRESENCE"
[ -f "web/admin-dashboard/src/App.tsx" ] || fail "Missing App.tsx"
[ -f "web/admin-dashboard/src/components/PayablesWorkflow.tsx" ] || fail "Missing PayablesWorkflow.tsx"
[ -f "web/admin-dashboard/src/styles.css" ] || fail "Missing styles.css"
[ -d "docs/pharmaco/admin-home-ui-ux-audit-navigation-diagnostics" ] || fail "Missing Phase 21.1 docs directory"

pass "Required Phase 21.1 files exist"

section "PHASE 21.1 CHANGED FILE SAFETY"
UNSAFE_FILES=""

while IFS= read -r file; do
  [ -z "${file}" ] && continue

  case "${file}" in
    web/admin-dashboard/src/App.tsx) ;;
    web/admin-dashboard/src/components/PayablesWorkflow.tsx) ;;
    web/admin-dashboard/src/components/ProductInventoryPreview.tsx) ;;
    web/admin-dashboard/src/components/ProductInventoryActions.tsx) ;;
    web/admin-dashboard/src/styles.css) ;;
    docs/pharmaco/admin-home-ui-ux-audit-navigation-diagnostics/*) ;;
    scripts/pharmaco-admin-home-ui-ux-audit-navigation-diagnostics-check.sh) ;;
    *)
      UNSAFE_FILES="${UNSAFE_FILES}${file}
"
      ;;
  esac
done < <(tracked_files)

if [ -n "${UNSAFE_FILES}" ]; then
  echo "${UNSAFE_FILES}"
  fail "Unexpected files changed in Phase 21.1"
fi

pass "Changed files are limited to Admin Home UI/UX, Payables UI/UX, docs, and evidence script"

section "ADMIN HOME NAVIGATION MARKERS"
grep -q "adminNavGroups" web/admin-dashboard/src/App.tsx || fail "Missing grouped admin navigation"
grep -q "expandedNavGroups" web/admin-dashboard/src/App.tsx || fail "Missing folded navigation state"
grep -q "handleNavGroupToggle" web/admin-dashboard/src/App.tsx || fail "Missing folded navigation handler"
grep -q "admin-home-nav-tree" web/admin-dashboard/src/App.tsx || fail "Missing folded navigation tree markup"
grep -q "admin-workspace-scroll" web/admin-dashboard/src/App.tsx || fail "Missing independent workspace scroll wrapper"

pass "Admin Home grouped navigation and independent scroll markers found"

section "TENANT-AWARE WEBSITE ROUTING MARKERS"
grep -q "tenantWebsiteSignals" web/admin-dashboard/src/App.tsx || fail "Missing tenant website signal logic"
grep -q "VITE_UBUZIMA_PLUS_WEBSITE_URL" web/admin-dashboard/src/App.tsx || fail "Missing Ubuzima+ website env override"
grep -q "VITE_VITAPHARMA_WEBSITE_URL" web/admin-dashboard/src/App.tsx || fail "Missing Vita Pharma website env override"
grep -q "https://www.ubuzimaplus.com" web/admin-dashboard/src/App.tsx || fail "Missing Ubuzima+ default website URL"
grep -q "https://www.vitapharmaafrica.com" web/admin-dashboard/src/App.tsx || fail "Missing Vita Pharma default website URL"
grep -q "publicWebsiteLabel" web/admin-dashboard/src/App.tsx || fail "Missing dynamic website label"

pass "Tenant-aware website routing markers found"

section "SUPPLIER PAYABLES SOURCE REFACTOR MARKERS"
grep -q "type PayablesWorkspaceView" web/admin-dashboard/src/components/PayablesWorkflow.tsx || fail "Missing Payables child workspace type"
grep -q "activePayablesView" web/admin-dashboard/src/components/PayablesWorkflow.tsx || fail "Missing Payables child workspace state"
grep -q "payables-child-nav" web/admin-dashboard/src/components/PayablesWorkflow.tsx || fail "Missing Payables child navigation"
grep -q "payables-register-table" web/admin-dashboard/src/components/PayablesWorkflow.tsx || fail "Missing Payables register table"
grep -q "create-payable" web/admin-dashboard/src/components/PayablesWorkflow.tsx || fail "Missing Create payable child page"
grep -q "supplier-invoices" web/admin-dashboard/src/components/PayablesWorkflow.tsx || fail "Missing Supplier invoices child page"
grep -q "approval-queue" web/admin-dashboard/src/components/PayablesWorkflow.tsx || fail "Missing Approval queue child page"
grep -q "record-payment" web/admin-dashboard/src/components/PayablesWorkflow.tsx || fail "Missing Record payment child page"

PAYABLES_KPI_COUNT="$(grep -c 'procurement-kpi-grid payables-kpi-grid' web/admin-dashboard/src/components/PayablesWorkflow.tsx || true)"
echo "Payables KPI grid count: ${PAYABLES_KPI_COUNT}"
[ "${PAYABLES_KPI_COUNT}" -eq 1 ] || fail "Expected exactly one Payables KPI grid"

pass "Supplier Payables source refactor markers found"


section "INVENTORY SOURCE REFINEMENT MARKERS"
grep -q "inventory-master-table" web/admin-dashboard/src/components/ProductInventoryPreview.tsx || fail "Missing Product Master table"
grep -q "type InventoryActionsView" web/admin-dashboard/src/components/ProductInventoryActions.tsx || fail "Missing Inventory action child workspace type"
grep -q "activeInventoryAction" web/admin-dashboard/src/components/ProductInventoryActions.tsx || fail "Missing Inventory active child workspace state"
grep -q "inventory-actions-child-nav" web/admin-dashboard/src/components/ProductInventoryActions.tsx || fail "Missing Inventory child navigation"
grep -q "inventory-actions-grid-refined" web/admin-dashboard/src/components/ProductInventoryActions.tsx || fail "Missing refined Inventory action grid"
grep -q "inventory-receiving-card" web/admin-dashboard/src/components/ProductInventoryActions.tsx || fail "Missing focused Stock Receiving card"
grep -q "Phase 21.1 inventory source refinement" web/admin-dashboard/src/styles.css || fail "Missing Inventory source refinement CSS marker"

grep -q "INVENTORY_PRODUCT_MASTER_TABLE_REFINED=YES" "${STATUS_FILE}" || fail "Missing Inventory product master table status"
grep -q "INVENTORY_ACTIONS_CHILD_WORKSPACES_INCLUDED=YES" "${STATUS_FILE}" || fail "Missing Inventory child workspace status"
grep -q "INVENTORY_STOCK_RECEIVING_WORKSPACE_REFINED=YES" "${STATUS_FILE}" || fail "Missing Inventory stock receiving status"

pass "Inventory source refinement markers found"


section "CSS UX REFINEMENT MARKERS"
grep -q "Phase 21.1 permanent refinement" web/admin-dashboard/src/styles.css || fail "Missing permanent commercial shell CSS marker"
grep -q "Phase 21.1 deep UI/UX audit refinement" web/admin-dashboard/src/styles.css || fail "Missing deep UI/UX audit CSS marker"
grep -q "Phase 21.1 source refactor — Supplier Payables child workspaces" web/admin-dashboard/src/styles.css || fail "Missing Payables source refactor CSS marker"
grep -q "Phase 21.1 Payables KPI readability correction" web/admin-dashboard/src/styles.css || fail "Missing Payables KPI readability CSS marker"
grep -q "Phase 21.1 Operating View credit-risk readability refinement" web/admin-dashboard/src/styles.css || fail "Missing Operating View credit-risk CSS marker"

pass "CSS UX refinement markers found"

section "PHASE 21.1 STATUS MARKERS"
STATUS_FILE="docs/pharmaco/admin-home-ui-ux-audit-navigation-diagnostics/PHASE_21_1_ADMIN_HOME_UI_UX_AUDIT_NAVIGATION_DIAGNOSTICS_STATUS.env"
[ -f "${STATUS_FILE}" ] || fail "Missing Phase 21.1 status file"

grep -q "LEFT_MENU_INDEPENDENT_SCROLL_INCLUDED=YES" "${STATUS_FILE}" || fail "Missing left menu independent scroll status"
grep -q "HEADER_FIXED_OUTSIDE_WORKSPACE_SCROLL=YES" "${STATUS_FILE}" || fail "Missing fixed header status"
grep -q "TENANT_AWARE_MAIN_WEBSITE_ROUTING_INCLUDED=YES" "${STATUS_FILE}" || fail "Missing tenant-aware website routing status"
grep -q "SUPPLIER_PAYABLES_SOURCE_REFACTOR_INCLUDED=YES" "${STATUS_FILE}" || fail "Missing Payables source refactor status"
grep -q "PAYABLES_DENSE_SINGLE_PAGE_REPLACED=YES" "${STATUS_FILE}" || fail "Missing dense Payables replacement status"
grep -q "OPERATING_VIEW_CREDIT_RISK_READABILITY_REFINED=YES" "${STATUS_FILE}" || fail "Missing Operating View refinement status"

pass "Phase 21.1 status markers found"

section "PACKAGE AND PRODUCTION SAFETY"
if git status --short | grep -E '\.(zip|tar|tar\.gz|tgz|sha256|checksum)$'; then
  fail "Package/checksum artifact detected"
fi

if tracked_files | grep -E '(^database/|/database/|migrations/|\.env$|backend/|api/|routes/|app/Models/)'; then
  fail "Backend/database/environment files changed unexpectedly"
fi

pass "No package, checksum, backend, database, production, or environment changes detected"

section "ADMIN DASHBOARD BUILD"
npm --prefix web/admin-dashboard run build

pass "Admin dashboard build passed"

section "FINAL RESULT"
echo "PHASE 21.1 ADMIN HOME UI/UX AUDIT NAVIGATION DIAGNOSTICS CHECK PASSED"

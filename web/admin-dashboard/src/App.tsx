/* POS_SALES_ANALYTICS_VISIBLE_ENTRY_V1 */
import {
  InventoryWorkspaceFrame } from './components/InventoryWorkspaceFrame'; import { FormEvent,
  useEffect,
  useMemo,
  useState } from 'react';   type PosBatchProduct = PharmaStockBatch['product'] & {   selling_unit?: string | null;   base_unit?: string | null;   unit?: string | null;   quantity_per_selling_unit?: number | string | null;   allow_other_quantity?: boolean | null;   default_pos_quantity_mode?: string | null; };  type UbuzimaHandoverLiveAnalytics = PharmaLiveBusinessAnalyticsResponse | null;

function formatUbuzimaOperatorName(transaction: PharmaRecentTransactionWithUser | null | undefined): string {   const name = transaction?.operator_name?.trim();    if (name) {     return name;   }    const email = transaction?.operator_email?.trim();    if (email) {     return email;   }    return 'Recorded user'; }  function normalizeUbuzimaTransactionDate(value: string | null | undefined): string | null {   if (!value) {     return null;   }    const dateOnlyMatch = value.match(/^\d{4}-\d{2}-\d{2}/);    return dateOnlyMatch ? dateOnlyMatch[0] : value; }  function formatUbuzimaMoney(value: number | string | null | undefined): string {   const amount = Number(value ?? 0);    return `RWF ${(Number.isFinite(amount) ? amount : 0).toLocaleString('en-RW')}`; }  function printUbuzimaPosDocument(): void {   const nativePrint = window.print.bind(window);    document.body.classList.add('ubuzima-pos-print-mode');    window.setTimeout(() => {     nativePrint();      window.setTimeout(() => {       document.body.classList.remove('ubuzima-pos-print-mode');     },
  250);   },
  50); }  function configuredPosTaxMode(): 'inclusive' | 'exclusive' {   return 'inclusive'; }  type PosInventoryAutoLoaderProps = {   shouldLoad: boolean;   onLoad: () => void | Promise<void>; };  function PosInventoryAutoLoader({ shouldLoad,
  onLoad }: PosInventoryAutoLoaderProps) {   useEffect(() => {     if (!shouldLoad) {       return;     }      void onLoad();   },
  [onLoad,
  shouldLoad]);    return null; }  import { AccessCheckResult,
  AccessProfile,
  LoginExperience,
  BranchDepartmentsResponse,
  BranchesResponse,
  LoginResponse,
  PharmacyProfileResponse,
  PharmaStockBatch,
  TwoFactorSetupPayload,
  getAuthenticatedProfile,
  getBranchDepartments,
  getCorporateMailOverview,
  getPharmaBranches,
  getPharmaInventoryBatches,
  getPharmacyProfile,
  login,
  logout,
  requestPasswordReset,
  changePassword,
  runAccessCheck,
  verifyTwoFactor,
  getPharmaSales,
  type PharmaSale,
  type PharmaPayment,
  checkoutPharmaSale,
  getPharmaLiveBusinessAnalytics,
  getPharmaRecentTransactionsWithUsers,
  type PharmaLiveBusinessAnalyticsResponse,
  type PharmaRecentTransactionWithUser,
  getTenantSecurityRoleTemplates,
  getTenantSecurityUsers,
  createTenantSecurityUser,
  updateTenantSecurityUser,
  adminResetTenantSecurityUserPassword,
} from './lib/api';
import {
  type PosSession,
  closePosSession,
  getCurrentPosSession,
  openPosSession,
  zeroizePosSession,
} from './lib/posSessionApi';
import {
  getInsurancePartners,
  type InsurancePartner,
} from './lib/insuranceApi';
import { PharmaCoreEditor } from './components/PharmaCoreEditor';
import { ProductInventoryPreview, type InventoryView } from './components/ProductInventoryPreview';
import { InventoryModuleHome } from './components/InventoryModuleHome';
import {
  GeneralStockItemsModule,
} from './components/GeneralStockItemsModule';
import { ProductInventoryActions } from './components/ProductInventoryActions';
import { SalesDispensingReview } from './components/SalesDispensingReview';
import { HistoricalPosWorkflow } from './components/HistoricalPosWorkflow';
import { AdminManagementWorkspace } from './components/AdminManagementWorkspace';
import { SalesReturnsWorkspace } from './components/SalesReturnsWorkspace';
import { MomoReconciliationWorkspace } from './components/MomoReconciliationWorkspace';
import { PosSalesOverview } from './components/PosSalesOverview';
import { ModulePageNavigation } from './components/ModulePageNavigation';
import { PosModuleWorkspaceHeader } from './components/PosModuleWorkspaceHeader';
import { CustomerPrescriptionManagementWorkspace } from './components/CustomerPrescriptionManagementWorkspace';
import { WorkspacePopupFormManager } from './components/WorkspacePopupFormManager';
import { ProcurementWorkflow } from './components/ProcurementWorkflow';
import { ProcurementModuleHome } from './components/ProcurementModuleHome';
import { ProcurementSupplierWorkspace } from './components/ProcurementSupplierWorkspace';
import { ProcurementPurchaseOrderWorkspace } from './components/ProcurementPurchaseOrderWorkspace';
import { ProcurementReceivingWorkspace } from './components/ProcurementReceivingWorkspace';
import {
  GeneralItemsManagementWorkspace,
} from './components/GeneralItemsManagementWorkspace';
import { PayablesWorkflow } from './components/PayablesWorkflow';
import { ReportingDashboard } from './components/ReportingDashboard';
import { PharmacoOperationsCommandCenter } from './components/PharmacoOperationsCommandCenter';
import { TwoFactorAdminPanel } from './components/TwoFactorAdminPanel';
import { LoginSuccessOverlay } from './components/LoginSuccessOverlay';
import { PlatformManagementPanel } from './components/PlatformManagementPanel';
import { CorporateEmailPanel } from './components/CorporateEmailPanel';
import { PharmacistChatPanel } from './components/PharmacistChatPanel';
import { DataLayerAdminPanel } from './components/DataLayerAdminPanel';
import { AiOperationsPanel } from './components/AiOperationsPanel';
import { NotificationCenterPanel } from './components/NotificationCenterPanel';
import { MarketLocalizationPanel } from './components/MarketLocalizationPanel';
import { NearbyProvidersPanel } from './components/NearbyProvidersPanel';
import { TenantPharmacyDashboard } from './components/TenantPharmacyDashboard';
import { applyInputKeyboardModes } from './lib/formUsability';
import { RuntimeLanguage, applyRuntimeLanguage } from './lib/runtimeI18n';
import { calculatePosQuantity } from './lib/posQuantity';
import './styles.css';
import ReceivablesWorkflow from './components/ReceivablesWorkflow';
import { BusinessOverviewReviewPage } from './components/business-overview/BusinessOverviewReviewPage';
import {
  InsuranceManagementWorkspace,
  type InsuranceWorkspaceKey,
} from './components/InsuranceManagementWorkspace';
import {
  UbuzimaMobileApp,
  type UbuzimaMobileAppAction,
  type UbuzimaMobileAppMenuGroup,
  type UbuzimaMobileAppMetric,
  type UbuzimaMobileAppNavItem,
  type UbuzimaMobileAppScreen,
  type UbuzimaMobileAppWorkbench,
} from './components/UbuzimaMobileApp';

type StoredSession = {
  token: string;
  profile: AccessProfile;
};

type AccessCheckState = {
  label: string;
  result: AccessCheckResult;
} | null;

type TwoFactorFlowState = {
  status: 'two_factor_setup_required' | 'two_factor_challenge_required';
  message: string;
  challenge_token: string;
  expires_at: string;
  setup?: TwoFactorSetupPayload;
};

type PharmaCoreState = {
  profile: PharmacyProfileResponse | null;
  branches: BranchesResponse | null;
  departments: BranchDepartmentsResponse | null;
};

type AdminSectionKey =
  | 'overview'
  | 'erp'
  | 'solution-portfolio'
  | 'ai-center'
  | 'admin-panel'
  | 'admin-management'
  | 'inventory'
  | 'general-stock-items'
  | 'insurance'
  | 'pos'
  | 'suppliers'
  | 'finance'
  | 'reports'
  | 'tenant-setup'
  | 'security'
  | 'corporate-email'
  | 'pharmacist-chat'
  | 'notifications'
  | 'market-management'
  | 'localization'
  | 'nearby-providers'
  | 'vitapharma-website'
  | 'settings';

type MenuGroupKey = 'erp' | 'solutions' | 'ai' | 'admin' | 'tenant-ops' | 'tenant-admin' | 'market';
type ErpWorkspaceKey = 'erp-overview' | 'finance' | 'hr' | 'procurement' | 'projects' | 'customer-care';
type SolutionKey = 'pharmaco' | 'vetcore' | 'cliniccore' | 'insucore';
type PharmaSegmentKey = 'retail' | 'wholesale' | 'retail-procurement' | 'delivery' | 'insurance-clinic' | 'ai-insights';
type PharmaFeatureKey =
  | 'ai-model'
  | 'inventory'
  | 'pos'
  | 'product-master'
  | 'procurement'
  | 'prescriptions'
  | 'customers'
  | 'reports';
type AiWorkspaceKey =
  | 'operational-ai-center'
  | 'business-chat'
  | 'customer-retention'
  | 'demand-forecast'
  | 'expiry-risk'
  | 'finance-forecast'
  | 'fraud-anomaly'
  | 'pricing-margin'
  | 'reorder-recommendation'
  | 'stock-out'
  | 'supplier-performance'
  | 'inventory-assistance'
  | 'operations-copilot'
  | 'governance'
  | 'provider-management'
  | 'model-registry'
  | 'agent-management'
  | 'prompt-library'
  | 'knowledge-base'
  | 'data-connectors'
  | 'recommendations'
  | 'workflow-automation'
  | 'approval-center'
  | 'feedback-learning'
  | 'usage-cost'
  | 'risk-compliance'
  | 'audit-logs'
  | 'recommendation-approval-queue'
  | 'insights-dashboard'
  | 'chat-me-ai';
type AdminPanelWorkspaceKey =
  | 'user-profiles'
  | 'backend-api'
  | 'two-factor-auth'
  | 'platform-management'
  | 'notification-management'
  | 'corporate-email'
  | 'pharmacist-chat'
  | 'web-application'
  | 'mobile-application'
  | 'desktop-application'
  | 'data-layer'
  | 'infrastructure';
type PosWorkspaceKey =
  | 'overview'
  | 'pos'
  | 'dispensing-review'
  | 'customers'
  | 'prescriptions'
  | 'sales-performance'
  | 'payment-receipt';
type SupplierWorkspaceKey =
  | 'overview'
  | 'create-supplier'
  | 'supplier-list'
  | 'create-purchase-order'
  | 'outstanding-purchase-orders'
  | 'receive-purchase-order'
  | 'received-purchase-orders'
  | 'general-items-overview'
  | 'general-item-categories'
  | 'general-item-master'
  | 'general-item-stock'
  | 'general-item-receiving'
  | 'general-item-usage';
type FinanceWorkspaceKey =
  | 'overview'
  | 'finance-flow'
  | 'exception-focus'
  | 'credits-receivables'
  | 'receivable-register'
  | 'collection'
  | 'financial-statements';
type AdhocReportWorkspaceKey =
  | 'overview'
  | 'operation-alerts'
  | 'review-queues'
  | 'executive-summary'
  | 'decision-note'
  | 'operation-checklist'
  | 'priority-follow-up';
const adminStateStorageKey = 'ubuzima.admin.state.v1';

function storedAdminState(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(adminStateStorageKey) || '{}');
  } catch {
    return {};
  }
}

function rememberAdminState(key: string, value: string): void {
  try {
    sessionStorage.setItem(
      adminStateStorageKey,
      JSON.stringify({
        ...storedAdminState(),
        [key]: value,
      }),
    );
    localStorage.setItem(`ubuzima.admin.${key}`, value);
  } catch {
    // Browser storage is optional.
  }
}

function storedAdminValue(key: string, fallback: string): string {
  return storedAdminState()[key] || localStorage.getItem(`ubuzima.admin.${key}`) || fallback;
}

function posPartnerCustomerContributionPercent(
  partner: InsurancePartner | null | undefined,
): number {
  const partnerRecord = partner as unknown as Record<string, unknown> | null;
  const rawMetadata = partnerRecord?.metadata;
  const metadata =
    rawMetadata && typeof rawMetadata === 'object'
      ? (rawMetadata as Record<string, unknown>)
      : {};

  const rawValue =
    metadata.customer_contribution_percent ??
    metadata.customerContributionPercent ??
    metadata.default_customer_contribution_percent ??
    metadata.defaultCustomerContributionPercent ??
    0;

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

type PosSaleSummary = {
  lineCount: number;
  totalQuantity: number;
  subtotal: number;
  discount: number;
  taxableBase: number;
  tax: number;
  customerContributionPercent: number;
  insuranceContributionPercent: number;
  insuranceContribution: number;
  customerContribution: number;
  total: number;
  calculatedAt: string;
};

function calculatePosSaleSummary(input: {
  cartItems: Array<{ quantity: number; unitPrice: number }>;
  discountAmount: string;
  paymentMethod: 'cash' | 'momo' | 'card' | 'insurance' | 'credit';
  insuranceProviderId: string;
  insuranceInstitutionId: string;
  insuranceCustomerContributionPercent?: number;
}): PosSaleSummary {

  const lineCount = input.cartItems.length;
  const totalQuantity = input.cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = input.cartItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = Math.min(Number(input.discountAmount || 0), subtotal);
  const taxableBase = Math.max(0, subtotal - discount);
  const tax = Math.round(taxableBase * 0.18);

  const customerContributionPercent =
    input.paymentMethod === 'insurance'
      ? Math.max(
          0,
          Math.min(
            100,
            Number(input.insuranceCustomerContributionPercent ?? 0),
          ),
        )
      : 100;

  const insuranceContributionPercent =
    input.paymentMethod === 'insurance' ? Math.max(0, 100 - customerContributionPercent) : 0;

  const insuranceContribution =
    input.paymentMethod === 'insurance'
      ? Math.round((taxableBase * insuranceContributionPercent) / 100)
      : 0;

  const customerContribution =
    input.paymentMethod === 'insurance'
      ? Math.max(0, taxableBase + tax - insuranceContribution)
      : Math.max(0, taxableBase + tax);

  return {
    lineCount,
    totalQuantity,
    subtotal,
    discount,
    taxableBase,
    tax,
    customerContributionPercent,
    insuranceContributionPercent,
    insuranceContribution,
    customerContribution,
    total: Math.max(0, taxableBase + tax),
    calculatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}



type HomeWidgetKey =
  | 'summary'
  | 'tenant-dashboard'
  | 'quick-actions'
  | 'system-experience'
  | 'role-workspaces';
type MenuContextKey = ErpWorkspaceKey | SolutionKey | AiWorkspaceKey | AdminPanelWorkspaceKey;
type LoginMethod = 'email' | 'phone';
type UbuzimaPwaInstallChangeEvent = CustomEvent<{ isAvailable: boolean }>;
type MobileBottomNavItem = {
  key: string;
  label: string;
  icon: string;
  section: AdminSectionKey;
  posWorkspace?: PosWorkspaceKey;
};

type MenuItem = {
  key: AdminSectionKey;
  label: string;
  description: string;
  icon: string;
  context?: MenuContextKey;
  status?: string;
};

type MenuGroup = { key: MenuGroupKey; label: string; icon: string; items: MenuItem[] };


type DashboardCardKey =
  | 'inventory'
  | 'pos'
  | 'finance'
  | 'suppliers'
  | 'communications'
  | 'ai-reports'
  | 'profile';

const dashboardCardVisibilityStorageKey = 'ubuzima_admin_dashboard_card_visibility';
const dashboardCardFieldVisibilityStorageKey = 'ubuzima_admin_dashboard_card_field_visibility';

const dashboardCardOptions: Array<{ key: DashboardCardKey; label: string }> = [
  { key: 'inventory', label: 'Inventory Control' },
  { key: 'pos', label: 'POS and Sales' },
  { key: 'finance', label: 'Finance Watch' },
  { key: 'suppliers', label: 'Procurement and Purchase Orders' },
  { key: 'communications', label: 'Communication Center' },
  { key: 'ai-reports', label: 'AI and Reports' },
  { key: 'profile', label: 'Profile and Access' },
];

const dashboardCardFieldOptions: Record<DashboardCardKey, Array<{ key: string; label: string }>> = {
  inventory: [
    { key: 'pages', label: 'Inventory pages' },
    { key: 'expiry', label: 'Expiry watch' },
    { key: 'permission', label: 'Permission status' },
  ],
  pos: [
    { key: 'pages', label: 'Sales pages' },
    { key: 'receipts', label: 'Receipt readiness' },
    { key: 'permission', label: 'POS access' },
  ],
  finance: [
    { key: 'pages', label: 'Finance pages' },
    { key: 'statements', label: 'AI statements' },
    { key: 'reconcile', label: 'Reconciliation' },
  ],
  suppliers: [
    { key: 'pages', label: 'Supplier pages' },
    { key: 'po', label: 'Purchase orders' },
    { key: 'permission', label: 'Permission status' },
  ],
  communications: [
    { key: 'unread', label: 'Unread email' },
    { key: 'channel', label: 'Official channel' },
    { key: 'alerts', label: 'Alert readiness' },
  ],
  'ai-reports': [
    { key: 'ai-tools', label: 'AI tools' },
    { key: 'report-pages', label: 'Report pages' },
    { key: 'permission', label: 'AI access' },
  ],
  profile: [
    { key: 'permissions', label: 'Permissions' },
    { key: 'scope', label: 'Scope' },
    { key: 'edit', label: 'Edit profile' },
  ],
};

const defaultDashboardCardVisibility: Record<DashboardCardKey, boolean> = {
  inventory: true,
  pos: true,
  finance: true,
  suppliers: true,
  communications: true,
  'ai-reports': true,
  profile: true,
};

const defaultDashboardCardFieldVisibility: Record<DashboardCardKey, Record<string, boolean>> =
  Object.fromEntries(
    dashboardCardOptions.map((card) => [
      card.key,
      Object.fromEntries(dashboardCardFieldOptions[card.key].map((field) => [field.key, true])),
    ]),
  ) as Record<DashboardCardKey, Record<string, boolean>>;

function loadStoredDashboardCardVisibility(): Record<DashboardCardKey, boolean> {
  try {
    const stored = localStorage.getItem(dashboardCardVisibilityStorageKey);
    if (!stored) return defaultDashboardCardVisibility;

    const parsed = JSON.parse(stored) as Partial<Record<DashboardCardKey, boolean>>;

    return {
      ...defaultDashboardCardVisibility,
      ...parsed,
    };
  } catch {
    return defaultDashboardCardVisibility;
  }
}

function loadStoredDashboardCardFieldVisibility(): Record<DashboardCardKey, Record<string, boolean>> {
  try {
    const stored = localStorage.getItem(dashboardCardFieldVisibilityStorageKey);
    if (!stored) return defaultDashboardCardFieldVisibility;

    const parsed = JSON.parse(stored) as Partial<Record<DashboardCardKey, Record<string, boolean>>>;

    return Object.fromEntries(
      dashboardCardOptions.map((card) => [
        card.key,
        {
          ...defaultDashboardCardFieldVisibility[card.key],
          ...(parsed[card.key] ?? {}),
        },
      ]),
    ) as Record<DashboardCardKey, Record<string, boolean>>;
  } catch {
    return defaultDashboardCardFieldVisibility;
  }
}


type LeftMenuAppearance = {
  primaryColor: string;
  titleColor: string;
  density: 'compact' | 'comfortable';
};

const leftMenuAppearanceStorageKey = 'ubuzima_admin_left_menu_appearance';

const defaultLeftMenuAppearance: LeftMenuAppearance = {
  primaryColor: '#4B5320',
  titleColor: '#ffffff',
  density: 'compact',
};

function loadStoredLeftMenuAppearance(): LeftMenuAppearance {
  try {
    const stored = localStorage.getItem(leftMenuAppearanceStorageKey);
    if (!stored) return defaultLeftMenuAppearance;

    const parsed = JSON.parse(stored) as Partial<LeftMenuAppearance>;

    return {
      primaryColor: parsed.primaryColor || defaultLeftMenuAppearance.primaryColor,
      titleColor: parsed.titleColor || defaultLeftMenuAppearance.titleColor,
      density: parsed.density === 'comfortable' ? 'comfortable' : 'compact',
    };
  } catch {
    return defaultLeftMenuAppearance;
  }
}


type LeftMenuSubmenu = {
  key: string;
  label: string;
  target?: string;
};

const leftMenuSubmenus: Partial<Record<AdminSectionKey, LeftMenuSubmenu[]>> = {
  inventory: [
    { key: 'inventory-overview', label: 'Overview Summary', target: 'overview' },
    { key: 'inventory-low-stock', label: 'Low Stock Watch List', target: 'low-stock' },
    { key: 'inventory-shelf', label: 'Retail Product Shelf', target: 'shelf' },
    { key: 'inventory-batches', label: 'Batch and Expiry Preview', target: 'batches' },
    { key: 'inventory-near-expiry', label: 'Near Expiry Watch List', target: 'near-expiry' },
    { key: 'inventory-product-master', label: 'Product Master', target: 'product-master' },
    { key: 'inventory-product-inventory', label: 'Product Inventory', target: 'product-inventory' },
    { key: 'inventory-locations', label: 'Stock Locations', target: 'locations' },
  ],
  insurance: [
    { key: 'insurance-overview', label: 'Insurance Overview', target: 'overview' },
    { key: 'insurance-partners', label: 'Insurance Partners', target: 'partners' },
    { key: 'insurance-price-lists', label: 'Price Lists', target: 'price-lists' },
    { key: 'insurance-product-prices', label: 'Product Prices', target: 'product-prices' },
    { key: 'insurance-contribution-rules', label: 'Contribution Rules', target: 'contribution-rules' },
    { key: 'insurance-claims', label: 'Claims', target: 'claims-readiness' },
    { key: 'insurance-reconciliation', label: 'Reconciliation', target: 'reconciliation-readiness' },
    { key: 'insurance-audit', label: 'Insurance Audit', target: 'audit-readiness' },
  ],
  pos: [
    { key: 'pos-overview', label: 'POS and Sales Overview', target: 'overview' },
    { key: 'pos-counter', label: 'POS Counter', target: 'pos' },
    { key: 'pos-dispensing', label: 'Pharmacist Review', target: 'dispensing-review' },
    { key: 'pos-customers', label: 'Customers and Patients', target: 'customers' },
    { key: 'pos-prescriptions', label: 'Prescriptions', target: 'prescriptions' },
    { key: 'pos-performance', label: 'Sales Register', target: 'sales-performance' },
    { key: 'pos-payment-receipt', label: 'Receipts & Payments', target: 'payment-receipt' },
  ],
  suppliers: [
    { key: 'supplier-overview', label: 'Procurement Overview', target: 'overview' },
    { key: 'supplier-create', label: 'Create Supplier', target: 'create-supplier' },
    { key: 'supplier-list', label: 'Supplier List', target: 'supplier-list' },
    { key: 'supplier-create-po', label: 'Create Purchase Order', target: 'create-purchase-order' },
    { key: 'supplier-outstanding-po', label: 'Outstanding Purchase Order List', target: 'outstanding-purchase-orders' },
    { key: 'supplier-receive-po', label: 'Receive Purchase Order', target: 'receive-purchase-order' },
    { key: 'supplier-received-po', label: 'Received Purchase Order List', target: 'received-purchase-orders' },
    { key: 'general-items-overview', label: 'General Items Overview', target: 'general-items-overview' },
    { key: 'general-item-categories', label: 'General Item Categories', target: 'general-item-categories' },
    { key: 'general-item-master', label: 'General Item Master', target: 'general-item-master' },
    { key: 'general-item-stock', label: 'General Item Stock', target: 'general-item-stock' },
    { key: 'general-item-receiving', label: 'General Item Receiving', target: 'general-item-receiving' },
    { key: 'general-item-usage', label: 'General Item Issues and Usage', target: 'general-item-usage' },
  ],
  finance: [
    { key: 'finance-overview', label: 'Finance Overview', target: 'overview' },
    { key: 'finance-flow', label: 'Finance Flow', target: 'finance-flow' },
    { key: 'finance-exception', label: 'Exception Focus', target: 'exception-focus' },
    { key: 'finance-credits-receivables', label: 'Customer Credits and Receivables', target: 'credits-receivables' },
    { key: 'finance-receivable-register', label: 'Receivable Register', target: 'receivable-register' },
    { key: 'finance-collection', label: 'Collection', target: 'collection' },
    { key: 'finance-statement', label: 'Financial Statement', target: 'financial-statements' },
  ],
  reports: [
    { key: 'adhoc-overview', label: 'Ad-hoc Report Overview', target: 'overview' },
    { key: 'adhoc-alerts', label: 'Operation Alerts', target: 'operation-alerts' },
    { key: 'adhoc-review-queues', label: 'Review Queues', target: 'review-queues' },
    { key: 'adhoc-executive-summary', label: 'Executive Operating Summary', target: 'executive-summary' },
    { key: 'adhoc-decision-note', label: 'Decision Note', target: 'decision-note' },
    { key: 'adhoc-checklist', label: 'Operation Checklist', target: 'operation-checklist' },
    { key: 'adhoc-priority-follow-up', label: 'Priority Follow-up and Manager Review Notes', target: 'priority-follow-up' },
  ],
  'ai-center': [
    { key: 'ai-governance', label: 'AI Governance', target: 'governance' },
    { key: 'ai-operational-center', label: 'Operational AI Center', target: 'operational-ai-center' },
    { key: 'ai-provider-management', label: 'AI Provider Management', target: 'provider-management' },
    { key: 'ai-model-registry', label: 'AI Model Registry', target: 'model-registry' },
    { key: 'ai-agent-management', label: 'AI Agent Management', target: 'agent-management' },
    { key: 'ai-prompt-library', label: 'AI Prompt Library', target: 'prompt-library' },
    { key: 'ai-knowledge-base', label: 'AI Knowledge Base', target: 'knowledge-base' },
    { key: 'ai-data-connectors', label: 'AI Data Connectors', target: 'data-connectors' },
    { key: 'ai-recommendations', label: 'AI Recommendations', target: 'recommendations' },
    { key: 'ai-workflow-automations', label: 'AI Workflow Automations', target: 'workflow-automation' },
    { key: 'ai-human-approval-center', label: 'AI Human Approval Center', target: 'approval-center' },
    { key: 'ai-feedback-learning', label: 'AI Feedback and Learning', target: 'feedback-learning' },
    { key: 'ai-usage-cost-quota', label: 'AI Usage, Cost and Quota Control', target: 'usage-cost' },
    { key: 'ai-risk-compliance', label: 'AI Risk and Compliance', target: 'risk-compliance' },
    { key: 'ai-audit-logs', label: 'AI Audit Logs', target: 'audit-logs' },
    { key: 'ai-recommendation-approval-queue', label: 'Recommendation Approval Queue', target: 'recommendation-approval-queue' },
    { key: 'ai-insight-dashboard', label: 'AI Insight Dashboard', target: 'insights-dashboard' },
    { key: 'ai-chat-me', label: 'Chat Me AI', target: 'chat-me-ai' },
  ],
  notifications: [
    { key: 'notification-overview', label: 'Notification Overview', target: 'overview' },
    { key: 'notification-create', label: 'Create New Notification', target: 'create-notification' },
    { key: 'notification-recurring', label: 'Manage Recurring Notifications', target: 'recurring-notifications' },
    { key: 'notification-center', label: 'Platform Notification Management Center', target: 'platform-notification-center' },
  ],
  'pharmacist-chat': [
    { key: 'chat-in-app', label: 'In-app Chat', target: 'in-app-chat' },
    { key: 'chat-whatsapp', label: 'WhatsApp Message Chats', target: 'whatsapp-chat' },
  ],
  'admin-panel': [
    { key: 'admin-users', label: 'User Profiles', target: 'user-profiles' },
    { key: 'admin-platform', label: 'Platform Management', target: 'platform-management' },
    { key: 'admin-notifications', label: 'Notification Management', target: 'notification-management' },
    { key: 'admin-email', label: 'Corporate Email', target: 'corporate-email' },
    { key: 'admin-chat', label: 'Pharmacist Chat', target: 'pharmacist-chat' },
    { key: 'admin-data', label: 'Data Layer', target: 'data-layer' },
  ],
};


const storageKey = 'ubuzima_admin_session';
const activeSectionStorageKey = 'ubuzima_admin_active_section';
const trustedDeviceStorageKey = 'ubuzima_admin_trusted_device_token';
const staffLanguageStorageKey = 'ubuzima_admin_language';
const adminAssetBaseUrl = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
const brandLogoSrc = `${adminAssetBaseUrl}assets/ubuzima-logo.png`;
const vitaPharmaLogoSrc = `${adminAssetBaseUrl}assets/vitapharma-logo.png`;
const staffLoginLanguages = ['English', 'French', 'Portuguese'] as const;
type StaffLoginLanguage = typeof staffLoginLanguages[number];

function mobileAppScreenForSection(section: AdminSectionKey): UbuzimaMobileAppScreen {
  if (section === 'overview') return 'business';
  if (section === 'pos' || section === 'finance') return 'sales';
  if (section === 'inventory') return 'inventory';
  if (section === 'suppliers') return 'procurement';
  if (section === 'general-stock-items') return 'general-stock';

  return 'more';
}

type SharedBusinessMetric = {
  valueText?: string;
  updatedAt?: number;
};

const sharedBusinessOverviewMetricStorageKey = 'ubuzimaSharedDashboardAnalyticsMetricsV1';

function readSharedBusinessMetric(labels: string[]): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(sharedBusinessOverviewMetricStorageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, SharedBusinessMetric>;
    const normalizedEntries = Object.entries(parsed).map(([key, metric]) => [
      key.toLowerCase(),
      metric,
    ] as const);

    for (const label of labels) {
      const normalizedLabel = label.toLowerCase();
      const exact = parsed[label] ?? normalizedEntries.find(([key]) => key === normalizedLabel)?.[1];

      if (exact?.valueText) {
        return exact.valueText;
      }

      const partial = normalizedEntries.find(([key]) =>
        key.includes(normalizedLabel) || normalizedLabel.includes(key),
      )?.[1];

      if (partial?.valueText) {
        return partial.valueText;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function staffLanguageCode(language: StaffLoginLanguage): RuntimeLanguage {
  if (language === 'French') return 'fr';
  if (language === 'Portuguese') return 'pt';
  return 'en';
}

function readStoredStaffLanguage(): StaffLoginLanguage {
  const stored = localStorage.getItem(staffLanguageStorageKey);

  return staffLoginLanguages.includes(stored as StaffLoginLanguage)
    ? (stored as StaffLoginLanguage)
    : 'English';
}


const commercialFramework = [
  {
    family: 'Platform core',
    state: 'Foundation active',
    modules: [
      'Tenancy',
      'Admin scopes',
      'Roles and permissions',
      'Module registry',
      'Audit logs',
      'Configuration',
      'Support access',
    ],
  },
  {
    family: 'Operations 360 View',
    state: 'Pilot active',
    modules: [
      'Profile and branches',
      'Product master',
      'Inventory',
      'Sales and dispensing',
      'Procurement',
      'Payables',
      'Receivables',
      'Ad-hoc Report',
    ],
  },
  {
    family: 'Growth modules',
    state: 'Progressive activation',
    modules: [
      'Customer engagement',
      'Wholesale catalog',
      'Retail procurement',
      'Delivery dispatch',
      'Insurance claims',
      'Clinic integration',
      'Finance exports',
    ],
  },
  {
    family: 'Ubuzima AI Center',
    state: 'Controlled',
    modules: [
      'AI governance',
      'Provider registry',
      'Model registry',
      'AI agents',
      'Approval center',
      'Usage and cost',
      'AI audit logs',
    ],
  },
];

const viewFramework = [
  ['Ubuzima+ Admin 360', 'Tenants, solutions, modules, security, support, billing, platform health, and aggregated insights.'],
  ['Solution Admin 360', 'Tenant operations, onboarding, workflow templates, module usage, AI performance, and solution alerts.'],
  ['Tenant Admin 360', 'VitaPharma branches, users, modules, sales, stock, suppliers, finance, customer risk, and AI insights.'],
  ['Branch 360', 'Branch stock, POS activity, cashier sessions, daily close, expiry risk, low stock, and local alerts.'],
  ['Product 360', 'Batches, expiry, purchases, sales history, supplier options, margin, forecast, and reorder advice.'],
  ['Supplier 360', 'Catalog, purchase orders, invoices, payment status, delivery performance, and demand opportunities.'],
  ['Customer 360', 'Customer profile, prescriptions, credit exposure, refill history, communication, and follow-up notes.'],
  ['AI 360', 'Models, agents, tasks, recommendations, approvals, feedback, usage, cost, risk, and audit logs.'],
];

const channelReadiness = [
  ['Public website', 'Repositioned for commercial lead capture and solution discovery.'],
  ['Admin dashboard', 'Current working control center with live tenant operation modules.'],
  ['Tenant portal', 'Next framework for VitaPharma setup, package, branding, and onboarding.'],
  ['Mobile app', 'Future manager alerts, approvals, delivery tasks, and stock summaries.'],
  ['Desktop/PWA POS', 'Future counter-optimized sales, barcode, receipt, and installable POS flow.'],
];

const experienceBlueprint = [
  {
    lane: 'Operate',
    outcome: 'Make daily pharmacy work faster, safer, and easier to supervise.',
    modules: ['POS and dispensing', 'Inventory', 'Product master', 'Branches', 'Daily close'],
    signal: 'Active core',
  },
  {
    lane: 'Control',
    outcome: 'Keep finance, access, risk, and approvals visible without slowing operators.',
    modules: ['Roles', 'Audit logs', 'Payables', 'Receivables', 'Ad-hoc Report', 'AI approvals'],
    signal: 'Governed',
  },
  {
    lane: 'Grow',
    outcome: 'Prepare tenants for wholesale, customer engagement, delivery, and partner channels.',
    modules: ['Wholesale', 'Customer engagement', 'Delivery', 'Insurance', 'Clinic integration'],
    signal: 'Progressive',
  },
  {
    lane: 'Connect',
    outcome: 'Give each user the right channel for the job across web, mobile, desktop POS, and API integrations.',
    modules: ['Public website', 'Tenant portal', 'Mobile app', 'PWA POS', 'Partner APIs'],
    signal: 'Framework ready',
  },
];

const workspaceModel = [
  ['Platform admin', 'Tenants, packages, security, support, billing, AI governance, and platform health.'],
  ['Solution admin', 'Operations templates, tenant readiness, module adoption, ad-hoc reports, and support oversight.'],
  ['Tenant admin', 'Branches, users, modules, finance visibility, sales, stock, suppliers, and local policy.'],
  ['Branch manager', 'Daily close, stock movement, cashier activity, expiry risk, transfers, and local alerts.'],
  ['Counter team', 'Fast POS, barcode search, prescription checks, receipt, payment, and controlled dispensing.'],
  ['AI steward', 'Agents, recommendations, approvals, usage, risk, feedback, and audit trail.'],
];

const sectionMeta: Record<AdminSectionKey, { title: string; eyebrow: string; description: string }> = {
  overview: {
    eyebrow: 'Authenticated workspace',
    title: 'Operating dashboard',
    description: 'A compact control room for the active tenant, role scope, and priority modules.',
  },
  erp: {
    eyebrow: 'ERP Module',
    title: 'Enterprise resource planning',
    description: 'Finance, HR, procurement, projects, customer care, approvals, and shared business controls.',
  },
  'solution-portfolio': {
    eyebrow: 'Solution Portfolio',
    title: 'Ubuzima+ solution portfolio',
    description: 'Sector-specific solutions, with PharmaCore 360 active and future solutions clearly marked by readiness.',
  },
  'ai-center': {
    eyebrow: 'Governed AI module',
    title: 'AI Center review workspace',
    description: 'Document extraction, reconciliation, recommendations, approvals, and audit-first AI operations.',
  },
  'admin-panel': {
    eyebrow: 'Admin Panel',
    title: 'Platform administration architecture',
    description: 'Backend API, web, mobile, desktop, data layer, and infrastructure readiness for controlled deployment.',
  },
  'admin-management': {
    eyebrow: 'Governed tenant administration',
    title: 'Admin Management',
    description: 'User security, administrator support, POS session controls, audit-ready privileges, and future administrative capabilities.',
  },
  inventory: {
    eyebrow: 'Inventory and product control',
    title: 'Inventory command workspace',
    description: 'Batch, expiry, FEFO, stock movement, receiving, and shelf-readiness workflows.',
  },
  insurance: {
    eyebrow: 'Insurance operations',
    title: 'Insurance Management',
    description: 'Partners, schemes, pricing, claims and reconciliation',
  },
  pos: {
    eyebrow: 'POS and dispensing',
    title: 'Pharmacy POS workspace',
    description: 'Teller sessions, fast sales, prescription checks, payments, supervisor controls, and till closure.',
  },
  suppliers: {
    eyebrow: 'Procurement',
    title: 'Procurement and wholesale operations',
    description: 'Supplier setup, wholesale pharmacy readiness, purchase orders, receiving, and dispatch preparation.',
  },
  finance: {
    eyebrow: 'Finance operations',
    title: 'Payables and receivables',
    description: 'Procurement invoices, payments, customer credit, collections, and finance visibility.',
  },
  reports: {
    eyebrow: 'Ad-hoc Report and command view',
    title: 'Ad-hoc Report and executive review',
    description: 'Stock valuation, sales, procurement, payables, credit exposure, operating alerts, and daily management review.',
  },
  'tenant-setup': {
    eyebrow: 'Tenant and branch setup',
    title: 'Operations 360 tenant configuration',
    description: 'Business profile, branches, departments, capabilities, operating hours, and local setup.',
  },
  security: {
    eyebrow: 'POS and Sales Operations',
    title: 'Counter, dispensing, customers, prescriptions, receipts, and sales control',
    description: 'Resolved permissions, access checks, tenant assignments, audit posture, and protected modules.',
  },
  'corporate-email': {
    eyebrow: 'Corporate Email',
    title: 'Company mailbox workspace',
    description: 'Outlook-style email access prepared for company mail provider integration.',
  },
  'pharmacist-chat': {
    eyebrow: 'Pharmacist Chat',
    title: 'Customer pharmacist conversations',
    description: 'Mobile app customer conversations routed to authorized pharmacists and tenant staff.',
  },
  notifications: {
    eyebrow: 'Notification Center',
    title: 'In-app communication and SMS-ready notices',
    description: 'Publish operational messages to platform, market, and tenant audiences.',
  },
  'market-management': {
    eyebrow: 'Market Management',
    title: 'Market onboarding and tenant availability',
    description: 'Assign tenants to markets and prepare customer discovery by market and service radius.',
  },
  localization: {
    eyebrow: 'Localization',
    title: 'Language, region, and access context',
    description: 'Support English, French, and Portuguese with market-aware default language behavior.',
  },
  'nearby-providers': {
    eyebrow: 'Nearby Providers',
    title: 'Customer service-provider discovery',
    description: 'Preview nearby pharmacy, clinic, and partner recommendations for the mobile app.',
  },
  'vitapharma-website': {
    eyebrow: 'Tenant Website',
    title: 'VitaPharma public website',
    description: 'First-tenant public website surface integrated with Ubuzima+ tenant operations.',
  },
  settings: {
    eyebrow: 'System framework',
    title: 'Platform settings blueprint',
    description: 'Module activation, offline policy, channels, integration placeholders, and deployment readiness.',
  },

  'general-stock-items': {
    eyebrow: 'Operational stock control',
    title: 'General Stock Items',
    description: 'Monitor operational supplies, shortages, stock cover and replenishment separately from pharmacy inventory.',
  },
};

const menuGroups: MenuGroup[] = [
  {
    key: 'erp',
    label: 'ERP Module',
    icon: 'ERP',
    items: [
      { key: 'erp', context: 'erp-overview', label: 'ERP Overview', description: 'Shared business control layer', icon: 'ER', status: 'Framework' },
      { key: 'erp', context: 'finance', label: 'Finance', description: 'Payables, receivables, close', icon: 'FN', status: 'Live' },
      { key: 'erp', context: 'hr', label: 'HR', description: 'People, shifts, performance', icon: 'HR', status: 'Coming soon' },
      { key: 'erp', context: 'procurement', label: 'Procurement', description: 'Purchasing and approvals', icon: 'PR', status: 'Live' },
      { key: 'erp', context: 'projects', label: 'Projects', description: 'Rollouts and implementation', icon: 'PJ', status: 'Planned' },
      { key: 'erp', context: 'customer-care', label: 'Customer Care', description: 'Support, SLA, escalations', icon: 'CC', status: 'Planned' },
    ],
  },
  {
    key: 'solutions',
    label: 'Solution Portfolio',
    icon: 'SOL',
    items: [
      { key: 'solution-portfolio', context: 'pharmaco', label: 'PharmaCore 360', description: 'Retail and wholesale pharmacy', icon: 'PH', status: 'Active' },
      { key: 'solution-portfolio', context: 'vetcore', label: 'VetCore 360', description: 'Veterinary practice ecosystem', icon: 'VT', status: 'Coming soon' },
      { key: 'solution-portfolio', context: 'cliniccore', label: 'ClinicCore 360', description: 'Clinic operations suite', icon: 'CL', status: 'Coming soon' },
      { key: 'solution-portfolio', context: 'insucore', label: 'InsuCore 260', description: 'Insurance partner operations', icon: 'IN', status: 'Coming soon' },
    ],
  },
  {
    key: 'ai',
    label: 'AI Center',
    icon: 'AI',
    items: [
      { key: 'ai-center', context: 'governance', label: 'AI Governance', description: 'Policies and approval rules', icon: 'GV', status: 'Controlled' },
      { key: 'ai-center', context: 'provider-management', label: 'Provider Management', description: 'Provider keys and status', icon: 'PV' },
      { key: 'ai-center', context: 'model-registry', label: 'AI Model Registry', description: 'Models, versions, risk', icon: 'MD', status: 'Priority' },
      { key: 'ai-center', context: 'agent-management', label: 'AI Agents', description: 'Inventory, sales, support', icon: 'AG' },
      { key: 'ai-center', context: 'prompt-library', label: 'Prompt Library', description: 'Approved instructions', icon: 'PL' },
      { key: 'ai-center', context: 'knowledge-base', label: 'Knowledge Base', description: 'SOPs and trusted content', icon: 'KB' },
      { key: 'ai-center', context: 'data-connectors', label: 'Data Connectors', description: 'Sales, stock, ERP links', icon: 'DC' },
      { key: 'ai-center', context: 'recommendations', label: 'Recommendations', description: 'Structured advisory queue', icon: 'RC' },
      { key: 'ai-center', context: 'workflow-automation', label: 'Workflow Automation', description: 'Draft tasks and reminders', icon: 'WA' },
      { key: 'ai-center', context: 'approval-center', label: 'Approval Center', description: 'Human review queue', icon: 'AP', status: 'Priority' },
      { key: 'ai-center', context: 'feedback-learning', label: 'Feedback', description: 'Accepted/rejected learning', icon: 'FB' },
      { key: 'ai-center', context: 'usage-cost', label: 'Usage and Cost', description: 'Quota and monthly limits', icon: 'UC' },
      { key: 'ai-center', context: 'risk-compliance', label: 'Risk Compliance', description: 'Sensitive data and policy', icon: 'RK' },
      { key: 'ai-center', context: 'audit-logs', label: 'AI Audit Logs', description: 'Inputs, outputs, approvals', icon: 'AL' },
      { key: 'ai-center', context: 'insights-dashboard', label: 'AI Insights', description: 'Operational AI signals', icon: 'ID' },
    ],
  },
  {
    key: 'admin',
    label: 'Admin Panel',
    icon: 'ADM',
    items: [
      { key: 'admin-panel', context: 'user-profiles', label: 'User Profiles', description: 'Create, edit, deactivate users', icon: 'US', status: 'Active' },
      { key: 'admin-panel', context: 'backend-api', label: 'Backend API', description: 'Laravel API and services', icon: 'BE', status: 'Active' },
      { key: 'admin-panel', context: 'platform-management', label: 'Platform Management', description: 'Website, pages, sections', icon: 'PM', status: 'Active' },
      { key: 'admin-panel', context: 'notification-management', label: 'Notification Management', description: 'Recurring and platform notices', icon: 'NM', status: 'Active' },
      { key: 'admin-panel', context: 'corporate-email', label: 'Corporate Email', description: 'Company mailbox workspace', icon: 'EM', status: 'Active' },
      { key: 'admin-panel', context: 'pharmacist-chat', label: 'Pharmacist Chat', description: 'Mobile customer queue', icon: 'CH', status: 'Active' },
      { key: 'notifications', label: 'Notification Center', description: 'In-app and SMS-ready notices', icon: 'NT', status: 'Active' },
      { key: 'market-management', label: 'Market Management', description: 'Markets and tenant assignment', icon: 'MK', status: 'Active' },
      { key: 'localization', label: 'Localization', description: 'Language and market policy', icon: 'LG', status: 'Active' },
      { key: 'nearby-providers', label: 'Nearby Providers', description: 'Customer provider discovery', icon: 'NP', status: 'Active' },
      { key: 'vitapharma-website', label: 'VitaPharma Website', description: 'First tenant public site', icon: 'VP', status: 'Active' },
      { key: 'admin-panel', context: 'web-application', label: 'Web Application', description: 'Public and staff web apps', icon: 'WEB', status: 'Active' },
      { key: 'admin-panel', context: 'mobile-application', label: 'Mobile Application', description: 'Manager and field apps', icon: 'MOB', status: 'Planned' },
      { key: 'admin-panel', context: 'desktop-application', label: 'Desktop Application', description: 'Installable POS/PWA', icon: 'DSK', status: 'Planned' },
      { key: 'admin-panel', context: 'data-layer', label: 'Data Layer', description: 'Tenancy, audit, modules', icon: 'DB', status: 'Active' },
      { key: 'admin-panel', context: 'infrastructure', label: 'Infrastructure', description: 'Deployment and operations', icon: 'INF', status: 'Framework' },
    ],
  },
];

function hasAnyPermission(profile: AccessProfile | undefined, permissions: string[]): boolean {
  if (!profile) return false;
  return permissions.some((permission) => profile!.permissions.includes(permission));
}


function canManagePosSessions(profile: AccessProfile | undefined): boolean {
  return hasAnyPermission(profile, [
    'pharmaco.pos.sessions.manage',
    'pharmaco.pos.session.manage',
    'pharmaco.pos.session.admin',
    'pharmaco.pos.session.view',
    'pharmaco.pos.admin',
    'pos.sessions.manage',
    'pos.session.manage',
    'pos.session.admin',
    'pos.session.view',
    'tenant.admin',
    'tenant.users.manage',
    'platform.admin',
  ]);
}

function canOpenHistoricalPos(profile: AccessProfile | undefined): boolean {
  return hasAnyPermission(profile, [
    'pharmaco.pos.historical.open',
    'pharmaco.pos.historical.create',
    'pharmaco.pos.historical.record',
    'pharmaco.pos.historical.request',
    'historical.pos.open',
    'historical.pos.create',
    'historical.pos.record',
    'pos.historical.open',
    'pos.historical.create',
    'pos.historical.record',
    'pos.historical.request',
    'pharmaco.pos.session.open',
    'pos.session.open',
    'pharmaco.pos.use',
  ]);
}

const granularMenuPermissionMap: Record<string, string[]> = {
  'erp:erp-overview': ['erp.dashboard.view'],
  'erp:finance': ['finance.dashboard.view', 'finance.payables.view', 'finance.receivables.view'],
  'erp:hr': ['hr.staff.view'],
  'erp:procurement': ['procurement.purchases.view', 'procurement.suppliers.view'],
  'erp:projects': ['projects.projects.view'],
  'erp:customer-care': ['customer_care.tickets.view'],

  'solution-portfolio:pharmaco': ['solutions.pharmaco.view'],
  'solution-portfolio:vetcore': ['solutions.vetcore.view'],
  'solution-portfolio:cliniccore': ['solutions.cliniccore.view'],
  'solution-portfolio:insucore': ['solutions.insucore.view'],

  'ai-center:governance': ['ai.governance.view'],
  'ai-center:provider-management': ['ai.providers.view'],
  'ai-center:model-registry': ['ai.models.view'],
  'ai-center:agent-management': ['ai.agents.view'],
  'ai-center:prompt-library': ['ai.prompts.view'],
  'ai-center:knowledge-base': ['ai.knowledge_base.view'],
  'ai-center:data-connectors': ['ai.data_connectors.view'],
  'ai-center:recommendations': ['ai.recommendations.view'],
  'ai-center:workflow-automation': ['ai.workflow_automation.view'],
  'ai-center:approval-center': ['ai.approvals.view'],
  'ai-center:feedback-learning': ['ai.feedback.view'],
  'ai-center:usage-cost': ['ai.usage_cost.view'],
  'ai-center:risk-compliance': ['ai.risk_compliance.view'],
  'ai-center:audit-logs': ['ai.audit_logs.view'],
  'ai-center:insights-dashboard': ['ai.insights.view'],

  'admin-panel:user-profiles': ['users.staff.view'],
  'admin-panel:backend-api': ['platform.backend.view'],
  'admin-panel:two-factor-auth': ['security.two_factor.view'],
  'admin-panel:platform-management': ['platform.management.view'],
  'admin-panel:notification-management': ['communications.notifications.view'],
  'admin-panel:corporate-email': ['communications.email.view'],
  'admin-panel:pharmacist-chat': ['communications.chat.view'],
  'admin-panel:web-application': ['platform.web_application.view'],
  'admin-panel:mobile-application': ['platform.mobile_application.view'],
  'admin-panel:desktop-application': ['platform.desktop_application.view'],
  'admin-panel:data-layer': ['platform.data_layer.view'],
  'admin-panel:infrastructure': ['platform.infrastructure.view'],

  inventory: [
    'pharmaco.inventory.view',
    'pharmaco.product_master.view',
    'inventory.dashboard.view',
    'inventory.products.view',
    'inventory.batches.view',
    'inventory.receiving.view',
    'inventory.locations.view',
    'inventory.low_stock.view',
    'inventory.expiry_review.view',
    'inventory.table_settings.view',
    'inventory.expiry_labels.view',
  ],
  insurance: [
    'insurance.dashboard.view',
    'insurance.configuration.view',
    'insurance.memberships.view',
    'insurance.eligibility.check',
    'insurance.claims.view',
    'insurance.reconciliation.view',
    'insurance.audit.view',
    'pharmaco.insurance.manage',
  ],
  pos: [
    'pharmaco.pos.use',
    'pharmaco.sales.view',
    'pharmaco.sales.create',
    'pos.sales.view',
    'pos.receipts.view',
    'pos.returns.view',
    'pos.cashier_close.view',
    'pos.insurance.view',
    'pos.payments.view',
  ],
  suppliers: [
    'procurement.suppliers.view',
    'procurement.purchase_orders.view',
    'procurement.receiving.view',
    'procurement.dispatch.view',
  ],
  finance: [
    'finance.dashboard.view',
    'finance.payables.view',
    'finance.receivables.view',
    'finance.payments.view',
    'finance.reconciliation.view',
  ],
  reports: [
    'reports.inventory.view',
    'reports.sales.view',
    'reports.finance.view',
    'reports.procurement.view',
    'reports.audit.view',
  ],
  'tenant-setup': [
    'tenant.profile.view',
    'tenant.branches.view',
    'tenant.departments.view',
    'tenant.capabilities.view',
  ],
  'admin-management': [
    'users.staff.view',
    'security.users.view',
    'security.roles.view',
    'security.permissions.view',
    'security.audit.view',
    'security.two_factor.view',
    'pos.session_support.view',
    'pos.session_support.edit',
    'pharmaco.pos.session.reset',
    'roles.manage',
    'tenant.roles.manage',
  ],
  security: [
    'users.staff.view',
    'security.users.view',
    'security.roles.view',
    'security.permissions.view',
    'security.audit.view',
    'security.two_factor.view',
  ],
  'corporate-email': ['communications.email.view'],
  'pharmacist-chat': ['communications.chat.view'],
  notifications: ['communications.notifications.view'],
  'market-management': ['markets.management.view'],
  localization: ['settings.localization.view'],
  'nearby-providers': ['markets.providers.view'],
  'vitapharma-website': ['tenant.website.view'],
  settings: ['settings.platform.view'],
};

const granularLeftSubmenuPermissionMap: Record<string, Record<string, string[]>> = {
  inventory: {
    overview: ['inventory.dashboard.view'],
    dashboard: ['inventory.dashboard.view'],
    'inventory-dashboard': ['inventory.dashboard.view'],
    'product-master': ['inventory.products.view'],
    products: ['inventory.products.view'],
    'product-inventory': ['inventory.batches.view'],
    batches: ['inventory.batches.view'],
    'receive-stock': ['inventory.receiving.view'],
    receiving: ['inventory.receiving.view'],
    'stock-locations': ['inventory.locations.view'],
    locations: ['inventory.locations.view'],
    'low-stock': ['inventory.low_stock.view'],
    'batch-expiry': ['inventory.expiry_review.view'],
    'expiry-review': ['inventory.expiry_review.view'],
    'near-expiry': ['inventory.expiry_review.view'],
    'table-settings': ['inventory.table_settings.view'],
    'expiry-labels': ['inventory.expiry_labels.view'],
  },
  insurance: {
    overview: ['insurance.dashboard.view', 'pharmaco.insurance.manage'],
    partners: ['insurance.configuration.view', 'pharmaco.insurance.manage'],
    institutions: ['insurance.configuration.view', 'pharmaco.insurance.manage'],
    schemes: ['insurance.configuration.view', 'pharmaco.insurance.manage'],
    'price-lists': ['insurance.configuration.view', 'pharmaco.insurance.manage'],
    'product-prices': ['insurance.configuration.view', 'pharmaco.insurance.manage'],
    'contribution-rules': ['insurance.configuration.view', 'pharmaco.insurance.manage'],
    'claims-readiness': ['insurance.claims.view', 'pharmaco.insurance.manage'],
    'reconciliation-readiness': ['insurance.reconciliation.view', 'pharmaco.insurance.manage'],
    'audit-readiness': ['insurance.audit.view', 'pharmaco.insurance.manage'],
  },
  pos: {
    overview: ['pos.sales.view'],
    dashboard: ['pos.sales.view'],
    sales: ['pos.sales.view'],
    'sales-register': ['pos.sales.view'],
    receipts: ['pos.receipts.view'],
    returns: ['pos.returns.view'],
    payments: ['pos.payments.view'],
    insurance: ['pos.insurance.view'],
    'cashier-close': ['pos.cashier_close.view'],
    'daily-close': ['pos.cashier_close.view'],
  },
  suppliers: {
    overview: ['procurement.suppliers.view'],
    suppliers: ['procurement.suppliers.view'],
    'purchase-orders': ['procurement.purchase_orders.view'],
    receiving: ['procurement.receiving.view'],
    dispatch: ['procurement.dispatch.view'],
  },
  finance: {
    overview: ['finance.dashboard.view'],
    dashboard: ['finance.dashboard.view'],
    payables: ['finance.payables.view'],
    receivables: ['finance.receivables.view'],
    payments: ['finance.payments.view'],
    reconciliation: ['finance.reconciliation.view'],
  },
  reports: {
    overview: ['reports.inventory.view', 'reports.sales.view', 'reports.finance.view'],
    inventory: ['reports.inventory.view'],
    sales: ['reports.sales.view'],
    finance: ['reports.finance.view'],
    procurement: ['reports.procurement.view'],
    audit: ['reports.audit.view'],
  },
  'ai-center': {
    governance: ['ai.governance.view'],
    'provider-management': ['ai.providers.view'],
    'model-registry': ['ai.models.view'],
    'agent-management': ['ai.agents.view'],
    'prompt-library': ['ai.prompts.view'],
    'knowledge-base': ['ai.knowledge_base.view'],
    'data-connectors': ['ai.data_connectors.view'],
    recommendations: ['ai.recommendations.view'],
    'workflow-automation': ['ai.workflow_automation.view'],
    'approval-center': ['ai.approvals.view'],
    'feedback-learning': ['ai.feedback.view'],
    'usage-cost': ['ai.usage_cost.view'],
    'risk-compliance': ['ai.risk_compliance.view'],
    'audit-logs': ['ai.audit_logs.view'],
    'insights-dashboard': ['ai.insights.view'],
  },
  'admin-panel': {
    'user-profiles': ['users.staff.view'],
    'two-factor-auth': ['security.two_factor.view'],
    'platform-management': ['platform.management.view'],
    'notification-management': ['communications.notifications.view'],
    'corporate-email': ['communications.email.view'],
    'pharmacist-chat': ['communications.chat.view'],
    'data-layer': ['platform.data_layer.view'],
    'backend-api': ['platform.backend.view'],
    'web-application': ['platform.web_application.view'],
    'mobile-application': ['platform.mobile_application.view'],
    'desktop-application': ['platform.desktop_application.view'],
    infrastructure: ['platform.infrastructure.view'],
  },
  notifications: {
    overview: ['communications.notifications.view'],
    'create-notification': ['communications.notifications.add'],
    'recurring-notifications': ['communications.notifications.edit'],
    'platform-notification-center': ['communications.notifications.view'],
  },
  'pharmacist-chat': {
    'in-app-chat': ['communications.chat.view'],
    'whatsapp-chat': ['communications.chat.view'],
  },
};

function normalizePermissionKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const operationalPermissionAliases: Record<string, string[]> = {
  'tenant.dashboard.view': [
    'dashboard.view',
  ],

  'pharmaco.pos.use': [
    'pos.sales.view',
    'pos.receipts.view',
    'pos.payments.view',
    'pos.cashier_close.view',
  ],
  'pharmaco.pos.open_session': [
    'pos.sales.view',
    'pos.sales.add',
    'pos.cashier_close.view',
    'pos.cashier_close.add',
  ],
  'pharmaco.pos.close_session': [
    'pos.cashier_close.view',
    'pos.cashier_close.edit',
  ],
  'pharmaco.pos.session.reset': [
    'pos.session_support.view',
    'pos.session_support.edit',
  ],

  'pharmaco.sales.view': [
    'pos.sales.view',
    'pos.receipts.view',
    'pos.returns.view',
    'pos.payments.view',
    'reports.sales.view',
  ],
  'pharmaco.sales.create': [
    'pos.sales.view',
    'pos.sales.add',
    'pos.receipts.view',
    'pos.receipts.add',
    'pos.payments.view',
    'pos.payments.add',
  ],
  'pharmaco.sales.manage': [
    'pos.sales.view',
    'pos.sales.add',
    'pos.sales.edit',
    'pos.receipts.view',
    'pos.receipts.add',
    'pos.returns.view',
    'pos.returns.add',
    'pos.returns.edit',
    'pos.payments.view',
    'pos.payments.add',
    'pos.payments.edit',
    'pos.cashier_close.view',
    'pos.cashier_close.add',
    'pos.cashier_close.edit',
    'reports.sales.view',
  ],
  'pharmaco.sales.return': [
    'pos.returns.view',
    'pos.returns.add',
  ],
  'pharmaco.sales.receipt.reprint': [
    'pos.receipts.view',
    'pos.receipts.add',
  ],
  'pharmaco.customers.view': [
    'pos.customers.view',
  ],

  'pharmaco.inventory.view': [
    'inventory.dashboard.view',
    'inventory.products.view',
    'inventory.batches.view',
    'inventory.locations.view',
    'inventory.low_stock.view',
    'inventory.expiry_review.view',
    'inventory.table_settings.view',
    'inventory.expiry_labels.view',
    'reports.inventory.view',
  ],
  'pharmaco.inventory.manage': [
    'inventory.dashboard.view',
    'inventory.products.view',
    'inventory.products.add',
    'inventory.products.edit',
    'inventory.batches.view',
    'inventory.batches.add',
    'inventory.batches.edit',
    'inventory.receiving.view',
    'inventory.receiving.add',
    'inventory.locations.view',
    'inventory.locations.add',
    'inventory.locations.edit',
    'inventory.low_stock.view',
    'inventory.expiry_review.view',
    'inventory.expiry_review.edit',
    'inventory.table_settings.view',
    'inventory.table_settings.edit',
    'inventory.expiry_labels.view',
    'inventory.expiry_labels.add',
    'reports.inventory.view',
  ],
  'pharmaco.product_master.view': [
    'inventory.products.view',
  ],
  'pharmaco.product_master.manage': [
    'inventory.products.view',
    'inventory.products.add',
    'inventory.products.edit',
    'inventory.products.delete',
  ],
  'pharmaco.products.manage': [
    'inventory.products.view',
    'inventory.products.add',
    'inventory.products.edit',
    'inventory.products.delete',
  ],
  'pharmaco.product_inventory.receive': [
    'inventory.receiving.view',
    'inventory.receiving.add',
    'inventory.batches.view',
    'inventory.batches.add',
  ],
  'pharmaco.product_inventory.update': [
    'inventory.batches.view',
    'inventory.batches.edit',
  ],
  'pharmaco.inventory.low_stock.view': [
    'inventory.low_stock.view',
  ],
  'pharmaco.inventory.batch_expiry.view': [
    'inventory.expiry_review.view',
    'inventory.expiry_labels.view',
  ],
  'pharmaco.inventory.batch_expiry.manage': [
    'inventory.expiry_review.view',
    'inventory.expiry_review.edit',
    'inventory.expiry_labels.view',
    'inventory.expiry_labels.add',
  ],

  'pharmaco.procurement.view': [
    'procurement.suppliers.view',
    'procurement.purchase_orders.view',
    'procurement.receiving.view',
    'reports.procurement.view',
  ],
  'pharmaco.suppliers.manage': [
    'procurement.suppliers.view',
    'procurement.suppliers.add',
    'procurement.suppliers.edit',
  ],
  'pharmaco.procurement.suppliers.manage': [
    'procurement.suppliers.view',
    'procurement.suppliers.add',
    'procurement.suppliers.edit',
  ],
  'pharmaco.procurement.purchase_order.create': [
    'procurement.purchase_orders.view',
    'procurement.purchase_orders.add',
  ],
  'pharmaco.procurement.purchase_order.approve': [
    'procurement.purchase_orders.view',
    'procurement.purchase_orders.edit',
  ],
  'pharmaco.procurement.purchase_order.receive': [
    'procurement.receiving.view',
    'procurement.receiving.add',
  ],

  'pharmaco.finance.view': [
    'finance.dashboard.view',
    'finance.payables.view',
    'finance.receivables.view',
    'finance.payments.view',
    'finance.reconciliation.view',
    'reports.finance.view',
  ],
  'pharmaco.finance.receivables.manage': [
    'finance.receivables.view',
    'finance.receivables.add',
    'finance.receivables.edit',
  ],
  'pharmaco.finance.payables.manage': [
    'finance.payables.view',
    'finance.payables.add',
    'finance.payables.edit',
  ],
  'pharmaco.finance.reconciliation.manage': [
    'finance.reconciliation.view',
    'finance.reconciliation.add',
    'finance.reconciliation.edit',
  ],
  'pharmaco.procurement.payment.view': [
    'finance.payments.view',
  ],
  'pharmaco.procurement.payment.manage': [
    'finance.payments.view',
    'finance.payments.add',
    'finance.payments.edit',
  ],

  'pharmaco.reports.view': [
    'reports.sales.view',
    'reports.inventory.view',
    'reports.procurement.view',
    'reports.finance.view',
  ],
  'pharmaco.reports.sales': [
    'reports.sales.view',
  ],
  'pharmaco.reports.inventory': [
    'reports.inventory.view',
  ],
  'pharmaco.reports.procurement': [
    'reports.procurement.view',
  ],
  'pharmaco.reports.finance': [
    'reports.finance.view',
  ],
  'pharmaco.reports.audit': [
    'reports.audit.view',
  ],

  'users.view': [
    'users.staff.view',
  ],
  'users.manage': [
    'users.staff.view',
    'security.users.view',
    'security.users.add',
    'security.users.edit',
    'security.users.delete',
  ],
  'tenant.roles.manage': [
    'users.staff.view',
    'security.users.view',
    'security.users.add',
    'security.users.edit',
    'security.roles.view',
    'security.permissions.view',
  ],
  'roles.manage': [
    'users.staff.view',
    'security.users.view',
    'security.users.add',
    'security.users.edit',
    'security.users.delete',
    'security.roles.view',
    'security.roles.add',
    'security.roles.edit',
    'security.roles.delete',
    'security.permissions.view',
    'security.permissions.add',
    'security.permissions.edit',
    'security.permissions.delete',
  ],

  'notifications.view': [
    'communications.notifications.view',
  ],
  'notifications.manage': [
    'communications.notifications.view',
    'communications.notifications.add',
    'communications.notifications.edit',
  ],
  'communications.email.use': [
    'communications.email.view',
  ],
  'pharmaco.chat.manage': [
    'communications.chat.view',
  ],
};

function profilePermissionSet(
  profile: AccessProfile | undefined,
): Set<string> {
  const permissions = new Set<string>();

  (profile?.permissions ?? []).forEach((rawPermission) => {
    const permission = normalizePermissionKey(rawPermission);

    if (!permission) return;

    permissions.add(permission);

    (operationalPermissionAliases[permission] ?? []).forEach(
      (alias) => {
        permissions.add(normalizePermissionKey(alias));
      },
    );
  });

  return permissions;
}

function profileRoleTokens(profile: AccessProfile | undefined): string[] {
  return (profile?.roles ?? [])
    .flatMap((role) => [
      role.code,
      role.name,
      (role as unknown as Record<string, unknown>).slug,
      (role as unknown as Record<string, unknown>).key,
    ])
    .map((role) => normalizePermissionKey(role))
    .filter(Boolean);
}

function profileHasAdminAuthority(profile: AccessProfile | undefined): boolean {
  if (!profile) return false;
  if (profile!.scope.is_platform) return true;

  const adminRoles = new Set([
    'admin',
    'administrator',
    'super_admin',
    'system_admin',
    'platform_admin',
    'solution_admin',
    'tenant_admin',
  ]);

  return profileRoleTokens(profile).some((role) =>
    adminRoles.has(role)
    || Array.from(adminRoles).some((adminRole) =>
      role.endsWith(`_${adminRole}`)
      || role.includes(`_${adminRole}_`)
    )
  );
}

function profileHasOwnerRole(
  profile: AccessProfile | undefined,
): boolean {
  if (!profile) return false;

  return profileRoleTokens(profile).some(
    (role) =>
      role === 'owner'
      || role.endsWith('_owner')
      || role.includes('_owner_'),
  );
}

const ownerTechnicalSectionKeys =
  new Set<AdminSectionKey>([
    'admin-panel',
    'settings',
  ]);

function profileHasGranularPermission(profile: AccessProfile | undefined, permissions: string[]): boolean {
  if (!profile) return false;
  if (profileHasAdminAuthority(profile)) return true;

  const availablePermissions = profilePermissionSet(profile);

  return permissions
    .map((permission) => normalizePermissionKey(permission))
    .some((permission) => availablePermissions.has(permission));
}

function preferredOperationalSection(
  profile: AccessProfile | undefined,
): AdminSectionKey {
  if (!profile || profileHasAdminAuthority(profile)) {
    return 'overview';
  }

  if (profileHasOwnerRole(profile)) {
    return 'pos';
  }

  const roles = profileRoleTokens(profile);

  const hasRole = (...tokens: string[]) =>
    roles.some((role) =>
      tokens.some(
        (token) =>
          role === token
          || role.endsWith(`_${token}`)
          || role.includes(`_${token}_`),
      ),
    );

  if (
    hasRole('cashier', 'pharmacist')
    || profileHasGranularPermission(
      profile,
      ['pos.sales.view'],
    )
  ) {
    return 'pos';
  }

  if (
    hasRole('inventory_officer')
    || profileHasGranularPermission(
      profile,
      ['inventory.dashboard.view'],
    )
  ) {
    return 'inventory';
  }

  if (
    hasRole('procurement_officer')
    || profileHasGranularPermission(
      profile,
      ['procurement.suppliers.view'],
    )
  ) {
    return 'suppliers';
  }

  if (
    hasRole('finance_officer')
    || profileHasGranularPermission(
      profile,
      ['finance.dashboard.view'],
    )
  ) {
    return 'finance';
  }

  if (
    hasRole('hr_officer')
    || profileHasGranularPermission(
      profile,
      ['users.staff.view'],
    )
  ) {
    return 'admin-management';
  }

  return 'overview';
}

function menuPermissionLookupKey(item: MenuItem): string {
  return item.context ? `${item.key}:${item.context}` : item.key;
}

function moduleKeyForMenuItem(item: MenuItem): string {
  if (item.key === 'admin-panel') return 'platform';
  if (item.key === 'ai-center') return 'ai';
  if (item.key === 'solution-portfolio') return 'solutions';
  if (item.key === 'tenant-setup') return 'tenant';
  if (item.key === 'corporate-email') return 'communications';
  if (item.key === 'pharmacist-chat') return 'communications';
  if (item.key === 'market-management') return 'markets';
  if (item.key === 'nearby-providers') return 'markets';

  return normalizePermissionKey(item.key);
}

function viewPermissionsForMenuItem(item: MenuItem): string[] {
  const direct = granularMenuPermissionMap[menuPermissionLookupKey(item)] ?? granularMenuPermissionMap[item.key];

  if (direct) return direct;

  const moduleKey = moduleKeyForMenuItem(item);
  const resourceKey = normalizePermissionKey(item.context ?? item.key);

  return [`${moduleKey}.${resourceKey}.view`];
}

function viewPermissionsForLeftSubmenu(item: MenuItem, submenu: LeftMenuSubmenu): string[] {
  const submenuKey = normalizePermissionKey(submenu.target ?? submenu.key);
  const direct = granularLeftSubmenuPermissionMap[item.key]?.[submenuKey];

  if (direct) return direct;

  const moduleKey = moduleKeyForMenuItem(item);

  return [`${moduleKey}.${submenuKey}.view`];
}

function leftSubmenuIsVisibleForProfile(
  profile: AccessProfile | undefined,
  item: MenuItem,
  submenu: LeftMenuSubmenu,
): boolean {
  if (!profile) return false;
  if (profileHasAdminAuthority(profile)) return true;

  return profileHasGranularPermission(profile, viewPermissionsForLeftSubmenu(item, submenu));
}



function tenantDisplayName(profile: AccessProfile | undefined): string {
  return profile?.tenant_assignments?.[0]?.tenant?.name ?? 'Tenant';
}



type PermissionMatrixAction = 'view' | 'add' | 'edit' | 'delete';

type PermissionMatrixResource = {
  label: string;
  description: string;
  permissions: Partial<Record<PermissionMatrixAction, string>>;
};

type PermissionMatrixGroup = {
  title: string;
  description: string;
  resources: PermissionMatrixResource[];
};

const granularPermissionMatrix: PermissionMatrixGroup[] = [
  {
    title: 'Inventory',
    description: 'Products, batches, receiving, stock locations, expiry review, and inventory customization.',
    resources: [
      {
        label: 'Inventory Dashboard',
        description: 'Summary cards, stock overview, and inventory health.',
        permissions: { view: 'inventory.dashboard.view' },
      },
      {
        label: 'Product Master',
        description: 'Commercial product records used by stock and POS.',
        permissions: {
          view: 'inventory.products.view',
          add: 'inventory.products.add',
          edit: 'inventory.products.edit',
          delete: 'inventory.products.delete',
        },
      },
      {
        label: 'Inventory Batches',
        description: 'Batch-level quantity, cost, expiry, and pricing.',
        permissions: {
          view: 'inventory.batches.view',
          add: 'inventory.batches.add',
          edit: 'inventory.batches.edit',
          delete: 'inventory.batches.delete',
        },
      },
      {
        label: 'Receiving',
        description: 'Stock receiving workflow from Product Master.',
        permissions: {
          view: 'inventory.receiving.view',
          add: 'inventory.receiving.add',
          edit: 'inventory.receiving.edit',
          delete: 'inventory.receiving.delete',
        },
      },
      {
        label: 'Stock Locations',
        description: 'Shelves, stores, branches, and inventory holding points.',
        permissions: {
          view: 'inventory.locations.view',
          add: 'inventory.locations.add',
          edit: 'inventory.locations.edit',
          delete: 'inventory.locations.delete',
        },
      },
      {
        label: 'Low Stock',
        description: 'Low stock monitoring and replenishment attention.',
        permissions: {
          view: 'inventory.low_stock.view',
          add: 'inventory.low_stock.add',
          edit: 'inventory.low_stock.edit',
          delete: 'inventory.low_stock.delete',
        },
      },
      {
        label: 'Expiry Review',
        description: 'Near-expiry, expired, and expiry-risk review tables.',
        permissions: {
          view: 'inventory.expiry_review.view',
          add: 'inventory.expiry_review.add',
          edit: 'inventory.expiry_review.edit',
          delete: 'inventory.expiry_review.delete',
        },
      },
      {
        label: 'Expiry Labels',
        description: 'Expiry thresholds, row colours, and label mapping.',
        permissions: {
          view: 'inventory.expiry_labels.view',
          edit: 'inventory.expiry_labels.edit',
        },
      },
      {
        label: 'Table Settings',
        description: 'Table density, font size, wrapping, sticky columns, and table style.',
        permissions: {
          view: 'inventory.table_settings.view',
          edit: 'inventory.table_settings.edit',
        },
      },
    ],
  },
  {
    title: 'POS and Sales',
    description: 'Counter sales, receipts, returns, payments, insurance, and cashier close.',
    resources: [
      {
        label: 'Sales Register',
        description: 'Create and manage sales transactions.',
        permissions: {
          view: 'pos.sales.view',
          add: 'pos.sales.add',
          edit: 'pos.sales.edit',
          delete: 'pos.sales.delete',
        },
      },
      {
        label: 'Receipts',
        description: 'Receipt viewing, printing, and correction.',
        permissions: {
          view: 'pos.receipts.view',
          add: 'pos.receipts.add',
          edit: 'pos.receipts.edit',
          delete: 'pos.receipts.delete',
        },
      },
      {
        label: 'Returns',
        description: 'Returned items and refund handling.',
        permissions: {
          view: 'pos.returns.view',
          add: 'pos.returns.add',
          edit: 'pos.returns.edit',
          delete: 'pos.returns.delete',
        },
      },
      {
        label: 'Payments',
        description: 'Cash, mobile money, card, and insurance payment handling.',
        permissions: {
          view: 'pos.payments.view',
          add: 'pos.payments.add',
          edit: 'pos.payments.edit',
          delete: 'pos.payments.delete',
        },
      },
      {
        label: 'Cashier Close',
        description: 'Daily cashier close and shift reconciliation.',
        permissions: {
          view: 'pos.cashier_close.view',
          add: 'pos.cashier_close.add',
          edit: 'pos.cashier_close.edit',
        },
      },
      {
        label: 'Insurance',
        description: 'Insurance-linked sales and claim preparation.',
        permissions: {
          view: 'pos.insurance.view',
          add: 'pos.insurance.add',
          edit: 'pos.insurance.edit',
          delete: 'pos.insurance.delete',
        },
      },
    ],
  },
  {
    title: 'Procurement and Suppliers',
    description: 'Supplier records, purchase orders, receiving, and dispatch coordination.',
    resources: [
      {
        label: 'Suppliers',
        description: 'Supplier registry and supplier profile management.',
        permissions: {
          view: 'procurement.suppliers.view',
          add: 'procurement.suppliers.add',
          edit: 'procurement.suppliers.edit',
          delete: 'procurement.suppliers.delete',
        },
      },
      {
        label: 'Purchase Orders',
        description: 'Purchase planning and order preparation.',
        permissions: {
          view: 'procurement.purchase_orders.view',
          add: 'procurement.purchase_orders.add',
          edit: 'procurement.purchase_orders.edit',
          delete: 'procurement.purchase_orders.delete',
        },
      },
      {
        label: 'Receiving',
        description: 'Supplier delivery and stock receipt confirmation.',
        permissions: {
          view: 'procurement.receiving.view',
          add: 'procurement.receiving.add',
          edit: 'procurement.receiving.edit',
          delete: 'procurement.receiving.delete',
        },
      },
      {
        label: 'Dispatch',
        description: 'Dispatch coordination and delivery movement.',
        permissions: {
          view: 'procurement.dispatch.view',
          add: 'procurement.dispatch.add',
          edit: 'procurement.dispatch.edit',
          delete: 'procurement.dispatch.delete',
        },
      },
    ],
  },
  {
    title: 'Finance',
    description: 'Payables, receivables, reconciliation, and finance operations.',
    resources: [
      {
        label: 'Finance Dashboard',
        description: 'Finance overview and operational indicators.',
        permissions: { view: 'finance.dashboard.view' },
      },
      {
        label: 'Payables',
        description: 'Supplier bills and payable tracking.',
        permissions: {
          view: 'finance.payables.view',
          add: 'finance.payables.add',
          edit: 'finance.payables.edit',
          delete: 'finance.payables.delete',
        },
      },
      {
        label: 'Receivables',
        description: 'Customer, insurer, and partner receivables.',
        permissions: {
          view: 'finance.receivables.view',
          add: 'finance.receivables.add',
          edit: 'finance.receivables.edit',
          delete: 'finance.receivables.delete',
        },
      },
      {
        label: 'Payments',
        description: 'Payment records and settlement operations.',
        permissions: {
          view: 'finance.payments.view',
          add: 'finance.payments.add',
          edit: 'finance.payments.edit',
          delete: 'finance.payments.delete',
        },
      },
      {
        label: 'Reconciliation',
        description: 'Cash, bank, mobile money, and settlement reconciliation.',
        permissions: {
          view: 'finance.reconciliation.view',
          add: 'finance.reconciliation.add',
          edit: 'finance.reconciliation.edit',
          delete: 'finance.reconciliation.delete',
        },
      },
    ],
  },
  {
    title: 'Users, Roles, and Security',
    description: 'Staff users, roles, permission assignment, 2FA, and audit trails.',
    resources: [
      {
        label: 'Staff Users',
        description: 'User accounts and staff profile access.',
        permissions: {
          view: 'users.staff.view',
          add: 'users.staff.add',
          edit: 'users.staff.edit',
          delete: 'users.staff.delete',
        },
      },
      {
        label: 'Roles',
        description: 'Role creation and role assignment.',
        permissions: {
          view: 'security.roles.view',
          add: 'security.roles.add',
          edit: 'security.roles.edit',
          delete: 'security.roles.delete',
        },
      },
      {
        label: 'Permissions',
        description: 'Fine-grained permission assignment.',
        permissions: {
          view: 'security.permissions.view',
          add: 'security.permissions.add',
          edit: 'security.permissions.edit',
          delete: 'security.permissions.delete',
        },
      },
      {
        label: 'Audit Trail',
        description: 'Security and activity audit review.',
        permissions: {
          view: 'security.audit.view',
          add: 'security.audit.add',
          edit: 'security.audit.edit',
          delete: 'security.audit.delete',
        },
      },
      {
        label: 'Two-Factor Authentication',
        description: '2FA policy and trusted device control.',
        permissions: {
          view: 'security.two_factor.view',
          add: 'security.two_factor.add',
          edit: 'security.two_factor.edit',
          delete: 'security.two_factor.delete',
        },
      },
    ],
  },
  {
    title: 'Reports',
    description: 'Inventory, sales, finance, procurement, and audit reporting.',
    resources: [
      {
        label: 'Inventory Reports',
        description: 'Inventory reporting and exports.',
        permissions: {
          view: 'reports.inventory.view',
          add: 'reports.inventory.add',
          edit: 'reports.inventory.edit',
          delete: 'reports.inventory.delete',
        },
      },
      {
        label: 'Sales Reports',
        description: 'Sales reporting and exports.',
        permissions: {
          view: 'reports.sales.view',
          add: 'reports.sales.add',
          edit: 'reports.sales.edit',
          delete: 'reports.sales.delete',
        },
      },
      {
        label: 'Finance Reports',
        description: 'Finance reporting and exports.',
        permissions: {
          view: 'reports.finance.view',
          add: 'reports.finance.add',
          edit: 'reports.finance.edit',
          delete: 'reports.finance.delete',
        },
      },
      {
        label: 'Procurement Reports',
        description: 'Supplier and procurement reporting.',
        permissions: {
          view: 'reports.procurement.view',
          add: 'reports.procurement.add',
          edit: 'reports.procurement.edit',
          delete: 'reports.procurement.delete',
        },
      },
      {
        label: 'Audit Reports',
        description: 'Audit and compliance reporting.',
        permissions: {
          view: 'reports.audit.view',
          add: 'reports.audit.add',
          edit: 'reports.audit.edit',
          delete: 'reports.audit.delete',
        },
      },
    ],
  },
  {
    title: 'Communications and Platform',
    description: 'Notifications, email, chat, tenant profile, branches, and platform tools.',
    resources: [
      {
        label: 'Notifications',
        description: 'Notification center and message scheduling.',
        permissions: {
          view: 'communications.notifications.view',
          add: 'communications.notifications.add',
          edit: 'communications.notifications.edit',
          delete: 'communications.notifications.delete',
        },
      },
      {
        label: 'Corporate Email',
        description: 'Corporate email and message templates.',
        permissions: {
          view: 'communications.email.view',
          add: 'communications.email.add',
          edit: 'communications.email.edit',
          delete: 'communications.email.delete',
        },
      },
      {
        label: 'Pharmacist Chat',
        description: 'In-app and WhatsApp communication workspace.',
        permissions: {
          view: 'communications.chat.view',
          add: 'communications.chat.add',
          edit: 'communications.chat.edit',
          delete: 'communications.chat.delete',
        },
      },
      {
        label: 'Tenant Profile',
        description: 'Tenant profile and operational setup.',
        permissions: {
          view: 'tenant.profile.view',
          add: 'tenant.profile!.add',
          edit: 'tenant.profile!.edit',
          delete: 'tenant.profile!.delete',
        },
      },
      {
        label: 'Branches',
        description: 'Branch and location setup.',
        permissions: {
          view: 'tenant.branches.view',
          add: 'tenant.branches.add',
          edit: 'tenant.branches.edit',
          delete: 'tenant.branches.delete',
        },
      },
    ],
  },
];

function permissionMatrixCell(profile: AccessProfile, permission?: string) {
  if (!permission) {
    return <span className="permission-matrix-cell permission-matrix-cell--not-applicable">—</span>;
  }

  const allowed = profileHasGranularPermission(profile, [permission]);

  return (
    <span
      className={`permission-matrix-cell ${allowed ? 'permission-matrix-cell--allowed' : 'permission-matrix-cell--blocked'}`}
      title={permission}
    >
      {allowed ? '✓' : '—'}
    </span>
  );
}

function renderProfilePermissionMatrix(profile: AccessProfile) {
  return (
    <div className="security-permission-matrix">
      {granularPermissionMatrix.map((group) => (
        <section key={group.title} className="security-permission-matrix-group">
          <div className="security-permission-matrix-group__header">
            <div>
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </div>
          </div>

          <div className="security-permission-table-shell">
            <table className="security-permission-table">
              <thead>
                <tr>
                  <th scope="col">Resource</th>
                  <th scope="col">View</th>
                  <th scope="col">Add</th>
                  <th scope="col">Edit</th>
                  <th scope="col">Delete</th>
                </tr>
              </thead>
              <tbody>
                {group.resources.map((resource) => (
                  <tr key={`${group.title}-${resource.label}`}>
                    <td>
                      <strong>{resource.label}</strong>
                      <span>{resource.description}</span>
                    </td>
                    <td>{permissionMatrixCell(profile, resource.permissions.view)}</td>
                    <td>{permissionMatrixCell(profile, resource.permissions.add)}</td>
                    <td>{permissionMatrixCell(profile, resource.permissions.edit)}</td>
                    <td>{permissionMatrixCell(profile, resource.permissions.delete)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}


function itemIsVisibleForProfile(profile: AccessProfile | undefined, item: MenuItem): boolean {
  if (!profile) return false;
  if (profileHasAdminAuthority(profile)) return true;

  return profileHasGranularPermission(profile, viewPermissionsForMenuItem(item));
}

function pruneMenuGroups(profile: AccessProfile | undefined, groups: MenuGroup[]): MenuGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => itemIsVisibleForProfile(profile, item)),
    }))
    .filter((group) => group.items.length > 0);
}

function buildVisibleMenuGroups(profile: AccessProfile | undefined): MenuGroup[] {
  if (!profile || profile!.scope.is_platform) {
    return menuGroups;
  }

  if (profile!.scope.is_solution) {
    return pruneMenuGroups(profile, [
      {
        key: 'solutions',
        label: 'Solution Portfolio',
        icon: 'SOL',
        items: [
          { key: 'solution-portfolio', context: 'pharmaco', label: 'PharmaCore 360', description: 'Assigned solution tenants', icon: 'PH', status: 'Active' },
        ],
      },
      {
        key: 'tenant-ops',
        label: 'Operations 360 View',
        icon: 'PH',
        items: [
          { key: 'inventory', label: 'Inventory', description: 'Stock, batches, expiry', icon: 'IN', status: 'Live' },
          { key: 'general-stock-items', label: 'General Stock Items', description: 'Operational supplies, shortages and reorder planning', icon: 'GS', status: 'Live' },
          { key: 'insurance', label: 'Insurance', description: 'Partners, schemes, pricing and claims', icon: 'IS', status: 'Live' },
          { key: 'pos', label: 'POS', description: 'Sales and dispensing', icon: 'PS', status: 'Live' },
          { key: 'suppliers', label: 'Procurement', description: 'Procurement and payables', icon: 'SP', status: 'Live' },
          { key: 'finance', label: 'Finance', description: 'Receivables and payments', icon: 'FN', status: 'Live' },
          { key: 'reports', label: 'Ad-hoc Report', description: 'Executive and daily reports', icon: 'AR', status: 'Live' },
          { key: 'pharmacist-chat', label: 'Pharmacist Chats', description: 'In-app and WhatsApp customer conversations', icon: 'CH', status: 'Live' },
        ],
      },
      {
        key: 'ai',
        label: 'AI Center',
        icon: 'AI',
        items: [
          { key: 'ai-center', context: 'recommendations', label: 'AI Operations', description: 'Recommendations and approvals', icon: 'AI', status: 'Active' },
        ],
      },
      {
        key: 'market',
        label: 'Market & Communication',
        icon: 'MK',
        items: [
          { key: 'market-management', label: 'Market Management', description: 'Assign tenants to markets', icon: 'MK', status: 'Active' },
          { key: 'nearby-providers', label: 'Nearby Providers', description: 'Customer discovery', icon: 'NP', status: 'Active' },
          { key: 'notifications', label: 'Notifications', description: 'In-app notices', icon: 'NT', status: 'Active' },
          { key: 'corporate-email', label: 'Corporate Email', description: 'Company mail', icon: 'EM', status: 'Active' },
        ],
      },
    ]);
  }

  const tenantName = tenantDisplayName(profile);

  return pruneMenuGroups(profile, [
    {
      key: 'tenant-ops',
      label: `${tenantName} Pharmacy`,
      icon: 'PH',
      items: [
        { key: 'inventory', label: 'Inventory', description: 'Products, stock, batches', icon: 'IN', status: 'Live' },
        { key: 'general-stock-items', label: 'General Stock Items', description: 'Operational supplies, shortages and reorder planning', icon: 'GS', status: 'Live' },
        { key: 'insurance', label: 'Insurance', description: 'Partners, schemes, pricing and claims', icon: 'IS', status: 'Live' },
        { key: 'pos', label: 'POS and Sales', description: 'Counter sales and dispensing', icon: 'PS', status: 'Live' },
        { key: 'suppliers', label: 'Procurement', description: 'Purchasing and receiving', icon: 'PR', status: 'Live' },
        { key: 'finance', label: 'Finance', description: 'Payables and receivables', icon: 'FN', status: 'Live' },
        { key: 'reports', label: 'Ad-hoc Report', description: 'Daily and monthly review', icon: 'AR', status: 'Live' },
        { key: 'pharmacist-chat', label: 'Pharmacist Chat', description: 'Customer questions', icon: 'CH', status: 'Live' },
        { key: 'ai-center', context: 'recommendations', label: 'AI Center', description: 'Stock, expiry, and operating guidance', icon: 'AI', status: 'Active' },
      ],
    },
    {
      key: 'tenant-admin',
      label: 'Tenant Administration',
      icon: 'ADM',
      items: [
        { key: 'tenant-setup', label: 'Business Setup', description: 'Profile, branches, departments', icon: 'TS', status: 'Live' },
        { key: 'admin-management', label: 'Admin Management', description: 'Users, security and administrator support', icon: 'AM', status: 'Protected' },
        { key: 'corporate-email', label: 'Corporate Email', description: 'Company mail', icon: 'EM', status: 'Active' },
        { key: 'notifications', label: 'Notifications', description: 'Staff communication', icon: 'NT', status: 'Active' },
        { key: 'localization', label: 'Language and Market', description: 'EN, FR, PT preference', icon: 'LG', status: 'Active' },
        { key: 'nearby-providers', label: 'Nearby Providers', description: 'Customer app discovery', icon: 'NP', status: 'Active' },
      ],
    },
  ]);
}

const erpModules: Array<{
  key: ErpWorkspaceKey;
  title: string;
  status: string;
  summary: string;
  workspace: string[];
}> = [
  {
    key: 'erp-overview',
    title: 'ERP operating layer',
    status: 'Framework',
    summary: 'Shared controls for finance, people, procurement, approvals, implementation, and customer support.',
    workspace: ['Role-aware dashboards', 'Approval queues', 'Audit trail', 'Tenant and branch filters'],
  },
  {
    key: 'finance',
    title: 'Finance',
    status: 'Live APIs',
    summary: 'Payables, receivables, collections, customer credit, supplier aging, and management review.',
    workspace: ['Procurement invoices', 'Payment records', 'Customer collections', 'Cash and credit visibility'],
  },
  {
    key: 'hr',
    title: 'Human resources',
    status: 'Coming soon',
    summary: 'Staff records, role assignment, shifts, branch staffing, training, leave, and productivity controls.',
    workspace: ['Staff profile', 'Shift schedule', 'Training checklist', 'Performance notes'],
  },
  {
    key: 'procurement',
    title: 'Procurement',
    status: 'Live APIs',
    summary: 'Purchase requests, supplier comparison, purchase orders, receiving, and invoice handoff.',
    workspace: ['Purchase order builder', 'Receiving review', 'Supplier terms', 'Approval evidence'],
  },
  {
    key: 'projects',
    title: 'Projects and rollout',
    status: 'Planned',
    summary: 'Implementation tasks for new tenants, branches, integrations, migrations, and training.',
    workspace: ['Milestones', 'Risks', 'Owner assignment', 'Deployment readiness'],
  },
  {
    key: 'customer-care',
    title: 'Customer care',
    status: 'Planned',
    summary: 'Support cases, tenant requests, SLA tracking, knowledge responses, and escalation visibility.',
    workspace: ['Tickets', 'SLA aging', 'Knowledge base', 'Escalation queue'],
  },
];

const solutionPortfolio: Array<{
  key: SolutionKey;
  title: string;
  status: string;
  audience: string;
  summary: string;
  next: string;
}> = [
  {
    key: 'pharmaco',
    title: 'PharmaCore 360',
    status: 'Active',
    audience: 'Retail pharmacies, wholesale pharmacies, suppliers, and health-commerce partners.',
    summary: 'A pharmacy ecosystem for product master, inventory, POS, procurement, finance, ad-hoc reporting, AI, and partner growth.',
    next: 'Use the segment selector below to open retail pharmacy, wholesale, procurement, delivery, partner, and AI workspaces.',
  },
  {
    key: 'vetcore',
    title: 'VetCore 360',
    status: 'Coming soon',
    audience: 'Veterinary clinics, pharmacies, livestock health teams, and animal-care suppliers.',
    summary: 'Future veterinary operations suite with appointments, medicines, stock, treatment records, billing, and reports.',
    next: 'Keep as portfolio-visible but locked until the first tenant and module activation plan are approved.',
  },
  {
    key: 'cliniccore',
    title: 'ClinicCore 360',
    status: 'Coming soon',
    audience: 'Clinics, outpatient departments, reception teams, clinicians, pharmacies, and billing offices.',
    summary: 'Future clinic workflow suite for registration, appointments, consultation, prescribing, billing, insurance, and reporting.',
    next: 'Design after PharmaCore 360 core workflows stabilize so shared patient and pharmacy logic stays clean.',
  },
  {
    key: 'insucore',
    title: 'InsuCore 260',
    status: 'Coming soon',
    audience: 'Insurance partners, claims reviewers, providers, and reconciliation teams.',
    summary: 'Future insurance operations layer for partner setup, covered products, claims, co-payments, reconciliation, and audit.',
    next: 'Expose only the readiness view until insurance integration rules and regulatory controls are defined.',
  },
];

const pharmaSegments: Array<{
  key: PharmaSegmentKey;
  label: string;
  status: string;
  summary: string;
}> = [
  {
    key: 'retail',
    label: 'Retail Pharmacy',
    status: 'Phase 1 active',
    summary: 'Counter sales, dispensing, product master, inventory, prescriptions, customers, branch control, and daily review.',
  },
  {
    key: 'wholesale',
    label: 'Wholesale Pharmacy',
    status: 'Phase 2/3',
    summary: 'Wholesale catalog, bulk pricing, invoices, delivery terms, demand analytics, and retail order visibility.',
  },
  {
    key: 'retail-procurement',
    label: 'Retail Procurement',
    status: 'Phase 2/3',
    summary: 'Browse wholesale catalogs, compare supplier prices, order, receive stock, reconcile invoice, and update inventory.',
  },
  {
    key: 'delivery',
    label: 'Delivery and Dispatch',
    status: 'Phase 3',
    summary: 'Assignments, proof of delivery, OTP confirmation, failed delivery reasons, and dispatch performance.',
  },
  {
    key: 'insurance-clinic',
    label: 'Insurance and Clinic Links',
    status: 'Later',
    summary: 'Partner setup, claim handoff, covered medicines, co-payment, e-prescription readiness, and referrals.',
  },
  {
    key: 'ai-insights',
    label: 'AI Insights',
    status: 'Controlled',
    summary: 'Demand, reorder, expiry, pricing, anomaly, product gap, customer, supplier, and finance recommendations.',
  },
];

const pharmaFeaturesBySegment: Record<PharmaSegmentKey, {
  note: string;
  features: Array<{
    key: PharmaFeatureKey;
    title: string;
    status: string;
    summary: string;
    actions: string[];
  }>;
}> = {
  retail: {
    note: 'Retail pharmacy users should land on their permitted workspace: owner and managers see executive health; cashiers see POS; inventory officers see stock; finance users see receivables and close.',
    features: [
      {
        key: 'ai-model',
        title: 'AI Model',
        status: 'Controlled activation',
        summary: 'Governed pharmacy AI for demand, reorder, expiry, pricing, anomaly, compliance, and report writing.',
        actions: ['Human approval required', 'Explanation and confidence visible', 'Tenant data boundary enforced'],
      },
      {
        key: 'inventory',
        title: 'Inventory',
        status: 'Live APIs',
        summary: 'Product master, batches, expiry, stock movement, receiving, FEFO, low stock, and shelf readiness.',
        actions: ['Review stock by branch', 'Receive and adjust with audit', 'Escalate expiry and stock-out risk'],
      },
      {
        key: 'pos',
        title: 'POS',
        status: 'Live APIs',
        summary: 'Fast checkout, barcode/product search, dispensing checks, payment controls, returns, receipts, and daily close.',
        actions: ['Open teller session', 'Validate FEFO stock', 'Close till with supervisor review'],
      },
      {
        key: 'product-master',
        title: 'Product Master',
        status: 'Phase 1',
        summary: 'Approved products, generics, brands, categories, dosage, strength, barcode, and regulatory flags.',
        actions: ['Maintain approved product list', 'Map barcodes and SKU', 'Control prescription flags'],
      },
      {
        key: 'procurement',
        title: 'Procurement',
        status: 'Live APIs',
        summary: 'Suppliers, purchase requests, purchase orders, goods received, invoices, and wholesale readiness.',
        actions: ['Create purchase order', 'Receive against order', 'Hand invoice to payables'],
      },
      {
        key: 'prescriptions',
        title: 'Prescriptions',
        status: 'Phase 2',
        summary: 'Prescription capture, item validation, dispensing status, refill tracking, and safety checks.',
        actions: ['Capture prescription', 'Check duplicate/risky dispensing', 'Schedule refill follow-up'],
      },
      {
        key: 'customers',
        title: 'Customers',
        status: 'Phase 2',
        summary: 'Customer profiles, refill reminders, feedback, loyalty, chronic medicine follow-up, and credit visibility.',
        actions: ['Review customer 360', 'Send approved reminders', 'Monitor credit exposure'],
      },
      {
        key: 'reports',
        title: 'Ad-hoc Report and BI',
        status: 'Live APIs',
        summary: 'Sales, stock, margin, branch performance, supplier performance, expiry, and stockout ad-hoc reports.',
        actions: ['Review daily command center', 'Export finance-ready ad-hoc reports', 'Track branch performance'],
      },
    ],
  },
  wholesale: {
    note: 'Wholesale users should only see their own business data, catalog, orders, invoices, dispatch terms, and aggregated demand opportunities.',
    features: [
      {
        key: 'procurement',
        title: 'Wholesale Catalog',
        status: 'Phase 2/3',
        summary: 'Bulk availability, minimum order quantities, pricing tiers, lead time, regions, returns, and credit terms.',
        actions: ['Publish catalog', 'Confirm retail orders', 'Prepare invoice and dispatch'],
      },
      {
        key: 'ai-model',
        title: 'Wholesale Opportunity AI',
        status: 'Controlled',
        summary: 'Aggregated demand signals help wholesalers identify products, regions, and pricing opportunities.',
        actions: ['Review demand without tenant leakage', 'Approve opportunity insight', 'Track accepted recommendation'],
      },
      {
        key: 'inventory',
        title: 'Warehouse Inventory',
        status: 'Framework',
        summary: 'Warehouse stock, batches, expiry, reserved stock, dispatch location, and replenishment controls.',
        actions: ['Reserve order stock', 'Monitor expiry risk', 'Prepare dispatch stock'],
      },
      {
        key: 'reports',
        title: 'Wholesale Performance',
        status: 'Framework',
        summary: 'Retail demand, order conversion, delivery reliability, supplier pricing, and payment performance.',
        actions: ['Review demand analytics', 'Compare supplier performance', 'Track payment aging'],
      },
    ],
  },
  'retail-procurement': {
    note: 'Retail-to-wholesale procurement should guide the user from demand to order to receipt without flooding the screen with unrelated supplier data.',
    features: [
      {
        key: 'procurement',
        title: 'Compare and Order',
        status: 'Phase 2/3',
        summary: 'Browse approved wholesale catalogs, compare supplier prices, select terms, submit order, and reconcile invoice.',
        actions: ['Compare prices', 'Submit purchase request', 'Receive stock against invoice'],
      },
      {
        key: 'ai-model',
        title: 'Reorder Recommendation AI',
        status: 'Controlled',
        summary: 'Recommend reorder quantity, supplier option, urgency, and expected stock-out risk using approved data signals.',
        actions: ['Review recommendation reason', 'Approve draft order', 'Capture rejection feedback'],
      },
      {
        key: 'inventory',
        title: 'Receiving and Stock Update',
        status: 'Live APIs',
        summary: 'Confirm received quantities, capture batch/expiry/cost, update shelf stock, and log variance.',
        actions: ['Receive against PO', 'Flag variance', 'Update stock after approval'],
      },
    ],
  },
  delivery: {
    note: 'Delivery and dispatch should be a task board for accountable handoff, not a generic logistics page.',
    features: [
      {
        key: 'pos',
        title: 'Dispatch-Ready Sale',
        status: 'Phase 3',
        summary: 'Validated paid or approved sale waits for assignment, package confirmation, and customer handoff.',
        actions: ['Confirm package', 'Assign delivery', 'Capture proof of delivery'],
      },
      {
        key: 'reports',
        title: 'Dispatch Review',
        status: 'Framework',
        summary: 'Delivery status, failed reasons, OTP confirmation, branch delays, and partner performance.',
        actions: ['Monitor failed delivery', 'Review OTP completion', 'Escalate delayed dispatch'],
      },
    ],
  },
  'insurance-clinic': {
    note: 'Insurance and clinic integrations remain visible as controlled modules until partner rules, data sharing, and claim workflows are approved.',
    features: [
      {
        key: 'prescriptions',
        title: 'Clinic Prescription Flow',
        status: 'Later',
        summary: 'Clinic partner setup, e-prescription readiness, referral flow, and dispensing handoff.',
        actions: ['Map partner', 'Validate prescription payload', 'Route to pharmacist review'],
      },
      {
        key: 'procurement',
        title: 'Insurance Claims',
        status: 'Later',
        summary: 'Covered medicine list, co-payment, claim status, reconciliation, and audit-ready exceptions.',
        actions: ['Check coverage', 'Capture co-payment', 'Reconcile partner claim'],
      },
    ],
  },
  'ai-insights': {
    note: 'AI insights must remain advisory by default and always show reason, confidence, data signals, approval status, and audit context.',
    features: [
      {
        key: 'ai-model',
        title: 'PharmaCore AI Models',
        status: 'Controlled',
        summary: 'Demand forecasting, reorder, stock-out, expiry, product mix, pricing, fraud, finance, branch, and report-writing AI.',
        actions: ['Register model and use case', 'Set risk and data class', 'Require human approval for high-risk action'],
      },
      {
        key: 'reports',
        title: 'AI Insight Dashboard',
        status: 'Framework',
        summary: 'Accepted, rejected, pending, high-risk, and implemented recommendations by tenant, branch, user, and module.',
        actions: ['Review insight queue', 'Track cost and quota', 'Audit outputs and approvals'],
      },
    ],
  },
};

const roleDashboardModels = [
  ['Owner dashboard', 'Sales health, cash and credit position, stock value, branch performance, supplier aging, exceptions, and strategic AI recommendations.'],
  ['Finance dashboard', 'Receivables, payables, collections, supplier payments, daily close, payment variance, ad-hoc reports, and export readiness.'],
  ['Branch manager dashboard', 'Today sales, active tills, stock alerts, expiry risk, branch tasks, approvals, and staff activity.'],
  ['Inventory officer dashboard', 'Product master, batch/expiry, receiving, adjustments, transfers, low stock, and shelf readiness.'],
  ['Cashier/POS dashboard', 'Open teller session, product search, cart, payment, prescription flags, held sales, returns, and close till.'],
  ['Pharmacist dashboard', 'Prescription checks, controlled medicine alerts, dispensing safety, substitutions, refill follow-up, and audit notes.'],
];

const aiCenterModules: Array<{
  key: AiWorkspaceKey;
  title: string;
  status: string;
  purpose: string;
  controls: string[];
}> = [
  { key: 'business-chat', title: 'Business Chat AI', status: 'Active', purpose: 'Authorized users ask operational questions about their own tenant data, sales, stock, credit, suppliers, and branch activity.', controls: ['Tenant-scoped answers', 'Source-linked responses', 'No cross-tenant data'] },
  { key: 'customer-retention', title: 'Customer Retention AI', status: 'Framework', purpose: 'Identify refill, chronic-care, inactive-customer, and follow-up opportunities without sending messages until a human approves.', controls: ['Consent-aware audience', 'Human-approved messages', 'Follow-up tracking'] },
  { key: 'demand-forecast', title: 'Demand Forecast AI', status: 'Priority', purpose: 'Forecast product demand by branch, category, season, stock movement, sale velocity, and prescription trend.', controls: ['Forecast window', 'Branch scope', 'Confidence band'] },
  { key: 'expiry-risk', title: 'Expiry Risk AI', status: 'Priority', purpose: 'Predict batches likely to expire before sale and recommend markdown, transfer, or supplier return review.', controls: ['FEFO evidence', 'Batch age', 'Approval before action'] },
  { key: 'finance-forecast', title: 'Finance Forecast AI', status: 'Framework', purpose: 'Forecast revenue, cash collection, supplier obligations, margin pressure, and daily-close risks.', controls: ['Finance-only scope', 'Export evidence', 'Manual refresh'] },
  { key: 'fraud-anomaly', title: 'Fraud and Anomaly AI', status: 'Controlled', purpose: 'Flag unusual refunds, discounts, stock adjustments, payments, supplier invoices, and user behavior for review.', controls: ['Sensitive alert approval', 'Audit evidence', 'No automatic penalties'] },
  { key: 'pricing-margin', title: 'Pricing and Margin AI', status: 'Framework', purpose: 'Highlight margin gaps, price review opportunities, regulatory pricing issues, and category profitability.', controls: ['Margin threshold', 'Regulatory flag', 'Manager approval'] },
  { key: 'reorder-recommendation', title: 'Reorder Recommendation AI', status: 'Priority', purpose: 'Recommend what to reorder, from which supplier, at what quantity, and why, based on demand and stock position.', controls: ['Supplier comparison', 'Quantity reason', 'Purchase draft only'] },
  { key: 'stock-out', title: 'Stock-out Risk AI', status: 'Priority', purpose: 'Detect products likely to run out before the next supply cycle and push controlled reorder or transfer tasks.', controls: ['Risk days', 'Alternative products', 'Branch task'] },
  { key: 'supplier-performance', title: 'Supplier Performance AI', status: 'Framework', purpose: 'Score suppliers by delivery reliability, pricing, fill rate, returns, payment terms, and issue history.', controls: ['Supplier scorecard', 'Evidence trail', 'No hidden ranking'] },
  { key: 'inventory-assistance', title: 'Inventory Assistance AI', status: 'Active', purpose: 'Help inventory staff interpret batch, expiry, low-stock, shelf, and product-master signals in plain language.', controls: ['Read-only by default', 'Inventory permission check', 'Human update action'] },
  { key: 'operations-copilot', title: 'Operations Copilot', status: 'Active', purpose: 'Guide managers through daily close, priority follow-up, report review, and cross-module operating decisions.', controls: ['Role-aware guidance', 'Checklist trail', 'Manager review notes'] },
  { key: 'governance', title: 'AI Governance', status: 'Controlled', purpose: 'Policies, consent, risk levels, approval rules, data-sharing controls, and audit requirements.', controls: ['Global safety rules', 'Tenant data boundaries', 'Sensitive action approvals'] },
  { key: 'provider-management', title: 'AI Provider Management', status: 'Framework', purpose: 'OpenAI, local/internal models, future providers, sandbox/production status, and encrypted keys.', controls: ['Provider disabled by default', 'Sandbox before production', 'Encrypted secret ownership'] },
  { key: 'model-registry', title: 'AI Model Registry', status: 'Priority', purpose: 'Model name, provider, version, use case, risk level, approved data types, and status.', controls: ['Risk level', 'Approved data classes', 'Versioned model use case'] },
  { key: 'agent-management', title: 'AI Agent Management', status: 'Framework', purpose: 'Platform assistant, solution assistant, inventory assistant, sales assistant, compliance agent, and support agent.', controls: ['Agent scope', 'Allowed tools', 'Escalation rules'] },
  { key: 'prompt-library', title: 'AI Prompt Library', status: 'Framework', purpose: 'Approved prompts, reusable instructions, tenant-specific overrides, and version history.', controls: ['Version history', 'Admin approval', 'Tenant overrides'] },
  { key: 'knowledge-base', title: 'AI Knowledge Base', status: 'Framework', purpose: 'Approved policies, SOPs, training content, FAQs, product information, and support resolutions.', controls: ['Trusted sources', 'Review dates', 'Access classes'] },
  { key: 'data-connectors', title: 'AI Data Connectors', status: 'Framework', purpose: 'Controlled data access to sales, stock, products, suppliers, customers, finance, support, and ERP.', controls: ['Permission-aware connectors', 'Tenant isolation', 'Read/write separation'] },
  { key: 'recommendations', title: 'AI Recommendations', status: 'Priority', purpose: 'Structured recommendations with title, type, confidence, explanation, action, status, and approval.', controls: ['Confidence', 'Reason', 'Human approval status'] },
  { key: 'workflow-automation', title: 'AI Workflow Automation', status: 'Framework', purpose: 'Draft reorder proposals, reminders, reports, alerts, and support responses.', controls: ['Draft-only default', 'Reviewer assignment', 'Audit log'] },
  { key: 'approval-center', title: 'AI Human Approval Center', status: 'Priority', purpose: 'Review queue for price changes, purchase drafts, customer messages, permission changes, and sensitive alerts.', controls: ['Reviewer role', 'Bulk review evidence', 'Reject reason'] },
  { key: 'feedback-learning', title: 'AI Feedback and Learning', status: 'Framework', purpose: 'Useful, incorrect, accepted, rejected, implemented, needs-review, and comment history.', controls: ['User feedback', 'Model evaluation', 'Closed-loop improvement'] },
  { key: 'usage-cost', title: 'AI Usage, Cost and Quota Control', status: 'Framework', purpose: 'Usage per user, tenant, solution, model, feature, quota, monthly limit, and cost estimate.', controls: ['Quota', 'Cost guardrails', 'Monthly limits'] },
  { key: 'risk-compliance', title: 'AI Risk and Compliance', status: 'Controlled', purpose: 'Sensitive data checks, anomaly flags, access violations, and policy exceptions.', controls: ['Data classification', 'Risk scoring', 'Compliance escalation'] },
  { key: 'audit-logs', title: 'AI Audit Logs', status: 'Required', purpose: 'Complete audit trail of AI inputs, outputs, context, provider, model, user, and approval path.', controls: ['Immutable trail', 'Provider context', 'Approval path'] },
  { key: 'insights-dashboard', title: 'AI Insights Dashboard', status: 'Framework', purpose: 'AI performance, recommendation adoption, risk posture, cost trend, and operational impact.', controls: ['Adoption rate', 'Pending risk', 'Cost-to-value view'] },
  { key: 'chat-me-ai', title: 'Chat Me AI', status: 'Active guide', purpose: 'In-platform guidance assistant for training, navigation, tutorials, policy questions, and module-specific help.', controls: ['No clinical diagnosis', 'Screen-aware help', 'Escalate to support'] },
];

const pharmaAiModels = [
  ['Demand Forecasting AI', 'Predicts demand by branch, product, period, and season.'],
  ['Reorder Recommendation AI', 'Suggests what to reorder, when, and estimated quantity.'],
  ['Stock-Out Risk AI', 'Detects products likely to run out before the next supply cycle.'],
  ['Expiry Risk AI', 'Flags products likely to expire before they are sold.'],
  ['Inter-Branch Transfer AI', 'Suggests movement between branches to reduce stockouts and expiry risk.'],
  ['Pricing Intelligence AI', 'Highlights margin gaps, price review opportunities, and pricing risks.'],
  ['Prescription Safety AI', 'Flags potential duplicate, risky, unusual, or incomplete dispensing patterns.'],
  ['Fraud/Anomaly AI', 'Detects unusual refunds, stock adjustments, sales, claims, or user behavior.'],
  ['Finance Forecast AI', 'Forecasts revenue, cash flow, margins, and profitability.'],
  ['Business Chat AI', 'Lets authorized users ask questions about their own tenant data.'],
];

const adminPanelLayers: Array<{
  key: AdminPanelWorkspaceKey;
  title: string;
  status: string;
  summary: string;
  components: string[];
}> = [
  {
    key: 'user-profiles',
    title: 'User Profiles',
    status: 'Active',
    summary: 'Create users, edit profile and role details, deactivate staff, delete draft users, and review access readiness.',
    components: ['Create user', 'Edit user', 'Delete draft user', 'Deactivate user', 'Access readiness'],
  },
  {
    key: 'backend-api',
    title: 'Backend API',
    status: 'Active',
    summary: 'Laravel API, Sanctum auth, tenant-aware endpoints, module permissions, reports, and protected service routes.',
    components: ['Auth and profile', 'Tenant scope', 'PharmaCore endpoints', 'Protected access checks'],
  },
  {
    key: 'two-factor-auth',
    title: 'Staff two-factor authentication',
    status: 'Mandatory',
    summary: 'Authenticator app setup with QR scanning, manual text key, recovery codes, and trusted-device approval.',
    components: ['TOTP authenticator', 'QR scanning', 'Manual setup key', 'Trusted devices', 'Recovery codes'],
  },
  {
    key: 'platform-management',
    title: 'Platform Management',
    status: 'Active',
    summary: 'No-code control for website pages, blog/content sections, text, section visibility, and style metadata.',
    components: ['Website pages', 'Sections', 'Copy', 'Style JSON', 'Publishing status'],
  },
  {
    key: 'notification-management',
    title: 'Platform Notification Management Center',
    status: 'Active',
    summary: 'Create notifications, manage recurring communication, edit drafts, disable old messages, and prepare SMS delivery.',
    components: ['Create new notification', 'Manage recurring notifications', 'Edit notification', 'Disable notification', 'SMS-ready channel'],
  },
  {
    key: 'corporate-email',
    title: 'Corporate Email',
    status: 'Active',
    summary: 'In-app company mailbox with folders, reading pane, compose flow, and external provider readiness.',
    components: ['Inbox', 'Sent mail', 'Compose', 'Provider sync configuration', 'Audit trail'],
  },
  {
    key: 'pharmacist-chat',
    title: 'Pharmacist Chat',
    status: 'Active',
    summary: 'Mobile app users can start pharmacy questions and authorized pharmacists can respond from the staff console.',
    components: ['Mobile entry endpoint', 'Conversation queue', 'Pharmacist replies', 'Resolution status'],
  },
  {
    key: 'web-application',
    title: 'Web Application',
    status: 'Active',
    summary: 'Public website for external customers and the authenticated staff console for platform, solution, and tenant work.',
    components: ['Public website', 'Admin dashboard', 'Tenant portal framework', 'Section-based shell'],
  },
  {
    key: 'mobile-application',
    title: 'Mobile Application',
    status: 'Planned',
    summary: 'Manager alerts, approvals, delivery tasks, stock summaries, refill reminders, and mobile support workflows.',
    components: ['Manager app', 'Approval push', 'Delivery task view', 'Offline-safe summaries'],
  },
  {
    key: 'desktop-application',
    title: 'Desktop Application',
    status: 'Planned',
    summary: 'Installable desktop/PWA POS for counters, barcode scanner support, receipt printing, and offline-friendly lookups.',
    components: ['PWA POS', 'Barcode scanner', 'Receipt printer', 'Teller session cache'],
  },
  {
    key: 'data-layer',
    title: 'Data Layer',
    status: 'Active',
    summary: 'Tenants, solutions, modules, branches, permissions, products, stock, sales, suppliers, finance, AI, and audit records.',
    components: ['Tenant boundary', 'Module activation', 'Audit fields', 'AI entities'],
  },
  {
    key: 'infrastructure',
    title: 'Infrastructure',
    status: 'Framework',
    summary: 'Deployment readiness, environment configuration, queues for long AI jobs, storage, monitoring, backup, and secure secrets.',
    components: ['Environment policy', 'Queue workers', 'Object storage', 'Monitoring and backups'],
  },
];

const aiWorkflows = [
  ['Document intake', 'Upload or connect approved regulatory, supplier, or price documents for extraction review.'],
  ['Structured extraction', 'Convert document content into product, price, supplier, and inventory proposal rows.'],
  ['Reconciliation', 'Compare extracted content with the existing product master, stock, price, and supplier records.'],
  ['Approval queue', 'Show differences inline, support bulk approval, and keep sensitive actions pending human review.'],
  ['Controlled apply', 'Only update product, regulatory price, or inventory-related fields after approval and audit logging.'],
];

const posReadiness = [
  ['Teller session', 'Open till, teller PIN, branch, terminal, opening cash, supervisor approval, and status.'],
  ['Fast sale', 'Barcode search, product search, category filter, cart, discounts, tax, hold/retrieve sale.'],
  ['Dispensing safety', 'Prescription-required alerts, pharmacist override, FEFO batch assignment, and stock validation.'],
  ['Payment control', 'Cash, wallet, card, insurance, credit, institution pay-later, OTP, and receipt output readiness.'],
  ['Till close', 'Expected cash, physical cash, variance, supervisor review, closure report, and audit trail.'],
];

const inventoryReadiness = [
  ['Product master', 'Approved products, generics, categories, strength, SKU, barcode, and prescription flags.'],
  ['Batch and expiry', 'FEFO sorting, stock locations, expiry watchlists, low-stock thresholds, and controlled adjustments.'],
  ['Receiving', 'PO-linked receiving, quantity checks, supplier references, batch capture, cost, and selling price.'],
  ['Offline policy', 'Lookup can be offline; stock changes stay pending sync and must not overwrite online inventory blindly.'],
  ['Shelf arrangement', 'AI can propose shelf/warehouse placement, but pharmacist or inventory officer approves changes.'],
];

const supplierReadiness = [
  ['Supplier categories', 'Wholesale Pharmacy, Manufacturer, Distributor, Importer, Local Supplier, Service Provider, Delivery Supplier, Technology/API Supplier, Other.'],
  ['Wholesale profile', 'Minimum order, payment terms, regions, dispatch lead time, returns, credit limit, and catalog readiness.'],
  ['Procurement flow', 'Retail request, wholesale confirmation, payment proof, dispatch, delivery, receipt acknowledgment, then inventory update.'],
  ['Data boundary', 'Wholesale users should only see their business data; retail demand shared only in aggregated form.'],
];

const settingsBlueprint = [
  ['Offline mode', 'Admin chooses which services can work offline by global policy, tenant override, service, branch, and risk level.'],
  ['Integration gateway', 'AI proposes connector mappings, sandbox tests them, and waits for administrator approval before activation.'],
  ['Numbering and receipts', 'Receipt, invoice, POS, prescription, RRA/EBM placeholders, and payment gateway settings stay configurable.'],
  ['Notification policy', 'Email, SMS, WhatsApp, OTP validity, templates, delivery status, and approval notifications.'],
  ['Deployment readiness', 'Frontend framework is active; backend migrations and production deployment remain separate approval phases.'],
];

const posWorkspaceItems: Array<{ key: PosWorkspaceKey; label: string; description: string }> = [
  { key: 'overview', label: 'Overview Summary', description: 'Sales, customers, prescriptions, charts, and queues' },
  { key: 'pos', label: 'POS Counter', description: 'Fast sale, cart, customer, insurance, payment, receipt' },
  { key: 'customers', label: 'Customers / Patients', description: 'Customer records, invoice-ready capture, bulk tools' },
  { key: 'prescriptions', label: 'Prescriptions', description: 'Rx capture, AI extraction, previous records' },
  { key: 'sales-performance', label: 'Sales Register', description: '15-row register, review detail, export' },
  { key: 'payment-receipt', label: 'Receipts & Payments', description: 'Payments, balances, printer, WhatsApp, email' },
];

const supplierWorkspaceItems: Array<{ key: SupplierWorkspaceKey; label: string; description: string }> = [
  { key: 'overview', label: 'Overview Summary', description: 'Supplier charts, PO signals, receiving alerts' },
  { key: 'create-supplier', label: 'Create Supplier', description: 'Supplier profile and category setup' },
  { key: 'supplier-list', label: 'Supplier List', description: '15-row register with bulk controls' },
  { key: 'create-purchase-order', label: 'Create Purchase Order', description: 'PO builder and approval-ready draft' },
  { key: 'outstanding-purchase-orders', label: 'Outstanding PO List', description: 'Draft, approved, partial, and delayed POs' },
  { key: 'receive-purchase-order', label: 'Receive Purchase Order', description: 'PO-linked stock receiving and batch capture' },
  { key: 'received-purchase-orders', label: 'Received PO List', description: 'Received register and export tools' },
  { key: 'general-items-overview', label: 'General Items Management', description: 'Non-sale operational stock overview and controls' },
  { key: 'general-item-categories', label: 'General Item Categories', description: 'Admin-controlled categories for consistent analytics' },
  { key: 'general-item-master', label: 'General Item Master', description: 'Reusable non-pharmaceutical purchasing records' },
  { key: 'general-item-stock', label: 'General Item Stock', description: 'Locations, balances, valuation, and low-stock control' },
  { key: 'general-item-receiving', label: 'General Item Receiving', description: 'Receive non-sale operational stock separately' },
  { key: 'general-item-usage', label: 'General Item Issues and Usage', description: 'Record department usage and stock issues' },
];

const financeWorkspaceItems: Array<{ key: FinanceWorkspaceKey; label: string; description: string }> = [
  { key: 'overview', label: 'Finance Overview', description: 'Cards, charts, and finance position' },
  { key: 'finance-flow', label: 'Finance Flow', description: 'Procurement invoices, approval, and payment' },
  { key: 'exception-focus', label: 'Exception Focus', description: 'Overdue, partial, variance, and approval risks' },
  { key: 'credits-receivables', label: 'Customer Credits / Receivables', description: 'Credit setup and receivable creation' },
  { key: 'receivable-register', label: 'Receivable Register', description: '15-row register with bulk and export tools' },
  { key: 'collection', label: 'Collection', description: 'Payment collection and selected detail' },
  { key: 'financial-statements', label: 'AI Financial Statements', description: 'Manual refresh statements and reconciliations' },
];

const adhocReportWorkspaceItems: Array<{ key: AdhocReportWorkspaceKey; label: string; description: string }> = [
  { key: 'overview', label: 'Overview Summary', description: 'Today operating picture and core ad-hoc reports' },
  { key: 'operation-alerts', label: 'Operation Alerts', description: 'Real operating alerts from tenant figures' },
  { key: 'review-queues', label: 'Review Queues', description: 'Credit, supplier, receiving, and sales queues' },
  { key: 'executive-summary', label: 'Executive Operating Summary', description: 'Management interpretation of the period' },
  { key: 'decision-note', label: 'Decision Note', description: 'Daily decisions and handover prompts' },
  { key: 'operation-checklist', label: 'Operation Checklist', description: 'Manager checklist before close' },
  { key: 'priority-follow-up', label: 'Priority Follow-up', description: 'Manager review notes and follow-up list' },
];

const homeWidgetOptions: Array<{ key: HomeWidgetKey; label: string; description: string }> = [
  { key: 'summary', label: 'Access summary', description: 'Roles, permissions, assignments, scopes' },
  { key: 'tenant-dashboard', label: 'Tenant dashboard', description: 'Daily pharmacy control for tenant users' },
  { key: 'quick-actions', label: 'Quick actions', description: 'Open the most-used operating pages' },
  { key: 'system-experience', label: 'System experience', description: 'Commercial framework and module direction' },
  { key: 'role-workspaces', label: 'Role workspaces', description: 'Recommended dashboard by user type' },
];

const adminUserActions = [
  ['Create User', 'Add staff with phone/email identity, role, tenant, branch, language, and 2FA requirement.'],
  ['Edit User', 'Update profile, job title, branch, role, market, contact details, and notification preferences.'],
  ['Delete User', 'Delete only draft or unactivated records after permission and audit checks.'],
  ['Deactivate User', 'Suspend login while retaining audit history, sales ownership, and approval records.'],
];

const financialStatementItems = [
  ['Trial Balance', 'AI-assisted draft generated from posted account movements after manual refresh.'],
  ['General Ledger', 'Account-level transaction trail prepared for finance review and export.'],
  ['Cash Flow', 'Operating cash view based on sales collection, supplier payments, and adjustments.'],
  ['Income Statement', 'Revenue, cost, margin, and operating expense view for management review.'],
  ['Balance Sheet', 'Stock value, cash, receivables, payables, and equity-position draft.'],
  ['Bank Reconciliation', 'Bank receipts and payments matched against recorded transactions.'],
  ['MoMo Reconciliation', 'Mobile money references compared with POS and receivable payments.'],
  ['Cash Reconciliation', 'Teller cash expected versus counted cash and approved variance notes.'],
];

function loadStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

type AdminRouteSnapshot = {
  section?: string;
  inventory?: string;
  insurance?: string;
  pos?: string;
  supplier?: string;
  finance?: string;
  reports?: string;
  ai?: string;
  adminPanel?: string;
  scrollY?: string;
};

function readAdminRouteSnapshot(): AdminRouteSnapshot {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const stored = localStorage.getItem('ubuzima.admin.route.snapshot.v2');
    const saved = stored ? JSON.parse(stored) as AdminRouteSnapshot : {};

    return {
      ...saved,
      section: params.get('section') || saved.section,
      inventory: params.get('inventory') || saved.inventory,
      insurance: params.get('insurance') || saved.insurance,
      pos: params.get('pos') || saved.pos,
      supplier: params.get('supplier') || saved.supplier,
      finance: params.get('finance') || saved.finance,
      reports: params.get('reports') || saved.reports,
      ai: params.get('ai') || saved.ai,
      adminPanel: params.get('adminPanel') || saved.adminPanel,
      scrollY: params.get('scrollY') || saved.scrollY,
    };
  } catch {
    return {};
  }
}

function writeAdminRouteSnapshot(snapshot: AdminRouteSnapshot): void {
  try {
    localStorage.setItem(
      'ubuzima.admin.route.snapshot.v2',
      JSON.stringify(snapshot),
    );

    const hash = new URLSearchParams(
      Object.entries(snapshot).reduce<Record<string, string>>(
        (values, [key, value]) => {
          if (value !== undefined && value !== '') {
            values[key] = value;
          }

          return values;
        },
        {},
      ),
    ).toString();

    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}#${hash}`,
    );
  } catch {
    // Route persistence must never block the app.
  }
}

function hasAdminRouteRestoreRequest(): boolean {
  const snapshot = readAdminRouteSnapshot();
  return Boolean(snapshot.section);
}

function restoredAdminSection(): AdminSectionKey | null {
  const snapshot = readAdminRouteSnapshot();
  const section = snapshot.section;

  if (section && section in sectionMeta) {
    return section as AdminSectionKey;
  }

  return null;
}

function loadStoredActiveSection(): AdminSectionKey {
  const snapshot = readAdminRouteSnapshot();
  const stored =
    snapshot.section ||
    storedAdminValue('section', '') ||
    localStorage.getItem(activeSectionStorageKey);

  if (stored && stored in sectionMeta) {
    return stored as AdminSectionKey;
  }

  return 'overview';
}

function ModuleReadinessGrid({
  items,
}: {
  items: Array<[string, string]>;
}) {
  return (
    <div className="module-readiness-grid">
      {items.map(([title, text]) => (
        <article key={title}>
          <strong>{title}</strong>
          <span>{text}</span>
        </article>
      ))}
    </div>
  );
}

function ModuleLandingCards<K extends string>({
  moduleName,
  items,
  activeKey,
  onOpen,
}: {
  moduleName: string;
  items: Array<{ key: K; label: string; description: string }>;
  activeKey: K;
  onOpen: (key: K) => void;
}) {
  return (
    <section className="module-landing-card-grid" aria-label={`${moduleName} pages`}>
      {items.map((item) => (
        <article
          key={item.key}
          className={`module-landing-card ${activeKey === item.key ? 'active' : ''}`}
        >
          <div>
            <span>{moduleName}</span>
            <h3>{item.label}</h3>
            <p>{item.description}</p>
          </div>
          <button type="button" onClick={() => onOpen(item.key)}>
            Open Module
          </button>
        </article>
      ))}
    </section>
  );
}

function ModulePageIntro({
  eyebrow,
  title,
  description,
  status,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
}) {
  return (
    <section className="module-page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
      <span>{status}</span>
    </section>
  );
}

function DedicatedModuleHeader({
  eyebrow,
  title,
  description,
  dashboardLabel = 'Main Dashboard',
  onDashboard,
}: {
  eyebrow: string;
  title: string;
  description: string;
  dashboardLabel?: string;
  onDashboard: () => void;
}) {
  return (
    <header className="dedicated-module-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button
        type="button"
        className="secondary-action"
        onClick={onDashboard}
      >
        {dashboardLabel}
      </button>
    </header>
  );
}

function ModuleWorkspaceRail<K extends string>({
  label,
  items,
  activeKey,
  onSelect,
}: {
  label: string;
  items: Array<{ key: K; label: string; description: string }>;
  activeKey: K;
  onSelect: (key: K) => void;
}) {
  return (
    <aside className="module-section-rail" aria-label={`${label} sections`}>
      <span>{label}</span>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={activeKey === item.key ? 'active' : ''}
          onClick={() => onSelect(item.key)}
        >
          <strong>{item.label}</strong>
          <small>{item.description}</small>
        </button>
      ))}
    </aside>
  );
}

function BulkActionStrip({ label = 'Selected rows' }: { label?: string }) {
  return (
    <div className="bulk-action-row" aria-label={`${label} bulk actions`}>
      <button type="button">Bulk edit</button>
      <button type="button">Export</button>
      <button type="button">Bulk approval</button>
      <button type="button" className="danger">Bulk delete</button>
    </div>
  );
}

function FocusRegisterPreview({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<[string, string, string, string]>;
}) {
  return (
    <article className="panel wide focus-register-panel">
      <div className="panel-heading-row">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <BulkActionStrip label={title} />
      </div>

      <div className="focus-register-table">
        {rows.slice(0, 15).map(([primary, secondary, status, amount]) => (
          <div key={`${primary}-${secondary}`}>
            <span>
              <strong>{primary}</strong>
              <small>{secondary}</small>
            </span>
            <span>{status}</span>
            <small>{amount}</small>
            <button type="button">Open detail</button>
          </div>
        ))}
      </div>
    </article>
  );
}


function createPosCheckoutKey(): string {
  const secureUuid =
    globalThis.crypto?.randomUUID?.();

  if (secureUuid) {
    return `pos-${secureUuid}`;
  }

  return [
    'pos',
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
  ].join('-');
}

type B2TenantSecurityRole = {
  code?: string | null;
  name?: string | null;
  role?: {
    code?: string | null;
    name?: string | null;
  } | null;
};

type B2TenantSecurityUser = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  job_title?: string | null;
  status?: string | null;
  two_factor_required?: boolean | null;
  roles?: B2TenantSecurityRole[];
};

type B2TenantSecurityRoleTemplate = {
  code: string;
  name: string;
  description?: string | null;
  permissions?: string[];
};

type B2TenantUserForm = {
  name: string;
  email: string;
  phone: string;
  job_title: string;
  role_code: string;
  status: string;
  password: string;
  two_factor_required: boolean;
};

const emptyB2TenantUserForm: B2TenantUserForm = {
  name: '',
  email: '',
  phone: '',
  job_title: '',
  role_code: '',
  status: 'active',
  password: '',
  two_factor_required: true,
};

function b2AsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function extractB2TenantSlug(profile: unknown): string {
  const record = b2AsRecord(profile);
  const tenant = b2AsRecord(record.tenant);
  const currentTenant = b2AsRecord(record.current_tenant);
  const activeTenant = b2AsRecord(record.active_tenant);

  const candidates = [
    record.tenant_slug,
    tenant.slug,
    currentTenant.slug,
    activeTenant.slug,
    record.slug,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();

    if (value) {
      return value;
    }
  }

  return 'ubuzima-plus';
}

function getB2RoleCode(user: B2TenantSecurityUser): string {
  const firstRole = Array.isArray(user.roles) ? user.roles[0] : null;
  const nestedRole = b2AsRecord(firstRole?.role);

  return String(firstRole?.code ?? nestedRole.code ?? '').trim();
}

function getB2RoleName(user: B2TenantSecurityUser): string {
  const firstRole = Array.isArray(user.roles) ? user.roles[0] : null;
  const nestedRole = b2AsRecord(firstRole?.role);

  return String(firstRole?.name ?? nestedRole.name ?? getB2RoleCode(user) ?? 'Role pending').trim();
}

function generateB2TemporaryPassword(): string {
  const segment = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36).slice(-4);

  return `Ubuzima-${segment}-${stamp}!`;
}

function TenantSecurityUserManagementPanel({
  token,
  profile,
}: {
  token: string;
  profile: unknown;
}) {
  const tenantSlug = extractB2TenantSlug(profile);
  const [users, setUsers] = useState<B2TenantSecurityUser[]>([]);
  const [roles, setRoles] = useState<B2TenantSecurityRoleTemplate[]>([]);
  const [form, setForm] = useState<B2TenantUserForm>(emptyB2TenantUserForm);
  const [editingUser, setEditingUser] = useState<B2TenantSecurityUser | null>(null);
  const [resetTarget, setResetTarget] = useState<B2TenantSecurityUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetMustChange, setResetMustChange] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const roleOptions = roles.length > 0
    ? roles
    : [
        { code: 'tenant_admin', name: 'Tenant Admin' },
        { code: 'cashier', name: 'Cashier / POS User' },
        { code: 'pharmacist', name: 'Pharmacist' },
        { code: 'inventory_officer', name: 'Inventory Officer' },
      ];

  async function loadUsers(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const [roleResponse, userResponse] = await Promise.all([
        getTenantSecurityRoleTemplates(token, tenantSlug),
        getTenantSecurityUsers(token, tenantSlug),
      ]);

      const loadedRoles = Array.isArray(roleResponse.roles)
        ? roleResponse.roles as B2TenantSecurityRoleTemplate[]
        : [];

      setRoles(loadedRoles);
      setUsers(Array.isArray(userResponse.users) ? userResponse.users as B2TenantSecurityUser[] : []);

      setForm((current) => ({
        ...current,
        role_code: current.role_code || loadedRoles[0]?.code || 'tenant_admin',
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load tenant users.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, [token, tenantSlug]);

  function startNewUser(): void {
    setEditingUser(null);
    setForm({
      ...emptyB2TenantUserForm,
      role_code: roleOptions[0]?.code ?? 'tenant_admin',
      password: generateB2TemporaryPassword(),
    });
    setNotice('Create a handover-ready user with a clear role, active status, and controlled temporary password.');
    setError(null);
  }

  function startEditUser(user: B2TenantSecurityUser): void {
    setEditingUser(user);
    setForm({
      name: user.name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      job_title: user.job_title ?? '',
      role_code: getB2RoleCode(user) || roleOptions[0]?.code || 'tenant_admin',
      status: user.status ?? 'active',
      password: '',
      two_factor_required: Boolean(user.two_factor_required),
    });
    setNotice(`Editing ${user.name}. Password changes are handled through Admin Reset Password.`);
    setError(null);
  }

  async function saveUser(): Promise<void> {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      if (!form.name.trim()) {
        throw new Error('Name is required.');
      }

      if (!form.email.trim()) {
        throw new Error('Email is required.');
      }

      if (!form.role_code.trim()) {
        throw new Error('Role is required.');
      }

      const payload = {
        tenant_slug: tenantSlug,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        job_title: form.job_title.trim() || undefined,
        access_assignment_mode: 'predefined_role' as const,
        role_code: form.role_code,
        status: form.status,
        two_factor_required: form.two_factor_required,
      };

      if (editingUser) {
        await updateTenantSecurityUser(token, tenantSlug, editingUser.id, payload);
        setNotice(`User updated: ${form.name.trim()}.`);
      } else {
        const response = await createTenantSecurityUser(token, tenantSlug, {
          ...payload,
          password: form.password.trim() || undefined,
        });

        setNotice(
          response.temporary_password
            ? `User created. Temporary password: ${response.temporary_password}`
            : `User created: ${form.name.trim()}.`,
        );
      }

      setEditingUser(null);
      setForm({
        ...emptyB2TenantUserForm,
        role_code: roleOptions[0]?.code ?? 'tenant_admin',
      });

      await loadUsers();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save user.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openResetPassword(user: B2TenantSecurityUser): void {
    const generated = generateB2TemporaryPassword();

    setResetTarget(user);
    setResetPassword(generated);
    setResetConfirmPassword(generated);
    setResetMustChange(true);
    setNotice(`Prepare a controlled password reset for ${user.name}.`);
    setError(null);
  }

  async function submitPasswordReset(): Promise<void> {
    if (!resetTarget) {
      return;
    }

    setIsResetting(true);
    setError(null);
    setNotice(null);

    try {
      if (resetPassword.length < 8) {
        throw new Error('The new password must be at least 8 characters.');
      }

      if (resetPassword !== resetConfirmPassword) {
        throw new Error('Password confirmation does not match.');
      }

      await adminResetTenantSecurityUserPassword(
        token,
        tenantSlug,
        resetTarget.id,
        {
          password: resetPassword,
          password_confirmation: resetConfirmPassword,
          must_change_password: resetMustChange,
        },
      );

      setNotice(`Password reset completed for ${resetTarget.name}.`);
      setResetTarget(null);
      setResetPassword('');
      setResetConfirmPassword('');

      await loadUsers();
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : 'Unable to reset password.',
      );
    } finally {
      setIsResetting(false);
    }
  }

  const activeUsers = users.filter((user) => String(user.status ?? '').toLowerCase() === 'active').length;
  const twoFactorUsers = users.filter((user) => Boolean(user.two_factor_required)).length;

  return (
    <section className="ubuzima-user-management-shell">
      <div className="ubuzima-user-management-hero">
        <div>
          <p className="eyebrow">Admin users</p>
          <h2>User creation and access handover</h2>
          <p className="muted">
            Manage staff identity, tenant role, active status, two-factor readiness,
            and controlled administrator password resets from one practical surface.
          </p>
        </div>
        <div className="ubuzima-user-management-actions">
          <button type="button" onClick={startNewUser}>
            Create user
          </button>
          <button type="button" className="secondary-action" onClick={() => void loadUsers()} disabled={isLoading}>
            {isLoading ? 'Refreshing…' : 'Refresh users'}
          </button>
        </div>
      </div>

      <div className="ubuzima-user-management-summary">
        <article>
          <span>Total users</span>
          <strong>{users.length}</strong>
          <small>Tenant: {tenantSlug}</small>
        </article>
        <article>
          <span>Active users</span>
          <strong>{activeUsers}</strong>
          <small>Ready for handover</small>
        </article>
        <article>
          <span>2FA required</span>
          <strong>{twoFactorUsers}</strong>
          <small>Security posture</small>
        </article>
      </div>

      {notice ? <div className="form-success">{notice}</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      <div className="ubuzima-user-management-grid">
        <form
          className="ubuzima-user-form-card"
          onSubmit={(event) => {
            event.preventDefault();
            void saveUser();
          }}
        >
          <div className="section-heading">
            <div>
              <span>{editingUser ? 'Update user' : 'Create user'}</span>
              <h3>{editingUser ? editingUser.name : 'New staff account'}</h3>
              <p className="muted">
                Clean handover fields only: identity, role, status, and security.
              </p>
            </div>
          </div>

          <div className="ubuzima-user-form-sections">
            <fieldset>
              <legend>Identity</legend>
              <label>
                <span>Full name</span>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Staff full name" />
              </label>
              <label>
                <span>Email</span>
                <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@company.rw" />
              </label>
              <label>
                <span>Phone</span>
                <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+250..." />
              </label>
              <label>
                <span>Job title</span>
                <input value={form.job_title} onChange={(event) => setForm((current) => ({ ...current, job_title: event.target.value }))} placeholder="Cashier, Pharmacist, Manager..." />
              </label>
            </fieldset>

            <fieldset>
              <legend>Access</legend>
              <label>
                <span>Role</span>
                <select value={form.role_code} onChange={(event) => setForm((current) => ({ ...current, role_code: event.target.value }))}>
                  {roleOptions.map((role) => (
                    <option key={role.code} value={role.code}>
                      {role.name || role.code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                  <option value="active">Active</option>
                  <option value="invited">Invited</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="ubuzima-user-check-row">
                <input type="checkbox" checked={form.two_factor_required} onChange={(event) => setForm((current) => ({ ...current, two_factor_required: event.target.checked }))} />
                <span>Require two-factor setup</span>
              </label>
            </fieldset>

            <fieldset>
              <legend>Security</legend>
              <label>
                <span>{editingUser ? 'Password reset handled separately' : 'Temporary password'}</span>
                <input
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={editingUser ? 'Use Admin Reset Password' : 'Optional temporary password'}
                  disabled={Boolean(editingUser)}
                />
              </label>
              <p className="muted">
                New users can receive a temporary password. Existing users should be reset through the audited Admin Reset Password action.
              </p>
            </fieldset>
          </div>

          <div className="ubuzima-user-form-footer">
            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : editingUser ? 'Update user' : 'Create user'}
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setEditingUser(null);
                setForm({
                  ...emptyB2TenantUserForm,
                  role_code: roleOptions[0]?.code ?? 'tenant_admin',
                });
              }}
            >
              Clear form
            </button>
          </div>
        </form>

        <aside className="ubuzima-user-reset-card">
          <div className="section-heading">
            <div>
              <span>Admin Reset Password</span>
              <h3>{resetTarget ? resetTarget.name : 'Select a user'}</h3>
              <p className="muted">
                Reset passwords without reactivating old inactive accounts manually.
              </p>
            </div>
          </div>

          {resetTarget ? (
            <div className="ubuzima-user-reset-form">
              <label>
                <span>New password</span>
                <input value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
              </label>
              <label>
                <span>Confirm password</span>
                <input value={resetConfirmPassword} onChange={(event) => setResetConfirmPassword(event.target.value)} />
              </label>
              <label className="ubuzima-user-check-row">
                <input type="checkbox" checked={resetMustChange} onChange={(event) => setResetMustChange(event.target.checked)} />
                <span>Require password change at next login</span>
              </label>
              <div className="ubuzima-user-form-footer">
                <button type="button" onClick={() => void submitPasswordReset()} disabled={isResetting}>
                  {isResetting ? 'Resetting…' : 'Reset password'}
                </button>
                <button type="button" className="secondary-action" onClick={() => setResetTarget(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="muted">
              Use the Reset Password action in the user table. The action revokes old access and prepares a clean handover login.
            </p>
          )}
        </aside>
      </div>

      <section className="ubuzima-user-table-card">
        <div className="section-heading">
          <div>
            <span>Staff register</span>
            <h3>Tenant users</h3>
          </div>
        </div>

        <div className="ubuzima-user-table-scroll">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>2FA</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5}>No users loaded yet.</td>
                </tr>
              ) : users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                    {user.phone ? <small>{user.phone}</small> : null}
                  </td>
                  <td>
                    <strong>{getB2RoleName(user)}</strong>
                    <small>{user.job_title || 'Job title pending'}</small>
                  </td>
                  <td>
                    <span className={`ubuzima-user-status ubuzima-user-status--${String(user.status ?? 'pending').toLowerCase()}`}>
                      {user.status || 'pending'}
                    </span>
                  </td>
                  <td>{user.two_factor_required ? 'Required' : 'Optional'}</td>
                  <td>
                    <div className="ubuzima-user-row-actions">
                      <button type="button" onClick={() => startEditUser(user)}>
                        Manage
                      </button>
                      <button type="button" className="secondary-action" onClick={() => openResetPassword(user)}>
                        Reset Password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function App() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [staffLoginLanguage, setStaffLoginLanguage] = useState<StaffLoginLanguage>(readStoredStaffLanguage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [unreadMailCount, setUnreadMailCount] = useState(0);
  const [twoFactorFlow, setTwoFactorFlow] = useState<TwoFactorFlowState | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [trustThisDevice, setTrustThisDevice] = useState(true);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[] | null>(null);
  const [loginSuccess, setLoginSuccess] =
    useState<LoginExperience | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [passwordResetEmail, setPasswordResetEmail] = useState('');
  const [passwordResetStatus, setPasswordResetStatus] = useState('');
  const [isRequestingPasswordReset, setIsRequestingPasswordReset] = useState(false);
  const [accessCheck, setAccessCheck] = useState<AccessCheckState>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [pharmaCore, setPharmaCore] = useState<PharmaCoreState>({
    profile: null,
    branches: null,
    departments: null,
  });
  const [isLoadingPharmaCore, setIsLoadingPharmaCore] = useState(false);
  const [pharmaCoreError, setPharmaCoreError] = useState('');
  const [activeSection, setActiveSection] = useState<AdminSectionKey>(loadStoredActiveSection);
  const [hasAppliedRoleLanding, setHasAppliedRoleLanding] = useState(() => hasAdminRouteRestoreRequest());
  const [navigationStack, setNavigationStack] = useState<AdminSectionKey[]>([]);
  const [activeErpWorkspace, setActiveErpWorkspace] = useState<ErpWorkspaceKey>('erp-overview');
  const [activeSolution, setActiveSolution] = useState<SolutionKey>('pharmaco');
  const [activePharmaSegment, setActivePharmaSegment] = useState<PharmaSegmentKey>('retail');
  const [activePharmaFeature, setActivePharmaFeature] = useState<PharmaFeatureKey>('ai-model');
  const [activeAiWorkspace, setActiveAiWorkspace] = useState<AiWorkspaceKey>(() => (readAdminRouteSnapshot().ai || storedAdminValue('aiWorkspace', 'model-registry')) as AiWorkspaceKey);
  const [activeAdminPanelWorkspace, setActiveAdminPanelWorkspace] = useState<AdminPanelWorkspaceKey>(() => (readAdminRouteSnapshot().adminPanel || storedAdminValue('adminPanelWorkspace', 'backend-api')) as AdminPanelWorkspaceKey);
  const [activeInsuranceWorkspace, setActiveInsuranceWorkspace] = useState<InsuranceWorkspaceKey>(() => (readAdminRouteSnapshot().insurance || storedAdminValue('insuranceWorkspace', 'overview')) as InsuranceWorkspaceKey);
  const [activePosWorkspace, setActivePosWorkspace] = useState<PosWorkspaceKey>(() => (readAdminRouteSnapshot().pos || storedAdminValue('posWorkspace', 'overview')) as PosWorkspaceKey);
  const [isPosDayOpen, setIsPosDayOpen] = useState(false);
  const [posSession, setPosSession] = useState<PosSession | null>(null);
  const [isLoadingPosSession, setIsLoadingPosSession] = useState(false);
  const [isSavingPosSession, setIsSavingPosSession] = useState(false);
  const [posDeclaredCashAmount, setPosDeclaredCashAmount] = useState('0');
  const [posOpeningMode, setPosOpeningMode] = useState<'fresh-start' | 'handover'>('fresh-start');
  const [posStartingCashBalance, setPosStartingCashBalance] = useState('0');
  const [posCustomerType, setPosCustomerType] = useState<'walk-in' | 'existing-customer' | 'insurance-customer' | 'corporate-customer'>('walk-in');
  const [posPrescriptionStatus, setPosPrescriptionStatus] = useState<'not-required' | 'required' | 'captured' | 'manual-review'>('not-required');
  const [posPaymentMethod, setPosPaymentMethod] = useState<'cash' | 'momo' | 'card' | 'insurance' | 'credit'>('cash');
  const [posInsuranceProvider, setPosInsuranceProvider] = useState('');
  const [posInsuranceInstitution, setPosInsuranceInstitution] = useState('');
  const [posCustomerInvoice] = useState<'no' | 'yes'>('no');
  const [isConfirmingPosTransaction, setIsConfirmingPosTransaction] = useState(false);
  const [posConfirmedSale, setPosConfirmedSale] = useState<PharmaSale | null>(null);
  const [posConfirmedPayment, setPosConfirmedPayment] = useState<PharmaPayment | null>(null);
  const [posRecentSales, setPosRecentSales] = useState<PharmaSale[]>([]);
  const [posRecentSearch, setPosRecentSearch] = useState('');
  const [posRecentFilter, setPosRecentFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [isLoadingPosRecentSales, setIsLoadingPosRecentSales] = useState(false);
  const [posInvoiceDelivery, setPosInvoiceDelivery] = useState<'printer' | 'whatsapp' | 'email'>('printer');
  const [posInvoiceContact, setPosInvoiceContact] = useState('');
  const [posDiscountAmount, setPosDiscountAmount] = useState('0');
  const [posTransactionConfirmed, setPosTransactionConfirmed] = useState(false);
  const [posLiveBusinessAnalytics, setPosLiveBusinessAnalytics] = useState<UbuzimaHandoverLiveAnalytics>(null);
  const [posRecentTransactionsWithUsers, setPosRecentTransactionsWithUsers] = useState<PharmaRecentTransactionWithUser[]>([]);
  const [posLiveBusinessAnalyticsNotice, setPosLiveBusinessAnalyticsNotice] = useState<string | null>(null);
  const [posCheckoutKey, setPosCheckoutKey] = useState(createPosCheckoutKey);
  const [posCloseMode, setPosCloseMode] = useState<'handover' | 'final-close'>('handover');
  const [posTillZeroized, setPosTillZeroized] = useState(false);
  const [posDepositProof, setPosDepositProof] = useState('');
  const [posNotice, setPosNotice] = useState('');
  const [posCartItems, setPosCartItems] = useState<Array<{
    code: string;
    name: string;
    strength: string;
    quantity: number;
    unitPrice: number;
    originalUnitPrice: number;
    usedUnitPrice: number;
    unitPriceDifference: number;
    priceOverrideApplied: boolean;
    originalSellingUnitPrice: number;
    usedSellingUnitPrice: number;
    sellingUnitPriceDifference: number;
    batchId: number;
    productId: number;
    batchNumber: string;
    availableQuantity: number;
    expiryDate: string | null;
    locationName: string;
    sellingUnit: string;
    baseUnit: string;
    quantityPerSellingUnit: number;
    sellingUnitQuantity: number;
    otherQuantity: number;
  }>>([]);
  const [posRenderedCartItems, setPosRenderedCartItems] = useState<typeof posCartItems>([]);
  const [posRenderedCartMetrics, setPosRenderedCartMetrics] = useState({ lineCount: 0, totalQuantity: 0, subtotal: 0 });
  const [posCounterItems, setPosCounterItems] = useState<typeof posCartItems>([]);
  const [posCounterCart, setPosCounterCart] = useState<{
    items: typeof posCartItems;
    lineCount: number;
    totalQuantity: number;
    subtotal: number;
  }>({
    items: [],
    lineCount: 0,
    totalQuantity: 0,
    subtotal: 0,
  });
  const [posInventoryBatches, setPosInventoryBatches] = useState<PharmaStockBatch[]>([]);
  const [isLoadingPosInventory, setIsLoadingPosInventory] = useState(false);
  const [posInventoryError, setPosInventoryError] = useState('');
  const [posInventoryLoadedAt, setPosInventoryLoadedAt] = useState('');
  const [posInsurancePartners, setPosInsurancePartners] = useState<
    InsurancePartner[]
  >([]);
  const [isLoadingPosInsurancePartners, setIsLoadingPosInsurancePartners] =
    useState(false);
  const [posInsurancePartnersError, setPosInsurancePartnersError] =
    useState('');
  const [posSaleSummary, setPosSaleSummary] = useState<PosSaleSummary>(() =>
    calculatePosSaleSummary({
      cartItems: [],
      discountAmount: '0',
      paymentMethod: 'cash',
      insuranceProviderId: '',
      insuranceInstitutionId: '',
    }),
  );
  const [posSummaryRefreshKey, setPosSummaryRefreshKey] = useState(0);
  const [posTerminalSearch, setPosTerminalSearch] = useState('');
  const [posQuantityProduct, setPosQuantityProduct] = useState<{
    code: string;
    name: string;
    strength: string;
    quantity: number;
    unitPrice: number;
    batchId: number;
    productId: number;
    batchNumber: string;
    availableQuantity: number;
    expiryDate: string | null;
    locationName: string;
    sellingUnit: string;
    baseUnit: string;
    quantityPerSellingUnit: number;
    allowOtherQuantity: boolean;
    defaultQuantityMode: 'selling_unit' | 'other_quantity' | 'combined';
  } | null>(null);
  const [posSellingUnitQuantity, setPosSellingUnitQuantity] = useState('1');
  const [posOtherQuantity, setPosOtherQuantity] = useState('0');
  const [posSellingAmount, setPosSellingAmount] = useState('');
  const [activeSupplierWorkspace, setActiveSupplierWorkspace] = useState<SupplierWorkspaceKey>(() => (readAdminRouteSnapshot().supplier || storedAdminValue('supplierWorkspace', 'overview')) as SupplierWorkspaceKey);
  const [activeFinanceWorkspace, setActiveFinanceWorkspace] = useState<FinanceWorkspaceKey>(() => (readAdminRouteSnapshot().finance || storedAdminValue('financeWorkspace', 'overview')) as FinanceWorkspaceKey);
  const [activeAdhocReportWorkspace, setActiveAdhocReportWorkspace] = useState<AdhocReportWorkspaceKey>(() => (readAdminRouteSnapshot().reports || storedAdminValue('reportsWorkspace', 'overview')) as AdhocReportWorkspaceKey);
  const [activeNotificationWorkspace, setActiveNotificationWorkspace] = useState<'overview' | 'create-notification' | 'recurring-notifications' | 'platform-notification-center'>('overview');
  const [activePharmacistChatWorkspace, setActivePharmacistChatWorkspace] = useState<'in-app-chat' | 'whatsapp-chat'>('in-app-chat');
  const [activeInventoryView, setActiveInventoryView] =
    useState<InventoryView>(() => {
      const snapshotView = readAdminRouteSnapshot().inventory;
      const requestedView =
        snapshotView ||
        storedAdminValue('inventoryWorkspace', '') ||
        new URLSearchParams(window.location.search)
          .get('inventoryView');

      const supportedViews: InventoryView[] = [
        'overview',
        'low-stock',
        'shelf',
        'batches',
        'near-expiry',
        'product-master',
        'product-inventory',
        'locations',
      ];

      return requestedView &&
        supportedViews.includes(
          requestedView as InventoryView,
        )
        ? requestedView as InventoryView
        : 'overview';
    });
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [changePasswordNotice, setChangePasswordNotice] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [openPrincipalMenus, setOpenPrincipalMenus] = useState<Partial<Record<AdminSectionKey, boolean>>>({});
  const [homeWidgets, setHomeWidgets] = useState<Record<HomeWidgetKey, boolean>>({
    summary: true,
    'tenant-dashboard': true,
    'quick-actions': true,
    'system-experience': false,
    'role-workspaces': false,
  });
  const [leftMenuAppearance, setLeftMenuAppearance] = useState<LeftMenuAppearance>(loadStoredLeftMenuAppearance);
  const [dashboardCardVisibility, setDashboardCardVisibility] = useState<Record<DashboardCardKey, boolean>>(loadStoredDashboardCardVisibility);
  const [dashboardCardFieldVisibility, setDashboardCardFieldVisibility] = useState<Record<DashboardCardKey, Record<string, boolean>>>(loadStoredDashboardCardFieldVisibility);
  const [openMenuGroups, setOpenMenuGroups] = useState<Record<MenuGroupKey, boolean>>({
    erp: false,
    solutions: false,
    ai: false,
    admin: false,
    'tenant-ops': true,
    'tenant-admin': true,
    market: false,
  });
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [mobileAppScreen, setMobileAppScreen] = useState<UbuzimaMobileAppScreen>('business');
  const [isPwaInstallAvailable, setIsPwaInstallAvailable] = useState(false);
  const [isPwaInstalling, setIsPwaInstalling] = useState(false);
  const [isStandalonePwa, setIsStandalonePwa] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  const profile = session?.profile;
  const shouldShowTenantOperationsDashboard = Boolean(profile?.scope.is_tenant || profile?.scope.is_branch);
  const builtVisibleMenuGroups = useMemo(
    () => buildVisibleMenuGroups(profile),
    [profile],
  );
  const isAdminProfile =
    profileHasAdminAuthority(profile);
  const isOwnerProfile =
    profileHasOwnerRole(profile);
  const visibleMenuGroups = useMemo(() => {
    if (!isOwnerProfile) {
      return builtVisibleMenuGroups;
    }

    return builtVisibleMenuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          !ownerTechnicalSectionKeys.has(item.key),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [
    builtVisibleMenuGroups,
    isOwnerProfile,
  ]);
  const visibleSectionKeys = useMemo(() => {
    const keys = new Set<AdminSectionKey>();

    if (isAdminProfile) {
      keys.add('overview');
    }

    visibleMenuGroups.forEach((group) =>
      group.items.forEach((item) =>
        keys.add(item.key),
      ),
    );

    return keys;
  }, [
    profile,
    visibleMenuGroups,
  ]);

  useEffect(() => {
    if (
      mobileAppScreen !== 'business' ||
      activeSection === 'overview' ||
      !visibleSectionKeys.has('overview') ||
      !window.matchMedia('(max-width: 860px)').matches
    ) {
      return;
    }

    navigateToSection('overview');
  }, [
    activeSection,
    mobileAppScreen,
    visibleSectionKeys,
  ]);

  const principalMenuItems = useMemo(
    () => visibleMenuGroups.flatMap((group) => group.items.map((item) => ({ group, item }))),
    [visibleMenuGroups],
  );
  const currentSection = sectionMeta[activeSection] ?? sectionMeta.overview;
  const activeLeftSubmenuLabel =
    leftMenuSubmenus[activeSection]?.find((submenu) => {
      if (activeSection === 'inventory') return submenu.target === activeInventoryView;
      if (activeSection === 'insurance') return submenu.target === activeInsuranceWorkspace;
      if (activeSection === 'pos') return submenu.target === activePosWorkspace;
      if (activeSection === 'suppliers') return submenu.target === activeSupplierWorkspace;
      if (activeSection === 'finance') return submenu.target === activeFinanceWorkspace;
      if (activeSection === 'reports') return submenu.target === activeAdhocReportWorkspace;
      if (activeSection === 'ai-center') return submenu.target === activeAiWorkspace;
      if (activeSection === 'admin-panel') return submenu.target === activeAdminPanelWorkspace;
      if (activeSection === 'notifications') return submenu.target === activeNotificationWorkspace;
      if (activeSection === 'pharmacist-chat') return submenu.target === activePharmacistChatWorkspace;
      return false;
    })?.label ?? null;
  const loginStatusText = profile
    ? `Logged in now as ${profile!.user.name || profile!.user.email}`
    : '';
  const profileDisplayName = profile?.user.name || profile?.user.email || 'User';
  const profileInitials = profileDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
  const profileInstitution =
    profile?.tenant_assignments?.[0]?.tenant?.name ||
    (profile?.scope.type ? `${profile!.scope.type} scope` : 'Ubuzima+');
  const profileAvatarUrl = ((profile?.user ?? {}) as { avatar_url?: string }).avatar_url || '';
  const nextStaffLoginLanguage = staffLoginLanguages[
    (staffLoginLanguages.indexOf(staffLoginLanguage) + 1) % staffLoginLanguages.length
  ];

  const appEnv = import.meta.env;
  const tenantWebsiteSignals = [
    profile?.user?.email,
    ...(profile?.tenant_assignments ?? []).map((assignment) => assignment.tenant?.slug),
    ...(profile?.tenant_assignments ?? []).map((assignment) => assignment.tenant?.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const ubuzimaPlusWebsiteUrl = appEnv.VITE_UBUZIMA_PLUS_WEBSITE_URL || 'https://www.ubuzimaplus.com';
  const vitaPharmaWebsiteUrl = appEnv.VITE_VITAPHARMA_WEBSITE_URL || 'https://www.vitapharmaafrica.com';
  const isVitaPharmaContext =
    tenantWebsiteSignals.includes('vitapharma') ||
    tenantWebsiteSignals.includes('vita pharma') ||
    tenantWebsiteSignals.includes('vita-pharma') ||
    tenantWebsiteSignals.includes('vitapharmaafrica');

  const publicWebsiteUrl = isVitaPharmaContext ? vitaPharmaWebsiteUrl : ubuzimaPlusWebsiteUrl;
  const publicWebsiteLabel = isVitaPharmaContext ? 'Vita Pharma website' : 'Ubuzima+ website';

  const posSessionTenantSlug =
    profile?.tenant_assignments?.[0]?.tenant?.slug || '';

  const posSessionBranchId =
    profile?.scope.branch_id ??
    profile?.tenant_assignments?.find(
      (assignment) =>
        assignment.status === 'active' &&
        assignment.branch?.status === 'active',
    )?.branch?.id ??
    profile?.tenant_assignments?.find(
      (assignment) => assignment.branch,
    )?.branch?.id ??
    pharmaCore.branches?.branches?.[0]?.id ??
    null;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('ubuzima-react-mobile-shell');

    return () => {
      root.classList.remove('ubuzima-react-mobile-shell');
      root.classList.remove('ubuzima-react-mobile-drawer-open');
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(
      'ubuzima-react-mobile-drawer-open',
      isMobileDrawerOpen,
    );

    return () => {
      document.documentElement.classList.remove(
        'ubuzima-react-mobile-drawer-open',
      );
    };
  }, [isMobileDrawerOpen]);

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);

    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);

    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  useEffect(() => {
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const updateStandaloneState = () => {
      setIsStandalonePwa(
        standaloneQuery.matches ||
          (window.navigator as Navigator & { standalone?: boolean })
            .standalone === true,
      );
    };

    const handleInstallChange = (event: Event) => {
      setIsPwaInstallAvailable(
        Boolean((event as UbuzimaPwaInstallChangeEvent).detail?.isAvailable),
      );
      setIsPwaInstalling(false);
    };

    const handleInstallComplete = () => {
      setIsPwaInstallAvailable(false);
      setIsPwaInstalling(false);
      updateStandaloneState();
    };

    updateStandaloneState();

    standaloneQuery.addEventListener('change', updateStandaloneState);
    window.addEventListener(
      'ubuzima:pwa-install-change',
      handleInstallChange,
    );
    window.addEventListener(
      'ubuzima:pwa-install-complete',
      handleInstallComplete,
    );
    window.addEventListener('appinstalled', handleInstallComplete);

    return () => {
      standaloneQuery.removeEventListener('change', updateStandaloneState);
      window.removeEventListener(
        'ubuzima:pwa-install-change',
        handleInstallChange,
      );
      window.removeEventListener(
        'ubuzima:pwa-install-complete',
        handleInstallComplete,
      );
      window.removeEventListener('appinstalled', handleInstallComplete);
    };
  }, []);

  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [
    activeSection,
    activeInventoryView,
    activeInsuranceWorkspace,
    activePosWorkspace,
    activeSupplierWorkspace,
    activeFinanceWorkspace,
    activeAdhocReportWorkspace,
    activeAiWorkspace,
    activeAdminPanelWorkspace,
  ]);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 861px)');
    const closeDesktopDrawer = () => {
      if (desktopQuery.matches) {
        setIsMobileDrawerOpen(false);
      }
    };

    closeDesktopDrawer();
    desktopQuery.addEventListener('change', closeDesktopDrawer);

    return () => {
      desktopQuery.removeEventListener('change', closeDesktopDrawer);
    };
  }, []);

  useEffect(() => {
    if (
      activeSection !== 'pos' ||
      !session?.token ||
      !posSessionTenantSlug
    ) {
      return;
    }

    let cancelled = false;

    setIsLoadingPosSession(true);

    void getCurrentPosSession({
      token: session.token,
      tenantSlug: posSessionTenantSlug,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        const currentPosSession = response.session;

        setPosSession(currentPosSession);
        setIsPosDayOpen(currentPosSession?.status === 'open');
        setPosTillZeroized(
          currentPosSession?.balance_cleared ?? false,
        );

        if (currentPosSession?.status === 'open') {
          setPosDeclaredCashAmount(
            String(currentPosSession.expected_cash_amount),
          );
        } else {
          setPosDeclaredCashAmount('0');
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setPosNotice(
          error instanceof Error
            ? error.message
            : 'Unable to load the current POS session.',
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPosSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeSection,
    posSessionTenantSlug,
    session?.token,
  ]);

  useEffect(() => {
    const language = staffLanguageCode(staffLoginLanguage);
    let frame = 0;

    const applyUsability = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        applyInputKeyboardModes();
        applyRuntimeLanguage(language);
      });
    };

    applyUsability();

    const observer = new MutationObserver(applyUsability);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [activeAdminPanelWorkspace, activeAdhocReportWorkspace, activeAiWorkspace, activeErpWorkspace, activeFinanceWorkspace, activeInsuranceWorkspace, activePharmaFeature, activePosWorkspace, activeSection, activeSupplierWorkspace, loginMethod, profile, staffLoginLanguage]);


  useEffect(() => {
    const saveRoute = () => {
      const snapshot: AdminRouteSnapshot = {
        section: activeSection,
        inventory: activeInventoryView,
        insurance: activeInsuranceWorkspace,
        pos: activePosWorkspace,
        supplier: activeSupplierWorkspace,
        finance: activeFinanceWorkspace,
        reports: activeAdhocReportWorkspace,
        ai: activeAiWorkspace,
        adminPanel: activeAdminPanelWorkspace,
        scrollY: String(window.scrollY),
      };

      writeAdminRouteSnapshot(snapshot);

      rememberAdminState('section', activeSection);
      rememberAdminState('inventoryWorkspace', activeInventoryView);
      rememberAdminState('insuranceWorkspace', activeInsuranceWorkspace);
      rememberAdminState('posWorkspace', activePosWorkspace);
      rememberAdminState('supplierWorkspace', activeSupplierWorkspace);
      rememberAdminState('financeWorkspace', activeFinanceWorkspace);
      rememberAdminState('reportsWorkspace', activeAdhocReportWorkspace);
      rememberAdminState('aiWorkspace', activeAiWorkspace);
      rememberAdminState('adminPanelWorkspace', activeAdminPanelWorkspace);
    };

    saveRoute();

    window.addEventListener('scroll', saveRoute, { passive: true });
    window.addEventListener('beforeunload', saveRoute);
    window.addEventListener('pagehide', saveRoute);

    return () => {
      saveRoute();
      window.removeEventListener('scroll', saveRoute);
      window.removeEventListener('beforeunload', saveRoute);
      window.removeEventListener('pagehide', saveRoute);
    };
  }, [
    activeSection,
    activeInventoryView,
    activeInsuranceWorkspace,
    activePosWorkspace,
    activeSupplierWorkspace,
    activeFinanceWorkspace,
    activeAdhocReportWorkspace,
    activeAiWorkspace,
    activeAdminPanelWorkspace,
  ]);

  useEffect(() => {
    const snapshot = readAdminRouteSnapshot();
    const scrollY = Number(snapshot.scrollY || 0);

    if (!scrollY) {
      return;
    }

    [150, 500, 1000, 1800, 2800].forEach((delay) => {
      window.setTimeout(() => {
        window.scrollTo(0, scrollY);
      }, delay);
    });
  }, [activeSection]);

  useEffect(() => {
    const saveRoute = () => {
      writeAdminRouteSnapshot({
        section: activeSection,
        inventory: activeInventoryView,
        insurance: activeInsuranceWorkspace,
        pos: activePosWorkspace,
        supplier: activeSupplierWorkspace,
        finance: activeFinanceWorkspace,
        reports: activeAdhocReportWorkspace,
        ai: activeAiWorkspace,
        adminPanel: activeAdminPanelWorkspace,
        scrollY: String(window.scrollY),
      });

      rememberAdminState('section', activeSection);
      rememberAdminState('inventoryWorkspace', activeInventoryView);
      rememberAdminState('insuranceWorkspace', activeInsuranceWorkspace);
      rememberAdminState('posWorkspace', activePosWorkspace);
      rememberAdminState('supplierWorkspace', activeSupplierWorkspace);
      rememberAdminState('financeWorkspace', activeFinanceWorkspace);
      rememberAdminState('reportsWorkspace', activeAdhocReportWorkspace);
      rememberAdminState('aiWorkspace', activeAiWorkspace);
      rememberAdminState('adminPanelWorkspace', activeAdminPanelWorkspace);
    };

    saveRoute();

    window.addEventListener('scroll', saveRoute, { passive: true });
    window.addEventListener('beforeunload', saveRoute);
    window.addEventListener('pagehide', saveRoute);

    return () => {
      saveRoute();
      window.removeEventListener('scroll', saveRoute);
      window.removeEventListener('beforeunload', saveRoute);
      window.removeEventListener('pagehide', saveRoute);
    };
  }, [
    activeSection,
    activeInventoryView,
    activeInsuranceWorkspace,
    activePosWorkspace,
    activeSupplierWorkspace,
    activeFinanceWorkspace,
    activeAdhocReportWorkspace,
    activeAiWorkspace,
    activeAdminPanelWorkspace,
  ]);

  useEffect(() => {
    const scrollY = Number(readAdminRouteSnapshot().scrollY || 0);

    if (!scrollY) {
      return;
    }

    [150, 500, 1000, 1800, 2800].forEach((delay) => {
      window.setTimeout(() => {
        window.scrollTo(0, scrollY);
      }, delay);
    });
  }, [activeSection, activeInventoryView, activeInsuranceWorkspace, activePosWorkspace]);

  useEffect(() => {
    const workspaceBySection: Record<string, string> = {
      inventory: activeInventoryView,
      insurance: activeInsuranceWorkspace,
      pos: activePosWorkspace,
      suppliers: activeSupplierWorkspace,
      finance: activeFinanceWorkspace,
      reports: activeAdhocReportWorkspace,
      'ai-center': activeAiWorkspace,
      'admin-panel': activeAdminPanelWorkspace,
      notifications: activeNotificationWorkspace,
      'pharmacist-chat': activePharmacistChatWorkspace,
    };

    const activeWorkspace = workspaceBySection[activeSection] || 'main';
    const scrollKey = `ubuzima.admin.scroll.${activeSection}.${activeWorkspace}`;
    let frame = 0;

    const restore = window.setTimeout(() => {
      const stored = sessionStorage.getItem(scrollKey);
      if (stored) {
        window.requestAnimationFrame(() => {
          window.scrollTo(0, Number(stored) || 0);
        });
      }
    }, 250);

    const save = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        sessionStorage.setItem(scrollKey, String(window.scrollY));
      });
    };

    const saveNow = () => {
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    };

    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('beforeunload', saveNow);
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', saveNow);

    return () => {
      window.clearTimeout(restore);
      window.cancelAnimationFrame(frame);
      saveNow();
      window.removeEventListener('scroll', save);
      window.removeEventListener('beforeunload', saveNow);
      window.removeEventListener('pagehide', saveNow);
      document.removeEventListener('visibilitychange', saveNow);
    };
  }, [
    activeSection,
    activeInventoryView,
    activeInsuranceWorkspace,
    activePosWorkspace,
    activeSupplierWorkspace,
    activeFinanceWorkspace,
    activeAdhocReportWorkspace,
    activeAiWorkspace,
    activeAdminPanelWorkspace,
    activeNotificationWorkspace,
    activePharmacistChatWorkspace,
  ]);



  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const stored = loadStoredSession();

      if (!stored?.token) {
        setIsRestoringSession(false);
        return;
      }

      try {
        const verifiedProfile = await getAuthenticatedProfile(stored.token);

        if (!cancelled) {
          const verifiedSession = {
            token: stored.token,
            profile: verifiedProfile,
          };

          localStorage.setItem(storageKey, JSON.stringify(verifiedSession));
          setSession(verifiedSession);
        }
      } catch {
        localStorage.removeItem(storageKey);

        if (!cancelled) {
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setIsRestoringSession(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);


  const permissionGroups = useMemo(() => {
    if (!profile) return [];

    return [
      {
        title: 'Security',
        items: profile!.permissions.filter((item) => item.includes('roles') || item.includes('audit')),
      },
      {
        title: 'Operations 360',
        items: profile!.permissions.filter((item) => item.startsWith('pharmaco.')),
      },
      {
        title: 'AI & Platform',
        items: profile!.permissions.filter((item) => item.includes('ai') || item.includes('platform')),
      },
    ].filter((group) => group.items.length > 0);
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(activeSectionStorageKey, activeSection);

    const existing = readAdminRouteSnapshot();
    writeAdminRouteSnapshot({
      ...existing,
      section: activeSection,
      scrollY: String(window.scrollY),
    });
  }, [activeSection]);

  useEffect(() => {
    localStorage.setItem(staffLanguageStorageKey, staffLoginLanguage);
  }, [staffLoginLanguage]);

  useEffect(() => {
    localStorage.setItem(leftMenuAppearanceStorageKey, JSON.stringify(leftMenuAppearance));
  }, [leftMenuAppearance]);

  useEffect(() => {
    localStorage.setItem(dashboardCardVisibilityStorageKey, JSON.stringify(dashboardCardVisibility));
  }, [dashboardCardVisibility]);

  useEffect(() => {
    localStorage.setItem(dashboardCardFieldVisibilityStorageKey, JSON.stringify(dashboardCardFieldVisibility));
  }, [dashboardCardFieldVisibility]);

  const leftMenuStyle = {
    '--left-menu-accent': leftMenuAppearance.primaryColor,
    '--left-menu-title-color': leftMenuAppearance.titleColor,
    '--left-menu-card-padding-y': leftMenuAppearance.density === 'compact' ? '0.34rem' : '0.52rem',
    '--left-menu-card-padding-x': leftMenuAppearance.density === 'compact' ? '0.48rem' : '0.62rem',
    '--left-menu-submenu-font-size': leftMenuAppearance.density === 'compact' ? '0.7rem' : '0.76rem',
  } as React.CSSProperties;

  useEffect(() => {
    if (!session?.token) {
      setUnreadMailCount(0);
      return;
    }

    let cancelled = false;

    async function loadUnreadMailCount() {
      try {
        const response = await getCorporateMailOverview(session!.token, 'inbox');
        const unread = response.folders.reduce((sum, folder) => sum + folder.unread_count, 0);

        if (!cancelled) {
          setUnreadMailCount(unread);
        }
      } catch {
        if (!cancelled) {
          setUnreadMailCount(0);
        }
      }
    }

    void loadUnreadMailCount();

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  useEffect(() => {
    if (!profile) return;

    const preferredSection =
      preferredOperationalSection(profile);

    const firstVisibleSection =
      Array.from(visibleSectionKeys)[0];

    const fallbackSection =
      visibleSectionKeys.has(preferredSection)
        ? preferredSection
        : firstVisibleSection
          ?? 'overview';

    if (!hasAppliedRoleLanding) {
      const restoredSection = restoredAdminSection();

      if (
        restoredSection &&
        visibleSectionKeys.has(restoredSection)
      ) {
        if (restoredSection !== activeSection) {
          setActiveSection(restoredSection);
        }

        setHasAppliedRoleLanding(true);
        return;
      }

      if (fallbackSection !== activeSection) {
        setActiveSection(fallbackSection);
      }

      setHasAppliedRoleLanding(true);
      return;
    }

    const restoredSection = restoredAdminSection();

    if (
      restoredSection &&
      visibleSectionKeys.has(restoredSection) &&
      activeSection !== restoredSection
    ) {
      setActiveSection(restoredSection);
      setHasAppliedRoleLanding(true);
      return;
    }

    if (!visibleSectionKeys.has(activeSection)) {
      setActiveSection(fallbackSection);
    }
  }, [
    activeSection,
    hasAppliedRoleLanding,
    profile,
    visibleSectionKeys,
  ]);

  function navigateToSection(section: AdminSectionKey) {
    setIsProfileMenuOpen(false);

    const firstVisibleSection =
      Array.from(visibleSectionKeys)[0];

    const permittedSection =
      visibleSectionKeys.has(section)
        ? section
        : firstVisibleSection
          ?? 'overview';

    if (permittedSection === activeSection) {
      return;
    }

    setNavigationStack(
      (current) =>
        [activeSection, ...current].slice(0, 10),
    );
    setActiveSection(permittedSection);
  }

  function activateModuleDefaultPage(item: MenuItem) {
    const firstSubmenu = leftMenuSubmenus[item.key]?.[0];

    if (item.key === 'inventory' && firstSubmenu?.target) setActiveInventoryView(firstSubmenu.target as InventoryView);
    if (item.key === 'insurance' && firstSubmenu?.target) setActiveInsuranceWorkspace(firstSubmenu.target as InsuranceWorkspaceKey);
    if (item.key === 'pos' && firstSubmenu?.target) setActivePosWorkspace(firstSubmenu.target as PosWorkspaceKey);
    if (item.key === 'suppliers' && firstSubmenu?.target) setActiveSupplierWorkspace(firstSubmenu.target as SupplierWorkspaceKey);
    if (item.key === 'finance' && firstSubmenu?.target) setActiveFinanceWorkspace(firstSubmenu.target as FinanceWorkspaceKey);
    if (item.key === 'reports' && firstSubmenu?.target) setActiveAdhocReportWorkspace(firstSubmenu.target as AdhocReportWorkspaceKey);
    if (item.key === 'ai-center' && firstSubmenu?.target) setActiveAiWorkspace(firstSubmenu.target as AiWorkspaceKey);
    if (item.key === 'admin-panel' && firstSubmenu?.target) setActiveAdminPanelWorkspace(firstSubmenu.target as AdminPanelWorkspaceKey);
    if (item.key === 'notifications' && firstSubmenu?.target) setActiveNotificationWorkspace(firstSubmenu.target as 'overview' | 'create-notification' | 'recurring-notifications' | 'platform-notification-center');
    if (item.key === 'pharmacist-chat' && firstSubmenu?.target) setActivePharmacistChatWorkspace(firstSubmenu.target as 'in-app-chat' | 'whatsapp-chat');
  }

  function togglePrincipalMenu(item: MenuItem) {
    setOpenPrincipalMenus((current) => ({
      ...current,
      [item.key]: !current[item.key],
    }));

    handleMenuItemClick(item);
  }

  function openPrincipalMenu(item: MenuItem) {
    setOpenPrincipalMenus((current) => ({
      ...current,
      [item.key]: true,
    }));
  }

  function handleMenuItemClick(item: MenuItem) {
    if (item.key === 'erp' && item.context) {
      setActiveErpWorkspace(item.context as ErpWorkspaceKey);
    }

    if (item.key === 'solution-portfolio' && item.context) {
      setActiveSolution(item.context as SolutionKey);
      if (item.context === 'pharmaco') {
        setActivePharmaSegment('retail');
      }
    }

    if (item.key === 'ai-center' && item.context) {
      setActiveAiWorkspace(item.context as AiWorkspaceKey);
    }

    if (item.key === 'admin-panel' && item.context) {
      setActiveAdminPanelWorkspace(item.context as AdminPanelWorkspaceKey);
    }

    activateModuleDefaultPage(item);
    navigateToSection(item.key);
  }

  function handleLeftSubmenuClick(item: MenuItem, submenu: LeftMenuSubmenu) {
    openPrincipalMenu(item);

    if (item.key === 'inventory' && submenu.target) {
      setActiveInventoryView(submenu.target as InventoryView);
      navigateToSection('inventory');
      return;
    }

    if (item.key === 'insurance' && submenu.target) {
      setActiveInsuranceWorkspace(submenu.target as InsuranceWorkspaceKey);
      navigateToSection('insurance');
      return;
    }

    if (item.key === 'pos' && submenu.target) setActivePosWorkspace(submenu.target as PosWorkspaceKey);
    if (item.key === 'suppliers' && submenu.target) setActiveSupplierWorkspace(submenu.target as SupplierWorkspaceKey);
    if (item.key === 'finance' && submenu.target) setActiveFinanceWorkspace(submenu.target as FinanceWorkspaceKey);
    if (item.key === 'reports' && submenu.target) setActiveAdhocReportWorkspace(submenu.target as AdhocReportWorkspaceKey);
    if (item.key === 'ai-center' && submenu.target) setActiveAiWorkspace(submenu.target as AiWorkspaceKey);
    if (item.key === 'admin-panel' && submenu.target) setActiveAdminPanelWorkspace(submenu.target as AdminPanelWorkspaceKey);
    if (item.key === 'notifications' && submenu.target) setActiveNotificationWorkspace(submenu.target as 'overview' | 'create-notification' | 'recurring-notifications' | 'platform-notification-center');
    if (item.key === 'pharmacist-chat' && submenu.target) setActivePharmacistChatWorkspace(submenu.target as 'in-app-chat' | 'whatsapp-chat');

    navigateToSection(item.key);
  }

  function isActiveLeftSubmenu(item: MenuItem, submenu: LeftMenuSubmenu) {
    if (activeSection !== item.key) return false;

    if (item.key === 'inventory') return submenu.target === activeInventoryView;
    if (item.key === 'insurance') return submenu.target === activeInsuranceWorkspace;
    if (item.key === 'pos') return submenu.target === activePosWorkspace;
    if (item.key === 'suppliers') return submenu.target === activeSupplierWorkspace;
    if (item.key === 'finance') return submenu.target === activeFinanceWorkspace;
    if (item.key === 'reports') return submenu.target === activeAdhocReportWorkspace;
    if (item.key === 'ai-center') return submenu.target === activeAiWorkspace;
    if (item.key === 'admin-panel') return submenu.target === activeAdminPanelWorkspace;
    if (item.key === 'notifications') return submenu.target === activeNotificationWorkspace;
    if (item.key === 'pharmacist-chat') return submenu.target === activePharmacistChatWorkspace;

    return false;
  }

  function isActiveMenuItem(item: MenuItem) {
    if (activeSection !== item.key) return false;

    if (item.key === 'erp') {
      return item.context === activeErpWorkspace;
    }

    if (item.key === 'solution-portfolio') {
      return item.context === activeSolution;
    }

    if (item.key === 'ai-center') {
      return item.context === activeAiWorkspace;
    }

    if (item.key === 'admin-panel') {
      return item.context === activeAdminPanelWorkspace;
    }

    return true;
  }

  function goBack() {
    const [previous, ...rest] = navigationStack;

    if (!previous) {
      return;
    }

    setNavigationStack(rest);
    setActiveSection(previous);
  }

  function navigateToMobileSection(
    section: AdminSectionKey,
    options: { posWorkspace?: PosWorkspaceKey } = {},
  ) {
    if (section === 'pos' && options.posWorkspace) {
      setActivePosWorkspace(options.posWorkspace);
    }

    navigateToSection(section);
    setIsMobileDrawerOpen(false);
  }

  function openNativeMobileSection(
    section: AdminSectionKey,
    options: {
      financeWorkspace?: FinanceWorkspaceKey;
      inventoryView?: InventoryView;
      posWorkspace?: PosWorkspaceKey;
      reportWorkspace?: AdhocReportWorkspaceKey;
      screen?: UbuzimaMobileAppScreen;
      supplierWorkspace?: SupplierWorkspaceKey;
    } = {},
  ) {
    if (section === 'inventory' && options.inventoryView) {
      setActiveInventoryView(options.inventoryView);
    }

    if (section === 'suppliers' && options.supplierWorkspace) {
      setActiveSupplierWorkspace(options.supplierWorkspace);
    }

    if (section === 'finance' && options.financeWorkspace) {
      setActiveFinanceWorkspace(options.financeWorkspace);
    }

    if (section === 'reports' && options.reportWorkspace) {
      setActiveAdhocReportWorkspace(options.reportWorkspace);
    }

    setMobileAppScreen(options.screen ?? mobileAppScreenForSection(section));
    navigateToMobileSection(section, {
      posWorkspace: options.posWorkspace,
    });
  }

  function handleNativeMobileScreenChange(screen: UbuzimaMobileAppScreen) {
    setMobileAppScreen(screen);

    if (screen === 'business') {
      if (visibleSectionKeys.has('overview')) {
        navigateToSection('overview');
      }
      return;
    }

    if (screen === 'sales' && visibleSectionKeys.has('pos')) {
      openNativeMobileSection('pos', {
        posWorkspace: 'overview',
        screen,
      });
      return;
    }

    if (screen === 'inventory' && visibleSectionKeys.has('inventory')) {
      openNativeMobileSection('inventory', {
        inventoryView: 'overview',
        screen,
      });
      return;
    }

    if (screen === 'procurement' && visibleSectionKeys.has('suppliers')) {
      openNativeMobileSection('suppliers', {
        supplierWorkspace: 'overview',
        screen,
      });
      return;
    }

    if (screen === 'general-stock') {
      if (visibleSectionKeys.has('general-stock-items')) {
        openNativeMobileSection('general-stock-items', {
          screen,
        });
        return;
      }

      if (visibleSectionKeys.has('suppliers')) {
        openNativeMobileSection('suppliers', {
          supplierWorkspace: 'general-items-overview',
          screen,
        });
      }
      return;
    }

    if (screen === 'sales' && visibleSectionKeys.has('finance')) {
      openNativeMobileSection('finance', {
        financeWorkspace: 'overview',
        screen,
      });
    }
  }

  function requestPwaInstall() {
    setIsPwaInstalling(true);
    window.dispatchEvent(new CustomEvent('ubuzima:pwa-install-request'));

    window.setTimeout(() => {
      setIsPwaInstalling(false);
    }, 1800);
  }

  function refreshMobileWorkspace() {
    window.dispatchEvent(new Event('ubuzima:refresh'));
  }

  function toggleMenuGroup(group: MenuGroupKey) {
    setOpenMenuGroups((current) => ({
      ...current,
      [group]: !current[group],
    }));
  }

  function persistSession(nextSession: StoredSession, trustedDeviceToken?: string) {
    localStorage.setItem(storageKey, JSON.stringify(nextSession));

    if (trustedDeviceToken) {
      localStorage.setItem(trustedDeviceStorageKey, trustedDeviceToken);
    }

    setSession(nextSession);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setTwoFactorFlow(null);
    setNewRecoveryCodes(null);
    setIsSubmitting(true);

    try {
      const response = await login({
        login_method: loginMethod,
        email: loginMethod === 'email' ? email.trim() : undefined,
        phone: loginMethod === 'phone' ? phone.trim() : undefined,
        password: loginMethod === 'email' ? password : undefined,
        pin: loginMethod === 'phone' ? pin : undefined,
        device_name: 'Ubuzima+ Admin Dashboard',
        trusted_device_token: localStorage.getItem(trustedDeviceStorageKey),
      });

      if ('status' in response && response.status?.startsWith('two_factor_')) {
        setTwoFactorFlow(response as TwoFactorFlowState);
        setPassword('');
        setPin('');
        return;
      }

      if (!('access_token' in response) || !('profile' in response)) {
        throw new Error('Login response did not include an authenticated session.');
      }

      const nextSession = {
        token: response.access_token,
        profile: response.profile,
      };

      persistSession(nextSession);

      setLoginSuccess(
        response.login_experience,
      );    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const targetEmail = (passwordResetEmail || email).trim();

    if (!targetEmail) {
      setPasswordResetStatus('Enter your staff email address before requesting a reset.');
      return;
    }

    setError('');
    setPasswordResetStatus('');
    setIsRequestingPasswordReset(true);

    try {
      const response = await requestPasswordReset({ email: targetEmail });
      setPasswordResetStatus(response.message);
    } catch (err) {
      setPasswordResetStatus(
        err instanceof Error
          ? err.message
          : 'Unable to submit the password reset request. Please contact the platform administrator.',
      );
    } finally {
      setIsRequestingPasswordReset(false);
    }
  }

  async function handleTwoFactorVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!twoFactorFlow) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const response = await verifyTwoFactor({
        challenge_token: twoFactorFlow.challenge_token,
        code: twoFactorCode,
        trust_device: trustThisDevice,
        device_name: 'Ubuzima+ Admin Dashboard',
      });

      const nextSession = {
        token: response.access_token,
        profile: response.profile,
      };

      setNewRecoveryCodes(response.recovery_codes);
      setTwoFactorFlow(null);
      setTwoFactorCode('');

      persistSession(
        nextSession,
        response.trusted_device
          ?.trusted_device_token,
      );

      setLoginSuccess(
        response.login_experience,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Two-factor verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    if (session?.token) {
      await logout(session!.token).catch(() => undefined);
    }

    localStorage.removeItem(storageKey);
    setLoginSuccess(null);    setSession(null);
    setAccessCheck(null);
    setPharmaCore({
      profile: null,
      branches: null,
      departments: null,
    });
    setPharmaCoreError('');
    setPosCartItems([]);
    setPosCounterItems([]);
    setPosCounterCart({ items: [], lineCount: 0, totalQuantity: 0, subtotal: 0 });
    setPosInventoryBatches([]);
    setPosInventoryError('');
    setPosInventoryLoadedAt('');
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.token) return;

    if (changePasswordForm.password !== changePasswordForm.password_confirmation) {
      setChangePasswordError('New password and confirmation do not match.');
      return;
    }

    setIsChangingPassword(true);
    setChangePasswordError('');
    setChangePasswordNotice('');

    try {
      const response = await changePassword(session!.token, changePasswordForm);
      persistSession({ token: session!.token, profile: response.profile });
      setChangePasswordNotice(response.message);
      setChangePasswordForm({ current_password: '', password: '', password_confirmation: '' });
    } catch (err) {
      setChangePasswordError(err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleAccessCheck(
    label: string,
    endpoint: 'security' | 'inventory' | 'ai',
    tenantSlug?: string,
  ) {
    if (!session?.token) return;

    setIsCheckingAccess(true);

    try {
      const result = await runAccessCheck(session!.token, endpoint, tenantSlug);
      setAccessCheck({ label, result });
    } finally {
      setIsCheckingAccess(false);
    }
  }

  async function loadPharmaCore() {
    if (!session?.token) return;

    const tenantSlug =
      profile?.tenant_assignments?.[0]?.tenant?.slug ||
      (profile?.scope?.is_tenant ? 'vitapharma' : '');

    if (!tenantSlug) {
      setPharmaCoreError('No tenant assignment is available for this account.');
      return;
    }

    setIsLoadingPharmaCore(true);
    setPharmaCoreError('');

    try {
      const profileResponse = await getPharmacyProfile(session!.token, tenantSlug);
      const branchesResponse = await getPharmaBranches(session!.token, tenantSlug);
      const firstBranch = branchesResponse.branches[0] ?? null;
      const departmentsResponse = firstBranch
        ? await getBranchDepartments(session!.token, tenantSlug, firstBranch.id)
        : null;

      setPharmaCore({
        profile: profileResponse,
        branches: branchesResponse,
        departments: departmentsResponse,
      });
    } catch (err) {
      setPharmaCoreError(err instanceof Error ? err.message : 'Unable to load Operations 360 data.');
    } finally {
      setIsLoadingPharmaCore(false);
    }
  }


  if (isRestoringSession) {
    return (
      <main
        className="session-restore-shell"
        aria-hidden="true"
      />
    );
  }

  if (!profile) {
    return (
      <main className="auth-shell auth-shell--identity">
        <section className="auth-side auth-info-panel">
          <img className="auth-logo" src={brandLogoSrc} alt="Ubuzima+" />
          <p className="eyebrow">Ubuzima+ Platform</p>
          <h1>Secure access for real pharmacy operations.</h1>
          <p className="auth-copy">
            Ubuzima+ connects PharmaCore 360 operations, tenant data, staff permissions, stock,
            POS, procurement, finance, ad-hoc reports, and controlled AI in one governed workspace.
          </p>

          <div className="auth-info-grid">
            <div>
              <strong>First tenant</strong>
              <span>VitaPharma onboarding</span>
            </div>
            <div>
              <strong>Staff security</strong>
              <span>Mandatory authenticator with trusted-device control</span>
            </div>
            <div>
              <strong>Operational modules</strong>
              <span>Inventory, POS, suppliers, finance, ad-hoc reports, AI</span>
            </div>
          </div>
        </section>

        <section className="auth-panel auth-form-panel">
          <div className="auth-language-row">
            <span>Staff Identity</span>
            <div>
              <a href={publicWebsiteUrl}>Back to website</a>
              <button type="button" onClick={() => setStaffLoginLanguage(nextStaffLoginLanguage)}>
                {staffLoginLanguage}
              </button>
            </div>
          </div>

          <div className="login-card">
            <p className="eyebrow">Sign in</p>
            <h2>Access your workspace</h2>
            <p className="auth-copy">
              Use your staff account. Access is tenant-aware and limited by your role, branch, package, and permissions.
            </p>

            <div className="login-method-tabs" aria-label="Login method">
              <button
                type="button"
                className={loginMethod === 'email' ? 'active' : ''}
                onClick={() => setLoginMethod('email')}
              >
                Email
              </button>
              <button
                type="button"
                className={loginMethod === 'phone' ? 'active' : ''}
                onClick={() => setLoginMethod('phone')}
              >
                Phone PIN
              </button>
            </div>

            {!twoFactorFlow ? (
              <form className="login-form" onSubmit={handleLogin}>
                {loginMethod === 'email' ? (
                  <>
                    <label>
                      Email address
                      <input
                        type="email"
                        inputMode="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="off"
                        required
                      />
                    </label>

                    <label>
                      Password
                      <div className="password-input-row">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          autoComplete="new-password"
                          required
                        />
                        <button
                          type="button"
                          className="password-visibility-button"
                          onClick={() => setShowPassword((current) => !current)}
                          aria-label={showPassword ? 'Hide password' : 'View password'}
                        >
                          {showPassword ? 'Hide' : 'View'}
                        </button>
                      </div>
                    </label>

                    <div className="login-assist-row">
                      <button
                        type="button"
                        className="auth-link-button"
                        onClick={() => {
                          setPasswordResetEmail(email);
                          setPasswordResetStatus('');
                          setIsPasswordResetOpen((current) => !current);
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <label>
                      Phone number
                      <input
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        autoComplete="off"
                        placeholder="+250..."
                        required
                      />
                    </label>

                    <label>
                      Staff PIN
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pin}
                        onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        autoComplete="new-password"
                        placeholder="Enter your PIN"
                        required
                      />
                    </label>
                  </>
                )}

                {error && <div className="form-error">{error}</div>}

                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Checking access...' : 'Continue'}
                </button>
              </form>
            ) : (
              <form className="login-form two-factor-login-form" onSubmit={handleTwoFactorVerify}>
                <div className="two-factor-login-copy">
                  <strong>
                    {twoFactorFlow.status === 'two_factor_setup_required'
                      ? 'Set up authenticator'
                      : 'Two-factor verification'}
                  </strong>
                  <span>{twoFactorFlow.message}</span>
                </div>

                {twoFactorFlow.setup && (
                  <div className="two-factor-login-setup">
                    <div dangerouslySetInnerHTML={{ __html: twoFactorFlow.setup.qr_svg }} />
                    <code>{twoFactorFlow.setup.manual_secret}</code>
                  </div>
                )}

                <label>
                  Authenticator or recovery code
                  <input
                    value={twoFactorCode}
                    onChange={(event) => setTwoFactorCode(event.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    required
                  />
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={trustThisDevice}
                    onChange={(event) => setTrustThisDevice(event.target.checked)}
                  />
                  Trust this device after approval
                </label>

                {error && <div className="form-error">{error}</div>}

                <button type="submit" disabled={isSubmitting || twoFactorCode.trim().length < 6}>
                  {isSubmitting ? 'Verifying...' : 'Verify and continue'}
                </button>
              </form>
            )}

            {newRecoveryCodes && (
              <div className="recovery-code-panel auth-recovery-panel">
                <h3>Recovery codes</h3>
                <p className="muted">Store these codes securely. They are shown once.</p>
                <div>
                  {newRecoveryCodes.map((code) => (
                    <code key={code}>{code}</code>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    );
  }

  const summaryGrid = (
    <section className="summary-grid compact-summary-grid">
      <article>
        <span>Active roles</span>
        <strong>{profile!.roles.length}</strong>
      </article>
      <article>
        <span>Permissions</span>
        <strong>{profile!.permissions.length}</strong>
      </article>
      <article>
        <span>Tenant assignments</span>
        <strong>{profile!.tenant_assignments.length}</strong>
      </article>
      <article>
        <span>Admin scopes</span>
        <strong>{profile!.admin_scopes.length}</strong>
      </article>
    </section>
  );

  const tenantOperationsPanel = (
    <article className="panel wide pharmaco-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Operation Helicopter View</h2>
          <p className="muted">
            Live tenant-scoped data from profile, branch, inventory, sales, finance, supplier, and department APIs.
          </p>
        </div>

        <button type="button" onClick={loadPharmaCore} disabled={isLoadingPharmaCore}>
          {isLoadingPharmaCore ? 'Loading...' : 'Load VitaPharma profile'}
        </button>
      </div>

      {pharmaCoreError && <div className="form-error">{pharmaCoreError}</div>}

      {pharmaCore.profile && (
        <div className="pharmaco-grid">
          <section className="pharmaco-card">
            <span className="section-label">Pharmacy profile</span>
            <h3>{pharmaCore.profile!.profile!.trading_name}</h3>
            <p>{pharmaCore.profile!.profile!.legal_name}</p>
            <div className="mini-facts">
              <span>Category: {pharmaCore.profile!.profile!.pharmacy_category}</span>
              <span>Regulator: {pharmaCore.profile!.profile!.regulator_name}</span>
              <span>Status: {pharmaCore.profile!.profile!.status}</span>
              <span>District: {pharmaCore.profile!.profile!.district ?? 'Not set'}</span>
            </div>
          </section>

          <section className="pharmaco-card">
            <span className="section-label">Capabilities</span>
            <div className="tag-list">
              {pharmaCore.profile!.profile!.capabilities.map((capability) => (
                <span key={capability}>{capability.replaceAll('_', ' ')}</span>
              ))}
            </div>
          </section>

          <section className="pharmaco-card">
            <span className="section-label">Insurance partners</span>
            <div className="tag-list">
              {pharmaCore.profile!.profile!.insurance_partners.map((partner) => (
                <span key={partner}>{partner}</span>
              ))}
            </div>
          </section>

          <section className="pharmaco-card">
            <span className="section-label">Operating hours</span>
            <div className="mini-facts">
              {Object.entries(pharmaCore.profile!.profile!.operating_hours).map(([day, hours]) => (
                <span key={day}>{day.replaceAll('_', ' ')}: {hours}</span>
              ))}
            </div>
          </section>
        </div>
      )}

      {pharmaCore.branches && (
        <div className="branch-preview">
          <h3>Branches</h3>
          {pharmaCore.branches.branches.map((branch) => (
            <div key={branch.id}>
              <strong>{branch.name}</strong>
              <span>{branch.code}</span>
              <span>{branch.branch_type}</span>
              <small>{branch.status}</small>
            </div>
          ))}
        </div>
      )}

      {pharmaCore.departments && (
        <div className="department-preview">
          <h3>{pharmaCore.departments.branch.name} departments</h3>
          {pharmaCore.departments.departments.map((department) => (
            <div key={department.id}>
              <strong>{department.name}</strong>
              <span>{department.code}</span>
              <span>{department.department_type}</span>
              <small>{department.is_revenue_center ? 'Revenue center' : 'Support unit'}</small>
            </div>
          ))}
        </div>
      )}
    </article>
  );

  const accessControlPanel = (
    <article className="panel wide">
      <h2>Live access control checks</h2>
      <p className="muted">
        These buttons call protected backend endpoints using your current Bearer token.
      </p>

      <div className="access-actions">
        <button
          type="button"
          onClick={() => handleAccessCheck('Security permission check', 'security')}
          disabled={isCheckingAccess}
        >
          Check security access
        </button>

        <button
          type="button"
          onClick={() => handleAccessCheck('VitaPharma inventory module check', 'inventory', 'vitapharma')}
          disabled={isCheckingAccess}
        >
          Check inventory access
        </button>

        <button
          type="button"
          onClick={() => handleAccessCheck('AI Center controlled-module check', 'ai', 'vitapharma')}
          disabled={isCheckingAccess}
        >
          Check AI Center access
        </button>
      </div>

      {accessCheck && (
        <div className={`access-result ${accessCheck.result.access?.status === 'granted' ? 'granted' : 'blocked'}`}>
          <strong>{accessCheck.label}</strong>
          <span>Status: {accessCheck.result.access?.status ?? accessCheck.result.status ?? 'unknown'}</span>
          {accessCheck.result.access?.area && <span>Area: {accessCheck.result.access.area}</span>}
          {accessCheck.result.access?.module && <span>Module: {accessCheck.result.access.module}</span>}
          {accessCheck.result.access?.tenant && <span>Tenant: {accessCheck.result.access.tenant}</span>}
          {accessCheck.result.message && <span>Message: {accessCheck.result.message}</span>}
          {accessCheck.result.missing_permissions?.length ? (
            <span>Missing: {accessCheck.result.missing_permissions.join(', ')}</span>
          ) : null}
        </div>
      )}
    </article>
  );

  const tenantAssignmentsPanel = (
    <article className="panel wide">
      <h2>Tenant assignments</h2>
      {profile!.tenant_assignments.length === 0 ? (
        <p className="muted">No tenant assignment is attached to this account.</p>
      ) : (
        <div className="tenant-table">
          {profile!.tenant_assignments.map((assignment) => (
            <div key={assignment.tenant.slug}>
              <strong>{assignment.tenant.name}</strong>
              <span>{assignment.branch?.name ?? 'All branches'}</span>
              <span>{assignment.job_title ?? 'Assigned user'}</span>
              <small>{assignment.status}</small>
            </div>
          ))}
        </div>
      )}
    </article>
  );

  function renderErpWorkspace() {
    const selectedErpModule = erpModules.find((module) => module.key === activeErpWorkspace) ?? erpModules[0];

    return (
      <section className="section-page">
<div className="workspace-selector erp-selector">
          {erpModules.map((module) => (
            <button
              key={module.key}
              type="button"
              className={activeErpWorkspace === module.key ? 'active' : ''}
              onClick={() => setActiveErpWorkspace(module.key)}
            >
              <strong>{module.title}</strong>
              <span>{module.status}</span>
            </button>
          ))}
        </div>

        <section className="erp-module-grid">
          <article className="panel">
            <h2>{selectedErpModule.title} workspace model</h2>
            <p className="muted">{selectedErpModule.summary}</p>
            <div className="framework-chip-list">
              {selectedErpModule.workspace.map((item) => (
                <small key={item}>{item}</small>
              ))}
            </div>
          </article>

          <article className="panel">
            <h2>Recommended access split</h2>
            <div className="workflow-list">
              <div><strong>Owner</strong><span>Executive health, risk, cash position, branch performance, and strategic approvals.</span></div>
              <div><strong>Finance</strong><span>Payables, receivables, collections, daily close, supplier aging, and exports.</span></div>
              <div><strong>Operator</strong><span>Only the task surface needed for the role, branch, tenant, and active package.</span></div>
            </div>
          </article>
        </section>

        {activeErpWorkspace === 'finance' && (
          <>
            <PayablesWorkflow token={session!.token} profile={profile!} />
            <ReceivablesWorkflow token={session!.token} profile={{ tenant: profile!.tenant_assignments?.[0]?.tenant }} />
          </>
        )}

        {activeErpWorkspace === 'procurement' && (
          <ProcurementWorkflow token={session!.token} profile={profile!} />
        )}

        {!['finance', 'procurement'].includes(activeErpWorkspace) && (
          <article className="panel wide roadmap-panel">
            <h2>Activation plan</h2>
            <p className="muted">
              This ERP workspace is visible in the framework so ChatGPT and future implementation can align
              with the platform architecture. Production actions stay inactive until backend permissions,
              data model, and tenant package activation are approved.
            </p>
          </article>
        )}
      </section>
    );
  }

  function renderPharmaFeatureContent() {
    const segmentConfig = pharmaFeaturesBySegment[activePharmaSegment];
    const selectedFeature = segmentConfig.features.find((feature) => feature.key === activePharmaFeature) ?? segmentConfig.features[0];

    return (
      <section className="pharma-feature-stage">
        <div className="feature-stage-heading">
          <div>
            <p className="eyebrow">Third section</p>
            <h2>{selectedFeature.title}</h2>
            <p className="muted">{selectedFeature.summary}</p>
          </div>
          <span>{selectedFeature.status}</span>
        </div>

        <div className="feature-action-grid">
          {selectedFeature.actions.map((action) => (
            <article key={action}>
              <strong>{action}</strong>
              <span>Visible only when the user role, tenant, package, and branch scope allow it.</span>
            </article>
          ))}
        </div>

        {selectedFeature.key === 'ai-model' && (
          <>
<AiOperationsPanel token={session!.token} profile={profile!} />
            <section className="ai-model-grid">
              {pharmaAiModels.map(([model, description]) => (
                <article key={model}>
                  <strong>{model}</strong>
                  <span>{description}</span>
                </article>
              ))}
            </section>
            {accessControlPanel}
          </>
        )}


        {selectedFeature.key === 'inventory' &&
          renderInventoryWorkspace()}

        {selectedFeature.key === 'pos' && (

          <>
<SalesDispensingReview token={session!.token} profile={profile!} />
          </>
        )}

        {selectedFeature.key === 'procurement' && (
          <>
<ProcurementWorkflow token={session!.token} profile={profile!} />
          </>
        )}

        {selectedFeature.key === 'reports' && (
          <>
            <PharmacoOperationsCommandCenter token={session!.token} profile={profile!} />
            <ReportingDashboard token={session!.token} profile={profile!} />
          </>
        )}

        {selectedFeature.key === 'product-master' && (
          <>
            <ProductInventoryPreview token={session!.token} profile={profile!} />
            <div className="product-inventory-actions-legacy-hidden" aria-hidden="true">

              <ProductInventoryActions token={session!.token} profile={profile!} />

            </div>
          </>
        )}

        {['prescriptions', 'customers'].includes(selectedFeature.key) && (
          <SalesDispensingReview token={session!.token} profile={profile!} />
        )}
      </section>
    );
  }

  function renderSolutionPortfolio() {
    const selectedSolution = solutionPortfolio.find((solution) => solution.key === activeSolution) ?? solutionPortfolio[0];
    const activeSegment = pharmaSegments.find((segment) => segment.key === activePharmaSegment) ?? pharmaSegments[0];
    const segmentConfig = pharmaFeaturesBySegment[activePharmaSegment];

    return (
      <section className="section-page">
<section className="solution-card-grid">
          {solutionPortfolio.map((solution) => (
            <button
              key={solution.key}
              type="button"
              className={activeSolution === solution.key ? 'active' : ''}
              onClick={() => setActiveSolution(solution.key)}
            >
              <span>{solution.status}</span>
              <strong>{solution.title}</strong>
              <small>{solution.audience}</small>
            </button>
          ))}
        </section>

        {activeSolution !== 'pharmaco' && (
          <article className="panel wide roadmap-panel">
            <h2>{selectedSolution.title} readiness</h2>
            <p className="muted">{selectedSolution.next}</p>
            <div className="framework-chip-list">
              <small>Coming soon</small>
              <small>Role-based activation required</small>
              <small>Tenant package pending</small>
            </div>
          </article>
        )}

        {activeSolution === 'pharmaco' && (
          <>
            <section className="pharma-segment-section">
              <div className="framework-heading">
                <div>
                  <p className="eyebrow">PharmaCore 360 dedicated menu</p>
                  <h2>Select the operating segment first.</h2>
                  <p className="muted">
                    These options appear directly below the fixed header when PharmaCore 360 is selected.
                    The detailed feature workspace opens underneath as the third section.
                  </p>
                </div>
                <div className="framework-scope-card">
                  <span>Active segment</span>
                  <strong>{activeSegment.label}</strong>
                  <small>{activeSegment.status}</small>
                </div>
              </div>

              <div className="segment-switcher">
                {pharmaSegments.map((segment) => (
                  <button
                    key={segment.key}
                    type="button"
                    className={activePharmaSegment === segment.key ? 'active' : ''}
                    onClick={() => {
                      setActivePharmaSegment(segment.key);
                      setActivePharmaFeature(pharmaFeaturesBySegment[segment.key].features[0]?.key ?? 'ai-model');
                    }}
                  >
                    <strong>{segment.label}</strong>
                    <span>{segment.status}</span>
                    <small>{segment.summary}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="pharma-feature-selector-panel">
              <div>
                <p className="eyebrow">Feature menu</p>
                <h2>{activeSegment.label} features</h2>
                <p className="muted">{segmentConfig.note}</p>
              </div>

              <div className="feature-tabs">
                {segmentConfig.features.map((feature) => (
                  <button
                    key={feature.key}
                    type="button"
                    className={activePharmaFeature === feature.key ? 'active' : ''}
                    onClick={() => setActivePharmaFeature(feature.key)}
                  >
                    <strong>{feature.title}</strong>
                    <span>{feature.status}</span>
                  </button>
                ))}
              </div>
            </section>

            {renderPharmaFeatureContent()}

            <section className="role-dashboard-section">
              <div>
                <p className="eyebrow">Role dashboards</p>
                <h2>Recommended dashboards by user type</h2>
                <p className="muted">
                  Admins and Ubuzima+ staff can see the portfolio flow. Tenant users should land on the
                  dashboard that matches their institution, branch, role, and activated package.
                </p>
              </div>
              <div className="role-dashboard-grid">
                {roleDashboardModels.map(([role, description]) => (
                  <article key={role}>
                    <strong>{role}</strong>
                    <span>{description}</span>
                  </article>
                ))}
              </div>
            </section>

            {tenantOperationsPanel}
          </>
        )}
      </section>
    );
  }

  function renderInventoryWorkspace() {
    return (
      <section
        className="section-page inventory-route-page"
        data-inventory-page={activeInventoryView}
        data-foundation-correction="AQUILA_INVENTORY_WORK_PACKAGE_2F_FOUNDATION_CORRECTION"
      >
        {/* AQUILA_INVENTORY_WORK_PACKAGE_2B_MODULE_HOME */}
        {/* AQUILA_INVENTORY_WORK_PACKAGE_2C_TABLE_POPUP_ALIGNMENT */}
        {/* AQUILA_INVENTORY_WORK_PACKAGE_2E_PROFESSIONAL_UPGRADE */}
        {/* AQUILA_INVENTORY_WORK_PACKAGE_2F_FOUNDATION_CORRECTION */}

        {activeInventoryView === 'overview' ? (
          <InventoryModuleHome
            token={session!.token}
            profile={profile!}
            onOpenWorkspace={setActiveInventoryView}
          />
        ) : (
          <InventoryWorkspaceFrame
            activeView={activeInventoryView}
            onOpenHome={() =>
              setActiveInventoryView('overview')
            }
          >
            <ProductInventoryPreview
              key={activeInventoryView}
              token={session!.token}
              profile={profile!}
              activeView={activeInventoryView}
              onActiveViewChange={setActiveInventoryView}
              showInternalNavigation={false}
            />
          </InventoryWorkspaceFrame>
        )}

        {activeInventoryView === 'product-master' && (
          <div
            className="product-inventory-actions-legacy-hidden"
            aria-hidden="true"
          >
            <ProductInventoryActions
              token={session!.token}
              profile={profile!}
            />
          </div>
        )}
      </section>
    );
  }

  function renderPosWorkspace() {
    const previewRows: Array<[string, string, string, string]> = [
      ['Walk-in customer', 'Counter sale draft', 'Needs payment', 'RWF 18,500'],
      ['Insurance customer', 'Co-pay plus insurer split', 'Receipt pending', 'RWF 64,200'],
      ['Chronic refill', 'Prescription review required', 'Pharmacist review', 'RWF 32,800'],
      ['Corporate client', 'Institution balance', 'Credit follow-up', 'RWF 118,400'],
    ];

    const posTenantSlug =
      profile?.tenant_assignments?.[0]?.tenant?.slug ||
      (profile?.scope?.is_tenant ? 'vitapharma' : 'vitapharma');

    const todayDate = new Date().toISOString().slice(0, 10);

    function resolveBatchAvailableQuantity(batch: PharmaStockBatch) {
      const quantityOnHand = Number(batch.quantity_on_hand ?? 0);
      const quantityReserved = Number((batch as PharmaStockBatch & { quantity_reserved?: number | string }).quantity_reserved ?? 0);
      const availableQuantity = Number(batch.available_quantity ?? quantityOnHand - quantityReserved);

      return Number.isFinite(availableQuantity) ? Math.max(0, availableQuantity) : 0;
    }

    const posProducts = posInventoryBatches
      .filter((batch) => {
        const availableQuantity = resolveBatchAvailableQuantity(batch);
        const batchIsActive = !batch.status || batch.status === 'active';
        const productIsActive = !batch.product || true;
        const expiryIsValid = !batch.expiry_date || batch.expiry_date >= todayDate;

        return availableQuantity > 0 && batchIsActive && productIsActive && expiryIsValid;
      })
      .sort((left, right) => {
        const leftExpiry = left.expiry_date ? new Date(left.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
        const rightExpiry = right.expiry_date ? new Date(right.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;

        if (leftExpiry !== rightExpiry) return leftExpiry - rightExpiry;

        return String(left.product?.name || '').localeCompare(String(right.product?.name || ''));
      })
      .map((batch) => {
        const availableQuantity = resolveBatchAvailableQuantity(batch);
        const sellingPrice = Number(batch.selling_price ?? 0);
        const productName = batch.product?.name || 'Unnamed product';
        const sku = batch.product?.sku || `BATCH-${batch.id}`;
        const locationName = batch.stock_location?.name || 'Current stock';

        return {
          code: `${sku}-B${batch.id}`,
          name: productName,
          strength: `${batch.batch_number} · ${batch.expiry_date ? `Exp ${batch.expiry_date}` : 'No expiry'} · ${locationName}`,
          quantity: 1,
          unitPrice: sellingPrice,
          status: `${availableQuantity.toLocaleString('en-RW')} available`,
          batchId: batch.id,
          productId: batch.product?.id || 0,
          batchNumber: batch.batch_number,
          availableQuantity,
          expiryDate: batch.expiry_date,
          locationName,
          sellingUnit: batch.product?.selling_unit || batch.product?.unit || 'unit',
          baseUnit: batch.product?.base_unit || batch.product?.unit || 'unit',
          quantityPerSellingUnit: Math.max(
            0.0001,
            Number(batch.product?.quantity_per_selling_unit || 1),
          ),
          allowOtherQuantity: batch.product?.allow_other_quantity !== false,
          defaultQuantityMode: ((batch.product?.default_pos_quantity_mode || 'selling_unit') === 'other_quantity'
            ? 'other_quantity'
            : (batch.product?.default_pos_quantity_mode || 'selling_unit') === 'combined'
              ? 'combined'
              : 'selling_unit') as 'selling_unit' | 'other_quantity' | 'combined',
        };
      });

    const salesSummaryRows: Array<{
      dateTime: string;
      businessDate: string;
      saleNumber: string;
      customer: string;
      method: string;
      status: string;
      amount: string;
    }> = [];

    const selectedInsurancePartner =
      posInsurancePartners.find(
        (partner) => String(partner.id) === String(posInsuranceProvider),
      ) ?? null;
    const selectedInsuranceCustomerContribution =
      posPartnerCustomerContributionPercent(selectedInsurancePartner);

    const normalizedPosTerminalSearch = posTerminalSearch.trim().toLowerCase();
    const posVisibleProducts = normalizedPosTerminalSearch
      ? posProducts.filter((product) =>
          [
            product.name,
            product.strength,
            product.code,
            product.batchNumber,
            product.locationName,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedPosTerminalSearch)),
        )
      : posProducts;

    const posSearchHelperText = posInventoryBatches.length === 0
      ? ''
      : normalizedPosTerminalSearch
        ? `${posVisibleProducts.length} matching product${posVisibleProducts.length === 1 ? '' : 's'}`
        : `${posProducts.length} fast product tile${posProducts.length === 1 ? '' : 's'} ready`;


    async function loadPosInsurancePartners() {
      if (!session?.token) return;

      setIsLoadingPosInsurancePartners(true);
      setPosInsurancePartnersError('');

      try {
        const response = await getInsurancePartners(
          session.token,
          posTenantSlug,
          {
            status: 'active',
            perPage: 100,
          },
        );

        const activePartners = (response.data || []).filter(
          (partner) => String(partner.status || '').toLowerCase() === 'active',
        );

        setPosInsurancePartners(activePartners);

        if (!posInsuranceProvider && activePartners.length > 0) {
          setPosInsuranceProvider(String(activePartners[0].id));
        }
      } catch (err) {
        setPosInsurancePartnersError(
          err instanceof Error
            ? err.message
            : 'Unable to load insurance partners for POS.',
        );
      } finally {
        setIsLoadingPosInsurancePartners(false);
      }
    }

    async function loadCurrentPosInventory() {
      if (!session?.token) return;

      void loadPosInsurancePartners();

      setIsLoadingPosInventory(true);
      setPosInventoryError('');
      setPosNotice('');

      try {
        const response = await getPharmaInventoryBatches(session!.token, posTenantSlug, undefined, { perPage: 1000, sellableOnly: true });
        const batches = response.batches || [];

        setPosInventoryBatches(batches);
        setPosInventoryLoadedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setPosCartItems([]);
        setPosCounterItems([]);
        setPosCounterCart({ items: [], lineCount: 0, totalQuantity: 0, subtotal: 0 });
        setPosTransactionConfirmed(false);

        setPosNotice('');
      } catch (err) {
        setPosInventoryError(err instanceof Error ? err.message : 'Unable to load current inventory for POS.');
      } finally {
        setIsLoadingPosInventory(false);
      }
    }

    function normalizePosCartItems(cartItems: typeof posCartItems = []) {
      const normalizedItems = (Array.isArray(cartItems) ? cartItems : [])
        .filter((item) => item && item.code)
        .reduce<typeof posCartItems>((items, item) => {
          const quantity = Math.max(1, Number(item.quantity || 1));
          const availableQuantity = Math.max(1, Number(item.availableQuantity || quantity));
          const unitPrice = Math.max(0, Number(item.unitPrice || 0));
          const originalUnitPrice = Math.max(0, Number(item.originalUnitPrice ?? unitPrice));
          const usedUnitPrice = Math.max(0, Number(item.usedUnitPrice ?? unitPrice));
          const originalSellingUnitPrice = Math.max(
            0,
            Number(item.originalSellingUnitPrice ?? item.usedSellingUnitPrice ?? unitPrice),
          );
          const usedSellingUnitPrice = Math.max(
            0,
            Number(item.usedSellingUnitPrice ?? unitPrice),
          );

          const normalizedItem = {
            ...item,
            quantity: Math.min(quantity, availableQuantity),
            unitPrice,
            originalUnitPrice,
            usedUnitPrice,
            unitPriceDifference: usedUnitPrice - originalUnitPrice,
            priceOverrideApplied:
              Boolean(item.priceOverrideApplied) ||
              Math.abs(usedUnitPrice - originalUnitPrice) > 0.0001,
            originalSellingUnitPrice,
            usedSellingUnitPrice,
            sellingUnitPriceDifference:
              usedSellingUnitPrice - originalSellingUnitPrice,
            availableQuantity,
            batchId: Number(item.batchId || 0),
            productId: Number(item.productId || 0),
            batchNumber: String(item.batchNumber || ''),
          };

          const existingIndex = items.findIndex(
            (existing) =>
              existing.code === normalizedItem.code &&
              Number(existing.batchId || 0) === Number(normalizedItem.batchId || 0),
          );

          if (existingIndex >= 0) {
            items[existingIndex] = normalizedItem;
          } else {
            items.push(normalizedItem);
          }

          return items;
        }, []);

      return normalizedItems;
    }

    function buildPosCounterCartSnapshot(items: typeof posCartItems = []) {
      const stableItems = normalizePosCartItems(items);

      return {
        items: stableItems,
        lineCount: stableItems.length,
        totalQuantity: stableItems.reduce((total, item) => total + Number(item.quantity || 0), 0),
        subtotal: stableItems.reduce(
          (total, item) => total + Number(item.quantity || 0) * Number(item.unitPrice || 0),
          0,
        ),
      };
    }

    function createStablePosCartSnapshot(sourceItems: typeof posCartItems = []) {
      return normalizePosCartItems(sourceItems);
    }

    function readActivePosCounterItems() {
      return createStablePosCartSnapshot(posRenderedCartItems);
    }

    function commitPosCounterItems(nextItems: typeof posCartItems) {
      const snapshot = buildPosCounterCartSnapshot(nextItems);

      setPosRenderedCartItems(snapshot.items);
      setPosCartItems(snapshot.items);
      setPosCounterItems(snapshot.items);
      setPosCounterCart(snapshot);
      setPosSaleSummary(
        calculatePosSaleSummary({
          cartItems: snapshot.items,
          discountAmount: posDiscountAmount,
          paymentMethod: posPaymentMethod,
          insuranceProviderId: posInsuranceProvider,
          insuranceInstitutionId: posInsuranceInstitution,
          insuranceCustomerContributionPercent:
            selectedInsuranceCustomerContribution,
        }),
      );
      setPosSummaryRefreshKey((current) => current + 1);
      setPosTransactionConfirmed(false);
      setPosConfirmedSale(null);
      setPosConfirmedPayment(null);
    }

    function forceRefreshSaleSummary() {
      const snapshot = buildPosCounterCartSnapshot(readActivePosCounterItems());

      setPosRenderedCartItems(snapshot.items);
      setPosCartItems(snapshot.items);
      setPosCounterItems(snapshot.items);
      setPosCounterCart(snapshot);
      setPosSaleSummary(
        calculatePosSaleSummary({
          cartItems: snapshot.items,
          discountAmount: posDiscountAmount,
          paymentMethod: posPaymentMethod,
          insuranceProviderId: posInsuranceProvider,
          insuranceInstitutionId: posInsuranceInstitution,
          insuranceCustomerContributionPercent:
            selectedInsuranceCustomerContribution,
        }),
      );
      setPosSummaryRefreshKey((current) => current + 1);
      setPosTransactionConfirmed(false);
      setPosNotice('Payment summary refreshed from the active cart.');
    }

    function openPosQuantityPopup(product: typeof posProducts[number]) {
      if (!product.batchId || product.availableQuantity <= 0) {
        setPosNotice('This product is not available in current inventory and cannot be sold.');
        return;
      }

      setPosQuantityProduct(product);
      setPosSellingAmount(String(product.unitPrice || 0));
      setPosSellingUnitQuantity('1');
      setPosOtherQuantity('0');
      setPosNotice('');
    }

    function closePosQuantityPopup() {
      setPosQuantityProduct(null);
      setPosSellingUnitQuantity('1');
      setPosOtherQuantity('0');
      setPosSellingAmount('');
    }

    function addConfiguredPosProductToCart() {
      const product = posQuantityProduct;

      if (!product) return;

      const systemSellingUnitPrice = Math.max(0, Number(product.unitPrice || 0));
      const usedSellingUnitPrice = Math.max(
        0,
        Number(posSellingAmount || systemSellingUnitPrice),
      );

      const quantityInput = {
        sellingUnitQuantity: Number(posSellingUnitQuantity || 0),
        otherQuantity: product.allowOtherQuantity
          ? Number(posOtherQuantity || 0)
          : 0,
        quantityPerSellingUnit: product.quantityPerSellingUnit,
      };

      const calculation = calculatePosQuantity({
        ...quantityInput,
        sellingUnitPrice: usedSellingUnitPrice,
      });

      const systemCalculation = calculatePosQuantity({
        ...quantityInput,
        sellingUnitPrice: systemSellingUnitPrice,
      });

      if (calculation.totalBaseQuantity <= 0) {
        setPosNotice('Enter at least one selling unit or another permitted quantity.');
        return;
      }

      const currentItems = readActivePosCounterItems();
      const existing = currentItems.find(
        (item) =>
          item.code === product.code &&
          Number(item.batchId || 0) === Number(product.batchId || 0),
      );

      const existingQuantity = Number(existing?.quantity || 0);
      const requestedTotalQuantity =
        existingQuantity + calculation.totalBaseQuantity;

      if (requestedTotalQuantity > product.availableQuantity) {
        setPosNotice(
          `${product.name} has ${product.availableQuantity.toLocaleString('en-RW')} ${product.baseUnit} available. Requested total is ${requestedTotalQuantity.toLocaleString('en-RW')}.`,
        );
        return;
      }

      const priceAudit = {
        unitPrice: calculation.baseUnitPrice,
        originalUnitPrice: systemCalculation.baseUnitPrice,
        usedUnitPrice: calculation.baseUnitPrice,
        unitPriceDifference:
          calculation.baseUnitPrice - systemCalculation.baseUnitPrice,
        priceOverrideApplied:
          Math.abs(calculation.baseUnitPrice - systemCalculation.baseUnitPrice) > 0.0001,
        originalSellingUnitPrice: systemSellingUnitPrice,
        usedSellingUnitPrice,
        sellingUnitPriceDifference:
          usedSellingUnitPrice - systemSellingUnitPrice,
      };

      let nextItems: typeof posCartItems;

      if (existing) {
        nextItems = currentItems.map((item) =>
          item.code === product.code &&
          Number(item.batchId || 0) === Number(product.batchId || 0)
            ? {
                ...item,
                quantity: requestedTotalQuantity,
                ...priceAudit,
                availableQuantity: product.availableQuantity,
                sellingUnit: product.sellingUnit,
                baseUnit: product.baseUnit,
                quantityPerSellingUnit: product.quantityPerSellingUnit,
                sellingUnitQuantity:
                  Number(item.sellingUnitQuantity || 0) +
                  calculation.sellingUnitQuantity,
                otherQuantity:
                  Number(item.otherQuantity || 0) +
                  calculation.otherQuantity,
              }
            : item,
        );
      } else {
        nextItems = [
          ...currentItems,
          {
            code: product.code,
            name: product.name,
            strength: product.strength,
            quantity: calculation.totalBaseQuantity,
            ...priceAudit,
            batchId: product.batchId,
            productId: product.productId,
            batchNumber: product.batchNumber,
            availableQuantity: product.availableQuantity,
            expiryDate: product.expiryDate,
            locationName: product.locationName,
            sellingUnit: product.sellingUnit,
            baseUnit: product.baseUnit,
            quantityPerSellingUnit: product.quantityPerSellingUnit,
            sellingUnitQuantity: calculation.sellingUnitQuantity,
            otherQuantity: calculation.otherQuantity,
          },
        ];
      }

      commitPosCounterItems(nextItems);
      closePosQuantityPopup();

      setPosNotice(
        `${product.name} added: ${calculation.sellingUnitQuantity.toLocaleString('en-RW')} ${product.sellingUnit} × ${product.quantityPerSellingUnit.toLocaleString('en-RW')} ${product.baseUnit}` +
          (calculation.otherQuantity > 0
            ? ` + ${calculation.otherQuantity.toLocaleString('en-RW')} ${product.baseUnit}`
            : '') +
          `. Selling amount: RWF ${usedSellingUnitPrice.toLocaleString('en-RW')}.`,
      );
    }

    function updateCartQuantity(code: string, quantity: number) {
      const nextItems = readActivePosCounterItems().map((item) => {
        if (item.code !== code) return item;

        const safeQuantity = Math.min(
          Math.max(1, Number.isFinite(quantity) ? quantity : 1),
          item.availableQuantity,
        );

        if (safeQuantity !== quantity) {
          setPosNotice(`${item.name} quantity adjusted to available inventory: ${item.availableQuantity}.`);
        }

        return {
          ...item,
          quantity: safeQuantity,
        };
      });

      commitPosCounterItems(nextItems);
    }

    function removeCartItem(code: string) {
      commitPosCounterItems(readActivePosCounterItems().filter((item) => item.code !== code));
    }

    function clearPosCart() {
      commitPosCounterItems([]);
      setPosNotice('Cart cleared.');
    }

    async function openPosDay() {
      if (isSavingPosSession) {
        return;
      }

      if (!session?.token || !posSessionTenantSlug) {
        setPosNotice('The authenticated tenant context is unavailable.');
        return;
      }

      if (!posSessionBranchId) {
        setPosNotice('No active branch is available for this POS session.');
        return;
      }

      const openingFloatAmount = Number(posStartingCashBalance);

      if (
        !Number.isFinite(openingFloatAmount) ||
        openingFloatAmount < 0
      ) {
        setPosNotice('Enter a valid starting cash balance.');
        return;
      }

      setIsSavingPosSession(true);
      setPosTransactionConfirmed(false);

      try {
        const response = await openPosSession(
          {
            token: session.token,
            tenantSlug: posSessionTenantSlug,
          },
          {
            branch_id: posSessionBranchId,
            opening_float_amount: openingFloatAmount,
            opening_mode: posOpeningMode,
          },
        );

        setPosSession(response.session);
        setIsPosDayOpen(response.session.status === 'open');
        setPosTillZeroized(response.session.balance_cleared);
        setPosDeclaredCashAmount(
          String(response.session.expected_cash_amount),
        );
        setPosNotice(response.message);
      } catch (error: unknown) {
        setPosNotice(
          error instanceof Error
            ? error.message
            : 'Unable to open the POS session.',
        );
      } finally {
        setIsSavingPosSession(false);
      }
    }

    async function closePosDay() {
      if (isSavingPosSession) {
        return;
      }

      if (!session?.token || !posSessionTenantSlug) {
        setPosNotice('The authenticated tenant context is unavailable.');
        return;
      }

      if (!posSession || posSession.status === 'closed') {
        setPosNotice('There is no active POS session to close.');
        return;
      }

      if (posCloseMode === 'handover' && !posTillZeroized) {
        setPosNotice(
          'Confirm the till count and incoming staff acknowledgement before handover.',
        );
        return;
      }

      if (
        posCloseMode === 'final-close' &&
        !posDepositProof.trim()
      ) {
        setPosNotice(
          'Final close requires proof of deposit for manager confirmation.',
        );
        return;
      }

      const declaredCashAmount = Number(posDeclaredCashAmount);

      if (
        !Number.isFinite(declaredCashAmount) ||
        declaredCashAmount < 0
      ) {
        setPosNotice('Enter a valid declared closing cash amount.');
        return;
      }

      setIsSavingPosSession(true);

      try {
        let workingSession = posSession;

        if (workingSession.status === 'open') {
          const zeroizeResponse = await zeroizePosSession(
            {
              token: session.token,
              tenantSlug: posSessionTenantSlug,
            },
            workingSession.id,
            {
              declared_cash_amount: declaredCashAmount,
              notes:
                posCloseMode === 'handover'
                  ? 'Till count confirmed for teller handover.'
                  : 'Till count confirmed for final close.',
            },
          );

          workingSession = zeroizeResponse.session;

          setPosSession(workingSession);
          setIsPosDayOpen(false);
          setPosTillZeroized(workingSession.balance_cleared);
          setPosDeclaredCashAmount('0');
          setPosNotice(zeroizeResponse.message);
        }

        if (workingSession.status !== 'zeroized') {
          setPosNotice(
            'The till must be zeroized before the session can close.',
          );
          return;
        }

        const closeResponse = await closePosSession(
          {
            token: session.token,
            tenantSlug: posSessionTenantSlug,
          },
          workingSession.id,
          {
            declared_cash_amount: 0,
            closing_mode: posCloseMode,
            deposit_proof:
              posCloseMode === 'final-close'
                ? posDepositProof.trim()
                : undefined,
          },
        );

        setPosSession(closeResponse.session);
        setIsPosDayOpen(false);
        setPosTillZeroized(false);
        setPosDeclaredCashAmount('0');
        setPosTransactionConfirmed(false);
        setPosNotice(closeResponse.message);
      } catch (error: unknown) {
        setPosNotice(
          error instanceof Error
            ? error.message
            : 'Unable to close the POS session.',
        );
      } finally {
        setIsSavingPosSession(false);
      }
    }

    /* AQUILA_PERSISTED_POS_TRANSACTION_20260712 */
    async function loadRecentPosTransactions() {
      if (!session?.token || !posTenantSlug) {
        return;
      }

      const branchId = Number(posSessionBranchId);

      if (!Number.isFinite(branchId) || branchId <= 0) {
        return;
      }

      setIsLoadingPosRecentSales(true);

      try {
        const response = await getPharmaSales(
          session.token,
          posTenantSlug,
          {
            branch_id: branchId,
          pos_session_id: posSession?.id ?? undefined,
          },
        );

        const orderedSales = [...response.sales].sort(
          (left, right) => {
            const leftTime = new Date(
              (left as { payments?: Array<{ received_at?: string | null }> }).payments?.[0]?.received_at
                    ?? left.sold_at
                    ?? left.created_at
                    ?? 0,
            ).getTime();

            const rightTime = new Date(
              (right as { payments?: Array<{ received_at?: string | null }> }).payments?.[0]?.received_at
                    ?? right.sold_at
                    ?? right.created_at
                    ?? 0,
            ).getTime();

            if (rightTime !== leftTime) {
              return rightTime - leftTime;
            }

            return right.id - left.id;
          },
        );

        setPosRecentSales(orderedSales);
      } catch (error: unknown) {
        setPosNotice(
          error instanceof Error
            ? error.message
            : 'Unable to synchronize recent POS transactions.',
        );
      } finally {
        setIsLoadingPosRecentSales(false);
      }
    }


      async function refreshPosHandoverInsights(businessDateOverride?: string | null): Promise<void> {
        if (!session?.token || !posTenantSlug) {
          return;
        }

        const posSessionBusinessDate =
          (posSession as { business_date?: string | null } | null)?.business_date
          ?? null;

        const effectiveBusinessDate =
          businessDateOverride
          ?? posSessionBusinessDate
          ?? new Date().toISOString().slice(0, 10);

        try {
          const [analyticsResponse, transactionsResponse] = await Promise.all([
            getPharmaLiveBusinessAnalytics(session.token, posTenantSlug, effectiveBusinessDate),
            getPharmaRecentTransactionsWithUsers(session.token, posTenantSlug),
          ]);

          setPosLiveBusinessAnalytics(analyticsResponse);
          setPosRecentTransactionsWithUsers(transactionsResponse.transactions);
          setPosLiveBusinessAnalyticsNotice(null);
        } catch (error) {
          setPosLiveBusinessAnalyticsNotice(
            error instanceof Error
              ? error.message
              : 'Unable to refresh live POS analytics.',
          );
        }
      }

async function confirmTransaction() {
      if (
        !session?.token
        || !posTenantSlug
      ) {
        setPosNotice(
          'The authenticated tenant context is unavailable.',
        );
        return;
      }

      let activeCheckoutSession = posSession;

      if (activeCheckoutSession?.status !== 'open') {
        try {
          const currentSessionResponse =
            await getCurrentPosSession({
              token: session.token,
              tenantSlug: posSessionTenantSlug,
            });

          activeCheckoutSession =
            currentSessionResponse.session;

          setPosSession(activeCheckoutSession);
          setIsPosDayOpen(
            activeCheckoutSession?.status === 'open',
          );
          setPosTillZeroized(
            activeCheckoutSession?.balance_cleared
              ?? false,
          );
        } catch (error: unknown) {
          setPosNotice(
            error instanceof Error
              ? error.message
              : 'Unable to verify the current POS session.',
          );
          return;
        }
      }

      if (
        !activeCheckoutSession
        || activeCheckoutSession.status !== 'open'
      ) {
        setPosNotice(
          'Open or restore a Live or Historical POS session before confirming this transaction.',
        );
        return;
      }

      const branchId = Number(posSessionBranchId);

      if (
        !Number.isFinite(branchId)
        || branchId <= 0
      ) {
        setPosNotice(
          'Select an active branch before confirming this transaction.',
        );
        return;
      }

      const currentItems = readActivePosCounterItems();

      const unavailableItem = currentItems.find(
        (item) =>
          item.quantity > item.availableQuantity
          || item.availableQuantity <= 0,
      );

      if (unavailableItem) {
        setPosNotice(
          `${unavailableItem.name} is no longer available in the selected quantity. Refresh current inventory before confirming.`,
        );
        setPosTransactionConfirmed(false);
        return;
      }

      if (currentItems.length === 0) {
        setPosNotice(
          'Add at least one drug to cart before confirming payment.',
        );
        return;
      }

      setIsConfirmingPosTransaction(true);
      setPosTransactionConfirmed(false);
      setPosConfirmedSale(null);
      setPosConfirmedPayment(null);
      setPosNotice('');

      try {
        const saleType =
          posPaymentMethod === 'insurance'
            ? 'insurance_sale'
            : posPaymentMethod === 'credit'
              ? 'credit_sale'
              : 'cash_sale';

        const checkoutResponse =
          await checkoutPharmaSale(
            session.token,
            posTenantSlug,
            {
              idempotency_key: posCheckoutKey,
              branch_id: branchId,
              sale_type: saleType,
              discount_amount:
                Math.max(
                  Number(posDiscountAmount) || 0,
                  0,
                ),
              tax_amount: 0,
              notes: [
                'Created from the Pharmacy POS Counter.',
                `Customer type: ${posCustomerType}.`,
                'Customer receipt: generated automatically.',
                'Customer invoice: not used for completed POS checkout.',
              ].join(' '),
              items: currentItems.map((item) => ({
                product_id: item.productId,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                original_unit_price: item.originalUnitPrice ?? item.unitPrice,
                used_unit_price: item.usedUnitPrice ?? item.unitPrice,
                unit_price_difference:
                  item.unitPriceDifference ??
                  ((item.usedUnitPrice ?? item.unitPrice) -
                    (item.originalUnitPrice ?? item.unitPrice)),
                price_override_applied:
                  item.priceOverrideApplied ??
                  Math.abs(
                    (item.usedUnitPrice ?? item.unitPrice) -
                      (item.originalUnitPrice ?? item.unitPrice),
                  ) > 0.0001,
                original_selling_unit_price:
                  item.originalSellingUnitPrice ?? item.unitPrice,
                used_selling_unit_price:
                  item.usedSellingUnitPrice ?? item.unitPrice,
                selling_unit_price_difference:
                  item.sellingUnitPriceDifference ??
                  ((item.usedSellingUnitPrice ?? item.unitPrice) -
                    (item.originalSellingUnitPrice ?? item.unitPrice)),
                discount_amount: 0,
                tax_amount: 0,
                stock_batch_id: item.batchId,
                prescription_verified:
                  posPrescriptionStatus === 'captured',
              })),
              payment: {
                payment_method: posPaymentMethod,
                generate_receipt: true,
                reference_number:
                  posInvoiceContact.trim() || null,
                received_at:
                  (activeCheckoutSession as { business_date?: string | null }).business_date
                  && (activeCheckoutSession as { business_date?: string | null }).business_date
                    !== new Date().toISOString().slice(0, 10)
                    ? `${(activeCheckoutSession as { business_date?: string | null }).business_date}T12:00:00`
                    : null,
                notes:
                  'Customer receipt generated automatically at POS confirmation.',
              },
            },
          );

        setPosConfirmedSale(checkoutResponse.sale);
        setPosConfirmedPayment(checkoutResponse.payment);
        setPosTransactionConfirmed(true);

        setPosCartItems([]);
        setPosRenderedCartItems([]);
        setPosCounterItems([]);
        setPosRenderedCartMetrics({
          lineCount: 0,
          totalQuantity: 0,
          subtotal: 0,
        });
        setPosCounterCart({
          items: [],
          lineCount: 0,
          totalQuantity: 0,
          subtotal: 0,
        });
        setPosQuantityProduct(null);
        setPosSellingUnitQuantity('1');
        setPosOtherQuantity('0');
        setPosSellingAmount('');

        await refreshPosHandoverInsights(
          (activeCheckoutSession as { business_date?: string | null } | null)?.business_date ?? null,
        );
        setPosCheckoutKey(createPosCheckoutKey());

        const recentResponse = await getPharmaSales(
          session.token,
          posTenantSlug,
          {
            branch_id: branchId,
          pos_session_id: posSession?.id ?? undefined,
          },
        );

        setPosRecentSales(
          [...recentResponse.sales].sort(
            (left, right) => {
              const leftTime = new Date(
                (left as { payments?: Array<{ received_at?: string | null }> }).payments?.[0]?.received_at
                    ?? left.sold_at
                    ?? left.created_at
                    ?? 0,
              ).getTime();

              const rightTime = new Date(
                (right as { payments?: Array<{ received_at?: string | null }> }).payments?.[0]?.received_at
                    ?? right.sold_at
                    ?? right.created_at
                    ?? 0,
              ).getTime();

              if (rightTime !== leftTime) {
                return rightTime - leftTime;
              }

              return right.id - left.id;
            },
          ),
        );

        if (checkoutResponse.payment.receipt_number) {
          setPosNotice(
            'Transaction Successful',
          );
        } else {
          setPosNotice(
            `Transaction ${checkoutResponse.sale.sale_number} was recorded, but no receipt number was returned.`,
          );
        }
      } catch (error: unknown) {
        setPosTransactionConfirmed(false);

        setPosNotice(
          error instanceof Error
            ? error.message
            : 'Unable to confirm the POS transaction.',
        );
      } finally {
        setIsConfirmingPosTransaction(false);
      }
    }


  function posSalePriceImpactSummary(
    sale: (typeof posRecentSales)[number],
  ): {
    originalPrice: string;
    usedPrice: string;
    difference: string;
  } {
    const items = Array.isArray(
      (sale as { items?: unknown }).items,
    )
      ? ((sale as { items?: Array<{
          quantity?: number | string;
          unit_price?: number | string;
          metadata?: Record<string, unknown>;
        }> }).items ?? [])
      : [];

    if (items.length === 0) {
      return {
        originalPrice: '—',
        usedPrice: '—',
        difference: '—',
      };
    }

    const totals = items.reduce(
      (summary, item) => {
        const quantity = Number(item.quantity ?? 0);
        const unitPrice = Number(item.unit_price ?? 0);
        const metadata = item.metadata ?? {};
        const originalUnitPrice = Number(
          metadata.original_unit_price ?? unitPrice,
        );
        const usedUnitPrice = Number(
          metadata.used_unit_price ?? unitPrice,
        );

        return {
          original:
            summary.original + originalUnitPrice * quantity,
          used:
            summary.used + usedUnitPrice * quantity,
        };
      },
      {
        original: 0,
        used: 0,
      },
    );

    const difference = totals.used - totals.original;

    return {
      originalPrice: `RWF ${totals.original.toLocaleString('en-RW')}`,
      usedPrice: `RWF ${totals.used.toLocaleString('en-RW')}`,
      difference:
        `${difference >= 0 ? '+' : '-'}RWF ${Math.abs(difference).toLocaleString('en-RW')}`,
    };
  }

  const posRecentTransactionRows = posRecentSales
    .filter((sale) => {
      if (
        posRecentFilter === 'paid'
        && sale.payment_status !== 'paid'
      ) {
        return false;
      }

      if (
        posRecentFilter === 'pending'
        && sale.payment_status === 'paid'
      ) {
        return false;
      }

      const keyword =
        posRecentSearch.trim().toLowerCase();

      if (!keyword) {
        return true;
      }

      return [
        sale.sale_number,
        sale.customer?.full_name,
        sale.sale_type,
        sale.payment_status,
        sale.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(keyword),
        );
    })
    .sort((left, right) => {
      const leftTime = new Date(
        (left as { payments?: Array<{ received_at?: string | null }> }).payments?.[0]?.received_at
                    ?? left.sold_at
                    ?? left.created_at
                    ?? 0,
      ).getTime();

      const rightTime = new Date(
        (right as { payments?: Array<{ received_at?: string | null }> }).payments?.[0]?.received_at
                    ?? right.sold_at
                    ?? right.created_at
                    ?? 0,
      ).getTime();

      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      return right.id - left.id;
    })
    .slice(0, 25)
    .map((sale) => {
      const priceImpact = posSalePriceImpactSummary(sale);

      return {
      dateTime: (sale as { payments?: Array<{ received_at?: string | null }> }).payments?.[0]?.received_at || sale.sold_at || sale.created_at
        ? new Date(
            sale.sold_at
              ?? sale.created_at
              ?? '',
          ).toLocaleString('en-RW')
        : 'Not recorded',
      businessDate:
        normalizeUbuzimaTransactionDate(
          (sale as { business_date?: string | null }).business_date
            ?? (sale as { payments?: Array<{ business_date?: string | null }> }).payments?.[0]?.business_date
            ?? null,
        ) ?? '—',
      saleNumber: sale.sale_number,
      customer:
        sale.customer?.full_name
        ?? 'Walk-in customer',
      method: ((sale as { payments?: Array<{ payment_method?: string | null }> }).payments?.[0]?.payment_method ?? sale.sale_type).replaceAll('_', ' '),
      status: sale.payment_status.replaceAll('_', ' '),
      amount:
        `RWF ${Number(sale.total_amount).toLocaleString('en-RW')}`,
      originalPrice: priceImpact.originalPrice,
      usedPrice: priceImpact.usedPrice,
      priceDifference: priceImpact.difference,
    };
    });

  const renderPosWorkspaceTopMenu = (
    workspace: PosWorkspaceKey,
  ) => (
    <div className="module-page-sticky-header">
      <ModulePageNavigation
        platformDashboardLabel="POS & Sales Dashboard"
        showMainDashboardExit={isAdminProfile}
        onExitToMainDashboard={() => {
          setActivePosWorkspace('overview');

          if (isAdminProfile) {
            setActiveSection(
              'overview' as typeof activeSection,
            );
          }
        }}
        onOpenPlatformDashboard={() => {
          setActivePosWorkspace('overview');
        }}
        onBack={() => {
          if (window.history.length > 1) {
            window.history.back();
            return;
          }

          setActivePosWorkspace('overview');
        }}
      />

      <WorkspacePopupFormManager
        workspace={workspace}
      />
    </div>
  );

  const renderPosWorkspaceIntelligence = (
    workspace: PosWorkspaceKey,
  ) => (
    <PosModuleWorkspaceHeader
      token={session!.token}
      profile={profile!}
      workspace={workspace}
    />
  );

    if (activePosWorkspace === 'overview') {
      return (
        <section className="section-page pos-unified-module-page">
          <PosSalesOverview
            token={session!.token}
            profile={profile!}
            onOpenWorkspace={(workspace) =>
              setActivePosWorkspace(
                workspace as PosWorkspaceKey,
              )
            }
          />
        </section>
      );
    }

    if (activePosWorkspace === 'pos') {
      const insuranceCustomerContributionPercent =
        selectedInsuranceCustomerContribution;
      const rawCustomerContributionPercent =
        insuranceCustomerContributionPercent;
      const posSummaryCustomerContributionPercent = posPaymentMethod === 'insurance'
        ? Math.min(Math.max(rawCustomerContributionPercent, 0), 100)
        : 100;
      const posSummaryInsurerContributionPercent = posPaymentMethod === 'insurance'
        ? Math.max(100 - posSummaryCustomerContributionPercent, 0)
        : 0;
      const posLiveCartItems = readActivePosCounterItems();
      const posVisibleCartItems = posLiveCartItems;
      const posCartDisplayItems = posLiveCartItems;
      const posFinancialLineCount = posLiveCartItems.length;
      const posFinancialTotalQuantity = posLiveCartItems.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0,
      );
      const posCartOperatingUnits = posFinancialTotalQuantity;
      const posSummarySyncKey = posSummaryRefreshKey;
      const posFinancialSubtotal = posLiveCartItems.reduce(
        (total, item) => total + Number(item.quantity || 0) * Number(item.unitPrice || 0),
        0,
      );
      const posOperatingCart = buildPosCounterCartSnapshot(posLiveCartItems);

      const posSummaryDiscountAmount = Math.max(Number.parseFloat(posDiscountAmount || '0') || 0, 0);
      const posSummaryAppliedDiscount = Math.min(posSummaryDiscountAmount, posFinancialSubtotal);
      const posSummaryNetDiscount = Math.max(posFinancialSubtotal - posSummaryAppliedDiscount, 0);

      // Tax mode will later come from Finance > Tax Compliance Management.
      // Inclusive means the displayed price already includes tax.
      // Exclusive means tax is added on top of Net Discount.
      const posTaxMode = configuredPosTaxMode();
      const posTaxRatePercent = 0;
      const posSummaryTaxAmount = posTaxMode === 'exclusive'
        ? Math.round((posSummaryNetDiscount * posTaxRatePercent) / 100)
        : 0;
      const posSummaryTotalAmount = posTaxMode === 'exclusive'
        ? posSummaryNetDiscount + posSummaryTaxAmount
        : posSummaryNetDiscount;
      const posSummaryCustomerPayment = posPaymentMethod === 'insurance'
        ? Math.round((posSummaryTotalAmount * posSummaryCustomerContributionPercent) / 100)
        : posSummaryTotalAmount;
      const posSummaryInsurerPayment = posPaymentMethod === 'insurance'
        ? Math.max(posSummaryTotalAmount - posSummaryCustomerPayment, 0)
        : 0;
      const posSessionBusinessDate =
        typeof (posSession as { business_date?: string | null } | null)?.business_date === 'string'
          ? (posSession as { business_date?: string | null }).business_date ?? null
          : null;
      const todayDateKey = new Date().toISOString().slice(0, 10);
      const isHistoricalPosTransactionDate =
        Boolean(
          posSessionBusinessDate
          && posSessionBusinessDate !== todayDateKey,
        );
      const posSummaryTimestamp = (
        isHistoricalPosTransactionDate && posSessionBusinessDate
          ? new Date(`${posSessionBusinessDate}T12:00:00`)
          : new Date()
      ).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const posPaymentSummarySignature = [
        posLiveCartItems.length
          ? posLiveCartItems
              .map((item) =>
                [
                  item.code,
                  Number(item.batchId || 0),
                  Number(item.quantity || 0),
                  Number(item.unitPrice || 0),
                ].join(':'),
              )
              .join('|')
          : 'empty-cart',
        posPaymentMethod,
        posDiscountAmount,
        posInsuranceProvider,
        posInsuranceInstitution,
        posSummaryCustomerContributionPercent,
        posSummaryInsurerContributionPercent,
      ].join('::');
      const posReceiptReference = `POS-${posPaymentSummarySignature
        .replace(/[^a-z0-9]/gi, '')
        .slice(-10)
        .toUpperCase() || 'RECEIPT'}`;

      void posSummarySyncKey;
      const posPaymentOperationalCards = [
        ['Date', posSummaryTimestamp],
        ['Cart lines', posFinancialLineCount],
        ['Cart units', posCartOperatingUnits],
        ['% Customer', `${posSummaryCustomerContributionPercent}%`],
        ['% Insurer', `${posSummaryInsurerContributionPercent}%`],
      ];

      const posPaymentFinancialCards = [
        ['Sub-Total', `RWF ${posOperatingCart.subtotal.toLocaleString('en-RW')}`],
        ['Discount', `RWF ${posSummaryDiscountAmount.toLocaleString('en-RW')}`],
        ['Net Discount', `RWF ${posSummaryNetDiscount.toLocaleString('en-RW')}`],
        ['Tax', `RWF ${posSummaryTaxAmount.toLocaleString('en-RW')}`],
        ['Total Amount', `RWF ${posSummaryTotalAmount.toLocaleString('en-RW')}`],
        ['Customer Payment', `RWF ${posSummaryCustomerPayment.toLocaleString('en-RW')}`],
        ['Insurer Payment', `RWF ${posSummaryInsurerPayment.toLocaleString('en-RW')}`],
      ];

      return (
        <section className="section-page pos-dedicated-counter-shell">
          <section className="pos-counter-page pos-counter-page--dedicated pos-stable-page-v16">
            <div className="pos-fixed-top-v16">
              {renderPosWorkspaceTopMenu('pos')}

            <PosInventoryAutoLoader
              shouldLoad={activePosWorkspace === 'pos' && !isLoadingPosInventory && !posInventoryLoadedAt && !posInventoryError}
              onLoad={loadCurrentPosInventory}
            />

            <section className="pos-counter-heading">
              <div>
                <p className="eyebrow">Pharmacy counter</p>
                <h2>Pharmacy POS Counter</h2>
                <p className="muted">Select drugs, build cart, complete transaction setup, confirm payment, then generate invoice when required.</p>
              </div>
            </section>
            </div>

            <div className="pos-terminal-main-scroll pos-scroll-body-v16">
              {posNotice && !posTransactionConfirmed && !/added:/i.test(posNotice) && <div className="form-success">{posNotice}</div>}

<section className="pos-counter-workbench pos-four-section-workspace pos-operating-cockpit-v2" aria-label="POS four-section workspace">
              <section className="pos-product-stock-section pos-builder-product-panel pos-rx-queue">
                <div className="section-heading">
                  <div>
                    <span>Step 1</span>
                    <h3>Product search & stock pick</h3>
                  </div>
                </div>

                <input
                  className="pos-search-input"
                  value={posTerminalSearch}
                  placeholder="Scan barcode or search product, batch, SKU..."
                  onChange={(event) => setPosTerminalSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && posVisibleProducts.length === 1) {
                      openPosQuantityPopup(posVisibleProducts[0]);
                      setPosTerminalSearch('');
                    }
                  }}
                />

                <div className="pos-inventory-load-panel">
                  <button type="button" onClick={loadCurrentPosInventory} disabled={isLoadingPosInventory}>
                    {isLoadingPosInventory ? 'Loading stock…' : 'Refresh stock'}
                  </button>
                  <span>
                    {posInventoryLoadedAt ? `Inventory loaded at ${posInventoryLoadedAt}` : ''}
                  </span>
                </div>

                {posInventoryError && <div className="form-error">{posInventoryError}</div>}

                <div className="pos-drug-list pos-drug-list--ten">
                  {posProducts.length === 0 ? (
                    <div className="pos-inventory-empty-state">
                      <strong>Loading stock…</strong>
                    </div>
                  ) : (
                    posVisibleProducts.length === 0 ? (
                      <div className="pos-inventory-empty-state">
                        <strong>No matching product</strong>
                        <small>Try another product name, SKU, batch, barcode, or clear the search.</small>
                      </div>
                    ) : (
                      posVisibleProducts.map((product) => {
                        const productRecord = product as {
                          expiryDate?: string;
                          expiresAt?: string;
                          expiry_date?: string;
                          expires_at?: string;
                          batchExpiryDate?: string;
                        };
                        const expiryDateText =
                          productRecord.expiryDate ||
                          productRecord.expiresAt ||
                          productRecord.expiry_date ||
                          productRecord.expires_at ||
                          productRecord.batchExpiryDate ||
                          product.status.match(/(?:exp(?:iry|ires)?\s*[:\-]?\s*)([^·|,]+)/i)?.[1]?.trim() ||
                          'Not set';
                        const expiryDateValue = expiryDateText !== 'Not set' ? new Date(expiryDateText) : null;
                        const expiryDaysRemaining = expiryDateValue && !Number.isNaN(expiryDateValue.getTime())
                          ? Math.ceil((expiryDateValue.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                          : null;
                        const expiryDaysText = expiryDaysRemaining === null
                          ? 'Days: N/A'
                          : expiryDaysRemaining < 0
                            ? `${Math.abs(expiryDaysRemaining)}d overdue`
                            : `${expiryDaysRemaining}d left`;
                        const normalizedStatus = product.status.toLowerCase();
                        const expiryStatusClass = expiryDaysRemaining !== null
                          ? expiryDaysRemaining <= 0
                            ? 'expired'
                            : expiryDaysRemaining <= 30
                              ? 'critical'
                              : expiryDaysRemaining <= 90
                                ? 'warning'
                                : expiryDaysRemaining <= 180
                                  ? 'watch'
                                  : 'safe'
                          : normalizedStatus.includes('expired')
                            ? 'expired'
                            : normalizedStatus.includes('critical') || normalizedStatus.includes('danger')
                              ? 'critical'
                              : normalizedStatus.includes('near') || normalizedStatus.includes('soon') || normalizedStatus.includes('warning')
                                ? 'warning'
                                : normalizedStatus.includes('watch')
                                  ? 'watch'
                                  : 'safe';

                        return (
                          <button
                            key={product.code}
                            type="button"
                            className={`pos-product-tile pos-product-tile-v16 product-expiry-${expiryStatusClass}`}
                            onClick={() => openPosQuantityPopup(product)}
                          >
                            <strong>{product.name}</strong>
                            <em>RWF {product.unitPrice.toLocaleString('en-RW')}</em>
                            <span className="pos-product-card-line">Available: {product.availableQuantity.toLocaleString('en-RW')}</span>
                            <span className="pos-product-card-line">Exp: {expiryDateText}</span>
                            <span className="pos-product-card-line">{expiryDaysText}</span>
                          </button>
                        );
                      })
                    )
                  )}
                </div>
              </section>

              {posQuantityProduct && (() => {
                const quantityPreviewSellingUnitPrice = Math.max(
                  0,
                  Number(posSellingAmount || posQuantityProduct.unitPrice || 0),
                );

                const quantityPreview = calculatePosQuantity({
                  sellingUnitQuantity: Number(posSellingUnitQuantity || 0),
                  otherQuantity: posQuantityProduct.allowOtherQuantity
                    ? Number(posOtherQuantity || 0)
                    : 0,
                  quantityPerSellingUnit: posQuantityProduct.quantityPerSellingUnit,
                  sellingUnitPrice: quantityPreviewSellingUnitPrice,
                });

                return (
                  <div
                    className="pos-quantity-dialog-backdrop"
                    role="presentation"
                    onMouseDown={(event) => {
                      if (event.target === event.currentTarget) {
                        closePosQuantityPopup();
                      }
                    }}
                  >
                    <section
                      className="pos-quantity-dialog"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="pos-quantity-dialog-title"
                    >
                      <div className="pos-quantity-dialog__header">
                        <div>
                          <span>POS quantity configuration</span>
                          <h3 id="pos-quantity-dialog-title">
                            {posQuantityProduct.name}
                          </h3>
                          <small>
                            Batch {posQuantityProduct.batchNumber} · Available{' '}
                            {posQuantityProduct.availableQuantity.toLocaleString('en-RW')}{' '}
                            {posQuantityProduct.baseUnit}
                          </small>
                        </div>

                        <button
                          type="button"
                          aria-label="Close quantity popup"
                          onClick={closePosQuantityPopup}
                        >
                          ×
                        </button>
                      </div>

                      <section className="pos-quantity-selling-unit-hero">
                        <div>
                          <span>Product Master selling unit</span>
                          <strong>{posQuantityProduct.sellingUnit}</strong>
                          <small>
                            1 {posQuantityProduct.sellingUnit} ={' '}
                            {posQuantityProduct.quantityPerSellingUnit.toLocaleString('en-RW')}{' '}
                            {posQuantityProduct.baseUnit}
                          </small>
                        </div>

                        <label>
                          <span>Quantity</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            autoFocus
                            inputMode="numeric"
                            value={posSellingUnitQuantity}
                            onChange={(event) => {
                              setPosSellingUnitQuantity(event.target.value);
                              setPosOtherQuantity('0');
                            }}
                            aria-label={`Quantity in ${posQuantityProduct.sellingUnit}`}
                          />
                          <small>Enter the number of {posQuantityProduct.sellingUnit} selected from Product Master.</small>
                        </label>
                      </section>

                      <section className="pos-quantity-readonly-grid" aria-label="Selected product information">
                        <article>
                          <span>Available stock</span>
                          <strong>
                            {posQuantityProduct.availableQuantity.toLocaleString('en-RW')}{' '}
                            {posQuantityProduct.baseUnit}
                          </strong>
                        </article>
                        <article>
                          <span>Unit price</span>
                          <strong>
                            RWF {posQuantityProduct.unitPrice.toLocaleString('en-RW')} /{' '}
                            {posQuantityProduct.sellingUnit}
                          </strong>
                        </article>
                        <article>
                          <span>Batch</span>
                          <strong>{posQuantityProduct.batchNumber}</strong>
                        </article>
                        <article>
                          <span>Expiry</span>
                          <strong>{posQuantityProduct.expiryDate || 'Not recorded'}</strong>
                        </article>
                        <article>
                          <span>Stock location</span>
                          <strong>{posQuantityProduct.locationName}</strong>
                        </article>
                        <article>
                          <span>Converted quantity</span>
                          <strong>
                            {quantityPreview.totalBaseQuantity.toLocaleString('en-RW')}{' '}
                            {posQuantityProduct.baseUnit}
                          </strong>
                        </article>
                      </section>

                      <section className="pos-quantity-price-override-card" aria-label="Selling amount override">
                        <label>
                          <span>Selling amount</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={posSellingAmount}
                            onChange={(event) => setPosSellingAmount(event.target.value)}
                          />
                          <small>
                            Defaults to system price. Adjust only when the agreed customer price is different.
                          </small>
                        </label>
                      </section>

                      <section className="pos-quantity-total-strip">
                        <div>
                          <span>Quantity to add</span>
                          <strong>
                            {quantityPreview.sellingUnitQuantity.toLocaleString('en-RW')}{' '}
                            {posQuantityProduct.sellingUnit}
                          </strong>
                        </div>
                        <div>
                          <span>Calculated total</span>
                          <strong>
                            RWF {quantityPreview.totalPrice.toLocaleString('en-RW', {
                              maximumFractionDigits: 2,
                            })}
                          </strong>
                        </div>
                      </section>

                      <div className="pos-quantity-dialog__actions">
                        <button type="button" onClick={closePosQuantityPopup}>
                          Cancel
                        </button>

                        <button
                          type="button"
                          className="primary"
                          disabled={
                            quantityPreview.totalBaseQuantity <= 0 ||
                            quantityPreview.totalBaseQuantity >
                              posQuantityProduct.availableQuantity
                          }
                          onClick={addConfiguredPosProductToCart}
                        >
                          Add to cart
                        </button>
                      </div>
                    </section>
                  </div>
                );
              })()}

              <section className="pos-sale-transaction-section" aria-label="Cart, Transaction Set-UP, and payment summary">

                <HistoricalPosWorkflow
                  token={session!.token}
                  tenantSlug={posSessionTenantSlug}
                  branchId={posSessionBranchId}
                  permissions={
                    canOpenHistoricalPos(profile)
                      ? Array.from(new Set([
                          ...(profile?.permissions ?? []),
                          'pharmaco.pos.historical.request',
                          'pharmaco.pos.historical.open',
                          'pharmaco.pos.historical.record',
                          'pharmaco.sales.historical.record',
                        ]))
                      : (profile?.permissions ?? [])
                  }
                  currentSession={posSession}
                  openingFloatAmount={
                    Number(posStartingCashBalance) || 0
                  }
                  openingMode={posOpeningMode}
                  onSessionChanged={(
                    nextSession,
                    message,
                  ) => {
                    setPosSession(nextSession);
                    setIsPosDayOpen(
                      nextSession.status === 'open',
                    );
                    setPosTillZeroized(
                      nextSession.balance_cleared,
                    );
                    setPosDeclaredCashAmount(
                      String(
                        nextSession.expected_cash_amount,
                      ),
                    );
                    setPosNotice(message);
                  }}
                  onNotice={setPosNotice}
                />


                <section className="pos-shift-control-section pos-session-control-card">
                  <div className="section-heading">
                    <div>
                      <span>Section 2 · Teller session</span>
                      <h3>POS Session</h3>
                    </div>
                    <small>
                      {isLoadingPosSession
                        ? 'Loading current session...'
                        : posSession
                          ? `${posSession.session_number} · ${posSession.status} · Expected RWF ${posSession.expected_cash_amount.toLocaleString('en-RW')}`
                          : 'No POS session recorded for the current business day'}
                    </small>
                  </div>

                  <section className="pos-shift-control-grid pos-shift-strip-v16">
                <article className="pos-shift-card pos-shift-card-v16 pos-shift-card--open">
                  <label className="pos-shift-field">
                    <span>Opening mode</span>
                    <select
                      value={posOpeningMode}
                      disabled={
                        isLoadingPosSession ||
                        isSavingPosSession ||
                        (posSession !== null &&
                          posSession.status !== 'closed')
                      }
                      onChange={(event) =>
                        setPosOpeningMode(
                          event.target.value as typeof posOpeningMode,
                        )
                      }
                    >
                      <option value="fresh-start">Fresh start day</option>
                      <option value="handover">Handover from previous teller</option>
                    </select>
                  </label>

                  <label className="pos-shift-field">
                    <span>Starting cash balance</span>
                    <input
                      type="number"
                      min="0"
                      value={posStartingCashBalance}
                      disabled={
                        isLoadingPosSession ||
                        isSavingPosSession ||
                        (posSession !== null &&
                          posSession.status !== 'closed')
                      }
                      onChange={(event) =>
                        setPosStartingCashBalance(event.target.value)
                      }
                    />
                  </label>

                  <button
                    type="button"
                    onClick={openPosDay}
                    disabled={
                      isLoadingPosSession ||
                      isSavingPosSession ||
                      (posSession !== null &&
                        posSession.status !== 'closed')
                    }
                  >
                    {isSavingPosSession ? 'Processing...' : 'Open Day'}
                  </button>
                </article>

                <article className="pos-shift-card pos-shift-card-v16 pos-shift-card--close">
                  <label className="pos-shift-field">
                    <span>Closing mode</span>
                    <select
                      value={posCloseMode}
                      disabled={
                        isSavingPosSession ||
                        !posSession ||
                        posSession.status === 'closed'
                      }
                      onChange={(event) =>
                        setPosCloseMode(
                          event.target.value as typeof posCloseMode,
                        )
                      }
                    >
                      <option value="handover">Handover to incoming staff</option>
                      <option value="final-close">Final close with manager deposit proof</option>
                    </select>
                  </label>

                  <label className="pos-shift-field">
                    <span>Declared closing cash</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={posDeclaredCashAmount}
                      disabled={
                        isSavingPosSession ||
                        !posSession ||
                        posSession.status === 'closed'
                      }
                      onChange={(event) =>
                        setPosDeclaredCashAmount(event.target.value)
                      }
                    />
                  </label>

                  {posCloseMode === 'handover' ? (
                    <label className="pos-shift-check">
                      <input
                        type="checkbox"
                        checked={posTillZeroized}
                        disabled={
                          isSavingPosSession ||
                          !posSession ||
                          posSession.status === 'closed'
                        }
                        onChange={(event) =>
                          setPosTillZeroized(event.target.checked)
                        }
                      />
                      <span>Till count confirmed and incoming staff acknowledged</span>
                    </label>
                  ) : (
                    <label className="pos-shift-field">
                      <span>Deposit proof reference</span>
                      <input
                        value={posDepositProof}
                        onChange={(event) => setPosDepositProof(event.target.value)}
                        placeholder="Deposit slip, bank ref, MoMo ref"
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={closePosDay}
                    disabled={
                      isLoadingPosSession ||
                      isSavingPosSession ||
                      !posSession ||
                      posSession.status === 'closed'
                    }
                  >
                    {isSavingPosSession
                      ? 'Processing...'
                      : posSession?.status === 'zeroized'
                        ? 'Complete Close'
                        : 'Zeroize & Close'}
                  </button>
                </article>
              </section>
                </section>

{(() => {
                  const visibleCartRows = posLiveCartItems;
                  const visibleCartLineCount = visibleCartRows.length;
                  const visibleCartUnitCount = visibleCartRows.reduce(
                    (total, item) => total + Number(item.quantity || 0),
                    0,
                  );
                  const visibleCartSignature = visibleCartRows.length
                    ? visibleCartRows
                        .map((item) =>
                          [
                            item.code,
                            Number(item.batchId || 0),
                            Number(item.quantity || 0),
                            Number(item.unitPrice || 0),
                          ].join(':'),
                        )
                        .join('|')
                    : 'empty-cart';

                  return (
                    <section
                      key={visibleCartSignature}
                      className="pos-sale-cart-section pos-builder-cart-panel pos-cart-card"
                      data-pos-cart-build="atomic-visible-cart-v1"
                      data-pos-cart-signature={visibleCartSignature}
                      data-pos-cart-lines={visibleCartLineCount}
                      data-pos-cart-units={visibleCartUnitCount}
                    >
                      <div className="section-heading">
                        <div>
                          <span>Section 2 · Cart</span>
                          <h3>Cart</h3>
                        </div>
                        <div className="pos-cart-header-actions">
                          <small>
                            {visibleCartLineCount} line{visibleCartLineCount === 1 ? '' : 's'} · {visibleCartUnitCount} unit{visibleCartUnitCount === 1 ? '' : 's'}
                          </small>
                          <button type="button" onClick={clearPosCart} disabled={visibleCartLineCount === 0}>
                            Clear cart
                          </button>
                        </div>
                      </div>

                      <div className="system-table-wrap">
                        <table className="system-table pos-cart-table">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Qty</th>
                              <th>Total</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleCartLineCount === 0 ? (
                              <tr>
                                <td colSpan={4}>No products added yet. Select products from the tile board.</td>
                              </tr>
                            ) : (
                              visibleCartRows.map((item) => (
                                <tr key={item.code}>
                                  <td>
                                    <strong>{item.name}</strong>
                                    <small>
                                      {item.sellingUnitQuantity > 0
                                        ? `${item.sellingUnitQuantity.toLocaleString('en-RW')} ${item.sellingUnit}`
                                        : ''}
                                      {item.sellingUnitQuantity > 0 && item.otherQuantity > 0 ? ' + ' : ''}
                                      {item.otherQuantity > 0
                                        ? `${item.otherQuantity.toLocaleString('en-RW')} ${item.baseUnit}`
                                        : ''}
                                    </small>
                                    <small>
                                      Total {item.quantity.toLocaleString('en-RW')} {item.baseUnit} ·
                                      RWF {item.unitPrice.toLocaleString('en-RW', {
                                        maximumFractionDigits: 4,
                                      })} / {item.baseUnit}
                                    </small>
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="1"
                                      max={item.availableQuantity}
                                      value={item.quantity}
                                      onChange={(event) => updateCartQuantity(item.code, Number(event.target.value))}
                                    />
                                  </td>
                                  <td>RWF {(item.quantity * item.unitPrice).toLocaleString('en-RW')}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="pos-cart-remove-button"
                                      onClick={() => removeCartItem(item.code)}
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  );
                })()}

                <section className="pos-transaction-setup-section pos-builder-setup-panel pos-transaction-setup-card pos-transaction-setup-card--two-column">
                  <div className="section-heading">
                    <div>
                      <span>Section 2 · Transaction Set-UP</span>
                      <h3>Transaction Set-UP</h3>
                    </div>
                  </div>

                  <div className="pos-field-grid pos-field-grid--two">
                    <label>
                      <span>Customer type</span>
                      <select
                        value={posCustomerType}
                        onChange={(event) => {
                          setPosCustomerType(event.target.value as typeof posCustomerType);
                          setPosTransactionConfirmed(false);
                        }}
                      >
                        <option value="walk-in">Walk-In Customer</option>
                        <option value="existing-customer">Existing Customer</option>
                        <option value="insurance-customer">Insurance Customer</option>
                        <option value="corporate-customer">Corporate Customer</option>
                      </select>
                    </label>

                    <label>
                      <span>Prescription</span>
                      <select value={posPrescriptionStatus} onChange={(event) => setPosPrescriptionStatus(event.target.value as typeof posPrescriptionStatus)}>
                        <option value="not-required">Not Required</option>
                        <option value="required">Required</option>
                        <option value="captured">Captured</option>
                        <option value="manual-review">Manual Review</option>
                      </select>
                    </label>

                    <label>
                      <span>Payment method</span>
                      <select
                        value={posPaymentMethod}
                        onChange={(event) => {
                          const nextPaymentMethod =
                            event.target.value as typeof posPaymentMethod;

                          setPosPaymentMethod(nextPaymentMethod);

                          if (nextPaymentMethod === 'insurance') {
                            void loadPosInsurancePartners();
                          }

                          setPosTransactionConfirmed(false);
                        }}
                      >
                        <option value="cash">Cash</option>
                        <option value="momo">Mobile Money</option>
                        <option value="card">Card</option>
                        <option value="insurance">Insurance</option>
                        <option value="credit">Customer Credit</option>
                      </select>
                    </label>

                    {posPaymentMethod === 'insurance' && (
                      <>
                        <label>
                          <span>Insurance partner</span>
                          <select
                            value={posInsuranceProvider}
                            onChange={(event) => {
                              setPosInsuranceProvider(event.target.value);
                              setPosInsuranceInstitution('');
                              setPosTransactionConfirmed(false);
                            }}
                            disabled={isLoadingPosInsurancePartners}
                          >
                            <option value="">
                              {isLoadingPosInsurancePartners
                                ? 'Loading insurance partners…'
                                : posInsurancePartners.length
                                  ? 'Select insurance partner'
                                  : 'No active insurance partners'}
                            </option>
                            {posInsurancePartners.map((partner) => (
                              <option key={partner.id} value={partner.id}>
                                {partner.name}
                              </option>
                            ))}
                          </select>
                          {posInsurancePartnersError ? (
                            <small>{posInsurancePartnersError}</small>
                          ) : selectedInsurancePartner ? (
                            <small>
                              Customer contribution{' '}
                              {selectedInsuranceCustomerContribution}%
                            </small>
                          ) : null}
                        </label>
                      </>
                    )}

                    <label>
                      <span>Discount amount</span>
                      <input
                        type="number"
                        min="0"
                        value={posDiscountAmount}
                        onChange={(event) => {
                          setPosDiscountAmount(event.target.value);
                          setPosTransactionConfirmed(false);
                        }}
                      />
                    </label>

                    <label>
                      <span>Customer contact / lookup</span>
                      <input
                        value={posInvoiceContact}
                        onChange={(event) => setPosInvoiceContact(event.target.value)}
                        placeholder="Phone, WhatsApp, or email"
                      />
                    </label>
                  </div>
                </section>

                <div className="pos-summary-update-bridge">
                  <button type="button" onClick={forceRefreshSaleSummary} disabled={posCartOperatingUnits === 0}>
                    Update Summary
                  </button>
                </div>

                <section
                  key={posPaymentSummarySignature}
                  className="pos-payment-summary-section pos-confirmation-rail"
                  data-pos-summary-build="atomic-payment-summary-v1"
                  data-pos-summary-signature={posPaymentSummarySignature}
                  data-pos-summary-lines={posFinancialLineCount}
                  data-pos-summary-units={posCartOperatingUnits}
                  data-pos-summary-subtotal={posFinancialSubtotal}
                  data-pos-summary-total={posSummaryTotalAmount}
                >
                <section className="pos-summary-confirmation-card">
                  <div className="section-heading">
                    <div>
                      <span>Step 4</span>
                      <h3>Payment summary</h3>
                    </div>
                  </div>

                  <div className="pos-summary-sync-note">
                    <span>Payment Summary</span>
                    <strong>{posCartOperatingUnits} unit{posCartOperatingUnits === 1 ? '' : 's'} in cart</strong>
                    <small>{posSummaryTimestamp}</small>
                  </div>

                  <div className="pos-payment-summary-grid pos-payment-summary-grid-v17">
                    <div className="pos-payment-summary-column pos-payment-summary-column--operational" aria-label="Operational payment summary">
                      <article className="pos-summary-field-card pos-summary-field-card--operational">
                        <span>Transaction timestamp</span>
                        <strong>{posSummaryTimestamp}</strong>
                      </article>
                    <article className="pos-summary-field-card pos-summary-field-card--operational pos-summary-field-card--business-date">
                      <span>Business Date</span>
                      <strong>
                        {posRecentTransactionsWithUsers[0]?.business_date
                          ?? (posSession as { business_date?: string | null } | null)?.business_date
                          ?? 'Current date'}
                      </strong>
                    </article>
                      <article className="pos-summary-field-card pos-summary-field-card--operational">
                        <span>Cart lines</span>
                        <strong>{posFinancialLineCount}</strong>
                      </article>
                      <article className="pos-summary-field-card pos-summary-field-card--operational">
                        <span>Cart units</span>
                        <strong>{posCartOperatingUnits}</strong>
                      </article>
                      <article className="pos-summary-field-card pos-summary-field-card--operational">
                        <span>% Customer</span>
                        <strong>{posSummaryCustomerContributionPercent}%</strong>
                      </article>
                      <article className="pos-summary-field-card pos-summary-field-card--operational">
                        <span>% Insurer</span>
                        <strong>{posSummaryInsurerContributionPercent}%</strong>
                      </article>
                    </div>

                    <div className="pos-payment-summary-column pos-payment-summary-column--financial" aria-label="Financial payment summary">
                      <article className="pos-summary-field-card pos-summary-field-card--financial">
                        <span>Sub-Total</span>
                        <strong>RWF {posFinancialSubtotal.toLocaleString('en-RW')}</strong>
                      </article>
                      <article className="pos-summary-field-card pos-summary-field-card--financial">
                        <span>Discount</span>
                        <strong>RWF {posSummaryDiscountAmount.toLocaleString('en-RW')}</strong>
                      </article>
                      <article className="pos-summary-field-card pos-summary-field-card--financial">
                        <span>Net Discount</span>
                        <strong>RWF {posSummaryNetDiscount.toLocaleString('en-RW')}</strong>
                      </article>
                      <article className="pos-summary-field-card pos-summary-field-card--financial">
                        <span>Tax</span>
                        <strong>RWF {posSummaryTaxAmount.toLocaleString('en-RW')}</strong>
                      </article>
                      <article className="pos-summary-field-card pos-summary-field-card--financial">
                        <span>Total Amount</span>
                        <strong>RWF {posSummaryTotalAmount.toLocaleString('en-RW')}</strong>
                      </article>
                      <article className="pos-summary-field-card pos-summary-field-card--financial">
                        <span>Customer Payment</span>
                        <strong>RWF {posSummaryCustomerPayment.toLocaleString('en-RW')}</strong>
                      </article>
                      <article className="pos-summary-field-card pos-summary-field-card--financial">
                        <span>Insurer Payment</span>
                        <strong>RWF {posSummaryInsurerPayment.toLocaleString('en-RW')}</strong>
                      </article>
                    </div>
                  </div>
                  {!posTransactionConfirmed && posNotice ? (
                    <div
                      className="notice pos-confirmation-notice"
                      role="status"
                      aria-live="polite"
                    >
                      {posNotice}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void confirmTransaction()}
                    disabled={isConfirmingPosTransaction}
                  >
                    {isConfirmingPosTransaction
                      ? 'Confirming transaction…'
                      : posTransactionConfirmed
                        ? 'Transaction confirmed'
                        : 'Confirm transaction'}
                  </button>

                  {posTransactionConfirmed ? (
                    <div
                      className="pos-transaction-completion-actions pos-transaction-completion-actions--summary"
                      role="status"
                      aria-live="polite"
                    >
                      <article className="pos-summary-field-card pos-summary-field-card--operational pos-transaction-completion-card">
                        <span>Transaction Completion Confirmation</span>
                        <strong>Transaction Successful</strong>
                      </article>

                      <article className="pos-summary-field-card pos-summary-field-card--financial pos-transaction-print-card">
                        <span>Print Receipt</span>
                        <button
                          type="button"
                          className="pos-print-receipt-button"
                          onClick={() => printUbuzimaPosDocument()}
                          disabled={!posConfirmedPayment?.receipt_number}
                        >
                          Print Receipt
                        </button>
                      </article>
                    </div>
                  ) : null}
                </section>

                {posCustomerInvoice === 'yes' && posTransactionConfirmed && (
                  <section className="pos-invoice-journey">
                    <h3>Invoice delivery</h3>

                    <label>
                      <span>Delivery channel</span>
                      <select value={posInvoiceDelivery} onChange={(event) => setPosInvoiceDelivery(event.target.value as typeof posInvoiceDelivery)}>
                        <option value="printer">Printer</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Corporate Email</option>
                      </select>
                    </label>

                    <button type="button" onClick={() => setPosNotice('Invoice PDF generated for the confirmed transaction.')}>
                      Generate invoice PDF
                    </button>

                    {posInvoiceDelivery === 'printer' && (
                      <button type="button" onClick={() => printUbuzimaPosDocument()}>
                        Print invoice
                      </button>
                    )}

                    {posInvoiceDelivery === 'whatsapp' && (
                      <button
                        type="button"
                        onClick={() => {
                          const phone = posInvoiceContact.replace(/[^\d+]/g, '');
                          window.open(`https://wa.me/${phone.replace('+', '')}`, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        Open WhatsApp
                      </button>
                    )}

                    {posInvoiceDelivery === 'email' && (
                      <button type="button" onClick={() => navigateToSection('corporate-email')}>
                        Open Corporate Email with invoice attached
                      </button>
                    )}
                  </section>
                )}
              </section>
              </section>
            </section>


              <section className="pos-live-business-performance-card" aria-label="Live business performance analytics">
                <div className="section-heading">
                  <div>
                    <span></span>
                    <h3></h3>
                  </div>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => void refreshPosHandoverInsights()}
                  >
                    Refresh data
                  </button>
                </div>

                {posLiveBusinessAnalyticsNotice ? (
                  <p className="pos-live-business-performance-card__notice">
                    {posLiveBusinessAnalyticsNotice}
                  </p>
                ) : null}

                <div className="pos-live-business-performance-grid">
                  <article>
                    <span>Sales</span>
                    <strong>{formatUbuzimaMoney(posLiveBusinessAnalytics?.sales_total ?? 0)}</strong>
                    <small>{posLiveBusinessAnalytics?.transaction_count ?? 0} transactions</small>
                  </article>
                  <article>
                    <span>Collections</span>
                    <strong>{formatUbuzimaMoney(posLiveBusinessAnalytics?.collections_total ?? 0)}</strong>
                    <small>{posLiveBusinessAnalytics?.receipt_count ?? 0} receipts</small>
                  </article>
                  <article>
                    <span>Open balance</span>
                    <strong>{formatUbuzimaMoney(posLiveBusinessAnalytics?.open_balance ?? 0)}</strong>
                    <small>{posLiveBusinessAnalytics?.collection_ratio ?? 0}% collection ratio</small>
                  </article>
                  <article>
                    <span>Average sale</span>
                    <strong>{formatUbuzimaMoney(posLiveBusinessAnalytics?.average_transaction_value ?? 0)}</strong>
                    <small>{posLiveBusinessAnalytics?.business_date ?? (posSession as { business_date?: string | null } | null)?.business_date ?? 'Current date'}</small>
                  </article>
                </div>
              </section>

<section className="pos-sales-summary-table-card pos-recent-transactions-bottom pos-recent-transactions-fullwidth">

              {posRecentTransactionsWithUsers.length > 0 ? (
                <div className="pos-transaction-operator-strip">
                  <span>Latest operator</span>
                  <strong>{formatUbuzimaOperatorName(posRecentTransactionsWithUsers[0])}</strong>
                  <small>
                    {posRecentTransactionsWithUsers[0]?.sale_number ?? 'Recent POS transaction'}
                    {' · '}
                    {normalizeUbuzimaTransactionDate(
                      posRecentTransactionsWithUsers[0]?.business_date
                        ?? posRecentTransactionsWithUsers[0]?.received_at
                        ?? posRecentTransactionsWithUsers[0]?.sold_at,
                    ) ?? 'Date pending'}
                  </small>
                </div>
              ) : null}

              <div className="section-heading">
                <div>
                  <span>Synchronized sales feed</span>
                  <h3>Recent transactions</h3>
                </div>
                {profileHasAdminAuthority(profile) && (
                <details className="admin-table-settings-panel">
          <summary className="admin-table-settings-panel__summary">
            <span>Table Management and Labelling</span>
            <small>Admin settings</small>
          </summary>

          <div className="admin-table-settings-panel__content">
            <div className="pos-table-management-actions">
                  <button type="button" onClick={() => setActivePosWorkspace('sales-performance')}>
                    Open Sales Register
                  </button>
                  <button type="button" className="secondary-action" onClick={() => setPosNotice('POS table management will control visible columns, filters, export, and row density for admin users.')}>
                    Table Management
                  </button>
                </div>
          </div>
        </details>
                )}
              </div>

                              <div
                  className="pos-current-session-table-toolbar"
                  aria-label="Recent transaction table controls"
                >
                  <input
                    aria-label="Search recent transactions"
                    placeholder="Search sale, customer, type or status…"
                    value={posRecentSearch}
                    onChange={(event) =>
                      setPosRecentSearch(event.target.value)
                    }
                  />

                  <select
                    aria-label="Filter recent transactions"
                    value={posRecentFilter}
                    onChange={(event) =>
                      setPosRecentFilter(
                        event.target.value as
                          | 'all'
                          | 'paid'
                          | 'pending',
                      )
                    }
                  >
                    <option value="all">
                      All recent transactions
                    </option>
                    <option value="paid">Paid</option>
                    <option value="pending">
                      Pending or partially paid
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={() =>
                      void loadRecentPosTransactions()
                    }
                    disabled={isLoadingPosRecentSales}
                  >
                    {isLoadingPosRecentSales
                      ? 'Refreshing…'
                      : 'Refresh'}
                  </button>
                </div>

<div className="system-table-wrap">
                <table className="system-table">
                  <thead>
                    <tr>
                      <th>Transaction timestamp</th>
                      <th>Business Date</th>
                      <th>Sale No.</th>
                      <th>Customer</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Original Price</th>
                      <th>Used Price</th>
                      <th>Difference</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posRecentTransactionRows.length === 0 ? (
                      <tr>
                        <td colSpan={10}>
                          No matching transactions are available. Confirm a sale or refresh the synchronized sales feed.
                        </td>
                      </tr>
                    ) : (
                      posRecentTransactionRows.map(({ dateTime, businessDate, saleNumber, customer, method, status, originalPrice, usedPrice, priceDifference, amount }) => (
                        <tr key={saleNumber}>
                          <td>{dateTime}</td>
                          <td>{businessDate}</td>
                          <td>{saleNumber}</td>
                          <td>{customer}</td>
                          <td>{method}</td>
                          <td>{status}</td>
                          <td>{originalPrice}</td>
                          <td>{usedPrice}</td>
                          <td>{priceDifference}</td>
                          <td>{amount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>








            </div>
          </section>
        </section>
      );
    }

    if (activePosWorkspace === 'dispensing-review') {
      return (
        <section className="section-page pos-unified-module-page">
          {renderPosWorkspaceTopMenu('dispensing-review')}

          <div className="module-page-scroll-content">
            {renderPosWorkspaceIntelligence('dispensing-review')}

            <SalesDispensingReview
              token={session!.token}
              profile={profile!}
              onOpenPos={() =>
                setActivePosWorkspace('pos')
              }
            />
          </div>
        </section>
      );
    }

    if (activePosWorkspace === 'customers') {
      return (
        <section className="section-page pos-unified-module-page">
          {renderPosWorkspaceTopMenu('customers')}

          <div className="module-page-scroll-content">
            {renderPosWorkspaceIntelligence('customers')}

            <CustomerPrescriptionManagementWorkspace
              token={session!.token}
              profile={profile!}
              mode="customers"
            />
          </div>
        </section>
      );
    }

    if (activePosWorkspace === 'prescriptions') {
      return (
        <section className="section-page pos-unified-module-page">
          {renderPosWorkspaceTopMenu('prescriptions')}

          <div className="module-page-scroll-content">
            {renderPosWorkspaceIntelligence('prescriptions')}

            <CustomerPrescriptionManagementWorkspace
              token={session!.token}
              profile={profile!}
              mode="prescriptions"
            />
          </div>
        </section>
      );
    }

    if (activePosWorkspace === 'sales-performance') {
      return (
        <section className="section-page pos-unified-module-page">
          {renderPosWorkspaceTopMenu('sales-performance')}

          <div className="module-page-scroll-content">
            <SalesReturnsWorkspace
              mode="sales"
              token={session!.token}
              profile={profile!}
            />
          </div>
        </section>
      );
    }

    return (
      <section className="section-page pos-unified-module-page">
        {renderPosWorkspaceTopMenu('payment-receipt')}

        <div className="module-page-scroll-content">
          <SalesReturnsWorkspace
            mode="payments"
            token={session!.token}
            profile={profile!}
          />
          <MomoReconciliationWorkspace
            token={session!.token}
            profile={profile!}
          />
        </div>
      </section>
    );
  }


  function renderSupplierWorkspace() {

    return (
      <section className="section-page dedicated-module-page">
        <div className="module-page-sticky-header">
          <ModulePageNavigation
            platformDashboardLabel="Procurement Home"
            showMainDashboardExit={isAdminProfile}
            onExitToMainDashboard={() => {
              if (isAdminProfile) {
                navigateToSection('overview');
                return;
              }

              setActiveSupplierWorkspace('overview');
            }}
            onOpenPlatformDashboard={() => setActiveSupplierWorkspace('overview')}
            onBack={() => setActiveSupplierWorkspace('overview')}
          />
        </div>

        <div className="module-section-stage procurement-module-stage">
          {activeSupplierWorkspace === 'overview' && (
            <ProcurementModuleHome
              token={session!.token}
              profile={profile!}
              workspaceItems={supplierWorkspaceItems.filter(
                (item) => item.key !== 'overview',
              )}
              onOpen={setActiveSupplierWorkspace}
            />
          )}

          {['create-supplier', 'supplier-list'].includes(
            activeSupplierWorkspace,
          ) && (
            <ProcurementSupplierWorkspace
              token={session!.token}
              profile={profile!}
              initialMode={
                activeSupplierWorkspace === 'create-supplier'
                  ? 'create'
                  : 'list'
              }
            />
          )}

          {[
            'create-purchase-order',
            'outstanding-purchase-orders',
            'received-purchase-orders',
          ].includes(activeSupplierWorkspace) && (
            <ProcurementPurchaseOrderWorkspace
              token={session!.token}
              profile={profile!}
              initialMode={
                activeSupplierWorkspace === 'create-purchase-order'
                  ? 'create'
                  : activeSupplierWorkspace === 'received-purchase-orders'
                    ? 'received'
                    : 'outstanding'
              }
            />
          )}

          {activeSupplierWorkspace === 'receive-purchase-order' && (
            <ProcurementReceivingWorkspace
              token={session!.token}
              profile={profile!}
            />
          )}

          {[
            'general-items-overview',
            'general-item-categories',
            'general-item-master',
            'general-item-stock',
            'general-item-receiving',
            'general-item-usage',
          ].includes(activeSupplierWorkspace) && (
            <GeneralItemsManagementWorkspace
              token={session!.token}
              profile={profile!}
              initialMode={
                activeSupplierWorkspace ===
                'general-item-categories'
                  ? 'categories'
                  : activeSupplierWorkspace ===
                      'general-item-master'
                    ? 'master'
                    : activeSupplierWorkspace ===
                        'general-item-stock'
                      ? 'stock'
                      : activeSupplierWorkspace ===
                          'general-item-receiving'
                        ? 'receiving'
                        : activeSupplierWorkspace ===
                            'general-item-usage'
                          ? 'usage'
                          : 'overview'
              }
            />
          )}
        </div>
      </section>
    );
  }

  function renderFinanceWorkspace() {
    const selected = financeWorkspaceItems.find((item) => item.key === activeFinanceWorkspace) ?? financeWorkspaceItems[0];
    const financeRows: Array<[string, string, string, string]> = [
      ['Customer receivable', 'Open balance and due date', 'Collection', 'RWF 42,000'],
      ['Supplier invoice', 'Approved payable', 'Payment due', 'RWF 180,000'],
      ['Cash close', 'Expected versus counted cash', 'Review', 'RWF 8,500'],
      ['Mobile money', 'Reference reconciliation', 'Matched', 'RWF 94,000'],
    ];

    return (
      <section className="section-page dedicated-module-page">
        <DedicatedModuleHeader
          eyebrow="Finance and control"
          title="Finance Workspace"
          description="Move from finance overview to payables, receivables, collections, exceptions, and statements through focused pages."
          dashboardLabel={
            isAdminProfile
              ? 'Main Dashboard'
              : 'Finance Home'
          }
          onDashboard={() => {
            if (isAdminProfile) {
              navigateToSection('overview');
              return;
            }

            setActiveFinanceWorkspace('overview');
          }}
        />
        {activeFinanceWorkspace === 'overview' && (
          <ModuleLandingCards
            moduleName="Finance"
            items={financeWorkspaceItems.filter((item) => item.key !== 'overview')}
            activeKey={activeFinanceWorkspace}
            onOpen={setActiveFinanceWorkspace}
          />
        )}
        <div className="module-section-stage">
          {activeFinanceWorkspace === 'overview' && (
            <FocusRegisterPreview
              title="Finance Overview"
              description="Cash, MoMo, card, credit, receivables, payables, and exception status."
              rows={financeRows}
            />
          )}

          {activeFinanceWorkspace === 'finance-flow' && (
            <PayablesWorkflow token={session!.token} profile={profile!} />
          )}

          {activeFinanceWorkspace === 'exception-focus' && (
            <>
              <FocusRegisterPreview
                title="Exception Focus"
                description="Overdue receivables, overdue payables, payment variance, cash variance, and approval risks."
                rows={financeRows}
              />
              <PayablesWorkflow token={session!.token} profile={profile!} />
            </>
          )}

          {activeFinanceWorkspace === 'credits-receivables' && (
            <ReceivablesWorkflow token={session!.token} profile={{ tenant: profile!.tenant_assignments?.[0]?.tenant }} />
          )}

          {['receivable-register', 'collection'].includes(activeFinanceWorkspace) && (
            <FocusRegisterPreview
              title={selected.label}
              description="Receivables and collections use a focused table with export, bulk edit, and selected-detail review."
              rows={financeRows}
            />
          )}

          {activeFinanceWorkspace === 'financial-statements' && (
            <article className="panel wide">
              <div className="panel-heading-row">
                <div>
                  <h2>Financial Statement</h2>
                  <p className="muted">
                    AI-assisted Trial Balance, General Ledger, Cash Flow Statement, Income Statement, Balance Sheet, Bank, MoMo, and Cash Reconciliation.
                  </p>
                </div>
                <button type="button">Manual refresh</button>
              </div>
              <div className="document-action-grid document-action-grid--tablelike">
                {financialStatementItems.map(([title, text]) => (
                  <article key={title}>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </article>
                ))}
              </div>
            </article>
          )}
        </div>
      </section>
    );
  }

  function renderAdhocReportWorkspace() {
    const selected = adhocReportWorkspaceItems.find((item) => item.key === activeAdhocReportWorkspace) ?? adhocReportWorkspaceItems[0];
    const reportRows: Array<[string, string, string, string]> = [
      ['Low stock attention', 'Inventory signal', 'Open', 'Manager review'],
      ['Expiry watch', 'Batch register', 'Priority', 'Pharmacist action'],
      ['Sales exception', 'POS signal', 'Review', 'Finance follow-up'],
      ['Supplier delay', 'Purchase order', 'Pending', 'Procurement follow-up'],
    ];

    return (
      <section className="section-page dedicated-module-page">
        <DedicatedModuleHeader
          eyebrow="Reports and management review"
          title="Reports Workspace"
          description="Open operational alerts, review queues, executive summaries, decisions, checklists, and follow-up pages individually."
          dashboardLabel={
            isAdminProfile
              ? 'Main Dashboard'
              : 'Reports Home'
          }
          onDashboard={() => {
            if (isAdminProfile) {
              navigateToSection('overview');
              return;
            }

            setActiveAdhocReportWorkspace('overview');
          }}
        />
        {activeAdhocReportWorkspace === 'overview' && (
          <ModuleLandingCards
            moduleName="Reports"
            items={adhocReportWorkspaceItems.filter((item) => item.key !== 'overview')}
            activeKey={activeAdhocReportWorkspace}
            onOpen={setActiveAdhocReportWorkspace}
          />
        )}
        <div className="module-section-stage">
          {activeAdhocReportWorkspace === 'overview' && (
            <ReportingDashboard token={session!.token} profile={profile!} />
          )}

          {activeAdhocReportWorkspace !== 'overview' && (
            <FocusRegisterPreview
              title={selected.label}
              description="This ad-hoc report page keeps its own focused operating data without repeating unrelated dashboard content."
              rows={reportRows}
            />
          )}
        </div>
      </section>
    );
  }

  function renderAiCenter() {
    const operationalAiCards: Array<{ key: AiWorkspaceKey; title: string; summary: string }> = [
      { key: 'business-chat', title: 'Business Chat', summary: 'Ask operational questions and get business guidance.' },
      { key: 'customer-retention', title: 'Customer Retention', summary: 'Identify customers needing follow-up.' },
      { key: 'demand-forecast', title: 'Demand Forecast', summary: 'Forecast product demand by period.' },
      { key: 'expiry-risk', title: 'Expiry Risk', summary: 'Detect expiry exposure and FEFO actions.' },
      { key: 'finance-forecast', title: 'Finance Forecast', summary: 'Forecast cash, receivables, and payables.' },
      { key: 'fraud-anomaly', title: 'Fraud and Anomaly', summary: 'Flag unusual sales, stock, or finance patterns.' },
      { key: 'pricing-margin', title: 'Pricing and Margin', summary: 'Review pricing, margin, and discount impact.' },
      { key: 'reorder-recommendation', title: 'Reorder Recommendation', summary: 'Recommend reorder timing and quantities.' },
      { key: 'stock-out', title: 'Stock-out', summary: 'Predict and prevent stock-out risks.' },
      { key: 'supplier-performance', title: 'Supplier Performance', summary: 'Evaluate supplier reliability and delays.' },
      { key: 'inventory-assistance', title: 'Inventory Assistance', summary: 'Support product, batch, and location decisions.' },
      { key: 'operations-copilot', title: 'Operations Copilot', summary: 'Guide daily pharmacy operations.' },
    ];

    const aiPageDetails: Record<AiWorkspaceKey, { title: string; summary: string; controls: string[] }> = {
      'operational-ai-center': {
        title: 'Operational AI Center',
        summary: 'Run pharmacy AI models from clear operational cards. Each model opens its own workspace.',
        controls: ['Model cards', 'Human approval', 'Audit trail'],
      },
      'business-chat': { title: 'Business Chat', summary: 'Business guidance and operating questions.', controls: ['Ask question', 'Review answer', 'Save decision'] },
      'customer-retention': { title: 'Customer Retention', summary: 'Customer follow-up and retention signals.', controls: ['Retention score', 'Follow-up task', 'Approval'] },
      'demand-forecast': { title: 'Demand Forecast', summary: 'Demand prediction for products and categories.', controls: ['Forecast period', 'Data source', 'Confidence'] },
      'expiry-risk': { title: 'Expiry Risk', summary: 'Expiry exposure and FEFO actions.', controls: ['Risk list', 'Action proposal', 'Approval'] },
      'finance-forecast': { title: 'Finance Forecast', summary: 'Cash, receivables, payables, and statement forecast.', controls: ['Forecast', 'Variance', 'Refresh'] },
      'fraud-anomaly': { title: 'Fraud and Anomaly', summary: 'Sales, stock, and finance anomaly detection.', controls: ['Anomaly list', 'Risk level', 'Escalation'] },
      'pricing-margin': { title: 'Pricing and Margin', summary: 'Pricing and margin recommendations.', controls: ['Margin signal', 'Price proposal', 'Approval'] },
      'reorder-recommendation': { title: 'Reorder Recommendation', summary: 'AI reorder recommendations and purchase draft support.', controls: ['Reorder list', 'Supplier link', 'Human approval'] },
      'stock-out': { title: 'Stock-out', summary: 'Stock-out risk prediction and prevention.', controls: ['Risk items', 'Transfer option', 'Purchase option'] },
      'supplier-performance': { title: 'Supplier Performance', summary: 'Supplier reliability and procurement risk.', controls: ['Delay score', 'Fill rate', 'Action note'] },
      'inventory-assistance': { title: 'Inventory Assistance', summary: 'Inventory assistant for product, batch, and shelf control.', controls: ['Product help', 'Batch help', 'Shelf proposal'] },
      'operations-copilot': { title: 'Operations Copilot', summary: 'Daily operational copilot for managers and staff.', controls: ['Task guidance', 'Checklist', 'Decision note'] },
      governance: { title: 'AI Governance', summary: 'Policies, consent, human approval, and AI safety rules.', controls: ['Policy', 'Approval', 'Audit'] },
      'provider-management': { title: 'AI Provider Management', summary: 'Provider configuration, mode, status, and secure keys.', controls: ['Provider', 'Mode', 'Key reference'] },
      'model-registry': { title: 'AI Model Registry', summary: 'Models, versions, use cases, status, and risk level.', controls: ['Model', 'Version', 'Risk'] },
      'agent-management': { title: 'AI Agent Management', summary: 'AI agents, tools, scopes, and permissions.', controls: ['Agent', 'Tools', 'Scope'] },
      'prompt-library': { title: 'AI Prompt Library', summary: 'Approved prompts, versions, tenant overrides, and reuse.', controls: ['Prompt', 'Version', 'Approval'] },
      'knowledge-base': { title: 'AI Knowledge Base', summary: 'Trusted SOPs, FAQs, policies, and pharmacy knowledge.', controls: ['Source', 'Status', 'Review'] },
      'data-connectors': { title: 'AI Data Connectors', summary: 'Controlled AI access to inventory, sales, finance, supplier, and support data.', controls: ['Connector', 'Scope', 'Permission'] },
      recommendations: { title: 'AI Recommendations', summary: 'Structured recommendations with confidence and explanation.', controls: ['Recommendation', 'Confidence', 'Action'] },
      'workflow-automation': { title: 'AI Workflow Automations', summary: 'Draft reminders, reorder proposals, alerts, and report generation.', controls: ['Workflow', 'Trigger', 'Approval'] },
      'approval-center': { title: 'AI Human Approval Center', summary: 'Human review for sensitive AI actions.', controls: ['Queue', 'Risk', 'Decision'] },
      'feedback-learning': { title: 'AI Feedback and Learning', summary: 'Accepted, rejected, corrected, and improved AI feedback.', controls: ['Feedback', 'Learning', 'Review'] },
      'usage-cost': { title: 'AI Usage, Cost and Quota Control', summary: 'Usage by model, feature, tenant, user, quota, and estimated cost.', controls: ['Usage', 'Quota', 'Cost'] },
      'risk-compliance': { title: 'AI Risk and Compliance', summary: 'Sensitive data checks, policy exceptions, and compliance monitoring.', controls: ['Risk', 'Policy', 'Exception'] },
      'audit-logs': { title: 'AI Audit Logs', summary: 'Complete AI input, output, provider, model, user, and decision trail.', controls: ['Input', 'Output', 'Decision'] },
      'recommendation-approval-queue': { title: 'Recommendation Approval Queue', summary: 'Pending AI recommendations waiting for human approval.', controls: ['Pending', 'Reviewer', 'Decision'] },
      'insights-dashboard': { title: 'AI Insight Dashboard', summary: 'AI adoption, accuracy, cost, risk, and operational impact.', controls: ['Insight', 'Trend', 'Impact'] },
      'chat-me-ai': { title: 'Chat Me AI', summary: 'Ask for platform guidance, tutorials, navigation help, and safe operating support.', controls: ['Ask', 'Guide', 'Tutorial'] },
    };

    const selectedAiPage = aiPageDetails[activeAiWorkspace] ?? aiPageDetails['operational-ai-center'];

    return (
      <section className="section-page">
        {activeAiWorkspace === 'operational-ai-center' ? (
          <section className="operational-ai-workspace">
            <div className="section-heading">
              <div>
                <span>AI Center</span>
                <h2>Operational AI Center</h2>
                <p className="muted">Choose an operational AI model to open its working area.</p>
              </div>
            </div>

            <div className="operational-ai-card-grid">
              {operationalAiCards.map((card) => (
                <button key={card.key} type="button" onClick={() => setActiveAiWorkspace(card.key)}>
                  <strong>{card.title}</strong>
                  <span>{card.summary}</span>
                  <small>Open model workspace</small>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <article className="panel wide ai-detail-panel">
            <div className="panel-heading-row">
              <div>
                <h2>{selectedAiPage.title}</h2>
                <p className="muted">{selectedAiPage.summary}</p>
              </div>
              <button type="button">Run / Open</button>
            </div>

            <div className="workflow-list">
              {selectedAiPage.controls.map((control) => (
                <div key={control}>
                  <strong>{control}</strong>
                  <span>Controlled by permissions, audit logs, and human approval where required.</span>
                </div>
              ))}
            </div>
          </article>
        )}

        {activeAiWorkspace === 'chat-me-ai' && (
          <article className="panel wide chat-me-ai-panel">
            <h2>Chat Me AI</h2>
            <p className="muted">Ask for platform guidance, tutorials, navigation help, or how to complete a task safely.</p>
            <textarea placeholder="Ask Chat Me AI how to use this platform..." rows={4} />
            <button type="button">Ask Chat Me AI</button>
          </article>
        )}

        <AiOperationsPanel token={session!.token} profile={profile!} />
      </section>
    );
  }


  function renderNotificationWorkspace() {
    return (
      <section className="section-page">
        <article className="panel wide">
          <div className="panel-heading-row">
            <div>
              <h2>
                {activeNotificationWorkspace === 'overview' && 'Notification Overview'}
                {activeNotificationWorkspace === 'create-notification' && 'Create New Notification'}
                {activeNotificationWorkspace === 'recurring-notifications' && 'Manage Recurring Notifications'}
                {activeNotificationWorkspace === 'platform-notification-center' && 'Platform Notification Management Center'}
              </h2>
              <p className="muted">Notification work is separated by page so creation, recurring rules, and platform management do not repeat the same information.</p>
            </div>
          </div>
        </article>

        <NotificationCenterPanel token={session!.token} profile={profile!} />
      </section>
    );
  }

  function renderPharmacistChatWorkspace() {
    return (
      <section className="section-page">
        <article className="panel wide">
          <h2>{activePharmacistChatWorkspace === 'in-app-chat' ? 'In-app Chat' : 'WhatsApp Message Chats'}</h2>
          <p className="muted">
            {activePharmacistChatWorkspace === 'in-app-chat'
              ? 'Internal and customer in-app conversations.'
              : 'Company WhatsApp conversations and customer-linked messages.'}
          </p>
        </article>

        <PharmacistChatPanel token={session!.token} />
      </section>
    );
  }

  function renderAdminPanel() {
    const visibleAdminPanelLayers = profile!.scope.is_platform
      ? adminPanelLayers
      : adminPanelLayers.filter((layer) => layer.key === 'two-factor-auth');
    const selectedWorkspace = visibleAdminPanelLayers.some((layer) => layer.key === activeAdminPanelWorkspace)
      ? activeAdminPanelWorkspace
      : visibleAdminPanelLayers[0].key;
    const selectedLayer = visibleAdminPanelLayers.find((layer) => layer.key === selectedWorkspace) ?? visibleAdminPanelLayers[0];

    return (
      <section className="section-page">
{selectedWorkspace === 'user-profiles' && (
          <TenantSecurityUserManagementPanel
            token={session!.token}
            profile={profile}
          />
        )}


        {selectedWorkspace === 'platform-management' && (
          <PlatformManagementPanel token={session!.token} />
        )}

        {selectedWorkspace === 'notification-management' && (
          <NotificationCenterPanel token={session!.token} profile={profile!} />
        )}

        {selectedWorkspace === 'corporate-email' && (
          <CorporateEmailPanel token={session!.token} />
        )}

        {selectedWorkspace === 'pharmacist-chat' && (
          <PharmacistChatPanel token={session!.token} />
        )}

        {selectedWorkspace === 'data-layer' && (
          <DataLayerAdminPanel token={session!.token} />
        )}

        <section className="admin-layer-grid">
          {visibleAdminPanelLayers.map((layer) => (
            <button
              key={layer.key}
              type="button"
              className={selectedWorkspace === layer.key ? 'active' : ''}
              onClick={() => setActiveAdminPanelWorkspace(layer.key)}
            >
              <span>{layer.status}</span>
              <strong>{layer.title}</strong>
              <small>{layer.summary}</small>
            </button>
          ))}
        </section>

        {selectedWorkspace === 'platform-management' && (
          <article className="panel wide platform-appearance-panel">
            <div className="section-heading">
              <div>
                <span>Platform management</span>
                <h2>Left Menu Appearance</h2>
                <p className="muted">
                  Customize the admin left menu without touching source code. These settings are saved for this admin workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLeftMenuAppearance(defaultLeftMenuAppearance)}
              >
                Reset default
              </button>
            </div>

            <div className="appearance-control-grid">
              <label>
                <span>Menu card color</span>
                <input
                  type="color"
                  value={leftMenuAppearance.primaryColor}
                  onChange={(event) =>
                    setLeftMenuAppearance((current) => ({
                      ...current,
                      primaryColor: event.target.value,
                    }))
                  }
                />
                <small>{leftMenuAppearance.primaryColor}</small>
              </label>

              <label>
                <span>Title text color</span>
                <input
                  type="color"
                  value={leftMenuAppearance.titleColor}
                  onChange={(event) =>
                    setLeftMenuAppearance((current) => ({
                      ...current,
                      titleColor: event.target.value,
                    }))
                  }
                />
                <small>{leftMenuAppearance.titleColor}</small>
              </label>

              <label>
                <span>Menu card size</span>
                <select
                  value={leftMenuAppearance.density}
                  onChange={(event) =>
                    setLeftMenuAppearance((current) => ({
                      ...current,
                      density: event.target.value === 'comfortable' ? 'comfortable' : 'compact',
                    }))
                  }
                >
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                </select>
                <small>Compact reduces empty vertical space.</small>
              </label>
            </div>
          </article>
        )}

        {!['user-profiles', 'two-factor-auth', 'platform-management', 'notification-management', 'corporate-email', 'pharmacist-chat', 'data-layer'].includes(selectedWorkspace) && (
          <article className="panel wide">
            <h2>{selectedLayer.title} control surface</h2>
            <p className="muted">{selectedLayer.summary}</p>
            <div className="framework-chip-list">
              {selectedLayer.components.map((component) => (
                <small key={component}>{component}</small>
              ))}
            </div>
          </article>
        )}
{selectedWorkspace === 'backend-api' && accessControlPanel}
      </section>
    );
  }

  function renderActiveSection() {
    if (
      !isAdminProfile
      && visibleSectionKeys.size === 0
    ) {
      return (
        <section className="section-page">
          <section className="module-page-intro">
            <div>
              <p className="eyebrow">
                Access setup required
              </p>
              <h2>
                No operational workspace is assigned
              </h2>
              <p className="muted">
                Your account is active, but no module
                permission is currently available. Ask
                a tenant administrator to assign the
                appropriate role or workspace access.
              </p>
            </div>
            <span>Access required</span>
          </section>
        </section>
      );
    }

    const isBusinessOverviewRoute =
      profile &&
      (
        window.location.hash === '#business-overview-review' ||
        window.location.search.includes('business-overview-review=1') ||
        window.location.hash.includes('section=overview') ||
        activeSection === 'overview' ||
        localStorage.getItem('ubuzima.admin.section') === 'overview' ||
        localStorage.getItem('ubuzima.admin.section') === 'dashboard' ||
        localStorage.getItem('ubuzima_admin_active_section') === 'overview' ||
        localStorage.getItem('ubuzima_admin_active_section') === 'dashboard'
      );

    if (isBusinessOverviewRoute) {
      return <BusinessOverviewReviewPage
        token={session?.token ?? ''}
        tenantSlug={posSessionTenantSlug}
      />;
    }

    switch (activeSection) {
case 'overview':
        if (!profileHasAdminAuthority(profile)) {
          return null;
        }
return (
          <section className="section-page dashboard-overview-page dashboard-operating-page">
            <section className="dashboard-operating-hero dashboard-operating-hero--compact">
              <div>
                <p className="eyebrow">Operating Dashboard</p>
                <h2>{profileInstitution}</h2>
              </div>

              <details className="dashboard-card-customizer">
                <summary>Customize Dashboard Cards</summary>
                <div className="dashboard-card-customizer-grid">
                  {dashboardCardOptions.map((option) => (
                    <section key={option.key}>
                      <label className="dashboard-card-master-toggle">
                        <input
                          type="checkbox"
                          checked={dashboardCardVisibility[option.key]}
                          onChange={(event) =>
                            setDashboardCardVisibility((current) => ({
                              ...current,
                              [option.key]: event.target.checked,
                            }))
                          }
                        />
                        <strong>{option.label}</strong>
                      </label>

                      <div className="dashboard-card-field-options">
                        {dashboardCardFieldOptions[option.key].map((field) => (
                          <label key={field.key}>
                            <input
                              type="checkbox"
                              checked={dashboardCardFieldVisibility[option.key]?.[field.key] ?? true}
                              onChange={(event) =>
                                setDashboardCardFieldVisibility((current) => ({
                                  ...current,
                                  [option.key]: {
                                    ...(current[option.key] ?? {}),
                                    [field.key]: event.target.checked,
                                  },
                                }))
                              }
                            />
                            <span>{field.label}</span>
                          </label>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </details>
            </section>

            <section className="dashboard-operating-grid dashboard-operating-grid--focused">
              <button
                type="button"
                className="dashboard-operating-card dashboard-operating-card--metrics priority"
                onClick={() => {
                  window.location.href = `${window.location.pathname}?business-overview-review=1`;
                }}
              >
                <span>Business Overview</span>
                <div className="dashboard-card-metrics">
                  <span><b>360°</b><small>Business view</small></span>
                  <span><b>Goals</b><small>Revenue and profit</small></span>
                  <span><b>Live</b><small>Admin preview</small></span>
                </div>
              </button>

              <button
                type="button"
                className="dashboard-operating-card dashboard-operating-card--metrics priority"
                onClick={() => {
                  window.location.href = `${window.location.pathname}?business-overview-review=1`;
                }}
              >
                <span>Business Overview Review</span>
                <div className="dashboard-card-metrics">
                  <span><b>360°</b><small>Business view</small></span>
                  <span><b>Goals</b><small>Revenue and profit</small></span>
                  <span><b>Test</b><small>Admin preview</small></span>
                </div>
              </button>
              {dashboardCardVisibility.inventory && profileHasGranularPermission(profile, granularMenuPermissionMap.inventory) && (
                <button
                  type="button"
                  className="dashboard-operating-card dashboard-operating-card--metrics priority"
                  onClick={() => {
                    setActiveInventoryView('overview');
                    navigateToSection('inventory');
                  }}
                >
                  <span>Inventory Control</span>
                  <div className="dashboard-card-metrics">
                    {dashboardCardFieldVisibility.inventory.pages && <span><b>7</b><small>Inventory pages</small></span>}
                    {dashboardCardFieldVisibility.inventory.expiry && <span><b>180d</b><small>Expiry watch</small></span>}
                    {dashboardCardFieldVisibility.inventory.permission && <span><b>{profile!.permissions.includes('pharmaco.inventory.manage') ? 'On' : 'Off'}</b><small>Permission</small></span>}
                  </div>
                </button>
              )}

              {dashboardCardVisibility.pos && profileHasGranularPermission(profile, granularMenuPermissionMap.pos) && (
                <button
                  type="button"
                  className="dashboard-operating-card dashboard-operating-card--metrics"
                  onClick={() => {
                    setActivePosWorkspace('overview');
                    navigateToSection('pos');
                  }}
                >
                  <span>POS and Sales</span>
                  <div className="dashboard-card-metrics">
                    {dashboardCardFieldVisibility.pos.pages && <span><b>7</b><small>Sales pages</small></span>}
                    {dashboardCardFieldVisibility.pos.receipts && <span><b>PDF</b><small>Receipts</small></span>}
                    {dashboardCardFieldVisibility.pos.permission && <span><b>{profile!.permissions.includes('pharmaco.pos.use') ? 'On' : 'Off'}</b><small>POS access</small></span>}
                  </div>
                </button>
              )}

              {dashboardCardVisibility.finance && profileHasGranularPermission(profile, granularMenuPermissionMap.finance) && (
                <button
                  type="button"
                  className="dashboard-operating-card dashboard-operating-card--metrics"
                  onClick={() => {
                    setActiveFinanceWorkspace('overview');
                    navigateToSection('finance');
                  }}
                >
                  <span>Finance Watch</span>
                  <div className="dashboard-card-metrics">
                    {dashboardCardFieldVisibility.finance.pages && <span><b>7</b><small>Finance pages</small></span>}
                    {dashboardCardFieldVisibility.finance.statements && <span><b>AI</b><small>Statements</small></span>}
                    {dashboardCardFieldVisibility.finance.reconcile && <span><b>MoMo</b><small>Reconcile</small></span>}
                  </div>
                </button>
              )}

              {dashboardCardVisibility.suppliers && (
                <button
                  type="button"
                  className="dashboard-operating-card dashboard-operating-card--metrics"
                  onClick={() => {
                    setActiveSupplierWorkspace('overview');
                    navigateToSection('suppliers');
                  }}
                >
                  <span>Suppliers and PO</span>
                  <div className="dashboard-card-metrics">
                    {dashboardCardFieldVisibility.suppliers.pages && <span><b>7</b><small>Supplier pages</small></span>}
                    {dashboardCardFieldVisibility.suppliers.po && <span><b>PO</b><small>Open orders</small></span>}
                    {dashboardCardFieldVisibility.suppliers.permission && <span><b>{profile!.permissions.includes('pharmaco.procurement.view') ? 'On' : 'Off'}</b><small>Permission</small></span>}
                  </div>
                </button>
              )}

              {dashboardCardVisibility.communications && profileHasGranularPermission(profile, ['communications.email.view', 'communications.notifications.view', 'communications.chat.view']) && (
                <button
                  type="button"
                  className="dashboard-operating-card dashboard-operating-card--metrics mail"
                  onClick={() => navigateToSection('corporate-email')}
                >
                  <span>Communication Center</span>
                  <div className="dashboard-card-metrics">
                    {dashboardCardFieldVisibility.communications.unread && <span><b>{unreadMailCount}</b><small>Unread</small></span>}
                    {dashboardCardFieldVisibility.communications.channel && <span><b>Email</b><small>Official</small></span>}
                    {dashboardCardFieldVisibility.communications.alerts && <span><b>Ready</b><small>Alerts</small></span>}
                  </div>
                </button>
              )}

              {dashboardCardVisibility['ai-reports'] && profileHasGranularPermission(profile, [...granularMenuPermissionMap.reports, 'ai.use']) && (
                <button
                  type="button"
                  className="dashboard-operating-card dashboard-operating-card--metrics"
                  onClick={() => {
                    setActiveAdhocReportWorkspace('overview');
                    navigateToSection('reports');
                  }}
                >
                  <span>AI and Reports</span>
                  <div className="dashboard-card-metrics">
                    {dashboardCardFieldVisibility['ai-reports']['ai-tools'] && <span><b>18</b><small>AI tools</small></span>}
                    {dashboardCardFieldVisibility['ai-reports']['report-pages'] && <span><b>7</b><small>Report pages</small></span>}
                    {dashboardCardFieldVisibility['ai-reports'].permission && <span><b>{profile!.permissions.includes('ai.use') ? 'On' : 'Off'}</b><small>AI access</small></span>}
                  </div>
                </button>
              )}

              {dashboardCardVisibility.profile && (
                <button
                  type="button"
                  className="dashboard-operating-card dashboard-operating-card--metrics"
                  onClick={() => {
                    setActiveAdminPanelWorkspace('user-profiles');
                    navigateToSection('admin-panel');
                  }}
                >
                  <span>Profile and Access</span>
                  <div className="dashboard-card-metrics">
                    {dashboardCardFieldVisibility.profile!.permissions && <span><b>{profile!.permissions.length}</b><small>Permissions</small></span>}
                    {dashboardCardFieldVisibility.profile!.scope && <span><b>{profile!.scope.type}</b><small>Scope</small></span>}
                    {dashboardCardFieldVisibility.profile!.edit && <span><b>Edit</b><small>Profile</small></span>}
                  </div>
                </button>
              )}
            </section>

            {(profile!.scope.is_tenant || profile!.scope.is_branch) && (
              <section className="dashboard-operating-tenant-summary operation-helicopter-view">
                <div className="section-heading">
                  <div>
                    <span>Tenant operations</span>
                    <h2>Operation Helicopter View</h2>
                  </div>
                </div>

                <section className="helicopter-quick-table-card">
                  <div className="section-heading">
                    <div>
                      <span>Branches</span>
                      <h3>{profileInstitution} Branches</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateToSection('tenant-setup')}
                    >
                      Add Branch
                    </button>
                  </div>

                  <div className="helicopter-table-wrap">
                    <table className="helicopter-table">
                      <thead>
                        <tr>
                          <th>Branch</th>
                          <th>Code</th>
                          <th>Status</th>
                          <th>Role</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(profile!.tenant_assignments ?? []).map((assignment, index) => (
                          <tr key={`${assignment.tenant?.id ?? 'tenant'}-${assignment.branch?.id ?? index}`}>
                            <td>{assignment.branch?.name || assignment.tenant?.name || profileInstitution}</td>
                            <td>{assignment.branch?.code || assignment.tenant?.slug || 'Main'}</td>
                            <td>{assignment.branch?.status || assignment.tenant?.status || assignment.status}</td>
                            <td>{assignment.job_title || 'Staff'}</td>
                            <td>
                              <button type="button" onClick={() => navigateToSection('tenant-setup')}>
                                Detail / Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="helicopter-quick-table-card">
                  <div className="section-heading">
                    <div>
                      <span>Users</span>
                      <h3>User Access Table</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveAdminPanelWorkspace('user-profiles');
                        navigateToSection('admin-panel');
                      }}
                    >
                      Add User
                    </button>
                  </div>

                  <div className="helicopter-table-wrap">
                    <table className="helicopter-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Scope</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{profile!.user.name || 'Current user'}</td>
                          <td>{profile!.user.email}</td>
                          <td>{profile!.user.phone || 'Not provided'}</td>
                          <td>{profile!.scope.type}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveAdminPanelWorkspace('user-profiles');
                                navigateToSection('admin-panel');
                              }}
                            >
                              Detail / Edit
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {tenantOperationsPanel}
              </section>
            )}
          </section>
        );
      case 'erp':
        return renderErpWorkspace();
      case 'solution-portfolio':
        return renderSolutionPortfolio();
      case 'ai-center':
        return renderAiCenter();
      case 'admin-panel':
        if (!profileHasAdminAuthority(profile)) {
          return null;
        }
        return renderAdminPanel();
            case 'general-stock-items': {

              return (
                <section className="section-page general-stock-route-page">
                  <GeneralStockItemsModule
            token={session!.token}
            profile={profile!}
            onOpenWorkspace={setActiveInventoryView}
          />
                </section>
              );
            }

            case 'inventory':
        return renderInventoryWorkspace();
      case 'insurance': {
        const tenantSlug =
          profile?.tenant_assignments?.[0]?.tenant?.slug ||
          (profile?.scope?.is_tenant ? 'vitapharma' : '');

        if (!tenantSlug) {
          return (
            <section className="section-page">
              <article className="panel wide">
                <h2>Insurance Management</h2>
                <p className="form-error">
                  No tenant assignment is available for this insurance workspace.
                </p>
              </article>
            </section>
          );
        }

        return (
          <section className="section-page">
            <section className="dedicated-module-page">
              <DedicatedModuleHeader
                eyebrow="Insurance administration"
                title="Insurance Workspace"
                description="Manage partners, pricing, contributions, claims, reconciliation, and audit evidence in focused pages."
                dashboardLabel={
                  isAdminProfile
                    ? 'Main Dashboard'
                    : 'Insurance Home'
                }
                onDashboard={() => {
                  if (isAdminProfile) {
                    navigateToSection('overview');
                    return;
                  }

                  setActiveInsuranceWorkspace(
                    'overview',
                  );
                }}
              />
              <InsuranceManagementWorkspace
              token={session!.token}
              tenantSlug={tenantSlug}
              activeWorkspace={activeInsuranceWorkspace}
              onWorkspaceChange={setActiveInsuranceWorkspace}
            />
            </section>
          </section>
        );
      }
      case 'pos':
        return renderPosWorkspace();
      case 'suppliers':
        return renderSupplierWorkspace();
      case 'finance':
        return renderFinanceWorkspace();
      case 'reports':
        return renderAdhocReportWorkspace();
      case 'tenant-setup':
        return (
          <section className="section-page">
{tenantOperationsPanel}
            <PharmaCoreEditor token={session!.token} profile={profile!} />
          </section>
        );
      case 'admin-management':
      case 'security': {
        const administrationTenantSlug =
          profile?.tenant_assignments?.find(
            (assignment) =>
              assignment.status === 'active'
              && assignment.tenant?.slug,
          )?.tenant?.slug
          ?? profile?.tenant_assignments?.find(
            (assignment) =>
              assignment.tenant?.slug,
          )?.tenant?.slug
          ?? '';

        if (!administrationTenantSlug) {
          return (
            <section className="section-page admin-management-route-page">
              <article className="panel wide">
                <h2>Admin Management</h2>
                <p className="form-error">
                  An active tenant assignment is required
                  before administrative privileges can be managed.
                </p>
              </article>
            </section>
          );
        }

        return (
          <section className="section-page admin-management-route-page">
            <AdminManagementWorkspace
              token={session!.token}
              tenantSlug={administrationTenantSlug}
              profile={profile!}
              onVerified={(
                nextToken,
                nextProfile,
                trustedDeviceToken,
              ) => {
                persistSession(
                  {
                    token: nextToken,
                    profile: nextProfile,
                  },
                  trustedDeviceToken,
                );
              }}
            />
          </section>
        );
      }

      case 'corporate-email':
        return (
          <section className="section-page">
<CorporateEmailPanel token={session!.token} />
          </section>
        );
      case 'pharmacist-chat':
        return (
          <section className="section-page">
<PharmacistChatPanel token={session!.token} />
          </section>
        );
      case 'notifications':
        return (
          <section className="section-page">
<NotificationCenterPanel token={session!.token} profile={profile!} />
          </section>
        );
      case 'market-management':
      case 'localization':
        return (
          <section className="section-page">
<MarketLocalizationPanel token={session!.token} profile={profile!} />
          </section>
        );
      case 'nearby-providers':
        return (
          <section className="section-page">
<NearbyProvidersPanel />
          </section>
        );
      case 'vitapharma-website':
        return (
          <section className="section-page">
<article className="panel wide tenant-website-panel">
              <img src={vitaPharmaLogoSrc} alt="VitaPharma" />
              <div>
                <h2>VitaPharma Africa</h2>
                <p className="muted">
                  Customer-facing pharmacy website with section navigation, staff login, language selector, and Ubuzima+ platform integration.
                </p>
                <div className="framework-chip-list">
                  <small>Retail pharmacy</small>
                  <small>Pharmacist support</small>
                  <small>Nearby providers</small>
                  <small>Powered by Ubuzima+</small>
                </div>
              </div>
              <a className="panel-action-link" href={`${publicWebsiteUrl.replace(/\/$/, '')}/vitapharma`}>
                Open tenant website
              </a>
            </article>
          </section>
        );
      case 'settings':
        return (
          <section className="section-page">
<section className="commercial-framework-section">
              <div className="framework-heading">
                <div>
                  <p className="eyebrow">Commercial platform framework</p>
                  <h2>Ubuzima+ exposes the full system while activating modules safely.</h2>
                  <p className="muted">
                    Modules can appear in the framework before production activation, but they stay marked
                    as active, controlled, progressive, planned, or later.
                  </p>
                </div>

                <div className="framework-scope-card">
                  <span>Current pilot</span>
                  <strong>VitaPharma</strong>
                  <small>Operations 360 tenant scope</small>
                </div>
              </div>

              <div className="framework-grid">
                {commercialFramework.map((group) => (
                  <article key={group.family} className="framework-card">
                    <span>{group.state}</span>
                    <h3>{group.family}</h3>
                    <div className="framework-chip-list">
                      {group.modules.map((module) => (
                        <small key={module}>{module}</small>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        );
      default:
        return (
          <section className="section-page">
<section className="home-control-panel">
              <div>
                <p className="eyebrow">Home display controls</p>
                <h2>Choose what stays visible on this Home page.</h2>
                <p className="muted">
                  Keep the Home page focused. Hide sections that are not needed today and continue working from the left menu.
                </p>
              </div>
              <div className="home-widget-toggle-grid">
                {homeWidgetOptions.map((option) => (
                  <label key={option.key}>
                    <input
                      type="checkbox"
                      checked={homeWidgets[option.key]}
                      onChange={(event) =>
                        setHomeWidgets((current) => ({
                          ...current,
                          [option.key]: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {homeWidgets.summary && summaryGrid}

            {homeWidgets['quick-actions'] && (
              <section className="home-quick-action-grid">
                {[
                  ['Open POS', 'Start or review counter sales', 'pos' as AdminSectionKey],
                  ['Review Inventory', 'Products, stock, batches, expiry', 'inventory' as AdminSectionKey],
                  ['Suppliers', 'Supplier setup, PO, receiving', 'suppliers' as AdminSectionKey],
                  ['Ad-hoc Report', 'Operating alerts and reports', 'reports' as AdminSectionKey],
                ].filter(([, , section]) =>
                  profileHasGranularPermission(
                    profile,
                    granularMenuPermissionMap[section as AdminSectionKey] ?? [],
                  )
                ).map(([title, text, section]) => (
                  <button key={title} type="button" onClick={() => navigateToSection(section as AdminSectionKey)}>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </button>
                ))}
              </section>
            )}

            {profileHasAdminAuthority(profile) && shouldShowTenantOperationsDashboard && homeWidgets['tenant-dashboard'] ? (
              <TenantPharmacyDashboard
                token={session!.token}
                profile={profile!}
                onOpenSection={(section) => navigateToSection(section)}
              />
            ) : (
              <>
                {homeWidgets['system-experience'] && (
                <section className="system-experience-section">
                  <div className="framework-heading">
                    <div>
                      <p className="eyebrow">System experience blueprint</p>
                      <h2>Choose a module from the left menu and work in that section.</h2>
                      <p className="muted">
                        The dashboard is no longer one long page. AI, Inventory, POS, Suppliers, Finance,
                        Ad-hoc Report, Setup, Security, and Settings each have their own focused workspace.
                      </p>
                    </div>

                    <div className="framework-scope-card design-system-card">
                      <span>Design infrastructure</span>
                      <strong>Section based</strong>
                      <small>Independent sidebar, sticky header, persisted active section</small>
                    </div>
                  </div>

                  <div className="experience-lane-grid">
                    {experienceBlueprint.map((lane) => (
                      <article key={lane.lane} className="experience-lane-card">
                        <span>{lane.signal}</span>
                        <h3>{lane.lane}</h3>
                        <p>{lane.outcome}</p>
                        <div>
                          {lane.modules.map((module) => (
                            <small key={module}>{module}</small>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                )}

                {homeWidgets['role-workspaces'] && (
                  <div className="workspace-model-panel">
                    <div>
                      <h2>Role-based workspaces</h2>
                      <p className="muted">
                        Existing modules keep their current APIs while each user lands in the workspace that fits their job.
                      </p>
                    </div>

                    <div className="workspace-model-grid">
                      {workspaceModel.map(([role, text]) => (
                        <div key={role}>
                          <strong>{role}</strong>
                          <span>{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        );
    }
  }

  const mobileHomeSection = (
    visibleSectionKeys.has('overview')
      ? 'overview'
      : Array.from(visibleSectionKeys)[0] ?? 'overview'
  ) as AdminSectionKey;
  const mobileActiveTitle = activeLeftSubmenuLabel ?? currentSection.title;
  const mobileShellStatus = !isOnline
    ? 'Offline'
    : isStandalonePwa
      ? 'Installed'
      : 'Online';
  const mobileBottomNavCandidates: MobileBottomNavItem[] = [
    {
      key: 'home',
      label: 'Home',
      icon: 'HM',
      section: mobileHomeSection,
    },
    {
      key: 'pos',
      label: 'POS',
      icon: 'POS',
      section: 'pos',
      posWorkspace: 'pos',
    },
    {
      key: 'inventory',
      label: 'Stock',
      icon: 'ST',
      section: 'inventory',
    },
    {
      key: 'reports',
      label: 'Report',
      icon: 'RP',
      section: 'reports',
    },
  ];
  const mobileBottomNavItems = mobileBottomNavCandidates.filter((item) =>
    visibleSectionKeys.has(item.section),
  );
  const mobileQuickActionCandidates: MobileBottomNavItem[] = [
    {
      key: 'quick-pos',
      label: 'POS Counter',
      icon: 'POS',
      section: 'pos',
      posWorkspace: 'pos',
    },
    {
      key: 'quick-inventory',
      label: 'Inventory',
      icon: 'ST',
      section: 'inventory',
    },
    {
      key: 'quick-suppliers',
      label: 'Suppliers',
      icon: 'PO',
      section: 'suppliers',
    },
    {
      key: 'quick-finance',
      label: 'Finance',
      icon: 'FN',
      section: 'finance',
    },
  ];
  const mobileQuickActions = mobileQuickActionCandidates.filter((item) =>
    visibleSectionKeys.has(item.section),
  );
  const nativeMobileNavItems: UbuzimaMobileAppNavItem[] = [
    ...(visibleSectionKeys.has('overview')
      ? [
          {
            key: 'home',
            label: 'Home',
            icon: 'HM',
            screen: 'business' as UbuzimaMobileAppScreen,
          },
        ]
      : []),
    ...(visibleSectionKeys.has('pos')
      ? [
          {
            key: 'pos-sales',
            label: 'POS & Sales',
            icon: 'POS',
            screen: 'sales' as UbuzimaMobileAppScreen,
          },
        ]
      : []),
    ...(visibleSectionKeys.has('inventory')
      ? [
          {
            key: 'inventory',
            label: 'Inventory',
            icon: 'ST',
            screen: 'inventory' as UbuzimaMobileAppScreen,
          },
        ]
      : []),
    ...(visibleSectionKeys.has('suppliers')
      ? [
          {
            key: 'procurement',
            label: 'Procurement',
            icon: 'PO',
            screen: 'procurement' as UbuzimaMobileAppScreen,
          },
        ]
      : []),
    ...(visibleSectionKeys.has('general-stock-items') || visibleSectionKeys.has('suppliers')
      ? [
          {
            key: 'general-stock',
            label: 'General Stock',
            icon: 'GS',
            screen: 'general-stock' as UbuzimaMobileAppScreen,
          },
        ]
      : []),
    {
      key: 'more',
      label: 'More',
      icon: 'MN',
      screen: 'more',
    },
  ];
  const nativeMetrics: UbuzimaMobileAppMetric[] = [
    {
      key: 'gross-sales',
      label: 'Gross sales',
      value: readSharedBusinessMetric(['Gross Sales', 'Gross Revenue']) ?? 'RWF 0',
      helper: 'Business Overview',
      tone: 'olive',
    },
    {
      key: 'net-revenue',
      label: 'Net revenue',
      value: readSharedBusinessMetric(['Net Revenue']) ?? 'RWF 0',
      helper: 'After discounts and returns',
      tone: 'teal',
    },
    {
      key: 'inventory-value',
      label: 'Stock value',
      value: readSharedBusinessMetric(['Total Inventory Value', 'Inventory Value', 'Stock Value']) ?? 'RWF 0',
      helper: 'Inventory position',
      tone: 'gold',
    },
    {
      key: 'alerts',
      label: 'Alerts',
      value:
        readSharedBusinessMetric(['Low Stock Count', 'Low Stock Products', 'Near Expiry Count']) ??
        (unreadMailCount > 0 ? unreadMailCount.toLocaleString('en-RW') : '0'),
      helper: unreadMailCount > 0 ? 'Corporate email requires review' : 'Stock and operations',
      tone: unreadMailCount > 0 ? 'red' : 'blue',
    },
  ];
  const nativePrimaryActions: UbuzimaMobileAppAction[] = [
    ...(visibleSectionKeys.has('pos')
      ? [
          {
            key: 'pos-sales',
            label: 'POS & Sales',
            detail: 'Counter, receipts, payments',
            icon: 'POS',
            tone: 'olive' as const,
            onPress: () =>
              openNativeMobileSection('pos', {
                screen: 'sales',
              }),
          },
        ]
      : []),
    ...(visibleSectionKeys.has('inventory')
      ? [
          {
            key: 'inventory-overview',
            label: 'Inventory',
            detail: 'Products, batches, expiry',
            icon: 'ST',
            tone: 'gold' as const,
            onPress: () =>
              openNativeMobileSection('inventory', {
                inventoryView: 'overview',
                screen: 'inventory',
              }),
          },
        ]
      : []),
    ...(visibleSectionKeys.has('suppliers')
      ? [
          {
            key: 'procurement',
            label: 'Procurement',
            detail: 'Suppliers, purchase orders',
            icon: 'PO',
            tone: 'blue' as const,
            onPress: () =>
              openNativeMobileSection('suppliers', {
                supplierWorkspace: 'overview',
                screen: 'procurement',
              }),
          },
        ]
      : []),
    ...(visibleSectionKeys.has('general-stock-items') || visibleSectionKeys.has('suppliers')
      ? [
          {
            key: 'general-stock',
            label: 'General Stock',
            detail: 'Operational supplies store',
            icon: 'GS',
            tone: 'red' as const,
            onPress: () => {
              if (visibleSectionKeys.has('general-stock-items')) {
                openNativeMobileSection('general-stock-items', {
                  screen: 'general-stock',
                });
                return;
              }

              openNativeMobileSection('suppliers', {
                supplierWorkspace: 'general-items-overview',
                screen: 'general-stock',
              });
            },
          },
        ]
      : []),
  ];
  const nativeStockActions: UbuzimaMobileAppAction[] = [
    ...(visibleSectionKeys.has('inventory')
      ? [
          {
            key: 'stock-low',
            label: 'Low Stock',
            detail: 'Products needing reorder',
            icon: 'LOW',
            tone: 'red' as const,
            onPress: () =>
              openNativeMobileSection('inventory', {
                inventoryView: 'low-stock',
                screen: 'inventory',
              }),
          },
          {
            key: 'stock-expiry',
            label: 'Expiry',
            detail: 'Near-expiry batch control',
            icon: 'EXP',
            tone: 'gold' as const,
            onPress: () =>
              openNativeMobileSection('inventory', {
                inventoryView: 'near-expiry',
                screen: 'inventory',
              }),
          },
          {
            key: 'stock-master',
            label: 'Product Master',
            detail: 'Medicine catalog and pricing',
            icon: 'PM',
            tone: 'olive' as const,
            onPress: () =>
              openNativeMobileSection('inventory', {
                inventoryView: 'product-master',
                screen: 'inventory',
              }),
          },
          {
            key: 'stock-batches',
            label: 'Batches',
            detail: 'Batch and shelf quantities',
            icon: 'BT',
            tone: 'teal' as const,
            onPress: () =>
              openNativeMobileSection('inventory', {
                inventoryView: 'batches',
                screen: 'inventory',
              }),
          },
        ]
      : []),
  ];
  const nativeProcurementActions: UbuzimaMobileAppAction[] = [
    ...(visibleSectionKeys.has('suppliers')
      ? [
          {
            key: 'supplier-list',
            label: 'Suppliers',
            detail: 'Approved supplier list',
            icon: 'PO',
            tone: 'blue' as const,
            onPress: () =>
              openNativeMobileSection('suppliers', {
                supplierWorkspace: 'supplier-list',
                screen: 'procurement',
              }),
          },
          {
            key: 'purchase-orders',
            label: 'Purchase Orders',
            detail: 'Create and follow orders',
            icon: 'PO',
            tone: 'olive' as const,
            onPress: () =>
              openNativeMobileSection('suppliers', {
                supplierWorkspace: 'create-purchase-order',
                screen: 'procurement',
              }),
          },
          {
            key: 'receiving',
            label: 'Receiving',
            detail: 'Receive supplier stock',
            icon: 'RC',
            tone: 'teal' as const,
            onPress: () =>
              openNativeMobileSection('suppliers', {
                supplierWorkspace: 'receive-purchase-order',
                screen: 'procurement',
              }),
          },
          {
            key: 'outstanding-orders',
            label: 'Outstanding',
            detail: 'Open purchase orders',
            icon: 'OP',
            tone: 'gold' as const,
            onPress: () =>
              openNativeMobileSection('suppliers', {
                supplierWorkspace: 'outstanding-purchase-orders',
                screen: 'procurement',
              }),
          },
        ]
      : []),
  ];
  const nativeGeneralStockActions: UbuzimaMobileAppAction[] = [
    ...(visibleSectionKeys.has('general-stock-items')
      ? [
          {
            key: 'general-stock-route',
            label: 'General Stock',
            detail: 'Open operational stock',
            icon: 'GS',
            tone: 'red' as const,
            onPress: () =>
              openNativeMobileSection('general-stock-items', {
                screen: 'general-stock',
              }),
          },
        ]
      : []),
    ...(visibleSectionKeys.has('suppliers')
      ? [
          {
            key: 'general-items-overview',
            label: 'Overview',
            detail: 'General item dashboard',
            icon: 'OV',
            tone: 'olive' as const,
            onPress: () =>
              openNativeMobileSection('suppliers', {
                supplierWorkspace: 'general-items-overview',
                screen: 'general-stock',
              }),
          },
          {
            key: 'general-item-master',
            label: 'Item Master',
            detail: 'Operational item catalog',
            icon: 'IM',
            tone: 'blue' as const,
            onPress: () =>
              openNativeMobileSection('suppliers', {
                supplierWorkspace: 'general-item-master',
                screen: 'general-stock',
              }),
          },
          {
            key: 'general-item-stock',
            label: 'Stock',
            detail: 'Quantities and valuation',
            icon: 'ST',
            tone: 'teal' as const,
            onPress: () =>
              openNativeMobileSection('suppliers', {
                supplierWorkspace: 'general-item-stock',
                screen: 'general-stock',
              }),
          },
          {
            key: 'general-item-usage',
            label: 'Usage',
            detail: 'Issues and consumption',
            icon: 'US',
            tone: 'gold' as const,
            onPress: () =>
              openNativeMobileSection('suppliers', {
                supplierWorkspace: 'general-item-usage',
                screen: 'general-stock',
              }),
          },
        ]
      : []),
  ];
  const nativeSalesActions: UbuzimaMobileAppAction[] = [
    ...(visibleSectionKeys.has('pos')
      ? [
          {
            key: 'pos-counter',
            label: 'POS Counter',
            detail: 'Open sale and cart',
            icon: 'POS',
            tone: 'olive' as const,
            onPress: () =>
              openNativeMobileSection('pos', {
                posWorkspace: 'pos',
                screen: 'sales',
              }),
          },
          {
            key: 'sales-performance',
            label: 'Sales Register',
            detail: 'Cashier activity and receipts',
            icon: 'REG',
            tone: 'olive' as const,
            onPress: () =>
              openNativeMobileSection('pos', {
                posWorkspace: 'sales-performance',
                screen: 'sales',
              }),
          },
          {
            key: 'payment-receipt',
            label: 'Payments',
            detail: 'Receipt and payment review',
            icon: 'PAY',
            tone: 'teal' as const,
            onPress: () =>
              openNativeMobileSection('pos', {
                posWorkspace: 'payment-receipt',
                screen: 'sales',
              }),
          },
          {
            key: 'dispensing-review',
            label: 'Dispensing',
            detail: 'Pharmacist review queue',
            icon: 'RX',
            tone: 'gold' as const,
            onPress: () =>
              openNativeMobileSection('pos', {
                posWorkspace: 'dispensing-review',
                screen: 'sales',
              }),
          },
        ]
      : []),
    ...(visibleSectionKeys.has('finance')
      ? [
          {
            key: 'finance-flow',
            label: 'Finance',
            detail: 'Receivables and collection',
            icon: 'FN',
            tone: 'blue' as const,
            onPress: () =>
              openNativeMobileSection('finance', {
                financeWorkspace: 'finance-flow',
                screen: 'sales',
              }),
          },
        ]
      : []),
  ];

  const nativeRoleTokens = profileRoleTokens(profile);
  const profileHasNativeRole = (...tokens: string[]) =>
    nativeRoleTokens.some((role) =>
      tokens.some((token) =>
        role === token ||
        role.endsWith(`_${token}`) ||
        role.includes(`_${token}_`),
      ),
    );
  const nativeRoleActionFallback =
    nativePrimaryActions.length > 0
      ? nativePrimaryActions
      : [
          {
            key: 'fallback-menu',
            label: 'Open Menu',
            detail: 'View all modules available to your account',
            icon: 'MN',
            tone: 'blue' as const,
            onPress: () => setMobileAppScreen('more'),
          },
        ];
  const nativeMobileWorkbench: UbuzimaMobileAppWorkbench = (() => {
    if (profileHasAdminAuthority(profile) || profileHasOwnerRole(profile)) {
      return {
        eyebrow: profileHasOwnerRole(profile) ? 'Owner workbench' : 'Admin workbench',
        title: 'Business control desk',
        summary: 'Start with the live dashboard, then move into sales, stock, procurement, and staff follow-up.',
        status: 'Executive operating view',
        actions: [
          ...(visibleSectionKeys.has('overview')
            ? [
                {
                  key: 'workbench-business-overview',
                  label: 'Business Overview',
                  detail: 'Live dashboard and management review',
                  icon: 'HM',
                  tone: 'olive' as const,
                  onPress: () => {
                    setMobileAppScreen('business');
                    navigateToSection('overview');
                  },
                },
              ]
            : []),
          ...nativeSalesActions.filter((action) => ['sales-performance', 'payment-receipt'].includes(action.key)),
          ...nativeStockActions.filter((action) => ['stock-low', 'stock-expiry'].includes(action.key)),
        ].slice(0, 4),
      };
    }

    if (
      profileHasNativeRole('cashier', 'sales_cashier', 'pos_cashier') ||
      profileHasGranularPermission(profile, ['pharmaco.pos.use', 'pos.sales.view', 'pos.payments.view'])
    ) {
      return {
        eyebrow: 'Cashier workbench',
        title: 'Counter and payments',
        summary: 'Open the POS counter, review receipts, capture payments, and keep the shift moving.',
        status: 'Front desk flow',
        actions: nativeSalesActions.filter((action) =>
          ['pos-counter', 'payment-receipt', 'sales-performance'].includes(action.key),
        ),
      };
    }

    if (
      profileHasNativeRole('pharmacist', 'dispensing', 'dispenser') ||
      profileHasGranularPermission(profile, ['pharmaco.inventory.view', 'inventory.products.view'])
    ) {
      return {
        eyebrow: 'Pharmacist workbench',
        title: 'Dispensing and medicine safety',
        summary: 'Review dispensing queues, product master, batches, low stock, and expiry risk.',
        status: 'Clinical operations',
        actions: [
          ...nativeSalesActions.filter((action) => action.key === 'dispensing-review'),
          ...nativeStockActions.filter((action) => ['stock-master', 'stock-batches', 'stock-expiry'].includes(action.key)),
        ].slice(0, 4),
      };
    }

    if (
      profileHasNativeRole('finance', 'accountant', 'collector') ||
      profileHasGranularPermission(profile, granularMenuPermissionMap.finance)
    ) {
      return {
        eyebrow: 'Finance workbench',
        title: 'Collections and reconciliation',
        summary: 'Follow receivables, payments, cashier activity, and daily settlement signals.',
        status: 'Finance desk',
        actions: [
          ...nativeSalesActions.filter((action) => ['finance-flow', 'payment-receipt', 'sales-performance'].includes(action.key)),
          ...nativePrimaryActions.filter((action) => action.key === 'pos-sales'),
        ].slice(0, 4),
      };
    }

    if (
      profileHasNativeRole('procurement', 'supplier', 'purchasing') ||
      profileHasGranularPermission(profile, granularMenuPermissionMap.suppliers)
    ) {
      return {
        eyebrow: 'Procurement workbench',
        title: 'Orders and receiving',
        summary: 'Move from supplier follow-up into purchase orders, receiving, and operational stock.',
        status: 'Supply desk',
        actions: [
          ...nativeProcurementActions,
          ...nativeGeneralStockActions.filter((action) => action.key === 'general-items-overview'),
        ].slice(0, 4),
      };
    }

    if (
      profileHasNativeRole('inventory', 'storekeeper', 'stock') ||
      profileHasGranularPermission(profile, granularMenuPermissionMap.inventory)
    ) {
      return {
        eyebrow: 'Inventory workbench',
        title: 'Stock control',
        summary: 'Check low stock, expiry, batches, product master, and shelf quantities.',
        status: 'Stock desk',
        actions: nativeStockActions.slice(0, 4),
      };
    }

    return {
      eyebrow: 'Staff workbench',
      title: 'Your available tools',
      summary: 'Open the modules your account can access and continue from your permitted workflows.',
      status: 'Role based access',
      actions: nativeRoleActionFallback.slice(0, 4),
    };
  })();

  const nativeMobileMenuGroups: UbuzimaMobileAppMenuGroup[] =
    visibleMenuGroups.map((group) => ({
      key: group.key,
      label: group.label,
      items: group.items.map((item) => ({
        key: `${group.key}-${item.key}-${item.context ?? 'root'}`,
        label: item.label,
        description: item.description,
        icon: item.icon,
        status: item.status,
        onPress: () => {
          handleMenuItemClick(item);
          setMobileAppScreen(mobileAppScreenForSection(item.key));
        },
      })),
    }));

  return (
    <main
      className={`dashboard-shell dashboard-shell--mobile-app-ready dashboard-shell--fresh-mobile-app ${
        isMobileDrawerOpen ? 'dashboard-shell--mobile-drawer-open' : ''
      }`}
      style={leftMenuStyle}
    >
      <UbuzimaMobileApp
        activeScreen={mobileAppScreen}
        brandLogoSrc={brandLogoSrc}
        currentWorkspace={mobileActiveTitle}
        installAvailable={isPwaInstallAvailable}
        isInstalling={isPwaInstalling}
        isOnline={isOnline}
        isStandalone={isStandalonePwa}
        menuGroups={nativeMobileMenuGroups}
        metrics={nativeMetrics}
        navigationItems={nativeMobileNavItems}
        primaryActions={nativePrimaryActions}
        procurementActions={nativeProcurementActions}
        generalStockActions={nativeGeneralStockActions}
        profileAvatarUrl={profileAvatarUrl}
        profileInitials={profileInitials}
        profileInstitution={profileInstitution}
        profileName={profileDisplayName}
        salesActions={nativeSalesActions}
        stockActions={nativeStockActions}
        unreadMailCount={unreadMailCount}
        workbench={nativeMobileWorkbench}
        onChangePassword={() => {
          setChangePasswordError('');
          setChangePasswordNotice('');
          setChangePasswordForm({ current_password: '', password: '', password_confirmation: '' });
          setIsChangePasswordOpen(true);
        }}
        onCorporateEmail={() => openNativeMobileSection('corporate-email', { screen: 'more' })}
        onInstall={requestPwaInstall}
        onOpenBusinessOverview={() => {
          setMobileAppScreen('business');
          if (visibleSectionKeys.has('overview')) {
            navigateToSection('overview');
          }
        }}
        onRefresh={refreshMobileWorkspace}
        onScreenChange={handleNativeMobileScreenChange}
        onSignOut={handleLogout}
      />

      <header className="ubuzima-mobile-topbar" aria-label="Ubuzima+ mobile app bar">
        <button
          type="button"
          className="ubuzima-mobile-icon-button"
          aria-label="Open navigation menu"
          aria-expanded={isMobileDrawerOpen}
          onClick={() => setIsMobileDrawerOpen((current) => !current)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <div className="ubuzima-mobile-brand">
          <img src={brandLogoSrc} alt="" />
          <div>
            <strong>{mobileActiveTitle}</strong>
            <small>{mobileShellStatus}</small>
          </div>
        </div>

        {isPwaInstallAvailable && !isStandalonePwa ? (
          <button
            type="button"
            className="ubuzima-mobile-install-button"
            onClick={requestPwaInstall}
            disabled={isPwaInstalling}
          >
            {isPwaInstalling ? 'Opening' : 'Install'}
          </button>
        ) : (
          <button
            type="button"
            className="ubuzima-mobile-icon-button ubuzima-mobile-refresh-button"
            aria-label="Refresh current workspace"
            onClick={refreshMobileWorkspace}
          >
            SY
          </button>
        )}
      </header>

      <button
        type="button"
        className="ubuzima-mobile-drawer-overlay"
        aria-label="Close navigation menu"
        hidden={!isMobileDrawerOpen}
        onClick={() => setIsMobileDrawerOpen(false)}
      />

      <aside
        className="sidebar"
        data-admin-sidebar
        onClickCapture={(event) => {
          const target = event.target as HTMLElement | null;

          if (target?.closest('button,a')) {
            window.setTimeout(() => {
              setIsMobileDrawerOpen(false);
            }, 150);
          }
        }}
      >
        <div className="sidebar-inner">
          <div className="sidebar-brand">
            <img className="sidebar-logo" src={brandLogoSrc} alt="Ubuzima+" />
            <div>
              <strong>Ubuzima+</strong>
              <span>
                {isAdminProfile
                  ? 'Admin Center'
                  : isOwnerProfile
                    ? 'Owner Business Center'
                    : 'Operations Center'}
              </span>
            </div>
          </div>

          <nav
            className="tree-nav tree-nav--principal"
            aria-label={
              isAdminProfile
                ? 'Admin workspace navigation'
                : 'Operational workspace navigation'
            }
          >
            {isAdminProfile && (
              <button
                type="button"
                className={`tree-root-button principal-menu-button ${activeSection === 'overview' ? 'active' : ''}`}
                data-section="overview"
                onClick={() =>
                  navigateToSection('overview')
                }
              >
                <span className="nav-icon">DB</span>
                <span className="principal-menu-title">
                  Dashboard
                </span>
              </button>
            )}

            {[...principalMenuItems]
              .sort((left, right) => {
                if (left.item.key === right.item.key) return 0;
                if (left.item.key === 'pos') return -1;
                if (right.item.key === 'pos') return 1;
                return 0;
              })
              .map(({ group, item }) => {
              const moduleOwnsInternalNavigation = [
                'inventory',
                'insurance',
                'pos',
                'suppliers',
                'finance',
                'reports',
                'security',
                'admin-management',
                'ai-center',
                'admin-panel',
              ].includes(item.key);
              const childSubmenus = moduleOwnsInternalNavigation
                ? []
                : (leftMenuSubmenus[item.key] ?? []);
              const itemActive = isActiveMenuItem(item);

              return (
                <div
                  key={`${group.key}-${item.label}`}
                  className={`principal-menu-section ${itemActive ? 'active' : ''}`}
                  data-principal-menu={item.key}
                >
                  <button
                    type="button"
                    className={`principal-menu-button ${itemActive ? 'active' : ''}`}
                    data-section={item.key}
                    aria-expanded={Boolean(openPrincipalMenus[item.key])}
                    onClick={() => togglePrincipalMenu(item)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="principal-menu-title">{item.label}</span>
                    {childSubmenus.length > 0 && (
                      <span className="principal-menu-toggle-sign" aria-hidden="true">
                        {openPrincipalMenus[item.key] ? '-' : '+'}
                      </span>
                    )}
                  </button>

                  {childSubmenus.length > 0 && openPrincipalMenus[item.key] && (
                    <div className="tree-child-submenu" aria-label={`${item.label} pages`}>
                      {childSubmenus.filter((submenu) => leftSubmenuIsVisibleForProfile(profile, item, submenu)).map((submenu) => (
                        <button
                          key={submenu.key}
                          type="button"
                          className={isActiveLeftSubmenu(item, submenu) ? 'active' : ''}
                          data-section={item.key}
                          data-submenu={submenu.key}
                          onClick={() => handleLeftSubmenuClick(item, submenu)}
                        >
                          <span>{submenu.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <button className="logout-button" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header dashboard-header--fixed dashboard-header--refined">
          <div className="dashboard-title-card">
            <p className="eyebrow">{currentSection.eyebrow}</p>
            <h1>{activeLeftSubmenuLabel ?? currentSection.title}</h1>
          </div>

          <div className="dashboard-header-center-actions">
            <button type="button" onClick={goBack} disabled={navigationStack.length === 0}>
              Back
            </button>
            <a href={publicWebsiteUrl} target="_blank" rel="noreferrer">{publicWebsiteLabel}</a>
            <button
              type="button"
              className="header-mail-button"
              onClick={() => {
                navigateToSection('corporate-email');
              }}
            >
              Corporate Email
              {unreadMailCount > 0 && <span className="action-badge" aria-label={`${unreadMailCount} unread emails`}>{unreadMailCount}</span>}
            </button>
          </div>

          <div className="dashboard-header-corner">
            <button
              type="button"
              className="language-corner-button"
              onClick={() => setStaffLoginLanguage(nextStaffLoginLanguage)}
            >
              {staffLoginLanguage}
            </button>

            <div className="profile-avatar-shell">
              <button
                type="button"
                className="profile-avatar-button"
                onClick={() => setIsProfileMenuOpen((current) => !current)}
                aria-expanded={isProfileMenuOpen}
                aria-label="Open staff profile"
              >
                {profileAvatarUrl ? (
                  <img src={profileAvatarUrl} alt={profileDisplayName} />
                ) : (
                  <span>{profileInitials}</span>
                )}
              </button>

              {isProfileMenuOpen && (
                <section className="profile-popover" aria-label="Staff profile summary">
                  <div className="profile-popover-heading">
                    <div className="profile-popover-avatar">
                      {profileAvatarUrl ? (
                        <img src={profileAvatarUrl} alt={profileDisplayName} />
                      ) : (
                        <span>{profileInitials}</span>
                      )}
                    </div>
                    <div>
                      <strong>{profileDisplayName}</strong>
                      <small>{profileInstitution}</small>
                    </div>
                  </div>

                  <dl>
                    <div>
                      <dt>Name</dt>
                      <dd>{profile!.user.name || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{profile!.user.email}</dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>{profile!.user.phone || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt>Institution</dt>
                      <dd>{profileInstitution}</dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setActiveAdminPanelWorkspace('user-profiles');
                      navigateToSection('admin-panel');
                    }}
                  >
                    Edit Profile
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setChangePasswordError('');
                      setChangePasswordNotice('');
                      setChangePasswordForm({ current_password: '', password: '', password_confirmation: '' });
                      setIsChangePasswordOpen(true);
                    }}
                  >
                    Change Password
                  </button>
                </section>
              )}
            </div>
          </div>
        </header>

        {unreadMailCount > 0 && (
          <button
            type="button"
            className="mail-notification-banner"
            onClick={() => navigateToSection('corporate-email')}
            aria-label={`${unreadMailCount} unread corporate emails`}
          >
            <span className="mail-notification-dot" />
            <strong>
              {unreadMailCount} unread corporate email{unreadMailCount === 1 ? '' : 's'}
            </strong>
            <small>Open Corporate Email</small>
          </button>
        )}

        <section className="ubuzima-mobile-action-strip" aria-label="Mobile quick actions">
          {!isOnline && (
            <div className="ubuzima-mobile-offline-banner" role="status">
              <strong>Offline mode</strong>
              <span>Saved screens remain available while the network reconnects.</span>
            </div>
          )}

          <div className="ubuzima-mobile-section-context">
            <span>{currentSection.eyebrow}</span>
            <strong>{mobileActiveTitle}</strong>
          </div>

          {mobileQuickActions.length > 0 && (
            <div className="ubuzima-mobile-quick-grid">
              {mobileQuickActions.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    navigateToMobileSection(item.section, {
                      posWorkspace: item.posWorkspace,
                    })
                  }
                >
                  <span>{item.icon}</span>
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-scroll-panel">
          {renderActiveSection()}
        </section>

        {loginSuccess && (
          <LoginSuccessOverlay
            experience={loginSuccess}
            onClose={() =>
              setLoginSuccess(null)
            }
          />
        )}

        {isChangePasswordOpen && (
          <div className="recovery-overlay" role="dialog" aria-modal="true" aria-label="Change password">
            <section className="recovery-overlay-card password-change-card">
              <p className="eyebrow">Profile security</p>
              <h2>Change password</h2>
              <p className="muted">Use your current password, then set a new secure password for this account.</p>

              <form className="password-change-form" onSubmit={handleChangePassword}>
                <label>
                  Current password
                  <input
                    type="password"
                    value={changePasswordForm.current_password}
                    onChange={(event) => setChangePasswordForm((current) => ({ ...current, current_password: event.target.value }))}
                    autoComplete="current-password"
                    required
                  />
                </label>

                <label>
                  New password
                  <input
                    type="password"
                    value={changePasswordForm.password}
                    onChange={(event) => setChangePasswordForm((current) => ({ ...current, password: event.target.value }))}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>

                <label>
                  Confirm new password
                  <input
                    type="password"
                    value={changePasswordForm.password_confirmation}
                    onChange={(event) => setChangePasswordForm((current) => ({ ...current, password_confirmation: event.target.value }))}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>

                {changePasswordError && <div className="form-error">{changePasswordError}</div>}
                {changePasswordNotice && <div className="form-success">{changePasswordNotice}</div>}

                <div className="password-change-actions">
                  <button type="submit" disabled={isChangingPassword}>
                    {isChangingPassword ? 'Changing…' : 'Change password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangePasswordOpen(false);
                      setChangePasswordError('');
                      setChangePasswordNotice('');
                    }}
                  >
                    Close
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {newRecoveryCodes && (
          <div className="recovery-overlay" role="dialog" aria-modal="true" aria-label="Recovery codes">
            <section className="recovery-overlay-card">
              <p className="eyebrow">Two-factor recovery</p>
              <h2>Store these recovery codes securely.</h2>
              <p className="muted">
                They are shown once and can be used if an authenticator device is unavailable.
              </p>
              <div>
                {newRecoveryCodes.map((code) => (
                  <code key={code}>{code}</code>
                ))}
              </div>
              <button type="button" onClick={() => setNewRecoveryCodes(null)}>
                Continue to workspace
              </button>
            </section>
          </div>
        )}
      </section>

      <nav className="ubuzima-mobile-bottom-nav" aria-label="Primary mobile navigation">
        {mobileBottomNavItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={activeSection === item.section ? 'active' : ''}
            onClick={() =>
              navigateToMobileSection(item.section, {
                posWorkspace: item.posWorkspace,
              })
            }
          >
            <span>{item.icon}</span>
            <small>{item.label}</small>
          </button>
        ))}

        <button
          type="button"
          className={isMobileDrawerOpen ? 'active' : ''}
          onClick={() => setIsMobileDrawerOpen((current) => !current)}
        >
          <span>MN</span>
          <small>Menu</small>
        </button>
      </nav>
    </main>
  );
}

export default App;

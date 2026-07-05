import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AccessCheckResult, AccessProfile, BranchDepartmentsResponse, BranchesResponse, LoginResponse, PharmacyProfileResponse, PharmaStockBatch, TwoFactorSetupPayload, getAuthenticatedProfile, getBranchDepartments, getCorporateMailOverview, getPharmaBranches, getPharmaInventoryBatches, getPharmacyProfile, login, logout, requestPasswordReset, changePassword, runAccessCheck, verifyTwoFactor } from './lib/api';
import { PharmaCoreEditor } from './components/PharmaCoreEditor';
import { ProductInventoryPreview, type InventoryView } from './components/ProductInventoryPreview';
import { ProductInventoryActions } from './components/ProductInventoryActions';
import { SalesDispensingReview } from './components/SalesDispensingReview';
import { ProcurementWorkflow } from './components/ProcurementWorkflow';
import { PayablesWorkflow } from './components/PayablesWorkflow';
import { ReportingDashboard } from './components/ReportingDashboard';
import { PharmacoOperationsCommandCenter } from './components/PharmacoOperationsCommandCenter';
import { TwoFactorAdminPanel } from './components/TwoFactorAdminPanel';
import { PlatformManagementPanel } from './components/PlatformManagementPanel';
import { CorporateEmailPanel } from './components/CorporateEmailPanel';
import { PharmacistChatPanel } from './components/PharmacistChatPanel';
import { DataLayerAdminPanel } from './components/DataLayerAdminPanel';
import { AiOperationsPanel } from './components/AiOperationsPanel';
import { NotificationCenterPanel } from './components/NotificationCenterPanel';
import { MarketLocalizationPanel } from './components/MarketLocalizationPanel';
import { NearbyProvidersPanel } from './components/NearbyProvidersPanel';
import { TenantPharmacyDashboard } from './components/TenantPharmacyDashboard';
import { UserSecurityManagement } from './components/UserSecurityManagement';
import { applyInputKeyboardModes } from './lib/formUsability';
import { RuntimeLanguage, applyRuntimeLanguage } from './lib/runtimeI18n';
import './styles.css';
import ReceivablesWorkflow from './components/ReceivablesWorkflow';

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
  | 'inventory'
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
  | 'received-purchase-orders';
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
type PosInsuranceInstitutionRate = {
  id: string;
  name: string;
  customerContributionPercent: number;
};

type PosInsuranceRate = {
  id: string;
  name: string;
  masterCustomerContributionPercent: number;
  institutions: PosInsuranceInstitutionRate[];
};

const posInsuranceRates: PosInsuranceRate[] = [
  {
    id: 'rssb',
    name: 'RSSB',
    masterCustomerContributionPercent: 15,
    institutions: [
      { id: 'rssb-public', name: 'Public Institution', customerContributionPercent: 10 },
      { id: 'rssb-private', name: 'Private Employer Group', customerContributionPercent: 20 },
    ],
  },
  {
    id: 'mmi',
    name: 'MMI',
    masterCustomerContributionPercent: 20,
    institutions: [
      { id: 'mmi-defense', name: 'Defence Institution', customerContributionPercent: 10 },
      { id: 'mmi-affiliate', name: 'Affiliate Employer', customerContributionPercent: 25 },
    ],
  },
  {
    id: 'radiant',
    name: 'Radiant Insurance',
    masterCustomerContributionPercent: 30,
    institutions: [
      { id: 'radiant-corporate', name: 'Corporate Scheme', customerContributionPercent: 15 },
    ],
  },
];

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
}): PosSaleSummary {
  const selectedInsurance = posInsuranceRates.find((insurance) => insurance.id === input.insuranceProviderId) ?? posInsuranceRates[0];
  const selectedInstitution = selectedInsurance.institutions.find((institution) => institution.id === input.insuranceInstitutionId) ?? null;

  const lineCount = input.cartItems.length;
  const totalQuantity = input.cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = input.cartItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = Math.min(Number(input.discountAmount || 0), subtotal);
  const taxableBase = Math.max(0, subtotal - discount);
  const tax = Math.round(taxableBase * 0.18);

  const customerContributionPercent =
    input.paymentMethod === 'insurance'
      ? selectedInstitution?.customerContributionPercent ?? selectedInsurance.masterCustomerContributionPercent
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
    { key: 'admin-2fa', label: '2FA Management', target: 'two-factor-auth' },
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
const brandLogoSrc = '/assets/ubuzima-logo.png';
const vitaPharmaLogoSrc = '/assets/vitapharma-logo.png';
const staffLoginLanguages = ['English', 'French', 'Portuguese'] as const;
type StaffLoginLanguage = typeof staffLoginLanguages[number];

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
  inventory: {
    eyebrow: 'Inventory and product control',
    title: 'Inventory command workspace',
    description: 'Batch, expiry, FEFO, stock movement, receiving, and shelf-readiness workflows.',
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
    eyebrow: 'Access and governance',
    title: 'Security, roles, and tenant scope',
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
      { key: 'admin-panel', context: 'two-factor-auth', label: 'Staff 2FA', description: 'Authenticator and trusted devices', icon: '2FA', status: 'Mandatory' },
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
  return permissions.some((permission) => profile.permissions.includes(permission));
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
  pos: [
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
  security: [
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

function profilePermissionSet(profile: AccessProfile | undefined): Set<string> {
  return new Set((profile?.permissions ?? []).map((permission) => normalizePermissionKey(permission)));
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
  if (profile.scope.is_platform) return true;

  const adminRoles = new Set([
    'admin',
    'administrator',
    'super_admin',
    'system_admin',
    'platform_admin',
    'solution_admin',
    'tenant_admin',
    'owner',
  ]);

  return profileRoleTokens(profile).some((role) => adminRoles.has(role));
}

function profileHasGranularPermission(profile: AccessProfile | undefined, permissions: string[]): boolean {
  if (!profile) return false;
  if (profileHasAdminAuthority(profile)) return true;

  const availablePermissions = profilePermissionSet(profile);

  return permissions
    .map((permission) => normalizePermissionKey(permission))
    .some((permission) => availablePermissions.has(permission));
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
          add: 'tenant.profile.add',
          edit: 'tenant.profile.edit',
          delete: 'tenant.profile.delete',
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
  if (!profile || profile.scope.is_platform) {
    return menuGroups;
  }

  if (profile.scope.is_solution) {
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
        { key: 'pos', label: 'POS and Sales', description: 'Counter sales and dispensing', icon: 'PS', status: 'Live' },
        { key: 'inventory', label: 'Inventory', description: 'Products, stock, batches', icon: 'IN', status: 'Live' },
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
        { key: 'security', label: 'Users and Security', description: 'Scope, roles, access', icon: 'SC', status: 'Protected' },
        { key: 'admin-panel', context: 'two-factor-auth', label: 'Staff 2FA', description: 'Authenticator and trusted devices', icon: '2F', status: 'Mandatory' },
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

function loadStoredActiveSection(): AdminSectionKey {
  try {
    const stored = localStorage.getItem(activeSectionStorageKey) as AdminSectionKey | null;
    return stored && sectionMeta[stored] ? stored : 'overview';
  } catch {
    return 'overview';
  }
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
  const [navigationStack, setNavigationStack] = useState<AdminSectionKey[]>([]);
  const [activeErpWorkspace, setActiveErpWorkspace] = useState<ErpWorkspaceKey>('erp-overview');
  const [activeSolution, setActiveSolution] = useState<SolutionKey>('pharmaco');
  const [activePharmaSegment, setActivePharmaSegment] = useState<PharmaSegmentKey>('retail');
  const [activePharmaFeature, setActivePharmaFeature] = useState<PharmaFeatureKey>('ai-model');
  const [activeAiWorkspace, setActiveAiWorkspace] = useState<AiWorkspaceKey>('model-registry');
  const [activeAdminPanelWorkspace, setActiveAdminPanelWorkspace] = useState<AdminPanelWorkspaceKey>('backend-api');
  const [activePosWorkspace, setActivePosWorkspace] = useState<PosWorkspaceKey>('overview');
  const [isPosDayOpen, setIsPosDayOpen] = useState(false);
  const [posOpeningMode, setPosOpeningMode] = useState<'fresh-start' | 'handover'>('fresh-start');
  const [posStartingCashBalance, setPosStartingCashBalance] = useState('0');
  const [posCustomerType, setPosCustomerType] = useState<'walk-in' | 'existing-customer' | 'insurance-customer' | 'corporate-customer'>('walk-in');
  const [posPrescriptionStatus, setPosPrescriptionStatus] = useState<'not-required' | 'required' | 'captured' | 'manual-review'>('not-required');
  const [posPaymentMethod, setPosPaymentMethod] = useState<'cash' | 'momo' | 'card' | 'insurance' | 'credit'>('cash');
  const [posInsuranceProvider, setPosInsuranceProvider] = useState('rssb');
  const [posInsuranceInstitution, setPosInsuranceInstitution] = useState('');
  const [posCustomerInvoice, setPosCustomerInvoice] = useState<'no' | 'yes'>('no');
  const [posInvoiceDelivery, setPosInvoiceDelivery] = useState<'printer' | 'whatsapp' | 'email'>('printer');
  const [posInvoiceContact, setPosInvoiceContact] = useState('');
  const [posDiscountAmount, setPosDiscountAmount] = useState('0');
  const [posTransactionConfirmed, setPosTransactionConfirmed] = useState(false);
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
    batchId: number;
    productId: number;
    batchNumber: string;
    availableQuantity: number;
    expiryDate: string | null;
    locationName: string;
  }>>([]);
  const [posInventoryBatches, setPosInventoryBatches] = useState<PharmaStockBatch[]>([]);
  const [isLoadingPosInventory, setIsLoadingPosInventory] = useState(false);
  const [posInventoryError, setPosInventoryError] = useState('');
  const [posInventoryLoadedAt, setPosInventoryLoadedAt] = useState('');
  const [posSaleSummary, setPosSaleSummary] = useState<PosSaleSummary>(() =>
    calculatePosSaleSummary({
      cartItems: [],
      discountAmount: '0',
      paymentMethod: 'cash',
      insuranceProviderId: 'rssb',
      insuranceInstitutionId: '',
    }),
  );
  const [posSummaryRefreshKey, setPosSummaryRefreshKey] = useState(0);
  const [activeSupplierWorkspace, setActiveSupplierWorkspace] = useState<SupplierWorkspaceKey>('overview');
  const [activeFinanceWorkspace, setActiveFinanceWorkspace] = useState<FinanceWorkspaceKey>('overview');
  const [activeAdhocReportWorkspace, setActiveAdhocReportWorkspace] = useState<AdhocReportWorkspaceKey>('overview');
  const [activeNotificationWorkspace, setActiveNotificationWorkspace] = useState<'overview' | 'create-notification' | 'recurring-notifications' | 'platform-notification-center'>('overview');
  const [activePharmacistChatWorkspace, setActivePharmacistChatWorkspace] = useState<'in-app-chat' | 'whatsapp-chat'>('in-app-chat');
  const [activeInventoryView, setActiveInventoryView] = useState<InventoryView>('overview');
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

  const profile = session?.profile;
  const visibleMenuGroups = useMemo(() => buildVisibleMenuGroups(profile), [profile]);
  const visibleSectionKeys = useMemo(() => {
    const keys = new Set<AdminSectionKey>(['overview']);
    visibleMenuGroups.forEach((group) => group.items.forEach((item) => keys.add(item.key)));
    return keys;
  }, [visibleMenuGroups]);
  const principalMenuItems = useMemo(
    () => visibleMenuGroups.flatMap((group) => group.items.map((item) => ({ group, item }))),
    [visibleMenuGroups],
  );
  const currentSection = sectionMeta[activeSection] ?? sectionMeta.overview;
  const activeLeftSubmenuLabel =
    leftMenuSubmenus[activeSection]?.find((submenu) => {
      if (activeSection === 'inventory') return submenu.target === activeInventoryView;
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
    ? `Logged in now as ${profile.user.name || profile.user.email}`
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
    (profile?.scope.type ? `${profile.scope.type} scope` : 'Ubuzima+');
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
  }, [activeAdminPanelWorkspace, activeAdhocReportWorkspace, activeAiWorkspace, activeErpWorkspace, activeFinanceWorkspace, activePharmaFeature, activePosWorkspace, activeSection, activeSupplierWorkspace, loginMethod, profile, staffLoginLanguage]);

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
        items: profile.permissions.filter((item) => item.includes('roles') || item.includes('audit')),
      },
      {
        title: 'Operations 360',
        items: profile.permissions.filter((item) => item.startsWith('pharmaco.')),
      },
      {
        title: 'AI & Platform',
        items: profile.permissions.filter((item) => item.includes('ai') || item.includes('platform')),
      },
    ].filter((group) => group.items.length > 0);
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(activeSectionStorageKey, activeSection);
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
  } as CSSProperties;

  useEffect(() => {
    if (!session?.token) {
      setUnreadMailCount(0);
      return;
    }

    let cancelled = false;

    async function loadUnreadMailCount() {
      try {
        const response = await getCorporateMailOverview(session.token, 'inbox');
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
    if (profile && !visibleSectionKeys.has(activeSection)) {
      setActiveSection('overview');
      setNavigationStack([]);
    }
  }, [activeSection, profile, visibleSectionKeys]);

  function navigateToSection(section: AdminSectionKey) {
    if (section === activeSection) {
      return;
    }

    setNavigationStack((current) => [activeSection, ...current].slice(0, 10));
    setActiveSection(section);
  }

  function activateModuleDefaultPage(item: MenuItem) {
    const firstSubmenu = leftMenuSubmenus[item.key]?.[0];

    if (item.key === 'inventory' && firstSubmenu?.target) setActiveInventoryView(firstSubmenu.target as InventoryView);
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

      const nextSession = {
        token: response.access_token,
        profile: response.profile,
      };

      persistSession(nextSession);
    } catch (err) {
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
      persistSession(nextSession, response.trusted_device?.trusted_device_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Two-factor verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    if (session?.token) {
      await logout(session.token).catch(() => undefined);
    }

    localStorage.removeItem(storageKey);
    setSession(null);
    setAccessCheck(null);
    setPharmaCore({
      profile: null,
      branches: null,
      departments: null,
    });
    setPharmaCoreError('');
    setPosCartItems([]);
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
      const response = await changePassword(session.token, changePasswordForm);
      persistSession({ token: session.token, profile: response.profile });
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
      const result = await runAccessCheck(session.token, endpoint, tenantSlug);
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
      const profileResponse = await getPharmacyProfile(session.token, tenantSlug);
      const branchesResponse = await getPharmaBranches(session.token, tenantSlug);
      const firstBranch = branchesResponse.branches[0] ?? null;
      const departmentsResponse = firstBranch
        ? await getBranchDepartments(session.token, tenantSlug, firstBranch.id)
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
      <main className="auth-shell">
        <section className="auth-panel">
          <img className="auth-logo" src={brandLogoSrc} alt="Ubuzima+" />
          <p className="eyebrow">Ubuzima+ Platform</p>
          <h1>Checking your secure session.</h1>
          <p className="auth-copy">
            We are validating your stored access token before opening the admin workspace.
          </p>
        </section>

        <section className="auth-side">
          <div className="status-card">
            <span className="status-dot" />
            <div>
              <strong>Session validation</strong>
              <p>Stored sessions are verified through the backend before dashboard access.</p>
            </div>
          </div>
        </section>
      </main>
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
        <strong>{profile.roles.length}</strong>
      </article>
      <article>
        <span>Permissions</span>
        <strong>{profile.permissions.length}</strong>
      </article>
      <article>
        <span>Tenant assignments</span>
        <strong>{profile.tenant_assignments.length}</strong>
      </article>
      <article>
        <span>Admin scopes</span>
        <strong>{profile.admin_scopes.length}</strong>
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
            <h3>{pharmaCore.profile.profile.trading_name}</h3>
            <p>{pharmaCore.profile.profile.legal_name}</p>
            <div className="mini-facts">
              <span>Category: {pharmaCore.profile.profile.pharmacy_category}</span>
              <span>Regulator: {pharmaCore.profile.profile.regulator_name}</span>
              <span>Status: {pharmaCore.profile.profile.status}</span>
              <span>District: {pharmaCore.profile.profile.district ?? 'Not set'}</span>
            </div>
          </section>

          <section className="pharmaco-card">
            <span className="section-label">Capabilities</span>
            <div className="tag-list">
              {pharmaCore.profile.profile.capabilities.map((capability) => (
                <span key={capability}>{capability.replaceAll('_', ' ')}</span>
              ))}
            </div>
          </section>

          <section className="pharmaco-card">
            <span className="section-label">Insurance partners</span>
            <div className="tag-list">
              {pharmaCore.profile.profile.insurance_partners.map((partner) => (
                <span key={partner}>{partner}</span>
              ))}
            </div>
          </section>

          <section className="pharmaco-card">
            <span className="section-label">Operating hours</span>
            <div className="mini-facts">
              {Object.entries(pharmaCore.profile.profile.operating_hours).map(([day, hours]) => (
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
      {profile.tenant_assignments.length === 0 ? (
        <p className="muted">No tenant assignment is attached to this account.</p>
      ) : (
        <div className="tenant-table">
          {profile.tenant_assignments.map((assignment) => (
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
            <PayablesWorkflow token={session.token} profile={profile} />
            <ReceivablesWorkflow token={session.token} profile={profile} />
          </>
        )}

        {activeErpWorkspace === 'procurement' && (
          <ProcurementWorkflow token={session.token} profile={profile} />
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
<AiOperationsPanel token={session.token} profile={profile} />
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

        {selectedFeature.key === 'inventory' && (
          <>
<ProductInventoryPreview
              token={session.token}
              profile={profile}
              activeView={activeInventoryView}
              onActiveViewChange={setActiveInventoryView}
              showInternalNavigation={false}
            />
            {activeInventoryView === 'product-master' && (
              <div className="product-inventory-actions-legacy-hidden" aria-hidden="true">

                <ProductInventoryActions token={session.token} profile={profile} />

              </div>
            )}
          </>
        )}

        {selectedFeature.key === 'pos' && (
          <>
<SalesDispensingReview token={session.token} profile={profile} />
          </>
        )}

        {selectedFeature.key === 'procurement' && (
          <>
<ProcurementWorkflow token={session.token} profile={profile} />
          </>
        )}

        {selectedFeature.key === 'reports' && (
          <>
            <PharmacoOperationsCommandCenter token={session.token} profile={profile} />
            <ReportingDashboard token={session.token} profile={profile} />
          </>
        )}

        {selectedFeature.key === 'product-master' && (
          <>
            <ProductInventoryPreview token={session.token} profile={profile} />
            <div className="product-inventory-actions-legacy-hidden" aria-hidden="true">

              <ProductInventoryActions token={session.token} profile={profile} />

            </div>
          </>
        )}

        {['prescriptions', 'customers'].includes(selectedFeature.key) && (
          <SalesDispensingReview token={session.token} profile={profile} />
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
      .slice(0, 10)
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
        };
      });

    const salesSummaryRows: Array<{
      dateTime: string;
      saleNumber: string;
      customer: string;
      method: string;
      status: string;
      amount: string;
    }> = [];

    const selectedInsurance = posInsuranceRates.find((insurance) => insurance.id === posInsuranceProvider) ?? posInsuranceRates[0];

    async function loadCurrentPosInventory() {
      if (!session?.token) return;

      setIsLoadingPosInventory(true);
      setPosInventoryError('');
      setPosNotice('');

      try {
        const response = await getPharmaInventoryBatches(session.token, posTenantSlug, undefined, { perPage: 150, sellableOnly: true });
        const batches = response.batches || [];

        setPosInventoryBatches(batches);
        setPosInventoryLoadedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setPosCartItems([]);
        setPosTransactionConfirmed(false);

        const sellableCount = batches.filter((batch) => {
          const availableQuantity = resolveBatchAvailableQuantity(batch);
          const expiryIsValid = !batch.expiry_date || batch.expiry_date >= new Date().toISOString().slice(0, 10);

          return availableQuantity > 0 && (!batch.status || batch.status === 'active') && expiryIsValid;
        }).length;

        setPosNotice(`Current inventory loaded. ${sellableCount} sellable batch${sellableCount === 1 ? '' : 'es'} available for POS picking.`);
      } catch (err) {
        setPosInventoryError(err instanceof Error ? err.message : 'Unable to load current inventory for POS.');
      } finally {
        setIsLoadingPosInventory(false);
      }
    }

    function forceRefreshSaleSummary() {
      setPosSaleSummary(
        calculatePosSaleSummary({
          cartItems: posCartItems,
          discountAmount: posDiscountAmount,
          paymentMethod: posPaymentMethod,
          insuranceProviderId: posInsuranceProvider,
          insuranceInstitutionId: posInsuranceInstitution,
        }),
      );
      setPosNotice('Payment summary updated from the current cart and Transaction Set-UP settings.');
    }

    function addPosProductToCart(product: typeof posProducts[number]) {
      if (!product.batchId || product.availableQuantity <= 0) {
        setPosNotice('This product is not available in current inventory and cannot be sold.');
        return;
      }

      setPosCartItems((current) => {
        const existing = current.find((item) => item.code === product.code);

        if (existing) {
          const nextQuantity = Math.min(existing.quantity + 1, product.availableQuantity);

          if (nextQuantity === existing.quantity) {
            setPosNotice(`${product.name} cannot exceed available inventory of ${product.availableQuantity}.`);
          }

          return current.map((item) =>
            item.code === product.code
              ? {
                  ...item,
                  quantity: nextQuantity,
                  availableQuantity: product.availableQuantity,
                  unitPrice: product.unitPrice,
                }
              : item,
          );
        }

        return [
          ...current,
          {
            code: product.code,
            name: product.name,
            strength: product.strength,
            quantity: 1,
            unitPrice: product.unitPrice,
            batchId: product.batchId,
            productId: product.productId,
            batchNumber: product.batchNumber,
            availableQuantity: product.availableQuantity,
            expiryDate: product.expiryDate,
            locationName: product.locationName,
          },
        ].slice(0, 10);
      });

      setPosTransactionConfirmed(false);
    }

    function updateCartQuantity(code: string, quantity: number) {
      setPosCartItems((current) =>
        current.map((item) => {
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
        }),
      );

      setPosTransactionConfirmed(false);
    }

    function removeCartItem(code: string) {
      setPosCartItems((current) => current.filter((item) => item.code !== code));
      setPosTransactionConfirmed(false);
      setPosNotice('Item removed from cart.');
    }

    function clearPosCart() {
      setPosCartItems([]);
      setPosTransactionConfirmed(false);
      setPosNotice('Cart cleared.');
    }

    function openPosDay() {
      setIsPosDayOpen(true);
      setPosTransactionConfirmed(false);
      setPosNotice(
        posOpeningMode === 'fresh-start'
          ? 'POS day opened. Starting cash balance requires manager confirmation for a fresh start day.'
          : 'POS day opened from handover. Incoming staff acknowledgement becomes the next starting position.',
      );
    }

    function closePosDay() {
      if (posCloseMode === 'handover' && !posTillZeroized) {
        setPosNotice('Before handover close, the teller must zeroize the till account and incoming staff must acknowledge the cash.');
        return;
      }

      if (posCloseMode === 'final-close' && !posDepositProof.trim()) {
        setPosNotice('Final close requires proof of deposit for manager confirmation.');
        return;
      }

      setIsPosDayOpen(false);
      setPosNotice(
        posCloseMode === 'handover'
          ? 'POS day closed through handover. Incoming staff acknowledgement is recorded as the next starting balance.'
          : 'POS day closed for final deposit review. Manager confirmation is required.',
      );
    }

    function confirmTransaction() {
      const unavailableItem = posCartItems.find((item) => item.quantity > item.availableQuantity || item.availableQuantity <= 0);

      if (unavailableItem) {
        setPosNotice(`${unavailableItem.name} is no longer available in the selected quantity. Refresh current inventory before confirming.`);
        setPosTransactionConfirmed(false);
        return;
      }

      if (posCartItems.length === 0) {
        setPosNotice('Add at least one drug to cart before confirming payment.');
        return;
      }

      if (posCustomerInvoice === 'yes' && posInvoiceDelivery !== 'printer' && !posInvoiceContact.trim()) {
        setPosNotice('Provide customer WhatsApp number or email before invoice delivery.');
        return;
      }

      setPosTransactionConfirmed(true);
      setPosNotice(
        posCustomerInvoice === 'yes'
          ? 'Payment confirmed. Invoice generation and delivery are now available inside POS.'
          : 'Payment confirmed without customer invoice.',
      );
    }

    if (activePosWorkspace === 'overview') {
      return (
        <section className="section-page pos-executive-overview">
          <section className="pos-executive-hero pos-international-hero">
            <div>
              <span>POS and sales operations</span>
              <h2>International pharmacy POS command dashboard</h2>
              <p>Real sales control, cashier readiness, pharmacist review, customer queues, receipts, and daily close signals without fake transaction data.</p>
            </div>
            <div className="pos-overview-hero-actions">
              <button type="button" onClick={() => setActivePosWorkspace('pos')}>
                Open Dedicated POS Counter
              </button>
              <button type="button" className="secondary-action" onClick={() => navigateToSection('overview')}>
                Main Dashboard
              </button>
            </div>
          </section>

          <section className="pos-overview-analytics-grid executive pos-real-kpi-grid">
            {[
              ['POS session', isPosDayOpen ? 'Open' : 'Closed', isPosDayOpen ? 'Ready for counter work' : 'Open day before serving', 'Controlled by cashier day opening'],
              ['Current cart lines', String(posCartItems.length), `${posSaleSummary.totalQuantity} unit${posSaleSummary.totalQuantity === 1 ? '' : 's'}`, 'Live from the active counter cart'],
              ['Current cart total', `RWF ${posSaleSummary.total.toLocaleString('en-RW')}`, posPaymentMethod.replaceAll('_', ' '), 'Calculated from current cart only'],
              ['Inventory loaded', posInventoryBatches.length ? String(posInventoryBatches.length) : '0', posInventoryLoadedAt || 'Not loaded', 'Load current inventory before selling'],
              ['Prescription state', posPrescriptionStatus.replaceAll('-', ' '), posPrescriptionStatus === 'manual-review' ? 'Needs review' : 'Counter selected', 'Used for pharmacist safety handoff'],
              ['Receipt readiness', posCustomerInvoice === 'yes' ? 'Invoice requested' : 'Receipt only', posInvoiceDelivery.replaceAll('_', ' '), 'No fake transactions displayed'],
            ].map(([title, value, signal, detail]) => (
              <article key={title} className="pos-executive-card">
                <span>{title}</span>
                <strong>{value}</strong>
                <em>{signal}</em>
                <small>{detail}</small>
              </article>
            ))}
          </section>

          <section className="pos-overview-command-grid">
            <article className="panel wide">
              <div className="section-heading">
                <div>
                  <span>Real-data readiness</span>
                  <h2>POS data quality and workflow readiness</h2>
                </div>
              </div>

              <div className="pos-channel-bars pos-readiness-bars">
                {[
                  ['Current inventory', posInventoryBatches.length ? '100%' : '8%', posInventoryBatches.length ? `${posInventoryBatches.length} batches loaded` : 'Not loaded'],
                  ['Active cart', posCartItems.length ? '72%' : '12%', posCartItems.length ? `${posCartItems.length} line(s)` : 'No active sale'],
                  ['Payment setup', posPaymentMethod ? '88%' : '10%', posPaymentMethod.replaceAll('_', ' ')],
                  ['Receipt setup', posCustomerInvoice === 'yes' ? '76%' : '35%', posCustomerInvoice === 'yes' ? posInvoiceDelivery : 'Standard receipt'],
                ].map(([label, width, value]) => (
                  <div key={label} className="pos-channel-row">
                    <span>{label}</span>
                    <div><i style={{ width }} /></div>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel wide">
              <div className="section-heading">
                <div>
                  <span>Counter guidance</span>
                  <h2>What the cashier should check next</h2>
                </div>
              </div>

              <div className="pos-alert-stack">
                {[
                  [isPosDayOpen ? 'Ready' : 'Start', isPosDayOpen ? 'POS day is open' : 'Open POS day', isPosDayOpen ? 'Counter can serve customers.' : 'Open the day before confirming payments.'],
                  [posInventoryBatches.length ? 'Ready' : 'Load', posInventoryBatches.length ? 'Inventory available' : 'Load current inventory', posInventoryBatches.length ? 'Sellable batches are available for picking.' : 'Use current inventory to avoid selling unavailable stock.'],
                  [posCartItems.length ? 'Active' : 'Idle', posCartItems.length ? 'Cart in progress' : 'No active cart', posCartItems.length ? 'Review quantity, payer, and receipt before payment.' : 'Search or scan a product to begin.'],
                  [posPrescriptionStatus === 'manual-review' ? 'Review' : 'Safe', posPrescriptionStatus === 'manual-review' ? 'Prescription needs manual review' : 'Prescription status selected', 'Pharmacist Review remains available for controlled dispensing.'],
                ].map(([level, title, detail]) => (
                  <div key={title}>
                    <strong>{level}</strong>
                    <span>{title}</span>
                    <small>{detail}</small>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="pos-real-register-card">
            <div className="section-heading">
              <div>
                <span>Real sales register</span>
                <h3>Recent POS transactions</h3>
                <p className="muted">No dummy rows are shown here. Real sales will appear after they are created through the backend-connected POS and dispensing workflow.</p>
              </div>
              <button type="button" onClick={() => setActivePosWorkspace('sales-performance')}>
                Open Sales Register
              </button>
            </div>
            <div className="system-table-wrap">
              <table className="system-table">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Sale No.</th>
                    <th>Customer</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={6}>No real POS transactions loaded in this dashboard view yet.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>
      );
    }

    if (activePosWorkspace === 'pos') {
      return (
        <section className="section-page pos-dedicated-counter-shell">
          <section className="pos-counter-page pos-counter-page--dedicated">
            <nav className="pos-dedicated-command-bar" aria-label="POS workspace navigation">
              <button type="button" onClick={() => navigateToSection('overview')}>
                <span>Main Dashboard</span>
                <strong>Exit POS</strong>
              </button>
              <button type="button" onClick={() => setActivePosWorkspace('overview')}>
                <span>POS Dashboard</span>
                <strong>Control view</strong>
              </button>
              <button type="button" className="active" onClick={() => setActivePosWorkspace('pos')}>
                <span>POS Counter</span>
                <strong>Serve customer</strong>
              </button>
              <button type="button" onClick={() => setActivePosWorkspace('dispensing-review')}>
                <span>Pharmacist Review</span>
                <strong>Safety queue</strong>
              </button>
              <button type="button" onClick={() => setActivePosWorkspace('sales-performance')}>
                <span>Sales Register</span>
                <strong>Real sales</strong>
              </button>
              <button type="button" onClick={() => setActivePosWorkspace('payment-receipt')}>
                <span>Receipts & Payments</span>
                <strong>Collection</strong>
              </button>
              <button type="button" onClick={() => setActivePosWorkspace('customers')}>
                <span>Customers</span>
                <strong>Patients</strong>
              </button>
              <button type="button" onClick={() => setActivePosWorkspace('prescriptions')}>
                <span>Prescriptions</span>
                <strong>Rx files</strong>
              </button>
            </nav>

            <section className="pos-counter-heading">
              <div>
                <p className="eyebrow">Simple but Mighty POS</p>
                <h2>Pharmacy POS Counter</h2>
                <p className="muted">Select drugs, build cart, complete transaction setup, confirm payment, then generate invoice when required.</p>
              </div>

              <div className={`pos-session-pill ${isPosDayOpen ? 'open' : 'closed'}`}>
                <span>{isPosDayOpen ? 'Session open' : 'Session closed'}</span>
                <strong>RWF {Number(posStartingCashBalance || 0).toLocaleString('en-RW')}</strong>
              </div>
            </section>

            {posNotice && <div className="form-success">{posNotice}</div>}

            <section className="pos-day-control-strip pos-day-control-strip--two-by-two">
              <article>
                <span>Open POS Day</span>
                <label>
                  <small>Opening mode</small>
                  <select value={posOpeningMode} onChange={(event) => setPosOpeningMode(event.target.value as typeof posOpeningMode)}>
                    <option value="fresh-start">Fresh start day</option>
                    <option value="handover">Handover from previous teller</option>
                  </select>
                </label>
                <label>
                  <small>Starting cash balance</small>
                  <input
                    type="number"
                    min="0"
                    value={posStartingCashBalance}
                    onChange={(event) => setPosStartingCashBalance(event.target.value)}
                  />
                </label>
                <button type="button" onClick={openPosDay}>Open POS Day</button>
              </article>

              <article>
                <span>Close POS Day</span>
                <label>
                  <small>Closing mode</small>
                  <select value={posCloseMode} onChange={(event) => setPosCloseMode(event.target.value as typeof posCloseMode)}>
                    <option value="handover">Handover to incoming staff</option>
                    <option value="final-close">Final close with manager deposit proof</option>
                  </select>
                </label>

                {posCloseMode === 'handover' ? (
                  <label className="pos-inline-check">
                    <input
                      type="checkbox"
                      checked={posTillZeroized}
                      onChange={(event) => setPosTillZeroized(event.target.checked)}
                    />
                    <small>Till zeroized and incoming staff acknowledged</small>
                  </label>
                ) : (
                  <label>
                    <small>Deposit proof reference</small>
                    <input
                      value={posDepositProof}
                      onChange={(event) => setPosDepositProof(event.target.value)}
                      placeholder="Deposit slip, bank ref, MoMo ref"
                    />
                  </label>
                )}

                <button type="button" onClick={closePosDay} disabled={!isPosDayOpen}>Close POS Day</button>
              </article>
            </section>

            <section className="pos-counter-workbench pos-counter-workbench--cart-middle pos-counter-workbench--builder-left">
              <section className="pos-transaction-builder-card" aria-label="POS product selection, cart, and transaction setup">
                <div className="pos-builder-heading">
                  <div>
                    <p className="eyebrow">Counter workflow</p>
                    <h3>Product selection, sale cart, and Transaction Set-UP</h3>
                    <span>
                      Select all products first, review the cart, then confirm whether the default customer, prescription, payer, discount, and invoice settings should stay unchanged.
                    </span>
                  </div>
                  <div className="pos-builder-status">
                    <strong>{posCartItems.length}</strong>
                    <small>cart line{posCartItems.length === 1 ? '' : 's'}</small>
                  </div>
                </div>

                <div className="pos-builder-main-grid">
                <section className="pos-builder-product-panel pos-rx-queue">
                <div className="section-heading">
                  <div>
                    <span>Step 1</span>
                    <h3>Product search & stock pick</h3>
                  </div>
                </div>

                <input className="pos-search-input" placeholder="Scan barcode or search product, batch, SKU..." />

                <div className="pos-inventory-load-panel">
                  <button type="button" onClick={loadCurrentPosInventory} disabled={isLoadingPosInventory}>
                    {isLoadingPosInventory ? 'Loading current inventory…' : 'Load current inventory'}
                  </button>
                  <span>
                    {posInventoryLoadedAt
                      ? `Current inventory loaded at ${posInventoryLoadedAt}`
                      : 'Load stock batches before adding products to cart.'}
                  </span>
                </div>

                {posInventoryError && <div className="form-error">{posInventoryError}</div>}

                <div className="pos-drug-list pos-drug-list--ten">
                  {posProducts.length === 0 ? (
                    <div className="pos-inventory-empty-state">
                      <strong>No current inventory loaded</strong>
                      <small>Load current inventory to pick only sellable batches with available stock.</small>
                    </div>
                  ) : (
                    posProducts.map((product) => (
                      <button key={product.code} type="button" onClick={() => addPosProductToCart(product)}>
                        <strong>{product.name}</strong>
                        <small>{product.strength}</small>
                        <em>{product.code}</em>
                        <span>{product.status}</span>
                        <i>Add to cart</i>
                      </button>
                    ))
                  )}
                </div>

                <button
                  type="button"
                  className="pos-view-products-link"
                  onClick={() => {
                    setActiveInventoryView('product-master');
                    navigateToSection('inventory');
                  }}
                >
                  View full product list
                </button>
              </section>
                <section className="pos-builder-cart-panel pos-cart-card">
                  <div className="section-heading">
                    <div>
                      <span>Step 2</span>
                      <h3>Sale cart</h3>
                    </div>
                    <div className="pos-cart-header-actions">
                      <small>{posCartItems.length}/10 rows</small>
                      <button type="button" onClick={clearPosCart} disabled={posCartItems.length === 0}>
                        Clear cart
                      </button>
                    </div>
                  </div>

                  <div className="system-table-wrap">
                    <table className="system-table pos-cart-table">
                      <thead>
                        <tr>
                          <th>Drug</th>
                          <th>Qty</th>
                          <th>Unit price</th>
                          <th>Total</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posCartItems.length === 0 ? (
                          <tr>
                            <td colSpan={5}>No drugs added yet. Select drugs from the left list.</td>
                          </tr>
                        ) : (
                          posCartItems.slice(0, 10).map((item) => (
                            <tr key={item.code}>
                              <td>
                                <strong>{item.name}</strong>
                                <small>{item.strength}</small>
                                <small>Batch {item.batchNumber} · Available {item.availableQuantity.toLocaleString('en-RW')} · {item.locationName}</small>
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
                              <td>RWF {item.unitPrice.toLocaleString('en-RW')}</td>
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
                </div>

              <section className="pos-builder-setup-panel pos-transaction-setup-card pos-transaction-setup-card--two-column">
                  <div className="section-heading">
                    <div>
                      <span>Step 3</span>
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
                          setPosPaymentMethod(event.target.value as typeof posPaymentMethod);
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
                          <span>Insurance provider</span>
                          <select
                            value={posInsuranceProvider}
                            onChange={(event) => {
                              setPosInsuranceProvider(event.target.value);
                              setPosInsuranceInstitution('');
                              setPosTransactionConfirmed(false);
                            }}
                          >
                            {posInsuranceRates.map((insurance) => (
                              <option key={insurance.id} value={insurance.id}>
                                {insurance.name} · master Cust {insurance.masterCustomerContributionPercent}%
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Institution / company</span>
                          <select
                            value={posInsuranceInstitution}
                            onChange={(event) => {
                              setPosInsuranceInstitution(event.target.value);
                              setPosTransactionConfirmed(false);
                            }}
                          >
                            <option value="">Use insurance master rate</option>
                            {selectedInsurance.institutions.map((institution) => (
                              <option key={institution.id} value={institution.id}>
                                {institution.name} · Cust {institution.customerContributionPercent}%
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}

                    <label>
                      <span>Customer invoice</span>
                      <select
                        value={posCustomerInvoice}
                        onChange={(event) => {
                          setPosCustomerInvoice(event.target.value as 'yes' | 'no');
                          setPosTransactionConfirmed(false);
                        }}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </label>

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
              </section>

              <aside className="pos-confirmation-rail">
                <section className="pos-summary-confirmation-card">
                  <div className="section-heading">
                    <div>
                      <span>Step 4</span>
                      <h3>Payment summary</h3>
                    </div>
                  </div>

                  <button type="button" className="pos-refresh-summary-button" onClick={forceRefreshSaleSummary}>
                    Update Summary
                  </button>
                  <p className="pos-summary-journey-note">
                    Select products, review Transaction Set-UP, update the summary, confirm payment, then print or send the invoice when requested.
                  </p>

                  <div className="pos-summary-sync-note" data-cart-lines={posSaleSummary.lineCount} data-cart-quantity={posSaleSummary.totalQuantity}>
                    <span>Live cart sync</span>
                    <strong>{posSaleSummary.lineCount} item line{posSaleSummary.lineCount === 1 ? '' : 's'} · {posSaleSummary.totalQuantity} unit{posSaleSummary.totalQuantity === 1 ? '' : 's'}</strong>
                    <small>Updated {posSaleSummary.calculatedAt}</small>
                  </div>

                  <dl className="pos-summary-list">
                    <div>
                      <dt>Date and time</dt>
                      <dd>{new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</dd>
                    </div>
                    <div>
                      <dt>Cart lines</dt>
                      <dd>{posSaleSummary.lineCount}</dd>
                    </div>
                    <div>
                      <dt>Total quantity</dt>
                      <dd>{posSaleSummary.totalQuantity}</dd>
                    </div>
                    <div>
                      <dt>Subtotal</dt>
                      <dd>RWF {posSaleSummary.subtotal.toLocaleString('en-RW')}</dd>
                    </div>
                    {posPaymentMethod === 'insurance' && (
                      <>
                        <div>
                          <dt>Cust %</dt>
                          <dd>{posSaleSummary.customerContributionPercent}%</dd>
                        </div>
                        <div>
                          <dt>Insur %</dt>
                          <dd>{posSaleSummary.insuranceContributionPercent}%</dd>
                        </div>
                      </>
                    )}
                    <div>
                      <dt>Customer contribution</dt>
                      <dd>RWF {posSaleSummary.customerContribution.toLocaleString('en-RW')}</dd>
                    </div>
                    <div>
                      <dt>Insurance contribution</dt>
                      <dd>RWF {posSaleSummary.insuranceContribution.toLocaleString('en-RW')}</dd>
                    </div>
                    <div>
                      <dt>Tax</dt>
                      <dd>RWF {posSaleSummary.tax.toLocaleString('en-RW')}</dd>
                    </div>
                    <div className="total">
                      <dt>Total</dt>
                      <dd>RWF {posSaleSummary.total.toLocaleString('en-RW')}</dd>
                    </div>
                  </dl>

                  <button type="button" onClick={confirmTransaction} disabled={!isPosDayOpen || posCartItems.length === 0}>
                    {posTransactionConfirmed ? 'Payment confirmed' : 'Confirm payment'}
                  </button>
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
                      <button type="button" onClick={() => window.print()}>
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
              </aside>
            </section>

            <section className="pos-sales-summary-table-card">
              <div className="section-heading">
                <div>
                  <span>Sales register</span>
                  <h3>Recent counter transactions</h3>
                </div>
                <div className="pos-table-management-actions">
                  <button type="button" onClick={() => setActivePosWorkspace('sales-performance')}>
                    Open Sales Register
                  </button>
                  <button type="button" className="secondary-action" onClick={() => setPosNotice('POS table management will control visible columns, filters, export, and row density for admin users.')}>
                    Table Management
                  </button>
                </div>
              </div>

              <div className="system-table-wrap">
                <table className="system-table">
                  <thead>
                    <tr>
                      <th>Date / Time</th>
                      <th>Sale No.</th>
                      <th>Customer</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesSummaryRows.length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          No real recent sales loaded here yet. Create or load backend POS sales to populate this register.
                        </td>
                      </tr>
                    ) : (
                      salesSummaryRows.map(({ dateTime, saleNumber, customer, method, status, amount }) => (
                        <tr key={saleNumber}>
                          <td>{dateTime}</td>
                          <td>{saleNumber}</td>
                          <td>{customer}</td>
                          <td>{method}</td>
                          <td>{status}</td>
                          <td>{amount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        </section>
      );
    }

    if (activePosWorkspace === 'dispensing-review') {
      return (
        <section className="section-page">
          <SalesDispensingReview token={session.token} profile={profile} />
        </section>
      );
    }

    if (activePosWorkspace === 'customers') {
      return (
        <section className="section-page">
          <FocusRegisterPreview
            title="Customers and Patients"
            description="Customer and patient register with default 15-row view, export, bulk edit, and controlled delete."
            rows={previewRows}
          />
        </section>
      );
    }

    if (activePosWorkspace === 'prescriptions') {
      return (
        <section className="section-page">
          <FocusRegisterPreview
            title="Prescriptions"
            description="Prescription capture, camera readiness, AI text extraction, manual correction, and returning customer lookup."
            rows={previewRows.map(([primary, secondary, status, amount]) => [primary, secondary.replace('sale', 'prescription'), status, amount])}
          />
        </section>
      );
    }

    if (activePosWorkspace === 'sales-performance') {
      return (
        <section className="section-page">
          <FocusRegisterPreview
            title="Sales Performance"
            description="Sales list with selected sale detail, export, review, and manager follow-up."
            rows={previewRows}
          />
        </section>
      );
    }

    return (
      <section className="section-page">
        <FocusRegisterPreview
          title="Payment and Receipt"
          description="Payment register with receipt print, Bluetooth readiness, WhatsApp, email, and corporate email delivery."
          rows={previewRows}
        />
      </section>
    );
  }


  function renderSupplierWorkspace() {
    const selected = supplierWorkspaceItems.find((item) => item.key === activeSupplierWorkspace) ?? supplierWorkspaceItems[0];
    const supplierRows: Array<[string, string, string, string]> = [
      ['Wholesale distributor', 'Medicines and hospital consumables', 'Approved', 'Net 30'],
      ['Manufacturer partner', 'Direct import product line', 'Review', 'Net 45'],
      ['Local supplier', 'Fast-moving OTC and cosmetics', 'Active', 'Cash / MoMo'],
      ['Service provider', 'Delivery and maintenance partner', 'Active', 'Contract'],
    ];

    return (
      <section className="section-page">
        <div className="module-section-stage">
          {activeSupplierWorkspace === 'overview' && (
            <FocusRegisterPreview
              title="Supplier Overview"
              description="Supplier performance, open PO status, receiving readiness, and procurement attention."
              rows={supplierRows}
            />
          )}

          {activeSupplierWorkspace === 'create-supplier' && (
            <ProcurementWorkflow token={session.token} profile={profile} />
          )}

          {['supplier-list', 'outstanding-purchase-orders', 'received-purchase-orders'].includes(activeSupplierWorkspace) && (
            <FocusRegisterPreview
              title={selected.label}
              description="This page keeps its own focused register with 15-row default view, export, bulk edit, and controlled delete where allowed."
              rows={supplierRows}
            />
          )}

          {['create-purchase-order', 'receive-purchase-order'].includes(activeSupplierWorkspace) && (
            <ProcurementWorkflow token={session.token} profile={profile} />
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
      <section className="section-page">
        <div className="module-section-stage">
          {activeFinanceWorkspace === 'overview' && (
            <FocusRegisterPreview
              title="Finance Overview"
              description="Cash, MoMo, card, credit, receivables, payables, and exception status."
              rows={financeRows}
            />
          )}

          {activeFinanceWorkspace === 'finance-flow' && (
            <PayablesWorkflow token={session.token} profile={profile} />
          )}

          {activeFinanceWorkspace === 'exception-focus' && (
            <>
              <FocusRegisterPreview
                title="Exception Focus"
                description="Overdue receivables, overdue payables, payment variance, cash variance, and approval risks."
                rows={financeRows}
              />
              <PayablesWorkflow token={session.token} profile={profile} />
            </>
          )}

          {activeFinanceWorkspace === 'credits-receivables' && (
            <ReceivablesWorkflow token={session.token} profile={profile} />
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
      <section className="section-page">
        <div className="module-section-stage">
          {activeAdhocReportWorkspace === 'overview' && (
            <ReportingDashboard token={session.token} profile={profile} />
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

        <AiOperationsPanel token={session.token} profile={profile} />
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

        <NotificationCenterPanel token={session.token} profile={profile} />
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

        <PharmacistChatPanel token={session.token} />
      </section>
    );
  }

  function renderAdminPanel() {
    const visibleAdminPanelLayers = profile.scope.is_platform
      ? adminPanelLayers
      : adminPanelLayers.filter((layer) => layer.key === 'two-factor-auth');
    const selectedWorkspace = visibleAdminPanelLayers.some((layer) => layer.key === activeAdminPanelWorkspace)
      ? activeAdminPanelWorkspace
      : visibleAdminPanelLayers[0].key;
    const selectedLayer = visibleAdminPanelLayers.find((layer) => layer.key === selectedWorkspace) ?? visibleAdminPanelLayers[0];

    return (
      <section className="section-page">
{selectedWorkspace === 'user-profiles' && (
          <article className="panel wide">
            <div className="panel-heading-row">
              <div>
                <h2>User profile management</h2>
                <p className="muted">
                  Admin users can manage staff identity, tenant scope, branch assignment, role, language, 2FA readiness, and status from this surface.
                </p>
              </div>
              <button type="button">Create user</button>
            </div>
            <div className="document-action-grid">
              {adminUserActions.map(([title, text]) => (
                <article key={title}>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </article>
              ))}
            </div>
          </article>
        )}

        {selectedWorkspace === 'two-factor-auth' && (
          <TwoFactorAdminPanel
            token={session.token}
            profile={profile}
            onVerified={(nextToken, nextProfile, trustedDeviceToken) => {
              persistSession({ token: nextToken, profile: nextProfile }, trustedDeviceToken);
            }}
          />
        )}

        {selectedWorkspace === 'platform-management' && (
          <PlatformManagementPanel token={session.token} />
        )}

        {selectedWorkspace === 'notification-management' && (
          <NotificationCenterPanel token={session.token} profile={profile} />
        )}

        {selectedWorkspace === 'corporate-email' && (
          <CorporateEmailPanel token={session.token} />
        )}

        {selectedWorkspace === 'pharmacist-chat' && (
          <PharmacistChatPanel token={session.token} />
        )}

        {selectedWorkspace === 'data-layer' && (
          <DataLayerAdminPanel token={session.token} />
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
    switch (activeSection) {
      case 'overview':
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
              {dashboardCardVisibility.inventory && (
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
                    {dashboardCardFieldVisibility.inventory.permission && <span><b>{profile.permissions.includes('pharmaco.inventory.manage') ? 'On' : 'Off'}</b><small>Permission</small></span>}
                  </div>
                </button>
              )}

              {dashboardCardVisibility.pos && (
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
                    {dashboardCardFieldVisibility.pos.permission && <span><b>{profile.permissions.includes('pharmaco.pos.use') ? 'On' : 'Off'}</b><small>POS access</small></span>}
                  </div>
                </button>
              )}

              {dashboardCardVisibility.finance && (
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
                    {dashboardCardFieldVisibility.suppliers.permission && <span><b>{profile.permissions.includes('pharmaco.suppliers.manage') ? 'On' : 'Off'}</b><small>Permission</small></span>}
                  </div>
                </button>
              )}

              {dashboardCardVisibility.communications && (
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

              {dashboardCardVisibility['ai-reports'] && (
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
                    {dashboardCardFieldVisibility['ai-reports'].permission && <span><b>{profile.permissions.includes('ai.use') ? 'On' : 'Off'}</b><small>AI access</small></span>}
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
                    {dashboardCardFieldVisibility.profile.permissions && <span><b>{profile.permissions.length}</b><small>Permissions</small></span>}
                    {dashboardCardFieldVisibility.profile.scope && <span><b>{profile.scope.type}</b><small>Scope</small></span>}
                    {dashboardCardFieldVisibility.profile.edit && <span><b>Edit</b><small>Profile</small></span>}
                  </div>
                </button>
              )}
            </section>

            {(profile.scope.is_tenant || profile.scope.is_branch) && (
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
                        {(profile.tenant_assignments ?? []).map((assignment, index) => (
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
                          <td>{profile.user.name || 'Current user'}</td>
                          <td>{profile.user.email}</td>
                          <td>{profile.user.phone || 'Not provided'}</td>
                          <td>{profile.scope.type}</td>
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
        return renderAdminPanel();
      case 'inventory':
        return (
          <section
            className="section-page inventory-route-page"
            data-inventory-page={activeInventoryView}
          >
            <ProductInventoryPreview
              key={activeInventoryView}
              token={session.token}
              profile={profile}
              activeView={activeInventoryView}
              onActiveViewChange={setActiveInventoryView}
              showInternalNavigation={false}
            />

            {activeInventoryView === 'product-master' && (
              <div className="product-inventory-actions-legacy-hidden" aria-hidden="true">

                <ProductInventoryActions token={session.token} profile={profile} />

              </div>
            )}
          </section>
        );
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
            <PharmaCoreEditor token={session.token} profile={profile} />
          </section>
        );
      case 'security':
        return (
          <section className="section-page">
<section className="content-grid security-content-grid">
            <UserSecurityManagement token={session.token} tenantSlug="vitapharma" />
              <article className="panel">
                <h2>Resolved access profile</h2>
                <div className="scope-list">
                  <div><span>Scope type</span><strong>{profile.scope.type}</strong></div>
                  <div><span>Solution ID</span><strong>{profile.scope.solution_id ?? 'All'}</strong></div>
                  <div><span>Tenant ID</span><strong>{profile.scope.tenant_id ?? 'All / none'}</strong></div>
                  <div><span>Branch ID</span><strong>{profile.scope.branch_id ?? 'All / none'}</strong></div>
                </div>
              </article>

              <article className="panel">
                <h2>Roles</h2>
                <div className="tag-list">
                  {profile.roles.map((role) => (
                    <span key={`${role.code}-${role.tenant_id ?? 'global'}`}>{role.name}</span>
                  ))}
                </div>
              </article>

              <article className="panel wide permission-matrix-panel">
                <div className="permission-matrix-panel__header">
                  <div>
                    <p className="eyebrow">Granular access matrix</p>
                    <h2>Permissions by module and action</h2>
                    <span>
                      Each resource is separated into View, Add, Edit, and Delete so roles do not receive more power than intended.
                    </span>
                  </div>
                </div>

                {renderProfilePermissionMatrix(profile)}
              </article>
              {accessControlPanel}
              {tenantAssignmentsPanel}
            </section>
          </section>
        );
      case 'corporate-email':
        return (
          <section className="section-page">
<CorporateEmailPanel token={session.token} />
          </section>
        );
      case 'pharmacist-chat':
        return (
          <section className="section-page">
<PharmacistChatPanel token={session.token} />
          </section>
        );
      case 'notifications':
        return (
          <section className="section-page">
<NotificationCenterPanel token={session.token} profile={profile} />
          </section>
        );
      case 'market-management':
      case 'localization':
        return (
          <section className="section-page">
<MarketLocalizationPanel token={session.token} profile={profile} />
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
                ].map(([title, text, section]) => (
                  <button key={title} type="button" onClick={() => navigateToSection(section)}>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </button>
                ))}
              </section>
            )}

            {shouldShowTenantOperationsDashboard && homeWidgets['tenant-dashboard'] ? (
              <TenantPharmacyDashboard
                token={session.token}
                profile={profile}
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

  return (
    <main className="dashboard-shell" style={leftMenuStyle}>
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div className="sidebar-brand">
            <img className="sidebar-logo" src={brandLogoSrc} alt="Ubuzima+" />
            <div>
              <strong>Ubuzima+</strong>
              <span>Admin Center</span>
            </div>
          </div>

          <nav className="tree-nav tree-nav--principal" aria-label="Admin workspace navigation">
            <button
              type="button"
              className={`tree-root-button principal-menu-button ${activeSection === 'overview' ? 'active' : ''}`}
              data-section="overview"
              onClick={() => navigateToSection('overview')}
            >
              <span className="nav-icon">DB</span>
              <span className="principal-menu-title">Dashboard</span>
            </button>

            {principalMenuItems.map(({ group, item }) => {
              const childSubmenus = leftMenuSubmenus[item.key] ?? [];
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
                      <dd>{profile.user.name || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{profile.user.email}</dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>{profile.user.phone || 'Not provided'}</dd>
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

        <section className="dashboard-scroll-panel">
          {renderActiveSection()}
        </section>

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
    </main>
  );
}

export default App;

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AccessCheckResult, AccessProfile, BranchDepartmentsResponse, BranchesResponse, LoginResponse, PharmacyProfileResponse, TwoFactorSetupPayload, getAuthenticatedProfile, getBranchDepartments, getCorporateMailOverview, getPharmaBranches, getPharmacyProfile, login, logout, requestPasswordReset, runAccessCheck, verifyTwoFactor } from './lib/api';
import { PharmaCoreEditor } from './components/PharmaCoreEditor';
import { ProductInventoryPreview } from './components/ProductInventoryPreview';
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
    eyebrow: 'Suppliers and procurement',
    title: 'Supplier and wholesale operations',
    description: 'Supplier setup, wholesale pharmacy readiness, purchase orders, receiving, and dispatch preparation.',
  },
  finance: {
    eyebrow: 'Finance operations',
    title: 'Payables and receivables',
    description: 'Supplier invoices, payments, customer credit, collections, and finance visibility.',
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

function tenantDisplayName(profile: AccessProfile | undefined): string {
  return profile?.tenant_assignments?.[0]?.tenant?.name ?? 'Tenant';
}

function itemIsVisibleForProfile(profile: AccessProfile | undefined, item: MenuItem): boolean {
  if (!profile || profile.scope.is_platform) return true;

  if (item.key === 'inventory') return hasAnyPermission(profile, ['pharmaco.inventory.manage']);
  if (item.key === 'pos') return hasAnyPermission(profile, ['pharmaco.pos.use', 'pharmaco.sales.manage']);
  if (item.key === 'suppliers') return hasAnyPermission(profile, ['pharmaco.suppliers.manage']);
  if (item.key === 'finance') return hasAnyPermission(profile, ['pharmaco.sales.manage', 'pharmaco.suppliers.manage']);
  if (item.key === 'reports') return hasAnyPermission(profile, ['pharmaco.reports.view', 'pharmaco.sales.manage', 'pharmaco.inventory.manage']);
  if (item.key === 'tenant-setup') return hasAnyPermission(profile, ['pharmaco.profile.manage', 'pharmaco.branches.manage']);
  if (item.key === 'ai-center') return hasAnyPermission(profile, ['ai.use', 'ai.manage']);
  if (item.key === 'corporate-email') return hasAnyPermission(profile, ['communications.email.use']);
  if (item.key === 'pharmacist-chat') return hasAnyPermission(profile, ['pharmaco.chat.manage']);
  if (item.key === 'notifications') return hasAnyPermission(profile, ['notifications.view', 'notifications.manage']);
  if (item.key === 'market-management') return hasAnyPermission(profile, ['markets.manage']);
  if (item.key === 'localization') return hasAnyPermission(profile, ['localization.use', 'localization.manage']);
  if (item.key === 'nearby-providers') return hasAnyPermission(profile, ['markets.view', 'markets.manage', 'localization.use']);
  if (item.key === 'security') return true;
  if (item.key === 'admin-panel') return item.context === 'two-factor-auth';
  if (item.key === 'solution-portfolio') return profile.scope.is_solution;

  return false;
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
          { key: 'suppliers', label: 'Suppliers', description: 'Procurement and payables', icon: 'SP', status: 'Live' },
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
        { key: 'pos', label: 'POS and Sales', description: 'Counter sales and dispensing', icon: 'PS', status: 'Live' },
        { key: 'suppliers', label: 'Suppliers', description: 'Purchasing and receiving', icon: 'SP', status: 'Live' },
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
    workspace: ['Supplier invoices', 'Payment records', 'Customer collections', 'Cash and credit visibility'],
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
  { key: 'pos', label: 'POS', description: 'Counter sale, cart, insurance, payment, receipt' },
  { key: 'customers', label: 'Customers / Patients', description: 'Customer records, invoice-ready capture, bulk tools' },
  { key: 'prescriptions', label: 'Prescriptions', description: 'Rx capture, AI extraction, previous records' },
  { key: 'sales-performance', label: 'Sales Performance', description: '15-row register, review detail, export' },
  { key: 'payment-receipt', label: 'Payment / Receipt', description: 'Payments, balances, printer, WhatsApp, email' },
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
  { key: 'finance-flow', label: 'Finance Flow', description: 'Supplier invoices, approval, and payment' },
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
  const [activeSupplierWorkspace, setActiveSupplierWorkspace] = useState<SupplierWorkspaceKey>('overview');
  const [activeFinanceWorkspace, setActiveFinanceWorkspace] = useState<FinanceWorkspaceKey>('overview');
  const [activeAdhocReportWorkspace, setActiveAdhocReportWorkspace] = useState<AdhocReportWorkspaceKey>('overview');
  const [homeWidgets, setHomeWidgets] = useState<Record<HomeWidgetKey, boolean>>({
    summary: true,
    'tenant-dashboard': true,
    'quick-actions': true,
    'system-experience': true,
    'role-workspaces': true,
  });
  const [openMenuGroups, setOpenMenuGroups] = useState<Record<MenuGroupKey, boolean>>({
    erp: false,
    solutions: false,
    ai: false,
    admin: false,
    'tenant-ops': false,
    'tenant-admin': false,
    market: false,
  });

  const profile = session?.profile;
  const visibleMenuGroups = useMemo(() => buildVisibleMenuGroups(profile), [profile]);
  const visibleSectionKeys = useMemo(() => {
    const keys = new Set<AdminSectionKey>(['overview']);
    visibleMenuGroups.forEach((group) => group.items.forEach((item) => keys.add(item.key)));
    return keys;
  }, [visibleMenuGroups]);
  const currentSection = sectionMeta[activeSection] ?? sectionMeta.overview;
  const shouldShowTenantOperationsDashboard = Boolean(profile?.scope.is_tenant || profile?.scope.is_branch);
  const tenantFlatMenuItems = useMemo(
    () => visibleMenuGroups.flatMap((group) => group.items.map((item) => ({ group, item }))),
    [visibleMenuGroups],
  );
  const loginStatusText = profile
    ? `Logged in now as ${profile.user.name || profile.user.email}`
    : '';
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

    navigateToSection(item.key);
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
          <h2>Operations 360 View tenant operations preview</h2>
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
        <ModulePageIntro
          eyebrow="ERP Module"
          title={selectedErpModule.title}
          description={selectedErpModule.summary}
          status={selectedErpModule.status}
        />

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
            <ModuleReadinessGrid items={aiWorkflows} />
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
            <ModuleReadinessGrid items={inventoryReadiness} />
            <ProductInventoryPreview token={session.token} profile={profile} />
            <ProductInventoryActions token={session.token} profile={profile} />
          </>
        )}

        {selectedFeature.key === 'pos' && (
          <>
            <ModuleReadinessGrid items={posReadiness} />
            <SalesDispensingReview token={session.token} profile={profile} />
          </>
        )}

        {selectedFeature.key === 'procurement' && (
          <>
            <ModuleReadinessGrid items={supplierReadiness} />
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
            <ProductInventoryActions token={session.token} profile={profile} />
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
        <ModulePageIntro
          eyebrow="Solution Portfolio"
          title={selectedSolution.title}
          description={selectedSolution.summary}
          status={selectedSolution.status}
        />

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
    const selected = posWorkspaceItems.find((item) => item.key === activePosWorkspace) ?? posWorkspaceItems[0];
    const previewRows: Array<[string, string, string, string]> = [
      ['Walk-in customer', 'Counter sale draft', 'Needs payment', 'RWF 18,500'],
      ['Insurance customer', 'Co-pay plus insurer split', 'Receipt pending', 'RWF 64,200'],
      ['Chronic refill', 'Prescription review required', 'Pharmacist review', 'RWF 32,800'],
      ['Corporate client', 'Institution balance', 'Credit follow-up', 'RWF 118,400'],
    ];

    return (
      <section className="section-page">
        <ModulePageIntro
          eyebrow="POS module"
          title={selected.label}
          description={selected.description}
          status="Live sales APIs plus pharmacy workflow"
        />

        <section className="module-workspace-shell">
          <ModuleWorkspaceRail
            label="POS and Sales"
            items={posWorkspaceItems}
            activeKey={activePosWorkspace}
            onSelect={setActivePosWorkspace}
          />

          <div className="module-section-stage">
            {activePosWorkspace === 'overview' && (
              <>
                <ModuleReadinessGrid items={posReadiness} />
                <section className="document-action-grid">
                  {[
                    ['POS transaction summary', 'Customer contribution, insurer or partner contribution, tax, and balance are shown before commit.'],
                    ['Prescription capture', 'RX products trigger prescription image/manual capture before the item proceeds to cart.'],
                    ['Receipt channels', 'Physical/Bluetooth print, WhatsApp handoff, email, and corporate email delivery are prepared.'],
                    ['Customer capture', 'Customer details are only requested when invoice, insurance, credit, or follow-up is needed.'],
                  ].map(([title, text]) => (
                    <article key={title}>
                      <strong>{title}</strong>
                      <span>{text}</span>
                    </article>
                  ))}
                </section>
              </>
            )}

            {activePosWorkspace === 'customers' && (
              <FocusRegisterPreview
                title="Customers / patients register"
                description="The module starts with summary cards, then a 15-row working register with bulk edit, export, approval, and controlled delete actions."
                rows={previewRows}
              />
            )}

            {activePosWorkspace === 'prescriptions' && (
              <FocusRegisterPreview
                title="Prescription register"
                description="Prescription-required products prompt camera capture, AI text extraction where possible, previous-customer lookup, and manual completion when extraction is unclear."
                rows={previewRows.map(([primary, secondary, status, amount]) => [primary, secondary.replace('sale', 'prescription'), status, amount])}
              />
            )}

            {activePosWorkspace === 'sales-performance' && (
              <FocusRegisterPreview
                title="Sales performance register"
                description="Performance review uses a compact 15-row list beside selected-sale detail, with export and bulk tools available from the header."
                rows={previewRows}
              />
            )}

            {activePosWorkspace === 'payment-receipt' && (
              <FocusRegisterPreview
                title="Payment and receipt register"
                description="Payments and receipts follow the same two-section pattern: 15-row list, selected detail, printer, WhatsApp, email, and corporate email actions."
                rows={previewRows}
              />
            )}

            {activePosWorkspace !== 'overview' && <SalesDispensingReview token={session.token} profile={profile} />}
          </div>
        </section>
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
        <ModulePageIntro
          eyebrow="Supplier module"
          title={selected.label}
          description={selected.description}
          status="Live procurement APIs plus supplier workspace"
        />

        <section className="module-workspace-shell">
          <ModuleWorkspaceRail
            label="Suppliers"
            items={supplierWorkspaceItems}
            activeKey={activeSupplierWorkspace}
            onSelect={setActiveSupplierWorkspace}
          />

          <div className="module-section-stage">
            {activeSupplierWorkspace === 'overview' && (
              <>
                <ModuleReadinessGrid items={supplierReadiness} />
                <section className="document-action-grid">
                  {[
                    ['Supplier overview charts', 'Supplier count, open PO value, approved receiving queue, overdue commitments, and active supplier types.'],
                    ['Create supplier', 'Wholesaler, manufacturer, distributor, importer, local supplier, service provider, delivery supplier, technology/API supplier, or other.'],
                    ['Purchase order flow', 'Create PO, approve, track outstanding orders, receive against PO, and update inventory with batch details.'],
                  ].map(([title, text]) => (
                    <article key={title}>
                      <strong>{title}</strong>
                      <span>{text}</span>
                    </article>
                  ))}
                </section>
              </>
            )}

            {['supplier-list', 'outstanding-purchase-orders', 'received-purchase-orders'].includes(activeSupplierWorkspace) && (
              <FocusRegisterPreview
                title={selected.label}
                description="Registers show 15 rows by default, then open the full page with bulk edit, export, approval, and controlled delete actions."
                rows={supplierRows}
              />
            )}

            {activeSupplierWorkspace !== 'overview' && <ProcurementWorkflow token={session.token} profile={profile} />}
          </div>
        </section>
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
        <ModulePageIntro
          eyebrow="Finance module"
          title={selected.label}
          description={selected.description}
          status="Live finance APIs"
        />

        <section className="module-workspace-shell">
          <ModuleWorkspaceRail
            label="Finance"
            items={financeWorkspaceItems}
            activeKey={activeFinanceWorkspace}
            onSelect={setActiveFinanceWorkspace}
          />

          <div className="module-section-stage">
            {activeFinanceWorkspace === 'overview' && (
              <>
                <section className="document-action-grid">
                  {[
                    ['Finance overview', 'Cash, MoMo, card, credit, supplier balance, receivables, and exception count.'],
                    ['Finance flow', 'Supplier invoice creation, approval, payment, and selected invoice detail.'],
                    ['Exception focus', 'Overdue receivables, overdue payables, payment variance, and approval risks.'],
                  ].map(([title, text]) => (
                    <article key={title}>
                      <strong>{title}</strong>
                      <span>{text}</span>
                    </article>
                  ))}
                </section>
                <PayablesWorkflow token={session.token} profile={profile} />
                <ReceivablesWorkflow token={session.token} profile={profile} />
              </>
            )}

            {activeFinanceWorkspace === 'financial-statements' && (
              <article className="panel wide">
                <div className="panel-heading-row">
                  <div>
                    <h2>AI-generated financial statements</h2>
                    <p className="muted">
                      Statements are generated only after a manual refresh, then reviewed by finance before export or posting.
                    </p>
                  </div>
                  <button type="button">Manual refresh</button>
                </div>
                <div className="document-action-grid">
                  {financialStatementItems.map(([title, text]) => (
                    <article key={title}>
                      <strong>{title}</strong>
                      <span>{text}</span>
                    </article>
                  ))}
                </div>
              </article>
            )}

            {['receivable-register', 'collection', 'exception-focus'].includes(activeFinanceWorkspace) && (
              <FocusRegisterPreview
                title={selected.label}
                description="Finance tables use a compact default register with bulk edit, export, approval, and selected-detail controls."
                rows={financeRows}
              />
            )}

            {['finance-flow', 'exception-focus'].includes(activeFinanceWorkspace) && (
              <PayablesWorkflow token={session.token} profile={profile} />
            )}

            {['credits-receivables', 'receivable-register', 'collection', 'exception-focus'].includes(activeFinanceWorkspace) && (
              <ReceivablesWorkflow token={session.token} profile={profile} />
            )}
          </div>
        </section>
      </section>
    );
  }

  function renderAdhocReportWorkspace() {
    const selected = adhocReportWorkspaceItems.find((item) => item.key === activeAdhocReportWorkspace) ?? adhocReportWorkspaceItems[0];

    return (
      <section className="section-page">
        <ModulePageIntro
          eyebrow="Ad-hoc Report"
          title={selected.label}
          description={selected.description}
          status="Read-only analytics"
        />

        <section className="module-workspace-shell">
          <ModuleWorkspaceRail
            label="Ad-hoc Report"
            items={adhocReportWorkspaceItems}
            activeKey={activeAdhocReportWorkspace}
            onSelect={setActiveAdhocReportWorkspace}
          />

          <div className="module-section-stage">
            <article className="panel wide report-focus-note">
              <strong>{selected.label}</strong>
              <span>
                This view uses the live command center and reporting endpoints, while keeping reports read-only and separate from operational forms.
              </span>
            </article>

            <PharmacoOperationsCommandCenter token={session.token} profile={profile} />

            {activeAdhocReportWorkspace === 'overview' && (
              <ReportingDashboard token={session.token} profile={profile} />
            )}
          </div>
        </section>
      </section>
    );
  }

  function renderAiCenter() {
    const selectedAiModule = aiCenterModules.find((module) => module.key === activeAiWorkspace) ?? aiCenterModules[0];

    return (
      <section className="section-page">
        <ModulePageIntro
          eyebrow="AI Center"
          title={selectedAiModule.title}
          description={selectedAiModule.purpose}
          status={selectedAiModule.status}
        />

        <section className="ai-center-layout">
          <div className="ai-center-module-grid">
            {aiCenterModules.map((module) => (
              <button
                key={module.key}
                type="button"
                className={activeAiWorkspace === module.key ? 'active' : ''}
                onClick={() => setActiveAiWorkspace(module.key)}
              >
                <strong>{module.title}</strong>
                <span>{module.status}</span>
              </button>
            ))}
          </div>

          <article className="panel ai-detail-panel">
            <h2>{selectedAiModule.title}</h2>
            <p className="muted">{selectedAiModule.purpose}</p>
            <div className="workflow-list">
              {selectedAiModule.controls.map((control) => (
                <div key={control}>
                  <strong>{control}</strong>
                  <span>Configured per platform, solution, tenant, role, branch, and data classification.</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <AiOperationsPanel token={session.token} profile={profile} />

        <ModuleReadinessGrid items={aiWorkflows} />

        <section className="ai-model-grid">
          {pharmaAiModels.map(([model, description]) => (
            <article key={model}>
              <strong>{model}</strong>
              <span>{description}</span>
            </article>
          ))}
        </section>

        {accessControlPanel}
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
        <ModulePageIntro
          eyebrow="Admin Panel"
          title={selectedLayer.title}
          description={selectedLayer.summary}
          status={selectedLayer.status}
        />

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

        {!['user-profiles', 'two-factor-auth', 'notification-management', 'corporate-email', 'pharmacist-chat', 'data-layer'].includes(selectedWorkspace) && <ModuleReadinessGrid items={settingsBlueprint} />}

        {selectedWorkspace === 'backend-api' && accessControlPanel}
      </section>
    );
  }

  function renderActiveSection() {
    switch (activeSection) {
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
          <section className="section-page">
            <ModulePageIntro
              eyebrow="Inventory module"
              title="Batch, expiry, FEFO, receiving, and shelf control"
              description="Inventory is now isolated as its own workspace so staff can work without the previous long dashboard flood."
              status="Live APIs plus framework"
            />
            <ModuleReadinessGrid items={inventoryReadiness} />
            <ProductInventoryPreview token={session.token} profile={profile} />
            <ProductInventoryActions token={session.token} profile={profile} />
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
            <ModulePageIntro
              eyebrow="Tenant setup"
              title="Business profile, branch, and department configuration"
              description="Tenant setup has its own workspace for profile verification, branch structure, departments, and operating capabilities."
              status="Live tenant APIs"
            />
            {tenantOperationsPanel}
            <PharmaCoreEditor token={session.token} profile={profile} />
          </section>
        );
      case 'security':
        return (
          <section className="section-page">
            <ModulePageIntro
              eyebrow="Security module"
              title="Role, permission, tenant, and access control"
              description="Security keeps access scope visible and provides protected endpoint checks without mixing them into daily operator pages."
              status="Protected backend checks"
            />
            <section className="content-grid security-content-grid">
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

              <article className="panel wide">
                <h2>Permissions by area</h2>
                <div className="permission-grid">
                  {permissionGroups.map((group) => (
                    <div key={group.title}>
                      <h3>{group.title}</h3>
                      {group.items.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  ))}
                </div>
              </article>
              {accessControlPanel}
              {tenantAssignmentsPanel}
            </section>
          </section>
        );
      case 'corporate-email':
        return (
          <section className="section-page">
            <ModulePageIntro
              eyebrow="Corporate Email"
              title="Outlook-style company mailbox"
              description="Staff can work from an in-app mailbox while external Microsoft Graph or IMAP/SMTP integration is configured."
              status="Active"
            />
            <CorporateEmailPanel token={session.token} />
          </section>
        );
      case 'pharmacist-chat':
        return (
          <section className="section-page">
            <ModulePageIntro
              eyebrow="Pharmacist Chat"
              title="Mobile customer conversations"
              description="Customer mobile app conversations are available to authorized pharmacists and tenant staff."
              status="Active"
            />
            <PharmacistChatPanel token={session.token} />
          </section>
        );
      case 'notifications':
        return (
          <section className="section-page">
            <ModulePageIntro
              eyebrow="Notification Center"
              title="In-app communication and SMS-ready notices"
              description="Publish messages to staff by platform, market, and tenant while keeping the same model ready for SMS integration."
              status="Active"
            />
            <NotificationCenterPanel token={session.token} profile={profile} />
          </section>
        );
      case 'market-management':
      case 'localization':
        return (
          <section className="section-page">
            <ModulePageIntro
              eyebrow={activeSection === 'market-management' ? 'Market Management' : 'Localization'}
              title={activeSection === 'market-management' ? 'Tenant market onboarding' : 'Language and regional access context'}
              description="Manage tenant market assignment, default languages, service radius, and regional context for expansion."
              status="Active"
            />
            <MarketLocalizationPanel token={session.token} profile={profile} />
          </section>
        );
      case 'nearby-providers':
        return (
          <section className="section-page">
            <ModulePageIntro
              eyebrow="Nearby Providers"
              title="Customer service-provider discovery"
              description="Preview how the customer mobile app recommends nearby pharmacies and other service providers."
              status="Active"
            />
            <NearbyProvidersPanel />
          </section>
        );
      case 'vitapharma-website':
        return (
          <section className="section-page">
            <ModulePageIntro
              eyebrow="Tenant Website"
              title="VitaPharma public website"
              description="The first tenant website is served from the public web app and can run at vitapharmaafrica.com or the local /vitapharma path."
              status="Active"
            />
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
            <ModulePageIntro
              eyebrow="Settings blueprint"
              title="Offline, integration, notification, numbering, and channel policy"
              description="This page gives the deployable UI direction for settings that still need backend activation and administrator approval."
              status="Configuration framework"
            />
            <ModuleReadinessGrid items={settingsBlueprint} />
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
      case 'overview':
      default:
        return (
          <section className="section-page">
            <section className="signed-in-banner">
              <div>
                <span className="status-dot" />
                <strong>{loginStatusText}</strong>
              </div>
              <small>
                Scope: {profile.scope.type} · Tenants: {profile.tenant_assignments.length || 'none'} · 2FA:{' '}
                {profile.user.two_factor?.enabled ? 'enabled' : 'setup needed'}
              </small>
            </section>
            <section className="home-control-panel">
              <div>
                <p className="eyebrow">Home display controls</p>
                <h2>Keep only the home sections this user needs.</h2>
                <p className="muted">
                  The home page stays compact. Users can leave a section visible or hide it and continue working in the selected module.
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
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div className="sidebar-brand">
            <img className="sidebar-logo" src={brandLogoSrc} alt="Ubuzima+" />
            <div>
              <strong>Ubuzima+</strong>
              <span>Admin Center</span>
            </div>
          </div>

          <nav
            className={`tree-nav ${shouldShowTenantOperationsDashboard ? 'tree-nav--flat' : ''}`}
            aria-label="Admin workspace navigation"
          >
            <button
              type="button"
              className={`tree-root-button ${activeSection === 'overview' ? 'active' : ''}`}
              data-section="overview"
              onClick={() => navigateToSection('overview')}
            >
              <span className="nav-icon">DB</span>
              <span>
                <strong>Dashboard</strong>
                <small>Workspace overview</small>
              </span>
            </button>

            {shouldShowTenantOperationsDashboard ? (
              tenantFlatMenuItems.map(({ group, item }) => (
                <button
                  key={`${group.key}-${item.label}`}
                  type="button"
                  className={`flat-menu-button ${isActiveMenuItem(item) ? 'active' : ''}`}
                  data-section={item.key}
                  onClick={() => handleMenuItemClick(item)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  {item.status && <em>{item.status}</em>}
                </button>
              ))
            ) : (
              visibleMenuGroups.map((group) => (
                <div key={group.key} className="tree-group">
                  <button
                    type="button"
                    className="tree-group-button"
                    data-group={group.key}
                    aria-expanded={Boolean(openMenuGroups[group.key])}
                    onClick={() => toggleMenuGroup(group.key)}
                  >
                    <span className="nav-icon">{group.icon}</span>
                    <span>{group.label}</span>
                    <small>{openMenuGroups[group.key] ? '-' : '+'}</small>
                  </button>

                  {openMenuGroups[group.key] && (
                    <div className="tree-submenu">
                      {group.items.map((item) => (
                        <button
                          key={`${group.key}-${item.label}`}
                          type="button"
                          className={isActiveMenuItem(item) ? 'active' : ''}
                          data-section={item.key}
                          onClick={() => handleMenuItemClick(item)}
                        >
                          <span className="nav-icon">{item.icon}</span>
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </span>
                          {item.status && <em>{item.status}</em>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </nav>

          <button className="logout-button" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header dashboard-header--fixed">
          <div>
            <p className="eyebrow">{currentSection.eyebrow}</p>
            <h1>{currentSection.title}</h1>
            <p>{currentSection.description}</p>
          </div>

          <div className="dashboard-header-actions">
            <button type="button" onClick={goBack} disabled={navigationStack.length === 0}>
              Back
            </button>
            <a href={publicWebsiteUrl} target="_blank" rel="noreferrer">{publicWebsiteLabel}</a>
            <button type="button" onClick={() => setStaffLoginLanguage(nextStaffLoginLanguage)}>
              {staffLoginLanguage}
            </button>
            <button
              type="button"
              className="header-mail-button"
              onClick={() => {
                navigateToSection('corporate-email');
              }}
            >
              Email Corporate
              {unreadMailCount > 0 && <span className="action-badge">{unreadMailCount}</span>}
            </button>
          </div>

          <div className="user-card">
            <strong>{profile.user.email}</strong>
            <span>{loginStatusText}</span>
            <small>{profile.scope.type} scope</small>
            {profile.user.must_change_password && <small>Password change required</small>}
          </div>
        </header>

        <section className="dashboard-scroll-panel">
          {renderActiveSection()}
        </section>

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

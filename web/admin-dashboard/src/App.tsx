import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AccessCheckResult, AccessProfile, BranchDepartmentsResponse, BranchesResponse, LoginResponse, PharmacyProfileResponse, TwoFactorSetupPayload, getAuthenticatedProfile, getBranchDepartments, getPharmaBranches, getPharmacyProfile, login, logout, runAccessCheck, verifyTwoFactor } from './lib/api';
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
  | 'settings';

type MenuGroupKey = 'erp' | 'solutions' | 'ai' | 'admin';
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
  | 'insights-dashboard';
type AdminPanelWorkspaceKey =
  | 'backend-api'
  | 'two-factor-auth'
  | 'platform-management'
  | 'corporate-email'
  | 'pharmacist-chat'
  | 'web-application'
  | 'mobile-application'
  | 'desktop-application'
  | 'data-layer'
  | 'infrastructure';
type MenuContextKey = ErpWorkspaceKey | SolutionKey | AiWorkspaceKey | AdminPanelWorkspaceKey;

type MenuItem = {
  key: AdminSectionKey;
  label: string;
  description: string;
  icon: string;
  context?: MenuContextKey;
  status?: string;
};

const storageKey = 'ubuzima_admin_session';
const activeSectionStorageKey = 'ubuzima_admin_active_section';
const trustedDeviceStorageKey = 'ubuzima_admin_trusted_device_token';
const brandLogoSrc = '/assets/ubuzima-logo.png';

const demoUsers = [
  {
    label: 'Ubuzima+ Super Admin',
    email: 'admin@ubuzimaplus.local',
    scope: 'Platform',
  },
  {
    label: 'PharmaCo360 Solution Admin',
    email: 'pharmaco.admin@ubuzimaplus.local',
    scope: 'Solution',
  },
  {
    label: 'VitaPharma Tenant Admin',
    email: 'admin@vitapharmaafrica.com',
    scope: 'Tenant',
  },
];

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
    family: 'PharmaCo360 operations',
    state: 'Pilot active',
    modules: [
      'Profile and branches',
      'Product master',
      'Inventory',
      'Sales and dispensing',
      'Procurement',
      'Payables',
      'Receivables',
      'Reports',
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
  ['Solution Admin 360', 'PharmaCo360 tenants, onboarding, workflow templates, module usage, AI performance, and solution alerts.'],
  ['Tenant Admin 360', 'VitaPharma branches, users, modules, sales, stock, suppliers, finance, customer risk, and AI insights.'],
  ['Branch 360', 'Branch stock, POS activity, cashier sessions, daily close, expiry risk, low stock, and local alerts.'],
  ['Product 360', 'Batches, expiry, purchases, sales history, supplier options, margin, forecast, and reorder advice.'],
  ['Supplier 360', 'Catalog, purchase orders, invoices, payment status, delivery performance, and demand opportunities.'],
  ['Customer 360', 'Customer profile, prescriptions, credit exposure, refill history, communication, and follow-up notes.'],
  ['AI 360', 'Models, agents, tasks, recommendations, approvals, feedback, usage, cost, risk, and audit logs.'],
];

const channelReadiness = [
  ['Public website', 'Repositioned for commercial lead capture and solution discovery.'],
  ['Admin dashboard', 'Current working control center with live PharmaCo360 modules.'],
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
    modules: ['Roles', 'Audit logs', 'Payables', 'Receivables', 'Reports', 'AI approvals'],
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
  ['Solution admin', 'PharmaCo360 templates, tenant readiness, module adoption, reports, and support oversight.'],
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
    eyebrow: 'Reports and command view',
    title: 'Reporting and executive review',
    description: 'Stock valuation, sales, procurement, payables, credit exposure, and daily management review.',
  },
  'tenant-setup': {
    eyebrow: 'Tenant and branch setup',
    title: 'PharmaCo360 tenant configuration',
    description: 'Business profile, branches, departments, capabilities, operating hours, and local setup.',
  },
  security: {
    eyebrow: 'Access and governance',
    title: 'Security, roles, and tenant scope',
    description: 'Resolved permissions, access checks, tenant assignments, audit posture, and protected modules.',
  },
  settings: {
    eyebrow: 'System framework',
    title: 'Platform settings blueprint',
    description: 'Module activation, offline policy, channels, integration placeholders, and deployment readiness.',
  },
};

const menuGroups: Array<{ key: MenuGroupKey; label: string; icon: string; items: MenuItem[] }> = [
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
      { key: 'admin-panel', context: 'backend-api', label: 'Backend API', description: 'Laravel API and services', icon: 'BE', status: 'Active' },
      { key: 'admin-panel', context: 'two-factor-auth', label: 'Staff 2FA', description: 'Authenticator and trusted devices', icon: '2FA', status: 'Mandatory' },
      { key: 'admin-panel', context: 'platform-management', label: 'Platform Management', description: 'Website, pages, sections', icon: 'PM', status: 'Active' },
      { key: 'admin-panel', context: 'corporate-email', label: 'Corporate Email', description: 'Company mailbox workspace', icon: 'EM', status: 'Active' },
      { key: 'admin-panel', context: 'pharmacist-chat', label: 'Pharmacist Chat', description: 'Mobile customer queue', icon: 'CH', status: 'Active' },
      { key: 'admin-panel', context: 'web-application', label: 'Web Application', description: 'Public and staff web apps', icon: 'WEB', status: 'Active' },
      { key: 'admin-panel', context: 'mobile-application', label: 'Mobile Application', description: 'Manager and field apps', icon: 'MOB', status: 'Planned' },
      { key: 'admin-panel', context: 'desktop-application', label: 'Desktop Application', description: 'Installable POS/PWA', icon: 'DSK', status: 'Planned' },
      { key: 'admin-panel', context: 'data-layer', label: 'Data Layer', description: 'Tenancy, audit, modules', icon: 'DB', status: 'Active' },
      { key: 'admin-panel', context: 'infrastructure', label: 'Infrastructure', description: 'Deployment and operations', icon: 'INF', status: 'Framework' },
    ],
  },
];

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
    summary: 'A pharmacy ecosystem for product master, inventory, POS, procurement, finance, reports, AI, and partner growth.',
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
        title: 'Reports and BI',
        status: 'Live APIs',
        summary: 'Sales, stock, margin, branch performance, supplier performance, expiry, and stockout reports.',
        actions: ['Review daily command center', 'Export finance-ready reports', 'Track branch performance'],
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
  ['Finance dashboard', 'Receivables, payables, collections, supplier payments, daily close, payment variance, reports, and export readiness.'],
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

function App() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [email, setEmail] = useState('admin@vitapharmaafrica.com');
  const [password, setPassword] = useState('ChangeThisPassword123!');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [twoFactorFlow, setTwoFactorFlow] = useState<TwoFactorFlowState | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [trustThisDevice, setTrustThisDevice] = useState(true);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[] | null>(null);
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
  const [openMenuGroups, setOpenMenuGroups] = useState<Record<MenuGroupKey, boolean>>({
    erp: false,
    solutions: false,
    ai: false,
    admin: false,
  });

  const profile = session?.profile;
  const currentSection = sectionMeta[activeSection];
  const loginStatusText = profile
    ? `Logged in now as ${profile.user.name || profile.user.email}`
    : '';

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
        title: 'PharmaCo360',
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
        email,
        password,
        device_name: 'Ubuzima+ Admin Dashboard',
        trusted_device_token: localStorage.getItem(trustedDeviceStorageKey),
      });

      if ('status' in response && response.status?.startsWith('two_factor_')) {
        setTwoFactorFlow(response as TwoFactorFlowState);
        setPassword('');
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
      setPharmaCoreError(err instanceof Error ? err.message : 'Unable to load PharmaCo360 data.');
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
            POS, procurement, finance, reports, and controlled AI in one governed workspace.
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
              <span>Inventory, POS, suppliers, finance, reports, AI</span>
            </div>
          </div>
        </section>

        <section className="auth-panel auth-form-panel">
          <div className="auth-language-row">
            <span>Staff Identity</span>
            <button type="button">English</button>
          </div>

          <div className="login-card">
            <p className="eyebrow">Sign in</p>
            <h2>Access your workspace</h2>
            <p className="auth-copy">
              Use your staff account. Access is tenant-aware and limited by your role, branch, package, and permissions.
            </p>

            <div className="login-method-tabs" aria-label="Login method">
              <button type="button" className="active">Email</button>
              <button type="button" disabled>Phone</button>
            </div>

            {!twoFactorFlow ? (
              <form className="login-form" onSubmit={handleLogin}>
                <label>
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>

                <label>
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>

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

            <div className="demo-users">
              <p>Development shortcuts</p>
              {demoUsers.map((user) => (
                <button key={user.email} type="button" onClick={() => setEmail(user.email)}>
                  <span>{user.label}</span>
                  <small>{user.scope} scope</small>
                </button>
              ))}
            </div>
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
          <h2>PharmaCo360 tenant operations preview</h2>
          <p className="muted">
            Live tenant-scoped data from the PharmaCo360 profile, branches, and department APIs.
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

        {['product-master', 'prescriptions', 'customers'].includes(selectedFeature.key) && (
          <article className="panel wide roadmap-panel">
            <h2>{selectedFeature.title} framework</h2>
            <p className="muted">
              The workflow is now represented in the platform shell and is ready for backend activation,
              migration design, permission mapping, and tenant rollout when prioritized.
            </p>
          </article>
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
    const selectedLayer = adminPanelLayers.find((layer) => layer.key === activeAdminPanelWorkspace) ?? adminPanelLayers[0];

    return (
      <section className="section-page">
        <ModulePageIntro
          eyebrow="Admin Panel"
          title={selectedLayer.title}
          description={selectedLayer.summary}
          status={selectedLayer.status}
        />

        {activeAdminPanelWorkspace === 'two-factor-auth' && (
          <TwoFactorAdminPanel
            token={session.token}
            profile={profile}
            onVerified={(nextToken, nextProfile, trustedDeviceToken) => {
              persistSession({ token: nextToken, profile: nextProfile }, trustedDeviceToken);
            }}
          />
        )}

        {activeAdminPanelWorkspace === 'platform-management' && (
          <PlatformManagementPanel token={session.token} />
        )}

        {activeAdminPanelWorkspace === 'corporate-email' && (
          <CorporateEmailPanel token={session.token} />
        )}

        {activeAdminPanelWorkspace === 'pharmacist-chat' && (
          <PharmacistChatPanel token={session.token} />
        )}

        {activeAdminPanelWorkspace === 'data-layer' && (
          <DataLayerAdminPanel token={session.token} />
        )}

        <section className="admin-layer-grid">
          {adminPanelLayers.map((layer) => (
            <button
              key={layer.key}
              type="button"
              className={activeAdminPanelWorkspace === layer.key ? 'active' : ''}
              onClick={() => setActiveAdminPanelWorkspace(layer.key)}
            >
              <span>{layer.status}</span>
              <strong>{layer.title}</strong>
              <small>{layer.summary}</small>
            </button>
          ))}
        </section>

        {!['two-factor-auth', 'platform-management', 'corporate-email', 'pharmacist-chat', 'data-layer'].includes(activeAdminPanelWorkspace) && (
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

        {!['two-factor-auth', 'corporate-email', 'pharmacist-chat', 'data-layer'].includes(activeAdminPanelWorkspace) && <ModuleReadinessGrid items={settingsBlueprint} />}

        {activeAdminPanelWorkspace === 'backend-api' && accessControlPanel}
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
        return (
          <section className="section-page">
            <ModulePageIntro
              eyebrow="POS module"
              title="Fast pharmacy POS with dispensing safety"
              description="The POS workspace now starts with teller-session, FEFO, prescription, payment, and closure expectations before the live sales review tools."
              status="Live sales APIs plus roadmap"
            />
            <ModuleReadinessGrid items={posReadiness} />
            <SalesDispensingReview token={session.token} profile={profile} />
          </section>
        );
      case 'suppliers':
        return (
          <section className="section-page">
            <ModulePageIntro
              eyebrow="Supplier module"
              title="Supplier, wholesale, and procurement workspace"
              description="Supplier work is separated from inventory so supplier categories, wholesale pharmacy profiles, procurement, and dispatch readiness can evolve cleanly."
              status="Live procurement APIs plus framework"
            />
            <ModuleReadinessGrid items={supplierReadiness} />
            <ProcurementWorkflow token={session.token} profile={profile} />
          </section>
        );
      case 'finance':
        return (
          <section className="section-page">
            <ModulePageIntro
              eyebrow="Finance module"
              title="Payables, receivables, and collection control"
              description="Finance is grouped separately from reports so operational users can focus on invoices, supplier payments, customer credit, and collections."
              status="Live finance APIs"
            />
            <PayablesWorkflow token={session.token} profile={profile} />
            <ReceivablesWorkflow token={session.token} profile={profile} />
          </section>
        );
      case 'reports':
        return (
          <section className="section-page">
            <ModulePageIntro
              eyebrow="Reports module"
              title="Executive reporting and daily command center"
              description="Reporting stays read-only and separated from operational forms to avoid accidental mutation while reviewing performance."
              status="Read-only analytics"
            />
            <PharmacoOperationsCommandCenter token={session.token} profile={profile} />
            <ReportingDashboard token={session.token} profile={profile} />
          </section>
        );
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
                  <small>PharmaCo360 tenant scope</small>
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
            {summaryGrid}
            <section className="system-experience-section">
              <div className="framework-heading">
                <div>
                  <p className="eyebrow">System experience blueprint</p>
                  <h2>Choose a module from the left menu and work in that section.</h2>
                  <p className="muted">
                    The dashboard is no longer one long page. AI, Inventory, POS, Suppliers, Finance,
                    Reports, Setup, Security, and Settings each have their own focused workspace.
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

              <div className="workspace-model-panel">
                <div>
                  <h2>Role-based workspaces to build next</h2>
                  <p className="muted">
                    Existing modules keep their current APIs and progressively adopt this structure.
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
            </section>
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

          <nav className="tree-nav" aria-label="Admin workspace navigation">
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

            {menuGroups.map((group) => (
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
            ))}
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
            <button
              type="button"
              onClick={() => {
                setActiveAdminPanelWorkspace('corporate-email');
                navigateToSection('admin-panel');
              }}
            >
              Email Corporate
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

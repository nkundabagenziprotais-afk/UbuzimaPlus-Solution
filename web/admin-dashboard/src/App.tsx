import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AccessCheckResult, AccessProfile, BranchDepartmentsResponse, BranchesResponse, PharmacyProfileResponse, getAuthenticatedProfile, getBranchDepartments, getPharmaBranches, getPharmacyProfile, login, logout, runAccessCheck } from './lib/api';
import { PharmaCoreEditor } from './components/PharmaCoreEditor';
import { ProductInventoryPreview } from './components/ProductInventoryPreview';
import { ProductInventoryActions } from './components/ProductInventoryActions';
import { SalesDispensingReview } from './components/SalesDispensingReview';
import { ProcurementWorkflow } from './components/ProcurementWorkflow';
import { PayablesWorkflow } from './components/PayablesWorkflow';
import { ReportingDashboard } from './components/ReportingDashboard';
import { PharmacoOperationsCommandCenter } from './components/PharmacoOperationsCommandCenter';
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

type PharmaCoreState = {
  profile: PharmacyProfileResponse | null;
  branches: BranchesResponse | null;
  departments: BranchDepartmentsResponse | null;
};

type AdminSectionKey =
  | 'overview'
  | 'ai-center'
  | 'inventory'
  | 'pos'
  | 'suppliers'
  | 'finance'
  | 'reports'
  | 'tenant-setup'
  | 'security'
  | 'settings';

type MenuGroupKey = 'start' | 'operations' | 'business' | 'control';

type MenuItem = {
  key: AdminSectionKey;
  label: string;
  description: string;
  icon: string;
  status?: string;
};

const storageKey = 'ubuzima_admin_session';
const activeSectionStorageKey = 'ubuzima_admin_active_section';
const brandLogoSrc = '/assets/ubuzima-logo.png';
const publicWebsiteUrl = import.meta.env.VITE_PUBLIC_WEBSITE_URL?.trim() || 'http://127.0.0.1:5174/';
const corporateEmailUrl = 'mailto:info@ubuzimaplus.com';

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
  'ai-center': {
    eyebrow: 'Governed AI module',
    title: 'AI Center review workspace',
    description: 'Document extraction, reconciliation, recommendations, approvals, and audit-first AI operations.',
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
    key: 'start',
    label: 'Start here',
    icon: 'ST',
    items: [
      { key: 'ai-center', label: 'AI Center', description: 'Extraction, reconciliation, approval', icon: 'AI', status: 'Priority' },
      { key: 'inventory', label: 'Inventory', description: 'Batch, expiry, FEFO, stock', icon: 'IN', status: 'Priority' },
      { key: 'pos', label: 'POS', description: 'Sales, dispensing, till control', icon: 'POS', status: 'Priority' },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    icon: 'OP',
    items: [
      { key: 'tenant-setup', label: 'Tenant setup', description: 'Profile, branches, departments', icon: 'TN' },
      { key: 'suppliers', label: 'Suppliers', description: 'Suppliers, wholesale, procurement', icon: 'SP' },
      { key: 'finance', label: 'Finance', description: 'Payables and receivables', icon: 'FN' },
      { key: 'reports', label: 'Reports', description: 'BI and command center', icon: 'RP' },
    ],
  },
  {
    key: 'business',
    label: 'Growth channels',
    icon: 'GR',
    items: [
      { key: 'settings', label: 'Offline mode', description: 'Allowed offline services and sync policy', icon: 'OF', status: 'Framework' },
      { key: 'settings', label: 'API integration', description: 'Connector proposals and sandbox approval', icon: 'API', status: 'Framework' },
    ],
  },
  {
    key: 'control',
    label: 'Control',
    icon: 'CT',
    items: [
      { key: 'security', label: 'Security', description: 'Permissions, access, tenant boundary', icon: 'SC' },
      { key: 'settings', label: 'Settings', description: 'Packages, modules, policy, channels', icon: 'ST' },
    ],
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
  const [openMenuGroups, setOpenMenuGroups] = useState<Record<MenuGroupKey, boolean>>({
    start: false,
    operations: false,
    business: false,
    control: false,
  });

  const profile = session?.profile;
  const currentSection = sectionMeta[activeSection];

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

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await login({
        email,
        password,
        device_name: 'Ubuzima+ Admin Dashboard',
      });

      const nextSession = {
        token: response.access_token,
        profile: response.profile,
      };

      localStorage.setItem(storageKey, JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
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
      <main className="auth-shell">
        <section className="auth-panel">
          <img className="auth-logo" src={brandLogoSrc} alt="Ubuzima+" />
          <p className="eyebrow">Ubuzima+ Platform</p>
          <h1>Sign in to manage trusted health operations.</h1>
          <p className="auth-copy">
            Access is role-based and tenant-aware. PharmaCo360 administrators see only the
            modules, tenants, and actions assigned to their scope.
          </p>

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
              {isSubmitting ? 'Checking access…' : 'Sign in securely'}
            </button>
          </form>

          <div className="demo-users">
            <p>Development users</p>
            {demoUsers.map((user) => (
              <button key={user.email} type="button" onClick={() => setEmail(user.email)}>
                <span>{user.label}</span>
                <small>{user.scope} scope</small>
              </button>
            ))}
          </div>
        </section>

        <section className="auth-side">
          <div className="status-card">
            <span className="status-dot" />
            <div>
              <strong>Backend API ready</strong>
              <p>Login uses `/api/v1/auth/login` with Sanctum Bearer tokens.</p>
            </div>
          </div>

          <div className="principle-card">
            <h2>Security by design</h2>
            <ul>
              <li>Permission-based navigation</li>
              <li>Tenant boundary protection</li>
              <li>Controlled AI Center access</li>
              <li>Audit-ready administration</li>
            </ul>
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

  function renderActiveSection() {
    switch (activeSection) {
      case 'ai-center':
        return (
          <section className="section-page">
            <ModulePageIntro
              eyebrow="AI module"
              title="Governed AI extraction, reconciliation, and approval"
              description="Built around the attached requirements: AI creates proposals from documents and system records, then humans approve before any product, price, or inventory update is applied."
              status="Controlled activation"
            />
            <ModuleReadinessGrid items={aiWorkflows} />
            <section className="ai-workspace-grid">
              <article className="panel">
                <h2>AI review queue model</h2>
                <div className="workflow-list">
                  <div><strong>Pending extraction</strong><span>Documents wait for structured content review, not file-only approval.</span></div>
                  <div><strong>Pending reconciliation</strong><span>Existing products, prices, suppliers, and stock fields are compared before approval.</span></div>
                  <div><strong>Pending bulk approval</strong><span>Bulk approval is allowed only after differences, risk, and affected fields are visible.</span></div>
                  <div><strong>Apply after approval</strong><span>Approved changes become backend work items for product, regulatory price, and inventory updates.</span></div>
                </div>
              </article>

              <article className="panel">
                <h2>AI safety controls</h2>
                <div className="workflow-list">
                  <div><strong>No paid provider by default</strong><span>External AI stays optional and provider-configured.</span></div>
                  <div><strong>No arbitrary code execution</strong><span>AI proposes connector mappings and reviewed configuration only.</span></div>
                  <div><strong>Timeout-aware work</strong><span>Long extraction should be queued or chunked so web requests avoid 30-second failures.</span></div>
                  <div><strong>Audit required</strong><span>Every AI recommendation needs reason, confidence, risk, approver, and audit trail.</span></div>
                </div>
              </article>
            </section>
            {accessControlPanel}
          </section>
        );
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
                        className={activeSection === item.key ? 'active' : ''}
                        data-section={item.key}
                        onClick={() => navigateToSection(item.key)}
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
            <a href={publicWebsiteUrl}>Website</a>
            <a href={corporateEmailUrl}>Email Corporate</a>
          </div>

          <div className="user-card">
            <strong>{profile.user.email}</strong>
            <span>{profile.user.status}</span>
            <small>{profile.scope.type} scope</small>
            {profile.user.must_change_password && <small>Password change required</small>}
          </div>
        </header>

        <section className="dashboard-scroll-panel">
          {renderActiveSection()}
        </section>
      </section>
    </main>
  );
}

export default App;

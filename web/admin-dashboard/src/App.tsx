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
  | 'solutions'
  | 'tenants'
  | 'modules'
  | 'ai-center'
  | 'audit-logs'
  | 'security'
  | 'settings'
  | 'command-center'
  | 'reporting'
  | 'procurement'
  | 'payables'
  | 'receivables'
  | 'sales-dispensing'
  | 'pharma-core'
  | 'inventory';

type AdminNavItem = {
  key: AdminSectionKey;
  label: string;
  description: string;
  icon: string;
};

type AdminNavGroupKey = 'platform' | 'operations' | 'commerce' | 'finance' | 'governance';

type AdminNavGroup = {
  key: AdminNavGroupKey;
  title: string;
  description: string;
  icon: string;
  items: AdminNavItem[];
};

const adminNavGroups: AdminNavGroup[] = [
  {
    key: 'platform',
    title: 'Platform workspace',
    description: 'Overview, solutions, tenants, modules',
    icon: '⌂',
    items: [
      {
        key: 'overview',
        label: 'Overview',
        description: 'Relevant profile, scope, and access summary',
        icon: '⌂',
      },
      {
        key: 'solutions',
        label: 'Solutions',
        description: 'Enabled business solutions',
        icon: '◫',
      },
      {
        key: 'tenants',
        label: 'Tenants',
        description: 'Tenant and branch assignments',
        icon: '☷',
      },
      {
        key: 'modules',
        label: 'Modules',
        description: 'Real Admin Home sub-modules',
        icon: '▦',
      },
    ],
  },
  {
    key: 'operations',
    title: 'PharmaCo360 operations',
    description: 'Command, reporting, core setup',
    icon: '◎',
    items: [
      {
        key: 'command-center',
        label: 'Command Center',
        description: 'Daily operating picture',
        icon: '◎',
      },
      {
        key: 'reporting',
        label: 'Operating View',
        description: 'Stock, sales, purchasing, credit, payables',
        icon: '▣',
      },
      {
        key: 'pharma-core',
        label: 'Pharma Core',
        description: 'Tenant profile, branches, departments',
        icon: '◇',
      },
    ],
  },
  {
    key: 'commerce',
    title: 'Sales and stock',
    description: 'Inventory, sales, dispensing',
    icon: '▤',
    items: [
      {
        key: 'inventory',
        label: 'Inventory',
        description: 'Products, batches, and stock movement',
        icon: '▤',
      },
      {
        key: 'sales-dispensing',
        label: 'Sales & Dispensing',
        description: 'Sales queues, payment, prescription review',
        icon: '＋',
      },
    ],
  },
  {
    key: 'finance',
    title: 'Finance workflows',
    description: 'Purchase orders, payables, receivables',
    icon: '₣',
    items: [
      {
        key: 'procurement',
        label: 'Purchase Orders',
        description: 'Suppliers, PO creation, and receiving',
        icon: '↗',
      },
      {
        key: 'payables',
        label: 'Supplier Payables',
        description: 'Supplier invoices and payments',
        icon: '₣',
      },
      {
        key: 'receivables',
        label: 'Customer Receivables',
        description: 'Customer credit and collections',
        icon: '◌',
      },
    ],
  },
  {
    key: 'governance',
    title: 'Governance',
    description: 'Security, audit, AI, settings',
    icon: '◈',
    items: [
      {
        key: 'security',
        label: 'Security',
        description: 'Roles, permissions, and access checks',
        icon: '◈',
      },
      {
        key: 'audit-logs',
        label: 'Audit Logs',
        description: 'Review traceability and controls',
        icon: '◷',
      },
      {
        key: 'ai-center',
        label: 'AI Center',
        description: 'Controlled AI access area',
        icon: '✦',
      },
      {
        key: 'settings',
        label: 'Settings',
        description: 'Account and workspace settings',
        icon: '⚙',
      },
    ],
  },
];

const adminNavItems: AdminNavItem[] = adminNavGroups.flatMap((group) => group.items);

function isAdminSectionKey(value: string | null): value is AdminSectionKey {
  return Boolean(value && adminNavItems.some((item) => item.key === value));
}

function loadStoredAdminSection(): AdminSectionKey {
  try {
    const stored = sessionStorage.getItem('ubuzima_admin_active_section');
    return isAdminSectionKey(stored) ? stored : 'overview';
  } catch {
    return 'overview';
  }
}

function loadStoredExpandedNavGroups(): Record<AdminNavGroupKey, boolean> {
  const defaults: Record<AdminNavGroupKey, boolean> = {
    platform: true,
    operations: false,
    commerce: false,
    finance: false,
    governance: false,
  };

  try {
    const stored = sessionStorage.getItem('ubuzima_admin_expanded_nav_groups');

    if (!stored) {
      return defaults;
    }

    const parsed = JSON.parse(stored) as Partial<Record<AdminNavGroupKey, boolean>>;

    return {
      ...defaults,
      ...parsed,
    };
  } catch {
    return defaults;
  }
}




const storageKey = 'ubuzima_admin_session';

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

function loadStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
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
  const [activeSection, setActiveSection] = useState<AdminSectionKey>(() => loadStoredAdminSection());
  const [expandedNavGroups, setExpandedNavGroups] = useState<Record<AdminNavGroupKey, boolean>>(() => loadStoredExpandedNavGroups());

  const profile = session?.profile;

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


  const safeRoles = profile?.roles ?? [];
  const safePermissions = profile?.permissions ?? [];
  const safeTenantAssignments = profile?.tenant_assignments ?? [];
  const safeAdminScopes = profile?.admin_scopes ?? [];
  const safeUser = profile?.user ?? {
    id: 0,
    name: 'Admin User',
    email: 'Not available',
    phone: null,
    status: 'active',
    must_change_password: false,
    last_login_at: null,
  };
  const safeScope = profile?.scope ?? {
    type: 'tenant',
    solution_id: null,
    tenant_id: null,
    branch_id: null,
    is_platform: false,
    is_solution: false,
    is_tenant: true,
    is_branch: false,
  };
  const safePharmaProfile = pharmaCore.profile?.profile ?? null;
  const activeNavItem = adminNavItems.find((item) => item.key === activeSection) ?? adminNavItems[0];
  const activeNavGroup = adminNavGroups.find((group) => group.items.some((item) => item.key === activeSection)) ?? adminNavGroups[0];
  const appEnv = (import.meta as any).env ?? {};
  const tenantWebsiteSignals = [
    safeUser.email,
    (safePharmaProfile as any)?.trading_name,
    (safePharmaProfile as any)?.legal_name,
    (safePharmaProfile as any)?.name,
    ...safeTenantAssignments.map((assignment) => assignment.tenant?.slug),
    ...safeTenantAssignments.map((assignment) => assignment.tenant?.name),
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
  const companyEmail = appEnv.VITE_COMPANY_EMAIL || (safePharmaProfile as any)?.email || (safePharmaProfile as any)?.contact_email || safeUser.email;
  const sectionViewClass = (section: AdminSectionKey, extra = '') => `admin-section-view ${activeSection === section ? 'active' : ''}${extra ? ` ${extra}` : ''}`;

  const permissionGroups = useMemo(() => {
    if (!profile) return [];

    return [
      {
        title: 'Security',
        items: safePermissions.filter((item) => item.includes('roles') || item.includes('audit')),
      },
      {
        title: 'PharmaCo360',
        items: safePermissions.filter((item) => item.startsWith('pharmaco.')),
      },
      {
        title: 'AI & Platform',
        items: safePermissions.filter((item) => item.includes('ai') || item.includes('platform')),
      },
    ].filter((group) => group.items.length > 0);
  }, [profile]);

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
      safeTenantAssignments.find((assignment) => assignment.status === 'active')?.tenant?.slug ||
      safeTenantAssignments[0]?.tenant?.slug ||
      (safeScope.is_tenant ? 'vitapharma' : '');

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


  function handleNavGroupToggle(groupKey: AdminNavGroupKey) {
    setExpandedNavGroups((current) => {
      const next = {
        ...current,
        [groupKey]: !current[groupKey],
      };

      try {
        sessionStorage.setItem('ubuzima_admin_expanded_nav_groups', JSON.stringify(next));
      } catch {
        // Keep the tree usable even if session storage is unavailable.
      }

      return next;
    });
  }

  function handleAdminNavigation(section: AdminSectionKey) {
    setActiveSection(section);

    window.requestAnimationFrame(() => {
      document.getElementById(`admin-section-${section}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }


  function handleBackNavigation() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    handleAdminNavigation('overview');
  }


  if (isRestoringSession) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="brand-mark">U+</div>
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
          <div className="brand-mark">U+</div>
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

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">U+</div>
          <div>
            <strong>Ubuzima+</strong>
            <span>Admin Center</span>
          </div>
        </div>

        <nav className="admin-home-nav admin-home-nav-tree" aria-label="Admin home sections">
          {adminNavGroups.map((group) => {
            const isExpanded = expandedNavGroups[group.key];
            const groupHasActiveItem = group.items.some((item) => item.key === activeSection);

            return (
              <section key={group.key} className={`admin-nav-group ${groupHasActiveItem ? 'has-active' : ''}`}>
                <button
                  type="button"
                  className="admin-nav-group-toggle"
                  aria-expanded={isExpanded}
                  onClick={() => handleNavGroupToggle(group.key)}
                >
                  <span className="admin-nav-icon" aria-hidden="true">{group.icon}</span>
                  <span className="admin-nav-copy">
                    <strong>{group.title}</strong>
                    <small>{group.description}</small>
                  </span>
                  <span className="admin-nav-chevron" aria-hidden="true">{isExpanded ? '⌃' : '⌄'}</span>
                </button>

                {isExpanded && (
                  <div className="admin-nav-children">
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={item.key === activeSection ? 'active' : ''}
                        aria-current={item.key === activeSection ? 'page' : undefined}
                        onClick={() => handleAdminNavigation(item.key)}
                      >
                        <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
                        <span className="admin-nav-copy">
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </nav>

        <button className="logout-button" type="button" onClick={handleLogout}>
          Sign out
        </button>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Authenticated workspace</p>
            <h1>Welcome back, {safeUser.name}</h1>
            <p>
              Current scope: <strong>{safeScope.type}</strong>. Access is generated from
              active roles, tenant assignments, and enabled modules.
            </p>
          </div>

          <div className="dashboard-header-actions" aria-label="Workspace quick actions">
            <button className="header-icon-action" type="button" onClick={handleBackNavigation}>
              <span aria-hidden="true">←</span>
              <strong>Back</strong>
            </button>

            <a className="header-icon-action" href={publicWebsiteUrl} target="_blank" rel="noreferrer">
              <span aria-hidden="true">↗</span>
              <strong>{publicWebsiteLabel}</strong>
            </a>

            <a className="header-icon-action" href={`mailto:${companyEmail}`}>
              <span aria-hidden="true">✉</span>
              <strong>Company email</strong>
            </a>

            <div className="user-card">
              <strong>{safeUser.email}</strong>
              <span>{safeUser.status}</span>
              {safeUser.must_change_password && <small>Password change required</small>}
            </div>
          </div>
        </header>

        <section className="admin-workspace-scroll" aria-label="Admin workspace content">
        <section className="admin-home-orientation" aria-live="polite">
          <span>{activeNavItem.icon}</span>
          <div>
            <strong>{activeNavGroup.title} · {activeNavItem.label}</strong>
            <p>{activeNavItem.description}. The left menu, top action bar, and workspace scroll independently. Section changes do not refresh the page or reset your working position.</p>
          </div>
        </section>

        <section id="admin-section-overview" className={sectionViewClass('overview', 'summary-grid admin-overview-grid')} hidden={activeSection !== 'overview'}>
          <article>
            <span>Active roles</span>
            <strong>{safeRoles.length}</strong>
          </article>
          <article>
            <span>Permissions</span>
            <strong>{safePermissions.length}</strong>
          </article>
          <article>
            <span>Tenant assignments</span>
            <strong>{safeTenantAssignments.length}</strong>
          </article>
          <article>
            <span>Admin scopes</span>
            <strong>{safeAdminScopes.length}</strong>
          </article>

          <article className="summary-website-card">
            <span>Main website</span>
            <strong>{publicWebsiteLabel}</strong>
            <a href={publicWebsiteUrl} target="_blank" rel="noreferrer">
              Open website
            </a>
          </article>
        </section>

        <section id="admin-section-command-center" className={sectionViewClass('command-center', 'admin-module-anchor admin-module-command-center')} hidden={activeSection !== 'command-center'}>
          <PharmacoOperationsCommandCenter token={session.token} profile={profile} />
        </section>

        <section className="content-grid">
          <article className={sectionViewClass('overview', 'panel')} hidden={activeSection !== 'overview'}>
            <h2>Resolved access profile</h2>
            <div className="scope-list">
              <div>
                <span>Scope type</span>
                <strong>{safeScope.type}</strong>
              </div>
              <div>
                <span>Solution ID</span>
                <strong>{safeScope.solution_id ?? 'All'}</strong>
              </div>
              <div>
                <span>Tenant ID</span>
                <strong>{safeScope.tenant_id ?? 'All / none'}</strong>
              </div>
              <div>
                <span>Branch ID</span>
                <strong>{safeScope.branch_id ?? 'All / none'}</strong>
              </div>
            </div>
          </article>

          <article className={sectionViewClass('overview', 'panel')} hidden={activeSection !== 'overview'}>
            <h2>Roles</h2>
            <div className="tag-list">
              {safeRoles.map((role) => (
                <span key={`${role.code}-${role.tenant_id ?? 'global'}`}>{role.name}</span>
              ))}
            </div>
          </article>

          <article className={sectionViewClass('overview', 'panel wide')} hidden={activeSection !== 'overview'}>
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



          <article id="admin-section-pharma-core" className={sectionViewClass('pharma-core', 'panel wide pharmaco-panel admin-module-anchor')} hidden={activeSection !== 'pharma-core'}>
            <div className="panel-heading-row">
              <div>
                <h2>PharmaCo360 tenant operations preview</h2>
                <p className="muted">
                  Live tenant-scoped data from the PharmaCo360 profile, branches, and department APIs.
                </p>
              </div>

              <button type="button" onClick={loadPharmaCore} disabled={isLoadingPharmaCore}>
                {isLoadingPharmaCore ? 'Loading…' : 'Load VitaPharma profile'}
              </button>
            </div>

            {pharmaCoreError && <div className="form-error">{pharmaCoreError}</div>}

            {pharmaCore.profile && (
              <div className="pharmaco-grid">
                <section className="pharmaco-card">
                  <span className="section-label">Pharmacy profile</span>
                  <h3>{safePharmaProfile?.trading_name ?? 'Pharmacy profile'}</h3>
                  <p>{safePharmaProfile?.legal_name ?? 'Legal name not set'}</p>
                  <div className="mini-facts">
                    <span>Category: {safePharmaProfile?.pharmacy_category ?? 'Not set'}</span>
                    <span>Regulator: {safePharmaProfile?.regulator_name ?? 'Not set'}</span>
                    <span>Status: {safePharmaProfile?.status ?? 'Not set'}</span>
                    <span>District: {safePharmaProfile?.district ?? 'Not set'}</span>
                  </div>
                </section>

                <section className="pharmaco-card">
                  <span className="section-label">Capabilities</span>
                  <div className="tag-list">
                    {(safePharmaProfile?.capabilities ?? []).map((capability) => (
                      <span key={capability}>{capability.replaceAll('_', ' ')}</span>
                    ))}
                  </div>
                </section>

                <section className="pharmaco-card">
                  <span className="section-label">Insurance partners</span>
                  <div className="tag-list">
                    {(safePharmaProfile?.insurance_partners ?? []).map((partner) => (
                      <span key={partner}>{partner}</span>
                    ))}
                  </div>
                </section>

                <section className="pharmaco-card">
                  <span className="section-label">Operating hours</span>
                  <div className="mini-facts">
                    {Object.entries(safePharmaProfile?.operating_hours ?? {}).map(([day, hours]) => (
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

          <section className={sectionViewClass('pharma-core', 'admin-module-anchor admin-module-stack')} hidden={activeSection !== 'pharma-core'}>
            <PharmaCoreEditor token={session.token} profile={profile} />
          </section>

          <section id="admin-section-inventory" className={sectionViewClass('inventory', 'admin-module-anchor admin-module-stack')} hidden={activeSection !== 'inventory'}>
            <ProductInventoryPreview token={session.token} profile={profile} />

            <ProductInventoryActions token={session.token} profile={profile} />
          </section>

          <section id="admin-section-procurement" className={sectionViewClass('procurement', 'admin-module-anchor admin-module-stack')} hidden={activeSection !== 'procurement'}>
            <ProcurementWorkflow token={session.token} profile={profile} />
          </section>


          <section id="admin-section-payables" className={sectionViewClass('payables', 'admin-module-anchor admin-module-stack payables-workspace-shell')} hidden={activeSection !== 'payables'}>
            <article className="panel wide finance-workspace-guide">
              <div className="admin-placeholder-heading">
                <span aria-hidden="true">₣</span>
                <div>
                  <h2>Supplier Payables workspace</h2>
                  <p className="muted">Payables contains several actions, so this page starts with a simple map before the working forms.</p>
                </div>
              </div>

              <div className="finance-workspace-table-wrap">
                <table className="finance-workspace-table">
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>Workspace area</th>
                      <th>User action</th>
                      <th>UX purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>01</td>
                      <td>Create payable</td>
                      <td>Start from approved purchase order and supplier invoice details.</td>
                      <td>Separate data capture from approval work.</td>
                    </tr>
                    <tr>
                      <td>02</td>
                      <td>Supplier invoices</td>
                      <td>Review invoice status, balance, supplier, and due date.</td>
                      <td>Give finance users a clean review queue.</td>
                    </tr>
                    <tr>
                      <td>03</td>
                      <td>Approval and payment</td>
                      <td>Approve payable and record payment only after review.</td>
                      <td>Reduce accidental finance actions.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <PayablesWorkflow token={session.token} profile={profile} />
          </section>

          <section id="admin-section-reporting" className={sectionViewClass('reporting', 'admin-module-anchor admin-module-stack')} hidden={activeSection !== 'reporting'}>
            <ReportingDashboard token={session.token} profile={profile} />
          </section>
          <section id="admin-section-receivables" className={sectionViewClass('receivables', 'admin-module-anchor admin-module-stack')} hidden={activeSection !== 'receivables'}>
            <ReceivablesWorkflow token={session.token} profile={profile} />
          </section>

          <section id="admin-section-sales-dispensing" className={sectionViewClass('sales-dispensing', 'admin-module-anchor admin-module-stack')} hidden={activeSection !== 'sales-dispensing'}>
            <SalesDispensingReview token={session.token} profile={profile} />
          </section>

          <article id="admin-section-security" className={sectionViewClass('security', 'panel wide admin-module-anchor')} hidden={activeSection !== 'security'}>
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

          <article id="admin-section-tenants" className={sectionViewClass('tenants', 'panel wide admin-module-anchor')} hidden={activeSection !== 'tenants'}>
            <h2>Tenant assignments</h2>
            {safeTenantAssignments.length === 0 ? (
              <p className="muted">No tenant assignment is attached to this account.</p>
            ) : (
              <div className="tenant-table">
                {safeTenantAssignments.map((assignment) => (
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


          <article id="admin-section-solutions" className={sectionViewClass('solutions', 'panel wide admin-module-anchor admin-placeholder-panel')} hidden={activeSection !== 'solutions'}>
            <div className="admin-placeholder-heading">
              <span aria-hidden="true">◫</span>
              <div>
                <h2>Solutions</h2>
                <p className="muted">A focused view of enabled business solutions for this workspace.</p>
              </div>
            </div>

            <div className="admin-ux-card-grid">
              <div>
                <strong>PharmaCo360</strong>
                <span>Active pharmacy operating solution</span>
                <small>Connected to tenant-safe pharmacy operations, inventory, sales, procurement, payables, receivables, and reporting workflows.</small>
              </div>
              <div>
                <strong>Access scope</strong>
                <span>{safeScope.type}</span>
                <small>Visible actions are controlled by roles, permissions, tenant assignments, and enabled modules.</small>
              </div>
            </div>
          </article>

          <article id="admin-section-modules" className={sectionViewClass('modules', 'panel wide admin-module-anchor admin-placeholder-panel')} hidden={activeSection !== 'modules'}>
            <div className="admin-placeholder-heading">
              <span aria-hidden="true">▦</span>
              <div>
                <h2>Modules</h2>
                <p className="muted">A folded directory of real Admin Home modules. ERP is not shown because it is not currently implemented in this dashboard.</p>
              </div>
            </div>

            <div className="admin-module-directory grouped">
              {adminNavGroups
                .filter((group) => ['operations', 'commerce', 'finance', 'governance'].includes(group.key))
                .map((group) => (
                  <section key={group.key} className="admin-module-directory-group">
                    <div>
                      <span aria-hidden="true">{group.icon}</span>
                      <strong>{group.title}</strong>
                      <small>{group.description}</small>
                    </div>

                    <div>
                      {group.items.map((item) => (
                        <button key={item.key} type="button" onClick={() => handleAdminNavigation(item.key)}>
                          <span aria-hidden="true">{item.icon}</span>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          </article>

          <article id="admin-section-ai-center" className={sectionViewClass('ai-center', 'panel wide admin-module-anchor admin-placeholder-panel')} hidden={activeSection !== 'ai-center'}>
            <div className="admin-placeholder-heading">
              <span aria-hidden="true">✦</span>
              <div>
                <h2>AI Center</h2>
                <p className="muted">Controlled AI access remains permission-aware and tenant-aware.</p>
              </div>
            </div>

            <div className="admin-ux-card-grid">
              <div>
                <strong>Controlled access</strong>
                <span>AI features must pass backend access checks.</span>
                <small>No sensitive AI recommendation should bypass human approval in health, finance, insurance, or pharmacy workflows.</small>
              </div>
              <div>
                <strong>Quick check</strong>
                <span>Validate AI access for VitaPharma.</span>
                <button type="button" onClick={() => handleAccessCheck('AI Center controlled-module check', 'ai', 'vitapharma')} disabled={isCheckingAccess}>
                  {isCheckingAccess ? 'Checking…' : 'Check AI Center access'}
                </button>
              </div>
            </div>
          </article>

          <article id="admin-section-audit-logs" className={sectionViewClass('audit-logs', 'panel wide admin-module-anchor admin-placeholder-panel')} hidden={activeSection !== 'audit-logs'}>
            <div className="admin-placeholder-heading">
              <span aria-hidden="true">◷</span>
              <div>
                <h2>Audit Logs</h2>
                <p className="muted">Audit readiness view for controlled operating workflows.</p>
              </div>
            </div>

            <div className="admin-ux-card-grid">
              <div>
                <strong>Current control position</strong>
                <span>Permission checks and tenant boundaries remain visible.</span>
                <small>Operational actions should remain traceable through backend audit services where enabled.</small>
              </div>
              <div>
                <strong>Review focus</strong>
                <span>Prioritize finance, inventory, credit, payables, and dispensing changes.</span>
                <small>This phase does not add a new backend audit-log endpoint.</small>
              </div>
            </div>
          </article>

          <article id="admin-section-settings" className={sectionViewClass('settings', 'panel wide admin-module-anchor admin-placeholder-panel')} hidden={activeSection !== 'settings'}>
            <div className="admin-placeholder-heading">
              <span aria-hidden="true">⚙</span>
              <div>
                <h2>Settings</h2>
                <p className="muted">Workspace settings and account context for the logged-in administrator.</p>
              </div>
            </div>

            <div className="admin-ux-card-grid">
              <div>
                <strong>Signed-in account</strong>
                <span>{safeUser.email}</span>
                <small>Status: {safeUser.status}. Scope: {safeScope.type}.</small>
              </div>
              <div>
                <strong>Session behavior</strong>
                <span>Section selection is preserved for the active browser session.</span>
                <small>Menu changes do not force a page refresh or reset the page to the top.</small>
              </div>
            </div>
          </article>

        </section>
        </section>
      </section>
    </main>
  );
}

export default App;

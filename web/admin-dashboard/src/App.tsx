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

const storageKey = 'ubuzima_admin_session';
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

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img className="sidebar-logo" src={brandLogoSrc} alt="Ubuzima+" />
          <div>
            <strong>Ubuzima+</strong>
            <span>Admin Center</span>
          </div>
        </div>

        <nav>
          <a className="active">Overview</a>
          <a>Solutions</a>
          <a>Tenants</a>
          <a>Modules</a>
          <a>AI Center</a>
          <a>Audit Logs</a>
          <a>Security</a>
          <a>Settings</a>
        </nav>

        <button className="logout-button" type="button" onClick={handleLogout}>
          Sign out
        </button>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Authenticated workspace</p>
            <h1>Welcome back, {profile.user.name}</h1>
            <p>
              Current scope: <strong>{profile.scope.type}</strong>. Access is generated from
              active roles, tenant assignments, and enabled modules.
            </p>
          </div>

          <div className="user-card">
            <strong>{profile.user.email}</strong>
            <span>{profile.user.status}</span>
            {profile.user.must_change_password && <small>Password change required</small>}
          </div>
        </header>

        <section className="summary-grid">
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

        <section className="system-experience-section">
          <div className="framework-heading">
            <div>
              <p className="eyebrow">System experience blueprint</p>
              <h2>One design model for every current and future Ubuzima+ module.</h2>
              <p className="muted">
                The platform now has a visible UX framework that future work can follow: role-first
                navigation, progressive module activation, operational 360 views, and channel-specific layouts.
              </p>
            </div>

            <div className="framework-scope-card design-system-card">
              <span>Design infrastructure</span>
              <strong>Synced</strong>
              <small>Logo, modules, roles, channels, and activation states</small>
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
                These are the destination workspaces for the whole system. Existing modules should keep their
                current APIs, then progressively adopt this structure.
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

        <section className="commercial-framework-section">
          <div className="framework-heading">
            <div>
              <p className="eyebrow">Commercial platform framework</p>
              <h2>Ubuzima+ should expose the full system, while activating modules safely.</h2>
              <p className="muted">
                This workspace now shows the current operating framework across platform core,
                PharmaCo360, future growth modules, AI governance, and application channels.
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

          <div className="view-framework-grid">
            <article className="framework-wide-panel">
              <div className="panel-heading-row">
                <div>
                  <h2>360 views to build into every module</h2>
                  <p className="muted">
                    Each user needs a complete but permissioned view of the entity they manage, with
                    alerts, pending actions, recent activity, and AI explanation where relevant.
                  </p>
                </div>
              </div>

              <div className="view-map">
                {viewFramework.map(([title, text]) => (
                  <div key={title}>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="framework-channel-panel">
              <h2>Channel readiness</h2>
              <div className="channel-readiness-list">
                {channelReadiness.map(([title, text]) => (
                  <div key={title}>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <PharmacoOperationsCommandCenter token={session.token} profile={profile} />

        <section className="content-grid">
          <article className="panel">
            <h2>Resolved access profile</h2>
            <div className="scope-list">
              <div>
                <span>Scope type</span>
                <strong>{profile.scope.type}</strong>
              </div>
              <div>
                <span>Solution ID</span>
                <strong>{profile.scope.solution_id ?? 'All'}</strong>
              </div>
              <div>
                <span>Tenant ID</span>
                <strong>{profile.scope.tenant_id ?? 'All / none'}</strong>
              </div>
              <div>
                <span>Branch ID</span>
                <strong>{profile.scope.branch_id ?? 'All / none'}</strong>
              </div>
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



          <article className="panel wide pharmaco-panel">
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

          <PharmaCoreEditor token={session.token} profile={profile} />

          <ProductInventoryPreview token={session.token} profile={profile} />

          <ProductInventoryActions token={session.token} profile={profile} />

          <ProcurementWorkflow token={session.token} profile={profile} />


          <PayablesWorkflow token={session.token} profile={profile} />

          <ReportingDashboard token={session.token} profile={profile} />
          <ReceivablesWorkflow token={session.token} profile={profile} />

          <SalesDispensingReview token={session.token} profile={profile} />

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
        </section>
      </section>
    </main>
  );
}

export default App;

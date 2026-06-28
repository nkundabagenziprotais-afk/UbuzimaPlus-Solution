import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AccessProfile, getAuthenticatedProfile, login, logout } from './lib/api';
import './styles.css';

type StoredSession = {
  token: string;
  profile: AccessProfile;
};

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

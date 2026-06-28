const summaryCards = [
  {
    label: 'Active tenants',
    value: '1',
    note: 'VitaPharma pilot active'
  },
  {
    label: 'Solutions',
    value: '3',
    note: 'PharmaCo360 active, ClinicCo360 and VetCo360 planned'
  },
  {
    label: 'Modules mapped',
    value: '19',
    note: 'Activated progressively by tenant and package'
  },
  {
    label: 'AI status',
    value: 'Controlled',
    note: 'Human approval required before sensitive use'
  }
];

const adminLevels = [
  {
    title: 'Ubuzima+ Admin',
    description: 'Controls platform-wide settings, solutions, tenants, AI providers, billing, security, support access and system health.',
    permissions: ['Platform overview', 'Tenant supervision', 'Global AI governance', 'Audit and security']
  },
  {
    title: 'PharmaCo360 Admin',
    description: 'Controls PharmaCo360 configuration, module availability, solution templates, pharmacy insights and tenant onboarding.',
    permissions: ['Solution modules', 'Pharmacy workflows', 'Aggregated insights', 'Support coordination']
  },
  {
    title: 'VitaPharma Tenant Admin',
    description: 'Controls VitaPharma users, branches, local settings, active modules, operations, reports and tenant-specific AI preferences.',
    permissions: ['Tenant users', 'Branches', 'Inventory and POS', 'Tenant reports']
  }
];

const pendingTasks = [
  'Review VitaPharma Phase 1 module activation',
  'Confirm tenant branding and receipt settings',
  'Approve AI Center sandbox policy before activation',
  'Prepare RBAC roles for pharmacy users',
  'Review audit logging coverage before production deployment'
];

const modules = [
  ['Public Website', 'Active foundation'],
  ['Authentication', 'Planned'],
  ['Admin Scopes', 'Foundation ready'],
  ['Tenancy', 'Foundation ready'],
  ['RBAC', 'Planned'],
  ['Audit Logs', 'Foundation ready'],
  ['AI Center', 'Controlled'],
  ['Product Master', 'Planned'],
  ['Inventory', 'Planned'],
  ['POS and Sales', 'Planned'],
  ['Suppliers', 'Planned'],
  ['Reports', 'Planned']
];

function App() {
  return (
    <main className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span>U+</span>
          <div>
            <strong>Ubuzima+</strong>
            <small>Platform Console</small>
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

        <div className="sidebar-note">
          <strong>Current branch</strong>
          <span>feature/platform-foundation</span>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Phase 0 dashboard frame</p>
            <h1>Admin control center for Ubuzima+, PharmaCo360 and VitaPharma.</h1>
          </div>

          <div className="profile-card">
            <span className="avatar">PN</span>
            <div>
              <strong>Protais</strong>
              <small>Ubuzima+ Platform Owner</small>
            </div>
          </div>
        </header>

        <section className="cards">
          {summaryCards.map((card) => (
            <article className="metric-card" key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.note}</p>
            </article>
          ))}
        </section>

        <section className="grid two">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Admin hierarchy</p>
                <h2>Higher levels supervise lower levels without breaking data separation.</h2>
              </div>
            </div>

            <div className="admin-list">
              {adminLevels.map((level) => (
                <div className="admin-item" key={level.title}>
                  <h3>{level.title}</h3>
                  <p>{level.description}</p>
                  <div className="chips">
                    {level.permissions.map((permission) => (
                      <span key={permission}>{permission}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Pending decisions</p>
                <h2>Review queue before deeper implementation.</h2>
              </div>
            </div>

            <ul className="task-list">
              {pendingTasks.map((task) => (
                <li key={task}>
                  <span></span>
                  {task}
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="grid two">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Module activation</p>
                <h2>Modules exist structurally and become active by phase.</h2>
              </div>
            </div>

            <div className="module-table">
              {modules.map(([name, status]) => (
                <div className="module-row" key={name}>
                  <strong>{name}</strong>
                  <span>{status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel ai-panel">
            <p className="eyebrow">Ubuzima AI Center</p>
            <h2>AI remains central, but controlled.</h2>
            <p>
              AI can support demand forecasting, reorder recommendations, expiry risk, wholesale opportunities,
              customer refill reminders, anomaly detection and report writing. Sensitive actions require human approval.
            </p>

            <div className="ai-rules">
              <span>Tenant boundary required</span>
              <span>Provider disabled until approved</span>
              <span>Audit logs required</span>
              <span>Human approval for risk</span>
            </div>
          </article>
        </section>

        <section className="review-panel">
          <div>
            <p className="eyebrow">Preview rule</p>
            <h2>Every meaningful UI change must be reviewable before production.</h2>
            <p>
              Review this dashboard at 360px, 430px, 768px, 1280px, 1440px and 1920px before approval.
            </p>
          </div>
          <button>Ready for review</button>
        </section>
      </section>
    </main>
  );
}

export default App;

const solutions = [
  {
    title: 'PharmaCo360',
    description: 'A complete pharmacy ecosystem platform for tenants, branches, inventory, POS, suppliers, wholesale, reporting, and AI insights.',
    status: 'First solution'
  },
  {
    title: 'ClinicCo360',
    description: 'A future clinic operations solution for patient flow, care coordination, pharmacy linkage, insurance, and clinic reporting.',
    status: 'Planned'
  },
  {
    title: 'VetCo360',
    description: 'A future veterinary health and supply chain solution for animal health businesses, clinics, products, and field operations.',
    status: 'Planned'
  }
];

const quickActions = [
  'Request a demo',
  'Explore PharmaCo360',
  'Tenant login',
  'Talk to Ubuzima+'
];

function App() {
  return (
    <main>
      <section className="topbar">
        <span>Ubuzima+ Platform</span>
        <span>Secure digital solutions for health, pharmacy, clinic, veterinary and business operations</span>
      </section>

      <header className="navbar">
        <div className="brand">
          <span className="brand-mark">U+</span>
          <div>
            <strong>Ubuzima+</strong>
            <small>Connected health business platform</small>
          </div>
        </div>

        <nav>
          <a href="#solutions">Solutions</a>
          <a href="#ai">AI Center</a>
          <a href="#security">Security</a>
          <a href="#tenants">Tenants</a>
          <a href="#contact">Contact</a>
        </nav>

        <button className="nav-button">Staff Login</button>
      </header>

      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Built for practical African health businesses</p>
          <h1>One platform for pharmacy, clinic, veterinary and enterprise health operations.</h1>
          <p className="subtitle">
            Ubuzima+ brings public websites, authenticated dashboards, tenant configuration, admin hierarchy,
            modular solutions, and AI-guided decisions into one secure operating platform.
          </p>

          <div className="hero-actions">
            <button>Start with PharmaCo360</button>
            <button className="secondary">View platform structure</button>
          </div>
        </div>

        <aside className="hero-card">
          <span>First tenant</span>
          <h2>VitaPharma</h2>
          <p>Using PharmaCo360 with dedicated tenant configuration, branch control, protected data, and controlled AI activation.</p>
          <div className="metric-grid">
            <div><strong>3</strong><small>Admin levels</small></div>
            <div><strong>360</strong><small>Business view</small></div>
            <div><strong>AI</strong><small>Governed center</small></div>
            <div><strong>RBAC</strong><small>Secure access</small></div>
          </div>
        </aside>
      </section>

      <section className="quick-actions">
        {quickActions.map((item) => (
          <article key={item}>
            <span>{item}</span>
            <strong>→</strong>
          </article>
        ))}
      </section>

      <section id="solutions" className="section">
        <div className="section-heading">
          <p className="eyebrow">Solutions</p>
          <h2>Modular solutions activated as the platform grows.</h2>
          <p>Each solution shares the Ubuzima+ foundation while keeping its own configuration, modules, data boundaries, and admin controls.</p>
        </div>

        <div className="cards">
          {solutions.map((solution) => (
            <article className="card" key={solution.title}>
              <span>{solution.status}</span>
              <h3>{solution.title}</h3>
              <p>{solution.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="ai" className="split-section">
        <div>
          <p className="eyebrow">Ubuzima AI Center</p>
          <h2>AI at the center, governed by people and protected by scope.</h2>
          <p>
            AI supports demand forecasting, reorder suggestions, expiry risk, wholesale opportunity insights,
            customer follow-up, finance forecasting, anomaly detection, report writing, and business questions.
          </p>
        </div>

        <div className="panel">
          <ul>
            <li>AI model registry</li>
            <li>AI provider control</li>
            <li>AI agents and prompts</li>
            <li>Human approval layer</li>
            <li>AI usage and cost tracking</li>
            <li>AI audit logs</li>
          </ul>
        </div>
      </section>

      <section id="security" className="section trust">
        <div className="section-heading">
          <p className="eyebrow">Trust, security and separation</p>
          <h2>Shared functionality. Separated data. Audited access.</h2>
        </div>

        <div className="cards four">
          <article className="card">
            <h3>Ubuzima+ Admin</h3>
            <p>Controls platform-wide settings, solutions, tenants, global AI, billing, security, and system health.</p>
          </article>
          <article className="card">
            <h3>Solution Admin</h3>
            <p>Controls solution-level rules, modules, templates, insights, and configuration for PharmaCo360.</p>
          </article>
          <article className="card">
            <h3>Tenant Admin</h3>
            <p>Controls VitaPharma users, branches, operations, tenant settings, and activated modules.</p>
          </article>
          <article className="card">
            <h3>Audit Layer</h3>
            <p>Tracks sensitive actions, configuration changes, AI decisions, access attempts, and support sessions.</p>
          </article>
        </div>
      </section>

      <section id="tenants" className="cta">
        <div>
          <p className="eyebrow">First deployment path</p>
          <h2>VitaPharma starts with PharmaCo360, then the platform expands module by module.</h2>
          <p>Core setup, users, branches, product master, inventory, POS, suppliers, reports, then controlled AI activation.</p>
        </div>
        <button>Prepare Tenant Setup</button>
      </section>

      <footer id="contact">
        <div>
          <strong>Ubuzima+</strong>
          <p>Digital solutions for health, pharmacy, veterinary, clinic and enterprise operations.</p>
        </div>
        <div>
          <strong>Solutions</strong>
          <a>PharmaCo360</a>
          <a>ClinicCo360</a>
          <a>VetCo360</a>
        </div>
        <div>
          <strong>Platform</strong>
          <a>AI Center</a>
          <a>Admin dashboard</a>
          <a>Tenant portal</a>
        </div>
        <div>
          <strong>Security</strong>
          <a>Tenant separation</a>
          <a>Audit logs</a>
          <a>Role permissions</a>
        </div>
      </footer>
    </main>
  );
}

export default App;

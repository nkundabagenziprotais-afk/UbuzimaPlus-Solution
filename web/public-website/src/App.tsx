import { useEffect } from 'react';

const brandLogoSrc = '/assets/ubuzima-logo.png';
const staffLoginUrl = import.meta.env.VITE_STAFF_LOGIN_URL?.trim() || 'http://127.0.0.1:5175/';
const staffLoginRedirectPaths = new Set(['/login', '/staff', '/staff-login']);

const quickActions = [
  {
    title: 'Request a demo',
    text: 'Book a practical walkthrough for your pharmacy or health business.',
    href: '#contact',
  },
  {
    title: 'Explore PharmaCo360',
    text: 'See how stock, sales, purchasing, finance, and reporting work together.',
    href: '#modules',
  },
  {
    title: 'Implementation path',
    text: 'Start with essentials, then activate advanced modules when ready.',
    href: '#onboarding',
  },
  {
    title: 'Staff login',
    text: 'Open the secure workspace for authorized Ubuzima+ users.',
    href: staffLoginUrl,
  },
];

const solutionLines = [
  {
    name: 'PharmaCo360',
    status: 'First solution',
    summary:
      'Retail and wholesale pharmacy operations across branches, inventory, POS, suppliers, finance, reporting, and governed AI.',
  },
  {
    name: 'ClinicCo360',
    status: 'Planned',
    summary:
      'Clinic operations, patient flow, pharmacy linkage, e-prescription readiness, insurance, and care coordination.',
  },
  {
    name: 'VetCo360',
    status: 'Planned',
    summary:
      'Veterinary clinic and animal health business operations with stock, services, field care, and customer follow-up.',
  },
  {
    name: 'Ubuzima ERP',
    status: 'Platform layer',
    summary:
      'Shared business administration, support, billing, reporting, partner management, and operational controls.',
  },
];

const pharmaModules = [
  ['Business setup', 'Profile, branches, licensing, operating hours, branding, tax, and payment settings.', 'Active foundation'],
  ['Users and roles', 'Tenant users, staff access, branch scope, permission-based navigation, and audit-ready identity.', 'Active foundation'],
  ['Product and drug master', 'Products, generics, brands, categories, dosage, strength, barcode, and regulatory flags.', 'Active foundation'],
  ['Inventory control', 'Batches, expiry, stock locations, stock movements, receiving, transfers, and reorder alerts.', 'Active foundation'],
  ['POS and dispensing', 'Sales cart, prescription checks, stock-safe dispensing, payments, receipts, returns, and daily close.', 'Active foundation'],
  ['Procurement and suppliers', 'Suppliers, purchase requests, purchase orders, goods received, supplier invoices, and payments.', 'Active foundation'],
  ['Reports and BI', 'Sales, stock valuation, credit exposure, payables, procurement, branch performance, and exports.', 'Active foundation'],
  ['Finance operations', 'Payables, receivables, settlement status, revenue visibility, stock value, and accounting exports.', 'Phase 2/3'],
  ['Customer engagement', 'Customer profiles, chronic refill reminders, feedback, loyalty, and safe follow-up workflows.', 'Phase 2'],
  ['Wholesale ecosystem', 'Bulk catalog, retail-to-wholesale ordering, price comparison, invoice reconciliation, and demand analytics.', 'Phase 2/3'],
  ['Delivery and dispatch', 'Delivery tasks, status tracking, proof of delivery, OTP confirmation, and failed-delivery reasons.', 'Phase 3'],
  ['Insurance and clinics', 'Insurance partners, claims, co-payments, clinic partners, e-prescription, and referral readiness.', 'Later'],
  ['Ubuzima AI Center', 'Demand, reorder, expiry, pricing, product gaps, customer retention, anomaly, and report-writing agents.', 'Controlled'],
  ['Mobile and PWA POS', 'Manager alerts, approvals, stock summaries, delivery tasks, barcode support, receipts, and installable POS.', 'Planned channels'],
];

const audiences = [
  ['Retail pharmacies', 'Run branch stock, sales, dispensing, patients, purchasing, reporting, and manager approvals.'],
  ['Wholesale pharmacies', 'Publish catalog, manage bulk orders, compare demand, support retailers, and track supplier performance.'],
  ['Clinics and prescribers', 'Prepare safe prescription flow, pharmacy linkage, insurance coordination, and referral visibility.'],
  ['Suppliers and partners', 'Improve purchase planning, availability, delivery performance, pricing, and reconciliation.'],
  ['Health business groups', 'Control multiple tenants, branches, packages, staff roles, finance visibility, and AI governance.'],
];

const platformChannels = [
  ['Public website', 'Company profile, solution pages, resources, demo request, partners, tenant website strategy.'],
  ['Admin dashboard', 'Role-based operations, configuration, reports, approval queues, support, security, and AI controls.'],
  ['Tenant portal', 'Tenant identity, branch setup, local users, package modules, data imports, and onboarding progress.'],
  ['Mobile app', 'Manager alerts, approvals, field tasks, delivery updates, stock alerts, and push notifications.'],
  ['Desktop/PWA POS', 'Installable counter experience with barcode, receipts, fast sales, and offline-ready direction.'],
];

const trustControls = [
  'Tenant data separation',
  'Role and branch scope',
  'Module activation rules',
  'Audit logs for sensitive actions',
  'Controlled support access',
  'Human approval for sensitive AI',
];

const roadmap = [
  ['1', 'Assess', 'Confirm branches, users, existing stock data, sales flow, purchasing, reporting, and priority pain points.'],
  ['2', 'Prepare', 'Configure business profile, roles, modules, products, suppliers, opening stock, payment, and tax settings.'],
  ['3', 'Train', 'Practice sales, dispensing, receiving, transfers, reporting, approvals, and manager review routines.'],
  ['4', 'Launch', 'Go live with monitored daily close, stock checks, support, issue tracking, and operational reports.'],
  ['5+', 'Grow', 'Activate customer engagement, wholesale, delivery, insurance, clinic workflows, and governed AI insights.'],
];

function App() {
  useEffect(() => {
    const normalizedPath = window.location.pathname.replace(/\/$/, '') || '/';

    if (staffLoginRedirectPaths.has(normalizedPath) && window.location.href !== staffLoginUrl) {
      window.location.replace(staffLoginUrl);
    }
  }, []);

  return (
    <main>
      <section className="utility-bar">
        <span>Ubuzima+ Digital Health Operations</span>
        <div>
          <a href="#audiences">Customers</a>
          <a href="#onboarding">Implementation</a>
          <a href="#security">Security</a>
          <a href={staffLoginUrl}>Staff login</a>
        </div>
      </section>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Ubuzima+ home">
          <img className="brand-logo" src={brandLogoSrc} alt="Ubuzima+" />
          <span className="brand-caption">Digital health operations</span>
        </a>

        <nav aria-label="Main navigation">
          <a href="#solutions">Solutions</a>
          <a href="#modules">PharmaCo360</a>
          <a href="#audiences">Customers</a>
          <a href="#platform">Platform</a>
          <a href="#security">Security</a>
        </nav>

        <a className="header-action" href="#contact">Request Demo</a>
      </header>

      <section id="top" className="hero">
        <div className="hero-content">
          <p className="eyebrow">Digital health business platform</p>
          <h1>Ubuzima+ digital health operations platform.</h1>
          <p className="hero-copy">
            Run pharmacy branches, stock, sales, dispensing, procurement, finance visibility, reporting,
            customer follow-up, and AI-assisted decisions from a secure modular platform.
          </p>

          <div className="hero-actions">
            <a className="primary-action" href="#contact">Request Demo</a>
            <a className="secondary-action" href="#modules">Explore PharmaCo360</a>
          </div>

          <dl className="hero-proof">
            <div>
              <dt>3</dt>
              <dd>Admin levels</dd>
            </div>
            <div>
              <dt>14</dt>
              <dd>Pharma modules</dd>
            </div>
            <div>
              <dt>360</dt>
              <dd>Role-based views</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="quick-actions" aria-label="Quick actions">
        {quickActions.map((action) => (
          <a key={action.title} href={action.href}>
            <span>{action.title}</span>
            <p>{action.text}</p>
          </a>
        ))}
      </section>

      <section id="solutions" className="section section-white">
        <div className="section-heading">
          <p className="eyebrow">Solution lines</p>
          <h2>One platform foundation, multiple health-sector solutions.</h2>
          <p>
            Ubuzima+ gives growing health businesses a clear path from daily operations to connected
            branch management, partner workflows, and controlled AI support.
          </p>
        </div>

        <div className="solution-grid">
          {solutionLines.map((solution) => (
            <article key={solution.name} className="solution-card">
              <span>{solution.status}</span>
              <h3>{solution.name}</h3>
              <p>{solution.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="modules" className="section section-soft">
        <div className="section-heading">
          <p className="eyebrow">PharmaCo360 module framework</p>
          <h2>A full pharmacy ecosystem, not only a POS.</h2>
          <p>
            Start with the pharmacy workflows you need today, then activate advanced modules by package,
            role, branch, readiness, and business policy.
          </p>
        </div>

        <div className="module-grid">
          {pharmaModules.map(([title, description, status]) => (
            <article key={title} className="module-card">
              <div>
                <h3>{title}</h3>
                <span>{status}</span>
              </div>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="audiences" className="section audience-section">
        <div className="section-heading">
          <p className="eyebrow">Who it serves</p>
          <h2>Routes for every commercial audience.</h2>
          <p>
            Whether you operate one pharmacy, manage branches, supply retailers, or coordinate care,
            Ubuzima+ keeps the work understandable and controlled.
          </p>
        </div>

        <div className="audience-grid">
          {audiences.map(([title, text]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="platform" className="section platform-section">
        <div className="section-heading inverse">
          <p className="eyebrow">Application channels</p>
          <h2>Public, admin, tenant, mobile, and desktop channels from one operating model.</h2>
          <p>
            Teams can work from the right channel for the task: management dashboard, tenant portal,
            counter POS, mobile approvals, or partner integrations.
          </p>
        </div>

        <div className="channel-list">
          {platformChannels.map(([title, text]) => (
            <article key={title}>
              <span>{title}</span>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="ai" className="section ai-section">
        <div className="ai-copy">
          <p className="eyebrow">Ubuzima AI Center</p>
          <h2>AI is central, but never uncontrolled.</h2>
          <p>
            AI recommendations should show the reason, confidence, data signals, risk level, and next action.
            Sensitive outputs move through human approval before they affect pharmacy operations.
          </p>
        </div>

        <div className="ai-grid">
          <article>
            <span>AI governance</span>
            <p>Provider approval, model registry, prompts, knowledge sources, usage controls, and risk policy.</p>
          </article>
          <article>
            <span>Pharma agents</span>
            <p>Demand forecasting, reorder, expiry risk, stock-out, supplier performance, pricing, and reports.</p>
          </article>
          <article>
            <span>Approval center</span>
            <p>Review reorder proposals, customer messages, permission suggestions, price changes, and risky actions.</p>
          </article>
        </div>
      </section>

      <section id="security" className="section section-white security-section">
        <div className="section-heading">
          <p className="eyebrow">Security and trust</p>
          <h2>Commercial viability depends on confidence, not decoration.</h2>
          <p>
            Ubuzima+ is designed around tenant separation, permissioned access, auditability, and
            controlled AI so health businesses can grow without losing operational control.
          </p>
        </div>

        <div className="trust-grid">
          {trustControls.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section id="onboarding" className="section pilot-section">
        <div>
          <p className="eyebrow">Implementation path</p>
          <h2>Go live in controlled, practical stages.</h2>
          <p>
            Begin with business setup, branches, users, products, stock, sales, suppliers, and reports.
            Add AI, wholesale, delivery, insurance, and clinic workflows when your team is ready.
          </p>
        </div>

        <div className="pilot-stack">
          <span>Business setup</span>
          <span>Product and stock import</span>
          <span>Sales and dispensing training</span>
          <span>Controlled AI activation</span>
        </div>
      </section>

      <section id="roadmap" className="section section-soft">
        <div className="section-heading">
          <p className="eyebrow">Roadmap</p>
          <h2>Progressive activation keeps the system simple and safe.</h2>
          <p>
            Ubuzima+ keeps the first experience simple while making the full growth path visible for
            pharmacy groups, partners, clinics, and connected health operations.
          </p>
        </div>

        <div className="roadmap">
          {roadmap.map(([phase, title, text]) => (
            <article key={phase}>
              <strong>{phase}</strong>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="contact-band">
        <div>
          <p className="eyebrow">Talk to Ubuzima+</p>
          <h2>Ready to simplify pharmacy and health business operations?</h2>
          <p>
            Share your branch structure, current workflows, and priority modules. The Ubuzima+ team can
            map the right implementation path for your organization.
          </p>
        </div>

        <a className="primary-action" href="mailto:info@ubuzimaplus.com">Contact Ubuzima+</a>
      </section>

      <footer>
        <div>
          <strong>Ubuzima+</strong>
          <p>Secure modular digital operations for health-sector businesses.</p>
        </div>
        <div>
          <strong>Solutions</strong>
          <a href="#modules">PharmaCo360</a>
          <a href="#solutions">ClinicCo360</a>
          <a href="#solutions">VetCo360</a>
        </div>
        <div>
          <strong>Platform</strong>
          <a href={staffLoginUrl}>Staff login</a>
          <a href="#platform">Tenant portal</a>
          <a href="#ai">AI Center</a>
        </div>
        <div>
          <strong>Trust</strong>
          <a href="#security">Tenant isolation</a>
          <a href="#security">Audit logs</a>
          <a href="#security">Data protection</a>
        </div>
      </footer>
    </main>
  );
}

export default App;

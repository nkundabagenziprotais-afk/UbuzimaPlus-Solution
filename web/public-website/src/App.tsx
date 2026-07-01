import { useEffect, useMemo, useState } from 'react';

const brandLogoSrc = '/assets/ubuzima-logo.png';
const staffLoginUrl = import.meta.env.VITE_STAFF_LOGIN_URL?.trim() || 'http://127.0.0.1:5175/';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000/api/v1';
const staffLoginRedirectPaths = new Set(['/login', '/staff', '/staff-login']);

type ManagedSection = {
  section_key: string;
  eyebrow: string | null;
  title: string | null;
  body: string | null;
  content: Record<string, unknown>;
  style: Record<string, unknown>;
};

type SiteSectionKey =
  | 'home'
  | 'about-mission'
  | 'about-vision'
  | 'about-team'
  | 'solutions'
  | 'pharmaco'
  | 'customers'
  | 'security'
  | 'contact';

const websiteMenu: Array<{
  label: string;
  children: Array<{ key: SiteSectionKey; label: string }>;
}> = [
  {
    label: 'About us',
    children: [
      { key: 'home', label: 'Overview' },
      { key: 'about-mission', label: 'Mission' },
      { key: 'about-vision', label: 'Vision' },
      { key: 'about-team', label: 'Our Team' },
    ],
  },
  {
    label: 'Solutions',
    children: [
      { key: 'solutions', label: 'Solution Portfolio' },
      { key: 'pharmaco', label: 'PharmaCo360' },
      { key: 'customers', label: 'Who We Serve' },
    ],
  },
  {
    label: 'Trust',
    children: [
      { key: 'security', label: 'Security' },
      { key: 'contact', label: 'Contact' },
    ],
  },
];

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
  const [managedSections, setManagedSections] = useState<Record<string, ManagedSection>>({});
  const [activeWebsiteSection, setActiveWebsiteSection] = useState<SiteSectionKey>('home');

  useEffect(() => {
    const normalizedPath = window.location.pathname.replace(/\/$/, '') || '/';

    if (staffLoginRedirectPaths.has(normalizedPath) && window.location.href !== staffLoginUrl) {
      window.location.replace(staffLoginUrl);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadManagedContent() {
      try {
        const response = await fetch(`${apiBaseUrl}/platform-content/public`, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) return;

        const data = await response.json();
        const home = data?.pages?.find((page: { slug: string }) => page.slug === 'home');
        const sections = Object.fromEntries(
          (home?.sections ?? []).map((section: ManagedSection) => [section.section_key, section]),
        );

        if (!cancelled) {
          setManagedSections(sections);
        }
      } catch {
        // Static content remains the fallback when the API is not available.
      }
    }

    void loadManagedContent();

    return () => {
      cancelled = true;
    };
  }, []);

  const heroSection = managedSections.hero;
  const solutionsSection = managedSections.solutions;
  const modulesSection = managedSections.pharmaco_modules;
  const securitySection = managedSections.security;
  const onboardingSection = managedSections.onboarding;

  const managedPriorityModules = useMemo(() => {
    const items = modulesSection?.content?.priority_modules;

    return Array.isArray(items) && items.every((item) => typeof item === 'string')
      ? items as string[]
      : [];
  }, [modulesSection]);

  function renderWebsiteSection() {
    switch (activeWebsiteSection) {
      case 'about-mission':
        return (
          <section className="website-focus-section">
            <p className="eyebrow">Mission</p>
            <h1>Make pharmacy and health business operations easier to run, safer to control, and clearer to grow.</h1>
            <p>
              Ubuzima+ helps health-sector teams move from paper, scattered spreadsheets, and disconnected tools
              into one practical operating platform built around real work: stock, sales, people, approvals, reports, and customer service.
            </p>
          </section>
        );
      case 'about-vision':
        return (
          <section className="website-focus-section">
            <p className="eyebrow">Vision</p>
            <h1>A connected health operations platform for businesses that serve people every day.</h1>
            <p>
              We are building Ubuzima+ so pharmacies, clinics, suppliers, and partners can coordinate work with confidence,
              protect customer data, and use AI only where it adds clear value and remains accountable.
            </p>
          </section>
        );
      case 'about-team':
        return (
          <section className="website-focus-section">
            <p className="eyebrow">Our Team</p>
            <h1>Built with operators, pharmacists, technologists, and implementation partners in mind.</h1>
            <p>
              Ubuzima+ is designed for teams that need a dependable daily system, not a complicated technology showcase.
              The platform focuses on practical onboarding, clean data, staff training, and continuous support.
            </p>
            <div className="website-mini-grid">
              <article><strong>Product</strong><span>Workflow design and module readiness.</span></article>
              <article><strong>Pharmacy</strong><span>Dispensing safety, inventory, and branch operations.</span></article>
              <article><strong>Support</strong><span>Tenant onboarding, training, and issue follow-up.</span></article>
            </div>
          </section>
        );
      case 'solutions':
        return (
          <section className="website-focus-section">
            <p className="eyebrow">{solutionsSection?.eyebrow ?? 'Solution portfolio'}</p>
            <h1>{solutionsSection?.title ?? 'One platform, focused solutions for health operations.'}</h1>
            <p>
              {solutionsSection?.body ??
                'Start with PharmaCo360 and grow into connected clinic, veterinary, partner, and ERP capabilities when the business is ready.'}
            </p>
            <div className="solution-grid compact-solution-grid">
              {solutionLines.map((solution) => (
                <article key={solution.name} className="solution-card">
                  <span>{solution.status}</span>
                  <h3>{solution.name}</h3>
                  <p>{solution.summary}</p>
                </article>
              ))}
            </div>
          </section>
        );
      case 'pharmaco':
        return (
          <section className="website-focus-section">
            <p className="eyebrow">{modulesSection?.eyebrow ?? 'PharmaCo360'}</p>
            <h1>{modulesSection?.title ?? 'Run pharmacy branches with fewer blind spots.'}</h1>
            <p>
              {modulesSection?.body ??
                'PharmaCo360 brings product master, inventory, POS, suppliers, finance visibility, reports, pharmacist chat, and governed AI into one pharmacy workspace.'}
            </p>
            {managedPriorityModules.length > 0 && (
              <div className="managed-priority-strip">
                {managedPriorityModules.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            )}
            <div className="website-module-list">
              {pharmaModules.slice(0, 8).map(([title, description, status]) => (
                <article key={title}>
                  <strong>{title}</strong>
                  <span>{status}</span>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </section>
        );
      case 'customers':
        return (
          <section className="website-focus-section">
            <p className="eyebrow">Who we serve</p>
            <h1>Built for teams who need daily clarity, not extra complexity.</h1>
            <div className="audience-grid compact-audience-grid">
              {audiences.map(([title, text]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </section>
        );
      case 'security':
        return (
          <section className="website-focus-section">
            <p className="eyebrow">{securitySection?.eyebrow ?? 'Security and trust'}</p>
            <h1>{securitySection?.title ?? 'Control matters as much as speed.'}</h1>
            <p>
              {securitySection?.body ??
                'Ubuzima+ is designed around tenant separation, staff permissions, audit logs, mandatory 2FA, and human approval for sensitive AI actions.'}
            </p>
            <div className="trust-grid">
              {trustControls.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>
        );
      case 'contact':
        return (
          <section className="website-focus-section contact-focus-section">
            <p className="eyebrow">Talk to Ubuzima+</p>
            <h1>Ready to prepare your first pharmacy or health business tenant?</h1>
            <p>
              Share your current branch setup, products, stock records, sales flow, and reporting needs.
              We will map a practical implementation path and keep the first rollout simple.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="mailto:info@ubuzimaplus.com">Email Ubuzima+</a>
              <a className="secondary-action" href={staffLoginUrl}>Staff login</a>
            </div>
          </section>
        );
      case 'home':
      default:
        return (
          <section className="website-focus-section website-hero-panel">
            <p className="eyebrow">{heroSection?.eyebrow ?? 'Digital health business platform'}</p>
            <h1>{heroSection?.title ?? 'Ubuzima+ helps health businesses run daily operations with confidence.'}</h1>
            <p>
              {heroSection?.body ??
                'Start with pharmacy operations: products, stock, sales, dispensing, suppliers, finance visibility, reporting, staff access, customer support, and governed AI.'}
            </p>
            <div className="hero-actions">
              <button className="primary-action" type="button" onClick={() => setActiveWebsiteSection('contact')}>Request Demo</button>
              <button className="secondary-action" type="button" onClick={() => setActiveWebsiteSection('pharmaco')}>Explore PharmaCo360</button>
            </div>
            <div className="quick-actions section-quick-actions" aria-label="Quick actions">
              {quickActions.map((action) => (
                <a key={action.title} href={action.href.startsWith('#') ? undefined : action.href} onClick={() => {
                  if (action.title === 'Explore PharmaCo360') setActiveWebsiteSection('pharmaco');
                  if (action.title === 'Implementation path') setActiveWebsiteSection('contact');
                  if (action.title === 'Request a demo') setActiveWebsiteSection('contact');
                }}>
                  <span>{action.title}</span>
                  <p>{action.text}</p>
                </a>
              ))}
            </div>
          </section>
        );
    }
  }

  return (
    <main className="website-app-shell">
      <aside className="website-tree-panel">
        <a className="brand" href="#top" aria-label="Ubuzima+ home" onClick={() => setActiveWebsiteSection('home')}>
          <img className="brand-logo" src={brandLogoSrc} alt="Ubuzima+" />
          <span className="brand-caption">Digital health operations</span>
        </a>

        <nav className="website-tree-nav" aria-label="Website sections">
          {websiteMenu.map((group) => (
            <section key={group.label}>
              <strong>{group.label}</strong>
              {group.children.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={activeWebsiteSection === item.key ? 'active' : ''}
                  onClick={() => setActiveWebsiteSection(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </section>
          ))}
        </nav>

        <a className="staff-login-card" href={staffLoginUrl}>
          <strong>Staff login</strong>
          <span>Open secure workspace</span>
        </a>
      </aside>

      <section className="website-content-panel">
        <header className="website-content-header">
          <span>Ubuzima+ Digital Health Operations</span>
          <div>
            <button type="button" onClick={() => setActiveWebsiteSection('contact')}>Request Demo</button>
            <a href={staffLoginUrl}>Staff Login</a>
          </div>
        </header>

        {renderWebsiteSection()}
      </section>
    </main>
  );

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
          <p className="eyebrow">{heroSection?.eyebrow ?? 'Digital health business platform'}</p>
          <h1>{heroSection?.title ?? 'Ubuzima+ digital health operations platform.'}</h1>
          <p className="hero-copy">
            {heroSection?.body ??
              'Run pharmacy branches, stock, sales, dispensing, procurement, finance visibility, reporting, customer follow-up, and AI-assisted decisions from a secure modular platform.'}
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
          <p className="eyebrow">{solutionsSection?.eyebrow ?? 'Solution lines'}</p>
          <h2>{solutionsSection?.title ?? 'One platform foundation, multiple health-sector solutions.'}</h2>
          <p>
            {solutionsSection?.body ??
              'Ubuzima+ gives growing health businesses a clear path from daily operations to connected branch management, partner workflows, and controlled AI support.'}
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
          <p className="eyebrow">{modulesSection?.eyebrow ?? 'PharmaCo360 module framework'}</p>
          <h2>{modulesSection?.title ?? 'A full pharmacy ecosystem, not only a POS.'}</h2>
          <p>
            {modulesSection?.body ??
              'Start with the pharmacy workflows you need today, then activate advanced modules by package, role, branch, readiness, and business policy.'}
          </p>
        </div>

        {managedPriorityModules.length > 0 && (
          <div className="managed-priority-strip">
            {managedPriorityModules.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        )}

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
          <p className="eyebrow">{securitySection?.eyebrow ?? 'Security and trust'}</p>
          <h2>{securitySection?.title ?? 'Commercial viability depends on confidence, not decoration.'}</h2>
          <p>
            {securitySection?.body ??
              'Ubuzima+ is designed around tenant separation, permissioned access, auditability, and controlled AI so health businesses can grow without losing operational control.'}
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
          <p className="eyebrow">{onboardingSection?.eyebrow ?? 'Implementation path'}</p>
          <h2>{onboardingSection?.title ?? 'Go live in controlled, practical stages.'}</h2>
          <p>
            {onboardingSection?.body ??
              'Begin with business setup, branches, users, products, stock, sales, suppliers, and reports. Add AI, wholesale, delivery, insurance, and clinic workflows when your team is ready.'}
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

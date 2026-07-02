import { useEffect, useMemo, useState } from 'react';
import { applyRuntimeLanguage } from './runtimeI18n';

const brandLogoSrc = '/assets/ubuzima-logo.png';
const vitaPharmaLogoSrc = '/assets/vitapharma-logo.png';
const staffLoginUrl = import.meta.env.VITE_STAFF_LOGIN_URL?.trim() || 'http://127.0.0.1:5175/';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000/api/v1';
const staffLoginRedirectPaths = new Set(['/login', '/staff', '/staff-login']);
const languageStorageKey = 'ubuzima_public_language';

type LanguageCode = 'en' | 'fr' | 'pt';

const languageOptions: Array<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Francais' },
  { code: 'pt', label: 'Portugues' },
];

const localizedLabels: Record<LanguageCode, {
  requestDemo: string;
  staffLogin: string;
  language: string;
  contact: string;
}> = {
  en: {
    requestDemo: 'Request Demo',
    staffLogin: 'Staff Login',
    language: 'Language',
    contact: 'Contact',
  },
  fr: {
    requestDemo: 'Demander une demo',
    staffLogin: 'Connexion equipe',
    language: 'Langue',
    contact: 'Contact',
  },
  pt: {
    requestDemo: 'Solicitar demo',
    staffLogin: 'Entrar equipa',
    language: 'Idioma',
    contact: 'Contacto',
  },
};

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

const trustControls = [
  'Tenant data separation',
  'Role and branch scope',
  'Module activation rules',
  'Audit logs for sensitive actions',
  'Controlled support access',
  'Human approval for sensitive AI',
];

type VitaSectionKey =
  | 'home'
  | 'products'
  | 'pharmacy-care'
  | 'ncd-care'
  | 'nutrition'
  | 'baby-care'
  | 'cosmetics'
  | 'contact';

const vitaSections: Array<{ key: VitaSectionKey; label: string }> = [
  { key: 'home', label: 'Overview' },
  { key: 'products', label: 'Products' },
  { key: 'pharmacy-care', label: 'Pharmacy Care' },
  { key: 'ncd-care', label: 'NCD Care' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'baby-care', label: 'Baby Care' },
  { key: 'cosmetics', label: 'Cosmetics' },
  { key: 'contact', label: 'Contact' },
];

const vitaServices = [
  ['Prescription medicines', 'Dispensing support, refill assistance, medicine-use guidance, and prescription safety checks.'],
  ['OTC and family health', 'Everyday medicines, first aid, hygiene, pain relief, cough and cold care, and home health essentials.'],
  ['Cosmetics and personal care', 'Skin care, beauty, hygiene, hair care, oral care, and pharmacist-guided product selection.'],
  ['Nutrition and supplements', 'Vitamins, minerals, wellness nutrition, dietary support, and supplement suitability guidance.'],
  ['NCD care and advisory', 'Support for chronic routines including hypertension, diabetes, asthma, adherence, and monitoring essentials.'],
  ['Baby care products', 'Mother and baby essentials, infant hygiene, feeding accessories, baby skin care, and family guidance.'],
];

const vitaCarePrinciples = [
  'Clear medicine information',
  'Respectful pharmacist support',
  'Reliable product availability',
  'Safe customer data handling',
  'Simple family health guidance',
  'Connected digital follow-up',
];

const vitaCustomerCategories = [
  ['Pharmaceutical Drugs', 'Prescription and non-prescription medicines handled with professional pharmacy care.'],
  ['Cosmetics', 'Beauty, skin, hair, hygiene, and personal-care products selected with safety in mind.'],
  ['Nutrition', 'Vitamins, supplements, wellness nutrition, and practical dietary support.'],
  ['NCD Care', 'Advisory support for chronic-care routines, refill planning, and monitoring essentials.'],
  ['Baby Care', 'Mother and baby products, infant hygiene, feeding accessories, and gentle care essentials.'],
  ['Advisory', 'Clear pharmacist guidance before, during, and after purchase.'],
];

const vitaProductCollections = [
  ['Pharmaceutical Drugs', 'Prescription medicines, OTC care, pain relief, antibiotics by prescription, cough and cold, digestive care, allergy care, and first aid.'],
  ['Cosmetics and Personal Care', 'Skin care, sun care, hair care, oral care, hygiene, beauty essentials, and sensitive-skin product guidance.'],
  ['Nutrition and Wellness', 'Supplements, vitamins, minerals, immune support, sports nutrition, weight-management support, and healthy routine advice.'],
  ['NCD Care and Advisory', 'Diabetes, hypertension, asthma, cholesterol, adherence reminders, refill planning, monitoring devices, and lifestyle guidance.'],
  ['Baby and Mother Care', 'Baby hygiene, diapers, feeding accessories, infant skin care, maternity essentials, and family wellness products.'],
  ['Diagnostics and Devices', 'Glucometers, BP monitors, thermometers, test strips, nebulizer support, and home-care devices.'],
];

const vitaNcdServices = [
  ['Blood pressure support', 'Monitoring essentials, refill reminders, and practical adherence guidance.'],
  ['Diabetes care', 'Glucometer support, test strips, lifestyle advice, and medicine routine support.'],
  ['Asthma and respiratory care', 'Inhaler support, nebulizer accessories, and correct-use guidance.'],
  ['Chronic refill planning', 'Customer history, refill follow-up, and pharmacist-led advisory conversations.'],
];

function readStoredLanguage(): LanguageCode {
  const stored = localStorage.getItem(languageStorageKey);
  return stored === 'fr' || stored === 'pt' || stored === 'en' ? stored : 'en';
}

function LanguageSelector({
  value,
  onChange,
}: {
  value: LanguageCode;
  onChange: (language: LanguageCode) => void;
}) {
  return (
    <label className="language-selector">
      <span>{localizedLabels[value].language}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as LanguageCode)}>
        {languageOptions.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function VitaPharmaWebsite({
  language,
  onLanguageChange,
}: {
  language: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
}) {
  const [activeSection, setActiveSection] = useState<VitaSectionKey>('home');
  const labels = localizedLabels[language];

  function renderSection() {
    switch (activeSection) {
      case 'products':
        return (
          <section className="vita-focus-section">
            <p className="eyebrow">Products</p>
            <h1>Everything customers expect from a modern retail pharmacy, organized clearly.</h1>
            <p>
              VitaPharma serves everyday medicine needs, family care, personal care, nutrition, chronic-care support,
              and pharmacist-guided product selection through one connected retail pharmacy experience.
            </p>
            <div className="vita-service-grid">
              {vitaProductCollections.map(([title, text]) => (
                <article key={title}>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </section>
        );
      case 'pharmacy-care':
        return (
          <section className="vita-focus-section">
            <p className="eyebrow">Pharmacy care</p>
            <h1>Designed for customers who need clarity before they buy.</h1>
            <p>
              Customers should be able to ask practical medicine questions, understand product options,
              and receive respectful support without feeling rushed or overloaded with technical wording.
            </p>
            <div className="trust-grid vita-care-grid">
              {vitaCarePrinciples.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>
        );
      case 'ncd-care':
        return (
          <section className="vita-focus-section">
            <p className="eyebrow">NCD care and advisory</p>
            <h1>Practical support for customers managing long-term health routines.</h1>
            <p>
              Customers managing hypertension, diabetes, asthma, cholesterol, and other chronic needs should find
              respectful guidance, consistent refill support, and the right monitoring essentials.
            </p>
            <div className="vita-service-grid vita-ncd-grid">
              {vitaNcdServices.map(([title, text]) => (
                <article key={title}>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </section>
        );
      case 'nutrition':
        return (
          <section className="vita-focus-section">
            <p className="eyebrow">Nutrition</p>
            <h1>Supplements and nutrition support selected with care.</h1>
            <p>
              VitaPharma helps customers choose vitamins, minerals, wellness nutrition, immune support,
              and dietary products with practical guidance on suitability, safe use, and consistency.
            </p>
            <div className="managed-priority-strip vita-priority-strip">
              {['Vitamins', 'Minerals', 'Immune support', 'Wellness nutrition', 'Dietary guidance', 'Supplement safety'].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>
        );
      case 'baby-care':
        return (
          <section className="vita-focus-section">
            <p className="eyebrow">Baby care products</p>
            <h1>Gentle essentials for babies, mothers, and families.</h1>
            <p>
              From baby hygiene and skin care to feeding accessories and mother-care essentials, VitaPharma keeps
              family shopping simple while giving parents access to respectful pharmacist support.
            </p>
            <div className="vita-category-grid vita-family-grid">
              {['Baby hygiene', 'Feeding accessories', 'Infant skin care', 'Mother care', 'Family first aid', 'Gentle wellness'].map((item) => (
                <article key={item}>
                  <strong>{item}</strong>
                  <span>Curated for safe, practical family care.</span>
                </article>
              ))}
            </div>
          </section>
        );
      case 'cosmetics':
        return (
          <section className="vita-focus-section">
            <p className="eyebrow">Cosmetics and personal care</p>
            <h1>Beauty and personal care with pharmacy-level attention.</h1>
            <p>
              Customers can shop skin care, hair care, oral care, hygiene, and beauty essentials with product guidance
              that considers sensitivity, safe use, and everyday confidence.
            </p>
            <div className="vita-category-grid vita-family-grid">
              {['Skin care', 'Hair care', 'Oral care', 'Hygiene', 'Beauty essentials', 'Sensitive-skin support'].map((item) => (
                <article key={item}>
                  <strong>{item}</strong>
                  <span>Selected for daily care and customer confidence.</span>
                </article>
              ))}
            </div>
          </section>
        );
      case 'contact':
        return (
          <section className="vita-focus-section contact-focus-section">
            <p className="eyebrow">{labels.contact}</p>
            <h1>Talk to VitaPharma for pharmacy support and product availability.</h1>
            <p>
              Ask about product availability, prescription support, nutrition, cosmetics, baby care, or chronic-care
              advisory. The customer chat and nearby-provider flow are ready to connect when live details are confirmed.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="mailto:care@vitapharmaafrica.com">care@vitapharmaafrica.com</a>
              <a className="secondary-action" href={staffLoginUrl}>{labels.staffLogin}</a>
            </div>
          </section>
        );
      case 'home':
      default:
        return (
          <section className="vita-focus-section vita-hero-section">
            <p className="eyebrow">VitaPharma Africa</p>
            <h1>Retail pharmacy care for medicines, cosmetics, nutrition, NCD support, and baby products.</h1>
            <p>
              VitaPharma brings practical pharmacy service closer to customers: pharmaceutical drugs, personal care,
              nutrition and supplements, chronic-care advisory, baby care products, and clear pharmacist guidance.
            </p>
            <div className="hero-actions">
              <button className="primary-action" type="button" onClick={() => setActiveSection('products')}>
                Explore products
              </button>
              <button className="secondary-action" type="button" onClick={() => setActiveSection('contact')}>
                {labels.contact}
              </button>
            </div>
            <div className="vita-hero-brand-card">
              <img src={vitaPharmaLogoSrc} alt="VitaPharma" />
              <div>
                <strong>Retail pharmacy and advisory care</strong>
                <span>Medicines, cosmetics, nutrition, NCD support, and baby care products.</span>
              </div>
            </div>
            <div className="vita-hero-assurance" aria-label="VitaPharma service highlights">
              {['Pharmacist guidance', 'Prescription support', 'NCD advisory', 'Family essentials'].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="vita-category-grid">
              {vitaCustomerCategories.map(([title, text]) => (
                <article key={title}>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </article>
              ))}
            </div>
          </section>
        );
    }
  }

  return (
    <main className="vita-website-shell website-top-shell">
      <header className="website-top-header vita-top-header">
        <a className="brand vita-brand" href="#top" aria-label="VitaPharma home" onClick={() => setActiveSection('home')}>
          <img className="brand-logo vita-logo" src={vitaPharmaLogoSrc} alt="VitaPharma" />
          <span className="brand-caption">Powered by Ubuzima+</span>
        </a>

        <nav className="website-top-nav vita-top-nav" aria-label="VitaPharma website sections">
          {vitaSections.map((section) => (
            <button
              key={section.key}
              type="button"
              className={activeSection === section.key ? 'active' : ''}
              onClick={() => setActiveSection(section.key)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="website-top-actions">
          <LanguageSelector value={language} onChange={onLanguageChange} />
          <button type="button" onClick={() => setActiveSection('contact')}>{labels.contact}</button>
          <a href={staffLoginUrl}>{labels.staffLogin}</a>
        </div>
      </header>

      <section className="website-content-panel vita-content-panel">
        {renderSection()}
      </section>
    </main>
  );
}

function App() {
  const [managedSections, setManagedSections] = useState<Record<string, ManagedSection>>({});
  const [activeWebsiteSection, setActiveWebsiteSection] = useState<SiteSectionKey>('home');
  const [language, setLanguage] = useState<LanguageCode>(readStoredLanguage);
  const isVitaPharmaSite =
    window.location.hostname.includes('vitapharmaafrica.com') ||
    window.location.pathname.toLowerCase().startsWith('/vitapharma');

  useEffect(() => {
    localStorage.setItem(languageStorageKey, language);
  }, [language]);

  useEffect(() => {
    let frame = 0;
    const applyLanguage = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => applyRuntimeLanguage(language));
    };

    applyLanguage();

    const observer = new MutationObserver(applyLanguage);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [language]);

  useEffect(() => {
    if (localStorage.getItem(languageStorageKey)) {
      return;
    }

    let cancelled = false;

    async function loadLocalizationContext() {
      try {
        const response = await fetch(`${apiBaseUrl}/localization/context`, {
          headers: { Accept: 'application/json' },
        });
        const data = await response.json();
        const detected = data?.selected_language;

        if (!cancelled && (detected === 'en' || detected === 'fr' || detected === 'pt')) {
          setLanguage(detected);
        }
      } catch {
        // English remains the default when localization context is unavailable.
      }
    }

    void loadLocalizationContext();

    return () => {
      cancelled = true;
    };
  }, []);

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
  const managedPriorityModules = useMemo(() => {
    const items = modulesSection?.content?.priority_modules;

    return Array.isArray(items) && items.every((item) => typeof item === 'string')
      ? items as string[]
      : [];
  }, [modulesSection]);

  if (isVitaPharmaSite) {
    return (
      <VitaPharmaWebsite
        language={language}
        onLanguageChange={setLanguage}
      />
    );
  }

  const labels = localizedLabels[language];

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
    <main className="website-app-shell website-top-shell">
      <header className="website-top-header">
        <a className="brand" href="#top" aria-label="Ubuzima+ home" onClick={() => setActiveWebsiteSection('home')}>
          <img className="brand-logo" src={brandLogoSrc} alt="Ubuzima+" />
          <span className="brand-caption">Digital health operations</span>
        </a>

        <nav className="website-top-nav" aria-label="Website sections">
          {websiteMenu.map((group) => (
            <div key={group.label} className="website-top-group">
              <button type="button">{group.label}</button>
              <div className="website-top-dropdown">
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
              </div>
            </div>
          ))}
        </nav>

        <div className="website-top-actions">
          <LanguageSelector value={language} onChange={setLanguage} />
          <button type="button" onClick={() => setActiveWebsiteSection('contact')}>{labels.requestDemo}</button>
          <a href={staffLoginUrl}>{labels.staffLogin}</a>
        </div>
      </header>

      <section className="website-content-panel">
        {renderWebsiteSection()}
      </section>
    </main>
  );
}

export default App;

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getPharmaFinancePosRevenueShadowReport,
  getPharmaFinancePosShadowReconciliationReport,
  getPharmaFinanceReadinessHealthReport,
  getPharmaTaxRegistryEditions,
  getPharmaTaxRegistrySummary,
  searchPharmaTaxRegistry,
} from '../lib/api';

type Props = {
  token: string;
  profile: any;
};

type FinanceTab =
  | 'overview'
  | 'profit-loss'
  | 'cash-flow'
  | 'receivables'
  | 'payables'
  | 'banking'
  | 'tax-registry'
  | 'reports';

function tenantSlugFromProfile(profile: any): string {
  return (
    profile?.tenant_assignments?.[0]?.tenant?.slug
    || profile?.tenant?.slug
    || profile?.scope?.tenant_slug
    || 'vitapharma'
  );
}

function isoDate(daysBack = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

function numberValue(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function money(value: unknown): string {
  return new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function readable(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'Passed' : 'Failed';
  }

  return String(value ?? 'pending')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(value: unknown): string {
  if (
    value === true
    || value === 'ready'
    || value === 'passed'
    || value === 'ready_for_staged_switch'
    || value === 'reconciled'
  ) {
    return 'success';
  }

  if (
    value === false
    || value === 'failed'
    || value === 'not_ready'
    || value === 'unreconciled'
  ) {
    return 'danger';
  }

  if (value === 'shadow' || value === 'shadow_mode') {
    return 'info';
  }

  return 'warning';
}

function StatusBadge({ value }: { value: unknown }) {
  return (
    <span className={`finance-inclusive-status finance-inclusive-status--${statusTone(value)}`}>
      {readable(value)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = 'neutral',
  icon,
  meta,
}: {
  label: string;
  value: string;
  helper: string;
  tone?: string;
  icon: string;
  meta?: string;
}) {
  return (
    <article className={`finance-inclusive-card finance-inclusive-card--${tone}`}>
      <div className="finance-inclusive-card__top">
        <span className="finance-inclusive-card__icon">{icon}</span>
        {meta && <small>{meta}</small>}
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}

function ProfessionalBars({
  title,
  subtitle,
  primary,
  secondary,
}: {
  title: string;
  subtitle: string;
  primary: number;
  secondary: number;
}) {
  const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
  const values = months.map((month, index) => {
    const factor = 0.58 + index * 0.085;
    return {
      month,
      primary: Math.max(1, primary * factor),
      secondary: Math.max(1, secondary * Math.max(0.18, factor - 0.16)),
    };
  });
  const max = Math.max(...values.flatMap((item) => [item.primary, item.secondary]), 1);

  return (
    <article className="finance-inclusive-panel finance-inclusive-panel--chart">
      <header>
        <div>
          <h3>{title}</h3>
          <small>{subtitle}</small>
        </div>
        <span>6M</span>
      </header>

      <div className="finance-inclusive-chart">
        {values.map((item) => (
          <div key={item.month}>
            <i style={{ height: `${Math.max(7, (item.primary / max) * 100)}%` }} />
            <b style={{ height: `${Math.max(7, (item.secondary / max) * 100)}%` }} />
            <small>{item.month}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

export function FinanceSourceOfTruthOverview({ token, profile }: Props) {
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [from, setFrom] = useState(() => isoDate(30));
  const [to, setTo] = useState(() => isoDate(0));
  const [branchId, setBranchId] = useState('');
  const [health, setHealth] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [registrySummary, setRegistrySummary] = useState<any>(null);
  const [registryEditions, setRegistryEditions] = useState<any[]>([]);
  const [registryCandidates, setRegistryCandidates] = useState<any[]>([]);
  const [registryQuery, setRegistryQuery] = useState('');
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registrySearchLoading, setRegistrySearchLoading] = useState(false);
  const [registryError, setRegistryError] = useState('');
  const [registrySearchNotice, setRegistrySearchNotice] = useState('');
  const [loadedAt, setLoadedAt] = useState('');

  const tenantSlug = tenantSlugFromProfile(profile);

  async function loadDashboard() {
    setIsLoading(true);
    setError('');

    try {
      const filters = {
        from,
        to,
        ...(branchId ? { branch_id: branchId } : {}),
      };

      const [healthResponse, paymentResponse, revenueResponse] = await Promise.all([
        getPharmaFinanceReadinessHealthReport(token, tenantSlug, filters),
        getPharmaFinancePosShadowReconciliationReport(token, tenantSlug, filters),
        getPharmaFinancePosRevenueShadowReport(token, tenantSlug, filters),
      ]);

      setHealth(healthResponse.data);
      setPayments(paymentResponse.data);
      setRevenue(revenueResponse.data);
      setLoadedAt(new Date().toLocaleTimeString('en-RW', { hour: '2-digit', minute: '2-digit' }));
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : 'Unable to load Finance dashboard reports.',
      );
    } finally {
      setIsLoading(false);
    }
  }


  async function loadTaxRegistryOverview() {
    if (!tenantSlug) {
      setRegistrySummary(null);
      setRegistryEditions([]);
      setRegistryError(
        'No tenant assignment is available for the tax registry review desk.',
      );
      return;
    }

    setRegistryLoading(true);
    setRegistryError('');

    try {
      const [summaryResponse, editionsResponse] = await Promise.all([
        getPharmaTaxRegistrySummary(
          token,
          tenantSlug,
          { as_of: to },
        ),
        getPharmaTaxRegistryEditions(
          token,
          tenantSlug,
          { limit: 12 },
        ),
      ]);

      setRegistrySummary(summaryResponse.data);
      setRegistryEditions(
        Array.isArray(editionsResponse.data)
          ? editionsResponse.data
          : [],
      );
    } catch (exception) {
      setRegistryError(
        exception instanceof Error
          ? exception.message
          : 'Unable to load the RRA registry review desk.',
      );
    } finally {
      setRegistryLoading(false);
    }
  }

  async function handleRegistrySearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const query = registryQuery.trim();

    if (!query) {
      setRegistryError(
        'Enter an official, generic or registered medicine name.',
      );
      setRegistrySearchNotice('');
      return;
    }

    if (!tenantSlug) {
      setRegistryError(
        'No tenant assignment is available for registry search.',
      );
      return;
    }

    setRegistrySearchLoading(true);
    setRegistryError('');
    setRegistrySearchNotice('');

    try {
      const response = await searchPharmaTaxRegistry(
        token,
        tenantSlug,
        {
          query,
          as_of: to,
          limit: 20,
        },
      );

      const candidates = Array.isArray(
        response.data?.candidates,
      )
        ? response.data.candidates
        : [];

      setRegistryCandidates(candidates);
      setRegistrySearchNotice(
        candidates.length === 0
          ? 'No approved and effective registry candidate matched this search.'
          : `${candidates.length} review candidate${candidates.length === 1 ? '' : 's'} found.`,
      );
    } catch (exception) {
      setRegistryCandidates([]);
      setRegistryError(
        exception instanceof Error
          ? exception.message
          : 'Unable to search the RRA registry.',
      );
    } finally {
      setRegistrySearchLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadTaxRegistryOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paymentSummary = payments?.summary ?? {};
  const revenueSummary = revenue?.summary ?? {};
  const paymentMethods = payments?.payment_methods ?? [];

  const totalRevenue = numberValue(
    revenueSummary.finance_shadow_revenue
    ?? revenueSummary.pos_revenue_total
    ?? revenueSummary.pos_sales_revenue_total
    ?? 0,
  );

  const taxShadow = numberValue(
    revenueSummary.finance_shadow_tax
    ?? revenueSummary.pos_tax_total
    ?? 0,
  );

  const completedPayments = numberValue(
    paymentSummary.pos_completed_payments_total
    ?? paymentSummary.finance_shadow_payment_total
    ?? 0,
  );

  const financePayments = numberValue(paymentSummary.finance_shadow_payment_total);
  const paymentDifference = numberValue(paymentSummary.difference);
  const revenueDifference = numberValue(revenueSummary.revenue_difference);
  const taxDifference = numberValue(revenueSummary.tax_difference);

  const cashTotal = numberValue(
    paymentMethods.find((item: any) => item.payment_method === 'cash')?.finance_shadow_total,
  );
  const momoTotal = numberValue(
    paymentMethods.find((item: any) => item.payment_method === 'momo')?.finance_shadow_total,
  );
  const cardTotal = numberValue(
    paymentMethods.find((item: any) => item.payment_method === 'card')?.finance_shadow_total,
  );

  const grossProfit = Math.max(totalRevenue - taxShadow, 0);
  const availableFinancialSignal = Math.max(totalRevenue, completedPayments, financePayments);
  const expenseSignal = taxShadow;
  const isReconciled = Boolean(paymentSummary.is_reconciled);

  const readinessChecks = useMemo(
    () => Object.entries(health?.checks ?? {}) as Array<[string, any]>,
    [health],
  );

  const tabs: Array<[FinanceTab, string]> = [
    ['overview', 'Overview'],
    ['profit-loss', 'Profit & Loss'],
    ['cash-flow', 'Cash Flow'],
    ['receivables', 'Receivables'],
    ['payables', 'Payables'],
    ['banking', 'Banking'],
    ['tax-registry', 'Tax Registry'],
    ['reports', 'Reports'],
  ];

  const cards = [
    {
      label: 'Total Revenue',
      value: `RWF ${money(totalRevenue)}`,
      helper: 'POS revenue shadow validated by Finance',
      tone: totalRevenue > 0 ? 'success' : 'warning',
      icon: '↗',
      meta: totalRevenue > 0 ? 'Live' : 'No period data',
    },
    {
      label: 'Completed Payments',
      value: `RWF ${money(completedPayments)}`,
      helper: 'Operational POS payment total',
      tone: completedPayments > 0 ? 'info' : 'warning',
      icon: '◉',
      meta: 'POS',
    },
    {
      label: 'Finance Shadow Payments',
      value: `RWF ${money(financePayments)}`,
      helper: 'Finance-side shadow payment total',
      tone: financePayments > 0 ? 'success' : 'warning',
      icon: '◆',
      meta: isReconciled ? 'Reconciled' : 'Review',
    },
    {
      label: 'Gross Profit Signal',
      value: `RWF ${money(grossProfit)}`,
      helper: 'Revenue less tax shadow',
      tone: grossProfit > 0 ? 'success' : 'neutral',
      icon: '▰',
      meta: 'Interim',
    },
    {
      label: 'Cash',
      value: `RWF ${money(cashTotal)}`,
      helper: 'Cash payment method shadow',
      tone: cashTotal > 0 ? 'info' : 'neutral',
      icon: '₣',
      meta: 'Cash',
    },
    {
      label: 'Mobile Money',
      value: `RWF ${money(momoTotal)}`,
      helper: 'MoMo payment method shadow',
      tone: momoTotal > 0 ? 'info' : 'neutral',
      icon: 'M',
      meta: 'MoMo',
    },
    {
      label: 'Card',
      value: `RWF ${money(cardTotal)}`,
      helper: 'Card payment method shadow',
      tone: cardTotal > 0 ? 'info' : 'neutral',
      icon: '▣',
      meta: 'Card',
    },
    {
      label: 'Exception Difference',
      value: `RWF ${money(paymentDifference + revenueDifference + taxDifference)}`,
      helper: 'Payment, revenue and tax variance',
      tone: paymentDifference + revenueDifference + taxDifference === 0 ? 'success' : 'danger',
      icon: '!',
      meta: paymentDifference + revenueDifference + taxDifference === 0 ? 'Clean' : 'Action',
    },
  ];

  return (
    <section className="finance-inclusive-page">
      <header className="finance-inclusive-hero">
        <div>
          <span>Finance source of truth</span>
          <h2>Inclusive Finance Dashboard</h2>
          <p>
            One operational dashboard for revenue, payments, reconciliation, cash movement,
            readiness health, and Finance-controlled source data.
          </p>
        </div>

        <div className="finance-inclusive-hero__status">
          <small>Readiness</small>
          <StatusBadge value={health?.overall_status ?? 'pending'} />
          <small>Switch status</small>
          <StatusBadge value={health?.dashboard_switch_status ?? 'not_ready'} />
        </div>
      </header>

      <section
        className="finance-inclusive-operating-strip"
        aria-label="Finance control status"
      >
        <article>
          <small>Operating mode</small>
          <strong>Finance shadow</strong>
          <span>No ledger or POS cutover</span>
        </article>
        <article>
          <small>Tax registry</small>
          <strong>Read-only evidence</strong>
          <span>Approved and effective editions only</span>
        </article>
        <article>
          <small>Decision authority</small>
          <strong>Human review</strong>
          <span>No category or search result grants exemption</span>
        </article>
      </section>

      <section className="finance-inclusive-toolbar">
        <label>
          <span>Date From</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          <span>Date To</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <label>
          <span>Branch</span>
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">All Branches</option>
          </select>
        </label>
        <button type="button" onClick={() => void loadDashboard()} disabled={isLoading}>
          {isLoading ? 'Refreshing…' : 'Refresh Dashboard'}
        </button>
      </section>

      <nav className="finance-inclusive-tabs" aria-label="Finance dashboard sections">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={activeTab === key ? 'active' : ''}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="finance-inclusive-sync">
        <span>Last updated: {loadedAt || 'Awaiting refresh'}</span>
        <span>Period: {from} → {to}</span>
        <span>Tenant: {tenantSlug}</span>
      </div>

      {error && <div className="form-error">{error}</div>}

      {activeTab === 'overview' ? (
        <>
          <section className="finance-inclusive-card-grid">
            {cards.map((card) => (
              <MetricCard key={card.label} {...card} />
            ))}
          </section>

          <section className="finance-inclusive-main-grid">
            <ProfessionalBars
              title="Revenue vs Finance Signal"
              subtitle="Revenue shadow compared with tax and exception signal"
              primary={availableFinancialSignal}
              secondary={expenseSignal}
            />

            <ProfessionalBars
              title="Cash Flow Signal"
              subtitle="Payments received versus Finance shadow movement"
              primary={completedPayments}
              secondary={Math.abs(paymentDifference)}
            />

            <article className="finance-inclusive-panel">
              <header>
                <div>
                  <h3>Profit & Loss Summary</h3>
                  <small>Available Finance source data</small>
                </div>
              </header>
              <dl className="finance-inclusive-summary">
                <div><dt>Total Revenue</dt><dd>RWF {money(totalRevenue)}</dd></div>
                <div><dt>Tax Shadow</dt><dd>RWF {money(taxShadow)}</dd></div>
                <div><dt>Gross Profit Signal</dt><dd>RWF {money(grossProfit)}</dd></div>
                <div><dt>Completed Payments</dt><dd>RWF {money(completedPayments)}</dd></div>
                <div><dt>Finance Shadow Payments</dt><dd>RWF {money(financePayments)}</dd></div>
                <div><dt>Payment Difference</dt><dd>RWF {money(paymentDifference)}</dd></div>
              </dl>
            </article>

            <article className="finance-inclusive-panel">
              <header>
                <div>
                  <h3>Payment Method Mix</h3>
                  <small>Source: Finance POS shadow reconciliation</small>
                </div>
              </header>
              <div className="finance-inclusive-methods">
                {paymentMethods.map((item: any) => (
                  <div key={item.payment_method}>
                    <span>{readable(item.payment_method)}</span>
                    <strong>RWF {money(item.finance_shadow_total)}</strong>
                    <StatusBadge value={numberValue(item.difference) === 0} />
                  </div>
                ))}
                {paymentMethods.length === 0 && (
                  <div className="finance-inclusive-empty">
                    No payment method records for this selected period.
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className="finance-inclusive-lower-grid">
            <article className="finance-inclusive-panel finance-inclusive-panel--wide">
              <header>
                <div>
                  <h3>Recent Finance Transactions</h3>
                  <small>Derived from available Finance shadow payment methods</small>
                </div>
              </header>

              <table className="finance-inclusive-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Finance Account</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentMethods.map((item: any) => (
                    <tr key={item.payment_method}>
                      <td>{to}</td>
                      <td>Payment</td>
                      <td>{readable(item.payment_method)} POS shadow posting</td>
                      <td>Finance Shadow Ledger</td>
                      <td>RWF {money(item.finance_shadow_total)}</td>
                      <td><StatusBadge value={numberValue(item.difference) === 0} /></td>
                    </tr>
                  ))}
                  {paymentMethods.length === 0 && (
                    <tr>
                      <td colSpan={6}>No Finance shadow transactions are available for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </article>

            <article className="finance-inclusive-panel">
              <header>
                <div>
                  <h3>Readiness Health</h3>
                  <small>Dashboard switch controls</small>
                </div>
              </header>
              <div className="finance-inclusive-checks">
                {readinessChecks.map(([name, check]) => (
                  <div key={name}>
                    <span>{check?.label || readable(name)}</span>
                    <StatusBadge value={check?.status} />
                  </div>
                ))}
                {readinessChecks.length === 0 && (
                  <div className="finance-inclusive-empty">Readiness checks are loading.</div>
                )}
              </div>
            </article>
          </section>
        </>
      ) : activeTab === 'tax-registry' ? (
        <section
          className="finance-tax-registry"
          aria-label="RRA tax registry review desk"
        >
          <article className="finance-inclusive-panel finance-tax-registry__intro">
            <header>
              <div>
                <span className="finance-tax-registry__eyebrow">
                  RRA evidence workspace
                </span>
                <h3>Tax Registry Review Desk</h3>
                <small>
                  Search approved and effective registry records without changing
                  tax treatment, product assignments or POS calculations.
                </small>
              </div>
              <span className="finance-tax-registry__mode">
                Read-only
              </span>
            </header>

            <div className="finance-tax-registry__policy">
              <strong>Human review remains mandatory</strong>
              <p>
                A registry result is an evidence candidate only. It does not grant
                VAT exemption, zero-rating or any other tax treatment.
              </p>
            </div>
          </article>

          <section className="finance-tax-registry__summary">
            <article>
              <small>Approved active editions</small>
              <strong>
                {numberValue(registrySummary?.approved_active_lists)}
              </strong>
              <span>Effective on {registrySummary?.as_of || to}</span>
            </article>
            <article>
              <small>Active registry items</small>
              <strong>
                {numberValue(registrySummary?.active_items)}
              </strong>
              <span>Eligible for evidence search</span>
            </article>
            <article>
              <small>Active aliases</small>
              <strong>
                {numberValue(registrySummary?.active_aliases)}
              </strong>
              <span>Alternative-name support</span>
            </article>
            <article>
              <small>Automatic exemption</small>
              <strong>No</strong>
              <span>Review and approval required</span>
            </article>
          </section>

          <article className="finance-inclusive-panel">
            <header className="finance-tax-registry__section-header">
              <div>
                <h3>Search registry evidence</h3>
                <small>
                  Search an official, generic or registered medicine name.
                </small>
              </div>
              <button
                type="button"
                onClick={() => void loadTaxRegistryOverview()}
                disabled={registryLoading}
              >
                {registryLoading ? 'Refreshing…' : 'Refresh registry'}
              </button>
            </header>

            <form
              className="finance-tax-registry__search"
              onSubmit={(event) => void handleRegistrySearch(event)}
            >
              <label>
                <span>Medicine or registered name</span>
                <input
                  type="search"
                  value={registryQuery}
                  onChange={(event) => setRegistryQuery(event.target.value)}
                  placeholder="Example: Paracetamol"
                  maxLength={191}
                />
              </label>
              <button
                type="submit"
                disabled={registrySearchLoading}
              >
                {registrySearchLoading ? 'Searching…' : 'Search registry'}
              </button>
            </form>

            {registryError && (
              <div className="form-error">{registryError}</div>
            )}

            {registrySearchNotice && (
              <div className="finance-tax-registry__notice">
                {registrySearchNotice}
              </div>
            )}

            <div
              className="finance-tax-registry__table-scroll"
              role="region"
              aria-label="Registry evidence candidates"
              tabIndex={0}
            >
              <table className="finance-inclusive-table">
                <thead>
                  <tr>
                    <th>Official medicine</th>
                    <th>Generic / alias</th>
                    <th>Form and strength</th>
                    <th>Registration / HS</th>
                    <th>Registry edition</th>
                    <th>Match evidence</th>
                    <th>Decision status</th>
                  </tr>
                </thead>
                <tbody>
                  {registryCandidates.map((candidate: any) => (
                    <tr key={candidate.item?.uuid || candidate.item?.id}>
                      <td>
                        <strong>{candidate.item?.official_name || '—'}</strong>
                        <small>
                          {candidate.item?.manufacturer || 'Manufacturer not listed'}
                        </small>
                      </td>
                      <td>
                        <span>{candidate.item?.generic_name || '—'}</span>
                        <small>
                          {(candidate.item?.aliases || []).join(', ') || 'No active aliases'}
                        </small>
                      </td>
                      <td>
                        <span>{candidate.item?.dosage_form || '—'}</span>
                        <small>{candidate.item?.strength || 'Strength not listed'}</small>
                      </td>
                      <td>
                        <span>{candidate.item?.registration_number || '—'}</span>
                        <small>HS {candidate.item?.hs_code || 'not listed'}</small>
                      </td>
                      <td>
                        <span>{candidate.registry_edition?.code || '—'}</span>
                        <small>
                          {candidate.registry_edition?.version_label || 'Version not labelled'}
                        </small>
                      </td>
                      <td>
                        <strong>{numberValue(candidate.match_score)}%</strong>
                        <small>
                          {(candidate.match_reasons || [])
                            .map((reason: string) => readable(reason))
                            .join(', ') || 'Candidate evidence'}
                        </small>
                      </td>
                      <td>
                        <span className="finance-tax-registry__review-badge">
                          Review required
                        </span>
                        <small>Automatic exemption: No</small>
                      </td>
                    </tr>
                  ))}

                  {registryCandidates.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        Search results will appear here. No tax treatment is
                        changed from this workspace.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="finance-inclusive-panel">
            <header className="finance-tax-registry__section-header">
              <div>
                <h3>Registry editions</h3>
                <small>
                  Published, draft and historical editions are visible for
                  traceability; searches use approved and effective editions.
                </small>
              </div>
              <StatusBadge
                value={
                  registrySummary?.approved_active_lists > 0
                    ? 'active'
                    : 'review'
                }
              />
            </header>

            <div
              className="finance-tax-registry__table-scroll"
              role="region"
              aria-label="RRA registry editions"
              tabIndex={0}
            >
              <table className="finance-inclusive-table">
                <thead>
                  <tr>
                    <th>Edition</th>
                    <th>Authority</th>
                    <th>Published</th>
                    <th>Effective period</th>
                    <th>Records</th>
                    <th>Import status</th>
                    <th>Source integrity</th>
                  </tr>
                </thead>
                <tbody>
                  {registryEditions.map((edition: any) => (
                    <tr key={edition.uuid || edition.id}>
                      <td>
                        <strong>{edition.code || edition.title}</strong>
                        <small>{edition.version_label || edition.title}</small>
                      </td>
                      <td>{edition.issuing_authority || 'Not stated'}</td>
                      <td>{edition.publication_date || '—'}</td>
                      <td>
                        <span>{edition.effective_from || '—'}</span>
                        <small>to {edition.effective_to || 'open-ended'}</small>
                      </td>
                      <td>
                        {numberValue(
                          edition.items_count
                          ?? edition.record_count,
                        )}
                      </td>
                      <td>
                        <StatusBadge value={edition.import_status} />
                      </td>
                      <td>
                        <span>
                          {edition.source_sha256
                            ? 'Hash recorded'
                            : 'Hash not recorded'}
                        </span>
                        <small>{edition.source_format || 'Format not stated'}</small>
                      </td>
                    </tr>
                  ))}

                  {registryEditions.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        {registryLoading
                          ? 'Loading registry editions…'
                          : 'No registry editions are available.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : (
        <section className="finance-inclusive-panel finance-inclusive-detail">
          <h3>{tabs.find(([key]) => key === activeTab)?.[1]}</h3>
          <p>
            This section is part of the same inclusive dashboard. It uses the same Finance
            source-of-truth API data and will be expanded without creating a separate old/new interface.
          </p>
          <div className="finance-inclusive-card-grid">
            {cards.slice(0, 4).map((card) => (
              <MetricCard key={card.label} {...card} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

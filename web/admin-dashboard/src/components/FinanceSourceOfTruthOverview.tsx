import { useEffect, useMemo, useState } from 'react';
import {
  getPharmaFinancePosRevenueShadowReport,
  getPharmaFinancePosShadowReconciliationReport,
  getPharmaFinanceReadinessHealthReport,
  type PharmaFinancePosRevenueShadowReport,
  type PharmaFinancePosShadowReconciliationReport,
  type PharmaFinanceReadinessHealthCheck,
  type PharmaFinanceReadinessHealthReport,
} from '../lib/api';

type Props = {
  token: string;
  profile: any;
};

type Tone = 'success' | 'warning' | 'danger' | 'info';

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

function money(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function readableStatus(value: string | null | undefined): string {
  return String(value ?? 'pending')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toneForStatus(status: string | boolean | null | undefined): Tone {
  if (status === true || status === 'ready' || status === 'passed' || status === 'shadow_validated' || status === 'ready_for_staged_switch') {
    return 'success';
  }

  if (status === false || status === 'failed' || status === 'needs_review' || status === 'not_ready') {
    return 'danger';
  }

  if (status === 'shadow_mode' || status === 'shadow') {
    return 'info';
  }

  return 'warning';
}

function FinanceStatusBadge({ status }: { status: string | boolean | null | undefined }) {
  const tone = toneForStatus(status);

  return (
    <span className={`finance-status-badge finance-status-badge--${tone}`}>
      {typeof status === 'boolean' ? (status ? 'Passed' : 'Failed') : readableStatus(status)}
    </span>
  );
}

function FinanceMetricCard({
  label,
  value,
  helper,
  status,
}: {
  label: string;
  value: string;
  helper: string;
  status?: string | boolean | null;
}) {
  return (
    <article className="finance-dashboard-card">
      <div className="finance-dashboard-card__top">
        <span>{label}</span>
        {status !== undefined && <FinanceStatusBadge status={status} />}
      </div>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function FinanceCheckRow({
  name,
  check,
}: {
  name: string;
  check: PharmaFinanceReadinessHealthCheck;
}) {
  return (
    <article className="finance-check-row">
      <div>
        <strong>{check.label || readableStatus(name)}</strong>
        <small>{name.replaceAll('_', ' ')}</small>
      </div>
      <FinanceStatusBadge status={check.status} />
    </article>
  );
}

export function FinanceSourceOfTruthOverview({ token, profile }: Props) {
  const [from, setFrom] = useState(() => isoDate(30));
  const [to, setTo] = useState(() => isoDate(0));
  const [healthReport, setHealthReport] = useState<PharmaFinanceReadinessHealthReport | null>(null);
  const [report, setReport] = useState<PharmaFinancePosShadowReconciliationReport | null>(null);
  const [revenueReport, setRevenueReport] = useState<PharmaFinancePosRevenueShadowReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState('');

  const tenantSlug = tenantSlugFromProfile(profile);
  const summary = report?.summary;
  const revenueSummary = revenueReport?.summary;
  const healthSummary = healthReport?.summary;

  const readinessChecks = useMemo(
    () => Object.entries(healthReport?.checks ?? {}) as Array<[string, PharmaFinanceReadinessHealthCheck]>,
    [healthReport],
  );

  async function loadReport() {
    setIsLoading(true);
    setError('');

    try {
      const [healthResponse, reconciliationResponse, revenueResponse] = await Promise.all([
        getPharmaFinanceReadinessHealthReport(
          token,
          tenantSlug,
          { from, to },
        ),
        getPharmaFinancePosShadowReconciliationReport(
          token,
          tenantSlug,
          { from, to },
        ),
        getPharmaFinancePosRevenueShadowReport(
          token,
          tenantSlug,
          { from, to },
        ),
      ]);

      setHealthReport(healthResponse.data);
      setReport(reconciliationResponse.data);
      setRevenueReport(revenueResponse.data);
      setLoadedAt(new Date().toLocaleString());
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

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dashboardSourceMap = [
    {
      dashboard: 'POS Dashboard',
      operational: 'Sales count, prescriptions, cashier workflow',
      finance: 'Payments, cash, MoMo, card, revenue shadow',
      status: summary?.is_reconciled ? 'ready_for_staged_switch' : 'not_ready',
    },
    {
      dashboard: 'Inventory Dashboard',
      operational: 'Stock quantity, expiry, low stock, batch movement',
      finance: 'Inventory value, COGS, write-offs',
      status: 'pending_integration',
    },
    {
      dashboard: 'Procurement Dashboard',
      operational: 'Orders, receiving, supplier workflow',
      finance: 'Supplier payables, payments, clearing accounts',
      status: 'pending_integration',
    },
    {
      dashboard: 'Insurance Dashboard',
      operational: 'Claims, members, approvals, partner workflow',
      finance: 'Insurance receivables, write-offs, partner payments',
      status: 'pending_integration',
    },
  ];

  return (
    <section className="finance-dashboard-page">
      <section className="finance-command-banner">
        <div className="finance-command-banner__copy">
          <p className="eyebrow">Finance source of truth</p>
          <h2>Financial command center</h2>
          <p>
            Finance is the source of money values. Module dashboards stay active and continue
            to own operational counts, workflow status, and source-document drilldowns.
          </p>
          <div className="finance-command-banner__badges">
            <FinanceStatusBadge status={healthReport?.mode ?? 'shadow'} />
            <FinanceStatusBadge status={healthReport?.overall_status ?? 'needs_review'} />
            <FinanceStatusBadge status={healthReport?.dashboard_switch_status ?? 'not_ready'} />
          </div>
        </div>

        <div className="finance-command-tile">
          <span>Readiness</span>
          <strong>{readableStatus(healthReport?.overall_status)}</strong>
          <small>{healthSummary?.checks_passed ?? 0} of {healthSummary?.checks_total ?? 0} checks passed</small>
        </div>

        <div className="finance-command-tile">
          <span>Dashboard switch</span>
          <strong>{readableStatus(healthReport?.dashboard_switch_status)}</strong>
          <small>{loadedAt ? `Last checked ${loadedAt}` : 'Awaiting refresh'}</small>
        </div>
      </section>

      <section className="finance-dashboard-toolbar">
        <label>
          <span>Business Date From</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>

        <label>
          <span>Business Date To</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>

        <button type="button" onClick={() => void loadReport()} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh dashboard'}
        </button>
      </section>

      {error && <div className="form-error">{error}</div>}

      <section className="finance-dashboard-grid finance-dashboard-grid--four">
        <FinanceMetricCard
          label="Trial Balance"
          value={`${money((healthReport?.checks.trial_balance?.details as any)?.difference)} RWF`}
          helper="Difference across posted and shadow-posted ledger lines."
          status={healthReport?.checks.trial_balance?.status}
        />

        <FinanceMetricCard
          label="POS Payments"
          value={`${money(summary?.finance_shadow_payment_total)} RWF`}
          helper="Finance shadow payment postings reconciled against POS completed payments."
          status={healthReport?.checks.pos_payment_reconciliation?.status}
        />

        <FinanceMetricCard
          label="Revenue Shadow"
          value={`${money(revenueSummary?.finance_shadow_revenue)} RWF`}
          helper="Payment-basis shadow revenue. Not final accrual P&L revenue."
          status={healthReport?.checks.pos_revenue_shadow?.status}
        />

        <FinanceMetricCard
          label="Tax Shadow"
          value={`${money(revenueSummary?.finance_shadow_tax)} RWF`}
          helper="Payment-basis shadow tax from completed POS payments."
          status={revenueSummary?.is_reconciled}
        />
      </section>

      <section className="finance-dashboard-grid finance-dashboard-grid--four">
        <FinanceMetricCard
          label="POS Completed Payments"
          value={`${money(summary?.pos_completed_payments_total)} RWF`}
          helper="Operational POS dashboard stays active as source-document workspace."
        />

        <FinanceMetricCard
          label="Payment Difference"
          value={`${money(summary?.difference)} RWF`}
          helper="Operational payments minus Finance payment shadow postings."
          status={summary?.is_reconciled}
        />

        <FinanceMetricCard
          label="Revenue Difference"
          value={`${money(revenueSummary?.revenue_difference)} RWF`}
          helper="Operational allocated revenue minus Finance revenue shadow."
          status={revenueSummary?.is_reconciled}
        />

        <FinanceMetricCard
          label="Tax Difference"
          value={`${money(revenueSummary?.tax_difference)} RWF`}
          helper="Operational allocated tax minus Finance tax shadow."
          status={revenueSummary?.is_reconciled}
        />
      </section>

      <section className="finance-dashboard-main-grid">
        <article className="finance-dashboard-panel">
          <div className="finance-panel-heading">
            <div>
              <p className="eyebrow">Readiness checklist</p>
              <h3>Finance authority checks</h3>
            </div>
            <FinanceStatusBadge status={healthReport?.overall_status} />
          </div>

          <div className="finance-check-list-expanded">
            {readinessChecks.length > 0 ? (
              readinessChecks.map(([name, check]) => (
                <FinanceCheckRow key={name} name={name} check={check} />
              ))
            ) : (
              <p className="muted">Readiness checks will appear after refresh.</p>
            )}
          </div>
        </article>

        <article className="finance-dashboard-panel">
          <div className="finance-panel-heading">
            <div>
              <p className="eyebrow">Dashboard policy</p>
              <h3>Module dashboards stay</h3>
            </div>
          </div>

          <div className="finance-source-map">
            {dashboardSourceMap.map((item) => (
              <article key={item.dashboard}>
                <div>
                  <strong>{item.dashboard}</strong>
                  <small>Operational: {item.operational}</small>
                  <small>Finance money values: {item.finance}</small>
                </div>
                <FinanceStatusBadge status={item.status} />
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="finance-dashboard-panel">
        <div className="finance-panel-heading">
          <div>
            <p className="eyebrow">Accounting rollout state</p>
            <h3>What this dashboard means</h3>
          </div>
        </div>

        <div className="finance-rollout-grid">
          <article>
            <strong>Shadow Mode</strong>
            <span>Finance validates operational money values without replacing module dashboards yet.</span>
          </article>
          <article>
            <strong>Payment-basis Revenue</strong>
            <span>Revenue and tax are visible from completed payment shadow lines, not final accrual P&L revenue.</span>
          </article>
          <article>
            <strong>Staged Dashboard Switch</strong>
            <span>Financial cards can move to Finance APIs only after readiness checks are clean.</span>
          </article>
          <article>
            <strong>Operational Drilldown</strong>
            <span>POS, Inventory, Procurement, and Insurance dashboards remain the workflow and source-document homes.</span>
          </article>
        </div>
      </section>
    </section>
  );
}

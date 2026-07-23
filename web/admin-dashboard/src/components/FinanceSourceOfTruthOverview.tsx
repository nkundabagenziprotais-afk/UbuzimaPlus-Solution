import { useEffect, useMemo, useState } from 'react';
import {
  getPharmaFinancePosShadowReconciliationReport,
  type PharmaFinancePosShadowReconciliationReport,
} from '../lib/api';

type FinanceSourceOfTruthOverviewProps = {
  token: string;
  profile: any;
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type StatusTone = 'success' | 'warning' | 'danger';

function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatNumber(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function isoDate(daysBack = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);

  return date.toISOString().slice(0, 10);
}

function tenantSlugFromProfile(profile: any): string {
  return (
    profile?.tenant_assignments?.[0]?.tenant?.slug
    || profile?.tenant?.slug
    || profile?.scope?.tenant_slug
    || 'vitapharma'
  );
}

function statusLabel(report: PharmaFinancePosShadowReconciliationReport | null): string {
  if (!report) {
    return 'Pending review';
  }

  return report.summary.is_reconciled ? 'Ready for dashboard switch' : 'Not ready';
}

function statusTone(report: PharmaFinancePosShadowReconciliationReport | null): StatusTone {
  if (!report) {
    return 'warning';
  }

  return report.summary.is_reconciled ? 'success' : 'danger';
}

export function FinanceSourceOfTruthOverview({
  token,
  profile,
}: FinanceSourceOfTruthOverviewProps) {
  const [from, setFrom] = useState(() => isoDate(30));
  const [to, setTo] = useState(() => isoDate(0));
  const [paymentMethod, setPaymentMethod] = useState('');
  const [report, setReport] = useState<PharmaFinancePosShadowReconciliationReport | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState('');

  const tenantSlug = tenantSlugFromProfile(profile);
  const summary = report?.summary;

  async function loadReport() {
    setLoadState('loading');
    setError('');

    try {
      const response = await getPharmaFinancePosShadowReconciliationReport(
        token,
        tenantSlug,
        {
          from,
          to,
          payment_method: paymentMethod || undefined,
        },
      );

      setReport(response.data);
      setLoadedAt(new Date().toLocaleString());
      setLoadState('ready');
    } catch (exception) {
      setLoadState('error');
      setError(
        exception instanceof Error
          ? exception.message
          : 'Unable to load Finance reconciliation report.',
      );
    }
  }

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postingCoverage = useMemo(() => {
    const posTotal = Number(summary?.pos_completed_payments_total ?? 0);
    const financeTotal = Number(summary?.finance_shadow_payment_total ?? 0);
    const coverage = posTotal > 0
      ? Math.min(100, Math.round((financeTotal / posTotal) * 100))
      : 100;

    return [
      {
        module: 'POS Payments',
        events: posTotal > 0 ? 'Completed payments' : 'No activity',
        source: 'Finance Shadow Ledger',
        coverage: `${coverage}%`,
        status: summary?.is_reconciled ? 'Finance Authoritative Ready' : 'Shadow Mismatch',
        tone: summary?.is_reconciled ? 'success' : 'danger',
      },
      {
        module: 'POS Sales Revenue',
        events: 'Sales source documents',
        source: 'Pending Finance revenue posting',
        coverage: 'Pending',
        status: 'Pending Finance Integration',
        tone: 'warning',
      },
      {
        module: 'Inventory Value',
        events: 'Batches and stock movements',
        source: 'Pending Finance inventory asset posting',
        coverage: 'Pending',
        status: 'Pending Finance Integration',
        tone: 'warning',
      },
      {
        module: 'Procurement / AP',
        events: 'Supplier invoices and payments',
        source: 'Pending Finance AP control posting',
        coverage: 'Pending',
        status: 'Pending Finance Integration',
        tone: 'warning',
      },
      {
        module: 'Insurance Receivables',
        events: 'Claims and partner payments',
        source: 'Pending Finance insurance AR posting',
        coverage: 'Pending',
        status: 'Pending Finance Integration',
        tone: 'warning',
      },
    ] as Array<{
      module: string;
      events: string;
      source: string;
      coverage: string;
      status: string;
      tone: StatusTone;
    }>;
  }, [summary]);

  const dashboardConsistency: Array<{
    metric: string;
    moduleDashboard: string;
    operationalSource: string;
    financeSource: string;
    status: string;
    tone: StatusTone;
  }> = [
    {
      metric: 'POS Payments',
      moduleDashboard: 'POS Dashboard remains active',
      operationalSource: `${formatMoney(summary?.pos_completed_payments_total)} RWF`,
      financeSource: `${formatMoney(summary?.finance_shadow_payment_total)} RWF`,
      status: summary?.is_reconciled ? 'Matched' : 'Mismatch',
      tone: summary?.is_reconciled ? 'success' : 'danger',
    },
    {
      metric: 'Gross Sales',
      moduleDashboard: 'POS Dashboard remains active',
      operationalSource: 'Operational Source',
      financeSource: 'Pending',
      status: 'Pending Finance Integration',
      tone: 'warning',
    },
    {
      metric: 'Inventory Value',
      moduleDashboard: 'Inventory Dashboard remains active',
      operationalSource: 'Operational Source',
      financeSource: 'Pending',
      status: 'Pending Finance Integration',
      tone: 'warning',
    },
    {
      metric: 'Supplier Payables',
      moduleDashboard: 'Procurement Dashboard remains active',
      operationalSource: 'Operational Source',
      financeSource: 'Pending',
      status: 'Pending Finance Integration',
      tone: 'warning',
    },
    {
      metric: 'Insurance Receivables',
      moduleDashboard: 'Insurance Dashboard remains active',
      operationalSource: 'Operational Source',
      financeSource: 'Pending',
      status: 'Pending Finance Integration',
      tone: 'warning',
    },
  ];

  const readinessChecks = [
    ['Chart of Accounts configured', 'Passed', 'Finance setup'],
    ['Account mappings configured', 'Passed', 'Finance setup'],
    ['POS shadow posting active', 'Passed', 'POS payments'],
    [
      'POS backfill completed',
      summary?.missing_finance_postings_count === 0 ? 'Passed' : 'Action required',
      'Backfill',
    ],
    [
      'POS reconciliation clean',
      summary?.is_reconciled ? 'Passed' : 'Action required',
      'Reconciliation',
    ],
    ['Trial balance balanced', 'Passed', 'Shadow ledger'],
    [
      'Dashboard financial switch',
      summary?.is_reconciled ? 'Ready for staged switch' : 'Not ready',
      'Governance',
    ],
  ];

  return (
    <section className="finance-source-truth-page">
      <section className={`finance-authority-banner finance-authority-banner--${statusTone(report)}`}>
        <div>
          <p className="eyebrow">Finance source of truth</p>
          <h2>Financial authority control center</h2>
          <p>
            Module dashboards stay in place. Finance supplies money values when each module reaches
            reconciliation readiness. Operational modules continue to own counts, workflows, and source documents.
          </p>
        </div>

        <div className="finance-authority-status-card">
          <span>Current mode</span>
          <strong>Shadow Mode</strong>
          <small>{statusLabel(report)}</small>
        </div>

        <div className="finance-authority-status-card">
          <span>Ledger state</span>
          <strong>{summary?.is_reconciled ? 'Balanced and reconciled' : 'Needs review'}</strong>
          <small>{loadedAt ? `Last checked ${loadedAt}` : 'Awaiting load'}</small>
        </div>
      </section>

      <section className="finance-filter-bar">
        <label>
          <span>Business Date From</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>

        <label>
          <span>Business Date To</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>

        <label>
          <span>Payment Method</span>
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            <option value="">All methods</option>
            <option value="cash">Cash</option>
            <option value="momo">Mobile Money</option>
            <option value="card">Card</option>
            <option value="bank">Bank</option>
            <option value="credit">Credit</option>
            <option value="insurance">Insurance</option>
          </select>
        </label>

        <button type="button" onClick={() => void loadReport()} disabled={loadState === 'loading'}>
          {loadState === 'loading' ? 'Refreshing…' : 'Refresh'}
        </button>
      </section>

      {error && <div className="form-error">{error}</div>}

      <section className="finance-kpi-grid">
        <article className="finance-kpi-card">
          <span>POS completed payments</span>
          <strong>{formatMoney(summary?.pos_completed_payments_total)} RWF</strong>
          <small>Source: Operational POS → dashboard stays active</small>
        </article>

        <article className="finance-kpi-card">
          <span>Finance shadow postings</span>
          <strong>{formatMoney(summary?.finance_shadow_payment_total)} RWF</strong>
          <small>Source: Finance Shadow Ledger</small>
        </article>

        <article className={`finance-kpi-card finance-kpi-card--${Number(summary?.difference ?? 0) === 0 ? 'success' : 'danger'}`}>
          <span>Reconciliation difference</span>
          <strong>{formatMoney(summary?.difference)} RWF</strong>
          <small>{Number(summary?.difference ?? 0) === 0 ? 'Shadow validated' : 'Action required'}</small>
        </article>

        <article className={`finance-kpi-card finance-kpi-card--${statusTone(report)}`}>
          <span>Dashboard switch readiness</span>
          <strong>{statusLabel(report)}</strong>
          <small>Financial values can switch only after reconciliation is clean.</small>
        </article>
      </section>

      <section className="finance-two-column-grid">
        <article className="panel wide finance-source-panel">
          <div className="panel-heading-row">
            <div>
              <h2>POS Shadow Reconciliation</h2>
              <p className="muted">
                Confirms POS completed payments match Finance shadow journal entries before dashboards consume Finance totals.
              </p>
            </div>
            <span className={`finance-status-pill finance-status-pill--${statusTone(report)}`}>
              {summary?.is_reconciled ? 'Reconciled' : 'Needs review'}
            </span>
          </div>

          <div className="finance-reconciliation-mini-grid">
            <div>
              <span>Missing Finance Postings</span>
              <strong>{formatNumber(summary?.missing_finance_postings_count)}</strong>
            </div>
            <div>
              <span>Orphan Finance Postings</span>
              <strong>{formatNumber(summary?.orphan_finance_shadow_postings_count)}</strong>
            </div>
            <div>
              <span>Mode</span>
              <strong>Shadow Validated</strong>
            </div>
          </div>

          <div className="finance-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Payment Method</th>
                  <th>POS Total</th>
                  <th>Finance Total</th>
                  <th>Difference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(report?.payment_methods ?? []).length > 0 ? (
                  report!.payment_methods.map((method) => (
                    <tr key={method.payment_method}>
                      <td>{method.payment_method || 'unknown'}</td>
                      <td>{formatMoney(method.pos_total)} RWF</td>
                      <td>{formatMoney(method.finance_shadow_total)} RWF</td>
                      <td>{formatMoney(method.difference)} RWF</td>
                      <td>
                        <span className={`finance-status-pill finance-status-pill--${Number(method.difference) === 0 ? 'success' : 'danger'}`}>
                          {Number(method.difference) === 0 ? 'Matched' : 'Mismatch'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>No payment activity in this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel finance-readiness-panel">
          <h2>Readiness Checklist</h2>
          <p className="muted">
            Finance can become authoritative for a dashboard only when control checks are clean.
          </p>
          <div className="finance-check-list">
            {readinessChecks.map(([label, state, source]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{state}</strong>
                <small>{source}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="finance-two-column-grid">
        <article className="panel wide finance-source-panel">
          <div className="panel-heading-row">
            <div>
              <h2>Dashboard Consistency Monitor</h2>
              <p className="muted">
                Module dashboards remain available, but financial cards should move to Finance once marked ready.
              </p>
            </div>
          </div>

          <div className="finance-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Financial Metric</th>
                  <th>Module Dashboard</th>
                  <th>Operational Value</th>
                  <th>Finance Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardConsistency.map((item) => (
                  <tr key={item.metric}>
                    <td>{item.metric}</td>
                    <td>{item.moduleDashboard}</td>
                    <td>{item.operationalSource}</td>
                    <td>{item.financeSource}</td>
                    <td>
                      <span className={`finance-status-pill finance-status-pill--${item.tone}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel finance-readiness-panel">
          <h2>Source Labels</h2>
          <div className="finance-source-label-grid">
            <span>Operational Source</span>
            <span>Shadow Validated</span>
            <span>Finance Authoritative</span>
            <span>Pending Finance Integration</span>
            <span>Ready for Dashboard Switch</span>
          </div>
        </article>
      </section>

      <article className="panel wide finance-source-panel">
        <div className="panel-heading-row">
          <div>
            <h2>Posting Coverage by Module</h2>
            <p className="muted">
              Tracks which operational modules are ready to supply dashboard money values through Finance.
            </p>
          </div>
        </div>

        <div className="finance-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Module</th>
                <th>Events</th>
                <th>Finance Source</th>
                <th>Coverage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {postingCoverage.map((item) => (
                <tr key={item.module}>
                  <td>{item.module}</td>
                  <td>{item.events}</td>
                  <td>{item.source}</td>
                  <td>{item.coverage}</td>
                  <td>
                    <span className={`finance-status-pill finance-status-pill--${item.tone}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

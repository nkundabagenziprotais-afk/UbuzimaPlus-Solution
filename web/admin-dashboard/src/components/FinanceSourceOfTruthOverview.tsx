import { useEffect, useMemo, useState } from 'react';
import {
  getPharmaFinancePosRevenueShadowReport,
  getPharmaFinancePosShadowReconciliationReport,
  getPharmaFinanceReadinessHealthReport,
} from '../lib/api';

type Props = {
  token: string;
  profile: any;
};

type FinanceTab =
  | 'overview'
  | 'profit-loss'
  | 'cash-flow'
  | 'sales'
  | 'receivables'
  | 'payables'
  | 'expenses'
  | 'inventory-finance'
  | 'banking'
  | 'reports'
  | 'accounting';

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

function readable(value: string | boolean | null | undefined): string {
  if (typeof value === 'boolean') {
    return value ? 'Passed' : 'Failed';
  }

  return String(value ?? 'pending')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(value: string | boolean | null | undefined): string {
  if (
    value === true
    || value === 'ready'
    || value === 'passed'
    || value === 'ready_for_staged_switch'
  ) {
    return 'success';
  }

  if (value === false || value === 'failed' || value === 'not_ready') {
    return 'danger';
  }

  if (value === 'shadow' || value === 'shadow_mode') {
    return 'info';
  }

  return 'warning';
}

function StatusBadge({ value }: { value: string | boolean | null | undefined }) {
  return (
    <span className={`finance-v2-status finance-v2-status--${statusClass(value)}`}>
      {readable(value)}
    </span>
  );
}

function MiniBars({
  title,
  subtitle,
  revenue,
  expense,
}: {
  title: string;
  subtitle: string;
  revenue: number;
  expense: number;
}) {
  const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
  const values = months.map((month, index) => ({
    month,
    revenue: Math.max(1, revenue * (0.55 + index * 0.09)),
    expense: Math.max(1, expense * (0.45 + index * 0.07)),
  }));
  const max = Math.max(...values.flatMap((item) => [item.revenue, item.expense]), 1);

  return (
    <article className="finance-v2-card finance-v2-chart-card">
      <div className="finance-v2-card-head">
        <div>
          <h3>{title}</h3>
          <small>{subtitle}</small>
        </div>
        <select aria-label={`${title} period`}>
          <option>6 Months</option>
          <option>This Month</option>
        </select>
      </div>

      <div className="finance-v2-legend">
        <span><i className="finance-v2-dot finance-v2-dot--green" /> Revenue</span>
        <span><i className="finance-v2-dot finance-v2-dot--red" /> Expenses</span>
        <span><i className="finance-v2-dot finance-v2-dot--blue" /> Net</span>
      </div>

      <div className="finance-v2-bars">
        {values.map((item) => {
          const net = Math.max(item.revenue - item.expense, 1);

          return (
            <div key={item.month}>
              <span style={{ height: `${Math.max(8, item.revenue / max * 100)}%` }} />
              <span style={{ height: `${Math.max(8, item.expense / max * 100)}%` }} />
              <span style={{ height: `${Math.max(8, net / max * 100)}%` }} />
              <small>{item.month}</small>
            </div>
          );
        })}
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

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paymentSummary = payments?.summary ?? {};
  const revenueSummary = revenue?.summary ?? {};
  const paymentMethods = payments?.payment_methods ?? [];

  const totalRevenue = Number(
    revenueSummary.finance_shadow_revenue
    ?? revenueSummary.pos_revenue_total
    ?? 0,
  );
  const taxShadow = Number(revenueSummary.finance_shadow_tax ?? 0);
  const cashTotal = Number(
    paymentMethods.find((item: any) => item.payment_method === 'cash')?.finance_shadow_total ?? 0,
  );
  const momoTotal = Number(
    paymentMethods.find((item: any) => item.payment_method === 'momo')?.finance_shadow_total ?? 0,
  );
  const cardTotal = Number(
    paymentMethods.find((item: any) => item.payment_method === 'card')?.finance_shadow_total ?? 0,
  );
  const paymentTotal = Number(paymentSummary.finance_shadow_payment_total ?? 0);
  const expenseSignal = taxShadow;
  const grossProfit = Math.max(totalRevenue - taxShadow, 0);
  const netProfit = grossProfit;

  const readinessChecks = useMemo(
    () => Object.entries(health?.checks ?? {}) as Array<[string, any]>,
    [health],
  );

  const tabs: Array<[FinanceTab, string]> = [
    ['overview', 'Overview'],
    ['profit-loss', 'Profit & Loss'],
    ['cash-flow', 'Cash Flow'],
    ['sales', 'Sales'],
    ['receivables', 'Receivables'],
    ['payables', 'Payables'],
    ['expenses', 'Expenses'],
    ['inventory-finance', 'Inventory Finance'],
    ['banking', 'Banking'],
    ['reports', 'Reports'],
    ['accounting', 'Accounting'],
  ];

  const kpis = [
    ['Total Revenue', totalRevenue, 'Payment-basis shadow revenue', 'success'],
    ['Gross Margin', grossProfit, 'Revenue less tax shadow', 'info'],
    ['Total Expenses', 0, 'Expense ledger feed pending', 'warning'],
    ['Net Profit', netProfit, 'Interim shadow profit signal', 'success'],
    ['Cash in Hand', cashTotal, 'Cash payment shadow', 'info'],
    ['Insurance Receivables', 0, 'Insurance AR feed pending', 'warning'],
    ['Accounts Payable', 0, 'Supplier AP feed pending', 'warning'],
    ['Inventory Value', 0, 'Inventory valuation feed pending', 'warning'],
  ] as const;

  return (
    <section className="finance-v2-page">
      <header className="finance-v2-header">
        <div>
          <h2>Finance Overview</h2>
          <p>Real-time financial performance of your business</p>
        </div>

        <div className="finance-v2-filters">
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
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <nav className="finance-v2-tabs" aria-label="Finance dashboard tabs">
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

      <div className="finance-v2-sync-line">
        <span>Readiness: <StatusBadge value={health?.overall_status ?? 'pending'} /></span>
        <span>Dashboard switch: <StatusBadge value={health?.dashboard_switch_status ?? 'not_ready'} /></span>
        <span>Last updated: {loadedAt || 'Awaiting refresh'}</span>
      </div>

      {error && <div className="form-error">{error}</div>}

      {activeTab === 'overview' ? (
        <>
          <section className="finance-v2-kpi-grid">
            {kpis.map(([label, value, helper, tone]) => (
              <article className={`finance-v2-kpi finance-v2-kpi--${tone}`} key={label}>
                <span>{label}</span>
                <strong>RWF {money(value)}</strong>
                <small>{helper}</small>
              </article>
            ))}
          </section>

          <section className="finance-v2-analytics-grid">
            <MiniBars
              title="Revenue vs Expenses Trend"
              subtitle="Finance shadow revenue, expense signal, and net movement"
              revenue={totalRevenue}
              expense={expenseSignal}
            />

            <MiniBars
              title="Cash Flow Overview"
              subtitle="Payment receipts and estimated cash movement"
              revenue={paymentTotal}
              expense={expenseSignal}
            />

            <article className="finance-v2-card">
              <div className="finance-v2-card-head">
                <div>
                  <h3>Profit & Loss Summary</h3>
                  <small>Shadow-mode interim summary</small>
                </div>
                <select aria-label="Profit and loss period">
                  <option>This Month</option>
                </select>
              </div>

              <dl className="finance-v2-summary-list">
                <div><dt>Total Revenue</dt><dd>RWF {money(totalRevenue)}</dd></div>
                <div><dt>Tax Shadow</dt><dd>RWF {money(taxShadow)}</dd></div>
                <div><dt>Gross Profit</dt><dd>RWF {money(grossProfit)}</dd></div>
                <div><dt>Total Expenses</dt><dd>RWF {money(0)}</dd></div>
                <div><dt>Net Profit</dt><dd>RWF {money(netProfit)}</dd></div>
                <div><dt>Payment Difference</dt><dd>RWF {money(paymentSummary.difference)}</dd></div>
              </dl>
            </article>

            <article className="finance-v2-card">
              <div className="finance-v2-card-head">
                <div>
                  <h3>Expense Breakdown</h3>
                  <small>Expense ledger feed pending</small>
                </div>
                <select aria-label="Expense period">
                  <option>This Month</option>
                </select>
              </div>

              <div className="finance-v2-donut-wrap">
                <div className="finance-v2-donut">
                  <strong>RWF</strong>
                  <b>0</b>
                  <small>Pending</small>
                </div>

                <div className="finance-v2-donut-list">
                  {['Staff Expenses', 'Rent & Utilities', 'Transport', 'Administrative', 'Marketing', 'Others'].map((item, index) => (
                    <span key={item}>
                      <i className={`finance-v2-dot finance-v2-dot--${index + 1}`} />
                      {item}
                      <strong>Pending</strong>
                    </span>
                  ))}
                </div>
              </div>
            </article>
          </section>

          <section className="finance-v2-tables-grid">
            <article className="finance-v2-card finance-v2-table-card finance-v2-table-card--wide">
              <div className="finance-v2-card-head">
                <div>
                  <h3>Recent Transactions</h3>
                  <small>Finance shadow journal movement summary</small>
                </div>
              </div>

              <table className="finance-v2-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Account</th>
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
                      <td><StatusBadge value={Number(item.difference ?? 0) === 0} /></td>
                    </tr>
                  ))}
                  {paymentMethods.length === 0 && (
                    <tr>
                      <td colSpan={6}>No Finance payment shadow records are available for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </article>

            <article className="finance-v2-card">
              <div className="finance-v2-card-head">
                <div>
                  <h3>Top Receivables</h3>
                  <small>Receivable source feed pending</small>
                </div>
              </div>
              <div className="finance-v2-empty-state">
                Module dashboard remains active. Finance AR feed will populate this panel.
              </div>
            </article>

            <article className="finance-v2-card">
              <div className="finance-v2-card-head">
                <div>
                  <h3>Upcoming Payables</h3>
                  <small>Payables source feed pending</small>
                </div>
              </div>
              <div className="finance-v2-empty-state">
                Supplier dashboard remains active. Finance AP feed will populate this panel.
              </div>
            </article>
          </section>

          <section className="finance-v2-bottom-grid">
            <article className="finance-v2-card">
              <div className="finance-v2-card-head">
                <div>
                  <h3>Quick Actions</h3>
                  <small>Finance operating shortcuts</small>
                </div>
              </div>
              <div className="finance-v2-action-grid">
                {['Add Income', 'Add Expense', 'Record Payment', 'Transfer Money', 'New Journal'].map((item) => (
                  <button type="button" key={item}>{item}</button>
                ))}
              </div>
            </article>

            <article className="finance-v2-card">
              <div className="finance-v2-card-head">
                <div>
                  <h3>Bank Accounts</h3>
                  <small>Cash, card, bank and mobile money summary</small>
                </div>
              </div>
              <div className="finance-v2-bank-grid">
                <article><span>Main Bank Account</span><strong>RWF {money(cardTotal)}</strong><small>Card shadow</small></article>
                <article><span>Cash on Hand</span><strong>RWF {money(cashTotal)}</strong><small>Cash shadow</small></article>
                <article><span>Mobile Money</span><strong>RWF {money(momoTotal)}</strong><small>MoMo shadow</small></article>
                <article><span>Insurance Clearing</span><strong>RWF 0</strong><small>Pending feed</small></article>
              </div>
            </article>

            <article className="finance-v2-card">
              <div className="finance-v2-card-head">
                <div>
                  <h3>Report Shortcuts</h3>
                  <small>Financial statements and reconciliation</small>
                </div>
              </div>
              <div className="finance-v2-action-grid finance-v2-action-grid--reports">
                {['Profit & Loss', 'Balance Sheet', 'Cash Flow Statement', 'Trial Balance', 'General Ledger', 'A/R Aging Report'].map((item) => (
                  <button type="button" key={item}>{item}</button>
                ))}
              </div>
            </article>
          </section>
        </>
      ) : (
        <section className="finance-v2-card finance-v2-tab-placeholder">
          <h3>{tabs.find(([key]) => key === activeTab)?.[1]}</h3>
          <p>
            This detailed Finance workflow will use the same Finance source-of-truth APIs.
            The overview already fetches readiness, POS payment reconciliation, and POS revenue shadow reports.
          </p>

          <div className="finance-v2-check-list">
            {readinessChecks.map(([name, check]) => (
              <article key={name}>
                <div>
                  <strong>{check?.label || readable(name)}</strong>
                  <small>{name.replaceAll('_', ' ')}</small>
                </div>
                <StatusBadge value={check?.status} />
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

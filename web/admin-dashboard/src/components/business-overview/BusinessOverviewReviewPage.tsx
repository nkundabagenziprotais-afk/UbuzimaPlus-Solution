import { useEffect, useMemo, useState } from 'react';

type BusinessOverviewReviewPageProps = {
  token?: string;
  tenantSlug?: string | null;
};

type SalesPaymentMethod = {
  payment_method?: string;
  payment_count?: number | string;
  total_amount?: number | string;
};

type SalesSummaryResponse = {
  tenant?: {
    id?: number;
    name?: string;
    slug?: string;
  };
  period?: {
    start_date?: string;
    end_date?: string;
  };
  sales?: {
    sale_count?: number | string;
    draft_sale_count?: number | string;
    dispensed_sale_count?: number | string;
    total_sales_amount?: number | string;
    paid_amount?: number | string;
    balance_amount?: number | string;
    payments_collected?: number | string;
    payment_methods?: SalesPaymentMethod[];
  };
};

type DashboardState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  tenantSlug: string | null;
  periodLabel: string;
  grossSales: number;
  netSales: number;
  collections: number;
  outstandingBalance: number;
  transactionCount: number;
  averageTransactionValue: number;
  paymentMethods: SalesPaymentMethod[];
};

const emptyDashboardState: DashboardState = {
  status: 'idle',
  error: null,
  tenantSlug: null,
  periodLabel: '—',
  grossSales: 0,
  netSales: 0,
  collections: 0,
  outstandingBalance: 0,
  transactionCount: 0,
  averageTransactionValue: 0,
  paymentMethods: [],
};

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function money(value: number): string {
  return new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function percent(value: number): string {
  return `${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 1 }).format(value)}%`;
}

function paymentLabel(method: unknown): string {
  const raw = String(method ?? 'Other');
  const normalized = raw.toLowerCase();

  if (normalized === 'momo' || normalized.includes('mobile')) return 'Mobile Money';
  if (normalized.includes('cash')) return 'Cash';
  if (normalized.includes('card')) return 'Card';
  if (normalized.includes('bank')) return 'Bank';
  if (normalized.includes('insurance')) return 'Insurance';
  if (normalized.includes('credit')) return 'Credit';

  return raw.replace(/_/g, ' ');
}

function periodLabel(response: SalesSummaryResponse): string {
  const start = response.period?.start_date ?? '';
  const end = response.period?.end_date ?? '';

  if (start && end) return `${start} → ${end}`;
  if (start) return start;
  if (end) return end;

  return 'Current live sales summary';
}

function buildDashboardState(response: SalesSummaryResponse): DashboardState {
  const sales = response.sales ?? {};

  const grossSales = toNumber(sales.total_sales_amount);
  const collections = toNumber(sales.payments_collected) || toNumber(sales.paid_amount);
  const outstandingBalance = toNumber(sales.balance_amount);
  const transactionCount = toNumber(sales.sale_count);
  const averageTransactionValue = transactionCount > 0 ? grossSales / transactionCount : 0;

  return {
    status: 'success',
    error: null,
    tenantSlug: response.tenant?.slug ?? null,
    periodLabel: periodLabel(response),
    grossSales,
    netSales: grossSales,
    collections,
    outstandingBalance,
    transactionCount,
    averageTransactionValue,
    paymentMethods: sales.payment_methods ?? [],
  };
}

async function fetchSalesSummary(token: string, tenantSlug: string): Promise<SalesSummaryResponse> {
  const response = await fetch('/api/v1/pharmaco/reports/sales-summary', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Tenant': tenantSlug,
      'X-Tenant-Slug': tenantSlug,
    },
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof json?.message === 'string'
        ? json.message
        : `Sales summary failed with HTTP ${response.status}`,
    );
  }

  return json as SalesSummaryResponse;
}

export function BusinessOverviewReviewPage({
  token = '',
  tenantSlug = null,
}: BusinessOverviewReviewPageProps) {
  const [dashboard, setDashboard] = useState<DashboardState>(emptyDashboardState);
  const debugEnabled =
    typeof window !== 'undefined' &&
    window.location.search.includes('boDebug=1');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token || !tenantSlug) {
        setDashboard({
          ...emptyDashboardState,
          status: 'error',
          error: !token
            ? 'Authentication token is missing.'
            : 'Tenant slug is missing.',
          tenantSlug,
        });
        return;
      }

      setDashboard({
        ...emptyDashboardState,
        status: 'loading',
        tenantSlug,
      });

      try {
        const response = await fetchSalesSummary(token, tenantSlug);

        if (cancelled) return;

        const nextState = buildDashboardState(response);
        setDashboard(nextState);

        if (debugEnabled) {
          console.log('Business Overview clean sales summary state', nextState);
        }
      } catch (error) {
        if (cancelled) return;

        setDashboard({
          ...emptyDashboardState,
          status: 'error',
          tenantSlug,
          error: error instanceof Error
            ? error.message
            : 'Unable to load Business Overview sales summary.',
        });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token, tenantSlug, debugEnabled]);

  const paymentTotal = Math.max(dashboard.collections, 1);

  const paymentMix = useMemo(
    () =>
      dashboard.paymentMethods
        .map((method) => {
          const amount = toNumber(method.total_amount);
          const share = (amount / paymentTotal) * 100;

          return {
            label: paymentLabel(method.payment_method),
            amount,
            value: percent(share),
            percent: Math.round(share),
          };
        })
        .filter((row) => row.amount > 0),
    [dashboard.paymentMethods, paymentTotal],
  );

  const kpis = [
    {
      label: 'Gross Revenue',
      value: money(dashboard.grossSales),
      helper: 'Live sales summary report',
      tone: 'positive',
      source: 'Live',
    },
    {
      label: 'Net Revenue',
      value: money(dashboard.netSales),
      helper: 'Live sales summary report',
      tone: 'positive',
      source: 'Live',
    },
    {
      label: 'Collections',
      value: money(dashboard.collections),
      helper: 'Payments collected from live sales summary',
      tone: 'positive',
      source: 'Live',
    },
    {
      label: 'Outstanding Balance',
      value: money(dashboard.outstandingBalance),
      helper: 'Balance amount from live sales summary',
      tone: dashboard.outstandingBalance > 0 ? 'warning' : 'positive',
      source: 'Live',
    },
    {
      label: 'Transaction Count',
      value: money(dashboard.transactionCount),
      helper: 'Sales count from live sales summary',
      tone: 'neutral',
      source: 'Live',
    },
    {
      label: 'Average Transaction Value',
      value: dashboard.transactionCount ? money(dashboard.averageTransactionValue) : '—',
      helper: 'Gross revenue divided by transactions',
      tone: 'neutral',
      source: 'Live',
    },
    {
      label: 'Inventory Value',
      value: '—',
      helper: 'Pending optimized inventory summary endpoint',
      tone: 'neutral',
      source: 'Pending',
    },
    {
      label: 'Low Stock Items',
      value: '—',
      helper: 'Pending optimized inventory summary endpoint',
      tone: 'neutral',
      source: 'Pending',
    },
  ];

  const revenueRows = [
    { label: 'Gross Sales', value: money(dashboard.grossSales) },
    { label: 'Discounts', value: money(0) },
    { label: 'Returns / Reversals', value: money(0) },
    { label: 'Net Sales', value: money(dashboard.netSales) },
    { label: 'Collections', value: money(dashboard.collections) },
    { label: 'Credit Sales', value: '—' },
    { label: 'Insurance Sales', value: '—' },
    { label: 'Net Cash Inflow', value: money(dashboard.collections) },
  ];

  const inventoryRows = [
    { label: 'Total Inventory Value', value: '—' },
    { label: 'Total Quantity On Hand', value: '—' },
    { label: 'Stock Batches', value: '—' },
    { label: 'Low Stock Items', value: '—' },
    { label: 'Expiring Items', value: '—' },
    { label: 'Expired Batches', value: '—' },
  ];

  const debugSnapshot = {
    tenantSlug,
    tokenPresent: Boolean(token),
    status: dashboard.status,
    loaded: dashboard.status === 'success',
    salesLoaded: dashboard.status === 'success',
    inventoryLoaded: false,
    error: dashboard.error,
    periodLabel: dashboard.periodLabel,
    kpis: Object.fromEntries(kpis.map((kpi) => [kpi.label, kpi.value])),
    revenueRows,
    inventoryRows,
    paymentMix,
  };

  return (
    <section className="bo-v3-page">
      <header className="bo-v3-header">
        <div>
          <div className="bo-v3-title-row">
            <span className="bo-v3-title-icon">⌘</span>
            <h1>Business Overview</h1>
            <strong>Business Driving Engine</strong>
          </div>
          <p>360° view of revenue, cash, expenses, profitability, goals, and operational risks.</p>
        </div>
      </header>

      {debugEnabled && (
        <pre className="bo-v3-live-debug">
{JSON.stringify(debugSnapshot, null, 2)}
        </pre>
      )}

      {dashboard.status === 'error' && (
        <div className="bo-v3-live-alert">
          {dashboard.error}
        </div>
      )}

      <section className="bo-v3-filter-strip">
        <label>
          <span>Date Range</span>
          <select value="live-summary" onChange={() => undefined}>
            <option value="live-summary">Live Sales Summary</option>
          </select>
        </label>

        <article>
          <small>Business Period</small>
          <strong>{dashboard.periodLabel}</strong>
        </article>

        <article>
          <small>Branch</small>
          <strong>All Branches</strong>
        </article>

        <article>
          <small>Revenue Goal</small>
          <strong>—</strong>
        </article>

        <article>
          <small>Profit Goal</small>
          <strong>—</strong>
        </article>

        <article>
          <small>Expense Mode</small>
          <strong>—</strong>
        </article>

        <article>
          <small>Status</small>
          <strong>{dashboard.status === 'loading' ? 'Loading' : dashboard.status === 'success' ? 'Live' : 'Check'}</strong>
        </article>
      </section>

      <h2 className="bo-v3-section-title">Executive KPIs</h2>
      <section className="bo-v3-kpi-grid">
        {kpis.map((kpi) => (
          <article key={kpi.label} className={`bo-v3-kpi-card is-${kpi.tone}`}>
            <div className="bo-v3-kpi-heading">
              <small>{kpi.label}</small>
              <em className={kpi.source === 'Live' ? 'bo-v3-source bo-v3-source-live' : 'bo-v3-source bo-v3-source-config'}>
                {kpi.source}
              </em>
            </div>
            <strong>{dashboard.status === 'loading' ? '…' : kpi.value}</strong>
            <span>{kpi.helper}</span>
          </article>
        ))}
      </section>

      <section className="bo-v3-analytics-grid">
        <article className="bo-v3-panel">
          <header>
            <h3>Daily Revenue Operation</h3>
            <span>Sales summary</span>
          </header>
          <table>
            <tbody>
              {revenueRows.map((row) => (
                <tr key={row.label} className={row.label === 'Net Sales' || row.label === 'Net Cash Inflow' ? 'strong positive' : undefined}>
                  <th>{row.label}</th>
                  <td>{dashboard.status === 'loading' ? '…' : row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="bo-v3-panel bo-v3-panel-payment">
          <header>
            <h3>Payment Mix</h3>
            <span>Collections</span>
          </header>
          <div className="bo-v3-payment-body">
            <div className="bo-v3-donut">
              <div>
                <small>Collected</small>
                <strong>{dashboard.status === 'loading' ? '…' : money(dashboard.collections)}</strong>
              </div>
            </div>
            <ul>
              {paymentMix.length === 0 ? (
                <li>
                  <span className="bo-v3-dot cash" />
                  <strong>No payment mix yet</strong>
                  <em>—</em>
                </li>
              ) : (
                paymentMix.map((row) => (
                  <li key={row.label}>
                    <span className="bo-v3-dot momo" />
                    <strong>{row.label}</strong>
                    <em>{row.value}</em>
                  </li>
                ))
              )}
            </ul>
          </div>
        </article>

        <article className="bo-v3-panel bo-v3-panel-products">
          <header>
            <h3>Top Contributing Products</h3>
            <span>Pending itemized source</span>
          </header>
          <div className="bo-v3-products">
            <p>Product contribution requires an optimized itemized sales summary source.</p>
          </div>
        </article>

        <article className="bo-v3-panel">
          <header>
            <h3>Inventory Risk Overview</h3>
            <span>Pending optimized source</span>
          </header>
          <table>
            <tbody>
              {inventoryRows.map((row) => (
                <tr key={row.label}>
                  <th>{row.label}</th>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="bo-v3-insight-panel">
          <header>
            <span>AI</span>
            <h3>Business Notes</h3>
          </header>
          <section>
            <h4>Revenue</h4>
            <p>Sales and collections are now connected to the live aggregated sales summary.</p>
          </section>
          <section>
            <h4>Inventory</h4>
            <p>Inventory cards are intentionally pending until the optimized inventory summary source is ready.</p>
          </section>
        </article>
      </section>
    </section>
  );
}

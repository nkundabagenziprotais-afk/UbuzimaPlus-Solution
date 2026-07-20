import { useEffect, useMemo, useState } from 'react';

type BusinessOverviewReviewPageProps = {
  token?: string;
  tenantSlug?: string | null;
};

type SalesPaymentMethod = {
  payment_method?: string;
  payment_count?: number | string;
  total_amount?: number | string;
  amount?: number | string;
};

type SalesSummaryResponse = {
  tenant?: { slug?: string; name?: string };
  period?: { start_date?: string; end_date?: string };
  sales?: {
    sale_count?: number | string;
    total_sales_amount?: number | string;
    paid_amount?: number | string;
    balance_amount?: number | string;
    payments_collected?: number | string;
    payment_methods?: SalesPaymentMethod[];
  };
};

type LiveAnalyticsResponse = {
  business_date?: string;
  sales_total?: number | string;
  collections_total?: number | string;
  open_balance?: number | string;
  transaction_count?: number | string;
  average_transaction_value?: number | string;
  payment_methods?: SalesPaymentMethod[];
};

type InventoryValuationResponse = {
  inventory?: {
    batch_count?: number | string;
    product_count?: number | string;
    total_quantity_on_hand?: number | string;
    total_cost_value?: number | string;
    total_retail_value?: number | string;
    low_stock_batches?: number | string;
    expired_batches?: number | string;
    expiring_soon_batches?: number | string;
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
  inventoryValue: number;
  inventoryQuantity: number;
  stockBatches: number;
  lowStockItems: number;
  expiringItems: number;
  expiredBatches: number;
  inventoryLoaded: boolean;
};

const defaultBusinessDate = '2026-06-24';

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
  inventoryValue: 0,
  inventoryQuantity: 0,
  stockBatches: 0,
  lowStockItems: 0,
  expiringItems: 0,
  expiredBatches: 0,
  inventoryLoaded: false,
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

async function fetchTenantJson<T>(
  token: string,
  tenantSlug: string,
  path: string,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
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
        : `${path} failed with HTTP ${response.status}`,
    );
  }

  return json as T;
}

function buildSalesEndpoint(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    return `/pharmaco/business-analytics/live?business_date=${encodeURIComponent(startDate)}`;
  }

  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    business_date_from: startDate,
    business_date_to: endDate,
    date_basis: 'business_date',
  });

  return `/pharmaco/reports/sales-summary?${params.toString()}`;
}

function buildSalesStateFromResponse(
  response: SalesSummaryResponse | LiveAnalyticsResponse,
  startDate: string,
  endDate: string,
): Pick<
  DashboardState,
  | 'periodLabel'
  | 'grossSales'
  | 'netSales'
  | 'collections'
  | 'outstandingBalance'
  | 'transactionCount'
  | 'averageTransactionValue'
  | 'paymentMethods'
> {
  const maybeSummary = response as SalesSummaryResponse;
  const maybeAnalytics = response as LiveAnalyticsResponse;

  if (maybeSummary.sales) {
    const sales = maybeSummary.sales;
    const grossSales = toNumber(sales.total_sales_amount);
    const collections = toNumber(sales.payments_collected) || toNumber(sales.paid_amount);
    const outstandingBalance = toNumber(sales.balance_amount);
    const transactionCount = toNumber(sales.sale_count);
    const averageTransactionValue = transactionCount > 0 ? grossSales / transactionCount : 0;

    return {
      periodLabel:
        maybeSummary.period?.start_date && maybeSummary.period?.end_date
          ? `${maybeSummary.period.start_date} → ${maybeSummary.period.end_date}`
          : `${startDate} → ${endDate}`,
      grossSales,
      netSales: grossSales,
      collections,
      outstandingBalance,
      transactionCount,
      averageTransactionValue,
      paymentMethods: sales.payment_methods ?? [],
    };
  }

  const grossSales = toNumber(maybeAnalytics.sales_total);
  const collections = toNumber(maybeAnalytics.collections_total);
  const outstandingBalance = toNumber(maybeAnalytics.open_balance);
  const transactionCount = toNumber(maybeAnalytics.transaction_count);
  const averageTransactionValue =
    toNumber(maybeAnalytics.average_transaction_value) ||
    (transactionCount > 0 ? grossSales / transactionCount : 0);

  return {
    periodLabel: maybeAnalytics.business_date ?? startDate,
    grossSales,
    netSales: grossSales,
    collections,
    outstandingBalance,
    transactionCount,
    averageTransactionValue,
    paymentMethods: maybeAnalytics.payment_methods ?? [],
  };
}

function buildInventoryState(response: InventoryValuationResponse): Pick<
  DashboardState,
  | 'inventoryValue'
  | 'inventoryQuantity'
  | 'stockBatches'
  | 'lowStockItems'
  | 'expiringItems'
  | 'expiredBatches'
  | 'inventoryLoaded'
> {
  const inventory = response.inventory ?? {};

  return {
    inventoryValue: toNumber(inventory.total_cost_value) || toNumber(inventory.total_retail_value),
    inventoryQuantity: toNumber(inventory.total_quantity_on_hand),
    stockBatches: toNumber(inventory.batch_count),
    lowStockItems: toNumber(inventory.low_stock_batches),
    expiringItems: toNumber(inventory.expiring_soon_batches),
    expiredBatches: toNumber(inventory.expired_batches),
    inventoryLoaded: true,
  };
}

export function BusinessOverviewReviewPage({
  token = '',
  tenantSlug = null,
}: BusinessOverviewReviewPageProps) {
  const [startDate, setStartDate] = useState(defaultBusinessDate);
  const [endDate, setEndDate] = useState(defaultBusinessDate);
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
          error: !token ? 'Authentication token is missing.' : 'Tenant slug is missing.',
          tenantSlug,
        });
        return;
      }

      setDashboard({
        ...emptyDashboardState,
        status: 'loading',
        tenantSlug,
        periodLabel: startDate === endDate ? startDate : `${startDate} → ${endDate}`,
      });

      try {
        const [salesResult, inventoryResult] = await Promise.allSettled([
          fetchTenantJson<SalesSummaryResponse | LiveAnalyticsResponse>(
            token,
            tenantSlug,
            buildSalesEndpoint(startDate, endDate),
          ),
          fetchTenantJson<InventoryValuationResponse>(
            token,
            tenantSlug,
            '/pharmaco/reports/inventory-valuation',
          ),
        ]);

        if (cancelled) return;

        if (salesResult.status === 'rejected') {
          throw salesResult.reason;
        }

        const salesState = buildSalesStateFromResponse(salesResult.value, startDate, endDate);
        const inventoryState =
          inventoryResult.status === 'fulfilled'
            ? buildInventoryState(inventoryResult.value)
            : {
                inventoryValue: 0,
                inventoryQuantity: 0,
                stockBatches: 0,
                lowStockItems: 0,
                expiringItems: 0,
                expiredBatches: 0,
                inventoryLoaded: false,
              };

        const nextState: DashboardState = {
          ...emptyDashboardState,
          ...salesState,
          ...inventoryState,
          status: 'success',
          error: null,
          tenantSlug,
        };

        setDashboard(nextState);

        if (debugEnabled) {
          console.log('Business Overview business-date state', nextState);
          if (inventoryResult.status === 'rejected') {
            console.warn('Business Overview inventory valuation failed', inventoryResult.reason);
          }
        }
      } catch (error) {
        if (cancelled) return;

        setDashboard({
          ...emptyDashboardState,
          status: 'error',
          tenantSlug,
          error: error instanceof Error
            ? error.message
            : 'Unable to load Business Overview live data.',
        });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token, tenantSlug, startDate, endDate, debugEnabled]);

  const paymentTotal = Math.max(dashboard.collections, 1);

  const paymentMix = useMemo(
    () =>
      dashboard.paymentMethods
        .map((method) => {
          const amount = toNumber(method.total_amount ?? method.amount);
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
    { label: 'Gross Revenue', value: money(dashboard.grossSales), helper: 'Business-date sales source', tone: 'positive', source: 'Live' },
    { label: 'Net Revenue', value: money(dashboard.netSales), helper: 'Business-date sales source', tone: 'positive', source: 'Live' },
    { label: 'Collections', value: money(dashboard.collections), helper: 'Collections from selected business date/range', tone: 'positive', source: 'Live' },
    { label: 'Outstanding Balance', value: money(dashboard.outstandingBalance), helper: 'Open balance from selected business date/range', tone: dashboard.outstandingBalance > 0 ? 'warning' : 'positive', source: 'Live' },
    { label: 'Transaction Count', value: money(dashboard.transactionCount), helper: 'Sales count from selected business date/range', tone: 'neutral', source: 'Live' },
    { label: 'Average Transaction Value', value: dashboard.transactionCount ? money(dashboard.averageTransactionValue) : '—', helper: 'Gross revenue divided by transactions', tone: 'neutral', source: 'Live' },
    { label: 'Inventory Value', value: dashboard.inventoryLoaded ? money(dashboard.inventoryValue) : '—', helper: 'Inventory valuation report', tone: 'neutral', source: dashboard.inventoryLoaded ? 'Live' : 'Pending' },
    { label: 'Low Stock Items', value: dashboard.inventoryLoaded ? money(dashboard.lowStockItems) : '—', helper: 'Inventory valuation report', tone: dashboard.lowStockItems > 0 ? 'warning' : 'neutral', source: dashboard.inventoryLoaded ? 'Live' : 'Pending' },
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
    { label: 'Total Inventory Value', value: dashboard.inventoryLoaded ? money(dashboard.inventoryValue) : '—' },
    { label: 'Total Quantity On Hand', value: dashboard.inventoryLoaded ? money(dashboard.inventoryQuantity) : '—' },
    { label: 'Stock Batches', value: dashboard.inventoryLoaded ? money(dashboard.stockBatches) : '—' },
    { label: 'Low Stock Items', value: dashboard.inventoryLoaded ? money(dashboard.lowStockItems) : '—' },
    { label: 'Expiring Items', value: dashboard.inventoryLoaded ? money(dashboard.expiringItems) : '—' },
    { label: 'Expired Batches', value: dashboard.inventoryLoaded ? money(dashboard.expiredBatches) : '—' },
  ];

  const debugSnapshot = {
    tenantSlug,
    tokenPresent: Boolean(token),
    startDate,
    endDate,
    status: dashboard.status,
    loaded: dashboard.status === 'success',
    salesLoaded: dashboard.status === 'success',
    inventoryLoaded: dashboard.inventoryLoaded,
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
        <div className="bo-v3-live-alert">{dashboard.error}</div>
      )}

      <section className="bo-v3-filter-strip">
        <label>
          <span>Business Date From</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => {
              const value = event.target.value;
              setStartDate(value);
              if (endDate < value) setEndDate(value);
            }}
          />
        </label>

        <label>
          <span>Business Date To</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
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
            <span>Business date basis</span>
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

        <article className="bo-v3-panel">
          <header>
            <h3>Inventory Risk Overview</h3>
            <span>Inventory valuation</span>
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
            <p>Sales and collections are connected on Business Date basis using the selected date range.</p>
          </section>
          <section>
            <h4>Inventory</h4>
            <p>Inventory is connected to the live valuation report.</p>
          </section>
        </article>
      </section>
    </section>
  );
}

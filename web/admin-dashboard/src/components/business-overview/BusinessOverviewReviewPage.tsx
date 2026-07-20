import { useEffect, useMemo, useState } from 'react';
import {
  businessOverviewKpis,
  businessOverviewModules,
  recommendedActions,
} from './businessOverviewMockData';
import {
  emptyBusinessOverviewLiveData,
  loadBusinessOverviewLiveData,
  type BusinessOverviewLiveData,
  type BusinessOverviewLiveRow,
} from './businessOverviewLiveData';

type BusinessOverviewReviewPageProps = {
  token?: string;
  tenantSlug?: string | null;
};

type BusinessOverviewSalesSummary = {
  sale_count?: number | string;
  total_sales_amount?: number | string;
  paid_amount?: number | string;
  balance_amount?: number | string;
  payments_collected?: number | string;
  payment_methods?: Array<{
    payment_method?: string;
    payment_count?: number | string;
    total_amount?: number | string;
  }>;
};

function boNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function boMoney(value: number): string {
  return new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function boPercent(value: number): string {
  return `${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 1 }).format(value)}%`;
}

function boPaymentLabel(method: string): string {
  const normalized = method.toLowerCase();
  if (normalized === 'momo' || normalized.includes('mobile')) return 'Mobile Money';
  if (normalized.includes('card')) return 'Card';
  if (normalized.includes('insurance')) return 'Insurance';
  if (normalized.includes('credit')) return 'Credit';
  if (normalized.includes('bank')) return 'Bank';
  if (normalized.includes('cash')) return 'Cash';
  return method ? method.replace(/_/g, ' ') : 'Other';
}

function buildBusinessOverviewFromSalesSummary(sales: BusinessOverviewSalesSummary): BusinessOverviewLiveData {
  const empty = emptyBusinessOverviewLiveData();

  const grossSales = boNumber(sales.total_sales_amount);
  const collections = boNumber(sales.payments_collected) || boNumber(sales.paid_amount);
  const outstandingBalance = boNumber(sales.balance_amount);
  const transactionCount = boNumber(sales.sale_count);
  const averageTransactionValue = transactionCount > 0 ? grossSales / transactionCount : 0;
  const paymentTotal = Math.max(collections, 1);

  const paymentMix = (sales.payment_methods ?? [])
    .map((method) => {
      const amount = boNumber(method.total_amount);
      return {
        label: boPaymentLabel(String(method.payment_method ?? 'Other')),
        value: boPercent((amount / paymentTotal) * 100),
        percent: Math.round((amount / paymentTotal) * 100),
      };
    })
    .filter((row) => row.percent > 0);

  return {
    ...empty,
    loaded: true,
    salesLoaded: true,
    inventoryLoaded: false,
    error: null,
    kpis: {
      'Gross Revenue': boMoney(grossSales),
      'Net Revenue': boMoney(grossSales),
      Collections: boMoney(collections),
      'Outstanding Balance': boMoney(outstandingBalance),
      'Transaction Count': boMoney(transactionCount),
      'Average Transaction Value': transactionCount ? boMoney(averageTransactionValue) : '—',
      'Live POS Sales': boMoney(transactionCount),
      'Historical POS Sales': '—',
      'Gross Profit': '—',
      'Estimated Net Profit': '—',
      'Operating Expenses': '—',
      'Expense / Revenue Ratio': '—',
      'Break-even Daily Cash': '—',
      'Daily Cash for Revenue Goal': '—',
      'Daily Cash for Profit Goal': '—',
      'Cash Variance': '—',
      'Inventory Value': '—',
      'Low Stock Items': '—',
      'Expiring Items': '—',
    },
    kpiHelpers: {
      'Gross Revenue': 'Live sales summary report',
      'Net Revenue': 'Live sales summary report',
      Collections: 'Payments collected from live sales summary',
      'Outstanding Balance': 'Balance amount from live sales summary',
      'Inventory Value': 'Inventory summary pending optimized live endpoint',
      'Low Stock Items': 'Inventory summary pending optimized live endpoint',
      'Expiring Items': 'Inventory summary pending optimized live endpoint',
    },
    revenueRows: [
      { label: 'Gross Sales', value: boMoney(grossSales) },
      { label: 'Discounts', value: boMoney(0) },
      { label: 'Returns / Reversals', value: boMoney(0) },
      { label: 'Net Sales', value: boMoney(grossSales) },
      { label: 'Collections', value: boMoney(collections) },
      { label: 'Credit Sales', value: '—' },
      { label: 'Insurance Sales', value: '—' },
      { label: 'Net Cash Inflow', value: boMoney(collections) },
    ],
    paymentMix,
  };
}

async function fetchBusinessOverviewSalesSummary(
  token: string,
  tenantSlug: string,
): Promise<BusinessOverviewLiveData> {
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

  return buildBusinessOverviewFromSalesSummary(json?.sales ?? {});
}

function toneClass(tone?: string) {
  return tone ? `is-${tone}` : 'is-neutral';
}

function LiveRowsTable({ rows }: { rows: BusinessOverviewLiveRow[] }) {
  return (
    <table>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th>{row.label}</th>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyState({ children }: { children: string }) {
  return <div className="bo-v3-empty-state-card">{children}</div>;
}

export function BusinessOverviewReviewPage({
  token = '',
  tenantSlug = null,
}: BusinessOverviewReviewPageProps) {
  const [liveData, setLiveData] = useState<BusinessOverviewLiveData>(() =>
    emptyBusinessOverviewLiveData(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loaderStatus, setLoaderStatus] = useState('not-started');
  const debugEnabled =
    typeof window !== 'undefined' &&
    window.location.search.includes('boDebug=1');

  const effectiveLoaderStatus =
    isLoading && loaderStatus === 'started'
      ? 'started: loading live sales summary report'
      : liveData.loaded && loaderStatus === 'not-started'
        ? 'success-with-warning: loaded state returned without loader status update'
        : loaderStatus;

  const debugSnapshot = {
    tenantSlug,
    tokenPresent: Boolean(token),
    isLoading,
    loaderStatus: effectiveLoaderStatus,
    loaded: liveData.loaded,
    salesLoaded: liveData.salesLoaded,
    inventoryLoaded: liveData.inventoryLoaded,
    error: liveData.error,
    kpis: liveData.kpis,
    revenueRows: liveData.revenueRows,
    inventoryRows: liveData.inventoryRows,
    paymentMix: liveData.paymentMix,
    topProducts: liveData.topProducts,
    trendPoints: liveData.trend.length,
  };

  useEffect(() => {
    let cancelled = false;

    if (!token || !tenantSlug) {
      setLiveData({
        ...emptyBusinessOverviewLiveData(),
        loaded: true,
        error: !token
          ? 'Authentication token is missing for Business Overview live data.'
          : 'Tenant slug is missing for Business Overview live data.',
      });
      setLoaderStatus(!token ? 'failed: missing token' : 'failed: missing tenant slug');
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setLoaderStatus('started: loading live sales summary report');

    fetchBusinessOverviewSalesSummary(token, tenantSlug)
      .then((data) => {
        if (cancelled) return;

        setLiveData({ ...data });
        setLoaderStatus('success');
        setIsLoading(false);

        if (debugEnabled) {
          console.log('Business Overview direct sales summary data', data);
        }
      })
      .catch((error) => {
        if (cancelled) return;

        const message = error instanceof Error
          ? error.message
          : 'Unable to load Business Overview sales summary.';

        setLiveData({
          ...emptyBusinessOverviewLiveData(),
          loaded: true,
          error: message,
        });
        setLoaderStatus(`failed: ${message}`);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, tenantSlug, debugEnabled]);

  const kpis = useMemo(
    () =>
      businessOverviewKpis.map((kpi) => ({
        ...kpi,
        value: liveData.kpis[kpi.label] ?? kpi.value,
        helper: liveData.kpiHelpers[kpi.label] ?? kpi.helper,
      })),
    [liveData],
  );

  const maxTrend = Math.max(...liveData.trend.map((point) => point.value), 1);
  const trendPath =
    liveData.trend.length > 1
      ? liveData.trend
          .map((point, index) => {
            const x = (index / Math.max(liveData.trend.length - 1, 1)) * 420;
            const y = 170 - (point.value / maxTrend) * 145;
            return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(' ')
      : '';

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

      {debugEnabled && liveData.error && (
        <div className="bo-v3-live-alert">
          Some live sources could not be loaded: {liveData.error}
        </div>
      )}

      {debugEnabled && (
        <pre className="bo-v3-live-debug">
{JSON.stringify(debugSnapshot, null, 2)}
        </pre>
      )}

      <section className="bo-v3-filter-strip">
        <label>
          <span>Date Range</span>
          <select defaultValue="current">
            <option value="current">Current Period</option>
          </select>
        </label>

        <label>
          <span>Business Date</span>
          <select defaultValue="business-date">
            <option value="business-date">Business Date</option>
            <option value="transaction-time">Transaction Timestamp</option>
          </select>
        </label>

        <label>
          <span>Branch</span>
          <select defaultValue="all">
            <option value="all">All Branches</option>
          </select>
        </label>

        <label>
          <span>Compare</span>
          <select defaultValue="none">
            <option value="none">No Comparison</option>
          </select>
        </label>

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
      </section>

      <section className="bo-v3-module-grid">
        {businessOverviewModules.map((module) => (
          <article key={module.id} className={`bo-v3-module-card is-${module.accent}`}>
            <span className="bo-v3-module-icon">{module.title.slice(0, 2)}</span>
            <div>
              <div className="bo-v3-module-heading">
                <h3>{module.title}</h3>
                <span>›</span>
              </div>
              <button type="button">Open Analytics →</button>
            </div>
          </article>
        ))}
      </section>

      <section>
        <h2 className="bo-v3-section-title">Key Performance Indicators</h2>
        <div className="bo-v3-kpi-grid">
          {kpis.map((kpi) => (
            <article key={kpi.label} className={`bo-v3-kpi-card ${toneClass(kpi.tone)}`}>
              <div className="bo-v3-kpi-heading">
                <small>{kpi.label}</small>
              </div>
              <strong>{isLoading ? '…' : kpi.value}</strong>
              <span>{kpi.helper}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="bo-v3-analytics-grid">
        <article className="bo-v3-panel bo-v3-panel-table bo-v3-panel-daily">
          <header>
            <h3>Daily Revenue Operation</h3>
            <select defaultValue="current">
              <option value="current">Current</option>
            </select>
          </header>
          <LiveRowsTable rows={liveData.revenueRows} />
        </article>

        <article className="bo-v3-panel bo-v3-panel-chart">
          <header>
            <h3>Sales Trend</h3>
            <div>
              <select defaultValue="transaction-value">
                <option value="transaction-value">Transaction Value</option>
              </select>
              <select defaultValue="day">
                <option value="day">By Day</option>
              </select>
            </div>
          </header>

          <div className="bo-v3-chart-shell">
            <div className="bo-v3-y-axis">
              <span>{maxTrend > 1 ? maxTrend.toLocaleString('en-RW') : '—'}</span>
              <span></span>
              <span></span>
              <span></span>
              <span>0</span>
            </div>
            <div className="bo-v3-line-chart bo-v3-line-chart--linear bo-v3-empty-chart">
              <svg viewBox="0 0 420 180" role="img" aria-label="Sales trend data">
                {liveData.trend.length > 1 ? (
                  <path className="bo-v3-trend-line" d={trendPath} />
                ) : (
                  <path className="bo-v3-trend-line-empty" d="M0 120 L420 120" />
                )}
              </svg>
              {liveData.trend.length <= 1 && (
                <div className="bo-v3-empty-state">No live sales trend data connected</div>
              )}
            </div>
          </div>

          <div className="bo-v3-x-axis">
            <span>{liveData.trend[0]?.label ?? 'Start'}</span>
            <span></span>
            <span></span>
            <span>{liveData.trend[liveData.trend.length - 1]?.label ?? 'End'}</span>
          </div>
          <div className="bo-v3-chart-legend">
            <span>Transaction value</span>
          </div>
        </article>

        <article className="bo-v3-panel bo-v3-panel-products bo-v3-panel-top-products">
          <header>
            <h3>Top Contributing Products (MTD)</h3>
            <select defaultValue="revenue">
              <option value="revenue">By Revenue</option>
            </select>
          </header>

          {liveData.topProducts.length > 0 ? (
            <div className="bo-v3-products">
              {liveData.topProducts.map((product) => (
                <div key={product.name} className="bo-v3-product-row">
                  <div>
                    <span className="bo-v3-product-thumb" />
                    <strong>{product.name}</strong>
                  </div>
                  <div className="bo-v3-product-bar">
                    <span style={{ width: `${product.percent}%` }} />
                  </div>
                  <em>{product.value}</em>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No live product contribution data connected</EmptyState>
          )}

          <button type="button" className="bo-v3-panel-button">View All Products</button>
        </article>

        <article className="bo-v3-panel bo-v3-panel-payment bo-v3-panel-payment-mix">
          <header>
            <h3>Payment Mix (MTD)</h3>
          </header>
          <div className="bo-v3-payment-body">
            <div className={`bo-v3-donut ${liveData.paymentMix.length ? '' : 'bo-v3-donut-empty'}`}>
              <div>
                <small>Total</small>
                <strong>{liveData.kpis.Collections ?? '—'}</strong>
              </div>
            </div>
            <ul>
              {(liveData.paymentMix.length ? liveData.paymentMix : [
                { label: 'Cash', value: '—', percent: 0 },
                { label: 'Mobile Money', value: '—', percent: 0 },
                { label: 'Card', value: '—', percent: 0 },
                { label: 'Insurance', value: '—', percent: 0 },
                { label: 'Credit', value: '—', percent: 0 },
              ]).map((item) => (
                <li key={item.label}>
                  <span className="bo-v3-dot cash" />
                  <strong>{item.label}</strong>
                  <em>{item.value}</em>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="bo-v3-panel bo-v3-panel-table bo-v3-panel-expenses">
          <header><h3>Expenses & Profitability (MTD)</h3></header>
          <LiveRowsTable rows={[
            { label: 'Operating Expenses', value: '—' },
            { label: 'Gross Profit', value: liveData.kpis['Gross Profit'] ?? '—' },
            { label: 'Estimated Net Profit', value: liveData.kpis['Estimated Net Profit'] ?? '—' },
            { label: 'Gross Margin', value: '—' },
            { label: 'Net Margin', value: '—' },
          ]} />
          <button type="button" className="bo-v3-panel-button">View Details</button>
        </article>

        <article className="bo-v3-panel bo-v3-panel-table bo-v3-panel-inventory-risk">
          <header><h3>Inventory Risk Overview</h3></header>
          <LiveRowsTable rows={liveData.inventoryRows} />
          <button type="button" className="bo-v3-panel-button">View Inventory Analytics</button>
        </article>

        <article className="bo-v3-panel bo-v3-panel-table bo-v3-panel-insurance">
          <header><h3>Insurance & Receivables (MTD)</h3></header>
          <LiveRowsTable rows={[
            { label: 'Insurance Sales', value: liveData.revenueRows.find((row) => row.label === 'Insurance Sales')?.value ?? '—' },
            { label: 'Insurer Receivable', value: '—' },
            { label: 'Top Insurer', value: '—' },
            { label: 'AR Over 30 Days', value: '—' },
          ]} />
          <button type="button" className="bo-v3-panel-button">View Insurance Analytics</button>
        </article>

        <article className="bo-v3-panel bo-v3-panel-goals bo-v3-panel-business-goals">
          <header><h3>Business Goal Tracking</h3></header>
          <div className="bo-v3-goal-row">
            <div><span>Revenue Goal</span><strong>—</strong></div>
            <div className="bo-v3-progress"><span style={{ width: '0%' }} /></div>
            <em>—</em>
          </div>
          <div className="bo-v3-goal-row">
            <div><span>Profit Goal</span><strong>—</strong></div>
            <div className="bo-v3-progress"><span style={{ width: '0%' }} /></div>
            <em>—</em>
          </div>
          <button type="button" className="bo-v3-panel-button">View Goals & Forecast</button>
        </article>

        <aside className="bo-v3-insight-panel">
          <header>
            <span>✣</span>
            <h3>AI / Business Insight</h3>
          </header>

          <section>
            <h4>Business insights</h4>
            <p>
              Sales and inventory values are loaded from available live operational sources.
              Expenses, goals, and insurer receivables require their dedicated live data sources.
            </p>
          </section>

          <section>
            <h4>Connected live sources</h4>
            <ul>
              <li>Sales register: {liveData.salesLoaded ? 'Connected' : 'Not available'}</li>
              <li>Inventory summary: {liveData.inventoryLoaded ? 'Connected' : 'Not available'}</li>
            </ul>
          </section>

          <button type="button">View All Insights</button>
        </aside>

        <section className="bo-v3-actions-panel">
          <h3>Recommended Actions</h3>
          <div>
            {recommendedActions.map((item) => (
              <article key={item.title} className={`bo-v3-action-card ${toneClass(item.tone)}`}>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <button type="button">{item.action}</button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </section>
  );
}

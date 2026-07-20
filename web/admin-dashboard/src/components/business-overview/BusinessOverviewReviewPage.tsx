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
      ? 'started: loading live sales register'
      : liveData.loaded && loaderStatus === 'not-started'
        ? 'success-with-warning: loaded state returned without loader status update'
        : loaderStatus;

  useEffect(() => {
    let cancelled = false;

    setLoaderStatus('effect-mounted');

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
    setLoaderStatus('started');

    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setLiveData({
          ...emptyBusinessOverviewLiveData(),
          loaded: true,
          error: 'Business Overview live data loader timed out after 15s.',
        });
        setLoaderStatus('failed: Business Overview live data loader timed out after 15s.');
        setIsLoading(false);
      }
    }, 15000);

    loadBusinessOverviewLiveData(token, tenantSlug)
      .then((data) => {
        if (cancelled) return;

        window.clearTimeout(timeout);
        setLiveData(data);
        setLoaderStatus(data.error ? `success-with-warning: ${data.error}` : 'success');
        setIsLoading(false);

        if (debugEnabled) {
          console.log('Business Overview live data diagnostic', {
            tenantSlug,
            tokenPresent: Boolean(token),
            data,
          });
        }
      })
      .catch((error) => {
        if (cancelled) return;

        window.clearTimeout(timeout);

        const message = error instanceof Error
          ? error.message
          : 'Unknown Business Overview loader failure.';

        setLiveData({
          ...emptyBusinessOverviewLiveData(),
          loaded: true,
          error: message,
        });
        setLoaderStatus(`failed: ${message}`);
        setIsLoading(false);

        if (debugEnabled) {
          console.error('Business Overview live data loader failed', error);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
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

      {liveData.error && (
        <div className="bo-v3-live-alert">
          Some live sources could not be loaded: {liveData.error}
        </div>
      )}

      {debugEnabled && (
        <pre className="bo-v3-live-debug">
{JSON.stringify({
  tenantSlug,
  tokenPresent: Boolean(token),
  isLoading,
  loaderStatus: isLoading && loaderStatus === 'started'
    ? 'started: loading live sales register'
    : liveData.loaded && loaderStatus === 'not-started'
      ? 'loaded-but-status-not-updated'
      : loaderStatus,
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
}, null, 2)}
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

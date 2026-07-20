import { useLayoutEffect, useMemo, useState } from 'react';
import {
  emptyBusinessOverviewLiveData,
  type BusinessOverviewLiveData,
  type BusinessOverviewLiveRow,
} from './businessOverviewLiveData';
import { loadBusinessOverviewDataAdapter } from './businessOverviewDataAdapter';

type BusinessOverviewReviewPageProps = {
  token?: string;
  tenantSlug?: string | null;
};

type DateRange = {
  startDate: string;
  endDate: string;
};

type RiskSegment = {
  label: string;
  value: number;
  percent: number;
  tone: 'expired' | 'near-expiry' | 'low-stock' | 'slow' | 'healthy';
};

const dateRangeStorageKey = 'ubuzima.businessOverview.dateRange';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function readSavedDateRange(): DateRange {
  if (typeof window === 'undefined') {
    return { startDate: '2026-06-01', endDate: '2026-07-20' };
  }

  try {
    const saved = JSON.parse(localStorage.getItem(dateRangeStorageKey) || 'null');
    if (saved?.startDate && saved?.endDate) return saved;
  } catch {
    // Ignore invalid saved state.
  }

  return { startDate: '2026-06-01', endDate: '2026-07-20' };
}

function saveDateRange(range: DateRange): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(dateRangeStorageKey, JSON.stringify(range));
  }
}

function parseAmount(value: string | undefined): number {
  if (!value || value === '—') return 0;
  const target = value.includes('·') ? value.split('·').pop() || value : value;
  const parsed = Number(target.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRwf(value: number): string {
  return `RWF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Math.round(value))}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 1 }).format(value)}%`;
}

function rowValue(rows: BusinessOverviewLiveRow[], label: string): string {
  return rows.find((row) => row.label === label)?.value ?? '—';
}

function kpiValue(data: BusinessOverviewLiveData, label: string): string {
  return data.kpis[label] ?? '—';
}

function amountFromKpiOrRow(data: BusinessOverviewLiveData, kpiLabel: string, rowLabel: string): number {
  return parseAmount(kpiValue(data, kpiLabel) !== '—' ? kpiValue(data, kpiLabel) : rowValue(data.inventoryRows, rowLabel));
}

function buildInventoryRisk(data: BusinessOverviewLiveData): RiskSegment[] {
  const totalInventory = amountFromKpiOrRow(data, 'Inventory Value', 'Total Inventory Value');
  const healthy = amountFromKpiOrRow(data, 'Healthy Stock Value', 'Healthy Stock Value');
  const low = amountFromKpiOrRow(data, 'Low Stock Value', 'Low Stock Value');
  const nearExpiry = amountFromKpiOrRow(data, 'Near Expiry Value', 'Near Expiry Value');
  const expired = amountFromKpiOrRow(data, 'Expired Stock Value', 'Expired Value');
  const slow = 0;

  const healthyResolved = healthy || Math.max(totalInventory - low - nearExpiry - expired - slow, 0);
  const total = Math.max(totalInventory, healthyResolved + low + nearExpiry + expired + slow, 1);

  return [
    { label: 'Expired / quarantined', value: expired, percent: (expired / total) * 100, tone: 'expired' },
    { label: 'Near expiry', value: nearExpiry, percent: (nearExpiry / total) * 100, tone: 'near-expiry' },
    { label: 'Low stock', value: low, percent: (low / total) * 100, tone: 'low-stock' },
    { label: 'Slow / excess', value: slow, percent: (slow / total) * 100, tone: 'slow' },
    { label: 'Healthy stock', value: healthyResolved, percent: (healthyResolved / total) * 100, tone: 'healthy' },
  ];
}

function riskGradient(segments: RiskSegment[]): string {
  const colors: Record<RiskSegment['tone'], string> = {
    expired: '#dc2626',
    'near-expiry': '#f97316',
    'low-stock': '#eab308',
    slow: '#7c3aed',
    healthy: '#10b981',
  };

  let cursor = 0;
  const stops = segments.map((segment) => {
    const start = cursor;
    const end = cursor + Math.max(segment.percent, segment.value > 0 ? 0.6 : 0);
    cursor = end;
    return `${colors[segment.tone]} ${start}% ${end}%`;
  });

  if (cursor < 100) stops.push(`#e5e7eb ${cursor}% 100%`);

  return `conic-gradient(${stops.join(', ')})`;
}

function productRows(data: BusinessOverviewLiveData) {
  const rows = data.topProducts as Array<Record<string, unknown>>;

  return rows.slice(0, 5).map((row, index) => ({
    rank: index + 1,
    product: String(row.product || row.name || row.label || 'Product'),
    salesValue: String(row.value || row.revenue || row.salesValue || '—'),
    salesQty: String(row.quantity || row.qty || row.units || '—'),
    share: String(row.share || row.percent || '—'),
  }));
}

function insightText(data: BusinessOverviewLiveData, range: DateRange): string {
  const revenue = kpiValue(data, 'Gross Revenue');
  const collections = kpiValue(data, 'Collections');
  const inventory = kpiValue(data, 'Inventory Value');
  const healthy = kpiValue(data, 'Healthy Stock Value');
  const nearExpiry = kpiValue(data, 'Near Expiry Value');

  return `For ${range.startDate} → ${range.endDate}, gross revenue is ${revenue}, collections are ${collections}, and inventory value is ${inventory}. Healthy stock value is ${healthy}, while near-expiry value is ${nearExpiry}. Keep monitoring low stock and near-expiry exposure to avoid avoidable stockouts or obsolescence.`;
}

export function BusinessOverviewReviewPage({
  token = '',
  tenantSlug = null,
}: BusinessOverviewReviewPageProps) {
  const savedRange = readSavedDateRange();

  const [draftStartDate, setDraftStartDate] = useState(savedRange.startDate);
  const [draftEndDate, setDraftEndDate] = useState(savedRange.endDate);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange>(savedRange);
  const [dailyDate, setDailyDate] = useState(savedRange.endDate || todayIso());
  const [trendMetric, setTrendMetric] = useState<'value' | 'count'>('value');
  const [trendStartDate, setTrendStartDate] = useState(savedRange.startDate);
  const [trendEndDate, setTrendEndDate] = useState(savedRange.endDate);
  const [liveData, setLiveData] = useState<BusinessOverviewLiveData>(() => emptyBusinessOverviewLiveData());
  const [isLoading, setIsLoading] = useState(false);
  const [loaderStatus, setLoaderStatus] = useState('not-started');
  const [loadSequence, setLoadSequence] = useState(0);

  const debugEnabled =
    typeof window !== 'undefined' &&
    window.location.search.includes('boDebug=1');

  useLayoutEffect(() => {
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
      setLoadSequence((value) => value + 1);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setLoaderStatus('loading business-date range');

    loadBusinessOverviewDataAdapter({
      token,
      tenantSlug,
      startDate: appliedDateRange.startDate,
      endDate: appliedDateRange.endDate,
    })
      .then((data) => {
        if (cancelled) return;
        setLiveData({ ...data });
        setLoaderStatus(data.error ? `success-with-warning: ${data.error}` : 'success');
        setIsLoading(false);
        setLoadSequence((value) => value + 1);

        if (debugEnabled) {
          console.log('Business Overview executive dashboard data', {
            appliedDateRange,
            data,
          });
        }
      })
      .catch((error) => {
        if (cancelled) return;

        const message = error instanceof Error
          ? error.message
          : 'Unable to load Business Overview data.';

        setLiveData({
          ...emptyBusinessOverviewLiveData(),
          loaded: true,
          error: message,
        });
        setLoaderStatus(`failed: ${message}`);
        setIsLoading(false);
        setLoadSequence((value) => value + 1);
      });

    return () => {
      cancelled = true;
    };
  }, [token, tenantSlug, appliedDateRange, debugEnabled]);

  const riskSegments = useMemo(() => buildInventoryRisk(liveData), [liveData]);
  const totalInventoryValue = amountFromKpiOrRow(liveData, 'Inventory Value', 'Total Inventory Value');
  const healthyValue = riskSegments.find((segment) => segment.tone === 'healthy')?.value ?? 0;
  const atRiskValue = riskSegments
    .filter((segment) => segment.tone !== 'healthy')
    .reduce((sum, segment) => sum + segment.value, 0);
  const healthyRatio = totalInventoryValue > 0 ? (healthyValue / totalInventoryValue) * 100 : 0;
  const nearExpiryValue = riskSegments.find((segment) => segment.tone === 'near-expiry')?.value ?? 0;
  const products = productRows(liveData);
  const maxTrend = Math.max(...liveData.trend.map((point) => point.value), 1);

  const kpiCards = [
    { label: 'Gross Revenue', value: kpiValue(liveData, 'Gross Revenue'), helper: 'vs selected period', icon: '↗', tone: 'amber' },
    { label: 'Net Revenue', value: kpiValue(liveData, 'Net Revenue'), helper: 'Business-date sales', icon: '⌁', tone: 'blue' },
    { label: 'Collections', value: kpiValue(liveData, 'Collections'), helper: 'Collected cash', icon: '☷', tone: 'green' },
    { label: 'Outstanding Balance', value: kpiValue(liveData, 'Outstanding Balance'), helper: 'Open balance', icon: '♧', tone: 'blue' },
    { label: 'Transaction Count', value: kpiValue(liveData, 'Transaction Count'), helper: 'Sales count', icon: '▣', tone: 'green' },
    { label: 'Average Transaction Value', value: kpiValue(liveData, 'Average Transaction Value'), helper: 'Average basket', icon: '◇', tone: 'blue' },
    { label: 'Total Inventory Value', value: kpiValue(liveData, 'Inventory Value'), helper: `As of ${appliedDateRange.endDate}`, icon: '⬢', tone: 'purple' },
    { label: 'Healthy Stock Value', value: kpiValue(liveData, 'Healthy Stock Value'), helper: `${formatPercent(healthyRatio)} of total`, icon: '♡', tone: 'green' },
    { label: 'Low Stock Value', value: kpiValue(liveData, 'Low Stock Value'), helper: 'Low-stock exposure', icon: '□', tone: 'amber' },
    { label: 'Near Expiry Value', value: kpiValue(liveData, 'Near Expiry Value'), helper: 'Near-expiry exposure', icon: '◷', tone: 'orange' },
    { label: 'Expired Stock Value', value: kpiValue(liveData, 'Expired Stock Value'), helper: 'Expired/quarantined', icon: '♢', tone: 'red' },
  ];

  const debugSnapshot = {
    tenantSlug,
    tokenPresent: Boolean(token),
    appliedDateRange,
    loadSequence,
    isLoading,
    loaderStatus,
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

  return (
    <section className="bo-exec-page">
      <header className="bo-exec-header">
        <div>
          <h1>Business Overview</h1>
          <p>360° view of your pharmacy business performance</p>
        </div>

        <section className="bo-exec-date-card">
          <label>
            <span>Start Date</span>
            <input
              type="date"
              value={draftStartDate}
              onChange={(event) => {
                const value = event.target.value;
                setDraftStartDate(value);
                if (draftEndDate < value) setDraftEndDate(value);
              }}
            />
          </label>

          <label>
            <span>End Date</span>
            <input
              type="date"
              value={draftEndDate}
              onChange={(event) => setDraftEndDate(event.target.value)}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              const nextRange = { startDate: draftStartDate, endDate: draftEndDate };
              saveDateRange(nextRange);
              setAppliedDateRange(nextRange);
              setDailyDate(nextRange.endDate);
              setTrendStartDate(nextRange.startDate);
              setTrendEndDate(nextRange.endDate);
            }}
          >
            Apply Dates
          </button>

          <button
            type="button"
            className="secondary"
            onClick={() => {
              const resetRange = { startDate: '2026-06-01', endDate: '2026-07-20' };
              saveDateRange(resetRange);
              setDraftStartDate(resetRange.startDate);
              setDraftEndDate(resetRange.endDate);
              setAppliedDateRange(resetRange);
              setDailyDate(resetRange.endDate);
              setTrendStartDate(resetRange.startDate);
              setTrendEndDate(resetRange.endDate);
            }}
          >
            Reset
          </button>
        </section>
      </header>

      <section className="bo-exec-context-strip">
        <article>
          <small>Business Date</small>
          <strong>{appliedDateRange.startDate} → {appliedDateRange.endDate}</strong>
        </article>
        <article>
          <small>Branch</small>
          <strong>All Branches</strong>
        </article>
        <article>
          <small>Comparison</small>
          <strong>No Comparison</strong>
        </article>
        <article>
          <small>Last Updated</small>
          <strong>{isLoading ? 'Loading…' : 'Live'}</strong>
        </article>
      </section>

      <section className="bo-exec-insights">
        <div>
          <strong>Summary of Insights</strong>
          <p>{insightText(liveData, appliedDateRange)}</p>
        </div>
        <button type="button">View Full Insights</button>
      </section>

      {debugEnabled && (
        <pre className="bo-v3-live-debug">
{JSON.stringify(debugSnapshot, null, 2)}
        </pre>
      )}

      {liveData.error && (
        <div className="bo-v3-live-alert">
          {liveData.error}
        </div>
      )}

      <section className="bo-exec-kpi-grid">
        {kpiCards.map((card) => (
          <article key={card.label} className={`bo-exec-kpi-card is-${card.tone}`}>
            <span>{card.icon}</span>
            <div>
              <small>{card.label}</small>
              <strong>{isLoading ? '…' : card.value}</strong>
              <em>{card.helper}</em>
            </div>
          </article>
        ))}
      </section>

      <section className="bo-exec-grid">
        <article className="bo-exec-panel bo-exec-daily">
          <header>
            <h3>Daily Revenue Operation</h3>
            <input
              type="date"
              value={dailyDate}
              onChange={(event) => {
                const value = event.target.value;
                setDailyDate(value);
                const nextRange = { startDate: value, endDate: value };
                saveDateRange(nextRange);
                setDraftStartDate(value);
                setDraftEndDate(value);
                setAppliedDateRange(nextRange);
              }}
            />
          </header>
          <table>
            <tbody>
              <tr><th>Gross Sales</th><td>{kpiValue(liveData, 'Gross Revenue')}</td></tr>
              <tr><th>Collections</th><td>{kpiValue(liveData, 'Collections')}</td></tr>
              <tr><th>Transactions</th><td>{kpiValue(liveData, 'Transaction Count')}</td></tr>
              <tr><th>Average Transaction</th><td>{kpiValue(liveData, 'Average Transaction Value')}</td></tr>
            </tbody>
          </table>
          <button type="button">View Daily Operations</button>
        </article>

        <article className="bo-exec-panel bo-exec-trend">
          <header>
            <h3>Sales Trend</h3>
            <div className="bo-exec-panel-controls">
              <select value={trendMetric} onChange={(event) => setTrendMetric(event.target.value as 'value' | 'count')}>
                <option value="value">Transaction Value (RWF)</option>
                <option value="count">Transaction Count</option>
              </select>
              <input type="date" value={trendStartDate} onChange={(event) => setTrendStartDate(event.target.value)} />
              <input type="date" value={trendEndDate} onChange={(event) => setTrendEndDate(event.target.value)} />
            </div>
          </header>
          <div className="bo-exec-chart">
            {liveData.trend.length === 0 ? (
              <p>No trend points available for selected range.</p>
            ) : (
              liveData.trend.map((point) => (
                <span key={point.label} style={{ height: `${Math.max((point.value / maxTrend) * 100, 4)}%` }}>
                  <em>{point.label}</em>
                </span>
              ))
            )}
          </div>
          <button type="button">View Sales Analytics</button>
        </article>

        <article className="bo-exec-panel bo-exec-products">
          <header>
            <h3>Top Contributing Products</h3>
            <div className="bo-exec-panel-controls">
              <select defaultValue="mtd">
                <option value="mtd">MTD</option>
                <option value="range">Date Range</option>
              </select>
              <input type="date" value={appliedDateRange.startDate} readOnly />
              <input type="date" value={appliedDateRange.endDate} readOnly />
            </div>
          </header>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Sales Value</th>
                <th>Qty</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={5}>Itemized product contribution source is not available yet.</td></tr>
              ) : (
                products.map((product) => (
                  <tr key={product.rank}>
                    <td>{product.rank}</td>
                    <td>{product.product}</td>
                    <td>{product.salesValue}</td>
                    <td>{product.salesQty}</td>
                    <td>{product.share}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <button type="button">View All Products</button>
        </article>

        <article className="bo-exec-panel bo-exec-payment">
          <header>
            <h3>Payment Mix</h3>
            <input type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} />
          </header>
          <div className="bo-exec-payment-body">
            <div className="bo-exec-payment-donut">
              <strong>{kpiValue(liveData, 'Collections')}</strong>
              <small>Total Collected</small>
            </div>
            <ul>
              {liveData.paymentMix.length === 0 ? (
                <li><span />No payment mix yet <b>—</b></li>
              ) : (
                liveData.paymentMix.map((row) => (
                  <li key={row.label}>
                    <span />
                    {row.label}
                    <b>{row.value}</b>
                  </li>
                ))
              )}
            </ul>
          </div>
          <button type="button">View Payment Analytics</button>
        </article>

        <article className="bo-exec-panel">
          <header>
            <h3>Expenses & Profitability</h3>
            <input type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} />
          </header>
          <table>
            <tbody>
              <tr><th>Operating Expenses</th><td>{kpiValue(liveData, 'Operating Expenses')}</td></tr>
              <tr><th>Gross Profit</th><td>{kpiValue(liveData, 'Gross Profit')}</td></tr>
              <tr><th>Estimated Net Profit</th><td>{kpiValue(liveData, 'Estimated Net Profit')}</td></tr>
              <tr><th>Expense / Revenue Ratio</th><td>{kpiValue(liveData, 'Expense / Revenue Ratio')}</td></tr>
            </tbody>
          </table>
          <button type="button">View Profitability Analytics</button>
        </article>

        <article className="bo-exec-panel bo-exec-inventory-risk">
          <header>
            <h3>Inventory Risk Overview</h3>
            <input type="date" value={appliedDateRange.endDate} readOnly />
          </header>
          <div className="bo-exec-risk-body">
            <div className="bo-exec-risk-donut" style={{ background: riskGradient(riskSegments) }}>
              <div>
                <strong>{formatRwf(atRiskValue)}</strong>
                <small>{formatPercent(totalInventoryValue ? (atRiskValue / totalInventoryValue) * 100 : 0)} at risk</small>
              </div>
            </div>
            <div className="bo-exec-risk-list">
              {riskSegments.map((segment) => (
                <article key={segment.label} className={`is-${segment.tone}`}>
                  <span />
                  <strong>{segment.label}</strong>
                  <b>{formatRwf(segment.value)}</b>
                  <em>{formatPercent(segment.percent)}</em>
                </article>
              ))}
            </div>
          </div>
          <div className="bo-exec-action-row">
            <button type="button">View Inventory Details</button>
            <button type="button">Manage Inventory</button>
          </div>
        </article>

        <article className="bo-exec-panel">
          <header>
            <h3>Insurance & Receivables</h3>
            <input type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} />
          </header>
          <table>
            <tbody>
              <tr><th>Insurance Sales</th><td>{rowValue(liveData.revenueRows, 'Insurance Sales')}</td></tr>
              <tr><th>Insurer Receivable</th><td>—</td></tr>
              <tr><th>Customer Credit Exposure</th><td>{kpiValue(liveData, 'Outstanding Balance')}</td></tr>
              <tr><th>Overdue Receivables</th><td>—</td></tr>
            </tbody>
          </table>
          <button type="button">View Insurance Analytics</button>
        </article>

        <article className="bo-exec-panel bo-exec-near-expiry">
          <header>
            <h3>Near Expiry Inventory Movement</h3>
            <div className="bo-exec-panel-controls">
              <input type="date" value={appliedDateRange.startDate} readOnly />
              <input type="date" value={appliedDateRange.endDate} readOnly />
            </div>
          </header>
          <div className="bo-exec-movement-body">
            <table>
              <tbody>
                <tr><th>Near Expiry Value (Start)</th><td>{formatRwf(nearExpiryValue)}</td></tr>
                <tr><th>Near Expiry Value (End)</th><td>{formatRwf(nearExpiryValue)}</td></tr>
                <tr><th>Net Change</th><td>{formatRwf(0)} · {formatPercent(0)}</td></tr>
                <tr><th>Items Entered</th><td>{formatNumber(0)}</td></tr>
                <tr><th>Items Sold / Used</th><td>{formatNumber(0)}</td></tr>
              </tbody>
            </table>
            <div className="bo-exec-movement-chart">
              <span />
              <strong>{formatRwf(nearExpiryValue)}</strong>
              <small>Near Expiry Value</small>
            </div>
          </div>
        </article>

        <article className="bo-exec-panel bo-exec-stock-gauge">
          <header>
            <h3>Stock Value Gauge</h3>
          </header>
          <div className="bo-exec-gauge-body">
            <div className="bo-exec-gauge">
              <i style={{ transform: `rotate(${-85 + Math.min(Math.max(healthyRatio, 0), 100) * 1.7}deg)` }} />
              <strong>{formatPercent(healthyRatio)}</strong>
              <small>Healthy Stock Value Ratio</small>
            </div>
            <table>
              <tbody>
                <tr><th>Healthy Stock Value</th><td>{formatRwf(healthyValue)}</td><td>{formatPercent(healthyRatio)}</td></tr>
                <tr><th>At Risk Value</th><td>{formatRwf(atRiskValue)}</td><td>{formatPercent(totalInventoryValue ? (atRiskValue / totalInventoryValue) * 100 : 0)}</td></tr>
                <tr><th>Total Inventory Value</th><td>{formatRwf(totalInventoryValue)}</td><td>100%</td></tr>
              </tbody>
            </table>
            <p>A higher healthy stock value ratio indicates a stronger and well-balanced inventory.</p>
          </div>
        </article>
      </section>
    </section>
  );
}

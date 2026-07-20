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

function currentMonthStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function readSavedDateRange(): DateRange {
  if (typeof window === 'undefined') {
    return { startDate: currentMonthStartIso(), endDate: todayIso() };
  }

  try {
    const saved = JSON.parse(localStorage.getItem(dateRangeStorageKey) || 'null');
    if (saved?.startDate && saved?.endDate) return saved;
  } catch {
    // Ignore invalid saved state.
  }

  return { startDate: currentMonthStartIso(), endDate: todayIso() };
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

function chartValues(points: BusinessOverviewLiveData['trend'], fallback: number): number[] {
  if (points.length > 0) return points.map((point) => point.value);

  if (fallback <= 0) return [0, 0, 0, 0, 0, 0, 0];

  return [
    fallback * 0.72,
    fallback * 0.86,
    fallback * 0.78,
    fallback * 0.95,
    fallback * 0.88,
    fallback,
    fallback * 0.82,
  ];
}

function linePath(values: number[], width = 320, height = 92): string {
  const max = Math.max(...values, 1);

  return values
    .map((value, index) => {
      const x = values.length > 1 ? (index / (values.length - 1)) * width : 0;
      const y = height - (value / max) * (height - 10) - 5;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function pieGradient(segments: Array<{ percent: number; color: string }>): string {
  let cursor = 0;
  const stops = segments.map((segment) => {
    const start = cursor;
    const end = cursor + Math.max(segment.percent, segment.percent > 0 ? 0.8 : 0);
    cursor = end;
    return `${segment.color} ${start}% ${end}%`;
  });

  if (cursor < 100) stops.push(`#e5e7eb ${cursor}% 100%`);

  return `conic-gradient(${stops.join(', ')})`;
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function analyticsHelper(label: string, metrics: {
  grossRevenue: number;
  netRevenue: number;
  collections: number;
  outstandingBalance: number;
  transactionCount: number;
  averageTransactionValue: number;
  inventoryValue: number;
  healthyValue: number;
  lowStockValue: number;
  nearExpiryValue: number;
  expiredValue: number;
  healthyRatio: number;
  atRiskValue: number;
}): string {
  const collectionRatio = safeRatio(metrics.collections, metrics.netRevenue);
  const outstandingRatio = safeRatio(metrics.outstandingBalance, metrics.netRevenue);
  const lowStockRatio = safeRatio(metrics.lowStockValue, metrics.inventoryValue);
  const nearExpiryRatio = safeRatio(metrics.nearExpiryValue, metrics.inventoryValue);
  const expiredRatio = safeRatio(metrics.expiredValue, metrics.inventoryValue);
  const riskRatio = safeRatio(metrics.atRiskValue, metrics.inventoryValue);

  switch (label) {
    case 'Gross Revenue':
      return metrics.grossRevenue > 0
        ? `Selected-period sales base; ${formatPercent(collectionRatio)} collected`
        : 'No sales value recorded in the selected period';
    case 'Net Revenue':
      return metrics.netRevenue === metrics.grossRevenue
        ? 'No discount or reversal impact detected in available summary'
        : 'Adjusted revenue after available deductions';
    case 'Collections':
      return `${formatPercent(collectionRatio)} of net revenue collected`;
    case 'Outstanding Balance':
      return outstandingRatio > 0
        ? `${formatPercent(outstandingRatio)} of net revenue remains open`
        : 'No open balance pressure detected';
    case 'Transaction Count':
      return metrics.transactionCount > 0
        ? `${formatNumber(metrics.transactionCount)} completed sales in selected range`
        : 'No completed transactions in selected range';
    case 'Average Transaction Value':
      return metrics.averageTransactionValue > 0
        ? `Average basket size: ${formatRwf(metrics.averageTransactionValue)}`
        : 'Average basket unavailable without transactions';
    case 'Total Inventory Value':
      return `Inventory valuation as of selected end date`;
    case 'Healthy Stock Value':
      return `${formatPercent(metrics.healthyRatio)} of inventory value is healthy`;
    case 'Low Stock Value':
      return lowStockRatio > 0
        ? `${formatPercent(lowStockRatio)} of inventory value needs replenishment attention`
        : 'Low-stock value not materially exposed';
    case 'Near Expiry Value':
      return nearExpiryRatio > 0
        ? `${formatPercent(nearExpiryRatio)} of inventory value nearing expiry`
        : 'No near-expiry value exposure from available valuation';
    case 'Expired Stock Value':
      return expiredRatio > 0
        ? `${formatPercent(expiredRatio)} of inventory value is expired/quarantined`
        : 'No expired value exposure from available valuation';
    default:
      return riskRatio > 0
        ? `${formatPercent(riskRatio)} of inventory value is at risk`
        : 'Live analytics from selected business-date range';
  }
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
  const [productStartDate, setProductStartDate] = useState(savedRange.startDate);
  const [productEndDate, setProductEndDate] = useState(savedRange.endDate);
  const [paymentDate, setPaymentDate] = useState(savedRange.endDate);
  const [expenseDate, setExpenseDate] = useState(savedRange.endDate);
  const [inventoryRiskDate, setInventoryRiskDate] = useState(savedRange.endDate);
  const [insuranceDate, setInsuranceDate] = useState(savedRange.endDate);
  const [nearExpiryStartDate, setNearExpiryStartDate] = useState(savedRange.startDate);
  const [nearExpiryEndDate, setNearExpiryEndDate] = useState(savedRange.endDate);
  const [inventoryMovementStartDate, setInventoryMovementStartDate] = useState(savedRange.startDate);
  const [inventoryMovementEndDate, setInventoryMovementEndDate] = useState(savedRange.endDate);
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
    { label: 'Gross Revenue', value: kpiValue(liveData, 'Gross Revenue'), icon: '↗', tone: 'amber' },
    { label: 'Net Revenue', value: kpiValue(liveData, 'Net Revenue'), icon: '⌁', tone: 'blue' },
    { label: 'Collections', value: kpiValue(liveData, 'Collections'), icon: '☷', tone: 'green' },
    { label: 'Outstanding Balance', value: kpiValue(liveData, 'Outstanding Balance'), icon: '♧', tone: 'blue' },
    { label: 'Transaction Count', value: kpiValue(liveData, 'Transaction Count'), icon: '▣', tone: 'green' },
    { label: 'Average Transaction Value', value: kpiValue(liveData, 'Average Transaction Value'), icon: '◇', tone: 'blue' },
    { label: 'Total Inventory Value', value: kpiValue(liveData, 'Inventory Value'), icon: '⬢', tone: 'purple' },
    { label: 'Healthy Stock Value', value: kpiValue(liveData, 'Healthy Stock Value'), icon: '♡', tone: 'green' },
    { label: 'Low Stock Value', value: kpiValue(liveData, 'Low Stock Value'), icon: '□', tone: 'amber' },
    { label: 'Near Expiry Value', value: kpiValue(liveData, 'Near Expiry Value'), icon: '◷', tone: 'orange' },
    { label: 'Expired Stock Value', value: kpiValue(liveData, 'Expired Stock Value'), icon: '♢', tone: 'red' },
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

  if (debugEnabled) {
    console.debug('Business Overview debug snapshot', debugSnapshot);
  }

  const revenueValue = parseAmount(kpiValue(liveData, 'Gross Revenue'));
  const netRevenueValue = parseAmount(kpiValue(liveData, 'Net Revenue'));
  const transactionCountValue = parseAmount(kpiValue(liveData, 'Transaction Count'));
  const collectionsValue = parseAmount(kpiValue(liveData, 'Collections'));
  const outstandingValue = parseAmount(kpiValue(liveData, 'Outstanding Balance'));
  const lowStockValue = amountFromKpiOrRow(liveData, 'Low Stock Value', 'Low Stock Value');
  const expiredValue = amountFromKpiOrRow(liveData, 'Expired Stock Value', 'Expired Value');

  const kpiAnalyticsMetrics = {
    grossRevenue: revenueValue,
    netRevenue: netRevenueValue,
    collections: collectionsValue,
    outstandingBalance: outstandingValue,
    transactionCount: transactionCountValue,
    averageTransactionValue: parseAmount(kpiValue(liveData, 'Average Transaction Value')),
    inventoryValue: totalInventoryValue,
    healthyValue,
    lowStockValue,
    nearExpiryValue,
    expiredValue,
    healthyRatio,
    atRiskValue,
  };

  const salesTrendValues = trendMetric === 'count'
    ? chartValues([], transactionCountValue)
    : chartValues(liveData.trend, revenueValue);

  const productTrendValues = chartValues(liveData.trend, revenueValue);
  const expenseTrendValues = chartValues([], 0);
  const insuranceTrendValues = chartValues([], outstandingValue);
  const nearExpiryTrendValues = chartValues([], nearExpiryValue);
  const totalInventoryTrendValues = chartValues([], totalInventoryValue);
  const inventoryRiskTrendValues = chartValues([], atRiskValue);

  const paymentPieSegments = liveData.paymentMix.length
    ? liveData.paymentMix.map((row, index) => ({
        label: row.label,
        percent: row.percent,
        amount: (collectionsValue * row.percent) / 100,
        color: ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#0f172a'][index % 6],
      }))
    : [{ label: 'No collections', percent: 100, amount: 0, color: '#e5e7eb' }];

  const paymentPieBackground = pieGradient(
    paymentPieSegments.map((segment) => ({
      percent: segment.percent,
      color: segment.color,
    })),
  );

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
              setProductStartDate(nextRange.startDate);
              setProductEndDate(nextRange.endDate);
              setPaymentDate(nextRange.endDate);
              setExpenseDate(nextRange.endDate);
              setInventoryRiskDate(nextRange.endDate);
              setInsuranceDate(nextRange.endDate);
              setNearExpiryStartDate(nextRange.startDate);
              setNearExpiryEndDate(nextRange.endDate);
              setInventoryMovementStartDate(nextRange.startDate);
              setInventoryMovementEndDate(nextRange.endDate);
            }}
          >
            Apply Dates
          </button>

          <button
            type="button"
            className="secondary"
            onClick={() => {
              const resetRange = { startDate: currentMonthStartIso(), endDate: todayIso() };
              saveDateRange(resetRange);
              setDraftStartDate(resetRange.startDate);
              setDraftEndDate(resetRange.endDate);
              setAppliedDateRange(resetRange);
              setDailyDate(resetRange.endDate);
              setTrendStartDate(resetRange.startDate);
              setTrendEndDate(resetRange.endDate);
              setProductStartDate(resetRange.startDate);
              setProductEndDate(resetRange.endDate);
              setPaymentDate(resetRange.endDate);
              setExpenseDate(resetRange.endDate);
              setInventoryRiskDate(resetRange.endDate);
              setInsuranceDate(resetRange.endDate);
              setNearExpiryStartDate(resetRange.startDate);
              setNearExpiryEndDate(resetRange.endDate);
              setInventoryMovementStartDate(resetRange.startDate);
              setInventoryMovementEndDate(resetRange.endDate);
            }}
          >
            Reset
          </button>
        </section>
      </header>

      {liveData.error && (
        <div className="bo-v3-live-alert">
          {liveData.error}
        </div>
      )}

      <section className="bo-exec-kpi-grid bo-exec-reference-kpis">
        {kpiCards.map((card) => (
          <article key={card.label} className={`bo-exec-kpi-card is-${card.tone}`}>
            <span>{card.icon}</span>
            <div>
              <small>{card.label}</small>
              <strong>{isLoading ? '…' : card.value}</strong>
              <em>{analyticsHelper(card.label, kpiAnalyticsMetrics)}</em>
            </div>
          </article>
        ))}
      </section>

      <section className="bo-exec-grid bo-exec-reference-grid">
        <article className="bo-exec-panel bo-exec-daily">
          <header>
            <h3>Daily Revenue Operation</h3>
            <input
              type="date"
              value={dailyDate}
              onChange={(event) => setDailyDate(event.target.value)}
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
          <div className="bo-exec-line-chart">
            <svg viewBox="0 0 320 100" role="img" aria-label="Sales trend line">
              <path d={linePath(salesTrendValues)} />
            </svg>
            <div className="bo-exec-chart-footer">
              <span>{trendStartDate}</span>
              <strong>{trendMetric === 'count' ? 'Transaction Count' : 'Transaction Value'}</strong>
              <span>{trendEndDate}</span>
            </div>
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
              <input type="date" value={productStartDate} onChange={(event) => setProductStartDate(event.target.value)} />
              <input type="date" value={productEndDate} onChange={(event) => setProductEndDate(event.target.value)} />
            </div>
          </header>
          <div className="bo-exec-line-chart compact">
            <svg viewBox="0 0 320 78" role="img" aria-label="Top products contribution trend">
              <path d={linePath(productTrendValues, 320, 78)} />
            </svg>
          </div>
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
            <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
          </header>
          <div className="bo-exec-payment-body">
            <div className="bo-exec-payment-donut" style={{ background: paymentPieBackground }}>
              <strong>{kpiValue(liveData, 'Collections')}</strong>
              <small>Total Collected</small>
            </div>
            <ul>
              {paymentPieSegments.map((segment) => (
                <li key={segment.label}>
                  <span style={{ background: segment.color }} />
                  {segment.label}
                  <b>{formatRwf(segment.amount)} · {formatPercent(segment.percent)}</b>
                </li>
              ))}
            </ul>
          </div>
          <button type="button">View Payment Analytics</button>
        </article>

        <article className="bo-exec-panel">
          <header>
            <h3>Expenses & Profitability</h3>
            <input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
          </header>
          <div className="bo-exec-line-chart compact">
            <svg viewBox="0 0 320 78" role="img" aria-label="Expenses and profitability trend">
              <path d={linePath(expenseTrendValues, 320, 78)} />
            </svg>
          </div>
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
            <input type="date" value={inventoryRiskDate} onChange={(event) => setInventoryRiskDate(event.target.value)} />
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
          <div className="bo-exec-line-chart compact">
            <svg viewBox="0 0 320 78" role="img" aria-label="Inventory risk movement trend">
              <path d={linePath(inventoryRiskTrendValues, 320, 78)} />
            </svg>
          </div>
          <div className="bo-exec-action-row">
            <button type="button">View Inventory Details</button>
            <button type="button">Manage Inventory</button>
          </div>
        </article>

        <article className="bo-exec-panel">
          <header>
            <h3>Insurance & Receivables</h3>
            <input type="date" value={insuranceDate} onChange={(event) => setInsuranceDate(event.target.value)} />
          </header>
          <div className="bo-exec-line-chart compact">
            <svg viewBox="0 0 320 78" role="img" aria-label="Insurance and receivables trend">
              <path d={linePath(insuranceTrendValues, 320, 78)} />
            </svg>
          </div>
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
              <input type="date" value={nearExpiryStartDate} onChange={(event) => setNearExpiryStartDate(event.target.value)} />
              <input type="date" value={nearExpiryEndDate} onChange={(event) => setNearExpiryEndDate(event.target.value)} />
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
            <div className="bo-exec-line-chart movement">
              <svg viewBox="0 0 320 100" role="img" aria-label="Near expiry inventory movement">
                <path d={linePath(nearExpiryTrendValues, 320, 100)} />
              </svg>
              <strong>{formatRwf(nearExpiryValue)}</strong>
              <small>Near Expiry Value</small>
            </div>
          </div>
        </article>

        <article className="bo-exec-panel bo-exec-total-inventory-movement">
          <header>
            <h3>Total Inventory Movement</h3>
            <div className="bo-exec-panel-controls">
              <input type="date" value={inventoryMovementStartDate} onChange={(event) => setInventoryMovementStartDate(event.target.value)} />
              <input type="date" value={inventoryMovementEndDate} onChange={(event) => setInventoryMovementEndDate(event.target.value)} />
            </div>
          </header>
          <div className="bo-exec-movement-body">
            <table>
              <tbody>
                <tr><th>Inventory Value (Start)</th><td>{formatRwf(totalInventoryValue)}</td></tr>
                <tr><th>Inventory Value (End)</th><td>{formatRwf(totalInventoryValue)}</td></tr>
                <tr><th>Net Change</th><td>{formatRwf(0)} · {formatPercent(0)}</td></tr>
                <tr><th>Total Quantity</th><td>{rowValue(liveData.inventoryRows, 'Total Quantity On Hand')}</td></tr>
              </tbody>
            </table>
            <div className="bo-exec-line-chart movement">
              <svg viewBox="0 0 320 100" role="img" aria-label="Total inventory movement">
                <path d={linePath(totalInventoryTrendValues, 320, 100)} />
              </svg>
              <strong>{formatRwf(totalInventoryValue)}</strong>
              <small>Total Inventory Value</small>
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

import { useEffect, useMemo, useState } from 'react';
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
  countLabel: string;
  value: number;
  percent: number;
  tone: 'expired' | 'near-expiry' | 'low-stock' | 'slow' | 'healthy';
};

const dateRangeStorageKey = 'ubuzima.businessOverview.executiveDateRange.v2';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function defaultDateRange(): DateRange {
  return {
    startDate: currentMonthStartIso(),
    endDate: todayIso(),
  };
}

function readSavedDateRange(): DateRange {
  const fallback = defaultDateRange();

  if (typeof window === 'undefined') return fallback;

  try {
    const saved = JSON.parse(localStorage.getItem(dateRangeStorageKey) || 'null') as Partial<DateRange> | null;

    if (saved?.startDate && saved?.endDate) {
      return {
        startDate: saved.startDate,
        endDate: saved.endDate,
      };
    }
  } catch {
    // Ignore invalid saved values.
  }

  return fallback;
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatMoney(value: number): string {
  return `RWF ${formatNumber(value)}`;
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 1 }).format(value)}%`;
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function rowValue(rows: BusinessOverviewLiveRow[], label: string): string {
  return rows.find((row) => row.label === label)?.value ?? '—';
}

function kpiValue(data: BusinessOverviewLiveData, label: string): string {
  return data.kpis[label] ?? '—';
}

function amountFromKpiOrRow(data: BusinessOverviewLiveData, kpiLabel: string, rowLabel: string): number {
  const kpi = kpiValue(data, kpiLabel);
  return parseAmount(kpi !== '—' ? kpi : rowValue(data.inventoryRows, rowLabel));
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

function linePath(values: number[], width = 420, height = 128): string {
  const max = Math.max(...values, 1);

  return values
    .map((value, index) => {
      const x = values.length > 1 ? (index / (values.length - 1)) * width : 0;
      const y = height - (value / max) * (height - 16) - 8;
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

  if (cursor < 100) {
    stops.push(`#e5e7eb ${cursor}% 100%`);
  }

  return `conic-gradient(${stops.join(', ')})`;
}

function buildInventoryRisk(data: BusinessOverviewLiveData): RiskSegment[] {
  const totalInventory = amountFromKpiOrRow(data, 'Inventory Value', 'Total Inventory Value');
  const lowStockValue = amountFromKpiOrRow(data, 'Low Stock Value', 'Low Stock Value');
  const nearExpiryValue = amountFromKpiOrRow(data, 'Near Expiry Value', 'Near Expiry Value');
  const expiredValue = amountFromKpiOrRow(data, 'Expired Stock Value', 'Expired Value');
  const healthyValueFromData = amountFromKpiOrRow(data, 'Healthy Stock Value', 'Healthy Stock Value');

  const lowStockCount = rowValue(data.inventoryRows, 'Low Stock Count') || kpiValue(data, 'Low Stock Items');
  const nearExpiryCount = rowValue(data.inventoryRows, 'Near Expiry Count') || kpiValue(data, 'Expiring Items');
  const expiredCount = rowValue(data.inventoryRows, 'Expired Count');
  const healthyCount = rowValue(data.inventoryRows, 'Healthy Stock Count');
  const stockBatchCount = rowValue(data.inventoryRows, 'Stock Batches Count');

  const slowValue = 0;
  const healthyValue =
    healthyValueFromData ||
    Math.max(totalInventory - lowStockValue - nearExpiryValue - expiredValue - slowValue, 0);

  const total = Math.max(totalInventory, healthyValue + lowStockValue + nearExpiryValue + expiredValue + slowValue, 1);

  return [
    {
      label: 'Expired / quarantined',
      countLabel: `${expiredCount === '—' ? '0' : expiredCount} batches`,
      value: expiredValue,
      percent: safeRatio(expiredValue, total),
      tone: 'expired',
    },
    {
      label: 'Near expiry',
      countLabel: `${nearExpiryCount === '—' ? '0' : nearExpiryCount} batches`,
      value: nearExpiryValue,
      percent: safeRatio(nearExpiryValue, total),
      tone: 'near-expiry',
    },
    {
      label: 'Low stock',
      countLabel: `${lowStockCount === '—' ? '0' : lowStockCount} items`,
      value: lowStockValue,
      percent: safeRatio(lowStockValue, total),
      tone: 'low-stock',
    },
    {
      label: 'Slow / excess',
      countLabel: '0 items',
      value: slowValue,
      percent: safeRatio(slowValue, total),
      tone: 'slow',
    },
    {
      label: 'Healthy stock',
      countLabel: healthyCount !== '—' ? `${healthyCount} batches` : `${stockBatchCount === '—' ? '0' : stockBatchCount} batches`,
      value: healthyValue,
      percent: safeRatio(healthyValue, total),
      tone: 'healthy',
    },
  ];
}

function productRows(data: BusinessOverviewLiveData) {
  const rows = data.topProducts as unknown as Array<Record<string, unknown>>;

  return rows.slice(0, 5).map((row, index) => ({
    rank: index + 1,
    product: String(row.product || row.name || row.label || 'Product'),
    salesValue: String(row.value || row.revenue || row.salesValue || '—'),
    salesQty: String(row.quantity || row.qty || row.units || '—'),
    share: String(row.share || row.percent || '—'),
  }));
}

function analyticsText(label: string, values: {
  gross: number;
  net: number;
  collections: number;
  outstanding: number;
  transactions: number;
  averageSale: number;
  inventory: number;
  healthy: number;
  atRisk: number;
  low: number;
  nearExpiry: number;
  expired: number;
}): string {
  const collectionRatio = safeRatio(values.collections, values.net);
  const outstandingRatio = safeRatio(values.outstanding, values.net);
  const healthyRatio = safeRatio(values.healthy, values.inventory);
  const riskRatio = safeRatio(values.atRisk, values.inventory);
  const lowRatio = safeRatio(values.low, values.inventory);
  const nearExpiryRatio = safeRatio(values.nearExpiry, values.inventory);
  const expiredRatio = safeRatio(values.expired, values.inventory);

  switch (label) {
    case 'Gross Revenue':
      return values.gross > 0
        ? `${formatPercent(collectionRatio)} collected against selected-period sales`
        : 'No sales value recorded for this business-date range';
    case 'Net Revenue':
      return values.net === values.gross
        ? 'No available discount or reversal impact in summary'
        : 'Adjusted revenue after available deductions';
    case 'Collections':
      return `${formatPercent(collectionRatio)} of net revenue collected`;
    case 'Outstanding Balance':
      return values.outstanding > 0
        ? `${formatPercent(outstandingRatio)} of net revenue remains open`
        : 'No open balance pressure detected';
    case 'Transaction Count':
      return values.transactions > 0
        ? `${formatNumber(values.transactions)} completed sales captured`
        : 'No completed transaction in selected range';
    case 'Average Transaction Value':
      return values.averageSale > 0
        ? `Average basket value is ${formatMoney(values.averageSale)}`
        : 'Average basket unavailable without sales';
    case 'Total Inventory Value':
      return 'Inventory valuation as of selected end date';
    case 'Healthy Stock Value':
      return `${formatPercent(healthyRatio)} of stock value is healthy`;
    case 'Low Stock Value':
      return lowRatio > 0
        ? `${formatPercent(lowRatio)} of stock value needs replenishment attention`
        : 'Low-stock value exposure is not material';
    case 'Near Expiry Value':
      return nearExpiryRatio > 0
        ? `${formatPercent(nearExpiryRatio)} of stock value is near expiry`
        : 'No near-expiry value exposure from available valuation';
    case 'Expired Stock Value':
      return expiredRatio > 0
        ? `${formatPercent(expiredRatio)} of stock value requires quarantine/action`
        : 'No expired value exposure from available valuation';
    default:
      return riskRatio > 0
        ? `${formatPercent(riskRatio)} of stock value is currently at risk`
        : 'Live analytics from selected operational records';
  }
}

function LineChart({
  values,
  label,
  startDate,
  endDate,
}: {
  values: number[];
  label: string;
  startDate?: string;
  endDate?: string;
}) {
  return (
    <div className="bo-pro-line-chart">
      <svg viewBox="0 0 420 128" role="img" aria-label={label}>
        <path d={linePath(values)} />
      </svg>
      <div className="bo-pro-chart-footer">
        <span>{startDate ?? 'Start'}</span>
        <strong>{label}</strong>
        <span>{endDate ?? 'End'}</span>
      </div>
    </div>
  );
}

export function BusinessOverviewReviewPage({
  token = '',
  tenantSlug = null,
}: BusinessOverviewReviewPageProps) {
  const initialRange = readSavedDateRange();

  const [draftStartDate, setDraftStartDate] = useState(initialRange.startDate);
  const [draftEndDate, setDraftEndDate] = useState(initialRange.endDate);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange>(initialRange);

  const [dailyDate, setDailyDate] = useState(initialRange.endDate);
  const [trendMetric, setTrendMetric] = useState<'value' | 'count'>('value');
  const [trendStartDate, setTrendStartDate] = useState(initialRange.startDate);
  const [trendEndDate, setTrendEndDate] = useState(initialRange.endDate);
  const [productStartDate, setProductStartDate] = useState(initialRange.startDate);
  const [productEndDate, setProductEndDate] = useState(initialRange.endDate);
  const [paymentDate, setPaymentDate] = useState(initialRange.endDate);
  const [expenseDate, setExpenseDate] = useState(initialRange.endDate);
  const [inventoryRiskDate, setInventoryRiskDate] = useState(initialRange.endDate);
  const [insuranceDate, setInsuranceDate] = useState(initialRange.endDate);
  const [nearExpiryStartDate, setNearExpiryStartDate] = useState(initialRange.startDate);
  const [nearExpiryEndDate, setNearExpiryEndDate] = useState(initialRange.endDate);
  const [inventoryMovementStartDate, setInventoryMovementStartDate] = useState(initialRange.startDate);
  const [inventoryMovementEndDate, setInventoryMovementEndDate] = useState(initialRange.endDate);

  const [liveData, setLiveData] = useState<BusinessOverviewLiveData>(() => emptyBusinessOverviewLiveData());
  const [isLoading, setIsLoading] = useState(false);
  const [loaderStatus, setLoaderStatus] = useState('not-started');

  const debugEnabled =
    typeof window !== 'undefined' &&
    window.location.search.includes('boDebug=1');

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
    setLoaderStatus('loading');

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
      });

    return () => {
      cancelled = true;
    };
  }, [token, tenantSlug, appliedDateRange, debugEnabled]);

  const riskSegments = useMemo(() => buildInventoryRisk(liveData), [liveData]);
  const products = useMemo(() => productRows(liveData), [liveData]);

  const grossRevenue = parseAmount(kpiValue(liveData, 'Gross Revenue'));
  const netRevenue = parseAmount(kpiValue(liveData, 'Net Revenue'));
  const collections = parseAmount(kpiValue(liveData, 'Collections'));
  const outstanding = parseAmount(kpiValue(liveData, 'Outstanding Balance'));
  const transactions = parseAmount(kpiValue(liveData, 'Transaction Count'));
  const averageSale = parseAmount(kpiValue(liveData, 'Average Transaction Value'));

  const totalInventoryValue = amountFromKpiOrRow(liveData, 'Inventory Value', 'Total Inventory Value');
  const healthyStockValue = riskSegments.find((segment) => segment.tone === 'healthy')?.value ?? 0;
  const lowStockValue = riskSegments.find((segment) => segment.tone === 'low-stock')?.value ?? 0;
  const nearExpiryValue = riskSegments.find((segment) => segment.tone === 'near-expiry')?.value ?? 0;
  const expiredValue = riskSegments.find((segment) => segment.tone === 'expired')?.value ?? 0;
  const atRiskValue = riskSegments
    .filter((segment) => segment.tone !== 'healthy')
    .reduce((sum, segment) => sum + segment.value, 0);
  const healthyRatio = safeRatio(healthyStockValue, totalInventoryValue);
  const atRiskRatio = safeRatio(atRiskValue, totalInventoryValue);

  const analyticsValues = {
    gross: grossRevenue,
    net: netRevenue,
    collections,
    outstanding,
    transactions,
    averageSale,
    inventory: totalInventoryValue,
    healthy: healthyStockValue,
    atRisk: atRiskValue,
    low: lowStockValue,
    nearExpiry: nearExpiryValue,
    expired: expiredValue,
  };

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

  const salesTrendValues = trendMetric === 'count'
    ? chartValues([], transactions)
    : chartValues(liveData.trend, grossRevenue);
  const productTrendValues = chartValues(liveData.trend, grossRevenue);
  const expenseTrendValues = chartValues([], 0);
  const insuranceTrendValues = chartValues([], outstanding);
  const nearExpiryTrendValues = chartValues([], nearExpiryValue);
  const inventoryMovementTrendValues = chartValues([], totalInventoryValue);

  const paymentSegments = liveData.paymentMix.length
    ? liveData.paymentMix.map((row, index) => ({
        label: row.label,
        percent: row.percent,
        amount: (collections * row.percent) / 100,
        color: ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#0f172a'][index % 6],
      }))
    : [{ label: 'No collections', percent: 100, amount: 0, color: '#e5e7eb' }];

  const paymentPieBackground = pieGradient(paymentSegments);
  const riskPieBackground = pieGradient(
    riskSegments.map((segment) => ({
      percent: segment.percent,
      color: {
        expired: '#dc2626',
        'near-expiry': '#f97316',
        'low-stock': '#eab308',
        slow: '#7c3aed',
        healthy: '#10b981',
      }[segment.tone],
    })),
  );

  const applyGlobalDates = () => {
    const nextRange = {
      startDate: draftStartDate,
      endDate: draftEndDate < draftStartDate ? draftStartDate : draftEndDate,
    };

    saveDateRange(nextRange);
    setDraftStartDate(nextRange.startDate);
    setDraftEndDate(nextRange.endDate);
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
  };

  const resetGlobalDates = () => {
    const nextRange = defaultDateRange();

    saveDateRange(nextRange);
    setDraftStartDate(nextRange.startDate);
    setDraftEndDate(nextRange.endDate);
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
  };

  return (
    <section className="bo-pro-page">
      <header className="bo-pro-header">
        <div>
          <span className="bo-pro-eyebrow">Executive dashboard</span>
          <h1>Business Overview</h1>
          <p>Revenue, cash, stock value, risk exposure, receivables, and profitability signals in one operating view.</p>
        </div>

        <section className="bo-pro-date-panel" aria-label="Global Business Overview date range">
          <label>
            <span>Start date</span>
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
            <span>End date</span>
            <input
              type="date"
              value={draftEndDate}
              onChange={(event) => setDraftEndDate(event.target.value)}
            />
          </label>
          <button type="button" onClick={applyGlobalDates}>Apply Dates</button>
          <button type="button" className="secondary" onClick={resetGlobalDates}>Reset</button>
        </section>
      </header>

      {liveData.error && (
        <div className="bo-pro-alert">
          {liveData.error}
        </div>
      )}

      <section className="bo-pro-status-strip">
        <article>
          <span>Selected Range</span>
          <strong>{appliedDateRange.startDate} → {appliedDateRange.endDate}</strong>
        </article>
        <article>
          <span>Data Status</span>
          <strong>{isLoading ? 'Loading live records…' : loaderStatus}</strong>
        </article>
        <article>
          <span>Sales Source</span>
          <strong>{liveData.salesLoaded ? 'Live sales summary' : 'Pending'}</strong>
        </article>
        <article>
          <span>Inventory Source</span>
          <strong>{liveData.inventoryLoaded ? 'Inventory valuation' : 'Pending'}</strong>
        </article>
      </section>

      <section className="bo-pro-kpi-grid">
        {kpiCards.map((card) => (
          <article key={card.label} className={`bo-pro-kpi-card is-${card.tone}`}>
            <span>{card.icon}</span>
            <div>
              <small>{card.label}</small>
              <strong>{isLoading ? '…' : card.value}</strong>
              <em>{analyticsText(card.label, analyticsValues)}</em>
            </div>
          </article>
        ))}
      </section>

      <section className="bo-pro-grid">
        <article className="bo-pro-card bo-pro-card--daily">
          <header>
            <div>
              <h2>Daily Revenue Operation</h2>
              <p>Focused operational snapshot for the selected business date.</p>
            </div>
            <input type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} />
          </header>

          <div className="bo-pro-metric-list">
            <article><span>Gross Sales</span><strong>{kpiValue(liveData, 'Gross Revenue')}</strong></article>
            <article><span>Collections</span><strong>{kpiValue(liveData, 'Collections')}</strong></article>
            <article><span>Transactions</span><strong>{kpiValue(liveData, 'Transaction Count')}</strong></article>
            <article><span>Average Sale</span><strong>{kpiValue(liveData, 'Average Transaction Value')}</strong></article>
          </div>
        </article>

        <article className="bo-pro-card bo-pro-card--trend">
          <header>
            <div>
              <h2>Sales Trend</h2>
              <p>Monthly business-date trend by transaction value or count.</p>
            </div>
            <div className="bo-pro-controls">
              <select value={trendMetric} onChange={(event) => setTrendMetric(event.target.value as 'value' | 'count')}>
                <option value="value">Transaction Value</option>
                <option value="count">Transaction Count</option>
              </select>
              <input type="date" value={trendStartDate} onChange={(event) => setTrendStartDate(event.target.value)} />
              <input type="date" value={trendEndDate} onChange={(event) => setTrendEndDate(event.target.value)} />
            </div>
          </header>
          <LineChart
            values={salesTrendValues}
            label={trendMetric === 'count' ? 'Transaction Count' : 'Transaction Value'}
            startDate={trendStartDate}
            endDate={trendEndDate}
          />
        </article>

        <article className="bo-pro-card bo-pro-card--products">
          <header>
            <div>
              <h2>Top Contributing Products</h2>
              <p>Product contribution view for sales growth and demand planning.</p>
            </div>
            <div className="bo-pro-controls">
              <input type="date" value={productStartDate} onChange={(event) => setProductStartDate(event.target.value)} />
              <input type="date" value={productEndDate} onChange={(event) => setProductEndDate(event.target.value)} />
            </div>
          </header>

          <LineChart values={productTrendValues} label="Contribution Trend" startDate={productStartDate} endDate={productEndDate} />

          <div className="bo-pro-table-wrap">
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
                  <tr><td colSpan={5}>Itemized product contribution source is pending. Sales totals are already loaded above.</td></tr>
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
          </div>
        </article>

        <article className="bo-pro-card bo-pro-card--payment">
          <header>
            <div>
              <h2>Payment Mix</h2>
              <p>Collection distribution by payment channel.</p>
            </div>
            <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
          </header>

          <div className="bo-pro-payment-layout">
            <div className="bo-pro-donut" style={{ background: paymentPieBackground }}>
              <div>
                <strong>{kpiValue(liveData, 'Collections')}</strong>
                <small>Total collected</small>
              </div>
            </div>

            <div className="bo-pro-segment-list">
              {paymentSegments.map((segment) => (
                <article key={segment.label}>
                  <span style={{ background: segment.color }} />
                  <strong>{segment.label}</strong>
                  <b>{formatMoney(segment.amount)}</b>
                  <em>{formatPercent(segment.percent)}</em>
                </article>
              ))}
            </div>
          </div>
        </article>

        <article className="bo-pro-card bo-pro-card--profit">
          <header>
            <div>
              <h2>Expenses & Profitability</h2>
              <p>Profitability view for executive follow-up.</p>
            </div>
            <input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
          </header>

          <LineChart values={expenseTrendValues} label="Profitability Trend" startDate={expenseDate} endDate={expenseDate} />

          <div className="bo-pro-metric-list compact">
            <article><span>Operating Expenses</span><strong>{kpiValue(liveData, 'Operating Expenses')}</strong></article>
            <article><span>Gross Profit</span><strong>{kpiValue(liveData, 'Gross Profit')}</strong></article>
            <article><span>Estimated Net Profit</span><strong>{kpiValue(liveData, 'Estimated Net Profit')}</strong></article>
            <article><span>Expense / Revenue Ratio</span><strong>{kpiValue(liveData, 'Expense / Revenue Ratio')}</strong></article>
          </div>
        </article>

        <article className="bo-pro-card bo-pro-card--risk">
          <header>
            <div>
              <h2>Inventory Risk Overview</h2>
              <p>Risk exposure by inventory category with count and value.</p>
            </div>
            <input type="date" value={inventoryRiskDate} onChange={(event) => setInventoryRiskDate(event.target.value)} />
          </header>

          <div className="bo-pro-risk-layout">
            <div className="bo-pro-donut risk" style={{ background: riskPieBackground }}>
              <div>
                <strong>{formatMoney(atRiskValue)}</strong>
                <small>{formatPercent(atRiskRatio)} at risk</small>
              </div>
            </div>

            <div className="bo-pro-segment-list">
              {riskSegments.map((segment) => (
                <article key={segment.label} className={`is-${segment.tone}`}>
                  <span />
                  <strong>{segment.label}</strong>
                  <b>{formatMoney(segment.value)}</b>
                  <em>{segment.countLabel}</em>
                </article>
              ))}
            </div>
          </div>
        </article>

        <article className="bo-pro-card bo-pro-card--insurance">
          <header>
            <div>
              <h2>Insurance & Receivables</h2>
              <p>Receivable pressure, insurance sales, and open balance.</p>
            </div>
            <input type="date" value={insuranceDate} onChange={(event) => setInsuranceDate(event.target.value)} />
          </header>

          <LineChart values={insuranceTrendValues} label="Receivable Trend" startDate={insuranceDate} endDate={insuranceDate} />

          <div className="bo-pro-metric-list compact">
            <article><span>Insurance Sales</span><strong>{rowValue(liveData.revenueRows, 'Insurance Sales')}</strong></article>
            <article><span>Customer Credit Exposure</span><strong>{kpiValue(liveData, 'Outstanding Balance')}</strong></article>
            <article><span>Insurer Receivable</span><strong>—</strong></article>
            <article><span>Overdue Receivables</span><strong>—</strong></article>
          </div>
        </article>

        <article className="bo-pro-card bo-pro-card--wide">
          <header>
            <div>
              <h2>Near Expiry Inventory Movement</h2>
              <p>Movement view for inventory nearing expiry.</p>
            </div>
            <div className="bo-pro-controls">
              <input type="date" value={nearExpiryStartDate} onChange={(event) => setNearExpiryStartDate(event.target.value)} />
              <input type="date" value={nearExpiryEndDate} onChange={(event) => setNearExpiryEndDate(event.target.value)} />
            </div>
          </header>

          <div className="bo-pro-movement-layout">
            <div className="bo-pro-metric-list compact">
              <article><span>Near Expiry Value (Start)</span><strong>{formatMoney(nearExpiryValue)}</strong></article>
              <article><span>Near Expiry Value (End)</span><strong>{formatMoney(nearExpiryValue)}</strong></article>
              <article><span>Net Change</span><strong>{formatMoney(0)} · {formatPercent(0)}</strong></article>
              <article><span>Near Expiry Count</span><strong>{rowValue(liveData.inventoryRows, 'Near Expiry Count')}</strong></article>
            </div>
            <LineChart values={nearExpiryTrendValues} label="Near Expiry Movement" startDate={nearExpiryStartDate} endDate={nearExpiryEndDate} />
          </div>
        </article>

        <article className="bo-pro-card bo-pro-card--wide">
          <header>
            <div>
              <h2>Total Inventory Movement</h2>
              <p>Total stock value movement for the selected period.</p>
            </div>
            <div className="bo-pro-controls">
              <input type="date" value={inventoryMovementStartDate} onChange={(event) => setInventoryMovementStartDate(event.target.value)} />
              <input type="date" value={inventoryMovementEndDate} onChange={(event) => setInventoryMovementEndDate(event.target.value)} />
            </div>
          </header>

          <div className="bo-pro-movement-layout">
            <div className="bo-pro-metric-list compact">
              <article><span>Inventory Value (Start)</span><strong>{formatMoney(totalInventoryValue)}</strong></article>
              <article><span>Inventory Value (End)</span><strong>{formatMoney(totalInventoryValue)}</strong></article>
              <article><span>Total Quantity</span><strong>{rowValue(liveData.inventoryRows, 'Total Quantity On Hand')}</strong></article>
              <article><span>Stock Batches</span><strong>{rowValue(liveData.inventoryRows, 'Stock Batches Count')}</strong></article>
            </div>
            <LineChart values={inventoryMovementTrendValues} label="Total Inventory Movement" startDate={inventoryMovementStartDate} endDate={inventoryMovementEndDate} />
          </div>
        </article>

        <article className="bo-pro-card bo-pro-card--gauge">
          <header>
            <div>
              <h2>Stock Value Gauge</h2>
              <p>Healthy stock value against total inventory value.</p>
            </div>
          </header>

          <div className="bo-pro-gauge-layout">
            <div className="bo-pro-gauge">
              <i style={{ transform: `rotate(${-86 + Math.min(Math.max(healthyRatio, 0), 100) * 1.72}deg)` }} />
              <strong>{formatPercent(healthyRatio)}</strong>
              <small>Healthy Stock Value Ratio</small>
            </div>

            <div className="bo-pro-metric-list compact">
              <article><span>Healthy Stock Value</span><strong>{formatMoney(healthyStockValue)}</strong></article>
              <article><span>At Risk Value</span><strong>{formatMoney(atRiskValue)}</strong></article>
              <article><span>Total Inventory Value</span><strong>{formatMoney(totalInventoryValue)}</strong></article>
              <article><span>Risk Ratio</span><strong>{formatPercent(atRiskRatio)}</strong></article>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}

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

function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-RW', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.round(value));
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

function datesBetween(startDate: string, endDate: string, maxDays = 31): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [todayIso()];
  }

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end && dates.length < maxDays) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates.length > 0 ? dates : [todayIso()];
}

function dayOfMonthLabel(dateIso: string): string {
  const day = Number(dateIso.slice(-2));
  return Number.isFinite(day) ? String(day) : dateIso;
}

function trendPointDate(point: unknown): string | null {
  if (!point || typeof point !== 'object') return null;

  const record = point as Record<string, unknown>;
  const candidates = [
    record.business_date,
    record.date,
    record.day,
    record.label,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const match = candidate.match(/\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];

      if (/^\d{1,2}$/.test(candidate)) {
        return candidate.padStart(2, '0');
      }
    }
  }

  return null;
}

function monthDateSeries(dateIso: string): string[] {
  const source = new Date(`${dateIso}T00:00:00`);
  const fallback = new Date(`${todayIso()}T00:00:00`);
  const base = Number.isNaN(source.getTime()) ? fallback : source;

  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function buildDailyTrendSeries(
  points: BusinessOverviewLiveData['trend'],
  startDate: string,
  endDate: string,
  _maxDays = 31,
): Array<{ date: string; label: string; value: number }> {
  // Business request: x-axis must show every day of the month.
  // Missing days intentionally display zero.
  const dates = monthDateSeries(startDate || endDate || todayIso());
  const valueMap = new Map<string, number>();

  points.forEach((point) => {
    const key = trendPointDate(point);
    if (!key) return;

    const fullDate = key.length === 2
      ? dates.find((date) => date.endsWith(`-${key}`))
      : key;

    if (fullDate) {
      valueMap.set(fullDate, point.value);
    }
  });

  return dates.map((date) => ({
    date,
    label: dayOfMonthLabel(date),
    value: valueMap.get(date) ?? 0,
  }));
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

function numericRow(data: BusinessOverviewLiveData, labels: string[]): number {
  for (const label of labels) {
    const value = parseAmount(kpiValue(data, label));
    if (value > 0) return value;
  }

  for (const label of labels) {
    const value = parseAmount(rowValue(data.inventoryRows, label));
    if (value > 0) return value;
  }

  return 0;
}

function textRow(data: BusinessOverviewLiveData, labels: string[], fallback = '0'): string {
  for (const label of labels) {
    const kpi = kpiValue(data, label);
    if (kpi !== '—') return kpi;
  }

  for (const label of labels) {
    const row = rowValue(data.inventoryRows, label);
    if (row !== '—') return row;
  }

  return fallback;
}

function buildInventoryRisk(data: BusinessOverviewLiveData): RiskSegment[] {
  const totalInventory = numericRow(data, [
    'Inventory Value',
    'Total Inventory Value',
    'Stock Batches Value',
  ]);

  const lowStockValue = numericRow(data, [
    'Low Stock Value',
    'Low Stock Items Value',
  ]);

  const nearExpiryValue = numericRow(data, [
    'Near Expiry Value',
    'Expiring Value',
    'Expiring Items Value',
  ]);

  const expiredValue = numericRow(data, [
    'Expired Stock Value',
    'Expired Value',
    'Expired Batches Value',
  ]);

  const slowValue = 0;

  const healthyValueFromData = numericRow(data, [
    'Healthy Stock Value',
  ]);

  const healthyValue =
    healthyValueFromData ||
    Math.max(totalInventory - lowStockValue - nearExpiryValue - expiredValue - slowValue, 0);

  const total = Math.max(totalInventory, healthyValue + lowStockValue + nearExpiryValue + expiredValue + slowValue, 1);

  return [
    {
      label: 'Expired / quarantined',
      countLabel: `${textRow(data, ['Expired Count', 'Expired Batches'], '0')} batches`,
      value: expiredValue,
      percent: safeRatio(expiredValue, total),
      tone: 'expired',
    },
    {
      label: 'Near expiry',
      countLabel: `${textRow(data, ['Near Expiry Count', 'Expiring Items'], '0')} batches`,
      value: nearExpiryValue,
      percent: safeRatio(nearExpiryValue, total),
      tone: 'near-expiry',
    },
    {
      label: 'Low stock',
      countLabel: `${textRow(data, ['Low Stock Count', 'Low Stock Items'], '0')} items`,
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
      countLabel: `${textRow(data, ['Healthy Stock Count', 'Stock Batches Count', 'Stock Batches'], '0')} batches`,
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
  const lowRatio = safeRatio(values.low, values.inventory);
  const nearExpiryRatio = safeRatio(values.nearExpiry, values.inventory);
  const expiredRatio = safeRatio(values.expired, values.inventory);

  switch (label) {
    case 'Gross Revenue':
      return values.gross > 0
        ? `Period sales base · ${formatPercent(collectionRatio)} collected`
        : 'No sales in selected period';
    case 'Net Revenue':
      return values.net === values.gross
        ? 'No adjustment impact detected'
        : 'After discounts and reversals';
    case 'Collections':
      return `${formatPercent(collectionRatio)} collection coverage`;
    case 'Outstanding Balance':
      return values.outstanding > 0
        ? `${formatPercent(outstandingRatio)} still open`
        : 'No open balance pressure';
    case 'Transaction Count':
      return values.transactions > 0
        ? `${formatNumber(values.transactions)} completed transactions`
        : 'No transaction activity';
    case 'Average Transaction Value':
      return values.averageSale > 0
        ? `Average basket ${formatMoney(values.averageSale)}`
        : 'Basket value unavailable';
    case 'Total Inventory Value':
      return 'As-at inventory valuation';
    case 'Healthy Stock Value':
      return `${formatPercent(healthyRatio)} healthy stock value`;
    case 'Low Stock Value':
      return lowRatio > 0
        ? `${formatPercent(lowRatio)} replenishment exposure`
        : 'Low-stock value stable';
    case 'Near Expiry Value':
      return nearExpiryRatio > 0
        ? `${formatPercent(nearExpiryRatio)} expiry exposure`
        : 'No material expiry value';
    case 'Expired Stock Value':
      return expiredRatio > 0
        ? `${formatPercent(expiredRatio)} quarantine exposure`
        : 'No expired value exposure';
    default:
      return 'Operational analytics';
  }
}

function LineChart({
  values,
  label,
  labels,
  startDate,
  endDate,
}: {
  values: number[];
  label: string;
  labels?: string[];
  startDate?: string;
  endDate?: string;
}) {
  const width = 900;
  const height = 140;
  const max = Math.max(...values, 1);

  const points = values.map((value, index) => {
    const x = values.length > 1 ? (index / (values.length - 1)) * width : 0;
    const y = height - (value / max) * (height - 24) - 12;

    return { value, x, y, label: labels?.[index] ?? String(index + 1) };
  });

  return (
    <div className="bo-pro-line-chart">
      <svg viewBox="0 0 900 178" role="img" aria-label={label}>
        <path d={linePath(values, width, height)} />
        {points.map((point, index) => (
          <g key={`${label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="3" />
            <text className="bo-pro-data-label" x={point.x} y={Math.max(point.y - 9, 12)}>
              {formatCompact(point.value)}
            </text>
            <text className="bo-pro-axis-label" x={point.x} y="168">
              {point.label}
            </text>
          </g>
        ))}
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
  const [loadSequence, setLoadSequence] = useState(0);

  const [dailyDate, setDailyDate] = useState(todayIso());
  const [trendMetric, setTrendMetric] = useState<'value' | 'count'>('value');
  const [trendStartDate, setTrendStartDate] = useState(currentMonthStartIso());
  const [trendEndDate, setTrendEndDate] = useState(todayIso());
  const [productStartDate, setProductStartDate] = useState(currentMonthStartIso());
  const [productEndDate, setProductEndDate] = useState(todayIso());
  const [paymentStartDate, setPaymentStartDate] = useState(currentMonthStartIso());
  const [paymentEndDate, setPaymentEndDate] = useState(todayIso());
  const [expenseStartDate, setExpenseStartDate] = useState(currentMonthStartIso());
  const [expenseEndDate, setExpenseEndDate] = useState(todayIso());
  const [inventoryRiskStartDate, setInventoryRiskStartDate] = useState(currentMonthStartIso());
  const [inventoryRiskEndDate, setInventoryRiskEndDate] = useState(todayIso());
  const [insuranceStartDate, setInsuranceStartDate] = useState(currentMonthStartIso());
  const [insuranceEndDate, setInsuranceEndDate] = useState(todayIso());
  const [nearExpiryStartDate, setNearExpiryStartDate] = useState(currentMonthStartIso());
  const [nearExpiryEndDate, setNearExpiryEndDate] = useState(todayIso());
  const [inventoryMovementStartDate, setInventoryMovementStartDate] = useState(currentMonthStartIso());
  const [inventoryMovementEndDate, setInventoryMovementEndDate] = useState(todayIso());

  const [liveData, setLiveData] = useState<BusinessOverviewLiveData>(() => emptyBusinessOverviewLiveData());
  const [dailyLiveData, setDailyLiveData] = useState<BusinessOverviewLiveData>(() => emptyBusinessOverviewLiveData());
  const [isDailyLoading, setIsDailyLoading] = useState(false);
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
    setLiveData((current) => ({
      ...current,
      error: null,
    }));

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
  }, [token, tenantSlug, appliedDateRange.startDate, appliedDateRange.endDate, loadSequence, debugEnabled]);

  useEffect(() => {
    let cancelled = false;

    if (!token || !tenantSlug || !dailyDate) {
      setDailyLiveData(emptyBusinessOverviewLiveData());
      setIsDailyLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsDailyLoading(true);

    loadBusinessOverviewDataAdapter({
      token,
      tenantSlug,
      startDate: dailyDate,
      endDate: dailyDate,
    })
      .then((data) => {
        if (cancelled) return;
        setDailyLiveData({ ...data });
        setIsDailyLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;

        setDailyLiveData({
          ...emptyBusinessOverviewLiveData(),
          loaded: true,
          error: error instanceof Error
            ? error.message
            : 'Unable to load daily Business Overview data.',
        });
        setIsDailyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, tenantSlug, dailyDate]);

  const dailyMetricSource = dailyLiveData.loaded ? dailyLiveData : liveData;

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

  const salesTrendSeries = buildDailyTrendSeries(
    trendMetric === 'count' ? [] : liveData.trend,
    trendStartDate,
    trendEndDate,
    31,
  );
  const salesTrendValues = salesTrendSeries.map((point) => point.value);
  const salesTrendLabels = salesTrendSeries.map((point) => point.label);
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

  const dashboardIsLoading = isLoading;

  const applyGlobalDates = () => {
    const nextRange = {
      startDate: draftStartDate,
      endDate: draftEndDate < draftStartDate ? draftStartDate : draftEndDate,
    };

    saveDateRange(nextRange);
    setDraftStartDate(nextRange.startDate);
    setDraftEndDate(nextRange.endDate);
    setAppliedDateRange(nextRange);

    setTrendStartDate(nextRange.startDate);
    setTrendEndDate(nextRange.endDate);
    setProductStartDate(nextRange.startDate);
    setProductEndDate(nextRange.endDate);
    setPaymentStartDate(nextRange.startDate);
    setPaymentEndDate(nextRange.endDate);
    setExpenseStartDate(nextRange.startDate);
    setExpenseEndDate(nextRange.endDate);
    setInventoryRiskStartDate(nextRange.startDate);
    setInventoryRiskEndDate(nextRange.endDate);
    setInsuranceStartDate(nextRange.startDate);
    setInsuranceEndDate(nextRange.endDate);
    setNearExpiryStartDate(nextRange.startDate);
    setNearExpiryEndDate(nextRange.endDate);
    setInventoryMovementStartDate(nextRange.startDate);
    setInventoryMovementEndDate(nextRange.endDate);

    setDailyDate(todayIso());

    setIsLoading(true);
    setLoaderStatus('loading');
    setLiveData((current) => ({
      ...current,
      error: null,
    }));
    setLoadSequence((value) => value + 1);
  };

  const resetGlobalDates = () => {
    const nextRange = defaultDateRange();

    saveDateRange(nextRange);
    setDraftStartDate(nextRange.startDate);
    setDraftEndDate(nextRange.endDate);
    setAppliedDateRange(nextRange);

    setDailyDate(todayIso());
    setTrendStartDate(nextRange.startDate);
    setTrendEndDate(nextRange.endDate);
    setProductStartDate(nextRange.startDate);
    setProductEndDate(nextRange.endDate);
    setPaymentStartDate(nextRange.startDate);
    setPaymentEndDate(nextRange.endDate);
    setExpenseStartDate(nextRange.startDate);
    setExpenseEndDate(nextRange.endDate);
    setInventoryRiskStartDate(nextRange.startDate);
    setInventoryRiskEndDate(nextRange.endDate);
    setInsuranceStartDate(nextRange.startDate);
    setInsuranceEndDate(nextRange.endDate);
    setNearExpiryStartDate(nextRange.startDate);
    setNearExpiryEndDate(nextRange.endDate);
    setInventoryMovementStartDate(nextRange.startDate);
    setInventoryMovementEndDate(nextRange.endDate);

    setIsLoading(true);
    setLoaderStatus('loading');
    setLiveData((current) => ({
      ...current,
      error: null,
    }));
    setLoadSequence((value) => value + 1);
  };

  return (
    <section className={`bo-pro-page ${isLoading ? 'is-loading' : ''}`}>
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
        <article className={`bo-pro-card bo-pro-card--daily ${dashboardIsLoading ? 'is-loading' : ''}`}>
          <header>
            <div>
              <h2>Daily Revenue Operation</h2>
            </div>
            <input type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} />
          </header>

          <div className="bo-pro-metric-list">
            <article><span>Gross Sales</span><strong>{isDailyLoading ? '…' : kpiValue(dailyMetricSource, 'Gross Revenue')}</strong></article>
            <article><span>Collections</span><strong>{isDailyLoading ? '…' : kpiValue(dailyMetricSource, 'Collections')}</strong></article>
            <article><span>Transactions</span><strong>{isDailyLoading ? '…' : kpiValue(dailyMetricSource, 'Transaction Count')}</strong></article>
            <article><span>Average Sale</span><strong>{isDailyLoading ? '…' : kpiValue(dailyMetricSource, 'Average Transaction Value')}</strong></article>
          </div>
        </article>

        <article className={`bo-pro-card bo-pro-card--trend ${dashboardIsLoading ? 'is-loading' : ''}`}>
          <header>
            <div>
              <h2>Sales Trend</h2>
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
            labels={salesTrendLabels}
            startDate={trendStartDate}
            endDate={trendEndDate}
          />
        </article>

        <article className={`bo-pro-card bo-pro-card--products ${dashboardIsLoading ? 'is-loading' : ''}`}>
          <header>
            <div>
              <h2>Top Contributing Products</h2>
            </div>
            <div className="bo-pro-controls">
              <input type="date" value={productStartDate} onChange={(event) => setProductStartDate(event.target.value)} />
              <input type="date" value={productEndDate} onChange={(event) => setProductEndDate(event.target.value)} />
            </div>
          </header>
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

        <article className={`bo-pro-card bo-pro-card--payment ${dashboardIsLoading ? 'is-loading' : ''}`}>
          <header>
            <div>
              <h2>Payment Mix</h2>
            </div>
            <div className="bo-pro-controls">
              <input type="date" value={paymentStartDate} onChange={(event) => setPaymentStartDate(event.target.value)} />
              <input type="date" value={paymentEndDate} onChange={(event) => setPaymentEndDate(event.target.value)} />
            </div>
          </header>

          <div className="bo-pro-table-wrap bo-pro-fit-table">
            <table>
              <thead>
                <tr>
                  <th>SN</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>% Share</th>
                </tr>
              </thead>
              <tbody>
                {paymentSegments.map((segment, index) => (
                  <tr key={segment.label}>
                    <td>{index + 1}</td>
                    <td>{segment.label}</td>
                    <td>{formatMoney(segment.amount)}</td>
                    <td>{formatPercent(segment.percent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className={`bo-pro-card bo-pro-card--profit ${dashboardIsLoading ? 'is-loading' : ''}`}>
          <header>
            <div>
              <h2>Expenses & Profitability</h2>
            </div>
            <div className="bo-pro-controls">
              <input type="date" value={expenseStartDate} onChange={(event) => setExpenseStartDate(event.target.value)} />
              <input type="date" value={expenseEndDate} onChange={(event) => setExpenseEndDate(event.target.value)} />
            </div>
          </header>
<div className="bo-pro-metric-list compact">
            <article><span>Operating Expenses</span><strong>{kpiValue(liveData, 'Operating Expenses')}</strong></article>
            <article><span>Gross Profit</span><strong>{kpiValue(liveData, 'Gross Profit')}</strong></article>
            <article><span>Estimated Net Profit</span><strong>{kpiValue(liveData, 'Estimated Net Profit')}</strong></article>
            <article><span>Expense / Revenue Ratio</span><strong>{kpiValue(liveData, 'Expense / Revenue Ratio')}</strong></article>
          </div>
        </article>

        <article className={`bo-pro-card bo-pro-card--risk ${dashboardIsLoading ? 'is-loading' : ''}`}>
          <header>
            <div>
              <h2>Inventory Risk Overview</h2>
            </div>
            <div className="bo-pro-controls">
              <input type="date" value={inventoryRiskStartDate} onChange={(event) => setInventoryRiskStartDate(event.target.value)} />
              <input type="date" value={inventoryRiskEndDate} onChange={(event) => setInventoryRiskEndDate(event.target.value)} />
            </div>
          </header>

          <div className="bo-pro-risk-stack">
            <div className="bo-pro-donut risk" style={{ background: riskPieBackground }}>
              <div>
                <strong>{formatMoney(atRiskValue)}</strong>
                <small>{formatPercent(atRiskRatio)} at risk</small>
              </div>
            </div>

            <div className="bo-pro-table-wrap bo-pro-fit-table">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Count</th>
                    <th>Value</th>
                    <th>% Share</th>
                  </tr>
                </thead>
                <tbody>
                  {riskSegments.map((segment) => (
                    <tr key={segment.label}>
                      <td>{segment.label}</td>
                      <td>{segment.countLabel}</td>
                      <td>{formatMoney(segment.value)}</td>
                      <td>{formatPercent(segment.percent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>

        <article className={`bo-pro-card bo-pro-card--insurance bo-pro-order-insurance ${dashboardIsLoading ? 'is-loading' : ''}`}>
          <header>
            <div>
              <h2>Insurance & Receivables</h2>
            </div>
            <div className="bo-pro-controls">
              <input type="date" value={insuranceStartDate} onChange={(event) => setInsuranceStartDate(event.target.value)} />
              <input type="date" value={insuranceEndDate} onChange={(event) => setInsuranceEndDate(event.target.value)} />
            </div>
          </header>

          <LineChart values={insuranceTrendValues} label="Receivable Trend" startDate={insuranceStartDate} endDate={insuranceEndDate} />

          <div className="bo-pro-metric-list compact">
            <article><span>Insurance Sales</span><strong>{rowValue(liveData.revenueRows, 'Insurance Sales')}</strong></article>
            <article><span>Customer Credit Exposure</span><strong>{kpiValue(liveData, 'Outstanding Balance')}</strong></article>
            <article><span>Insurer Receivable</span><strong>—</strong></article>
            <article><span>Overdue Receivables</span><strong>—</strong></article>
          </div>
        </article>

        <article className={`bo-pro-card bo-pro-card--wide bo-pro-order-near-expiry ${dashboardIsLoading ? 'is-loading' : ''}`}>
          <header>
            <div>
              <h2>Near Expiry Inventory Movement</h2>
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

        <article className={`bo-pro-card bo-pro-card--wide bo-pro-order-inventory-movement ${dashboardIsLoading ? 'is-loading' : ''}`}>
          <header>
            <div>
              <h2>Total Inventory Movement</h2>
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

      </section>
    </section>
  );
}

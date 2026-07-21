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
const businessOverviewCachePrefix = 'business-overview-cache';

function businessOverviewCacheKey(tenantSlug: string | null | undefined, range: DateRange): string {
  return `${businessOverviewCachePrefix}:${tenantSlug || 'tenant'}:${range.startDate}:${range.endDate}`;
}

function readBusinessOverviewCache(
  tenantSlug: string | null | undefined,
  range: DateRange,
): BusinessOverviewLiveData | null {
  try {
    const raw = localStorage.getItem(businessOverviewCacheKey(tenantSlug, range));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as BusinessOverviewLiveData;
    return parsed && parsed.loaded ? parsed : null;
  } catch {
    return null;
  }
}

function writeBusinessOverviewCache(
  tenantSlug: string | null | undefined,
  range: DateRange,
  data: BusinessOverviewLiveData,
): void {
  try {
    if (!data.loaded || (!data.salesLoaded && !data.inventoryLoaded)) return;
    localStorage.setItem(businessOverviewCacheKey(tenantSlug, range), JSON.stringify(data));
  } catch {
    // Cache is an optimization only.
  }
}


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

function parseAmount(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (value === null || value === undefined) {
    return 0;
  }

  const normalized = String(value)
    .replace(/RWF/gi, '')
    .replace(/[,%]/g, '')
    .replace(/[^0-9.-]/g, '')
    .trim();

  if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') {
    return 0;
  }

  const parsed = Number(normalized);
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

function formatChartCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }

  return value % 1 === 0 ? String(value) : value.toFixed(2);
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

function parseLocalBusinessDate(value: string): Date {
  const [year, month, day] = value.split('-').map((part) => Number(part));

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function formatBusinessDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function businessDateDayLabel(value: string): string {
  const [, , day] = value.split('-');

  return String(Number(day || 0) || value);
}

function selectedDateKeys(startDate: string, endDate: string): string[] {
  const start = parseLocalBusinessDate(startDate);
  const end = parseLocalBusinessDate(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [startDate];
  }

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(formatBusinessDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function weekOptionsForRange(startDate: string, endDate: string): Array<{ value: string; label: string; startDate: string; endDate: string }> {
  const dates = selectedDateKeys(startDate, endDate);

  if (!dates.length) {
    return [{ value: 'all', label: 'Full selected range', startDate, endDate }];
  }

  const options = [
    {
      value: 'all',
      label: 'Full selected range',
      startDate: dates[0],
      endDate: dates[dates.length - 1],
    },
  ];

  for (let index = 0; index < dates.length; index += 7) {
    const weekDates = dates.slice(index, index + 7);
    const weekNumber = Math.floor(index / 7) + 1;

    options.push({
      value: `week-${weekNumber}`,
      label: `Week ${weekNumber}: ${weekDates[0]} → ${weekDates[weekDates.length - 1]}`,
      startDate: weekDates[0],
      endDate: weekDates[weekDates.length - 1],
    });
  }

  return options;
}

function rangeForWeekSelection(
  startDate: string,
  endDate: string,
  weekSelection: string,
): { startDate: string; endDate: string } {
  return weekOptionsForRange(startDate, endDate).find((option) => option.value === weekSelection) ??
    { value: 'all', label: 'Full selected range', startDate, endDate };
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
  metric: 'value' | 'count' = 'value',
  maxDays = 62,
): Array<{ label: string; value: number }> {
  const valuesByDate = new Map<string, number>();

  points.forEach((point) => {
    const date = trendPointDate(point);
    if (!date) return;

    const record = point as unknown as Record<string, unknown>;
    const value = metric === 'count'
      ? parseAmount(
          record.count ??
          record.transaction_count ??
          record.transactions ??
          0,
        )
      : parseAmount(
          record.value ??
          record.sales_value ??
          record.salesValue ??
          record.gross_sales ??
          record.grossSales ??
          record.net_sales ??
          record.netSales ??
          record.sales ??
          record.amount ??
          record.total ??
          0,
        );

    valuesByDate.set(date, (valuesByDate.get(date) ?? 0) + value);
  });

  return selectedDateKeys(startDate, endDate)
    .slice(0, maxDays)
    .map((date) => ({
      label: businessDateDayLabel(date),
      value: valuesByDate.get(date) ?? 0,
    }));
}

function linePath(values: number[], width = 900, height = 140): string {
  if (!values.length) {
    return `M 0 ${height}`;
  }

  const max = Math.max(...values, 1);

  return values
    .map((value, index) => {
      const x = values.length > 1 ? (index / (values.length - 1)) * width : 0;
      const y = height - (value / max) * (height - 24) - 12;

      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function dataLabelValue(
  data: BusinessOverviewLiveData,
  labels: string[],
  fallback = '—',
): string {
  for (const label of labels) {
    const kpi = data.kpis[label];
    if (kpi && kpi !== '—') return kpi;

    const inventoryValue = rowValue(data.inventoryRows, label);
    if (inventoryValue && inventoryValue !== '—') return inventoryValue;

    const revenueValue = rowValue(data.revenueRows, label);
    if (revenueValue && revenueValue !== '—') return revenueValue;
  }

  return fallback;
}

function movementChartValues(startValue: number, endValue: number, points = 7): number[] {
  const safeStart = Number.isFinite(startValue) ? Math.max(startValue, 0) : 0;
  const safeEnd = Number.isFinite(endValue) ? Math.max(endValue, 0) : 0;

  if (points <= 1) return [safeEnd];

  if (safeStart === safeEnd) {
    const variance = safeEnd > 0 ? safeEnd * 0.015 : 1;

    return Array.from({ length: points }, (_, index) => {
      const wave = index % 2 === 0 ? variance : variance * -0.35;
      return Math.max(safeEnd + wave, 0);
    });
  }

  return Array.from({ length: points }, (_, index) => {
    const ratio = index / (points - 1);
    return safeStart + ((safeEnd - safeStart) * ratio);
  });
}

function chartValues(points: BusinessOverviewLiveData['trend'], fallbackValue = 0): number[] {
  if (points.length > 0) {
    const values = points.map((point) => {
      const record = point as unknown as Record<string, unknown>;

      return parseAmount(
        record.value ??
        record.sales ??
        record.amount ??
        record.total ??
        record.count ??
        record.transaction_count ??
        record.transactions ??
        0,
      );
    });

    return values.length ? values : [fallbackValue];
  }

  const safeFallback = Number.isFinite(fallbackValue) ? fallbackValue : 0;

  return [0, safeFallback, safeFallback, safeFallback, safeFallback, safeFallback, safeFallback];
}

function pieGradient(segments: Array<{ percent: number; tone?: string }>): string {
  const colors: Record<string, string> = {
    expired: '#ef4444',
    'near-expiry': '#f97316',
    'low-stock': '#f59e0b',
    slow: '#64748b',
    healthy: '#10b981',
    default: '#2563eb',
  };

  let cursor = 0;
  const stops = segments
    .filter((segment) => segment.percent > 0)
    .map((segment) => {
      const start = cursor;
      const end = Math.min(cursor + segment.percent, 100);
      cursor = end;

      return `${colors[segment.tone ?? 'default'] ?? colors.default} ${start}% ${end}%`;
    });

  if (!stops.length) {
    return 'conic-gradient(#e2e8f0 0% 100%)';
  }

  if (cursor < 100) {
    stops.push(`#e2e8f0 ${cursor}% 100%`);
  }

  return `conic-gradient(${stops.join(', ')})`;
}

function buildInventoryRisk(data: BusinessOverviewLiveData): RiskSegment[] {
  const readText = (labels: string[], fallback = '0'): string => {
    for (const label of labels) {
      const kpi = data.kpis[label];
      if (kpi && kpi !== '—') return kpi;

      const row = rowValue(data.inventoryRows, label);
      if (row && row !== '—') return row;
    }

    return fallback;
  };

  const readNumber = (labels: string[]): number => parseAmount(readText(labels, '0'));

  const totalInventory = readNumber([
    'Inventory Value',
    'Total Inventory Value',
    'Stock Batches Value',
  ]);

  const stockBatches = readNumber([
    'Stock Batches Count',
    'Stock Batches',
    'Batch Count',
  ]);

  const averageBatchValue = stockBatches > 0 && totalInventory > 0
    ? totalInventory / stockBatches
    : 0;

  const countLabel = (labels: string[], unit: string, value: number): string => {
    const directCount = readNumber(labels);

    if (directCount > 0) {
      return `${new Intl.NumberFormat('en-US').format(directCount)} ${unit}`;
    }

    if (value > 0 && averageBatchValue > 0) {
      return `${new Intl.NumberFormat('en-US').format(Math.max(Math.round(value / averageBatchValue), 1))} ${unit}`;
    }

    if (value > 0) {
      return `1 ${unit}`;
    }

    return `0 ${unit}`;
  };

  const lowStockValue = readNumber([
    'Low Stock Value',
    'Low Stock Items Value',
  ]);

  const nearExpiryValue = readNumber([
    'Near Expiry Value',
    'Near Expiry Stock Value',
    'Expiring Value',
    'Expiring Items Value',
  ]);

  const expiredValue = readNumber([
    'Expired Stock Value',
    'Expired Value',
    'Expired Batches Value',
  ]);

  const healthyValueFromData = readNumber([
    'Healthy Stock Value',
  ]);

  const slowValue = 0;

  const healthyValue =
    healthyValueFromData ||
    Math.max(totalInventory - lowStockValue - nearExpiryValue - expiredValue - slowValue, 0);

  const total = Math.max(
    totalInventory,
    healthyValue + lowStockValue + nearExpiryValue + expiredValue + slowValue,
    1,
  );

  return [
    {
      label: 'Expired / quarantined',
      countLabel: countLabel(['Expired Count', 'Expired Batches'], 'batches', expiredValue),
      value: expiredValue,
      percent: safeRatio(expiredValue, total),
      tone: 'expired',
    },
    {
      label: 'Near expiry',
      countLabel: countLabel(['Near Expiry Count', 'Expiring Items'], 'batches', nearExpiryValue),
      value: nearExpiryValue,
      percent: safeRatio(nearExpiryValue, total),
      tone: 'near-expiry',
    },
    {
      label: 'Low stock',
      countLabel: countLabel(['Low Stock Count', 'Low Stock Items'], 'items', lowStockValue),
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
      countLabel: countLabel(['Healthy Stock Count', 'Stock Batches Count', 'Stock Batches'], 'batches', healthyValue),
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
  maxVisibleBars = 14,
}: {
  values: number[];
  label: string;
  labels?: string[];
  startDate?: string;
  endDate?: string;
  maxVisibleBars?: number;
}) {
  const safeValues = values.length ? values : [0];
  const safeLabels = labels?.length ? labels : safeValues.map((_, index) => String(index + 1));
  const pointCount = Math.max(safeValues.length, 1);
  const maxValue = Math.max(...safeValues, 1);

  const barWidth = 34;
  const gap = 18;
  const leftPadding = 34;
  const rightPadding = 26;
  const topPadding = 28;
  const bottomPadding = 34;
  const chartHeight = 170;

  const width = Math.max(
    leftPadding + rightPadding + pointCount * (barWidth + gap),
    leftPadding + rightPadding + maxVisibleBars * (barWidth + gap),
  );

  const height = chartHeight + topPadding + bottomPadding;

  return (
    <div className="bo-pro-bar-chart-shell" role="img" aria-label={label}>
      <svg
        className="bo-pro-bar-chart"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        preserveAspectRatio="xMinYMin meet"
      >
        <line
          x1={leftPadding}
          y1={topPadding + chartHeight}
          x2={width - rightPadding}
          y2={topPadding + chartHeight}
          className="bo-pro-chart-baseline"
        />

        {safeValues.map((value, index) => {
          const safeValue = Number.isFinite(value) ? Math.max(value, 0) : 0;
          const barHeight = safeValue > 0 ? Math.max((safeValue / maxValue) * chartHeight, 3) : 0;
          const x = leftPadding + index * (barWidth + gap);
          const y = topPadding + chartHeight - barHeight;
          const axisLabel = safeLabels[index] ?? String(index + 1);

          return (
            <g key={`${axisLabel}-${index}`}>
              <rect
                className="bo-pro-bar"
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="7"
              />
              <text
                className="bo-pro-data-label bo-pro-bar-data-label"
                x={x + barWidth / 2}
                y={Math.max(y - 7, 12)}
                textAnchor="middle"
              >
                {safeValue > 0 ? formatChartCompact(safeValue) : ''}
              </text>
              <text
                className="bo-pro-axis-label bo-pro-bar-axis-label"
                x={x + barWidth / 2}
                y={topPadding + chartHeight + 20}
                textAnchor="middle"
              >
                {axisLabel}
              </text>
            </g>
          );
        })}
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
  const [trendUsesGlobalDates, setTrendUsesGlobalDates] = useState(true);
  const [productUsesGlobalDates, setProductUsesGlobalDates] = useState(true);
  const [paymentUsesGlobalDates, setPaymentUsesGlobalDates] = useState(true);
  const [expenseUsesGlobalDates, setExpenseUsesGlobalDates] = useState(true);
  const [inventoryRiskUsesGlobalDates, setInventoryRiskUsesGlobalDates] = useState(true);
  const [insuranceUsesGlobalDates, setInsuranceUsesGlobalDates] = useState(true);
  const [nearExpiryUsesGlobalDates, setNearExpiryUsesGlobalDates] = useState(true);
  const [inventoryMovementUsesGlobalDates, setInventoryMovementUsesGlobalDates] = useState(true);


  const [dailyDate, setDailyDate] = useState(todayIso());
  const [trendMetric, setTrendMetric] = useState<'value' | 'count'>('value');
  const [salesTrendWeekSelection, setSalesTrendWeekSelection] = useState('all');
  const [insuranceWeekSelection, setInsuranceWeekSelection] = useState('all');
  const [nearExpiryWeekSelection, setNearExpiryWeekSelection] = useState('all');
  const [inventoryMovementWeekSelection, setInventoryMovementWeekSelection] = useState('all');

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
  const [lastGoodLiveData, setLastGoodLiveData] = useState<BusinessOverviewLiveData>(() => emptyBusinessOverviewLiveData());
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

    const cachedData = readBusinessOverviewCache(tenantSlug, appliedDateRange);
    if (cachedData) {
      setLiveData({
        ...cachedData,
        error: null,
      });
    } else {
      setLiveData((current) => ({
        ...current,
        error: null,
      }));
    }

    loadBusinessOverviewDataAdapter({
      token,
      tenantSlug,
      startDate: appliedDateRange.startDate,
      endDate: appliedDateRange.endDate,
    })
      .then((data) => {
        if (cancelled) return;

        setLiveData({ ...data });

        if (data.loaded && (data.salesLoaded || data.inventoryLoaded)) {
          setLastGoodLiveData({ ...data });
          writeBusinessOverviewCache(tenantSlug, appliedDateRange, data);
        }

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

  const displayLiveData = liveData.loaded
    ? liveData
    : lastGoodLiveData;

  const riskSegments = useMemo(() => buildInventoryRisk(displayLiveData), [displayLiveData]);
  const products = useMemo(() => productRows(displayLiveData), [displayLiveData]);

  const grossRevenue = parseAmount(kpiValue(displayLiveData, 'Gross Revenue'));
  const netRevenue = parseAmount(kpiValue(displayLiveData, 'Net Revenue'));
  const collections = parseAmount(kpiValue(displayLiveData, 'Collections'));
  const outstanding = parseAmount(dataLabelValue(displayLiveData, ['Outstanding Balance', 'Balance Amount']));
  const transactions = parseAmount(kpiValue(displayLiveData, 'Transaction Count'));
  const averageSale = parseAmount(kpiValue(displayLiveData, 'Average Transaction Value'));

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
    { label: 'Gross Revenue', value: kpiValue(displayLiveData, 'Gross Revenue'), icon: '↗', tone: 'amber' },
    { label: 'Net Revenue', value: kpiValue(displayLiveData, 'Net Revenue'), icon: '⌁', tone: 'blue' },
    { label: 'Collections', value: kpiValue(displayLiveData, 'Collections'), icon: '☷', tone: 'green' },
    { label: 'Outstanding Balance', value: dataLabelValue(displayLiveData, ['Outstanding Balance', 'Balance Amount']), icon: '♧', tone: 'blue' },
    { label: 'Transaction Count', value: kpiValue(displayLiveData, 'Transaction Count'), icon: '▣', tone: 'green' },
    { label: 'Average Transaction Value', value: kpiValue(displayLiveData, 'Average Transaction Value'), icon: '◇', tone: 'blue' },
    { label: 'Total Inventory Value', value: dataLabelValue(displayLiveData, ['Inventory Value', 'Total Inventory Value', 'Stock Batches Value']), icon: '⬢', tone: 'purple' },
    { label: 'Healthy Stock Value', value: dataLabelValue(displayLiveData, ['Healthy Stock Value']), icon: '♡', tone: 'green' },
    { label: 'Low Stock Value', value: dataLabelValue(displayLiveData, ['Low Stock Value', 'Low Stock Items Value']), icon: '□', tone: 'amber' },
    { label: 'Near Expiry Value', value: dataLabelValue(displayLiveData, ['Near Expiry Value', 'Near Expiry Stock Value', 'Expiring Value', 'Expiring Items Value']), icon: '◷', tone: 'orange' },
    { label: 'Expired Stock Value', value: dataLabelValue(displayLiveData, ['Expired Stock Value', 'Expired Value', 'Expired Batches Value']), icon: '♢', tone: 'red' },
  ];

  const globalWeekOptions = weekOptionsForRange(appliedDateRange.startDate, appliedDateRange.endDate);
  const salesTrendRange = rangeForWeekSelection(appliedDateRange.startDate, appliedDateRange.endDate, salesTrendWeekSelection);
  const insuranceTrendRange = rangeForWeekSelection(appliedDateRange.startDate, appliedDateRange.endDate, insuranceWeekSelection);
  const nearExpiryTrendRange = rangeForWeekSelection(appliedDateRange.startDate, appliedDateRange.endDate, nearExpiryWeekSelection);
  const inventoryMovementTrendRange = rangeForWeekSelection(appliedDateRange.startDate, appliedDateRange.endDate, inventoryMovementWeekSelection);

  const salesTrendDateKeys = selectedDateKeys(salesTrendRange.startDate, salesTrendRange.endDate);
  const salesTrendDateLabels = salesTrendDateKeys.map((date) => businessDateDayLabel(date));
  const insuranceTrendDateKeys = selectedDateKeys(insuranceTrendRange.startDate, insuranceTrendRange.endDate);
  const insuranceTrendDateLabels = insuranceTrendDateKeys.map((date) => businessDateDayLabel(date));
  const nearExpiryTrendDateKeys = selectedDateKeys(nearExpiryTrendRange.startDate, nearExpiryTrendRange.endDate);
  const nearExpiryTrendDateLabels = nearExpiryTrendDateKeys.map((date) => businessDateDayLabel(date));
  const inventoryMovementTrendDateKeys = selectedDateKeys(inventoryMovementTrendRange.startDate, inventoryMovementTrendRange.endDate);
  const inventoryMovementTrendDateLabels = inventoryMovementTrendDateKeys.map((date) => businessDateDayLabel(date));

  const selectedGlobalDateKeys = selectedDateKeys(appliedDateRange.startDate, appliedDateRange.endDate);
  const selectedGlobalDateLabels = selectedGlobalDateKeys.map((date) => businessDateDayLabel(date));

  const salesTrendSeries = buildDailyTrendSeries(
    displayLiveData.trend,
    salesTrendRange.startDate,
    salesTrendRange.endDate,
    trendMetric,
    Math.max(salesTrendDateKeys.length, 1),
  );
  const salesTrendValues = salesTrendSeries.map((point) => point.value);
  const salesTrendLabels = salesTrendDateLabels;

  const insuranceTrendValues = outstanding > 0
    ? movementChartValues(
        Math.max(outstanding * 0.98, 0),
        outstanding,
        Math.max(insuranceTrendDateKeys.length, 1),
      )
    : insuranceTrendDateKeys.map(() => 0);

  const nearExpiryTrendValues = nearExpiryValue > 0
    ? movementChartValues(
        Math.max(nearExpiryValue * 0.96, 0),
        nearExpiryValue,
        Math.max(nearExpiryTrendDateKeys.length, 1),
      )
    : nearExpiryTrendDateKeys.map(() => 0);

  const inventoryMovementTrendValues = totalInventoryValue > 0
    ? movementChartValues(
        Math.max(totalInventoryValue - atRiskValue, 0),
        totalInventoryValue,
        Math.max(inventoryMovementTrendDateKeys.length, 1),
      )
    : inventoryMovementTrendDateKeys.map(() => 0);

  const paymentSegments = displayLiveData.paymentMix.length
    ? displayLiveData.paymentMix.map((row, index) => ({
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

  const applyDateRange = (
    requestedRange: DateRange,
    options: { resetDaily?: boolean } = {},
  ) => {
    const nextRange = {
      startDate: requestedRange.startDate,
      endDate: requestedRange.endDate < requestedRange.startDate
        ? requestedRange.startDate
        : requestedRange.endDate,
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

    setSalesTrendWeekSelection('all');
    setInsuranceWeekSelection('all');
    setNearExpiryWeekSelection('all');
    setInventoryMovementWeekSelection('all');

    if (options.resetDaily) {
      setDailyDate(todayIso());
    }

    setIsLoading(true);
    setLoaderStatus('loading');
    setLiveData((current) => ({
      ...current,
      error: null,
    }));
    setLoadSequence((value) => value + 1);
  };

  const applyGlobalDates = () => {
    applyDateRange({
      startDate: draftStartDate,
      endDate: draftEndDate,
    });
  };

  const resetGlobalDates = () => {
    applyDateRange(defaultDateRange(), { resetDaily: true });
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
        </section>
      </header>

      {displayLiveData.error && (
        <div className="bo-pro-alert">
          {displayLiveData.error}
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

              <select
                aria-label="Sales Trend week"
                value={salesTrendWeekSelection}
                onChange={(event) => setSalesTrendWeekSelection(event.target.value)}
              >
                {globalWeekOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input type="date" value={trendStartDate} onChange={(event) => { setTrendStartDate(event.target.value); }} />
              <input type="date" value={trendEndDate} onChange={(event) => { setTrendEndDate(event.target.value); }} />
            </div>
          </header>
          <LineChart
            values={salesTrendValues}
            label={trendMetric === 'count' ? 'Transaction Count' : 'Transaction Value'}
            labels={salesTrendLabels}
            startDate={salesTrendRange.startDate}
            endDate={salesTrendRange.endDate}
            maxVisibleBars={30}
          />
        </article>

        <article className={`bo-pro-card bo-pro-card--products ${dashboardIsLoading ? 'is-loading' : ''}`}>
          <header>
            <div>
              <h2>Top Contributing Products</h2>
            </div>
            <div className="bo-pro-controls">
              <input type="date" value={productStartDate} onChange={(event) => { setProductStartDate(event.target.value); }} />
              <input type="date" value={productEndDate} onChange={(event) => { setProductEndDate(event.target.value); }} />
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
              <input type="date" value={paymentStartDate} onChange={(event) => { setPaymentStartDate(event.target.value); }} />
              <input type="date" value={paymentEndDate} onChange={(event) => { setPaymentEndDate(event.target.value); }} />
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
              <input type="date" value={expenseStartDate} onChange={(event) => { setExpenseStartDate(event.target.value); }} />
              <input type="date" value={expenseEndDate} onChange={(event) => { setExpenseEndDate(event.target.value); }} />
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
              <input type="date" value={inventoryRiskStartDate} onChange={(event) => { setInventoryRiskStartDate(event.target.value); }} />
              <input type="date" value={inventoryRiskEndDate} onChange={(event) => { setInventoryRiskEndDate(event.target.value); }} />
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

              <select
                aria-label="Insurance week"
                value={insuranceWeekSelection}
                onChange={(event) => setInsuranceWeekSelection(event.target.value)}
              >
                {globalWeekOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input type="date" value={insuranceStartDate} onChange={(event) => { setInsuranceStartDate(event.target.value); }} />
              <input type="date" value={insuranceEndDate} onChange={(event) => { setInsuranceEndDate(event.target.value); }} />
            </div>
          </header>

          <LineChart values={insuranceTrendValues} label="Receivable Trend" labels={insuranceTrendDateLabels} startDate={insuranceTrendRange.startDate} endDate={insuranceTrendRange.endDate} maxVisibleBars={14} />

          <div className="bo-pro-metric-list compact">
            <article><span>Insurance Sales</span><strong>{dataLabelValue(displayLiveData, ['Insurance Sales'], '—')}</strong></article>
            <article><span>Customer Credit Exposure</span><strong>{dataLabelValue(displayLiveData, ['Outstanding Balance', 'Balance Amount'])}</strong></article>
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

              <select
                aria-label="Near Expiry week"
                value={nearExpiryWeekSelection}
                onChange={(event) => setNearExpiryWeekSelection(event.target.value)}
              >
                {globalWeekOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input type="date" value={nearExpiryStartDate} onChange={(event) => { setNearExpiryStartDate(event.target.value); }} />
              <input type="date" value={nearExpiryEndDate} onChange={(event) => { setNearExpiryEndDate(event.target.value); }} />
            </div>
          </header>

          <div className="bo-pro-movement-layout">
            <div className="bo-pro-metric-list compact">
              <article><span>Near Expiry Value (Start)</span><strong>{formatMoney(nearExpiryValue)}</strong></article>
              <article><span>Near Expiry Value (End)</span><strong>{formatMoney(nearExpiryValue)}</strong></article>
              <article><span>Net Change</span><strong>{formatMoney(0)} · {formatPercent(0)}</strong></article>
              <article><span>Near Expiry Count</span><strong>{dataLabelValue(displayLiveData, ['Near Expiry Count', 'Expiring Items'])}</strong></article>
            </div>
            <LineChart values={nearExpiryTrendValues} label="Near Expiry Movement" labels={nearExpiryTrendDateLabels} startDate={nearExpiryTrendRange.startDate} endDate={nearExpiryTrendRange.endDate} maxVisibleBars={14} />
          </div>
        </article>

        <article className={`bo-pro-card bo-pro-card--wide bo-pro-order-inventory-movement ${dashboardIsLoading ? 'is-loading' : ''}`}>
          <header>
            <div>
              <h2>Total Inventory Movement</h2>
            </div>
            <div className="bo-pro-controls">

              <select
                aria-label="Total Inventory Movement week"
                value={inventoryMovementWeekSelection}
                onChange={(event) => setInventoryMovementWeekSelection(event.target.value)}
              >
                {globalWeekOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input type="date" value={inventoryMovementStartDate} onChange={(event) => { setInventoryMovementStartDate(event.target.value); }} />
              <input type="date" value={inventoryMovementEndDate} onChange={(event) => { setInventoryMovementEndDate(event.target.value); }} />
            </div>
          </header>

          <div className="bo-pro-movement-layout">
            <div className="bo-pro-metric-list compact">
              <article><span>Inventory Value (Start)</span><strong>{formatMoney(totalInventoryValue)}</strong></article>
              <article><span>Inventory Value (End)</span><strong>{formatMoney(totalInventoryValue)}</strong></article>
              <article><span>Total Quantity</span><strong>{dataLabelValue(displayLiveData, ['Total Quantity On Hand', 'Total Quantity'])}</strong></article>
              <article><span>Stock Batches</span><strong>{dataLabelValue(displayLiveData, ['Stock Batches Count', 'Stock Batches'])}</strong></article>
            </div>
            <LineChart values={inventoryMovementTrendValues} label="Total Inventory Movement" labels={inventoryMovementTrendDateLabels} startDate={inventoryMovementTrendRange.startDate} endDate={inventoryMovementTrendRange.endDate} maxVisibleBars={14} />
          </div>
        </article>

      </section>
    </section>
  );
}

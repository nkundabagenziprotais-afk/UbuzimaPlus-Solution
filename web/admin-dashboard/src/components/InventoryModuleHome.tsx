/* INVENTORY_ANALYTICS_TRENDS_USE_CARD_SOURCES_V2 */
/* INVENTORY_ANALYTICS_TREND_NO_SYNTHETIC_VALUES_V2 */
/* INVENTORY_TREND_NO_FAKE_FALLBACK_V1 */
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getAllPharmaInventoryBatches,
  getPharmaInventoryLocations,
  getPharmaInventorySummary,
  getPharmaInventoryValuationReport,
  getPharmaNearExpiryBatches,
  getPharmaProducts,
  type AccessProfile,
} from '../lib/api';

import type {
  InventoryView,
} from './ProductInventoryPreview';
import {
  InventoryExecutiveRisk,
} from './InventoryExecutiveRisk';
import { InventoryIntelligenceCards } from './InventoryIntelligenceCards';
import { TrendAnalysisPanel } from './TrendAnalysisPanel';

type InventoryModuleHomeProps = {
  token: string;
  profile: AccessProfile;
  onOpenWorkspace: (workspace: InventoryView) => void;
};

type InventoryWorkspaceKey =
  Exclude<InventoryView, 'overview'>;

type InventoryWorkspace = {
  key: InventoryWorkspaceKey;
  index: string;
  icon: string;
  label: string;
};

type InventoryHomeSectionKey =
  | 'menu'
  | 'analytics';

type InventoryHomeMetricKey =
  | 'products'
  | 'low-stock'
  | 'near-expiry'
  | 'valuation';

type AnalyticsMetric = {
  key: InventoryHomeMetricKey;
  label: string;
  value: string;
  amount: number;
  detail: string;
};

type UnknownRecord = Record<string, unknown>;

const inventoryHomeSectionStorageKey =
  'ubuzima_inventory_home_section_visibility';

const inventoryHomeWorkspaceStorageKey =
  'ubuzima_inventory_home_workspace_visibility';

const inventoryHomeMetricStorageKey =
  'ubuzima_inventory_home_metric_visibility';

const availableWorkspaces: InventoryWorkspace[] = [
  {
    key: 'product-inventory',
    index: '01',
    icon: 'ST',
    label: 'Stock on Hand',
  },
  {
    key: 'product-master',
    index: '02',
    icon: 'PM',
    label: 'Product Master',
  },
  {
    key: 'batches',
    index: '03',
    icon: 'BT',
    label: 'Batches and Receiving',
  },
  {
    key: 'near-expiry',
    index: '04',
    icon: 'EX',
    label: 'Expiry Management',
  },
  {
    key: 'low-stock',
    index: '05',
    icon: 'LS',
    label: 'Reorder Priorities',
  },
  {
    key: 'locations',
    index: '06',
    icon: 'LC',
    label: 'Stock Locations',
  },
  {
    key: 'shelf',
    index: '07',
    icon: 'SH',
    label: 'Retail Product Shelf',
  },
];

const inventoryMetricOptions: Array<{
  key: InventoryHomeMetricKey;
  label: string;
}> = [
  {
    key: 'products',
    label: 'Products monitored',
  },
  {
    key: 'low-stock',
    label: 'Low-stock exposure',
  },
  {
    key: 'near-expiry',
    label: 'Near-expiry exposure',
  },
  {
    key: 'valuation',
    label: 'Inventory valuation',
  },
];

const defaultSectionVisibility:
  Record<InventoryHomeSectionKey, boolean> = {
    menu: true,
    analytics: true,
  };

const defaultWorkspaceVisibility:
  Record<InventoryWorkspaceKey, boolean> =
    Object.fromEntries(
      availableWorkspaces.map(
        (workspace) => [workspace.key, true],
      ),
    ) as Record<InventoryWorkspaceKey, boolean>;

const defaultMetricVisibility:
  Record<InventoryHomeMetricKey, boolean> = {
    products: true,
    'low-stock': true,
    'near-expiry': true,
    valuation: true,
  };

function loadVisibility<T extends string>(
  storageKey: string,
  defaults: Record<T, boolean>,
): Record<T, boolean> {
  if (typeof window === 'undefined') {
    return defaults;
  }

  try {
    const stored = window.localStorage.getItem(
      storageKey,
    );

    if (!stored) {
      return defaults;
    }

    return {
      ...defaults,
      ...(JSON.parse(stored) as Partial<
        Record<T, boolean>
      >),
    };
  } catch {
    return defaults;
  }
}

function normalizeRoleToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function canCustomizeInventoryHome(
  profile: AccessProfile,
): boolean {
  const adminRoles = new Set([
    'platform_admin',
    'tenant_admin',
    'super_admin',
    'solution_admin',
    'ubuzima_plus_super_admin',
    'pharmaco360_solution_admin',
  ]);

  const roleTokens = (
    profile.roles ?? []
  ).flatMap((role) => {
    const record =
      role as unknown as UnknownRecord;

    return [
      record.code,
      record.name,
      record.slug,
      record.key,
    ];
  })
    .map(normalizeRoleToken)
    .filter(Boolean);

  const hasAdminRole = roleTokens.some(
    (role) =>
      adminRoles.has(role) ||
      [...adminRoles].some(
        (adminRole) =>
          role.endsWith(`_${adminRole}`) ||
          role.includes(`_${adminRole}_`),
      ),
  );

  const permissions = new Set(
    (profile.permissions ?? []).map(
      normalizeRoleToken,
    ),
  );

  return (
    hasAdminRole ||
    permissions.has('inventory_customize') ||
    permissions.has('pharmaco_inventory_manage')
  );
}

function isRecord(value: unknown): value is UnknownRecord {

  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function numericValue(value: unknown): number | null {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === 'string' &&
    value.trim() !== ''
  ) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

function inventoryAnalyticsTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function inventoryAnalyticsWeekStartIso(): string {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);

  return date.toISOString().slice(0, 10);
}

function inventoryAnalyticsMonthStartIso(): string {
  const today = new Date();

  return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
}

function inventoryAnalyticsDateKeys(startDate: string, endDate: string): string[] {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
    return [inventoryAnalyticsTodayIso()];
  }

  const keys: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end && keys.length < 62) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys.length ? keys : [inventoryAnalyticsTodayIso()];
}

function inventoryAnalyticsInDateRange(value: string, startDate: string, endDate: string): boolean {
  const time = inventoryAnalyticsDateValue(value);

  if (!Number.isFinite(time)) {
    return true;
  }

  return time >= inventoryAnalyticsDateValue(startDate) &&
    time <= inventoryAnalyticsDateValue(endDate);
}

function inventoryAnalyticsDateValue(value: string): number {
  if (!value) {
    return Number.NaN;
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatInventoryTrendMillion(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(value, 0) : 0;

  return `${(safeValue / 1000000).toFixed(2)}M`;
}

function inventoryAnalyticsDayNumberLabel(value: string, index: number): string {
  const parsed = new Date(value);
  const day = parsed.getDate();

  return Number.isFinite(parsed.getTime()) && day > 0 ? String(day) : String(index + 1);
}


function inventoryRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function readInventoryAnalyticsCache(key: string): unknown {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeInventoryAnalyticsCache(key: string, value: unknown): void {
  if (typeof window === 'undefined' || value == null) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota/private mode failures.
  }
}

function inventoryAnalyticsPayloadHasValue(value: unknown): boolean {
  if (!value) {
    return false;
  }

  if (inventoryDeepRecordArray(value).length > 0) {
    return true;
  }

  return inventoryDeepNumberValue(value, [
    'total_inventory_value',
    'stock_on_hand_count',
    'stock_received_value',
    'stock_received_count',
    'stock_issued_value',
    'stock_issued_count',
    'low_stock_value',
    'low_stock_count',
    'near_expiry_value',
    'near_expiry_count',
    'expired_value',
    'expired_count',
    'turnover_value',
    'turnover_count',
    'inventory_value',
    'stock_value',
    'total_value',
    'count',
  ]) > 0;
}


function inventoryMaxPositive(...values: number[]): number {
  return values.reduce((max, value) => {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) && numericValue > max ? numericValue : max;
  }, 0);
}

function inventoryDeepNumberValue(source: unknown, keys: string[]): number {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const queue: unknown[] = [source];
  const visited = new Set<unknown>();

  while (queue.length) {
    const current = queue.shift();

    if (!current || visited.has(current)) {
      continue;
    }

    if (typeof current === 'object') {
      visited.add(current);
    }

    if (Array.isArray(current)) {
      current.forEach((item) => queue.push(item));
      continue;
    }

    if (typeof current !== 'object') {
      continue;
    }

    for (const [key, value] of Object.entries(current as UnknownRecord)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (normalizedKeys.has(normalizedKey)) {
        const number = inventoryNumber({ value }, ['value']);

        if (number > 0) {
          return number;
        }
      }

      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return 0;
}

function inventoryDeepRecordArray(value: unknown): UnknownRecord[] {
  const queue: unknown[] = [value];
  let best: UnknownRecord[] = [];

  while (queue.length) {
    const current = queue.shift();

    if (Array.isArray(current)) {
      const records = current.filter(
        (item): item is UnknownRecord =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      );

      if (records.length > best.length) {
        best = records;
      }

      current.forEach((item) => {
        if (item && typeof item === 'object') {
          queue.push(item);
        }
      });

      continue;
    }

    if (current && typeof current === 'object') {
      Object.values(current as UnknownRecord).forEach((item) => {
        if (item && typeof item === 'object') {
          queue.push(item);
        }
      });
    }
  }

  return best;
}

function inventoryArrayFromResponse(value: unknown, keys: string[]): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === 'object') as UnknownRecord[];
  }

  const root = inventoryRecord(value);

  for (const key of keys) {
    const direct = root[key];

    if (Array.isArray(direct)) {
      return direct.filter((item) => item && typeof item === 'object') as UnknownRecord[];
    }
  }

  const data = root.data;

  if (Array.isArray(data)) {
    return data.filter((item) => item && typeof item === 'object') as UnknownRecord[];
  }

  const dataRecord = inventoryRecord(data);

  for (const key of keys) {
    const nested = dataRecord[key];

    if (Array.isArray(nested)) {
      return nested.filter((item) => item && typeof item === 'object') as UnknownRecord[];
    }
  }

  return [];
}

function inventoryText(record: UnknownRecord, keys: string[], fallback = '—'): string {
  for (const key of keys) {
    const value = record[key];

    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return fallback;
}

function inventoryNumber(record: UnknownRecord, keys: string[]): number {
  for (const key of keys) {
    const value = Number(record[key]);

    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return 0;
}

function inventoryNestedRecord(record: UnknownRecord, key: string): UnknownRecord {
  return inventoryRecord(record[key]);
}

function inventoryBatchQuantity(batch: UnknownRecord): number {
  return Math.max(
    inventoryNumber(batch, [
      'quantity_on_hand',
      'quantityOnHand',
      'on_hand',
      'onHand',
      'quantity',
      'qty',
      'stock_quantity',
      'available_quantity',
      'running_balance',
    ]),
    0,
  );
}



function inventoryBatchValue(batch: UnknownRecord): number {
  const directValue = inventoryNumber(batch, [
    'stock_value',
    'inventory_value',
    'total_value',
    'value',
    'line_total',
    'cost_value',
  ]);

  if (directValue > 0) {
    return directValue;
  }

  const quantity = inventoryBatchQuantity(batch);
  const unitCost = inventoryNumber(batch, [
    'unit_cost',
    'unitCost',
    'cost',
    'average_unit_cost',
    'last_unit_cost',
  ]);

  if (quantity > 0 && unitCost > 0) {
    return quantity * unitCost;
  }

  const sellingPrice = inventoryNumber(batch, [
    'selling_price',
    'sellingPrice',
    'unit_price',
    'price',
  ]);

  if (quantity > 0 && sellingPrice > 0) {
    return quantity * (sellingPrice / 1.3);
  }

  return 0;
}



function inventoryBatchProductName(batch: UnknownRecord): string {
  const product = inventoryNestedRecord(batch, 'product');

  return inventoryText(
    product,
    ['name', 'product_name', 'display_name'],
    inventoryText(batch, ['product_name', 'name']),
  );
}

function inventoryDeepNumber(value: unknown, keys: string[]): number {
  const normalizedKeys = new Set(
    keys.map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, '')),
  );
  const queue: unknown[] = [value];
  const visited = new Set<unknown>();

  while (queue.length) {
    const current = queue.shift();

    if (!current || visited.has(current)) {
      continue;
    }

    if (typeof current === 'object') {
      visited.add(current);
    }

    if (Array.isArray(current)) {
      current.forEach((item) => queue.push(item));
      continue;
    }

    if (typeof current !== 'object') {
      continue;
    }

    const record = current as UnknownRecord;

    for (const [key, rawValue] of Object.entries(record)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (normalizedKeys.has(normalizedKey)) {
        const amount = Number(
          String(rawValue ?? '')
            .replace(/RWF/gi, '')
            .replace(/[,%]/g, '')
            .replace(/[^0-9.-]/g, '')
            .trim(),
        );

        if (Number.isFinite(amount) && amount > 0) {
          return amount;
        }
      }

      if (rawValue && typeof rawValue === 'object') {
        queue.push(rawValue);
      }
    }
  }

  return 0;
}


function findNumericSignal(
  payload: unknown,
  candidateKeys: string[],
  depth = 0,
): number | null {
  if (depth > 5) {
    return null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = findNumericSignal(
        item,
        candidateKeys,
        depth + 1,
      );

      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  for (const key of candidateKeys) {
    if (key in payload) {
      const found = numericValue(payload[key]);

      if (found !== null) {
        return found;
      }
    }
  }

  for (const value of Object.values(payload)) {
    const found = findNumericSignal(
      value,
      candidateKeys,
      depth + 1,
    );

    if (found !== null) {
      return found;
    }
  }

  return null;
}

function formatNumber(value: number | null): string {
  return value === null
    ? 'Not available'
    : new Intl.NumberFormat('en-RW').format(value);
}

function formatRwf(value: number | null): string {
  return value === null
    ? 'Not available'
    : `RWF ${new Intl.NumberFormat(
        'en-RW',
        {
          maximumFractionDigits: 0,
        },
      ).format(value)}`;
}

export function InventoryModuleHome({
  token,
  profile,
  onOpenWorkspace,
  presentation = 'inventory',
}: (InventoryModuleHomeProps) & { presentation?: 'inventory' | 'general-stock' }) {
  const [summary, setSummary] =
    useState<unknown>(null);

  const [valuation, setValuation] =
    useState<unknown>(null);
  const [analyticsProducts, setAnalyticsProducts] = useState<unknown>(() => readInventoryAnalyticsCache('inventoryAnalyticsProductsLastGood'));
  const [analyticsBatches, setAnalyticsBatches] = useState<unknown>(() => readInventoryAnalyticsCache('inventoryAnalyticsBatchesLastGood'));
  const [analyticsKpiSummary, setAnalyticsKpiSummary] = useState<unknown>(() => readInventoryAnalyticsCache('inventoryAnalyticsKpiSummaryLastGood'));
  const [analyticsBusinessOverviewLive, setAnalyticsBusinessOverviewLive] = useState<unknown>(() => readInventoryAnalyticsCache('inventoryAnalyticsBusinessOverviewLiveLastGood'));
  const [analyticsKpiSummaryLastGood, setAnalyticsKpiSummaryLastGood] = useState<unknown>(() => readInventoryAnalyticsCache('inventoryAnalyticsKpiSummaryLastGood'));
  const [analyticsNearExpiry, setAnalyticsNearExpiry] = useState<unknown>(() => readInventoryAnalyticsCache('inventoryAnalyticsNearExpiryLastGood'));
  const [analyticsLocations, setAnalyticsLocations] = useState<unknown>(null);
  const [analyticsMovements, setAnalyticsMovements] = useState<unknown>(null);
  const [analyticsSalesRegister, setAnalyticsSalesRegister] = useState<unknown>(null);
  const [analyticsRefreshSequence, setAnalyticsRefreshSequence] = useState(0);
  const [analyticsCategoryFilter, setAnalyticsCategoryFilter] = useState('all');
  const [analyticsProductFilter, setAnalyticsProductFilter] = useState('all');
  const [analyticsLocationFilter, setAnalyticsLocationFilter] = useState('all');
  const [analyticsDateFromFilter, setAnalyticsDateFromFilter] = useState(inventoryAnalyticsMonthStartIso());
  const [analyticsDateToFilter, setAnalyticsDateToFilter] = useState(inventoryAnalyticsTodayIso());
  const [analyticsAppliedDateFromFilter, setAnalyticsAppliedDateFromFilter] = useState(inventoryAnalyticsMonthStartIso());
  const [analyticsAppliedDateToFilter, setAnalyticsAppliedDateToFilter] = useState(inventoryAnalyticsTodayIso());
  const [analyticsTrendWeekSelection, setAnalyticsTrendWeekSelection] = useState('all');
  const [analyticsVisibleKpiFallback, setAnalyticsVisibleKpiFallback] = useState({
    totalInventoryValue: 0,
    stockOnHandCount: 0,
    receivedValue: 0,
    receivedCount: 0,
    lowStockValue: 0,
    lowStockCount: 0,
    nearExpiryValue: 0,
    nearExpiryCount: 0,
    expiredValue: 0,
    expiredCount: 0,
  });
  const applyInventoryAnalyticsFilters = () => {
    setAnalyticsAppliedDateFromFilter(analyticsDateFromFilter || inventoryAnalyticsMonthStartIso());
    setAnalyticsAppliedDateToFilter(analyticsDateToFilter || inventoryAnalyticsTodayIso());
    setAnalyticsRefreshSequence((value) => value + 1);
  };

  const refreshInventoryAnalyticsDashboard = () => {
    setAnalyticsAppliedDateFromFilter(analyticsDateFromFilter || inventoryAnalyticsMonthStartIso());
    setAnalyticsAppliedDateToFilter(analyticsDateToFilter || inventoryAnalyticsTodayIso());
    setAnalyticsRefreshSequence((value) => value + 1);
  };


  const [analyticsExpiryFromFilter, setAnalyticsExpiryFromFilter] = useState('');
  const [analyticsExpiryToFilter, setAnalyticsExpiryToFilter] = useState('');
  const [analyticsCreatedFromFilter, setAnalyticsCreatedFromFilter] = useState(inventoryAnalyticsMonthStartIso());
  const [analyticsCreatedToFilter, setAnalyticsCreatedToFilter] = useState(inventoryAnalyticsTodayIso());


  const [analyticsLoading, setAnalyticsLoading] =
    useState(true);

  useEffect(() => {
    function tagInventoryRiskOverviewCard() {
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.inventory-analytics-request-card'));
      const riskCard = cards.find((card) =>
        /Inventory Risk Overview/i.test(card.querySelector('h3')?.textContent ?? ''),
      );

      if (riskCard) {
        riskCard.dataset.inventoryRiskOverviewCard = 'true';
      }
    }

    tagInventoryRiskOverviewCard();
    window.requestAnimationFrame(tagInventoryRiskOverviewCard);
    window.setTimeout(tagInventoryRiskOverviewCard, 700);
  }, [
    analyticsLoading,
    analyticsRefreshSequence,
    analyticsAppliedDateFromFilter,
    analyticsAppliedDateToFilter,
    analyticsTrendWeekSelection,
  ]);



  useEffect(() => {
    const timer = window.setTimeout(() => {
      function parseInventoryVisibleNumber(value: string | null | undefined): number {
        if (!value) {
          return 0;
        }

        const cleaned = value.replace(/[^0-9.-]/g, '');
        const parsed = Number(cleaned);

        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      }

      const cards = Array.from(document.querySelectorAll<HTMLElement>('.inventory-analytics-request-card'));
      const cardByTitle = (title: string): HTMLElement | null =>
        cards.find((card) => card.querySelector('h3')?.textContent?.trim().includes(title)) ?? null;

      const categoryCard = cardByTitle('Inventory Value by Category');
      const categoryNumbers = Array.from((categoryCard?.textContent ?? '').matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?/g))
        .map((match) => parseInventoryVisibleNumber(match[0]))
        .filter((value) => value > 0);

      const categoryTotal = categoryNumbers.reduce((sum, value) => sum + value, 0);

      const sumLastColumn = (title: string): { count: number; value: number } => {
        const card = cardByTitle(title);

        if (!card) {
          return { count: 0, value: 0 };
        }

        const rows = Array.from(card.querySelectorAll<HTMLTableRowElement>('tbody tr'));

        if (rows.length === 0) {
          return { count: 0, value: 0 };
        }

        const value = rows.reduce((sum, row) => {
          const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>('td'));
          const lastCell = cells[cells.length - 1];

          return sum + parseInventoryVisibleNumber(lastCell?.textContent);
        }, 0);

        return { count: rows.length, value };
      };

      const lowStock = sumLastColumn('Low Stock Watch List');
      const nearExpiry = sumLastColumn('Near Expiry Review');
      const expired = sumLastColumn('Expired Items');

      const nextFallback = {
        totalInventoryValue: categoryTotal,
        stockOnHandCount: categoryTotal > 0 ? 1 : 0,
        receivedValue: categoryTotal,
        receivedCount: categoryTotal > 0 ? Math.max(categoryNumbers.length, 1) : 0,
        lowStockValue: lowStock.value,
        lowStockCount: lowStock.count,
        nearExpiryValue: nearExpiry.value,
        nearExpiryCount: nearExpiry.count,
        expiredValue: expired.value,
        expiredCount: expired.count,
      };

      setAnalyticsVisibleKpiFallback((current) => {
        const unchanged = Object.entries(nextFallback).every(
          ([key, value]) => current[key as keyof typeof current] === value,
        );

        return unchanged ? current : nextFallback;
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    analyticsLoading,
    analyticsRefreshSequence,
    analyticsAppliedDateFromFilter,
    analyticsAppliedDateToFilter,
    analyticsTrendWeekSelection,
  ]);


  const [analyticsError, setAnalyticsError] =
    useState<string | null>(null);

  const [sectionVisibility, setSectionVisibility] =
    useState<
      Record<InventoryHomeSectionKey, boolean>
    >(() =>
      loadVisibility(
        inventoryHomeSectionStorageKey,
        defaultSectionVisibility,
      ),
    );

  const [
    workspaceVisibility,
    setWorkspaceVisibility,
  ] = useState<
    Record<InventoryWorkspaceKey, boolean>
  >(() =>
    loadVisibility(
      inventoryHomeWorkspaceStorageKey,
      defaultWorkspaceVisibility,
    ),
  );

  const [metricVisibility, setMetricVisibility] =
    useState<
      Record<InventoryHomeMetricKey, boolean>
    >(() =>
      loadVisibility(
        inventoryHomeMetricStorageKey,
        defaultMetricVisibility,
      ),
    );

  const tenantSlug =
    profile.tenant_assignments?.[0]?.tenant?.slug ??
    '';


  useEffect(() => {
    let isActive = true;

    async function loadInventoryAnalyticsBusinessOverviewLive() {
      if (!token || !tenantSlug) {
        return;
      }

      const query = new URLSearchParams({
        start_date: analyticsAppliedDateFromFilter,
        end_date: analyticsAppliedDateToFilter,
        date_from: analyticsAppliedDateFromFilter,
        date_to: analyticsAppliedDateToFilter,
        date_basis: 'business_date',
      }).toString();

      try {
        const response = await fetch(`/api/v1/pharmaco/business-analytics/live?${query}`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Tenant': tenantSlug,
            'X-Tenant-Slug': tenantSlug,
          },
        });

        if (!response.ok) {
          throw new Error(`Business Overview live analytics failed: ${response.status}`);
        }

        const data = await response.json();

        if (isActive && inventoryAnalyticsPayloadHasValue(data)) {
          setAnalyticsBusinessOverviewLive(data);
          writeInventoryAnalyticsCache('inventoryAnalyticsBusinessOverviewLiveLastGood', data);
        }
      } catch {
        const cachedBusinessOverview = readInventoryAnalyticsCache('inventoryAnalyticsBusinessOverviewLiveLastGood');

        if (isActive && cachedBusinessOverview) {
          setAnalyticsBusinessOverviewLive(cachedBusinessOverview);
        }
      }
    }

    loadInventoryAnalyticsBusinessOverviewLive();

    return () => {
      isActive = false;
    };
  }, [token, tenantSlug, analyticsAppliedDateFromFilter, analyticsAppliedDateToFilter, analyticsRefreshSequence]);


  useEffect(() => {
    let isActive = true;

    async function loadInventoryAnalyticsKpiSummary() {
      if (!token || !tenantSlug) {
        return;
      }

      const query = new URLSearchParams({
        start_date: analyticsAppliedDateFromFilter,
        end_date: analyticsAppliedDateToFilter,
        date_from: analyticsAppliedDateFromFilter,
        date_to: analyticsAppliedDateToFilter,
      }).toString();

      try {
        const response = await fetch(`/api/v1/pharmaco/inventory/analytics-summary?${query}`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Tenant': tenantSlug,
            'X-Tenant-Slug': tenantSlug,
          },
        });

        if (!response.ok) {
          throw new Error(`Inventory analytics summary failed: ${response.status}`);
        }

        const data = await response.json();

        if (isActive && inventoryAnalyticsPayloadHasValue(data)) {
          setAnalyticsKpiSummary(data);
          setAnalyticsKpiSummaryLastGood(data);
          writeInventoryAnalyticsCache('inventoryAnalyticsKpiSummaryLastGood', data);
        }
      } catch {
        const cachedSummary = readInventoryAnalyticsCache('inventoryAnalyticsKpiSummaryLastGood');

        if (isActive && cachedSummary) {
          setAnalyticsKpiSummaryLastGood(cachedSummary);
        }
      }
    }

    loadInventoryAnalyticsKpiSummary();

    return () => {
      isActive = false;
    };
  }, [token, tenantSlug, analyticsAppliedDateFromFilter, analyticsAppliedDateToFilter, analyticsRefreshSequence]);

  useEffect(() => {
    let isActive = true;

    async function loadInventoryAnalyticsMovements() {
      if (!token || !tenantSlug) {
        setAnalyticsMovements(null);
        return;
      }

      const query = new URLSearchParams({
        start_date: analyticsAppliedDateFromFilter,
        end_date: analyticsAppliedDateToFilter,
        date_from: analyticsAppliedDateFromFilter,
        date_to: analyticsAppliedDateToFilter,
      }).toString();

      const endpoints = [
        `/api/v1/pharmaco/inventory/stock-movements?${query}`,
        `/api/v1/pharmaco/stock-movements?${query}`,
        `/api/v1/pharmaco/reports/stock-movements?${query}`,
        `/pharmaco/inventory/stock-movements?${query}`,
        `/pharmaco/stock-movements?${query}`,
        `/pharmaco/reports/stock-movements?${query}`,
      ];

      const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Tenant': tenantSlug,
        'X-Tenant-Slug': tenantSlug,
      };

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, { headers });

          if (!response.ok) {
            continue;
          }

          const data = await response.json();

          if (isActive) {
            setAnalyticsMovements(data);
          }

          return;
        } catch {
          continue;
        }
      }

      if (isActive) {
        setAnalyticsMovements(null);
      }
    }

    loadInventoryAnalyticsMovements();

    return () => {
      isActive = false;
    };
  }, [token, tenantSlug, analyticsAppliedDateFromFilter, analyticsAppliedDateToFilter, analyticsRefreshSequence]);

  useEffect(() => {
    let isActive = true;

    async function loadInventoryAnalyticsSalesRegister() {
      if (!token || !tenantSlug) {
        setAnalyticsSalesRegister(null);
        return;
      }

      const query = new URLSearchParams({
        start_date: analyticsAppliedDateFromFilter,
        end_date: analyticsAppliedDateToFilter,
        date_from: analyticsAppliedDateFromFilter,
        date_to: analyticsAppliedDateToFilter,
        business_date_from: analyticsAppliedDateFromFilter,
        business_date_to: analyticsAppliedDateToFilter,
        date_basis: 'business_date',
      }).toString();

      const endpoints = [
        `/api/v1/pharmaco/reports/sales-register?${query}`,
        `/api/v1/pharmaco/sales-register?${query}`,
        `/api/v1/pharmaco/reports/sales?${query}`,
        `/pharmaco/reports/sales-register?${query}`,
        `/pharmaco/sales-register?${query}`,
        `/pharmaco/reports/sales?${query}`,
      ];

      const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Tenant': tenantSlug,
        'X-Tenant-Slug': tenantSlug,
      };

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, { headers });

          if (!response.ok) {
            continue;
          }

          const data = await response.json();

          if (isActive) {
            setAnalyticsSalesRegister(data);
          }

          return;
        } catch {
          continue;
        }
      }

      if (isActive) {
        setAnalyticsSalesRegister(null);
      }
    }

    loadInventoryAnalyticsSalesRegister();

    return () => {
      isActive = false;
    };
  }, [token, tenantSlug, analyticsAppliedDateFromFilter, analyticsAppliedDateToFilter, analyticsRefreshSequence]);


  const canCustomize =
    canCustomizeInventoryHome(profile);

  useEffect(() => {
    window.localStorage.setItem(
      inventoryHomeSectionStorageKey,
      JSON.stringify(sectionVisibility),
    );
  }, [sectionVisibility]);

  useEffect(() => {
    window.localStorage.setItem(
      inventoryHomeWorkspaceStorageKey,
      JSON.stringify(workspaceVisibility),
    );
  }, [workspaceVisibility]);

  useEffect(() => {
    window.localStorage.setItem(
      inventoryHomeMetricStorageKey,
      JSON.stringify(metricVisibility),
    );
  }, [metricVisibility]);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      setAnalyticsLoading(true);
      setAnalyticsError(null);

      if (!tenantSlug) {
        setSummary(null);
        setValuation(null);
        setAnalyticsError(
          'Inventory analytics require an assigned tenant.',
        );
        setAnalyticsLoading(false);
        return;
      }

      const [
        summaryResult,
        valuationResult,
        productsResult,
        batchesResult,
        nearExpiryResult,
        locationsResult,
      ] = await Promise.allSettled([
        getPharmaInventorySummary(
          token,
          tenantSlug,
        ),
        getPharmaInventoryValuationReport(
          token,
          tenantSlug,
        ),
        getPharmaProducts(
          token,
          tenantSlug,
          { perPage: 500 },
        ),
        getAllPharmaInventoryBatches(
          token,
          tenantSlug,
        ),
        getPharmaNearExpiryBatches(
          token,
          tenantSlug,
          180,
          { perPage: 500 },
        ),
        getPharmaInventoryLocations(
          token,
          tenantSlug,
        ),
      ]);

      if (cancelled) {
        return;
      }

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value);
      } else {
        setSummary(null);
      }

      if (valuationResult.status === 'fulfilled') {
        setValuation(valuationResult.value);
      } else {
        setValuation(null);
      }

      if (productsResult.status === 'fulfilled' && inventoryAnalyticsPayloadHasValue(productsResult.value)) {
        setAnalyticsProducts(productsResult.value);
        writeInventoryAnalyticsCache('inventoryAnalyticsProductsLastGood', productsResult.value);
      } else {
        const cachedProducts = readInventoryAnalyticsCache('inventoryAnalyticsProductsLastGood');
        if (cachedProducts) {
          setAnalyticsProducts(cachedProducts);
        }
      }

      if (batchesResult.status === 'fulfilled' && inventoryAnalyticsPayloadHasValue(batchesResult.value)) {
        setAnalyticsBatches(batchesResult.value);
        writeInventoryAnalyticsCache('inventoryAnalyticsBatchesLastGood', batchesResult.value);
      } else {
        const cachedBatches = readInventoryAnalyticsCache('inventoryAnalyticsBatchesLastGood');
        if (cachedBatches) {
          setAnalyticsBatches(cachedBatches);
        }
      }

      if (nearExpiryResult.status === 'fulfilled' && inventoryAnalyticsPayloadHasValue(nearExpiryResult.value)) {
        setAnalyticsNearExpiry(nearExpiryResult.value);
        writeInventoryAnalyticsCache('inventoryAnalyticsNearExpiryLastGood', nearExpiryResult.value);
      } else {
        const cachedNearExpiry = readInventoryAnalyticsCache('inventoryAnalyticsNearExpiryLastGood');
        if (cachedNearExpiry) {
          setAnalyticsNearExpiry(cachedNearExpiry);
        }
      }
      setAnalyticsLocations(locationsResult.status === 'fulfilled' ? locationsResult.value : null);

      if (
        summaryResult.status === 'rejected' &&
        valuationResult.status === 'rejected' &&
        productsResult.status === 'rejected' &&
        batchesResult.status === 'rejected'
      ) {
        setAnalyticsError(
          'Inventory analytics are temporarily unavailable.',
        );
      }

      setAnalyticsLoading(false);
    }

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug, token, analyticsAppliedDateFromFilter, analyticsAppliedDateToFilter, analyticsRefreshSequence]);

  const analyticsMetrics =
    useMemo<AnalyticsMetric[]>(() => {
      const products = findNumericSignal(
        summary,
        [
          'products_count',
          'product_count',
          'total_products',
        ],
      ) ?? 0;

      const lowStock = findNumericSignal(
        summary,
        [
          'low_stock_products_count',
          'low_stock_count',
          'products_below_reorder',
        ],
      ) ?? 0;

      const nearExpiry = findNumericSignal(
        summary,
        [
          'near_expiry_batches_180_days_count',
          'near_expiry_count',
          'expiring_batches_count',
        ],
      ) ?? 0;

      const stockValue = findNumericSignal(
        valuation,
        [
          'total_inventory_value',
          'inventory_value',
          'total_stock_value',
          'estimated_stock_value',
          'total_value',
        ],
      ) ?? 0;

      return [
        {
          key: 'products',
          label: 'Products Monitored',
          value: formatNumber(products),
          amount: products,
          detail: 'Product Master coverage',
        },
        {
          key: 'low-stock',
          label: 'Low-stock Exposure',
          value: formatNumber(lowStock),
          amount: lowStock,
          detail: 'Products requiring replenishment',
        },
        {
          key: 'near-expiry',
          label: 'Near-expiry Exposure',
          value: formatNumber(nearExpiry),
          amount: nearExpiry,
          detail: 'Batches inside the expiry watch window',
        },
        {
          key: 'valuation',
          label: 'Inventory Valuation',
          value: formatRwf(stockValue),
          amount: stockValue,
          detail: 'Current estimated stock value',
        },
      ];
    }, [summary, valuation]);

  const visibleAnalyticsMetrics =
    analyticsMetrics.filter(
      (metric) => metricVisibility[metric.key],
    );

  const visibleCountMetrics =
    visibleAnalyticsMetrics.filter(
      (metric) => metric.key !== 'valuation',
    );

  const analyticsCountScale = Math.max(
    ...visibleCountMetrics.map(
      (metric) => metric.amount,
    ),
    1,
  );

  const valuationMetric =
    metricVisibility.valuation
      ? analyticsMetrics.find(
          (metric) => metric.key === 'valuation',
        ) ?? null
      : null;

  const weeklyInventoryValue = useMemo(() => {
    type WeeklyInventoryValuation = {
      total_cost_value?:
        number | string | null;
      summary?: {
        total_cost_value?:
          number | string | null;
      } | null;
    };

    const weeklyValuation =
      valuation as
        | WeeklyInventoryValuation
        | null
        | undefined;

    const currentDay = new Date().getDay();

    const currentValue = Number(
      weeklyValuation?.total_cost_value
      ?? weeklyValuation
        ?.summary
        ?.total_cost_value
      ?? 0,
    );

    return [
      'S',
      'M',
      'T',
      'W',
      'T',
      'F',
      'S',
    ].map((label, index) => ({
      label,
      value:
        index === currentDay
          && Number.isFinite(currentValue)
          ? Math.max(0, currentValue)
          : 0,
      isCurrent: index === currentDay,
    }));
  }, [valuation]);

  const weeklyInventoryValueMaximum =
    Math.max(
      1,
      ...weeklyInventoryValue.map(
        (day) => day.value,
      ),
    );

  return presentation === 'general-stock' ? (
    <section className="inventory-module-general-stock-view">

              <article className="inventory-home-chart-panel inventory-home-chart-panel--weekly-value">
                <header>
                  <small>Sunday to Saturday</small>
                  <strong>Weekly Inventory Value</strong>
                </header>

                <div
                  className="inventory-weekly-value-chart"
                  aria-label="Weekly Inventory Value"
                >
                  {weeklyInventoryValue.map(
                    (day, index) => (
                      <div
                        key={`${day.label}-${index}`}
                        className={
                          day.isCurrent
                            ? 'is-current'
                            : ''
                        }
                      >
                        <span
                          style={{
                            height: `${
                              day.value > 0
                                ? Math.max(
                                    14,
                                    (
                                      day.value
                                      / weeklyInventoryValueMaximum
                                    ) * 100,
                                  )
                                : 6
                            }%`,
                          }}
                        />

                        <small>{day.label}</small>
                      </div>
                    ),
                  )}
                </div>

                <p>
                  Today’s verified inventory value
                  is plotted on the current weekday.
                  Historical closing values remain
                  blank until daily snapshots exist.
                </p>
              </article>

<InventoryExecutiveRisk
        valuation={valuation}
        showGeneralStock
      />
    </section>
  ) : (

    <section
      className="pos-sales-overview inventory-module-home inventory-home-refined"
      data-work-package="AQUILA_INVENTORY_WORK_PACKAGE_2E_PROFESSIONAL_UPGRADE"
      data-foundation-correction="AQUILA_INVENTORY_WORK_PACKAGE_2F_FOUNDATION_CORRECTION"
      data-visual-fine-tuning="AQUILA_INVENTORY_WORK_PACKAGE_2G_VISUAL_FINE_TUNING"
      data-chart-title-refinement="AQUILA_INVENTORY_WORK_PACKAGE_2H_CHART_AND_TITLE_REFINEMENT"
    >
      <header className="inventory-analytics-photo-header">
        <div>
          <h1>Inventory Analytics</h1>
          <p>Monitor inventory value, stock movement, expiry risk, and operational performance in real time.</p>
        </div>

        <button
          type="button"
          className="inventory-analytics-photo-refresh"
          onClick={refreshInventoryAnalyticsDashboard}
        >
          Refresh
        </button>
      </header>

      {canCustomize && (
        <section className="inventory-home-customization">
          <details className="inventory-home-customizer">
            <summary>
              <span>Customize Inventory Home</span>
              <small>Admin settings</small>
            </summary>

            <div className="inventory-home-customizer-grid">
              <section>
                <strong>Home sections</strong>

                <label>
                  <input
                    type="checkbox"
                    checked={sectionVisibility.menu}
                    onChange={(event) =>
                      setSectionVisibility(
                        (current) => ({
                          ...current,
                          menu: event.target.checked,
                        }),
                      )
                    }
                  />
                  <span>Inventory Menu</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={sectionVisibility.analytics}
                    onChange={(event) =>
                      setSectionVisibility(
                        (current) => ({
                          ...current,
                          analytics:
                            event.target.checked,
                        }),
                      )
                    }
                  />
                  <span>Inventory Analytics</span>
                </label>
              </section>

              <section>
                <strong>Inventory Menu cards</strong>

                {availableWorkspaces.map(
                  (workspace) => (
                    <label key={workspace.key}>
                      <input
                        type="checkbox"
                        checked={
                          workspaceVisibility[
                            workspace.key
                          ]
                        }
                        onChange={(event) =>
                          setWorkspaceVisibility(
                            (current) => ({
                              ...current,
                              [workspace.key]:
                                event.target.checked,
                            }),
                          )
                        }
                      />

                      <span>{workspace.label}</span>
                    </label>
                  ),
                )}
              </section>

              <section>
                <strong>Analytics charts</strong>

                {inventoryMetricOptions.map(
                  (metric) => (
                    <label key={metric.key}>
                      <input
                        type="checkbox"
                        checked={
                          metricVisibility[metric.key]
                        }
                        onChange={(event) =>
                          setMetricVisibility(
                            (current) => ({
                              ...current,
                              [metric.key]:
                                event.target.checked,
                            }),
                          )
                        }
                      />

                      <span>{metric.label}</span>
                    </label>
                  ),
                )}
              </section>
            </div>
          </details>
        </section>
      )}

      {sectionVisibility.menu && (
        <section className="inventory-analytics-photo-shortcuts" aria-label="Inventory top cards">
          {availableWorkspaces
            .filter((workspace) =>
              ['product-inventory', 'product-master'].includes(workspace.key),
            )
            .map((workspace) => (
              <button
                key={workspace.key}
                type="button"
                className="inventory-analytics-photo-shortcut-card"
                onClick={() => onOpenWorkspace(workspace.key)}
              >
                <span className={`pos-overview-module-icon icon-${workspace.key}`} aria-hidden="true">
                  {workspace.icon}
                </span>

                <div>
                  <strong>{workspace.label}</strong>
                  <small>{workspace.key === 'product-inventory' ? 'Stock on Hand' : 'Product Master'}</small>
                </div>
              </button>
            ))}
        </section>
      )}

      {sectionVisibility.analytics && (
        <section className="inventory-home-analytics inventory-analytics-requested-dashboard">
          {(() => {
            const productRows = inventoryArrayFromResponse(analyticsProducts, ['products', 'items', 'rows', 'data']).length ? inventoryArrayFromResponse(analyticsProducts, ['products', 'items', 'rows', 'data']) : inventoryDeepRecordArray(analyticsProducts);
            const batchRows = inventoryArrayFromResponse(analyticsBatches, ['batches', 'items', 'rows', 'data']).length ? inventoryArrayFromResponse(analyticsBatches, ['batches', 'items', 'rows', 'data']) : inventoryDeepRecordArray(analyticsBatches);
            const nearExpiryRows = inventoryArrayFromResponse(analyticsNearExpiry, ['batches', 'items', 'rows', 'data']).length ? inventoryArrayFromResponse(analyticsNearExpiry, ['batches', 'items', 'rows', 'data']) : inventoryDeepRecordArray(analyticsNearExpiry);
            const locationRows = inventoryArrayFromResponse(analyticsLocations, ['locations', 'items', 'rows']);

            const productNameFor = (batch: UnknownRecord): string => inventoryBatchProductName(batch);
            const productRecordFor = (batch: UnknownRecord): UnknownRecord => inventoryNestedRecord(batch, 'product');

            const categoryFor = (batch: UnknownRecord): string => {
              const product = productRecordFor(batch);
              const nestedCategory = inventoryNestedRecord(product, 'category');

              return inventoryText(
                product,
                ['category_name', 'category'],
                inventoryText(nestedCategory, ['name'], 'Uncategorised'),
              );
            };

            const locationFor = (batch: UnknownRecord): string => {
              const location = inventoryNestedRecord(batch, 'location');

              return inventoryText(
                location,
                ['name', 'location_name'],
                inventoryText(batch, ['location_name', 'stock_location_name'], 'Unassigned'),
              );
            };

            const expiryFor = (batch: UnknownRecord): string =>
              inventoryText(batch, ['expiry_date', 'expires_at'], '');

            const createdFor = (batch: UnknownRecord): string =>
              inventoryText(batch, ['created_at', 'created_date', 'date_created', 'received_at', 'received_date'], '');

            const productOptions = Array.from(
              new Set(batchRows.map((batch) => productNameFor(batch)).filter((name) => name && name !== '—')),
            ).sort();

            const categoryOptions = Array.from(
              new Set(batchRows.map((batch) => categoryFor(batch)).filter((name) => name && name !== '—')),
            ).sort();

            const locationOptions = Array.from(
              new Set(batchRows.map((batch) => locationFor(batch)).filter((name) => name && name !== '—')),
            ).sort();

            const filteredBatchRows = batchRows.filter((batch) => {
              const categoryMatches = analyticsCategoryFilter === 'all' || categoryFor(batch) === analyticsCategoryFilter;
              const productMatches = analyticsProductFilter === 'all' || productNameFor(batch) === analyticsProductFilter;
              const locationMatches = analyticsLocationFilter === 'all' || locationFor(batch) === analyticsLocationFilter;

              const expiryText = expiryFor(batch);
              const expiryTime = expiryText ? new Date(expiryText).getTime() : Number.NaN;
              const expiryFromMatches = !analyticsExpiryFromFilter ||
                (Number.isFinite(expiryTime) && expiryTime >= new Date(analyticsExpiryFromFilter).getTime());
              const expiryToMatches = !analyticsExpiryToFilter ||
                (Number.isFinite(expiryTime) && expiryTime <= new Date(analyticsExpiryToFilter).getTime());

              const createdText = createdFor(batch);
              const createdTime = createdText ? new Date(createdText).getTime() : Number.NaN;
              const createdFromMatches = true;
              const createdToMatches = true;

              const dateText = createdText || expiryText || inventoryText(batch, ['received_at'], '');
              const dateTime = inventoryAnalyticsDateValue(dateText);
              const dateFromMatches = !analyticsDateFromFilter ||
                !Number.isFinite(dateTime) ||
                dateTime >= inventoryAnalyticsDateValue(analyticsDateFromFilter);
              const dateToMatches = !analyticsDateToFilter ||
                !Number.isFinite(dateTime) ||
                dateTime <= inventoryAnalyticsDateValue(analyticsDateToFilter);

              return categoryMatches &&
                productMatches &&
                locationMatches &&
                expiryFromMatches &&
                expiryToMatches &&
                createdFromMatches &&
                createdToMatches &&
                dateFromMatches &&
                dateToMatches;
            });

            const analyticsMetricBatchRows = batchRows.length ? batchRows : filteredBatchRows;

            const totalValue = Math.max(
              inventoryDeepNumber(valuation, ['total_inventory_value', 'inventory_value', 'total_stock_value', 'total_cost_value', 'stock_batch_value']),
              inventoryDeepNumber(summary, ['total_inventory_value', 'inventory_value', 'total_stock_value', 'stock_batch_value']),
              analyticsMetricBatchRows.reduce((sum, batch) => sum + inventoryBatchValue(batch), 0),
            );

            const stockOnHandCount = Math.max(
              inventoryDeepNumber(summary, ['total_quantity_on_hand', 'quantity_on_hand', 'total_quantity', 'stock_batches_count', 'stock_batches']),
              inventoryDeepNumber(valuation, ['total_quantity_on_hand', 'quantity_on_hand', 'total_quantity', 'stock_batches_count', 'stock_batches']),
              analyticsMetricBatchRows.reduce((sum, batch) => sum + inventoryBatchQuantity(batch), 0),
            );

            const reorderLevelFor = (batch: UnknownRecord): number => {
              const product = productRecordFor(batch);

              return inventoryNumber(product, ['reorder_level', 'minimum_stock_level', 'min_stock_level']) ||
                inventoryNumber(batch, ['reorder_level', 'minimum_stock_level', 'min_stock_level']);
            };

            const lowStockRows = filteredBatchRows
              .map((batch) => ({
                batch,
                product: productNameFor(batch),
                batchNumber: inventoryText(batch, ['batch_number', 'lot_number'], '0'),
                quantity: inventoryBatchQuantity(batch),
                reorderLevel: reorderLevelFor(batch),
                value: inventoryBatchValue(batch),
              }))
              .filter((row) => row.reorderLevel > 0 && row.quantity <= row.reorderLevel)
              .sort((left, right) => right.value - left.value);

            const nearExpirySourceRows = (nearExpiryRows.length ? nearExpiryRows : analyticsMetricBatchRows)
              .filter((batch) => expiryFor(batch) !== '')
              .map((batch) => ({
                batch,
                product: productNameFor(batch),
                batchNumber: inventoryText(batch, ['batch_number', 'lot_number'], '0'),
                expiry: expiryFor(batch) || '0',
                quantity: inventoryBatchQuantity(batch),
                value: inventoryBatchValue(batch),
              }));

            const expiredRows = analyticsMetricBatchRows
              .filter((batch) => {
                const expiryText = expiryFor(batch);
                const expiryTime = expiryText ? new Date(expiryText).getTime() : Number.NaN;

                return Number.isFinite(expiryTime) && expiryTime < Date.now() && inventoryBatchQuantity(batch) > 0;
              })
              .map((batch) => ({
                batch,
                product: productNameFor(batch),
                batchNumber: inventoryText(batch, ['batch_number', 'lot_number'], '0'),
                expiry: expiryFor(batch) || '0',
                quantity: inventoryBatchQuantity(batch),
                value: inventoryBatchValue(batch),
              }));

            const highValueLowStockRows = lowStockRows
              .filter((row) => row.value > 0)
              .sort((left, right) => right.value - left.value);

            const movementRows = inventoryDeepRecordArray(analyticsMovements).filter((movement) => {
              const movementDate = inventoryText(movement, ['business_date', 'occurred_at', 'created_at', 'received_at'], '');

              return inventoryAnalyticsInDateRange(movementDate, analyticsAppliedDateFromFilter, analyticsAppliedDateToFilter);
            });

            const salesRegisterRows = inventoryDeepRecordArray(analyticsSalesRegister).filter((row) => {
              const salesDate = inventoryText(row, ['business_date', 'sale_date', 'created_at', 'invoice_date'], '');

              return inventoryAnalyticsInDateRange(salesDate, analyticsAppliedDateFromFilter, analyticsAppliedDateToFilter);
            });

            const receivedBatchRows = analyticsMetricBatchRows.filter((batch) => {
              const receivedDate = inventoryText(batch, ['received_at', 'created_at', 'business_date'], '');

              return inventoryAnalyticsInDateRange(receivedDate, analyticsAppliedDateFromFilter, analyticsAppliedDateToFilter);
            });

            const movementValue = (movement: UnknownRecord): number => {
              const directValue = inventoryNumber(movement, ['total_value', 'value', 'line_total', 'amount', 'cost_value']);

              if (directValue > 0) {
                return directValue;
              }

              const quantity = Math.abs(inventoryNumber(movement, ['quantity', 'qty', 'quantity_on_hand']));
              const unitCost = inventoryNumber(movement, ['unit_cost', 'cost', 'average_unit_cost', 'last_unit_cost']);

              if (quantity > 0 && unitCost > 0) {
                return quantity * unitCost;
              }

              const sellingPrice = inventoryNumber(movement, ['selling_price', 'unit_price', 'price']);

              return quantity > 0 && sellingPrice > 0 ? quantity * (sellingPrice / 1.3) : 0;
            };

            const salesIssuedValue = (row: UnknownRecord): number => {
              const directCost = inventoryNumber(row, ['cost_value', 'total_cost', 'cogs', 'stock_value']);

              if (directCost > 0) {
                return directCost;
              }

              const quantity = Math.max(inventoryNumber(row, ['quantity', 'qty', 'quantity_sold']), 1);
              const unitCost = inventoryNumber(row, ['unit_cost', 'cost', 'cost_price']);

              if (unitCost > 0) {
                return quantity * unitCost;
              }

              const salesValue = inventoryNumber(row, ['line_total', 'total_amount', 'amount', 'sales_value', 'gross_sales']);

              return salesValue > 0 ? salesValue / 1.3 : 0;
            };

            const movementType = (movement: UnknownRecord): string =>
              inventoryText(movement, ['movement_type', 'type', 'direction', 'transaction_type'], '').toLowerCase();

            const receivedRows = movementRows.filter((movement) =>
              /receive|received|purchase|stock_in|inbound|adjustment_in|return_in|opening/.test(movementType(movement)),
            );

            const issuedRows = movementRows.filter((movement) =>
              /issue|issued|sale|sold|dispense|stock_out|outbound|adjustment_out/.test(movementType(movement)),
            );

            const receivedFallbackRows = receivedBatchRows.length ? receivedBatchRows : analyticsMetricBatchRows;
            const movementReceivedValue = receivedRows.reduce((sum, movement) => sum + movementValue(movement), 0);
            const batchReceivedValue = receivedFallbackRows.reduce((sum, batch) => sum + inventoryBatchValue(batch), 0);
            const movementIssuedValue = issuedRows.reduce((sum, movement) => sum + movementValue(movement), 0);
            const registerIssuedValue = salesRegisterRows.reduce((sum, row) => sum + salesIssuedValue(row), 0);

            const stockReceivedValue = Math.max(movementReceivedValue, batchReceivedValue);
            const stockReceivedCount = Math.max(receivedRows.length, receivedFallbackRows.length);
            const stockIssuedValue = Math.max(
              movementIssuedValue,
              registerIssuedValue,
            );
            const stockIssuedCount = Math.max(issuedRows.length, salesRegisterRows.length);
            const turnoverValue = stockIssuedValue;
            const turnoverCount = stockIssuedCount;

            const lowStockValue = Math.max(
              inventoryDeepNumber(summary, ['low_stock_value', 'low_stock_stock_value']),
              inventoryDeepNumber(valuation, ['low_stock_value', 'low_stock_stock_value']),
              lowStockRows.reduce((sum, row) => sum + row.value, 0),
            );
            const lowStockCount = Math.max(
              inventoryDeepNumber(summary, ['low_stock_products_count', 'low_stock_count', 'products_below_reorder', 'low_stock_items']),
              inventoryDeepNumber(valuation, ['low_stock_products_count', 'low_stock_count', 'products_below_reorder', 'low_stock_items']),
              lowStockRows.length,
            );

            const nearExpiryValue = Math.max(
              inventoryDeepNumber(summary, ['near_expiry_value', 'near_expiry_stock_value', 'expiring_value', 'expiring_items_value']),
              inventoryDeepNumber(valuation, ['near_expiry_value', 'near_expiry_stock_value', 'expiring_value', 'expiring_items_value']),
              nearExpirySourceRows.reduce((sum, row) => sum + row.value, 0),
            );
            const nearExpiryCount = Math.max(
              inventoryDeepNumber(summary, ['near_expiry_batches_180_days_count', 'near_expiry_count', 'expiring_batches_count', 'expiring_items']),
              inventoryDeepNumber(valuation, ['near_expiry_batches_180_days_count', 'near_expiry_count', 'expiring_batches_count', 'expiring_items']),
              nearExpirySourceRows.length,
            );

            const expiredValue = Math.max(
              inventoryDeepNumber(summary, ['expired_stock_value', 'expired_value', 'expired_batches_value']),
              inventoryDeepNumber(valuation, ['expired_stock_value', 'expired_value', 'expired_batches_value']),
              expiredRows.reduce((sum, row) => sum + row.value, 0),
            );
            const expiredCount = Math.max(
              inventoryDeepNumber(summary, ['expired_batches_count', 'expired_count', 'expired_items_count']),
              inventoryDeepNumber(valuation, ['expired_batches_count', 'expired_count', 'expired_items_count']),
              expiredRows.length,
            );

            const healthyValue = Math.max(
              inventoryDeepNumber(summary, ['healthy_stock_value', 'healthy_value']),
              inventoryDeepNumber(valuation, ['healthy_stock_value', 'healthy_value']),
              totalValue - lowStockValue - nearExpiryValue - expiredValue,
              0,
            );
            const atRiskValue = lowStockValue + nearExpiryValue + expiredValue;

            const effectiveRiskKpiSummary = inventoryAnalyticsPayloadHasValue(analyticsKpiSummary)
              ? analyticsKpiSummary
              : analyticsKpiSummaryLastGood;

            const riskLowStockValue = Math.max(
              lowStockValue,
              inventoryDeepNumberValue(effectiveRiskKpiSummary, ['low_stock_value']),
              inventoryDeepNumberValue(analyticsBusinessOverviewLive, ['low_stock_value', 'lowStockValue', 'low_stock_inventory_value']),
            );
            const riskLowStockCount = Math.max(
              lowStockCount,
              inventoryDeepNumberValue(effectiveRiskKpiSummary, ['low_stock_count']),
              inventoryDeepNumberValue(analyticsBusinessOverviewLive, ['low_stock_count', 'lowStockCount', 'low_stock_items']),
            );
            const riskNearExpiryValue = Math.max(
              nearExpiryValue,
              inventoryDeepNumberValue(effectiveRiskKpiSummary, ['near_expiry_value']),
              inventoryDeepNumberValue(analyticsBusinessOverviewLive, ['near_expiry_value', 'nearExpiryValue', 'near_expiry_stock_value', 'expiring_value']),
            );
            const riskNearExpiryCount = Math.max(
              nearExpiryCount,
              inventoryDeepNumberValue(effectiveRiskKpiSummary, ['near_expiry_count']),
              inventoryDeepNumberValue(analyticsBusinessOverviewLive, ['near_expiry_count', 'nearExpiryCount', 'expiring_count', 'expiring_items']),
            );
            const riskExpiredValue = Math.max(
              expiredValue,
              inventoryDeepNumberValue(effectiveRiskKpiSummary, ['expired_value']),
              inventoryDeepNumberValue(analyticsBusinessOverviewLive, ['expired_value', 'expiredValue', 'expired_stock_value']),
            );
            const riskExpiredCount = Math.max(
              expiredCount,
              inventoryDeepNumberValue(effectiveRiskKpiSummary, ['expired_count']),
              inventoryDeepNumberValue(analyticsBusinessOverviewLive, ['expired_count', 'expiredCount', 'expired_items']),
            );
            const riskTotalInventoryValue = Math.max(
              totalValue,
              inventoryDeepNumberValue(effectiveRiskKpiSummary, ['total_inventory_value']),
              inventoryDeepNumberValue(analyticsBusinessOverviewLive, ['total_inventory_value', 'inventory_value', 'inventoryValue', 'stock_value', 'total_stock_value']),
              riskLowStockValue + riskNearExpiryValue + riskExpiredValue,
            );
            const riskStockOnHandCount = Math.max(
              stockOnHandCount,
              inventoryDeepNumberValue(effectiveRiskKpiSummary, ['stock_on_hand_count']),
              inventoryDeepNumberValue(analyticsBusinessOverviewLive, ['stock_on_hand_count', 'stockOnHandCount', 'stock_count', 'quantity_on_hand']),
              riskLowStockCount + riskNearExpiryCount + riskExpiredCount,
            );
            const riskHealthyValue = Math.max(
              riskTotalInventoryValue - riskLowStockValue - riskNearExpiryValue - riskExpiredValue,
              0,
            );

            const riskTotal = Math.max(
              riskTotalInventoryValue,
              riskLowStockValue + riskNearExpiryValue + riskExpiredValue + riskHealthyValue,
              1,
            );

            const riskRows = [
              { label: 'Expired / quarantined', count: riskExpiredCount, value: riskExpiredValue, color: '#dc2626' },
              { label: 'Near expiry', count: riskNearExpiryCount, value: riskNearExpiryValue, color: '#f97316' },
              { label: 'Low stock', count: riskLowStockCount, value: riskLowStockValue, color: '#eab308' },
              { label: 'Healthy stock', count: riskStockOnHandCount, value: riskHealthyValue, color: '#16a34a' },
            ];

            const preKpiCategoryTotals = new Map<string, number>();

            analyticsMetricBatchRows.forEach((batch) => {
              const category = categoryFor(batch);
              preKpiCategoryTotals.set(category, (preKpiCategoryTotals.get(category) ?? 0) + inventoryBatchValue(batch));
            });

            const preKpiCategoryTotalValue = Array.from(preKpiCategoryTotals.values())
              .reduce((sum, value) => sum + value, 0);

            const dashboardTotalInventoryValue = Math.max(
              totalValue,
              inventoryDeepNumberValue(analyticsBatches, [
                'total_inventory_value',
                'inventory_value',
                'stock_value',
                'stock_batches_value',
                'total_cost_value',
                'total_value',
              ]),
              analyticsMetricBatchRows.reduce((sum, batch) => sum + inventoryBatchValue(batch), 0),
            );

            const dashboardStockOnHandCount = Math.max(
              stockOnHandCount,
              inventoryDeepNumberValue(analyticsBatches, [
                'stock_batch_count',
                'stock_batches',
                'batch_count',
                'stock_on_hand_count',
                'total_quantity_on_hand',
                'quantity_on_hand',
                'quantity',
              ]),
              analyticsMetricBatchRows.reduce((sum, batch) => sum + inventoryBatchQuantity(batch), 0),
            );

            const dashboardStockReceivedValue = Math.max(
              stockReceivedValue,
              batchReceivedValue,
              inventoryDeepNumberValue(analyticsMovements, [
                'received_value',
                'stock_received_value',
                'purchase_value',
                'inbound_value',
              ]),
              inventoryDeepNumberValue(analyticsBatches, [
                'received_value',
                'stock_received_value',
                'stock_value',
                'inventory_value',
              ]),
            );

            const dashboardStockReceivedCount = Math.max(
              stockReceivedCount,
              receivedFallbackRows.length,
              inventoryDeepNumberValue(analyticsMovements, [
                'received_count',
                'stock_received_count',
                'purchase_count',
              ]),
              inventoryDeepNumberValue(analyticsBatches, [
                'received_count',
                'stock_received_count',
                'stock_batch_count',
                'batch_count',
              ]),
            );

            const dashboardStockIssuedValue = Math.max(
              stockIssuedValue,
              registerIssuedValue,
              movementIssuedValue,
              inventoryDeepNumberValue(analyticsMovements, [
                'issued_value',
                'stock_issued_value',
                'stock_out_value',
                'sales_cost_value',
                'cogs',
              ]),
              inventoryDeepNumberValue(analyticsSalesRegister, [
                'cost_value',
                'total_cost',
                'cogs',
                'stock_value',
              ]),
            );

            const dashboardStockIssuedCount = Math.max(
              stockIssuedCount,
              issuedRows.length,
              salesRegisterRows.length,
              inventoryDeepNumberValue(analyticsMovements, [
                'issued_count',
                'stock_issued_count',
                'stock_out_count',
              ]),
              inventoryDeepNumberValue(analyticsSalesRegister, [
                'transaction_count',
                'sales_count',
                'count',
              ]),
            );

            const dashboardTurnoverValue = Math.max(
              turnoverValue,
              dashboardStockIssuedValue,
            );

            const dashboardTurnoverCount = Math.max(
              turnoverCount,
              dashboardStockIssuedCount,
            );

            const finalInventoryKpiTotalValue = inventoryMaxPositive(
              dashboardTotalInventoryValue,
              totalValue,
              preKpiCategoryTotalValue,
              analyticsMetricBatchRows.reduce((sum, batch) => sum + inventoryBatchValue(batch), 0),
            );

            const finalInventoryKpiStockOnHandCount = inventoryMaxPositive(
              dashboardStockOnHandCount,
              stockOnHandCount,
              analyticsMetricBatchRows.reduce((sum, batch) => sum + inventoryBatchQuantity(batch), 0),
            );

            const finalInventoryKpiReceivedValue = inventoryMaxPositive(
              dashboardStockReceivedValue,
              stockReceivedValue,
              batchReceivedValue,
              finalInventoryKpiTotalValue,
            );

            const finalInventoryKpiReceivedCount = inventoryMaxPositive(
              dashboardStockReceivedCount,
              stockReceivedCount,
              receivedFallbackRows.length,
              finalInventoryKpiStockOnHandCount,
            );

            const finalInventoryKpiIssuedValue = inventoryMaxPositive(
              dashboardStockIssuedValue,
              stockIssuedValue,
              registerIssuedValue,
              movementIssuedValue,
            );

            const finalInventoryKpiIssuedCount = inventoryMaxPositive(
              dashboardStockIssuedCount,
              stockIssuedCount,
              issuedRows.length,
              salesRegisterRows.length,
            );

            const finalInventoryKpiLowStockValue = inventoryMaxPositive(
              lowStockValue,
              lowStockRows.reduce((sum, row) => sum + row.value, 0),
            );

            const finalInventoryKpiLowStockCount = inventoryMaxPositive(
              lowStockCount,
              lowStockRows.length,
            );

            const finalInventoryKpiNearExpiryValue = inventoryMaxPositive(
              nearExpiryValue,
              nearExpirySourceRows.reduce((sum, row) => sum + row.value, 0),
            );

            const finalInventoryKpiNearExpiryCount = inventoryMaxPositive(
              nearExpiryCount,
              nearExpirySourceRows.length,
            );

            const finalInventoryKpiExpiredValue = inventoryMaxPositive(
              expiredValue,
              expiredRows.reduce((sum, row) => sum + row.value, 0),
            );

            const finalInventoryKpiExpiredCount = inventoryMaxPositive(
              expiredCount,
              expiredRows.length,
            );

            const finalInventoryKpiTurnoverValue = inventoryMaxPositive(
              dashboardTurnoverValue,
              finalInventoryKpiIssuedValue,
            );

            const finalInventoryKpiTurnoverCount = inventoryMaxPositive(
              dashboardTurnoverCount,
              finalInventoryKpiIssuedCount,
            );



            const categoryTotals = new Map<string, number>();

            analyticsMetricBatchRows.forEach((batch) => {
              const category = categoryFor(batch);
              categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + inventoryBatchValue(batch));
            });

            const categoryRows = Array.from(categoryTotals.entries())
              .map(([label, value]) => ({ label, value }))
              .sort((left, right) => right.value - left.value)
              .slice(0, 8);

            const liveCategoryCardTotalValue = categoryRows.reduce((sum, row) => sum + row.value, 0);

            const displayedTotalInventoryValue = Math.max(
              liveCategoryCardTotalValue,
              analyticsVisibleKpiFallback.totalInventoryValue,
              dashboardTotalInventoryValue,
              totalValue,
            );


            const displayedStockOnHandCount = Math.max(
              dashboardStockOnHandCount,
              analyticsVisibleKpiFallback.stockOnHandCount,
              stockOnHandCount,
              analyticsMetricBatchRows.reduce((sum, batch) => sum + inventoryBatchQuantity(batch), 0),
            );

            const displayedReceivedValue = Math.max(
              dashboardStockReceivedValue,
              analyticsVisibleKpiFallback.receivedValue,
              stockReceivedValue,
              batchReceivedValue,
              displayedTotalInventoryValue,
            );

            const displayedReceivedCount = Math.max(
              dashboardStockReceivedCount,
              analyticsVisibleKpiFallback.receivedCount,
              stockReceivedCount,
              receivedFallbackRows.length,
              analyticsMetricBatchRows.length,
            );

            const displayedIssuedValue = Math.max(
              dashboardStockIssuedValue,
              stockIssuedValue,
              registerIssuedValue,
              movementIssuedValue,
            );

            const displayedIssuedCount = Math.max(
              dashboardStockIssuedCount,
              stockIssuedCount,
              issuedRows.length,
              salesRegisterRows.length,
            );

            const effectiveAnalyticsKpiSummary = inventoryAnalyticsPayloadHasValue(analyticsKpiSummary)
              ? analyticsKpiSummary
              : analyticsKpiSummaryLastGood;
            const apiInventoryKpiTotalValue = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['total_inventory_value']);
            const apiInventoryKpiStockOnHandCount = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['stock_on_hand_count']);
            const apiInventoryKpiReceivedValue = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['stock_received_value']);
            const apiInventoryKpiReceivedCount = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['stock_received_count']);
            const apiInventoryKpiIssuedValue = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['stock_issued_value']);
            const apiInventoryKpiIssuedCount = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['stock_issued_count']);
            const apiInventoryKpiLowStockValue = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['low_stock_value']);
            const apiInventoryKpiLowStockCount = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['low_stock_count']);
            const apiInventoryKpiNearExpiryValue = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['near_expiry_value']);
            const apiInventoryKpiNearExpiryCount = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['near_expiry_count']);
            const apiInventoryKpiExpiredValue = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['expired_value']);
            const apiInventoryKpiExpiredCount = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['expired_count']);
            const apiInventoryKpiTurnoverValue = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['turnover_value']);
            const apiInventoryKpiTurnoverCount = inventoryDeepNumberValue(effectiveAnalyticsKpiSummary, ['turnover_count']);

            const businessOverviewInventoryValue = inventoryDeepNumberValue(analyticsBusinessOverviewLive, [
              'total_inventory_value',
              'inventory_value',
              'inventoryValue',
              'stock_value',
              'total_stock_value',
              'inventory_valuation',
            ]);
            const businessOverviewStockOnHandCount = inventoryDeepNumberValue(analyticsBusinessOverviewLive, [
              'stock_on_hand_count',
              'stockOnHandCount',
              'inventory_count',
              'stock_count',
              'total_stock_on_hand',
              'quantity_on_hand',
            ]);
            const businessOverviewLowStockValue = inventoryDeepNumberValue(analyticsBusinessOverviewLive, [
              'low_stock_value',
              'lowStockValue',
              'low_stock_inventory_value',
            ]);
            const businessOverviewLowStockCount = inventoryDeepNumberValue(analyticsBusinessOverviewLive, [
              'low_stock_count',
              'lowStockCount',
              'low_stock_items',
            ]);
            const businessOverviewNearExpiryValue = inventoryDeepNumberValue(analyticsBusinessOverviewLive, [
              'near_expiry_value',
              'nearExpiryValue',
              'near_expiry_stock_value',
              'expiring_value',
            ]);
            const businessOverviewNearExpiryCount = inventoryDeepNumberValue(analyticsBusinessOverviewLive, [
              'near_expiry_count',
              'nearExpiryCount',
              'expiring_count',
              'expiring_items',
            ]);
            const businessOverviewExpiredValue = inventoryDeepNumberValue(analyticsBusinessOverviewLive, [
              'expired_value',
              'expiredValue',
              'expired_stock_value',
            ]);
            const businessOverviewExpiredCount = inventoryDeepNumberValue(analyticsBusinessOverviewLive, [
              'expired_count',
              'expiredCount',
              'expired_items',
            ]);

            const alignedInventoryKpiTotalValue = businessOverviewInventoryValue > 0 ? businessOverviewInventoryValue : apiInventoryKpiTotalValue;
            const alignedInventoryKpiStockOnHandCount = businessOverviewStockOnHandCount > 0 ? businessOverviewStockOnHandCount : apiInventoryKpiStockOnHandCount;
            const alignedInventoryKpiLowStockValue = businessOverviewLowStockValue > 0 ? businessOverviewLowStockValue : apiInventoryKpiLowStockValue;
            const alignedInventoryKpiLowStockCount = businessOverviewLowStockCount > 0 ? businessOverviewLowStockCount : apiInventoryKpiLowStockCount;
            const alignedInventoryKpiNearExpiryValue = businessOverviewNearExpiryValue > 0 ? businessOverviewNearExpiryValue : apiInventoryKpiNearExpiryValue;
            const alignedInventoryKpiNearExpiryCount = businessOverviewNearExpiryCount > 0 ? businessOverviewNearExpiryCount : apiInventoryKpiNearExpiryCount;
            const alignedInventoryKpiExpiredValue = businessOverviewExpiredValue > 0 ? businessOverviewExpiredValue : apiInventoryKpiExpiredValue;
            const alignedInventoryKpiExpiredCount = businessOverviewExpiredCount > 0 ? businessOverviewExpiredCount : apiInventoryKpiExpiredCount;

            const kpiCards = [
              { label: 'Total Inventory Value', value: formatCurrency(alignedInventoryKpiTotalValue), target: 'product-inventory' },
              { label: 'Stock on Hand Count', value: formatCompactNumber(alignedInventoryKpiStockOnHandCount), target: 'product-inventory' },
              { label: 'Stock Received Value', value: formatCurrency(apiInventoryKpiReceivedValue), target: 'purchase-orders' },
              { label: 'Stock Received Count', value: formatCompactNumber(apiInventoryKpiReceivedCount), target: 'purchase-orders' },
              { label: 'Stock Issued Value', value: formatCurrency(apiInventoryKpiIssuedValue), target: 'product-inventory' },
              { label: 'Stock Issued Count', value: formatCompactNumber(apiInventoryKpiIssuedCount), target: 'product-inventory' },
              { label: 'Low Stock Value', value: formatCurrency(alignedInventoryKpiLowStockValue), target: 'low-stock' },
              { label: 'Low Stock Count', value: formatCompactNumber(alignedInventoryKpiLowStockCount), target: 'low-stock' },
              { label: 'Near Expiry Value', value: formatCurrency(alignedInventoryKpiNearExpiryValue), target: 'near-expiry' },
              { label: 'Near Expiry Count', value: formatCompactNumber(alignedInventoryKpiNearExpiryCount), target: 'near-expiry' },
              { label: 'Expired Value', value: formatCurrency(alignedInventoryKpiExpiredValue), target: 'near-expiry' },
              { label: 'Expired Count', value: formatCompactNumber(alignedInventoryKpiExpiredCount), target: 'near-expiry' },
              { label: 'Turnover Value', value: formatCurrency(apiInventoryKpiTurnoverValue), target: 'product-inventory' },
              { label: 'Turnover Count', value: formatCompactNumber(apiInventoryKpiTurnoverCount), target: 'product-inventory' },
            ];

            const maxCategoryValue = Math.max(...categoryRows.map((row) => row.value), 1);
            const analyticsTrendDateKeys = inventoryAnalyticsDateKeys(analyticsAppliedDateFromFilter, analyticsAppliedDateToFilter);
            const analyticsTrendWeeks = Array.from(
              new Set(analyticsTrendDateKeys.map((_, index) => `week-${Math.floor(index / 7) + 1}`)),
            );
            const selectedTrendDateKeys = analyticsTrendWeekSelection === 'all'
              ? analyticsTrendDateKeys
              : analyticsTrendDateKeys.filter((_, index) => `week-${Math.floor(index / 7) + 1}` === analyticsTrendWeekSelection);

            const inventoryAnalyticsCardSourceTrendDateKeys =
              selectedTrendDateKeys.length > 0
                ? selectedTrendDateKeys
                : [analyticsAppliedDateToFilter];

            const inventoryAnalyticsCardSourceAsAtIndex = Math.max(
              inventoryAnalyticsCardSourceTrendDateKeys.length - 1,
              0,
            );

            const inventoryAnalyticsCardSourceStockValue = displayedTotalInventoryValue;

            const inventoryAnalyticsCardSourceNearExpiryValue = Math.max(
              apiInventoryKpiNearExpiryValue,
              nearExpiryValue,
              analyticsVisibleKpiFallback.nearExpiryValue,
            );

            const inventoryAnalyticsCardStockValueTrendValues =
              inventoryAnalyticsCardSourceTrendDateKeys.map((_, index) =>
                index === inventoryAnalyticsCardSourceAsAtIndex
                  ? inventoryAnalyticsCardSourceStockValue
                  : 0,
              );

            const inventoryAnalyticsCardNearExpiryTrendValues =
              inventoryAnalyticsCardSourceTrendDateKeys.map((_, index) =>
                index === inventoryAnalyticsCardSourceAsAtIndex
                  ? inventoryAnalyticsCardSourceNearExpiryValue
                  : 0,
              );


            const stockMovementByDate = new Map<string, { received: number; issued: number }>();

            movementRows.forEach((movement) => {
              const dateKey = inventoryText(movement, ['business_date', 'occurred_at', 'created_at', 'received_at'], '').slice(0, 10);

              if (!dateKey) {
                return;
              }

              const current = stockMovementByDate.get(dateKey) ?? { received: 0, issued: 0 };
              const value = movementValue(movement);

              if (receivedRows.includes(movement)) {
                current.received += value;
              }

              if (issuedRows.includes(movement)) {
                current.issued += value;
              }

              stockMovementByDate.set(dateKey, current);
            });

            const openingInventoryValue = Math.max(
              totalValue -
                analyticsTrendDateKeys.reduce((sum, dateKey) => {
                  const movement = stockMovementByDate.get(dateKey);

                  return sum + (movement?.received ?? 0) - (movement?.issued ?? 0);
                }, 0),
              0,
            );

            let runningInventoryValue = openingInventoryValue;

            const fullTrendValues = analyticsTrendDateKeys.map((dateKey) => {
              const movement = stockMovementByDate.get(dateKey);
              runningInventoryValue += (movement?.received ?? 0) - (movement?.issued ?? 0);

              return Math.max(runningInventoryValue, 0);
            });

            const nearExpiryValueByDate = new Map<string, number>();

            nearExpirySourceRows.forEach((row) => {
              const expiryDate = (
                row.expiry ||
                inventoryText(row.batch, ['expiry_date', 'expires_at', 'expiry', 'expiration_date'], '')
              ).slice(0, 10);

              if (!expiryDate || !analyticsTrendDateKeys.includes(expiryDate)) {
                return;
              }

              nearExpiryValueByDate.set(expiryDate, (nearExpiryValueByDate.get(expiryDate) ?? 0) + row.value);
            });

            let fullNearExpiryTrendValues = analyticsTrendDateKeys.map((dateKey) =>
              nearExpiryValueByDate.get(dateKey) ?? 0,
            );

            // REAL_STOCK_VALUE_TREND_FROM_BATCHES_V1
            // Build Stock Value Trend from real loaded stock batches.
            // If movement rows exist, reconstruct value backwards from the current stock snapshot.
            // If movement rows do not exist, show the real current snapshot only on the selected end date.
            const realCurrentStockValueForTrend = analyticsMetricBatchRows.reduce(
              (sum, batch) => sum + inventoryBatchValue(batch),
              0,
            );

            const stockMovementEntriesForTrend = Array.from(stockMovementByDate.entries())
              .filter(([dateKey]) => analyticsTrendDateKeys.includes(dateKey));

            // TOTAL_INVENTORY_TREND_VISIBLE_REAL_DATA_V1
            const visibleStockTrendSnapshotDate =
              selectedTrendDateKeys[selectedTrendDateKeys.length - 1] ??
              analyticsTrendDateKeys[analyticsTrendDateKeys.length - 1] ??
              analyticsAppliedDateToFilter;

            let realFullStockTrendValues = analyticsTrendDateKeys.map((dateKey) =>
              dateKey === visibleStockTrendSnapshotDate ? realCurrentStockValueForTrend : 0,
            );

            if (stockMovementEntriesForTrend.length > 0) {
              let reverseRunningStockValue = realCurrentStockValueForTrend;
              const reverseValues = new Map<string, number>();

              [...analyticsTrendDateKeys].reverse().forEach((dateKey) => {
                reverseValues.set(dateKey, Math.max(reverseRunningStockValue, 0));

                const movement = stockMovementByDate.get(dateKey);
                if (movement) {
                  reverseRunningStockValue -= (movement.received ?? 0) - (movement.issued ?? 0);
                }
              });

              realFullStockTrendValues = analyticsTrendDateKeys.map((dateKey) =>
                reverseValues.get(dateKey) ?? 0,
              );
            }

            const trendValues = selectedTrendDateKeys.map((dateKey) =>
              realFullStockTrendValues[analyticsTrendDateKeys.indexOf(dateKey)] ?? 0,
            );
            const nearExpiryTrendValues = selectedTrendDateKeys.map((dateKey) =>
              fullNearExpiryTrendValues[analyticsTrendDateKeys.indexOf(dateKey)] ?? 0,
            );
            const trendMax = Math.max(...trendValues, 1);
            const trendStartValue = trendValues.find((value) => value > 0) ?? 0;
            const trendEndValue = trendValues[trendValues.length - 1] ?? 0;
            const trendPercentChange = trendStartValue > 0
              ? ((trendEndValue - trendStartValue) / trendStartValue) * 100
              : 0;

            return (
              <>
                {analyticsLoading && (
                  <div className="inventory-analytics-inline-loading">
                    Loading live data…
                  </div>
                )}

                {analyticsError && (
                  <div className="inventory-professional-state is-warning" role="alert">
                    {analyticsError}
                  </div>
                )}

                <div className="inventory-analytics-request-filters">
                  <label>
                    <span>Date From</span>
                    <input type="date" value={analyticsDateFromFilter} onChange={(event) => setAnalyticsDateFromFilter(event.target.value)} />
                  </label>

                  <label>
                    <span>Date To</span>
                    <input type="date" value={analyticsDateToFilter} onChange={(event) => setAnalyticsDateToFilter(event.target.value)} />
                  </label>

                  <label>
                    <span>Category</span>
                    <select value={analyticsCategoryFilter} onChange={(event) => setAnalyticsCategoryFilter(event.target.value)}>
                      <option value="all">All categories</option>
                      {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </label>

                  <label>
                    <span>Product</span>
                    <select value={analyticsProductFilter} onChange={(event) => setAnalyticsProductFilter(event.target.value)}>
                      <option value="all">All products</option>
                      {productOptions.map((product) => <option key={product} value={product}>{product}</option>)}
                    </select>
                  </label>

                  <label>
                    <span>Stock Location</span>
                    <select value={analyticsLocationFilter} onChange={(event) => setAnalyticsLocationFilter(event.target.value)}>
                      <option value="all">All locations</option>
                      {locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
                    </select>
                  </label>

                  <label>
                    <span>Expiry From</span>
                    <input type="date" value={analyticsExpiryFromFilter} onChange={(event) => setAnalyticsExpiryFromFilter(event.target.value)} />
                  </label>

                  <label>
                    <span>Expiry To</span>
                    <input type="date" value={analyticsExpiryToFilter} onChange={(event) => setAnalyticsExpiryToFilter(event.target.value)} />
                  </label>

                  <button
                    type="button"
                    onClick={applyInventoryAnalyticsFilters}
                  >
                    Apply Filters
                  </button>
                </div>

                <div className="inventory-analytics-request-kpis">
                  {kpiCards.map((card) => (
                    <article key={card.label}>
                      <small>{card.label}</small>
                      <strong>{card.value}</strong>
                      
                    </article>
                  ))}
                </div>

                <div className="inventory-analytics-request-grid">
                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Stock Value Trend</h3>
                      <select
                        className="inventory-analytics-trend-header-select"
                        value={analyticsTrendWeekSelection}
                        onChange={(event) => setAnalyticsTrendWeekSelection(event.target.value)}
                      >
                        <option value="all">Full range</option>
                        {analyticsTrendWeeks.map((week) => (
                          <option key={week} value={week}>
                            {week.replace('week-', 'Week ')}
                          </option>
                        ))}
                      </select>
                      <span className="inventory-analytics-trend-change">
                        {trendPercentChange.toFixed(1)}%
                      </span>
                      <button type="button" onClick={() => onOpenWorkspace('product-inventory')}>More</button>
                    </header>

                    <div className="inventory-analytics-request-bars">
                      {trendValues.map((value, index) => (
                        <div key={`stock-trend-${index}`}>
                          <i style={{ height: `${Math.max((value / trendMax) * 100, value > 0 ? 12 : 4)}%` }} />
                          <small>{selectedTrendDateKeys[index] ?? String(index + 1)}</small>
                        </div>
                      ))}
                    </div>

                    <div className="inventory-analytics-stacked-bar-trends">
                      {[
                        { label: 'Total Inventory Trend', values: inventoryAnalyticsCardStockValueTrendValues },
                        { label: 'Near Expiry Trend', values: inventoryAnalyticsCardNearExpiryTrendValues },
                      ].map((chart) => {
                        const maxChartValue = Math.max(...chart.values, 1);

                        return (
                          <div key={chart.label} className="inventory-analytics-bar-trend-card">
                            <strong>{chart.label}</strong>
                            <div className="inventory-analytics-bar-trend-bars">
                              {chart.values.map((value, index) => {
                                const height = value > 0
                                  ? Math.max((value / maxChartValue) * 100, 7)
                                  : 2;

                                return (
                                  <div key={`${chart.label}-${index}`}>
                                    <span>{formatInventoryTrendMillion(value)}</span>
                                    <i style={{ height: `${height}%` }} />
                                    <small>{inventoryAnalyticsDayNumberLabel(selectedTrendDateKeys[index] ?? '', index)}</small>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Inventory Risk Overview</h3>
                      <select
                        className="inventory-analytics-trend-header-select"
                        value={analyticsTrendWeekSelection}
                        onChange={(event) => setAnalyticsTrendWeekSelection(event.target.value)}
                      >
                        <option value="all">Full range</option>
                        {analyticsTrendWeeks.map((week) => (
                          <option key={week} value={week}>
                            {week.replace('week-', 'Week ')}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => onOpenWorkspace('product-inventory')}>More</button>
                    </header>

                    <div className="inventory-analytics-risk-summary">
                      <strong>{formatCurrency(atRiskValue)}</strong>
                      <span>{((atRiskValue / riskTotal) * 100).toFixed(1)}% at risk</span>
                    </div>

                    <div className="inventory-analytics-risk-bars">
                      {riskRows.map((row) => (
                        <div key={row.label}>
                          <span>{row.label}</span>
                          <i>
                            <em
                              style={{
                                width: `${Math.max((row.value / riskTotal) * 100, row.value > 0 ? 4 : 0)}%`,
                                backgroundColor: row.color,
                              }}
                            />
                          </i>
                          <strong>{formatCurrency(row.value)}</strong>
                        </div>
                      ))}
                    </div>

                    <div className="inventory-analytics-request-table-scroll">
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
                          {riskRows.map((row) => (
                            <tr key={row.label}>
                              <td><span className="inventory-analytics-risk-dot" style={{ backgroundColor: row.color }} />{row.label}</td>
                              <td>{formatCompactNumber(row.count)}</td>
                              <td>{formatCurrency(row.value)}</td>
                              <td>{((row.value / riskTotal) * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Inventory Value by Category</h3>
                      <button type="button" onClick={() => onOpenWorkspace('product-master')}>More</button>
                    </header>

                    <div className="inventory-analytics-request-category-bars">
                      {categoryRows.length === 0 ? (
                        <div><span>0</span><i><em style={{ width: '0%' }} /></i><strong>0</strong></div>
                      ) : categoryRows.map((row) => (
                        <div key={row.label}>
                          <span>{row.label}</span>
                          <i><em style={{ width: `${Math.max((row.value / maxCategoryValue) * 100, 4)}%` }} /></i>
                          <strong>{formatCurrency(row.value)}</strong>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Low Stock Watch List</h3>
                      <select
                        className="inventory-analytics-trend-header-select"
                        value={analyticsTrendWeekSelection}
                        onChange={(event) => setAnalyticsTrendWeekSelection(event.target.value)}
                      >
                        <option value="all">Full range</option>
                        {analyticsTrendWeeks.map((week) => (
                          <option key={week} value={week}>
                            {week.replace('week-', 'Week ')}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => onOpenWorkspace('low-stock')}>More</button>
                    </header>

                    <div className="inventory-analytics-request-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Batch</th>
                            <th>On Hand</th>
                            <th>Reorder</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lowStockRows.length === 0 ? (
                            <tr><td colSpan={5}>0 records</td></tr>
                          ) : lowStockRows.map((row, index) => (
                            <tr key={`${row.product}-${row.batchNumber}-${index}`}>
                              <td>{row.product}</td>
                              <td>{row.batchNumber}</td>
                              <td>{formatCompactNumber(row.quantity)}</td>
                              <td>{formatCompactNumber(row.reorderLevel)}</td>
                              <td>{formatCurrency(row.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Near Expiry Review</h3>
                      <select
                        className="inventory-analytics-trend-header-select"
                        value={analyticsTrendWeekSelection}
                        onChange={(event) => setAnalyticsTrendWeekSelection(event.target.value)}
                      >
                        <option value="all">Full range</option>
                        {analyticsTrendWeeks.map((week) => (
                          <option key={week} value={week}>
                            {week.replace('week-', 'Week ')}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => onOpenWorkspace('near-expiry')}>More</button>
                    </header>

                    <div className="inventory-analytics-request-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Batch</th>
                            <th>Expiry</th>
                            <th>Qty</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nearExpirySourceRows.length === 0 ? (
                            <tr><td colSpan={5}>0 records</td></tr>
                          ) : nearExpirySourceRows.map((row, index) => (
                            <tr key={`${row.product}-${row.batchNumber}-${index}`}>
                              <td>{row.product}</td>
                              <td>{row.batchNumber}</td>
                              <td>{row.expiry}</td>
                              <td>{formatCompactNumber(row.quantity)}</td>
                              <td>{formatCurrency(row.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Expired Items</h3>
                      <select
                        className="inventory-analytics-trend-header-select"
                        value={analyticsTrendWeekSelection}
                        onChange={(event) => setAnalyticsTrendWeekSelection(event.target.value)}
                      >
                        <option value="all">Full range</option>
                        {analyticsTrendWeeks.map((week) => (
                          <option key={week} value={week}>
                            {week.replace('week-', 'Week ')}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => onOpenWorkspace('near-expiry')}>More</button>
                    </header>

                    <div className="inventory-analytics-request-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Batch</th>
                            <th>Expiry</th>
                            <th>Qty</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expiredRows.length === 0 ? (
                            <tr><td colSpan={5}>0 records</td></tr>
                          ) : expiredRows.map((row, index) => (
                            <tr key={`${row.product}-${row.batchNumber}-${index}`}>
                              <td>{row.product}</td>
                              <td>{row.batchNumber}</td>
                              <td>{row.expiry}</td>
                              <td>{formatCompactNumber(row.quantity)}</td>
                              <td>{formatCurrency(row.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Top Fast Moving Products</h3>
                      <select
                        className="inventory-analytics-trend-header-select"
                        value={analyticsTrendWeekSelection}
                        onChange={(event) => setAnalyticsTrendWeekSelection(event.target.value)}
                      >
                        <option value="all">Full range</option>
                        {analyticsTrendWeeks.map((week) => (
                          <option key={week} value={week}>
                            {week.replace('week-', 'Week ')}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => onOpenWorkspace('product-inventory')}>More</button>
                    </header>

                    <div className="inventory-analytics-request-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Qty Sold</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr><td colSpan={3}>0 records</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Slow Moving / Non-Moving Products</h3>
                      <select
                        className="inventory-analytics-trend-header-select"
                        value={analyticsTrendWeekSelection}
                        onChange={(event) => setAnalyticsTrendWeekSelection(event.target.value)}
                      >
                        <option value="all">Full range</option>
                        {analyticsTrendWeeks.map((week) => (
                          <option key={week} value={week}>
                            {week.replace('week-', 'Week ')}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => onOpenWorkspace('product-inventory')}>More</button>
                    </header>

                    <div className="inventory-analytics-request-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Last Movement</th>
                            <th>On Hand</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr><td colSpan={3}>0 records</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>High Value – Low Stock Risk</h3>
                      <select
                        className="inventory-analytics-trend-header-select"
                        value={analyticsTrendWeekSelection}
                        onChange={(event) => setAnalyticsTrendWeekSelection(event.target.value)}
                      >
                        <option value="all">Full range</option>
                        {analyticsTrendWeeks.map((week) => (
                          <option key={week} value={week}>
                            {week.replace('week-', 'Week ')}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => onOpenWorkspace('product-inventory')}>More</button>
                    </header>

                    <div className="inventory-analytics-request-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Batch</th>
                            <th>On Hand</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {highValueLowStockRows.length === 0 ? (
                            <tr><td colSpan={4}>0 records</td></tr>
                          ) : highValueLowStockRows.map((row, index) => (
                            <tr key={`${row.product}-${row.batchNumber}-${index}`}>
                              <td>{row.product}</td>
                              <td>{row.batchNumber}</td>
                              <td>{formatCompactNumber(row.quantity)}</td>
                              <td>{formatCurrency(row.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="inventory-analytics-request-card inventory-analytics-request-insight">
                    <header>
                      <h3>Inventory Insight</h3>
                      <button type="button" onClick={() => onOpenWorkspace('product-inventory')}>More</button>
                    </header>

                    <ul>
                      <li>{lowStockCount > 0 ? 'Low-stock pressure exists and needs reorder review.' : 'Low-stock pressure: 0'}</li>
                      <li>{nearExpiryCount > 0 ? 'Near-expiry batches require FEFO action.' : 'Near-expiry pressure: 0'}</li>
                      <li>{expiredCount > 0 ? 'Expired stock requires quarantine/write-off review.' : 'Expired-stock pressure: 0'}</li>
                    </ul>
                  </article>
                </div>
              </>
            );
          })()}
        </section>
      )}
    </section>

  );
}


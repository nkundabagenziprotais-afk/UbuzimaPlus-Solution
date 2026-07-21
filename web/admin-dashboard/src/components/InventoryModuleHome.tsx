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

function inventoryRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
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
  return inventoryNumber(batch, [
    'available_quantity',
    'quantity_on_hand',
    'on_hand',
    'quantity',
  ]);
}

function inventoryBatchValue(batch: UnknownRecord): number {
  const quantity = inventoryBatchQuantity(batch);
  const unitCost = inventoryNumber(batch, ['unit_cost', 'cost_price', 'purchase_price']);
  const sellingPrice = inventoryNumber(batch, ['selling_price', 'retail_price']);

  return quantity * (unitCost || sellingPrice);
}

function inventoryBatchProductName(batch: UnknownRecord): string {
  const product = inventoryNestedRecord(batch, 'product');

  return inventoryText(
    product,
    ['name', 'product_name', 'display_name'],
    inventoryText(batch, ['product_name', 'name']),
  );
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
  const [analyticsProducts, setAnalyticsProducts] = useState<unknown>(null);
  const [analyticsBatches, setAnalyticsBatches] = useState<unknown>(null);
  const [analyticsNearExpiry, setAnalyticsNearExpiry] = useState<unknown>(null);
  const [analyticsLocations, setAnalyticsLocations] = useState<unknown>(null);

  const [analyticsLoading, setAnalyticsLoading] =
    useState(true);

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

      setAnalyticsProducts(productsResult.status === 'fulfilled' ? productsResult.value : null);
      setAnalyticsBatches(batchesResult.status === 'fulfilled' ? batchesResult.value : null);
      setAnalyticsNearExpiry(nearExpiryResult.status === 'fulfilled' ? nearExpiryResult.value : null);
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
  }, [tenantSlug, token]);

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

        <button type="button" className="inventory-analytics-photo-export">
          Export Report
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
        <section className="inventory-home-analytics inventory-analytics-photo-dashboard">
          {analyticsLoading && (
            <div className="inventory-professional-state">
              Loading Inventory analytics…
            </div>
          )}

          {!analyticsLoading && analyticsError && (
            <div className="inventory-professional-state is-warning" role="alert">
              {analyticsError}
            </div>
          )}

          {!analyticsLoading && !analyticsError && (() => {
            const productRows = inventoryArrayFromResponse(analyticsProducts, ['products', 'items', 'rows']);
            const batchRows = inventoryArrayFromResponse(analyticsBatches, ['batches', 'items', 'rows']);
            const nearExpiryRows = inventoryArrayFromResponse(analyticsNearExpiry, ['batches', 'items', 'rows']);
            const locationRows = inventoryArrayFromResponse(analyticsLocations, ['locations', 'items', 'rows']);

            const totalValue =
              findNumericSignal(valuation, ['total_inventory_value', 'inventory_value', 'total_stock_value', 'total_cost_value']) ??
              findNumericSignal(summary, ['total_inventory_value', 'inventory_value', 'total_stock_value']) ??
              batchRows.reduce((sum, batch) => sum + inventoryBatchValue(batch), 0);

            const stockOnHand =
              findNumericSignal(summary, ['total_quantity_on_hand', 'quantity_on_hand', 'total_quantity']) ??
              batchRows.reduce((sum, batch) => sum + inventoryBatchQuantity(batch), 0);

            const lowStockCount =
              findNumericSignal(summary, ['low_stock_products_count', 'low_stock_count', 'products_below_reorder']) ?? 0;

            const nearExpiryCount =
              findNumericSignal(summary, ['near_expiry_batches_180_days_count', 'near_expiry_count', 'expiring_batches_count']) ??
              nearExpiryRows.length;

            const expiredSummaryCount =
              findNumericSignal(summary, ['expired_batches_count', 'expired_count', 'expired_items_count']) ?? 0;

            const productCount =
              productRows.length ||
              (findNumericSignal(summary, ['products_count', 'product_count', 'total_products']) ?? 0);

            const categoryTotals = new Map<string, number>();

            batchRows.forEach((batch) => {
              const product = inventoryNestedRecord(batch, 'product');
              const nestedCategory = inventoryNestedRecord(product, 'category');
              const category = inventoryText(
                product,
                ['category_name', 'category'],
                inventoryText(nestedCategory, ['name'], 'Uncategorised'),
              );

              categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + inventoryBatchValue(batch));
            });

            const categoryRows = Array.from(categoryTotals.entries())
              .map(([label, value]) => ({ label, value }))
              .sort((left, right) => right.value - left.value)
              .slice(0, 6);

            const maxCategoryValue = Math.max(...categoryRows.map((row) => row.value), 1);

            const nearExpiryTableRows = (nearExpiryRows.length ? nearExpiryRows : batchRows)
              .filter((batch) => inventoryText(batch, ['expiry_date', 'expires_at'], '') !== '')
              .slice(0, 5);

            const expiredTableRows = batchRows
              .filter((batch) => {
                const expiryText = inventoryText(batch, ['expiry_date', 'expires_at'], '');
                const expiryTime = expiryText ? new Date(expiryText).getTime() : Number.NaN;

                return Number.isFinite(expiryTime) && expiryTime < Date.now() && inventoryBatchQuantity(batch) > 0;
              })
              .slice(0, 5);

            const highValueRows = [...batchRows]
              .map((batch) => ({
                batch,
                value: inventoryBatchValue(batch),
                quantity: inventoryBatchQuantity(batch),
              }))
              .filter((row) => row.value > 0 || row.quantity > 0)
              .sort((left, right) => right.value - left.value)
              .slice(0, 5);

            const expiredCount = expiredSummaryCount || expiredTableRows.length;

            const kpis = [
              { label: 'Total Inventory Value', value: formatCurrency(totalValue), detail: 'Live valuation', tone: 'green' },
              { label: 'Stock on Hand', value: formatCompactNumber(stockOnHand), detail: 'Units available', tone: 'blue' },
              { label: 'Stock Received', value: '0', detail: 'Movement pending', tone: 'cyan' },
              { label: 'Stock Issued', value: '0', detail: 'Movement pending', tone: 'purple' },
              { label: 'Low Stock', value: formatCompactNumber(lowStockCount), detail: 'Items', tone: 'amber' },
              { label: 'Near Expiry', value: formatCompactNumber(nearExpiryCount), detail: 'Items', tone: 'orange' },
              { label: 'Expired', value: formatCompactNumber(expiredCount), detail: 'Items', tone: 'red' },
              { label: 'Turnover', value: '0', detail: 'Movement pending', tone: 'slate' },
            ];

            const trendValues = [0, 0, 0, 0, 0, 0, totalValue];
            const trendMax = Math.max(...trendValues, 1);

            return (
              <>
                <div className="inventory-analytics-photo-filters">
                  <label><span>Date Range</span><input value="Live period" readOnly /></label>
                  <label><span>Business Date Mode</span><input value="Business Date" readOnly /></label>
                  <label><span>Branch</span><input value="All Branches" readOnly /></label>
                  <label><span>Category</span><input value={categoryRows.length ? `${categoryRows.length} categories` : '0'} readOnly /></label>
                  <label><span>Product</span><input value={productCount ? `${productCount} products` : '0'} readOnly /></label>
                  <label><span>Stock Location</span><input value={locationRows.length ? `${locationRows.length} locations` : '0'} readOnly /></label>
                  <label><span>Supplier</span><input value="0" readOnly /></label>
                  <label><span>ABC Class</span><input value="All Classes" readOnly /></label>

                  <div className="inventory-analytics-photo-filter-actions">
                    <button type="button">Reset</button>
                    <button type="button">Apply Filters</button>
                  </div>
                </div>

                <div className="inventory-analytics-photo-kpis">
                  {kpis.map((card) => (
                    <article key={card.label} className={`is-${card.tone}`}>
                      <small>{card.label}</small>
                      <strong>{card.value}</strong>
                      <span>{card.detail}</span>
                    </article>
                  ))}
                </div>

                <div className="inventory-analytics-photo-chart-grid">
                  <article className="inventory-analytics-photo-panel inventory-analytics-photo-panel--trend">
                    <header>
                      <h3>1. Stock Value Trend</h3>
                      <span>Live valuation</span>
                    </header>

                    <div className="inventory-analytics-photo-bars" aria-label="Stock Value Trend">
                      {trendValues.map((value, index) => (
                        <div key={`stock-trend-${index}`}>
                          <i style={{ height: `${Math.max((value / trendMax) * 100, value > 0 ? 12 : 4)}%` }} />
                          <small>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'][index]}</small>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="inventory-analytics-photo-panel">
                    <header>
                      <h3>2. Inventory Value by Category</h3>
                      <span>Live category value</span>
                    </header>

                    <div className="inventory-analytics-photo-category">
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

                  <article className="inventory-analytics-photo-panel">
                    <header>
                      <h3>3. Stock Status Summary</h3>
                      <span>Live status</span>
                    </header>

                    <div className="inventory-analytics-photo-status">
                      <div><small>In Stock</small><strong>{formatCompactNumber(batchRows.length)}</strong></div>
                      <div><small>Low Stock</small><strong>{formatCompactNumber(lowStockCount)}</strong></div>
                      <div><small>Near Expiry</small><strong>{formatCompactNumber(nearExpiryCount)}</strong></div>
                      <div><small>Expired</small><strong>{formatCompactNumber(expiredCount)}</strong></div>
                    </div>
                  </article>

                  <article className="inventory-analytics-photo-panel">
                    <header>
                      <h3>4. ABC Classification</h3>
                      <span>Live value ranking</span>
                    </header>

                    <div className="inventory-analytics-photo-abc">
                      <div><strong>A Items</strong><span>{categoryRows[0] ? formatCurrency(categoryRows[0].value) : '0'}</span></div>
                      <div><strong>B Items</strong><span>{categoryRows[1] ? formatCurrency(categoryRows[1].value) : '0'}</span></div>
                      <div><strong>C Items</strong><span>{categoryRows.slice(2).length ? formatCurrency(categoryRows.slice(2).reduce((sum, row) => sum + row.value, 0)) : '0'}</span></div>
                    </div>
                  </article>
                </div>

                <div className="inventory-analytics-photo-table-grid">
                  <article>
                    <header><h3>5. Low Stock Watch List</h3><span>{formatCompactNumber(lowStockCount)} items</span></header>
                    <div className="inventory-analytics-photo-list"><p>{lowStockCount > 0 ? 'Open Reorder Priorities for item-level records.' : '0 records'}</p></div>
                    <button type="button" onClick={() => onOpenWorkspace('low-stock')}>View All Low Stock Items →</button>
                  </article>

                  <article>
                    <header><h3>6. Near Expiry Review</h3><span>{formatCompactNumber(nearExpiryTableRows.length)} rows</span></header>
                    <div className="inventory-analytics-photo-list">
                      {nearExpiryTableRows.length === 0 ? <p>0 records</p> : nearExpiryTableRows.map((batch, index) => (
                        <span key={`${inventoryText(batch, ['id', 'batch_number'], 'batch')}-${index}`}>
                          {inventoryBatchProductName(batch)} · {inventoryText(batch, ['batch_number'], '0')} · {inventoryText(batch, ['expiry_date', 'expires_at'], '0')}
                        </span>
                      ))}
                    </div>
                    <button type="button" onClick={() => onOpenWorkspace('near-expiry')}>View All Near Expiry Items →</button>
                  </article>

                  <article>
                    <header><h3>7. Expired Items</h3><span>{formatCompactNumber(expiredTableRows.length)} rows</span></header>
                    <div className="inventory-analytics-photo-list">
                      {expiredTableRows.length === 0 ? <p>0 records</p> : expiredTableRows.map((batch, index) => (
                        <span key={`${inventoryText(batch, ['id', 'batch_number'], 'batch')}-${index}`}>
                          {inventoryBatchProductName(batch)} · {inventoryText(batch, ['batch_number'], '0')} · {inventoryText(batch, ['expiry_date', 'expires_at'], '0')}
                        </span>
                      ))}
                    </div>
                    <button type="button" onClick={() => onOpenWorkspace('near-expiry')}>View All Expired Items →</button>
                  </article>

                  <article>
                    <header><h3>8. Top Fast Moving Products</h3><span>Movement</span></header>
                    <div className="inventory-analytics-photo-list"><p>0 records</p></div>
                    <button type="button" onClick={() => onOpenWorkspace('product-inventory')}>View Product Inventory →</button>
                  </article>

                  <article>
                    <header><h3>9. Slow Moving / Non-Moving Products</h3><span>Stock balance</span></header>
                    <div className="inventory-analytics-photo-list">
                      {highValueRows.length === 0 ? <p>0 records</p> : highValueRows.map(({ batch, quantity }, index) => (
                        <span key={`${inventoryText(batch, ['id', 'batch_number'], 'batch')}-${index}`}>
                          {inventoryBatchProductName(batch)} · On hand {formatCompactNumber(quantity)}
                        </span>
                      ))}
                    </div>
                    <button type="button" onClick={() => onOpenWorkspace('product-inventory')}>View Slow / Non Moving Products →</button>
                  </article>

                  <article>
                    <header><h3>10. High Value – Low Stock Risk</h3><span>Top values</span></header>
                    <div className="inventory-analytics-photo-list">
                      {highValueRows.length === 0 ? <p>0 records</p> : highValueRows.map(({ batch, value, quantity }, index) => (
                        <span key={`${inventoryText(batch, ['id', 'batch_number'], 'batch')}-${index}`}>
                          {inventoryBatchProductName(batch)} · {formatCurrency(value)} · On hand {formatCompactNumber(quantity)}
                        </span>
                      ))}
                    </div>
                    <button type="button" onClick={() => onOpenWorkspace('product-inventory')}>View At Risk Items →</button>
                  </article>

                  <article className="inventory-analytics-photo-insight">
                    <header><h3>Inventory Insight</h3><span>Rule-based live signals</span></header>
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

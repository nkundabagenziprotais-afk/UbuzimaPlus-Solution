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
    return '—';
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '—';
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
      <header className="inventory-home-title-card platform-heading-card">
        <h1>Pharmaceutical Inventory Operations</h1>
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
        <section className="pos-overview-modules inventory-home-menu-section">
          <div className="inventory-home-section-title platform-heading-card">
            <h2>Inventory Menu</h2>
          </div>

          <div className="pos-overview-module-grid inventory-home-menu-grid">
            {availableWorkspaces
              .filter(
                (workspace) =>
                  workspaceVisibility[workspace.key],
              )
              .map((workspace) => (
                <button
                  key={workspace.key}
                  type="button"
                  className="pos-overview-module-card inventory-home-menu-card inventory-home-menu-card--title-only"
                  onClick={() =>
                    onOpenWorkspace(workspace.key)
                  }
                >
                  <span className="pos-overview-module-index">
                    {workspace.index}
                  </span>

                  <span
                    className={`pos-overview-module-icon icon-${workspace.key}`}
                    aria-hidden="true"
                  >
                    {workspace.icon}
                  </span>

                  <span className="pos-overview-module-content inventory-home-menu-title">
                    <strong>{workspace.label}</strong>
                  </span>

                  <span
                    className="pos-overview-module-arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </button>
              ))}
          </div>
        </section>
      )}

      {sectionVisibility.analytics && (
        <section className="inventory-home-analytics inventory-analytics-dashboard-v2 inventory-analytics-dashboard-v3">
          <div className="inventory-analytics-dashboard-header-v3">
            <div>
              <p className="eyebrow">Dashboard Analytics</p>
              <h2>Inventory Analytics</h2>
              <span>Real-time visibility of stock, value, expiry risk, and operating priorities.</span>
            </div>

            <button type="button" onClick={() => onOpenWorkspace('product-inventory')}>
              Open Stock on Hand
            </button>
          </div>

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

            const expiredCount =
              findNumericSignal(summary, ['expired_batches_count', 'expired_count', 'expired_items_count']) ?? 0;

            const topValueRows = [...batchRows]
              .map((batch) => ({
                batch,
                value: inventoryBatchValue(batch),
                quantity: inventoryBatchQuantity(batch),
              }))
              .filter((row) => row.value > 0 || row.quantity > 0)
              .sort((left, right) => right.value - left.value)
              .slice(0, 5);

            const nearExpiryTableRows = (nearExpiryRows.length ? nearExpiryRows : batchRows)
              .filter((batch) => inventoryText(batch, ['expiry_date', 'expires_at'], '') !== '')
              .slice(0, 5);

            const kpis = [
              ['Total Inventory Value', formatCurrency(totalValue), 'Live valuation'],
              ['Stock on Hand', formatCompactNumber(stockOnHand), 'Units available'],
              ['Products Monitored', formatCompactNumber(productRows.length || (findNumericSignal(summary, ['products_count', 'product_count', 'total_products']) ?? 0)), 'Product master'],
              ['Stock Locations', formatCompactNumber(locationRows.length), 'Storage points'],
              ['Low Stock Items', formatCompactNumber(lowStockCount), 'Reorder pressure'],
              ['Near Expiry Items', formatCompactNumber(nearExpiryCount), 'Expiry window'],
              ['Expired Items', formatCompactNumber(expiredCount), 'Requires review'],
              ['Inventory Turnover', '—', 'Movement source unavailable'],
            ];

            return (
              <>
                <div className="inventory-analytics-filter-bar-v3">
                  <label>
                    <span>Date Range</span>
                    <input type="text" value="Live selected period" readOnly />
                  </label>
                  <label>
                    <span>Business Date Mode</span>
                    <input type="text" value="Business Date" readOnly />
                  </label>
                  <label>
                    <span>Branch</span>
                    <input type="text" value="All Branches" readOnly />
                  </label>
                  <label>
                    <span>Product</span>
                    <input type="text" value={productRows.length ? `${productRows.length} live products` : 'Source unavailable'} readOnly />
                  </label>
                  <label>
                    <span>Stock Location</span>
                    <input type="text" value={locationRows.length ? `${locationRows.length} locations` : 'Source unavailable'} readOnly />
                  </label>
                  <label>
                    <span>ABC Class</span>
                    <input type="text" value="Live value ranking" readOnly />
                  </label>
                </div>

                <div className="inventory-analytics-kpi-grid-v2 inventory-analytics-kpi-grid-v3">
                  {kpis.map(([label, value, detail]) => (
                    <article key={label} className="inventory-analytics-kpi-card-v2">
                      <small>{label}</small>
                      <strong>{value}</strong>
                      <span>{detail}</span>
                    </article>
                  ))}
                </div>

                <div className="inventory-analytics-dashboard-grid-v2 inventory-analytics-dashboard-grid-v3">
                  <article className="inventory-analytics-panel-v2 inventory-analytics-panel-v2--wide">
                    <header>
                      <h3>1. Stock Value Trend</h3>
                      <span>Live valuation snapshot</span>
                    </header>
                    <div className="inventory-analytics-trend-placeholder-v2">
                      <strong>{formatCurrency(totalValue)}</strong>
                      <span>Historical stock movement trend source unavailable.</span>
                    </div>
                  </article>

                  <article className="inventory-analytics-panel-v2">
                    <header>
                      <h3>2. Inventory Value by Category</h3>
                      <span>Source-limited</span>
                    </header>
                    <div className="inventory-analytics-abc-v2">
                      <div><strong>Total stock value</strong><span>{formatCurrency(totalValue)}</span></div>
                      <div><strong>Products monitored</strong><span>{formatCompactNumber(productRows.length)}</span></div>
                      <div><strong>Batches loaded</strong><span>{formatCompactNumber(batchRows.length)}</span></div>
                    </div>
                  </article>

                  <article className="inventory-analytics-panel-v2">
                    <header>
                      <h3>3. Stock Status Summary</h3>
                      <span>Live summary</span>
                    </header>
                    <div className="inventory-analytics-status-grid-v2">
                      <div><small>In Stock</small><strong>{formatCompactNumber(batchRows.length)}</strong></div>
                      <div><small>Low Stock</small><strong>{formatCompactNumber(lowStockCount)}</strong></div>
                      <div><small>Near Expiry</small><strong>{formatCompactNumber(nearExpiryCount)}</strong></div>
                      <div><small>Expired</small><strong>{formatCompactNumber(expiredCount)}</strong></div>
                    </div>
                  </article>
                </div>

                <div className="inventory-analytics-action-grid-v2 inventory-analytics-action-grid-v3">
                  <article>
                    <header><h3>Low Stock Watch List</h3><span>Live count</span></header>
                    <strong>{formatCompactNumber(lowStockCount)}</strong>
                    <p>Open Reorder Priorities for item-level action.</p>
                    <button type="button" onClick={() => onOpenWorkspace('low-stock')}>View Low Stock</button>
                  </article>

                  <article>
                    <header><h3>Near Expiry Review</h3><span>{formatCompactNumber(nearExpiryTableRows.length)} rows</span></header>
                    <div className="inventory-analytics-mini-list-v3">
                      {nearExpiryTableRows.length === 0 ? (
                        <p>Source unavailable.</p>
                      ) : nearExpiryTableRows.map((batch, index) => (
                        <span key={`${inventoryText(batch, ['id', 'batch_number'], 'batch')}-${index}`}>
                          {inventoryBatchProductName(batch)} · {inventoryText(batch, ['expiry_date', 'expires_at'])}
                        </span>
                      ))}
                    </div>
                    <button type="button" onClick={() => onOpenWorkspace('near-expiry')}>View Near Expiry</button>
                  </article>

                  <article>
                    <header><h3>High Value – Low Stock Risk</h3><span>Top values</span></header>
                    <div className="inventory-analytics-mini-list-v3">
                      {topValueRows.length === 0 ? (
                        <p>Source unavailable.</p>
                      ) : topValueRows.map(({ batch, value }, index) => (
                        <span key={`${inventoryText(batch, ['id', 'batch_number'], 'batch')}-${index}`}>
                          {inventoryBatchProductName(batch)} · {formatCurrency(value)}
                        </span>
                      ))}
                    </div>
                    <button type="button" onClick={() => onOpenWorkspace('product-inventory')}>View Stock on Hand</button>
                  </article>

                  <article>
                    <header><h3>Inventory Insight</h3><span>Rule-based live signals</span></header>
                    <ul>
                      <li>{lowStockCount > 0 ? 'Low-stock pressure exists and needs reorder review.' : 'No live low-stock pressure loaded.'}</li>
                      <li>{nearExpiryCount > 0 ? 'Near-expiry batches require FEFO action.' : 'No live near-expiry pressure loaded.'}</li>
                      <li>{expiredCount > 0 ? 'Expired stock requires quarantine/write-off review.' : 'No live expired-stock pressure loaded.'}</li>
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

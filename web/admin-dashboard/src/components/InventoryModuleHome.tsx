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
  const [analyticsCategoryFilter, setAnalyticsCategoryFilter] = useState('all');
  const [analyticsProductFilter, setAnalyticsProductFilter] = useState('all');
  const [analyticsLocationFilter, setAnalyticsLocationFilter] = useState('all');
  const [analyticsExpiryFromFilter, setAnalyticsExpiryFromFilter] = useState('');
  const [analyticsExpiryToFilter, setAnalyticsExpiryToFilter] = useState('');


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
        <section className="inventory-home-analytics inventory-analytics-requested-dashboard">
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

            const productOptions = Array.from(
              new Set(
                batchRows
                  .map((batch) => productNameFor(batch))
                  .filter((name) => name && name !== '—'),
              ),
            ).sort();

            const categoryOptions = Array.from(
              new Set(
                batchRows
                  .map((batch) => categoryFor(batch))
                  .filter((name) => name && name !== '—'),
              ),
            ).sort();

            const locationOptions = Array.from(
              new Set(
                batchRows
                  .map((batch) => locationFor(batch))
                  .filter((name) => name && name !== '—'),
              ),
            ).sort();

            const filteredBatchRows = batchRows.filter((batch) => {
              const categoryMatches = analyticsCategoryFilter === 'all' || categoryFor(batch) === analyticsCategoryFilter;
              const productMatches = analyticsProductFilter === 'all' || productNameFor(batch) === analyticsProductFilter;
              const locationMatches = analyticsLocationFilter === 'all' || locationFor(batch) === analyticsLocationFilter;

              const expiryText = expiryFor(batch);
              const expiryTime = expiryText ? new Date(expiryText).getTime() : Number.NaN;
              const fromMatches = !analyticsExpiryFromFilter ||
                (Number.isFinite(expiryTime) && expiryTime >= new Date(analyticsExpiryFromFilter).getTime());
              const toMatches = !analyticsExpiryToFilter ||
                (Number.isFinite(expiryTime) && expiryTime <= new Date(analyticsExpiryToFilter).getTime());

              return categoryMatches && productMatches && locationMatches && fromMatches && toMatches;
            });

            const totalValue =
              findNumericSignal(valuation, ['total_inventory_value', 'inventory_value', 'total_stock_value', 'total_cost_value']) ??
              findNumericSignal(summary, ['total_inventory_value', 'inventory_value', 'total_stock_value']) ??
              filteredBatchRows.reduce((sum, batch) => sum + inventoryBatchValue(batch), 0);

            const stockOnHandCount =
              findNumericSignal(summary, ['total_quantity_on_hand', 'quantity_on_hand', 'total_quantity']) ??
              filteredBatchRows.reduce((sum, batch) => sum + inventoryBatchQuantity(batch), 0);

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

            const nearExpirySourceRows = (nearExpiryRows.length ? nearExpiryRows : filteredBatchRows)
              .filter((batch) => expiryFor(batch) !== '')
              .map((batch) => ({
                batch,
                product: productNameFor(batch),
                batchNumber: inventoryText(batch, ['batch_number', 'lot_number'], '0'),
                expiry: expiryFor(batch) || '0',
                quantity: inventoryBatchQuantity(batch),
                value: inventoryBatchValue(batch),
              }));

            const expiredRows = filteredBatchRows
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

            const stockReceivedValue = 0;
            const stockReceivedCount = 0;
            const stockIssuedValue = 0;
            const stockIssuedCount = 0;
            const turnoverValue = 0;
            const turnoverCount = 0;

            const lowStockValue = lowStockRows.reduce((sum, row) => sum + row.value, 0);
            const lowStockCount =
              findNumericSignal(summary, ['low_stock_products_count', 'low_stock_count', 'products_below_reorder']) ??
              lowStockRows.length;

            const nearExpiryValue = nearExpirySourceRows.reduce((sum, row) => sum + row.value, 0);
            const nearExpiryCount =
              findNumericSignal(summary, ['near_expiry_batches_180_days_count', 'near_expiry_count', 'expiring_batches_count']) ??
              nearExpirySourceRows.length;

            const expiredValue = expiredRows.reduce((sum, row) => sum + row.value, 0);
            const expiredCount =
              findNumericSignal(summary, ['expired_batches_count', 'expired_count', 'expired_items_count']) ??
              expiredRows.length;

            const healthyValue = Math.max(totalValue - lowStockValue - nearExpiryValue - expiredValue, 0);
            const riskTotal = Math.max(totalValue, lowStockValue + nearExpiryValue + expiredValue + healthyValue, 1);
            const riskRows = [
              ['Expired / quarantined', expiredCount, expiredValue],
              ['Near expiry', nearExpiryCount, nearExpiryValue],
              ['Low stock', lowStockCount, lowStockValue],
              ['Healthy stock', stockOnHandCount, healthyValue],
            ];

            const kpiCards = [
              ['Total Inventory Value', formatCurrency(totalValue)],
              ['Stock on Hand Count', formatCompactNumber(stockOnHandCount)],
              ['Stock Received Value', formatCurrency(stockReceivedValue)],
              ['Stock Received Count', formatCompactNumber(stockReceivedCount)],
              ['Stock Issued Value', formatCurrency(stockIssuedValue)],
              ['Stock Issued Count', formatCompactNumber(stockIssuedCount)],
              ['Low Stock Value', formatCurrency(lowStockValue)],
              ['Low Stock Count', formatCompactNumber(lowStockCount)],
              ['Near Expiry Value', formatCurrency(nearExpiryValue)],
              ['Near Expiry Count', formatCompactNumber(nearExpiryCount)],
              ['Expired Value', formatCurrency(expiredValue)],
              ['Expired Count', formatCompactNumber(expiredCount)],
              ['Turnover Value', formatCurrency(turnoverValue)],
              ['Turnover Count', formatCompactNumber(turnoverCount)],
            ];

            const categoryTotals = new Map<string, number>();

            filteredBatchRows.forEach((batch) => {
              const category = categoryFor(batch);

              categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + inventoryBatchValue(batch));
            });

            const categoryRows = Array.from(categoryTotals.entries())
              .map(([label, value]) => ({ label, value }))
              .sort((left, right) => right.value - left.value)
              .slice(0, 8);

            const maxCategoryValue = Math.max(...categoryRows.map((row) => row.value), 1);
            const trendValues = [0, 0, 0, 0, 0, 0, totalValue];
            const trendMax = Math.max(...trendValues, 1);

            const tableRows = <T,>(
              rows: T[],
              render: (row: T, index: number) => React.ReactNode,
            ) => (
              <div className="inventory-analytics-request-table-scroll">
                <table>
                  {render(rows[0] as T, -1)}
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6}>0 records</td>
                      </tr>
                    ) : rows.map((row, index) => render(row, index))}
                  </tbody>
                </table>
              </div>
            );

            return (
              <>
                <div className="inventory-analytics-request-filters">
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
                    onClick={() => {
                      setAnalyticsCategoryFilter('all');
                      setAnalyticsProductFilter('all');
                      setAnalyticsLocationFilter('all');
                      setAnalyticsExpiryFromFilter('');
                      setAnalyticsExpiryToFilter('');
                    }}
                  >
                    Reset Filters
                  </button>
                </div>

                <div className="inventory-analytics-request-kpis">
                  {kpiCards.map(([label, value]) => (
                    <article key={label}>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </article>
                  ))}
                </div>

                <div className="inventory-analytics-request-grid">
                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Stock Value Trend</h3>
                    </header>

                    <div className="inventory-analytics-request-bars">
                      {trendValues.map((value, index) => (
                        <div key={`stock-trend-${index}`}>
                          <i style={{ height: `${Math.max((value / trendMax) * 100, value > 0 ? 12 : 4)}%` }} />
                          <small>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'][index]}</small>
                        </div>
                      ))}
                    </div>

                    <div className="inventory-analytics-request-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Period</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trendValues.map((value, index) => (
                            <tr key={`trend-row-${index}`}>
                              <td>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'][index]}</td>
                              <td>{formatCurrency(value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Inventory Risk Overview</h3>
                    </header>

                    <div className="inventory-analytics-risk-summary">
                      <strong>{formatCurrency(lowStockValue + nearExpiryValue + expiredValue)}</strong>
                      <span>{(((lowStockValue + nearExpiryValue + expiredValue) / riskTotal) * 100).toFixed(1)}% at risk</span>
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
                          {riskRows.map(([label, count, value]) => (
                            <tr key={String(label)}>
                              <td>{label}</td>
                              <td>{formatCompactNumber(Number(count))}</td>
                              <td>{formatCurrency(Number(value))}</td>
                              <td>{((Number(value) / riskTotal) * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Inventory Value by Category</h3>
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
                    </header>

                    {tableRows(lowStockRows, (row, index) => index === -1 ? (
                      <thead key="head">
                        <tr>
                          <th>Product</th>
                          <th>Batch</th>
                          <th>On Hand</th>
                          <th>Reorder</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                    ) : (
                      <tr key={`${row.product}-${row.batchNumber}-${index}`}>
                        <td>{row.product}</td>
                        <td>{row.batchNumber}</td>
                        <td>{formatCompactNumber(row.quantity)}</td>
                        <td>{formatCompactNumber(row.reorderLevel)}</td>
                        <td>{formatCurrency(row.value)}</td>
                      </tr>
                    ))}
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Near Expiry Review</h3>
                    </header>

                    {tableRows(nearExpirySourceRows, (row, index) => index === -1 ? (
                      <thead key="head">
                        <tr>
                          <th>Product</th>
                          <th>Batch</th>
                          <th>Expiry</th>
                          <th>Qty</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                    ) : (
                      <tr key={`${row.product}-${row.batchNumber}-${index}`}>
                        <td>{row.product}</td>
                        <td>{row.batchNumber}</td>
                        <td>{row.expiry}</td>
                        <td>{formatCompactNumber(row.quantity)}</td>
                        <td>{formatCurrency(row.value)}</td>
                      </tr>
                    ))}
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Expired Items</h3>
                    </header>

                    {tableRows(expiredRows, (row, index) => index === -1 ? (
                      <thead key="head">
                        <tr>
                          <th>Product</th>
                          <th>Batch</th>
                          <th>Expiry</th>
                          <th>Qty</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                    ) : (
                      <tr key={`${row.product}-${row.batchNumber}-${index}`}>
                        <td>{row.product}</td>
                        <td>{row.batchNumber}</td>
                        <td>{row.expiry}</td>
                        <td>{formatCompactNumber(row.quantity)}</td>
                        <td>{formatCurrency(row.value)}</td>
                      </tr>
                    ))}
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Top Fast Moving Products</h3>
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
                          <tr>
                            <td colSpan={3}>0 records</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>Slow Moving / Non-Moving Products</h3>
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
                          <tr>
                            <td colSpan={3}>0 records</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="inventory-analytics-request-card">
                    <header>
                      <h3>High Value – Low Stock Risk</h3>
                    </header>

                    {tableRows(highValueLowStockRows, (row, index) => index === -1 ? (
                      <thead key="head">
                        <tr>
                          <th>Product</th>
                          <th>Batch</th>
                          <th>On Hand</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                    ) : (
                      <tr key={`${row.product}-${row.batchNumber}-${index}`}>
                        <td>{row.product}</td>
                        <td>{row.batchNumber}</td>
                        <td>{formatCompactNumber(row.quantity)}</td>
                        <td>{formatCurrency(row.value)}</td>
                      </tr>
                    ))}
                  </article>

                  <article className="inventory-analytics-request-card inventory-analytics-request-insight">
                    <header>
                      <h3>Inventory Insight</h3>
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

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getPharmaInventorySummary,
  type AccessProfile,
  type PharmaInventorySummaryResponse,
} from '../lib/api';

import type {
  InventoryView,
} from './ProductInventoryPreview';

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


function formatInventoryCategoryValue(
  value: number,
): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function InventoryModuleHome({
  token,
  profile,
  onOpenWorkspace,
}: InventoryModuleHomeProps) {
  const [summary, setSummary] =
    useState<PharmaInventorySummaryResponse | null>(
      null,
    );

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
        setAnalyticsError(
          'Inventory analytics require an assigned tenant.',
        );
        setAnalyticsLoading(false);
        return;
      }

      try {
        const response =
          await getPharmaInventorySummary(
            token,
            tenantSlug,
          );

        if (!cancelled) {
          setSummary(response);
        }
      } catch (loadError) {
        if (!cancelled) {
          setSummary(null);
          setAnalyticsError(
            loadError instanceof Error
              ? loadError.message
              : 'Inventory analytics are temporarily unavailable.',
          );
        }
      } finally {
        if (!cancelled) {
          setAnalyticsLoading(false);
        }
      }
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
        summary,
        [
          'estimated_stock_retail_value',
          'estimated_stock_value',
          'total_inventory_value',
          'inventory_value',
          'total_stock_value',
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
    }, [summary]);

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

  const productAmount =
    metricVisibility.products
      ? analyticsMetrics.find(
          (metric) => metric.key === 'products',
        )?.amount ?? 0
      : 0;

  const lowStockAmount =
    metricVisibility['low-stock']
      ? analyticsMetrics.find(
          (metric) => metric.key === 'low-stock',
        )?.amount ?? 0
      : 0;

  const nearExpiryAmount =
    metricVisibility['near-expiry']
      ? analyticsMetrics.find(
          (metric) => metric.key === 'near-expiry',
        )?.amount ?? 0
      : 0;

  const valuationMetric =
    metricVisibility.valuation
      ? analyticsMetrics.find(
          (metric) => metric.key === 'valuation',
        ) ?? null
      : null;

  const riskBase = Math.max(
    productAmount,
    lowStockAmount + nearExpiryAmount,
    1,
  );

  const lowStockShare = Math.min(
    100,
    (lowStockAmount / riskBase) * 100,
  );

  const nearExpiryShare = Math.min(
    100 - lowStockShare,
    (nearExpiryAmount / riskBase) * 100,
  );

  const healthyShare = Math.max(
    0,
    100 - lowStockShare - nearExpiryShare,
  );

  // AQUILA_REAL_INVENTORY_VALUE_TREND_20260710
  const weeklyValueTrend =
    summary?.summary
      .inventory_value_weekly_trend ??
    null;

  const weeklyValuePoints =
    weeklyValueTrend?.points ?? [];

  const weeklyLabels =
    weeklyValuePoints.length === 7
      ? weeklyValuePoints.map(
          (point) => point.label,
        )
      : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const numericWeeklyValues =
    weeklyValuePoints
      .map((point) => point.value)
      .filter(
        (value): value is number =>
          typeof value === 'number' &&
          Number.isFinite(value),
      );

  const weeklyValueMinimum =
    numericWeeklyValues.length > 0
      ? Math.min(...numericWeeklyValues)
      : 0;

  const weeklyValueMaximum =
    numericWeeklyValues.length > 0
      ? Math.max(...numericWeeklyValues)
      : 0;

  const weeklyValueRange = Math.max(
    weeklyValueMaximum -
      weeklyValueMinimum,
    1,
  );

  const weeklyPolylinePoints =
    weeklyValuePoints
      .map((point, index) => {
        if (point.value === null) {
          return null;
        }

        const x = 8 + index * 17;
        const y =
          54 -
          (
            (
              point.value -
              weeklyValueMinimum
            ) /
            weeklyValueRange
          ) *
            42;

        return `${x},${y}`;
      })
      .filter(
        (point): point is string =>
          point !== null,
      )
      .join(' ');

  const trendDirection =
    weeklyValueTrend?.direction ??
    'stable';

  const trendDirectionLabel =
    trendDirection === 'growing'
      ? 'Growing'
      : trendDirection === 'reducing'
        ? 'Reducing'
        : 'Stable';

  const trendDelta =
    weeklyValueTrend?.delta_value ?? 0;

  const inventoryValueByCategory =
    summary?.summary
      .inventory_value_by_category ?? [];

  const displayedInventoryCategoryValues =
    inventoryValueByCategory.slice(0, 6);


  return (
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
                  <span>AI Inventory Analytics</span>
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
        <section className="inventory-home-analytics">
          <div className="inventory-home-section-title platform-heading-card">
            <h2>AI Inventory Analytics</h2>
          </div>

          {analyticsLoading && (
            <div className="inventory-professional-state">
              Loading Inventory analytics…
            </div>
          )}

          {!analyticsLoading && analyticsError && (
            <div
              className="inventory-professional-state is-warning"
              role="alert"
            >
              {analyticsError}
            </div>
          )}

          {!analyticsLoading && (
            <div className="inventory-home-chart-grid inventory-home-chart-grid--four">
              {visibleCountMetrics.length > 0 && (
                <article className="inventory-home-chart-panel inventory-home-chart-panel--bars inventory-home-chart-panel--compact">
                  <header>
                    <small>Live stock profile</small>
                    <strong>Inventory Coverage</strong>
                  </header>

                  <div className="inventory-horizontal-chart inventory-horizontal-chart--compact">
                    {visibleCountMetrics.map((metric) => (
                      <div
                        key={metric.key}
                        className={`inventory-chart-row is-${metric.key}`}
                      >
                        <div>
                          <span>{metric.label}</span>
                          <strong>{metric.value}</strong>
                        </div>

                        <div className="inventory-chart-track">
                          <span
                            style={{
                              width: `${
                                Math.max(
                                  4,
                                  (
                                    metric.amount /
                                    analyticsCountScale
                                  ) * 100,
                                )
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              )}

              {(metricVisibility['low-stock'] ||
                metricVisibility['near-expiry']) && (
                <article className="inventory-home-chart-panel inventory-home-chart-panel--risk">
                  <header>
                    <small>Operational exposure</small>
                    <strong>Inventory Risk Mix</strong>
                  </header>

                  <div className="inventory-risk-chart-layout inventory-risk-chart-layout--compact">
                    <div
                      className="inventory-risk-donut inventory-risk-donut--compact"
                      style={{
                        '--inventory-low-stock-share':
                          `${lowStockShare}%`,
                        '--inventory-near-expiry-share':
                          `${nearExpiryShare}%`,
                      } as CSSProperties}
                      aria-label="Inventory risk distribution chart"
                    >
                      <span>
                        <strong>
                          {formatNumber(
                            lowStockAmount +
                              nearExpiryAmount,
                          )}
                        </strong>
                        <small>risk signals</small>
                      </span>
                    </div>

                    <div className="inventory-risk-chart-legend inventory-risk-chart-legend--compact">
                      {metricVisibility['low-stock'] && (
                        <span className="is-low-stock">
                          <i />
                          Low stock
                          <strong>
                            {formatNumber(
                              lowStockAmount,
                            )}
                          </strong>
                        </span>
                      )}

                      {metricVisibility['near-expiry'] && (
                        <span className="is-near-expiry">
                          <i />
                          Near expiry
                          <strong>
                            {formatNumber(
                              nearExpiryAmount,
                            )}
                          </strong>
                        </span>
                      )}

                      <span className="is-healthy">
                        <i />
                        Healthy share
                        <strong>
                          {healthyShare.toFixed(0)}%
                        </strong>
                      </span>
                    </div>
                  </div>


                  {/* AQUILA_INVENTORY_VALUE_BY_CATEGORY_20260711
                      Existing Risk Mix information remains above. */}
                  <div className="inventory-risk-category-values">
                    <header>
                      <div>
                        <span>
                          Inventory value by category
                        </span>

                        <small>
                          Retail selling-price basis
                        </small>
                      </div>

                      <strong>
                        {inventoryValueByCategory.length}
                      </strong>
                    </header>

                    {displayedInventoryCategoryValues.length ===
                    0 ? (
                      <p className="inventory-risk-category-empty">
                        Category values will appear when
                        categorized stock with selling prices
                        is available.
                      </p>
                    ) : (
                      <div className="inventory-risk-category-list">
                        {displayedInventoryCategoryValues.map(
                          (category) => (
                            <div
                              key={category.category_name}
                              className="inventory-risk-category-row"
                            >
                              <span>
                                <strong>
                                  {category.category_name}
                                </strong>

                                <small>
                                  {category.quantity_on_hand.toLocaleString(
                                    'en-RW',
                                    {
                                      maximumFractionDigits: 3,
                                    },
                                  )}{' '}
                                  units ·{' '}
                                  {category.priced_batches_count}/
                                  {category.stock_batches_count}{' '}
                                  batches priced
                                </small>
                              </span>

                              <b>
                                {formatInventoryCategoryValue(
                                  category.inventory_value,
                                )}
                              </b>
                            </div>
                          ),
                        )}
                      </div>
                    )}

                    {inventoryValueByCategory.length > 6 && (
                      <small className="inventory-risk-category-more">
                        Showing the six highest-value
                        categories.
                      </small>
                    )}

                    {inventoryValueByCategory.some(
                      (category) =>
                        category.missing_price_batches_count >
                        0,
                    ) && (
                      <small className="inventory-risk-category-warning">
                        Batches without selling prices are
                        excluded from category value totals.
                      </small>
                    )}
                  </div>
</article>
              )}

              {valuationMetric && (
                <article className="inventory-home-chart-panel inventory-home-chart-panel--currency">
                  <header>
                    <small>Current financial position</small>
                    <strong>Inventory Currency Value</strong>
                  </header>

                  <div className="inventory-currency-value">
                    <span>Retail valuation</span>

                    <strong>
                      {valuationMetric.value}
                    </strong>

                    <small>
                      Live quantity on hand multiplied by recorded batch selling prices.
                    </small>
                  </div>
                </article>
              )}

              {valuationMetric && (
                <article className="inventory-home-chart-panel inventory-home-chart-panel--weekly-trend">
                  <header>
                    <small>Recorded movement history</small>
                    <strong>Weekly Inventory Value</strong>
                  </header>

                  <div className="inventory-weekly-value-summary">
                    <strong>
                      {valuationMetric.value}
                    </strong>

                    <span
                      className={`inventory-value-direction is-${trendDirection}`}
                    >
                      {trendDirectionLabel}

                      <small>
                        {trendDelta === 0
                          ? 'No net value change'
                          : `${trendDelta > 0 ? '+' : ''}${formatRwf(
                              trendDelta,
                            )}`}
                      </small>
                    </span>
                  </div>

                  {weeklyValueTrend?.history_available ? (
                    <div
                      className="inventory-weekly-value-chart"
                      aria-label="Sunday to Saturday Inventory currency-value trend"
                    >
                      <svg
                        viewBox="0 0 116 64"
                        role="img"
                      >
                        <polyline
                          points={
                            weeklyPolylinePoints
                          }
                        />

                        {weeklyValuePoints.map(
                          (point, index) => {
                            if (
                              point.value === null
                            ) {
                              return null;
                            }

                            const x =
                              8 + index * 17;

                            const y =
                              54 -
                              (
                                (
                                  point.value -
                                  weeklyValueMinimum
                                ) /
                                weeklyValueRange
                              ) *
                                42;

                            return (
                              <circle
                                key={point.date}
                                cx={x}
                                cy={y}
                                r="2.5"
                              />
                            );
                          },
                        )}
                      </svg>

                      <div className="inventory-weekly-value-labels">
                        {weeklyLabels.map(
                          (label, index) => (
                            <small
                              key={`${label}-${index}`}
                            >
                              {label}
                            </small>
                          ),
                        )}
                      </div>

                      {(
                        weeklyValueTrend
                          .unmapped_movement_count >
                        0
                      ) && (
                        <small className="inventory-weekly-value-note">
                          {
                            weeklyValueTrend
                              .unmapped_movement_count
                          } movement
                          {weeklyValueTrend
                            .unmapped_movement_count ===
                          1
                            ? ''
                            : 's'}{' '}
                          had no usable batch price.
                        </small>
                      )}
                    </div>
                  ) : (
                    <div className="inventory-weekly-value-empty">
                      <strong>
                        No dated stock movement history this week.
                      </strong>

                      <span>
                        The current Inventory value is real, but no line is drawn until receiving, dispensing or approved return movements are recorded.
                      </span>

                      <div className="inventory-weekly-value-labels">
                        {weeklyLabels.map(
                          (label, index) => (
                            <small
                              key={`${label}-${index}`}
                            >
                              {label}
                            </small>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </article>
              )}
            </div>
          )}
        </section>
      )}
    </section>
  );
}

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getPharmaInventorySummary,
  getPharmaInventoryValuationReport,
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

      const [summaryResult, valuationResult] =
        await Promise.allSettled([
          getPharmaInventorySummary(
            token,
            tenantSlug,
          ),
          getPharmaInventoryValuationReport(
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

      if (
        summaryResult.status === 'rejected' &&
        valuationResult.status === 'rejected'
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
        <section className="inventory-home-analytics inventory-analytics-dashboard-v2">
          <div className="inventory-home-section-title platform-heading-card inventory-analytics-dashboard-title">
            <div>
              <p className="eyebrow">Dashboard Analytics</p>
              <h2>Inventory Analytics</h2>
              <span>Live visibility of stock value, expiry risk, low-stock pressure, and operating priorities.</span>
            </div>
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

          {!analyticsLoading && !analyticsError && (
            <>
              <div className="inventory-analytics-kpi-grid-v2">
                {analyticsMetrics
                  .filter((metric) => metricVisibility[metric.key])
                  .map((metric) => (
                    <article
                      key={metric.key}
                      className={`inventory-analytics-kpi-card-v2 is-${metric.key}`}
                    >
                      <small>{metric.label}</small>
                      <strong>{metric.value || '—'}</strong>
                      <span>{metric.detail || 'Live source'}</span>
                    </article>
                  ))}

                <article className="inventory-analytics-kpi-card-v2 is-stock-on-hand">
                  <small>Stock on Hand</small>
                  <strong>
                    {formatCompactNumber(
                      findNumericSignal(summary, [
                        'total_quantity_on_hand',
                        'quantity_on_hand',
                        'total_quantity',
                      ]) ?? 0,
                    )}
                  </strong>
                  <span>Live units available</span>
                </article>

                <article className="inventory-analytics-kpi-card-v2 is-expired">
                  <small>Expired Items</small>
                  <strong>
                    {formatCompactNumber(
                      findNumericSignal(summary, [
                        'expired_batches_count',
                        'expired_count',
                        'expired_items_count',
                      ]) ?? 0,
                    )}
                  </strong>
                  <span>Requires review</span>
                </article>

                <article className="inventory-analytics-kpi-card-v2 is-turnover">
                  <small>Inventory Turnover</small>
                  <strong>—</strong>
                  <span>Sales movement source unavailable</span>
                </article>
              </div>

              <div className="inventory-analytics-dashboard-grid-v2">
                <article className="inventory-analytics-panel-v2 inventory-analytics-panel-v2--wide">
                  <header>
                    <h3>Stock Value Trend</h3>
                    <span>Current live valuation snapshot</span>
                  </header>

                  <div className="inventory-analytics-trend-placeholder-v2">
                    <strong>
                      {formatCurrency(
                        findNumericSignal(valuation, [
                          'total_inventory_value',
                          'inventory_value',
                          'total_stock_value',
                          'total_cost_value',
                        ]) ?? 0,
                      )}
                    </strong>
                    <span>Historical stock movement trend source unavailable.</span>
                  </div>
                </article>

                <article className="inventory-analytics-panel-v2">
                  <header>
                    <h3>Stock Status Summary</h3>
                    <span>Live summary</span>
                  </header>

                  <div className="inventory-analytics-status-grid-v2">
                    <div>
                      <small>Products</small>
                      <strong>
                        {formatCompactNumber(
                          findNumericSignal(summary, [
                            'products_count',
                            'product_count',
                            'total_products',
                          ]) ?? 0,
                        )}
                      </strong>
                    </div>
                    <div>
                      <small>Low Stock</small>
                      <strong>
                        {formatCompactNumber(
                          findNumericSignal(summary, [
                            'low_stock_products_count',
                            'low_stock_count',
                            'products_below_reorder',
                          ]) ?? 0,
                        )}
                      </strong>
                    </div>
                    <div>
                      <small>Near Expiry</small>
                      <strong>
                        {formatCompactNumber(
                          findNumericSignal(summary, [
                            'near_expiry_batches_180_days_count',
                            'near_expiry_count',
                            'expiring_batches_count',
                          ]) ?? 0,
                        )}
                      </strong>
                    </div>
                    <div>
                      <small>Expired</small>
                      <strong>
                        {formatCompactNumber(
                          findNumericSignal(summary, [
                            'expired_batches_count',
                            'expired_count',
                            'expired_items_count',
                          ]) ?? 0,
                        )}
                      </strong>
                    </div>
                  </div>
                </article>

                <article className="inventory-analytics-panel-v2">
                  <header>
                    <h3>ABC Classification</h3>
                    <span>By live stock value</span>
                  </header>

                  <div className="inventory-analytics-abc-v2">
                    <div>
                      <strong>A Items</strong>
                      <span>—</span>
                    </div>
                    <div>
                      <strong>B Items</strong>
                      <span>—</span>
                    </div>
                    <div>
                      <strong>C Items</strong>
                      <span>—</span>
                    </div>
                  </div>
                </article>
              </div>

              <div className="inventory-analytics-action-grid-v2">
                <article>
                  <header>
                    <h3>Low Stock Watch List</h3>
                    <span>Live count</span>
                  </header>
                  <strong>
                    {formatCompactNumber(
                      findNumericSignal(summary, [
                        'low_stock_products_count',
                        'low_stock_count',
                        'products_below_reorder',
                      ]) ?? 0,
                    )}
                  </strong>
                  <p>Open Reorder Priorities for item-level actions.</p>
                  <button type="button" onClick={() => onOpenWorkspace('low-stock')}>
                    View Low Stock
                  </button>
                </article>

                <article>
                  <header>
                    <h3>Near Expiry Review</h3>
                    <span>Live count</span>
                  </header>
                  <strong>
                    {formatCompactNumber(
                      findNumericSignal(summary, [
                        'near_expiry_batches_180_days_count',
                        'near_expiry_count',
                        'expiring_batches_count',
                      ]) ?? 0,
                    )}
                  </strong>
                  <p>Open Expiry Management for batch-level FEFO review.</p>
                  <button type="button" onClick={() => onOpenWorkspace('near-expiry')}>
                    View Near Expiry
                  </button>
                </article>

                <article>
                  <header>
                    <h3>Stock on Hand</h3>
                    <span>Product Inventory</span>
                  </header>
                  <strong>
                    {formatCompactNumber(
                      findNumericSignal(summary, [
                        'total_quantity_on_hand',
                        'quantity_on_hand',
                        'total_quantity',
                      ]) ?? 0,
                    )}
                  </strong>
                  <p>Open Stock on Hand for full batch and margin columns.</p>
                  <button type="button" onClick={() => onOpenWorkspace('product-inventory')}>
                    View Stock on Hand
                  </button>
                </article>

                <article>
                  <header>
                    <h3>Inventory Insight</h3>
                    <span>Rule-based live signals</span>
                  </header>
                  <ul>
                    <li>
                      {((findNumericSignal(summary, ['low_stock_products_count', 'low_stock_count']) ?? 0) > 0)
                        ? 'Low-stock pressure exists and needs reorder review.'
                        : 'No live low-stock pressure loaded.'}
                    </li>
                    <li>
                      {((findNumericSignal(summary, ['near_expiry_batches_180_days_count', 'near_expiry_count']) ?? 0) > 0)
                        ? 'Near-expiry batches require FEFO action.'
                        : 'No live near-expiry pressure loaded.'}
                    </li>
                    <li>
                      {((findNumericSignal(summary, ['expired_batches_count', 'expired_count']) ?? 0) > 0)
                        ? 'Expired stock requires quarantine/write-off review.'
                        : 'No live expired-stock pressure loaded.'}
                    </li>
                  </ul>
                </article>
              </div>
            </>
          )}
        </section>
      )}
    </section>

  );
}

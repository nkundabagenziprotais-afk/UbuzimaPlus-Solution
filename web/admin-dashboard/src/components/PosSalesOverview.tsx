import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  type AccessProfile,
  type PharmaSale,
  getPharmaSales,
} from '../lib/api';

type PosSalesOverviewProps = {
  token: string;
  profile: AccessProfile;
  onOpenWorkspace: (workspace: string) => void;
};

type ModuleDefinition = {
  key: string;
  title: string;
  description: string;
  icon: string;
};

type VisibilityConfiguration = {
  modules: string[];
  analytics: string[];
};

type DailyPerformance = {
  date: string;
  label: string;
  sales: number;
  collected: number;
  transactions: number;
};

const moduleDefinitions: ModuleDefinition[] =
  [
  {
    "key": "pos",
    "title": "POS and Sales",
    "description": "Open the dedicated workspace for detailed operations, approvals, and audit review.",
    "icon": "sales"
  },
  {
    "key": "dispensing-review",
    "title": "Pharmacist Review",
    "description": "Review medicines, batches, quantities, and dispensing completion.",
    "icon": "counter"
  },
  {
    "key": "customers",
    "title": "Customers & Patients",
    "description": "Manage customer, patient, contact, credit, and purchase history.",
    "icon": "people"
  },
  {
    "key": "prescriptions",
    "title": "Prescription Management",
    "description": "Capture, validate, monitor, and fulfil patient prescriptions.",
    "icon": "prescription"
  },
  {
    "key": "sales-performance",
    "title": "Sales Register & Returns",
    "description": "Review sales, returns, refunds, credit notes, and transaction history.",
    "icon": "sales"
  },
  {
    "key": "payment-receipt",
    "title": "Receipts & Payments",
    "description": "Review receipts, payment methods, settlements, and reconciliation.",
    "icon": "payment"
  }
];

const analyticsDefinitions = [
  {
    id: 'revenue',
    title: 'Total sales',
  },
  {
    id: 'collections',
    title: 'Cash collected',
  },
  {
    id: 'outstanding',
    title: 'Outstanding balance',
  },
  {
    id: 'average-ticket',
    title: 'Average transaction',
  },
  {
    id: 'open-pos',
    title: 'MoMo Sales Counter',
  },
  {
    id: 'best-day',
    title: 'Strongest business day',
  },
  {
    id: 'daily-cash',
    title: 'Daily cash requirement',
  },
  {
    id: 'collection-rate',
    title: 'Collection efficiency',
  },
  {
    id: 'forecast',
    title: 'Seven-day sales forecast',
  },
  {
    id: 'trend-chart',
    title: 'Sales and collection trend',
  },
  {
    id: 'payment-health',
    title: 'Payment health',
  },
  {
    id: 'ai-insights',
    title: 'AI business insights',
  },
  {
    id: 'management-actions',
    title: 'Recommended actions',
  },
];

const defaultVisibility: VisibilityConfiguration = {
  modules: moduleDefinitions.map(
    (module) => module.key,
  ),
  analytics: analyticsDefinitions.map(
    (widget) => widget.id,
  ),
};

function tenantSlugFrom(
  profile: AccessProfile,
): string {
  const assignments = Array.isArray(
    profile.tenant_assignments,
  )
    ? profile.tenant_assignments
    : [];

  return assignments[0]?.tenant?.slug ?? '';
}

function profileIsAdmin(
  profile: AccessProfile,
): boolean {
  const roles = Array.isArray(profile.roles)
    ? profile.roles
    : [];

  return roles.some((role) => {
    const code = String(role?.code ?? '')
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, '_');

    return (
      code === 'tenant_admin' ||
      code === 'ubuzima_plus_super_admin' ||
      code === 'super_admin' ||
      code === 'platform_admin' ||
      code === 'owner' ||
      code.endsWith('_admin')
    );
  });
}

function numberValue(
  value: number | string | null | undefined,
): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value);
}

function shortMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }

  return Math.round(value).toLocaleString('en-RW');
}

function percentage(value: number): string {
  return `${Math.round(value)}%`;
}

function safeDate(
  value: string | null | undefined,
): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-RW', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function iconFor(type: string) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (type === 'people') {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  if (type === 'prescription') {
    return (
      <svg {...common}>
        <path d="M7 3h8a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M9 8h4M9 12h6M9 16h4" />
      </svg>
    );
  }

  if (type === 'payment') {
    return (
      <svg {...common}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h2" />
      </svg>
    );
  }

  if (type === 'insurance') {
    return (
      <svg {...common}>
        <path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Z" />
        <path d="M9 12h6M12 9v6" />
      </svg>
    );
  }

  if (type === 'reconciliation') {
    return (
      <svg {...common}>
        <path d="M20 7h-9M20 7l-3-3M20 7l-3 3" />
        <path d="M4 17h9M4 17l3-3M4 17l3 3" />
      </svg>
    );
  }

  if (type === 'clinical') {
    return (
      <svg {...common}>
        <path d="M9 3h6v5H9z" />
        <path d="M6 8h12v13H6z" />
        <path d="M9 14h6M12 11v6" />
      </svg>
    );
  }

  if (type === 'counter') {
    return (
      <svg {...common}>
        <path d="M4 4h16l-1 7H5L4 4Z" />
        <path d="M5 11v9h14v-9M9 15h6" />
      </svg>
    );
  }

  if (type === 'cashier') {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 8h10M7 12h4M15 12h2M7 16h2M12 16h5" />
      </svg>
    );
  }

  if (type === 'shield') {
    return (
      <svg {...common}>
        <path d="M12 3 4 6v5c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-3Z" />
        <path d="M9.5 12 11 13.5 15 9.5" />
      </svg>
    );
  }

  if (type === 'traceability') {
    return (
      <svg {...common}>
        <path d="M4 7h16M4 12h16M4 17h10" />
        <circle cx="18" cy="17" r="2" />
      </svg>
    );
  }

  if (type === 'report') {
    return (
      <svg {...common}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-4 3 3 5-7" />
    </svg>
  );
}

function loadVisibility(
  key: string,
): VisibilityConfiguration {
  try {
    const saved = window.localStorage.getItem(key);

    if (!saved) {
      return defaultVisibility;
    }

    const parsed = JSON.parse(
      saved,
    ) as Partial<VisibilityConfiguration>;

    return {
      modules: Array.isArray(parsed.modules)
        ? parsed.modules
        : defaultVisibility.modules,
      analytics: Array.isArray(parsed.analytics)
        ? parsed.analytics
        : defaultVisibility.analytics,
    };
  } catch {
    return defaultVisibility;
  }
}

export function PosSalesOverview({
  token,
  profile,
  onOpenWorkspace,
}: PosSalesOverviewProps) {
  const tenantSlug = tenantSlugFrom(profile);
  const isAdmin = profileIsAdmin(profile);

  const visibilityKey =
    `ubuzimaplus:pos-dashboard:${tenantSlug || 'tenant'}:v3`;

  const [sales, setSales] = useState<PharmaSale[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showConfiguration, setShowConfiguration] =
    useState(false);
  const [visibility, setVisibility] =
    useState<VisibilityConfiguration>(
      () => loadVisibility(visibilityKey),
    );

  const loadSales = useCallback(async () => {
    if (!tenantSlug) {
      setError(
        'An active tenant assignment is required to load business analytics.',
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await getPharmaSales(
        token,
        tenantSlug,
      );

      setSales(
        Array.isArray(response.sales)
          ? response.sales
          : [],
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : ' data could not be loaded.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [tenantSlug, token]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  useEffect(() => {
    setVisibility(
      loadVisibility(visibilityKey),
    );
  }, [visibilityKey]);

  useEffect(() => {
    const syncVisibility = (
      event: StorageEvent,
    ) => {
      if (event.key === visibilityKey) {
        setVisibility(
          loadVisibility(visibilityKey),
        );
      }
    };

    window.addEventListener(
      'storage',
      syncVisibility,
    );

    return () => {
      window.removeEventListener(
        'storage',
        syncVisibility,
      );
    };
  }, [visibilityKey]);

  const analytics = useMemo(() => {
    const totalSales = sales.reduce(
      (sum, sale) =>
        sum + numberValue(sale.total_amount),
      0,
    );

    const totalCollected = sales.reduce(
      (sum, sale) =>
        sum + numberValue(sale.paid_amount),
      0,
    );

    const outstanding = sales.reduce(
      (sum, sale) =>
        sum + numberValue(sale.balance_amount),
      0,
    );

    const dailyMap = new Map<
      string,
      DailyPerformance
    >();

    sales.forEach((sale) => {
      const saleDate = safeDate(sale.sold_at);

      if (!saleDate) {
        return;
      }

      const key = dateKey(saleDate);
      const existing = dailyMap.get(key);

      if (existing) {
        existing.sales += numberValue(
          sale.total_amount,
        );
        existing.collected += numberValue(
          sale.paid_amount,
        );
        existing.transactions += 1;
        return;
      }

      dailyMap.set(key, {
        date: key,
        label: dayLabel(saleDate),
        sales: numberValue(sale.total_amount),
        collected: numberValue(
          sale.paid_amount,
        ),
        transactions: 1,
      });
    });

    const daily = [...dailyMap.values()]
      .sort((left, right) =>
        left.date.localeCompare(right.date),
      )
      .slice(-14);

    const activeDays = Math.max(
      daily.length,
      1,
    );

    const averageDailySales =
      totalSales / activeDays;

    const averageDailyCollected =
      totalCollected / activeDays;

    const averageTicket =
      sales.length > 0
        ? totalSales / sales.length
        : 0;

    const collectionRate =
      totalSales > 0
        ? (totalCollected / totalSales) * 100
        : 0;

    const strongestDay =
      daily.reduce<DailyPerformance | null>(
        (best, current) =>
          !best || current.sales > best.sales
            ? current
            : best,
        null,
      );

    const weakestDay =
      daily.reduce<DailyPerformance | null>(
        (weakest, current) =>
          !weakest ||
          current.sales < weakest.sales
            ? current
            : weakest,
        null,
      );

    const recentSeven = daily.slice(-7);

    const earlierSeven = daily.slice(-14, -7);

    const recentTotal = recentSeven.reduce(
      (sum, day) => sum + day.sales,
      0,
    );

    const earlierTotal = earlierSeven.reduce(
      (sum, day) => sum + day.sales,
      0,
    );

    const trendRate =
      earlierTotal > 0
        ? ((recentTotal - earlierTotal) /
            earlierTotal) *
          100
        : recentTotal > 0
          ? 100
          : 0;

    const forecast =
      averageDailySales * 7 *
      (1 + Math.max(-0.25, Math.min(0.25, trendRate / 100)));

    return {
      totalSales,
      totalCollected,
      outstanding,
      averageDailySales,
      averageDailyCollected,
      averageTicket,
      collectionRate,
      strongestDay,
      weakestDay,
      trendRate,
      forecast,
      daily,
    };
  }, [sales]);

  const visibleModules = moduleDefinitions.filter(
    (module) =>
      visibility.modules.includes(module.key),
  );

  const widgetVisible = (id: string) =>
    visibility.analytics.includes(id);

  const saveVisibility = (
    next: VisibilityConfiguration,
  ) => {
    setVisibility(next);

    try {
      window.localStorage.setItem(
        visibilityKey,
        JSON.stringify(next),
      );
    } catch {
      // The dashboard remains functional when storage
      // is unavailable.
    }
  };

  const toggleModule = (moduleKey: string) => {
    const modules = visibility.modules.includes(
      moduleKey,
    )
      ? visibility.modules.filter(
          (key) => key !== moduleKey,
        )
      : [...visibility.modules, moduleKey];

    saveVisibility({
      ...visibility,
      modules,
    });
  };

  const toggleAnalytic = (widgetId: string) => {
    const analyticsWidgets =
      visibility.analytics.includes(widgetId)
        ? visibility.analytics.filter(
            (id) => id !== widgetId,
          )
        : [...visibility.analytics, widgetId];

    saveVisibility({
      ...visibility,
      analytics: analyticsWidgets,
    });
  };

  const maxDailyValue = Math.max(
    ...analytics.daily.map(
      (day) =>
        Math.max(day.sales, day.collected),
    ),
    1,
  );

  const insights = [
    analytics.strongestDay
      ? `${analytics.strongestDay.label} is currently the strongest trading day at ${money(
          analytics.strongestDay.sales,
        )}. Plan staffing, stock availability, and till cash around this pattern.`
      : 'Complete more sales to identify the strongest trading day.',
    analytics.collectionRate >= 90
      ? `Collection efficiency is healthy at ${percentage(
          analytics.collectionRate,
        )}. Continue monitoring digital settlement timing and credit exposure.`
      : `Only ${percentage(
          analytics.collectionRate,
        )} of recorded sales has been collected. Prioritize outstanding balances and unsettled payer transactions.`,
    analytics.trendRate >= 0
      ? `Recent sales momentum is ${percentage(
          Math.abs(analytics.trendRate),
        )} above the preceding period. Protect availability of fast-moving products.`
      : `Recent sales are ${percentage(
          Math.abs(analytics.trendRate),
        )} below the preceding period. Review stock-outs, pricing, customer traffic, and prescription conversion.`,
    `The operation should plan for approximately ${money(
      analytics.averageDailyCollected,
    )} in daily cash and settlement handling based on current activity.`,
  ];

  const recommendations = [
    analytics.outstanding > analytics.totalCollected * 0.2
      ? 'Review customer, insurance, and corporate balances before extending additional credit.'
      : 'Outstanding exposure remains controlled; continue daily balance review.',
    analytics.weakestDay
      ? `Use ${analytics.weakestDay.label} for targeted promotions, customer follow-up, and staff training.`
      : 'A weakest-day recommendation will appear after more transaction history is available.',
    analytics.collectionRate < 95
      ? 'Reconcile mobile money, card, insurance, and bank settlements before closing the next till.'
      : 'Maintain the current reconciliation discipline and investigate all exceptions on the same day.',
  ];

  return (
    <section className="pos-overview">
      <header className="pos-overview-header">
        <div>
          <span className="pos-overview-eyebrow">
            POS & Sales
          </span>
          <h1>Business control centre</h1>
          <p>
            Open a dedicated operational module or review
            the most important sales, cash, collection,
            and performance signals in one place.
          </p>
        </div>

        <div className="pos-overview-header-actions">
          {isAdmin && (
            <button
              type="button"
              className="pos-overview-secondary-button"
              onClick={() =>
                setShowConfiguration(
                  (current) => !current,
                )
              }
            >
              {showConfiguration
                ? 'Close dashboard settings'
                : 'Customize team dashboard'}
            </button>
          )}

          <button
            type="button"
            onClick={() => void loadSales()}
            disabled={isLoading}
          >
            {isLoading
              ? 'Refreshing…'
              : 'Refresh performance'}
          </button>
        </div>
      </header>

      {error && (
        <div
          className="pos-overview-notice error"
          role="alert"
        >
          {error}
        </div>
      )}

      {showConfiguration && isAdmin && (
        <section className="pos-overview-configuration">
          <div className="pos-overview-section-heading">
            <div>
              <span className="pos-overview-eyebrow">
                Administrator control
              </span>
              <h2>Dashboard visibility</h2>
              <p>
                Select the module and performance cards
                visible on the POS & Sales landing page.
              </p>
            </div>

            <button
              type="button"
              className="pos-overview-secondary-button"
              onClick={() =>
                saveVisibility(defaultVisibility)
              }
            >
              Restore all cards
            </button>
          </div>

          <div className="pos-overview-config-columns">
            <div>
              <h3>Operational modules</h3>

              <div className="pos-overview-config-list">
                {moduleDefinitions.map((module) => (
                  <label key={module.key}>
                    <input
                      type="checkbox"
                      checked={visibility.modules.includes(
                        module.key,
                      )}
                      onChange={() =>
                        toggleModule(module.key)
                      }
                    />
                    <span>{module.title}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3>Performance intelligence</h3>

              <div className="pos-overview-config-list">
                {analyticsDefinitions.map(
                  (widget) => (
                    <label key={widget.id}>
                      <input
                        type="checkbox"
                        checked={visibility.analytics.includes(
                          widget.id,
                        )}
                        onChange={() =>
                          toggleAnalytic(widget.id)
                        }
                      />
                      <span>{widget.title}</span>
                    </label>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="pos-overview-modules">
        <div className="pos-overview-section-heading">
          <div>
            <span className="pos-overview-eyebrow">
              Operational modules
            </span>
            <h2>Choose where you want to work</h2>
            <p>
              Every module opens a dedicated page with its
              own workflow, controls, approvals, and audit
              history.
            </p>
          </div>

          <span className="pos-overview-count">
            {visibleModules.length} modules
          </span>
        </div>

        <div className="pos-overview-module-grid">
          {visibleModules.map(
            (module, index) => (
              <button
                type="button"
                key={module.key}
                className="pos-overview-module-card"
                onClick={() =>
                  onOpenWorkspace(module.key)
                }
              >
                <span className="pos-overview-module-index">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <span
                  className={`pos-overview-module-icon icon-${module.icon}`}
                >
                  {iconFor(module.icon)}
                </span>

                <span className="pos-overview-module-content">
                  <strong>{module.title}</strong>
                </span>

                <span className="pos-overview-module-arrow">
                  →
                </span>
              </button>
            ),
          )}
        </div>
      </section>

      <section className="pos-overview-performance">
        <div className="pos-overview-section-heading">
          <div>
            <span className="pos-overview-eyebrow">
              AI-assisted business analytics
            </span>
            <h2></h2>
            <p>
              Practical signals derived from current sales,
              collections, balances, and transaction
              patterns.
            </p>
          </div>

          <span className="pos-overview-live-indicator">
            <i />
            Live operational view
          </span>
        </div>

        <div className="pos-overview-kpi-grid">
          {widgetVisible('revenue') && (
            <article className="pos-overview-kpi primary">
              <span>Total sales</span>
              <strong>
                {money(analytics.totalSales)}
              </strong>
              <small>
                {sales.length} recorded transactions
              </small>
            </article>
          )}

          {widgetVisible('collections') && (
            <article className="pos-overview-kpi">
              <span>Cash collected</span>
              <strong>
                {money(analytics.totalCollected)}
              </strong>
              <small>
                Settled against recorded sales
              </small>
            </article>
          )}

          {widgetVisible('average-ticket') && (
            <article className="pos-overview-kpi">
              <span>Average transaction</span>
              <strong>
                {money(analytics.averageTicket)}
              </strong>
              <small>
                Average value per completed sale
              </small>
            </article>
          )}

          {widgetVisible('outstanding') && (
            <article className="pos-overview-kpi warning">
              <span>Outstanding exposure</span>
              <strong>
                {money(analytics.outstanding)}
              </strong>
              <small>
                Customer, payer, or credit balance
              </small>
            </article>
          )}

          {widgetVisible('open-pos') && (
            <button
              type="button"
              className="pos-overview-kpi pos-overview-open-pos-card"
              onClick={() => onOpenWorkspace('pos')}
            >
              <span>Dedicated POS Counter</span>
              <strong>MoMo Sales</strong>
              <small>
                Start a controlled pharmacy sale and payment workflow.
              </small>
              <b>Open dedicated page →</b>
            </button>
          )}

          {widgetVisible('best-day') && (
            <article className="pos-overview-kpi accent">
              <span>Strongest business day</span>
              <strong>
                {analytics.strongestDay?.label ??
                  'Building history'}
              </strong>
              <small>
                {analytics.strongestDay
                  ? money(
                      analytics.strongestDay.sales,
                    )
                  : 'More sales are required'}
              </small>
            </article>
          )}

          {widgetVisible('daily-cash') && (
            <article className="pos-overview-kpi">
              <span>Daily cash requirement</span>
              <strong>
                {money(
                  analytics.averageDailyCollected,
                )}
              </strong>
              <small>
                Average daily collection handling
              </small>
            </article>
          )}

          {widgetVisible('collection-rate') && (
            <article className="pos-overview-kpi">
              <span>Collection efficiency</span>
              <strong>
                {percentage(
                  analytics.collectionRate,
                )}
              </strong>
              <small>
                Collected value versus total sales
              </small>
            </article>
          )}

          {widgetVisible('forecast') && (
            <article className="pos-overview-kpi forecast">
              <span>Seven-day sales forecast</span>
              <strong>
                {money(analytics.forecast)}
              </strong>
              <small>
                Based on daily average and recent trend
              </small>
            </article>
          )}
        </div>

        <div className="pos-overview-analytics-grid">
          {widgetVisible('trend-chart') && (
            <article className="pos-overview-chart-card">
              <div className="pos-overview-card-heading">
                <div>
                  <h3>Sales and collection trend</h3>
                  <p>
                    Daily sales value compared with money
                    collected.
                  </p>
                </div>

                <span
                  className={
                    analytics.trendRate >= 0
                      ? 'positive'
                      : 'negative'
                  }
                >
                  {analytics.trendRate >= 0
                    ? '↑'
                    : '↓'}{' '}
                  {percentage(
                    Math.abs(
                      analytics.trendRate,
                    ),
                  )}
                </span>
              </div>

              <div className="pos-overview-chart">
                {analytics.daily.length === 0 ? (
                  <div className="pos-overview-empty-chart">
                    Sales activity will appear here once
                    transactions are recorded.
                  </div>
                ) : (
                  analytics.daily.map((day) => (
                    <div
                      className="pos-overview-chart-column"
                      key={day.date}
                    >
                      <div className="pos-overview-bars">
                        <i
                          className="sales"
                          style={{
                            height: `${Math.max(
                              5,
                              (day.sales /
                                maxDailyValue) *
                                100,
                            )}%`,
                          }}
                          title={`Sales ${money(
                            day.sales,
                          )}`}
                        />
                        <i
                          className="collected"
                          style={{
                            height: `${Math.max(
                              4,
                              (day.collected /
                                maxDailyValue) *
                                100,
                            )}%`,
                          }}
                          title={`Collected ${money(
                            day.collected,
                          )}`}
                        />
                      </div>
                      <span>{day.label}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="pos-overview-chart-legend">
                <span>
                  <i className="sales" />
                  Sales
                </span>
                <span>
                  <i className="collected" />
                  Collected
                </span>
              </div>
            </article>
          )}

          {widgetVisible('payment-health') && (
            <article className="pos-overview-chart-card payment-health">
              <div className="pos-overview-card-heading">
                <div>
                  <h3>Payment health</h3>
                  <p>
                    How much of the recorded business has
                    converted to collected cash.
                  </p>
                </div>
              </div>

              <div className="pos-overview-donut-wrap">
                <div
                  className="pos-overview-donut"
                  style={{
                    background: `conic-gradient(
                      #176944 0deg ${
                        Math.min(
                          100,
                          analytics.collectionRate,
                        ) * 3.6
                      }deg,
                      #e7ece9 ${
                        Math.min(
                          100,
                          analytics.collectionRate,
                        ) * 3.6
                      }deg 360deg
                    )`,
                  }}
                >
                  <div>
                    <strong>
                      {percentage(
                        analytics.collectionRate,
                      )}
                    </strong>
                    <span>collected</span>
                  </div>
                </div>

                <div className="pos-overview-payment-stats">
                  <div>
                    <span>Collected</span>
                    <strong>
                      {shortMoney(
                        analytics.totalCollected,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Outstanding</span>
                    <strong>
                      {shortMoney(
                        analytics.outstanding,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Daily sales average</span>
                    <strong>
                      {shortMoney(
                        analytics.averageDailySales,
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </article>
          )}

          {widgetVisible('ai-insights') && (
            <article className="pos-overview-insight-card">
              <div className="pos-overview-ai-badge">
                AI
              </div>

              <div className="pos-overview-card-heading">
                <div>
                  <h3>Business intelligence briefing</h3>
                  <p>
                    What current activity is telling
                    management.
                  </p>
                </div>
              </div>

              <div className="pos-overview-insight-list">
                {insights.map((insight, index) => (
                  <div key={insight}>
                    <span>{index + 1}</span>
                    <p>{insight}</p>
                  </div>
                ))}
              </div>
            </article>
          )}

          {widgetVisible('management-actions') && (
            <article className="pos-overview-actions-card">
              <div className="pos-overview-card-heading">
                <div>
                  <h3>Recommended management actions</h3>
                  <p>
                    Priority actions based on current
                    business signals.
                  </p>
                </div>
              </div>

              <div className="pos-overview-action-list">
                {recommendations.map(
                  (recommendation, index) => (
                    <div key={recommendation}>
                      <span>
                        {String(index + 1).padStart(
                          2,
                          '0',
                        )}
                      </span>
                      <p>{recommendation}</p>
                    </div>
                  ),
                )}
              </div>
            </article>
          )}
        </div>
      </section>
    </section>
  );
}

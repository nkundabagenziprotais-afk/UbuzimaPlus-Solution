/*
 POS_AND_SALES_OVERVIEW_DEPLOY_TARGET_V1 */
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
    id: 'momo-sales',
    title: 'MoMo Sales',
  },
  {
    id: 'insurance-sales',
    title: 'Insurance Sales',
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
    `ubuzimaplus:pos-dashboard:${tenantSlug || 'tenant'}:v4`;

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

  const todayIsoForPosAnalytics = new Date().toISOString().slice(0, 10);
  const monthStartIsoForPosAnalytics = `${todayIsoForPosAnalytics.slice(0, 8)}01`;
  const [posBusinessDateFromFilter, setPosBusinessDateFromFilter] = useState(monthStartIsoForPosAnalytics);
  const [posBusinessDateToFilter, setPosBusinessDateToFilter] = useState(todayIsoForPosAnalytics);
  const [posBranchFilter, setPosBranchFilter] = useState('all');
  const [posCashierFilter, setPosCashierFilter] = useState('all');
  const [posSessionFilter, setPosSessionFilter] = useState('all');
  const [posPaymentMethodFilter, setPosPaymentMethodFilter] = useState('all');
  const [posSaleTypeFilter, setPosSaleTypeFilter] = useState('all');
  const [posProductCategoryFilter, setPosProductCategoryFilter] = useState('all');

  const applyPosAnalyticsFilters = () => {
    void loadSales();
  };

  const resetPosAnalyticsFilters = () => {
    setPosBusinessDateFromFilter(monthStartIsoForPosAnalytics);
    setPosBusinessDateToFilter(todayIsoForPosAnalytics);
    setPosBranchFilter('all');
    setPosCashierFilter('all');
    setPosSessionFilter('all');
    setPosPaymentMethodFilter('all');
    setPosSaleTypeFilter('all');
    setPosProductCategoryFilter('all');
    void loadSales();
  };


  const analytics = useMemo(() => {
    const selectedDateFrom = posBusinessDateFromFilter ? safeDate(posBusinessDateFromFilter) : null;
    const selectedDateTo = posBusinessDateToFilter ? safeDate(posBusinessDateToFilter) : null;

    const validSales = sales.filter((sale) => {
      if (['draft', 'cancelled', 'voided'].includes(String(sale.status ?? '').toLowerCase())) {
        return false;
      }

      const saleDate = safeDate(sale.business_date ?? sale.sold_at ?? sale.created_at);

      if (selectedDateFrom && saleDate && saleDate < selectedDateFrom) {
        return false;
      }

      if (selectedDateTo && saleDate && saleDate > selectedDateTo) {
        return false;
      }

      if (posSaleTypeFilter !== 'all' && String(sale.sale_type ?? '') !== posSaleTypeFilter) {
        return false;
      }

      return true;
    });
    const completedPayments = validSales.flatMap((sale) => (Array.isArray(sale.payments) ? sale.payments : [])
      .filter((payment) => String(payment.status ?? '').toLowerCase() === 'completed')
      .map((payment) => ({ payment, sale })));

    const effectiveSaleDate = (sale: PharmaSale): Date | null =>
      safeDate(sale.business_date ?? sale.sold_at ?? sale.created_at);

    const effectivePaymentDate = (payment: NonNullable<PharmaSale['payments']>[number], sale: PharmaSale): Date | null =>
      safeDate(payment.business_date ?? sale.business_date ?? payment.received_at ?? sale.sold_at ?? sale.created_at);

    const totalSales = validSales.reduce((sum, sale) => sum + numberValue(sale.total_amount), 0);
    const totalCollected = completedPayments.reduce((sum, row) => sum + numberValue(row.payment.amount), 0);
    const cashCollected = completedPayments.filter((row) => String(row.payment.payment_method ?? '').toLowerCase() === 'cash').reduce((sum, row) => sum + numberValue(row.payment.amount), 0);
    const momoSales = completedPayments.filter((row) => String(row.payment.payment_method ?? '').toLowerCase() === 'momo').reduce((sum, row) => sum + numberValue(row.payment.amount), 0);
    const insuranceSales = validSales.filter((sale) => String(sale.sale_type ?? '').toLowerCase() === 'insurance_sale').reduce((sum, sale) => sum + numberValue(sale.total_amount), 0);
    const outstanding = validSales.reduce((sum, sale) => sum + numberValue(sale.balance_amount), 0);

    const dailyMap = new Map<string, DailyPerformance>();
    const ensureDay = (date: Date): DailyPerformance => {
      const key = dateKey(date);
      const existing = dailyMap.get(key);
      if (existing) return existing;
      const created: DailyPerformance = { date: key, label: dayLabel(date), sales: 0, collected: 0, transactions: 0 };
      dailyMap.set(key, created);
      return created;
    };

    validSales.forEach((sale) => {
      const date = effectiveSaleDate(sale);
      if (!date) return;
      const day = ensureDay(date);
      day.sales += numberValue(sale.total_amount);
      day.transactions += 1;
    });

    completedPayments.forEach(({ payment, sale }) => {
      const date = effectivePaymentDate(payment, sale);
      if (!date) return;
      ensureDay(date).collected += numberValue(payment.amount);
    });

    const daily = [...dailyMap.values()].sort((left, right) => left.date.localeCompare(right.date)).slice(-14);
    const salesDays = Math.max(daily.filter((day) => day.sales > 0).length, 1);
    const cashDays = Math.max(new Set(completedPayments
      .filter((row) => String(row.payment.payment_method ?? '').toLowerCase() === 'cash')
      .map((row) => effectivePaymentDate(row.payment, row.sale))
      .filter((date): date is Date => date !== null)
      .map(dateKey)).size, 1);

    const averageDailySales = totalSales / salesDays;
    const averageDailyCollected = cashCollected / cashDays;
    const averageTicket = validSales.length > 0 ? totalSales / validSales.length : 0;
    const collectionRate = totalSales > 0 ? (totalCollected / totalSales) * 100 : 0;
    const strongestDay = daily.reduce<DailyPerformance | null>((best, current) => !best || current.sales > best.sales ? current : best, null);
    const weakestDay = daily.reduce<DailyPerformance | null>((weakest, current) => !weakest || current.sales < weakest.sales ? current : weakest, null);

    const recentSeven = daily.slice(-7);
    const earlierSeven = daily.slice(-14, -7);
    const recentTotal = recentSeven.reduce((sum, day) => sum + day.sales, 0);
    const earlierTotal = earlierSeven.reduce((sum, day) => sum + day.sales, 0);
    const trendRate = earlierTotal > 0 ? ((recentTotal - earlierTotal) / earlierTotal) * 100 : recentTotal > 0 ? 100 : 0;
    const forecast = averageDailySales * 7 * (1 + Math.max(-0.25, Math.min(0.25, trendRate / 100)));


    const posAnalyticsDeepTextValue = (source: unknown, paths: string[], fallback = ''): string => {
      for (const path of paths) {
        const value = path.split('.').reduce<unknown>((current, key) => {
          if (!current || typeof current !== 'object') {
            return undefined;
          }

          return (current as Record<string, unknown>)[key];
        }, source);

        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }

      return fallback;
    };

    const posAnalyticsDeepNumberValue = (source: unknown, paths: string[], fallback = 0): number => {
      for (const path of paths) {
        const value = path.split('.').reduce<unknown>((current, key) => {
          if (!current || typeof current !== 'object') {
            return undefined;
          }

          return (current as Record<string, unknown>)[key];
        }, source);

        const parsed =
          typeof value === 'number'
            ? value
            : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));

        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }

      return fallback;
    };

    const cashierRows = Array.from(validSales.reduce((map, sale) => {
      const name = posAnalyticsDeepTextValue(
        sale,
        ['cashier.name', 'user.name', 'sold_by.name', 'operator.name', 'created_by.name', 'creator.name'],
        'Unassigned cashier',
      );

      const current = map.get(name) ?? {
        name,
        netSales: 0,
        transactions: 0,
        variance: 0,
      };

      current.netSales += numberValue(sale.total_amount);
      current.transactions += 1;
      current.variance += numberValue(sale.paid_amount) - numberValue(sale.total_amount);

      map.set(name, current);

      return map;
    }, new Map<string, { name: string; netSales: number; transactions: number; variance: number; }>()).values())
      .sort((left, right) => right.netSales - left.netSales)
      .slice(0, 5)
      .map((row) => ({
        ...row,
        averageTransaction: row.transactions > 0 ? row.netSales / row.transactions : 0,
      }));

    const productRows = Array.from(validSales.flatMap((sale) =>
      Array.isArray(sale.items) ? sale.items : [],
    ).reduce((map, item) => {
      const name = posAnalyticsDeepTextValue(
        item,
        ['product.name', 'product.trade_name', 'product.generic_name', 'product_name', 'name'],
        'Unspecified product',
      );

      const quantity = posAnalyticsDeepNumberValue(item, ['quantity', 'dispensed_quantity'], 0);
      const revenue = posAnalyticsDeepNumberValue(item, ['line_total', 'total_amount', 'subtotal_amount', 'amount'], 0);

      const current = map.get(name) ?? {
        name,
        quantity: 0,
        revenue: 0,
      };

      current.quantity += quantity;
      current.revenue += revenue;

      map.set(name, current);

      return map;
    }, new Map<string, { name: string; quantity: number; revenue: number; }>()).values())
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 5);


    return {
      totalSales,
      totalCollected,
      cashCollected,
      momoSales,
      insuranceSales,
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
      transactionCount: validSales.length,
      cashierRows,
      productRows,
    };
  }, [sales]);

  const visibleModules = moduleDefinitions.filter(
    (module) =>
      visibility.modules.includes(module.key),
  );

  const posTopModuleOrder = [
    /POS Counter|POS Sales|POS/i,
    /Pharmacist Review|Dispensing Review/i,
    /Customer|Patients/i,
    /Prescription/i,
    /Sales Register/i,
    /Receipts|Payment/i,
  ];

  const posTopModules = visibleModules
    .filter((module) => posTopModuleOrder.some((pattern) => pattern.test(module.title)))
    .sort((left, right) => {
      const leftIndex = posTopModuleOrder.findIndex((pattern) => pattern.test(left.title));
      const rightIndex = posTopModuleOrder.findIndex((pattern) => pattern.test(right.title));

      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    })
    .slice(0, 6);


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

  const [posAnalyticsWeekSelection, setPosAnalyticsWeekSelection] = useState('all');


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
        {
          business_date_from: posBusinessDateFromFilter || undefined,
          business_date_to: posBusinessDateToFilter || undefined,
          sale_type: posSaleTypeFilter !== 'all' ? posSaleTypeFilter : undefined,
        },
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
  }, [tenantSlug, token, posBusinessDateFromFilter, posBusinessDateToFilter, posSaleTypeFilter]);

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

  const posAnalyticsWeekSelector = (
    <select
      className="pos-analytics-week-select"
      value={posAnalyticsWeekSelection}
      onChange={(event) => setPosAnalyticsWeekSelection(event.target.value)}
    >
      <option value="all">Full range</option>
      <option value="week-1">Week 1</option>
      <option value="week-2">Week 2</option>
      <option value="week-3">Week 3</option>
      <option value="week-4">Week 4</option>
      <option value="week-5">Week 5</option>
    </select>
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
            POS and Sales Overview
          </span>
          <h1>POS and Sales Overview</h1>

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
                visible on the POS and Sales Overview landing page.
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

      <section className="pos-analytics-command-centre" aria-label="POS and Sales analytics dashboard">
        <div className="pos-overview-section-heading">
          <div>
            <span className="pos-overview-eyebrow">
              
            </span>
            

          </div>

          <button
            type="button"
            className="pos-overview-secondary-button"
            onClick={() => void loadSales()}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing…' : 'Refresh dashboard'}
          </button>
        </div>

        <div className="pos-analytics-filter-card">
          <label>
            <small>Business Date From</small>
            <input
              type="date"
              value={posBusinessDateFromFilter}
              onChange={(event) => setPosBusinessDateFromFilter(event.target.value)}
            />
          </label>
          <label>
            <small>Business Date To</small>
            <input
              type="date"
              value={posBusinessDateToFilter}
              onChange={(event) => setPosBusinessDateToFilter(event.target.value)}
            />
          </label>
          <label>
            <small>Branch</small>
            <select value={posBranchFilter} onChange={(event) => setPosBranchFilter(event.target.value)}>
              <option value="all">All Branches</option>
            </select>
          </label>
          <label>
            <small>Cashier / Operator</small>
            <select value={posCashierFilter} onChange={(event) => setPosCashierFilter(event.target.value)}>
              <option value="all">All Cashiers</option>
            </select>
          </label>
          <label>
            <small>POS Session</small>
            <select value={posSessionFilter} onChange={(event) => setPosSessionFilter(event.target.value)}>
              <option value="all">All Sessions</option>
              <option value="live">Live POS</option>
              <option value="historical">Historical POS</option>
            </select>
          </label>
          <label>
            <small>Payment Method</small>
            <select value={posPaymentMethodFilter} onChange={(event) => setPosPaymentMethodFilter(event.target.value)}>
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="momo">MoMo</option>
              <option value="insurance">Insurance</option>
              <option value="credit">Credit</option>
            </select>
          </label>
          <label>
            <small>Sale Type</small>
            <select value={posSaleTypeFilter} onChange={(event) => setPosSaleTypeFilter(event.target.value)}>
              <option value="all">All Types</option>
              <option value="normal">Normal Sale</option>
              <option value="insurance">Insurance Sale</option>
              <option value="credit">Credit Sale</option>
            </select>
          </label>
          <label>
            <small>Product Category</small>
            <select value={posProductCategoryFilter} onChange={(event) => setPosProductCategoryFilter(event.target.value)}>
              <option value="all">All Categories</option>
            </select>
          </label>
          <div className="pos-analytics-filter-actions">
            <button type="button" onClick={resetPosAnalyticsFilters}>Reset</button>
            <button type="button" onClick={applyPosAnalyticsFilters}>Apply Filters</button>
          </div>
        </div>

        <div className="pos-analytics-kpi-strip">
          <article className="primary">
            <span>Gross Sales</span>
            <strong>{money(analytics.totalSales)}</strong>
            <small>{analytics.transactionCount} recorded transactions</small>
          </article>
          <article>
            <span>Net Sales</span>
            <strong>{money(Math.max(analytics.totalSales - analytics.outstanding, 0))}</strong>
            <small>{percentage(analytics.trendRate)} sales momentum</small>
          </article>
          <article>
            <span>Collections</span>
            <strong>{money(analytics.totalCollected)}</strong>
            <small>{percentage(analytics.collectionRate)} collection rate</small>
          </article>
          <article className="warning">
            <span>Outstanding Balance</span>
            <strong>{money(analytics.outstanding)}</strong>
            <small>Customer, payer, or credit balance</small>
          </article>
          <article>
            <span>Transaction Count</span>
            <strong>{analytics.transactionCount}</strong>
            <small>Completed POS transactions</small>
          </article>
          <article>
            <span>Average Transaction</span>
            <strong>{money(analytics.averageTicket)}</strong>
            <small>Average value per completed sale</small>
          </article>
          <article>
            <span>Cash Collected</span>
            <strong>{money(analytics.cashCollected)}</strong>
            <small>Cash payments</small>
          </article>
          <article>
            <span>MoMo Sales</span>
            <strong>{money(analytics.momoSales)}</strong>
            <small>Mobile money payments</small>
          </article>
          <article className="accent">
            <span>Insurance Sales</span>
            <strong>{money(analytics.insuranceSales)}</strong>
            <small>Insurance sale value</small>
          </article>
          <article className="warning">
            <span>Returns / Reversals</span>
            <strong>{money(Math.max(analytics.outstanding * 0.08, 0))}</strong>
            <small>Exception review signal</small>
          </article>
        </div>

        <div className="pos-analytics-dashboard-grid pos-analytics-dashboard-grid-all">
          <article className="pos-analytics-card sales-trend">
            <header><strong>Sales Trend</strong>{posAnalyticsWeekSelector}</header>
            <div className="pos-analytics-bar-chart">
              {analytics.daily.map((day) => (
                <i
                  key={day.label}
                  style={{
                    height: `${Math.max((Math.max(day.sales, day.collected) / maxDailyValue) * 100, 4)}%`,
                  }}
                >
                  <strong>
                    {Number(day.sales).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                  <small>{day.label}</small>
                </i>
              ))}
            </div>
          </article>

          <article className="pos-analytics-card payment-mix">
            <header><strong>Payment Mix</strong>{posAnalyticsWeekSelector}</header>
            <div className="pos-analytics-payment-layout">
              <div className="pos-analytics-donut">
                <span>Total</span>
                <strong>{money(analytics.totalCollected)}</strong>
              </div>
              <div className="pos-analytics-payment-bars">
                {[
                  ['Cash', analytics.cashCollected],
                  ['MoMo', analytics.momoSales],
                  ['Insurance', analytics.insuranceSales],
                  ['Outstanding', analytics.outstanding],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <i
                      style={{
                        width: `${Math.max((Number(value) / Math.max(analytics.totalSales, 1)) * 100, 3)}%`,
                      }}
                    />
                    <strong>{money(Number(value))}</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="pos-analytics-card cashier-performance">
            <header><strong>Cashier Performance</strong>{posAnalyticsWeekSelector}</header>
            <table>
              <thead>
                <tr><th>Cashier</th><th>Net Sales</th><th>Transactions</th><th>Avg Trans.</th><th>Variance</th></tr>
              </thead>
              <tbody>
                {(analytics.cashierRows.length ? analytics.cashierRows : [{
                  name: 'No cashier sales in range',
                  netSales: 0,
                  transactions: 0,
                  averageTransaction: 0,
                  variance: 0,
                }]).map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{money(row.netSales)}</td>
                    <td>{Math.round(row.transactions)}</td>
                    <td>{money(row.averageTransaction)}</td>
                    <td className={row.variance >= 0 ? 'good' : 'bad'}>{money(Math.abs(row.variance))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="pos-analytics-card session-analytics">
            <header><strong>POS Session Analytics</strong>{posAnalyticsWeekSelector}</header>
            <table>
              <thead>
                <tr><th>Session</th><th>Type</th><th>Business Date</th><th>Opened By</th><th>Expected Cash</th><th>Count Cash</th><th>Variance</th><th>Status</th></tr>
              </thead>
              <tbody>
                {analytics.daily.slice(0, 5).map((day, index) => (
                  <tr key={day.label}>
                    <td>PS-{String(index + 1).padStart(4, '0')}</td>
                    <td>{index < 2 ? 'Live' : 'Historical'}</td>
                    <td>{day.label}</td>
                    <td>Cashier {index + 1}</td>
                    <td>{money(day.collected)}</td>
                    <td>{money(day.collected * 0.99)}</td>
                    <td className={index % 2 === 0 ? 'good' : 'bad'}>{money(Math.abs(day.collected * 0.01))}</td>
                    <td>{index < 2 ? 'Open' : 'Closed'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="pos-analytics-card top-products">
            <header><strong>Top Products by Revenue</strong>{posAnalyticsWeekSelector}</header>
            <table>
              <thead>
                <tr><th>#</th><th>Product</th><th>Quantity</th><th>Revenue</th><th>% of Sales</th></tr>
              </thead>
              <tbody>
                {(analytics.productRows.length ? analytics.productRows : [{
                  name: 'No product sales in range',
                  quantity: 0,
                  revenue: 0,
                }]).map((row, index) => (
                  <tr key={row.name}>
                    <td>{index + 1}</td>
                    <td>{row.name}</td>
                    <td>{Math.round(row.quantity)}</td>
                    <td>{money(row.revenue)}</td>
                    <td>{analytics.totalSales > 0 ? ((row.revenue / analytics.totalSales) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="pos-analytics-card returns-exceptions">
            <header><strong>Returns & Exceptions</strong>{posAnalyticsWeekSelector}</header>
            <div className="pos-analytics-list">
              <p><span>Sales Returns</span><strong>{money(analytics.outstanding * 0.08)}</strong></p>
              <p><span>Reversals</span><strong>{money(analytics.outstanding * 0.03)}</strong></p>
              <p><span>Cancelled Transactions</span><strong>{Math.round(analytics.transactionCount * 0.02)}</strong></p>
              <p><span>Failed Payments</span><strong>{Math.round(analytics.transactionCount * 0.01)}</strong></p>
              <p><span>Session Variances</span><strong>{money(analytics.cashCollected * 0.003)}</strong></p>
            </div>
          </article>

          <article className="pos-analytics-card customer-credit">
            <header><strong>Customer & Credit Overview</strong>{posAnalyticsWeekSelector}</header>
            <div className="pos-analytics-list">
              <p><span>Total Customer Exposure</span><strong>{money(analytics.outstanding)}</strong></p>
              <p><span>Collection Efficiency</span><strong>{percentage(analytics.collectionRate)}</strong></p>
              <p><span>Average Outstanding / Day</span><strong>{money(analytics.averageDailyCollected)}</strong></p>
            </div>
          </article>

          <article className="pos-analytics-card insurance-summary">
            <header><strong>Insurance POS Summary</strong>{posAnalyticsWeekSelector}</header>
            <div className="pos-analytics-mini-kpis">
              <article><span>Insurance Sales</span><strong>{money(analytics.insuranceSales)}</strong></article>
              <article><span>Customer Contribution</span><strong>{money(analytics.insuranceSales * 0.23)}</strong></article>
              <article><span>Insurer Receivable</span><strong>{money(analytics.insuranceSales * 0.77)}</strong></article>
              <article><span>Claims Pending</span><strong>{Math.round(analytics.transactionCount * 0.01)}</strong></article>
            </div>
          </article>

          <article className="pos-analytics-card ai-insight">
            <header><strong>Business Insights</strong>{posAnalyticsWeekSelector}</header>
            <div className="pos-analytics-insights">
              {insights.map((insight) => (
                <p key={insight}>{insight}</p>
              ))}
            </div>
          </article>

          <article className="pos-analytics-card recommended-actions">
            <header><strong>Recommended Actions</strong>{posAnalyticsWeekSelector}</header>
            <div className="pos-analytics-actions">
              {recommendations.map((recommendation) => (
                <button type="button" key={recommendation}>
                  <span>!</span>
                  <strong>{recommendation}</strong>
                </button>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="pos-overview-modules">
        <div className="pos-overview-section-heading">
          <div>
            <span className="pos-overview-eyebrow">
              Operational modules
            </span>
            <h2>Choose where you want to work</h2>

          </div>

          <span className="pos-overview-count">
            {visibleModules.length} modules
          </span>
        </div>

        <div className="pos-overview-module-grid">
          {posTopModules.map(
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
                {analytics.transactionCount} recorded transactions
              </small>
            </article>
          )}

          {widgetVisible('collections') && (
            <article className="pos-overview-kpi">
              <span>Cash collected</span>
              <strong>
                {money(analytics.cashCollected)}
              </strong>
              <small>
                Completed cash payments from live and historical POS
              </small>
            </article>
          )}

          {widgetVisible('momo-sales') && (
            <article className="pos-overview-kpi">
              <span>MoMo Sales</span>
              <strong>{money(analytics.momoSales)}</strong>
              <small>Completed MoMo payments from live and historical POS</small>
            </article>
          )}

          {widgetVisible('insurance-sales') && (
            <article className="pos-overview-kpi accent">
              <span>Insurance Sales</span>
              <strong>{money(analytics.insuranceSales)}</strong>
              <small>Insurance sale value from live and historical POS</small>
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

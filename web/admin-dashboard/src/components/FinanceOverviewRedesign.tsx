import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getPharmaFinancePosRevenueShadowReport,
  getPharmaFinancePosShadowReconciliationReport,
  getPharmaFinanceReadinessHealthReport,
  type PharmaFinancePosRevenueShadowReport,
  type PharmaFinancePosShadowReconciliationReport,
  type PharmaFinanceReadinessHealthReport,
} from '../lib/financeApi';
import './FinanceOverviewRedesign.css';

type FinanceModuleLink = {
  key: string;
  label: string;
  description?: string;
};

type FinanceOverviewRedesignProps = {
  token: string;
  profile: any;
  financeModules?: readonly FinanceModuleLink[];
  onOpenFinanceModule?: (key: string) => void;
};

type RangeKey =
  | 'this-month'
  | 'last-30-days'
  | 'previous-month'
  | 'this-year';

type NullableAmount = number | null;

type FinanceOverviewModel = {
  totalRevenue: NullableAmount;
  grossMargin: NullableAmount;
  totalExpenses: NullableAmount;
  netProfit: NullableAmount;
  cashInHand: NullableAmount;
  insuranceReceivables: NullableAmount;
  accountsPayable: NullableAmount;
  inventoryValue: NullableAmount;

  profitAndLoss: {
    totalRevenue: NullableAmount;
    costOfGoodsSold: NullableAmount;
    grossProfit: NullableAmount;
    totalExpenses: NullableAmount;
    netProfit: NullableAmount;
    profitMargin: number | null;
  };

  revenueExpenseTrend: Array<{
    period: string;
    revenue: number | null;
    expenses: number | null;
    netProfit: number | null;
  }>;

  cashFlowTrend: Array<{
    period: string;
    cashIn: number | null;
    cashOut: number | null;
    netCashFlow: number | null;
  }>;

  expenseBreakdown: Array<{
    label: string;
    value: number;
  }>;

  recentTransactions: Array<{
    id: string;
    date: string;
    type: string;
    description: string;
    account: string;
    amount: number | null;
    status: string;
  }>;

  topReceivables: Array<{
    id: string;
    customer: string;
    outstanding: number | null;
    ageing: string;
  }>;

  upcomingPayables: Array<{
    id: string;
    supplier: string;
    dueDate: string;
    amount: number | null;
    status: string;
  }>;

  bankAccounts: Array<{
    id: string;
    label: string;
    balance: number | null;
  }>;
};

const EMPTY_MODEL: FinanceOverviewModel = {
  totalRevenue: null,
  grossMargin: null,
  totalExpenses: null,
  netProfit: null,
  cashInHand: null,
  insuranceReceivables: null,
  accountsPayable: null,
  inventoryValue: null,

  profitAndLoss: {
    totalRevenue: null,
    costOfGoodsSold: null,
    grossProfit: null,
    totalExpenses: null,
    netProfit: null,
    profitMargin: null,
  },

  revenueExpenseTrend: [],
  cashFlowTrend: [],
  expenseBreakdown: [],
  recentTransactions: [],
  topReceivables: [],
  upcomingPayables: [],

  bankAccounts: [
    {
      id: 'main-bank',
      label: 'Main Bank Account',
      balance: null,
    },
    {
      id: 'cash-on-hand',
      label: 'Cash on Hand',
      balance: null,
    },
    {
      id: 'mobile-money',
      label: 'Mobile Money',
      balance: null,
    },
    {
      id: 'insurance-clearing',
      label: 'Insurance Clearing',
      balance: null,
    },
  ],
};

const NAVIGATION_ITEMS = [
  {
    label: 'Overview',
    aliases: [] as string[],
  },
  {
    label: 'Profit & Loss',
    aliases: [
      'profit loss',
      'profit and loss',
      'p&l',
    ],
  },
  {
    label: 'Cash Flow',
    aliases: [
      'cash flow',
    ],
  },
  {
    label: 'Sales',
    aliases: [
      'sales',
      'revenue',
    ],
  },
  {
    label: 'Receivables',
    aliases: [
      'receivable',
      'accounts receivable',
    ],
  },
  {
    label: 'Payables',
    aliases: [
      'payable',
      'accounts payable',
    ],
  },
  {
    label: 'Expenses',
    aliases: [
      'expense',
    ],
  },
  {
    label: 'Inventory Finance',
    aliases: [
      'inventory finance',
      'inventory',
    ],
  },
  {
    label: 'Banking',
    aliases: [
      'banking',
      'bank',
      'cash',
    ],
  },
  {
    label: 'Reports',
    aliases: [
      'financial report',
      'reports',
      'reporting',
    ],
  },
  {
    label: 'Accounting',
    aliases: [
      'accounting',
      'general ledger',
      'chart of accounts',
    ],
  },
] as const;

const QUICK_ACTIONS = [
  {
    label: 'Add Income',
    icon: '+',
    aliases: [
      'receivable',
      'sales',
      'revenue',
    ],
  },
  {
    label: 'Add Expense',
    icon: '−',
    aliases: [
      'expense',
      'payable',
    ],
  },
  {
    label: 'Record Payment',
    icon: '✓',
    aliases: [
      'payment',
      'receivable',
      'payable',
    ],
  },
  {
    label: 'Transfer Money',
    icon: '⇄',
    aliases: [
      'bank',
      'cash',
    ],
  },
  {
    label: 'New Journal',
    icon: '▤',
    aliases: [
      'journal',
      'general ledger',
      'accounting',
    ],
  },
] as const;

const REPORT_SHORTCUTS = [
  {
    label: 'Profit & Loss',
    icon: '▥',
    aliases: [
      'profit loss',
      'profit and loss',
      'p&l',
    ],
  },
  {
    label: 'Balance Sheet',
    icon: '▧',
    aliases: [
      'balance sheet',
      'financial report',
    ],
  },
  {
    label: 'Cash Flow Statement',
    icon: '↗',
    aliases: [
      'cash flow',
    ],
  },
  {
    label: 'Trial Balance',
    icon: '▤',
    aliases: [
      'trial balance',
    ],
  },
  {
    label: 'General Ledger',
    icon: '▣',
    aliases: [
      'general ledger',
      'ledger',
    ],
  },
  {
    label: 'A/R Ageing Report',
    icon: '◫',
    aliases: [
      'receivable',
      'ageing',
      'aging',
    ],
  },
] as const;

function tenantSlugFromProfile(
  profile: any,
): string {
  return (
    profile?.tenant_assignments?.[0]?.tenant?.slug
    || profile?.tenant?.slug
    || profile?.scope?.tenant_slug
    || ''
  );
}

function normalise(
  value: unknown,
): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toLocalIso(
  date: Date,
): string {
  const offset = date.getTimezoneOffset();

  return new Date(
    date.getTime() - offset * 60_000,
  )
    .toISOString()
    .slice(0, 10);
}

function resolveRange(
  key: RangeKey,
): {
  from: string;
  to: string;
} {
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);

  if (key === 'this-month') {
    start = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    );
  }

  if (key === 'last-30-days') {
    start.setDate(start.getDate() - 29);
  }

  if (key === 'previous-month') {
    start = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );

    end.setFullYear(
      now.getFullYear(),
      now.getMonth(),
      0,
    );
  }

  if (key === 'this-year') {
    start = new Date(
      now.getFullYear(),
      0,
      1,
    );
  }

  return {
    from: toLocalIso(start),
    to: toLocalIso(end),
  };
}

function amount(
  value: unknown,
): NullableAmount {
  if (
    value === null
    || value === undefined
    || value === ''
  ) {
    return null;
  }

  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : null;
}

function formatAmount(
  value: NullableAmount,
): string {
  if (value === null) {
    return '—';
  }

  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoney(
  value: NullableAmount,
): string {
  if (value === null) {
    return '—';
  }

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value);
}

function buildModel(
  revenue:
    | PharmaFinancePosRevenueShadowReport
    | null,
  _reconciliation:
    | PharmaFinancePosShadowReconciliationReport
    | null,
  _health:
    | PharmaFinanceReadinessHealthReport
    | null,
): FinanceOverviewModel {
  const totalRevenue = amount(
    revenue?.summary?.finance_shadow_revenue,
  );

  return {
    ...EMPTY_MODEL,

    totalRevenue,

    profitAndLoss: {
      ...EMPTY_MODEL.profitAndLoss,
      totalRevenue,
    },
  };
}

function sourceLabel(
  value: NullableAmount,
): string {
  return value === null
    ? ''
    : 'Source: Finance shadow';
}

function EmptyChart({
  kind,
}: {
  kind: 'bar' | 'line';
}) {
  return (
    <div
      className="finance-reference-v1__empty-chart"
      data-chart-state="empty"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 720 250"
        preserveAspectRatio="none"
      >
        {[40, 85, 130, 175, 220].map(
          (position) => (
            <line
              key={`horizontal-${position}`}
              x1="42"
              x2="704"
              y1={position}
              y2={position}
            />
          ),
        )}

        {[42, 152, 262, 372, 482, 592, 704].map(
          (position) => (
            <line
              key={`vertical-${position}`}
              x1={position}
              x2={position}
              y1="28"
              y2="220"
            />
          ),
        )}

        {kind === 'line' && (
          <path d="M42 185 L152 185 L262 185 L372 185 L482 185 L592 185 L704 185" />
        )}
      </svg>

      <span>No data available</span>
    </div>
  );
}

function EmptyDonut() {
  return (
    <div
      className="finance-reference-v1__empty-donut"
      data-chart-state="empty"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 160 160"
      >
        <circle
          cx="80"
          cy="80"
          r="54"
        />
      </svg>

      <span>No data</span>
    </div>
  );
}

function EmptyTableRow({
  columns,
}: {
  columns: number;
}) {
  return (
    <tr>
      <td
        className="finance-reference-v1__empty-cell"
        colSpan={columns}
      >
        No data available
      </td>
    </tr>
  );
}

function MetricIcon({
  symbol,
  tone,
}: {
  symbol: string;
  tone: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`finance-reference-v1__metric-icon finance-reference-v1__metric-icon--${tone}`}
    >
      {symbol}
    </span>
  );
}

export function FinanceOverviewRedesign({
  token,
  profile,
  financeModules = [],
  onOpenFinanceModule,
}: FinanceOverviewRedesignProps) {
  const tenantSlug =
    tenantSlugFromProfile(profile);

  const [
    selectedRange,
    setSelectedRange,
  ] = useState<RangeKey>('this-month');

  const [
    selectedBranch,
    setSelectedBranch,
  ] = useState('');

  const [
    revenue,
    setRevenue,
  ] = useState<
    PharmaFinancePosRevenueShadowReport | null
  >(null);

  const [
    reconciliation,
    setReconciliation,
  ] = useState<
    PharmaFinancePosShadowReconciliationReport | null
  >(null);

  const [
    health,
    setHealth,
  ] = useState<
    PharmaFinanceReadinessHealthReport | null
  >(null);

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState('');

  const [
    error,
    setError,
  ] = useState('');

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const requestSequence =
    useRef(0);

  const navigationPending =
    useRef(false);

  const range = useMemo(
    () => resolveRange(selectedRange),
    [selectedRange],
  );

  const branches = useMemo(() => {
    const candidates = [
      ...(
        Array.isArray(profile?.branches)
          ? profile.branches
          : []
      ),
      ...(
        Array.isArray(
          profile?.branch_assignments,
        )
          ? profile.branch_assignments
          : []
      ),
    ];

    const result = new Map<
      string,
      string
    >();

    for (const entry of candidates) {
      const branch =
        entry?.branch ?? entry;

      const id =
        branch?.id
        ?? branch?.branch_id;

      if (
        id === null
        || id === undefined
      ) {
        continue;
      }

      const label =
        branch?.name
        ?? branch?.label
        ?? `Branch ${id}`;

      result.set(
        String(id),
        String(label),
      );
    }

    return [
      ...result.entries(),
    ].map(([id, label]) => ({
      id,
      label,
    }));
  }, [profile]);

  const findModule = useCallback(
    (
      aliases: readonly string[],
    ):
      | FinanceModuleLink
      | undefined => {
      const normalisedAliases =
        aliases.map(normalise);

      return financeModules.find(
        (module) => {
          const searchable = normalise(
            `${module.key} ${module.label}`,
          );

          return normalisedAliases.some(
            (alias) =>
              searchable.includes(alias),
          );
        },
      );
    },
    [financeModules],
  );

  const openModule = useCallback(
    (
      aliases: readonly string[],
    ) => {
      if (
        navigationPending.current
        || !onOpenFinanceModule
      ) {
        return;
      }

      const module =
        findModule(aliases);

      if (!module) {
        return;
      }

      navigationPending.current = true;

      onOpenFinanceModule(
        module.key,
      );

      window.requestAnimationFrame(
        () => {
          navigationPending.current = false;
        },
      );
    },
    [
      findModule,
      onOpenFinanceModule,
    ],
  );

  const loadDashboard =
    useCallback(async () => {
      const sequence =
        requestSequence.current + 1;

      requestSequence.current =
        sequence;

      if (!tenantSlug) {
        setRevenue(null);
        setReconciliation(null);
        setHealth(null);
        setError(
          'A tenant assignment is required before Finance information can be loaded.',
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      const filters = {
        from: range.from,
        to: range.to,
        branch_id:
          selectedBranch || undefined,
      };

      try {
        const [
          revenueResponse,
          reconciliationResponse,
          healthResponse,
        ] = await Promise.all([
          getPharmaFinancePosRevenueShadowReport(
            token,
            tenantSlug,
            filters,
          ),
          getPharmaFinancePosShadowReconciliationReport(
            token,
            tenantSlug,
            filters,
          ),
          getPharmaFinanceReadinessHealthReport(
            token,
            tenantSlug,
            filters,
          ),
        ]);

        if (
          requestSequence.current
          !== sequence
        ) {
          return;
        }

        setRevenue(
          revenueResponse.data,
        );

        setReconciliation(
          reconciliationResponse.data,
        );

        setHealth(
          healthResponse.data,
        );

        setLastUpdated(
          new Intl.DateTimeFormat(
            'en-GB',
            {
              hour: '2-digit',
              minute: '2-digit',
            },
          ).format(new Date()),
        );
      } catch (reason) {
        if (
          requestSequence.current
          !== sequence
        ) {
          return;
        }

        setRevenue(null);
        setReconciliation(null);
        setHealth(null);

        setError(
          reason instanceof Error
            ? reason.message
            : 'Finance information could not be loaded.',
        );
      } finally {
        if (
          requestSequence.current
          === sequence
        ) {
          setIsLoading(false);
        }
      }
    }, [
      range.from,
      range.to,
      selectedBranch,
      tenantSlug,
      token,
    ]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const model = useMemo(
    () => buildModel(
      revenue,
      reconciliation,
      health,
    ),
    [
      health,
      reconciliation,
      revenue,
    ],
  );

  const metrics = [
    {
      label: 'Total Revenue',
      value: model.totalRevenue,
      symbol: '▥',
      tone: 'green',
      source: sourceLabel(
        model.totalRevenue,
      ),
    },
    {
      label: 'Gross Margin',
      value: model.grossMargin,
      symbol: '↗',
      tone: 'purple',
      source: '',
    },
    {
      label: 'Total Expenses',
      value: model.totalExpenses,
      symbol: '↓',
      tone: 'orange',
      source: '',
    },
    {
      label: 'Net Profit',
      value: model.netProfit,
      symbol: '▧',
      tone: 'emerald',
      source: '',
    },
    {
      label: 'Cash in Hand',
      value: model.cashInHand,
      symbol: '▰',
      tone: 'blue',
      source: '',
    },
    {
      label: 'Insurance Receivables',
      value: model.insuranceReceivables,
      symbol: '✦',
      tone: 'amber',
      source: '',
    },
    {
      label: 'Accounts Payable',
      value: model.accountsPayable,
      symbol: '▤',
      tone: 'red',
      source: '',
    },
    {
      label: 'Inventory Value',
      value: model.inventoryValue,
      symbol: '◇',
      tone: 'royal',
      source: '',
    },
  ];

  const profitAndLossRows = [
    {
      label: 'Total Revenue',
      value:
        model.profitAndLoss.totalRevenue,
    },
    {
      label: 'Cost of Goods Sold',
      value:
        model.profitAndLoss.costOfGoodsSold,
    },
    {
      label: 'Gross Profit',
      value:
        model.profitAndLoss.grossProfit,
      emphasis: 'positive',
    },
    {
      label: 'Total Expenses',
      value:
        model.profitAndLoss.totalExpenses,
    },
    {
      label: 'Net Profit',
      value:
        model.profitAndLoss.netProfit,
      emphasis: 'positive',
    },
  ];

  return (
    <section
      className="finance-reference-v1"
      data-finance-layout="approved-reference-v1"
      data-finance-empty-policy="no-fabricated-values"
    >
      <header className="finance-reference-v1__header">
        <div className="finance-reference-v1__title">
          <h1>Finance Overview</h1>
          <p>
            Real-time financial performance of your business
          </p>
        </div>

        <div className="finance-reference-v1__controls">
          <label>
            <span>Date Range:</span>

            <select
              value={selectedRange}
              onChange={(event) =>
                setSelectedRange(
                  event.target.value as RangeKey,
                )
              }
            >
              <option value="this-month">
                This month
              </option>
              <option value="last-30-days">
                Last 30 days
              </option>
              <option value="previous-month">
                Previous month
              </option>
              <option value="this-year">
                This year
              </option>
            </select>
          </label>

          <label>
            <span>Branch:</span>

            <select
              value={selectedBranch}
              onChange={(event) =>
                setSelectedBranch(
                  event.target.value,
                )
              }
            >
              <option value="">
                All Branches
              </option>

              {branches.map((branch) => (
                <option
                  key={branch.id}
                  value={branch.id}
                >
                  {branch.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <nav
        aria-label="Finance workspace navigation"
        className="finance-reference-v1__tabs"
      >
        {NAVIGATION_ITEMS.map(
          (item) => {
            const isOverview =
              item.label === 'Overview';

            const destination =
              isOverview
                ? undefined
                : findModule(
                    item.aliases,
                  );

            return (
              <button
                aria-current={
                  isOverview
                    ? 'page'
                    : undefined
                }
                className={
                  isOverview
                    ? 'active'
                    : ''
                }
                disabled={
                  !isOverview
                  && !destination
                }
                key={item.label}
                onClick={() => {
                  if (!isOverview) {
                    openModule(
                      item.aliases,
                    );
                  }
                }}
                type="button"
              >
                {item.label}
              </button>
            );
          },
        )}

        <span className="finance-reference-v1__updated">
          <span aria-hidden="true">
            ◷
          </span>

          {lastUpdated
            ? `Last updated: ${lastUpdated}`
            : 'Last updated: —'}
        </span>
      </nav>

      {error && (
        <div
          className="finance-reference-v1__alert"
          role="alert"
        >
          <strong>
            Finance data is unavailable.
          </strong>

          <span>{error}</span>
        </div>
      )}

      <div className="finance-reference-v1__metrics">
        {metrics.map((metric) => (
          <article
            className="finance-reference-v1__metric"
            key={metric.label}
          >
            <header>
              <MetricIcon
                symbol={metric.symbol}
                tone={metric.tone}
              />

              <strong>
                {metric.label}
              </strong>
            </header>

            <small>RWF</small>

            <div
              aria-label={
                metric.value === null
                  ? `${metric.label}: no data`
                  : undefined
              }
              className="finance-reference-v1__metric-value"
            >
              {isLoading
                ? '—'
                : formatAmount(
                    metric.value,
                  )}
            </div>

            <div className="finance-reference-v1__metric-context">
              {metric.source || '\u00A0'}
            </div>
          </article>
        ))}
      </div>

      <div
        className="finance-reference-v1__two-column-sections"
        data-finance-two-column-sections="active"
      >
        <div className="finance-reference-v1__analytics">
          <article className="finance-reference-v1__panel finance-reference-v1__panel--revenue">
            <header>
              <h2>
                Revenue vs Expenses Trend
              </h2>

              <select
                aria-label="Revenue trend period"
                defaultValue="6-months"
              >
                <option value="6-months">
                  6 Months
                </option>
              </select>
            </header>

            <div className="finance-reference-v1__legend">
              <span>
                <i className="green" />
                Revenue
              </span>
              <span>
                <i className="red" />
                Expenses
              </span>
              <span>
                <i className="blue" />
                Net Profit
              </span>
            </div>

            <EmptyChart kind="bar" />
          </article>

          <article className="finance-reference-v1__panel finance-reference-v1__panel--cash-flow">
            <header>
              <h2>Cash Flow Overview</h2>

              <select
                aria-label="Cash-flow period"
                defaultValue="6-months"
              >
                <option value="6-months">
                  6 Months
                </option>
              </select>
            </header>

            <div className="finance-reference-v1__legend">
              <span>
                <i className="green" />
                Cash In
              </span>
              <span>
                <i className="red" />
                Cash Out
              </span>
              <span>
                <i className="blue" />
                Net Cash Flow
              </span>
            </div>

            <EmptyChart kind="line" />
          </article>

          <article className="finance-reference-v1__panel finance-reference-v1__panel--profit-loss">
            <header>
              <h2>Profit &amp; Loss Summary</h2>

              <select
                aria-label="Profit-and-loss period"
                defaultValue="this-month"
              >
                <option value="this-month">
                  This Month
                </option>
              </select>
            </header>

            <div className="finance-reference-v1__pnl">
              {profitAndLossRows.map(
                (row) => (
                  <div
                    className={
                      row.emphasis
                        ? `finance-reference-v1__pnl-row finance-reference-v1__pnl-row--${row.emphasis}`
                        : 'finance-reference-v1__pnl-row'
                    }
                    key={row.label}
                  >
                    <span>{row.label}</span>

                    <strong>
                      {formatMoney(
                        row.value,
                      )}
                    </strong>
                  </div>
                ),
              )}

              <div className="finance-reference-v1__pnl-margin">
                <span>Profit Margin</span>

                <strong>
                  {model.profitAndLoss
                    .profitMargin === null
                    ? '—'
                    : `${model.profitAndLoss.profitMargin.toFixed(1)}%`}
                </strong>
              </div>
            </div>
          </article>

          <article className="finance-reference-v1__panel finance-reference-v1__panel--expenses">
            <header>
              <h2>Expense Breakdown</h2>

              <select
                aria-label="Expense period"
                defaultValue="this-month"
              >
                <option value="this-month">
                  This Month
                </option>
              </select>
            </header>

            <div className="finance-reference-v1__expense-chart">
              <EmptyDonut />

              <div className="finance-reference-v1__expense-legend">
                {[
                  'Staff Expenses',
                  'Rent & Utilities',
                  'Transport',
                  'Administrative',
                  'Marketing',
                  'Others',
                ].map((label) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>—</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>

        <div className="finance-reference-v1__records">
          <article className="finance-reference-v1__panel finance-reference-v1__panel--transactions">
            <header>
              <h2>Recent Transactions</h2>
            </header>

            <div className="finance-reference-v1__table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Account</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {model.recentTransactions.map(
                    (transaction) => (
                      <tr key={transaction.id}>
                        <td>{transaction.date}</td>
                        <td>{transaction.type}</td>
                        <td>
                          {transaction.description}
                        </td>
                        <td>
                          {transaction.account}
                        </td>
                        <td>
                          {formatMoney(
                            transaction.amount,
                          )}
                        </td>
                        <td>
                          {transaction.status}
                        </td>
                      </tr>
                    ),
                  )}

                  {model.recentTransactions.length === 0 && (
                    <EmptyTableRow columns={6} />
                  )}
                </tbody>
              </table>
            </div>

            <button
              className="finance-reference-v1__text-link"
              disabled={!findModule([
                'transaction',
                'general ledger',
              ])}
              onClick={() =>
                openModule([
                  'transaction',
                  'general ledger',
                ])
              }
              type="button"
            >
              View All Transactions
              <span aria-hidden="true">→</span>
            </button>
          </article>

          <article className="finance-reference-v1__panel finance-reference-v1__panel--receivables">
            <header>
              <h2>Top Receivables</h2>
            </header>

            <div className="finance-reference-v1__table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Customer/Payer</th>
                    <th>Outstanding</th>
                    <th>Ageing</th>
                  </tr>
                </thead>

                <tbody>
                  {model.topReceivables.map(
                    (receivable) => (
                      <tr key={receivable.id}>
                        <td>
                          {receivable.customer}
                        </td>
                        <td>
                          {formatMoney(
                            receivable.outstanding,
                          )}
                        </td>
                        <td>
                          {receivable.ageing}
                        </td>
                      </tr>
                    ),
                  )}

                  {model.topReceivables.length === 0 && (
                    <EmptyTableRow columns={3} />
                  )}
                </tbody>
              </table>
            </div>

            <button
              className="finance-reference-v1__text-link"
              disabled={!findModule([
                'receivable',
              ])}
              onClick={() =>
                openModule([
                  'receivable',
                ])
              }
              type="button"
            >
              View All Receivables
              <span aria-hidden="true">→</span>
            </button>
          </article>

          <article className="finance-reference-v1__panel finance-reference-v1__panel--payables">
            <header>
              <h2>Upcoming Payables</h2>
            </header>

            <div className="finance-reference-v1__table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Due Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {model.upcomingPayables.map(
                    (payable) => (
                      <tr key={payable.id}>
                        <td>
                          {payable.supplier}
                        </td>
                        <td>
                          {payable.dueDate}
                        </td>
                        <td>
                          {formatMoney(
                            payable.amount,
                          )}
                        </td>
                        <td>
                          {payable.status}
                        </td>
                      </tr>
                    ),
                  )}

                  {model.upcomingPayables.length === 0 && (
                    <EmptyTableRow columns={4} />
                  )}
                </tbody>
              </table>
            </div>

            <button
              className="finance-reference-v1__text-link"
              disabled={!findModule([
                'payable',
              ])}
              onClick={() =>
                openModule([
                  'payable',
                ])
              }
              type="button"
            >
              View All Payables
              <span aria-hidden="true">→</span>
            </button>
          </article>
        </div>

        <div className="finance-reference-v1__utilities">
          <article className="finance-reference-v1__panel">
            <header>
              <h2>Quick Actions</h2>
            </header>

            <div className="finance-reference-v1__quick-actions">
              {QUICK_ACTIONS.map(
                (action) => {
                  const destination =
                    findModule(
                      action.aliases,
                    );

                  return (
                    <button
                      disabled={!destination}
                      key={action.label}
                      onClick={() =>
                        openModule(
                          action.aliases,
                        )
                      }
                      type="button"
                    >
                      <span aria-hidden="true">
                        {action.icon}
                      </span>

                      <small>
                        {action.label}
                      </small>
                    </button>
                  );
                },
              )}
            </div>
          </article>

          <article className="finance-reference-v1__panel">
            <header>
              <h2>Bank Accounts</h2>

              <select
                aria-label="Bank-account period"
                defaultValue="this-month"
              >
                <option value="this-month">
                  This Month
                </option>
              </select>
            </header>

            <div className="finance-reference-v1__bank-accounts">
              {model.bankAccounts.map(
                (account) => (
                  <div key={account.id}>
                    <span>{account.label}</span>

                    <strong>
                      {formatMoney(
                        account.balance,
                      )}
                    </strong>

                    <small>Balance</small>
                  </div>
                ),
              )}
            </div>
          </article>

          <article className="finance-reference-v1__panel">
            <header>
              <h2>Report Shortcuts</h2>
            </header>

            <div className="finance-reference-v1__report-shortcuts">
              {REPORT_SHORTCUTS.map(
                (report) => {
                  const destination =
                    findModule(
                      report.aliases,
                    );

                  return (
                    <button
                      disabled={!destination}
                      key={report.label}
                      onClick={() =>
                        openModule(
                          report.aliases,
                        )
                      }
                      type="button"
                    >
                      <span aria-hidden="true">
                        {report.icon}
                      </span>

                      <small>
                        {report.label}
                      </small>
                    </button>
                  );
                },
              )}
            </div>
          </article>
        </div>

      </div>

      <div
        aria-live="polite"
        className="finance-reference-v1__loading-state"
      >
        {isLoading
          ? 'Refreshing available Finance information…'
          : ''}
      </div>
    </section>
  );
}

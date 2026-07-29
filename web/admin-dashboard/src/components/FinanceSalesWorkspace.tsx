import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  type AccessProfile,
  type PharmaSale,
  getPharmaSales,
} from '../lib/api';
import './FinanceSalesWorkspace.css';

type FinanceSalesWorkspaceProps = {
  token: string;
  profile: AccessProfile;
  onBack: () => void;
  onMainDashboard: () => void;
};

type StatementRow = {
  label: string;
  current: number | null;
  comparison: number | null;
  tone?: 'positive' | 'negative' | 'strong';
  section?: 'sales' | 'deductions' | 'profitability';
};

type TrendBucket = {
  key: string;
  label: string;
  sales: number;
  returns: number;
};

function localIsoDate(
  date: Date,
): string {
  const offset =
    date.getTimezoneOffset();

  return new Date(
    date.getTime()
    - offset * 60_000,
  )
    .toISOString()
    .slice(0, 10);
}

function initialPeriods() {
  const now = new Date();

  return {
    currentFrom: localIsoDate(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ),
    ),
    currentTo: localIsoDate(now),
    comparisonFrom: localIsoDate(
      new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      ),
    ),
    comparisonTo: localIsoDate(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
      ),
    ),
  };
}

function tenantSlugFromProfile(
  profile: AccessProfile,
): string {
  const candidate =
    profile as unknown as {
      tenant_assignments?: Array<{
        tenant?: {
          slug?: string | null;
        } | null;
      }>;
    };

  return (
    candidate
      .tenant_assignments?.[0]
      ?.tenant?.slug
    ?? ''
  );
}

function saleDate(
  sale: PharmaSale,
): string {
  return (
    sale.business_date
    ?? sale.sold_at?.slice(0, 10)
    ?? sale.created_at?.slice(0, 10)
    ?? ''
  );
}

function isReturnOrVoid(
  sale: PharmaSale,
): boolean {
  return /return|refund|void|cancel/i.test(
    String(sale.status ?? ''),
  );
}

function paymentIsValid(
  status: string,
): boolean {
  return !/fail|cancel|void|refund|reject/i.test(
    status,
  );
}

function numberValue(
  value: unknown,
): number {
  const numeric = Number(value);

  return Number.isFinite(numeric)
    ? numeric
    : 0;
}

function money(
  value: number | null,
): string {
  if (value === null) {
    return '—';
  }

  return new Intl.NumberFormat(
    'en-GB',
    {
      style: 'currency',
      currency: 'RWF',
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function count(
  value: number | null,
): string {
  if (value === null) {
    return '—';
  }

  return new Intl.NumberFormat(
    'en-GB',
  ).format(value);
}

function percentage(
  value: number | null,
): string {
  if (value === null) {
    return '—';
  }

  return `${value.toFixed(1)}%`;
}

function percentChange(
  current: number | null,
  comparison: number | null,
): number | null {
  if (
    current === null
    || comparison === null
    || comparison === 0
  ) {
    return null;
  }

  return (
    (current - comparison)
    / Math.abs(comparison)
  ) * 100;
}

function rangeLabel(
  from: string,
  to: string,
): string {
  const format = (
    value: string,
  ) => {
    if (!value) {
      return '—';
    }

    return new Intl.DateTimeFormat(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
    ).format(
      new Date(
        `${value}T00:00:00`,
      ),
    );
  };

  return `${format(from)} – ${format(to)}`;
}

function sumSales(
  sales: PharmaSale[],
): number {
  return sales.reduce(
    (total, sale) =>
      total
      + numberValue(
          sale.total_amount,
        ),
    0,
  );
}

function sumDiscounts(
  sales: PharmaSale[],
): number {
  return sales.reduce(
    (total, sale) =>
      total
      + numberValue(
          sale.discount_amount,
        ),
    0,
  );
}

function amountForTypes(
  sales: PharmaSale[],
  types: string[],
): number {
  return sales
    .filter(
      (sale) =>
        types.includes(
          String(sale.sale_type),
        ),
    )
    .reduce(
      (total, sale) =>
        total
        + numberValue(
            sale.total_amount,
          ),
      0,
    );
}

function buildTrend(
  sales: PharmaSale[],
  currentTo: string,
): TrendBucket[] {
  const end = currentTo
    ? new Date(
        `${currentTo}T00:00:00`,
      )
    : new Date();

  return Array.from(
    {
      length: 6,
    },
    (_, reverseIndex) => {
      const offset =
        reverseIndex - 5;

      const start = new Date(
        end.getFullYear(),
        end.getMonth() + offset,
        1,
      );

      const finish = new Date(
        start.getFullYear(),
        start.getMonth() + 1,
        0,
      );

      const from =
        localIsoDate(start);

      const to =
        localIsoDate(finish);

      const bucketSales =
        sales.filter(
          (sale) => {
            const date =
              saleDate(sale);

            return (
              date >= from
              && date <= to
            );
          },
        );

      return {
        key: from,
        label:
          new Intl.DateTimeFormat(
            'en-GB',
            {
              month: 'short',
              year: '2-digit',
            },
          ).format(start),
        sales:
          sumSales(
            bucketSales.filter(
              (sale) =>
                !isReturnOrVoid(sale),
            ),
          ),
        returns:
          sumSales(
            bucketSales.filter(
              isReturnOrVoid,
            ),
          ),
      };
    },
  );
}

function EmptyChart({
  message,
}: {
  message: string;
}) {
  return (
    <div className="finance-sales-v1__empty-chart">
      <span>{message}</span>
    </div>
  );
}

export function FinanceSalesWorkspace({
  token,
  profile,
  onBack,
  onMainDashboard,
}: FinanceSalesWorkspaceProps) {
  const periods =
    useMemo(
      initialPeriods,
      [],
    );

  const [
    sales,
    setSales,
  ] = useState<PharmaSale[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const [
    currentFrom,
    setCurrentFrom,
  ] = useState(
    periods.currentFrom,
  );

  const [
    currentTo,
    setCurrentTo,
  ] = useState(
    periods.currentTo,
  );

  const [
    comparisonFrom,
    setComparisonFrom,
  ] = useState(
    periods.comparisonFrom,
  );

  const [
    comparisonTo,
    setComparisonTo,
  ] = useState(
    periods.comparisonTo,
  );

  const [
    branchId,
    setBranchId,
  ] = useState('all');

  const [
    filtersOpen,
    setFiltersOpen,
  ] = useState(false);

  const [
    businessDate,
    setBusinessDate,
  ] = useState(
    periods.currentTo,
  );

  const tenantSlug =
    tenantSlugFromProfile(profile);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token || !tenantSlug) {
        setError(
          'A valid tenant and authenticated session are required to load Sales.',
        );

        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const response =
          await getPharmaSales(
            token,
            tenantSlug,
          );

        if (!cancelled) {
          setSales(
            Array.isArray(
              response.sales,
            )
              ? response.sales
              : [],
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError
              instanceof Error
              ? requestError.message
              : 'Unable to load the live Sales register.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    tenantSlug,
  ]);

  const branches =
    useMemo(
      () => {
        const map =
          new Map<
            number,
            string
          >();

        sales.forEach(
          (sale) => {
            if (sale.branch) {
              map.set(
                sale.branch.id,
                sale.branch.name,
              );
            }
          },
        );

        return Array.from(
          map.entries(),
        ).sort(
          (left, right) =>
            left[1].localeCompare(
              right[1],
            ),
        );
      },
      [sales],
    );

  const branchSales =
    useMemo(
      () =>
        sales.filter(
          (sale) =>
            branchId === 'all'
            || String(
              sale.branch?.id ?? '',
            ) === branchId,
        ),
      [
        sales,
        branchId,
      ],
    );

  const currentRecords =
    useMemo(
      () =>
        branchSales.filter(
          (sale) => {
            const date =
              saleDate(sale);

            return (
              date
              && date >= currentFrom
              && date <= currentTo
            );
          },
        ),
      [
        branchSales,
        currentFrom,
        currentTo,
      ],
    );

  const comparisonRecords =
    useMemo(
      () =>
        branchSales.filter(
          (sale) => {
            const date =
              saleDate(sale);

            return (
              date
              && date >= comparisonFrom
              && date <= comparisonTo
            );
          },
        ),
      [
        branchSales,
        comparisonFrom,
        comparisonTo,
      ],
    );

  const currentConfirmed =
    currentRecords.filter(
      (sale) =>
        !isReturnOrVoid(sale),
    );

  const comparisonConfirmed =
    comparisonRecords.filter(
      (sale) =>
        !isReturnOrVoid(sale),
    );

  const currentReturns =
    currentRecords.filter(
      isReturnOrVoid,
    );

  const comparisonReturns =
    comparisonRecords.filter(
      isReturnOrVoid,
    );

  const currentGross =
    sumSales(currentConfirmed);

  const comparisonGross =
    sumSales(comparisonConfirmed);

  const currentReturnAmount =
    sumSales(currentReturns);

  const comparisonReturnAmount =
    sumSales(comparisonReturns);

  const currentDiscounts =
    sumDiscounts(currentConfirmed);

  const comparisonDiscounts =
    sumDiscounts(
      comparisonConfirmed,
    );

  const currentNet =
    Math.max(
      0,
      currentGross
      - currentReturnAmount
      - currentDiscounts,
    );

  const comparisonNet =
    Math.max(
      0,
      comparisonGross
      - comparisonReturnAmount
      - comparisonDiscounts,
    );

  const currentOrders =
    currentConfirmed.length;

  const comparisonOrders =
    comparisonConfirmed.length;

  const currentAverage =
    currentOrders > 0
      ? currentNet
        / currentOrders
      : null;

  const comparisonAverage =
    comparisonOrders > 0
      ? comparisonNet
        / comparisonOrders
      : null;

  const trend =
    useMemo(
      () =>
        buildTrend(
          branchSales,
          currentTo,
        ),
      [
        branchSales,
        currentTo,
      ],
    );

  const trendMaximum =
    Math.max(
      0,
      ...trend.flatMap(
        (bucket) => [
          bucket.sales,
          bucket.returns,
        ],
      ),
    );

  const revenuePoints =
    trend.map(
      (bucket, index) => {
        const x =
          trend.length > 1
            ? 32
              + (
                  index
                  / (
                    trend.length
                    - 1
                  )
                ) * 636
            : 350;

        const y =
          trendMaximum > 0
            ? 218
              - (
                  bucket.sales
                  / trendMaximum
                ) * 170
            : 218;

        return `${x},${y}`;
      },
    ).join(' ');

  const statementRows:
    StatementRow[] = [
      {
        label: 'SALES REVENUE',
        section: 'sales',
        current: null,
        comparison: null,
      },
      {
        label:
          'Cash & Prescription Sales',
        current:
          amountForTypes(
            currentConfirmed,
            [
              'cash_sale',
              'prescription_sale',
            ],
          ),
        comparison:
          amountForTypes(
            comparisonConfirmed,
            [
              'cash_sale',
              'prescription_sale',
            ],
          ),
      },
      {
        label: 'Insurance Sales',
        current:
          amountForTypes(
            currentConfirmed,
            [
              'insurance_sale',
            ],
          ),
        comparison:
          amountForTypes(
            comparisonConfirmed,
            [
              'insurance_sale',
            ],
          ),
      },
      {
        label: 'Credit Sales',
        current:
          amountForTypes(
            currentConfirmed,
            [
              'credit_sale',
            ],
          ),
        comparison:
          amountForTypes(
            comparisonConfirmed,
            [
              'credit_sale',
            ],
          ),
      },
      {
        label: 'Total Sales',
        current: currentGross,
        comparison: comparisonGross,
        tone: 'positive',
      },
      {
        label: 'SALES DEDUCTIONS',
        section: 'deductions',
        current: null,
        comparison: null,
      },
      {
        label: 'Returns / Voids',
        current:
          currentReturnAmount,
        comparison:
          comparisonReturnAmount,
        tone: 'negative',
      },
      {
        label: 'Discounts',
        current:
          currentDiscounts,
        comparison:
          comparisonDiscounts,
        tone: 'negative',
      },
      {
        label: 'Net Sales',
        current: currentNet,
        comparison: comparisonNet,
        tone: 'positive',
      },
      {
        label: 'PROFITABILITY',
        section: 'profitability',
        current: null,
        comparison: null,
      },
      {
        label: 'Cost of Goods Sold',
        current: null,
        comparison: null,
      },
      {
        label: 'Gross Profit',
        current: null,
        comparison: null,
        tone: 'positive',
      },
    ];

  const businessDateSales =
    branchSales.filter(
      (sale) =>
        saleDate(sale)
        === businessDate,
    );

  const paymentDetailsAvailable =
    businessDateSales.some(
      (sale) =>
        Array.isArray(
          sale.payments,
        ),
    );

  const payments =
    businessDateSales.flatMap(
      (sale) =>
        Array.isArray(
          sale.payments,
        )
          ? sale.payments
          : [],
    );

  const channelAmount = (
    matcher: RegExp,
  ): number | null => {
    if (!paymentDetailsAvailable) {
      return null;
    }

    return payments
      .filter(
        (payment) =>
          matcher.test(
            String(
              payment.payment_method
              ?? '',
            ),
          )
          && paymentIsValid(
            String(
              payment.status
              ?? '',
            ),
          ),
      )
      .reduce(
        (total, payment) =>
          total
          + numberValue(
              payment.amount,
            ),
        0,
      );
  };

  const cashSystemAmount =
    channelAmount(
      /^cash$/i,
    );

  const momoSystemAmount =
    channelAmount(
      /momo|mobile.?money/i,
    );

  const metrics = [
    {
      label: 'Total Sales',
      value: money(currentNet),
      change:
        percentChange(
          currentNet,
          comparisonNet,
        ),
      icon: '▣',
    },
    {
      label: 'Orders',
      value: count(currentOrders),
      change:
        percentChange(
          currentOrders,
          comparisonOrders,
        ),
      icon: '🛒',
    },
    {
      label: 'Average Order Value',
      value: money(currentAverage),
      change:
        percentChange(
          currentAverage,
          comparisonAverage,
        ),
      icon: '▥',
    },
    {
      label: 'Gross Profit',
      value: '—',
      change: null,
      icon: '◎',
      helper:
        'Requires posted Cost of Goods Sold.',
    },
  ];

  const salesChange =
    percentChange(
      currentNet,
      comparisonNet,
    );

  function exportCsv() {
    const rows = [
      [
        'Business Date',
        'Sale Number',
        'Branch',
        'Sale Type',
        'Status',
        'Total',
        'Paid',
        'Balance',
      ],
      ...currentRecords.map(
        (sale) => [
          saleDate(sale),
          sale.sale_number,
          sale.branch?.name ?? '',
          sale.sale_type,
          sale.status,
          String(
            numberValue(
              sale.total_amount,
            ),
          ),
          String(
            numberValue(
              sale.paid_amount,
            ),
          ),
          String(
            numberValue(
              sale.balance_amount,
            ),
          ),
        ],
      ),
    ];

    const csv =
      rows.map(
        (row) =>
          row.map(
            (value) =>
              `"${String(value).replaceAll(
                '"',
                '""',
              )}"`,
          ).join(','),
      ).join('\n');

    const blob =
      new Blob(
        [csv],
        {
          type: 'text/csv;charset=utf-8',
        },
      );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement('a');

    anchor.href = url;
    anchor.download =
      `finance-sales-${currentFrom}-${currentTo}.csv`;

    anchor.click();

    URL.revokeObjectURL(url);
  }

  return (
    <section
      className="finance-sales-v1"
      data-finance-workspace="sales"
      data-sales-source="live-pharmaco-sales-register"
      data-reconciliation-posting="blocked-pending-controls"
    >
      <header className="finance-sales-v1__header">
        <div>
          <span>
            Finance · Sales Performance
          </span>

          <h1>Sales</h1>

          <p>
            Track pharmacy sales, revenue trends, returns,
            collections and Business Date payment balances.
          </p>
        </div>

        <div className="finance-sales-v1__header-actions">
          <button
            className="navigation"
            onClick={onBack}
            type="button"
          >
            <span aria-hidden="true">←</span>
            Back to Finance
          </button>

          <button
            className="navigation main-dashboard"
            onClick={onMainDashboard}
            type="button"
          >
            <span aria-hidden="true">⌂</span>
            Main Dashboard
          </button>

          <button
            disabled={
              isLoading
              || currentRecords.length === 0
            }
            onClick={exportCsv}
            type="button"
          >
            <span aria-hidden="true">⇧</span>
            Export
          </button>

          <button
            aria-expanded={filtersOpen}
            className="primary"
            onClick={() =>
              setFiltersOpen(
                (current) => !current,
              )
            }
            type="button"
          >
            <span aria-hidden="true">☷</span>
            Filters
          </button>
        </div>
      </header>

      <div className="finance-sales-v1__period-bar">
        <label>
          <span>Current period</span>

          <div>
            <input
              aria-label="Sales current period start"
              onChange={(event) =>
                setCurrentFrom(
                  event.target.value,
                )
              }
              type="date"
              value={currentFrom}
            />

            <b>to</b>

            <input
              aria-label="Sales current period end"
              onChange={(event) =>
                setCurrentTo(
                  event.target.value,
                )
              }
              type="date"
              value={currentTo}
            />
          </div>
        </label>

        <label>
          <span>Compare with</span>

          <div>
            <input
              aria-label="Sales comparison period start"
              onChange={(event) =>
                setComparisonFrom(
                  event.target.value,
                )
              }
              type="date"
              value={comparisonFrom}
            />

            <b>to</b>

            <input
              aria-label="Sales comparison period end"
              onChange={(event) =>
                setComparisonTo(
                  event.target.value,
                )
              }
              type="date"
              value={comparisonTo}
            />
          </div>
        </label>

        <label>
          <span>View by</span>

          <select disabled value="monthly">
            <option value="monthly">
              Monthly
            </option>
          </select>
        </label>
      </div>

      {filtersOpen && (
        <aside className="finance-sales-v1__filters">
          <label>
            <span>Branch</span>

            <select
              onChange={(event) =>
                setBranchId(
                  event.target.value,
                )
              }
              value={branchId}
            >
              <option value="all">
                All branches
              </option>

              {branches.map(
                ([id, name]) => (
                  <option
                    key={id}
                    value={String(id)}
                  >
                    {name}
                  </option>
                ),
              )}
            </select>
          </label>

          <p>
            Date comparison and branch filtering use the
            authenticated Sales register.
          </p>
        </aside>
      )}

      {error && (
        <div className="finance-sales-v1__message is-error">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="finance-sales-v1__message">
          Loading live Sales information…
        </div>
      )}

      <div className="finance-sales-v1__metrics">
        {metrics.map(
          (metric) => (
            <article
              className="finance-sales-v1__metric"
              key={metric.label}
            >
              <header>
                <span>{metric.label}</span>
                <i aria-hidden="true">
                  {metric.icon}
                </i>
              </header>

              <strong>
                {metric.value}
              </strong>

              <small>
                {metric.helper
                  ?? (
                    metric.change === null
                      ? '— compared with the previous period'
                      : `${metric.change >= 0 ? '↑' : '↓'} ${percentage(Math.abs(metric.change))} compared with the previous period`
                  )}
              </small>
            </article>
          ),
        )}
      </div>

      <div className="finance-sales-v1__charts">
        <article className="finance-sales-v1__panel">
          <header>
            <h2>Sales vs Returns</h2>
          </header>

          <div className="finance-sales-v1__legend">
            <span>
              <i className="sales" />
              Sales
            </span>

            <span>
              <i className="returns" />
              Returns / Voids
            </span>
          </div>

          {trendMaximum <= 0 ? (
            <EmptyChart message="No Sales trend is available for this period." />
          ) : (
            <div className="finance-sales-v1__bar-chart">
              {trend.map(
                (bucket) => (
                  <div
                    className="finance-sales-v1__bar-group"
                    key={bucket.key}
                  >
                    <div className="finance-sales-v1__bars">
                      <i
                        className="sales"
                        style={{
                          height:
                            `${Math.max(
                              2,
                              (
                                bucket.sales
                                / trendMaximum
                              ) * 100,
                            )}%`,
                        }}
                        title={money(bucket.sales)}
                      />

                      <i
                        className="returns"
                        style={{
                          height:
                            `${Math.max(
                              bucket.returns > 0
                                ? 2
                                : 0,
                              (
                                bucket.returns
                                / trendMaximum
                              ) * 100,
                            )}%`,
                        }}
                        title={money(bucket.returns)}
                      />
                    </div>

                    <span>{bucket.label}</span>
                  </div>
                ),
              )}
            </div>
          )}
        </article>

        <article className="finance-sales-v1__panel">
          <header>
            <h2>Revenue Trend</h2>
          </header>

          <div className="finance-sales-v1__legend">
            <span>
              <i className="sales" />
              Net Revenue
            </span>
          </div>

          {trendMaximum <= 0 ? (
            <EmptyChart message="No Revenue trend is available for this period." />
          ) : (
            <div className="finance-sales-v1__line-chart">
              <svg
                aria-label="Revenue trend"
                preserveAspectRatio="none"
                viewBox="0 0 700 250"
              >
                {[48, 90, 132, 174, 216].map(
                  (position) => (
                    <line
                      key={position}
                      x1="28"
                      x2="678"
                      y1={position}
                      y2={position}
                    />
                  ),
                )}

                <polyline
                  points={revenuePoints}
                />

                {revenuePoints
                  .split(' ')
                  .map(
                    (point) => {
                      const [x, y] =
                        point.split(',');

                      return (
                        <circle
                          cx={x}
                          cy={y}
                          key={point}
                          r="4"
                        />
                      );
                    },
                  )}
              </svg>

              <div className="finance-sales-v1__line-labels">
                {trend.map(
                  (bucket) => (
                    <span key={bucket.key}>
                      {bucket.label}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}
        </article>
      </div>

      <article className="finance-sales-v1__panel finance-sales-v1__statement">
        <header>
          <h2>Sales Performance</h2>
        </header>

        <div className="finance-sales-v1__table-scroll">
          <table>
            <thead>
              <tr>
                <th>Particulars</th>
                <th>
                  {rangeLabel(
                    currentFrom,
                    currentTo,
                  )}
                </th>
                <th>
                  {rangeLabel(
                    comparisonFrom,
                    comparisonTo,
                  )}
                </th>
                <th>Change</th>
                <th>Change %</th>
              </tr>
            </thead>

            <tbody>
              {statementRows.map(
                (row) => {
                  if (row.section) {
                    return (
                      <tr
                        className={`finance-sales-v1__section-row finance-sales-v1__section-row--${row.section}`}
                        key={row.label}
                      >
                        <td colSpan={5}>
                          {row.label}
                        </td>
                      </tr>
                    );
                  }

                  const change =
                    row.current !== null
                    && row.comparison !== null
                      ? row.current
                        - row.comparison
                      : null;

                  const changePercent =
                    percentChange(
                      row.current,
                      row.comparison,
                    );

                  return (
                    <tr
                      className={
                        row.tone
                          ? `is-${row.tone}`
                          : undefined
                      }
                      key={row.label}
                    >
                      <td>{row.label}</td>
                      <td>{money(row.current)}</td>
                      <td>{money(row.comparison)}</td>
                      <td>{money(change)}</td>
                      <td>{percentage(changePercent)}</td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="finance-sales-v1__panel finance-sales-v1__reconciliation">
        <header>
          <div>
            <h2>
              Cash &amp; MoMo Business Date Balance
            </h2>

            <p>
              System amounts are read from recorded payments.
              Actual counting, approval and journal posting remain
              disabled until the required maker-checker controls are installed.
            </p>
          </div>

          <label>
            <span>Business Date</span>

            <input
              onChange={(event) =>
                setBusinessDate(
                  event.target.value,
                )
              }
              type="date"
              value={businessDate}
            />
          </label>
        </header>

        <div className="finance-sales-v1__table-scroll">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th>System Record</th>
                <th>Verified Actual</th>
                <th>Variance</th>
                <th>Posting Status</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>Cash</td>
                <td>{money(cashSystemAmount)}</td>
                <td>—</td>
                <td>—</td>
                <td>
                  <span className="is-pending">
                    Approval setup pending
                  </span>
                </td>
              </tr>

              <tr>
                <td>MoMo</td>
                <td>{money(momoSystemAmount)}</td>
                <td>—</td>
                <td>—</td>
                <td>
                  <span className="is-pending">
                    Approval setup pending
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer>
          Original Sales and Payment records remain unchanged.
          Posting will use a separate audited adjustment register.
        </footer>
      </article>

      <aside className="finance-sales-v1__insight">
        <div aria-hidden="true">↗</div>

        <section>
          <strong>Insight</strong>

          <p>
            {salesChange === null
              ? 'A comparative Sales insight will appear when both reporting periods contain Sales records.'
              : `Net Sales ${salesChange >= 0 ? 'increased' : 'decreased'} by ${percentage(Math.abs(salesChange))} compared with the previous period.`}
          </p>
        </section>
      </aside>
    </section>
  );
}

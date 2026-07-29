import {
  useMemo,
  useState,
} from 'react';
import './ProfitLossWorkspace.css';

type ProfitLossWorkspaceProps = {
  onBack: () => void;
  onMainDashboard: () => void;
};

type ProfitLossAmount = number | null;

type ProfitLossStatementRow = {
  label: string;
  section?: 'income' | 'expenses';
  emphasis?: 'positive' | 'negative' | 'strong';
  current: ProfitLossAmount;
  comparison: ProfitLossAmount;
  change: ProfitLossAmount;
  changePercent: number | null;
};

function localIsoDate(
  date: Date,
): string {
  const timezoneOffset =
    date.getTimezoneOffset();

  return new Date(
    date.getTime()
    - timezoneOffset * 60_000,
  )
    .toISOString()
    .slice(0, 10);
}

function currentMonthRange() {
  const now = new Date();

  return {
    from: localIsoDate(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ),
    ),
    to: localIsoDate(now),
  };
}

function previousMonthRange() {
  const now = new Date();

  return {
    from: localIsoDate(
      new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      ),
    ),
    to: localIsoDate(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
      ),
    ),
  };
}

function formatMoney(
  value: ProfitLossAmount,
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

function formatPercent(
  value: number | null,
): string {
  if (value === null) {
    return '—';
  }

  return `${value.toFixed(1)}%`;
}

function readableDate(
  value: string,
): string {
  if (!value) {
    return '—';
  }

  const date = new Date(
    `${value}T00:00:00`,
  );

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(date);
}

function EmptyChart({
  label,
}: {
  label: string;
}) {
  return (
    <div
      aria-label={`${label}: no data available`}
      className="profit-loss-v1__empty-chart"
      data-chart-state="empty"
    >
      <svg
        aria-hidden="true"
        preserveAspectRatio="none"
        viewBox="0 0 720 260"
      >
        {[42, 88, 134, 180, 226].map(
          (position) => (
            <line
              key={`horizontal-${position}`}
              x1="48"
              x2="700"
              y1={position}
              y2={position}
            />
          ),
        )}

        {[48, 178, 308, 438, 568, 700].map(
          (position) => (
            <line
              key={`vertical-${position}`}
              x1={position}
              x2={position}
              y1="28"
              y2="226"
            />
          ),
        )}
      </svg>

      <span>
        No data available for the selected period
      </span>
    </div>
  );
}

const EMPTY_STATEMENT: ProfitLossStatementRow[] = [
  {
    label: 'INCOME',
    section: 'income',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Sales Revenue',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Other Income',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Total Income',
    emphasis: 'positive',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'EXPENSES',
    section: 'expenses',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Cost of Goods Sold',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Employee Expenses',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Rent & Utilities',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Marketing Expenses',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Administrative Expenses',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Depreciation',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Total Expenses',
    emphasis: 'negative',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Net Profit',
    emphasis: 'positive',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Profit Margin',
    emphasis: 'positive',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
];

export function ProfitLossWorkspace({
  onBack,
  onMainDashboard,
}: ProfitLossWorkspaceProps) {
  const initialCurrent =
    useMemo(
      currentMonthRange,
      [],
    );

  const initialComparison =
    useMemo(
      previousMonthRange,
      [],
    );

  const [
    currentFrom,
    setCurrentFrom,
  ] = useState(
    initialCurrent.from,
  );

  const [
    currentTo,
    setCurrentTo,
  ] = useState(
    initialCurrent.to,
  );

  const [
    comparisonFrom,
    setComparisonFrom,
  ] = useState(
    initialComparison.from,
  );

  const [
    comparisonTo,
    setComparisonTo,
  ] = useState(
    initialComparison.to,
  );

  const [
    viewBy,
    setViewBy,
  ] = useState('monthly');

  const [
    filtersOpen,
    setFiltersOpen,
  ] = useState(false);

  const currentPeriodLabel =
    `${readableDate(currentFrom)} – ${readableDate(currentTo)}`;

  const comparisonPeriodLabel =
    `${readableDate(comparisonFrom)} – ${readableDate(comparisonTo)}`;

  const metrics = [
    {
      label: 'Total Income',
      value: null,
      comparison: null,
      icon: '↗',
      tone: 'green',
    },
    {
      label: 'Total Expenses',
      value: null,
      comparison: null,
      icon: '◷',
      tone: 'red',
    },
    {
      label: 'Net Profit',
      value: null,
      comparison: null,
      icon: '◉',
      tone: 'green',
    },
    {
      label: 'Profit Margin',
      value: null,
      comparison: null,
      icon: '%',
      tone: 'blue',
      percentage: true,
    },
  ] as const;

  return (
    <section
      className="profit-loss-v1"
      data-finance-workspace="profit-loss"
      data-profit-loss-source="backend-contract-pending"
      data-empty-policy="no-fabricated-values"
    >
      <header className="profit-loss-v1__header">
        <div>
          <span>
            Finance · Financial Statements
          </span>

          <h1>Profit &amp; Loss</h1>

          <p>
            View your business profitability and performance summary.
          </p>
        </div>

        <div className="profit-loss-v1__header-actions">
          <button
            className="navigation"
            onClick={onBack}
            title="Return to the Finance Overview"
            type="button"
          >
            <span aria-hidden="true">←</span>
            Back to Finance
          </button>

          <button
            className="navigation main-dashboard"
            onClick={onMainDashboard}
            title="Open the Main Dashboard"
            type="button"
          >
            <span aria-hidden="true">⌂</span>
            Main Dashboard
          </button>

          <button
            disabled
            title="Export becomes available when Profit and Loss data is available."
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

      <div className="profit-loss-v1__period-bar">
        <label>
          <span>Current period</span>

          <div>
            <input
              aria-label="Current period start date"
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
              aria-label="Current period end date"
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
              aria-label="Comparison period start date"
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
              aria-label="Comparison period end date"
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

        <label className="profit-loss-v1__view-by">
          <span>View by</span>

          <select
            onChange={(event) =>
              setViewBy(
                event.target.value,
              )
            }
            value={viewBy}
          >
            <option value="monthly">
              Monthly
            </option>
            <option value="weekly">
              Weekly
            </option>
            <option value="quarterly">
              Quarterly
            </option>
            <option value="yearly">
              Yearly
            </option>
          </select>
        </label>
      </div>

      {filtersOpen && (
        <aside className="profit-loss-v1__filter-note">
          <strong>
            Profit &amp; Loss filters
          </strong>

          <span>
            Date comparison and reporting frequency are active. Branch,
            department and account filters will be connected when their
            backend contract is available.
          </span>
        </aside>
      )}

      <div className="profit-loss-v1__metrics">
        {metrics.map((metric) => (
          <article
            className="profit-loss-v1__metric"
            key={metric.label}
          >
            <header>
              <span>{metric.label}</span>

              <i
                aria-hidden="true"
                className={`profit-loss-v1__metric-icon profit-loss-v1__metric-icon--${metric.tone}`}
              >
                {metric.icon}
              </i>
            </header>

            <strong>
              {metric.percentage
                ? formatPercent(
                    metric.value,
                  )
                : formatMoney(
                    metric.value,
                  )}
            </strong>

            <small>
              — compared with the previous period
            </small>
          </article>
        ))}
      </div>

      <div className="profit-loss-v1__charts">
        <article className="profit-loss-v1__panel">
          <header>
            <h2>
              Income vs Expenses
            </h2>
          </header>

          <div className="profit-loss-v1__legend">
            <span>
              <i className="green" />
              Income
            </span>

            <span>
              <i className="red" />
              Expenses
            </span>
          </div>

          <EmptyChart label="Income versus expenses" />
        </article>

        <article className="profit-loss-v1__panel">
          <header>
            <h2>
              Net Profit Trend
            </h2>
          </header>

          <div className="profit-loss-v1__legend">
            <span>
              <i className="green" />
              Net Profit
            </span>
          </div>

          <EmptyChart label="Net profit trend" />
        </article>
      </div>

      <article className="profit-loss-v1__panel profit-loss-v1__statement">
        <header>
          <h2>
            Profit &amp; Loss Statement
          </h2>
        </header>

        <div className="profit-loss-v1__table-scroll">
          <table>
            <thead>
              <tr>
                <th>Particulars</th>
                <th>{currentPeriodLabel}</th>
                <th>{comparisonPeriodLabel}</th>
                <th>Change</th>
                <th>Change %</th>
              </tr>
            </thead>

            <tbody>
              {EMPTY_STATEMENT.map(
                (row) => {
                  if (row.section) {
                    return (
                      <tr
                        className={`profit-loss-v1__section-row profit-loss-v1__section-row--${row.section}`}
                        key={row.label}
                      >
                        <td colSpan={5}>
                          {row.label}
                        </td>
                      </tr>
                    );
                  }

                  const className =
                    row.emphasis
                      ? `profit-loss-v1__statement-row profit-loss-v1__statement-row--${row.emphasis}`
                      : 'profit-loss-v1__statement-row';

                  const isMargin =
                    row.label === 'Profit Margin';

                  return (
                    <tr
                      className={className}
                      key={row.label}
                    >
                      <td>{row.label}</td>

                      <td>
                        {isMargin
                          ? formatPercent(
                              row.current,
                            )
                          : formatMoney(
                              row.current,
                            )}
                      </td>

                      <td>
                        {isMargin
                          ? formatPercent(
                              row.comparison,
                            )
                          : formatMoney(
                              row.comparison,
                            )}
                      </td>

                      <td>
                        {isMargin
                          ? formatPercent(
                              row.change,
                            )
                          : formatMoney(
                              row.change,
                            )}
                      </td>

                      <td>
                        {formatPercent(
                          row.changePercent,
                        )}
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      </article>

      <aside className="profit-loss-v1__insight">
        <div aria-hidden="true">↗</div>

        <section>
          <strong>Insight</strong>

          <p>
            Profit and Loss insight will appear when both the current and
            comparison periods contain complete income and expense data.
          </p>
        </section>
      </aside>
    </section>
  );
}

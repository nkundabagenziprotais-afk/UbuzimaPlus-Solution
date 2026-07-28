import {
  useMemo,
  useState,
} from 'react';
import './CashFlowWorkspace.css';

type CashFlowWorkspaceProps = {
  onBack: () => void;
  onMainDashboard: () => void;
};

type CashFlowAmount = number | null;

type CashFlowStatementRow = {
  label: string;
  section?: 'operating' | 'investing' | 'financing';
  emphasis?: 'positive' | 'negative' | 'strong';
  current: CashFlowAmount;
  comparison: CashFlowAmount;
  change: CashFlowAmount;
  changePercent: number | null;
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
  value: CashFlowAmount,
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
}

function EmptyChart({
  label,
}: {
  label: string;
}) {
  return (
    <div
      aria-label={`${label}: no data available`}
      className="cash-flow-v1__empty-chart"
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

const EMPTY_STATEMENT: CashFlowStatementRow[] = [
  {
    label: 'OPERATING ACTIVITIES',
    section: 'operating',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Cash Received from Customers',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Cash Paid to Suppliers & Vendors',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Cash Paid to Employees',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Other Operating Cash Outflows',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Net Cash from Operating Activities',
    emphasis: 'positive',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'INVESTING ACTIVITIES',
    section: 'investing',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Purchase of Equipment',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Proceeds from Sale of Assets',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Net Cash from Investing Activities',
    emphasis: 'negative',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'FINANCING ACTIVITIES',
    section: 'financing',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Proceeds from Loans',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Loan Repayments',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Net Cash from Financing Activities',
    emphasis: 'positive',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Total Cash Inflows',
    emphasis: 'positive',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Total Cash Outflows',
    emphasis: 'negative',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Net Cash Flow',
    emphasis: 'positive',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Opening Balance',
    emphasis: 'strong',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
  {
    label: 'Closing Balance',
    emphasis: 'positive',
    current: null,
    comparison: null,
    change: null,
    changePercent: null,
  },
];

export function CashFlowWorkspace({
  onBack,
  onMainDashboard,
}: CashFlowWorkspaceProps) {
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

  const metrics = [
    {
      label: 'Cash Inflow',
      value: null,
      icon: '↓',
      tone: 'green',
    },
    {
      label: 'Cash Outflow',
      value: null,
      icon: '↑',
      tone: 'red',
    },
    {
      label: 'Net Cash Flow',
      value: null,
      icon: '⌁',
      tone: 'green',
    },
    {
      label: 'Closing Balance',
      value: null,
      icon: '▣',
      tone: 'green',
    },
  ];

  const currentPeriodLabel =
    `${readableDate(currentFrom)} – ${readableDate(currentTo)}`;

  const comparisonPeriodLabel =
    `${readableDate(comparisonFrom)} – ${readableDate(comparisonTo)}`;

  return (
    <section
      className="cash-flow-v1"
      data-finance-workspace="cash-flow"
      data-cash-flow-source="backend-contract-pending"
      data-empty-policy="no-fabricated-values"
    >
      <header className="cash-flow-v1__header">
        <div>
          <span>
            Finance · Financial Statements
          </span>

          <h1>Cash Flow</h1>

          <p>
            Track money moving in and out of your business.
          </p>
        </div>

        <div className="cash-flow-v1__header-actions">
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
            title="Export becomes available when Cash Flow data is available."
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

      <div className="cash-flow-v1__period-bar">
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

        <label className="cash-flow-v1__view-by">
          <span>View by</span>

          <select
            onChange={(event) =>
              setViewBy(
                event.target.value,
              )
            }
            value={viewBy}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>
      </div>

      {filtersOpen && (
        <aside className="cash-flow-v1__filter-note">
          <strong>Cash Flow filters</strong>

          <span>
            Date comparison and reporting frequency are active. Account,
            payment-channel, branch and cash-activity filters will use
            verified backend contracts when connected.
          </span>
        </aside>
      )}

      <div className="cash-flow-v1__metrics">
        {metrics.map((metric) => (
          <article
            className="cash-flow-v1__metric"
            key={metric.label}
          >
            <header>
              <span>{metric.label}</span>

              <i
                aria-hidden="true"
                className={`cash-flow-v1__metric-icon cash-flow-v1__metric-icon--${metric.tone}`}
              >
                {metric.icon}
              </i>
            </header>

            <strong>
              {formatMoney(metric.value)}
            </strong>

            <small>
              — compared with the previous period
            </small>
          </article>
        ))}
      </div>

      <div className="cash-flow-v1__charts">
        <article className="cash-flow-v1__panel">
          <header>
            <h2>Cash Inflow vs Cash Outflow</h2>
          </header>

          <div className="cash-flow-v1__legend">
            <span>
              <i className="green" />
              Inflow
            </span>

            <span>
              <i className="red" />
              Outflow
            </span>
          </div>

          <EmptyChart label="Cash inflow versus cash outflow" />
        </article>

        <article className="cash-flow-v1__panel">
          <header>
            <h2>Net Cash Flow Trend</h2>
          </header>

          <div className="cash-flow-v1__legend">
            <span>
              <i className="green" />
              Net Cash Flow
            </span>
          </div>

          <EmptyChart label="Net cash flow trend" />
        </article>
      </div>

      <article className="cash-flow-v1__panel cash-flow-v1__statement">
        <header>
          <h2>Cash Flow Statement</h2>
        </header>

        <div className="cash-flow-v1__table-scroll">
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
                        className={`cash-flow-v1__section-row cash-flow-v1__section-row--${row.section}`}
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
                      ? `cash-flow-v1__statement-row cash-flow-v1__statement-row--${row.emphasis}`
                      : 'cash-flow-v1__statement-row';

                  return (
                    <tr
                      className={className}
                      key={row.label}
                    >
                      <td>{row.label}</td>
                      <td>{formatMoney(row.current)}</td>
                      <td>{formatMoney(row.comparison)}</td>
                      <td>{formatMoney(row.change)}</td>
                      <td>{formatPercent(row.changePercent)}</td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      </article>

      <aside className="cash-flow-v1__insight">
        <div aria-hidden="true">↗</div>

        <section>
          <strong>Insight</strong>

          <p>
            Cash Flow insight will appear after complete inflow, outflow,
            opening-balance and closing-balance information is available
            for both reporting periods.
          </p>
        </section>
      </aside>
    </section>
  );
}

import type { ComponentProps } from 'react';
import type { FinanceSourceOfTruthOverview as LegacyFinanceSourceOfTruthOverview } from './FinanceSourceOfTruthOverview';

type FinanceOverviewRedesignProps =
  ComponentProps<typeof LegacyFinanceSourceOfTruthOverview>;

const FINANCE_NAVIGATION = [
  'Overview',
  'Profit & Loss',
  'Cash Flow',
  'Sales & Revenue',
  'Receivables',
  'Payables',
  'Expenses',
  'Inventory Finance',
  'Banking & Cash',
  'Tax Registry',
  'Reports',
  'Accounting',
] as const;

const FINANCE_METRICS = [
  {
    label: 'Total Revenue',
    source: 'POS revenue source',
    icon: 'TR',
    tone: 'green',
  },
  {
    label: 'Gross Margin',
    source: 'Sales and inventory cost',
    icon: 'GM',
    tone: 'green',
  },
  {
    label: 'Total Expenses',
    source: 'Expense ledger',
    icon: 'EX',
    tone: 'red',
  },
  {
    label: 'Net Profit',
    source: 'Finance reconciliation',
    icon: 'NP',
    tone: 'green',
  },
  {
    label: 'Cash in Hand',
    source: 'Cash collection source',
    icon: 'CH',
    tone: 'blue',
  },
  {
    label: 'Insurance Receivables',
    source: 'Claims and receivables',
    icon: 'IR',
    tone: 'amber',
  },
  {
    label: 'Accounts Payable',
    source: 'Supplier obligations',
    icon: 'AP',
    tone: 'red',
  },
  {
    label: 'Inventory Value',
    source: 'Inventory valuation',
    icon: 'IV',
    tone: 'blue',
  },
] as const;

const PROFIT_AND_LOSS_ROWS = [
  'Gross Revenue',
  'Cost of Goods Sold',
  'Gross Profit',
  'Operating Expenses',
  'Net Profit',
] as const;

const QUICK_ACTIONS = [
  {
    label: 'Record Expense',
    description: 'Capture an approved operating expense.',
    icon: 'RE',
  },
  {
    label: 'Add Payment',
    description: 'Record a verified incoming payment.',
    icon: 'AP',
  },
  {
    label: 'Create Invoice',
    description: 'Prepare an authorised customer invoice.',
    icon: 'CI',
  },
  {
    label: 'Reconcile Bank',
    description: 'Review bank and system balances.',
    icon: 'RB',
  },
] as const;

const REPORT_SHORTCUTS = [
  'Profit & Loss Statement',
  'Cash Flow Statement',
  'Accounts Receivable Ageing',
  'Accounts Payable Ageing',
] as const;

function FinanceEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="finance-overview__empty-state">
      <span aria-hidden="true">—</span>

      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

export function FinanceOverviewRedesign(
  props: FinanceOverviewRedesignProps,
) {
  void props;

  return (
    <section
      className="finance-overview"
      data-finance-approved-overview="active"
    >
      <header className="finance-overview__header">
        <div className="finance-overview__heading">
          <span className="finance-overview__eyebrow">
            Finance workspace
          </span>

          <h1>Finance Overview</h1>

          <p>
            Real-time financial performance and operational
            visibility for Ubuzima Plus.
          </p>
        </div>

        <div
          className="finance-overview__filters"
          aria-label="Finance overview filters"
        >
          <label className="finance-overview__filter">
            <span>Date range</span>

            <select
              disabled
              aria-label="Finance date range"
            >
              <option>Current reporting period</option>
            </select>
          </label>

          <label className="finance-overview__filter">
            <span>Branch</span>

            <select
              disabled
              aria-label="Finance branch"
            >
              <option>Current authorised branch</option>
            </select>
          </label>

          <button
            type="button"
            className="finance-overview__refresh"
            disabled
          >
            Refresh
          </button>
        </div>
      </header>

      <nav
        className="finance-overview__navigation"
        aria-label="Finance workspace sections"
      >
        {FINANCE_NAVIGATION.map((item) => (
          <button
            key={item}
            type="button"
            className={
              item === 'Overview'
                ? 'finance-overview__nav-item is-active'
                : 'finance-overview__nav-item'
            }
            aria-current={
              item === 'Overview'
                ? 'page'
                : undefined
            }
            disabled={item !== 'Overview'}
          >
            {item}

            {item !== 'Overview' && (
              <small>Planned</small>
            )}
          </button>
        ))}
      </nav>

      <aside className="finance-overview__status-strip">
        <div>
          <span>Operating mode</span>
          <strong>Finance shadow</strong>
        </div>

        <div>
          <span>Data policy</span>
          <strong>Verified sources only</strong>
        </div>

        <div>
          <span>Tax Registry</span>
          <strong>Read-only review</strong>
        </div>

        <div>
          <span>Automatic exemption</span>
          <strong>No</strong>
        </div>
      </aside>

      <div className="finance-overview__metric-grid">
        {FINANCE_METRICS.map((metric) => (
          <article
            key={metric.label}
            className={
              `finance-overview__metric-card is-${metric.tone}`
            }
          >
            <div className="finance-overview__metric-top">
              <span
                className="finance-overview__metric-icon"
                aria-hidden="true"
              >
                {metric.icon}
              </span>

              <small>Awaiting source</small>
            </div>

            <span className="finance-overview__metric-label">
              {metric.label}
            </span>

            <strong className="finance-overview__metric-value">
              —
            </strong>

            <footer>
              <span>{metric.source}</span>
              <b>Not connected</b>
            </footer>
          </article>
        ))}
      </div>

      <div className="finance-overview__analytics-grid">
        <article className="finance-overview__panel">
          <header className="finance-overview__panel-header">
            <div>
              <h2>Revenue vs Expenses</h2>
              <p>
                Monthly comparison from verified Finance sources.
              </p>
            </div>

            <span className="finance-overview__panel-status">
              Awaiting series
            </span>
          </header>

          <div className="finance-overview__chart">
            <div
              className="finance-overview__chart-grid"
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
              <span />
            </div>

            <FinanceEmptyState
              title="No verified monthly series"
              description="Revenue and expense trends will appear after the reporting-period source is connected."
            />
          </div>
        </article>

        <article className="finance-overview__panel">
          <header className="finance-overview__panel-header">
            <div>
              <h2>Cash Flow Overview</h2>
              <p>
                Inflows and outflows for the selected period.
              </p>
            </div>

            <span className="finance-overview__panel-status">
              Awaiting series
            </span>
          </header>

          <div className="finance-overview__chart">
            <div
              className="finance-overview__chart-grid"
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
              <span />
            </div>

            <FinanceEmptyState
              title="Cash-flow series unavailable"
              description="Verified cash, bank and Mobile Money movements have not yet been connected to this view."
            />
          </div>
        </article>

        <article className="finance-overview__panel">
          <header className="finance-overview__panel-header">
            <div>
              <h2>Profit & Loss Summary</h2>
              <p>
                Reporting-period readiness summary.
              </p>
            </div>
          </header>

          <div className="finance-overview__summary-list">
            {PROFIT_AND_LOSS_ROWS.map((row) => (
              <div key={row}>
                <span>{row}</span>
                <strong>—</strong>
              </div>
            ))}
          </div>

          <footer className="finance-overview__panel-note">
            Values remain hidden until all required sources are
            verified.
          </footer>
        </article>

        <article className="finance-overview__panel">
          <header className="finance-overview__panel-header">
            <div>
              <h2>Expense Breakdown</h2>
              <p>
                Approved expenses grouped by business category.
              </p>
            </div>
          </header>

          <div className="finance-overview__expense-empty">
            <div
              className="finance-overview__empty-ring"
              aria-hidden="true"
            >
              <span>—</span>
            </div>

            <FinanceEmptyState
              title="No verified expense categories"
              description="The breakdown will display after the expense ledger is connected."
            />
          </div>
        </article>
      </div>

      <div className="finance-overview__operations-grid">
        <article className="finance-overview__panel">
          <header className="finance-overview__panel-header">
            <div>
              <h2>Recent Transactions</h2>
              <p>
                Latest verified financial movements.
              </p>
            </div>

            <button type="button" disabled>
              View all
            </button>
          </header>

          <div
            className="finance-overview__table-region"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Account</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                <tr className="finance-overview__empty-row">
                  <td colSpan={6}>
                    No verified transaction feed is connected.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article className="finance-overview__panel">
          <header className="finance-overview__panel-header">
            <div>
              <h2>Top Receivables</h2>
              <p>
                Outstanding customer and insurance balances.
              </p>
            </div>
          </header>

          <div
            className="finance-overview__table-region"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Due</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                <tr className="finance-overview__empty-row">
                  <td colSpan={4}>
                    Receivables data is not yet connected.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article className="finance-overview__panel">
          <header className="finance-overview__panel-header">
            <div>
              <h2>Upcoming Payables</h2>
              <p>
                Supplier obligations requiring attention.
              </p>
            </div>
          </header>

          <div
            className="finance-overview__table-region"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Due</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                <tr className="finance-overview__empty-row">
                  <td colSpan={4}>
                    Payables data is not yet connected.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <div className="finance-overview__bottom-grid">
        <article className="finance-overview__panel">
          <header className="finance-overview__panel-header">
            <div>
              <h2>Quick Actions</h2>
              <p>
                Finance actions will require permissions and
                approval.
              </p>
            </div>
          </header>

          <div className="finance-overview__action-grid">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled
              >
                <span aria-hidden="true">
                  {action.icon}
                </span>

                <div>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="finance-overview__panel">
          <header className="finance-overview__panel-header">
            <div>
              <h2>Bank & Cash Accounts</h2>
              <p>
                Verified account balances and reconciliation.
              </p>
            </div>
          </header>

          <div className="finance-overview__account-list">
            <div>
              <span className="is-bank">BA</span>

              <div>
                <strong>Bank account</strong>
                <small>Connection pending</small>
              </div>

              <b>—</b>
            </div>

            <div>
              <span className="is-mobile">MM</span>

              <div>
                <strong>Mobile Money</strong>
                <small>Connection pending</small>
              </div>

              <b>—</b>
            </div>

            <div>
              <span className="is-cash">CS</span>

              <div>
                <strong>Cash account</strong>
                <small>Reconciliation pending</small>
              </div>

              <b>—</b>
            </div>
          </div>
        </article>

        <article className="finance-overview__panel">
          <header className="finance-overview__panel-header">
            <div>
              <h2>Report Shortcuts</h2>
              <p>
                Reports will use verified reporting data.
              </p>
            </div>
          </header>

          <div className="finance-overview__report-list">
            {REPORT_SHORTCUTS.map((report) => (
              <button
                key={report}
                type="button"
                disabled
              >
                <span>{report}</span>
                <b aria-hidden="true">›</b>
              </button>
            ))}
          </div>
        </article>
      </div>

      <footer className="finance-overview__compliance">
        <div>
          <strong>Finance remains in shadow mode</strong>
          <p>
            This interface does not automatically approve
            accounting, tax-exemption or product tax-assignment
            decisions.
          </p>
        </div>

        <span>Human review remains mandatory</span>
      </footer>
    </section>
  );
}

export default FinanceOverviewRedesign;

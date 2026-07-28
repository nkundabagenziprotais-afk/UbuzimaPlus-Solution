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

export function FinanceOverviewRedesign(
  props: FinanceOverviewRedesignProps,
) {
  void props;

  return (
    <section
      className="finance-redesign"
      data-finance-design-reset="active"
    >
      <header className="finance-redesign__header">
        <div className="finance-redesign__heading">
          <span className="finance-redesign__eyebrow">
            Finance workspace
          </span>

          <h1>Finance Overview</h1>

          <p>
            Real-time financial performance, reconciliation,
            receivables, payables and compliance visibility for
            Ubuzima Plus.
          </p>
        </div>

        <div
          className="finance-redesign__controls"
          aria-label="Finance review controls"
        >
          <div className="finance-redesign__control">
            <small>Date range</small>
            <strong>Awaiting live period integration</strong>
          </div>

          <div className="finance-redesign__control">
            <small>Branch</small>
            <strong>Current authorised branch</strong>
          </div>
        </div>
      </header>

      <nav
        className="finance-redesign__navigation"
        aria-label="Finance sections"
      >
        {FINANCE_NAVIGATION.map((item) => (
          <button
            key={item}
            type="button"
            className={
              item === 'Overview'
                ? 'finance-redesign__nav-button is-active'
                : 'finance-redesign__nav-button'
            }
            aria-current={
              item === 'Overview' ? 'page' : undefined
            }
            disabled={item !== 'Overview'}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="finance-redesign__guardrails">
        <article>
          <span>Design foundation</span>
          <strong>Approved visual direction</strong>
          <small>
            The previous Finance dashboard is no longer active.
          </small>
        </article>

        <article>
          <span>Operating mode</span>
          <strong>Finance shadow</strong>
          <small>
            No production accounting decisions are automated.
          </small>
        </article>

        <article>
          <span>Data integrity</span>
          <strong>No invented values</strong>
          <small>
            Financial cards appear only when verified data exists.
          </small>
        </article>

        <article>
          <span>Tax evidence</span>
          <strong>Human review required</strong>
          <small>
            Tax Registry remains read-only with no automatic
            exemption.
          </small>
        </article>
      </div>

      <main className="finance-redesign__canvas">
        <article className="finance-redesign__welcome">
          <div className="finance-redesign__welcome-mark">
            FP
          </div>

          <div>
            <span className="finance-redesign__eyebrow">
              Redesign foundation ready
            </span>

            <h2>
              The Finance workspace is ready for the approved
              Ubuzima Plus design.
            </h2>

            <p>
              KPI cards, charts, receivables, payables, bank
              balances and report shortcuts will now be introduced
              using verified Finance, POS and Inventory data.
            </p>
          </div>
        </article>

        <div className="finance-redesign__foundation-grid">
          <article className="finance-redesign__foundation-card">
            <span>Overview foundation</span>
            <h3>Business-first financial visibility</h3>
            <p>
              Revenue, gross margin, expenses, net profit, cash,
              insurance receivables, payables and inventory value
              will follow the approved reference.
            </p>
          </article>

          <article className="finance-redesign__foundation-card">
            <span>Operational patterns</span>
            <h3>Borrowed from POS and Inventory</h3>
            <p>
              Compact controls, clear statuses, responsive tables,
              review queues and practical empty states will remain
              consistent across Ubuzima Plus.
            </p>
          </article>

          <article className="finance-redesign__foundation-card">
            <span>Implementation rule</span>
            <h3>Real data before visual metrics</h3>
            <p>
              Missing financial information will use honest
              readiness states rather than fabricated statistics.
            </p>
          </article>
        </div>
      </main>
    </section>
  );
}

export default FinanceOverviewRedesign;

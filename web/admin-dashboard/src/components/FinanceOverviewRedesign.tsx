import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
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

function tenantSlugFromProfile(profile: any): string {
  return (
    profile?.tenant_assignments?.[0]?.tenant?.slug
    || profile?.tenant?.slug
    || profile?.scope?.tenant_slug
    || ''
  );
}

function isoDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return date.toISOString().slice(0, 10);
}

function money(value: unknown): string {
  if (
    value === null
    || value === undefined
    || value === ''
  ) {
    return '—';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '—';
  }

  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(number);
}

function numberValue(value: unknown): string {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '—';
  }

  return new Intl.NumberFormat('en-GB').format(number);
}

function readable(value: unknown): string {
  if (
    value === null
    || value === undefined
    || String(value).trim() === ''
  ) {
    return 'Not available';
  }

  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function statusTone(value: unknown): string {
  const status = String(value ?? '').toLowerCase();

  if (
    status.includes('pass')
    || status.includes('ready')
    || status.includes('reconciled')
    || status.includes('healthy')
  ) {
    return 'positive';
  }

  if (
    status.includes('fail')
    || status.includes('blocked')
    || status.includes('critical')
    || status.includes('unreconciled')
  ) {
    return 'negative';
  }

  return 'review';
}

export function FinanceOverviewRedesign({
  token,
  profile,
  financeModules = [],
  onOpenFinanceModule,
}: FinanceOverviewRedesignProps) {
  const tenantSlug = tenantSlugFromProfile(profile);

  const [from, setFrom] = useState(() => isoDate(30));
  const [to, setTo] = useState(() => isoDate(0));
  const [branchId, setBranchId] = useState('');

  const [revenue, setRevenue] =
    useState<PharmaFinancePosRevenueShadowReport | null>(null);

  const [payments, setPayments] =
    useState<PharmaFinancePosShadowReconciliationReport | null>(null);

  const [health, setHealth] =
    useState<PharmaFinanceReadinessHealthReport | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const requestSequence = useRef(0);
  const moduleNavigationPending = useRef(false);

  const loadDashboard = useCallback(async () => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;

    if (!tenantSlug) {
      setError(
        'A tenant assignment is required before Finance data can be loaded.',
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    const filters = {
      from,
      to,
      branch_id: branchId || undefined,
    };

    try {
      const [
        revenueResponse,
        paymentResponse,
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

      if (requestSequence.current !== sequence) {
        return;
      }

      setRevenue(revenueResponse.data);
      setPayments(paymentResponse.data);
      setHealth(healthResponse.data);
    } catch (reason) {
      if (requestSequence.current !== sequence) {
        return;
      }

      setRevenue(null);
      setPayments(null);
      setHealth(null);

      setError(
        reason instanceof Error
          ? reason.message
          : 'Finance data could not be loaded.',
      );
    } finally {
      if (requestSequence.current === sequence) {
        setIsLoading(false);
      }
    }
  }, [
    branchId,
    from,
    tenantSlug,
    to,
    token,
  ]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = useMemo(
    () => [
      {
        label: 'Operational Payments',
        value: money(
          revenue?.summary
            ?.operational_completed_payment_total,
        ),
        note: 'Completed POS payments',
        tone: 'blue',
      },
      {
        label: 'Finance Shadow Payments',
        value: money(
          payments?.summary
            ?.finance_shadow_payment_total,
        ),
        note: 'Finance shadow ledger',
        tone: 'green',
      },
      {
        label: 'Shadow Revenue',
        value: money(
          revenue?.summary?.finance_shadow_revenue,
        ),
        note: 'Recognised revenue shadow',
        tone: 'green',
      },
      {
        label: 'Shadow Tax',
        value: money(
          revenue?.summary?.finance_shadow_tax,
        ),
        note: 'Read-only tax shadow',
        tone: 'amber',
      },
      {
        label: 'Payment Variance',
        value: money(
          payments?.summary?.difference,
        ),
        note: payments?.summary?.is_reconciled
          ? 'Reconciled'
          : 'Requires review',
        tone: payments?.summary?.is_reconciled
          ? 'green'
          : 'red',
      },
      {
        label: 'Readiness Checks',
        value: health
          ? `${numberValue(
              health.summary?.checks_passed,
            )} / ${numberValue(
              health.summary?.checks_total,
            )}`
          : '—',
        note: readable(health?.overall_status),
        tone:
          statusTone(health?.overall_status) === 'positive'
            ? 'green'
            : 'amber',
      },
    ],
    [
      health,
      payments,
      revenue,
    ],
  );

  const healthChecks = useMemo(
    () => Object.entries(health?.checks ?? {}),
    [health],
  );

  const submitFilters = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    void loadDashboard();
  };

  const openFinanceModule = (key: string) => {
    if (
      moduleNavigationPending.current
      || !onOpenFinanceModule
    ) {
      return;
    }

    moduleNavigationPending.current = true;
    onOpenFinanceModule(key);

    window.requestAnimationFrame(() => {
      moduleNavigationPending.current = false;
    });
  };

  return (
    <section
      className="finance-live-v7c"
      data-finance-redesign="live-v7c"
      data-finance-source="three-production-reports"
    >
      <header className="finance-live-v7c__hero">
        <div>
          <span>Finance and control</span>
          <h1>Finance Overview</h1>
          <p>
            Live payment, revenue-shadow, reconciliation and
            readiness signals from authenticated production
            Finance reports.
          </p>
        </div>

        <aside
          className={`finance-live-v7c__status finance-live-v7c__status--${
            statusTone(health?.overall_status)
          }`}
        >
          <strong>
            {isLoading
              ? 'Loading Finance data'
              : readable(health?.overall_status)}
          </strong>
          <small>
            Finance shadow · read-only reporting
          </small>
        </aside>
      </header>

      <form
        className="finance-live-v7c__filters"
        onSubmit={submitFilters}
      >
        <label>
          <span>From</span>
          <input
            type="date"
            value={from}
            onChange={(event) =>
              setFrom(event.target.value)
            }
          />
        </label>

        <label>
          <span>To</span>
          <input
            type="date"
            value={to}
            onChange={(event) =>
              setTo(event.target.value)
            }
          />
        </label>

        <label>
          <span>Branch ID</span>
          <input
            inputMode="numeric"
            placeholder="All branches"
            value={branchId}
            onChange={(event) =>
              setBranchId(event.target.value)
            }
          />
        </label>

        <button
          type="submit"
          disabled={isLoading}
        >
          {isLoading
            ? 'Refreshing…'
            : 'Refresh Finance'}
        </button>
      </form>

      {error && (
        <div
          className="finance-live-v7c__message finance-live-v7c__message--error"
          role="alert"
        >
          <strong>Finance data is unavailable</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="finance-live-v7c__metrics">
        {metrics.map((metric) => (
          <article
            className={`finance-live-v7c__metric finance-live-v7c__metric--${metric.tone}`}
            key={metric.label}
          >
            <span>{metric.label}</span>
            <strong>
              {isLoading ? 'Loading…' : metric.value}
            </strong>
            <small>{metric.note}</small>
          </article>
        ))}
      </div>

      <div className="finance-live-v7c__workspace">
        <article className="finance-live-v7c__panel">
          <header>
            <div>
              <span>Payment control</span>
              <h2>POS and Finance Reconciliation</h2>
            </div>

            <strong
              className={`finance-live-v7c__badge finance-live-v7c__badge--${
                payments?.summary?.is_reconciled
                  ? 'positive'
                  : 'review'
              }`}
            >
              {payments
                ? payments.summary.is_reconciled
                  ? 'Reconciled'
                  : 'Review required'
                : 'Not available'}
            </strong>
          </header>

          <div className="finance-live-v7c__summary-list">
            <div>
              <span>POS completed payments</span>
              <strong>
                {money(
                  payments?.summary
                    ?.pos_completed_payments_total,
                )}
              </strong>
            </div>

            <div>
              <span>Finance shadow payments</span>
              <strong>
                {money(
                  payments?.summary
                    ?.finance_shadow_payment_total,
                )}
              </strong>
            </div>

            <div>
              <span>Missing postings</span>
              <strong>
                {numberValue(
                  payments?.summary
                    ?.missing_finance_postings_count,
                )}
              </strong>
            </div>

            <div>
              <span>Orphan shadow postings</span>
              <strong>
                {numberValue(
                  payments?.summary
                    ?.orphan_finance_shadow_postings_count,
                )}
              </strong>
            </div>
          </div>
        </article>

        <article className="finance-live-v7c__panel">
          <header>
            <div>
              <span>Release readiness</span>
              <h2>Finance Health Checks</h2>
            </div>

            <strong
              className={`finance-live-v7c__badge finance-live-v7c__badge--${
                statusTone(health?.overall_status)
              }`}
            >
              {readable(health?.overall_status)}
            </strong>
          </header>

          {healthChecks.length > 0 ? (
            <div className="finance-live-v7c__health-list">
              {healthChecks.map(([key, check]) => (
                <div key={key}>
                  <span>
                    {check.label || readable(key)}
                  </span>
                  <strong
                    className={`finance-live-v7c__badge finance-live-v7c__badge--${
                      statusTone(check.status)
                    }`}
                  >
                    {readable(check.status)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="finance-live-v7c__empty">
              No readiness checks are available for the
              selected period.
            </div>
          )}
        </article>
      </div>

      <article className="finance-live-v7c__panel">
        <header>
          <div>
            <span>Payment channels</span>
            <h2>Reconciliation by Payment Method</h2>
          </div>
        </header>

        <div className="finance-live-v7c__table-scroll">
          <table>
            <thead>
              <tr>
                <th>Payment method</th>
                <th>POS total</th>
                <th>Finance shadow</th>
                <th>Difference</th>
              </tr>
            </thead>

            <tbody>
              {(payments?.payment_methods ?? []).map(
                (method) => (
                  <tr key={method.payment_method}>
                    <td>
                      {readable(method.payment_method)}
                    </td>
                    <td>{money(method.pos_total)}</td>
                    <td>
                      {money(method.finance_shadow_total)}
                    </td>
                    <td>{money(method.difference)}</td>
                  </tr>
                ),
              )}

              {(payments?.payment_methods ?? []).length === 0 && (
                <tr>
                  <td colSpan={4}>
                    No payment-method reconciliation data is
                    available for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="finance-live-v7c__panel">
        <header>
          <div>
            <span>Revenue shadow</span>
            <h2>Revenue and Tax Allocation</h2>
          </div>
        </header>

        <div className="finance-live-v7c__table-scroll">
          <table>
            <thead>
              <tr>
                <th>Payment method</th>
                <th>Operational revenue</th>
                <th>Shadow revenue</th>
                <th>Shadow tax</th>
                <th>Revenue difference</th>
                <th>Tax difference</th>
              </tr>
            </thead>

            <tbody>
              {(revenue?.payment_methods ?? []).map(
                (method) => (
                  <tr key={method.payment_method}>
                    <td>
                      {readable(method.payment_method)}
                    </td>
                    <td>
                      {money(
                        method.operational_allocated_revenue,
                      )}
                    </td>
                    <td>
                      {money(method.finance_shadow_revenue)}
                    </td>
                    <td>
                      {money(method.finance_shadow_tax)}
                    </td>
                    <td>
                      {money(method.revenue_difference)}
                    </td>
                    <td>
                      {money(method.tax_difference)}
                    </td>
                  </tr>
                ),
              )}

              {(revenue?.payment_methods ?? []).length === 0 && (
                <tr>
                  <td colSpan={6}>
                    No revenue-shadow allocation data is
                    available for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <div
        className="finance-live-v7c__message"
        role="note"
      >
        <strong>Tax Registry not activated</strong>
        <span>
          The current production backend does not expose the
          Tax Registry reporting routes. No exemption, tax
          treatment or registry decision is calculated here.
        </span>
      </div>

      {financeModules.length > 0 && (
        <section
          className="finance-live-v7c__modules"
          aria-labelledby="finance-live-modules-title"
        >
          <header>
            <div>
              <span>Finance suite</span>
              <h2 id="finance-live-modules-title">
                Finance Modules
              </h2>
              <p>
                Open a focused workflow without leaving the
                authorised workspace structure.
              </p>
            </div>

            <strong>
              {financeModules.length} modules
            </strong>
          </header>

          <div className="finance-live-v7c__module-grid">
            {financeModules.map((financeModule) => (
              <article
                className="finance-live-v7c__module-card"
                key={financeModule.key}
              >
                <div>
                  <span>Finance</span>
                  <h3>{financeModule.label}</h3>
                  <p>
                    {financeModule.description?.trim()
                      || 'Open this Finance workflow for focused review and action.'}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!onOpenFinanceModule}
                  onClick={() =>
                    openFinanceModule(financeModule.key)
                  }
                >
                  <span>Open module</span>
                  <b aria-hidden="true">→</b>
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

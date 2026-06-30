import { useEffect, useMemo, useState } from 'react';
import {
  getPharmaCustomerCreditExposureReport,
  getPharmaInventoryValuationReport,
  getPharmaPayablesSummaryReport,
  getPharmaProcurementSummaryReport,
  getPharmaReportingOverview,
  getPharmaSalesSummaryReport,
  PharmaInventoryValuationReport,
  PharmaPayablesSummaryReport,
  PharmaProcurementSummaryReport,
  PharmaReportPeriod,
  PharmaSalesSummaryReport,
} from '../lib/api';

type PharmacoOperationsCommandCenterProps = {
  token?: string;
  tenantSlug?: string;
  profile?: Record<string, any>;
  [key: string]: any;
};

type CommandCenterState = {
  period: PharmaReportPeriod | null;
  inventory: PharmaInventoryValuationReport | null;
  sales: PharmaSalesSummaryReport | null;
  procurement: PharmaProcurementSummaryReport | null;
  payables: PharmaPayablesSummaryReport | null;
  customerCredit: any | null;
};

const money = new Intl.NumberFormat('en-RW', {
  style: 'currency',
  currency: 'RWF',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('en-RW', {
  maximumFractionDigits: 0,
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return date.toISOString().slice(0, 10);
}

function deriveTenantSlug(props: PharmacoOperationsCommandCenterProps): string {
  return (
    props.tenantSlug ||
    props.profile?.tenant?.slug ||
    props.profile?.tenant_slug ||
    props.profile?.current_tenant?.slug ||
    props.tenant?.slug ||
    props.profile?.tenant_assignments?.[0]?.tenant?.slug ||
    ''
  );
}

function formatMoney(value?: number | null): string {
  return money.format(Number(value ?? 0));
}

function formatNumber(value?: number | null): string {
  return numberFormatter.format(Number(value ?? 0));
}

function percentage(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

export function PharmacoOperationsCommandCenter(props: PharmacoOperationsCommandCenterProps) {
  const token = props.token || props.accessToken || props.session?.accessToken || props.session?.token || '';
  const tenantSlug = deriveTenantSlug(props);
  const [state, setState] = useState<CommandCenterState>({
    period: null,
    inventory: null,
    sales: null,
    procurement: null,
    payables: null,
    customerCredit: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const hasTenantContext = Boolean(token && tenantSlug);

  const collectionRate = useMemo(() => {
    return percentage(Number(state.sales?.paid_amount ?? 0), Number(state.sales?.total_sales_amount ?? 0));
  }, [state.sales]);

  const payableSettlementRate = useMemo(() => {
    return percentage(Number(state.payables?.paid_amount ?? 0), Number(state.payables?.total_invoice_amount ?? 0));
  }, [state.payables]);

  const overdueCredit = Number(state.customerCredit?.overdue_balance ?? 0);
  const openCredit = Number(state.customerCredit?.open_balance ?? 0);
  const creditRiskRate = percentage(overdueCredit, openCredit);

  useEffect(() => {
    if (!hasTenantContext) {
      return;
    }

    void loadCommandCenter();
  }, [hasTenantContext]);

  async function loadCommandCenter() {
    if (!token || !tenantSlug) {
      setError('Tenant context is required before loading the operations command center.');
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');

    const filters = {
      start_date: daysAgoIso(30),
      end_date: todayIso(),
    };

    try {
      const overview = await getPharmaReportingOverview(token, tenantSlug, filters);
      const [inventory, sales, procurement, payables, customerCredit] = await Promise.all([
        getPharmaInventoryValuationReport(token, tenantSlug),
        getPharmaSalesSummaryReport(token, tenantSlug, filters),
        getPharmaProcurementSummaryReport(token, tenantSlug, filters),
        getPharmaPayablesSummaryReport(token, tenantSlug, filters),
        getPharmaCustomerCreditExposureReport(token, tenantSlug),
      ]);

      setState({
        period: overview.period,
        inventory: inventory.inventory,
        sales: sales.sales,
        procurement: procurement.procurement,
        payables: payables.payables,
        customerCredit: customerCredit.customer_credit_exposure,
      });

      setNotice('Operations command center refreshed with read-only tenant figures.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the operations command center.');
    } finally {
      setIsLoading(false);
    }
  }

  const focusItems = [
    {
      label: 'Collect customer credit',
      value: formatMoney(state.customerCredit?.open_balance),
      helper: `${formatMoney(state.customerCredit?.overdue_balance)} overdue`,
    },
    {
      label: 'Settle supplier payables',
      value: formatMoney(state.payables?.open_balance),
      helper: `${payableSettlementRate}% settled this period`,
    },
    {
      label: 'Move approved purchases',
      value: formatMoney(state.procurement?.approved_amount),
      helper: `${formatNumber(state.procurement?.approved_orders_count)} approved orders`,
    },
  ];

  return (
    <article className="panel wide operations-command-center">
      <div className="operations-hero">
        <div>
          <p className="eyebrow">PharmaCo360 command center</p>
          <h2>Today’s operating picture</h2>
          <p className="muted">
            A read-only pharmacy command view for stock value, sales collection, purchasing,
            customer credit risk, and supplier exposure.
          </p>
          {state.period && (
            <p className="operations-period">
              Showing activity from {state.period.start_date} to {state.period.end_date}
            </p>
          )}
        </div>

        <button type="button" onClick={loadCommandCenter} disabled={isLoading || !hasTenantContext}>
          {isLoading ? 'Refreshing…' : 'Refresh command center'}
        </button>
      </div>

      {!hasTenantContext && (
        <div className="reporting-empty-overview">
          Tenant context is required before loading the PharmaCo360 command center.
        </div>
      )}

      {error && <div className="form-error">{error}</div>}
      {notice && <div className="form-success">{notice}</div>}

      <section className="operations-kpi-grid">
        <div>
          <span>Stock at cost</span>
          <strong>{formatMoney(state.inventory?.total_cost_value)}</strong>
          <small>{formatNumber(state.inventory?.total_quantity)} units available</small>
        </div>
        <div>
          <span>Sales generated</span>
          <strong>{formatMoney(state.sales?.total_sales_amount)}</strong>
          <small>{collectionRate}% collected</small>
        </div>
        <div>
          <span>Customer credit risk</span>
          <strong>{formatMoney(state.customerCredit?.open_balance)}</strong>
          <small>{creditRiskRate}% overdue exposure</small>
        </div>
        <div>
          <span>Supplier balance</span>
          <strong>{formatMoney(state.payables?.open_balance)}</strong>
          <small>{formatMoney(state.payables?.overdue_balance)} overdue</small>
        </div>
      </section>

      <section className="operations-action-grid">
        <div className="operations-focus-card">
          <h3>Priority follow-up</h3>
          {focusItems.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>

        <div className="operations-focus-card">
          <h3>Manager review notes</h3>
          <ul>
            <li>Use sales collection rate to follow daily cash discipline.</li>
            <li>Use overdue customer credit before approving additional credit sales.</li>
            <li>Use supplier balance before committing new purchase orders.</li>
            <li>Use stock value to guide replenishment and expiry review discussions.</li>
          </ul>
        </div>
      </section>
    </article>
  );
}

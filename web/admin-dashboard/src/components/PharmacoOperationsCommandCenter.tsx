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
  const totalSales = Number(state.sales?.total_sales_amount ?? 0);
  const supplierBalance = Number(state.payables?.open_balance ?? 0);
  const stockAtCost = Number(state.inventory?.total_cost_value ?? 0);

  const collectionRate = useMemo(() => {
    return percentage(Number(state.sales?.paid_amount ?? 0), Number(state.sales?.total_sales_amount ?? 0));
  }, [state.sales]);

  const payableSettlementRate = useMemo(() => {
    return percentage(Number(state.payables?.paid_amount ?? 0), Number(state.payables?.total_invoice_amount ?? 0));
  }, [state.payables]);

  const overdueCredit = Number(state.customerCredit?.overdue_balance ?? 0);
  const openCredit = Number(state.customerCredit?.open_balance ?? 0);
  const creditRiskRate = percentage(overdueCredit, openCredit);

  const operationalAlerts = useMemo(() => {
    const payablesOverdue = Number(state.payables?.overdue_balance ?? 0);
    const purchaseOrdersApproved = Number(state.procurement?.approved_orders_count ?? 0);
    const stockValue = Number(state.inventory?.total_cost_value ?? 0);

    const alerts = [
      {
        tone: overdueCredit > 0 ? 'warning' : 'stable',
        label: 'Customer credit',
        title: overdueCredit > 0 ? 'Overdue customer balances need follow-up' : 'No overdue customer credit flagged',
        detail:
          overdueCredit > 0
            ? `${formatMoney(overdueCredit)} is overdue from ${formatMoney(openCredit)} open credit.`
            : 'Customer credit exposure is not showing overdue risk from the latest report.',
      },
      {
        tone: payablesOverdue > 0 ? 'warning' : 'stable',
        label: 'Supplier payables',
        title: payablesOverdue > 0 ? 'Supplier overdue balance requires review' : 'Supplier balance is under control',
        detail:
          payablesOverdue > 0
            ? `${formatMoney(payablesOverdue)} is overdue and should be reviewed before new commitments.`
            : 'No overdue supplier balance is flagged from the latest payable report.',
      },
      {
        tone: collectionRate > 0 && collectionRate < 80 ? 'attention' : 'stable',
        label: 'Sales collection',
        title: collectionRate > 0 && collectionRate < 80 ? 'Collection rate needs attention' : 'Collection rate is acceptable',
        detail:
          collectionRate > 0 && collectionRate < 80
            ? `${collectionRate}% of generated sales has been collected in the current period.`
            : `${collectionRate}% collection rate based on the current reporting period.`,
      },
      {
        tone: purchaseOrdersApproved > 0 ? 'attention' : 'stable',
        label: 'Purchasing',
        title: purchaseOrdersApproved > 0 ? 'Approved purchase orders need receiving review' : 'No approved purchase queue flagged',
        detail:
          purchaseOrdersApproved > 0
            ? `${formatNumber(purchaseOrdersApproved)} approved order ${purchaseOrdersApproved === 1 ? 'is' : 'are'} ready for follow-up.`
            : 'No approved purchase order queue is highlighted from the current report.',
      },
      {
        tone: stockValue > 0 ? 'stable' : 'attention',
        label: 'Stock visibility',
        title: stockValue > 0 ? 'Stock value is visible for review' : 'Stock value needs verification',
        detail:
          stockValue > 0
            ? `${formatMoney(stockValue)} stock at cost is available for management review.`
            : 'No stock value is currently visible from the inventory valuation report.',
      },
    ];

    return alerts;
  }, [collectionRate, openCredit, overdueCredit, state.inventory, state.payables, state.procurement]);

  const reviewQueues = useMemo(() => {
    return [
      {
        title: 'Credit collection queue',
        count: formatNumber(state.customerCredit?.open_receivables_count),
        value: formatMoney(state.customerCredit?.open_balance),
        note: `${formatNumber(state.customerCredit?.overdue_receivables_count)} overdue receivables need review`,
      },
      {
        title: 'Supplier payment queue',
        count: formatNumber(state.payables?.open_invoices_count),
        value: formatMoney(state.payables?.open_balance),
        note: `${formatMoney(state.payables?.overdue_balance)} overdue supplier exposure`,
      },
      {
        title: 'Purchase receiving queue',
        count: formatNumber(state.procurement?.approved_orders_count),
        value: formatMoney(state.procurement?.approved_amount),
        note: 'Approved orders should be checked against received stock.',
      },
      {
        title: 'Sales collection queue',
        count: formatNumber(state.sales?.sales_count),
        value: formatMoney(state.sales?.balance_amount),
        note: `${collectionRate}% of generated sales has been collected.`,
      },
    ];
  }, [collectionRate, state.customerCredit, state.payables, state.procurement, state.sales]);

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


  const executiveSummaryItems = [
    {
      label: 'Operating position',
      title: collectionRate >= 80 ? 'Collections are supporting daily operations' : 'Collections need executive attention',
      detail: `${collectionRate}% of generated sales has been collected from ${formatMoney(totalSales)} total sales.`,
      tone: collectionRate >= 80 ? 'stable' : 'attention',
    },
    {
      label: 'Credit discipline',
      title: overdueCredit > 0 ? 'Overdue customer credit requires action' : 'Customer credit is within review comfort',
      detail:
        overdueCredit > 0
          ? `${formatMoney(overdueCredit)} is overdue from ${formatMoney(openCredit)} open credit.`
          : 'No overdue customer credit is highlighted in the current snapshot.',
      tone: overdueCredit > 0 ? 'warning' : 'stable',
    },
    {
      label: 'Supplier exposure',
      title: supplierBalance > 0 ? 'Supplier obligations should be reviewed' : 'Supplier exposure is currently light',
      detail: `${formatMoney(supplierBalance)} remains open with suppliers in the latest payable view.`,
      tone: supplierBalance > 0 ? 'attention' : 'stable',
    },
    {
      label: 'Stock investment',
      title: stockAtCost > 0 ? 'Stock value is visible for executive review' : 'Stock valuation needs confirmation',
      detail:
        stockAtCost > 0
          ? `${formatMoney(stockAtCost)} stock at cost is visible for pharmacy operating review.`
          : 'Inventory value is not visible in the current reporting snapshot.',
      tone: stockAtCost > 0 ? 'stable' : 'attention',
    },
  ];

  const decisionNotes = [
    {
      title: 'Approve daily position',
      note: 'Use sales collected, open customer credit, and supplier balance to decide whether the day can be closed cleanly.',
    },
    {
      title: 'Prioritize collection follow-up',
      note: 'Escalate overdue receivables before extending additional credit or releasing large-value products on account.',
    },
    {
      title: 'Control purchasing pressure',
      note: 'Check approved purchase orders, open supplier balances, and current stock value before new buying commitments.',
    },
    {
      title: 'Prepare manager handover',
      note: 'Use alerts, queues, and operator notes as the handover agenda between cashier, stock, procurement, and management.',
    },
  ];

  const operatorChecklist = [
    {
      title: 'Cash and collections',
      note: 'Compare sales generated, collected cash, and open customer credit before closing the day.',
    },
    {
      title: 'Credit control',
      note: 'Review overdue receivables before approving additional credit sales.',
    },
    {
      title: 'Supplier exposure',
      note: 'Check open and overdue supplier balances before confirming new purchase commitments.',
    },
    {
      title: 'Stock attention',
      note: 'Use the stock value and queue notes to guide replenishment, expiry, and receiving conversations.',
    },
  ];

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

      <section className="operations-alerts-section">
        <div className="section-heading">
          <div>
            <h3>Operational alerts</h3>
            <span>Read-only alerts generated from the current tenant reporting snapshot.</span>
          </div>
        </div>

        <div className="operations-alert-grid">
          {operationalAlerts.map((alert) => (
            <div key={alert.label} className={`operations-alert-card operations-alert-card--${alert.tone}`}>
              <span>{alert.label}</span>
              <strong>{alert.title}</strong>
              <small>{alert.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="operations-review-section">
        <div className="section-heading">
          <div>
            <h3>Review queues</h3>
            <span>Queues that managers can use for daily follow-up discussions.</span>
          </div>
        </div>

        <div className="operations-review-grid">
          {reviewQueues.map((queue) => (
            <div key={queue.title}>
              <span>{queue.title}</span>
              <strong>{queue.count}</strong>
              <small>{queue.value}</small>
              <p>{queue.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="operations-executive-section">
        <div className="section-heading">
          <div>
            <h3>Executive operating summary</h3>
            <span>Management-level interpretation of the current pharmacy reporting snapshot.</span>
          </div>
        </div>

        <div className="operations-executive-grid">
          {executiveSummaryItems.map((item) => (
            <div key={item.label} className={`operations-executive-card operations-executive-card--${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="operations-decision-section">
        <div className="section-heading">
          <div>
            <h3>Decision notes</h3>
            <span>Executive prompts for daily review, escalation, and handover.</span>
          </div>
        </div>

        <div className="operations-decision-grid">
          {decisionNotes.map((note) => (
            <div key={note.title}>
              <strong>{note.title}</strong>
              <p>{note.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="operations-operator-section">
        <div className="section-heading">
          <div>
            <h3>Operator review checklist</h3>
            <span>Daily questions for a pharmacy manager before moving into detailed workflows.</span>
          </div>
        </div>

        <div className="operations-operator-grid">
          {operatorChecklist.map((item) => (
            <div key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.note}</p>
            </div>
          ))}
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

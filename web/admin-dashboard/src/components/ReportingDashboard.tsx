import { useEffect, useMemo, useState } from 'react';
import {
  getPharmaInventoryValuationReport,
  getPharmaPayablesSummaryReport,
  getPharmaProcurementSummaryReport,
  getPharmaReportingOverview,
  getPharmaSalesSummaryReport,
  PharmaInventoryValuationReport,
  PharmaPayablesSummaryReport,
  PharmaProcurementSummaryReport,
  PharmaReportDateFilters,
  PharmaReportPeriod,
  PharmaSalesSummaryReport,
} from '../lib/api';

type ReportingDashboardProps = {
  token?: string;
  tenantSlug?: string;
  profile?: Record<string, any>;
  permissions?: string[];
  [key: string]: any;
};

type ReportingState = {
  period: PharmaReportPeriod | null;
  inventory: PharmaInventoryValuationReport | null;
  sales: PharmaSalesSummaryReport | null;
  procurement: PharmaProcurementSummaryReport | null;
  payables: PharmaPayablesSummaryReport | null;
};

const money = new Intl.NumberFormat('en-RW', {
  style: 'currency',
  currency: 'RWF',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('en-RW', {
  maximumFractionDigits: 2,
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return date.toISOString().slice(0, 10);
}

function deriveTenantSlug(props: ReportingDashboardProps): string {
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

function deriveToken(props: ReportingDashboardProps): string {
  return props.token || props.accessToken || props.session?.accessToken || props.session?.token || '';
}

function formatMoney(value?: number | null): string {
  return money.format(Number(value ?? 0));
}

function formatNumber(value?: number | null): string {
  return numberFormatter.format(Number(value ?? 0));
}

function statusLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function ReportingDashboard(props: ReportingDashboardProps) {
  const token = deriveToken(props);
  const tenantSlug = deriveTenantSlug(props);
  const permissions = props.permissions ?? props.profile?.permissions ?? [];

  const canViewReports =
    permissions.length === 0 ||
    permissions.includes('pharmaco.sales.manage') ||
    permissions.includes('pharmaco.inventory.manage') ||
    permissions.includes('pharmaco.suppliers.manage');

  const [filters, setFilters] = useState<Required<PharmaReportDateFilters>>({
    start_date: daysAgoIso(30),
    end_date: todayIso(),
  });
  const [state, setState] = useState<ReportingState>({
    period: null,
    inventory: null,
    sales: null,
    procurement: null,
    payables: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const salesCollectionRate = useMemo(() => {
    const total = Number(state.sales?.total_sales_amount ?? 0);
    const paid = Number(state.sales?.paid_amount ?? 0);

    if (total <= 0) {
      return 0;
    }

    return Math.round((paid / total) * 100);
  }, [state.sales]);

  const payableSettlementRate = useMemo(() => {
    const total = Number(state.payables?.total_invoice_amount ?? 0);
    const paid = Number(state.payables?.paid_amount ?? 0);

    if (total <= 0) {
      return 0;
    }

    return Math.round((paid / total) * 100);
  }, [state.payables]);

  useEffect(() => {
    if (!token || !tenantSlug || !canViewReports) {
      return;
    }

    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantSlug, canViewReports]);

  async function loadReports() {
    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      const overview = await getPharmaReportingOverview(token, tenantSlug, filters);
      const [inventory, sales, procurement, payables] = await Promise.all([
        getPharmaInventoryValuationReport(token, tenantSlug),
        getPharmaSalesSummaryReport(token, tenantSlug, filters),
        getPharmaProcurementSummaryReport(token, tenantSlug, filters),
        getPharmaPayablesSummaryReport(token, tenantSlug, filters),
      ]);

      setState({
        period: overview.period,
        inventory: inventory.inventory,
        sales: sales.sales,
        procurement: procurement.procurement,
        payables: payables.payables,
      });

      setNotice('Reporting dashboard refreshed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load PharmaCo360 reports.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!canViewReports) {
    return null;
  }

  return (
    <section className="reporting-dashboard-panel">
      <div className="section-heading">
        <span>Reporting and analytics</span>
        <h2>Operational reporting dashboard</h2>
        <p>
          Review stock value, sales collection, procurement movement, and supplier payables from one tenant-safe view.
        </p>
      </div>

      <div className="reporting-filter-bar">
        <label>
          Start date
          <input
            type="date"
            value={filters.start_date}
            onChange={(event) => setFilters((current) => ({ ...current, start_date: event.target.value }))}
          />
        </label>

        <label>
          End date
          <input
            type="date"
            value={filters.end_date}
            onChange={(event) => setFilters((current) => ({ ...current, end_date: event.target.value }))}
          />
        </label>

        <button type="button" onClick={loadReports} disabled={isLoading}>
          {isLoading ? 'Refreshing…' : 'Refresh reports'}
        </button>

        {state.period && (
          <small>
            Active period: {state.period.start_date} to {state.period.end_date}
          </small>
        )}
      </div>

      {notice && <div className="notice-banner">{notice}</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="reporting-kpi-grid">
        <article>
          <span>Inventory cost value</span>
          <strong>{formatMoney(state.inventory?.total_cost_value)}</strong>
          <small>{formatNumber(state.inventory?.total_quantity_on_hand)} units on hand</small>
        </article>

        <article>
          <span>Estimated retail value</span>
          <strong>{formatMoney(state.inventory?.total_retail_value)}</strong>
          <small>Margin estimate {formatMoney(state.inventory?.estimated_margin_value)}</small>
        </article>

        <article>
          <span>Sales value</span>
          <strong>{formatMoney(state.sales?.total_sales_amount)}</strong>
          <small>{salesCollectionRate}% collected</small>
        </article>

        <article>
          <span>Purchase order value</span>
          <strong>{formatMoney(state.procurement?.total_purchase_order_amount)}</strong>
          <small>{state.procurement?.purchase_order_count ?? 0} purchase orders</small>
        </article>

        <article>
          <span>Open supplier balance</span>
          <strong>{formatMoney(state.payables?.balance_amount)}</strong>
          <small>{payableSettlementRate}% settled</small>
        </article>
      </div>

      <div className="reporting-grid">
        <section className="report-card">
          <div className="mini-section-heading">
            <strong>Inventory valuation</strong>
            <span>{state.inventory?.product_count ?? 0} products</span>
          </div>

          <div className="report-metric-list">
            <div>
              <span>Batches</span>
              <strong>{state.inventory?.batch_count ?? 0}</strong>
            </div>
            <div>
              <span>Low stock</span>
              <strong>{state.inventory?.low_stock_batches ?? 0}</strong>
            </div>
            <div>
              <span>Expired</span>
              <strong>{state.inventory?.expired_batches ?? 0}</strong>
            </div>
            <div>
              <span>Expiring soon</span>
              <strong>{state.inventory?.expiring_soon_batches ?? 0}</strong>
            </div>
          </div>

          <div className="report-table">
            <div className="report-table-header">
              <span>Location</span>
              <span>Quantity</span>
              <span>Cost value</span>
            </div>

            {(state.inventory?.locations ?? []).slice(0, 6).map((location) => (
              <div key={`${location.stock_location_id}-${location.location_name}`}>
                <span>
                  <strong>{location.location_name ?? 'Location'}</strong>
                  <small>{location.branch_name ?? 'Branch not set'}</small>
                </span>
                <span>{formatNumber(location.total_quantity_on_hand)}</span>
                <span>{formatMoney(location.total_cost_value)}</span>
              </div>
            ))}

            {(state.inventory?.locations ?? []).length === 0 && (
              <p className="muted">No location valuation loaded yet.</p>
            )}
          </div>
        </section>

        <section className="report-card">
          <div className="mini-section-heading">
            <strong>Sales summary</strong>
            <span>{state.sales?.sale_count ?? 0} sales</span>
          </div>

          <div className="report-metric-list">
            <div>
              <span>Draft</span>
              <strong>{state.sales?.draft_sale_count ?? 0}</strong>
            </div>
            <div>
              <span>Dispensed</span>
              <strong>{state.sales?.dispensed_sale_count ?? 0}</strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>{formatMoney(state.sales?.paid_amount)}</strong>
            </div>
            <div>
              <span>Balance</span>
              <strong>{formatMoney(state.sales?.balance_amount)}</strong>
            </div>
          </div>

          <div className="report-table">
            <div className="report-table-header">
              <span>Payment method</span>
              <span>Count</span>
              <span>Amount</span>
            </div>

            {(state.sales?.payment_methods ?? []).map((method) => (
              <div key={method.payment_method}>
                <span>{statusLabel(method.payment_method)}</span>
                <span>{method.payment_count}</span>
                <span>{formatMoney(method.total_amount)}</span>
              </div>
            ))}

            {(state.sales?.payment_methods ?? []).length === 0 && (
              <p className="muted">No completed payments in this period.</p>
            )}
          </div>
        </section>

        <section className="report-card">
          <div className="mini-section-heading">
            <strong>Procurement summary</strong>
            <span>{state.procurement?.purchase_order_count ?? 0} purchase orders</span>
          </div>

          <div className="report-metric-list">
            <div>
              <span>Draft</span>
              <strong>{state.procurement?.draft_purchase_order_count ?? 0}</strong>
            </div>
            <div>
              <span>Approved</span>
              <strong>{state.procurement?.approved_purchase_order_count ?? 0}</strong>
            </div>
            <div>
              <span>Received</span>
              <strong>{state.procurement?.received_purchase_order_count ?? 0}</strong>
            </div>
            <div>
              <span>Cancelled</span>
              <strong>{state.procurement?.cancelled_purchase_order_count ?? 0}</strong>
            </div>
          </div>

          <div className="report-table">
            <div className="report-table-header">
              <span>Status</span>
              <span>Count</span>
              <span>Amount</span>
            </div>

            {(state.procurement?.status_summary ?? []).map((status) => (
              <div key={status.status}>
                <span>{statusLabel(status.status)}</span>
                <span>{status.purchase_order_count}</span>
                <span>{formatMoney(status.total_amount)}</span>
              </div>
            ))}

            {(state.procurement?.status_summary ?? []).length === 0 && (
              <p className="muted">No purchase orders in this period.</p>
            )}
          </div>
        </section>

        <section className="report-card">
          <div className="mini-section-heading">
            <strong>Supplier payables</strong>
            <span>{state.payables?.supplier_invoice_count ?? 0} invoices</span>
          </div>

          <div className="report-metric-list">
            <div>
              <span>Approved</span>
              <strong>{state.payables?.approved_invoice_count ?? 0}</strong>
            </div>
            <div>
              <span>Partial</span>
              <strong>{state.payables?.partially_paid_invoice_count ?? 0}</strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>{state.payables?.paid_invoice_count ?? 0}</strong>
            </div>
            <div>
              <span>Overdue</span>
              <strong>{state.payables?.overdue_invoice_count ?? 0}</strong>
            </div>
          </div>

          <div className="report-table">
            <div className="report-table-header">
              <span>Status</span>
              <span>Invoices</span>
              <span>Balance</span>
            </div>

            {(state.payables?.status_summary ?? []).map((status) => (
              <div key={status.status}>
                <span>{statusLabel(status.status)}</span>
                <span>{status.invoice_count}</span>
                <span>{formatMoney(status.balance_amount)}</span>
              </div>
            ))}

            {(state.payables?.status_summary ?? []).length === 0 && (
              <p className="muted">No supplier invoices in this period.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

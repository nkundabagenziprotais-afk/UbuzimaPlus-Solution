import { useEffect, useMemo, useState } from 'react';
import {
  getPharmaInventoryValuationReport,
  getPharmaPayablesSummaryReport,
  getPharmaCustomerCreditExposureExport,
  getPharmaCustomerCreditExposureReport,
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
  customerCredit: PharmaCustomerCreditExposureReport | null;
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

function csvCell(value?: string | number | null): string {
  const text = value === null || value === undefined ? '' : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
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
    customerCredit: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparingCustomerCreditExport, setIsPreparingCustomerCreditExport] = useState(false);
  const [customerCreditExportNotice, setCustomerCreditExportNotice] = useState('');
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
    setCustomerCreditExportNotice('');

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

      setNotice('Reporting view refreshed with the latest tenant-safe figures.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load PharmaCo360 reports.');
    } finally {
      setIsLoading(false);
    }
  }

  async function downloadCustomerCreditCsv() {
    if (!token || !tenantSlug) {
      setError('Tenant context is required before downloading the customer credit export.');
      return;
    }

    setIsPreparingCustomerCreditExport(true);
    setError('');
    setCustomerCreditExportNotice('');

    try {
      const exportResponse = await getPharmaCustomerCreditExposureExport(token, tenantSlug);
      const headers = [
        'Customer',
        'Reference',
        'Status',
        'Original amount',
        'Collected amount',
        'Balance amount',
        'Due date',
        'Days overdue',
        'Aging bucket',
      ];

      const rows = exportResponse.rows.map((row) => [
        row.customer_name,
        row.reference_number,
        statusLabel(row.status),
        row.original_amount,
        row.collected_amount,
        row.balance_amount,
        row.due_date,
        row.days_overdue,
        row.aging_bucket_label,
      ]);

      const csvContent = [
        headers.map(csvCell).join(','),
        ...rows.map((row) => row.map(csvCell).join(',')),
      ].join('\n');

      const filename = `customer-credit-exposure-${tenantSlug}-${exportResponse.period.as_of_date}.csv`;
      const rowCount = exportResponse.export.rows_count;

      downloadCsvFile(filename, csvContent);

      setCustomerCreditExportNotice(
        `CSV downloaded with ${formatNumber(rowCount)} open receivable ${rowCount === 1 ? 'row' : 'rows'} as of ${exportResponse.period.as_of_date}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download the customer credit export.');
    } finally {
      setIsPreparingCustomerCreditExport(false);
    }
  }

  if (!canViewReports) {
    return null;
  }

  return (
    <section className="reporting-dashboard-panel reporting-dashboard-panel--business">
      <div className="section-heading">
        <span>Business reporting</span>
        <h2>PharmaCo360 operating view</h2>
        <p>
          Track stock value, sales collection, purchasing movement, customer credit exposure, and supplier obligations from one tenant-safe view.
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
          <small className="reporting-period-note">
            Active period: {state.period.start_date} to {state.period.end_date}
          </small>
        )}
      </div>

      {notice && <div className="notice-banner">{notice}</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="reporting-kpi-grid">
        <article>
          <span>Stock at cost</span>
          <strong>{formatMoney(state.inventory?.total_cost_value)}</strong>
          <small>{formatNumber(state.inventory?.total_quantity_on_hand)} units on hand</small>
        </article>

        <article>
          <span>Estimated sale value</span>
          <strong>{formatMoney(state.inventory?.total_retail_value)}</strong>
          <small>Estimated margin {formatMoney(state.inventory?.estimated_margin_value)}</small>
        </article>

        <article>
          <span>Sales generated</span>
          <strong>{formatMoney(state.sales?.total_sales_amount)}</strong>
          <small>{salesCollectionRate}% collected</small>
        </article>

        <article>
          <span>Purchase orders value</span>
          <strong>{formatMoney(state.procurement?.total_purchase_order_amount)}</strong>
          <small>{state.procurement?.purchase_order_count ?? 0} purchase orders</small>
        </article>

        <article>
          <span>Supplier balance</span>
          <strong>{formatMoney(state.payables?.balance_amount)}</strong>
          <small>{payableSettlementRate}% settled</small>
        </article>
      </div>

      <div className="reporting-grid">
        <section className="report-card">
          <div className="mini-section-heading">
            <strong>Stock valuation</strong>
            <span>{state.inventory?.product_count ?? 0} products</span>
          </div>

          <p className="report-card-intro">Review stock value, batch movement, and location-level exposure before replenishment decisions.</p>

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
            <strong>Sales and collection</strong>
            <span>{state.sales?.sale_count ?? 0} sales</span>
          </div>

          <p className="report-card-intro">Track sales value, paid amounts, and remaining balances for the selected operating period.</p>

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
            <strong>Purchase orders</strong>
            <span>{state.procurement?.purchase_order_count ?? 0} purchase orders</span>
          </div>

          <p className="report-card-intro">Monitor purchasing value and approval status before supplier follow-up or stock receiving.</p>

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
            <strong>Customer credit risk</strong>
            <span>{state.customerCredit?.open_receivables_count ?? 0} open receivables</span>
          </div>

          <p className="report-card-intro">Prioritize open customer balances by overdue risk before collection review and follow-up.</p>

          <div className="report-card-actions">
            <button
              type="button"
              onClick={downloadCustomerCreditCsv}
              disabled={isPreparingCustomerCreditExport}
            >
              {isPreparingCustomerCreditExport ? 'Downloading CSV…' : 'Download CSV'}
            </button>
          </div>

          <p className="muted report-muted-note">
            CSV includes open customer receivables as of today, grouped by aging status for collection review and follow-up.
          </p>

          {customerCreditExportNotice && <p className="notice-banner report-export-notice">{customerCreditExportNotice}</p>}

          <div className="report-metric-list">
            <div>
              <span>Open balance</span>
              <strong>{formatMoney(state.customerCredit?.open_balance)}</strong>
            </div>
            <div>
              <span>Overdue</span>
              <strong>{formatMoney(state.customerCredit?.overdue_balance)}</strong>
            </div>
            <div>
              <span>Current</span>
              <strong>{formatMoney(state.customerCredit?.current_balance)}</strong>
            </div>
            <div>
              <span>Customers on credit</span>
              <strong>{formatNumber(state.customerCredit?.customers_on_credit)}</strong>
            </div>
          </div>

          <div className="report-status-list">
            <div>
              <span>Credit limit enabled</span>
              <span>{formatMoney(state.customerCredit?.credit_limit_total)}</span>
            </div>
            <div>
              <span>Overdue receivables</span>
              <span>{formatNumber(state.customerCredit?.overdue_receivables_count)}</span>
            </div>
          </div>

          <div className="report-status-list report-status-list--aging">
            {(state.customerCredit?.aging_buckets ?? []).map((bucket) => (
              <div key={bucket.code}>
                <span>{bucket.label}</span>
                <span>
                  {formatMoney(bucket.balance)} · {formatNumber(bucket.receivables_count)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="report-card">
          <div className="mini-section-heading">
            <strong>Supplier payables</strong>
            <span>{state.payables?.supplier_invoice_count ?? 0} invoices</span>
          </div>

          <p className="report-card-intro">Review approved, partial, paid, and overdue supplier obligations before payment planning.</p>

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

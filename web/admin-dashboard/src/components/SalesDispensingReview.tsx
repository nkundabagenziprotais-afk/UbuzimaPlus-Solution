import { useMemo, useState } from 'react';
import {
  AccessProfile,
  PharmaCustomer,
  PharmaPrescription,
  PharmaSale,
  PharmaSalesResponse,
  getPharmaCustomers,
  getPharmaPrescriptions,
  getPharmaSale,
  getPharmaSales,
} from '../lib/api';

type Props = {
  token: string;
  profile: AccessProfile;
};

type SalesReviewState = {
  customers: PharmaCustomer[];
  prescriptions: PharmaPrescription[];
  sales: PharmaSale[];
  selectedSale: PharmaSale | null;
};

function money(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not set';

  return new Intl.DateTimeFormat('en-RW', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

function getTenantSlug(profile: AccessProfile): string {
  return (
    profile.tenant_assignments?.[0]?.tenant?.slug ||
    (profile.scope.is_tenant ? 'vitapharma' : '')
  );
}

export function SalesDispensingReview({ token, profile }: Props) {
  const [state, setState] = useState<SalesReviewState>({
    customers: [],
    prescriptions: [],
    sales: [],
    selectedSale: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSale, setIsLoadingSale] = useState(false);
  const [error, setError] = useState('');

  const tenantSlug = useMemo(() => getTenantSlug(profile), [profile]);
  const canReadSales = profile.permissions.includes('pharmaco.sales.manage');

  const salesSummary = useMemo(() => {
    const draftSales = state.sales.filter((sale) => sale.status === 'draft');
    const dispensedSales = state.sales.filter((sale) => sale.status === 'dispensed');
    const totalValue = state.sales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const openBalance = state.sales.reduce((sum, sale) => sum + sale.balance_amount, 0);

    return {
      draftSales: draftSales.length,
      dispensedSales: dispensedSales.length,
      totalValue,
      openBalance,
    };
  }, [state.sales]);

  async function loadSalesReview() {
    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    if (!canReadSales) {
      setError('Your current role does not include pharmaco.sales.manage.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const [customersResponse, prescriptionsResponse, salesResponse] = await Promise.all([
        getPharmaCustomers(token, tenantSlug),
        getPharmaPrescriptions(token, tenantSlug),
        getPharmaSales(token, tenantSlug),
      ]);

      const firstSale = (salesResponse as PharmaSalesResponse).sales[0] ?? null;
      const selectedSale = firstSale
        ? (await getPharmaSale(token, tenantSlug, firstSale.id)).sale
        : null;

      setState({
        customers: customersResponse.customers,
        prescriptions: prescriptionsResponse.prescriptions,
        sales: salesResponse.sales,
        selectedSale,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sales and dispensing review data.');
    } finally {
      setIsLoading(false);
    }
  }

  async function selectSale(saleId: number) {
    setIsLoadingSale(true);
    setError('');

    try {
      const response = await getPharmaSale(token, tenantSlug, saleId);
      setState((current) => ({
        ...current,
        selectedSale: response.sale,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sale detail.');
    } finally {
      setIsLoadingSale(false);
    }
  }

  const selectedSale = state.selectedSale;
  const saleItems = selectedSale?.items ?? [];
  const readinessItems = saleItems.map((item) => {
    const needsPrescription = item.requires_prescription && !item.prescription_verified;
    const needsBatch = !item.stock_batch;
    const ready = !needsPrescription && !needsBatch;

    return {
      item,
      needsPrescription,
      needsBatch,
      ready,
    };
  });

  const readyCount = readinessItems.filter((item) => item.ready).length;

  return (
    <article className="panel wide sales-review-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Sales and dispensing review</h2>
          <p className="muted">
            Read-only visibility for customers, prescriptions, draft sales, dispensed sales and confirmation readiness.
          </p>
        </div>

        <button type="button" onClick={loadSalesReview} disabled={isLoading}>
          {isLoading ? 'Loading…' : 'Load sales review'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!canReadSales && (
        <div className="form-error">
          This account is missing pharmaco.sales.manage. Use a tenant admin or solution admin account.
        </div>
      )}

      <div className="inventory-kpi-grid sales-kpi-grid">
        <article>
          <span>Customers</span>
          <strong>{state.customers.length}</strong>
        </article>
        <article>
          <span>Prescriptions</span>
          <strong>{state.prescriptions.length}</strong>
        </article>
        <article>
          <span>Draft sales</span>
          <strong>{salesSummary.draftSales}</strong>
        </article>
        <article>
          <span>Dispensed sales</span>
          <strong>{salesSummary.dispensedSales}</strong>
        </article>
        <article>
          <span>Total sale value</span>
          <strong>{money(salesSummary.totalValue)}</strong>
        </article>
        <article>
          <span>Open balance</span>
          <strong>{money(salesSummary.openBalance)}</strong>
        </article>
      </div>

      <div className="sales-review-grid">
        <section className="pharmaco-card">
          <span className="section-label">Customers / patients</span>
          {state.customers.length === 0 ? (
            <p className="muted">No customers loaded yet.</p>
          ) : (
            <div className="compact-list">
              {state.customers.slice(0, 5).map((customer) => (
                <div key={customer.id}>
                  <strong>{customer.full_name}</strong>
                  <span>{customer.phone ?? 'No phone'} · {customer.insurance_provider ?? 'No insurer'}</span>
                  <small>{customer.status}</small>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="pharmaco-card">
          <span className="section-label">Prescriptions</span>
          {state.prescriptions.length === 0 ? (
            <p className="muted">No prescriptions loaded yet.</p>
          ) : (
            <div className="compact-list">
              {state.prescriptions.slice(0, 5).map((prescription) => (
                <div key={prescription.id}>
                  <strong>{prescription.prescription_number}</strong>
                  <span>{prescription.prescriber_name ?? 'No prescriber'} · {prescription.prescriber_facility ?? 'No facility'}</span>
                  <small>{prescription.status} · expires {formatDate(prescription.expires_at)}</small>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="sales-table">
        <div className="sales-table-header">
          <strong>Sale</strong>
          <strong>Customer</strong>
          <strong>Status</strong>
          <strong>Total</strong>
          <strong>Action</strong>
        </div>

        {state.sales.length === 0 ? (
          <p className="muted">No sales loaded yet.</p>
        ) : (
          state.sales.map((sale) => (
            <div key={sale.id} className={selectedSale?.id === sale.id ? 'active-sale-row' : ''}>
              <span>
                <strong>{sale.sale_number}</strong>
                <small>{sale.sale_type.replaceAll('_', ' ')}</small>
              </span>
              <span>{sale.customer?.full_name ?? 'Walk-in customer'}</span>
              <span>
                <span className={`status-pill ${sale.status}`}>{sale.status}</span>
                <small>{sale.payment_status}</small>
              </span>
              <span>{money(sale.total_amount)}</span>
              <button type="button" onClick={() => selectSale(sale.id)} disabled={isLoadingSale}>
                Review
              </button>
            </div>
          ))
        )}
      </div>

      {selectedSale && (
        <section className="sale-detail-card">
          <div className="panel-heading-row">
            <div>
              <span className="section-label">Selected sale detail</span>
              <h3>{selectedSale.sale_number}</h3>
              <p className="muted">
                {selectedSale.customer?.full_name ?? 'Walk-in customer'} · {selectedSale.branch?.name ?? 'No branch'} · {selectedSale.status}
              </p>
            </div>
            <div className="sale-total-box">
              <span>Total</span>
              <strong>{money(selectedSale.total_amount)}</strong>
              <small>Balance: {money(selectedSale.balance_amount)}</small>
            </div>
          </div>

          <div className="readiness-summary">
            <strong>{readyCount}/{saleItems.length}</strong>
            <span>items ready for confirmation review</span>
            <small>
              This panel is read-only. Actual stock deduction remains backend-controlled and will be exposed later.
            </small>
          </div>

          <div className="sale-items-grid">
            {readinessItems.map(({ item, needsPrescription, needsBatch, ready }) => (
              <div key={item.id} className={ready ? 'ready-item' : 'pending-item'}>
                <div>
                  <strong>{item.product_name_snapshot}</strong>
                  <span>{item.sku_snapshot} · Qty {item.quantity}</span>
                </div>

                <div className="mini-facts">
                  <span>Line total: {money(item.line_total)}</span>
                  <span>Prescription: {item.requires_prescription ? (item.prescription_verified ? 'verified' : 'required') : 'not required'}</span>
                  <span>Batch: {item.stock_batch?.batch_number ?? 'not assigned'}</span>
                  <span>Location: {item.stock_location?.name ?? 'not assigned'}</span>
                </div>

                <small>
                  {ready
                    ? 'Ready for controlled confirmation.'
                    : [
                        needsPrescription ? 'Prescription verification needed' : null,
                        needsBatch ? 'Stock batch assignment needed' : null,
                      ].filter(Boolean).join(' · ')}
                </small>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

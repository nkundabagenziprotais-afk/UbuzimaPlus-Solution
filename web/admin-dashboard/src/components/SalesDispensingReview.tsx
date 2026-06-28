import { useMemo, useState } from 'react';
import {
  AccessProfile,
  PharmaCustomer,
  PharmaPrescription,
  PharmaSale,
  PharmaSaleItem,
  PharmaSalesResponse,
  PharmaStockBatch,
  confirmPharmaSale,
  getPharmaCustomers,
  getPharmaInventoryBatches,
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
  batches: PharmaStockBatch[];
};

type BatchSelections = Record<number, string>;
type PrescriptionChecks = Record<number, boolean>;

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

function eligibleBatchesForItem(
  item: PharmaSaleItem,
  sale: PharmaSale | null,
  batches: PharmaStockBatch[],
): PharmaStockBatch[] {
  if (!item.product) return [];

  return batches
    .filter((batch) => batch.product.id === item.product?.id)
    .filter((batch) => !sale?.branch?.id || batch.branch.id === sale.branch.id)
    .filter((batch) => batch.available_quantity >= item.quantity)
    .filter((batch) => batch.status === 'active')
    .sort((left, right) => {
      const leftExpiry = left.expiry_date ? new Date(left.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
      const rightExpiry = right.expiry_date ? new Date(right.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;

      return leftExpiry - rightExpiry || left.id - right.id;
    });
}

function buildBatchSelections(sale: PharmaSale | null, batches: PharmaStockBatch[]): BatchSelections {
  if (!sale?.items?.length) return {};

  return sale.items.reduce<BatchSelections>((carry, item) => {
    if (item.stock_batch?.id) {
      carry[item.id] = String(item.stock_batch.id);
      return carry;
    }

    const firstEligibleBatch = eligibleBatchesForItem(item, sale, batches)[0];

    if (firstEligibleBatch) {
      carry[item.id] = String(firstEligibleBatch.id);
    }

    return carry;
  }, {});
}

function buildPrescriptionChecks(sale: PharmaSale | null): PrescriptionChecks {
  if (!sale?.items?.length) return {};

  return sale.items.reduce<PrescriptionChecks>((carry, item) => {
    carry[item.id] = Boolean(item.prescription_verified);
    return carry;
  }, {});
}

export function SalesDispensingReview({ token, profile }: Props) {
  const [state, setState] = useState<SalesReviewState>({
    customers: [],
    prescriptions: [],
    sales: [],
    selectedSale: null,
    batches: [],
  });
  const [batchSelections, setBatchSelections] = useState<BatchSelections>({});
  const [prescriptionChecks, setPrescriptionChecks] = useState<PrescriptionChecks>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSale, setIsLoadingSale] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
    setNotice('');

    try {
      const [customersResponse, prescriptionsResponse, salesResponse, batchesResponse] = await Promise.all([
        getPharmaCustomers(token, tenantSlug),
        getPharmaPrescriptions(token, tenantSlug),
        getPharmaSales(token, tenantSlug),
        getPharmaInventoryBatches(token, tenantSlug),
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
        batches: batchesResponse.batches,
      });
      setBatchSelections(buildBatchSelections(selectedSale, batchesResponse.batches));
      setPrescriptionChecks(buildPrescriptionChecks(selectedSale));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sales and dispensing review data.');
    } finally {
      setIsLoading(false);
    }
  }

  async function selectSale(saleId: number) {
    setIsLoadingSale(true);
    setError('');
    setNotice('');

    try {
      const response = await getPharmaSale(token, tenantSlug, saleId);
      setState((current) => ({
        ...current,
        selectedSale: response.sale,
      }));
      setBatchSelections(buildBatchSelections(response.sale, state.batches));
      setPrescriptionChecks(buildPrescriptionChecks(response.sale));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sale detail.');
    } finally {
      setIsLoadingSale(false);
    }
  }

  async function handleConfirmSale() {
    const sale = state.selectedSale;

    if (!sale) return;

    if (sale.status !== 'draft') {
      setError('Only draft sales can be confirmed.');
      return;
    }

    const items = sale.items ?? [];

    if (items.length === 0) {
      setError('This sale has no items to confirm.');
      return;
    }

    const notReadyItems = items.filter((item) => {
      const hasBatch = Boolean(Number(batchSelections[item.id]));
      const prescriptionOk = !item.requires_prescription || Boolean(prescriptionChecks[item.id]);

      return !hasBatch || !prescriptionOk;
    });

    if (notReadyItems.length > 0) {
      setError('Every sale item must have an eligible batch and required prescription verification before confirmation.');
      return;
    }

    setIsConfirming(true);
    setError('');
    setNotice('');

    try {
      const response = await confirmPharmaSale(token, tenantSlug, sale.id, {
        items: items.map((item) => ({
          sale_item_id: item.id,
          stock_batch_id: Number(batchSelections[item.id]),
          prescription_verified: Boolean(prescriptionChecks[item.id]),
        })),
      });

      const [salesResponse, batchesResponse] = await Promise.all([
        getPharmaSales(token, tenantSlug),
        getPharmaInventoryBatches(token, tenantSlug),
      ]);

      setState((current) => ({
        ...current,
        sales: salesResponse.sales,
        selectedSale: response.sale,
        batches: batchesResponse.batches,
      }));
      setBatchSelections(buildBatchSelections(response.sale, batchesResponse.batches));
      setPrescriptionChecks(buildPrescriptionChecks(response.sale));
      setNotice(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to confirm sale.');
    } finally {
      setIsConfirming(false);
    }
  }

  const selectedSale = state.selectedSale;
  const saleItems = selectedSale?.items ?? [];
  const isDraftSale = selectedSale?.status === 'draft';

  const readinessItems = saleItems.map((item) => {
    const selectedBatch = state.batches.find((batch) => batch.id === Number(batchSelections[item.id]));
    const needsPrescription = item.requires_prescription && !prescriptionChecks[item.id];
    const needsBatch = !selectedBatch;
    const ready = !needsPrescription && !needsBatch;

    return {
      item,
      selectedBatch,
      eligibleBatches: eligibleBatchesForItem(item, selectedSale, state.batches),
      needsPrescription,
      needsBatch,
      ready,
    };
  });

  const readyCount = readinessItems.filter((item) => item.ready).length;
  const canConfirmSelectedSale = Boolean(selectedSale && isDraftSale && saleItems.length > 0 && readyCount === saleItems.length);

  return (
    <article className="panel wide sales-review-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Sales and dispensing review</h2>
          <p className="muted">
            Review customers, prescriptions, draft sales and controlled dispensing readiness before stock deduction.
          </p>
        </div>

        <button type="button" onClick={loadSalesReview} disabled={isLoading}>
          {isLoading ? 'Loading…' : 'Load sales review'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {notice && <div className="form-success">{notice}</div>}

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
            <span>items ready for controlled confirmation</span>
            <small>
              Confirmation deducts stock, creates sale_dispensed movements and records an audit log.
            </small>
          </div>

          <div className="sale-items-grid">
            {readinessItems.map(({ item, selectedBatch, eligibleBatches, needsPrescription, needsBatch, ready }) => (
              <div key={item.id} className={ready ? 'ready-item' : 'pending-item'}>
                <div>
                  <strong>{item.product_name_snapshot}</strong>
                  <span>{item.sku_snapshot} · Qty {item.quantity}</span>
                </div>

                <div className="mini-facts">
                  <span>Line total: {money(item.line_total)}</span>
                  <span>Prescription: {item.requires_prescription ? (prescriptionChecks[item.id] ? 'verified' : 'required') : 'not required'}</span>
                  <span>Batch: {selectedBatch?.batch_number ?? item.stock_batch?.batch_number ?? 'not assigned'}</span>
                  <span>Location: {selectedBatch?.stock_location.name ?? item.stock_location?.name ?? 'not assigned'}</span>
                </div>

                {isDraftSale && (
                  <div className="confirmation-controls">
                    <label>
                      Dispensing batch
                      <select
                        value={batchSelections[item.id] ?? ''}
                        onChange={(event) =>
                          setBatchSelections((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select eligible batch</option>
                        {eligibleBatches.map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            {batch.batch_number} · {batch.stock_location.name} · available {batch.available_quantity} · expires {formatDate(batch.expiry_date)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {item.requires_prescription ? (
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={Boolean(prescriptionChecks[item.id])}
                          onChange={(event) =>
                            setPrescriptionChecks((current) => ({
                              ...current,
                              [item.id]: event.target.checked,
                            }))
                          }
                        />
                        Prescription verified
                      </label>
                    ) : (
                      <small>No prescription verification required for this item.</small>
                    )}
                  </div>
                )}

                <small>
                  {ready
                    ? 'Ready for controlled confirmation.'
                    : [
                        needsPrescription ? 'Prescription verification needed' : null,
                        needsBatch ? 'Eligible stock batch needed' : null,
                      ].filter(Boolean).join(' · ')}
                </small>
              </div>
            ))}
          </div>

          <div className="confirmation-footer">
            <div>
              <strong>Controlled sale confirmation</strong>
              <p className="muted">
                This action is irreversible in the current foundation. It deducts stock once and prevents double confirmation.
              </p>
            </div>

            <button
              type="button"
              className="danger-action"
              onClick={handleConfirmSale}
              disabled={!canConfirmSelectedSale || isConfirming}
            >
              {isConfirming ? 'Confirming…' : selectedSale.status === 'draft' ? 'Confirm and dispense stock' : 'Sale already dispensed'}
            </button>
          </div>
        </section>
      )}
    </article>
  );
}

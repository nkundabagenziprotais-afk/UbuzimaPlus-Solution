import { useMemo, useState } from 'react';
import { SalesCreationPanel } from './SalesCreationPanel';
import {
  AccessProfile,
  PharmaBranch,
  PharmaCustomer,
  PharmaPrescription,
  PharmaSale,
  PharmaSaleItem,
  PharmaPayment,
  PharmaProduct,
  PharmaSalesResponse,
  PharmaSalesFilters,
  PharmaStockBatch,
  confirmPharmaSale,
  getPharmaBranches,
  recordPharmaPayment,
  getPharmaCustomers,
  getPharmaProducts,
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
  branches: PharmaBranch[];
  customers: PharmaCustomer[];
  prescriptions: PharmaPrescription[];
  sales: PharmaSale[];
  selectedSale: PharmaSale | null;
  batches: PharmaStockBatch[];
  products: PharmaProduct[];
};

type BatchSelections = Record<number, string>;
type PrescriptionChecks = Record<number, boolean>;

type PaymentMethod = 'cash' | 'momo' | 'card' | 'insurance' | 'credit' | 'bank_transfer';

type PaymentFormState = {
  amount: string;
  payment_method: PaymentMethod;
  reference_number: string;
  notes: string;
};

type SalesStatusFilter = 'all' | 'draft' | 'dispensed' | 'cancelled';
type PaymentStatusFilter = 'all' | 'unpaid' | 'partial' | 'paid' | 'refunded';
type SaleTypeFilter = 'all' | 'cash_sale' | 'prescription_sale' | 'insurance_sale' | 'credit_sale';

type SalesFiltersState = {
  status: SalesStatusFilter;
  payment_status: PaymentStatusFilter;
  sale_type: SaleTypeFilter;
  branch_id: string;
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
    profile.tenant_assignments?.find((assignment) => assignment.status === 'active')?.tenant?.slug ||
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

function defaultPaymentForm(sale: PharmaSale | null): PaymentFormState {
  const balance = Number(sale?.balance_amount ?? 0);

  return {
    amount: balance > 0 ? String(Math.round(balance * 100) / 100) : '',
    payment_method: 'cash',
    reference_number: '',
    notes: '',
  };
}

function buildPrescriptionChecks(sale: PharmaSale | null): PrescriptionChecks {
  if (!sale?.items?.length) return {};

  return sale.items.reduce<PrescriptionChecks>((carry, item) => {
    carry[item.id] = Boolean(item.prescription_verified);
    return carry;
  }, {});
}

function defaultSalesFilters(): SalesFiltersState {
  return {
    status: 'all',
    payment_status: 'all',
    sale_type: 'all',
    branch_id: 'all',
  };
}

function labelize(value: string): string {
  return value.replaceAll('_', ' ');
}

function paymentStatusTone(status: string): string {
  if (status === 'paid') return 'stable';
  if (status === 'partial') return 'attention';
  if (status === 'unpaid') return 'warning';
  if (status === 'refunded') return 'neutral';

  return 'neutral';
}

function paymentStatusGuidance(status: string, balance: number): string {
  if (status === 'paid' || balance <= 0) {
    return 'Receipt trail is complete and no balance remains.';
  }

  if (status === 'partial') {
    return 'A balance remains. Confirm the next collection step before closing the sale.';
  }

  if (status === 'unpaid') {
    return 'Payment has not been collected yet. Keep this sale visible for follow-up.';
  }

  return 'Review payment status before dispensing or closing the sale.';
}

function prescriptionTone(required: number, verified: number): string {
  if (required === 0) return 'stable';
  if (verified >= required) return 'stable';
  if (verified > 0) return 'attention';

  return 'warning';
}

function prescriptionGuidance(required: number, verified: number): string {
  if (required === 0) {
    return 'No prescription verification is required for the current items.';
  }

  if (verified >= required) {
    return 'Required prescription checks are complete.';
  }

  return `${required - verified} prescription check${required - verified === 1 ? '' : 's'} still need confirmation.`;
}

function salesFiltersToApiFilters(filters: SalesFiltersState): PharmaSalesFilters {
  return {
    status: filters.status === 'all' ? undefined : filters.status,
    payment_status: filters.payment_status === 'all' ? undefined : filters.payment_status,
    sale_type: filters.sale_type === 'all' ? undefined : filters.sale_type,
    branch_id: filters.branch_id === 'all' ? undefined : Number(filters.branch_id),
  };
}

export function SalesDispensingReview({ token, profile }: Props) {
  const [state, setState] = useState<SalesReviewState>({
    branches: [],
    customers: [],
    prescriptions: [],
    sales: [],
    selectedSale: null,
    batches: [],
    products: [],
  });
  const [batchSelections, setBatchSelections] = useState<BatchSelections>({});
  const [prescriptionChecks, setPrescriptionChecks] = useState<PrescriptionChecks>({});
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(defaultPaymentForm(null));
  const [lastPayment, setLastPayment] = useState<PharmaPayment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSale, setIsLoadingSale] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [salesFilters, setSalesFilters] = useState<SalesFiltersState>(defaultSalesFilters());

  const tenantSlug = useMemo(() => getTenantSlug(profile), [profile]);
  const canReadSales = (profile.permissions ?? []).includes('pharmaco.sales.manage');

  const apiSalesFilters = useMemo(() => salesFiltersToApiFilters(salesFilters), [salesFilters]);

  const activeFilterText = useMemo(() => {
    const values = [
      salesFilters.status !== 'all' ? `Status: ${labelize(salesFilters.status)}` : null,
      salesFilters.payment_status !== 'all' ? `Payment: ${labelize(salesFilters.payment_status)}` : null,
      salesFilters.sale_type !== 'all' ? `Type: ${labelize(salesFilters.sale_type)}` : null,
      salesFilters.branch_id !== 'all'
        ? `Branch: ${state.branches.find((branch) => branch.id === Number(salesFilters.branch_id))?.name ?? salesFilters.branch_id}`
        : null,
    ].filter(Boolean);

    return values.length ? values.join(' · ') : 'All sales';
  }, [salesFilters, state.branches]);

  const salesSummary = useMemo(() => {
    const draftSales = state.sales.filter((sale) => sale.status === 'draft');
    const dispensedSales = state.sales.filter((sale) => sale.status === 'dispensed');
    const totalValue = state.sales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const openBalance = state.sales.reduce((sum, sale) => sum + sale.balance_amount, 0);

    const unpaidSales = state.sales.filter((sale) => sale.payment_status === 'unpaid');
    const partialSales = state.sales.filter((sale) => sale.payment_status === 'partial');
    const paidSales = state.sales.filter((sale) => sale.payment_status === 'paid');

    return {
      draftSales: draftSales.length,
      dispensedSales: dispensedSales.length,
      unpaidSales: unpaidSales.length,
      partialSales: partialSales.length,
      paidSales: paidSales.length,
      totalValue,
      openBalance,
    };
  }, [state.sales]);

  const salesQueues = useMemo(() => {
    const draft = state.sales.filter((sale) => sale.status === 'draft');
    const readyToDispense = draft.filter((sale) => Number(sale.items_count ?? sale.items?.length ?? 0) > 0);
    const dispensed = state.sales.filter((sale) => sale.status === 'dispensed');
    const unpaid = state.sales.filter((sale) => sale.payment_status === 'unpaid');
    const partiallyPaid = state.sales.filter((sale) => sale.payment_status === 'partial');
    const paid = state.sales.filter((sale) => sale.payment_status === 'paid');

    return {
      draft,
      readyToDispense,
      dispensed,
      unpaid,
      partiallyPaid,
      paid,
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
      const [
        branchesResponse,
        customersResponse,
        prescriptionsResponse,
        salesResponse,
        batchesResponse,
        productsResponse,
      ] = await Promise.all([
        getPharmaBranches(token, tenantSlug),
        getPharmaCustomers(token, tenantSlug),
        getPharmaPrescriptions(token, tenantSlug),
        getPharmaSales(token, tenantSlug, apiSalesFilters),
        getPharmaInventoryBatches(token, tenantSlug),
        getPharmaProducts(token, tenantSlug),
      ]);

      const firstSale = (salesResponse as PharmaSalesResponse).sales[0] ?? null;
      const selectedSale = firstSale
        ? (await getPharmaSale(token, tenantSlug, firstSale.id)).sale
        : null;

      setState({
        branches: branchesResponse.branches,
        customers: customersResponse.customers,
        prescriptions: prescriptionsResponse.prescriptions,
        sales: salesResponse.sales,
        selectedSale,
        batches: batchesResponse.batches,
        products: productsResponse.products,
      });
      setBatchSelections(buildBatchSelections(selectedSale, batchesResponse.batches));
      setPrescriptionChecks(buildPrescriptionChecks(selectedSale));
      setPaymentForm(defaultPaymentForm(selectedSale));
      setLastPayment(null);
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
      setPaymentForm(defaultPaymentForm(response.sale));
      setLastPayment(null);
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
        getPharmaSales(token, tenantSlug, apiSalesFilters),
        getPharmaInventoryBatches(token, tenantSlug),
      ]);

      setState((current) => ({
        ...current,
        sales: salesResponse.sales,
        selectedSale: response.sale,
        batches: batchesResponse.batches,
        products: current.products,
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

  async function handleRecordPayment() {
    const sale = state.selectedSale;

    if (!sale) return;

    if (sale.status === 'draft') {
      setError('Draft sales must be confirmed and dispensed before payment can be recorded.');
      return;
    }

    if (sale.payment_status === 'paid' || Number(sale.balance_amount) <= 0) {
      setError('This sale is already fully paid.');
      return;
    }

    const amount = Number(paymentForm.amount);
    const balance = Number(sale.balance_amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid payment amount greater than zero.');
      return;
    }

    if (amount > balance) {
      setError(`Payment amount cannot exceed the current balance of ${money(balance)}.`);
      return;
    }

    setIsRecordingPayment(true);
    setError('');
    setNotice('');

    try {
      const response = await recordPharmaPayment(token, tenantSlug, sale.id, {
        amount,
        payment_method: paymentForm.payment_method,
        reference_number: paymentForm.reference_number.trim() || null,
        notes: paymentForm.notes.trim() || null,
      });

      const salesResponse = await getPharmaSales(token, tenantSlug);

      setState((current) => ({
        ...current,
        sales: salesResponse.sales,
        selectedSale: response.sale,
      }));
      setLastPayment(response.payment);
      setPaymentForm(defaultPaymentForm(response.sale));
      setNotice(`${response.message} Receipt: ${response.payment.receipt_number ?? 'Not generated'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record payment.');
    } finally {
      setIsRecordingPayment(false);
    }
  }


  function handleCustomerCreated(customer: PharmaCustomer) {
    setState((current) => ({
      ...current,
      customers: [customer, ...current.customers.filter((entry) => entry.id !== customer.id)],
    }));
  }

  function handlePrescriptionCreated(prescription: PharmaPrescription) {
    setState((current) => ({
      ...current,
      prescriptions: [
        prescription,
        ...current.prescriptions.filter((entry) => entry.id !== prescription.id),
      ],
    }));
  }

  function handleSaleCreated(sale: PharmaSale) {
    setState((current) => ({
      ...current,
      sales: [sale, ...current.sales.filter((entry) => entry.id !== sale.id)],
      selectedSale: sale,
    }));
    setBatchSelections(buildBatchSelections(sale, state.batches));
    setPrescriptionChecks(buildPrescriptionChecks(sale));
    setPaymentForm(defaultPaymentForm(sale));
    setLastPayment(null);
  }

  function handleResetSalesFilters() {
    setSalesFilters(defaultSalesFilters());
    setNotice('Sales filters reset. Load sales review to refresh the list.');
    setError('');
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
  const requiredPrescriptionCount = readinessItems.filter((entry) => entry.item.requires_prescription).length;
  const verifiedPrescriptionCount = readinessItems.filter(
    (entry) => entry.item.requires_prescription && Boolean(prescriptionChecks[entry.item.id]),
  ).length;
  const paymentBalance = Number(selectedSale?.balance_amount ?? 0);
  const selectedPaymentStatus = selectedSale?.payment_status ?? 'unpaid';
  const selectedPaymentTone = paymentStatusTone(selectedPaymentStatus);
  const selectedPrescriptionTone = prescriptionTone(requiredPrescriptionCount, verifiedPrescriptionCount);
  const selectedDispensingTone = canConfirmSelectedSale || selectedSale?.status === 'dispensed' ? 'stable' : isDraftSale ? 'attention' : 'neutral';
  const prescriptionStatusText =
    requiredPrescriptionCount === 0
      ? 'Not required'
      : `${verifiedPrescriptionCount}/${requiredPrescriptionCount} verified`;

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

      <section className="pharmaco-card sales-filter-panel">
        <div className="panel-heading-row">
          <div>
            <span className="section-label">Sales queues and filters</span>
            <h3>Focus the dispensing review</h3>
            <p className="muted">
              Use the existing backend filters to focus work by status, payment state, sale type and branch.
            </p>
          </div>
          <div className="sale-total-box">
            <span>Current view</span>
            <strong>{activeFilterText}</strong>
            <small>{state.sales.length} sale records loaded</small>
          </div>
        </div>

        <div className="sales-queue-grid" aria-label="Sales review queues">
          <button
            type="button"
            className={`queue-card ${salesFilters.status === 'draft' ? 'queue-card-active' : ''}`}
            aria-pressed={salesFilters.status === 'draft'}
            onClick={() => setSalesFilters((current) => ({ ...current, status: 'draft' }))}
          >
            <span>Draft queue</span>
            <strong>{salesQueues.draft.length}</strong>
            <small>Needs review before stock deduction</small>
          </button>
          <button
            type="button"
            className={`queue-card ${salesFilters.status === 'draft' ? 'queue-card-active' : ''}`}
            aria-pressed={salesFilters.status === 'draft'}
            onClick={() => setSalesFilters((current) => ({ ...current, status: 'draft' }))}
          >
            <span>Ready to dispense</span>
            <strong>{salesQueues.readyToDispense.length}</strong>
            <small>Draft sales with line items</small>
          </button>
          <button
            type="button"
            className={`queue-card ${salesFilters.status === 'dispensed' ? 'queue-card-active' : ''}`}
            aria-pressed={salesFilters.status === 'dispensed'}
            onClick={() => setSalesFilters((current) => ({ ...current, status: 'dispensed' }))}
          >
            <span>Dispensed</span>
            <strong>{salesQueues.dispensed.length}</strong>
            <small>Stock already deducted</small>
          </button>
          <button
            type="button"
            className={`queue-card ${salesFilters.payment_status === 'unpaid' ? 'queue-card-active warning' : ''}`}
            aria-pressed={salesFilters.payment_status === 'unpaid'}
            onClick={() => setSalesFilters((current) => ({ ...current, payment_status: 'unpaid' }))}
          >
            <span>Unpaid</span>
            <strong>{salesQueues.unpaid.length}</strong>
            <small>Payment follow-up needed</small>
          </button>
          <button
            type="button"
            className={`queue-card ${salesFilters.payment_status === 'partial' ? 'queue-card-active attention' : ''}`}
            aria-pressed={salesFilters.payment_status === 'partial'}
            onClick={() => setSalesFilters((current) => ({ ...current, payment_status: 'partial' }))}
          >
            <span>Partially paid</span>
            <strong>{salesQueues.partiallyPaid.length}</strong>
            <small>Balance still open</small>
          </button>
          <button
            type="button"
            className={`queue-card ${salesFilters.payment_status === 'paid' ? 'queue-card-active stable' : ''}`}
            aria-pressed={salesFilters.payment_status === 'paid'}
            onClick={() => setSalesFilters((current) => ({ ...current, payment_status: 'paid' }))}
          >
            <span>Paid</span>
            <strong>{salesQueues.paid.length}</strong>
            <small>Receipt trail complete</small>
          </button>
        </div>

        <div className="sales-filter-grid">
          <label>
            Sale status
            <select
              value={salesFilters.status}
              onChange={(event) =>
                setSalesFilters((current) => ({
                  ...current,
                  status: event.target.value as SalesStatusFilter,
                }))
              }
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="dispensed">Dispensed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          <label>
            Payment status
            <select
              value={salesFilters.payment_status}
              onChange={(event) =>
                setSalesFilters((current) => ({
                  ...current,
                  payment_status: event.target.value as PaymentStatusFilter,
                }))
              }
            >
              <option value="all">All payment states</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
            </select>
          </label>

          <label>
            Sale type
            <select
              value={salesFilters.sale_type}
              onChange={(event) =>
                setSalesFilters((current) => ({
                  ...current,
                  sale_type: event.target.value as SaleTypeFilter,
                }))
              }
            >
              <option value="all">All sale types</option>
              <option value="cash_sale">Cash sale</option>
              <option value="prescription_sale">Prescription sale</option>
              <option value="insurance_sale">Insurance sale</option>
              <option value="credit_sale">Credit sale</option>
            </select>
          </label>

          <label>
            Branch
            <select
              value={salesFilters.branch_id}
              onChange={(event) =>
                setSalesFilters((current) => ({
                  ...current,
                  branch_id: event.target.value,
                }))
              }
            >
              <option value="all">All branches</option>
              {state.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="filter-action-row">
          <button type="button" onClick={loadSalesReview} disabled={isLoading}>
            {isLoading ? 'Applying filters…' : 'Apply filters'}
          </button>
          <button type="button" className="secondary-action" onClick={handleResetSalesFilters}>
            Reset filters
          </button>
        </div>
        <p className="filter-helper-text">
          Queue cards prepare a focused view. Apply filters reloads the list from the backend; reset returns the team to the full sales view.
        </p>
      </section>

      <SalesCreationPanel
        token={token}
        tenantSlug={tenantSlug}
        branches={state.branches}
        customers={state.customers}
        prescriptions={state.prescriptions}
        products={state.products}
        onCustomerCreated={handleCustomerCreated}
        onPrescriptionCreated={handlePrescriptionCreated}
        onSaleCreated={handleSaleCreated}
      />

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

          <div className="selected-sale-insight-grid">
            <article className={`insight-card ${selectedSale.status === 'dispensed' ? 'stable' : 'attention'}`}>
              <span>Status</span>
              <strong>{labelize(selectedSale.status)}</strong>
              <small>{selectedSale.status === 'dispensed' ? 'Stock movement completed' : 'Confirm readiness before dispensing'}</small>
            </article>
            <article className={`insight-card ${selectedPaymentTone}`}>
              <span>Payment</span>
              <strong>{labelize(selectedSale.payment_status)}</strong>
              <small>{paymentStatusGuidance(selectedPaymentStatus, paymentBalance)}</small>
            </article>
            <article className={`insight-card ${selectedPrescriptionTone}`}>
              <span>Prescription</span>
              <strong>{prescriptionStatusText}</strong>
              <small>{prescriptionGuidance(requiredPrescriptionCount, verifiedPrescriptionCount)}</small>
            </article>
            <article className={`insight-card ${selectedDispensingTone}`}>
              <span>Dispensing readiness</span>
              <strong>{readyCount}/{saleItems.length}</strong>
              <small>{canConfirmSelectedSale ? 'Ready for controlled confirmation' : 'Review batches and prescription checks'}</small>
            </article>
            <article>
              <span>Customer</span>
              <strong>{selectedSale.customer?.full_name ?? 'Walk-in'}</strong>
              <small>{selectedSale.customer?.phone ?? 'No phone captured'}</small>
            </article>
            <article>
              <span>Created</span>
              <strong>{formatDate(selectedSale.created_at)}</strong>
              <small>{selectedSale.sale_type.replaceAll('_', ' ')}</small>
            </article>
          </div>

          <div className="readiness-summary">
            <strong>{readyCount}/{saleItems.length}</strong>
            <span>items ready for controlled confirmation</span>
            <small>
              Confirmation deducts stock, creates sale_dispensed movements and records an audit log.
            </small>
          </div>


          <section className="payment-recording-card">
            <div className="panel-heading-row">
              <div>
                <span className="section-label">Payment and receipt</span>
                <h3>Record customer payment</h3>
                <p className="muted">
                  Payments can only be recorded after a sale has been dispensed. The backend generates the receipt number.
                </p>
              </div>
              <div className="sale-total-box">
                <span>Payment status</span>
                <strong>{selectedSale.payment_status.replaceAll('_', ' ')}</strong>
                <small>Paid: {money(selectedSale.paid_amount)} · Balance: {money(selectedSale.balance_amount)}</small>
              </div>
            </div>

            <div className="workflow-state-grid" aria-label="Payment and prescription workflow guidance">
              <article className={`workflow-state-card ${selectedPaymentTone}`}>
                <span>Payment guidance</span>
                <strong>{labelize(selectedPaymentStatus)}</strong>
                <small>{paymentStatusGuidance(selectedPaymentStatus, paymentBalance)}</small>
              </article>
              <article className={`workflow-state-card ${selectedPrescriptionTone}`}>
                <span>Prescription guidance</span>
                <strong>{prescriptionStatusText}</strong>
                <small>{prescriptionGuidance(requiredPrescriptionCount, verifiedPrescriptionCount)}</small>
              </article>
            </div>

            {selectedSale.status === 'draft' ? (
              <div className="form-error">
                Confirm and dispense this sale before recording payment.
              </div>
            ) : selectedSale.payment_status === 'paid' || Number(selectedSale.balance_amount) <= 0 ? (
              <div className="form-success">
                This sale is fully paid.
              </div>
            ) : (
              <div className="payment-form-grid">
                <label>
                  Amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Payment method
                  <select
                    value={paymentForm.payment_method}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        payment_method: event.target.value as PaymentMethod,
                      }))
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="momo">Mobile Money</option>
                    <option value="card">Card</option>
                    <option value="insurance">Insurance</option>
                    <option value="credit">Credit</option>
                    <option value="bank_transfer">Bank transfer</option>
                  </select>
                </label>

                <label>
                  Reference number
                  <input
                    type="text"
                    value={paymentForm.reference_number}
                    placeholder="MoMo, card, bank or insurance reference"
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        reference_number: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Notes
                  <textarea
                    value={paymentForm.notes}
                    placeholder="Optional payment note"
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="payment-action-row">
                  <button type="button" onClick={handleRecordPayment} disabled={isRecordingPayment}>
                    {isRecordingPayment ? 'Recording payment…' : 'Record payment and generate receipt'}
                  </button>
                </div>
              </div>
            )}

            {lastPayment && (
              <div className="receipt-preview">
                <span>Latest receipt</span>
                <strong>{lastPayment.receipt_number ?? 'Receipt pending'}</strong>
                <small>
                  {money(lastPayment.amount)} · {lastPayment.payment_method.replaceAll('_', ' ')} · {lastPayment.status}
                </small>
              </div>
            )}

            {selectedSale.payments?.length ? (
              <div className="payment-history">
                <h4>Payment history</h4>
                {selectedSale.payments.map((payment) => (
                  <div key={payment.id}>
                    <strong>{payment.receipt_number ?? payment.reference_number ?? `Payment #${payment.id}`}</strong>
                    <span>{money(payment.amount)} · {payment.payment_method.replaceAll('_', ' ')}</span>
                    <small>{payment.status} · {formatDate(payment.received_at)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No payment has been recorded for this sale yet.</p>
            )}
          </section>

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

import { useEffect, useMemo, useState } from 'react';
import {
  approvePharmaSupplierInvoice,
  createPharmaSupplierInvoice,
  getPharmaPurchaseOrders,
  getPharmaSupplierInvoice,
  getPharmaSupplierInvoices,
  getPharmaSuppliers,
  PharmaPurchaseOrder,
  PharmaPurchaseOrderItem,
  PharmaSupplier,
  PharmaSupplierInvoice,
  recordPharmaSupplierPayment,
} from '../lib/api';

type PayablesWorkflowProps = {
  token?: string;
  tenantSlug?: string;
  profile?: Record<string, any>;
  permissions?: string[];
  [key: string]: any;
};

type PayablesState = {
  suppliers: PharmaSupplier[];
  purchaseOrders: PharmaPurchaseOrder[];
  invoices: PharmaSupplierInvoice[];
  selectedInvoice: PharmaSupplierInvoice | null;
};

type InvoiceLineForm = {
  pharmaco_purchase_order_item_id: string;
  product_name: string;
  quantity: string;
  unit_cost: string;
  discount_amount: string;
  tax_amount: string;
  notes: string;
};

type InvoiceForm = {
  supplier_id: string;
  purchase_order_id: string;
  supplier_invoice_number: string;
  invoice_date: string;
  due_date: string;
  discount_amount: string;
  tax_amount: string;
  notes: string;
  items: InvoiceLineForm[];
};

type PaymentForm = {
  amount: string;
  payment_method: 'cash' | 'momo' | 'card' | 'bank_transfer' | 'cheque' | 'credit';
  reference_number: string;
  paid_at: string;
  notes: string;
};

type PayablesWorkspaceView =
  | 'overview'
  | 'create-payable'
  | 'supplier-invoices'
  | 'approval-queue'
  | 'record-payment';

const money = new Intl.NumberFormat('en-RW', {
  style: 'currency',
  currency: 'RWF',
  maximumFractionDigits: 0,
});

function blankInvoiceForm(): InvoiceForm {
  return {
    supplier_id: '',
    purchase_order_id: '',
    supplier_invoice_number: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    discount_amount: '0',
    tax_amount: '0',
    notes: '',
    items: [],
  };
}

function blankPaymentForm(): PaymentForm {
  return {
    amount: '',
    payment_method: 'bank_transfer',
    reference_number: '',
    paid_at: new Date().toISOString().slice(0, 10),
    notes: '',
  };
}

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return 'Not set';
  }

  return new Date(value).toLocaleDateString();
}

function deriveTenantSlug(props: PayablesWorkflowProps): string {
  return (
    props.tenantSlug ||
    props.profile?.tenant?.slug ||
    props.profile?.tenant_slug ||
    props.profile?.current_tenant?.slug ||
    props.tenant?.slug ||
    ''
  );
}

function deriveToken(props: PayablesWorkflowProps): string {
  return props.token || props.accessToken || props.session?.accessToken || props.session?.token || '';
}

export function PayablesWorkflow(props: PayablesWorkflowProps) {
  const token = deriveToken(props);
  const tenantSlug = deriveTenantSlug(props);
  const permissions = props.permissions ?? props.profile?.permissions ?? [];
  const hasProcurementAccess = permissions.length === 0 || permissions.includes('pharmaco.suppliers.manage');

  const [state, setState] = useState<PayablesState>({
    suppliers: [],
    purchaseOrders: [],
    invoices: [],
    selectedInvoice: null,
  });
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>(blankInvoiceForm());
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(blankPaymentForm());
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isApprovingInvoice, setIsApprovingInvoice] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [activePayablesView, setActivePayablesView] = useState<PayablesWorkspaceView>('overview');

  const approvedPurchaseOrders = useMemo(() => {
    return state.purchaseOrders.filter((purchaseOrder) =>
      ['approved', 'partially_received', 'received'].includes(purchaseOrder.status),
    );
  }, [state.purchaseOrders]);

  const selectedPurchaseOrder = useMemo(() => {
    return approvedPurchaseOrders.find((purchaseOrder) => purchaseOrder.id === Number(invoiceForm.purchase_order_id));
  }, [approvedPurchaseOrders, invoiceForm.purchase_order_id]);

  const kpis = useMemo(() => {
    const outstanding = state.invoices.reduce((total, invoice) => total + toNumber(invoice.balance_amount), 0);
    const approved = state.invoices.filter((invoice) => invoice.status === 'approved').length;
    const partiallyPaid = state.invoices.filter((invoice) => invoice.status === 'partially_paid').length;
    const paid = state.invoices.filter((invoice) => invoice.status === 'paid').length;
    const overdue = state.invoices.filter((invoice) => {
      if (!invoice.due_date || invoice.balance_amount <= 0) {
        return false;
      }

      return new Date(invoice.due_date).getTime() < Date.now();
    }).length;

    return { outstanding, approved, partiallyPaid, paid, overdue };
  }, [state.invoices]);

  const invoicePreviewTotal = useMemo(() => {
    const linesTotal = invoiceForm.items.reduce((total, item) => {
      const quantity = toNumber(item.quantity);
      const unitCost = toNumber(item.unit_cost);
      const discount = toNumber(item.discount_amount);
      const tax = toNumber(item.tax_amount);

      return total + Math.max(quantity * unitCost - discount + tax, 0);
    }, 0);

    return Math.max(linesTotal - toNumber(invoiceForm.discount_amount) + toNumber(invoiceForm.tax_amount), 0);
  }, [invoiceForm]);

  const invoiceQueues = useMemo(() => {
    const draft = state.invoices.filter((invoice) => invoice.status === 'draft');
    const payable = state.invoices.filter(
      (invoice) => ['approved', 'partially_paid'].includes(invoice.status) && toNumber(invoice.balance_amount) > 0,
    );
    const overdue = state.invoices.filter((invoice) => {
      if (!invoice.due_date || toNumber(invoice.balance_amount) <= 0) {
        return false;
      }

      return new Date(invoice.due_date).getTime() < Date.now();
    });

    return { draft, payable, overdue };
  }, [state.invoices]);

  useEffect(() => {
    if (!token || !tenantSlug || !hasProcurementAccess) {
      return;
    }

    void loadPayables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantSlug, hasProcurementAccess]);

  async function loadPayables() {
    setIsLoading(true);
    setError('');

    try {
      const [suppliersResponse, purchaseOrdersResponse, invoicesResponse] = await Promise.all([
        getPharmaSuppliers(token, tenantSlug),
        getPharmaPurchaseOrders(token, tenantSlug),
        getPharmaSupplierInvoices(token, tenantSlug),
      ]);

      setState((current) => ({
        ...current,
        suppliers: suppliersResponse.suppliers,
        purchaseOrders: purchaseOrdersResponse.purchase_orders,
        invoices: invoicesResponse.supplier_invoices,
        selectedInvoice:
          current.selectedInvoice &&
          invoicesResponse.supplier_invoices.some((invoice) => invoice.id === current.selectedInvoice?.id)
            ? current.selectedInvoice
            : null,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load supplier payables.');
    } finally {
      setIsLoading(false);
    }
  }

  async function selectInvoice(invoiceId: number) {
    setError('');
    setNotice('');

    try {
      const response = await getPharmaSupplierInvoice(token, tenantSlug, invoiceId);
      setState((current) => ({
        ...current,
        selectedInvoice: response.supplier_invoice,
      }));
      setPaymentForm((current) => ({
        ...current,
        amount: response.supplier_invoice.balance_amount > 0 ? String(response.supplier_invoice.balance_amount) : '',
      }));
      setActivePayablesView(response.supplier_invoice.status === 'draft' ? 'approval-queue' : 'record-payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open supplier invoice.');
    }
  }

  function applyPurchaseOrderToInvoice(purchaseOrderId: string) {
    const purchaseOrder = approvedPurchaseOrders.find((item) => item.id === Number(purchaseOrderId));

    if (!purchaseOrder) {
      setInvoiceForm((current) => ({
        ...current,
        purchase_order_id: purchaseOrderId,
        items: [],
      }));
      return;
    }

    setInvoiceForm((current) => ({
      ...current,
      supplier_id: String(purchaseOrder.supplier?.id ?? current.supplier_id),
      purchase_order_id: purchaseOrderId,
      items: (purchaseOrder.items ?? []).map((item: PharmaPurchaseOrderItem) => ({
        pharmaco_purchase_order_item_id: String(item.id),
        product_name: item.product_name_snapshot || item.product?.name || 'Purchase order item',
        quantity: String(Math.max(toNumber(item.quantity_received) || toNumber(item.quantity_ordered) || 1, 0.001)),
        unit_cost: String(toNumber(item.unit_cost)),
        discount_amount: '0',
        tax_amount: '0',
        notes: '',
      })),
    }));
  }

  function updateInvoiceLine(index: number, patch: Partial<InvoiceLineForm>) {
    setInvoiceForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  async function createInvoice() {
    if (!invoiceForm.supplier_id) {
      setError('Select a supplier first.');
      return;
    }

    if (invoiceForm.items.length === 0) {
      setError('Select an approved purchase order with at least one item.');
      return;
    }

    setIsCreatingInvoice(true);
    setError('');
    setNotice('');

    try {
      const response = await createPharmaSupplierInvoice(token, tenantSlug, {
        pharmaco_supplier_id: Number(invoiceForm.supplier_id),
        pharmaco_purchase_order_id: invoiceForm.purchase_order_id ? Number(invoiceForm.purchase_order_id) : null,
        supplier_invoice_number: invoiceForm.supplier_invoice_number || null,
        invoice_date: invoiceForm.invoice_date || null,
        due_date: invoiceForm.due_date || null,
        discount_amount: toNumber(invoiceForm.discount_amount),
        tax_amount: toNumber(invoiceForm.tax_amount),
        notes: invoiceForm.notes || null,
        items: invoiceForm.items.map((item) => ({
          pharmaco_purchase_order_item_id: item.pharmaco_purchase_order_item_id
            ? Number(item.pharmaco_purchase_order_item_id)
            : null,
          quantity: toNumber(item.quantity),
          unit_cost: toNumber(item.unit_cost),
          discount_amount: toNumber(item.discount_amount),
          tax_amount: toNumber(item.tax_amount),
          notes: item.notes || null,
        })),
      });

      const invoicesResponse = await getPharmaSupplierInvoices(token, tenantSlug);

      setState((current) => ({
        ...current,
        invoices: invoicesResponse.supplier_invoices,
        selectedInvoice: response.supplier_invoice,
      }));
      setInvoiceForm(blankInvoiceForm());
      setPaymentForm((current) => ({
        ...current,
        amount: String(response.supplier_invoice.balance_amount),
      }));
      setNotice(response.message);
      setActivePayablesView('approval-queue');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create supplier invoice.');
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  async function approveSelectedInvoice() {
    if (!state.selectedInvoice) {
      setError('Select a supplier invoice first.');
      return;
    }

    setIsApprovingInvoice(true);
    setError('');
    setNotice('');

    try {
      const response = await approvePharmaSupplierInvoice(token, tenantSlug, state.selectedInvoice.id);
      const invoicesResponse = await getPharmaSupplierInvoices(token, tenantSlug);

      setState((current) => ({
        ...current,
        invoices: invoicesResponse.supplier_invoices,
        selectedInvoice: response.supplier_invoice,
      }));
      setNotice(response.message);
      setActivePayablesView('record-payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve supplier invoice.');
    } finally {
      setIsApprovingInvoice(false);
    }
  }

  async function recordPayment() {
    if (!state.selectedInvoice) {
      setError('Select a supplier invoice first.');
      return;
    }

    setIsRecordingPayment(true);
    setError('');
    setNotice('');

    try {
      const response = await recordPharmaSupplierPayment(token, tenantSlug, state.selectedInvoice.id, {
        amount: toNumber(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        reference_number: paymentForm.reference_number || null,
        paid_at: paymentForm.paid_at || null,
        notes: paymentForm.notes || null,
      });
      const invoicesResponse = await getPharmaSupplierInvoices(token, tenantSlug);

      setState((current) => ({
        ...current,
        invoices: invoicesResponse.supplier_invoices,
        selectedInvoice: response.supplier_invoice,
      }));
      setPaymentForm(blankPaymentForm());
      setNotice(response.message);
      setActivePayablesView('supplier-invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record supplier payment.');
    } finally {
      setIsRecordingPayment(false);
    }
  }

  if (!hasProcurementAccess) {
    return null;
  }

  return (
    <section className="payables-panel payables-workspace-refined">
      <div className="section-heading payables-commercial-heading">
        <div>
          <span>Supplier payables</span>
          <h2>Supplier invoices and accounts payable</h2>
          <p>
            Separate supplier invoice creation, review, approval, payment, and exception follow-up into focused finance workspaces.
          </p>
        </div>

        <button type="button" onClick={loadPayables} disabled={isLoading}>
          {isLoading ? 'Refreshing…' : 'Refresh payables'}
        </button>
      </div>

      <div className="payables-command-strip" aria-label="Supplier payables workflow map">
        <article>
          <span>01</span>
          <strong>Create payable</strong>
          <small>Capture supplier invoice details from an approved purchase order.</small>
        </article>
        <article>
          <span>02</span>
          <strong>Review and approve</strong>
          <small>Check invoice status, due date, supplier, balance, and supporting items.</small>
        </article>
        <article>
          <span>03</span>
          <strong>Record payment</strong>
          <small>Settle only approved or partially paid invoices with a clear payment trail.</small>
        </article>
      </div>

      <div className="procurement-kpi-grid payables-kpi-grid" aria-label="Supplier payables summary">
        <article>
          <span>Outstanding payables</span>
          <strong>{money.format(kpis.outstanding)}</strong>
          <small>Open supplier balance</small>
        </article>
        <article>
          <span>Draft invoices</span>
          <strong>{invoiceQueues.draft.length}</strong>
          <small>Need approval review</small>
        </article>
        <article>
          <span>Approved invoices</span>
          <strong>{kpis.approved}</strong>
          <small>Ready for payment</small>
        </article>
        <article>
          <span>Partially paid</span>
          <strong>{kpis.partiallyPaid}</strong>
          <small>Still has balance</small>
        </article>
        <article>
          <span>Overdue</span>
          <strong>{kpis.overdue}</strong>
          <small>Due date passed</small>
        </article>
      </div>

      {notice && <div className="notice-banner">{notice}</div>}
      {error && <div className="error-banner">{error}</div>}

      <nav className="payables-child-nav" aria-label="Supplier payables child workspaces">
        <button
          type="button"
          className={activePayablesView === 'overview' ? 'active' : ''}
          onClick={() => setActivePayablesView('overview')}
        >
          <span>Overview</span>
          <strong>{state.invoices.length}</strong>
        </button>
        <button
          type="button"
          className={activePayablesView === 'create-payable' ? 'active' : ''}
          onClick={() => setActivePayablesView('create-payable')}
        >
          <span>Create payable</span>
          <strong>{approvedPurchaseOrders.length}</strong>
        </button>
        <button
          type="button"
          className={activePayablesView === 'supplier-invoices' ? 'active' : ''}
          onClick={() => setActivePayablesView('supplier-invoices')}
        >
          <span>Supplier invoices</span>
          <strong>{state.invoices.length}</strong>
        </button>
        <button
          type="button"
          className={activePayablesView === 'approval-queue' ? 'active' : ''}
          onClick={() => setActivePayablesView('approval-queue')}
        >
          <span>Approval queue</span>
          <strong>{invoiceQueues.draft.length}</strong>
        </button>
        <button
          type="button"
          className={activePayablesView === 'record-payment' ? 'active' : ''}
          onClick={() => setActivePayablesView('record-payment')}
        >
          <span>Record payment</span>
          <strong>{invoiceQueues.payable.length}</strong>
        </button>
      </nav>

      {activePayablesView === 'overview' && (
        <section className="payables-child-page payables-overview-page">
          <article className="payables-workflow-card">
            <span className="section-label">Recommended finance flow</span>
            <h3>Run payables as separate workspaces</h3>
            <p>
              The payables process is easier to control when invoice capture, invoice review, approval,
              and payment are not competing on one screen.
            </p>

            <div className="payables-overview-grid">
              <button type="button" onClick={() => setActivePayablesView('create-payable')}>
                <span>01</span>
                <strong>Create payable</strong>
                <small>Supplier invoice from purchase order</small>
              </button>
              <button type="button" onClick={() => setActivePayablesView('supplier-invoices')}>
                <span>02</span>
                <strong>Supplier invoices</strong>
                <small>Table-based invoice register</small>
              </button>
              <button type="button" onClick={() => setActivePayablesView('approval-queue')}>
                <span>03</span>
                <strong>Approval queue</strong>
                <small>Draft invoices awaiting decision</small>
              </button>
              <button type="button" onClick={() => setActivePayablesView('record-payment')}>
                <span>04</span>
                <strong>Record payment</strong>
                <small>Approved balances ready to settle</small>
              </button>
            </div>
          </article>

          <article className="payables-workflow-card">
            <span className="section-label">Exception focus</span>
            <h3>Finance attention needed</h3>
            <div className="payables-exception-list">
              <div>
                <strong>{invoiceQueues.overdue.length}</strong>
                <span>Overdue supplier invoices</span>
              </div>
              <div>
                <strong>{invoiceQueues.draft.length}</strong>
                <span>Draft invoices needing approval</span>
              </div>
              <div>
                <strong>{invoiceQueues.payable.length}</strong>
                <span>Approved balances ready for payment</span>
              </div>
            </div>
          </article>
        </section>
      )}

      {activePayablesView === 'create-payable' && (
        <section className="payables-child-page">
          <section className="draft-sale-builder payables-builder payables-focused-card">
            <div className="form-header">
              <div>
                <span>Create payable</span>
                <h3>Supplier invoice from purchase order</h3>
                <p className="muted">
                  Use this page only for invoice capture. Approval and payment are handled in their own workspaces.
                </p>
              </div>
              <button type="button" onClick={loadPayables} disabled={isLoading}>
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            <div className="payables-form-section-title">
              <strong>Purchase order source</strong>
              <span>Select an approved purchase order to populate invoice items.</span>
            </div>

            <div className="creation-form-grid payables-form-grid">
              <label>
                Approved purchase order
                <select
                  value={invoiceForm.purchase_order_id}
                  onChange={(event) => applyPurchaseOrderToInvoice(event.target.value)}
                >
                  <option value="">Select approved PO</option>
                  {approvedPurchaseOrders.map((purchaseOrder) => (
                    <option key={purchaseOrder.id} value={purchaseOrder.id}>
                      {purchaseOrder.po_number} · {purchaseOrder.supplier?.name ?? 'Supplier'} ·{' '}
                      {money.format(purchaseOrder.total_amount)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Supplier
                <select
                  value={invoiceForm.supplier_id}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, supplier_id: event.target.value }))}
                >
                  <option value="">Select supplier</option>
                  {state.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} · {supplier.supplier_code}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Supplier invoice number
                <input
                  value={invoiceForm.supplier_invoice_number}
                  onChange={(event) =>
                    setInvoiceForm((current) => ({ ...current, supplier_invoice_number: event.target.value }))
                  }
                  placeholder="External supplier invoice"
                />
              </label>

              <label>
                Invoice date
                <input
                  type="date"
                  value={invoiceForm.invoice_date}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, invoice_date: event.target.value }))}
                />
              </label>

              <label>
                Due date
                <input
                  type="date"
                  value={invoiceForm.due_date}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, due_date: event.target.value }))}
                />
              </label>

              <label>
                Invoice-level discount
                <input
                  type="number"
                  min="0"
                  value={invoiceForm.discount_amount}
                  onChange={(event) =>
                    setInvoiceForm((current) => ({ ...current, discount_amount: event.target.value }))
                  }
                />
              </label>

              <label>
                Invoice-level tax
                <input
                  type="number"
                  min="0"
                  value={invoiceForm.tax_amount}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, tax_amount: event.target.value }))}
                />
              </label>

              <label className="wide-field">
                Notes
                <input
                  value={invoiceForm.notes}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Optional internal note"
                />
              </label>
            </div>

            <div className="payables-form-section-title">
              <strong>Invoice items</strong>
              <span>{selectedPurchaseOrder ? selectedPurchaseOrder.po_number : 'Select a PO to populate items'}</span>
            </div>

            {invoiceForm.items.length === 0 ? (
              <div className="payables-empty-state">No invoice items selected yet.</div>
            ) : (
              <div className="payables-line-table-wrap">
                <table className="payables-line-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Unit cost</th>
                      <th>Discount</th>
                      <th>Tax</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceForm.items.map((item, index) => (
                      <tr key={`${item.pharmaco_purchase_order_item_id}-${index}`}>
                        <td>{item.product_name}</td>
                        <td>
                          <input
                            aria-label={`Quantity for ${item.product_name}`}
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={item.quantity}
                            onChange={(event) => updateInvoiceLine(index, { quantity: event.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Unit cost for ${item.product_name}`}
                            type="number"
                            min="0"
                            value={item.unit_cost}
                            onChange={(event) => updateInvoiceLine(index, { unit_cost: event.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Discount for ${item.product_name}`}
                            type="number"
                            min="0"
                            value={item.discount_amount}
                            onChange={(event) => updateInvoiceLine(index, { discount_amount: event.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Tax for ${item.product_name}`}
                            type="number"
                            min="0"
                            value={item.tax_amount}
                            onChange={(event) => updateInvoiceLine(index, { tax_amount: event.target.value })}
                          />
                        </td>
                        <td>
                          {money.format(
                            Math.max(
                              toNumber(item.quantity) * toNumber(item.unit_cost) -
                                toNumber(item.discount_amount) +
                                toNumber(item.tax_amount),
                              0,
                            ),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="payables-total-row">
              <span>Invoice preview total</span>
              <strong>{money.format(invoicePreviewTotal)}</strong>
            </div>

            <button type="button" onClick={createInvoice} disabled={isCreatingInvoice || invoiceForm.items.length === 0}>
              {isCreatingInvoice ? 'Creating invoice…' : 'Create supplier invoice'}
            </button>
          </section>
        </section>
      )}

      {activePayablesView === 'supplier-invoices' && (
        <section className="payables-child-page">
          <article className="payables-workflow-card">
            <div className="mini-section-heading">
              <strong>Supplier invoices register</strong>
              <span>{state.invoices.length} records</span>
            </div>

            {state.invoices.length === 0 ? (
              <div className="payables-empty-state">No supplier invoices yet.</div>
            ) : (
              <div className="payables-register-table-wrap">
                <table className="payables-register-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Supplier</th>
                      <th>Status</th>
                      <th>Due date</th>
                      <th>Total</th>
                      <th>Balance</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.invoices.map((invoice) => (
                      <tr key={invoice.id} className={invoice.id === state.selectedInvoice?.id ? 'selected-list-row' : ''}>
                        <td>{invoice.invoice_number}</td>
                        <td>{invoice.supplier?.name ?? 'Supplier'}</td>
                        <td><span className={`payables-status-pill ${invoice.status}`}>{invoice.status}</span></td>
                        <td>{formatDate(invoice.due_date)}</td>
                        <td>{money.format(invoice.total_amount)}</td>
                        <td>{money.format(invoice.balance_amount)}</td>
                        <td>
                          <button type="button" onClick={() => selectInvoice(invoice.id)}>
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      )}

      {activePayablesView === 'approval-queue' && (
        <section className="payables-child-page payables-approval-page">
          <article className="payables-workflow-card">
            <div className="mini-section-heading">
              <strong>Approval queue</strong>
              <span>{invoiceQueues.draft.length} draft invoices</span>
            </div>

            {invoiceQueues.draft.length === 0 ? (
              <div className="payables-empty-state">No draft supplier invoices need approval.</div>
            ) : (
              <div className="payables-register-table-wrap">
                <table className="payables-register-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Supplier</th>
                      <th>Due date</th>
                      <th>Total</th>
                      <th>Balance</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceQueues.draft.map((invoice) => (
                      <tr key={invoice.id} className={invoice.id === state.selectedInvoice?.id ? 'selected-list-row' : ''}>
                        <td>{invoice.invoice_number}</td>
                        <td>{invoice.supplier?.name ?? 'Supplier'}</td>
                        <td>{formatDate(invoice.due_date)}</td>
                        <td>{money.format(invoice.total_amount)}</td>
                        <td>{money.format(invoice.balance_amount)}</td>
                        <td>
                          <button type="button" onClick={() => selectInvoice(invoice.id)}>
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {state.selectedInvoice && (
            <article className="payables-workflow-card payables-review-card">
              <div className="form-header">
                <div>
                  <span>Selected payable</span>
                  <h3>{state.selectedInvoice.invoice_number}</h3>
                  <p className="muted">
                    {state.selectedInvoice.supplier?.name ?? 'Supplier'} · {state.selectedInvoice.status} · Due{' '}
                    {formatDate(state.selectedInvoice.due_date)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={approveSelectedInvoice}
                  disabled={isApprovingInvoice || state.selectedInvoice.status !== 'draft'}
                >
                  {isApprovingInvoice ? 'Approving…' : 'Approve invoice'}
                </button>
              </div>

              <div className="payables-detail-grid">
                <article>
                  <span>Total</span>
                  <strong>{money.format(state.selectedInvoice.total_amount)}</strong>
                </article>
                <article>
                  <span>Paid</span>
                  <strong>{money.format(state.selectedInvoice.paid_amount)}</strong>
                </article>
                <article>
                  <span>Balance</span>
                  <strong>{money.format(state.selectedInvoice.balance_amount)}</strong>
                </article>
                <article>
                  <span>Items</span>
                  <strong>{state.selectedInvoice.items?.length ?? state.selectedInvoice.items_count ?? 0}</strong>
                </article>
              </div>

              <div className="payables-register-table-wrap">
                <table className="payables-register-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Unit cost</th>
                      <th>Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.selectedInvoice.items ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={4}>Open the invoice again to load item details.</td>
                      </tr>
                    ) : (
                      state.selectedInvoice.items?.map((item) => (
                        <tr key={item.id}>
                          <td>{item.product_name_snapshot}</td>
                          <td>{item.quantity}</td>
                          <td>{money.format(item.unit_cost)}</td>
                          <td>{money.format(item.line_total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          )}
        </section>
      )}

      {activePayablesView === 'record-payment' && (
        <section className="payables-child-page payables-payment-page">
          <article className="payables-workflow-card">
            <div className="mini-section-heading">
              <strong>Invoices ready for payment</strong>
              <span>{invoiceQueues.payable.length} payable balances</span>
            </div>

            {invoiceQueues.payable.length === 0 ? (
              <div className="payables-empty-state">No approved or partially paid invoice has an open balance.</div>
            ) : (
              <div className="payables-register-table-wrap">
                <table className="payables-register-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Supplier</th>
                      <th>Status</th>
                      <th>Due date</th>
                      <th>Balance</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceQueues.payable.map((invoice) => (
                      <tr key={invoice.id} className={invoice.id === state.selectedInvoice?.id ? 'selected-list-row' : ''}>
                        <td>{invoice.invoice_number}</td>
                        <td>{invoice.supplier?.name ?? 'Supplier'}</td>
                        <td><span className={`payables-status-pill ${invoice.status}`}>{invoice.status}</span></td>
                        <td>{formatDate(invoice.due_date)}</td>
                        <td>{money.format(invoice.balance_amount)}</td>
                        <td>
                          <button type="button" onClick={() => selectInvoice(invoice.id)}>
                            Pay
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {state.selectedInvoice && (
            <article className="payables-workflow-card payables-payment-card">
              <div className="form-header">
                <div>
                  <span>Record supplier payment</span>
                  <h3>{state.selectedInvoice.invoice_number}</h3>
                  <p className="muted">
                    {state.selectedInvoice.supplier?.name ?? 'Supplier'} · Balance{' '}
                    {money.format(state.selectedInvoice.balance_amount)}
                  </p>
                </div>
              </div>

              <div className="creation-form-grid payables-form-grid">
                <label>
                  Amount
                  <input
                    type="number"
                    min="0.01"
                    value={paymentForm.amount}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                  />
                </label>

                <label>
                  Method
                  <select
                    value={paymentForm.payment_method}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        payment_method: event.target.value as PaymentForm['payment_method'],
                      }))
                    }
                  >
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="cash">Cash</option>
                    <option value="momo">MoMo</option>
                    <option value="card">Card</option>
                    <option value="cheque">Cheque</option>
                    <option value="credit">Credit</option>
                  </select>
                </label>

                <label>
                  Reference
                  <input
                    value={paymentForm.reference_number}
                    onChange={(event) =>
                      setPaymentForm((current) => ({ ...current, reference_number: event.target.value }))
                    }
                    placeholder="Bank or MoMo reference"
                  />
                </label>

                <label>
                  Paid at
                  <input
                    type="date"
                    value={paymentForm.paid_at}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, paid_at: event.target.value }))}
                  />
                </label>

                <label className="wide-field">
                  Notes
                  <input
                    value={paymentForm.notes}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Optional payment note"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={recordPayment}
                disabled={
                  isRecordingPayment ||
                  state.selectedInvoice.balance_amount <= 0 ||
                  !['approved', 'partially_paid'].includes(state.selectedInvoice.status)
                }
              >
                {isRecordingPayment ? 'Recording payment…' : 'Record supplier payment'}
              </button>

              <div className="payables-register-table-wrap payables-history-table">
                <table className="payables-register-table">
                  <thead>
                    <tr>
                      <th>Payment</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Paid at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.selectedInvoice.payments ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5}>No supplier payments recorded yet.</td>
                      </tr>
                    ) : (
                      state.selectedInvoice.payments?.map((payment) => (
                        <tr key={payment.id}>
                          <td>{payment.payment_number}</td>
                          <td>{payment.payment_method}</td>
                          <td>{payment.status}</td>
                          <td>{money.format(payment.amount)}</td>
                          <td>{formatDate(payment.paid_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          )}
        </section>
      )}
    </section>
  );
}

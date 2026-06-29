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
    <section className="payables-panel">
      <div className="section-heading">
        <span>Supplier payables</span>
        <h2>Invoice and accounts payable workflow</h2>
        <p>
          Create supplier invoices from approved purchase orders, approve payables, and record supplier payments.
        </p>
      </div>

      <div className="procurement-kpi-grid payables-kpi-grid">
        <article>
          <span>Outstanding payables</span>
          <strong>{money.format(kpis.outstanding)}</strong>
          <small>Open supplier balance</small>
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
          <span>Paid invoices</span>
          <strong>{kpis.paid}</strong>
          <small>Closed payable records</small>
        </article>
        <article>
          <span>Overdue</span>
          <strong>{kpis.overdue}</strong>
          <small>Due date passed</small>
        </article>
      </div>

      {notice && <div className="notice-banner">{notice}</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="payables-grid">
        <section className="draft-sale-builder payables-builder">
          <div className="form-header">
            <div>
              <span>Create payable</span>
              <h3>Supplier invoice from purchase order</h3>
            </div>
            <button type="button" onClick={loadPayables} disabled={isLoading}>
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <div className="creation-form-grid">
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

          <div className="payables-line-list">
            <div className="mini-section-heading">
              <strong>Invoice items</strong>
              <span>{selectedPurchaseOrder ? selectedPurchaseOrder.po_number : 'Select a PO to populate items'}</span>
            </div>

            {invoiceForm.items.length === 0 ? (
              <p className="muted">No invoice items selected yet.</p>
            ) : (
              invoiceForm.items.map((item, index) => (
                <div key={`${item.pharmaco_purchase_order_item_id}-${index}`} className="payables-line-row">
                  <strong>{item.product_name}</strong>
                  <label>
                    Qty
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={item.quantity}
                      onChange={(event) => updateInvoiceLine(index, { quantity: event.target.value })}
                    />
                  </label>
                  <label>
                    Unit cost
                    <input
                      type="number"
                      min="0"
                      value={item.unit_cost}
                      onChange={(event) => updateInvoiceLine(index, { unit_cost: event.target.value })}
                    />
                  </label>
                  <label>
                    Discount
                    <input
                      type="number"
                      min="0"
                      value={item.discount_amount}
                      onChange={(event) => updateInvoiceLine(index, { discount_amount: event.target.value })}
                    />
                  </label>
                  <label>
                    Tax
                    <input
                      type="number"
                      min="0"
                      value={item.tax_amount}
                      onChange={(event) => updateInvoiceLine(index, { tax_amount: event.target.value })}
                    />
                  </label>
                  <span>
                    {money.format(
                      Math.max(
                        toNumber(item.quantity) * toNumber(item.unit_cost) -
                          toNumber(item.discount_amount) +
                          toNumber(item.tax_amount),
                        0,
                      ),
                    )}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="payables-total-row">
            <span>Invoice preview total</span>
            <strong>{money.format(invoicePreviewTotal)}</strong>
          </div>

          <button type="button" onClick={createInvoice} disabled={isCreatingInvoice || invoiceForm.items.length === 0}>
            {isCreatingInvoice ? 'Creating invoice…' : 'Create supplier invoice'}
          </button>
        </section>

        <section className="procurement-list-card payables-list-card">
          <div className="mini-section-heading">
            <strong>Supplier invoices</strong>
            <span>{state.invoices.length} records</span>
          </div>

          {state.invoices.length === 0 ? (
            <p className="muted">No supplier invoices yet.</p>
          ) : (
            state.invoices.slice(0, 12).map((invoice) => (
              <div
                key={invoice.id}
                className={invoice.id === state.selectedInvoice?.id ? 'selected-list-row' : ''}
              >
                <strong>{invoice.invoice_number}</strong>
                <span>{invoice.supplier?.name ?? 'Supplier'} · {invoice.status}</span>
                <small>
                  Total {money.format(invoice.total_amount)} · Balance {money.format(invoice.balance_amount)}
                </small>
                <button type="button" onClick={() => selectInvoice(invoice.id)}>
                  Review
                </button>
              </div>
            ))
          )}
        </section>
      </div>

      {state.selectedInvoice && (
        <section className="draft-sale-builder payables-detail-card">
          <div className="form-header">
            <div>
              <span>Selected payable</span>
              <h3>{state.selectedInvoice.invoice_number}</h3>
              <p>
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

          <div className="payables-grid">
            <div className="procurement-list-card">
              <div className="mini-section-heading">
                <strong>Invoice items</strong>
                <span>Backend source of truth</span>
              </div>

              {(state.selectedInvoice.items ?? []).length === 0 ? (
                <p className="muted">Open the invoice again to load item details.</p>
              ) : (
                state.selectedInvoice.items?.map((item) => (
                  <div key={item.id}>
                    <strong>{item.product_name_snapshot}</strong>
                    <span>
                      Qty {item.quantity} · Unit {money.format(item.unit_cost)}
                    </span>
                    <small>Total {money.format(item.line_total)}</small>
                  </div>
                ))
              )}
            </div>

            <div className="procurement-list-card">
              <div className="mini-section-heading">
                <strong>Record supplier payment</strong>
                <span>Payable settlement</span>
              </div>

              <div className="creation-form-grid">
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

              <div className="mini-section-heading payables-history-heading">
                <strong>Payment history</strong>
                <span>{state.selectedInvoice.payments?.length ?? 0} payments</span>
              </div>

              {(state.selectedInvoice.payments ?? []).length === 0 ? (
                <p className="muted">No supplier payments recorded yet.</p>
              ) : (
                state.selectedInvoice.payments?.map((payment) => (
                  <div key={payment.id} className="payment-history-row">
                    <strong>{payment.payment_number}</strong>
                    <span>{payment.payment_method} · {payment.status}</span>
                    <small>{money.format(payment.amount)} · {formatDate(payment.paid_at)}</small>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}
    </section>
  );
}

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AccessProfile,
  PharmaBranch,
  PharmaProduct,
  PharmaPurchaseOrder,
  PharmaPurchaseOrderItem,
  PharmaStockLocation,
  PharmaSupplier,
  PharmaSupplierInvoice,
  approvePharmaPurchaseOrder,
  approvePharmaSupplierInvoice,
  cancelPharmaPurchaseOrder,
  createPharmaPurchaseOrder,
  createPharmaSupplier,
  createPharmaSupplierInvoice,
  getPharmaBranches,
  getPharmaInventoryLocations,
  getPharmaProducts,
  getPharmaPurchaseOrder,
  getPharmaPurchaseOrders,
  getPharmaSupplierInvoices,
  getPharmaSuppliers,
  receivePharmaStock,
  updatePharmaSupplier,
} from '../lib/api';

type Props = {
  token: string;
  profile: AccessProfile;
};

type ProcurementWorkspace =
  | 'overview'
  | 'suppliers'
  | 'purchase-orders'
  | 'receiving'
  | 'invoices'
  | 'three-way-match';

type ModalType = 'supplier' | 'purchase-order' | 'receiving' | 'invoice' | null;

type ProcurementState = {
  branches: PharmaBranch[];
  products: PharmaProduct[];
  locations: PharmaStockLocation[];
  suppliers: PharmaSupplier[];
  purchaseOrders: PharmaPurchaseOrder[];
  invoices: PharmaSupplierInvoice[];
  selectedPurchaseOrder: PharmaPurchaseOrder | null;
};

type SupplierForm = {
  name: string;
  legal_name: string;
  supplier_code: string;
  supplier_type: 'wholesaler' | 'manufacturer' | 'distributor' | 'importer' | 'other';
  contact_person: string;
  phone: string;
  email: string;
  tax_identification_number: string;
  license_number: string;
  address: string;
  payment_terms: string;
  status: 'active' | 'inactive' | 'suspended';
  notes: string;
};

type PurchaseOrderLineForm = {
  product_id: string;
  quantity_ordered: string;
  unit_cost: string;
  discount_amount: string;
  tax_amount: string;
};

type PurchaseOrderForm = {
  branch_id: string;
  pharmaco_supplier_id: string;
  order_date: string;
  expected_delivery_date: string;
  discount_amount: string;
  tax_amount: string;
  shipping_amount: string;
  notes: string;
  items: PurchaseOrderLineForm[];
};

type ReceiveForm = {
  purchase_order_item_id: string;
  stock_location_id: string;
  batch_number: string;
  quantity: string;
  expiry_date: string;
  unit_cost: string;
  selling_price: string;
};

type InvoiceForm = {
  pharmaco_supplier_id: string;
  pharmaco_purchase_order_id: string;
  supplier_invoice_number: string;
  invoice_date: string;
  due_date: string;
  discount_amount: string;
  tax_amount: string;
  notes: string;
};

const workspaceOptions: Array<{ key: ProcurementWorkspace; label: string; description: string }> = [
  { key: 'overview', label: 'Overview', description: 'Procure-to-pay control tower' },
  { key: 'suppliers', label: 'Suppliers', description: 'Master data and compliance' },
  { key: 'purchase-orders', label: 'Purchase Orders', description: 'Requisition, approval and commitments' },
  { key: 'receiving', label: 'Receiving', description: 'GRN, batches, expiry and stock' },
  { key: 'invoices', label: 'Invoices', description: 'Supplier invoice and approval' },
  { key: 'three-way-match', label: '3-Way Match', description: 'PO, receipt and invoice controls' },
];

function tenantSlugFrom(profile: AccessProfile): string {
  return profile.tenant_assignments?.[0]?.tenant?.slug || (profile.scope.is_tenant ? 'vitapharma' : '');
}

function money(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function numberFrom(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function blankSupplierForm(): SupplierForm {
  return {
    name: '',
    legal_name: '',
    supplier_code: '',
    supplier_type: 'wholesaler',
    contact_person: '',
    phone: '',
    email: '',
    tax_identification_number: '',
    license_number: '',
    address: '',
    payment_terms: 'Net 30',
    status: 'active',
    notes: '',
  };
}

function supplierToForm(supplier: PharmaSupplier): SupplierForm {
  return {
    name: supplier.name,
    legal_name: supplier.legal_name ?? '',
    supplier_code: supplier.supplier_code,
    supplier_type: supplier.supplier_type as SupplierForm['supplier_type'],
    contact_person: supplier.contact_person ?? '',
    phone: supplier.phone ?? '',
    email: supplier.email ?? '',
    tax_identification_number: supplier.tax_identification_number ?? '',
    license_number: supplier.license_number ?? '',
    address: supplier.address ?? '',
    payment_terms: supplier.payment_terms ?? '',
    status: supplier.status as SupplierForm['status'],
    notes: '',
  };
}

function blankLine(): PurchaseOrderLineForm {
  return {
    product_id: '',
    quantity_ordered: '1',
    unit_cost: '',
    discount_amount: '0',
    tax_amount: '0',
  };
}

function blankPurchaseOrderForm(branchId = '', supplierId = ''): PurchaseOrderForm {
  return {
    branch_id: branchId,
    pharmaco_supplier_id: supplierId,
    order_date: new Date().toISOString().slice(0, 10),
    expected_delivery_date: '',
    discount_amount: '0',
    tax_amount: '0',
    shipping_amount: '0',
    notes: '',
    items: [blankLine()],
  };
}

function blankReceiveForm(locationId = ''): ReceiveForm {
  return {
    purchase_order_item_id: '',
    stock_location_id: locationId,
    batch_number: '',
    quantity: '',
    expiry_date: '',
    unit_cost: '',
    selling_price: '',
  };
}

function blankInvoiceForm(supplierId = '', purchaseOrderId = ''): InvoiceForm {
  return {
    pharmaco_supplier_id: supplierId,
    pharmaco_purchase_order_id: purchaseOrderId,
    supplier_invoice_number: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    discount_amount: '0',
    tax_amount: '0',
    notes: '',
  };
}

function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (['approved', 'received', 'paid', 'active', 'completed'].some((value) => normalized.includes(value))) return 'success';
  if (['cancelled', 'rejected', 'suspended', 'overdue'].some((value) => normalized.includes(value))) return 'danger';
  if (['draft', 'partial', 'pending', 'review'].some((value) => normalized.includes(value))) return 'warning';
  return 'neutral';
}

export function ProcurementWorkflow({ token, profile }: Props) {
  const [workspace, setWorkspace] = useState<ProcurementWorkspace>('overview');
  const [modal, setModal] = useState<ModalType>(null);
  const [state, setState] = useState<ProcurementState>({
    branches: [],
    products: [],
    locations: [],
    suppliers: [],
    purchaseOrders: [],
    invoices: [],
    selectedPurchaseOrder: null,
  });
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(blankSupplierForm());
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [purchaseOrderForm, setPurchaseOrderForm] = useState<PurchaseOrderForm>(blankPurchaseOrderForm());
  const [receiveForm, setReceiveForm] = useState<ReceiveForm>(blankReceiveForm());
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>(blankInvoiceForm());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const tenantSlug = useMemo(() => tenantSlugFrom(profile), [profile]);
  const canManage = profile.permissions.includes('pharmaco.suppliers.manage');
  const activeBranches = state.branches.filter((branch) => branch.status === 'active');
  const activeProducts = state.products.filter((product) => product.status === 'active');
  const activeSuppliers = state.suppliers.filter((supplier) => supplier.status === 'active');
  const selectedItems = state.selectedPurchaseOrder?.items ?? [];
  const selectedReceiveItem = selectedItems.find((item) => item.id === Number(receiveForm.purchase_order_item_id));
  const remainingQuantity = selectedReceiveItem
    ? Math.max(Number(selectedReceiveItem.quantity_ordered) - Number(selectedReceiveItem.quantity_received), 0)
    : 0;

  const poPreviewTotal = useMemo(() => {
    const lines = purchaseOrderForm.items.reduce((sum, item) => (
      sum + Math.max(
        numberFrom(item.quantity_ordered) * numberFrom(item.unit_cost)
          - numberFrom(item.discount_amount)
          + numberFrom(item.tax_amount),
        0,
      )
    ), 0);
    return Math.max(
      lines - numberFrom(purchaseOrderForm.discount_amount)
        + numberFrom(purchaseOrderForm.tax_amount)
        + numberFrom(purchaseOrderForm.shipping_amount),
      0,
    );
  }, [purchaseOrderForm]);

  const procurementCommitment = state.purchaseOrders
    .filter((order) => !['cancelled', 'received'].includes(order.status))
    .reduce((sum, order) => sum + Number(order.total_amount), 0);
  const outstandingInvoices = state.invoices.reduce((sum, invoice) => sum + Number(invoice.balance_amount), 0);
  const overdueInvoices = state.invoices.filter((invoice) => (
    invoice.due_date && new Date(invoice.due_date) < new Date() && Number(invoice.balance_amount) > 0
  ));
  const openPurchaseOrders = state.purchaseOrders.filter((order) => !['received', 'cancelled'].includes(order.status));

  async function loadProcurement(): Promise<void> {
    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }
    if (!canManage) {
      setError('Your role does not have procurement management permission.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const [branches, products, locations, suppliers, purchaseOrders, invoices] = await Promise.all([
        getPharmaBranches(token, tenantSlug),
        getPharmaProducts(token, tenantSlug, { perPage: 1000, status: 'active' }),
        getPharmaInventoryLocations(token, tenantSlug),
        getPharmaSuppliers(token, tenantSlug),
        getPharmaPurchaseOrders(token, tenantSlug),
        getPharmaSupplierInvoices(token, tenantSlug),
      ]);

      const firstPo = purchaseOrders.purchase_orders[0];
      const selectedPurchaseOrder = firstPo
        ? (await getPharmaPurchaseOrder(token, tenantSlug, firstPo.id)).purchase_order
        : null;

      setState({
        branches: branches.branches,
        products: products.products,
        locations: locations.locations,
        suppliers: suppliers.suppliers,
        purchaseOrders: purchaseOrders.purchase_orders,
        invoices: invoices.supplier_invoices,
        selectedPurchaseOrder,
      });

      const branchId = String(branches.branches.find((branch) => branch.status === 'active')?.id ?? '');
      const supplierId = String(suppliers.suppliers.find((supplier) => supplier.status === 'active')?.id ?? '');
      setPurchaseOrderForm((current) => current.branch_id ? current : blankPurchaseOrderForm(branchId, supplierId));
      setReceiveForm((current) => current.stock_location_id ? current : blankReceiveForm(String(locations.locations[0]?.id ?? '')));
      setNotice('Procurement, inventory, invoice and supplier records synchronized.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load procurement control center.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProcurement();
    // Authentication context changes are the only automatic reload trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, token]);

  function openSupplierModal(supplier?: PharmaSupplier): void {
    setEditingSupplierId(supplier?.id ?? null);
    setSupplierForm(supplier ? supplierToForm(supplier) : blankSupplierForm());
    setModal('supplier');
    setError('');
  }

  async function saveSupplier(event: FormEvent, createAnother = false): Promise<void> {
    event.preventDefault();
    if (!supplierForm.name.trim()) {
      setError('Supplier name is required.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const payload = {
        name: supplierForm.name.trim(),
        legal_name: supplierForm.legal_name.trim() || null,
        supplier_code: supplierForm.supplier_code.trim() || null,
        supplier_type: supplierForm.supplier_type,
        contact_person: supplierForm.contact_person.trim() || null,
        phone: supplierForm.phone.trim() || null,
        email: supplierForm.email.trim() || null,
        tax_identification_number: supplierForm.tax_identification_number.trim() || null,
        license_number: supplierForm.license_number.trim() || null,
        address: supplierForm.address.trim() || null,
        payment_terms: supplierForm.payment_terms.trim() || null,
        status: supplierForm.status,
        notes: supplierForm.notes.trim() || null,
      };
      const response = editingSupplierId
        ? await updatePharmaSupplier(token, tenantSlug, editingSupplierId, payload)
        : await createPharmaSupplier(token, tenantSlug, payload);

      setState((current) => ({
        ...current,
        suppliers: editingSupplierId
          ? current.suppliers.map((supplier) => supplier.id === editingSupplierId ? response.supplier : supplier)
          : [response.supplier, ...current.suppliers],
      }));
      setNotice(response.message);
      setEditingSupplierId(null);
      setSupplierForm(blankSupplierForm());
      if (!createAnother) setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save supplier.');
    } finally {
      setIsSaving(false);
    }
  }

  function updateLine(index: number, patch: Partial<PurchaseOrderLineForm>): void {
    setPurchaseOrderForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  async function savePurchaseOrder(event: FormEvent, createAnother = false): Promise<void> {
    event.preventDefault();
    const items = purchaseOrderForm.items
      .filter((item) => item.product_id && numberFrom(item.quantity_ordered) > 0)
      .map((item) => ({
        product_id: Number(item.product_id),
        quantity_ordered: numberFrom(item.quantity_ordered),
        unit_cost: numberFrom(item.unit_cost),
        discount_amount: numberFrom(item.discount_amount),
        tax_amount: numberFrom(item.tax_amount),
      }));

    if (!purchaseOrderForm.branch_id || !purchaseOrderForm.pharmaco_supplier_id || !items.length) {
      setError('Branch, supplier and at least one valid purchase-order line are required.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const response = await createPharmaPurchaseOrder(token, tenantSlug, {
        branch_id: Number(purchaseOrderForm.branch_id),
        pharmaco_supplier_id: Number(purchaseOrderForm.pharmaco_supplier_id),
        order_date: purchaseOrderForm.order_date || null,
        expected_delivery_date: purchaseOrderForm.expected_delivery_date || null,
        discount_amount: numberFrom(purchaseOrderForm.discount_amount),
        tax_amount: numberFrom(purchaseOrderForm.tax_amount),
        shipping_amount: numberFrom(purchaseOrderForm.shipping_amount),
        notes: purchaseOrderForm.notes.trim() || null,
        items,
      });
      setState((current) => ({
        ...current,
        purchaseOrders: [response.purchase_order, ...current.purchaseOrders],
        selectedPurchaseOrder: response.purchase_order,
      }));
      setNotice(response.message);
      setPurchaseOrderForm(blankPurchaseOrderForm(purchaseOrderForm.branch_id, purchaseOrderForm.pharmaco_supplier_id));
      if (!createAnother) setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create purchase order.');
    } finally {
      setIsSaving(false);
    }
  }

  async function selectPurchaseOrder(order: PharmaPurchaseOrder, openReceiving = false): Promise<void> {
    setError('');
    try {
      const detail = (await getPharmaPurchaseOrder(token, tenantSlug, order.id)).purchase_order;
      setState((current) => ({ ...current, selectedPurchaseOrder: detail }));
      const firstOpenItem = (detail.items ?? []).find((item) => Number(item.quantity_received) < Number(item.quantity_ordered));
      setReceiveForm({
        ...blankReceiveForm(String(state.locations[0]?.id ?? '')),
        purchase_order_item_id: firstOpenItem ? String(firstOpenItem.id) : '',
        quantity: firstOpenItem ? String(Number(firstOpenItem.quantity_ordered) - Number(firstOpenItem.quantity_received)) : '',
        unit_cost: firstOpenItem ? String(firstOpenItem.unit_cost) : '',
      });
      if (openReceiving) setModal('receiving');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load purchase order.');
    }
  }

  async function controlPurchaseOrder(order: PharmaPurchaseOrder, action: 'approve' | 'cancel'): Promise<void> {
    setIsSaving(true);
    setError('');
    try {
      const response = action === 'approve'
        ? await approvePharmaPurchaseOrder(token, tenantSlug, order.id)
        : await cancelPharmaPurchaseOrder(token, tenantSlug, order.id, 'Cancelled from procurement control center.');
      setState((current) => ({
        ...current,
        purchaseOrders: current.purchaseOrders.map((item) => item.id === order.id ? response.purchase_order : item),
        selectedPurchaseOrder: current.selectedPurchaseOrder?.id === order.id ? response.purchase_order : current.selectedPurchaseOrder,
      }));
      setNotice(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to ${action} purchase order.`);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveReceipt(event: FormEvent, createAnother = false): Promise<void> {
    event.preventDefault();
    if (!selectedReceiveItem?.product?.id || !receiveForm.stock_location_id || !receiveForm.batch_number.trim()) {
      setError('Purchase-order line, stock location and batch number are required.');
      return;
    }
    if (numberFrom(receiveForm.quantity) <= 0 || numberFrom(receiveForm.quantity) > remainingQuantity) {
      setError(`Received quantity must be between 1 and ${remainingQuantity}.`);
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const response = await receivePharmaStock(token, tenantSlug, {
        product_id: selectedReceiveItem.product.id,
        stock_location_id: Number(receiveForm.stock_location_id),
        pharmaco_purchase_order_item_id: selectedReceiveItem.id,
        batch_number: receiveForm.batch_number.trim(),
        quantity: numberFrom(receiveForm.quantity),
        expiry_date: receiveForm.expiry_date || null,
        unit_cost: receiveForm.unit_cost ? numberFrom(receiveForm.unit_cost) : null,
        selling_price: receiveForm.selling_price ? numberFrom(receiveForm.selling_price) : null,
        supplier_name: state.selectedPurchaseOrder?.supplier?.name ?? null,
        reference_number: state.selectedPurchaseOrder?.po_number ?? null,
        reason: 'PO-linked goods receipt posted from procurement control center.',
      });
      setNotice(`${response.message} Inventory and PO receiving status were synchronized.`);
      await loadProcurement();
      setReceiveForm(blankReceiveForm(receiveForm.stock_location_id));
      if (!createAnother) setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post goods receipt.');
    } finally {
      setIsSaving(false);
    }
  }

  function openInvoiceModal(order?: PharmaPurchaseOrder): void {
    const supplierId = String(order?.supplier?.id ?? activeSuppliers[0]?.id ?? '');
    setInvoiceForm(blankInvoiceForm(supplierId, String(order?.id ?? '')));
    if (order) void selectPurchaseOrder(order);
    setModal('invoice');
  }

  async function saveInvoice(event: FormEvent, createAnother = false): Promise<void> {
    event.preventDefault();
    const purchaseOrder = state.purchaseOrders.find((order) => order.id === Number(invoiceForm.pharmaco_purchase_order_id));
    const detailedOrder = state.selectedPurchaseOrder?.id === purchaseOrder?.id ? state.selectedPurchaseOrder : null;
    const invoiceItems = (detailedOrder?.items ?? []).map((item) => ({
      pharmaco_purchase_order_item_id: item.id,
      product_id: item.product?.id ?? null,
      quantity: Number(item.quantity_received || item.quantity_ordered),
      unit_cost: Number(item.unit_cost),
      discount_amount: Number(item.discount_amount),
      tax_amount: Number(item.tax_amount),
    })).filter((item) => item.quantity > 0);

    if (!invoiceForm.pharmaco_supplier_id || !invoiceItems.length) {
      setError('Select a supplier and a purchase order with receivable lines before recording an invoice.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const response = await createPharmaSupplierInvoice(token, tenantSlug, {
        pharmaco_supplier_id: Number(invoiceForm.pharmaco_supplier_id),
        pharmaco_purchase_order_id: Number(invoiceForm.pharmaco_purchase_order_id) || null,
        supplier_invoice_number: invoiceForm.supplier_invoice_number.trim() || null,
        invoice_date: invoiceForm.invoice_date || null,
        due_date: invoiceForm.due_date || null,
        discount_amount: numberFrom(invoiceForm.discount_amount),
        tax_amount: numberFrom(invoiceForm.tax_amount),
        notes: invoiceForm.notes.trim() || null,
        items: invoiceItems,
      });
      setState((current) => ({ ...current, invoices: [response.supplier_invoice, ...current.invoices] }));
      setNotice(response.message);
      setInvoiceForm(blankInvoiceForm(invoiceForm.pharmaco_supplier_id));
      if (!createAnother) setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record supplier invoice.');
    } finally {
      setIsSaving(false);
    }
  }

  async function approveInvoice(invoice: PharmaSupplierInvoice): Promise<void> {
    setIsSaving(true);
    setError('');
    try {
      const response = await approvePharmaSupplierInvoice(token, tenantSlug, invoice.id);
      setState((current) => ({
        ...current,
        invoices: current.invoices.map((item) => item.id === invoice.id ? response.supplier_invoice : item),
      }));
      setNotice(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve supplier invoice.');
    } finally {
      setIsSaving(false);
    }
  }

  const visibleSuppliers = state.suppliers.filter((supplier) => (
    `${supplier.name} ${supplier.supplier_code} ${supplier.license_number ?? ''}`.toLowerCase().includes(search.toLowerCase())
  ));
  const visibleOrders = state.purchaseOrders.filter((order) => (
    `${order.po_number} ${order.supplier?.name ?? ''} ${order.status}`.toLowerCase().includes(search.toLowerCase())
  ));

  return (
    <article className="panel wide procurement-panel procurement-enterprise-center">
      <header className="procurement-enterprise-header">
        <div>
          <span className="section-label">Procure-to-pay · Enterprise control</span>
          <h2>Procurement Management Center</h2>
          <p className="muted">Supplier governance, purchase commitments, approvals, receiving, batches, invoices, matching and finance synchronization.</p>
        </div>
        <div className="procurement-header-actions">
          <button type="button" onClick={() => openSupplierModal()} disabled={!canManage}>New Supplier</button>
          <button type="button" className="primary" onClick={() => setModal('purchase-order')} disabled={!canManage}>New Purchase Order</button>
          <button type="button" onClick={() => void loadProcurement()} disabled={isLoading}>{isLoading ? 'Synchronizing…' : 'Refresh'}</button>
        </div>
      </header>

      <nav className="procurement-workspace-nav" aria-label="Procurement workspaces">
        {workspaceOptions.map((option) => (
          <button key={option.key} type="button" className={workspace === option.key ? 'active' : ''} onClick={() => setWorkspace(option.key)}>
            <strong>{option.label}</strong><small>{option.description}</small>
          </button>
        ))}
      </nav>

      {error && <div className="form-error">{error}</div>}
      {notice && <div className="form-success">{notice}</div>}

      <section className="procurement-enterprise-kpis inventory-kpi-grid">
        <article><span>Approved suppliers</span><strong>{activeSuppliers.length}</strong><small>{state.suppliers.length} total master records</small></article>
        <article><span>Open commitments</span><strong>{money(procurementCommitment)}</strong><small>{openPurchaseOrders.length} active purchase orders</small></article>
        <article><span>Outstanding invoices</span><strong>{money(outstandingInvoices)}</strong><small>{overdueInvoices.length} overdue</small></article>
        <article><span>3-way-match exceptions</span><strong>{state.invoices.filter((invoice) => !invoice.purchase_order).length}</strong><small>Invoices without linked PO</small></article>
      </section>

      {(workspace === 'overview' || workspace === 'three-way-match') && (
        <section className="procurement-overview-grid">
          <article className="pharmaco-card">
            <span className="section-label">Process governance</span>
            <h3>Procure-to-pay control gates</h3>
            <div className="procurement-stage-list">
              {[
                ['1', 'Supplier qualification', 'License, tax, contacts and payment terms'],
                ['2', 'Purchase order', 'Budget commitment and approval trail'],
                ['3', 'Goods receipt', 'Quantity, batch, expiry, cost and location'],
                ['4', 'Invoice match', 'PO vs receipt vs supplier invoice'],
                ['5', 'Payables', 'Approved invoice synchronized to finance'],
              ].map(([step, title, detail]) => <div key={step}><b>{step}</b><span><strong>{title}</strong><small>{detail}</small></span></div>)}
            </div>
          </article>
          <article className="pharmaco-card">
            <span className="section-label">Exception management</span>
            <h3>Items requiring attention</h3>
            <div className="compact-list">
              <div><strong>{openPurchaseOrders.filter((order) => order.status === 'draft').length} draft POs</strong><span>Awaiting approval</span></div>
              <div><strong>{openPurchaseOrders.filter((order) => order.status === 'partially_received').length} partial receipts</strong><span>Outstanding delivery quantity</span></div>
              <div><strong>{overdueInvoices.length} overdue invoices</strong><span>Finance follow-up required</span></div>
              <div><strong>{state.suppliers.filter((supplier) => supplier.status !== 'active').length} restricted suppliers</strong><span>Inactive or suspended master records</span></div>
            </div>
          </article>
        </section>
      )}

      {workspace === 'suppliers' && (
        <section className="procurement-register-card">
          <div className="section-heading"><div><span>Supplier master</span><h3>Qualified supplier register</h3></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplier, code or license" /></div>
          <div className="system-table-wrap"><table className="system-table"><thead><tr><th>Supplier</th><th>Type</th><th>Compliance</th><th>Payment Terms</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {visibleSuppliers.map((supplier) => <tr key={supplier.id}><td><strong>{supplier.name}</strong><small>{supplier.supplier_code}</small></td><td>{supplier.supplier_type}</td><td><span>{supplier.license_number || 'License pending'}</span><small>{supplier.tax_identification_number || 'TIN pending'}</small></td><td>{supplier.payment_terms || 'Not set'}</td><td><span className={`enterprise-status-badge status--${statusClass(supplier.status)}`}><i />{supplier.status}</span></td><td><button type="button" onClick={() => openSupplierModal(supplier)}>View / Update</button></td></tr>)}
            {!visibleSuppliers.length && <tr><td colSpan={6}>No suppliers match the current search.</td></tr>}
          </tbody></table></div>
        </section>
      )}

      {(workspace === 'purchase-orders' || workspace === 'receiving') && (
        <section className="procurement-register-card">
          <div className="section-heading"><div><span>Purchase commitments</span><h3>Purchase order register</h3></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search PO, supplier or status" /></div>
          <div className="system-table-wrap"><table className="system-table"><thead><tr><th>PO Number</th><th>Supplier</th><th>Branch</th><th>Delivery</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {visibleOrders.map((order) => <tr key={order.id}><td><strong>{order.po_number}</strong><small>{order.order_date || 'No date'}</small></td><td>{order.supplier?.name || 'Not linked'}</td><td>{order.branch?.name || '—'}</td><td>{order.expected_delivery_date || 'Not set'}</td><td>{money(order.total_amount)}</td><td><span className={`enterprise-status-badge status--${statusClass(order.status)}`}><i />{order.status}</span></td><td><div className="procurement-row-actions"><button type="button" onClick={() => void selectPurchaseOrder(order, workspace === 'receiving')}>{workspace === 'receiving' ? 'Receive' : 'Detail'}</button>{order.status === 'draft' && <button type="button" onClick={() => void controlPurchaseOrder(order, 'approve')} disabled={isSaving}>Approve</button>}{!['received', 'cancelled'].includes(order.status) && <button type="button" onClick={() => void controlPurchaseOrder(order, 'cancel')} disabled={isSaving}>Cancel</button>}<button type="button" onClick={() => openInvoiceModal(order)}>Invoice</button></div></td></tr>)}
            {!visibleOrders.length && <tr><td colSpan={7}>No purchase orders match the current search.</td></tr>}
          </tbody></table></div>
        </section>
      )}

      {workspace === 'invoices' && (
        <section className="procurement-register-card">
          <div className="section-heading"><div><span>Accounts payable source</span><h3>Supplier invoice register</h3></div><button type="button" onClick={() => openInvoiceModal()}>Record Invoice</button></div>
          <div className="system-table-wrap"><table className="system-table"><thead><tr><th>Invoice</th><th>Supplier</th><th>PO</th><th>Due Date</th><th>Total</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {state.invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.supplier_invoice_number || invoice.invoice_number}</strong><small>{invoice.invoice_date || 'No date'}</small></td><td>{invoice.supplier?.name || 'Not linked'}</td><td>{invoice.purchase_order?.po_number || 'Exception: no PO'}</td><td>{invoice.due_date || 'Not set'}</td><td>{money(invoice.total_amount)}</td><td>{money(invoice.balance_amount)}</td><td><span className={`enterprise-status-badge status--${statusClass(invoice.status)}`}><i />{invoice.status}</span></td><td>{invoice.status === 'draft' ? <button type="button" onClick={() => void approveInvoice(invoice)} disabled={isSaving}>Approve</button> : <span>Controlled</span>}</td></tr>)}
            {!state.invoices.length && <tr><td colSpan={8}>No supplier invoices recorded.</td></tr>}
          </tbody></table></div>
        </section>
      )}

      {workspace === 'three-way-match' && (
        <section className="procurement-register-card">
          <div className="section-heading"><div><span>Control evidence</span><h3>PO · Goods receipt · Invoice matching</h3></div></div>
          <div className="system-table-wrap"><table className="system-table"><thead><tr><th>Invoice</th><th>Purchase Order</th><th>PO Total</th><th>Invoice Total</th><th>Receipt Position</th><th>Match Result</th></tr></thead><tbody>
            {state.invoices.map((invoice) => {
              const order = state.purchaseOrders.find((item) => item.id === invoice.purchase_order?.id);
              const receiptComplete = order?.status === 'received';
              const amountMatch = order ? Math.abs(Number(order.total_amount) - Number(invoice.total_amount)) < 0.01 : false;
              const matched = Boolean(order && receiptComplete && amountMatch);
              return <tr key={invoice.id}><td>{invoice.supplier_invoice_number || invoice.invoice_number}</td><td>{order?.po_number || 'Missing'}</td><td>{money(order?.total_amount)}</td><td>{money(invoice.total_amount)}</td><td>{receiptComplete ? 'Fully received' : order ? 'Open / partial' : 'No receipt link'}</td><td><span className={`enterprise-status-badge status--${matched ? 'success' : 'warning'}`}><i />{matched ? 'Matched' : 'Exception'}</span></td></tr>;
            })}
            {!state.invoices.length && <tr><td colSpan={6}>No invoices available for matching.</td></tr>}
          </tbody></table></div>
        </section>
      )}

      {modal && <div className="procurement-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="procurement-modal" role="dialog" aria-modal="true">
        <header><div><span className="section-label">Controlled record form</span><h3>{modal === 'supplier' ? `${editingSupplierId ? 'Update' : 'Create'} Supplier` : modal === 'purchase-order' ? 'Create Purchase Order' : modal === 'receiving' ? 'Post Goods Receipt' : 'Record Supplier Invoice'}</h3></div><button type="button" onClick={() => setModal(null)} aria-label="Close form">×</button></header>

        {modal === 'supplier' && <form className="enterprise-record-form" onSubmit={(event) => void saveSupplier(event)}><div className="procurement-form-grid">
          <label><span>Supplier name *</span><input required value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} /></label>
          <label><span>Legal name</span><input value={supplierForm.legal_name} onChange={(event) => setSupplierForm({ ...supplierForm, legal_name: event.target.value })} /></label>
          <label><span>Supplier code</span><input value={supplierForm.supplier_code} onChange={(event) => setSupplierForm({ ...supplierForm, supplier_code: event.target.value })} placeholder="Auto-generated if empty" /></label>
          <label><span>Supplier type</span><select value={supplierForm.supplier_type} onChange={(event) => setSupplierForm({ ...supplierForm, supplier_type: event.target.value as SupplierForm['supplier_type'] })}><option value="wholesaler">Wholesaler</option><option value="manufacturer">Manufacturer</option><option value="distributor">Distributor</option><option value="importer">Importer</option><option value="other">Other</option></select></label>
          <label><span>Contact person</span><input value={supplierForm.contact_person} onChange={(event) => setSupplierForm({ ...supplierForm, contact_person: event.target.value })} /></label>
          <label><span>Phone</span><input type="tel" value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} /></label>
          <label><span>Email</span><input type="email" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} /></label>
          <label><span>TIN</span><input value={supplierForm.tax_identification_number} onChange={(event) => setSupplierForm({ ...supplierForm, tax_identification_number: event.target.value })} /></label>
          <label><span>License number</span><input value={supplierForm.license_number} onChange={(event) => setSupplierForm({ ...supplierForm, license_number: event.target.value })} /></label>
          <label><span>Payment terms</span><input value={supplierForm.payment_terms} onChange={(event) => setSupplierForm({ ...supplierForm, payment_terms: event.target.value })} /></label>
          <label><span>Status</span><select value={supplierForm.status} onChange={(event) => setSupplierForm({ ...supplierForm, status: event.target.value as SupplierForm['status'] })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label>
          <label className="procurement-form-span"><span>Address</span><input value={supplierForm.address} onChange={(event) => setSupplierForm({ ...supplierForm, address: event.target.value })} /></label>
          <label className="procurement-form-span"><span>Notes</span><textarea value={supplierForm.notes} onChange={(event) => setSupplierForm({ ...supplierForm, notes: event.target.value })} /></label>
        </div><footer className="enterprise-form-actions"><button type="button" onClick={() => setModal(null)}>Cancel</button>{!editingSupplierId && <button type="button" onClick={(event) => void saveSupplier(event as unknown as FormEvent, true)} disabled={isSaving}>Save & Create Another</button>}<button type="submit" className="primary" disabled={isSaving}>{isSaving ? 'Saving…' : editingSupplierId ? 'Update' : 'Save'}</button></footer></form>}

        {modal === 'purchase-order' && <form className="enterprise-record-form" onSubmit={(event) => void savePurchaseOrder(event)}><div className="procurement-form-grid">
          <label><span>Branch *</span><select required value={purchaseOrderForm.branch_id} onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, branch_id: event.target.value })}><option value="">Select branch</option>{activeBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label><span>Supplier *</span><select required value={purchaseOrderForm.pharmaco_supplier_id} onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, pharmaco_supplier_id: event.target.value })}><option value="">Select supplier</option>{activeSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
          <label><span>Order date</span><input type="date" value={purchaseOrderForm.order_date} onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, order_date: event.target.value })} /></label>
          <label><span>Expected delivery</span><input type="date" value={purchaseOrderForm.expected_delivery_date} onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, expected_delivery_date: event.target.value })} /></label>
        </div><section className="procurement-line-builder"><div className="section-heading"><div><span>Order lines</span><h4>Products and quantities</h4></div><button type="button" onClick={() => setPurchaseOrderForm({ ...purchaseOrderForm, items: [...purchaseOrderForm.items, blankLine()] })}>Add Line</button></div>{purchaseOrderForm.items.map((line, index) => <div className="procurement-line-row" key={index}><select value={line.product_id} onChange={(event) => updateLine(index, { product_id: event.target.value })}><option value="">Select product</option>{activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select><input type="number" min="0.001" step="0.001" value={line.quantity_ordered} onChange={(event) => updateLine(index, { quantity_ordered: event.target.value })} placeholder="Qty" /><input type="number" min="0" step="0.01" value={line.unit_cost} onChange={(event) => updateLine(index, { unit_cost: event.target.value })} placeholder="Unit cost" /><input type="number" min="0" step="0.01" value={line.discount_amount} onChange={(event) => updateLine(index, { discount_amount: event.target.value })} placeholder="Discount" /><input type="number" min="0" step="0.01" value={line.tax_amount} onChange={(event) => updateLine(index, { tax_amount: event.target.value })} placeholder="Tax" /><button type="button" onClick={() => setPurchaseOrderForm({ ...purchaseOrderForm, items: purchaseOrderForm.items.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button></div>)}</section><div className="procurement-form-grid"><label><span>Order discount</span><input type="number" min="0" value={purchaseOrderForm.discount_amount} onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, discount_amount: event.target.value })} /></label><label><span>Tax</span><input type="number" min="0" value={purchaseOrderForm.tax_amount} onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, tax_amount: event.target.value })} /></label><label><span>Shipping</span><input type="number" min="0" value={purchaseOrderForm.shipping_amount} onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, shipping_amount: event.target.value })} /></label><label><span>PO preview</span><output>{money(poPreviewTotal)}</output></label><label className="procurement-form-span"><span>Notes</span><textarea value={purchaseOrderForm.notes} onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, notes: event.target.value })} /></label></div><footer className="enterprise-form-actions"><button type="button" onClick={() => setModal(null)}>Cancel</button><button type="button" onClick={(event) => void savePurchaseOrder(event as unknown as FormEvent, true)} disabled={isSaving}>Save & Create Another</button><button type="submit" className="primary" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save'}</button></footer></form>}

        {modal === 'receiving' && <form className="enterprise-record-form" onSubmit={(event) => void saveReceipt(event)}><div className="procurement-form-grid"><label className="procurement-form-span"><span>Purchase order line *</span><select required value={receiveForm.purchase_order_item_id} onChange={(event) => { const item = selectedItems.find((candidate) => candidate.id === Number(event.target.value)); setReceiveForm({ ...receiveForm, purchase_order_item_id: event.target.value, quantity: item ? String(Number(item.quantity_ordered) - Number(item.quantity_received)) : '', unit_cost: item ? String(item.unit_cost) : '' }); }}><option value="">Select line</option>{selectedItems.filter((item) => Number(item.quantity_received) < Number(item.quantity_ordered)).map((item) => <option key={item.id} value={item.id}>{item.product_name_snapshot} · remaining {Number(item.quantity_ordered) - Number(item.quantity_received)}</option>)}</select></label><label><span>Stock location *</span><select required value={receiveForm.stock_location_id} onChange={(event) => setReceiveForm({ ...receiveForm, stock_location_id: event.target.value })}><option value="">Select location</option>{state.locations.map((location) => <option key={location.id} value={location.id}>{location.branch?.name} · {location.name}</option>)}</select></label><label><span>Batch number *</span><input required value={receiveForm.batch_number} onChange={(event) => setReceiveForm({ ...receiveForm, batch_number: event.target.value })} /></label><label><span>Quantity *</span><input required type="number" min="0.001" max={remainingQuantity || undefined} step="0.001" value={receiveForm.quantity} onChange={(event) => setReceiveForm({ ...receiveForm, quantity: event.target.value })} /></label><label><span>Expiry date</span><input type="date" value={receiveForm.expiry_date} onChange={(event) => setReceiveForm({ ...receiveForm, expiry_date: event.target.value })} /></label><label><span>Unit cost</span><input type="number" min="0" step="0.01" value={receiveForm.unit_cost} onChange={(event) => setReceiveForm({ ...receiveForm, unit_cost: event.target.value })} /></label><label><span>Selling price</span><input type="number" min="0" step="0.01" value={receiveForm.selling_price} onChange={(event) => setReceiveForm({ ...receiveForm, selling_price: event.target.value })} /></label></div><footer className="enterprise-form-actions"><button type="button" onClick={() => setModal(null)}>Cancel</button><button type="button" onClick={(event) => void saveReceipt(event as unknown as FormEvent, true)} disabled={isSaving}>Save & Create Another</button><button type="submit" className="primary" disabled={isSaving}>{isSaving ? 'Posting…' : 'Save'}</button></footer></form>}

        {modal === 'invoice' && <form className="enterprise-record-form" onSubmit={(event) => void saveInvoice(event)}><div className="procurement-form-grid"><label><span>Supplier *</span><select required value={invoiceForm.pharmaco_supplier_id} onChange={(event) => setInvoiceForm({ ...invoiceForm, pharmaco_supplier_id: event.target.value })}><option value="">Select supplier</option>{activeSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label><span>Purchase order *</span><select required value={invoiceForm.pharmaco_purchase_order_id} onChange={(event) => { const order = state.purchaseOrders.find((candidate) => candidate.id === Number(event.target.value)); setInvoiceForm({ ...invoiceForm, pharmaco_purchase_order_id: event.target.value, pharmaco_supplier_id: String(order?.supplier?.id ?? invoiceForm.pharmaco_supplier_id) }); if (order) void selectPurchaseOrder(order); }}><option value="">Select PO</option>{state.purchaseOrders.filter((order) => order.status !== 'cancelled').map((order) => <option key={order.id} value={order.id}>{order.po_number} · {order.supplier?.name}</option>)}</select></label><label><span>Supplier invoice number</span><input value={invoiceForm.supplier_invoice_number} onChange={(event) => setInvoiceForm({ ...invoiceForm, supplier_invoice_number: event.target.value })} /></label><label><span>Invoice date</span><input type="date" value={invoiceForm.invoice_date} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoice_date: event.target.value })} /></label><label><span>Due date</span><input type="date" value={invoiceForm.due_date} onChange={(event) => setInvoiceForm({ ...invoiceForm, due_date: event.target.value })} /></label><label><span>Discount</span><input type="number" min="0" value={invoiceForm.discount_amount} onChange={(event) => setInvoiceForm({ ...invoiceForm, discount_amount: event.target.value })} /></label><label><span>Tax</span><input type="number" min="0" value={invoiceForm.tax_amount} onChange={(event) => setInvoiceForm({ ...invoiceForm, tax_amount: event.target.value })} /></label><label className="procurement-form-span"><span>Notes</span><textarea value={invoiceForm.notes} onChange={(event) => setInvoiceForm({ ...invoiceForm, notes: event.target.value })} /></label></div><footer className="enterprise-form-actions"><button type="button" onClick={() => setModal(null)}>Cancel</button><button type="button" onClick={(event) => void saveInvoice(event as unknown as FormEvent, true)} disabled={isSaving}>Save & Create Another</button><button type="submit" className="primary" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save'}</button></footer></form>}
      </section></div>}
    </article>
  );
}

import { useMemo, useState } from 'react';
import {
  AccessProfile,
  PharmaBranch,
  PharmaProduct,
  PharmaPurchaseOrder,
  PharmaPurchaseOrderItem,
  PharmaStockLocation,
  PharmaSupplier,
  approvePharmaPurchaseOrder,
  cancelPharmaPurchaseOrder,
  createPharmaPurchaseOrder,
  createPharmaSupplier,
  getPharmaBranches,
  getPharmaInventoryLocations,
  getPharmaProducts,
  getPharmaPurchaseOrder,
  getPharmaPurchaseOrders,
  getPharmaSuppliers,
  receivePharmaStock,
} from '../lib/api';

type Props = {
  token: string;
  profile: AccessProfile;
};

type ProcurementState = {
  branches: PharmaBranch[];
  products: PharmaProduct[];
  locations: PharmaStockLocation[];
  suppliers: PharmaSupplier[];
  purchaseOrders: PharmaPurchaseOrder[];
  selectedPurchaseOrder: PharmaPurchaseOrder | null;
};

type SupplierForm = {
  name: string;
  supplier_code: string;
  supplier_type: 'wholesaler' | 'manufacturer' | 'distributor' | 'importer' | 'other';
  contact_person: string;
  phone: string;
  email: string;
  license_number: string;
  payment_terms: string;
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
    supplier_code: '',
    supplier_type: 'wholesaler',
    contact_person: '',
    phone: '',
    email: '',
    license_number: '',
    payment_terms: 'Net 30',
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

export function ProcurementWorkflow({ token, profile }: Props) {
  const [state, setState] = useState<ProcurementState>({
    branches: [],
    products: [],
    locations: [],
    suppliers: [],
    purchaseOrders: [],
    selectedPurchaseOrder: null,
  });

  const [supplierForm, setSupplierForm] = useState<SupplierForm>(blankSupplierForm());
  const [purchaseOrderForm, setPurchaseOrderForm] = useState<PurchaseOrderForm>(blankPurchaseOrderForm());
  const [receiveForm, setReceiveForm] = useState<ReceiveForm>(blankReceiveForm());
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [isSavingPurchaseOrder, setIsSavingPurchaseOrder] = useState(false);
  const [isReceivingStock, setIsReceivingStock] = useState(false);
  const [isApprovingPurchaseOrder, setIsApprovingPurchaseOrder] = useState(false);
  const [isCancellingPurchaseOrder, setIsCancellingPurchaseOrder] = useState(false);

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const tenantSlug = useMemo(() => tenantSlugFrom(profile), [profile]);
  const permissions = profile.permissions ?? [];
  const canViewProcurement = permissions.includes('pharmaco.procurement.view');
  const canLoadProcurement =
    canViewProcurement &&
    permissions.includes('branches.view') &&
    permissions.includes('pharmaco.product_master.view') &&
    permissions.includes('pharmaco.inventory.view');
  const canManageSuppliers = permissions.includes(
    'pharmaco.procurement.suppliers.manage',
  );
  const canCreatePurchaseOrders = permissions.includes(
    'pharmaco.procurement.purchase_order.create',
  );
  const canApprovePurchaseOrders = permissions.includes(
    'pharmaco.procurement.purchase_order.approve',
  );
  const canReceivePurchaseOrders =
    permissions.includes('pharmaco.product_inventory.receive') &&
    permissions.includes('pharmaco.procurement.purchase_order.receive');

  const activeBranches = state.branches.filter((branch) => branch.status === 'active');
  const activeProducts = state.products.filter((product) => product.status === 'active');
  const activeSuppliers = state.suppliers.filter((supplier) => supplier.status === 'active');
  const selectedItems = state.selectedPurchaseOrder?.items ?? [];
  const selectedSupplier = state.suppliers.find((supplier) => supplier.id === Number(selectedSupplierId));

  const purchaseOrderTotal = useMemo(() => {
    const linesTotal = purchaseOrderForm.items.reduce((sum, item) => {
      const line = numberFrom(item.quantity_ordered) * numberFrom(item.unit_cost);
      const discount = numberFrom(item.discount_amount);
      const tax = numberFrom(item.tax_amount);

      return sum + Math.max(line - discount + tax, 0);
    }, 0);

    return Math.max(
      linesTotal
        - numberFrom(purchaseOrderForm.discount_amount)
        + numberFrom(purchaseOrderForm.tax_amount)
        + numberFrom(purchaseOrderForm.shipping_amount),
      0,
    );
  }, [purchaseOrderForm]);

  const selectedReceiveItem = selectedItems.find(
    (item) => item.id === Number(receiveForm.purchase_order_item_id),
  );

  const remainingQuantity = selectedReceiveItem
    ? Math.max(Number(selectedReceiveItem.quantity_ordered) - Number(selectedReceiveItem.quantity_received), 0)
    : 0;

  async function loadProcurement() {
    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    if (!canLoadProcurement) {
      setError(
        'Your role does not include all read permissions required for the Procurement workspace.',
      );
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      const [branches, products, locations, suppliers, purchaseOrders] = await Promise.all([
        getPharmaBranches(token, tenantSlug),
        getPharmaProducts(token, tenantSlug),
        getPharmaInventoryLocations(token, tenantSlug),
        getPharmaSuppliers(token, tenantSlug),
        getPharmaPurchaseOrders(token, tenantSlug),
      ]);

      const selectedSummary = purchaseOrders.purchase_orders[0] ?? null;
      const selectedPurchaseOrder = selectedSummary
        ? (await getPharmaPurchaseOrder(token, tenantSlug, selectedSummary.id)).purchase_order
        : null;

      setState({
        branches: branches.branches,
        products: products.products,
        locations: locations.locations,
        suppliers: suppliers.suppliers,
        purchaseOrders: purchaseOrders.purchase_orders,
        selectedPurchaseOrder,
      });

      setPurchaseOrderForm(
        blankPurchaseOrderForm(
          String(branches.branches.find((branch) => branch.status === 'active')?.id ?? ''),
          String(suppliers.suppliers.find((supplier) => supplier.status === 'active')?.id ?? ''),
        ),
      );

      setReceiveForm(blankReceiveForm(String(locations.locations[0]?.id ?? '')));
      setNotice('Procurement data loaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load procurement workflow.');
    } finally {
      setIsLoading(false);
    }
  }

  async function createSupplier() {
    if (!canManageSuppliers) {
      setError('Supplier management permission is required.');
      return;
    }

    if (!supplierForm.name.trim()) {
      setError('Supplier name is required.');
      return;
    }

    setIsSavingSupplier(true);
    setError('');
    setNotice('');

    try {
      const response = await createPharmaSupplier(token, tenantSlug, {
        name: supplierForm.name.trim(),
        supplier_code: supplierForm.supplier_code.trim() || null,
        supplier_type: supplierForm.supplier_type,
        contact_person: supplierForm.contact_person.trim() || null,
        phone: supplierForm.phone.trim() || null,
        email: supplierForm.email.trim() || null,
        license_number: supplierForm.license_number.trim() || null,
        payment_terms: supplierForm.payment_terms.trim() || null,
      });

      setState((current) => ({
        ...current,
        suppliers: [response.supplier, ...current.suppliers],
      }));

      setPurchaseOrderForm((current) => ({
        ...current,
        pharmaco_supplier_id: String(response.supplier.id),
      }));

      setSupplierForm(blankSupplierForm());
      setNotice(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create supplier.');
    } finally {
      setIsSavingSupplier(false);
    }
  }

  async function createPurchaseOrder() {
    if (!canCreatePurchaseOrders) {
      setError('Purchase-order creation permission is required.');
      return;
    }

    const items = purchaseOrderForm.items
      .filter((item) => item.product_id && numberFrom(item.quantity_ordered) > 0)
      .map((item) => ({
        product_id: Number(item.product_id),
        quantity_ordered: numberFrom(item.quantity_ordered),
        unit_cost: numberFrom(item.unit_cost),
        discount_amount: numberFrom(item.discount_amount),
        tax_amount: numberFrom(item.tax_amount),
      }));

    if (!purchaseOrderForm.branch_id || !purchaseOrderForm.pharmaco_supplier_id || items.length === 0) {
      setError('Select branch, supplier, and at least one purchase order item.');
      return;
    }

    setIsSavingPurchaseOrder(true);
    setError('');
    setNotice('');

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

      const purchaseOrders = await getPharmaPurchaseOrders(token, tenantSlug);

      setState((current) => ({
        ...current,
        purchaseOrders: purchaseOrders.purchase_orders,
        selectedPurchaseOrder: response.purchase_order,
      }));

      setPurchaseOrderForm(
        blankPurchaseOrderForm(purchaseOrderForm.branch_id, purchaseOrderForm.pharmaco_supplier_id),
      );

      setNotice(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create purchase order.');
    } finally {
      setIsSavingPurchaseOrder(false);
    }
  }

  async function selectPurchaseOrder(purchaseOrderId: number) {
    setError('');
    setNotice('');

    try {
      const response = await getPharmaPurchaseOrder(token, tenantSlug, purchaseOrderId);
      const purchaseOrder = response.purchase_order;
      const firstOpenItem = (purchaseOrder.items ?? []).find(
        (item) => Number(item.quantity_received) < Number(item.quantity_ordered),
      );

      setState((current) => ({
        ...current,
        selectedPurchaseOrder: purchaseOrder,
      }));

      setReceiveForm((current) => ({
        ...current,
        purchase_order_item_id: firstOpenItem ? String(firstOpenItem.id) : '',
        quantity: firstOpenItem
          ? String(Number(firstOpenItem.quantity_ordered) - Number(firstOpenItem.quantity_received))
          : '',
        unit_cost: firstOpenItem ? String(firstOpenItem.unit_cost) : current.unit_cost,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load purchase order.');
    }
  }

  async function receiveAgainstPurchaseOrder() {
    if (!canReceivePurchaseOrders) {
      setError(
        'Product receiving and Procurement receiving permissions are required.',
      );
      return;
    }

    if (!selectedReceiveItem?.product?.id) {
      setError('Select a purchase order item.');
      return;
    }

    if (!receiveForm.stock_location_id || !receiveForm.batch_number.trim() || numberFrom(receiveForm.quantity) <= 0) {
      setError('Select location, batch number, and valid received quantity.');
      return;
    }

    if (numberFrom(receiveForm.quantity) > remainingQuantity) {
      setError(`Received quantity cannot exceed remaining quantity of ${remainingQuantity}.`);
      return;
    }

    setIsReceivingStock(true);
    setError('');
    setNotice('');

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
        reason: 'Stock received from procurement dashboard.',
      });

      const purchaseOrders = await getPharmaPurchaseOrders(token, tenantSlug);
      const refreshedPurchaseOrder = state.selectedPurchaseOrder
        ? (await getPharmaPurchaseOrder(token, tenantSlug, state.selectedPurchaseOrder.id)).purchase_order
        : null;

      setState((current) => ({
        ...current,
        purchaseOrders: purchaseOrders.purchase_orders,
        selectedPurchaseOrder: refreshedPurchaseOrder,
      }));

      setReceiveForm(blankReceiveForm(receiveForm.stock_location_id));
      setNotice(`${response.message} Reference: ${response.movement.reference_number}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to receive stock.');
    } finally {
      setIsReceivingStock(false);
    }
  }


  async function approveSelectedPurchaseOrder() {
    if (!canApprovePurchaseOrders) {
      setError('Purchase-order approval permission is required.');
      return;
    }

    if (!state.selectedPurchaseOrder) {
      setError('Select a purchase order first.');
      return;
    }

    setIsApprovingPurchaseOrder(true);
    setError('');
    setNotice('');

    try {
      const response = await approvePharmaPurchaseOrder(token, tenantSlug, state.selectedPurchaseOrder.id);
      const purchaseOrders = await getPharmaPurchaseOrders(token, tenantSlug);

      setState((current) => ({
        ...current,
        purchaseOrders: purchaseOrders.purchase_orders,
        selectedPurchaseOrder: response.purchase_order,
      }));

      setNotice(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve purchase order.');
    } finally {
      setIsApprovingPurchaseOrder(false);
    }
  }

  async function cancelSelectedPurchaseOrder() {
    if (!canApprovePurchaseOrders) {
      setError('Purchase-order approval permission is required.');
      return;
    }

    if (!state.selectedPurchaseOrder) {
      setError('Select a purchase order first.');
      return;
    }

    setIsCancellingPurchaseOrder(true);
    setError('');
    setNotice('');

    try {
      const response = await cancelPharmaPurchaseOrder(
        token,
        tenantSlug,
        state.selectedPurchaseOrder.id,
        cancelReason,
      );
      const purchaseOrders = await getPharmaPurchaseOrders(token, tenantSlug);

      setState((current) => ({
        ...current,
        purchaseOrders: purchaseOrders.purchase_orders,
        selectedPurchaseOrder: response.purchase_order,
      }));

      setCancelReason('');
      setNotice(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel purchase order.');
    } finally {
      setIsCancellingPurchaseOrder(false);
    }
  }

  function updateLine(index: number, patch: Partial<PurchaseOrderLineForm>) {
    setPurchaseOrderForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  if (!canViewProcurement) {
    return null;
  }

  return (
    <article className="panel wide procurement-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Procurement workflow</h2>
          <p className="muted">
            Supplier setup, purchase order creation and PO-linked stock receiving.
          </p>
        </div>

        <button
          type="button"
          onClick={loadProcurement}
          disabled={isLoading || !canLoadProcurement}
          title={
            !canLoadProcurement
              ? 'Additional branch, product and inventory read permissions are required'
              : undefined
          }
        >
          {isLoading ? 'Loading…' : 'Load procurement'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {notice && <div className="form-success">{notice}</div>}

      <div className="inventory-kpi-grid procurement-kpi-grid">
        <article>
          <span>Suppliers</span>
          <strong>{state.suppliers.length}</strong>
        </article>
        <article>
          <span>Purchase orders</span>
          <strong>{state.purchaseOrders.length}</strong>
        </article>
        <article>
          <span>Draft / partial</span>
          <strong>
            {state.purchaseOrders.filter((order) => ['draft', 'partially_received'].includes(order.status)).length}
          </strong>
        </article>
        <article>
          <span>PO preview</span>
          <strong>{money(purchaseOrderTotal)}</strong>
        </article>
      </div>

      <div className="procurement-workflow-grid">
        <section className="pharmaco-card">
          <span className="section-label">Supplier setup</span>
          <h3>Create supplier</h3>

          <div className="creation-form-grid">
            <label>
              Supplier name
              <input
                value={supplierForm.name}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>

            <label>
              Supplier code
              <input
                placeholder="Auto-generated if empty"
                value={supplierForm.supplier_code}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, supplier_code: event.target.value }))
                }
              />
            </label>

            <label>
              Supplier type
              <select
                value={supplierForm.supplier_type}
                onChange={(event) =>
                  setSupplierForm((current) => ({
                    ...current,
                    supplier_type: event.target.value as SupplierForm['supplier_type'],
                  }))
                }
              >
                <option value="wholesaler">Wholesaler</option>
                <option value="manufacturer">Manufacturer</option>
                <option value="distributor">Distributor</option>
                <option value="importer">Importer</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              Phone
              <input
                value={supplierForm.phone}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </label>

            <label>
              Email
              <input
                value={supplierForm.email}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>

            <label>
              Payment terms
              <input
                value={supplierForm.payment_terms}
                onChange={(event) =>
                  setSupplierForm((current) => ({ ...current, payment_terms: event.target.value }))
                }
              />
            </label>
          </div>

          <button
            type="button"
            onClick={createSupplier}
            disabled={isSavingSupplier || !canManageSuppliers}
            title={
              !canManageSuppliers
                ? 'Supplier management permission is required'
                : undefined
            }
          >
            {isSavingSupplier ? 'Creating supplier…' : 'Create supplier'}
          </button>
        </section>

        <section className="pharmaco-card">
          <span className="section-label">Suppliers</span>
          <h3>Supplier list</h3>

          {state.suppliers.length === 0 ? (
            <p className="muted">No suppliers loaded yet.</p>
          ) : (
            <div className="compact-list">
              {state.suppliers.slice(0, 6).map((supplier) => (
                <div key={supplier.id} className={supplier.id === Number(selectedSupplierId) ? 'selected-list-row' : ''}>
                  <strong>{supplier.name}</strong>
                  <span>{supplier.supplier_code} · {supplier.supplier_type}</span>
                  <small>{supplier.status} · {supplier.payment_terms ?? 'No terms'}</small>
                  <button type="button" onClick={() => setSelectedSupplierId(String(supplier.id))}>
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

          {selectedSupplier && (
            <div className="approval-control-box">
              <strong>Selected supplier</strong>
              <span>{selectedSupplier.name}</span>
              <small>{selectedSupplier.supplier_code} · {selectedSupplier.status}</small>
              <p className="muted">
                Supplier update API is now available. A full edit form can be added in the next UI refinement without backend changes.
              </p>
            </div>
          )}
      </div>

      <section className="draft-sale-builder purchase-order-builder">
        <div className="panel-heading-row">
          <div>
            <span className="section-label">Purchase order</span>
            <h3>Create purchase order</h3>
          </div>

          <div className="sale-total-box">
            <span>Preview</span>
            <strong>{money(purchaseOrderTotal)}</strong>
          </div>
        </div>

        <div className="creation-form-grid">
          <label>
            Branch
            <select
              value={purchaseOrderForm.branch_id}
              onChange={(event) =>
                setPurchaseOrderForm((current) => ({ ...current, branch_id: event.target.value }))
              }
            >
              <option value="">Select branch</option>
              {activeBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Supplier
            <select
              value={purchaseOrderForm.pharmaco_supplier_id}
              onChange={(event) =>
                setPurchaseOrderForm((current) => ({
                  ...current,
                  pharmaco_supplier_id: event.target.value,
                }))
              }
            >
              <option value="">Select supplier</option>
              {activeSuppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Order date
            <input
              type="date"
              value={purchaseOrderForm.order_date}
              onChange={(event) =>
                setPurchaseOrderForm((current) => ({ ...current, order_date: event.target.value }))
              }
            />
          </label>

          <label>
            Expected delivery
            <input
              type="date"
              value={purchaseOrderForm.expected_delivery_date}
              onChange={(event) =>
                setPurchaseOrderForm((current) => ({
                  ...current,
                  expected_delivery_date: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div className="sale-line-builder">
          {purchaseOrderForm.items.map((item, index) => (
            <div key={index} className="sale-line-row procurement-line-row">
              <label>
                Product
                <select
                  value={item.product_id}
                  onChange={(event) => updateLine(index, { product_id: event.target.value })}
                >
                  <option value="">Select product</option>
                  {activeProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {product.sku}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Quantity
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={item.quantity_ordered}
                  onChange={(event) => updateLine(index, { quantity_ordered: event.target.value })}
                />
              </label>

              <label>
                Unit cost
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_cost}
                  onChange={(event) => updateLine(index, { unit_cost: event.target.value })}
                />
              </label>

              <label>
                Discount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.discount_amount}
                  onChange={(event) => updateLine(index, { discount_amount: event.target.value })}
                />
              </label>

              <label>
                Tax
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.tax_amount}
                  onChange={(event) => updateLine(index, { tax_amount: event.target.value })}
                />
              </label>
            </div>
          ))}
        </div>

        <div className="draft-sale-footer">
          <button
            type="button"
            onClick={() =>
              setPurchaseOrderForm((current) => ({
                ...current,
                items: [...current.items, blankLine()],
              }))
            }
          >
            Add PO line
          </button>

          <button
            type="button"
            onClick={createPurchaseOrder}
            disabled={isSavingPurchaseOrder || !canCreatePurchaseOrders}
            title={
              !canCreatePurchaseOrders
                ? 'Purchase-order creation permission is required'
                : undefined
            }
          >
            {isSavingPurchaseOrder ? 'Creating PO…' : 'Create purchase order'}
          </button>
        </div>
      </section>

      <div className="procurement-workflow-grid">
        <section className="pharmaco-card">
          <span className="section-label">Purchase orders</span>
          <h3>PO list</h3>

          {state.purchaseOrders.length === 0 ? (
            <p className="muted">No purchase orders loaded yet.</p>
          ) : (
            <div className="compact-list">
              {state.purchaseOrders.map((purchaseOrder) => (
                <div key={purchaseOrder.id}>
                  <strong>{purchaseOrder.po_number}</strong>
                  <span>{purchaseOrder.supplier?.name ?? 'No supplier'}</span>
                  <small>{purchaseOrder.status} · {money(purchaseOrder.total_amount)}</small>
                  <button type="button" onClick={() => selectPurchaseOrder(purchaseOrder.id)}>
                    Review / receive
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="pharmaco-card">
          <span className="section-label">Receiving</span>
          <h3>{state.selectedPurchaseOrder?.po_number ?? 'Select purchase order'}</h3>

          {!state.selectedPurchaseOrder ? (
            <p className="muted">Select a purchase order to receive stock.</p>
          ) : (
            <>
              <div className="mini-facts">
                <span>Supplier: {state.selectedPurchaseOrder.supplier?.name ?? 'Not set'}</span>
                <span>Branch: {state.selectedPurchaseOrder.branch?.name ?? 'Not set'}</span>
                <span>Status: {state.selectedPurchaseOrder.status}</span>
              </div>


              <div className="approval-control-box">
                <strong>Approval controls</strong>
                <span>Current status: {state.selectedPurchaseOrder.status}</span>

                <div className="approval-actions">
                  <button
                    type="button"
                    onClick={approveSelectedPurchaseOrder}
                    disabled={
                      !canApprovePurchaseOrders ||
                      isApprovingPurchaseOrder ||
                      state.selectedPurchaseOrder.status !== 'draft'
                    }
                  >
                    {isApprovingPurchaseOrder ? 'Approving…' : 'Approve PO'}
                  </button>

                  <button
                    type="button"
                    onClick={cancelSelectedPurchaseOrder}
                    disabled={
                      !canApprovePurchaseOrders ||
                      isCancellingPurchaseOrder ||
                      ['received', 'cancelled'].includes(state.selectedPurchaseOrder.status)
                    }
                  >
                    {isCancellingPurchaseOrder ? 'Cancelling…' : 'Cancel PO'}
                  </button>
                </div>

                <label>
                  Cancellation reason
                  <input
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    placeholder="Optional reason for audit trail"
                  />
                </label>
              </div>

              <div className="creation-form-grid">
                <label>
                  PO item
                  <select
                    value={receiveForm.purchase_order_item_id}
                    onChange={(event) => {
                      const item = selectedItems.find((entry) => entry.id === Number(event.target.value));

                      setReceiveForm((current) => ({
                        ...current,
                        purchase_order_item_id: event.target.value,
                        quantity: item
                          ? String(Number(item.quantity_ordered) - Number(item.quantity_received))
                          : '',
                        unit_cost: item ? String(item.unit_cost) : current.unit_cost,
                      }));
                    }}
                  >
                    <option value="">Select item</option>
                    {selectedItems.map((item: PharmaPurchaseOrderItem) => (
                      <option key={item.id} value={item.id}>
                        {item.product_name_snapshot} · remaining {Number(item.quantity_ordered) - Number(item.quantity_received)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Location
                  <select
                    value={receiveForm.stock_location_id}
                    onChange={(event) =>
                      setReceiveForm((current) => ({ ...current, stock_location_id: event.target.value }))
                    }
                  >
                    <option value="">Select location</option>
                    {state.locations
                      .filter((location) =>
                        !state.selectedPurchaseOrder?.branch?.id ||
                        location.branch.id === state.selectedPurchaseOrder.branch.id
                      )
                      .map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Batch number
                  <input
                    value={receiveForm.batch_number}
                    onChange={(event) =>
                      setReceiveForm((current) => ({ ...current, batch_number: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Quantity
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={receiveForm.quantity}
                    onChange={(event) =>
                      setReceiveForm((current) => ({ ...current, quantity: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Expiry date
                  <input
                    type="date"
                    value={receiveForm.expiry_date}
                    onChange={(event) =>
                      setReceiveForm((current) => ({ ...current, expiry_date: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Selling price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={receiveForm.selling_price}
                    onChange={(event) =>
                      setReceiveForm((current) => ({ ...current, selling_price: event.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="readiness-summary">
                <strong>{remainingQuantity}</strong>
                <span>remaining quantity for selected item</span>
              </div>

              <button
                type="button"
                onClick={receiveAgainstPurchaseOrder}
                disabled={isReceivingStock || !canReceivePurchaseOrders}
                title={
                  !canReceivePurchaseOrders
                    ? 'Product receiving and Procurement receiving permissions are required'
                    : undefined
                }
              >
                {isReceivingStock ? 'Receiving stock…' : 'Receive stock against PO'}
              </button>
            </>
          )}
        </section>
      </div>
    </article>
  );
}

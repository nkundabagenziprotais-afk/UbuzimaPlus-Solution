import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  type AccessProfile,
  type PharmaBranch,
  type PharmaProduct,
  type PharmaPurchaseOrder,
  type PharmaPurchaseOrderItem,
  type PharmaStockLocation,
  type PharmaSupplier,
  createPharmaProduct,
  createPharmaPurchaseOrder,
  getPharmaBranches,
  getPharmaInventoryLocations,
  getPharmaProducts,
  getPharmaPurchaseOrder,
  getPharmaPurchaseOrders,
  getPharmaSuppliers,
  receivePharmaStock,
} from '../lib/api';

export type MobileNativeOperationalWorkflowKind =
  | 'receive-stock-manually'
  | 'purchase-orders'
  | 'receiving';

type MobileNativeOperationalWorkflowProps = {
  kind: MobileNativeOperationalWorkflowKind;
  token: string;
  profile: AccessProfile;
  onCompleted?: () => void | Promise<void>;
};

type ReceiveStep = 'source' | 'product' | 'details' | 'review' | 'success';
type PurchaseOrderStep = 'supplier' | 'products' | 'review' | 'success';
type PurchaseOrderReceiveStep = 'orders' | 'items' | 'details' | 'review' | 'success';

type ReceiveFormState = {
  source: 'manual' | 'purchase-code';
  productId: string;
  stockLocationId: string;
  batchNumber: string;
  quantity: string;
  expiryDate: string;
  unitCost: string;
  sellingPrice: string;
  supplierName: string;
  referenceNumber: string;
};

type QuickProductFormState = {
  name: string;
  sku: string;
  genericName: string;
  unit: string;
};

type PurchaseOrderLine = {
  localId: string;
  productId: string;
  quantity: string;
  unitCost: string;
  notes: string;
};

type PurchaseOrderFormState = {
  branchId: string;
  supplierId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  discountAmount: string;
  shippingAmount: string;
  notes: string;
};

type PurchaseReceivingFormState = {
  stockLocationId: string;
  batchNumber: string;
  quantity: string;
  expiryDate: string;
  unitCost: string;
  sellingPrice: string;
  referenceNumber: string;
};

type CompletedPurchaseReceipt = {
  itemId: number;
  productName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  batchNumber: string;
};

function tenantSlugFrom(profile: AccessProfile): string {
  return profile.tenant_assignments?.[0]?.tenant?.slug || (profile.scope.is_tenant ? 'vitapharma' : '');
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function localId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function numberFrom(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: string | number | null | undefined): string {
  return `RWF ${numberFrom(value).toLocaleString('en-RW')}`;
}

function productLabel(product: PharmaProduct | null | undefined): string {
  if (!product) return 'No product selected';

  return [product.name, product.strength, product.dosage_form].filter(Boolean).join(' ');
}

function remainingQuantity(item: PharmaPurchaseOrderItem): number {
  return Math.max(numberFrom(item.quantity_ordered) - numberFrom(item.quantity_received), 0);
}

function orderHasReceivableItems(order: PharmaPurchaseOrder): boolean {
  if (!order.items || order.items.length === 0) {
    return !['received', 'cancelled', 'canceled', 'closed'].includes(order.status.toLowerCase());
  }

  return order.items.some((item) => remainingQuantity(item) > 0);
}

function nextReceivableOrderItem(
  order: PharmaPurchaseOrder | null,
  ignoredItemIds: number[] = [],
): PharmaPurchaseOrderItem | null {
  return (
    order?.items?.find(
      (item) =>
        item.product?.id &&
        remainingQuantity(item) > 0 &&
        !ignoredItemIds.includes(item.id),
    ) ?? null
  );
}

function filteredProducts(products: PharmaProduct[], search: string): PharmaProduct[] {
  const keyword = search.trim().toLowerCase();

  if (!keyword) {
    return products.slice(0, 14);
  }

  return products
    .filter((product) =>
      [
        product.name,
        product.generic_name,
        product.brand_name,
        product.sku,
        product.barcode,
        product.strength,
        product.dosage_form,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    )
    .slice(0, 18);
}

function workflowTitle(kind: MobileNativeOperationalWorkflowKind): string {
  if (kind === 'purchase-orders') return 'Create Purchase Order';
  if (kind === 'receiving') return 'Receive Purchase Order';
  return 'Receive Stock Manually';
}

function workflowSubtitle(kind: MobileNativeOperationalWorkflowKind): string {
  if (kind === 'purchase-orders') {
    return 'Supplier, branch, products, quantities and price confirmation.';
  }

  if (kind === 'receiving') {
    return 'Open purchase orders, item selection, batch capture and receiving review.';
  }

  return 'Source, product, batch, quantity, price and stock-location capture.';
}

export function MobileNativeOperationalWorkflow({
  kind,
  token,
  profile,
  onCompleted,
}: MobileNativeOperationalWorkflowProps) {
  const tenantSlug = tenantSlugFrom(profile);
  const [products, setProducts] = useState<PharmaProduct[]>([]);
  const [locations, setLocations] = useState<PharmaStockLocation[]>([]);
  const [suppliers, setSuppliers] = useState<PharmaSupplier[]>([]);
  const [branches, setBranches] = useState<PharmaBranch[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PharmaPurchaseOrder[]>([]);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PharmaPurchaseOrder | null>(null);
  const [selectedPurchaseOrderItemId, setSelectedPurchaseOrderItemId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [receiveStep, setReceiveStep] = useState<ReceiveStep>('source');
  const [purchaseOrderStep, setPurchaseOrderStep] = useState<PurchaseOrderStep>('supplier');
  const [poReceiveStep, setPoReceiveStep] = useState<PurchaseOrderReceiveStep>('orders');
  const [productSearch, setProductSearch] = useState('');
  const [poProductSearch, setPoProductSearch] = useState('');
  const [isQuickProductOpen, setIsQuickProductOpen] = useState(false);
  const [quickProductForm, setQuickProductForm] = useState<QuickProductFormState>({
    name: '',
    sku: '',
    genericName: '',
    unit: 'unit',
  });
  const [receiveForm, setReceiveForm] = useState<ReceiveFormState>({
    source: 'manual',
    productId: '',
    stockLocationId: '',
    batchNumber: '',
    quantity: '',
    expiryDate: '',
    unitCost: '',
    sellingPrice: '',
    supplierName: '',
    referenceNumber: '',
  });
  const [purchaseOrderForm, setPurchaseOrderForm] = useState<PurchaseOrderFormState>({
    branchId: '',
    supplierId: '',
    orderDate: todayIso(),
    expectedDeliveryDate: '',
    discountAmount: '0',
    shippingAmount: '0',
    notes: '',
  });
  const [purchaseOrderLines, setPurchaseOrderLines] = useState<PurchaseOrderLine[]>([
    {
      localId: localId('po-line'),
      productId: '',
      quantity: '',
      unitCost: '',
      notes: '',
    },
  ]);
  const [poReceivingForm, setPoReceivingForm] = useState<PurchaseReceivingFormState>({
    stockLocationId: '',
    batchNumber: '',
    quantity: '',
    expiryDate: '',
    unitCost: '',
    sellingPrice: '',
    referenceNumber: '',
  });
  const [completedPoReceipts, setCompletedPoReceipts] = useState<CompletedPurchaseReceipt[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadMobileWorkflowData() {
      if (!tenantSlug) {
        setError('No tenant assignment is available for this account.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const [productResponse, locationResponse, supplierResponse, branchResponse, orderResponse] =
          await Promise.all([
            getPharmaProducts(token, tenantSlug, { perPage: 120, status: 'active' }),
            getPharmaInventoryLocations(token, tenantSlug),
            getPharmaSuppliers(token, tenantSlug),
            getPharmaBranches(token, tenantSlug),
            getPharmaPurchaseOrders(token, tenantSlug),
          ]);

        if (cancelled) return;

        const activeLocations = locationResponse.locations.filter((location) => location.status === 'active');
        const activeSuppliers = supplierResponse.suppliers.filter((supplier) => supplier.status === 'active');
        const activeBranches = branchResponse.branches.filter((branch) => branch.status === 'active');

        setProducts(productResponse.products);
        setLocations(activeLocations);
        setSuppliers(activeSuppliers);
        setBranches(activeBranches);
        setPurchaseOrders(orderResponse.purchase_orders);
        setReceiveForm((current) => ({
          ...current,
          stockLocationId: current.stockLocationId || String(activeLocations[0]?.id ?? ''),
          supplierName: current.supplierName || activeSuppliers[0]?.name || '',
        }));
        setPurchaseOrderForm((current) => ({
          ...current,
          branchId: current.branchId || String(activeBranches[0]?.id ?? ''),
          supplierId: current.supplierId || String(activeSuppliers[0]?.id ?? ''),
        }));
        setPoReceivingForm((current) => ({
          ...current,
          stockLocationId: current.stockLocationId || String(activeLocations[0]?.id ?? ''),
        }));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load mobile workflow data.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadMobileWorkflowData();

    return () => {
      cancelled = true;
    };
  }, [kind, refreshKey, tenantSlug, token]);

  const receiveProduct = useMemo(
    () => products.find((product) => String(product.id) === receiveForm.productId) ?? null,
    [products, receiveForm.productId],
  );
  const receiveProductOptions = useMemo(
    () => filteredProducts(products, productSearch),
    [products, productSearch],
  );
  const poProductOptions = useMemo(
    () => filteredProducts(products, poProductSearch),
    [products, poProductSearch],
  );
  const selectedPoItem = useMemo(
    () =>
      selectedPurchaseOrder?.items?.find(
        (item) => String(item.id) === selectedPurchaseOrderItemId,
      ) ?? null,
    [selectedPurchaseOrder, selectedPurchaseOrderItemId],
  );
  const receivableOrders = useMemo(
    () =>
      purchaseOrders.filter(
        (order) =>
          order.purchase_type === 'core_products' &&
          !['cancelled', 'canceled', 'received', 'closed'].includes(order.status.toLowerCase()) &&
          orderHasReceivableItems(order),
      ),
    [purchaseOrders],
  );
  const purchaseOrderTotal = useMemo(() => {
    const subtotal = purchaseOrderLines.reduce(
      (sum, line) => sum + numberFrom(line.quantity) * numberFrom(line.unitCost),
      0,
    );

    return subtotal - numberFrom(purchaseOrderForm.discountAmount) + numberFrom(purchaseOrderForm.shippingAmount);
  }, [purchaseOrderForm.discountAmount, purchaseOrderForm.shippingAmount, purchaseOrderLines]);

  async function notifyCompleted() {
    setRefreshKey((current) => current + 1);
    await onCompleted?.();
  }

  async function createQuickProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    if (!quickProductForm.name.trim()) {
      setError('Enter the product name before creating Product Master.');
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await createPharmaProduct(token, tenantSlug, {
        name: quickProductForm.name.trim(),
        generic_name: quickProductForm.genericName.trim() || null,
        sku: quickProductForm.sku.trim() || `MOB-${Date.now().toString().slice(-8)}`,
        unit: quickProductForm.unit.trim() || 'unit',
        product_type: 'medicine',
        regulatory_status: 'approved',
        status: 'active',
        reorder_level: 0,
        minimum_stock_level: 0,
        maximum_stock_level: null,
      });

      setProducts((current) => [response.product, ...current.filter((product) => product.id !== response.product.id)]);
      setReceiveForm((current) => ({
        ...current,
        productId: String(response.product.id),
      }));
      setProductSearch(response.product.name);
      setIsQuickProductOpen(false);
      setQuickProductForm({ name: '', sku: '', genericName: '', unit: 'unit' });
      setNotice(`${response.product.name} was created and selected.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create the Product Master record.');
    } finally {
      setIsSaving(false);
    }
  }

  async function submitManualReceiving(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug || !receiveProduct) {
      setError('Select a product before submitting receiving.');
      return;
    }

    if (!receiveForm.stockLocationId || !receiveForm.batchNumber.trim() || numberFrom(receiveForm.quantity) <= 0) {
      setError('Select location, enter batch number, and provide a valid quantity.');
      return;
    }

    if (receiveForm.source === 'purchase-code' && !receiveForm.referenceNumber.trim()) {
      setError('Enter the purchase/reference code for purchase-code receiving.');
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await receivePharmaStock(token, tenantSlug, {
        product_id: receiveProduct.id,
        stock_location_id: Number(receiveForm.stockLocationId),
        batch_number: receiveForm.batchNumber.trim(),
        quantity: numberFrom(receiveForm.quantity),
        expiry_date: receiveForm.expiryDate || null,
        unit_cost: receiveForm.unitCost ? numberFrom(receiveForm.unitCost) : null,
        selling_price: receiveForm.sellingPrice ? numberFrom(receiveForm.sellingPrice) : null,
        supplier_name: receiveForm.supplierName.trim() || null,
        reference_number: receiveForm.referenceNumber.trim() || null,
        receive_source: receiveForm.source,
        reason:
          receiveForm.source === 'purchase-code'
            ? 'Mobile app purchase-code receiving'
            : 'Mobile app manual receiving',
        idempotency_key: localId('mobile-stock-receipt'),
      });

      setNotice(response.message || 'Inventory receiving completed.');
      setReceiveStep('success');
      await notifyCompleted();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to receive stock.');
    } finally {
      setIsSaving(false);
    }
  }

  function updatePurchaseOrderLine(localLineId: string, patch: Partial<PurchaseOrderLine>) {
    setPurchaseOrderLines((current) =>
      current.map((line) => (line.localId === localLineId ? { ...line, ...patch } : line)),
    );
  }

  function addPurchaseOrderLine(productId = '') {
    setPurchaseOrderLines((current) => [
      ...current,
      {
        localId: localId('po-line'),
        productId,
        quantity: '',
        unitCost: '',
        notes: '',
      },
    ]);
  }

  async function submitPurchaseOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    const validLines = purchaseOrderLines.filter(
      (line) => line.productId && numberFrom(line.quantity) > 0 && numberFrom(line.unitCost) >= 0,
    );

    if (!purchaseOrderForm.branchId || !purchaseOrderForm.supplierId) {
      setError('Select branch and supplier before submitting.');
      return;
    }

    if (validLines.length === 0) {
      setError('Add at least one product with quantity and unit cost.');
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await createPharmaPurchaseOrder(token, tenantSlug, {
        branch_id: Number(purchaseOrderForm.branchId),
        pharmaco_supplier_id: Number(purchaseOrderForm.supplierId),
        order_date: purchaseOrderForm.orderDate || null,
        expected_delivery_date: purchaseOrderForm.expectedDeliveryDate || null,
        discount_amount: numberFrom(purchaseOrderForm.discountAmount),
        shipping_amount: numberFrom(purchaseOrderForm.shippingAmount),
        tax_amount: 0,
        notes: purchaseOrderForm.notes.trim() || null,
        purchase_type: 'core_products',
        items: validLines.map((line) => ({
          product_id: Number(line.productId),
          quantity_ordered: numberFrom(line.quantity),
          unit_cost: numberFrom(line.unitCost),
          discount_amount: 0,
          tax_amount: 0,
          notes: line.notes.trim() || null,
        })),
      });

      setNotice(response.message || `${response.purchase_order.po_number} was created.`);
      setPurchaseOrderStep('success');
      await notifyCompleted();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create purchase order.');
    } finally {
      setIsSaving(false);
    }
  }

  async function openPurchaseOrder(order: PharmaPurchaseOrder) {
    if (!tenantSlug) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await getPharmaPurchaseOrder(token, tenantSlug, order.id);
      const detail = response.purchase_order;
      const firstOpenItem = nextReceivableOrderItem(detail);

      setSelectedPurchaseOrder(detail);
      setSelectedPurchaseOrderItemId(firstOpenItem ? String(firstOpenItem.id) : '');
      setCompletedPoReceipts([]);
      setPoReceivingForm((current) => ({
        ...current,
        batchNumber: '',
        quantity: firstOpenItem ? String(remainingQuantity(firstOpenItem)) : current.quantity,
        unitCost: firstOpenItem ? String(firstOpenItem.unit_cost ?? '') : current.unitCost,
        sellingPrice: '',
        expiryDate: '',
        referenceNumber: detail.po_number,
      }));
      setPoReceiveStep('items');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load purchase order.');
    } finally {
      setIsLoading(false);
    }
  }

  async function submitPurchaseOrderReceiving(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug || !selectedPurchaseOrder || !selectedPoItem?.product?.id) {
      setError('Select a purchase order item before receiving.');
      return;
    }

    if (!poReceivingForm.stockLocationId || !poReceivingForm.batchNumber.trim() || numberFrom(poReceivingForm.quantity) <= 0) {
      setError('Select location, enter batch number, and provide a valid quantity.');
      return;
    }

    if (numberFrom(poReceivingForm.quantity) > remainingQuantity(selectedPoItem)) {
      setError(`Received quantity cannot exceed ${remainingQuantity(selectedPoItem)}.`);
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await receivePharmaStock(token, tenantSlug, {
        product_id: selectedPoItem.product.id,
        stock_location_id: Number(poReceivingForm.stockLocationId),
        pharmaco_purchase_order_item_id: selectedPoItem.id,
        batch_number: poReceivingForm.batchNumber.trim(),
        quantity: numberFrom(poReceivingForm.quantity),
        expiry_date: poReceivingForm.expiryDate || null,
        unit_cost: poReceivingForm.unitCost ? numberFrom(poReceivingForm.unitCost) : null,
        selling_price: poReceivingForm.sellingPrice ? numberFrom(poReceivingForm.sellingPrice) : null,
        supplier_name: selectedPurchaseOrder.supplier?.name ?? null,
        reference_number: poReceivingForm.referenceNumber.trim() || selectedPurchaseOrder.po_number,
        receive_source: 'purchase-code',
        reason: 'Mobile app purchase order receiving',
        idempotency_key: localId('mobile-po-receipt'),
      });

      const receivedQuantity = numberFrom(poReceivingForm.quantity);
      const orderedQuantity = numberFrom(selectedPoItem.quantity_ordered);
      const previousReceivedQuantity = numberFrom(selectedPoItem.quantity_received);
      const updatedOrder: PharmaPurchaseOrder = {
        ...selectedPurchaseOrder,
        items: (selectedPurchaseOrder.items ?? []).map((item) => {
          if (item.id !== selectedPoItem.id) {
            return item;
          }

          const quantityReceived = Math.min(
            numberFrom(item.quantity_ordered),
            previousReceivedQuantity + receivedQuantity,
          );

          return {
            ...item,
            quantity_received: quantityReceived,
            status: quantityReceived >= numberFrom(item.quantity_ordered)
              ? 'received'
              : item.status,
          };
        }),
      };
      const completedItemIds = [
        ...completedPoReceipts.map((receipt) => receipt.itemId),
        selectedPoItem.id,
      ];
      const nextItem = nextReceivableOrderItem(updatedOrder, completedItemIds);

      setSelectedPurchaseOrder(updatedOrder);
      setCompletedPoReceipts((current) => [
        ...current.filter((receipt) => receipt.itemId !== selectedPoItem.id),
        {
          itemId: selectedPoItem.id,
          productName: selectedPoItem.product?.name || selectedPoItem.product_name_snapshot,
          orderedQuantity,
          receivedQuantity,
          remainingQuantity: Math.max(remainingQuantity(selectedPoItem) - receivedQuantity, 0),
          unitCost: poReceivingForm.unitCost ? numberFrom(poReceivingForm.unitCost) : numberFrom(selectedPoItem.unit_cost),
          batchNumber: poReceivingForm.batchNumber.trim(),
        },
      ]);

      if (nextItem) {
        setSelectedPurchaseOrderItemId(String(nextItem.id));
        setPoReceivingForm((current) => ({
          ...current,
          batchNumber: '',
          quantity: String(remainingQuantity(nextItem)),
          expiryDate: '',
          unitCost: String(nextItem.unit_cost ?? ''),
          sellingPrice: '',
          referenceNumber: selectedPurchaseOrder.po_number,
        }));
        setNotice(`${response.message || 'Item received.'} Continue with the next product.`);
        setPoReceiveStep('details');
        return;
      }

      setNotice(response.message || 'Purchase order receiving completed.');
      setPoReceiveStep('success');
      await notifyCompleted();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to receive purchase order item.');
    } finally {
      setIsSaving(false);
    }
  }

  function renderStepDots(labels: string[], activeIndex: number) {
    return (
      <div className="mobile-native-flow-steps" aria-label="Workflow steps">
        {labels.map((label, index) => (
          <span key={label} className={index === activeIndex ? 'active' : ''}>
            {index + 1}
          </span>
        ))}
      </div>
    );
  }

  function renderLoading() {
    if (!isLoading) return null;

    return (
      <div className="mobile-native-flow-state" role="status">
        <strong>Loading live records...</strong>
        <span>Products, suppliers, stock locations and purchase orders are syncing.</span>
      </div>
    );
  }

  function renderMessages() {
    return (
      <>
        {error && <div className="mobile-native-flow-alert is-error">{error}</div>}
        {notice && <div className="mobile-native-flow-alert is-success">{notice}</div>}
      </>
    );
  }

  function renderProductSearch({
    selectedProductId,
    onSelect,
    search,
    onSearch,
    options,
  }: {
    selectedProductId: string;
    onSelect: (product: PharmaProduct) => void;
    search: string;
    onSearch: (value: string) => void;
    options: PharmaProduct[];
  }) {
    const selected = products.find((product) => String(product.id) === selectedProductId) ?? null;

    return (
      <section className="mobile-native-flow-card mobile-native-flow-product-picker">
        <label>
          Search product
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search medicine, SKU or barcode"
            inputMode="search"
            autoComplete="off"
          />
        </label>

        {selected && (
          <article className="mobile-native-flow-selected">
            <strong>{productLabel(selected)}</strong>
            <span>{selected.sku || 'SKU not set'} / {selected.unit}</span>
          </article>
        )}

        <div className="mobile-native-flow-product-list">
          {options.map((product) => (
            <button
              key={product.id}
              type="button"
              className={String(product.id) === selectedProductId ? 'active' : ''}
              onClick={() => onSelect(product)}
            >
              <strong>{productLabel(product)}</strong>
              <span>{product.sku || 'No SKU'} / {product.generic_name || 'Generic not set'}</span>
            </button>
          ))}
        </div>

        {search.trim() && options.length === 0 && (
          <div className="mobile-native-flow-missing">
            <strong>No product found</strong>
            <span>Create it in Product Master, then continue receiving.</span>
            <button
              type="button"
              onClick={() => {
                setQuickProductForm((current) => ({
                  ...current,
                  name: current.name || search.trim(),
                  sku: current.sku || `MOB-${Date.now().toString().slice(-6)}`,
                }));
                setIsQuickProductOpen(true);
              }}
            >
              Create Product Master
            </button>
          </div>
        )}
      </section>
    );
  }

  function renderQuickProductForm() {
    if (!isQuickProductOpen) return null;

    return (
      <form className="mobile-native-flow-card mobile-native-flow-two-column" onSubmit={createQuickProduct}>
        <div className="mobile-native-flow-card-heading">
          <strong>Create Product Master</strong>
          <span>Minimal approved product record for mobile receiving.</span>
        </div>
        <label>
          Product name
          <input
            value={quickProductForm.name}
            onChange={(event) => setQuickProductForm({ ...quickProductForm, name: event.target.value })}
            required
          />
        </label>
        <label>
          Internal SKU
          <input
            value={quickProductForm.sku}
            onChange={(event) => setQuickProductForm({ ...quickProductForm, sku: event.target.value })}
          />
        </label>
        <label>
          Generic name
          <input
            value={quickProductForm.genericName}
            onChange={(event) => setQuickProductForm({ ...quickProductForm, genericName: event.target.value })}
          />
        </label>
        <label>
          Unit
          <input
            value={quickProductForm.unit}
            onChange={(event) => setQuickProductForm({ ...quickProductForm, unit: event.target.value })}
            required
          />
        </label>
        <div className="mobile-native-flow-actions">
          <button type="button" onClick={() => setIsQuickProductOpen(false)}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={isSaving}>
            {isSaving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    );
  }

  function renderManualReceiving() {
    const sourceIndex = receiveStep === 'source' ? 0 : receiveStep === 'product' ? 1 : receiveStep === 'details' ? 2 : 3;

    return (
      <>
        {renderStepDots(['Source', 'Product', 'Details', 'Review'], sourceIndex)}

        {receiveStep === 'source' && (
          <section className="mobile-native-flow-card">
            <div className="mobile-native-flow-choice-grid">
              <button
                type="button"
                className={receiveForm.source === 'manual' ? 'active' : ''}
                onClick={() => setReceiveForm({ ...receiveForm, source: 'manual' })}
              >
                <strong>Receive manually</strong>
                <span>Record stock directly without purchase order link.</span>
              </button>
              <button
                type="button"
                className={receiveForm.source === 'purchase-code' ? 'active' : ''}
                onClick={() => setReceiveForm({ ...receiveForm, source: 'purchase-code' })}
              >
                <strong>Purchase code</strong>
                <span>Use delivery note, invoice or procurement reference.</span>
              </button>
            </div>
            <div className="mobile-native-flow-actions">
              <button type="button" className="primary" onClick={() => setReceiveStep('product')}>
                Continue
              </button>
            </div>
          </section>
        )}

        {receiveStep === 'product' && (
          <>
            {renderProductSearch({
              selectedProductId: receiveForm.productId,
              onSelect: (product) => {
                setReceiveForm({ ...receiveForm, productId: String(product.id) });
                setProductSearch(product.name);
              },
              search: productSearch,
              onSearch: setProductSearch,
              options: receiveProductOptions,
            })}
            {renderQuickProductForm()}
            <div className="mobile-native-flow-actions">
              <button type="button" onClick={() => setReceiveStep('source')}>
                Back
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => setReceiveStep('details')}
                disabled={!receiveForm.productId}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {receiveStep === 'details' && (
          <form className="mobile-native-flow-card mobile-native-flow-two-column" onSubmit={(event) => {
            event.preventDefault();
            setReceiveStep('review');
          }}>
            <div className="mobile-native-flow-card-heading">
              <strong>{productLabel(receiveProduct)}</strong>
              <span>Capture batch, quantity, price and stock location.</span>
            </div>
            <label>
              Batch number
              <input
                value={receiveForm.batchNumber}
                onChange={(event) => setReceiveForm({ ...receiveForm, batchNumber: event.target.value })}
                required
              />
            </label>
            <label>
              Quantity
              <input
                type="number"
                min="1"
                inputMode="decimal"
                value={receiveForm.quantity}
                onChange={(event) => setReceiveForm({ ...receiveForm, quantity: event.target.value })}
                required
              />
            </label>
            <label>
              Expiry date
              <input
                type="date"
                value={receiveForm.expiryDate}
                onChange={(event) => setReceiveForm({ ...receiveForm, expiryDate: event.target.value })}
              />
            </label>
            <label>
              Unit cost
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={receiveForm.unitCost}
                onChange={(event) => setReceiveForm({ ...receiveForm, unitCost: event.target.value })}
              />
            </label>
            <label>
              Selling price
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={receiveForm.sellingPrice}
                onChange={(event) => setReceiveForm({ ...receiveForm, sellingPrice: event.target.value })}
              />
            </label>
            <label>
              Stock location
              <select
                value={receiveForm.stockLocationId}
                onChange={(event) => setReceiveForm({ ...receiveForm, stockLocationId: event.target.value })}
                required
              >
                <option value="">Select location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Supplier
              <select
                value={receiveForm.supplierName}
                onChange={(event) => setReceiveForm({ ...receiveForm, supplierName: event.target.value })}
              >
                <option value="">No supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.name}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reference
              <input
                value={receiveForm.referenceNumber}
                onChange={(event) => setReceiveForm({ ...receiveForm, referenceNumber: event.target.value })}
                required={receiveForm.source === 'purchase-code'}
              />
            </label>
            <div className="mobile-native-flow-actions">
              <button type="button" onClick={() => setReceiveStep('product')}>
                Back
              </button>
              <button type="submit" className="primary">
                Review
              </button>
            </div>
          </form>
        )}

        {receiveStep === 'review' && (
          <form className="mobile-native-flow-card" onSubmit={submitManualReceiving}>
            <div className="mobile-native-flow-review-grid">
              <span>Product</span>
              <strong>{productLabel(receiveProduct)}</strong>
              <span>Quantity</span>
              <strong>{receiveForm.quantity || '0'}</strong>
              <span>Batch</span>
              <strong>{receiveForm.batchNumber || 'Not set'}</strong>
              <span>Location</span>
              <strong>{locations.find((location) => String(location.id) === receiveForm.stockLocationId)?.name ?? 'Not selected'}</strong>
              <span>Cost / price</span>
              <strong>{money(receiveForm.unitCost)} / {money(receiveForm.sellingPrice)}</strong>
              <span>Reference</span>
              <strong>{receiveForm.referenceNumber || 'Manual'}</strong>
            </div>
            <div className="mobile-native-flow-actions">
              <button type="button" onClick={() => setReceiveStep('details')}>
                Back
              </button>
              <button type="submit" className="primary" disabled={isSaving}>
                {isSaving ? 'Submitting...' : 'Submit receiving'}
              </button>
            </div>
          </form>
        )}

        {receiveStep === 'success' && (
          <section className="mobile-native-flow-success">
            <strong>Inventory received successfully</strong>
            <span>{notice || 'The stock record was created and synced with live inventory.'}</span>
            <div className="mobile-native-flow-actions">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setReceiveForm((current) => ({
                    ...current,
                    productId: '',
                    batchNumber: '',
                    quantity: '',
                    expiryDate: '',
                    unitCost: '',
                    sellingPrice: '',
                    referenceNumber: '',
                  }));
                  setProductSearch('');
                  setReceiveStep('source');
                }}
              >
                Receive another
              </button>
            </div>
          </section>
        )}
      </>
    );
  }

  function renderPurchaseOrderBuilder() {
    const activeIndex = purchaseOrderStep === 'supplier' ? 0 : purchaseOrderStep === 'products' ? 1 : 2;

    return (
      <>
        {renderStepDots(['Supplier', 'Products', 'Review'], activeIndex)}

        {purchaseOrderStep === 'supplier' && (
          <form className="mobile-native-flow-card mobile-native-flow-two-column" onSubmit={(event) => {
            event.preventDefault();
            setPurchaseOrderStep('products');
          }}>
            <div className="mobile-native-flow-card-heading">
              <strong>Supplier and dates</strong>
              <span>Core product purchase order for pharmacy inventory.</span>
            </div>
            <label>
              Branch
              <select
                value={purchaseOrderForm.branchId}
                onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, branchId: event.target.value })}
                required
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Supplier
              <select
                value={purchaseOrderForm.supplierId}
                onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, supplierId: event.target.value })}
                required
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
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
                value={purchaseOrderForm.orderDate}
                onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, orderDate: event.target.value })}
              />
            </label>
            <label>
              Expected delivery
              <input
                type="date"
                value={purchaseOrderForm.expectedDeliveryDate}
                onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, expectedDeliveryDate: event.target.value })}
              />
            </label>
            <label>
              Order discount
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={purchaseOrderForm.discountAmount}
                onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, discountAmount: event.target.value })}
              />
            </label>
            <label>
              Transport cost
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={purchaseOrderForm.shippingAmount}
                onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, shippingAmount: event.target.value })}
              />
            </label>
            <label className="mobile-native-flow-wide">
              Notes
              <textarea
                value={purchaseOrderForm.notes}
                onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, notes: event.target.value })}
                rows={2}
              />
            </label>
            <div className="mobile-native-flow-actions">
              <button type="submit" className="primary">
                Add products
              </button>
            </div>
          </form>
        )}

        {purchaseOrderStep === 'products' && (
          <section className="mobile-native-flow-card">
            {renderProductSearch({
              selectedProductId: '',
              onSelect: (product) => {
                addPurchaseOrderLine(String(product.id));
                setPoProductSearch(product.name);
              },
              search: poProductSearch,
              onSearch: setPoProductSearch,
              options: poProductOptions,
            })}

            <div className="mobile-native-flow-line-list">
              {purchaseOrderLines.map((line, index) => {
                const product = products.find((item) => String(item.id) === line.productId) ?? null;

                return (
                  <article key={line.localId} className="mobile-native-flow-line-card">
                    <strong>{product ? productLabel(product) : `Product line ${index + 1}`}</strong>
                    <div className="mobile-native-flow-two-column">
                      <label>
                        Product
                        <select
                          value={line.productId}
                          onChange={(event) => updatePurchaseOrderLine(line.localId, { productId: event.target.value })}
                        >
                          <option value="">Select</option>
                          {products.slice(0, 160).map((productOption) => (
                            <option key={productOption.id} value={productOption.id}>
                              {productOption.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Quantity
                        <input
                          type="number"
                          min="1"
                          inputMode="decimal"
                          value={line.quantity}
                          onChange={(event) => updatePurchaseOrderLine(line.localId, { quantity: event.target.value })}
                        />
                      </label>
                      <label>
                        Unit cost
                        <input
                          type="number"
                          min="0"
                          inputMode="decimal"
                          value={line.unitCost}
                          onChange={(event) => updatePurchaseOrderLine(line.localId, { unitCost: event.target.value })}
                        />
                      </label>
                      <label>
                        Notes
                        <input
                          value={line.notes}
                          onChange={(event) => updatePurchaseOrderLine(line.localId, { notes: event.target.value })}
                        />
                      </label>
                    </div>
                    {purchaseOrderLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPurchaseOrderLines((current) => current.filter((item) => item.localId !== line.localId))}
                      >
                        Remove line
                      </button>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="mobile-native-flow-actions">
              <button type="button" onClick={() => addPurchaseOrderLine()}>
                Add line
              </button>
              <button type="button" onClick={() => setPurchaseOrderStep('supplier')}>
                Back
              </button>
              <button type="button" className="primary" onClick={() => setPurchaseOrderStep('review')}>
                Review
              </button>
            </div>
          </section>
        )}

        {purchaseOrderStep === 'review' && (
          <form className="mobile-native-flow-card" onSubmit={submitPurchaseOrder}>
            <div className="mobile-native-flow-review-grid">
              <span>Supplier</span>
              <strong>{suppliers.find((supplier) => String(supplier.id) === purchaseOrderForm.supplierId)?.name ?? 'Not selected'}</strong>
              <span>Branch</span>
              <strong>{branches.find((branch) => String(branch.id) === purchaseOrderForm.branchId)?.name ?? 'Not selected'}</strong>
              <span>Products</span>
              <strong>{purchaseOrderLines.filter((line) => line.productId).length}</strong>
              <span>Transport</span>
              <strong>{money(purchaseOrderForm.shippingAmount)}</strong>
              <span>Discount</span>
              <strong>{money(purchaseOrderForm.discountAmount)}</strong>
              <span>Total</span>
              <strong>{money(purchaseOrderTotal)}</strong>
            </div>
            <div className="mobile-native-flow-line-list">
              {purchaseOrderLines.filter((line) => line.productId).map((line) => {
                const product = products.find((item) => String(item.id) === line.productId) ?? null;

                return (
                  <article key={line.localId} className="mobile-native-flow-review-line">
                    <strong>{productLabel(product)}</strong>
                    <span>{line.quantity || '0'} x {money(line.unitCost)}</span>
                  </article>
                );
              })}
            </div>
            <div className="mobile-native-flow-actions">
              <button type="button" onClick={() => setPurchaseOrderStep('products')}>
                Back
              </button>
              <button type="submit" className="primary" disabled={isSaving}>
                {isSaving ? 'Submitting...' : 'Create purchase order'}
              </button>
            </div>
          </form>
        )}

        {purchaseOrderStep === 'success' && (
          <section className="mobile-native-flow-success">
            <strong>Purchase order created</strong>
            <span>{notice || 'The purchase order is now available for approval and receiving.'}</span>
            <div className="mobile-native-flow-actions">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setPurchaseOrderForm((current) => ({
                    ...current,
                    orderDate: todayIso(),
                    expectedDeliveryDate: '',
                    discountAmount: '0',
                    shippingAmount: '0',
                    notes: '',
                  }));
                  setPurchaseOrderLines([
                    {
                      localId: localId('po-line'),
                      productId: '',
                      quantity: '',
                      unitCost: '',
                      notes: '',
                    },
                  ]);
                  setPoProductSearch('');
                  setPurchaseOrderStep('supplier');
                }}
              >
                Create another
              </button>
            </div>
          </section>
        )}
      </>
    );
  }

  function renderPurchaseOrderReceiving() {
    const activeIndex = poReceiveStep === 'orders' ? 0 : poReceiveStep === 'items' ? 1 : poReceiveStep === 'details' ? 2 : 3;

    return (
      <>
        {renderStepDots(['Orders', 'Items', 'Details', 'Review'], activeIndex)}

        {poReceiveStep === 'orders' && (
          <section className="mobile-native-flow-card">
            <div className="mobile-native-flow-order-list">
              {receivableOrders.length === 0 ? (
                <div className="mobile-native-flow-state">
                  <strong>No open purchase order</strong>
                  <span>Approved or partially received core-product orders will appear here.</span>
                </div>
              ) : (
                receivableOrders.map((order) => (
                  <article key={order.id} className="mobile-native-flow-order-card">
                    <div>
                      <span>{order.order_date || order.created_at || 'No date'}</span>
                      <strong>{order.po_number}</strong>
                      <small>{order.supplier?.name || 'No supplier'} / {order.items_count ?? order.items?.length ?? 0} products</small>
                    </div>
                    <div>
                      <strong>{money(order.total_amount)}</strong>
                      <button type="button" onClick={() => void openPurchaseOrder(order)}>
                        Receive
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {poReceiveStep === 'items' && selectedPurchaseOrder && (
          <section className="mobile-native-flow-card">
            <div className="mobile-native-flow-card-heading">
              <strong>{selectedPurchaseOrder.po_number}</strong>
              <span>{selectedPurchaseOrder.supplier?.name || 'No supplier'}</span>
            </div>
            <div className="mobile-native-flow-line-list">
              {(selectedPurchaseOrder.items ?? []).filter((item) => item.product?.id && remainingQuantity(item) > 0).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`mobile-native-flow-item-option ${String(item.id) === selectedPurchaseOrderItemId ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedPurchaseOrderItemId(String(item.id));
                    setPoReceivingForm((current) => ({
                      ...current,
                      quantity: String(remainingQuantity(item)),
                      unitCost: String(item.unit_cost ?? ''),
                    }));
                  }}
                >
                  <strong>{item.product?.name || item.product_name_snapshot}</strong>
                  <span>Ordered {item.quantity_ordered.toLocaleString('en-RW')} / remaining {remainingQuantity(item).toLocaleString('en-RW')}</span>
                </button>
              ))}
            </div>
            <div className="mobile-native-flow-actions">
              <button type="button" onClick={() => setPoReceiveStep('orders')}>
                Back
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => setPoReceiveStep('details')}
                disabled={!selectedPurchaseOrderItemId}
              >
                Start receiving
              </button>
            </div>
          </section>
        )}

        {poReceiveStep === 'details' && selectedPoItem && (
          <form className="mobile-native-flow-card mobile-native-flow-two-column" onSubmit={(event) => {
            event.preventDefault();
            setPoReceiveStep('review');
          }}>
            <div className="mobile-native-flow-card-heading">
              <strong>{selectedPoItem.product?.name || selectedPoItem.product_name_snapshot}</strong>
              <span>Remaining: {remainingQuantity(selectedPoItem).toLocaleString('en-RW')}</span>
            </div>
            <label>
              Batch number
              <input
                value={poReceivingForm.batchNumber}
                onChange={(event) => setPoReceivingForm({ ...poReceivingForm, batchNumber: event.target.value })}
                required
              />
            </label>
            <label>
              Quantity
              <input
                type="number"
                min="1"
                max={remainingQuantity(selectedPoItem)}
                inputMode="decimal"
                value={poReceivingForm.quantity}
                onChange={(event) => setPoReceivingForm({ ...poReceivingForm, quantity: event.target.value })}
                required
              />
            </label>
            <label>
              Expiry date
              <input
                type="date"
                value={poReceivingForm.expiryDate}
                onChange={(event) => setPoReceivingForm({ ...poReceivingForm, expiryDate: event.target.value })}
              />
            </label>
            <label>
              Unit cost
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={poReceivingForm.unitCost}
                onChange={(event) => setPoReceivingForm({ ...poReceivingForm, unitCost: event.target.value })}
              />
            </label>
            <label>
              Selling price
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={poReceivingForm.sellingPrice}
                onChange={(event) => setPoReceivingForm({ ...poReceivingForm, sellingPrice: event.target.value })}
              />
            </label>
            <label>
              Stock location
              <select
                value={poReceivingForm.stockLocationId}
                onChange={(event) => setPoReceivingForm({ ...poReceivingForm, stockLocationId: event.target.value })}
                required
              >
                <option value="">Select location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mobile-native-flow-wide">
              Reference
              <input
                value={poReceivingForm.referenceNumber}
                onChange={(event) => setPoReceivingForm({ ...poReceivingForm, referenceNumber: event.target.value })}
              />
            </label>
            <div className="mobile-native-flow-actions">
              <button type="button" onClick={() => setPoReceiveStep('items')}>
                Back
              </button>
              <button type="submit" className="primary">
                Review
              </button>
            </div>
          </form>
        )}

        {poReceiveStep === 'review' && selectedPurchaseOrder && selectedPoItem && (
          <form className="mobile-native-flow-card" onSubmit={submitPurchaseOrderReceiving}>
            <div className="mobile-native-flow-review-grid">
              <span>PO</span>
              <strong>{selectedPurchaseOrder.po_number}</strong>
              <span>Product</span>
              <strong>{selectedPoItem.product?.name || selectedPoItem.product_name_snapshot}</strong>
              <span>Ordered</span>
              <strong>{selectedPoItem.quantity_ordered.toLocaleString('en-RW')}</strong>
              <span>Receiving now</span>
              <strong>{poReceivingForm.quantity || '0'}</strong>
              <span>Variance after</span>
              <strong>{Math.max(remainingQuantity(selectedPoItem) - numberFrom(poReceivingForm.quantity), 0).toLocaleString('en-RW')}</strong>
              <span>Batch</span>
              <strong>{poReceivingForm.batchNumber || 'Not set'}</strong>
            </div>
            <div className="mobile-native-flow-actions">
              <button type="button" onClick={() => setPoReceiveStep('details')}>
                Back
              </button>
              <button type="submit" className="primary" disabled={isSaving}>
                {isSaving ? 'Submitting...' : 'Submit receiving'}
              </button>
            </div>
          </form>
        )}

	        {poReceiveStep === 'success' && (
	          <section className="mobile-native-flow-success">
	            <strong>Purchase order receiving saved</strong>
	            <span>{notice || 'The inventory and purchase-order receiving status were updated.'}</span>
	            {completedPoReceipts.length > 0 && (
	              <div className="mobile-native-flow-line-list">
	                {completedPoReceipts.map((receipt) => (
	                  <article key={receipt.itemId} className="mobile-native-flow-review-line">
	                    <strong>{receipt.productName}</strong>
	                    <span>
	                      Ordered {receipt.orderedQuantity.toLocaleString('en-RW')} / received{' '}
	                      {receipt.receivedQuantity.toLocaleString('en-RW')} / variance{' '}
	                      {receipt.remainingQuantity.toLocaleString('en-RW')}
	                    </span>
	                  </article>
	                ))}
	              </div>
	            )}
	            <div className="mobile-native-flow-actions">
	              <button
	                type="button"
	                className="primary"
	                onClick={() => {
	                  setSelectedPurchaseOrder(null);
	                  setSelectedPurchaseOrderItemId('');
	                  setCompletedPoReceipts([]);
	                  setPoReceivingForm((current) => ({
	                    ...current,
	                    batchNumber: '',
                    quantity: '',
                    expiryDate: '',
                    sellingPrice: '',
                  }));
                  setPoReceiveStep('orders');
                }}
              >
                Receive another
              </button>
            </div>
          </section>
        )}
      </>
    );
  }

  return (
    <section className="mobile-native-flow" aria-label={workflowTitle(kind)}>
      <header className="mobile-native-flow-hero">
        <span>Mobile app workflow</span>
        <strong>{workflowTitle(kind)}</strong>
        <small>{workflowSubtitle(kind)}</small>
      </header>

      {renderMessages()}
      {renderLoading()}

      {!isLoading && kind === 'receive-stock-manually' && renderManualReceiving()}
      {!isLoading && kind === 'purchase-orders' && renderPurchaseOrderBuilder()}
      {!isLoading && kind === 'receiving' && renderPurchaseOrderReceiving()}
    </section>
  );
}

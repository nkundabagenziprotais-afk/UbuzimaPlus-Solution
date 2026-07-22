import { useEffect, useMemo, useState } from 'react';
import {
  PharmaBranch,
  PharmaCustomer,
  PharmaPrescription,
  PharmaProduct,
  PharmaSale,
  PharmaStockBatch,
  createPharmaCustomer,
  createPharmaPrescription,
  createPharmaSale,
  uploadPharmaPrescriptionAttachment,
} from '../lib/api';


type SalePreviewLine = {
  index: number;
} & Record<string, number>;

type Props = {
  token: string;
  tenantSlug: string;
  branches: PharmaBranch[];
  customers: PharmaCustomer[];
  prescriptions: PharmaPrescription[];
  products: PharmaProduct[];
  batches: PharmaStockBatch[];
  onCustomerCreated: (customer: PharmaCustomer) => void;
  onPrescriptionCreated: (prescription: PharmaPrescription) => void;
  onSaleCreated: (sale: PharmaSale) => void;
};

type CustomerForm = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  gender: string;
  insurance_provider: string;
  insurance_membership_number: string;
  notes: string;
};

type PrescriptionForm = {
  pharmaco_customer_id: string;
  prescriber_name: string;
  prescriber_facility: string;
  prescriber_phone: string;
  issued_at: string;
  expires_at: string;
  notes: string;
};

type SaleLineForm = {
  product_id: string;
  stock_batch_id: string;
  quantity: string;
  unit_price: string;
  discount_amount: string;
  tax_amount: string;
};

type SaleForm = {
  branch_id: string;
  pharmaco_customer_id: string;
  pharmaco_prescription_id: string;
  sale_type: 'cash_sale' | 'prescription_sale' | 'insurance_sale' | 'credit_sale';
  discount_amount: string;
  tax_amount: string;
  notes: string;
  items: SaleLineForm[];
};

type ProductBrowserView = 'grid' | 'list';

function blankCustomerForm(): CustomerForm {
  return {
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    gender: '',
    insurance_provider: '',
    insurance_membership_number: '',
    notes: '',
  };
}

function blankPrescriptionForm(customerId = ''): PrescriptionForm {
  return {
    pharmaco_customer_id: customerId,
    prescriber_name: '',
    prescriber_facility: '',
    prescriber_phone: '',
    issued_at: new Date().toISOString().slice(0, 10),
    expires_at: '',
    notes: '',
  };
}

function normalizePosProductSearchText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function blankSaleLine(productId = '', stockBatchId = '', unitPrice = ''): SaleLineForm {
  return {
    product_id: productId,
    stock_batch_id: stockBatchId,
    quantity: '1',
    unit_price: unitPrice,
    discount_amount: '0',
    tax_amount: '0',
  };
}

function blankSaleForm(branchId = '', customerId = '', prescriptionId = ''): SaleForm {
  return {
    branch_id: branchId,
    pharmaco_customer_id: customerId,
    pharmaco_prescription_id: prescriptionId,
    sale_type: prescriptionId ? 'prescription_sale' : 'cash_sale',
    discount_amount: '0',
    tax_amount: '0',
    notes: '',
    items: [],
  };
}

function toNumber(value: string): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value);
}

export function SalesCreationPanel({
  token,
  tenantSlug,
  branches,
  customers,
  prescriptions,
  products,
  batches,
  onCustomerCreated,
  onPrescriptionCreated,
  onSaleCreated,
}: Props) {
  const activeBranches = branches.filter((branch) => branch.status === 'active');
  const activeProducts = products.filter((product) => product.status === 'active');

  const [customerForm, setCustomerForm] = useState<CustomerForm>(blankCustomerForm());
  const [prescriptionForm, setPrescriptionForm] = useState<PrescriptionForm>(blankPrescriptionForm());
  const [saleForm, setSaleForm] = useState<SaleForm>(
    blankSaleForm(String(activeBranches[0]?.id ?? ''), '', ''),
  );
  const [productSearch, setProductSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [productBrowserView, setProductBrowserView] = useState<ProductBrowserView>('grid');
  const [invoiceRequested, setInvoiceRequested] = useState(false);
  const [insuranceCustomerPercent, setInsuranceCustomerPercent] = useState('20');
  const [insurancePartnerPercent, setInsurancePartnerPercent] = useState('80');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isSavingPrescription, setIsSavingPrescription] = useState(false);
  const [isSavingSale, setIsSavingSale] = useState(false);
  const [creationNotice, setCreationNotice] = useState('');
  const [creationError, setCreationError] = useState('');
  const [isCustomerCaptureOpen, setIsCustomerCaptureOpen] = useState(false);
  const [isPrescriptionCaptureOpen, setIsPrescriptionCaptureOpen] = useState(false);
  const [prescriptionAttachment, setPrescriptionAttachment] = useState<File | null>(null);

  useEffect(() => {
    if (!saleForm.branch_id && activeBranches[0]?.id) {
      setSaleForm((current) => ({
        ...current,
        branch_id: String(activeBranches[0].id),
      }));
    }
  }, [activeBranches, saleForm.branch_id]);

  const salePreview = useMemo(() => {
    const lineSubtotal = saleForm.items.reduce((sum, item) => {
      const quantity = toNumber(item.quantity);
      const unitPrice = toNumber(item.unit_price);
      const discount = toNumber(item.discount_amount);
      const tax = toNumber(item.tax_amount);

      return sum + Math.max(quantity * unitPrice - discount + tax, 0);
    }, 0);

    const saleDiscount = toNumber(saleForm.discount_amount);
    const saleTax = toNumber(saleForm.tax_amount);
    const total = Math.max(lineSubtotal - saleDiscount + saleTax, 0);
    const customerPercent = saleForm.sale_type === 'insurance_sale'
      ? Math.max(Math.min(toNumber(insuranceCustomerPercent), 100), 0)
      : 100;
    const partnerPercent = saleForm.sale_type === 'insurance_sale'
      ? Math.max(Math.min(toNumber(insurancePartnerPercent), 100), 0)
      : 0;

    return {
      lineSubtotal,
      saleDiscount,
      saleTax,
      total,
      customerContribution: total * (customerPercent / 100),
      partnerContribution: total * (partnerPercent / 100),
    };
  }, [insuranceCustomerPercent, insurancePartnerPercent, saleForm]);

  const prescriptionRequiredWithoutPrescription = saleForm.items.some((item) => {
    const product = activeProducts.find((entry) => entry.id === Number(item.product_id));

    return product?.requires_prescription && !saleForm.pharmaco_prescription_id;
  });

  const productCategories = useMemo(() => {
    const categories = new Map<string, string>();

    activeProducts.forEach((product) => {
      if (product.category?.code && product.category.name) {
        categories.set(product.category.code, product.category.name);
      }
    });

    return Array.from(categories.entries()).map(([code, name]) => ({ code, name }));
  }, [activeProducts]);

  const visibleProducts = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLowerCase();

    return activeProducts
      .filter((product) => activeCategory === 'all' || product.category?.code === activeCategory)
      .filter((product) => {
        if (!normalizedSearch) return true;

        return [
          product.name,
          product.generic_name,
          product.brand_name,
          product.sku,
          product.barcode,
          product.category?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => {
        const leftRisk = left.stock_summary?.is_below_reorder_level ? 0 : 1;
        const rightRisk = right.stock_summary?.is_below_reorder_level ? 0 : 1;

        return leftRisk - rightRisk || left.name.localeCompare(right.name);
      });
  }, [activeCategory, activeProducts, productSearch]);

  function preferredPrice(product: PharmaProduct): string {
    const price = bestBatch(product.id)?.selling_price;

    return price === null || price === undefined ? '' : String(price);
  }

  function stockBatchesForProduct(productId: number): PharmaStockBatch[] {
    return batches
      .filter((batch) => batch.product.id === productId)
      .filter((batch) => batch.status === 'active' && batch.available_quantity > 0)
      .sort((left, right) => {
        const leftExpiry = left.expiry_date ? new Date(left.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
        const rightExpiry = right.expiry_date ? new Date(right.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;

        return leftExpiry - rightExpiry || left.id - right.id;
      });
  }

  function bestBatch(productId: number): PharmaStockBatch | undefined {
    return stockBatchesForProduct(productId)[0];
  }

  function batchSellingPrice(stockBatch?: PharmaStockBatch): string {
    return stockBatch?.selling_price === null || stockBatch?.selling_price === undefined
      ? ''
      : String(stockBatch.selling_price);
  }

  function addProductToCart(product: PharmaProduct, stockBatch = bestBatch(product.id)) {
    if (
      product.requires_prescription &&
      !saleForm.pharmaco_prescription_id
    ) {
      setIsPrescriptionCaptureOpen(true);
      setCreationNotice(
        'This medicine normally requires a prescription. Pharmacist may proceed after reviewing this warning.',
      );
    }

    const selectedBatchId = stockBatch ? String(stockBatch.id) : '';
    const selectedUnitPrice = batchSellingPrice(stockBatch);

    setSaleForm((current) => {
      const currentItems = current.items.filter((item) => item.product_id);
      const existingIndex = currentItems.findIndex(
        (item) =>
          item.product_id === String(product.id) &&
          (item.stock_batch_id || '') === selectedBatchId,
      );

      if (existingIndex >= 0) {
        return {
          ...current,
          items: currentItems.map((item, index) =>
            index === existingIndex
              ? {
                  ...item,
                  quantity: String(Math.max(toNumber(item.quantity), 0) + 1),
                  unit_price: item.unit_price || selectedUnitPrice,
                }
              : item,
          ),
          sale_type: product.requires_prescription ? 'prescription_sale' : current.sale_type,
        };
      }

      return {
        ...current,
        items: [
          ...currentItems,
          blankSaleLine(String(product.id), selectedBatchId, selectedUnitPrice),
        ],
        sale_type: product.requires_prescription ? 'prescription_sale' : current.sale_type,
      };
    });
  }


  async function handleCreateCustomer() {
    if (!customerForm.first_name.trim()) {
      setCreationError('Customer first name is required.');
      return;
    }

    setIsSavingCustomer(true);
    setCreationError('');
    setCreationNotice('');

    try {
      const response = await createPharmaCustomer(token, tenantSlug, {
        first_name: customerForm.first_name.trim(),
        last_name: customerForm.last_name.trim() || null,
        phone: customerForm.phone.trim() || null,
        email: customerForm.email.trim() || null,
        gender: customerForm.gender.trim() || null,
        insurance_provider: customerForm.insurance_provider.trim() || null,
        insurance_membership_number: customerForm.insurance_membership_number.trim() || null,
        customer_type: 'patient',
        notes: customerForm.notes.trim() || null,
      });

      onCustomerCreated(response.customer);
      setCustomerForm(blankCustomerForm());
      setPrescriptionForm(blankPrescriptionForm(String(response.customer.id)));
      setSaleForm((current) => ({
        ...current,
        pharmaco_customer_id: String(response.customer.id),
      }));
      setCreationNotice(response.message);
      setIsCustomerCaptureOpen(false);
    } catch (err) {
      setCreationError(err instanceof Error ? err.message : 'Unable to create customer.');
    } finally {
      setIsSavingCustomer(false);
    }
  }

  async function handleCreatePrescription() {
    setIsSavingPrescription(true);
    setCreationError('');
    setCreationNotice('');

    try {
      const response = await createPharmaPrescription(token, tenantSlug, {
        pharmaco_customer_id: prescriptionForm.pharmaco_customer_id
          ? Number(prescriptionForm.pharmaco_customer_id)
          : null,
        prescriber_name: prescriptionForm.prescriber_name.trim() || null,
        prescriber_facility: prescriptionForm.prescriber_facility.trim() || null,
        prescriber_phone: prescriptionForm.prescriber_phone.trim() || null,
        issued_at: prescriptionForm.issued_at || null,
        expires_at: prescriptionForm.expires_at || null,
        notes: prescriptionForm.notes.trim() || null,
      });

      let savedPrescription = response.prescription;
      let attachmentNotice = '';

      if (prescriptionAttachment) {
        try {
          const attachmentResponse =
            await uploadPharmaPrescriptionAttachment(
              token,
              tenantSlug,
              response.prescription.id,
              prescriptionAttachment,
            );

          savedPrescription =
            attachmentResponse.prescription;

          attachmentNotice =
            ' Prescription attachment uploaded.';
        } catch (attachmentError) {
          attachmentNotice =
            attachmentError instanceof Error
              ? ` Prescription created, but attachment upload needs attention: ${attachmentError.message}`
              : ' Prescription created, but the attachment could not be uploaded.';
        }
      }

      onPrescriptionCreated(savedPrescription);
      setPrescriptionForm(blankPrescriptionForm(prescriptionForm.pharmaco_customer_id));
      setPrescriptionAttachment(null);
      setSaleForm((current) => ({
        ...current,
        pharmaco_customer_id: String(savedPrescription.customer?.id ?? current.pharmaco_customer_id),
        pharmaco_prescription_id: String(savedPrescription.id),
        sale_type: 'prescription_sale',
      }));
      setCreationNotice(
        `${response.message}${attachmentNotice}`,
      );
      setIsPrescriptionCaptureOpen(false);
    } catch (err) {
      setCreationError(err instanceof Error ? err.message : 'Unable to create prescription.');
    } finally {
      setIsSavingPrescription(false);
    }
  }

  async function handleCreateSale() {
    if (!saleForm.branch_id) {
      setCreationError('Select a branch before creating the sale.');
      return;
    }

    const validItems = saleForm.items
      .filter((item) => item.product_id && toNumber(item.quantity) > 0 && toNumber(item.unit_price) >= 0)
      .map((item) => ({
        product_id: Number(item.product_id),
        stock_batch_id: item.stock_batch_id ? Number(item.stock_batch_id) : null,
        quantity: toNumber(item.quantity),
        unit_price: toNumber(item.unit_price),
        discount_amount: toNumber(item.discount_amount),
        tax_amount: toNumber(item.tax_amount),
      }));

    if (validItems.length === 0) {
      setCreationError('Add at least one valid sale item.');
      return;
    }

    if (prescriptionRequiredWithoutPrescription) {
      setCreationError('');
    }

    setIsSavingSale(true);
    setCreationError('');
    setCreationNotice('');

    try {
      const response = await createPharmaSale(token, tenantSlug, {
        branch_id: Number(saleForm.branch_id),
        pharmaco_customer_id: saleForm.pharmaco_customer_id
          ? Number(saleForm.pharmaco_customer_id)
          : null,
        pharmaco_prescription_id: saleForm.pharmaco_prescription_id
          ? Number(saleForm.pharmaco_prescription_id)
          : null,
        sale_type: saleForm.sale_type,
        discount_amount: toNumber(saleForm.discount_amount),
        tax_amount: toNumber(saleForm.tax_amount),
        notes: saleForm.notes.trim() || null,
        items: validItems,
      });

      onSaleCreated(response.sale);
      setSaleForm(blankSaleForm(saleForm.branch_id, saleForm.pharmaco_customer_id, saleForm.pharmaco_prescription_id));
      setCreationNotice(response.message);
    } catch (err) {
      setCreationError(err instanceof Error ? err.message : 'Unable to create draft sale.');
    } finally {
      setIsSavingSale(false);
    }
  }

  function updateSaleLine(index: number, patch: Partial<SaleLineForm>) {
    setSaleForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function removeSaleLine(index: number) {
    setSaleForm((current) => ({
      ...current,
      items: current.items.length === 1
        ? [blankSaleLine()]
        : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  const cartLineCount = saleForm.items.filter((item) => item.product_id).length;
  const selectedCustomer = customers.find((customer) => customer.id === Number(saleForm.pharmaco_customer_id));
  const selectedPrescription = prescriptions.find((prescription) => prescription.id === Number(saleForm.pharmaco_prescription_id));

  return (
    <section className="sales-creation-card">
      <div className="panel-heading-row">
        <div>
          <span className="section-label">Retail pharmacy counter</span>
          <h3>POS</h3>
          <p className="muted">
            Search products, build the sale cart, confirm customer contribution, capture prescription when needed,
            then create the draft sale for FEFO dispensing and payment review.
          </p>
        </div>
        <div className="sale-total-box">
          <span>Cart total</span>
          <strong>{money(salePreview.total)}</strong>
          <small>{cartLineCount} line{cartLineCount === 1 ? '' : 's'} · subtotal {money(salePreview.lineSubtotal)}</small>
        </div>
      </div>

      {creationError && <div className="form-error">{creationError}</div>}
      {creationNotice && <div className="form-success">{creationNotice}</div>}

      <div className="retail-pos-grid">
        <section className="pos-product-browser" aria-label="Product browser">
          <div className="section-heading">
            <div>
              <h4>Product browser</h4>
              <span>Search by medicine, SKU, barcode, brand, or category.</span>
            </div>
            <div className="view-toggle" aria-label="Product browser view">
              <button
                type="button"
                className={productBrowserView === 'grid' ? 'active' : ''}
                onClick={() => setProductBrowserView('grid')}
              >
                Grid
              </button>
              <button
                type="button"
                className={productBrowserView === 'list' ? 'active' : ''}
                onClick={() => setProductBrowserView('list')}
              >
                List
              </button>
            </div>
          </div>

          <div className="pos-product-toolbar">
            <label>
              Search
              <input
                value={productSearch}
                placeholder="Amoxicillin, paracetamol, barcode..."
                onChange={(event) => setProductSearch(event.target.value)}
              />
            </label>

            <label>
              Category
              <select value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)}>
                <option value="all">All categories</option>
                {productCategories.map((category) => (
                  <option key={category.code} value={category.code}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={`pos-product-grid ${productBrowserView === 'list' ? 'pos-product-grid--list' : ''}`}>
            {visibleProducts.slice(0, productBrowserView === 'grid' ? 10 : 16).map((product) => {
              const batch = bestBatch(product.id);
              const price = preferredPrice(product);

              return (
                <button key={product.id} type="button" onClick={() => addProductToCart(product, bestBatch(product.id))}>
                  <span className={product.requires_prescription ? 'rx-chip' : 'otc-chip'}>
                    {product.requires_prescription ? 'RX' : 'OTC'}
                  </span>
                  <strong>{product.name}</strong>
                  <small>{product.sku} · {product.category?.name ?? 'Uncategorised'}</small>
                  <em>
                    {price ? money(Number(price)) : 'Set price in cart'} · stock {product.stock_summary?.available_quantity ?? 0}
                  </em>
                  <small>FEFO batch: {batch?.batch_number ?? 'No active batch'}</small>
                </button>
              );
            })}

            {visibleProducts.length === 0 && (
              <p className="muted">No matching products. Try product name, generic name, SKU, barcode, or confirm the product exists in Product Inventory with active stock.</p>
            )}
          </div>
        </section>

        <section className="pos-cart-panel" aria-label="Current sale cart">
          <div className="section-heading">
            <div>
              <h4>Sale cart</h4>
              <span>{selectedCustomer?.full_name ?? 'Walk-in customer'} · {selectedPrescription?.prescription_number ?? 'No prescription selected'}</span>
            </div>
          </div>

          <div className="pos-meta-grid">
            <label>
              Branch
              <select
                value={saleForm.branch_id}
                onChange={(event) => setSaleForm((current) => ({ ...current, branch_id: event.target.value }))}
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
              Customer
              <select
                value={saleForm.pharmaco_customer_id}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    pharmaco_customer_id: event.target.value,
                  }))
                }
              >
                <option value="">Walk-in customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Prescription
              <select
                value={saleForm.pharmaco_prescription_id}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    pharmaco_prescription_id: event.target.value,
                    sale_type: event.target.value ? 'prescription_sale' : current.sale_type,
                  }))
                }
              >
                <option value="">No prescription</option>
                {prescriptions.map((prescription) => (
                  <option key={prescription.id} value={prescription.id}>
                    {prescription.prescription_number}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Sale type
              <select
                value={saleForm.sale_type}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    sale_type: event.target.value as SaleForm['sale_type'],
                  }))
                }
              >
                <option value="cash_sale">Cash sale</option>
                <option value="prescription_sale">Prescription sale</option>
                <option value="insurance_sale">Insurance sale</option>
                <option value="credit_sale">Credit sale</option>
              </select>
            </label>

            {saleForm.sale_type === 'insurance_sale' && (
              <>
                <label>
                  Customer %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={insuranceCustomerPercent}
                    onChange={(event) => setInsuranceCustomerPercent(event.target.value)}
                  />
                </label>
                <label>
                  Insurance %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={insurancePartnerPercent}
                    onChange={(event) => setInsurancePartnerPercent(event.target.value)}
                  />
                </label>
              </>
            )}

            <label className="checkbox-label invoice-checkbox">
              <input
                type="checkbox"
                checked={invoiceRequested}
                onChange={(event) => setInvoiceRequested(event.target.checked)}
              />
              Customer wants invoice
            </label>
          </div>

          <div className="pos-cart-lines">
            {saleForm.items.some((item) => item.product_id) ? (
              saleForm.items.map((item, index) => {
                if (!item.product_id) return null;

                const product = activeProducts.find((entry) => entry.id === Number(item.product_id));
                const linePreview = (
                  salePreview as typeof salePreview & { lines: SalePreviewLine[] }
                ).lines?.find((line) => line.index === index);
                const productBatches = product ? stockBatchesForProduct(product.id) : [];

                return (
                  <div key={`${item.product_id}-${item.stock_batch_id || 'auto'}-${index}`} className="pos-cart-line">
                    <div>
                      <strong>{product?.name ?? 'Selected product'}</strong>
                      <small>{product?.sku ?? 'SKU pending'} · {product?.requires_prescription ? 'Prescription required' : 'OTC/general'}</small>
                    </div>

                    <label className="pos-stock-pick">
                      Stock pick
                      <select
                        value={item.stock_batch_id}
                        onChange={(event) => {
                          const nextBatch = batches.find((batch) => batch.id === Number(event.target.value));

                          updateSaleLine(index, {
                            stock_batch_id: event.target.value,
                            unit_price: nextBatch?.selling_price !== null && nextBatch?.selling_price !== undefined
                              ? String(nextBatch.selling_price)
                              : item.unit_price,
                          });
                        }}
                      >
                        <option value="">FEFO auto</option>
                        {productBatches.map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            {batch.batch_number} · {batch.stock_location.name} · {batch.available_quantity}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Qty
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) => updateSaleLine(index, { quantity: event.target.value })}
                      />
                    </label>

                    <label>
                      Price
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(event) => updateSaleLine(index, { unit_price: event.target.value })}
                      />
                    </label>

                    <label>
                      Discount
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.discount_amount}
                        onChange={(event) => updateSaleLine(index, { discount_amount: event.target.value })}
                      />
                    </label>

                    <div className="pos-line-calculated">
                      <span>Tax</span>
                      <strong>{money(linePreview?.taxAmount ?? 0)}</strong>
                      <small>{linePreview?.taxRule ? `Tax rule #${linePreview.taxRule}` : 'No active rule'}</small>
                    </div>

                    <button type="button" onClick={() => removeSaleLine(index)}>
                      Remove
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="muted">Add products from the browser to start a sale.</p>
            )}
          </div>

          {prescriptionRequiredWithoutPrescription && (
            <div className="prescription-capture-alert">
              <div>
                <strong>Prescription required</strong>
                <span>Capture an image for AI extraction or enter the details manually before checkout.</span>
              </div>
              <label>
                Capture prescription image
                <input type="file" accept="image/*" capture="environment" />
              </label>
              <button type="button" onClick={() => setPrescriptionForm(blankPrescriptionForm(saleForm.pharmaco_customer_id))}>
                Manual prescription entry
              </button>
              <button type="button" disabled={!saleForm.pharmaco_customer_id}>
                Retrieve customer history
              </button>
            </div>
          )}

          <div className="pos-cart-footer">
            <label>
              Sale discount
              <input
                type="number"
                min="0"
                step="0.01"
                value={saleForm.discount_amount}
                onChange={(event) =>
                  setSaleForm((current) => ({ ...current, discount_amount: event.target.value }))
                }
              />
            </label>
            <label>
              Sale tax
              <input
                type="number"
                min="0"
                step="0.01"
                value={saleForm.tax_amount}
                onChange={(event) => setSaleForm((current) => ({ ...current, tax_amount: event.target.value }))}
              />
            </label>
            <label>
              Note
              <input
                value={saleForm.notes}
                placeholder="Optional sale note"
                onChange={(event) => setSaleForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
          </div>

          <div className="transaction-summary-panel">
            <strong>Transaction summary</strong>
            <div><span>Subtotal</span><small>{money(salePreview.lineSubtotal)}</small></div>
            <div><span>Discount</span><small>{money(salePreview.saleDiscount)}</small></div>
            <div><span>Tax</span><small>{money(salePreview.saleTax)}</small></div>
            <div><span>Customer contribution</span><small>{money(salePreview.customerContribution)}</small></div>
            {saleForm.sale_type === 'insurance_sale' && (
              <div><span>Insurance / partner contribution</span><small>{money(salePreview.partnerContribution)}</small></div>
            )}
            <div className="transaction-summary-total"><span>Total due</span><small>{money(salePreview.total)}</small></div>
          </div>

          <div className="draft-sale-footer pos-action-footer">
            <button
              type="button"
              onClick={() =>
                setSaleForm((current) => ({
                  ...current,
                  items: [],
                }))
              }
            >
              Clear cart
            </button>

            <button type="button" onClick={handleCreateSale} disabled={isSavingSale || cartLineCount === 0}>
              {isSavingSale ? 'Creating draft sale...' : 'Create draft sale'}
            </button>
          </div>
        </section>
      </div>

      <div className="pos-support-action-grid">
        <section className="quick-customer-panel pos-capture-action-card">
          <div>
            <span className="section-label">
              Customer information
            </span>
            <h4>Customer capture</h4>
            <p className="muted">
              Capture identity, contact, insurance,
              invoice, credit, or follow-up information
              only when it is needed.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setIsCustomerCaptureOpen(true)
            }
          >
            Open customer form
          </button>
        </section>

        <section
          className={`quick-customer-panel pos-capture-action-card ${
            prescriptionRequiredWithoutPrescription
              ? 'requires-attention'
              : ''
          }`}
        >
          <div>
            <span className="section-label">
              Prescription information
            </span>
            <h4>Prescription capture</h4>
            <p className="muted">
              {prescriptionRequiredWithoutPrescription
                ? 'A selected medicine normally requires a prescription. Pharmacist can proceed after reviewing this warning.'
                : 'Attach a prescription now or capture it later through Prescription Management.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setIsPrescriptionCaptureOpen(true)
            }
          >
            {prescriptionRequiredWithoutPrescription
              ? 'Proceed with pharmacist warning'
              : 'Open prescription form'}
          </button>
        </section>
      </div>

      {isCustomerCaptureOpen && (
        <div
          className="workspace-explicit-modal-backdrop is-open"
          role="presentation"
          onMouseDown={() =>
            setIsCustomerCaptureOpen(false)
          }
        >
          <section
            className="workspace-explicit-modal pos-capture-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Customer capture"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="workspace-explicit-modal-close"
              onClick={() =>
                setIsCustomerCaptureOpen(false)
              }
              aria-label="Close customer form"
            >
              ×
            </button>

            <div className="popup-form-heading">
              <span className="section-label">
                POS customer record
              </span>
              <h3>Customer capture</h3>
              <p className="muted">
                Record only the information needed
                for this sale, invoice, insurance,
                credit, or patient follow-up.
              </p>
            </div>

            <div className="creation-form-grid">
              <label>
                First name
                <input
                  value={customerForm.first_name}
                  onChange={(event) =>
                    setCustomerForm((current) => ({
                      ...current,
                      first_name:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Last name
                <input
                  value={customerForm.last_name}
                  onChange={(event) =>
                    setCustomerForm((current) => ({
                      ...current,
                      last_name:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Phone
                <input
                  value={customerForm.phone}
                  onChange={(event) =>
                    setCustomerForm((current) => ({
                      ...current,
                      phone:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={customerForm.email}
                  onChange={(event) =>
                    setCustomerForm((current) => ({
                      ...current,
                      email:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Gender
                <input
                  value={customerForm.gender}
                  onChange={(event) =>
                    setCustomerForm((current) => ({
                      ...current,
                      gender:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Insurance provider
                <input
                  value={
                    customerForm
                      .insurance_provider
                  }
                  onChange={(event) =>
                    setCustomerForm((current) => ({
                      ...current,
                      insurance_provider:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Insurance number
                <input
                  value={
                    customerForm
                      .insurance_membership_number
                  }
                  onChange={(event) =>
                    setCustomerForm((current) => ({
                      ...current,
                      insurance_membership_number:
                        event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="managed-detail-actions">
              <button
                type="button"
                onClick={() =>
                  setIsCustomerCaptureOpen(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCreateCustomer}
                disabled={isSavingCustomer}
              >
                {isSavingCustomer
                  ? 'Creating customer…'
                  : 'Create customer'}
              </button>
            </div>
          </section>
        </div>
      )}

      {isPrescriptionCaptureOpen && (
        <div
          className="workspace-explicit-modal-backdrop is-open"
          role="presentation"
          onMouseDown={() =>
            setIsPrescriptionCaptureOpen(false)
          }
        >
          <section
            className="workspace-explicit-modal pos-capture-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Prescription capture"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="workspace-explicit-modal-close"
              onClick={() =>
                setIsPrescriptionCaptureOpen(false)
              }
              aria-label="Close prescription form"
            >
              ×
            </button>

            <div className="popup-form-heading">
              <span className="section-label">
                Required clinical record
              </span>
              <h3>Prescription capture</h3>
              <p className="muted">
                Capture the prescription information
                and optionally attach a copy now.
                The attachment can also be added later
                from Prescription Management.
              </p>
            </div>

            <div className="creation-form-grid">
              <label>
                Customer / Patient
                <select
                  value={
                    prescriptionForm
                      .pharmaco_customer_id
                  }
                  onChange={(event) =>
                    setPrescriptionForm((current) => ({
                      ...current,
                      pharmaco_customer_id:
                        event.target.value,
                    }))
                  }
                >
                  <option value="">
                    Walk-in / no customer
                  </option>

                  {customers.map((customer) => (
                    <option
                      key={customer.id}
                      value={customer.id}
                    >
                      {customer.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Prescriber
                <input
                  value={
                    prescriptionForm
                      .prescriber_name
                  }
                  onChange={(event) =>
                    setPrescriptionForm((current) => ({
                      ...current,
                      prescriber_name:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Facility
                <input
                  value={
                    prescriptionForm
                      .prescriber_facility
                  }
                  onChange={(event) =>
                    setPrescriptionForm((current) => ({
                      ...current,
                      prescriber_facility:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Prescriber phone
                <input
                  value={
                    prescriptionForm
                      .prescriber_phone
                  }
                  onChange={(event) =>
                    setPrescriptionForm((current) => ({
                      ...current,
                      prescriber_phone:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Issued date
                <input
                  type="date"
                  value={
                    prescriptionForm.issued_at
                  }
                  onChange={(event) =>
                    setPrescriptionForm((current) => ({
                      ...current,
                      issued_at:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Expiry date
                <input
                  type="date"
                  value={
                    prescriptionForm.expires_at
                  }
                  onChange={(event) =>
                    setPrescriptionForm((current) => ({
                      ...current,
                      expires_at:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label className="managed-detail-wide">
                Prescription attachment
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setPrescriptionAttachment(
                      event.target.files?.[0] ??
                      null,
                    )
                  }
                />

                <small>
                  Optional now. PDF, JPG, PNG, or WebP;
                  maximum 10 MB.
                </small>
              </label>
            </div>

            <div className="managed-detail-actions">
              <button
                type="button"
                onClick={() =>
                  setIsPrescriptionCaptureOpen(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCreatePrescription}
                disabled={isSavingPrescription}
              >
                {isSavingPrescription
                  ? 'Creating prescription…'
                  : 'Create and link prescription'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

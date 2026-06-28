import { type FormEvent, useState } from 'react';
import {
  AccessProfile,
  PharmaInventoryLocationsResponse,
  PharmaProduct,
  PharmaProductCategory,
  PharmaProductsResponse,
  createPharmaProduct,
  getPharmaInventoryLocations,
  getPharmaProducts,
  receivePharmaStock,
  updatePharmaProduct,
} from '../lib/api';

type ProductInventoryActionsProps = {
  token: string;
  profile: AccessProfile;
};

type ProductFormState = {
  product_category_id: string;
  name: string;
  generic_name: string;
  sku: string;
  dosage_form: string;
  strength: string;
  unit: string;
  pack_size: string;
  product_type: 'medicine' | 'consumable' | 'device' | 'service';
  regulatory_status: 'approved' | 'pending' | 'suspended' | 'unregistered';
  requires_prescription: boolean;
  is_controlled: boolean;
  reorder_level: string;
  minimum_stock_level: string;
  status: 'active' | 'inactive' | 'discontinued';
};

type StockReceiveFormState = {
  product_id: string;
  stock_location_id: string;
  batch_number: string;
  quantity: string;
  expiry_date: string;
  unit_cost: string;
  selling_price: string;
  supplier_name: string;
  reference_number: string;
  reason: string;
};

const emptyProductForm: ProductFormState = {
  product_category_id: '',
  name: '',
  generic_name: '',
  sku: '',
  dosage_form: '',
  strength: '',
  unit: 'unit',
  pack_size: '',
  product_type: 'medicine',
  regulatory_status: 'approved',
  requires_prescription: false,
  is_controlled: false,
  reorder_level: '0',
  minimum_stock_level: '0',
  status: 'active',
};

const emptyStockReceiveForm: StockReceiveFormState = {
  product_id: '',
  stock_location_id: '',
  batch_number: '',
  quantity: '',
  expiry_date: '',
  unit_cost: '',
  selling_price: '',
  supplier_name: '',
  reference_number: '',
  reason: '',
};

function toNullableNumber(value: string): number | null {
  if (!value.trim()) return null;
  return Number(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 2,
  }).format(value);
}

export function ProductInventoryActions({ token, profile }: ProductInventoryActionsProps) {
  const [products, setProducts] = useState<PharmaProductsResponse | null>(null);
  const [locations, setLocations] = useState<PharmaInventoryLocationsResponse | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [stockReceiveForm, setStockReceiveForm] = useState<StockReceiveFormState>(emptyStockReceiveForm);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    reorder_level: '',
    minimum_stock_level: '',
    status: 'active' as 'active' | 'inactive' | 'discontinued',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);
  const [isReceivingStock, setIsReceivingStock] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const tenantSlug =
    profile.tenant_assignments?.[0]?.tenant?.slug ||
    (profile.scope.is_tenant ? 'vitapharma' : '');

  const categories = collectCategories(products?.products ?? []);

  async function loadReferenceData() {
    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const [productsResponse, locationsResponse] = await Promise.all([
        getPharmaProducts(token, tenantSlug),
        getPharmaInventoryLocations(token, tenantSlug),
      ]);

      setProducts(productsResponse);
      setLocations(locationsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inventory form data.');
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshProductsAndLocations() {
    if (!tenantSlug) return;

    const [productsResponse, locationsResponse] = await Promise.all([
      getPharmaProducts(token, tenantSlug),
      getPharmaInventoryLocations(token, tenantSlug),
    ]);

    setProducts(productsResponse);
    setLocations(locationsResponse);
  }

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    setIsSavingProduct(true);
    setError('');
    setMessage('');

    try {
      const response = await createPharmaProduct(token, tenantSlug, {
        product_category_id: toNullableNumber(productForm.product_category_id),
        name: productForm.name,
        generic_name: productForm.generic_name || null,
        sku: productForm.sku,
        dosage_form: productForm.dosage_form || null,
        strength: productForm.strength || null,
        unit: productForm.unit,
        pack_size: productForm.pack_size || null,
        product_type: productForm.product_type,
        regulatory_status: productForm.regulatory_status,
        requires_prescription: productForm.requires_prescription,
        is_controlled: productForm.is_controlled,
        reorder_level: Number(productForm.reorder_level || 0),
        minimum_stock_level: Number(productForm.minimum_stock_level || 0),
        status: productForm.status,
      });

      setMessage(response.message);
      setProductForm(emptyProductForm);
      await refreshProductsAndLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create product.');
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handleUpdateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug || !selectedProductId) {
      setError('Select a product to update first.');
      return;
    }

    setIsUpdatingProduct(true);
    setError('');
    setMessage('');

    try {
      const response = await updatePharmaProduct(token, tenantSlug, Number(selectedProductId), {
        name: editForm.name,
        reorder_level: Number(editForm.reorder_level || 0),
        minimum_stock_level: Number(editForm.minimum_stock_level || 0),
        status: editForm.status,
      });

      setMessage(response.message);
      await refreshProductsAndLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update product.');
    } finally {
      setIsUpdatingProduct(false);
    }
  }

  async function handleReceiveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    setIsReceivingStock(true);
    setError('');
    setMessage('');

    try {
      const response = await receivePharmaStock(token, tenantSlug, {
        product_id: Number(stockReceiveForm.product_id),
        stock_location_id: Number(stockReceiveForm.stock_location_id),
        batch_number: stockReceiveForm.batch_number,
        quantity: Number(stockReceiveForm.quantity),
        expiry_date: stockReceiveForm.expiry_date || null,
        unit_cost: toNullableNumber(stockReceiveForm.unit_cost),
        selling_price: toNullableNumber(stockReceiveForm.selling_price),
        supplier_name: stockReceiveForm.supplier_name || null,
        reference_number: stockReceiveForm.reference_number || null,
        reason: stockReceiveForm.reason || null,
      });

      setMessage(`${response.message} Batch ${response.batch.batch_number} now has ${formatNumber(response.batch.quantity_on_hand)} units.`);
      setStockReceiveForm(emptyStockReceiveForm);
      await refreshProductsAndLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to receive stock.');
    } finally {
      setIsReceivingStock(false);
    }
  }

  function handleSelectProductForEdit(productId: string) {
    setSelectedProductId(productId);

    const product = products?.products.find((item) => item.id === Number(productId));

    if (product) {
      setEditForm({
        name: product.name,
        reorder_level: String(product.reorder_level),
        minimum_stock_level: String(product.minimum_stock_level),
        status: product.status as 'active' | 'inactive' | 'discontinued',
      });
    }
  }

  return (
    <article className="panel wide inventory-actions-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Product master and stock receiving actions</h2>
          <p className="muted">
            Controlled forms for creating products, updating product settings, and receiving stock into the movement ledger.
          </p>
        </div>

        <button type="button" onClick={loadReferenceData} disabled={isLoading}>
          {isLoading ? 'Loading…' : 'Load action data'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      {!products || !locations ? (
        <p className="muted">Load action data first to populate product categories, product list, and stock locations.</p>
      ) : (
        <div className="inventory-actions-grid">
          <form className="inventory-action-card" onSubmit={handleCreateProduct}>
            <h3>Create product</h3>

            <label>
              Product category
              <select
                value={productForm.product_category_id}
                onChange={(event) => setProductForm({ ...productForm, product_category_id: event.target.value })}
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.code})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Product name
              <input
                value={productForm.name}
                onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                placeholder="e.g. Cefixime 200mg Tablets"
                required
              />
            </label>

            <label>
              Generic name
              <input
                value={productForm.generic_name}
                onChange={(event) => setProductForm({ ...productForm, generic_name: event.target.value })}
                placeholder="e.g. Cefixime"
              />
            </label>

            <label>
              SKU
              <input
                value={productForm.sku}
                onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })}
                placeholder="e.g. CEFIX-200-TAB"
                required
              />
            </label>

            <div className="form-two-column">
              <label>
                Dosage form
                <input
                  value={productForm.dosage_form}
                  onChange={(event) => setProductForm({ ...productForm, dosage_form: event.target.value })}
                  placeholder="tablet"
                />
              </label>

              <label>
                Strength
                <input
                  value={productForm.strength}
                  onChange={(event) => setProductForm({ ...productForm, strength: event.target.value })}
                  placeholder="200mg"
                />
              </label>
            </div>

            <div className="form-two-column">
              <label>
                Unit
                <input
                  value={productForm.unit}
                  onChange={(event) => setProductForm({ ...productForm, unit: event.target.value })}
                  required
                />
              </label>

              <label>
                Pack size
                <input
                  value={productForm.pack_size}
                  onChange={(event) => setProductForm({ ...productForm, pack_size: event.target.value })}
                  placeholder="10 tablets"
                />
              </label>
            </div>

            <div className="form-two-column">
              <label>
                Product type
                <select
                  value={productForm.product_type}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      product_type: event.target.value as ProductFormState['product_type'],
                    })
                  }
                >
                  <option value="medicine">Medicine</option>
                  <option value="consumable">Consumable</option>
                  <option value="device">Device</option>
                  <option value="service">Service</option>
                </select>
              </label>

              <label>
                Regulatory status
                <select
                  value={productForm.regulatory_status}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      regulatory_status: event.target.value as ProductFormState['regulatory_status'],
                    })
                  }
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                  <option value="unregistered">Unregistered</option>
                </select>
              </label>
            </div>

            <div className="form-two-column">
              <label>
                Reorder level
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.reorder_level}
                  onChange={(event) => setProductForm({ ...productForm, reorder_level: event.target.value })}
                />
              </label>

              <label>
                Minimum stock
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.minimum_stock_level}
                  onChange={(event) => setProductForm({ ...productForm, minimum_stock_level: event.target.value })}
                />
              </label>
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={productForm.requires_prescription}
                onChange={(event) => setProductForm({ ...productForm, requires_prescription: event.target.checked })}
              />
              Requires prescription
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={productForm.is_controlled}
                onChange={(event) => setProductForm({ ...productForm, is_controlled: event.target.checked })}
              />
              Controlled product
            </label>

            <button type="submit" disabled={isSavingProduct}>
              {isSavingProduct ? 'Creating…' : 'Create product'}
            </button>
          </form>

          <form className="inventory-action-card" onSubmit={handleUpdateProduct}>
            <h3>Update product settings</h3>

            <label>
              Product
              <select value={selectedProductId} onChange={(event) => handleSelectProductForEdit(event.target.value)} required>
                <option value="">Select product</option>
                {products.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Product name
              <input
                value={editForm.name}
                onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                required
              />
            </label>

            <div className="form-two-column">
              <label>
                Reorder level
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.reorder_level}
                  onChange={(event) => setEditForm({ ...editForm, reorder_level: event.target.value })}
                />
              </label>

              <label>
                Minimum stock
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.minimum_stock_level}
                  onChange={(event) => setEditForm({ ...editForm, minimum_stock_level: event.target.value })}
                />
              </label>
            </div>

            <label>
              Status
              <select
                value={editForm.status}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    status: event.target.value as 'active' | 'inactive' | 'discontinued',
                  })
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </label>

            <button type="submit" disabled={isUpdatingProduct || !selectedProductId}>
              {isUpdatingProduct ? 'Updating…' : 'Update product'}
            </button>
          </form>

          <form className="inventory-action-card" onSubmit={handleReceiveStock}>
            <h3>Receive stock</h3>

            <label>
              Product
              <select
                value={stockReceiveForm.product_id}
                onChange={(event) => setStockReceiveForm({ ...stockReceiveForm, product_id: event.target.value })}
                required
              >
                <option value="">Select product</option>
                {products.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Stock location
              <select
                value={stockReceiveForm.stock_location_id}
                onChange={(event) => setStockReceiveForm({ ...stockReceiveForm, stock_location_id: event.target.value })}
                required
              >
                <option value="">Select location</option>
                {locations.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.code})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Batch number
              <input
                value={stockReceiveForm.batch_number}
                onChange={(event) => setStockReceiveForm({ ...stockReceiveForm, batch_number: event.target.value })}
                placeholder="e.g. BATCH-2026-001"
                required
              />
            </label>

            <div className="form-two-column">
              <label>
                Quantity
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={stockReceiveForm.quantity}
                  onChange={(event) => setStockReceiveForm({ ...stockReceiveForm, quantity: event.target.value })}
                  required
                />
              </label>

              <label>
                Expiry date
                <input
                  type="date"
                  value={stockReceiveForm.expiry_date}
                  onChange={(event) => setStockReceiveForm({ ...stockReceiveForm, expiry_date: event.target.value })}
                />
              </label>
            </div>

            <div className="form-two-column">
              <label>
                Unit cost
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={stockReceiveForm.unit_cost}
                  onChange={(event) => setStockReceiveForm({ ...stockReceiveForm, unit_cost: event.target.value })}
                />
              </label>

              <label>
                Selling price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={stockReceiveForm.selling_price}
                  onChange={(event) => setStockReceiveForm({ ...stockReceiveForm, selling_price: event.target.value })}
                />
              </label>
            </div>

            <label>
              Supplier
              <input
                value={stockReceiveForm.supplier_name}
                onChange={(event) => setStockReceiveForm({ ...stockReceiveForm, supplier_name: event.target.value })}
                placeholder="Supplier name"
              />
            </label>

            <label>
              Reference number
              <input
                value={stockReceiveForm.reference_number}
                onChange={(event) => setStockReceiveForm({ ...stockReceiveForm, reference_number: event.target.value })}
                placeholder="Receipt or invoice number"
              />
            </label>

            <label>
              Reason / note
              <textarea
                value={stockReceiveForm.reason}
                onChange={(event) => setStockReceiveForm({ ...stockReceiveForm, reason: event.target.value })}
                placeholder="Stock receiving note"
              />
            </label>

            <button type="submit" disabled={isReceivingStock}>
              {isReceivingStock ? 'Receiving…' : 'Receive stock'}
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

function collectCategories(products: PharmaProduct[]): PharmaProductCategory[] {
  const map = new Map<number, PharmaProductCategory>();

  products.forEach((product) => {
    if (product.category) {
      map.set(product.category.id, product.category);
    }
  });

  return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
}

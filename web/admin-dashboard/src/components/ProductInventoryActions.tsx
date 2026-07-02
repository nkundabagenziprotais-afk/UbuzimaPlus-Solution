import { type ChangeEvent, type FormEvent, useState } from 'react';
import {
  AccessProfile,
  CreatePharmaProductCategoryPayload,
  CreatePharmaStockLocationPayload,
  PharmaInventoryLocationsResponse,
  PharmaProductCategoriesResponse,
  PharmaProduct,
  PharmaProductCategory,
  PharmaProductsResponse,
  ProductBulkImportRow,
  bulkActionPharmaProducts,
  bulkImportPharmaProducts,
  createPharmaProduct,
  createPharmaProductCategory,
  createPharmaStockLocation,
  getPharmaInventoryLocations,
  getPharmaProductCategories,
  getPharmaProducts,
  receivePharmaStock,
  updatePharmaProduct,
  updatePharmaProductCategory,
  updatePharmaStockLocation,
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

type CategorySetupFormState = {
  name: string;
  code: string;
  category_type: string;
  status: 'active' | 'inactive';
  description: string;
};

type LocationSetupFormState = {
  branch_id: string;
  name: string;
  code: string;
  location_type: string;
  status: 'active' | 'inactive';
};

type InventoryTask = 'setup' | 'create' | 'edit' | 'receive' | 'bulk';

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

const emptyCategorySetupForm: CategorySetupFormState = {
  name: '',
  code: '',
  category_type: 'medicine',
  status: 'active',
  description: '',
};

const emptyLocationSetupForm: LocationSetupFormState = {
  branch_id: '',
  name: '',
  code: '',
  location_type: 'store',
  status: 'active',
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
  const [categoriesResponse, setCategoriesResponse] = useState<PharmaProductCategoriesResponse | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [stockReceiveForm, setStockReceiveForm] = useState<StockReceiveFormState>(emptyStockReceiveForm);
  const [categoryForm, setCategoryForm] = useState<CategorySetupFormState>(emptyCategorySetupForm);
  const [locationForm, setLocationForm] = useState<LocationSetupFormState>(emptyLocationSetupForm);
  const [activeTask, setActiveTask] = useState<InventoryTask>('setup');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedBulkIds, setSelectedBulkIds] = useState<number[]>([]);
  const [bulkRows, setBulkRows] = useState<ProductBulkImportRow[]>([]);
  const [bulkMode, setBulkMode] = useState<'create_only' | 'upsert'>('upsert');
  const [bulkAction, setBulkAction] = useState<'approve' | 'activate' | 'deactivate' | 'discontinue' | 'update' | 'delete'>('approve');
  const [bulkUpdateField, setBulkUpdateField] = useState<'status' | 'regulatory_status' | 'reorder_level' | 'minimum_stock_level'>('status');
  const [bulkUpdateValue, setBulkUpdateValue] = useState('active');
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
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [isRunningBulk, setIsRunningBulk] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const tenantSlug =
    profile.tenant_assignments?.[0]?.tenant?.slug ||
    (profile.scope.is_tenant ? 'vitapharma' : '');

  const categories = categoriesResponse?.categories ?? collectCategories(products?.products ?? []);
  const branchOptions = Array.from(
    new Map((locations?.locations ?? []).map((location) => [location.branch.id, location.branch])).values(),
  );

  async function loadReferenceData() {
    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const [productsResponse, locationsResponse, categoriesResult] = await Promise.all([
        getPharmaProducts(token, tenantSlug),
        getPharmaInventoryLocations(token, tenantSlug),
        getPharmaProductCategories(token, tenantSlug),
      ]);

      setProducts(productsResponse);
      setLocations(locationsResponse);
      setCategoriesResponse(categoriesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inventory form data.');
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshProductsAndLocations() {
    if (!tenantSlug) return;

    const [productsResponse, locationsResponse, categoriesResult] = await Promise.all([
      getPharmaProducts(token, tenantSlug),
      getPharmaInventoryLocations(token, tenantSlug),
      getPharmaProductCategories(token, tenantSlug),
    ]);

    setProducts(productsResponse);
    setLocations(locationsResponse);
    setCategoriesResponse(categoriesResult);
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    setIsSavingSetup(true);
    setError('');
    setMessage('');

    try {
      const payload: CreatePharmaProductCategoryPayload = {
        name: categoryForm.name,
        code: categoryForm.code,
        category_type: categoryForm.category_type || 'medicine',
        status: categoryForm.status,
        description: categoryForm.description || null,
      };

      const response = await createPharmaProductCategory(token, tenantSlug, payload);

      setMessage(`${response.message} ${response.category.name} is ready for product setup.`);
      setCategoryForm(emptyCategorySetupForm);
      setSelectedCategoryId(String(response.category.id));
      await refreshProductsAndLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create product category.');
    } finally {
      setIsSavingSetup(false);
    }
  }

  async function handleUpdateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug || !selectedCategoryId) {
      setError('Select a product category before updating.');
      return;
    }

    setIsSavingSetup(true);
    setError('');
    setMessage('');

    try {
      const response = await updatePharmaProductCategory(token, tenantSlug, Number(selectedCategoryId), {
        name: categoryForm.name,
        code: categoryForm.code,
        category_type: categoryForm.category_type || 'medicine',
        status: categoryForm.status,
        description: categoryForm.description || null,
      });

      setMessage(`${response.message} ${response.category.name} is updated.`);
      await refreshProductsAndLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update product category.');
    } finally {
      setIsSavingSetup(false);
    }
  }

  async function handleCreateLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    setIsSavingSetup(true);
    setError('');
    setMessage('');

    try {
      const payload: CreatePharmaStockLocationPayload = {
        branch_id: Number(locationForm.branch_id),
        name: locationForm.name,
        code: locationForm.code,
        location_type: locationForm.location_type || 'store',
        status: locationForm.status,
      };

      const response = await createPharmaStockLocation(token, tenantSlug, payload);

      setMessage(`${response.message} ${response.location.name} is available for receiving.`);
      setLocationForm(emptyLocationSetupForm);
      setSelectedLocationId(String(response.location.id));
      await refreshProductsAndLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create stock location.');
    } finally {
      setIsSavingSetup(false);
    }
  }

  async function handleUpdateLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug || !selectedLocationId) {
      setError('Select a stock location before updating.');
      return;
    }

    setIsSavingSetup(true);
    setError('');
    setMessage('');

    try {
      const response = await updatePharmaStockLocation(token, tenantSlug, Number(selectedLocationId), {
        name: locationForm.name,
        code: locationForm.code,
        location_type: locationForm.location_type || 'store',
        status: locationForm.status,
      });

      setMessage(`${response.message} ${response.location.name} is updated.`);
      await refreshProductsAndLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update stock location.');
    } finally {
      setIsSavingSetup(false);
    }
  }

  function handleSelectCategoryForEdit(categoryId: string) {
    setSelectedCategoryId(categoryId);

    const category = categories.find((item) => String(item.id) === categoryId);

    if (!category) {
      setCategoryForm(emptyCategorySetupForm);
      return;
    }

    setCategoryForm({
      name: category.name,
      code: category.code,
      category_type: category.category_type,
      status: category.status === 'inactive' ? 'inactive' : 'active',
      description: category.description ?? '',
    });
  }

  function handleSelectLocationForEdit(locationId: string) {
    setSelectedLocationId(locationId);

    const location = locations?.locations.find((item) => String(item.id) === locationId);

    if (!location) {
      setLocationForm(emptyLocationSetupForm);
      return;
    }

    setLocationForm({
      branch_id: String(location.branch.id),
      name: location.name,
      code: location.code,
      location_type: location.location_type,
      status: location.status === 'inactive' ? 'inactive' : 'active',
    });
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

  async function handleBulkImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    if (bulkRows.length === 0) {
      setError('Choose a CSV file before running bulk import.');
      return;
    }

    setIsRunningBulk(true);
    setError('');
    setMessage('');

    try {
      const response = await bulkImportPharmaProducts(token, tenantSlug, bulkRows, bulkMode);
      setMessage(`${response.message} Processed ${response.bulk_operation.processed_rows} row(s), failed ${response.bulk_operation.failed_rows}.`);
      setBulkRows([]);
      await refreshProductsAndLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run product bulk import.');
    } finally {
      setIsRunningBulk(false);
    }
  }

  async function handleBulkAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug || selectedBulkIds.length === 0) {
      setError('Select at least one product before running a bulk action.');
      return;
    }

    setIsRunningBulk(true);
    setError('');
    setMessage('');

    try {
      const values = bulkAction === 'update'
        ? { [bulkUpdateField]: numericBulkFields.includes(bulkUpdateField) ? Number(bulkUpdateValue || 0) : bulkUpdateValue }
        : undefined;

      const response = await bulkActionPharmaProducts(token, tenantSlug, {
        ids: selectedBulkIds,
        action: bulkAction,
        values,
      });

      setMessage(`${response.message} Processed ${response.bulk_operation.processed_rows} row(s), failed ${response.bulk_operation.failed_rows}.`);
      setSelectedBulkIds([]);
      await refreshProductsAndLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run product bulk action.');
    } finally {
      setIsRunningBulk(false);
    }
  }

  async function handleBulkCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const text = await file.text();
    setBulkRows(parseCsvProducts(text));
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

      {!products || !locations || !categoriesResponse ? (
        <p className="muted">Load action data first to populate product categories, product list, branches, and stock locations.</p>
      ) : (
        <>
          <div className="inventory-task-switcher" role="tablist" aria-label="Inventory action">
            {[
              ['setup', 'Setup'],
              ['create', 'Create product'],
              ['edit', 'Edit product'],
              ['receive', 'Receive stock'],
              ['bulk', 'Bulk tools'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTask === key}
                className={activeTask === key ? 'active' : ''}
                onClick={() => setActiveTask(key as InventoryTask)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="inventory-actions-grid inventory-actions-grid--focused">
          {activeTask === 'setup' && (
            <section className="inventory-action-card inventory-setup-card">
              <h3>Inventory setup</h3>
              <p className="form-hint">
                Prepare product categories and stock locations before product creation and stock receiving.
              </p>

              <div className="inventory-setup-grid">
                <form className="inventory-setup-form" onSubmit={handleCreateCategory}>
                  <h4>Create category</h4>
                  <label>
                    Category name
                    <input
                      value={categoryForm.name}
                      onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
                      placeholder="e.g. Antibiotics"
                      required
                    />
                  </label>
                  <label>
                    Category code
                    <input
                      value={categoryForm.code}
                      onChange={(event) => setCategoryForm({ ...categoryForm, code: event.target.value })}
                      placeholder="e.g. antibiotics"
                      required
                    />
                  </label>
                  <div className="form-two-column">
                    <label>
                      Type
                      <input
                        value={categoryForm.category_type}
                        onChange={(event) => setCategoryForm({ ...categoryForm, category_type: event.target.value })}
                      />
                    </label>
                    <label>
                      Status
                      <select
                        value={categoryForm.status}
                        onChange={(event) => setCategoryForm({ ...categoryForm, status: event.target.value as CategorySetupFormState['status'] })}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Description
                    <textarea
                      value={categoryForm.description}
                      onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })}
                      placeholder="Short setup note"
                    />
                  </label>
                  <button type="submit" disabled={isSavingSetup}>
                    {isSavingSetup ? 'Saving…' : 'Create category'}
                  </button>
                </form>

                <form className="inventory-setup-form" onSubmit={handleUpdateCategory}>
                  <h4>Update category</h4>
                  <label>
                    Category
                    <select value={selectedCategoryId} onChange={(event) => handleSelectCategoryForEdit(event.target.value)} required>
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name} ({category.code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="form-hint">After selecting a category, adjust the same fields in the create form and submit here.</p>
                  <button type="submit" disabled={isSavingSetup || !selectedCategoryId}>
                    Update selected category
                  </button>
                </form>

                <form className="inventory-setup-form" onSubmit={handleCreateLocation}>
                  <h4>Create stock location</h4>
                  <label>
                    Branch
                    <select
                      value={locationForm.branch_id}
                      onChange={(event) => setLocationForm({ ...locationForm, branch_id: event.target.value })}
                      required
                    >
                      <option value="">Select branch</option>
                      {branchOptions.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} ({branch.code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Location name
                    <input
                      value={locationForm.name}
                      onChange={(event) => setLocationForm({ ...locationForm, name: event.target.value })}
                      placeholder="e.g. Reserve Store"
                      required
                    />
                  </label>
                  <label>
                    Location code
                    <input
                      value={locationForm.code}
                      onChange={(event) => setLocationForm({ ...locationForm, code: event.target.value })}
                      placeholder="e.g. reserve-store"
                      required
                    />
                  </label>
                  <div className="form-two-column">
                    <label>
                      Type
                      <input
                        value={locationForm.location_type}
                        onChange={(event) => setLocationForm({ ...locationForm, location_type: event.target.value })}
                      />
                    </label>
                    <label>
                      Status
                      <select
                        value={locationForm.status}
                        onChange={(event) => setLocationForm({ ...locationForm, status: event.target.value as LocationSetupFormState['status'] })}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                  <button type="submit" disabled={isSavingSetup || branchOptions.length === 0}>
                    Create stock location
                  </button>
                </form>

                <form className="inventory-setup-form" onSubmit={handleUpdateLocation}>
                  <h4>Update stock location</h4>
                  <label>
                    Stock location
                    <select value={selectedLocationId} onChange={(event) => handleSelectLocationForEdit(event.target.value)} required>
                      <option value="">Select location</option>
                      {locations.locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name} ({location.code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="form-hint">After selecting a location, adjust the same location fields in the create form and submit here.</p>
                  <button type="submit" disabled={isSavingSetup || !selectedLocationId}>
                    Update selected location
                  </button>
                </form>
              </div>
            </section>
          )}

          {activeTask === 'create' && (
          <form className="inventory-action-card" onSubmit={handleCreateProduct}>
            <h3>Create product</h3>
            <p className="form-hint">Required fields are product name, SKU, unit, product type, and regulatory status.</p>

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
          )}

          {activeTask === 'edit' && (
          <form className="inventory-action-card" onSubmit={handleUpdateProduct}>
            <h3>Update product settings</h3>
            <p className="form-hint">Use bulk tools when the same change applies to many products.</p>

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
          )}

          {activeTask === 'receive' && (
          <form className="inventory-action-card" onSubmit={handleReceiveStock}>
            <h3>Receive stock</h3>
            <p className="form-hint">Receiving creates stock batches and movement history for audit review.</p>

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
          )}

          {activeTask === 'bulk' && (
            <section className="inventory-action-card inventory-bulk-card">
              <h3>Bulk upload and bulk actions</h3>
              <p className="form-hint">
                Upload product CSV files or select existing products for approval, edit, status change, or guarded delete.
              </p>

              <form className="bulk-tool-form" onSubmit={handleBulkImport}>
                <label htmlFor="product-bulk-csv">
                  Product CSV
                  <input id="product-bulk-csv" type="file" accept=".csv,text/csv" onChange={handleBulkCsvUpload} />
                </label>
                <label>
                  Import mode
                  <select value={bulkMode} onChange={(event) => setBulkMode(event.target.value as 'create_only' | 'upsert')}>
                    <option value="upsert">Create or update by SKU</option>
                    <option value="create_only">Create only</option>
                  </select>
                </label>
                <div className="bulk-preview">
                  <strong>{bulkRows.length}</strong>
                  <span>rows ready</span>
                </div>
                <button type="submit" disabled={isRunningBulk || bulkRows.length === 0}>
                  Run bulk import
                </button>
              </form>

              <form className="bulk-tool-form" onSubmit={handleBulkAction}>
                <label>
                  Action
                  <select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as typeof bulkAction)}>
                    <option value="approve">Approve and activate</option>
                    <option value="activate">Activate</option>
                    <option value="deactivate">Deactivate</option>
                    <option value="discontinue">Discontinue</option>
                    <option value="update">Bulk edit field</option>
                    <option value="delete">Delete if safe</option>
                  </select>
                </label>

                {bulkAction === 'update' && (
                  <>
                    <label>
                      Field
                      <select value={bulkUpdateField} onChange={(event) => setBulkUpdateField(event.target.value as typeof bulkUpdateField)}>
                        <option value="status">Status</option>
                        <option value="regulatory_status">Regulatory status</option>
                        <option value="reorder_level">Reorder level</option>
                        <option value="minimum_stock_level">Minimum stock</option>
                      </select>
                    </label>
                    <label>
                      New value
                      <input value={bulkUpdateValue} onChange={(event) => setBulkUpdateValue(event.target.value)} />
                    </label>
                  </>
                )}

                <div className="bulk-product-picker">
                  {products.products.map((product) => (
                    <label key={product.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedBulkIds.includes(product.id)}
                        onChange={(event) => {
                          setSelectedBulkIds((current) =>
                            event.target.checked
                              ? [...current, product.id]
                              : current.filter((id) => id !== product.id),
                          );
                        }}
                      />
                      {product.name} ({product.sku})
                    </label>
                  ))}
                </div>

                <button type="submit" disabled={isRunningBulk || selectedBulkIds.length === 0}>
                  Run bulk action on {selectedBulkIds.length} product(s)
                </button>
              </form>
            </section>
          )}
        </div>
        </>
      )}
    </article>
  );
}

const numericBulkFields = ['reorder_level', 'minimum_stock_level'];

function parseCsvProducts(text: string): ProductBulkImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim().replace(/\s+/g, '_').toLowerCase());

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? '';
    });

    return row as ProductBulkImportRow;
  });
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);

  return values;
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

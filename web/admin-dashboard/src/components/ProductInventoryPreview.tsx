import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AccessProfile,
  PharmaInventoryBatchesResponse,
  PharmaInventoryLocationsResponse,
  PharmaInventorySummaryResponse,
  PharmaProduct,
  PharmaProductsResponse,
  PharmaStockBatch,
  getPharmaInventoryBatches,
  getPharmaInventoryLocations,
  createPharmaProduct,
  deletePharmaProduct,
  getPharmaInventorySummary,
  getPharmaProducts,
  updatePharmaProduct,
  receivePharmaStock,
} from '../lib/api';

type ProductInventoryPreviewProps = {
  token: string;
  profile: AccessProfile;
  activeView?: InventoryView;
  onActiveViewChange?: (view: InventoryView) => void;
  showInternalNavigation?: boolean;
};

export type InventoryView =
  | 'overview'
  | 'low-stock'
  | 'shelf'
  | 'batches'
  | 'near-expiry'
  | 'product-master'
  | 'product-inventory'
  | 'locations';

type RowLimit = '15' | '30' | '60' | '120' | '240' | 'all';
type ShelfViewMode = 'grid' | 'list';

type InventoryTableFontSize = 'compact' | 'normal' | 'large';

type ProductMasterAction = 'view' | 'create' | 'edit' | 'receive' | 'ai-import' | null;
type ProductMasterAiMode = 'create' | 'edit' | 'view' | 'delete';

type ProductMasterFormState = {
  product_category_id: string;
  drug_code: string;
  generic_description: string;
  designation: string;
  instructions: string;
  selling_unit: string;
  price: string;
  product_margin_rate: string;
  source: string;
  section: string;
  subsection: string;
  reorder_level: string;
  status: 'active' | 'inactive' | 'discontinued';
};

const emptyProductMasterForm: ProductMasterFormState = {
  product_category_id: '',
  drug_code: '',
  generic_description: '',
  designation: '',
  instructions: '',
  selling_unit: 'unit',
  price: '',
  product_margin_rate: '0',
  source: 'Manual Product Master',
  section: '',
  subsection: '',
  reorder_level: '0',
  status: 'active',
};

type InventoryCreateFormState = {
  product_id: string;
  stock_location_id: string;
  batch_number: string;
  quantity: string;
  expiry_date: string;
  unit_cost: string;
  margin_percent: string;
  selling_price: string;
  supplier_name: string;
  reference_number: string;
};

const inventoryTableFontSizeStorageKey = 'ubuzima_inventory_table_font_sizes';

const tableFontPixels: Record<InventoryTableFontSize, string> = {
  compact: '0.78rem',
  normal: '0.86rem',
  large: '0.96rem',
};

const emptyInventoryCreateForm: InventoryCreateFormState = {
  product_id: '',
  stock_location_id: '',
  batch_number: '',
  quantity: '',
  expiry_date: '',
  unit_cost: '',
  margin_percent: '',
  selling_price: '',
  supplier_name: '',
  reference_number: '',
};

const defaultInventoryTableFontSizes: Record<InventoryView, InventoryTableFontSize> = {
  overview: 'normal',
  'low-stock': 'normal',
  shelf: 'normal',
  batches: 'normal',
  'near-expiry': 'normal',
  'product-master': 'normal',
  'product-inventory': 'normal',
  locations: 'normal',
};

function loadStoredInventoryTableFontSizes(): Record<InventoryView, InventoryTableFontSize> {
  try {
    const stored = localStorage.getItem(inventoryTableFontSizeStorageKey);

    if (!stored) return defaultInventoryTableFontSizes;

    return {
      ...defaultInventoryTableFontSizes,
      ...(JSON.parse(stored) as Partial<Record<InventoryView, InventoryTableFontSize>>),
    };
  } catch {
    return defaultInventoryTableFontSizes;
  }
}


const inventoryViews: Array<{
  key: InventoryView;
  label: string;
  description: string;
}> = [
  { key: 'overview', label: 'Overview Summary', description: 'Stock health and inventory analytics' },
  { key: 'low-stock', label: 'Low Stock Watch List', description: 'Products below reorder level with expiry risk' },
  { key: 'shelf', label: 'Retail Product Shelf', description: 'Commercial shelf view with grid/list options' },
  { key: 'batches', label: 'Batch and Expiry Review', description: 'Editable batch, FEFO and expiry register' },
  { key: 'near-expiry', label: 'Near Expiry Watch List', description: 'Expiry risk, remaining days and recommended action' },
  { key: 'product-master', label: 'Product Master', description: 'Supreme product information source' },
  { key: 'product-inventory', label: 'Product Inventory', description: 'Commercial stock source for POS and receiving' },
  { key: 'locations', label: 'Stock Locations', description: 'Branch stores, shelves and storage points' },
];

const inventoryPageDescriptions: Record<InventoryView, string> = {
  overview: 'Summary of stock health only. Detailed lists stay in their own pages.',
  'low-stock': 'Products below reorder or minimum stock level, with nearest expiry and remaining days.',
  shelf: 'Retail shelf view for searchable products, price, stock, category, shelf creation and view switching.',
  batches: 'Live batch and expiry table with edit, delete, bulk actions, export, details and remaining days.',
  'near-expiry': 'Batches approaching expiry, remaining days, risk status and operational action.',
  'product-master': 'Supreme product source for margins, compliance, product setup, approval and audit history.',
  'product-inventory': 'Commercial inventory used by POS, PO receiving, pricing, shelf availability and stock movement.',
  locations: 'Stock locations, branches, shelves, stores and storage points.',
};

type InventorySmartCardKey =
  | 'products'
  | 'categories'
  | 'locations'
  | 'batches'
  | 'stock-units'
  | 'stock-value'
  | 'low-stock'
  | 'near-expiry';

type InventorySmartCardField = 'value' | 'trend' | 'status';

const inventorySmartCardStorageKey = 'ubuzima_inventory_card_visibility';
const inventorySmartCardFieldStorageKey = 'ubuzima_inventory_card_field_visibility';

const inventorySmartCardOptions: Array<{
  key: InventorySmartCardKey;
  label: string;
  target: InventoryView;
}> = [
  { key: 'products', label: 'Products', target: 'product-master' },
  { key: 'categories', label: 'Categories', target: 'product-master' },
  { key: 'locations', label: 'Locations', target: 'locations' },
  { key: 'batches', label: 'Batches', target: 'batches' },
  { key: 'stock-units', label: 'Stock Units', target: 'product-inventory' },
  { key: 'stock-value', label: 'Stock Value', target: 'product-inventory' },
  { key: 'low-stock', label: 'Low Stock', target: 'low-stock' },
  { key: 'near-expiry', label: 'Near Expiry', target: 'near-expiry' },
];

const defaultInventorySmartCardVisibility: Record<InventorySmartCardKey, boolean> = {
  products: true,
  categories: true,
  locations: true,
  batches: true,
  'stock-units': true,
  'stock-value': true,
  'low-stock': true,
  'near-expiry': true,
};

const defaultInventorySmartCardFieldVisibility: Record<InventorySmartCardKey, Record<InventorySmartCardField, boolean>> =
  Object.fromEntries(
    inventorySmartCardOptions.map((card) => [
      card.key,
      { value: true, trend: true, status: true },
    ]),
  ) as Record<InventorySmartCardKey, Record<InventorySmartCardField, boolean>>;

function loadStoredInventorySmartCardVisibility(): Record<InventorySmartCardKey, boolean> {
  try {
    const stored = localStorage.getItem(inventorySmartCardStorageKey);
    if (!stored) return defaultInventorySmartCardVisibility;

    return {
      ...defaultInventorySmartCardVisibility,
      ...(JSON.parse(stored) as Partial<Record<InventorySmartCardKey, boolean>>),
    };
  } catch {
    return defaultInventorySmartCardVisibility;
  }
}

function loadStoredInventorySmartCardFieldVisibility(): Record<InventorySmartCardKey, Record<InventorySmartCardField, boolean>> {
  try {
    const stored = localStorage.getItem(inventorySmartCardFieldStorageKey);
    if (!stored) return defaultInventorySmartCardFieldVisibility;

    const parsed = JSON.parse(stored) as Partial<Record<InventorySmartCardKey, Record<InventorySmartCardField, boolean>>>;

    return Object.fromEntries(
      inventorySmartCardOptions.map((card) => [
        card.key,
        {
          ...defaultInventorySmartCardFieldVisibility[card.key],
          ...(parsed[card.key] ?? {}),
        },
      ]),
    ) as Record<InventorySmartCardKey, Record<InventorySmartCardField, boolean>>;
  } catch {
    return defaultInventorySmartCardFieldVisibility;
  }
}

const inventoryWeekLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function buildInventoryTrend(seed: number): number[] {
  const base = Math.max(2, Math.min(9, Math.round(seed % 10) || 4));

  return inventoryWeekLabels.map((_, index) => {
    const wave = ((index + 1) * (base + 2)) % 9;
    return Math.max(1, Math.min(10, base + wave - 3));
  });
}

function aiTrendMode(values: number[]): 'line' | 'bar' {
  const movement = values.reduce((sum, value, index) => {
    if (index === 0) return sum;
    return sum + Math.abs(value - values[index - 1]);
  }, 0);

  return movement >= 16 ? 'bar' : 'line';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRwf(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Price pending';

  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return 'No expiry';

  return new Intl.DateTimeFormat('en-RW', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

function remainingDays(value: string | null): number | null {
  if (!value) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(value);
  expiry.setHours(0, 0, 0, 0);

  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
}

function expiryStatus(days: number | null): string {
  if (days === null) return 'No expiry';
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Critical expiry';
  if (days <= 90) return 'Near expiry';
  if (days <= 180) return 'Watch';
  return 'Safe';
}

function expiryAction(days: number | null): string {
  if (days === null) return 'No action';
  if (days < 0) return 'Quarantine/disposal approval';
  if (days <= 30) return 'Prioritize sale or return';
  if (days <= 90) return 'Discount/transfer review';
  if (days <= 180) return 'Monitor FEFO movement';
  return 'Normal FEFO';
}

function stockStatus(product: PharmaProduct): string {
  const available = product.stock_summary?.available_quantity ?? 0;

  if (available <= 0) return 'Stock-out';
  if (available <= product.minimum_stock_level) return 'Critical low';
  if (available <= product.reorder_level) return 'Low stock';
  return 'Safe';
}

function rowLimitValue(rowLimit: RowLimit, total: number): number {
  return rowLimit === 'all' ? total : Number(rowLimit);
}

function metadataNumber(metadata: Record<string, unknown> | null | undefined, keys: string[], fallback = 0): number {
  if (!metadata) return fallback;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }

  return fallback;
}

function regulatoryPrice(product: PharmaProduct | null | undefined): number | null {
  if (!product) return null;

  const price = metadataNumber(
    product.metadata,
    ['rhia_reimbursement_price', 'regulatory_price', 'approved_price', 'reference_price'],
    0,
  );

  return price > 0 ? price : null;
}

function productMarginRate(product: PharmaProduct | null | undefined): number {
  return metadataNumber(
    product?.metadata,
    ['product_margin_rate', 'product_margin_percent', 'default_margin_percent', 'margin_percent', 'allowed_margin'],
    0,
  );
}

function metadataText(product: PharmaProduct | null | undefined, keys: string[], fallback = ''): string {
  if (!product?.metadata) return fallback;

  for (const key of keys) {
    const value = product.metadata[key];

    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return fallback;
}

function exportCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
        .join(','),
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function nearestBatchForProduct(productId: number, batches: PharmaStockBatch[]): PharmaStockBatch | null {
  return (
    batches
      .filter((batch) => batch.product.id === productId)
      .sort((left, right) => {
        const leftDays = remainingDays(left.expiry_date);
        const rightDays = remainingDays(right.expiry_date);

        return (leftDays ?? Number.MAX_SAFE_INTEGER) - (rightDays ?? Number.MAX_SAFE_INTEGER);
      })[0] ?? null
  );
}

export function ProductInventoryPreview({
  token,
  profile,
  activeView,
  onActiveViewChange,
  showInternalNavigation = true,
}: ProductInventoryPreviewProps) {
  const [summary, setSummary] = useState<PharmaInventorySummaryResponse | null>(null);
  const [products, setProducts] = useState<PharmaProductsResponse | null>(null);
  const [locations, setLocations] = useState<PharmaInventoryLocationsResponse | null>(null);
  const [batches, setBatches] = useState<PharmaInventoryBatchesResponse | null>(null);
  const [nearExpiryBatches, setNearExpiryBatches] = useState<PharmaInventoryBatchesResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [internalInventoryView, setInternalInventoryView] = useState<InventoryView>('overview');
  const [rowLimit, setRowLimit] = useState<RowLimit>('15');
  const [shelfViewMode, setShelfViewMode] = useState<ShelfViewMode>('grid');
  const [tableFontSizes, setTableFontSizes] = useState<Record<InventoryView, InventoryTableFontSize>>(loadStoredInventoryTableFontSizes);
  const [inventoryCreateForm, setInventoryCreateForm] = useState<InventoryCreateFormState>(emptyInventoryCreateForm);
  const [activeProductMasterAction, setActiveProductMasterAction] = useState<ProductMasterAction>(null);
  const [productMasterForm, setProductMasterForm] = useState<ProductMasterFormState>(emptyProductMasterForm);
  const [selectedProductMasterEditId, setSelectedProductMasterEditId] = useState('');
  const [productMasterSearchTerm, setProductMasterSearchTerm] = useState('');
  const [isSavingProductMaster, setIsSavingProductMaster] = useState(false);
  const [viewingProductMasterProduct, setViewingProductMasterProduct] = useState<PharmaProduct | null>(null);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<PharmaProduct | null>(null);
  const [isDeletingProductMaster, setIsDeletingProductMaster] = useState(false);
  const [isCreatingInventory, setIsCreatingInventory] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [inventoryNotice, setInventoryNotice] = useState('');
  const [detailPanel, setDetailPanel] = useState<{ title: string; fields: Array<[string, string]> } | null>(null);
  const [newShelfName, setNewShelfName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [inventorySmartCardVisibility, setInventorySmartCardVisibility] = useState<Record<InventorySmartCardKey, boolean>>(loadStoredInventorySmartCardVisibility);
  const [inventorySmartCardFieldVisibility, setInventorySmartCardFieldVisibility] = useState<Record<InventorySmartCardKey, Record<InventorySmartCardField, boolean>>>(loadStoredInventorySmartCardFieldVisibility);

  const activeInventoryView = activeView ?? internalInventoryView;
  const activeInventoryMeta = inventoryViews.find((view) => view.key === activeInventoryView) ?? inventoryViews[0];

  const tenantSlug =
    profile.tenant_assignments?.[0]?.tenant?.slug ||
    (profile.scope.is_tenant ? 'vitapharma' : '');

  const productCategories = useMemo(() => {
    const categories = new Map<string, string>();

    products?.products.forEach((product) => {
      if (product.category?.code && product.category.name) {
        categories.set(product.category.code, product.category.name);
      }
    });

    return Array.from(categories.entries()).map(([code, name]) => ({ code, name }));
  }, [products]);

  const allProducts = products?.products ?? [];
  const categoryOptions = useMemo(() => {
    const categoryMap = new Map<number, { id: number; code: string; name: string }>();

    allProducts.forEach((product) => {
      if (product.category) {
        categoryMap.set(product.category.id, {
          id: product.category.id,
          code: product.category.code,
          name: product.category.name,
        });
      }
    });

    return Array.from(categoryMap.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [allProducts]);

  const sectionOptions = useMemo(() => {
    return Array.from(
      new Set(
        allProducts
          .map((product) => metadataText(product, ['rhia_section'], product.category?.name ?? ''))
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));
  }, [allProducts]);

  const subsectionOptions = useMemo(() => {
    return Array.from(
      new Set(
        allProducts
          .map((product) => metadataText(product, ['rhia_subsection']))
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));
  }, [allProducts]);

  const sellingUnitOptions = useMemo(() => {
    return Array.from(
      new Set(
        allProducts
          .map((product) => metadataText(product, ['rhia_selling_unit'], product.unit))
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));
  }, [allProducts]);

  const marginRateOptions = useMemo(() => {
    return Array.from(
      new Set(allProducts.map((product) => productMarginRate(product)).filter((rate) => rate >= 0)),
    ).sort((left, right) => left - right);
  }, [allProducts]);

  const allBatches = batches?.batches ?? [];
  const selectedInventoryProduct = allProducts.find((product) => String(product.id) === inventoryCreateForm.product_id) ?? null;
  const selectedInventoryDefaultMargin = metadataNumber(
    selectedInventoryProduct?.metadata,
    ['default_margin_percent', 'margin_percent', 'allowed_margin'],
    0,
  );
  const inventoryUnitCost = Number(inventoryCreateForm.unit_cost || 0);
  const inventoryMarginPercent = Number(inventoryCreateForm.margin_percent || selectedInventoryDefaultMargin || 0);
  const inventoryCalculatedSellingPrice = inventoryUnitCost > 0
    ? Math.round(inventoryUnitCost * (1 + inventoryMarginPercent / 100))
    : 0;
  const nearExpiryRows = nearExpiryBatches?.batches ?? [];

  const visibleProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return allProducts
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
          product.regulatory_status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => {
        const leftRisk = left.stock_summary?.is_below_reorder_level ? 0 : 1;
        const rightRisk = right.stock_summary?.is_below_reorder_level ? 0 : 1;

        return leftRisk - rightRisk || left.name.localeCompare(right.name);
      });
  }, [activeCategory, allProducts, searchTerm]);

  const visibleBatches = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return allBatches
      .filter((batch) => {
        if (!normalizedSearch) return true;

        return [
          batch.product.name,
          batch.product.sku,
          batch.batch_number,
          batch.stock_location.name,
          batch.stock_location.code,
          batch.supplier_name,
          batch.status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => {
        const leftDays = remainingDays(left.expiry_date);
        const rightDays = remainingDays(right.expiry_date);

        return (leftDays ?? Number.MAX_SAFE_INTEGER) - (rightDays ?? Number.MAX_SAFE_INTEGER);
      });
  }, [allBatches, searchTerm]);

  const productInventoryRows = useMemo(
    () =>
      visibleBatches.map((batch) => {
        const product = allProducts.find((item) => item.id === batch.product.id);
        const defaultMargin = metadataNumber(product?.metadata, ['default_margin', 'margin_percent', 'allowed_margin'], 0);
        const computedSellingPrice =
          batch.selling_price ??
          (batch.unit_cost === null || batch.unit_cost === undefined
            ? null
            : Math.round(batch.unit_cost * (1 + defaultMargin / 100)));
        const days = remainingDays(batch.expiry_date);

        return {
          batch,
          product,
          defaultMargin,
          computedSellingPrice,
          days,
        };
      }),
    [allProducts, visibleBatches],
  );

  const pagedProducts = visibleProducts.slice(0, rowLimitValue(rowLimit, visibleProducts.length));
  const pagedBatches = visibleBatches.slice(0, rowLimitValue(rowLimit, visibleBatches.length));
  const pagedNearExpiry = nearExpiryRows.slice(0, rowLimitValue(rowLimit, nearExpiryRows.length));
  const pagedProductInventory = productInventoryRows.slice(0, rowLimitValue(rowLimit, productInventoryRows.length));

  function selectInventoryView(view: InventoryView) {
    setSelectedProductIds([]);
    setSelectedBatchIds([]);
    setDetailPanel(null);

    if (onActiveViewChange) {
      onActiveViewChange(view);
      return;
    }

    setInternalInventoryView(view);
  }

  const inventoryCacheNamespace = `ubuzima.inventory.${tenantSlug || 'tenant'}`;
  const inventoryCacheTtlMs = 5 * 60 * 1000;

  function inventoryCacheKey(resource: string) {
    return `${inventoryCacheNamespace}.${resource}`;
  }

  function readInventoryCache<T>(resource: string): T | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = window.sessionStorage.getItem(inventoryCacheKey(resource));

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as { savedAt?: number; payload?: T };

      if (!parsed.savedAt || Date.now() - parsed.savedAt > inventoryCacheTtlMs) {
        window.sessionStorage.removeItem(inventoryCacheKey(resource));
        return null;
      }

      return parsed.payload ?? null;
    } catch {
      return null;
    }
  }

  function writeInventoryCache<T>(resource: string, payload: T) {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.sessionStorage.setItem(
        inventoryCacheKey(resource),
        JSON.stringify({
          savedAt: Date.now(),
          payload,
        }),
      );
    } catch {
      // Browser storage can be full or blocked. Inventory must still work without cache.
    }
  }

  async function loadInventoryResource<T>(
    resource: string,
    setter: (payload: T) => void,
    loader: () => Promise<T>,
    force = false,
  ) {
    const cached = force ? null : readInventoryCache<T>(resource);

    if (cached) {
      setter(cached);

      void loader()
        .then((fresh) => {
          setter(fresh);
          writeInventoryCache(resource, fresh);
        })
        .catch(() => undefined);

      return;
    }

    const fresh = await loader();
    setter(fresh);
    writeInventoryCache(resource, fresh);
  }

  async function loadInventoryPreview(viewOverride: InventoryView = activeInventoryView, force = true) {
    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    const viewToLoad = viewOverride;

    if (!force) {
      if (viewToLoad === 'overview' && summary) return;
      if (['product-master', 'shelf'].includes(viewToLoad) && products) return;
      if (viewToLoad === 'locations' && locations) return;
      if (viewToLoad === 'batches' && batches) return;
      if (viewToLoad === 'near-expiry' && nearExpiryBatches) return;
      if (viewToLoad === 'product-inventory' && products && locations && batches) return;

      if (viewToLoad === 'low-stock' && products) {
        if (!batches) {
          void loadInventoryResource(
            'batches',
            setBatches,
            () => getPharmaInventoryBatches(token, tenantSlug),
            false,
          );
        }

        return;
      }
    }

    setIsLoading(true);
    setError('');
    setInventoryNotice('');

    try {
      if (viewToLoad === 'overview') {
        await loadInventoryResource(
          'summary',
          setSummary,
          () => getPharmaInventorySummary(token, tenantSlug),
          force,
        );

        void loadInventoryResource(
          'products',
          setProducts,
          () => getPharmaProducts(token, tenantSlug),
          false,
        );

        return;
      }

      if (viewToLoad === 'product-master' || viewToLoad === 'shelf') {
        await loadInventoryResource(
          'products',
          setProducts,
          () => getPharmaProducts(token, tenantSlug),
          force,
        );
        return;
      }

      if (viewToLoad === 'low-stock') {
        await loadInventoryResource(
          'products',
          setProducts,
          () => getPharmaProducts(token, tenantSlug),
          force,
        );

        void loadInventoryResource(
          'batches',
          setBatches,
          () => getPharmaInventoryBatches(token, tenantSlug),
          false,
        );

        return;
      }

      if (viewToLoad === 'batches') {
        await loadInventoryResource(
          'batches',
          setBatches,
          () => getPharmaInventoryBatches(token, tenantSlug),
          force,
        );
        return;
      }

      if (viewToLoad === 'near-expiry') {
        await loadInventoryResource(
          'near-expiry-batches',
          setNearExpiryBatches,
          () => getPharmaInventoryBatches(token, tenantSlug, 180),
          force,
        );
        return;
      }

      if (viewToLoad === 'locations') {
        await loadInventoryResource(
          'locations',
          setLocations,
          () => getPharmaInventoryLocations(token, tenantSlug),
          force,
        );
        return;
      }

      if (viewToLoad === 'product-inventory') {
        const productsPromise = loadInventoryResource(
          'products',
          setProducts,
          () => getPharmaProducts(token, tenantSlug),
          force,
        );

        const locationsPromise = loadInventoryResource(
          'locations',
          setLocations,
          () => getPharmaInventoryLocations(token, tenantSlug),
          force,
        );

        const batchesPromise = loadInventoryResource(
          'batches',
          setBatches,
          () => getPharmaInventoryBatches(token, tenantSlug),
          force,
        );

        await Promise.all([productsPromise, locationsPromise, batchesPromise]);
        return;
      }

      await loadInventoryResource(
        'summary',
        setSummary,
        () => getPharmaInventorySummary(token, tenantSlug),
        force,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the selected inventory page.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInventoryPreview(activeInventoryView, false);
  }, [tenantSlug, token, activeInventoryView]);

  useEffect(() => {
    localStorage.setItem(inventorySmartCardStorageKey, JSON.stringify(inventorySmartCardVisibility));
  }, [inventorySmartCardVisibility]);

  useEffect(() => {
    localStorage.setItem(inventorySmartCardFieldStorageKey, JSON.stringify(inventorySmartCardFieldVisibility));
  }, [inventorySmartCardFieldVisibility]);

  useEffect(() => {
    localStorage.setItem(inventoryTableFontSizeStorageKey, JSON.stringify(tableFontSizes));
  }, [tableFontSizes]);

  const inventorySmartCardData = summary
    ? {
        products: {
          value: formatNumber(summary.summary.products_count),
          status: 'Product Master',
          target: 'product-master' as InventoryView,
          trendSeed: summary.summary.products_count,
        },
        categories: {
          value: formatNumber(summary.summary.product_categories_count),
          status: 'Product setup',
          target: 'product-master' as InventoryView,
          trendSeed: summary.summary.product_categories_count,
        },
        locations: {
          value: formatNumber(summary.summary.stock_locations_count),
          status: 'Storage points',
          target: 'locations' as InventoryView,
          trendSeed: summary.summary.stock_locations_count,
        },
        batches: {
          value: formatNumber(summary.summary.stock_batches_count),
          status: 'FEFO register',
          target: 'batches' as InventoryView,
          trendSeed: summary.summary.stock_batches_count,
        },
        'stock-units': {
          value: formatNumber(summary.summary.total_quantity_on_hand),
          status: 'Product Inventory',
          target: 'product-inventory' as InventoryView,
          trendSeed: summary.summary.total_quantity_on_hand,
        },
        'stock-value': {
          value: formatRwf(summary.summary.estimated_stock_value),
          status: 'Estimated value',
          target: 'product-inventory' as InventoryView,
          trendSeed: summary.summary.estimated_stock_value,
        },
        'low-stock': {
          value: formatNumber(summary.summary.low_stock_products_count),
          status: 'Needs reorder',
          target: 'low-stock' as InventoryView,
          trendSeed: summary.summary.low_stock_products_count,
        },
        'near-expiry': {
          value: formatNumber(summary.summary.near_expiry_batches_180_days_count),
          status: 'Expiry risk',
          target: 'near-expiry' as InventoryView,
          trendSeed: summary.summary.near_expiry_batches_180_days_count,
        },
      }
    : null;

  function renderMiniTrend(values: number[], mode: 'line' | 'bar') {
    const max = Math.max(...values, 1);

    if (mode === 'bar') {
      return (
        <div className="mini-ai-trend mini-ai-trend--bar" aria-label="AI weekly trend bar chart">
          {values.map((value, index) => (
            <span key={`${inventoryWeekLabels[index]}-${index}`}>
              <i style={{ height: `${Math.max(18, (value / max) * 48)}px` }} />
              <small>{inventoryWeekLabels[index]}</small>
            </span>
          ))}
        </div>
      );
    }

    const points = values
      .map((value, index) => {
        const x = 8 + index * 17;
        const y = 54 - (value / max) * 42;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <div className="mini-ai-trend mini-ai-trend--line" aria-label="AI weekly trend line chart">
        <svg viewBox="0 0 116 64" role="img">
          <polyline points={points} />
          {values.map((value, index) => {
            const x = 8 + index * 17;
            const y = 54 - (value / max) * 42;

            return <circle key={`${value}-${index}`} cx={x} cy={y} r="2.2" />;
          })}
        </svg>
        <div>
          {inventoryWeekLabels.map((label, index) => (
            <small key={`${label}-${index}`}>{label}</small>
          ))}
        </div>
      </div>
    );
  }

  function openInventoryCardPage(card: { target: InventoryView; label: string }) {
    selectInventoryView(card.target);
    setInventoryNotice(`${card.label} opened for detailed review and available actions.`);
  }

  function markAction(action: string) {
    setInventoryNotice(`${action} captured. Backend execution remains permission-controlled and will write an audit log when connected to the mutation endpoint.`);
  }

  async function handleCreateInventoryFromProductMaster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    if (!inventoryCreateForm.product_id || !inventoryCreateForm.stock_location_id) {
      setError('Select a Product Master item and stock location before creating inventory.');
      return;
    }

    setIsCreatingInventory(true);
    setError('');
    setInventoryNotice('');

    try {
      const sellingPrice = Number(inventoryCreateForm.selling_price || inventoryCalculatedSellingPrice || 0);

      const response = await receivePharmaStock(token, tenantSlug, {
        product_id: Number(inventoryCreateForm.product_id),
        stock_location_id: Number(inventoryCreateForm.stock_location_id),
        batch_number: inventoryCreateForm.batch_number,
        quantity: Number(inventoryCreateForm.quantity || 0),
        expiry_date: inventoryCreateForm.expiry_date || null,
        unit_cost: inventoryCreateForm.unit_cost ? Number(inventoryCreateForm.unit_cost) : null,
        selling_price: sellingPrice > 0 ? sellingPrice : null,
        supplier_name: inventoryCreateForm.supplier_name || null,
        reference_number: inventoryCreateForm.reference_number || null,
        reason: 'Product Inventory created from Product Master',
      });

      setInventoryNotice(
        `${response.message} ${selectedInventoryProduct?.name ?? 'Product'} is now available in Product Inventory. Batch ${response.batch.batch_number} received.`,
      );
      setInventoryCreateForm(emptyInventoryCreateForm);
      await loadInventoryPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create inventory from Product Master.');
    } finally {
      setIsCreatingInventory(false);
    }
  }

  function toggleProductSelection(id: number) {
    setSelectedProductIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleBatchSelection(id: number) {
    setSelectedBatchIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function selectAllProducts(rows: PharmaProduct[]) {
    const ids = rows.map((product) => product.id);
    setSelectedProductIds((current) => (ids.every((id) => current.includes(id)) ? [] : ids));
  }

  function selectAllBatches(rows: PharmaStockBatch[]) {
    const ids = rows.map((batch) => batch.id);
    setSelectedBatchIds((current) => (ids.every((id) => current.includes(id)) ? [] : ids));
  }

  function showProductDetails(product: PharmaProduct, nearestBatch?: PharmaStockBatch | null) {
    const days = nearestBatch ? remainingDays(nearestBatch.expiry_date) : null;

    setDetailPanel({
      title: product.name,
      fields: [
        ['SKU', product.sku],
        ['Generic name', product.generic_name ?? 'Not set'],
        ['Category', product.category?.name ?? 'Uncategorised'],
        ['Available stock', formatNumber(product.stock_summary?.available_quantity ?? 0)],
        ['Reorder level', formatNumber(product.reorder_level)],
        ['Minimum stock', formatNumber(product.minimum_stock_level)],
        ['Nearest expiry', nearestBatch ? formatDate(nearestBatch.expiry_date) : 'No batch found'],
        ['Remaining days', days === null ? 'N/A' : String(days)],
        ['Regulatory status', product.regulatory_status],
        ['Product status', product.status],
      ],
    });
  }

  function showBatchDetails(batch: PharmaStockBatch) {
    const days = remainingDays(batch.expiry_date);

    setDetailPanel({
      title: `${batch.product.name} · ${batch.batch_number}`,
      fields: [
        ['Product', batch.product.name],
        ['SKU', batch.product.sku],
        ['Batch number', batch.batch_number],
        ['Location', `${batch.stock_location.name} (${batch.stock_location.code})`],
        ['Available quantity', formatNumber(batch.available_quantity)],
        ['Reserved quantity', formatNumber(batch.quantity_reserved)],
        ['Expiry date', formatDate(batch.expiry_date)],
        ['Remaining days', days === null ? 'N/A' : String(days)],
        ['Supplier', batch.supplier_name ?? 'Not set'],
        ['Unit cost', formatRwf(batch.unit_cost)],
        ['Selling price', formatRwf(batch.selling_price)],
        ['Status', batch.status],
      ],
    });
  }

  function productToMasterForm(product: PharmaProduct): ProductMasterFormState {
    return {
      product_category_id: product.category ? String(product.category.id) : '',
      drug_code: product.sku,
      generic_description: product.generic_name ?? '',
      designation: product.name,
      instructions: metadataText(product, ['rhia_instructions']),
      selling_unit: metadataText(product, ['rhia_selling_unit'], product.unit),
      price: regulatoryPrice(product) ? String(regulatoryPrice(product)) : '',
      product_margin_rate: String(productMarginRate(product)),
      source: metadataText(product, ['source'], 'Product Master'),
      section: metadataText(product, ['rhia_section'], product.category?.name ?? ''),
      subsection: metadataText(product, ['rhia_subsection']),
      reorder_level: String(product.reorder_level ?? 0),
      status: product.status as ProductMasterFormState['status'],
    };
  }

  function handleSelectProductMasterForEdit(productId: string) {
    setSelectedProductMasterEditId(productId);

    const product = allProducts.find((item) => String(item.id) === productId);

    if (!product) {
      setProductMasterForm(emptyProductMasterForm);
      return;
    }

    setProductMasterForm(productToMasterForm(product));
  }

  function productMasterPayload() {
    return {
      product_category_id: productMasterForm.product_category_id ? Number(productMasterForm.product_category_id) : null,
      name: productMasterForm.designation,
      generic_name: productMasterForm.generic_description || null,
      sku: productMasterForm.drug_code,
      dosage_form: productMasterForm.selling_unit || null,
      unit: productMasterForm.selling_unit || 'unit',
      product_type: 'medicine' as const,
      regulatory_status: 'approved' as const,
      requires_prescription: productMasterForm.instructions.trim().length > 0,
      is_controlled: false,
      reorder_level: Number(productMasterForm.reorder_level || 0),
      minimum_stock_level: 0,
      status: productMasterForm.status,
      metadata: {
        rhia_instructions: productMasterForm.instructions || null,
        rhia_selling_unit: productMasterForm.selling_unit || null,
        rhia_reimbursement_price: Number(productMasterForm.price || 0),
        product_margin_rate: Number(productMasterForm.product_margin_rate || 0),
        product_margin_percent: Number(productMasterForm.product_margin_rate || 0),
        default_margin_percent: Number(productMasterForm.product_margin_rate || 0),
        source: productMasterForm.source || 'Manual Product Master',
        rhia_section: productMasterForm.section || null,
        rhia_subsection: productMasterForm.subsection || null,
        pricing_source: 'product_master',
      },
    };
  }

  async function handleCreateProductMaster(event: FormEvent<HTMLFormElement>, createAnother = false) {
    event.preventDefault();

    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    setIsSavingProductMaster(true);
    setError('');
    setInventoryNotice('');

    try {
      const response = await createPharmaProduct(token, tenantSlug, productMasterPayload());
      setInventoryNotice(`${response.message} ${response.product.name} added to Product Master.`);
      setProductMasterForm(createAnother ? emptyProductMasterForm : productMasterForm);
      if (!createAnother) setActiveProductMasterAction(null);
      await loadInventoryPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create Product Master item.');
    } finally {
      setIsSavingProductMaster(false);
    }
  }

  async function handleUpdateProductMaster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug || !selectedProductMasterEditId) {
      setError('Select a product before saving changes.');
      return;
    }

    setIsSavingProductMaster(true);
    setError('');
    setInventoryNotice('');

    try {
      const response = await updatePharmaProduct(token, tenantSlug, Number(selectedProductMasterEditId), productMasterPayload());
      setInventoryNotice(`${response.message} ${response.product.name} updated in Product Master.`);
      setActiveProductMasterAction(null);
      await loadInventoryPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update Product Master item.');
    } finally {
      setIsSavingProductMaster(false);
    }
  }

  function openProductMasterViewFromProduct(product: PharmaProduct) {
    setPendingDeleteProduct(null);
    setViewingProductMasterProduct(product);
    setActiveProductMasterAction('view');
    setInventoryNotice(`${product.sku} opened for Product Master review.`);
  }

  function openProductMasterEditFromProduct(product: PharmaProduct) {
    setActiveProductMasterAction('edit');
    setSelectedProductMasterEditId(String(product.id));
    setProductMasterSearchTerm(`${product.sku} · ${product.name}`);
    setProductMasterForm(productToMasterForm(product));
    setDetailPanel({
      title: product.name,
      fields: [
        ['Drug Code', product.sku],
        ['Generic Description', product.generic_name ?? 'Not set'],
        ['Designation', product.name],
        ['Instructions', metadataText(product, ['rhia_instructions'], 'Not set')],
        ['Selling Unit', metadataText(product, ['rhia_selling_unit'], product.unit)],
        ['Regulatory Price', formatRwf(regulatoryPrice(product))],
        ['Product Margin Rate', `${formatNumber(productMarginRate(product))}%`],
        ['Category', product.category?.name ?? 'Uncategorised'],
        ['Source', metadataText(product, ['source'], 'Product Master')],
        ['Section', metadataText(product, ['rhia_section'], product.category?.name ?? 'Uncategorised')],
        ['Subsection', metadataText(product, ['rhia_subsection'], 'Not set')],
        ['Re-order Level', formatNumber(product.reorder_level)],
        ['Status', product.status],
      ],
    });
    setInventoryNotice(`${product.sku} opened in Edit Product form.`);
  }

  function requestDeleteProductMaster(product: PharmaProduct) {
    setViewingProductMasterProduct(null);
    setActiveProductMasterAction(null);
    setPendingDeleteProduct(product);
    setInventoryNotice('');
    setError('');
  }

  async function confirmDeleteProductMaster() {
    if (!tenantSlug || !pendingDeleteProduct) {
      setError('No product is selected for deletion.');
      return;
    }

    setIsDeletingProductMaster(true);
    setError('');
    setInventoryNotice('');

    try {
      const response = await deletePharmaProduct(token, tenantSlug, pendingDeleteProduct.id);
      setInventoryNotice(`${response.message} ${pendingDeleteProduct.name} was removed from Product Master.`);
      setPendingDeleteProduct(null);
      await loadInventoryPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete Product Master item.');
    } finally {
      setIsDeletingProductMaster(false);
    }
  }

  function searchProductMasterForEdit() {
    const term = productMasterSearchTerm.trim().toLowerCase();

    if (!term) {
      setError('Type a drug code, designation, or generic description before searching.');
      return;
    }

    const product = allProducts.find((item) =>
      [
        item.sku,
        item.name,
        item.generic_name,
        item.category?.name,
        metadataText(item, ['rhia_section']),
        metadataText(item, ['rhia_subsection']),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );

    if (!product) {
      setError('No Product Master item matched your search.');
      return;
    }

    setError('');
    handleSelectProductMasterForEdit(String(product.id));
    setProductMasterSearchTerm(`${product.sku} · ${product.name}`);
  }

  function findProductMasterReferenceMatch() {
    const generic = productMasterForm.generic_description.trim().toLowerCase();
    const designation = productMasterForm.designation.trim().toLowerCase();
    const drugCode = productMasterForm.drug_code.trim().toLowerCase();

    return allProducts.find((product) => {
      const haystack = [
        product.sku,
        product.name,
        product.generic_name,
        product.category?.name,
        metadataText(product, ['rhia_section']),
        metadataText(product, ['rhia_subsection']),
        metadataText(product, ['rhia_selling_unit'], product.unit),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return Boolean(
        (drugCode && haystack.includes(drugCode.slice(0, Math.min(drugCode.length, 5)))) ||
        (generic && haystack.includes(generic.split(' ')[0])) ||
        (designation && haystack.includes(designation.split(' ')[0])),
      );
    }) ?? null;
  }

  function inferProductMasterMargin(referenceProduct: PharmaProduct | null) {
    const current = Number(productMasterForm.product_margin_rate || 0);

    if (current > 0) return current;

    if (referenceProduct && productMarginRate(referenceProduct) > 0) {
      return productMarginRate(referenceProduct);
    }

    const regulatoryAmount = Number(productMasterForm.price || 0);

    if (regulatoryAmount >= 50000) return 8;
    if (regulatoryAmount >= 10000) return 10;
    return 15;
  }

  function renderProductMasterAiAssistant(mode: ProductMasterAiMode) {
    const referenceProduct = findProductMasterReferenceMatch();
    const suggestedCategory = referenceProduct?.category ?? categoryOptions.find((category) =>
      productMasterForm.section && category.name.toLowerCase().includes(productMasterForm.section.toLowerCase().slice(0, 8)),
    );
    const suggestedSection = metadataText(referenceProduct, ['rhia_section'], productMasterForm.section || suggestedCategory?.name || '');
    const suggestedSubsection = metadataText(referenceProduct, ['rhia_subsection'], productMasterForm.subsection);
    const suggestedSellingUnit = metadataText(referenceProduct, ['rhia_selling_unit'], productMasterForm.selling_unit || 'unit');
    const suggestedMargin = inferProductMasterMargin(referenceProduct);

    if (mode === 'delete') {
      return (
        <div className="product-master-ai-assistant product-master-ai-assistant--delete">
          <strong>AI deletion safety assistant</strong>
          <span>
            Before deletion, the system checks whether this product has inventory, purchase order, or commercial history.
            If it has history, deactivate or discontinue the product instead of deleting it.
          </span>
        </div>
      );
    }

    return (
      <section className="product-master-ai-assistant">
        <div>
          <strong>AI Product Master Assistant</strong>
          <span>
            Suggestions are based on Product Master, RHIA imported fields, current inventory references and naming consistency.
            Review before saving.
          </span>
        </div>

        <div className="product-master-ai-suggestion-grid">
          {[
            {
              title: 'Category',
              value: suggestedCategory?.name || 'No match yet',
              apply: () => suggestedCategory && setProductMasterForm((current) => ({
                ...current,
                product_category_id: String(suggestedCategory.id),
                section: current.section || suggestedCategory.name,
              })),
              disabled: !suggestedCategory,
            },
            {
              title: 'Section',
              value: suggestedSection || 'No section suggested',
              apply: () => suggestedSection && setProductMasterForm((current) => ({ ...current, section: suggestedSection })),
              disabled: !suggestedSection,
            },
            {
              title: 'Subsection',
              value: suggestedSubsection || 'No subsection suggested',
              apply: () => suggestedSubsection && setProductMasterForm((current) => ({ ...current, subsection: suggestedSubsection })),
              disabled: !suggestedSubsection,
            },
            {
              title: 'Selling Unit',
              value: suggestedSellingUnit || 'unit',
              apply: () => setProductMasterForm((current) => ({ ...current, selling_unit: suggestedSellingUnit || 'unit' })),
              disabled: false,
            },
            {
              title: 'Margin Rate',
              value: `${formatNumber(suggestedMargin)}%`,
              apply: () => setProductMasterForm((current) => ({ ...current, product_margin_rate: String(suggestedMargin) })),
              disabled: false,
            },
            {
              title: 'Naming Check',
              value: productMasterForm.drug_code && productMasterForm.designation ? 'Ready for review' : 'Drug Code and Designation required',
              apply: () => undefined,
              disabled: true,
            },
          ].map((suggestion) => (
            <article key={suggestion.title}>
              <span>{suggestion.title}</span>
              <strong>{suggestion.value}</strong>
              <button type="button" disabled={suggestion.disabled} onClick={suggestion.apply}>
                Apply
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderProductMasterFormFields() {
    return (
      <div className="product-master-form-grid">
        <label>
          Drug Code
          <input
            value={productMasterForm.drug_code}
            onChange={(event) => setProductMasterForm({ ...productMasterForm, drug_code: event.target.value })}
            required
          />
        </label>

        <label>
          Generic Description
          <input
            value={productMasterForm.generic_description}
            onChange={(event) => setProductMasterForm({ ...productMasterForm, generic_description: event.target.value })}
          />
        </label>

        <label>
          Designation
          <input
            value={productMasterForm.designation}
            onChange={(event) => setProductMasterForm({ ...productMasterForm, designation: event.target.value })}
            required
          />
        </label>

        <label>
          Instructions
          <input
            value={productMasterForm.instructions}
            onChange={(event) => setProductMasterForm({ ...productMasterForm, instructions: event.target.value })}
            placeholder="e.g. DT"
          />
        </label>

        <label>
          Selling Unit
          <input
            list="product-master-selling-unit-options"
            value={productMasterForm.selling_unit}
            onChange={(event) => setProductMasterForm({ ...productMasterForm, selling_unit: event.target.value })}
            required
          />
          <datalist id="product-master-selling-unit-options">
            {sellingUnitOptions.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
        </label>

        <label>
          Regulatory Price
          <input
            type="number"
            min="0"
            value={productMasterForm.price}
            onChange={(event) => setProductMasterForm({ ...productMasterForm, price: event.target.value })}
          />
        </label>

        <label>
          Product Margin Rate %
          <input
            list="product-master-margin-rate-options"
            type="number"
            min="0"
            value={productMasterForm.product_margin_rate}
            onChange={(event) => setProductMasterForm({ ...productMasterForm, product_margin_rate: event.target.value })}
          />
          <datalist id="product-master-margin-rate-options">
            {marginRateOptions.map((rate) => (
              <option key={rate} value={rate} />
            ))}
          </datalist>
        </label>

        <label>
          Category
          <select
            value={productMasterForm.product_category_id}
            onChange={(event) => {
              const category = categoryOptions.find((item) => String(item.id) === event.target.value);

              setProductMasterForm({
                ...productMasterForm,
                product_category_id: event.target.value,
                section: category?.name ?? productMasterForm.section,
              });
            }}
          >
            <option value="">Select category</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Source
          <input
            value={productMasterForm.source}
            onChange={(event) => setProductMasterForm({ ...productMasterForm, source: event.target.value })}
          />
        </label>

        <label>
          Section
          <input
            list="product-master-section-options"
            value={productMasterForm.section}
            onChange={(event) => setProductMasterForm({ ...productMasterForm, section: event.target.value })}
          />
          <datalist id="product-master-section-options">
            {sectionOptions.map((section) => (
              <option key={section} value={section} />
            ))}
          </datalist>
        </label>

        <label>
          Subsection
          <input
            list="product-master-subsection-options"
            value={productMasterForm.subsection}
            onChange={(event) => setProductMasterForm({ ...productMasterForm, subsection: event.target.value })}
          />
          <datalist id="product-master-subsection-options">
            {subsectionOptions.map((subsection) => (
              <option key={subsection} value={subsection} />
            ))}
          </datalist>
        </label>

        <label>
          Re-order Level
          <input
            type="number"
            min="0"
            value={productMasterForm.reorder_level}
            onChange={(event) => setProductMasterForm({ ...productMasterForm, reorder_level: event.target.value })}
          />
        </label>

        <label>
          Status
          <select
            value={productMasterForm.status}
            onChange={(event) => setProductMasterForm({ ...productMasterForm, status: event.target.value as ProductMasterFormState['status'] })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </label>
      </div>
    );
  }

  function renderProductMasterActionPanel() {
    if (pendingDeleteProduct) {
      return (
        <section className="product-master-action-panel product-master-delete-confirmation-card">
          <div>
            <h3>Confirm Product Deletion</h3>
            <p>
              You are about to delete <strong>{pendingDeleteProduct.name}</strong> ({pendingDeleteProduct.sku}) from Product Master.
              This action will be blocked if the product has stock or purchase order history.
            </p>
          </div>

          {renderProductMasterAiAssistant('delete')}

          <div className="product-master-delete-actions">
            <button type="button" className="cancel-delete" disabled={isDeletingProductMaster} onClick={() => setPendingDeleteProduct(null)}>
              Cancel
            </button>
            <button type="button" className="confirm-delete" disabled={isDeletingProductMaster} onClick={() => void confirmDeleteProductMaster()}>
              {isDeletingProductMaster ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </section>
      );
    }

    if (activeProductMasterAction === 'view' && viewingProductMasterProduct) {
      return (
        <section className="product-master-action-panel product-master-view-panel">
          <div className="section-heading">
            <div>
              <h3>View Product</h3>
              <span>Product Master information displayed from the same area used by action cards.</span>
            </div>
            <button type="button" onClick={() => {
              setActiveProductMasterAction(null);
              setViewingProductMasterProduct(null);
            }}>Close</button>
          </div>

          <div className="product-master-view-grid">
            {[
              ['SN', metadataText(viewingProductMasterProduct, ['rhia_sn'], String(viewingProductMasterProduct.id))],
              ['Drug Code', viewingProductMasterProduct.sku],
              ['Generic Description', viewingProductMasterProduct.generic_name ?? 'Not set'],
              ['Designation', viewingProductMasterProduct.name],
              ['Instructions', metadataText(viewingProductMasterProduct, ['rhia_instructions'], 'Not set')],
              ['Selling Unit', metadataText(viewingProductMasterProduct, ['rhia_selling_unit'], viewingProductMasterProduct.unit)],
              ['Regulatory Price', formatRwf(regulatoryPrice(viewingProductMasterProduct))],
              ['Product Margin Rate', `${formatNumber(productMarginRate(viewingProductMasterProduct))}%`],
              ['Category', viewingProductMasterProduct.category?.name ?? 'Uncategorised'],
              ['Source', metadataText(viewingProductMasterProduct, ['source'], 'Product Master')],
              ['Section', metadataText(viewingProductMasterProduct, ['rhia_section'], viewingProductMasterProduct.category?.name ?? 'Uncategorised')],
              ['Subsection', metadataText(viewingProductMasterProduct, ['rhia_subsection'], 'Not set')],
              ['Re-order Level', formatNumber(viewingProductMasterProduct.reorder_level)],
              ['Status', viewingProductMasterProduct.status],
            ].map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>

          <div className="inventory-form-actions">
            <button type="button" onClick={() => openProductMasterEditFromProduct(viewingProductMasterProduct)}>Edit Product</button>
            <button type="button" className="danger" onClick={() => requestDeleteProductMaster(viewingProductMasterProduct)}>Delete Product</button>
          </div>
        </section>
      );
    }

    if (!activeProductMasterAction) return null;

    if (activeProductMasterAction === 'create') {
      return (
        <section className="product-master-action-panel">
          <div className="section-heading">
            <div>
              <h3>Create New Product</h3>
              <span>Fields start from the Product Master table structure.</span>
            </div>
            <button type="button" onClick={() => setActiveProductMasterAction(null)}>Cancel</button>
          </div>

          <form
            onSubmit={(event) => void handleCreateProductMaster(event, false)}
          >
            {renderProductMasterAiAssistant('create')}
            {renderProductMasterFormFields()}

            <div className="inventory-form-actions">
              <button type="submit" disabled={isSavingProductMaster}>
                {isSavingProductMaster ? 'Saving…' : 'Save'}
              </button>
              <button type="button" disabled={isSavingProductMaster} onClick={(event) => void handleCreateProductMaster(event as unknown as FormEvent<HTMLFormElement>, true)}>
                Save and Create Another
              </button>
              <button type="button" onClick={() => setActiveProductMasterAction(null)}>Cancel</button>
            </div>
          </form>
        </section>
      );
    }

    if (activeProductMasterAction === 'edit') {
      return (
        <section className="product-master-action-panel">
          <div className="section-heading">
            <div>
              <h3>Edit Product</h3>
              <span>Search and select a Product Master item, then update the table fields.</span>
            </div>
            <button type="button" onClick={() => setActiveProductMasterAction(null)}>Cancel</button>
          </div>

          <form onSubmit={(event) => void handleUpdateProductMaster(event)}>
            {renderProductMasterAiAssistant('edit')}
            <label className="product-master-search-select product-master-combo-select">
              Select Product
              <div className="product-master-combo-field">
                <input
                  list="product-master-edit-options"
                  value={productMasterSearchTerm}
                  onChange={(event) => {
                    const value = event.target.value;
                    setProductMasterSearchTerm(value);

                    const directMatch = allProducts.find((product) =>
                      value.startsWith(`${product.sku} · ${product.name}`),
                    );
                    if (directMatch) {
                      handleSelectProductMasterForEdit(String(directMatch.id));
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      searchProductMasterForEdit();
                    }
                  }}
                  placeholder="Search by drug code, designation, or generic description"
                  required
                />
                <button type="button" aria-label="Search Product Master" onClick={searchProductMasterForEdit}>Search</button>
              </div>

              <datalist id="product-master-edit-options">
                {allProducts.map((product) => (
                  <option
                    key={product.id}
                    value={`${product.sku} · ${product.name} · ${product.generic_name ?? 'No generic'} · ${metadataText(product, ['rhia_section'], product.category?.name ?? 'No category')}`}
                  />
                ))}
              </datalist>
            </label>

            {renderProductMasterFormFields()}

            <div className="inventory-form-actions">
              <button type="submit" disabled={isSavingProductMaster || !selectedProductMasterEditId}>
                {isSavingProductMaster ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setActiveProductMasterAction(null)}>Cancel</button>
            </div>
          </form>
        </section>
      );
    }

    if (activeProductMasterAction === 'receive') {
      return (
        <section className="product-master-action-panel">
          <div className="section-heading">
            <div>
              <h3>Receive Stock</h3>
              <span>Receiving uses Product Master identity. Complete commercial inventory fields under Product Inventory.</span>
            </div>
            <button type="button" onClick={() => selectInventoryView('product-inventory')}>Open Product Inventory form</button>
          </div>
        </section>
      );
    }

    return (
      <section className="product-master-action-panel">
        <div className="section-heading">
          <div>
            <h3>AI Import</h3>
            <span>RSSB/RHIA, FDA, and Excel import will compare extracted products against Product Master before approval.</span>
          </div>
          <button type="button" onClick={() => markAction('AI Import approval queue')}>Open AI review queue</button>
        </div>
      </section>
    );
  }

  function renderRowLimitControl() {
    return (
      <label className="inventory-row-limit-control">
        Rows
        <select value={rowLimit} onChange={(event) => setRowLimit(event.target.value as RowLimit)}>
          <option value="15">15</option>
          <option value="30">30</option>
          <option value="60">60</option>
          <option value="120">120</option>
          <option value="240">240</option>
          <option value="all">All</option>
        </select>
      </label>
    );
  }

  function renderTableFontControl() {
    return (
      <label className="inventory-row-limit-control">
        Table font
        <select
          value={tableFontSizes[activeInventoryView] ?? 'normal'}
          onChange={(event) =>
            setTableFontSizes((current) => ({
              ...current,
              [activeInventoryView]: event.target.value as InventoryTableFontSize,
            }))
          }
        >
          <option value="compact">Compact</option>
          <option value="normal">Normal</option>
          <option value="large">Large</option>
        </select>
      </label>
    );
  }

  function renderTableToolbar(config: {
    title: string;
    subtitle: string;
    selectedCount: number;
    onExport: () => void;
    onBulkEdit: () => void;
    onBulkDelete: () => void;
    extra?: React.ReactNode;
  }) {
    return (
      <div className="section-heading">
        <div>
          <h3>{config.title}</h3>
          <span>{config.subtitle}</span>
        </div>
        <div className="bulk-action-row" aria-label="Table controls">
          {config.extra}
          {renderRowLimitControl()}
          {renderTableFontControl()}
          <button type="button" onClick={config.onBulkEdit}>Bulk edit</button>
          <button type="button" onClick={config.onExport}>Export</button>
          <button type="button" className="danger" onClick={config.onBulkDelete}>
            Bulk delete {config.selectedCount > 0 ? `(${config.selectedCount})` : ''}
          </button>
        </div>
      </div>
    );
  }

  function renderProductActions(product: PharmaProduct, nearestBatch?: PharmaStockBatch | null) {
    return (
      <div className="table-action-row">
        <button type="button" onClick={() => openProductMasterViewFromProduct(product)}>View</button>
        <button type="button" onClick={() => openProductMasterEditFromProduct(product)}>Edit</button>
        <button type="button" className="danger" onClick={() => requestDeleteProductMaster(product)}>Delete</button>
      </div>
    );
  }

  function renderBatchActions(batch: PharmaStockBatch) {
    return (
      <div className="table-action-row">
        <button type="button" onClick={() => showBatchDetails(batch)}>Details</button>
        <button type="button" onClick={() => markAction(`Edit batch ${batch.batch_number}`)}>Edit</button>
        <button type="button" className="danger" onClick={() => markAction(`Delete batch ${batch.batch_number}`)}>Delete</button>
      </div>
    );
  }

  return (
    <article className="panel wide inventory-preview-panel">
      <div className="panel-heading-row">
        <div>
          <h2>{activeInventoryMeta.label}</h2>
          <p className="muted">{inventoryPageDescriptions[activeInventoryView]}</p>
        </div>

        <button type="button" onClick={() => loadInventoryPreview(activeInventoryView, true)} disabled={isLoading}>
          {isLoading ? 'Loading...' : summary ? 'Refresh inventory' : 'Load inventory'}
        </button>
      </div>

      {isLoading && !summary && <p className="muted">Loading inventory automatically...</p>}

      {error && <div className="form-error">{error}</div>}
      {inventoryNotice && <div className="form-success">{inventoryNotice}</div>}

      <section className="inventory-active-page-marker" data-active-inventory-view={activeInventoryView}>
        <span>Inventory page</span>
        <strong>{activeInventoryMeta.label}</strong>
        <small>{activeInventoryMeta.description}</small>
      </section>

      <section className="module-workspace-shell inventory-workspace-shell">
        {showInternalNavigation && (
          <aside className="module-section-rail" aria-label="Inventory module sections">
            <span>Inventory</span>
            {inventoryViews.map((view) => (
              <button
                key={view.key}
                type="button"
                className={activeInventoryView === view.key ? 'active' : ''}
                onClick={() => selectInventoryView(view.key)}
              >
                <strong>{view.label}</strong>
                <small>{view.description}</small>
              </button>
            ))}
          </aside>
        )}

        <div className="module-section-stage" style={{ fontSize: tableFontPixels[tableFontSizes[activeInventoryView] ?? 'normal'] }}>
        {pendingDeleteProduct && activeInventoryView !== 'product-master' && (
          <section className="inventory-section inventory-delete-confirmation-panel">
            <div className="section-heading">
              <div>
                <h3>Confirm Product Deletion</h3>
                <span>
                  This deletion request came from the current table. The system will block deletion if the product has stock, purchase, sales, or audit history.
                </span>
              </div>
            </div>

            <div className="delete-confirmation-card">
              <div>
                <strong>{pendingDeleteProduct.sku}</strong>
                <span>{pendingDeleteProduct.name}</span>
                <small>{pendingDeleteProduct.generic_name ?? 'Generic name not set'}</small>
              </div>

              <div className="delete-confirmation-actions">
                <button type="button" onClick={() => setPendingDeleteProduct(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={isDeletingProductMaster}
                  onClick={confirmDeleteProductMaster}
                >
                  {isDeletingProductMaster ? 'Deleting…' : 'Delete Product'}
                </button>
              </div>
            </div>
          </section>
        )}


          {activeInventoryView === 'overview' && summary && (
            <>
              <section className="inventory-card-control-row">
                <details className="inventory-card-customizer">
                  <summary>Edit Product Master cards</summary>
                  <div className="inventory-card-customizer-grid">
                    {inventorySmartCardOptions.map((card) => (
                      <section key={card.key}>
                        <label className="inventory-card-master-toggle">
                          <input
                            type="checkbox"
                            checked={inventorySmartCardVisibility[card.key]}
                            onChange={(event) =>
                              setInventorySmartCardVisibility((current) => ({
                                ...current,
                                [card.key]: event.target.checked,
                              }))
                            }
                          />
                          <strong>{card.label}</strong>
                        </label>

                        <div className="inventory-card-field-options">
                          {(['value', 'trend', 'status'] as InventorySmartCardField[]).map((field) => (
                            <label key={`${card.key}-${field}`}>
                              <input
                                type="checkbox"
                                checked={inventorySmartCardFieldVisibility[card.key]?.[field] ?? true}
                                onChange={(event) =>
                                  setInventorySmartCardFieldVisibility((current) => ({
                                    ...current,
                                    [card.key]: {
                                      ...(current[card.key] ?? {}),
                                      [field]: event.target.checked,
                                    },
                                  }))
                                }
                              />
                              <span>{field === 'value' ? 'Number/value' : field === 'trend' ? 'AI weekly trend' : 'Status text'}</span>
                            </label>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </details>
              </section>

              <section className="inventory-smart-card-grid">
                {inventorySmartCardData &&
                  inventorySmartCardOptions
                    .filter((card) => inventorySmartCardVisibility[card.key])
                    .map((card) => {
                      const cardData = inventorySmartCardData[card.key];
                      const fields = inventorySmartCardFieldVisibility[card.key] ?? { value: true, trend: true, status: true };
                      const trendValues = buildInventoryTrend(cardData.trendSeed);
                      const trendMode = aiTrendMode(trendValues);

                      return (
                        <button
                          key={card.key}
                          type="button"
                          className="inventory-smart-card"
                          onClick={() => openInventoryCardPage({ target: card.target, label: card.label })}
                        >
                          <span>{card.label}</span>
                          {fields.value && <strong>{cardData.value}</strong>}
                          {fields.trend && renderMiniTrend(trendValues, trendMode)}
                          {fields.status && <small>{cardData.status}</small>}
                        </button>
                      );
                    })}
              </section>

              <section className="inventory-ai-analytics">
                <div className="section-heading">
                  <div>
                    <h3>AI inventory analytics</h3>
                    <span>Operational signals prepared for demand, reorder, expiry, margin and stock-out models.</span>
                  </div>
                  <button type="button" onClick={() => selectInventoryView('product-inventory')}>Open Product Inventory</button>
                </div>

                <div className="analytics-bar-grid">
                  {[
                    ['Low stock risk', summary.summary.low_stock_products_count, Math.max(summary.summary.products_count, 1)],
                    ['Expiry risk', summary.summary.near_expiry_batches_180_days_count, Math.max(summary.summary.stock_batches_count, 1)],
                    ['Batch coverage', summary.summary.stock_batches_count, Math.max(summary.summary.products_count, 1)],
                  ].map(([label, value, max]) => (
                    <article key={label}>
                      <span>{label}</span>
                      <strong>{formatNumber(Number(value))}</strong>
                      <div>
                        <i style={{ width: `${Math.min((Number(value) / Number(max)) * 100, 100)}%` }} />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}

          {activeInventoryView !== 'overview' && (
            <div className="inventory-filter-bar">
              <label>
                Search
                <input
                  value={searchTerm}
                  placeholder="Search product, SKU, batch, location or supplier"
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>

              {['shelf', 'product-master', 'product-inventory'].includes(activeInventoryView) && (
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
              )}
            </div>
          )}

          {activeInventoryView === 'low-stock' && (() => {
            const productSource = (() => {
              if (typeof allProducts !== 'undefined' && Array.isArray(allProducts)) {
                return allProducts;
              }

              if (typeof products !== 'undefined') {
                if (Array.isArray(products)) {
                  return products;
                }

                if (products && Array.isArray(products.data)) {
                  return products.data;
                }

                if (products && Array.isArray(products.items)) {
                  return products.items;
                }
              }

              return [];
            })();

            const batchSource = (() => {
              if (typeof allBatches !== 'undefined' && Array.isArray(allBatches)) {
                return allBatches;
              }

              if (typeof batches !== 'undefined') {
                if (Array.isArray(batches)) {
                  return batches;
                }

                if (batches && Array.isArray(batches.data)) {
                  return batches.data;
                }

                if (batches && Array.isArray(batches.items)) {
                  return batches.items;
                }
              }

              return [];
            })();

            const toNumber = (value: unknown) => {
              const parsed = Number(value);
              return Number.isFinite(parsed) ? parsed : 0;
            };

            const formatLowStockNumber = (value: unknown) =>
              new Intl.NumberFormat('en-US', {
                maximumFractionDigits: 2,
              }).format(toNumber(value));

            const formatLowStockCurrency = (value: unknown) =>
              new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'RWF',
                maximumFractionDigits: 0,
              }).format(toNumber(value));

            const productMeta = (product: any, key: string) => {
              if (!product || !product.metadata || typeof product.metadata !== 'object') {
                return undefined;
              }

              return product.metadata[key];
            };

            const productAvailableQty = (product: any) =>
              toNumber(
                product?.stock_summary?.available_quantity ??
                  product?.available_quantity ??
                  product?.available_qty ??
                  product?.quantity_available ??
                  0,
              );

            const productReorderLevel = (product: any) =>
              toNumber(product?.reorder_level ?? product?.reorderLevel ?? product?.minimum_stock_level ?? 0);

            const productRegulatoryPrice = (product: any) =>
              toNumber(
                productMeta(product, 'rhia_reimbursement_price') ??
                  productMeta(product, 'regulatory_price') ??
                  product?.regulatory_price ??
                  product?.selling_price ??
                  product?.unit_price ??
                  0,
              );

            const productMargin = (product: any) =>
              toNumber(
                productMeta(product, 'product_margin_rate') ??
                  productMeta(product, 'product_margin_percent') ??
                  productMeta(product, 'default_margin_percent') ??
                  product?.margin_rate ??
                  product?.margin_percent ??
                  0,
              );

            const productSellingUnit = (product: any) =>
              String(productMeta(product, 'rhia_selling_unit') ?? product?.unit ?? product?.selling_unit ?? 'Not set');

            const productGenericName = (product: any) =>
              String(product?.generic_name ?? product?.genericDescription ?? productMeta(product, 'generic_description') ?? 'Not set');

            const productDesignation = (product: any) =>
              String(product?.name ?? product?.designation ?? product?.description ?? 'Not set');

            const productCategory = (product: any) =>
              String(product?.category?.name ?? product?.category_name ?? productMeta(product, 'category') ?? 'Uncategorised');

            const nearestLowStockBatch = (product: any) => {
              const productId = toNumber(product?.id);

              const matches = batchSource.filter((batch: any) => {
                const batchProductId = toNumber(batch?.product_id ?? batch?.product?.id);
                return productId > 0 && batchProductId === productId;
              });

              return matches
                .filter((batch: any) => batch?.expiry_date)
                .sort((a: any, b: any) => {
                  const left = new Date(a.expiry_date).getTime();
                  const right = new Date(b.expiry_date).getTime();
                  return left - right;
                })[0] ?? null;
            };

            const lowStockProducts = productSource.filter((product: any) => {
              const available = productAvailableQty(product);
              const reorderLevel = productReorderLevel(product);

              return reorderLevel > 0 && available <= reorderLevel;
            });

            const lowStockRows = lowStockProducts.slice(0, 15);

            const openLowStockView = (product: any) => {
              if (typeof openProductMasterViewFromProduct === 'function') {
                openProductMasterViewFromProduct(product);
                return;
              }

              if (typeof markAction === 'function') {
                markAction(`View low stock product ${product?.sku ?? product?.id ?? ''}`);
              }
            };

            const openLowStockEdit = (product: any) => {
              if (typeof openProductMasterEditFromProduct === 'function') {
                openProductMasterEditFromProduct(product);
                return;
              }

              if (typeof markAction === 'function') {
                markAction(`Edit low stock product ${product?.sku ?? product?.id ?? ''}`);
              }
            };

            const openLowStockDelete = (product: any) => {
              if (typeof requestDeleteProductMaster === 'function') {
                requestDeleteProductMaster(product);
                return;
              }

              if (typeof markAction === 'function') {
                markAction(`Delete low stock product ${product?.sku ?? product?.id ?? ''}`);
              }
            };

            return (
              <section className="inventory-section inventory-section--low-stock-product-master">
                <div className="section-heading">
                  <div>
                    <h3>Low Stock Watch List</h3>
                    <span>
                      Product Master register filtered by available quantity against configured re-order level.
                    </span>
                  </div>

                  <div className="bulk-action-row register-action-toolbar">
                    <button type="button" onClick={() => markAction('Bulk edit low stock products')}>
                      Bulk edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof exportCsv !== 'function') {
                          return;
                        }

                        exportCsv(
                          'low-stock-watch-list.csv',
                          [
                            'SN',
                            'Drug Code',
                            'Generic Description',
                            'Designation',
                            'Selling Unit',
                            'Regulatory Price',
                            'Product Margin Rate',
                            'Category',
                            'Available Qty',
                            'Re-order Level',
                            'Shortage Qty',
                            'Nearest Expiry',
                            'Trigger Logic',
                          ],
                          lowStockRows.map((product: any, index: number) => {
                            const available = productAvailableQty(product);
                            const reorderLevel = productReorderLevel(product);
                            const nearestBatch = nearestLowStockBatch(product);

                            return [
                              index + 1,
                              product?.sku ?? '',
                              productGenericName(product),
                              productDesignation(product),
                              productSellingUnit(product),
                              productRegulatoryPrice(product),
                              productMargin(product),
                              productCategory(product),
                              available,
                              reorderLevel,
                              Math.max(reorderLevel - available, 0),
                              nearestBatch?.expiry_date ?? '',
                              `Available ${formatLowStockNumber(available)} is at or below re-order level ${formatLowStockNumber(reorderLevel)}.`,
                            ];
                          }),
                        );
                      }}
                    >
                      Export
                    </button>
                  </div>
                </div>

                <div className="low-stock-trigger-note">
                  <strong>Listing rule:</strong>
                  <span>
                    A product is listed here only when its Product Master re-order level is greater than zero and Product Inventory available quantity is less than or equal to that level.
                  </span>
                </div>

                <div className="inventory-master-table inventory-master-table--rhia-format inventory-master-table--low-stock-product-master">
                  <div className="inventory-master-table__header low-stock-product-master-row">
                    <strong>SN</strong>
                    <strong>Drug Code</strong>
                    <strong>Generic Description</strong>
                    <strong>Designation</strong>
                    <strong>Selling Unit</strong>
                    <strong className="rhia-number-cell">Regulatory Price</strong>
                    <strong className="rhia-number-cell">Product Margin Rate</strong>
                    <strong>Category</strong>
                    <strong className="rhia-number-cell">Available Qty</strong>
                    <strong className="rhia-number-cell">Re-order Level</strong>
                    <strong className="rhia-number-cell">Shortage Qty</strong>
                    <strong>Nearest Expiry</strong>
                    <strong>Trigger Logic</strong>
                    <strong>Actions</strong>
                  </div>

                  {lowStockRows.length === 0 ? (
                    <div className="low-stock-product-master-row low-stock-product-master-row--empty">
                      <span>
                        No low-stock products found. Set a Product Master re-order level above zero, then compare it with available Product Inventory quantity.
                      </span>
                    </div>
                  ) : (
                    lowStockRows.map((product: any, index: number) => {
                      const available = productAvailableQty(product);
                      const reorderLevel = productReorderLevel(product);
                      const shortage = Math.max(reorderLevel - available, 0);
                      const nearestBatch = nearestLowStockBatch(product);

                      return (
                        <div key={product?.id ?? product?.sku ?? index} className="low-stock-product-master-row">
                          <span>{index + 1}</span>
                          <span>{product?.sku ?? 'Not set'}</span>
                          <span>{productGenericName(product)}</span>
                          <span><strong>{productDesignation(product)}</strong></span>
                          <span>{productSellingUnit(product)}</span>
                          <span className="rhia-number-cell">{formatLowStockCurrency(productRegulatoryPrice(product))}</span>
                          <span className="rhia-number-cell">{formatLowStockNumber(productMargin(product))}%</span>
                          <span>{productCategory(product)}</span>
                          <span className="rhia-number-cell">{formatLowStockNumber(available)}</span>
                          <span className="rhia-number-cell">{formatLowStockNumber(reorderLevel)}</span>
                          <span className="rhia-number-cell">{formatLowStockNumber(shortage)}</span>
                          <span>{nearestBatch?.expiry_date ?? 'No batch'}</span>
                          <span>{`Available ${formatLowStockNumber(available)} is at or below re-order level ${formatLowStockNumber(reorderLevel)}.`}</span>
                          <span className="table-action-row">
                            <button type="button" onClick={() => openLowStockView(product)}>View</button>
                            <button type="button" onClick={() => openLowStockEdit(product)}>Edit</button>
                            <button type="button" className="danger" onClick={() => openLowStockDelete(product)}>Delete</button>
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })()}

          {activeInventoryView === 'shelf' && products && (
            <section className="inventory-section product-shelf-section">
              <div className="section-heading">
                <div>
                  <h3>Retail product shelf</h3>
                  <span>{visibleProducts.length} visible of {products.products.length} product(s)</span>
                </div>
                <div className="bulk-action-row">
                  {renderRowLimitControl()}
                  <button type="button" className={shelfViewMode === 'grid' ? 'active' : ''} onClick={() => setShelfViewMode('grid')}>Grid view</button>
                  <button type="button" className={shelfViewMode === 'list' ? 'active' : ''} onClick={() => setShelfViewMode('list')}>List view</button>
                </div>
              </div>

              <form
                className="inventory-inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!newShelfName.trim()) return;
                  setInventoryNotice(`Shelf "${newShelfName}" prepared. Backend shelf creation endpoint will persist it with audit log.`);
                  setNewShelfName('');
                }}
              >
                <label>
                  Create another shelf
                  <input value={newShelfName} onChange={(event) => setNewShelfName(event.target.value)} placeholder="e.g. Front counter fast movers" />
                </label>
                <button type="submit">Create shelf</button>
              </form>

              {shelfViewMode === 'grid' ? (
                <div className="product-shelf-grid product-shelf-grid--fixed">
                  {pagedProducts.map((product) => (
                    <article key={product.id}>
                      <div className="product-shelf-card-header">
                        <span className={product.requires_prescription ? 'rx-chip' : 'otc-chip'}>
                          {product.requires_prescription ? 'RX' : 'OTC'}
                        </span>
                        {product.stock_summary?.is_below_reorder_level && <span className="risk-chip">Low stock</span>}
                      </div>
                      <strong>{product.name}</strong>
                      <span>{product.generic_name || product.brand_name || product.dosage_form || product.sku}</span>
                      <small>{product.category?.name ?? 'Uncategorised'} · SKU {product.sku} · Regulatory Price {formatRwf(regulatoryPrice(product))}</small>
                      <footer>
                        <span>{formatRwf(nearestBatchForProduct(product.id, allBatches)?.selling_price)}</span>
                        <strong>{formatNumber(product.stock_summary?.available_quantity ?? 0)} {product.unit}</strong>
                      </footer>
                      {renderProductActions(product, nearestBatchForProduct(product.id, allBatches))}
                    </article>
                  ))}
                </div>
              ) : (
                <ProductMasterTable
                  rows={pagedProducts}
                  selectedProductIds={selectedProductIds}
                  onToggleProduct={toggleProductSelection}
                  onSelectAll={() => selectAllProducts(pagedProducts)}
                  onAction={renderProductActions}
                  batches={allBatches}
                />
              )}
            </section>
          )}

          {activeInventoryView === 'batches' && (() => {
            const batchSource = Array.isArray(allBatches) ? allBatches : [];

            const toNumber = (value: unknown) => {
              const parsed = Number(value);
              return Number.isFinite(parsed) ? parsed : 0;
            };

            const formatBatchNumber = (value: unknown) =>
              new Intl.NumberFormat('en-US', {
                maximumFractionDigits: 2,
              }).format(toNumber(value));

            const formatBatchCurrency = (value: unknown) =>
              new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'RWF',
                maximumFractionDigits: 0,
              }).format(toNumber(value));

            const batchProductMeta = (product: any, key: string) => {
              if (!product || !product.metadata || typeof product.metadata !== 'object') {
                return undefined;
              }

              return product.metadata[key];
            };

            const batchProduct = (batch: any) => batch?.product ?? {};

            const batchProductGeneric = (batch: any) =>
              String(batchProduct(batch)?.generic_name ?? batchProductMeta(batchProduct(batch), 'generic_description') ?? 'Not set');

            const batchProductDesignation = (batch: any) =>
              String(batchProduct(batch)?.name ?? batchProduct(batch)?.designation ?? 'Not set');

            const batchSellingUnit = (batch: any) =>
              String(batchProductMeta(batchProduct(batch), 'rhia_selling_unit') ?? batchProduct(batch)?.unit ?? 'Not set');

            const batchRegulatoryPrice = (batch: any) =>
              toNumber(
                batchProductMeta(batchProduct(batch), 'rhia_reimbursement_price') ??
                  batchProductMeta(batchProduct(batch), 'regulatory_price') ??
                  batchProduct(batch)?.regulatory_price ??
                  batchProduct(batch)?.selling_price ??
                  batchProduct(batch)?.unit_price ??
                  0,
              );

            const batchProductMargin = (batch: any) =>
              toNumber(
                batchProductMeta(batchProduct(batch), 'product_margin_rate') ??
                  batchProductMeta(batchProduct(batch), 'product_margin_percent') ??
                  batchProductMeta(batchProduct(batch), 'default_margin_percent') ??
                  batchProduct(batch)?.margin_rate ??
                  batchProduct(batch)?.margin_percent ??
                  0,
              );

            const batchLocation = (batch: any) =>
              String(
                batch?.stock_location?.name ??
                  batch?.location?.name ??
                  batch?.stock_location_name ??
                  'No location',
              );

            const batchExpiryDate = (batch: any) => String(batch?.expiry_date ?? '');

            const batchRemainingDays = (batch: any) => {
              if (!batch?.expiry_date) {
                return null;
              }

              const today = new Date();
              const expiry = new Date(batch.expiry_date);
              today.setHours(0, 0, 0, 0);
              expiry.setHours(0, 0, 0, 0);

              return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
            };

            const batchStatusText = (batch: any) => {
              const days = batchRemainingDays(batch);

              if (days === null) {
                return 'No expiry date';
              }

              if (days < 0) {
                return 'Expired';
              }

              if (days <= 90) {
                return 'Near expiry';
              }

              return 'Valid';
            };

            const batchRows = batchSource
              .filter((batch: any) => batch && batch.product)
              .sort((a: any, b: any) => {
                const left = a?.expiry_date ? new Date(a.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
                const right = b?.expiry_date ? new Date(b.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
                return left - right;
              });

            const visibleBatchRows = batchRows.slice(0, 15);

            return (
              <section className="inventory-section inventory-section--batch-expiry-register">
                <div className="section-heading">
                  <div>
                    <h3>Batch and Expiry Preview</h3>
                    <span>
                      Stock batch register from Product Inventory, linked back to Product Master identity and pricing.
                    </span>
                  </div>

                  <div className="bulk-action-row register-action-toolbar">
                    <button type="button" onClick={() => markAction('Bulk edit stock batches')}>
                      Bulk edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        exportCsv(
                          'batch-and-expiry-register.csv',
                          [
                            'SN',
                            'Drug Code',
                            'Generic Description',
                            'Designation',
                            'Selling Unit',
                            'Regulatory Price',
                            'Product Margin Rate',
                            'Batch Number',
                            'Location',
                            'Available Qty',
                            'Expiry Date',
                            'Remaining Days',
                            'Batch Status',
                            'Supplier',
                          ],
                          visibleBatchRows.map((batch: any, index: number) => [
                            index + 1,
                            batchProduct(batch)?.sku ?? '',
                            batchProductGeneric(batch),
                            batchProductDesignation(batch),
                            batchSellingUnit(batch),
                            batchRegulatoryPrice(batch),
                            batchProductMargin(batch),
                            batch?.batch_number ?? '',
                            batchLocation(batch),
                            toNumber(batch?.available_quantity ?? batch?.quantity ?? 0),
                            batchExpiryDate(batch),
                            batchRemainingDays(batch) ?? '',
                            batchStatusText(batch),
                            batch?.supplier_name ?? 'Not set',
                          ]),
                        );
                      }}
                    >
                      Export
                    </button>
                  </div>
                </div>

                <div className="low-stock-trigger-note">
                  <strong>Listing rule:</strong>
                  <span>
                    This page lists stock batch records only. Product Master information is shown here only to identify and price the batch.
                  </span>
                </div>

                <div className="inventory-master-table inventory-master-table--rhia-format inventory-master-table--batch-expiry-register">
                  <div className="inventory-master-table__header batch-expiry-register-row">
                    <strong>SN</strong>
                    <strong>Drug Code</strong>
                    <strong>Generic Description</strong>
                    <strong>Designation</strong>
                    <strong>Selling Unit</strong>
                    <strong className="rhia-number-cell">Regulatory Price</strong>
                    <strong className="rhia-number-cell">Product Margin Rate</strong>
                    <strong>Batch Number</strong>
                    <strong>Location</strong>
                    <strong className="rhia-number-cell">Available Qty</strong>
                    <strong>Expiry Date</strong>
                    <strong className="rhia-number-cell">Remaining Days</strong>
                    <strong>Batch Status</strong>
                    <strong>Supplier</strong>
                    <strong>Actions</strong>
                  </div>

                  {visibleBatchRows.length === 0 ? (
                    <div className="batch-expiry-register-row batch-expiry-register-row--empty">
                      <span>
                        No stock batch records found. This page will populate after stock is received into Product Inventory.
                      </span>
                    </div>
                  ) : (
                    visibleBatchRows.map((batch: any, index: number) => {
                      const days = batchRemainingDays(batch);

                      return (
                        <div key={batch?.id ?? `${batch?.batch_number}-${index}`} className="batch-expiry-register-row">
                          <span>{index + 1}</span>
                          <span>{batchProduct(batch)?.sku ?? 'Not set'}</span>
                          <span>{batchProductGeneric(batch)}</span>
                          <span><strong>{batchProductDesignation(batch)}</strong></span>
                          <span>{batchSellingUnit(batch)}</span>
                          <span className="rhia-number-cell">{formatBatchCurrency(batchRegulatoryPrice(batch))}</span>
                          <span className="rhia-number-cell">{formatBatchNumber(batchProductMargin(batch))}%</span>
                          <span>{batch?.batch_number ?? 'Not set'}</span>
                          <span>{batchLocation(batch)}</span>
                          <span className="rhia-number-cell">{formatBatchNumber(batch?.available_quantity ?? batch?.quantity ?? 0)}</span>
                          <span>{batchExpiryDate(batch) || 'No expiry'}</span>
                          <span className="rhia-number-cell">{days === null ? 'N/A' : days}</span>
                          <span>{batchStatusText(batch)}</span>
                          <span>{batch?.supplier_name ?? 'Not set'}</span>
                          <span className="table-action-row">
                            <button type="button" onClick={() => markAction(`View batch ${batch?.batch_number ?? batch?.id ?? ''}`)}>View</button>
                            <button type="button" onClick={() => markAction(`Review batch ${batch?.batch_number ?? batch?.id ?? ''}`)}>Review</button>
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })()}

          {activeInventoryView === 'near-expiry' && nearExpiryBatches && (
            <section className="inventory-section">
              {renderTableToolbar({
                title: 'Near-expiry watchlist',
                subtitle: 'Batches expiring within 180 days, with remaining days and recommended action.',
                selectedCount: selectedBatchIds.length,
                onExport: () =>
                  exportCsv(
                    'near-expiry-watchlist.csv',
                    ['Product', 'SKU', 'Batch', 'Location', 'Available', 'Expiry', 'Remaining days', 'Status', 'Recommended action'],
                    nearExpiryRows.map((batch) => {
                      const days = remainingDays(batch.expiry_date);
                      return [
                        batch.product.name,
                        batch.product.sku,
                        batch.batch_number,
                        batch.stock_location.code,
                        batch.available_quantity,
                        formatDate(batch.expiry_date),
                        days ?? '',
                        expiryStatus(days),
                        expiryAction(days),
                      ];
                    }),
                  ),
                onBulkEdit: () => markAction('Near-expiry bulk edit'),
                onBulkDelete: () => markAction('Near-expiry bulk delete'),
              })}

              <BatchTable
                rows={pagedNearExpiry}
                selectedBatchIds={selectedBatchIds}
                onToggleBatch={toggleBatchSelection}
                onSelectAll={() => selectAllBatches(pagedNearExpiry)}
                onAction={renderBatchActions}
                showRecommendedAction
              />
            </section>
          )}

          {activeInventoryView === 'product-master' && products && (
            <section className="inventory-section">
              {renderTableToolbar({
                title: 'Product Master',
                subtitle: 'Supreme source of product identity, margin, regulatory status and product rules.',
                selectedCount: selectedProductIds.length,
                onExport: () =>
                  exportCsv(
                    'product-master.csv',
                    ['SN', 'Drug Code', 'Generic Description', 'Designation', 'Instructions', 'Selling Unit', 'Regulatory Price', 'Product Margin Rate', 'Category', 'Source', 'Section', 'Subsection', 'Re-order Level', 'Status'],
                    visibleProducts.map((product) => [
                      metadataText(product, ['rhia_sn']),
                      product.sku,
                      product.generic_name ?? '',
                      product.name,
                      metadataText(product, ['rhia_instructions']),
                      metadataText(product, ['rhia_selling_unit'], product.unit),
                      regulatoryPrice(product) ?? '',
                      productMarginRate(product),
                      product.category?.name ?? '',
                      metadataText(product, ['source']),
                      metadataText(product, ['rhia_section'], product.category?.name ?? ''),
                      metadataText(product, ['rhia_subsection']),
                      product.reorder_level,
                      product.status,
                    ]),
                  ),
                onBulkEdit: () => markAction('Product Master bulk edit'),
                onBulkDelete: () => markAction('Product Master bulk delete'),
              })}

              <div className="inventory-action-card-grid inventory-action-card-grid--title-only product-master-action-cards">
                {[
                  ['create', 'Create New Product'],
                  ['edit', 'Edit Product'],
                  ['receive', 'Receive Stock'],
                  ['ai-import', 'AI Import'],
                ].map(([action, label]) => (
                  <button
                    key={action}
                    type="button"
                    className={activeProductMasterAction === action ? 'active' : ''}
                    onClick={() => {
                      setPendingDeleteProduct(null);
                      setViewingProductMasterProduct(null);
                      setActiveProductMasterAction(action as Exclude<ProductMasterAction, null>);
                      if (action === 'create') {
                        setProductMasterForm(emptyProductMasterForm);
                        setSelectedProductMasterEditId('');
                        setProductMasterSearchTerm('');
                      }
                    }}
                  >
                    <strong>{label}</strong>
                  </button>
                ))}
              </div>

              {renderProductMasterActionPanel()}

              <ProductMasterTable
                rows={pagedProducts}
                selectedProductIds={selectedProductIds}
                onToggleProduct={toggleProductSelection}
                onSelectAll={() => selectAllProducts(pagedProducts)}
                onAction={renderProductActions}
                batches={allBatches}
              />
            </section>
          )}

          {activeInventoryView === 'product-inventory' && (
            <section className="inventory-section">
              {renderTableToolbar({
                title: 'Product Inventory',
                subtitle: 'Commercial stock source for POS, purchase order receiving, shelf availability and selling price.',
                selectedCount: selectedBatchIds.length,
                onExport: () =>
                  exportCsv(
                    'product-inventory.csv',
                    ['Product', 'SKU', 'Batch', 'Location', 'Available', 'Unit cost', 'Margin %', 'Selling price', 'Expiry', 'Remaining days', 'Status'],
                    productInventoryRows.map(({ batch, defaultMargin, computedSellingPrice, days }) => [
                      batch.product.name,
                      batch.product.sku,
                      batch.batch_number,
                      batch.stock_location.code,
                      batch.available_quantity,
                      batch.unit_cost ?? '',
                      defaultMargin,
                      computedSellingPrice ?? '',
                      formatDate(batch.expiry_date),
                      days ?? '',
                      `${batch.status} · ${expiryStatus(days)}`,
                    ]),
                  ),
                onBulkEdit: () => markAction('Product Inventory bulk edit'),
                onBulkDelete: () => markAction('Product Inventory bulk delete'),
              })}

              <section className="inventory-create-from-master-panel">
                <div className="section-heading">
                  <div>
                    <h3>Create inventory from Product Master</h3>
                    <span>Product identity comes from Product Master. Inventory adds batch, location, quantity, cost, margin and selling price.</span>
                  </div>
                </div>

                <form className="inventory-creation-grid" onSubmit={handleCreateInventoryFromProductMaster}>
                  <label>
                    Product Master item
                    <input
                      list="product-master-inventory-options"
                      value={inventoryCreateForm.product_id}
                      onChange={(event) => {
                        const productId = event.target.value;
                        const product = allProducts.find((item) => String(item.id) === productId);
                        const defaultMargin = metadataNumber(product?.metadata, ['default_margin_percent', 'margin_percent', 'allowed_margin'], 0);

                        setInventoryCreateForm((current) => ({
                          ...current,
                          product_id: productId,
                          margin_percent: String(defaultMargin),
                        }));
                      }}
                      placeholder="Type or select product ID"
                      required
                    />
                    <datalist id="product-master-inventory-options">
                      {allProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · {product.sku} · {product.generic_name ?? product.category?.name ?? 'RHIA Product Master'}
                        </option>
                      ))}
                    </datalist>
                  </label>

                  <label>
                    Stock location
                    <select
                      value={inventoryCreateForm.stock_location_id}
                      onChange={(event) => setInventoryCreateForm({ ...inventoryCreateForm, stock_location_id: event.target.value })}
                      required
                    >
                      <option value="">Select location</option>
                      {(locations?.locations ?? []).map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name} ({location.code})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Batch number
                    <input
                      value={inventoryCreateForm.batch_number}
                      onChange={(event) => setInventoryCreateForm({ ...inventoryCreateForm, batch_number: event.target.value })}
                      placeholder="e.g. RHIA-2026-001"
                      required
                    />
                  </label>

                  <label>
                    Quantity received
                    <input
                      type="number"
                      min="1"
                      value={inventoryCreateForm.quantity}
                      onChange={(event) => setInventoryCreateForm({ ...inventoryCreateForm, quantity: event.target.value })}
                      required
                    />
                  </label>

                  <label>
                    Expiry date
                    <input
                      type="date"
                      value={inventoryCreateForm.expiry_date}
                      onChange={(event) => setInventoryCreateForm({ ...inventoryCreateForm, expiry_date: event.target.value })}
                    />
                  </label>

                  <label>
                    Unit cost
                    <input
                      type="number"
                      min="0"
                      value={inventoryCreateForm.unit_cost}
                      onChange={(event) => setInventoryCreateForm({ ...inventoryCreateForm, unit_cost: event.target.value })}
                      placeholder="Supplier cost"
                    />
                  </label>

                  <label>
                    Margin %
                    <input
                      type="number"
                      min="0"
                      value={inventoryCreateForm.margin_percent}
                      onChange={(event) => setInventoryCreateForm({ ...inventoryCreateForm, margin_percent: event.target.value })}
                      placeholder="Product Master margin"
                    />
                  </label>

                  <label>
                    Selling price
                    <input
                      type="number"
                      min="0"
                      value={inventoryCreateForm.selling_price}
                      onChange={(event) => setInventoryCreateForm({ ...inventoryCreateForm, selling_price: event.target.value })}
                      placeholder={inventoryCalculatedSellingPrice ? String(inventoryCalculatedSellingPrice) : 'Calculated after cost + margin'}
                    />
                  </label>

                  <label>
                    Supplier
                    <input
                      value={inventoryCreateForm.supplier_name}
                      onChange={(event) => setInventoryCreateForm({ ...inventoryCreateForm, supplier_name: event.target.value })}
                      placeholder="Supplier name"
                    />
                  </label>

                  <label>
                    Reference / PO code
                    <input
                      value={inventoryCreateForm.reference_number}
                      onChange={(event) => setInventoryCreateForm({ ...inventoryCreateForm, reference_number: event.target.value })}
                      placeholder="PO or delivery note"
                    />
                  </label>

                  <div className="inventory-create-summary">
                    <strong>{selectedInventoryProduct?.name ?? 'No product selected'}</strong>
                    <span>Default margin: {formatNumber(selectedInventoryDefaultMargin)}%</span>
                    <span>Calculated price: {formatRwf(inventoryCalculatedSellingPrice || null)}</span>
                    <small>Purchase Orders must also select products from Product Master. If missing, create or approve the product first.</small>
                  </div>

                  <div className="inventory-form-actions">
                    <button type="submit" disabled={isCreatingInventory || allProducts.length === 0 || (locations?.locations ?? []).length === 0}>
                      {isCreatingInventory ? 'Creating inventory…' : 'Create inventory'}
                    </button>
                    <button type="button" onClick={() => setInventoryCreateForm(emptyInventoryCreateForm)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </section>

              <section className="inventory-ai-opportunity-panel">
                <div className="section-heading">
                  <div>
                    <h3>AI inventory opportunity model</h3>
                    <span>Uses Product Master against Current Inventory, market dynamics, reimbursement opportunity and stock movement.</span>
                  </div>
                </div>

                <div className="inventory-opportunity-grid">
                  {[
                    'Missing reimbursable products',
                    'Stock-out opportunity',
                    'Market dynamics',
                    'Margin and pricing opportunity',
                    'Near-expiry pressure',
                    'Purchase planning',
                  ].map((title) => (
                    <article key={title}>
                      <strong>{title}</strong>
                    </article>
                  ))}
                </div>
              </section>

              <div className="inventory-master-table inventory-master-table--wide">
                <div className="inventory-master-table__header">
                  <strong><input type="checkbox" onChange={() => selectAllBatches(pagedProductInventory.map((row) => row.batch))} /></strong>
                  <strong>Product</strong>
                  <strong>Batch</strong>
                  <strong>Location</strong>
                  <strong>Available</strong>
                  <strong>Cost</strong>
                  <strong>Margin</strong>
                  <strong>Selling price</strong>
                  <strong>Expiry</strong>
                  <strong>Actions</strong>
                </div>

                {pagedProductInventory.length === 0 ? (
                  <div><span>No commercial inventory batches found.</span></div>
                ) : (
                  pagedProductInventory.map(({ batch, defaultMargin, computedSellingPrice, days }) => (
                    <div key={batch.id}>
                      <span><input type="checkbox" checked={selectedBatchIds.includes(batch.id)} onChange={() => toggleBatchSelection(batch.id)} /></span>
                      <span>
                        <strong>{batch.product.name}</strong>
                        <small>{batch.product.sku} · Regulatory Price {formatRwf(regulatoryPrice(batch.product))}</small>
                      </span>
                      <span>{batch.batch_number}</span>
                      <span>{batch.stock_location.name}</span>
                      <span>{formatNumber(batch.available_quantity)}</span>
                      <span>{formatRwf(batch.unit_cost)}</span>
                      <span>{formatNumber(defaultMargin)}%</span>
                      <span>{formatRwf(computedSellingPrice)}</span>
                      <span>{formatDate(batch.expiry_date)} · {days === null ? 'N/A' : `${days} days`}</span>
                      <span>{renderBatchActions(batch)}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {activeInventoryView === 'locations' && locations && (
            <section className="inventory-section">
              {renderTableToolbar({
                title: 'Stock locations',
                subtitle: 'Branch-scoped stock storage points, shelves and stores.',
                selectedCount: 0,
                onExport: () =>
                  exportCsv(
                    'stock-locations.csv',
                    ['Location', 'Code', 'Type', 'Branch', 'Batches', 'Status'],
                    locations.locations.map((location) => [
                      location.name,
                      location.code,
                      location.location_type,
                      location.branch?.name ?? '',
                      location.stock_batches_count,
                      location.status,
                    ]),
                  ),
                onBulkEdit: () => markAction('Stock location bulk edit'),
                onBulkDelete: () => markAction('Stock location bulk delete'),
              })}

              <div className="inventory-table location-preview-table">
                {locations.locations.map((location) => (
                  <div key={location.id}>
                    <strong>{location.name}</strong>
                    <span>{location.code}</span>
                    <span>{location.location_type.replaceAll('_', ' ')}</span>
                    <small>{location.stock_batches_count} batches</small>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>

      {detailPanel && (
        <aside className="inventory-detail-drawer">
          <div className="section-heading">
            <div>
              <h3>{detailPanel.title}</h3>
              <span>Selected product/batch details</span>
            </div>
            <button type="button" onClick={() => setDetailPanel(null)}>Close</button>
          </div>

          <dl>
            {detailPanel.fields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      )}
    </article>
  );
}

function ProductMasterTable({
  rows,
  selectedProductIds,
  onToggleProduct,
  onSelectAll,
  onAction,
  batches,
}: {
  rows: PharmaProduct[];
  selectedProductIds: number[];
  onToggleProduct: (id: number) => void;
  onSelectAll: () => void;
  onAction: (product: PharmaProduct, nearestBatch?: PharmaStockBatch | null) => React.ReactNode;
  batches: PharmaStockBatch[];
}) {
  return (
    <div className="inventory-master-table inventory-master-table--wide inventory-master-table--rhia-format">
      <div className="inventory-master-table__header rhia-product-master-row">
        <strong>SN</strong>
        <strong>Drug Code</strong>
        <strong>Generic Description</strong>
        <strong>Designation</strong>
        <strong>Instructions</strong>
        <strong>Selling Unit</strong>
        <strong className="rhia-number-cell">Regulatory Price</strong>
        <strong className="rhia-number-cell">Product Margin Rate</strong>
        <strong>Category</strong>
        <strong>Source</strong>
        <strong>Section</strong>
        <strong>Subsection</strong>
        <strong className="rhia-number-cell">Re-order Level</strong>
        <strong>Status</strong>
        <strong>Actions</strong>
      </div>

      {rows.length === 0 ? (
        <div className="rhia-product-master-row">
          <span>No products found.</span>
        </div>
      ) : (
        rows.map((product, index) => {
          const nearestBatch = nearestBatchForProduct(product.id, batches);

          return (
            <div key={product.id} className="rhia-product-master-row">
              <span>{index + 1}</span>
              <span>{product.sku}</span>
              <span>{product.generic_name ?? 'Not set'}</span>
              <span><strong>{product.name}</strong></span>
              <span>{metadataText(product, ['rhia_instructions'], 'Not set')}</span>
              <span>{metadataText(product, ['rhia_selling_unit'], product.unit)}</span>
              <span className="rhia-number-cell">{formatRwf(regulatoryPrice(product))}</span>
              <span className="rhia-number-cell">{formatNumber(productMarginRate(product))}%</span>
              <span>{product.category?.name ?? 'Uncategorised'}</span>
              <span>{metadataText(product, ['source'], 'Product Master')}</span>
              <span>{metadataText(product, ['rhia_section'], product.category?.name ?? 'Uncategorised')}</span>
              <span>{metadataText(product, ['rhia_subsection'], 'Not set')}</span>
              <span className="rhia-number-cell">{formatNumber(product.reorder_level)}</span>
              <span>{product.status}</span>
              <span>{onAction(product, nearestBatch)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

function BatchTable({
  rows,
  selectedBatchIds,
  onToggleBatch,
  onSelectAll,
  onAction,
  showRecommendedAction = false,
}: {
  rows: PharmaStockBatch[];
  selectedBatchIds: number[];
  onToggleBatch: (id: number) => void;
  onSelectAll: () => void;
  onAction: (batch: PharmaStockBatch) => React.ReactNode;
  showRecommendedAction?: boolean;
}) {
  return (
    <div className="inventory-master-table inventory-master-table--wide">
      <div className="inventory-master-table__header">
        <strong><input type="checkbox" onChange={onSelectAll} /></strong>
        <strong>Product</strong>
        <strong>Batch</strong>
        <strong>Location</strong>
        <strong>Available</strong>
        <strong>Expiry</strong>
        <strong>Remaining days</strong>
        <strong>Supplier</strong>
        {showRecommendedAction && <strong>Recommended action</strong>}
        <strong>Actions</strong>
      </div>

      {rows.length === 0 ? (
        <div><span>No batch records found.</span></div>
      ) : (
        rows.map((batch) => {
          const days = remainingDays(batch.expiry_date);

          return (
            <div key={batch.id}>
              <span><input type="checkbox" checked={selectedBatchIds.includes(batch.id)} onChange={() => onToggleBatch(batch.id)} /></span>
              <span><strong>{batch.product.name}</strong><small>{batch.product.sku}</small></span>
              <span>{batch.batch_number}</span>
              <span>{batch.stock_location.name} ({batch.stock_location.code})</span>
              <span>{formatNumber(batch.available_quantity)}</span>
              <span>{formatDate(batch.expiry_date)}</span>
              <span>{days === null ? 'N/A' : days}</span>
              <span>{batch.supplier_name ?? 'Not set'} · {expiryStatus(days)}</span>
              {showRecommendedAction && <span>{expiryAction(days)}</span>}
              <span>{onAction(batch)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

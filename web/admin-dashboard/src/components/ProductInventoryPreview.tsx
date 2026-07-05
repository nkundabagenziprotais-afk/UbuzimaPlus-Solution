import { type FormEvent, useEffect, useEffect, useMemo, useState } from 'react';
import {
  AccessProfile,
  PharmaInventoryBatchesResponse,
  PharmaInventoryLocationsResponse,
  PharmaInventorySummaryResponse,
  PharmaProduct,
  PharmaProductsResponse,
  PharmaStockBatch,
  PharmaStockLocation,
  getPharmaInventoryBatches,
  getPharmaInventoryLocations,
  createPharmaStockLocation,
  updatePharmaStockLocation,
  deletePharmaStockLocation,
  createPharmaProduct,
  deletePharmaProduct,
  getPharmaInventorySummary,
  getPharmaProducts,
  updatePharmaProduct,
  receivePharmaStock,
  updatePharmaStockBatch,
  deletePharmaStockBatch,
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

type ProductMasterAction = 'view' | 'create' | 'edit' | 'replicate' | 'receive' | 'ai-import' | null;
type ProductMasterAiMode = 'create' | 'edit' | 'view' | 'delete';

type StockLocationAction = 'create' | 'edit' | 'replace' | null;

type StockLocationFormState = {
  branch_id: string;
  name: string;
  code: string;
  location_type: string;
  status: 'active' | 'inactive';
};

const emptyStockLocationForm: StockLocationFormState = {
  branch_id: '',
  name: '',
  code: '',
  location_type: 'store',
  status: 'active',
};

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

export 
type InventoryTableKey =
  | 'low-stock'
  | 'batch-expiry'
  | 'near-expiry'
  | 'product-register'
  | 'product-master'
  | 'stock-locations';

type InventoryTableStyle = 'clean' | 'striped' | 'bordered';
type InventoryTableDensity = 'compact' | 'comfortable' | 'tall';
type InventoryColumnWidthPreset = 'compact' | 'balanced' | 'wide';

type InventoryTableSettings = {
  style: InventoryTableStyle;
  density: InventoryTableDensity;
  fontSize: number;
  widthPreset: InventoryColumnWidthPreset;
  wrapText: boolean;
  stickyHeader: boolean;
  stickyActions: boolean;
};

const INVENTORY_TABLE_SETTINGS_STORAGE_KEY = 'ubuzima.inventory.table-management.v1';
const EXPIRY_LABEL_RULES_STORAGE_KEY = 'ubuzima.inventory.expiry-label-rules.v1';

const defaultInventoryTableSettings: InventoryTableSettings = {
  style: 'clean',
  density: 'comfortable',
  fontSize: 14,
  widthPreset: 'balanced',
  wrapText: true,
  stickyHeader: true,
  stickyActions: false,
};


let runtimeExpiryLabelRules: any[] = [];

function managedRuleValue(rule: any, keys: string[], fallback: any = undefined) {
  for (const key of keys) {
    if (rule && rule[key] !== undefined && rule[key] !== null && rule[key] !== '') {
      return rule[key];
    }
  }

  return fallback;
}

function managedExpiryRuleFromDays(days: number | null) {
  const rules = Array.isArray(runtimeExpiryLabelRules) ? runtimeExpiryLabelRules : [];

  if (days === null || Number.isNaN(Number(days))) {
    return {
      key: 'safe',
      label: 'No expiry date',
      backgroundColor: '#e0f2fe',
      fontColor: '#075985',
      action: 'Confirm expiry date before dispensing or transfer.',
    };
  }

  if (Number(days) < 0) {
    const expiredRule = rules.find((rule) => {
      const key = String(managedRuleValue(rule, ['key', 'status', 'name'], '')).toLowerCase();
      const label = String(managedRuleValue(rule, ['label', 'title'], '')).toLowerCase();
      return key.includes('expired') || label.includes('expired');
    });

    return expiredRule ?? {
      key: 'expired',
      label: 'Expired',
      backgroundColor: '#7f1d1d',
      fontColor: '#ffffff',
      action: 'Block sale, isolate stock, and start disposal or supplier-return workflow.',
    };
  }

  const sortedRules = rules
    .map((rule) => {
      const threshold = Number(
        managedRuleValue(rule, ['maxDays', 'daysToExpiry', 'days_to_expiry', 'toDays', 'to_days', 'threshold'], 999999),
      );

      return {
        rule,
        threshold: Number.isFinite(threshold) ? threshold : 999999,
      };
    })
    .sort((a, b) => a.threshold - b.threshold);

  const matched = sortedRules.find(({ threshold }) => Number(days) <= threshold)?.rule;

  return matched ?? {
    key: 'safe',
    label: 'Good shelf life',
    backgroundColor: '#dcfce7',
    fontColor: '#166534',
    action: 'Keep under normal FEFO monitoring.',
  };
}

function managedExpiryRiskKeyFromDays(days: number | null) {
  const rule = managedExpiryRuleFromDays(days);
  return String(managedRuleValue(rule, ['key', 'status', 'name'], 'safe'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'safe';
}

function managedExpiryRiskLabel(days: number | null) {
  const rule = managedExpiryRuleFromDays(days);
  return String(managedRuleValue(rule, ['label', 'title', 'name'], 'Good shelf life'));
}

function managedExpiryAiRecommendation(days: number | null) {
  const rule = managedExpiryRuleFromDays(days);

  return String(
    managedRuleValue(
      rule,
      ['action', 'recommendation', 'aiRecommendation', 'recommendedAction'],
      Number(days) < 0
        ? 'Block sale, isolate stock, and start disposal or supplier-return workflow.'
        : 'Use FEFO and continue normal monitoring.',
    ),
  );
}

function managedExpiryRiskClass(days: number | null) {
  const key = managedExpiryRiskKeyFromDays(days);

  if (key.includes('expired')) {
    return 'expiry-row--expired';
  }

  if (key.includes('critical') || key.includes('danger')) {
    return 'expiry-row--critical';
  }

  if (key.includes('warning') || key.includes('soon')) {
    return 'expiry-row--warning';
  }

  return 'expiry-row--watch';
}

function managedExpiryLabelStyle(days: number | null) {
  const rule = managedExpiryRuleFromDays(days);

  return {
    backgroundColor: String(managedRuleValue(rule, ['backgroundColor', 'background_color', 'bgColor', 'bg_color'], '#e0f2fe')),
    color: String(managedRuleValue(rule, ['fontColor', 'font_color', 'textColor', 'text_color', 'color'], '#075985')),
  };
}

export function ProductInventoryPreview({
  token,
  profile,
  activeView,
  onActiveViewChange,
  showInternalNavigation = true,
}: ProductInventoryPreviewProps) {
  const [summary, setSummary] = useState<PharmaInventorySummaryResponse | null>(null);

  const summaryPayload = (summary?.summary ?? {}) as Record<string, unknown>;
  const inventorySummary = {
    products_count: Number(summaryPayload.products_count ?? 0),
    product_categories_count: Number(summaryPayload.product_categories_count ?? 0),
    active_products_count: Number(summaryPayload.active_products_count ?? 0),
    stock_locations_count: Number(summaryPayload.stock_locations_count ?? 0),
    stock_batches_count: Number(summaryPayload.stock_batches_count ?? 0),
    total_quantity_on_hand: Number(summaryPayload.total_quantity_on_hand ?? 0),
    estimated_stock_value: Number(summaryPayload.estimated_stock_value ?? 0),
    low_stock_products_count: Number(summaryPayload.low_stock_products_count ?? 0),
    near_expiry_batches_180_days_count: Number(summaryPayload.near_expiry_batches_180_days_count ?? 0),
    low_stock_count: Number(summaryPayload.low_stock_count ?? 0),
    near_expiry_count: Number(summaryPayload.near_expiry_count ?? 0),
    total_stock_value: Number(summaryPayload.total_stock_value ?? 0),
    inventory_value: Number(summaryPayload.inventory_value ?? 0),
    batches_count: Number(summaryPayload.batches_count ?? 0),
  };
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
  const [inventoryReceiveSource, setInventoryReceiveSource] = useState<'purchase-code' | 'manual'>('manual');
  const [inventoryProductSearchTerm, setInventoryProductSearchTerm] = useState('');
  const [inventoryProductOptions, setInventoryProductOptions] = useState<PharmaProduct[]>([]);
  const [isInventoryProductSearchOpen, setIsInventoryProductSearchOpen] = useState(false);
  const [isSearchingInventoryProducts, setIsSearchingInventoryProducts] = useState(false);

  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [editingInventoryBatch, setEditingInventoryBatch] = useState<PharmaStockBatch | null>(null);
  const [isInventoryReceiveFlowOpen, setIsInventoryReceiveFlowOpen] = useState(false);
  const [expiryViewFilter, setExpiryViewFilter] = useState('all');
  const [isExpiryLabelManagerOpen, setIsExpiryLabelManagerOpen] = useState(false);
  const [expiryLabelRules, setExpiryLabelRules] = useState({
    expired: { label: 'Expired', maxDays: -1, background: '#7f1d1d', text: '#ffffff' },
    critical: { label: 'Critical', maxDays: 30, background: '#fee2e2', text: '#7f1d1d' },
    warning: { label: 'Warning', maxDays: 90, background: '#ffedd5', text: '#9a3412' },
    watch: { label: 'Watch', maxDays: 180, background: '#fef3c7', text: '#92400e' },
    valid: { label: 'Healthy', maxDays: 181, background: '#ecfdf5', text: '#065f46' },
    noDate: { label: 'No date', maxDays: 0, background: '#f1f5f9', text: '#334155' },
  });

  runtimeExpiryLabelRules = expiryLabelRules;


  const [tableSettingsByKey, setTableSettingsByKey] = useState<Record<string, InventoryTableSettings>>({});

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedTableSettings = window.localStorage.getItem(INVENTORY_TABLE_SETTINGS_STORAGE_KEY);

    if (savedTableSettings) {
      try {
        const parsed = JSON.parse(savedTableSettings);

        if (parsed && typeof parsed === 'object') {
          setTableSettingsByKey(parsed);
        }
      } catch {
        window.localStorage.removeItem(INVENTORY_TABLE_SETTINGS_STORAGE_KEY);
      }
    }

    const savedExpiryLabelRules = window.localStorage.getItem(EXPIRY_LABEL_RULES_STORAGE_KEY);

    if (savedExpiryLabelRules) {
      try {
        const parsedRules = JSON.parse(savedExpiryLabelRules);

        if (Array.isArray(parsedRules) && parsedRules.length > 0) {
          setExpiryLabelRules(parsedRules);
        }
      } catch {
        window.localStorage.removeItem(EXPIRY_LABEL_RULES_STORAGE_KEY);
      }
    }
  }, []);

  const [viewingInventoryBatch, setViewingInventoryBatch] = useState<PharmaStockBatch | null>(null);
  const [pendingDeleteInventoryBatch, setPendingDeleteInventoryBatch] = useState<PharmaStockBatch | null>(null);
  const [activeStockLocationAction, setActiveStockLocationAction] = useState<StockLocationAction>(null);
  const [stockLocationForm, setStockLocationForm] = useState<StockLocationFormState>(emptyStockLocationForm);
  const [selectedStockLocationEditId, setSelectedStockLocationEditId] = useState('');
  const [viewingStockLocation, setViewingStockLocation] = useState<PharmaStockLocation | null>(null);
  const [pendingDeleteStockLocation, setPendingDeleteStockLocation] = useState<PharmaStockLocation | null>(null);
  const [isSavingStockLocation, setIsSavingStockLocation] = useState(false);
  const [activeInventoryOpportunity, setActiveInventoryOpportunity] = useState<string>('Stock-out opportunity');
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

    (Array.isArray(products?.products) ? products.products : []).forEach((product) => {
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

  const stockLocationBranchOptions = useMemo(() => {
    const branchMap = new Map<number, { id: number; name: string; code: string }>();

    profile.tenant_assignments?.forEach((assignment) => {
      if (assignment.branch) {
        branchMap.set(assignment.branch.id, {
          id: assignment.branch.id,
          name: assignment.branch.name,
          code: assignment.branch.code,
        });
      }
    });

    (locations?.locations ?? []).forEach((location) => {
      if (location.branch) {
        branchMap.set(location.branch.id, {
          id: location.branch.id,
          name: location.branch.name,
          code: location.branch.code,
        });
      }
    });

    return Array.from(branchMap.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [locations, profile.tenant_assignments]);

  const filteredStockLocations = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return (locations?.locations ?? [])
      .filter((location) => {
        if (!keyword) return true;

        return [
          location.name,
          location.code,
          location.location_type,
          location.status,
          location.branch?.name,
          location.branch?.code,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword));
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [locations, searchTerm]);

  const allBatches = batches?.batches ?? [];
  const inventoryProductLookupOptions = useMemo(() => {
    const merged = new Map<number, PharmaProduct>();

    [...allProducts, ...inventoryProductOptions].forEach((product) => {
      merged.set(product.id, product);
    });

    return Array.from(merged.values()).sort((left, right) =>
      `${left.name} ${left.sku}`.localeCompare(`${right.name} ${right.sku}`),
    );
  }, [allProducts, inventoryProductOptions]);

  const selectedInventoryProduct =
    inventoryProductLookupOptions.find((product) => String(product.id) === inventoryCreateForm.product_id) ?? null;
  const filteredInventoryProductOptions = useMemo(() => {
    const keyword = inventoryProductSearchTerm.trim().toLowerCase();

    if (!keyword) {
      return inventoryProductLookupOptions.slice(0, 30);
    }

    return inventoryProductLookupOptions
      .filter((product) =>
        [
          product.name,
          product.generic_name,
          product.brand_name,
          product.sku,
          product.barcode,
          product.category?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword)),
      )
      .slice(0, 30);
  }, [inventoryProductLookupOptions, inventoryProductSearchTerm]);


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
  const pagedStockLocations = filteredStockLocations.slice(0, rowLimitValue(rowLimit, filteredStockLocations.length));


  function productInventoryProductLabel(product: PharmaProduct) {
    return `${product.name} • ${product.generic_name ?? 'Generic not set'} • ${product.sku}`;
  }

  async function loadInventoryProductMasterOptions(searchValue = inventoryProductSearchTerm) {
    if (!tenantSlug) {
      return;
    }

    setIsSearchingInventoryProducts(true);

    try {
      const response = await getPharmaProducts(token, tenantSlug, {
        page: 1,
        perPage: 30,
        search: searchValue,
        status: 'active',
      });

      setInventoryProductOptions(response.products);

      if (!searchValue.trim() && response.products.length > 0) {
        setIsInventoryProductSearchOpen(true);
      }
    } catch (err) {
      setInventoryNotice(err instanceof Error ? err.message : 'Unable to search Product Master products.');
    } finally {
      setIsSearchingInventoryProducts(false);
    }
  }

  function selectInventoryProductFromMaster(product: PharmaProduct) {
    const defaultMargin = metadataNumber(product, ['margin_percent', 'product_margin_rate', 'margin'], 0);
    const regulatorySellingPrice = regulatoryPrice(product);

    setInventoryCreateForm((current) => ({
      ...current,
      product_id: String(product.id),
      margin_percent: current.margin_percent || (defaultMargin > 0 ? String(defaultMargin) : ''),
      selling_price: current.selling_price || (regulatorySellingPrice > 0 ? String(regulatorySellingPrice) : ''),
    }));

    // Clear the search box, close dropdown, but keep selected product available for the selected card.
    setInventoryProductSearchTerm('');
    setInventoryProductOptions([product]);
    setIsInventoryProductSearchOpen(false);
    setInventoryNotice(`${product.name} selected from Product Master. Complete inventory quantity, batch, location and pricing.`);
  }

  function handleInventoryProductSearchChange(value: string) {
    setInventoryProductSearchTerm(value);

    if (!value.trim()) {
      setInventoryProductOptions([]);
      setIsInventoryProductSearchOpen(false);
      setInventoryCreateForm((current) => ({
        ...current,
        product_id: '',
      }));
      return;
    }

    setIsInventoryProductSearchOpen(true);

    const matchedProduct = inventoryProductLookupOptions.find((product) => productInventoryProductLabel(product) === value);

    if (matchedProduct) {
      selectInventoryProductFromMaster(matchedProduct);
      return;
    }

    setInventoryCreateForm((current) => ({
      ...current,
      product_id: '',
    }));
  }

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

  const productMasterInitialLoadLimit = 150;
  const inventoryBatchInitialLoadLimit = 150;

  const inventoryCacheVersion = 'inventory-active-page-v3';

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

      if (parsed.version !== inventoryCacheVersion) {
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
          version: inventoryCacheVersion,
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
            () => getPharmaInventoryBatches(token, tenantSlug, undefined, { perPage: inventoryBatchInitialLoadLimit }),
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
          () => getPharmaProducts(token, tenantSlug, { perPage: productMasterInitialLoadLimit }),
          false,
        );

        return;
      }

      if (viewToLoad === 'product-master' || viewToLoad === 'shelf') {
        await loadInventoryResource(
          'products',
          setProducts,
          () => getPharmaProducts(token, tenantSlug, { perPage: productMasterInitialLoadLimit }),
          force,
        );
        return;
      }

      if (viewToLoad === 'low-stock') {
        await loadInventoryResource(
          'products',
          setProducts,
          () => getPharmaProducts(token, tenantSlug, { perPage: productMasterInitialLoadLimit }),
          force,
        );

        void loadInventoryResource(
          'batches',
          setBatches,
          () => getPharmaInventoryBatches(token, tenantSlug, undefined, { perPage: inventoryBatchInitialLoadLimit }),
          false,
        );

        return;
      }

      if (viewToLoad === 'batches') {
        await loadInventoryResource(
          'batches',
          setBatches,
          () => getPharmaInventoryBatches(token, tenantSlug, undefined, { perPage: inventoryBatchInitialLoadLimit }),
          force,
        );
        return;
      }

      if (viewToLoad === 'near-expiry') {
        await loadInventoryResource(
          'near-expiry-batches',
          setNearExpiryBatches,
          () => getPharmaInventoryBatches(token, tenantSlug, 180, { perPage: inventoryBatchInitialLoadLimit }),
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
          () => getPharmaProducts(token, tenantSlug, { perPage: productMasterInitialLoadLimit }),
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
          () => getPharmaInventoryBatches(token, tenantSlug, undefined, { perPage: inventoryBatchInitialLoadLimit }),
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
    if (!tenantSlug) {
      return;
    }

    // Controlled active inventory page loading contract:
    // load only the active page resources, not the whole inventory module at once.
    // This keeps Product Master/Product Inventory from looking broken while avoiding
    // the previous heavy auto-load that affected performance.
    void loadInventoryPreview(activeInventoryView, true);
  }, [activeInventoryView, tenantSlug]);

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
          value: formatNumber(inventorySummary.products_count),
          status: 'Product Master',
          target: 'product-master' as InventoryView,
          trendSeed: inventorySummary.products_count,
        },
        categories: {
          value: formatNumber(inventorySummary.product_categories_count),
          status: 'Product setup',
          target: 'product-master' as InventoryView,
          trendSeed: inventorySummary.product_categories_count,
        },
        locations: {
          value: formatNumber(inventorySummary.stock_locations_count),
          status: 'Storage points',
          target: 'locations' as InventoryView,
          trendSeed: inventorySummary.stock_locations_count,
        },
        batches: {
          value: formatNumber(inventorySummary.stock_batches_count),
          status: 'FEFO register',
          target: 'batches' as InventoryView,
          trendSeed: inventorySummary.stock_batches_count,
        },
        'stock-units': {
          value: formatNumber(inventorySummary.total_quantity_on_hand),
          status: 'Product Inventory',
          target: 'product-inventory' as InventoryView,
          trendSeed: inventorySummary.total_quantity_on_hand,
        },
        'stock-value': {
          value: formatRwf(inventorySummary.estimated_stock_value),
          status: 'Estimated value',
          target: 'product-inventory' as InventoryView,
          trendSeed: inventorySummary.estimated_stock_value,
        },
        'low-stock': {
          value: formatNumber(inventorySummary.low_stock_products_count),
          status: 'Needs reorder',
          target: 'low-stock' as InventoryView,
          trendSeed: inventorySummary.low_stock_products_count,
        },
        'near-expiry': {
          value: formatNumber(inventorySummary.near_expiry_batches_180_days_count),
          status: 'Expiry risk',
          target: 'near-expiry' as InventoryView,
          trendSeed: inventorySummary.near_expiry_batches_180_days_count,
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

    if (isCreatingInventory) {
      return;
    }

    if (!inventoryCreateForm.product_id) {
      setInventoryNotice('Select a Product Master item before receiving inventory.');
      return;
    }

    if (inventoryReceiveSource === 'purchase-code' && !(inventoryCreateForm.reference_number ?? '').trim()) {
      setInventoryNotice('Enter the purchase code or purchase order reference before receiving stock.');
      return;
    }

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

      if (editingInventoryBatch) {
        const response = await updatePharmaStockBatch(token, tenantSlug, editingInventoryBatch.id, {
          product_id: Number(inventoryCreateForm.product_id),
          stock_location_id: Number(inventoryCreateForm.stock_location_id),
          batch_number: inventoryCreateForm.batch_number,
          quantity: Number(inventoryCreateForm.quantity || 0),
          expiry_date: inventoryCreateForm.expiry_date || null,
          unit_cost: inventoryCreateForm.unit_cost ? Number(inventoryCreateForm.unit_cost) : null,
          selling_price: sellingPrice > 0 ? sellingPrice : null,
          supplier_name: inventoryCreateForm.supplier_name || null,
          reference_number: inventoryCreateForm.reference_number || null,
        });

        setInventoryNotice(`${response.message} Batch ${response.batch.batch_number} updated successfully.`);
        setEditingInventoryBatch(null);
      } else {
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
      }

      setInventoryCreateForm(emptyInventoryCreateForm);
      setInventoryProductSearchTerm('');
      setInventoryProductOptions([]);
      setIsInventoryProductSearchOpen(false);
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

  function openProductMasterReplicateFromProduct(product: PharmaProduct) {
    const baseSku = product.sku || `PRODUCT-${product.id}`;
    let candidateSku = `${baseSku}-COPY`;
    let copyIndex = 2;

    while (allProducts.some((item) => item.sku.toLowerCase() === candidateSku.toLowerCase())) {
      candidateSku = `${baseSku}-COPY-${copyIndex}`;
      copyIndex += 1;
    }

    setPendingDeleteProduct(null);
    setViewingProductMasterProduct(null);
    setSelectedProductMasterEditId(null);
    setActiveProductMasterAction('replicate');
    setProductMasterSearchTerm('');

    setProductMasterForm({
      ...productToMasterForm(product),
      drug_code: candidateSku,
      designation: `${product.name} Copy`,
      source: 'Replicated from Product Master',
      status: 'active',
    });

    setInventoryNotice(`${product.sku} copied into a new Product Master form. Review the copied fields, then save as a new product.`);
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
            <button type="button" onClick={() => openProductMasterReplicateFromProduct(viewingProductMasterProduct)}>Replicate Product</button>
            <button type="button" className="danger" onClick={() => requestDeleteProductMaster(viewingProductMasterProduct)}>Delete Product</button>
          </div>
        </section>
      );
    }

    if (!activeProductMasterAction) return null;

    if (activeProductMasterAction === 'create' || activeProductMasterAction === 'replicate') {
      return (
        <section className="product-master-action-panel">
          <div className="section-heading">
            <div>
              <h3>{activeProductMasterAction === 'replicate' ? 'Replicate Product' : 'Create New Product'}</h3>
              <span>{activeProductMasterAction === 'replicate' ? 'Copied Product Master fields. Review unique fields before saving.' : 'Fields start from the Product Master table structure.'}</span>
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
                  required/>
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

  function startSimpleMightyInventoryFlow(
    flow:
      | 'product-master-create'
      | 'product-master-review'
      | 'product-master-replicate'
      | 'receive-stock'
      | 'low-stock'
      | 'near-expiry'
      | 'ai-import',
  ) {
    setError('');
    setInventoryNotice('');

    if (flow === 'product-master-create') {
      selectInventoryView('product-master');
      setPendingDeleteProduct(null);
      setViewingProductMasterProduct(null);
      setActiveProductMasterAction('create');
      setInventoryNotice('Create Product Master flow opened. Complete only the required fields, then review before saving.');
      return;
    }

    if (flow === 'product-master-review') {
      selectInventoryView('product-master');
      setActiveProductMasterAction(null);
      setInventoryNotice('Product Master opened. Use the table actions when you need to view, edit, replicate, or delete a product.');
      return;
    }

    if (flow === 'product-master-replicate') {
      selectInventoryView('product-master');
      setActiveProductMasterAction(null);
      setInventoryNotice('Choose a Product Master row, then click Replicate. The copied form will open only after selecting the product.');
      return;
    }

    if (flow === 'receive-stock') {
      selectInventoryView('product-inventory');
      setIsInventoryReceiveFlowOpen(true);
      setActiveProductMasterAction(null);
      setInventoryNotice('Receive Stock flow opened. Select a Product Master item, then complete batch, location, quantity, cost, and selling price.');
      return;
    }

    if (flow === 'low-stock') {
      selectInventoryView('low-stock');
      setInventoryNotice('Low Stock review opened. Use this page to decide what should be replenished first.');
      return;
    }

    if (flow === 'near-expiry') {
      selectInventoryView('near-expiry');
      setInventoryNotice('Near Expiry review opened. Prioritize batches that require action before expiry.');
      return;
    }

    selectInventoryView('product-master');
    setActiveProductMasterAction('ai-import');
    setInventoryNotice('AI Import flow opened. Use this for structured product list review and approval.');
  }

  function renderSimpleMightyInventoryCommandCenter() {
    const commandCards = [
      {
        key: 'receive-stock',
        eyebrow: 'Flow',
        title: 'Receive stock',
        action: 'Start',
        tone: 'primary',
      },
      {
        key: 'product-master-create',
        eyebrow: 'Master',
        title: 'Add product',
        action: 'Add',
        tone: 'quiet',
      },
      {
        key: 'product-master-review',
        eyebrow: 'Register',
        title: 'Product list',
        action: 'Open',
        tone: 'quiet',
      },
      {
        key: 'product-master-replicate',
        eyebrow: 'Fast',
        title: 'Replicate',
        action: 'Choose',
        tone: 'quiet',
      },
      {
        key: 'low-stock',
        eyebrow: 'Queue',
        title: 'Low stock',
        action: 'Review',
        tone: 'alert',
      },
      {
        key: 'near-expiry',
        eyebrow: 'Risk',
        title: 'Expiry',
        action: 'Review',
        tone: 'alert',
      },
    ] as const;

    return (
      <section className="inventory-simple-command-center">
        <div className="inventory-simple-command-heading">
          <div>
            <p className="eyebrow">Workflow launcher</p>
            <h3>Choose the next action</h3>
            <span>
              Start with the action you need today. Forms stay closed until you open them.
            </span>
          </div>
          <button type="button" onClick={() => loadInventoryPreview(activeInventoryView, true)} disabled={isLoading}>
            {isLoading ? 'Refreshing…' : 'Refresh active page'}
          </button>
        </div>

        <div className="inventory-simple-command-grid">
          {commandCards.map((card) => (
            <button
              key={card.key}
              type="button"
              className={`inventory-simple-command-card inventory-simple-command-card--${card.tone}`}
              onClick={() => startSimpleMightyInventoryFlow(card.key)}
            >
              <small>{card.eyebrow}</small>
              <strong>{card.title}</strong>
              <em>{card.action}</em>
            </button>
          ))}
        </div>

        <div className="inventory-simple-command-note">
          <strong>Current page:</strong>
          <span>{activeInventoryMeta.label}</span>
          <small>{activeInventoryMeta.description}</small>
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
      <div className="table-action-row product-master-action-button-row">
        <button type="button" onClick={() => openProductMasterViewFromProduct(product)}>View</button>
        <button type="button" onClick={() => openProductMasterEditFromProduct(product)}>Edit</button>
        <button type="button" onClick={() => openProductMasterReplicateFromProduct(product)}>Replicate</button>
        <button type="button" className="danger" onClick={() => requestDeleteProductMaster(product)}>Delete</button>
      </div>
    );
  }

  function openInventoryBatchView(batch: PharmaStockBatch) {
    setViewingInventoryBatch(batch);
    setInventoryNotice(`Viewing inventory batch ${batch.batch_number}.`);
  }

  function openInventoryBatchEdit(batch: PharmaStockBatch) {
    setEditingInventoryBatch(batch);
    setViewingInventoryBatch(null);
    setPendingDeleteInventoryBatch(null);

    setInventoryCreateForm({
      product_id: String(batch.product.id),
      stock_location_id: String(batch.stock_location.id),
      batch_number: batch.batch_number ?? '',
      quantity: String(batch.available_quantity ?? 0),
      expiry_date: batch.expiry_date ?? '',
      unit_cost: batch.unit_cost === null || batch.unit_cost === undefined ? '' : String(batch.unit_cost),
      margin_percent: '',
      selling_price: batch.selling_price === null || batch.selling_price === undefined ? '' : String(batch.selling_price),
      supplier_name: batch.supplier_name ?? '',
      reference_number: '',
    });

    setInventoryProductSearchTerm('');
    setInventoryProductOptions([]);
    setIsInventoryProductSearchOpen(false);
    setInventoryNotice(`Update mode active for batch ${batch.batch_number}. Review the form fields, then click Update inventory.`);
    selectInventoryView('product-inventory');
  }

  async function confirmDeleteInventoryBatch() {
    if (!tenantSlug || !pendingDeleteInventoryBatch) {
      return;
    }

    setIsCreatingInventory(true);
    setError('');
    setInventoryNotice('');

    try {
      const response = await deletePharmaStockBatch(token, tenantSlug, pendingDeleteInventoryBatch.id);
      setInventoryNotice(response.message);
      setPendingDeleteInventoryBatch(null);
      await loadInventoryPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete inventory batch.');
    } finally {
      setIsCreatingInventory(false);
    }
  }

  function replicateInventoryBatch(batch: PharmaStockBatch) {
    setEditingInventoryBatch(null);
    setViewingInventoryBatch(null);
    setPendingDeleteInventoryBatch(null);

    setInventoryCreateForm({
      product_id: String(batch.product.id),
      stock_location_id: String(batch.stock_location.id),
      batch_number: '',
      quantity: '',
      expiry_date: batch.expiry_date ?? '',
      unit_cost: batch.unit_cost === null || batch.unit_cost === undefined ? '' : String(batch.unit_cost),
      margin_percent: '',
      selling_price: batch.selling_price === null || batch.selling_price === undefined ? '' : String(batch.selling_price),
      supplier_name: batch.supplier_name ?? '',
      reference_number: '',
    });

    setInventoryProductSearchTerm('');
    setInventoryProductOptions([batch.product]);
    setIsInventoryProductSearchOpen(false);
    setInventoryNotice(`Replicating ${batch.product.name}. Enter a new batch number and quantity, then click Create inventory.`);
  }

  function renderStockLocationActions(location: PharmaStockLocation) {
    return (
      <div className="table-action-row stock-location-action-button-row">
        <button type="button" onClick={() => openStockLocationView(location)}>View</button>
        <button type="button" onClick={() => openStockLocationEdit(location)}>Edit</button>
        <button type="button" onClick={() => openStockLocationReplace(location)}>Replace</button>
        <button type="button" className="danger" onClick={() => requestDeleteStockLocation(location)}>Delete</button>
      </div>
    );
  }

  function defaultStockLocationBranchId() {
    return stockLocationBranchOptions[0]?.id
      ? String(stockLocationBranchOptions[0].id)
      : profile.scope.branch_id
        ? String(profile.scope.branch_id)
        : '';
  }

  function stockLocationToForm(location: PharmaStockLocation): StockLocationFormState {
    return {
      branch_id: String(location.branch?.id ?? location.branch_id ?? defaultStockLocationBranchId()),
      name: location.name,
      code: location.code,
      location_type: location.location_type || 'store',
      status: location.status === 'inactive' ? 'inactive' : 'active',
    };
  }

  function suggestedReplacementLocationCode(location: PharmaStockLocation) {
    const base = `${location.code}-R`;
    let candidate = base;
    let counter = 2;

    while ((locations?.locations ?? []).some((item) => item.code.toLowerCase() === candidate.toLowerCase())) {
      candidate = `${base}${counter}`;
      counter += 1;
    }

    return candidate;
  }

  function openStockLocationCreate() {
    setActiveStockLocationAction('create');
    setViewingStockLocation(null);
    setPendingDeleteStockLocation(null);
    setSelectedStockLocationEditId('');
    setStockLocationForm({
      ...emptyStockLocationForm,
      branch_id: defaultStockLocationBranchId(),
    });
    setInventoryNotice('Create a new stock location, shelf, store, counter or quarantine point.');
  }

  function openStockLocationEdit(location: PharmaStockLocation) {
    setActiveStockLocationAction('edit');
    setViewingStockLocation(null);
    setPendingDeleteStockLocation(null);
    setSelectedStockLocationEditId(String(location.id));
    setStockLocationForm(stockLocationToForm(location));
    setInventoryNotice(`${location.name} opened for editing.`);
  }

  function openStockLocationReplace(location: PharmaStockLocation) {
    setActiveStockLocationAction('replace');
    setViewingStockLocation(null);
    setPendingDeleteStockLocation(null);
    setSelectedStockLocationEditId('');
    setStockLocationForm({
      ...stockLocationToForm(location),
      name: `${location.name} Replacement`,
      code: suggestedReplacementLocationCode(location),
      status: 'active',
    });
    setInventoryNotice(`Replacement draft prepared from ${location.name}. Save it, then move stock batches before deactivating the old location.`);
  }

  function openStockLocationView(location: PharmaStockLocation) {
    setViewingStockLocation(location);
    setActiveStockLocationAction(null);
    setPendingDeleteStockLocation(null);
    setInventoryNotice(`${location.name} opened for review.`);
  }

  function requestDeleteStockLocation(location: PharmaStockLocation) {
    setPendingDeleteStockLocation(location);
    setViewingStockLocation(null);
    setActiveStockLocationAction(null);
    setInventoryNotice('');
    setError('');
  }

  function stockLocationAiRecommendation(location: PharmaStockLocation) {
    if (Number(location.stock_batches_count || 0) > 0 && location.status === 'active') {
      return 'Keep active. Move batches first before replacement or deletion.';
    }

    if (Number(location.stock_batches_count || 0) > 0 && location.status === 'inactive') {
      return 'Review linked batches and complete stock movement cleanup.';
    }

    if (location.status === 'inactive') {
      return 'Safe for archive or deletion after admin confirmation.';
    }

    return 'Available for receiving and stock organization.';
  }

  async function handleSaveStockLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    if (!stockLocationForm.name.trim() || !stockLocationForm.code.trim()) {
      setError('Location name and code are required.');
      return;
    }

    if (activeStockLocationAction !== 'edit' && !stockLocationForm.branch_id) {
      setError('Select a branch before creating a stock location.');
      return;
    }

    setIsSavingStockLocation(true);
    setError('');
    setInventoryNotice('');

    try {
      if (activeStockLocationAction === 'edit') {
        if (!selectedStockLocationEditId) {
          setError('Select a stock location before saving changes.');
          return;
        }

        const response = await updatePharmaStockLocation(token, tenantSlug, Number(selectedStockLocationEditId), {
          name: stockLocationForm.name.trim(),
          code: stockLocationForm.code.trim(),
          location_type: stockLocationForm.location_type,
          status: stockLocationForm.status,
        });

        setInventoryNotice(`${response.message} ${response.location.name} updated.`);
      } else {
        const response = await createPharmaStockLocation(token, tenantSlug, {
          branch_id: Number(stockLocationForm.branch_id),
          name: stockLocationForm.name.trim(),
          code: stockLocationForm.code.trim(),
          location_type: stockLocationForm.location_type,
          status: stockLocationForm.status,
        });

        setInventoryNotice(`${response.message} ${response.location.name} is ready for use.`);
      }

      setActiveStockLocationAction(null);
      setSelectedStockLocationEditId('');
      setStockLocationForm(emptyStockLocationForm);
      await loadInventoryPreview('locations', true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save stock location.');
    } finally {
      setIsSavingStockLocation(false);
    }
  }

  async function confirmDeleteStockLocation() {
    if (!tenantSlug || !pendingDeleteStockLocation) {
      setError('No stock location is selected for deletion.');
      return;
    }

    if (Number(pendingDeleteStockLocation.stock_batches_count || 0) > 0) {
      setError('This stock location still has linked stock batches. Create a replacement, move the batches, then delete or deactivate the old location.');
      return;
    }

    setIsSavingStockLocation(true);
    setError('');
    setInventoryNotice('');

    try {
      const response = await deletePharmaStockLocation(token, tenantSlug, pendingDeleteStockLocation.id);
      setInventoryNotice(response.message);
      setPendingDeleteStockLocation(null);
      await loadInventoryPreview('locations', true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete stock location.');
    } finally {
      setIsSavingStockLocation(false);
    }
  }

  function renderStockLocationActionPanel() {
    if (pendingDeleteStockLocation) {
      return (
        <section className="stock-location-action-panel stock-location-delete-panel">
          <div className="section-heading">
            <div>
              <h3>Delete stock location</h3>
              <span>
                Delete only unused locations. If batches are linked, replace or move stock first.
              </span>
            </div>
            <button type="button" onClick={() => setPendingDeleteStockLocation(null)}>Cancel</button>
          </div>

          <div className="delete-confirmation-card">
            <div>
              <strong>{pendingDeleteStockLocation.name}</strong>
              <span>{pendingDeleteStockLocation.code} · {pendingDeleteStockLocation.location_type.replaceAll('_', ' ')}</span>
              <small>{formatNumber(pendingDeleteStockLocation.stock_batches_count)} linked batch(es)</small>
            </div>

            <div className="delete-confirmation-actions">
              <button type="button" onClick={() => setPendingDeleteStockLocation(null)}>Keep location</button>
              <button
                type="button"
                className="danger"
                disabled={isSavingStockLocation || Number(pendingDeleteStockLocation.stock_batches_count || 0) > 0}
                onClick={() => void confirmDeleteStockLocation()}
              >
                {isSavingStockLocation ? 'Deleting…' : 'Delete location'}
              </button>
            </div>
          </div>
        </section>
      );
    }

    if (viewingStockLocation) {
      return (
        <section className="stock-location-action-panel stock-location-view-panel">
          <div className="section-heading">
            <div>
              <h3>Location profile</h3>
              <span>Storage point details and operational status.</span>
            </div>
            <button type="button" onClick={() => setViewingStockLocation(null)}>Close</button>
          </div>

          <div className="stock-location-profile-grid">
            {[
              ['Location', viewingStockLocation.name],
              ['Code', viewingStockLocation.code],
              ['Type', viewingStockLocation.location_type.replaceAll('_', ' ')],
              ['Branch', viewingStockLocation.branch?.name ?? 'Branch not set'],
              ['Linked batches', formatNumber(viewingStockLocation.stock_batches_count)],
              ['Status', viewingStockLocation.status],
              ['Recommended action', stockLocationAiRecommendation(viewingStockLocation)],
            ].map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>

          <div className="inventory-form-actions">
            <button type="button" onClick={() => openStockLocationEdit(viewingStockLocation)}>Edit location</button>
            <button type="button" onClick={() => openStockLocationReplace(viewingStockLocation)}>Replace location</button>
            <button type="button" className="danger" onClick={() => requestDeleteStockLocation(viewingStockLocation)}>Delete location</button>
          </div>
        </section>
      );
    }

    if (!activeStockLocationAction) return null;

    const isEdit = activeStockLocationAction === 'edit';

    return (
      <section className="stock-location-action-panel">
        <div className="section-heading">
          <div>
            <h3>{isEdit ? 'Edit stock location' : activeStockLocationAction === 'replace' ? 'Replace stock location' : 'Create stock location'}</h3>
            <span>
              {isEdit
                ? 'Update the location name, code, type or status.'
                : activeStockLocationAction === 'replace'
                  ? 'Create the replacement first. Then move stock batches before deleting or deactivating the old location.'
                  : 'Add a branch store, shelf, counter, quarantine area or other storage point.'}
            </span>
          </div>
          <button type="button" onClick={() => setActiveStockLocationAction(null)}>Cancel</button>
        </div>

        <form className="stock-location-form-grid" onSubmit={(event) => void handleSaveStockLocation(event)}>
          <label>
            Branch
            {stockLocationBranchOptions.length > 0 ? (
              <select
                value={stockLocationForm.branch_id}
                disabled={isEdit}
                onChange={(event) => setStockLocationForm({ ...stockLocationForm, branch_id: event.target.value })}
                required={!isEdit}
              >
                <option value="">Select branch</option>
                {stockLocationBranchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                value={stockLocationForm.branch_id}
                disabled={isEdit}
                onChange={(event) => setStockLocationForm({ ...stockLocationForm, branch_id: event.target.value })}
                placeholder="Branch ID"
                required={!isEdit}
              />
            )}
          </label>

          <label>
            Location name
            <input
              value={stockLocationForm.name}
              onChange={(event) => setStockLocationForm({ ...stockLocationForm, name: event.target.value })}
              placeholder="e.g. Main store, Counter shelf A"
              required
            />
          </label>

          <label>
            Location code
            <input
              value={stockLocationForm.code}
              onChange={(event) => setStockLocationForm({ ...stockLocationForm, code: event.target.value })}
              placeholder="e.g. MAIN-STORE"
              required
            />
          </label>

          <label>
            Location type
            <select
              value={stockLocationForm.location_type}
              onChange={(event) => setStockLocationForm({ ...stockLocationForm, location_type: event.target.value })}
            >
              <option value="store">Store</option>
              <option value="shelf">Shelf</option>
              <option value="counter">Counter</option>
              <option value="warehouse">Warehouse</option>
              <option value="quarantine">Quarantine</option>
              <option value="cold_chain">Cold chain</option>
            </select>
          </label>

          <label>
            Status
            <select
              value={stockLocationForm.status}
              onChange={(event) => setStockLocationForm({ ...stockLocationForm, status: event.target.value as StockLocationFormState['status'] })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <div className="inventory-create-summary">
            <strong>{activeStockLocationAction === 'replace' ? 'Replacement workflow' : 'Location setup'}</strong>
            <span>Codes are kept unique within the branch.</span>
            <small>Use inactive status when a location should remain visible for audit but not used for new receiving.</small>
          </div>

          <div className="inventory-form-actions">
            <button type="submit" disabled={isSavingStockLocation}>
              {isSavingStockLocation ? 'Saving…' : isEdit ? 'Save changes' : 'Save location'}
            </button>
            <button type="button" onClick={() => setActiveStockLocationAction(null)}>Cancel</button>
          </div>
        </form>
      </section>
    );
  }

  function renderBatchActions(batch: PharmaStockBatch) {
    return (
      <div className="table-action-row product-inventory-action-button-row">
        <button
          type="button"
          className="inventory-action-button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            openInventoryBatchView(batch);
          }}
        >
          View
        </button>
        <button
          type="button"
          className="inventory-action-button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            openInventoryBatchEdit(batch);
          }}
        >
          Edit
        </button>
        <button
          type="button"
          className="inventory-action-button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            replicateInventoryBatch(batch);
          }}
        >
          Replicate
        </button>
        <button
          type="button"
          className="inventory-action-button danger"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setPendingDeleteInventoryBatch(batch);
            setViewingInventoryBatch(null);
          }}
        >
          Delete
        </button>
      </div>
    );
  }


  function expiryRiskKeyFromDays(days: number | null) {
    if (days === null) return 'noDate';
    if (days < 0) return 'expired';
    if (days <= Number(expiryLabelRules.critical.maxDays)) return 'critical';
    if (days <= Number(expiryLabelRules.warning.maxDays)) return 'warning';
    if (days <= Number(expiryLabelRules.watch.maxDays)) return 'watch';
    return 'valid';
  }

  function expiryRiskLabel(days: number | null) {
    const key = managedExpiryRiskKeyFromDays(days);
    return expiryLabelRules[key as keyof typeof expiryLabelRules]?.label ?? 'Review';
  }

  function expiryRiskClass(days: number | null) {
    return `inventory-expiry-row inventory-expiry-row--${managedExpiryRiskKeyFromDays(days)}`;
  }

  function shouldShowExpiryRow(days: number | null) {
    if (expiryViewFilter === 'all') return true;
    return managedExpiryRiskKeyFromDays(days) === expiryViewFilter;
  }

  function expiryAiRecommendation(days: number | null) {
    if (days === null) return 'Add expiry date before this batch is released for routine selling.';
    if (days < 0) return 'Remove from sale, quarantine the batch, and document disposal or supplier return.';
    if (days <= 30) return 'Escalate today: FEFO sale, transfer, supplier return, or controlled write-off.';
    if (days <= 90) return 'Prioritize FEFO selling and avoid new purchasing until stock reduces.';
    if (days <= 180) return 'Keep on watchlist and review weekly movement.';
    return 'Healthy batch. Continue normal FEFO monitoring.';
  }


  function resolveInventoryTableSettings(tableKey: InventoryTableKey): InventoryTableSettings {
    return {
      ...defaultInventoryTableSettings,
      ...(tableSettingsByKey[tableKey] ?? {}),
    };
  }

  function updateInventoryTableSetting<K extends keyof InventoryTableSettings>(
    tableKey: InventoryTableKey,
    field: K,
    value: InventoryTableSettings[K],
  ) {
    setTableSettingsByKey((current) => ({
      ...current,
      [tableKey]: {
        ...defaultInventoryTableSettings,
        ...(current[tableKey] ?? {}),
        [field]: value,
      },
    }));
  }

  function saveInventoryTableSettings() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(INVENTORY_TABLE_SETTINGS_STORAGE_KEY, JSON.stringify(tableSettingsByKey));
    }

    markAction('Table management settings saved');
  }

  function resetInventoryTableSettings(tableKey: InventoryTableKey) {
    setTableSettingsByKey((current) => {
      const next = { ...current };
      delete next[tableKey];

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(INVENTORY_TABLE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
      }

      return next;
    });

    markAction('Table settings restored');
  }

  function inventoryTableShellClass(tableKey: InventoryTableKey) {
    const settings = resolveInventoryTableSettings(tableKey);

    return [
      'inventory-table-shell',
      `inventory-table-style--${settings.style}`,
      `inventory-table-density--${settings.density}`,
      `inventory-table-width--${settings.widthPreset}`,
      settings.wrapText ? 'inventory-table-wrap--on' : 'inventory-table-wrap--off',
      settings.stickyHeader ? 'inventory-table-sticky-header' : 'inventory-table-no-sticky-header',
      settings.stickyActions ? 'inventory-table-sticky-actions' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  function inventoryTableShellStyle(tableKey: InventoryTableKey) {
    const settings = resolveInventoryTableSettings(tableKey);

    const densityPadding = {
      compact: '8px',
      comfortable: '13px',
      tall: '17px',
    }[settings.density];

    return {
      '--inventory-table-font-size': `${settings.fontSize}px`,
      '--inventory-table-cell-padding-y': densityPadding,
      '--inventory-table-cell-padding-x': settings.density === 'compact' ? '10px' : '14px',
    };
  }

  function renderAdminTableManagement(tableKey: InventoryTableKey, title: string) {
    const settings = resolveInventoryTableSettings(tableKey);

    return (
      <div className="inventory-table-management-panel">
        <div>
          <strong>Table Management</strong>
          <span>{title} layout controls for Admin.</span>
        </div>

        <label>
          Style
          <select
            value={settings.style}
            onChange={(event) =>
              updateInventoryTableSetting(tableKey, 'style', event.target.value as InventoryTableStyle)
            }
          >
            <option value="clean">Clean</option>
            <option value="striped">Striped</option>
            <option value="bordered">Bordered</option>
          </select>
        </label>

        <label>
          Font
          <input
            type="range"
            min="12"
            max="16"
            value={settings.fontSize}
            onChange={(event) =>
              updateInventoryTableSetting(tableKey, 'fontSize', Number(event.target.value))
            }
          />
          <small>{settings.fontSize}px</small>
        </label>

        <label>
          Density
          <select
            value={settings.density}
            onChange={(event) =>
              updateInventoryTableSetting(tableKey, 'density', event.target.value as InventoryTableDensity)
            }
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="tall">Tall</option>
          </select>
        </label>

        <label>
          Column width
          <select
            value={settings.widthPreset}
            onChange={(event) =>
              updateInventoryTableSetting(tableKey, 'widthPreset', event.target.value as InventoryColumnWidthPreset)
            }
          >
            <option value="compact">Compact</option>
            <option value="balanced">Balanced</option>
            <option value="wide">Wide</option>
          </select>
        </label>

        <label className="inventory-table-toggle">
          <input
            type="checkbox"
            checked={settings.wrapText}
            onChange={(event) => updateInventoryTableSetting(tableKey, 'wrapText', event.target.checked)}
          />
          Wrap text
        </label>

        <label className="inventory-table-toggle">
          <input
            type="checkbox"
            checked={settings.stickyHeader}
            onChange={(event) => updateInventoryTableSetting(tableKey, 'stickyHeader', event.target.checked)}
          />
          Sticky header
        </label>

        <label className="inventory-table-toggle">
          <input
            type="checkbox"
            checked={settings.stickyActions}
            onChange={(event) => updateInventoryTableSetting(tableKey, 'stickyActions', event.target.checked)}
          />
          Sticky actions
        </label>

        <div className="inventory-table-management-actions">
          <button type="button" className="primary" onClick={saveInventoryTableSettings}>
            Save table settings
          </button>
          <button type="button" onClick={() => resetInventoryTableSettings(tableKey)}>
            Reset
          </button>
        </div>
      </div>
    );
  }

  function renderExpiryLabelBadge(days: number | null) {
    return (
      <mark
        className={`inventory-expiry-label inventory-expiry-label--${managedExpiryRiskKeyFromDays(days)}`}
        style={managedExpiryLabelStyle(days) as React.CSSProperties}
      >
        {managedExpiryRiskLabel(days)}
      </mark>
    );
  }

  function handleSaveExpiryLabelRules() {
    runtimeExpiryLabelRules = expiryLabelRules;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(EXPIRY_LABEL_RULES_STORAGE_KEY, JSON.stringify(expiryLabelRules));
    }

    setIsExpiryLabelManagerOpen(false);
    markAction('Expiry labelling rules saved and applied');
  }

  function renderExpiryLabelTools() {
    const filterOptions = [
      ['all', 'All'],
      ['expired', expiryLabelRules.expired.label],
      ['critical', expiryLabelRules.critical.label],
      ['warning', expiryLabelRules.warning.label],
      ['watch', expiryLabelRules.watch.label],
      ['valid', expiryLabelRules.valid.label],
      ['noDate', expiryLabelRules.noDate.label],
    ];

    const mappingRows = [
      ['expired', 'Less than 0 days'],
      ['critical', `0-${expiryLabelRules.critical.maxDays} days`],
      ['warning', `${Number(expiryLabelRules.critical.maxDays) + 1}-${expiryLabelRules.warning.maxDays} days`],
      ['watch', `${Number(expiryLabelRules.warning.maxDays) + 1}-${expiryLabelRules.watch.maxDays} days`],
      ['valid', `More than ${expiryLabelRules.watch.maxDays} days`],
      ['noDate', 'Missing expiry date'],
    ] as const;

    return (
      <section className="inventory-expiry-control-suite">
        <div className="inventory-expiry-filter-row" aria-label="Expiry filters">
          {filterOptions.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={expiryViewFilter === key ? 'active' : ''}
              onClick={() => setExpiryViewFilter(key)}
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            className="inventory-expiry-map-button"
            onClick={() => setIsExpiryLabelManagerOpen((current) => !current)}
          >
            Labelling & Mapping
          </button>
        </div>

        <div className="inventory-expiry-legend">
          {mappingRows.map(([key, range]) => {
            const rule = expiryLabelRules[key as keyof typeof expiryLabelRules];

            return (
              <span
                key={key}
                style={{ background: rule.background, color: rule.text }}
              >
                <strong>{rule.label}</strong>
                <small>{range}</small>
              </span>
            );
          })}
        </div>

        {isExpiryLabelManagerOpen && (
          <section className="inventory-expiry-label-manager">
            <div>
              <h4>Labelling and mapping</h4>
              <p>
                Admins can adjust expiry bands and colours to match internal stock policy.
              </p>
            </div>

            <div className="inventory-expiry-label-grid">
              {(['critical', 'warning', 'watch'] as const).map((key) => (
                <label key={key}>
                  {expiryLabelRules[key].label} max days
                  <input
                    type="number"
                    min="0"
                    value={expiryLabelRules[key].maxDays}
                    onChange={(event) =>
                      setExpiryLabelRules((current) => ({
                        ...current,
                        [key]: {
                          ...current[key],
                          maxDays: Number(event.target.value || 0),
                        },
                      }))
                    }
                  />
                </label>
              ))}

              {(['expired', 'critical', 'warning', 'watch', 'valid', 'noDate'] as const).map((key) => (
                <label key={`${key}-background`}>
                  {expiryLabelRules[key].label} background
                  <input
                    type="color"
                    value={expiryLabelRules[key].background}
                    onChange={(event) =>
                      setExpiryLabelRules((current) => ({
                        ...current,
                        [key]: {
                          ...current[key],
                          background: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              ))}

              {(['expired', 'critical', 'warning', 'watch', 'valid', 'noDate'] as const).map((key) => (
                <label key={`${key}-text`}>
                  {expiryLabelRules[key].label} text
                  <input
                    type="color"
                    value={expiryLabelRules[key].text}
                    onChange={(event) =>
                      setExpiryLabelRules((current) => ({
                        ...current,
                        [key]: {
                          ...current[key],
                          text: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </section>
        )}
      </section>
    );
  }

  return (
    <article className="panel wide inventory-preview-panel">
      <div className="panel-heading-row">
        <div>
          <h2>{activeInventoryView === 'overview' ? 'Inventory' : activeInventoryMeta.label}</h2>
          <p className="muted">{inventoryPageDescriptions[activeInventoryView]}</p>
        </div>

        <button type="button" onClick={() => loadInventoryPreview(activeInventoryView, true)} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {isLoading && !summary && <p className="muted">Loading inventory automatically...</p>}

      {error && <div className="form-error">{error}</div>}
      {inventoryNotice && <div className="form-success">{inventoryNotice}</div>}

      {activeInventoryView === 'overview' && renderSimpleMightyInventoryCommandCenter()}

      {activeInventoryView !== 'overview' && (
        <section className="inventory-active-page-marker" data-active-inventory-view={activeInventoryView}>
          <span>Inventory page</span>
          <strong>{activeInventoryMeta.label}</strong>
          <small>{activeInventoryMeta.description}</small>
        </section>
      )}

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
                    <span>Stock signals for reorder, expiry, margin, and availability decisions.</span>
                  </div>
                  <button type="button" onClick={() => selectInventoryView('product-inventory')}>Open Product Inventory</button>
                </div>

                <div className="analytics-bar-grid">
                  {[
                    ['Low stock risk', inventorySummary.low_stock_products_count, Math.max(inventorySummary.products_count, 1)],
                    ['Expiry risk', inventorySummary.near_expiry_batches_180_days_count, Math.max(inventorySummary.stock_batches_count, 1)],
                    ['Batch coverage', inventorySummary.stock_batches_count, Math.max(inventorySummary.products_count, 1)],
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
                  onChange={(event) => setSearchTerm(event.target.value)}/>
              </label>

              {productInventorySummaryCards.map(([action, label]) => (
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
                subtitle: 'Stock batches used for POS, receiving, availability, and pricing.',
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

              <div className="inventory-product-inventory-card-grid">
                {[
                  {
                    label: 'Inventory batches',
                    value: formatNumber(productInventoryRows.length),
                    helper: 'Commercial stock rows linked to Product Master',
                  },
                  {
                    label: 'Available quantity',
                    value: formatNumber(productInventoryRows.reduce((total, { batch }) => total + Number(batch.available_quantity || 0), 0)),
                    helper: 'Available units across inventory batches',
                  },
                  {
                    label: 'Estimated stock value',
                    value: formatRwf(productInventoryRows.reduce((total, { batch, computedSellingPrice }) => total + (Number(batch.available_quantity || 0) * Number(computedSellingPrice || batch.unit_cost || 0)), 0)),
                    helper: 'Quantity multiplied by selling price or cost',
                  },
                  {
                    label: 'Near-expiry risk',
                    value: formatNumber(productInventoryRows.filter(({ days }) => days !== null && days <= 180).length),
                    helper: 'Batches within 180 days of expiry',
                  },
                ].map((card) => (
                  <article key={card.label} className="inventory-product-inventory-card">
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <small>{card.helper}</small>
                  </article>
                ))}
              </div>

              {!isInventoryReceiveFlowOpen && !editingInventoryBatch && (
                <section className="inventory-guided-flow-launch-panel">
                  <div>
                    <p className="eyebrow">Guided receiving</p>
                    <h3>Receive stock only when you are ready</h3>
                    <span>
                      The receiving form is hidden to keep this page calm. Start the flow when you need to record stock against Product Master.
                    </span>
                  </div>
                  <button type="button" onClick={() => startSimpleMightyInventoryFlow('receive-stock')}>
                    Start Receive Stock
                  </button>
                </section>
              )}

              <section className={`inventory-create-from-master-panel inventory-guided-flow-panel ${(isInventoryReceiveFlowOpen || editingInventoryBatch) ? 'is-open' : 'is-hidden'}`}>
                <div className="section-heading">
                  <div>
                    <h3>{editingInventoryBatch ? 'Update inventory batch' : 'Create inventory from Product Master'}</h3>
                    <span>{editingInventoryBatch ? `Update mode active for batch ${editingInventoryBatch.batch_number}. Save changes using the Update Inventory button.` : 'Product identity comes from Product Master. Inventory adds batch, location, quantity, cost, margin and selling price.'}</span>
                  </div>
                </div>

                <form className="inventory-creation-grid" onSubmit={handleCreateInventoryFromProductMaster}>
                  <div className={`inventory-receive-source-selector inventory-receive-source-selector--${inventoryReceiveSource}`}>
                    <button
                      type="button"
                      className={inventoryReceiveSource === 'purchase-code' ? 'active inventory-source-option inventory-source-option--purchase' : 'inventory-source-option inventory-source-option--purchase'}
                      onClick={() => setInventoryReceiveSource('purchase-code')}
                    >
                      <strong>Receive from Purchase Code</strong>
                      <span>Use the purchase order/reference code and receive stock against Product Master items.</span>
                    </button>
                    <button
                      type="button"
                      className={inventoryReceiveSource === 'manual' ? 'active inventory-source-option inventory-source-option--manual' : 'inventory-source-option inventory-source-option--manual'}
                      onClick={() => setInventoryReceiveSource('manual')}
                    >
                      <strong>Manual Product Master Entry</strong>
                      <span>Select an approved Product Master item before quantity, batch and expiry are recorded.</span>
                    </button>
                  </div>

                  <div className={`inventory-receive-mode-banner inventory-receive-mode-banner--${inventoryReceiveSource}`}>
                    <strong>{inventoryReceiveSource === 'purchase-code' ? 'Purchase Code Receiving Mode' : 'Manual Inventory Entry Mode'}</strong>
                    <span>
                      {inventoryReceiveSource === 'purchase-code'
                        ? 'Use this when stock is received from a purchase order, delivery note, or procurement reference.'
                        : 'Use this when recording inventory directly from Product Master without a purchase order reference.'}
                    </span>
                  </div>

                  <label className="inventory-product-master-combobox-label">
                    Product from Product Master
                    <div className="inventory-product-master-combobox">
                      <div className="inventory-product-master-search-row">
                        <textarea
                          value={inventoryProductSearchTerm}
                          placeholder={selectedInventoryProduct ? 'Product selected. Use Change product to search another item.' : 'Search Product Master by product name, generic name, or drug code'}
                          onFocus={() => {
                            setIsInventoryProductSearchOpen(true);
                            if (inventoryProductOptions.length === 0) {
                              void loadInventoryProductMasterOptions('');
                            }
                          }}
                          onChange={(event) => {
                            const value = event.target.value;

                            handleInventoryProductSearchChange(value);
                            setIsInventoryProductSearchOpen(true);

                            if (value.trim().length === 0 || value.trim().length >= 2) {
                              void loadInventoryProductMasterOptions(value);
                            }
                          }}
                          rows={1}
                          inputMode="text"
                          autoCapitalize="none"
                          autoCorrect="off"
                          autoComplete="off"
                          enterKeyHint="search"
                          spellCheck={false}
                          aria-label="Product from Product Master search"
                        ></textarea>
                        <button
                          type="button"
                          onClick={() => {
                            setIsInventoryProductSearchOpen(true);
                            void loadInventoryProductMasterOptions(inventoryProductSearchTerm);
                          }}
                        >
                          {isSearchingInventoryProducts ? 'Searching…' : 'Search'}
                        </button>
                      </div>

                      {selectedInventoryProduct && (
                        <div className="inventory-product-master-selected inventory-product-master-selected--active">
                          <div>
                            <strong>{selectedInventoryProduct.name}</strong>
                            <span>{selectedInventoryProduct.generic_name ?? 'Generic name not set'}</span>
                            <small>Drug code: {selectedInventoryProduct.sku}</small>
                          </div>
                          <button
                            type="button"
                            className="inventory-product-master-change-button"
                            onClick={() => {
                              setInventoryCreateForm((current) => ({
                                ...current,
                                product_id: '',
                                margin_percent: '',
                                selling_price: '',
                              }));
                              setInventoryProductSearchTerm('');
                              setInventoryProductOptions([]);
                              setIsInventoryProductSearchOpen(false);
                              setEditingInventoryBatch(null);
                            }}
                          >
                            Change product
                          </button>
                        </div>
                      )}

                      {isInventoryProductSearchOpen && inventoryProductSearchTerm.trim().length > 0 && (
                        <div className="inventory-product-master-options">
                          {filteredInventoryProductOptions.length === 0 ? (
                            <button type="button" disabled>
                              No Product Master products found for the typed keyword.
                            </button>
                          ) : (
                            filteredInventoryProductOptions.map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => selectInventoryProductFromMaster(product)}
                              >
                                <strong>{product.name}</strong>
                                <span>{product.generic_name ?? 'Generic name not set'}</span>
                                <small>Drug code: {product.sku}</small>
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      <input type="hidden" value={inventoryCreateForm.product_id} readOnly />
                    </div>
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
                    <button
                      type="submit"
                      className="inventory-create-submit-button"
                      disabled={
                        isCreatingInventory ||
                        !inventoryCreateForm.product_id ||
                        !inventoryCreateForm.stock_location_id ||
                        !inventoryCreateForm.batch_number.trim() ||
                        Number(inventoryCreateForm.quantity || 0) <= 0 ||
                        (inventoryReceiveSource === 'purchase-code' && !(inventoryCreateForm.reference_number ?? '').trim())
                      }
                      aria-busy={isCreatingInventory}
                    >
                      {editingInventoryBatch ? (isCreatingInventory ? 'Updating inventory, please wait…' : 'Update inventory') : (isCreatingInventory ? 'Creating inventory, please wait…' : 'Create inventory')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInventoryCreateForm(emptyInventoryCreateForm);
                        setEditingInventoryBatch(null);
                        setInventoryProductSearchTerm('');
                        setInventoryProductOptions([]);
                        setIsInventoryProductSearchOpen(false);
                      }}
                    >
                      {editingInventoryBatch ? 'Cancel edit' : 'Cancel'}
                    </button>
                  </div>
                </form>
              </section>

              {viewingInventoryBatch && (
                <section className="inventory-batch-detail-panel">
                  <div className="section-heading">
                    <div>
                      <h3>Inventory batch details</h3>
                      <span>Review the selected Product Inventory record before editing or deleting.</span>
                    </div>
                    <button type="button" onClick={() => setViewingInventoryBatch(null)}>Close</button>
                  </div>
                  <div className="inventory-batch-detail-grid">
                    {[
                      ['Product', viewingInventoryBatch.product.name],
                      ['Drug code', viewingInventoryBatch.product.sku],
                      ['Generic name', viewingInventoryBatch.product.generic_name ?? 'Generic name not set'],
                      ['Batch number', viewingInventoryBatch.batch_number],
                      ['Location', `${viewingInventoryBatch.stock_location.name} (${viewingInventoryBatch.stock_location.code})`],
                      ['Available quantity', formatNumber(viewingInventoryBatch.available_quantity)],
                      ['Unit cost', formatRwf(viewingInventoryBatch.unit_cost)],
                      ['Selling price', formatRwf(viewingInventoryBatch.selling_price)],
                      ['Expiry date', formatDate(viewingInventoryBatch.expiry_date)],
                      ['Status', viewingInventoryBatch.status],
                    ].map(([label, value]) => (
                      <article key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </article>
                    ))}
                  </div>
                  <div className="inventory-form-actions">
                    <button type="button" onClick={() => openInventoryBatchEdit(viewingInventoryBatch)}>Edit this batch</button>
                    <button type="button" className="danger" onClick={() => setPendingDeleteInventoryBatch(viewingInventoryBatch)}>Delete this batch</button>
                  </div>
                </section>
              )}

              {pendingDeleteInventoryBatch && (
                <section className="inventory-delete-confirmation-panel">
                  <div>
                    <strong>Delete inventory batch?</strong>
                    <span>
                      This will remove batch {pendingDeleteInventoryBatch.batch_number} for {pendingDeleteInventoryBatch.product.name}.
                    </span>
                  </div>
                  <div className="inventory-form-actions">
                    <button type="button" className="danger" disabled={isCreatingInventory} onClick={confirmDeleteInventoryBatch}>
                      {isCreatingInventory ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button type="button" onClick={() => setPendingDeleteInventoryBatch(null)}>Cancel</button>
                  </div>
                </section>
              )}

              <section className="inventory-ai-opportunity-panel">
                <div className="section-heading">
                  <div>
                    <h3>AI inventory opportunity model</h3>
                    <span>Connects Product Master, stock movement, margin, and expiry pressure.</span>
                  </div>
                </div>

                <div className="inventory-opportunity-grid">
                  {[
                    {
                      title: 'Missing reimbursable products',
                      helper: `${formatNumber(Math.max(0, allProducts.length - productInventoryRows.length))} Product Master items may not yet have inventory stock.`,
                    },
                    {
                      title: 'Stock-out opportunity',
                      helper: `${formatNumber(productInventoryRows.filter(({ batch }) => Number(batch.available_quantity || 0) <= 0).length)} stock rows need attention.`,
                    },
                    {
                      title: 'Market dynamics',
                      helper: 'Review fast-moving items, supplier availability and patient demand before purchasing.',
                    },
                    {
                      title: 'Margin and pricing opportunity',
                      helper: `${formatNumber(productInventoryRows.filter(({ computedSellingPrice, batch }) => Number(computedSellingPrice || 0) <= Number(batch.unit_cost || 0)).length)} rows may need pricing review.`,
                    },
                    {
                      title: 'Near-expiry pressure',
                      helper: `${formatNumber(productInventoryRows.filter(({ days }) => days !== null && days <= 180).length)} batches are within 180 days.`,
                    },
                    {
                      title: 'Purchase planning',
                      helper: 'Use Product Master, current stock and expiry risk to guide replenishment.',
                    },
                  ].map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      className={`inventory-ai-opportunity-card ${activeInventoryOpportunity === item.title ? 'active' : ''}`}
                      aria-pressed={activeInventoryOpportunity === item.title}
                      onClick={() => {
                        setActiveInventoryOpportunity(item.title);
                        setInventoryNotice(`${item.title} opened in the AI inventory opportunity model.`);
                      }}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.helper}</span>
                      <small>Open opportunity</small>
                    </button>
                  ))}
                </div>

                <div className="inventory-ai-opportunity-detail">
                  <strong>{activeInventoryOpportunity}</strong>
                  <span>
                    {activeInventoryOpportunity === 'Missing reimbursable products'
                      ? 'Compare Product Master against Product Inventory and prioritize approved reimbursable items without stock.'
                      : activeInventoryOpportunity === 'Stock-out opportunity'
                        ? 'Identify zero-stock or low-availability products and prepare restocking actions before sales are lost.'
                        : activeInventoryOpportunity === 'Market dynamics'
                          ? 'Use supplier availability, patient demand, reimbursement trends and seasonal patterns before purchase decisions.'
                          : activeInventoryOpportunity === 'Margin and pricing opportunity'
                            ? 'Review items where selling price is missing, below cost, or below the configured Product Master margin.'
                            : activeInventoryOpportunity === 'Near-expiry pressure'
                              ? 'Prioritize FEFO selling, transfer, supplier return or promotion for batches nearing expiry.'
                              : 'Build a purchase plan from Product Master demand, available quantity, expiry risk and supplier lead time.'}
                  </span>
                  <div className="inventory-ai-opportunity-actions">
                    <button type="button" onClick={() => selectInventoryView('product-master')}>Review Product Master</button>
                    <button type="button" onClick={() => selectInventoryView('product-inventory')}>Review Product Inventory</button>
                    <button type="button" onClick={() => selectInventoryView('batches')}>Review Batch & Expiry</button>
                  </div>
                </div>
              </section>

              {renderAdminTableManagement('product-register', 'Product Inventory Register')}

              <div className={inventoryTableShellClass('product-register')} style={inventoryTableShellStyle('product-register') as any}>
                <table className="inventory-data-table inventory-data-table--product-register">
                  <colgroup>
                    <col className="col-sn" />
                    <col className="col-product" />
                    <col className="col-product" />
                    <col className="col-code" />
                    <col className="col-location" />
                    <col className="col-number" />
                    <col className="col-number" />
                    <col className="col-number" />
                    <col className="col-number" />
                    <col className="col-status" />
                    <col className="col-actions" />
                  </colgroup>

                  <thead>
                    <tr>
                      <th>SN</th>
                      <th>Product / Drug Code</th>
                      <th>Generic Description</th>
                      <th>Batch / Expiry</th>
                      <th>Location</th>
                      <th className="cell-number">Available Qty</th>
                      <th className="cell-number">Unit Cost</th>
                      <th className="cell-number">Margin</th>
                      <th className="cell-number">Selling Price</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagedProductInventory.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="cell-center">
                          No commercial inventory batches found.
                        </td>
                      </tr>
                    ) : (
                      pagedProductInventory.map(({ batch, defaultMargin, computedSellingPrice, days }, index) => (
                        <tr key={batch.id} className={managedExpiryRiskClass(days)}>
                          <td className="cell-center">{index + 1}</td>
                          <td className="cell-wrap">
                            <strong className="cell-strong">{batch.product.name}</strong>
                            <br />
                            <span className="cell-muted">Drug code: {batch.product.sku}</span>
                            <br />
                            <span className="cell-muted">Regulatory Price: {formatRwf(regulatoryPrice(batch.product))}</span>
                          </td>
                          <td className="cell-wrap">
                            <strong className="cell-strong">{batch.product.generic_name ?? 'Generic name not set'}</strong>
                            <br />
                            <span className="cell-muted">
                              {metadataText(batch.product, ['designation', 'rhia_designation'], 'Designation not set')}
                            </span>
                          </td>
                          <td className="cell-wrap">
                            <strong className="cell-strong">{batch.batch_number}</strong>
                            <br />
                            <span className="cell-muted">{formatDate(batch.expiry_date)}</span>
                            <br />
                            <span className="cell-muted">{days === null ? 'Remaining days: N/A' : `Remaining days: ${days}`}</span>
                          </td>
                          <td className="cell-wrap">
                            <strong className="cell-strong">{batch.stock_location.name}</strong>
                            <br />
                            <span className="cell-muted">{batch.stock_location.code}</span>
                          </td>
                          <td className="cell-number">{formatNumber(batch.available_quantity)}</td>
                          <td className="cell-number">{formatRwf(batch.unit_cost)}</td>
                          <td className="cell-number">{formatNumber(defaultMargin)}%</td>
                          <td className="cell-number">{formatRwf(computedSellingPrice)}</td>
                          <td className="cell-wrap">
                            <strong className="cell-strong">{batch.status}</strong>
                            <br />
                            <span className="cell-muted">{expiryStatus(days)}</span>
                          </td>
                          <td className="table-cell-actions">{renderBatchActions(batch)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeInventoryView === 'locations' && locations && (
            <section className="inventory-section inventory-section--stock-locations">
              {renderTableToolbar({
                title: 'Stock Locations',
                subtitle: 'Managed branch stores, shelves, counters, quarantine areas and storage points.',
                selectedCount: 0,
                onExport: () =>
                  exportCsv(
                    'stock-locations.csv',
                    ['SN', 'Location', 'Code', 'Type', 'Branch', 'Linked Batches', 'Status', 'Recommended Action'],
                    filteredStockLocations.map((location, index) => [
                      index + 1,
                      location.name,
                      location.code,
                      location.location_type,
                      location.branch?.name ?? '',
                      location.stock_batches_count,
                      location.status,
                      stockLocationAiRecommendation(location),
                    ]),
                  ),
                onBulkEdit: () => markAction('Select a stock location row, then use Edit. Bulk location editing will follow the same audit rule.'),
                onBulkDelete: () => markAction('Delete is controlled per location to protect linked stock batches and audit history.'),
                extra: <button type="button" onClick={openStockLocationCreate}>Create new</button>,
              })}

              <div className="inventory-action-card-grid inventory-action-card-grid--title-only stock-location-action-cards">
                {[
                  ['create', 'Create New Location'],
                  ['edit', 'Edit from Row'],
                  ['replace', 'Replace from Row'],
                  ['delete', 'Delete from Row'],
                ].map(([action, label]) => (
                  <button
                    key={action}
                    type="button"
                    className={activeStockLocationAction === action ? 'active' : ''}
                    onClick={() => {
                      if (action === 'create') {
                        openStockLocationCreate();
                        return;
                      }

                      setInventoryNotice(`Choose a Stock Locations row, then click ${label.replace(' from Row', '')}.`);
                    }}
                  >
                    <strong>{label}</strong>
                  </button>
                ))}
              </div>

              {renderStockLocationActionPanel()}

              <div className="low-stock-trigger-note">
                <strong>Management rule:</strong>
                <span>
                  Locations with linked batches remain protected. Create a replacement and move batches before deleting the old location.
                </span>
              </div>

              {renderAdminTableManagement('stock-locations', 'Stock Locations')}

              <div className={`${inventoryTableShellClass('stock-locations')} stock-location-table-shell`} style={inventoryTableShellStyle('stock-locations') as any}>
                <table className="inventory-data-table inventory-data-table--stock-locations">
                  <colgroup>
                    <col className="col-sn" />
                    <col className="col-location" />
                    <col className="col-code" />
                    <col className="col-type" />
                    <col className="col-branch" />
                    <col className="col-number" />
                    <col className="col-status" />
                    <col className="col-recommendation" />
                    <col className="col-actions" />
                  </colgroup>

                  <thead>
                    <tr>
                      <th>SN</th>
                      <th>Location</th>
                      <th>Code</th>
                      <th>Type</th>
                      <th>Branch</th>
                      <th className="cell-number">Batches</th>
                      <th>Status</th>
                      <th>Recommended Action</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagedStockLocations.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="cell-center">
                          No stock locations match the current search.
                        </td>
                      </tr>
                    ) : (
                      pagedStockLocations.map((location, index) => (
                        <tr
                          key={location.id}
                          className={location.status === 'inactive' ? 'stock-location-row--inactive' : undefined}
                        >
                          <td className="cell-center">{index + 1}</td>
                          <td className="cell-wrap">
                            <strong className="cell-strong">{location.name}</strong>
                            <br />
                            <span className="cell-muted">
                              {Number(location.stock_batches_count || 0) > 0 ? 'In use' : 'No linked batch'}
                            </span>
                          </td>
                          <td className="cell-nowrap">{location.code}</td>
                          <td className="cell-wrap">{location.location_type.replaceAll('_', ' ')}</td>
                          <td className="cell-wrap">
                            <strong className="cell-strong">{location.branch?.name ?? 'Branch not set'}</strong>
                            <br />
                            <span className="cell-muted">{location.branch?.code ?? 'No branch code'}</span>
                          </td>
                          <td className="cell-number">{formatNumber(location.stock_batches_count)}</td>
                          <td className="cell-center">
                            <span className={`inventory-table-chip inventory-table-chip--${location.status === 'active' ? 'active' : 'inactive'}`}>
                              {location.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="cell-wrap">{stockLocationAiRecommendation(location)}</td>
                          <td className="table-cell-actions">{renderStockLocationActions(location)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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


function ManagedInventoryTableBlock({
  tableKey,
  title,
  children,
  extraClassName = '',
}: {
  tableKey: InventoryTableKey;
  title: string;
  children: React.ReactNode;
  extraClassName?: string;
}) {
  const [settingsByKey, setSettingsByKey] = useState<Record<string, InventoryTableSettings>>({});

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const saved = window.localStorage.getItem(INVENTORY_TABLE_SETTINGS_STORAGE_KEY);

    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved);

      if (parsed && typeof parsed === 'object') {
        setSettingsByKey(parsed);
      }
    } catch {
      window.localStorage.removeItem(INVENTORY_TABLE_SETTINGS_STORAGE_KEY);
    }
  }, []);

  const settings: InventoryTableSettings = {
    ...defaultInventoryTableSettings,
    ...(settingsByKey[tableKey] ?? {}),
  };

  function updateSetting<K extends keyof InventoryTableSettings>(
    field: K,
    value: InventoryTableSettings[K],
  ) {
    setSettingsByKey((current) => ({
      ...current,
      [tableKey]: {
        ...defaultInventoryTableSettings,
        ...(current[tableKey] ?? {}),
        [field]: value,
      },
    }));
  }

  function saveSettings() {
    const next = {
      ...settingsByKey,
      [tableKey]: settings,
    };

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(INVENTORY_TABLE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    }

    setSettingsByKey(next);
  }

  function resetSettings() {
    setSettingsByKey((current) => {
      const next = { ...current };
      delete next[tableKey];

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(INVENTORY_TABLE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
      }

      return next;
    });
  }

  const shellClassName = [
    'inventory-table-shell',
    extraClassName,
    `inventory-table-style--${settings.style}`,
    `inventory-table-density--${settings.density}`,
    `inventory-table-width--${settings.widthPreset}`,
    settings.wrapText ? 'inventory-table-wrap--on' : 'inventory-table-wrap--off',
    settings.stickyHeader ? 'inventory-table-sticky-header' : 'inventory-table-no-sticky-header',
    settings.stickyActions ? 'inventory-table-sticky-actions' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const shellStyle = {
    '--inventory-table-font-size': `${settings.fontSize}px`,
    '--inventory-table-cell-padding-y': settings.density === 'compact' ? '8px' : settings.density === 'tall' ? '17px' : '13px',
    '--inventory-table-cell-padding-x': settings.density === 'compact' ? '10px' : '14px',
  } as React.CSSProperties;

  return (
    <>
      <div className="inventory-table-management-panel">
        <div>
          <strong>Table Management</strong>
          <span>{title} layout controls for Admin.</span>
        </div>

        <label>
          Style
          <select value={settings.style} onChange={(event) => updateSetting('style', event.target.value as InventoryTableStyle)}>
            <option value="clean">Clean</option>
            <option value="striped">Striped</option>
            <option value="bordered">Bordered</option>
          </select>
        </label>

        <label>
          Font
          <input type="range" min="12" max="16" value={settings.fontSize} onChange={(event) => updateSetting('fontSize', Number(event.target.value))} />
          <small>{settings.fontSize}px</small>
        </label>

        <label>
          Density
          <select value={settings.density} onChange={(event) => updateSetting('density', event.target.value as InventoryTableDensity)}>
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="tall">Tall</option>
          </select>
        </label>

        <label>
          Column width
          <select value={settings.widthPreset} onChange={(event) => updateSetting('widthPreset', event.target.value as InventoryColumnWidthPreset)}>
            <option value="compact">Compact</option>
            <option value="balanced">Balanced</option>
            <option value="wide">Wide</option>
          </select>
        </label>

        <label className="inventory-table-toggle">
          <input type="checkbox" checked={settings.wrapText} onChange={(event) => updateSetting('wrapText', event.target.checked)} />
          Wrap text
        </label>

        <label className="inventory-table-toggle">
          <input type="checkbox" checked={settings.stickyHeader} onChange={(event) => updateSetting('stickyHeader', event.target.checked)} />
          Sticky header
        </label>

        <label className="inventory-table-toggle">
          <input type="checkbox" checked={settings.stickyActions} onChange={(event) => updateSetting('stickyActions', event.target.checked)} />
          Sticky actions
        </label>

        <div className="inventory-table-management-actions">
          <button type="button" className="primary" onClick={saveSettings}>
            Save table settings
          </button>
          <button type="button" onClick={resetSettings}>
            Reset
          </button>
        </div>
      </div>

      <div className={shellClassName} style={shellStyle}>
        {children}
      </div>
    </>
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
    <ManagedInventoryTableBlock tableKey="product-master" title="Product Master">
      <table className="inventory-data-table inventory-data-table--product-master">
        <colgroup>
          <col className="col-sn" />
          <col className="col-code" />
          <col className="col-product" />
          <col className="col-product" />
          <col className="col-product" />
          <col className="col-type" />
          <col className="col-number" />
          <col className="col-number" />
          <col className="col-category" />
          <col className="col-type" />
          <col className="col-category" />
          <col className="col-category" />
          <col className="col-number" />
          <col className="col-status" />
          <col className="col-actions" />
        </colgroup>

        <thead>
          <tr>
            <th>SN</th>
            <th>Drug Code</th>
            <th>Generic Description</th>
            <th>Designation</th>
            <th>Instructions</th>
            <th>Selling Unit</th>
            <th className="cell-number">Regulatory Price</th>
            <th className="cell-number">Product Margin Rate</th>
            <th>Category</th>
            <th>Source</th>
            <th>Section</th>
            <th>Subsection</th>
            <th className="cell-number">Re-order Level</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={15} className="cell-center">
                No products found.
              </td>
            </tr>
          ) : (
            rows.map((product, index) => {
              const nearestBatch = nearestBatchForProduct(product.id, batches);

              return (
                <tr key={product.id}>
                  <td className="cell-center">{index + 1}</td>
                  <td className="cell-nowrap">{product.sku}</td>
                  <td className="cell-wrap">{product.generic_name ?? 'Not set'}</td>
                  <td className="cell-wrap">
                    <strong className="cell-strong">{product.name}</strong>
                  </td>
                  <td className="cell-wrap">{metadataText(product, ['rhia_instructions'], 'Not set')}</td>
                  <td className="cell-wrap">{metadataText(product, ['rhia_selling_unit'], product.unit)}</td>
                  <td className="cell-number">{formatRwf(regulatoryPrice(product))}</td>
                  <td className="cell-number">{formatNumber(productMarginRate(product))}%</td>
                  <td className="cell-wrap">{product.category?.name ?? 'Uncategorised'}</td>
                  <td className="cell-wrap">{metadataText(product, ['source'], 'Product Master')}</td>
                  <td className="cell-wrap">{metadataText(product, ['rhia_section'], product.category?.name ?? 'Uncategorised')}</td>
                  <td className="cell-wrap">{metadataText(product, ['rhia_subsection'], 'Not set')}</td>
                  <td className="cell-number">{formatNumber(product.reorder_level)}</td>
                  <td className="cell-center">
                    <span className={`inventory-table-chip inventory-table-chip--${product.status === 'active' ? 'active' : 'inactive'}`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="table-cell-actions">{onAction(product, nearestBatch)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </ManagedInventoryTableBlock>
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
    <ManagedInventoryTableBlock tableKey="batch-expiry" title="Batch Table">
      <table className="inventory-data-table inventory-data-table--generic">
        <colgroup>
          <col className="col-sn" />
          <col className="col-product" />
          <col className="col-code" />
          <col className="col-location" />
          <col className="col-number" />
          <col className="col-date" />
          <col className="col-days" />
          <col className="col-product" />
          {showRecommendedAction && <col className="col-recommendation" />}
          <col className="col-actions" />
        </colgroup>

        <thead>
          <tr>
            <th className="cell-center">
              <input
                type="checkbox"
                checked={rows.length > 0 && selectedBatchIds.length === rows.length}
                onChange={onSelectAll}
              />
            </th>
            <th>Product</th>
            <th>Batch</th>
            <th>Location</th>
            <th className="cell-number">Available</th>
            <th>Expiry</th>
            <th className="cell-number">Remaining days</th>
            <th>Supplier</th>
            {showRecommendedAction && <th>Recommended action</th>}
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={showRecommendedAction ? 10 : 9} className="cell-center">
                No batch records found.
              </td>
            </tr>
          ) : (
            rows.map((batch) => {
              const days = remainingDays(batch.expiry_date);

              return (
                <tr key={batch.id} className={managedExpiryRiskClass(days)}>
                  <td className="cell-center">
                    <input
                      type="checkbox"
                      checked={selectedBatchIds.includes(batch.id)}
                      onChange={() => onToggleBatch(batch.id)}
                    />
                  </td>
                  <td className="cell-wrap">
                    <strong className="cell-strong">{batch.product.name}</strong>
                    <br />
                    <span className="cell-muted">{batch.product.sku}</span>
                  </td>
                  <td className="cell-nowrap">{batch.batch_number}</td>
                  <td className="cell-wrap">
                    {batch.stock_location.name}
                    <br />
                    <span className="cell-muted">{batch.stock_location.code}</span>
                  </td>
                  <td className="cell-number">{formatNumber(batch.available_quantity)}</td>
                  <td className="cell-nowrap">{formatDate(batch.expiry_date)}</td>
                  <td className="cell-number">{days === null ? 'N/A' : days}</td>
                  <td className="cell-wrap">
                    {batch.supplier_name ?? 'Not set'}
                    <br />
                    <span className="cell-muted">{expiryStatus(days)}</span>
                  </td>
                  {showRecommendedAction && <td className="cell-wrap">{expiryAction(days)}</td>}
                  <td className="table-cell-actions">{onAction(batch)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </ManagedInventoryTableBlock>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  AccessProfile,
  PharmaInventoryBatchesResponse,
  PharmaInventoryLocationsResponse,
  PharmaInventorySummaryResponse,
  PharmaProductsResponse,
  getPharmaInventoryBatches,
  getPharmaInventoryLocations,
  getPharmaInventorySummary,
  getPharmaProducts,
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
  | 'locations';

const inventoryViews: Array<{
  key: InventoryView;
  label: string;
  description: string;
}> = [
  { key: 'overview', label: 'Overview Summary', description: 'Inventory summary only' },
  { key: 'low-stock', label: 'Low Stock Watch List', description: 'Products below reorder level' },
  { key: 'shelf', label: 'Retail Product Shelf', description: 'Shelf-ready product view' },
  { key: 'batches', label: 'Batch and Expiry Preview', description: 'Batch and FEFO register' },
  { key: 'near-expiry', label: 'Near Expiry Watch List', description: 'Expiry risk within 180 days' },
  { key: 'product-master', label: 'Product Master', description: 'Product register and product actions' },
  { key: 'locations', label: 'Stock Locations', description: 'Branch stock storage points' },
];

const inventoryPageDescriptions: Record<InventoryView, string> = {
  overview: 'Summary of stock health only. Detailed lists stay in their own pages.',
  'low-stock': 'Products below reorder or minimum stock level. Reorder action belongs here.',
  shelf: 'Retail shelf view for searchable products, customer-facing price, stock and category filters.',
  batches: 'Batch, expiry, FEFO, supplier reference, cost and selling price review.',
  'near-expiry': 'Batches approaching expiry and actions for manager/pharmacist review.',
  'product-master': 'Product master, create product, edit product, receive stock and bulk tools.',
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
  { key: 'stock-units', label: 'Stock Units', target: 'overview' },
  { key: 'stock-value', label: 'Stock Value', target: 'overview' },
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

function formatRwf(value: number): string {
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

export function ProductInventoryPreview({ token, profile, activeView, onActiveViewChange, showInternalNavigation = true }: ProductInventoryPreviewProps) {
  const [summary, setSummary] = useState<PharmaInventorySummaryResponse | null>(null);
  const [products, setProducts] = useState<PharmaProductsResponse | null>(null);
  const [locations, setLocations] = useState<PharmaInventoryLocationsResponse | null>(null);
  const [batches, setBatches] = useState<PharmaInventoryBatchesResponse | null>(null);
  const [nearExpiryBatches, setNearExpiryBatches] = useState<PharmaInventoryBatchesResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [internalInventoryView, setInternalInventoryView] = useState<InventoryView>('overview');
  const [expandedViews, setExpandedViews] = useState<Partial<Record<InventoryView, boolean>>>({});
  const [inventoryNotice, setInventoryNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [inventorySmartCardVisibility, setInventorySmartCardVisibility] = useState<Record<InventorySmartCardKey, boolean>>(loadStoredInventorySmartCardVisibility);
  const [inventorySmartCardFieldVisibility, setInventorySmartCardFieldVisibility] = useState<Record<InventorySmartCardKey, Record<InventorySmartCardField, boolean>>>(loadStoredInventorySmartCardFieldVisibility);

  const activeInventoryView = activeView ?? internalInventoryView;
  const activeInventoryMeta = inventoryViews.find((view) => view.key === activeInventoryView) ?? inventoryViews[0];

  function selectInventoryView(view: InventoryView) {
    if (onActiveViewChange) {
      onActiveViewChange(view);
      return;
    }

    setInternalInventoryView(view);
  }


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

  const visibleProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return (products?.products ?? [])
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
  }, [activeCategory, products, searchTerm]);

  function preferredPrice(productId: number): string {
    const batch = (batches?.batches ?? [])
      .filter((entry) => entry.product.id === productId && entry.selling_price !== null)
      .sort((left, right) => {
        const leftExpiry = left.expiry_date ? new Date(left.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
        const rightExpiry = right.expiry_date ? new Date(right.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;

        return leftExpiry - rightExpiry;
      })[0];

    return batch?.selling_price === null || batch?.selling_price === undefined
      ? 'Price pending'
      : formatRwf(batch.selling_price);
  }

  function openFullRegister(view: InventoryView) {
    selectInventoryView(view);
    setExpandedViews((current) => ({ ...current, [view]: true }));
    setInventoryNotice(`${inventoryViews.find((item) => item.key === view)?.label ?? 'Register'} opened in full register mode.`);
  }

  function markBulkAction(action: string) {
    setInventoryNotice(`${action} is ready for the selected register. Product-level execution remains controlled by user permissions and backend validation.`);
  }

  async function loadInventoryPreview() {
    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    setIsLoading(true);
    setError('');
    setInventoryNotice('');

    try {
      const [summaryResponse, productsResponse, locationsResponse, batchesResponse, nearExpiryResponse] =
        await Promise.all([
          getPharmaInventorySummary(token, tenantSlug),
          getPharmaProducts(token, tenantSlug),
          getPharmaInventoryLocations(token, tenantSlug),
          getPharmaInventoryBatches(token, tenantSlug),
          getPharmaInventoryBatches(token, tenantSlug, 180),
        ]);

      setSummary(summaryResponse);
      setProducts(productsResponse);
      setLocations(locationsResponse);
      setBatches(batchesResponse);
      setNearExpiryBatches(nearExpiryResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load product and inventory preview.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInventoryPreview();
  }, [tenantSlug, token]);

  useEffect(() => {
    localStorage.setItem(inventorySmartCardStorageKey, JSON.stringify(inventorySmartCardVisibility));
  }, [inventorySmartCardVisibility]);

  useEffect(() => {
    localStorage.setItem(inventorySmartCardFieldStorageKey, JSON.stringify(inventorySmartCardFieldVisibility));
  }, [inventorySmartCardFieldVisibility]);



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
          status: 'On-hand stock',
          target: 'overview' as InventoryView,
          trendSeed: summary.summary.total_quantity_on_hand,
        },
        'stock-value': {
          value: formatRwf(summary.summary.estimated_stock_value),
          status: 'Estimated value',
          target: 'overview' as InventoryView,
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


  return (
    <article className="panel wide inventory-preview-panel">
      <div className="panel-heading-row">
        <div>
          <h2>{activeInventoryMeta.label}</h2>
          <p className="muted">{inventoryPageDescriptions[activeInventoryView]}</p>
        </div>

        <button type="button" onClick={loadInventoryPreview} disabled={isLoading}>
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

        <div className="module-section-stage">
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
                    <span>Operational signals prepared for demand, reorder, expiry, and margin models.</span>
                  </div>
                  <button type="button" onClick={() => openFullRegister('low-stock')}>Review watchlists</button>
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

          {activeInventoryView === 'low-stock' && summary && (
            <section className="inventory-section">
              <div className="section-heading">
                <div>
                  <h3>Low-stock watchlist</h3>
                  <span>Based on current quantity vs reorder level</span>
                </div>
                <BulkActionButtons
                  onExport={() => markBulkAction('Low-stock export')}
                  onBulkEdit={() => markBulkAction('Low-stock bulk edit')}
                  onBulkDelete={() => markBulkAction('Low-stock bulk delete')}
                />
              </div>

              {summary.low_stock_products.length === 0 ? (
                <p className="muted">No seeded products are currently below their reorder level.</p>
              ) : (
                <div className="inventory-table">
                  {summary.low_stock_products
                    .slice(0, expandedViews['low-stock'] ? summary.low_stock_products.length : 5)
                    .map((product) => (
                      <div key={product.id}>
                        <strong>{product.name}</strong>
                        <span>{product.sku}</span>
                        <span>Available: {formatNumber(product.stock_summary?.available_quantity ?? 0)}</span>
                        <small>Reorder: {formatNumber(product.reorder_level)}</small>
                      </div>
                    ))}
                </div>
              )}

              {summary.low_stock_products.length > 5 && !expandedViews['low-stock'] && (
                <button className="view-more-button" type="button" onClick={() => openFullRegister('low-stock')}>
                  View full low-stock register
                </button>
              )}
            </section>
          )}

          {activeInventoryView === 'shelf' && products && (
            <section className="inventory-section product-shelf-section">
              <div className="section-heading">
                <div>
                  <h3>Retail product shelf</h3>
                  <span>{visibleProducts.length} visible of {products.products.length} products</span>
                </div>
                <button type="button" onClick={() => openFullRegister('product-master')}>Open product master</button>
              </div>

              <div className="inventory-filter-bar">
                <label>
                  Search product, SKU, barcode
                  <input
                    value={searchTerm}
                    placeholder="Search medicines and health products"
                    onChange={(event) => setSearchTerm(event.target.value)}
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

              <div className="product-shelf-grid product-shelf-grid--fixed">
                {visibleProducts.slice(0, expandedViews.shelf ? visibleProducts.length : 10).map((product) => (
                  <article key={product.id}>
                    <div className="product-shelf-card-header">
                      <span className={product.requires_prescription ? 'rx-chip' : 'otc-chip'}>
                        {product.requires_prescription ? 'RX' : 'OTC'}
                      </span>
                      {product.stock_summary?.is_below_reorder_level && <span className="risk-chip">Low stock</span>}
                    </div>
                    <strong>{product.name}</strong>
                    <span>{product.generic_name || product.brand_name || product.dosage_form || product.sku}</span>
                    <small>{product.category?.name ?? 'Uncategorised'} · SKU {product.sku}</small>
                    <footer>
                      <span>{preferredPrice(product.id)}</span>
                      <strong>{formatNumber(product.stock_summary?.available_quantity ?? 0)} {product.unit}</strong>
                    </footer>
                  </article>
                ))}
              </div>

              {visibleProducts.length > 10 && !expandedViews.shelf && (
                <button className="view-more-button" type="button" onClick={() => openFullRegister('shelf')}>
                  View full shelf
                </button>
              )}
            </section>
          )}

          {activeInventoryView === 'batches' && batches && (
            <section className="inventory-section">
              <div className="section-heading">
                <div>
                  <h3>Batch and expiry preview</h3>
                  <span>Sorted by expiry date from the inventory API</span>
                </div>
                <BulkActionButtons
                  onExport={() => markBulkAction('Batch export')}
                  onBulkEdit={() => markBulkAction('Batch bulk edit')}
                  onBulkDelete={() => markBulkAction('Batch bulk delete')}
                />
              </div>

              <div className="inventory-table batch-preview-table">
                {batches.batches.slice(0, expandedViews.batches ? batches.batches.length : 5).map((batch) => (
                  <div key={batch.id}>
                    <strong>{batch.product.name}</strong>
                    <span>{batch.batch_number}</span>
                    <span>{batch.stock_location.code}</span>
                    <span>Expiry: {formatDate(batch.expiry_date)}</span>
                    <small>Available: {formatNumber(batch.available_quantity)}</small>
                  </div>
                ))}
              </div>

              {batches.batches.length > 5 && !expandedViews.batches && (
                <button className="view-more-button" type="button" onClick={() => openFullRegister('batches')}>
                  View full batch register
                </button>
              )}
            </section>
          )}

          {activeInventoryView === 'near-expiry' && nearExpiryBatches && (
            <section className="inventory-section">
              <div className="section-heading">
                <div>
                  <h3>Near-expiry watchlist</h3>
                  <span>Batches expiring within 180 days</span>
                </div>
                <BulkActionButtons
                  onExport={() => markBulkAction('Near-expiry export')}
                  onBulkEdit={() => markBulkAction('Near-expiry bulk edit')}
                  onBulkDelete={() => markBulkAction('Near-expiry bulk delete')}
                />
              </div>

              {nearExpiryBatches.batches.length === 0 ? (
                <p className="muted">No batches are currently within the 180-day expiry watch window.</p>
              ) : (
                <div className="inventory-table batch-preview-table">
                  {nearExpiryBatches.batches
                    .slice(0, expandedViews['near-expiry'] ? nearExpiryBatches.batches.length : 5)
                    .map((batch) => (
                      <div key={batch.id}>
                        <strong>{batch.product.name}</strong>
                        <span>{batch.batch_number}</span>
                        <span>{batch.stock_location.code}</span>
                        <span>Expiry: {formatDate(batch.expiry_date)}</span>
                        <small>Available: {formatNumber(batch.available_quantity)}</small>
                      </div>
                    ))}
                </div>
              )}

              {nearExpiryBatches.batches.length > 5 && !expandedViews['near-expiry'] && (
                <button className="view-more-button" type="button" onClick={() => openFullRegister('near-expiry')}>
                  View full near-expiry register
                </button>
              )}
            </section>
          )}

          {activeInventoryView === 'product-master' && products && (
            <section className="inventory-section">
              <div className="section-heading">
                <div>
                  <h3>Product master and stock receiving actions</h3>
                  <span>15 rows by default with bulk controls for the full register.</span>
                </div>
                <BulkActionButtons
                  onExport={() => markBulkAction('Product master export')}
                  onBulkEdit={() => markBulkAction('Product master bulk edit')}
                  onBulkDelete={() => markBulkAction('Product master bulk delete')}
                />
              </div>

              <div className="inventory-action-card-grid">
                {['Create New Product', 'Edit Product', 'Receive Stock', 'Bulk Tools'].map((action) => (
                  <button key={action} type="button" onClick={() => markBulkAction(action)}>
                    <strong>{action}</strong>
                    <span>{action === 'Bulk Tools' ? 'Import, approve, edit, export, or delete controlled product records.' : 'Open the related inventory workflow.'}</span>
                  </button>
                ))}
              </div>

              <div className="inventory-master-table">
                <div className="inventory-master-table__header">
                  <strong>Product</strong>
                  <strong>SKU</strong>
                  <strong>Category</strong>
                  <strong>Type</strong>
                  <strong>Available</strong>
                  <strong>Unit</strong>
                </div>
                {products.products.slice(0, expandedViews['product-master'] ? products.products.length : 15).map((product) => (
                  <div key={product.id}>
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.generic_name ?? 'Generic name not set'}</small>
                    </span>
                    <span>{product.sku}</span>
                    <span>{product.category?.name ?? 'Uncategorised'}</span>
                    <span>{product.requires_prescription ? 'Prescription' : 'OTC/General'}</span>
                    <span>{formatNumber(product.stock_summary?.available_quantity ?? 0)}</span>
                    <span>{product.unit}</span>
                  </div>
                ))}
              </div>

              {products.products.length > 15 && !expandedViews['product-master'] && (
                <button className="view-more-button" type="button" onClick={() => openFullRegister('product-master')}>
                  View full product master
                </button>
              )}
            </section>
          )}

          {activeInventoryView === 'locations' && locations && (
            <section className="inventory-section">
              <div className="section-heading">
                <div>
                  <h3>Stock locations</h3>
                  <span>Branch-scoped stock storage points</span>
                </div>
                <BulkActionButtons
                  onExport={() => markBulkAction('Stock location export')}
                  onBulkEdit={() => markBulkAction('Stock location bulk edit')}
                  onBulkDelete={() => markBulkAction('Stock location bulk delete')}
                />
              </div>

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
    </article>
  );
}

function BulkActionButtons({
  onExport,
  onBulkEdit,
  onBulkDelete,
}: {
  onExport: () => void;
  onBulkEdit: () => void;
  onBulkDelete: () => void;
}) {
  return (
    <div className="bulk-action-row" aria-label="Bulk table actions">
      <button type="button" onClick={onBulkEdit}>Bulk edit</button>
      <button type="button" onClick={onExport}>Export</button>
      <button type="button" className="danger" onClick={onBulkDelete}>Bulk delete</button>
    </div>
  );
}

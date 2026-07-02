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
};

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

export function ProductInventoryPreview({ token, profile }: ProductInventoryPreviewProps) {
  const [summary, setSummary] = useState<PharmaInventorySummaryResponse | null>(null);
  const [products, setProducts] = useState<PharmaProductsResponse | null>(null);
  const [locations, setLocations] = useState<PharmaInventoryLocationsResponse | null>(null);
  const [batches, setBatches] = useState<PharmaInventoryBatchesResponse | null>(null);
  const [nearExpiryBatches, setNearExpiryBatches] = useState<PharmaInventoryBatchesResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

  async function loadInventoryPreview() {
    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    setIsLoading(true);
    setError('');

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

  return (
    <article className="panel wide inventory-preview-panel">
      <div className="panel-heading-row">
        <div>
          <h2>PharmaCo360 product master register and inventory snapshot</h2>
          <p className="muted">
            Tenant-scoped shelf view for products, stock locations, batches, low stock, and expiry exposure.
          </p>
        </div>

        <button type="button" onClick={loadInventoryPreview} disabled={isLoading}>
          {isLoading ? 'Loading...' : summary ? 'Refresh inventory' : 'Load inventory'}
        </button>
      </div>

      {isLoading && !summary && <p className="muted">Loading inventory automatically...</p>}

      {error && <div className="form-error">{error}</div>}

      {summary && (
        <>
          <section className="inventory-kpi-grid">
            <div>
              <span>Products</span>
              <strong>{summary.summary.products_count}</strong>
            </div>
            <div>
              <span>Categories</span>
              <strong>{summary.summary.product_categories_count}</strong>
            </div>
            <div>
              <span>Locations</span>
              <strong>{summary.summary.stock_locations_count}</strong>
            </div>
            <div>
              <span>Batches</span>
              <strong>{summary.summary.stock_batches_count}</strong>
            </div>
            <div>
              <span>Total stock units</span>
              <strong>{formatNumber(summary.summary.total_quantity_on_hand)}</strong>
            </div>
            <div>
              <span>Estimated stock value</span>
              <strong>{formatRwf(summary.summary.estimated_stock_value)}</strong>
            </div>
            <div>
              <span>Low-stock products</span>
              <strong>{summary.summary.low_stock_products_count}</strong>
            </div>
            <div>
              <span>Near expiry batches</span>
              <strong>{summary.summary.near_expiry_batches_180_days_count}</strong>
            </div>
          </section>

          <section className="inventory-section">
            <div className="section-heading">
              <h3>Low-stock watchlist</h3>
              <span>Based on current quantity vs reorder level</span>
            </div>

            {summary.low_stock_products.length === 0 ? (
              <p className="muted">No seeded products are currently below their reorder level.</p>
            ) : (
              <div className="inventory-table">
                {summary.low_stock_products.map((product) => (
                  <div key={product.id}>
                    <strong>{product.name}</strong>
                    <span>{product.sku}</span>
                    <span>Available: {formatNumber(product.stock_summary?.available_quantity ?? 0)}</span>
                    <small>Reorder: {formatNumber(product.reorder_level)}</small>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {products && (
        <section className="inventory-section product-shelf-section">
          <div className="section-heading">
            <div>
              <h3>Retail product shelf</h3>
              <span>{visibleProducts.length} visible of {products.products.length} products</span>
            </div>
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

          <div className="product-shelf-grid">
            {visibleProducts.slice(0, 12).map((product) => (
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
        </section>
      )}

      {locations && (
        <section className="inventory-section">
          <div className="section-heading">
            <h3>Stock locations</h3>
            <span>Branch-scoped stock storage points</span>
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

      {batches && (
        <section className="inventory-section">
          <div className="section-heading">
            <h3>Batch and expiry preview</h3>
            <span>Sorted by expiry date from the inventory API</span>
          </div>

          <div className="inventory-table batch-preview-table">
            {batches.batches.slice(0, 6).map((batch) => (
              <div key={batch.id}>
                <strong>{batch.product.name}</strong>
                <span>{batch.batch_number}</span>
                <span>{batch.stock_location.code}</span>
                <span>Expiry: {formatDate(batch.expiry_date)}</span>
                <small>Available: {formatNumber(batch.available_quantity)}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {nearExpiryBatches && (
        <section className="inventory-section">
          <div className="section-heading">
            <h3>Near-expiry watchlist</h3>
            <span>Batches expiring within 180 days</span>
          </div>

          {nearExpiryBatches.batches.length === 0 ? (
            <p className="muted">No batches are currently within the 180-day expiry watch window.</p>
          ) : (
            <div className="inventory-table batch-preview-table">
              {nearExpiryBatches.batches.map((batch) => (
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
        </section>
      )}
    </article>
  );
}

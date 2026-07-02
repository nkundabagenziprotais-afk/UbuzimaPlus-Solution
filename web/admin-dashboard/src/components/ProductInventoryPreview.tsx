import { useState } from 'react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const tenantSlug =
    profile.tenant_assignments?.[0]?.tenant?.slug ||
    (profile.scope.is_tenant ? 'vitapharma' : '');

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

  return (
    <article className="panel wide inventory-preview-panel">
      <div className="panel-heading-row">
        <div>
          <h2>PharmaCo360 product master register and inventory snapshot</h2>
          <p className="muted">
            Read-only tenant-scoped register of products, stock locations, batches, and expiry exposure.
          </p>
        </div>

        <button type="button" onClick={loadInventoryPreview} disabled={isLoading}>
          {isLoading ? 'Loading…' : 'Load inventory snapshot'}
        </button>
      </div>

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

          <section className="inventory-section inventory-formula-panel">
            <div className="section-heading">
              <h3>Inventory formulas and stock health</h3>
              <span>Cost value, retail value, margin exposure, low stock, and expiry controls</span>
            </div>

            <div className="inventory-formula-grid">
              <div>
                <span>Stock cost value</span>
                <strong>{formatRwf(summary.summary.estimated_stock_cost_value ?? 0)}</strong>
                <small>Formula: quantity on hand × unit cost</small>
              </div>
              <div>
                <span>Stock retail value</span>
                <strong>{formatRwf(summary.summary.estimated_stock_retail_value ?? summary.summary.estimated_stock_value)}</strong>
                <small>Formula: quantity on hand × selling price</small>
              </div>
              <div>
                <span>Potential margin</span>
                <strong>{formatRwf(summary.summary.estimated_potential_margin_value ?? 0)}</strong>
                <small>Formula: retail value − cost value</small>
              </div>
              <div>
                <span>Expired batches</span>
                <strong>{summary.summary.expired_batches_count ?? 0}</strong>
                <small>Control: expiry date before today</small>
              </div>
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
        <section className="inventory-section">
          <div className="section-heading">
            <h3>Product master register</h3>
            <span>First {Math.min(products.products.length, 6)} of {products.products.length} products</span>
          </div>

          <div className="inventory-table-wrap product-master-table-wrap">
            <table className="inventory-master-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Available</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {products.products.slice(0, 6).map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      <small>{product.generic_name ?? 'Generic name not set'}</small>
                    </td>
                    <td>{product.sku}</td>
                    <td>{product.category?.name ?? 'Uncategorised'}</td>
                    <td>{product.requires_prescription ? 'Prescription' : 'OTC/General'}</td>
                    <td>{formatNumber(product.stock_summary?.available_quantity ?? 0)}</td>
                    <td>{product.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

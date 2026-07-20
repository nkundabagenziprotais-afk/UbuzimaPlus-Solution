type UnknownRecord = Record<string, unknown>;

const API_BASE = '/api/v1';

function businessOverviewSalesEndpoint(): string {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    per_page: '100',
    limit: '100',
    page: '1',
    business_date_from: startOfMonth,
    business_date_to: today,
    date_from: startOfMonth,
    date_to: today,
  });

  return `/pharmaco/sales?${params.toString()}`;
}

function fetchBusinessOverviewJson(
  token: string,
  tenantSlug: string,
  endpoint: string,
  label: string,
  timeoutMs = 10000,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open('GET', `${API_BASE}${endpoint}`, true);
    request.timeout = timeoutMs;
    request.setRequestHeader('Accept', 'application/json');
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.setRequestHeader('X-Tenant', tenantSlug);
    request.setRequestHeader('X-Tenant-Slug', tenantSlug);

    request.onload = () => {
      const bodyText = request.responseText || '';

      let body: unknown = bodyText;
      try {
        body = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        body = bodyText;
      }

      if (request.status < 200 || request.status >= 300) {
        reject(
          new Error(
            `${label} failed with HTTP ${request.status}: ${
              typeof body === 'string' ? body.slice(0, 180) : JSON.stringify(body).slice(0, 180)
            }`,
          ),
        );
        return;
      }

      resolve(body);
    };

    request.onerror = () => {
      reject(new Error(`${label} network request failed.`));
    };

    request.ontimeout = () => {
      reject(new Error(`${label} request timed out after ${timeoutMs / 1000}s`));
    };

    request.send();
  });
}

export type BusinessOverviewLiveRow = {
  label: string;
  value: string;
};

export type BusinessOverviewProductRow = {
  name: string;
  value: string;
  percent: number;
};

export type BusinessOverviewPaymentMixRow = {
  label: string;
  value: string;
  percent: number;
};

export type BusinessOverviewTrendPoint = {
  label: string;
  value: number;
};

export type BusinessOverviewLiveData = {
  loaded: boolean;
  salesLoaded: boolean;
  inventoryLoaded: boolean;
  error: string | null;
  kpis: Record<string, string>;
  kpiHelpers: Record<string, string>;
  revenueRows: BusinessOverviewLiveRow[];
  inventoryRows: BusinessOverviewLiveRow[];
  paymentMix: BusinessOverviewPaymentMixRow[];
  topProducts: BusinessOverviewProductRow[];
  trend: BusinessOverviewTrendPoint[];
};

const moneyFormatter = new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat('en-RW', { maximumFractionDigits: 1 });

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function asArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const cleaned = value
      .replace(/[^0-9.-]/g, '')
      .trim();

    if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return 0;

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function firstNumber(record: UnknownRecord, keys: string[]): number {
  for (const key of keys) {
    const value = numberValue(record[key]);
    if (value !== 0) return value;
  }
  return 0;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function formatMoney(value: number): string {
  return moneyFormatter.format(Math.round(value));
}

function formatCount(value: number): string {
  return moneyFormatter.format(Math.round(value));
}

function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}

function saleDateKey(sale: UnknownRecord): string {
  const raw =
    stringValue(sale.business_date) ||
    stringValue(sale.sold_at) ||
    stringValue(sale.created_at);

  if (!raw) return 'Unknown';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);

  return date.toISOString().slice(0, 10);
}

function paymentMethodLabel(method: string): string {
  const normalized = method.toLowerCase();
  if (normalized === 'momo' || normalized.includes('mobile')) return 'Mobile Money';
  if (normalized.includes('card')) return 'Card';
  if (normalized.includes('insurance')) return 'Insurance';
  if (normalized.includes('credit')) return 'Credit';
  if (normalized.includes('bank')) return 'Bank';
  if (normalized.includes('cash')) return 'Cash';
  return method ? method.replace(/_/g, ' ') : 'Other';
}

function isCompletedPayment(payment: UnknownRecord): boolean {
  const status = stringValue(payment.status, 'completed').toLowerCase();
  return ['completed', 'paid', 'success', 'successful', 'settled'].includes(status);
}

function isVoidedOrReturnedSale(sale: UnknownRecord): boolean {
  const status = `${stringValue(sale.status)} ${stringValue(sale.payment_status)} ${stringValue(sale.sale_type)}`.toLowerCase();
  return status.includes('void') || status.includes('return') || status.includes('refund') || status.includes('reversal') || status.includes('cancel');
}

function saleTotal(sale: UnknownRecord): number {
  return (
    numberValue(sale.total_amount) ||
    numberValue(sale.net_amount) ||
    numberValue(sale.grand_total) ||
    numberValue(sale.total) ||
    numberValue(sale.amount)
  );
}

function saleDiscount(sale: UnknownRecord): number {
  return numberValue(sale.discount_amount) || numberValue(sale.discount_total) || numberValue(sale.discount);
}

function salePaidAmount(sale: UnknownRecord): number {
  return numberValue(sale.paid_amount);
}

function salePaymentMethod(sale: UnknownRecord): string {
  return (
    stringValue(sale.payment_method) ||
    stringValue(sale.payment_mode) ||
    stringValue(sale.collection_method) ||
    stringValue(sale.payment_type) ||
    'Other'
  );
}

function isHistoricalSale(sale: UnknownRecord): boolean {
  return (
    String(sale.is_historical ?? '').toLowerCase() === 'true' ||
    stringValue(sale.entry_mode).toLowerCase() === 'historical'
  );
}

function extractSales(response: unknown): UnknownRecord[] {
  const record = asRecord(response);
  const data = asRecord(record.data);
  const payload = asRecord(record.payload);
  const result = asRecord(record.result);

  const candidates = [
    record.sales,
    data.sales,
    payload.sales,
    result.sales,
    record.transactions,
    data.transactions,
    payload.transactions,
    result.transactions,
    record.records,
    data.records,
    payload.records,
    result.records,
    record.items,
    data.items,
    payload.items,
    result.items,
    record.data,
  ];

  for (const candidate of candidates) {
    const rows = asArray(candidate);
    if (rows.length > 0) return rows;
  }

  return [];
}

function extractInventorySummary(response: unknown): UnknownRecord {
  const record = asRecord(response);
  const data = asRecord(record.data);
  const payload = asRecord(record.payload);
  const result = asRecord(record.result);

  return asRecord(
    record.summary && typeof record.summary === 'object'
      ? record.summary
      : data.summary && typeof data.summary === 'object'
        ? data.summary
        : payload.summary && typeof payload.summary === 'object'
          ? payload.summary
          : result.summary && typeof result.summary === 'object'
            ? result.summary
            : data && Object.keys(data).length
              ? data
              : record,
  );
}

function extractInventoryBatches(response: unknown): UnknownRecord[] {
  const record = asRecord(response);
  return (
    asArray(record.batches).length ? asArray(record.batches)
      : asArray(record.data).length ? asArray(record.data)
      : asArray(record.items)
  );
}

function buildTrend(sales: UnknownRecord[]): BusinessOverviewTrendPoint[] {
  const grouped = new Map<string, number>();

  for (const sale of sales) {
    if (isVoidedOrReturnedSale(sale)) continue;
    const key = saleDateKey(sale);
    grouped.set(key, (grouped.get(key) ?? 0) + saleTotal(sale));
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([label, value]) => ({ label, value }));
}

function buildTopProducts(sales: UnknownRecord[]): BusinessOverviewProductRow[] {
  const grouped = new Map<string, number>();

  for (const sale of sales) {
    if (isVoidedOrReturnedSale(sale)) continue;

    for (const item of asArray(sale.items)) {
      const product = asRecord(item.product);
      const name =
        stringValue(product.name) ||
        stringValue(item.product_name) ||
        stringValue(item.name) ||
        'Unspecified product';

      const value =
        numberValue(item.line_total) ||
        numberValue(item.total_amount) ||
        numberValue(item.total) ||
        numberValue(item.quantity) * numberValue(item.unit_price);

      grouped.set(name, (grouped.get(name) ?? 0) + value);
    }
  }

  const rows = [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = Math.max(...rows.map(([, value]) => value), 1);

  return rows.map(([name, value]) => ({
    name,
    value: formatMoney(value),
    percent: Math.max(6, Math.round((value / max) * 100)),
  }));
}

function batchQuantity(batch: UnknownRecord): number {
  return firstNumber(batch, [
    'quantity_on_hand',
    'available_quantity',
    'quantity_available',
    'current_quantity',
    'remaining_quantity',
    'stock_quantity',
    'quantity',
  ]);
}

function batchUnitValue(batch: UnknownRecord): number {
  return firstNumber(batch, [
    'selling_price',
    'retail_price',
    'unit_price',
    'unit_cost',
    'cost_price',
    'purchase_price',
    'cost',
  ]);
}

function batchInventoryValue(batch: UnknownRecord): number {
  return (
    firstNumber(batch, ['stock_value', 'inventory_value', 'retail_value', 'cost_value', 'total_value']) ||
    batchQuantity(batch) * batchUnitValue(batch)
  );
}

function batchExpiryDate(batch: UnknownRecord): Date | null {
  const raw =
    stringValue(batch.expiry_date) ||
    stringValue(batch.expires_at) ||
    stringValue(batch.expiration_date);

  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function productKeyForBatch(batch: UnknownRecord): string {
  const product = asRecord(batch.product);
  return (
    stringValue(product.id) ||
    stringValue(batch.product_id) ||
    stringValue(product.name) ||
    stringValue(batch.product_name) ||
    stringValue(batch.id)
  );
}

function productLowStockThreshold(batch: UnknownRecord): number {
  const product = asRecord(batch.product);
  return (
    firstNumber(product, ['minimum_stock_level', 'reorder_level', 'minimum_quantity']) ||
    firstNumber(batch, ['minimum_stock_level', 'reorder_level', 'minimum_quantity'])
  );
}

function computeBatchFallback(batches: UnknownRecord[]) {
  const now = new Date();
  const nearExpiryLimit = new Date(now);
  nearExpiryLimit.setDate(nearExpiryLimit.getDate() + 180);

  let inventoryValue = 0;
  let totalQuantity = 0;
  let expired = 0;
  let nearExpiry = 0;

  const quantityByProduct = new Map<string, number>();
  const thresholdByProduct = new Map<string, number>();

  for (const batch of batches) {
    const quantity = batchQuantity(batch);
    totalQuantity += quantity;
    inventoryValue += batchInventoryValue(batch);

    const expiry = batchExpiryDate(batch);
    if (expiry) {
      if (expiry < now) expired += 1;
      else if (expiry <= nearExpiryLimit) nearExpiry += 1;
    }

    const productKey = productKeyForBatch(batch);
    const threshold = productLowStockThreshold(batch);

    if (productKey) {
      quantityByProduct.set(productKey, (quantityByProduct.get(productKey) ?? 0) + quantity);
      if (threshold > 0) thresholdByProduct.set(productKey, threshold);
    }
  }

  let lowStock = 0;
  for (const [productKey, quantity] of quantityByProduct.entries()) {
    const threshold = thresholdByProduct.get(productKey) ?? 0;
    if (threshold > 0 && quantity <= threshold) lowStock += 1;
  }

  return {
    inventoryValue,
    totalQuantity,
    stockBatches: batches.length,
    expired,
    nearExpiry,
    lowStock,
  };
}

export function emptyBusinessOverviewLiveData(): BusinessOverviewLiveData {
  return {
    loaded: false,
    salesLoaded: false,
    inventoryLoaded: false,
    error: null,
    kpis: {},
    kpiHelpers: {},
    revenueRows: [
      'Gross Sales',
      'Discounts',
      'Returns / Reversals',
      'Net Sales',
      'Collections',
      'Credit Sales',
      'Insurance Sales',
      'Net Cash Inflow',
    ].map((label) => ({ label, value: '—' })),
    inventoryRows: [
      'Total Inventory Value',
      'Total Quantity On Hand',
      'Stock Batches',
      'Low Stock Items',
      'Expiring Items',
      'Expired Batches',
    ].map((label) => ({ label, value: '—' })),
    paymentMix: [],
    topProducts: [],
    trend: [],
  };
}

export async function loadBusinessOverviewLiveData(
  token: string,
  tenantSlug?: string | null,
): Promise<BusinessOverviewLiveData> {
  const empty = emptyBusinessOverviewLiveData();

  if (!token) {
    return {
      ...empty,
      loaded: true,
      error: 'Authentication is required to load live dashboard data.',
    };
  }

  if (!tenantSlug) {
    return {
      ...empty,
      loaded: true,
      error: 'Tenant context is required to load live dashboard data.',
    };
  }

  let salesLoaded = false;
  let inventorySummaryLoaded = false;
  let inventoryBatchesLoaded = false;
  const errors: string[] = [];

  let sales: UnknownRecord[] = [];
  let inventorySummary: UnknownRecord = {};
  let inventoryBatches: UnknownRecord[] = [];

  // Sales is the primary Business Overview source and must not be blocked by inventory.
  try {
    const salesResponse = await fetchBusinessOverviewJson(
      token,
      tenantSlug,
      businessOverviewSalesEndpoint(),
      'Sales register',
      25000,
    );

    sales = extractSales(salesResponse);
    salesLoaded = true;
  } catch (err) {
    errors.push(
      err instanceof Error
        ? err.message
        : 'Unable to load live and historical POS sales.',
    );
  }

  // Inventory summary endpoint is currently too slow for the customer-facing dashboard.
  // Do not call it during initial Business Overview rendering.
  // Inventory values stay unavailable until a lightweight backend summary endpoint is added.
  inventorySummaryLoaded = false;
  inventorySummary = {};
  errors.push('Inventory summary is temporarily unavailable while the live inventory summary endpoint is optimized.');

  // Do not load full inventory batches in Business Overview initial render.
  inventoryBatchesLoaded = false;
  inventoryBatches = [];

  const validSales = sales.filter((sale) => !isVoidedOrReturnedSale(sale));
  const returnedSales = sales.filter(isVoidedOrReturnedSale);

  const grossSales = validSales.reduce((sum, sale) => sum + saleTotal(sale), 0);
  const discounts = validSales.reduce((sum, sale) => sum + saleDiscount(sale), 0);
  const returns = returnedSales.reduce((sum, sale) => sum + saleTotal(sale), 0);
  const netSales = Math.max(grossSales - discounts - returns, 0);

  const paymentGrouped = new Map<string, number>();
  let collections = 0;

  for (const sale of validSales) {
    const completedPayments = asArray(sale.payments).filter(isCompletedPayment);

    if (completedPayments.length > 0) {
      for (const payment of completedPayments) {
        const amount = numberValue(payment.amount);
        collections += amount;
        const label = paymentMethodLabel(stringValue(payment.payment_method, 'Other'));
        paymentGrouped.set(label, (paymentGrouped.get(label) ?? 0) + amount);
      }
    } else {
      const amount = salePaidAmount(sale);
      collections += amount;

      if (amount > 0) {
        const label = paymentMethodLabel(salePaymentMethod(sale));
        paymentGrouped.set(label, (paymentGrouped.get(label) ?? 0) + amount);
      }
    }
  }

  const outstandingBalance = Math.max(netSales - collections, 0);

  const creditSales = validSales
    .filter((sale) => stringValue(sale.payment_status).toLowerCase().includes('credit'))
    .reduce((sum, sale) => sum + saleTotal(sale), 0);

  const insuranceSales = validSales
    .filter((sale) => stringValue(sale.sale_type).toLowerCase().includes('insurance'))
    .reduce((sum, sale) => sum + saleTotal(sale), 0);

  const paymentTotal = Math.max(collections, 1);
  const paymentMix = [...paymentGrouped.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({
      label,
      value: formatPercent((amount / paymentTotal) * 100),
      percent: Math.round((amount / paymentTotal) * 100),
    }));

  const trend = buildTrend(validSales);
  const topProducts = buildTopProducts(validSales);

  const batchFallback = computeBatchFallback(inventoryBatches);

  const summaryInventoryValue =
    numberValue(inventorySummary.estimated_stock_value) ||
    numberValue(inventorySummary.estimated_stock_retail_value) ||
    numberValue(inventorySummary.estimated_stock_cost_value);

  const inventoryValue = summaryInventoryValue || batchFallback.inventoryValue;
  const totalQuantity = numberValue(inventorySummary.total_quantity_on_hand) || batchFallback.totalQuantity;
  const stockBatches = numberValue(inventorySummary.stock_batches_count) || batchFallback.stockBatches;
  const lowStock = numberValue(inventorySummary.low_stock_products_count) || batchFallback.lowStock;
  const nearExpiry = numberValue(inventorySummary.near_expiry_batches_180_days_count) || batchFallback.nearExpiry;
  const expired = numberValue(inventorySummary.expired_batches_count) || batchFallback.expired;

  const inventoryLoaded = inventorySummaryLoaded || inventoryBatchesLoaded;

  const livePosCount = validSales.filter((sale) => !isHistoricalSale(sale)).length;
  const historicalPosCount = validSales.filter(isHistoricalSale).length;

  return {
    loaded: true,
    salesLoaded,
    inventoryLoaded,
    error: errors.length ? errors.join(' ') : null,
    kpis: {
      'Gross Revenue': salesLoaded ? formatMoney(grossSales) : '—',
      'Net Revenue': salesLoaded ? formatMoney(netSales) : '—',
      Collections: salesLoaded ? formatMoney(collections) : '—',
      'Outstanding Balance': salesLoaded ? formatMoney(outstandingBalance) : '—',
      'Transaction Count': salesLoaded ? formatCount(validSales.length) : '—',
      'Average Transaction Value': salesLoaded && validSales.length ? formatMoney(netSales / validSales.length) : '—',
      'Live POS Sales': salesLoaded ? formatCount(livePosCount) : '—',
      'Historical POS Sales': salesLoaded ? formatCount(historicalPosCount) : '—',
      'Gross Profit': '—',
      'Estimated Net Profit': '—',
      'Operating Expenses': '—',
      'Expense / Revenue Ratio': '—',
      'Break-even Daily Cash': '—',
      'Daily Cash for Revenue Goal': '—',
      'Daily Cash for Profit Goal': '—',
      'Cash Variance': '—',
      'Inventory Value': inventoryLoaded ? formatMoney(inventoryValue) : '—',
      'Low Stock Items': inventoryLoaded ? formatCount(lowStock) : '—',
      'Expiring Items': inventoryLoaded ? formatCount(nearExpiry) : '—',
    },
    kpiHelpers: {
      'Gross Revenue': salesLoaded ? 'Live and Historical POS sales register' : 'Sales source unavailable',
      'Net Revenue': salesLoaded ? 'Sales less discounts and reversals' : 'Sales source unavailable',
      Collections: salesLoaded ? 'Completed payments or paid amount from Live/Historical POS' : 'Payment source unavailable',
      'Outstanding Balance': salesLoaded ? 'Sales value not yet collected' : 'Receivable source unavailable',
      'Inventory Value': inventoryLoaded ? 'Inventory summary with batch-register fallback' : 'Inventory source unavailable',
      'Low Stock Items': inventoryLoaded ? 'Inventory summary or batch threshold fallback' : 'Inventory source unavailable',
      'Expiring Items': inventoryLoaded ? 'Inventory summary or batch expiry fallback' : 'Inventory source unavailable',
    },
    revenueRows: [
      { label: 'Gross Sales', value: salesLoaded ? formatMoney(grossSales) : '—' },
      { label: 'Discounts', value: salesLoaded ? formatMoney(discounts) : '—' },
      { label: 'Returns / Reversals', value: salesLoaded ? formatMoney(returns) : '—' },
      { label: 'Net Sales', value: salesLoaded ? formatMoney(netSales) : '—' },
      { label: 'Collections', value: salesLoaded ? formatMoney(collections) : '—' },
      { label: 'Credit Sales', value: salesLoaded ? formatMoney(creditSales) : '—' },
      { label: 'Insurance Sales', value: salesLoaded ? formatMoney(insuranceSales) : '—' },
      { label: 'Net Cash Inflow', value: salesLoaded ? formatMoney(collections) : '—' },
    ],
    inventoryRows: [
      { label: 'Total Inventory Value', value: inventoryLoaded ? formatMoney(inventoryValue) : '—' },
      { label: 'Total Quantity On Hand', value: inventoryLoaded ? formatCount(totalQuantity) : '—' },
      { label: 'Stock Batches', value: inventoryLoaded ? formatCount(stockBatches) : '—' },
      { label: 'Low Stock Items', value: inventoryLoaded ? formatCount(lowStock) : '—' },
      { label: 'Expiring Items', value: inventoryLoaded ? formatCount(nearExpiry) : '—' },
      { label: 'Expired Batches', value: inventoryLoaded ? formatCount(expired) : '—' },
    ],
    paymentMix,
    topProducts,
    trend,
  };
}

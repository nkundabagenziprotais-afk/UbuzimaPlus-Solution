type UnknownRecord = Record<string, unknown>;

const API_BASE = '/api/v1';

function businessOverviewSalesSummaryEndpoint(): string {
  // Use backend default reporting period.
  // Verified live: /pharmaco/reports/sales-summary returns the current operational sales window.
  return '/pharmaco/reports/sales-summary';
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

function extractSalesSummary(response: unknown): UnknownRecord {
  const record = asRecord(response);
  const data = asRecord(record.data);
  const payload = asRecord(record.payload);
  const result = asRecord(record.result);

  return asRecord(
    record.sales && typeof record.sales === 'object'
      ? record.sales
      : data.sales && typeof data.sales === 'object'
        ? data.sales
        : payload.sales && typeof payload.sales === 'object'
          ? payload.sales
          : result.sales && typeof result.sales === 'object'
            ? result.sales
            : data && Object.keys(data).length
              ? data
              : record,
  );
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

  try {
    const salesSummaryResponse = await fetchBusinessOverviewJson(
      token,
      tenantSlug,
      businessOverviewSalesSummaryEndpoint(),
      'Sales summary report',
      12000,
    );

    const salesSummary = extractSalesSummary(salesSummaryResponse);
    const paymentMethods = asArray(salesSummary.payment_methods);

    const grossSales = firstNumber(salesSummary, [
      'total_sales_amount',
      'gross_sales',
      'sales_total',
      'total_amount',
      'total_sales',
    ]);

    const discounts = firstNumber(salesSummary, [
      'discount_amount',
      'discounts',
      'discount_total',
      'total_discount',
    ]);

    const returns = firstNumber(salesSummary, [
      'returns_amount',
      'reversal_amount',
      'refund_amount',
      'returned_amount',
    ]);

    const netSales = firstNumber(salesSummary, [
      'net_sales_amount',
      'net_sales',
      'net_revenue',
    ]) || Math.max(grossSales - discounts - returns, 0);

    const grossRevenue = firstNumber(salesSummary, [
      'gross_revenue',
      'gross_profit',
      'gross_margin',
      'margin_income',
      'profit_amount',
    ]) || Math.max(netSales, 0);

    const collections = firstNumber(salesSummary, [
      'payments_collected',
      'paid_amount',
      'collections_total',
      'collected_amount',
    ]);

    const outstandingBalance = firstNumber(salesSummary, [
      'balance_amount',
      'open_balance',
      'outstanding_balance',
    ]) || Math.max(netSales - collections, 0);

    const transactionCount = firstNumber(salesSummary, [
      'sale_count',
      'transaction_count',
      'transactions',
      'sales_count',
    ]);

    const averageTransactionValue = transactionCount > 0 ? netSales / transactionCount : 0;
    const paymentTotal = Math.max(collections, 1);

    const paymentMix = paymentMethods
      .map((method) => {
        const label = paymentMethodLabel(stringValue(method.payment_method, 'Other'));
        const amount = firstNumber(method, ['total_amount', 'amount', 'paid_amount']);

        return {
          label,
          value: formatPercent((amount / paymentTotal) * 100),
          percent: Math.round((amount / paymentTotal) * 100),
        };
      })
      .filter((row) => row.percent > 0);

    const inventoryRows = empty.inventoryRows;

    return {
      loaded: true,
      salesLoaded: true,
      inventoryLoaded: false,
      error: null,
      kpis: {
        'Gross Sales': formatMoney(grossSales),
        'Gross Revenue': formatMoney(grossRevenue),
        'Net Revenue': formatMoney(netSales),
        Collections: formatMoney(collections),
        'Outstanding Balance': formatMoney(outstandingBalance),
        'Transaction Count': formatCount(transactionCount),
        'Average Transaction Value': transactionCount ? formatMoney(averageTransactionValue) : '—',
        'Live POS Sales': formatCount(transactionCount),
        'Historical POS Sales': '—',
        'Gross Profit': '—',
        'Estimated Net Profit': '—',
        'Operating Expenses': '—',
        'Expense / Revenue Ratio': '—',
        'Break-even Daily Cash': '—',
        'Daily Cash for Revenue Goal': '—',
        'Daily Cash for Profit Goal': '—',
        'Cash Variance': '—',
        'Inventory Value': '—',
        'Low Stock Items': '—',
        'Expiring Items': '—',
      },
      kpiHelpers: {
        'Gross Sales': 'Aggregated live sales summary report',
        'Gross Revenue': 'Gross revenue or margin signal from live sales summary',
        'Net Revenue': 'Sales summary total after available adjustments',
        Collections: 'Payments collected from sales summary report',
        'Outstanding Balance': 'Balance amount from sales summary report',
        'Inventory Value': 'Inventory summary pending optimized live endpoint',
        'Low Stock Items': 'Inventory summary pending optimized live endpoint',
        'Expiring Items': 'Inventory summary pending optimized live endpoint',
      },
      revenueRows: [
        { label: 'Gross Sales', value: formatMoney(grossSales) },
        { label: 'Gross Revenue', value: formatMoney(grossRevenue) },
        { label: 'Discounts', value: formatMoney(discounts) },
        { label: 'Returns / Reversals', value: formatMoney(returns) },
        { label: 'Net Sales', value: formatMoney(netSales) },
        { label: 'Collections', value: formatMoney(collections) },
        { label: 'Credit Sales', value: '—' },
        { label: 'Insurance Sales', value: '—' },
        { label: 'Net Cash Inflow', value: formatMoney(collections) },
      ],
      inventoryRows,
      paymentMix,
      topProducts: [],
      trend: [],
    };
  } catch (err) {
    return {
      ...empty,
      loaded: true,
      error: err instanceof Error
        ? err.message
        : 'Unable to load Business Overview sales summary.',
    };
  }
}

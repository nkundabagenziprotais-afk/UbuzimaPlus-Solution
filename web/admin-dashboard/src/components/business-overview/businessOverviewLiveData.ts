import {
  getPharmaInventorySummary,
  getPharmaSales,
} from '../../lib/api';

type UnknownRecord = Record<string, unknown>;

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

const moneyFormatter = new Intl.NumberFormat('en-RW', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('en-RW', {
  maximumFractionDigits: 1,
});

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function asArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
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

function paymentDateKey(payment: UnknownRecord, sale: UnknownRecord): string {
  const raw =
    stringValue(payment.business_date) ||
    stringValue(sale.business_date) ||
    stringValue(payment.received_at) ||
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
  const status = `${stringValue(sale.status)} ${stringValue(sale.payment_status)}`.toLowerCase();
  return status.includes('void') || status.includes('return') || status.includes('refund') || status.includes('reversal');
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

function extractSales(response: unknown): UnknownRecord[] {
  const record = asRecord(response);
  return (
    asArray(record.sales).length ? asArray(record.sales)
      : asArray(record.data).length ? asArray(record.data)
      : asArray(record.items)
  );
}

function extractInventorySummary(response: unknown): UnknownRecord {
  const record = asRecord(response);
  return asRecord(record.summary && typeof record.summary === 'object' ? record.summary : record);
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
    const items = asArray(sale.items);

    for (const item of items) {
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

  const rows = [...grouped.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const max = Math.max(...rows.map(([, value]) => value), 1);

  return rows.map(([name, value]) => ({
    name,
    value: formatMoney(value),
    percent: Math.max(6, Math.round((value / max) * 100)),
  }));
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

  let salesLoaded = false;
  let inventoryLoaded = false;
  let error: string | null = null;

  let sales: UnknownRecord[] = [];
  let inventorySummary: UnknownRecord = {};

  try {
    const salesResponse = await getPharmaSales(token, tenantSlug ?? undefined);
    sales = extractSales(salesResponse);
    salesLoaded = true;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unable to load live sales data.';
  }

  try {
    const inventoryResponse = await getPharmaInventorySummary(token, tenantSlug ?? undefined);
    inventorySummary = extractInventorySummary(inventoryResponse);
    inventoryLoaded = true;
  } catch (err) {
    error = error ?? (err instanceof Error ? err.message : 'Unable to load live inventory data.');
  }

  const validSales = sales.filter((sale) => !isVoidedOrReturnedSale(sale));
  const returnedSales = sales.filter(isVoidedOrReturnedSale);

  const grossSales = validSales.reduce((sum, sale) => sum + saleTotal(sale), 0);
  const discounts = validSales.reduce((sum, sale) => sum + saleDiscount(sale), 0);
  const returns = returnedSales.reduce((sum, sale) => sum + saleTotal(sale), 0);
  const netSales = Math.max(grossSales - discounts - returns, 0);

  const completedPayments = validSales.flatMap((sale) =>
    asArray(sale.payments)
      .filter(isCompletedPayment)
      .map((payment) => ({ payment, sale })),
  );

  const collections = completedPayments.reduce((sum, row) => sum + numberValue(row.payment.amount), 0);
  const outstandingBalance = Math.max(netSales - collections, 0);

  const creditSales = validSales
    .filter((sale) => stringValue(sale.payment_status).toLowerCase().includes('credit'))
    .reduce((sum, sale) => sum + saleTotal(sale), 0);

  const insuranceSales = validSales
    .filter((sale) => stringValue(sale.sale_type).toLowerCase().includes('insurance'))
    .reduce((sum, sale) => sum + saleTotal(sale), 0);

  const paymentGrouped = new Map<string, number>();
  for (const { payment } of completedPayments) {
    const label = paymentMethodLabel(stringValue(payment.payment_method, 'Other'));
    paymentGrouped.set(label, (paymentGrouped.get(label) ?? 0) + numberValue(payment.amount));
  }

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

  const inventoryValue =
    numberValue(inventorySummary.estimated_stock_value) ||
    numberValue(inventorySummary.estimated_stock_retail_value) ||
    numberValue(inventorySummary.estimated_stock_cost_value);

  const lowStock = numberValue(inventorySummary.low_stock_products_count);
  const nearExpiry = numberValue(inventorySummary.near_expiry_batches_180_days_count);
  const expired = numberValue(inventorySummary.expired_batches_count);

  return {
    loaded: true,
    salesLoaded,
    inventoryLoaded,
    error,
    kpis: {
      'Gross Revenue': salesLoaded ? formatMoney(grossSales) : '—',
      'Net Revenue': salesLoaded ? formatMoney(netSales) : '—',
      Collections: salesLoaded ? formatMoney(collections) : '—',
      'Outstanding Balance': salesLoaded ? formatMoney(outstandingBalance) : '—',
      'Transaction Count': salesLoaded ? formatCount(validSales.length) : '—',
      'Average Transaction Value': salesLoaded && validSales.length ? formatMoney(netSales / validSales.length) : '—',
      'Items Sold': salesLoaded ? formatCount(validSales.reduce((sum, sale) => sum + asArray(sale.items).reduce((inner, item) => inner + numberValue(item.quantity), 0), 0)) : '—',
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
      'Gross Revenue': salesLoaded ? 'Live sales register' : 'Live sales source unavailable',
      'Net Revenue': salesLoaded ? 'Sales less discounts and reversals' : 'Live sales source unavailable',
      Collections: salesLoaded ? 'Completed POS payments' : 'Live payment source unavailable',
      'Outstanding Balance': salesLoaded ? 'Sales value not yet collected' : 'Live receivable source unavailable',
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
      { label: 'Low Stock Items', value: inventoryLoaded ? formatCount(lowStock) : '—' },
      { label: 'Expiring Items', value: inventoryLoaded ? formatCount(nearExpiry) : '—' },
      { label: 'Expired Batches', value: inventoryLoaded ? formatCount(expired) : '—' },
    ],
    paymentMix,
    topProducts,
    trend,
  };
}

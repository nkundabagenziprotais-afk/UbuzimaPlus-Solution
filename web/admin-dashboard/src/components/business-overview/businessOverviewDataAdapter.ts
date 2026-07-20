import {
  emptyBusinessOverviewLiveData,
  type BusinessOverviewLiveData,
  type BusinessOverviewPaymentMixRow,
  type BusinessOverviewTrendPoint,
} from './businessOverviewLiveData';

type UnknownRecord = Record<string, unknown>;

type AdapterInput = {
  token: string;
  tenantSlug: string;
  startDate: string;
  endDate: string;
};

type SalesPayment = {
  amount?: number | string;
  payment_method?: string;
  status?: string;
};

type SaleRow = {
  business_date?: string;
  sold_at?: string;
  created_at?: string;
  status?: string;
  payment_status?: string;
  sale_type?: string;
  total_amount?: number | string;
  grand_total?: number | string;
  net_amount?: number | string;
  paid_amount?: number | string;
  balance_amount?: number | string;
  discount_amount?: number | string;
  payments?: SalesPayment[];
};

type InventoryValuationResponse = {
  inventory?: {
    batch_count?: number | string;
    product_count?: number | string;
    total_quantity_on_hand?: number | string;
    total_cost_value?: number | string;
    total_retail_value?: number | string;
    low_stock_batches?: number | string;
    expired_batches?: number | string;
    expiring_soon_batches?: number | string;
    healthy_stock_batches?: number | string;
    low_stock_value?: number | string;
    expired_value?: number | string;
    expiring_soon_value?: number | string;
    healthy_stock_value?: number | string;
  };
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
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
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

function paymentLabel(value: unknown): string {
  const raw = String(value ?? 'Other');
  const normalized = raw.toLowerCase();

  if (normalized === 'momo' || normalized.includes('mobile')) return 'Mobile Money';
  if (normalized.includes('cash')) return 'Cash';
  if (normalized.includes('card')) return 'Card';
  if (normalized.includes('bank')) return 'Bank';
  if (normalized.includes('insurance')) return 'Insurance';
  if (normalized.includes('credit')) return 'Credit';

  return raw.replace(/_/g, ' ');
}

async function fetchTenantJson<T>(
  token: string,
  tenantSlug: string,
  path: string,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Tenant': tenantSlug,
      'X-Tenant-Slug': tenantSlug,
    },
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof asRecord(json).message === 'string'
        ? String(asRecord(json).message)
        : `${path} failed with HTTP ${response.status}`,
    );
  }

  return json as T;
}

function buildSalesSummaryEndpoint(startDate: string, endDate: string): string {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    business_date_from: startDate,
    business_date_to: endDate,
    date_basis: 'business_date',
  });

  return `/pharmaco/reports/sales-summary?${params.toString()}`;
}

function buildSalesRegisterEndpoint(startDate: string, endDate: string): string {
  const params = new URLSearchParams({
    per_page: '500',
    limit: '500',
    page: '1',
    business_date_from: startDate,
    business_date_to: endDate,
    date_from: startDate,
    date_to: endDate,
    start_date: startDate,
    end_date: endDate,
    date_basis: 'business_date',
  });

  return `/pharmaco/sales?${params.toString()}`;
}

function buildInventoryEndpoint(asOfDate: string): string {
  const params = new URLSearchParams({
    as_of_date: asOfDate,
    business_date: asOfDate,
    date_basis: 'business_date',
  });

  return `/pharmaco/reports/inventory-valuation?${params.toString()}`;
}

function extractSalesRows(response: unknown): SaleRow[] {
  const record = asRecord(response);
  const data = record.data;

  const candidates = [
    record.sales,
    record.items,
    record.records,
    data,
    asRecord(data).sales,
    asRecord(data).data,
    asRecord(record.payload).sales,
    asRecord(record.result).sales,
  ];

  for (const candidate of candidates) {
    const rows = asArray(candidate);
    if (rows.length > 0) return rows as SaleRow[];
  }

  return [];
}

function saleBusinessDate(sale: SaleRow): string {
  return String(sale.business_date || sale.sold_at || sale.created_at || '').slice(0, 10);
}

function saleTotal(sale: SaleRow): number {
  return (
    numberValue(sale.total_amount) ||
    numberValue(sale.grand_total) ||
    numberValue(sale.net_amount)
  );
}

function salePaid(sale: SaleRow): number {
  const explicitPaid = numberValue(sale.paid_amount);
  if (explicitPaid > 0) return explicitPaid;

  return (sale.payments ?? []).reduce((sum, payment) => sum + numberValue(payment.amount), 0);
}

function saleBalance(sale: SaleRow): number {
  const explicitBalance = numberValue(sale.balance_amount);
  if (explicitBalance > 0) return explicitBalance;

  return Math.max(saleTotal(sale) - salePaid(sale), 0);
}

function isActiveSale(sale: SaleRow): boolean {
  const status = String(sale.status ?? '').toLowerCase();
  return !status.includes('void') && !status.includes('cancel') && !status.includes('return');
}

function salesFromSummary(response: unknown, startDate: string, endDate: string) {
  const record = asRecord(response);
  const sales = asRecord(record.sales);

  const grossSales = numberValue(sales.total_sales_amount);
  const collections = numberValue(sales.payments_collected) || numberValue(sales.paid_amount);
  const outstandingBalance = numberValue(sales.balance_amount);
  const transactionCount = numberValue(sales.sale_count);
  const paymentMethods = asArray(sales.payment_methods);

  return {
    periodLabel: startDate === endDate ? startDate : `${startDate} → ${endDate}`,
    grossSales,
    netSales: grossSales,
    collections,
    outstandingBalance,
    transactionCount,
    averageTransactionValue: transactionCount > 0 ? grossSales / transactionCount : 0,
    paymentMethods,
    trend: [] as BusinessOverviewTrendPoint[],
  };
}

function salesFromRows(rows: SaleRow[], startDate: string, endDate: string) {
  const filtered = rows.filter((sale) => {
    const date = saleBusinessDate(sale);
    return isActiveSale(sale) && date >= startDate && date <= endDate;
  });

  const grossSales = filtered.reduce((sum, sale) => sum + saleTotal(sale), 0);
  const collections = filtered.reduce((sum, sale) => sum + salePaid(sale), 0);
  const outstandingBalance = filtered.reduce((sum, sale) => sum + saleBalance(sale), 0);
  const transactionCount = filtered.length;

  const paymentGroups = new Map<string, number>();
  const trendGroups = new Map<string, number>();

  for (const sale of filtered) {
    const date = saleBusinessDate(sale);
    trendGroups.set(date, (trendGroups.get(date) ?? 0) + saleTotal(sale));

    for (const payment of sale.payments ?? []) {
      const method = String(payment.payment_method ?? 'Other');
      paymentGroups.set(method, (paymentGroups.get(method) ?? 0) + numberValue(payment.amount));
    }
  }

  const paymentMethods = [...paymentGroups.entries()].map(([payment_method, total_amount]) => ({
    payment_method,
    total_amount,
  }));

  const trend = [...trendGroups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label: label.slice(5), value }));

  return {
    periodLabel: startDate === endDate ? startDate : `${startDate} → ${endDate}`,
    grossSales,
    netSales: grossSales,
    collections,
    outstandingBalance,
    transactionCount,
    averageTransactionValue: transactionCount > 0 ? grossSales / transactionCount : 0,
    paymentMethods,
    trend,
  };
}

function buildPaymentMix(paymentMethods: UnknownRecord[], collections: number): BusinessOverviewPaymentMixRow[] {
  const total = Math.max(collections, 1);

  return paymentMethods
    .map((method) => {
      const amount = numberValue(method.total_amount ?? method.amount ?? method.paid_amount);
      const percentage = (amount / total) * 100;

      return {
        label: paymentLabel(method.payment_method),
        value: formatPercent(percentage),
        percent: Math.round(percentage),
      };
    })
    .filter((row) => row.percent > 0);
}

function inventoryFromValuation(response: InventoryValuationResponse) {
  const inventory = response.inventory ?? {};

  const inventoryValue =
    numberValue(inventory.total_cost_value) || numberValue(inventory.total_retail_value);
  const stockBatches = numberValue(inventory.batch_count);
  const lowStock = numberValue(inventory.low_stock_batches);
  const expiring = numberValue(inventory.expiring_soon_batches);
  const expired = numberValue(inventory.expired_batches);
  const healthy = numberValue(inventory.healthy_stock_batches) || Math.max(stockBatches - lowStock - expiring - expired, 0);

  const lowStockValue = numberValue(inventory.low_stock_value);
  const expiringValue = numberValue(inventory.expiring_soon_value);
  const expiredValue = numberValue(inventory.expired_value);
  const healthyValue =
    numberValue(inventory.healthy_stock_value) ||
    Math.max(inventoryValue - lowStockValue - expiringValue - expiredValue, 0);

  return {
    inventoryValue,
    quantity: numberValue(inventory.total_quantity_on_hand),
    stockBatches,
    healthy,
    lowStock,
    expiring,
    expired,
    stockBatchValue: inventoryValue,
    healthyValue,
    lowStockValue,
    expiringValue,
    expiredValue,
  };
}

export async function loadBusinessOverviewDataAdapter({
  token,
  tenantSlug,
  startDate,
  endDate,
}: AdapterInput): Promise<BusinessOverviewLiveData> {
  const empty = emptyBusinessOverviewLiveData();

  if (!token || !tenantSlug) {
    return {
      ...empty,
      loaded: true,
      error: !token ? 'Authentication token is missing.' : 'Tenant slug is missing.',
    };
  }

  const [summaryResult, registerResult, inventoryResult] = await Promise.allSettled([
    fetchTenantJson<unknown>(token, tenantSlug, buildSalesSummaryEndpoint(startDate, endDate)),
    fetchTenantJson<unknown>(token, tenantSlug, buildSalesRegisterEndpoint(startDate, endDate)),
    fetchTenantJson<InventoryValuationResponse>(token, tenantSlug, buildInventoryEndpoint(endDate)),
  ]);

  if (summaryResult.status === 'rejected' && registerResult.status === 'rejected') {
    throw summaryResult.reason;
  }

  let sales =
    summaryResult.status === 'fulfilled'
      ? salesFromSummary(summaryResult.value, startDate, endDate)
      : salesFromRows([], startDate, endDate);

  if (sales.grossSales <= 0 && registerResult.status === 'fulfilled') {
    sales = salesFromRows(extractSalesRows(registerResult.value), startDate, endDate);
  }

  const inventory =
    inventoryResult.status === 'fulfilled'
      ? inventoryFromValuation(inventoryResult.value)
      : null;

  const inventoryLoaded = Boolean(inventory);
  const paymentMix = buildPaymentMix(sales.paymentMethods, sales.collections);

  return {
    loaded: true,
    salesLoaded: sales.grossSales > 0 || sales.transactionCount > 0,
    inventoryLoaded,
    error: inventoryResult.status === 'rejected' ? 'Inventory valuation source unavailable.' : null,
    kpis: {
      'Gross Revenue': formatMoney(sales.grossSales),
      'Net Revenue': formatMoney(sales.netSales),
      Collections: formatMoney(sales.collections),
      'Outstanding Balance': formatMoney(sales.outstandingBalance),
      'Transaction Count': formatCount(sales.transactionCount),
      'Average Transaction Value': sales.transactionCount ? formatMoney(sales.averageTransactionValue) : '—',
      'Live POS Sales': formatCount(sales.transactionCount),
      'Historical POS Sales': '—',
      'Gross Profit': '—',
      'Estimated Net Profit': '—',
      'Operating Expenses': '—',
      'Expense / Revenue Ratio': '—',
      'Break-even Daily Cash': '—',
      'Daily Cash for Revenue Goal': '—',
      'Daily Cash for Profit Goal': '—',
      'Cash Variance': '—',
      'Inventory Value': inventoryLoaded ? formatMoney(inventory!.inventoryValue) : '—',
      'Healthy Stock Value': inventoryLoaded ? formatMoney(inventory!.healthyValue) : '—',
      'Low Stock Value': inventoryLoaded ? formatMoney(inventory!.lowStockValue) : '—',
      'Near Expiry Value': inventoryLoaded ? formatMoney(inventory!.expiringValue) : '—',
      'Expired Stock Value': inventoryLoaded ? formatMoney(inventory!.expiredValue) : '—',
      'Low Stock Items': inventoryLoaded ? formatCount(inventory!.lowStock) : '—',
      'Expiring Items': inventoryLoaded ? formatCount(inventory!.expiring) : '—',
    },
    kpiHelpers: {
      'Gross Revenue': `Business Date ${sales.periodLabel}`,
      'Net Revenue': 'Business-date sales summary with register fallback',
      Collections: 'Collected payments for selected Business Date range',
      'Outstanding Balance': 'Uncollected sales balance for selected period',
      'Inventory Value': `Inventory valuation as of ${endDate}`,
      'Healthy Stock Value': 'Healthy stock value from inventory valuation or residual estimate',
      'Low Stock Value': 'Low stock value from inventory valuation',
      'Near Expiry Value': 'Near-expiry stock value from inventory valuation',
      'Expired Stock Value': 'Expired stock value from inventory valuation',
      'Low Stock Items': 'Count from inventory valuation',
      'Expiring Items': 'Count from inventory valuation',
    },
    revenueRows: [
      { label: 'Gross Sales', value: formatMoney(sales.grossSales) },
      { label: 'Discounts', value: formatMoney(0) },
      { label: 'Returns / Reversals', value: formatMoney(0) },
      { label: 'Net Sales', value: formatMoney(sales.netSales) },
      { label: 'Collections', value: formatMoney(sales.collections) },
      { label: 'Credit Sales', value: '—' },
      { label: 'Insurance Sales', value: '—' },
      { label: 'Net Cash Inflow', value: formatMoney(sales.collections) },
    ],
    inventoryRows: [
      { label: 'Total Inventory Value', value: inventoryLoaded ? formatMoney(inventory!.inventoryValue) : '—' },
      { label: 'Total Quantity On Hand', value: inventoryLoaded ? formatCount(inventory!.quantity) : '—' },
      { label: 'Stock Batches Count', value: inventoryLoaded ? formatCount(inventory!.stockBatches) : '—' },
      { label: 'Stock Batches Value', value: inventoryLoaded ? formatMoney(inventory!.stockBatchValue) : '—' },
      { label: 'Healthy Stock Count', value: inventoryLoaded ? formatCount(inventory!.healthy) : '—' },
      { label: 'Healthy Stock Value', value: inventoryLoaded ? formatMoney(inventory!.healthyValue) : '—' },
      { label: 'Low Stock Count', value: inventoryLoaded ? formatCount(inventory!.lowStock) : '—' },
      { label: 'Low Stock Value', value: inventoryLoaded ? formatMoney(inventory!.lowStockValue) : '—' },
      { label: 'Near Expiry Count', value: inventoryLoaded ? formatCount(inventory!.expiring) : '—' },
      { label: 'Near Expiry Value', value: inventoryLoaded ? formatMoney(inventory!.expiringValue) : '—' },
      { label: 'Expired Count', value: inventoryLoaded ? formatCount(inventory!.expired) : '—' },
      { label: 'Expired Value', value: inventoryLoaded ? formatMoney(inventory!.expiredValue) : '—' },
    ],
    paymentMix,
    topProducts: [],
    trend: sales.trend,
  };
}

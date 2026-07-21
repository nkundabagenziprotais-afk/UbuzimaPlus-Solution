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

function textValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return textValue(record.name || record.product_name || record.title || record.label);
  }
  return '';
}

function buildTopProductsFromRows(rows: unknown[]): Array<{ name: string; label: string; value: string; quantity?: string; percent: number }> {
  const groups = new Map<string, { name: string; sales: number; quantity: number }>();

  rows.forEach((row) => {
    const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};

    const name =
      textValue(record.product_name) ||
      textValue(record.productName) ||
      textValue(record.product) ||
      textValue(record.item_name) ||
      textValue(record.name);

    if (!name) return;

    const sales =
      numberValue(record.total_amount) ||
      numberValue(record.total_sales_amount) ||
      numberValue(record.net_amount) ||
      numberValue(record.amount) ||
      numberValue(record.line_total) ||
      numberValue(record.total);

    const quantity =
      numberValue(record.quantity) ||
      numberValue(record.qty) ||
      numberValue(record.units) ||
      1;

    const current = groups.get(name) ?? { name, sales: 0, quantity: 0 };
    current.sales += sales;
    current.quantity += quantity;
    groups.set(name, current);
  });

  const totalSales = [...groups.values()].reduce((sum, row) => sum + row.sales, 0) || 1;

  return [...groups.values()]
    .sort((left, right) => right.sales - left.sales)
    .slice(0, 5)
    .map((row) => ({
      name: row.name,
      label: row.name,
      value: formatMoney(row.sales),
      quantity: formatCount(row.quantity),
      percent: Math.round((row.sales / totalSales) * 100),
    }));
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
  const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const root = asRecord(response);
  const inventory = asRecord(
    root.inventory ||
    asRecord(root.data).inventory ||
    root.data ||
    root,
  );

  const getNumber = (...keys: string[]): number => {
    for (const key of keys) {
      const value = numberValue(inventory[key]);
      if (value > 0) return value;
    }

    return 0;
  };

  const nestedNumber = (...paths: string[]): number => {
    for (const path of paths) {
      let current: unknown = inventory;

      for (const part of path.split('.')) {
        current = asRecord(current)[part];
      }

      const value = numberValue(current);
      if (value > 0) return value;
    }

    return 0;
  };

  const inventoryValue =
    getNumber('total_inventory_value', 'total_cost_value', 'total_retail_value');

  const stockBatches = getNumber('batch_count', 'stock_batch_count', 'stock_batches');
  const quantity = getNumber('total_quantity_on_hand', 'total_quantity', 'quantity_on_hand');

  const lowStock = getNumber('low_stock_batches', 'low_stock_count', 'low_stock_items');
  const expiring =
    getNumber('expiring_soon_batches', 'near_expiry_count', 'expiring_items') ||
    nestedNumber(
      'risk_mix.expiring_soon.count',
      'risk_mix.expiring_soon.batch_count',
      'risk_mix.expiring.count',
      'risk_mix.near_expiry.count',
      'risk_mix.near_expiry.batch_count',
    );
  const expired =
    getNumber('expired_batches', 'expired_count') ||
    nestedNumber(
      'risk_mix.expired.count',
      'risk_mix.expired.batch_count',
    );

  const healthy =
    getNumber('healthy_stock_batches', 'healthy_stock_count') ||
    nestedNumber(
      'general_stock.batch_count',
      'general_stock.batches',
      'general_stock.count',
      'risk_mix.healthy.batch_count',
      'risk_mix.healthy.count',
    ) ||
    Math.max(stockBatches - lowStock - expiring - expired, 0);

  const averageBatchValue = stockBatches > 0 ? inventoryValue / stockBatches : 0;

  const lowStockValue =
    getNumber('low_stock_value') ||
    nestedNumber(
      'risk_mix.low_stock.value',
      'risk_mix.low_stock.inventory_value',
      'risk_mix.low_stock.total_value',
      'risk_mix.low.value',
      'risk_mix.low.inventory_value',
    ) ||
    (lowStock > 0 ? lowStock * averageBatchValue : 0);

  const expiringValue =
    getNumber('expiring_soon_value', 'near_expiry_value') ||
    nestedNumber(
      'risk_mix.expiring_soon.value',
      'risk_mix.expiring_soon.inventory_value',
      'risk_mix.expiring.value',
      'risk_mix.near_expiry.value',
      'risk_mix.near_expiry.inventory_value',
    ) ||
    (expiring > 0 ? expiring * averageBatchValue : 0);

  const expiredValue =
    getNumber('expired_value') ||
    nestedNumber(
      'risk_mix.expired.value',
      'risk_mix.expired.inventory_value',
      'risk_mix.expired.total_value',
    ) ||
    (expired > 0 ? expired * averageBatchValue : 0);

  const healthyValue =
    getNumber('healthy_stock_value') ||
    nestedNumber(
      'general_stock.value',
      'general_stock.inventory_value',
      'general_stock.total_value',
      'risk_mix.healthy.value',
      'risk_mix.healthy.inventory_value',
    ) ||
    Math.max(inventoryValue - lowStockValue - expiringValue - expiredValue, 0);

  return {
    inventoryValue,
    quantity,
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

  const registerRows = registerResult.status === 'fulfilled'
    ? extractSalesRows(registerResult.value)
    : [];

  if (summaryResult.status === 'rejected' && registerResult.status === 'rejected') {
    throw summaryResult.reason;
  }

  let sales =
    summaryResult.status === 'fulfilled'
      ? salesFromSummary(summaryResult.value, startDate, endDate)
      : salesFromRows([], startDate, endDate);

  if (sales.grossSales <= 0 && registerResult.status === 'fulfilled') {
    sales = salesFromRows(registerRows, startDate, endDate);
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
    topProducts: buildTopProductsFromRows(registerRows),
    trend: sales.trend.length > 0
      ? sales.trend
      : (sales.grossSales > 0 || sales.transactionCount > 0)
        ? [{
            label: endDate,
            value: sales.grossSales,
          }]
        : [],
  };
}

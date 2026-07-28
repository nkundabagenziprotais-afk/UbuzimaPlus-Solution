import {
  buildApiUrl,
  normalizeApiBaseUrl,
} from './apiBase';

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
);

async function getJsonWithTenant<T>(
  token: string,
  path: string,
  tenantSlug: string,
): Promise<T> {
  const response = await fetch(buildApiUrl(API_BASE_URL, path), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load PharmaCo360 tenant data.');
  }

  return data as T;
}

export type PharmaFinancePosShadowReconciliationFilters = {
  from?: string;
  to?: string;
  branch_id?: number | string;
  payment_method?: string;
};

export type PharmaFinancePaymentMethodBreakdown = {
  payment_method: string;
  pos_total: number;
  finance_shadow_total: number;
  difference: number;
};

export type PharmaFinancePosShadowReconciliationReport = {
  filters: {
    tenant_id: number;
    from: string | null;
    to: string | null;
    branch_id: number | null;
    payment_method: string | null;
  };
  summary: {
    pos_completed_payments_total: number;
    finance_shadow_payment_total: number;
    difference: number;
    missing_finance_postings_count: number;
    orphan_finance_shadow_postings_count: number;
    is_reconciled: boolean;
  };
  payment_methods: PharmaFinancePaymentMethodBreakdown[];
  details: {
    missing_payment_ids: Array<number | string>;
    orphan_finance_source_ids: Array<number | string>;
  };
};

export type PharmaFinancePosShadowReconciliationReportResponse = {
  data: PharmaFinancePosShadowReconciliationReport;
};

export type PharmaFinanceRevenueShadowPaymentMethodBreakdown = {
  payment_method: string;
  operational_payment_total: number;
  operational_allocated_revenue: number;
  operational_allocated_tax: number;
  finance_shadow_revenue: number;
  finance_shadow_tax: number;
  revenue_difference: number;
  tax_difference: number;
};

export type PharmaFinancePosRevenueShadowReport = {
  filters: {
    tenant_id: number;
    from: string | null;
    to: string | null;
    branch_id: number | null;
    payment_method: string | null;
  };
  basis: {
    mode: string;
    label: string;
    description: string;
  };
  summary: {
    operational_completed_payment_total: number;
    operational_allocated_revenue: number;
    operational_allocated_tax: number;
    finance_shadow_revenue: number;
    finance_shadow_tax: number;
    revenue_difference: number;
    tax_difference: number;
    is_reconciled: boolean;
    dashboard_source_status: string;
  };
  payment_methods: PharmaFinanceRevenueShadowPaymentMethodBreakdown[];
};

export type PharmaFinancePosRevenueShadowReportResponse = {
  data: PharmaFinancePosRevenueShadowReport;
};

export type PharmaFinanceReadinessHealthCheck = {
  label: string;
  status: string;
  details: Record<string, unknown>;
};

export type PharmaFinanceReadinessHealthReport = {
  mode: string;
  overall_status: string;
  dashboard_switch_status: string;
  filters: {
    tenant_id: number;
    from: string | null;
    to: string | null;
    branch_id: number | null;
  };
  summary: {
    blocking_failures: string[];
    checks_passed: number;
    checks_total: number;
  };
  checks: Record<string, PharmaFinanceReadinessHealthCheck>;
};

export type PharmaFinanceReadinessHealthReportResponse = {
  data: PharmaFinanceReadinessHealthReport;
};

function financePosShadowReconciliationQuery(
  filters?: PharmaFinancePosShadowReconciliationFilters,
): string {
  const params = new URLSearchParams();

  if (filters?.from) {
    params.set('from', filters.from);
  }

  if (filters?.to) {
    params.set('to', filters.to);
  }

  if (filters?.branch_id) {
    params.set('branch_id', String(filters.branch_id));
  }

  if (filters?.payment_method) {
    params.set('payment_method', filters.payment_method);
  }

  const query = params.toString();

  return query ? `?${query}` : '';
}

export async function getPharmaFinancePosShadowReconciliationReport(
  token: string,
  tenantSlug: string,
  filters?: PharmaFinancePosShadowReconciliationFilters,
): Promise<PharmaFinancePosShadowReconciliationReportResponse> {
  return getJsonWithTenant<PharmaFinancePosShadowReconciliationReportResponse>(
    token,
    `/pharmaco/finance/reports/pos-shadow-reconciliation${financePosShadowReconciliationQuery(filters)}`,
    tenantSlug,
  );
}

export async function getPharmaFinancePosRevenueShadowReport(
  token: string,
  tenantSlug: string,
  filters?: PharmaFinancePosShadowReconciliationFilters,
): Promise<PharmaFinancePosRevenueShadowReportResponse> {
  return getJsonWithTenant<PharmaFinancePosRevenueShadowReportResponse>(
    token,
    `/pharmaco/finance/reports/pos-revenue-shadow${financePosShadowReconciliationQuery(filters)}`,
    tenantSlug,
  );
}

export async function getPharmaFinanceReadinessHealthReport(
  token: string,
  tenantSlug: string,
  filters?: PharmaFinancePosShadowReconciliationFilters,
): Promise<PharmaFinanceReadinessHealthReportResponse> {
  return getJsonWithTenant<PharmaFinanceReadinessHealthReportResponse>(
    token,
    `/pharmaco/finance/reports/readiness-health${financePosShadowReconciliationQuery(filters)}`,
    tenantSlug,
  );
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api/v1';

export type InsurancePagination = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from?: number | null;
  to?: number | null;
};

export type InsurancePartner = {
  id: number;
  uuid?: string;
  code: string;
  name: string;
  partner_type?: string | null;
  pricing_mode?: string | null;
  contract_start_date?: string | null;
  contract_expiry_date?: string | null;
  default_customer_contribution_percent?: number | string | null;
  default_insurer_contribution_percent?: number | string | null;
  coverage_limit?: number | string | null;
  required_documentation?: unknown;
  invoice_claim_settings?: unknown;
  external_portal_reference?: string | null;
  requires_price_approval?: boolean;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  requires_preauthorization?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type InsuranceInstitution = {
  id: number;
  insurance_partner_id: number;
  code: string;
  name: string;
  institution_type?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  partner?: Pick<InsurancePartner, 'id' | 'code' | 'name'> | null;
};

export type InsuranceScheme = {
  id: number;
  insurance_partner_id: number;
  insurance_institution_id?: number | null;
  code: string;
  name: string;
  status: string;
  customer_contribution_percent?: number | string | null;
  insurer_contribution_percent?: number | string | null;
  requires_preauthorization?: boolean;
  effective_from?: string | null;
  effective_to?: string | null;
  partner?: Pick<InsurancePartner, 'id' | 'code' | 'name'> | null;
  institution?: Pick<InsuranceInstitution, 'id' | 'code' | 'name'> | null;
};

export type InsurancePriceList = {
  id: number;
  insurance_partner_id: number;
  insurance_scheme_id?: number | null;
  code: string;
  name: string;
  status: string;
  currency?: string | null;
  priority?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
  source_type?: string | null;
  source_document_path?: string | null;
  approval_status?: string | null;
  approved_by?: number | null;
  approved_at?: string | null;
  approval_notes?: string | null;
  partner?: Pick<InsurancePartner, 'id' | 'code' | 'name'> | null;
  scheme?: Pick<InsuranceScheme, 'id' | 'code' | 'name'> | null;
};

export type InsuranceProductPrice = {
  id: number;
  insurance_price_list_id: number;
  product_id: number;
  agreed_unit_price?: number | string | null;
  covered_unit_price?: number | string | null;
  maximum_claimable_price?: number | string | null;
  customer_contribution_percent?: number | string | null;
  insurer_contribution_percent?: number | string | null;
  requires_pre_authorization?: boolean;
  requires_preauthorization?: boolean;
  is_covered?: boolean;
  coverage_status?: string | null;
  status: string;
  standard_selling_price_snapshot?: number | string | null;
  price_difference_amount?: number | string | null;
  price_difference_percentage?: number | string | null;
  pricing_source?: string | null;
  price_confidence?: number | string | null;
  last_used_at?: string | null;
  use_count?: number | null;
  approval_status?: string | null;
  approved_by?: number | null;
  approved_at?: string | null;
  approval_notes?: string | null;
  product?: {
    id: number;
    name: string;
    sku?: string | null;
  } | null;
  price_list?: Pick<InsurancePriceList, 'id' | 'code' | 'name'> | null;
};

export type InsuranceContributionRule = {
  id: number;
  insurance_partner_id: number;
  insurance_institution_id?: number | null;
  insurance_scheme_id?: number | null;
  product_id?: number | null;
  customer_contribution_percent?: number | string | null;
  insurer_contribution_percent?: number | string | null;
  fixed_customer_amount?: number | string | null;
  maximum_insurer_amount?: number | string | null;
  status: string;
  effective_from?: string | null;
  effective_to?: string | null;
  partner?: Pick<InsurancePartner, 'id' | 'code' | 'name'> | null;
  institution?: Pick<InsuranceInstitution, 'id' | 'code' | 'name'> | null;
  scheme?: Pick<InsuranceScheme, 'id' | 'code' | 'name'> | null;
  product?: {
    id: number;
    name: string;
    sku?: string | null;
  } | null;
};

export type InsuranceListResponse<T> = {
  tenant?: {
    id: number;
    name: string;
    slug: string;
  };
  data: T[];
  pagination?: InsurancePagination;
};

type RawListResponse<T> = {
  tenant?: InsuranceListResponse<T>['tenant'];
  data?: T[];
  pagination?: InsurancePagination;
  partners?: T[];
  institutions?: T[];
  schemes?: T[];
  price_lists?: T[];
  product_prices?: T[];
  contribution_rules?: T[];
  meta?: Partial<InsurancePagination>;
};

export type InsuranceListOptions = {
  search?: string;
  status?: string;
  page?: number;
  perPage?: number;
  partnerId?: number | '';
  institutionId?: number | '';
  schemeId?: number | '';
  priceListId?: number | '';
  productId?: number | '';
};

function buildQuery(options: InsuranceListOptions = {}): string {
  const params = new URLSearchParams();

  if (options.search) params.set('search', options.search);
  if (options.status) params.set('status', options.status);
  if (options.page) params.set('page', String(options.page));
  if (options.perPage) params.set('per_page', String(options.perPage));
  if (options.partnerId) params.set('insurance_partner_id', String(options.partnerId));
  if (options.institutionId) {
    params.set('insurance_institution_id', String(options.institutionId));
  }
  if (options.schemeId) params.set('insurance_scheme_id', String(options.schemeId));
  if (options.priceListId) {
    params.set('insurance_price_list_id', String(options.priceListId));
  }
  if (options.productId) params.set('product_id', String(options.productId));

  const query = params.toString();

  return query ? `?${query}` : '';
}

function validationMessage(data: any): string {
  if (!data?.errors) {
    return data?.message || '';
  }

  return Object.values(data.errors)
    .flat()
    .filter(Boolean)
    .join(' ');
}

async function insuranceRequest<T>(
  token: string,
  tenantSlug: string,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH';
    body?: unknown;
  } = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
      ...(options.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    body:
      options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      validationMessage(data) ||
        'Unable to complete the insurance management request.',
    );
  }

  return data as T;
}

function normalizeList<T>(
  response: RawListResponse<T>,
  collectionKey:
    | 'partners'
    | 'institutions'
    | 'schemes'
    | 'price_lists'
    | 'product_prices'
    | 'contribution_rules',
): InsuranceListResponse<T> {
  const data =
    response.data ??
    response[collectionKey] ??
    [];

  const rawPagination = response.pagination ?? response.meta;

  const pagination = rawPagination
    ? {
        current_page: Number(rawPagination.current_page ?? 1),
        per_page: Number(rawPagination.per_page ?? Math.max(data.length, 1)),
        total: Number(rawPagination.total ?? data.length),
        last_page: Number(rawPagination.last_page ?? 1),
        from: rawPagination.from ?? (data.length ? 1 : null),
        to: rawPagination.to ?? (data.length ? data.length : null),
      }
    : {
        current_page: 1,
        per_page: Math.max(data.length, 1),
        total: data.length,
        last_page: 1,
        from: data.length ? 1 : null,
        to: data.length ? data.length : null,
      };

  return {
    tenant: response.tenant,
    data,
    pagination,
  };
}

export async function bootstrapInsuranceDefaults(
  token: string,
  tenantSlug: string,
): Promise<{
  message?: string;
  partners?: InsurancePartner[];
  summary?: Record<string, number>;
}> {
  return insuranceRequest(
    token,
    tenantSlug,
    '/pharmaco/insurance/bootstrap',
    { method: 'POST', body: {} },
  );
}

export async function getInsurancePartners(
  token: string,
  tenantSlug: string,
  options: InsuranceListOptions = {},
): Promise<InsuranceListResponse<InsurancePartner>> {
  const response = await insuranceRequest<RawListResponse<InsurancePartner>>(
    token,
    tenantSlug,
    `/pharmaco/insurance/partners${buildQuery(options)}`,
  );

  return normalizeList(response, 'partners');
}

export async function createInsurancePartner(
  token: string,
  tenantSlug: string,
  payload: Record<string, unknown>,
): Promise<{ message?: string; partner: InsurancePartner }> {
  return insuranceRequest(
    token,
    tenantSlug,
    '/pharmaco/insurance/partners',
    { method: 'POST', body: payload },
  );
}

export async function updateInsurancePartner(
  token: string,
  tenantSlug: string,
  partnerId: number,
  payload: Record<string, unknown>,
): Promise<{ message?: string; partner: InsurancePartner }> {
  return insuranceRequest(
    token,
    tenantSlug,
    `/pharmaco/insurance/partners/${partnerId}`,
    { method: 'PATCH', body: payload },
  );
}

export async function getInsuranceInstitutions(
  token: string,
  tenantSlug: string,
  options: InsuranceListOptions = {},
): Promise<InsuranceListResponse<InsuranceInstitution>> {
  const response = await insuranceRequest<RawListResponse<InsuranceInstitution>>(
    token,
    tenantSlug,
    `/pharmaco/insurance/institutions${buildQuery(options)}`,
  );

  return normalizeList(response, 'institutions');
}

export async function createInsuranceInstitution(
  token: string,
  tenantSlug: string,
  payload: Record<string, unknown>,
): Promise<{ message?: string; institution: InsuranceInstitution }> {
  return insuranceRequest(
    token,
    tenantSlug,
    '/pharmaco/insurance/institutions',
    { method: 'POST', body: payload },
  );
}

export async function getInsuranceSchemes(
  token: string,
  tenantSlug: string,
  options: InsuranceListOptions = {},
): Promise<InsuranceListResponse<InsuranceScheme>> {
  const response = await insuranceRequest<RawListResponse<InsuranceScheme>>(
    token,
    tenantSlug,
    `/pharmaco/insurance/schemes${buildQuery(options)}`,
  );

  return normalizeList(response, 'schemes');
}

export async function createInsuranceScheme(
  token: string,
  tenantSlug: string,
  payload: Record<string, unknown>,
): Promise<{ message?: string; scheme: InsuranceScheme }> {
  return insuranceRequest(
    token,
    tenantSlug,
    '/pharmaco/insurance/schemes',
    { method: 'POST', body: payload },
  );
}

export async function getInsurancePriceLists(
  token: string,
  tenantSlug: string,
  options: InsuranceListOptions = {},
): Promise<InsuranceListResponse<InsurancePriceList>> {
  const response = await insuranceRequest<RawListResponse<InsurancePriceList>>(
    token,
    tenantSlug,
    `/pharmaco/insurance/price-lists${buildQuery(options)}`,
  );

  return normalizeList(response, 'price_lists');
}

export async function createInsurancePriceList(
  token: string,
  tenantSlug: string,
  payload: Record<string, unknown>,
): Promise<{ message?: string; price_list: InsurancePriceList }> {
  return insuranceRequest(
    token,
    tenantSlug,
    '/pharmaco/insurance/price-lists',
    { method: 'POST', body: payload },
  );
}

export async function getInsuranceProductPrices(
  token: string,
  tenantSlug: string,
  options: InsuranceListOptions = {},
): Promise<InsuranceListResponse<InsuranceProductPrice>> {
  const response = await insuranceRequest<RawListResponse<InsuranceProductPrice>>(
    token,
    tenantSlug,
    `/pharmaco/insurance/product-prices${buildQuery(options)}`,
  );

  return normalizeList(response, 'product_prices');
}

export async function createInsuranceProductPrice(
  token: string,
  tenantSlug: string,
  payload: Record<string, unknown>,
): Promise<{ message?: string; product_price: InsuranceProductPrice }> {
  return insuranceRequest(
    token,
    tenantSlug,
    '/pharmaco/insurance/product-prices',
    { method: 'POST', body: payload },
  );
}

export async function getInsuranceContributionRules(
  token: string,
  tenantSlug: string,
  options: InsuranceListOptions = {},
): Promise<InsuranceListResponse<InsuranceContributionRule>> {
  const response =
    await insuranceRequest<RawListResponse<InsuranceContributionRule>>(
      token,
      tenantSlug,
      `/pharmaco/insurance/contribution-rules${buildQuery(options)}`,
    );

  return normalizeList(response, 'contribution_rules');
}

export async function createInsuranceContributionRule(
  token: string,
  tenantSlug: string,
  payload: Record<string, unknown>,
): Promise<{
  message?: string;
  contribution_rule: InsuranceContributionRule;
}> {
  return insuranceRequest(
    token,
    tenantSlug,
    '/pharmaco/insurance/contribution-rules',
    { method: 'POST', body: payload },
  );
}

export type InsuranceClaimLine = {
  id: number;
  description?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  claimed_amount?: number | string | null;
  approved_amount?: number | string | null;
  product?: { id: number; name: string; sku?: string | null } | null;
};

export type InsuranceClaim = {
  id: number;
  claim_number: string;
  status: string;
  service_date?: string | null;
  claimed_amount?: number | string | null;
  approved_amount?: number | string | null;
  rejected_amount?: number | string | null;
  paid_amount?: number | string | null;
  partner?: Pick<InsurancePartner, 'id' | 'code' | 'name'> | null;
  membership?: { id: number; member_number?: string | null } | null;
  sale?: { id: number; sale_number?: string | null } | null;
  lines?: InsuranceClaimLine[];
};

export type InsuranceReconciliationBatch = {
  id: number;
  batch_number: string;
  status: string;
  period_from: string;
  period_to: string;
  claim_count?: number;
  approved_amount?: number | string | null;
  paid_amount?: number | string | null;
  partner?: Pick<InsurancePartner, 'id' | 'code' | 'name'> | null;
};

export async function getInsuranceClaims(
  token: string,
  tenantSlug: string,
  options: InsuranceListOptions = {},
): Promise<InsuranceListResponse<InsuranceClaim>> {
  const response = await insuranceRequest<any>(
    token,
    tenantSlug,
    `/pharmaco/insurance/claims${buildQuery(options)}`,
  );
  return {
    tenant: response.tenant,
    data: response.claims ?? [],
    pagination: response.meta,
  };
}

export async function getInsuranceClaim(
  token: string,
  tenantSlug: string,
  claimId: number,
): Promise<{ claim: InsuranceClaim }> {
  return insuranceRequest(
    token,
    tenantSlug,
    `/pharmaco/insurance/claims/${claimId}`,
  );
}

export async function submitInsuranceClaim(
  token: string,
  tenantSlug: string,
  claimId: number,
  payload: Record<string, unknown>,
): Promise<{ message?: string; claim: InsuranceClaim }> {
  return insuranceRequest(
    token,
    tenantSlug,
    `/pharmaco/insurance/claims/${claimId}/submit`,
    { method: 'POST', body: payload },
  );
}

export async function adjudicateInsuranceClaim(
  token: string,
  tenantSlug: string,
  claimId: number,
  payload: Record<string, unknown>,
): Promise<{ message?: string; claim: InsuranceClaim }> {
  return insuranceRequest(
    token,
    tenantSlug,
    `/pharmaco/insurance/claims/${claimId}/adjudicate`,
    { method: 'POST', body: payload },
  );
}

export async function createInsuranceClaimPayment(
  token: string,
  tenantSlug: string,
  claimId: number,
  payload: Record<string, unknown>,
): Promise<{ message?: string; payment: Record<string, unknown> }> {
  return insuranceRequest(
    token,
    tenantSlug,
    `/pharmaco/insurance/claims/${claimId}/payments`,
    { method: 'POST', body: payload },
  );
}

export async function getInsuranceReconciliationBatches(
  token: string,
  tenantSlug: string,
  options: InsuranceListOptions = {},
): Promise<InsuranceListResponse<InsuranceReconciliationBatch>> {
  const response = await insuranceRequest<any>(
    token,
    tenantSlug,
    `/pharmaco/insurance/reconciliation-batches${buildQuery(options)}`,
  );
  return {
    tenant: response.tenant,
    data:
      response.data ??
      response.batches ??
      response.reconciliation_batches ??
      [],
    pagination: response.pagination ?? response.meta,
  };
}

export async function createInsuranceReconciliationBatch(
  token: string,
  tenantSlug: string,
  payload: Record<string, unknown>,
): Promise<{ message?: string; batch: InsuranceReconciliationBatch }> {
  return insuranceRequest(
    token,
    tenantSlug,
    '/pharmaco/insurance/reconciliation-batches',
    { method: 'POST', body: payload },
  );
}

export async function submitInsuranceReconciliationBatch(
  token: string,
  tenantSlug: string,
  batchId: number,
): Promise<{ message?: string; batch: InsuranceReconciliationBatch }> {
  return insuranceRequest(
    token,
    tenantSlug,
    `/pharmaco/insurance/reconciliation-batches/${batchId}/submit`,
    { method: 'POST', body: {} },
  );
}

export async function reconcileInsuranceBatch(
  token: string,
  tenantSlug: string,
  batchId: number,
  payload: Record<string, unknown>,
): Promise<{ message?: string; batch: InsuranceReconciliationBatch }> {
  return insuranceRequest(
    token,
    tenantSlug,
    `/pharmaco/insurance/reconciliation-batches/${batchId}/reconcile`,
    { method: 'POST', body: payload },
  );
}

export type InsurancePaymentOption = {
  id: number;
  payment_reference: string;
  payment_date?: string | null;
  amount: number | string;
  currency?: string | null;
  payment_method?: string | null;
  bank_reference?: string | null;
  status?: string | null;
  insurance_claim_id: number;
  insurance_reconciliation_batch_id?: number | null;
};

export async function getEligibleInsuranceBatchPayments(
  token: string,
  tenantSlug: string,
  batchId: number,
): Promise<{ payments: InsurancePaymentOption[] }> {
  return insuranceRequest(
    token,
    tenantSlug,
    `/pharmaco/insurance/reconciliation-batches/${batchId}/eligible-payments`,
  );
}

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
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  default_customer_contribution_percent?: number | string | null;
  default_insurer_contribution_percent?: number | string | null;
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
  partner?: Pick<InsurancePartner, 'id' | 'code' | 'name'> | null;
  scheme?: Pick<InsuranceScheme, 'id' | 'code' | 'name'> | null;
};

export type InsuranceProductPrice = {
  id: number;
  insurance_price_list_id: number;
  product_id: number;
  covered_unit_price?: number | string | null;
  customer_contribution_percent?: number | string | null;
  insurer_contribution_percent?: number | string | null;
  requires_preauthorization?: boolean;
  status: string;
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

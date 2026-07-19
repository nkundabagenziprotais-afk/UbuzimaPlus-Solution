import {
  runDuplicateProtectedReceipt,
} from './duplicateReceiptFlow';

import {
  buildApiUrl,
  normalizeApiBaseUrl,
} from './apiBase';

export type LoginPayload = {
  login_method: 'email' | 'phone';
  email?: string;
  phone?: string;
  password?: string;
  pin?: string;
  device_name?: string;
  trusted_device_token?: string | null;
};

export type TwoFactorSetupPayload = {
  type: 'totp';
  issuer: string;
  account: string;
  manual_secret: string;
  otpauth_uri: string;
  qr_svg: string;
};

export type AccessProfile = {
  user: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    status: string;
    must_change_password: boolean;
    last_login_at: string | null;
    two_factor?: {
      required: boolean;
      enabled: boolean;
      confirmed_at: string | null;
      last_verified_at: string | null;
      trusted_devices_count: number;
    };
  };
  scope: {
    type: string;
    solution_id: number | null;
    tenant_id: number | null;
    branch_id: number | null;
    is_platform: boolean;
    is_solution: boolean;
    is_tenant: boolean;
    is_branch: boolean;
  };
  roles: Array<{
    code: string;
    name: string;
    scope_type: string;
    solution_id: number | null;
    tenant_id: number | null;
    branch_id: number | null;
  }>;
  permissions: string[];
  tenant_assignments: Array<{
    tenant: {
      id: number;
      name: string;
      slug: string;
      status: string;
    };
    branch: {
      id: number;
      name: string;
      code: string;
      status: string;
    } | null;
    job_title: string | null;
    status: string;
  }>;
  admin_scopes: Array<{
    scope_type: string;
    solution_id: number | null;
    tenant_id: number | null;
    branch_id: number | null;
    status: string;
  }>;
};

export type LoginExperience = {
  first_login: boolean;
  title: 'Welcome' | 'Welcome Back';
  user_name: string;
  message: string;
  trusted_device_used: boolean;
  authenticated_at: string;
};

export type LoginResponse = {
  token_type: 'Bearer';
  access_token: string;
  profile: AccessProfile;
  login_experience: LoginExperience;
} | {
  status: 'two_factor_setup_required';
  message: string;
  challenge_token: string;
  expires_at: string;
  setup: TwoFactorSetupPayload;
} | {
  status: 'two_factor_challenge_required';
  message: string;
  challenge_token: string;
  expires_at: string;
  delivery_methods: string[];
  trust_device_available: boolean;
};

export type PasswordResetRequestResponse = {
  status: 'ok';
  message: string;
};

export type TwoFactorVerifyResponse = {
  status: 'two_factor_verified';
  token_type: 'Bearer';
  access_token: string;
  profile: AccessProfile;
  recovery_codes: string[] | null;
  trusted_device: {
    trusted_device_token: string;
    trusted_until: string;
  } | null;
  login_experience: LoginExperience;
};

export type TwoFactorStatusResponse = {
  two_factor: {
    required: boolean;
    enabled: boolean;
    confirmed_at: string | null;
    last_verified_at: string | null;
    trusted_device_days: number;
    trusted_devices: Array<{
      id: number;
      device_name: string | null;
      ip_address: string | null;
      trusted_until: string | null;
      last_used_at: string | null;
    }>;
  };
};

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
);

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok && response.status !== 202) {
    const message =
      data?.message ||
      data?.errors?.email?.[0] ||
        data?.errors?.phone?.[0] ||
      data?.errors?.email?.[0] ||
      data?.errors?.pin?.[0] ||
      'Login failed. Please check your credentials and try again.';

    throw new Error(message);
  }

  return data as LoginResponse;
}

export async function requestPasswordReset(payload: { email: string }): Promise<PasswordResetRequestResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/password-reset-request`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.errors?.email?.[0] ||
        data?.message ||
        'Unable to submit password reset request.',
    );
  }

  return data as PasswordResetRequestResponse;
}


export type ChangePasswordResponse = {
  message: string;
  profile: AccessProfile;
};

export async function changePassword(
  token: string,
  payload: {
    current_password: string;
    password: string;
    password_confirmation: string;
  },
): Promise<ChangePasswordResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationMessage = data?.errors
      ? Object.values(data.errors).flat().filter(Boolean).join(' ')
      : '';

    throw new Error(validationMessage || data?.message || 'Unable to change password.');
  }

  return data as ChangePasswordResponse;
}

export async function verifyTwoFactor(payload: {
  challenge_token: string;
  code: string;
  trust_device?: boolean;
  device_name?: string;
}): Promise<TwoFactorVerifyResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/two-factor/verify`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.errors?.code?.[0] || data?.message || 'Two-factor verification failed.');
  }

  return data as TwoFactorVerifyResponse;
}

export async function getAuthenticatedProfile(token: string): Promise<AccessProfile> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Stored session is no longer valid.');
  }

  return data.profile as AccessProfile;
}

export async function logout(token: string): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getTwoFactorStatus(token: string): Promise<TwoFactorStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/two-factor/status`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load two-factor status.');
  }

  return data as TwoFactorStatusResponse;
}

export async function startTwoFactorSetup(token: string): Promise<{
  status: 'two_factor_setup_ready';
  challenge_token: string;
  expires_at: string;
  setup: TwoFactorSetupPayload;
}> {
  const response = await fetch(`${API_BASE_URL}/auth/two-factor/setup`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to start two-factor setup.');
  }

  return data;
}

export async function regenerateRecoveryCodes(token: string): Promise<{ recovery_codes: string[] }> {
  const response = await fetch(`${API_BASE_URL}/auth/two-factor/recovery-codes`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to regenerate recovery codes.');
  }

  return data;
}

export async function revokeTrustedDevice(token: string, trustedDeviceId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/two-factor/trusted-devices/${trustedDeviceId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || 'Unable to revoke trusted device.');
  }
}


export type AccessCheckResult = {
  access?: {
    status: string;
    area: string;
    permission?: string;
    module?: string;
    tenant?: string;
  };
  message?: string;
  missing_permissions?: string[];
  required_header?: string;
  status?: string;
};

export async function runAccessCheck(
  token: string,
  endpoint: 'security' | 'inventory' | 'ai',
  tenantSlug?: string,
): Promise<AccessCheckResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  if (tenantSlug) {
    headers['X-Tenant-Slug'] = tenantSlug;
  }

  const response = await fetch(`${API_BASE_URL}/access-check/${endpoint}`, {
    method: 'GET',
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ...data,
      access: {
        status: 'blocked',
        area: endpoint,
      },
    };
  }

  return data as AccessCheckResult;
}


export type PharmacyProfileResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
    status?: string;
  };
  profile: {
    id: number;
    uuid: string;
    legal_name: string;
    trading_name: string;
    pharmacy_category: string;
    ownership_type: string | null;
    license_number: string | null;
    tin: string | null;
    rssb_provider_code: string | null;
    insurance_partner_code: string | null;
    regulator_name: string;
    primary_contact_name: string | null;
    primary_phone: string | null;
    primary_email: string | null;
    website: string | null;
    country: string;
    city: string | null;
    district: string | null;
    sector: string | null;
    physical_address: string | null;
    capabilities: string[];
    insurance_partners: string[];
    operating_hours: Record<string, string>;
    status: string;
    is_primary: boolean;
    verified_at: string | null;
  };
};

export type PharmaBranch = {
  id: number;
  name: string;
  code: string;
  branch_type: string;
  status: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  settings: Record<string, unknown>;
};

export type BranchesResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  branches: PharmaBranch[];
};

export type BranchDepartment = {
  id: number;
  uuid: string;
  name: string;
  code: string;
  department_type: string;
  phone: string | null;
  email: string | null;
  opening_time: string | null;
  closing_time: string | null;
  is_revenue_center: boolean;
  operating_status: string;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type BranchDepartmentsResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  branch: {
    id: number;
    name: string;
    code: string;
    status: string;
  };
  departments: BranchDepartment[];
};

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

export async function getPharmacyProfile(
  token: string,
  tenantSlug: string,
): Promise<PharmacyProfileResponse> {
  return getJsonWithTenant<PharmacyProfileResponse>(token, '/pharmaco/profile', tenantSlug);
}

export async function getPharmaBranches(
  token: string,
  tenantSlug: string,
): Promise<BranchesResponse> {
  return getJsonWithTenant<BranchesResponse>(token, '/pharmaco/branches', tenantSlug);
}

export async function getBranchDepartments(
  token: string,
  tenantSlug: string,
  branchId: number,
): Promise<BranchDepartmentsResponse> {
  return getJsonWithTenant<BranchDepartmentsResponse>(
    token,
    `/pharmaco/branches/${branchId}/departments`,
    tenantSlug,
  );
}


export type BranchMutationResponse = {
  message: string;
  branch: PharmaBranch;
};

export type DepartmentMutationResponse = {
  message: string;
  department: BranchDepartment;
};

export type UpdateBranchPayload = {
  name?: string;
  branch_type?: string;
  status?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export type CreateDepartmentPayload = {
  name: string;
  code: string;
  department_type: string;
  phone?: string | null;
  email?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  is_revenue_center?: boolean;
  operating_status?: string;
  notes?: string | null;
};

export type UpdateDepartmentPayload = Partial<CreateDepartmentPayload>;


/*
 * DUPLICATE_RECEIPT_FRONTEND_FLOW_20260714
 *
 * Preserve the HTTP status and backend JSON response while retaining
 * the standard Error message consumed by existing workspaces.
 */
export class ApiRequestError extends Error {
  readonly status: number;

  readonly payload: unknown;

  constructor(
    status: number,
    payload: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.payload = payload;
  }
}

async function sendJsonWithTenant<T>(
  token: string,
  path: string,
  tenantSlug: string,
  method: 'POST' | 'PATCH',
  payload: unknown,
): Promise<T> {
  const response = await fetch(buildApiUrl(API_BASE_URL, path), {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Slug': tenantSlug,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationMessage = data?.errors
      ? Object.values(data.errors).flat().join(' ')
      : null;

    throw new ApiRequestError(
      response.status,
      data,
      validationMessage || data?.message || 'Unable to save PharmaCo360 tenant data.',
    );
  }

  return data as T;
}

export async function updatePharmaBranch(
  token: string,
  tenantSlug: string,
  branchId: number,
  payload: UpdateBranchPayload,
): Promise<BranchMutationResponse> {
  return sendJsonWithTenant<BranchMutationResponse>(
    token,
    `/pharmaco/branches/${branchId}`,
    tenantSlug,
    'PATCH',
    payload,
  );
}

export async function createPharmaBranchDepartment(
  token: string,
  tenantSlug: string,
  branchId: number,
  payload: CreateDepartmentPayload,
): Promise<DepartmentMutationResponse> {
  return sendJsonWithTenant<DepartmentMutationResponse>(
    token,
    `/pharmaco/branches/${branchId}/departments`,
    tenantSlug,
    'POST',
    payload,
  );
}

export async function updatePharmaBranchDepartment(
  token: string,
  tenantSlug: string,
  branchId: number,
  departmentId: number,
  payload: UpdateDepartmentPayload,
): Promise<DepartmentMutationResponse> {
  return sendJsonWithTenant<DepartmentMutationResponse>(
    token,
    `/pharmaco/branches/${branchId}/departments/${departmentId}`,
    tenantSlug,
    'PATCH',
    payload,
  );
}


export type PharmaProductCategory = {
  id: number;
  uuid?: string;
  name: string;
  code: string;
  category_type: string;
  status?: string;
  description?: string | null;
  products_count?: number;
};

export type PharmaProductStockSummary = {
  quantity_on_hand: number;
  quantity_reserved: number;
  available_quantity: number;
  is_below_reorder_level: boolean;
};

export type PharmaProduct = {
  id: number;
  uuid: string;
  name: string;
  generic_name: string | null;
  brand_name: string | null;
  sku: string;
  barcode: string | null;
  registration_number: string | null;
  dosage_form: string | null;
  strength: string | null;
  unit: string;
  selling_unit: string;
  base_unit: string;
  quantity_per_selling_unit: number;
  allow_other_quantity: boolean;
  default_pos_quantity_mode: 'selling_unit' | 'other_quantity' | 'combined';
  selling_unit_notes: string | null;
  ai_suggested_quantity_per_unit: number | null;
  ai_suggestion_status: string;
  ai_suggestion_confidence: number | null;
  ai_suggestion_explanation: string | null;
  ai_suggestion_source: string | null;
  ai_suggestion_reference: string | null;
  ai_suggestion_reviewed_by: number | null;
  ai_suggestion_reviewed_at: string | null;
  pack_size: string | null;
  route_of_administration: string | null;
  product_type: string;
  regulatory_status: string;
  requires_prescription: boolean;
  is_controlled: boolean;
  reorder_level: number;
  minimum_stock_level: number;
  maximum_stock_level: number | null;
  status: string;
  category: PharmaProductCategory | null;
  metadata: Record<string, unknown>;
  stock_summary?: PharmaProductStockSummary;
};

export type PharmaStockLocation = {
  id: number;
  uuid: string;
  branch_id?: number;
  branch_name?: string | null;
  name: string;
  code: string;
  location_type: string;
  status: string;
  branch: {
    id: number;
    name: string;
    code: string;
  };
  stock_batches_count: number;
  metadata: Record<string, unknown>;
};

export type PharmaStockBatch = {
  id: number;
  uuid: string;
  batch_number: string;
  expiry_date: string | null;
  received_at: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  available_quantity: number;
  unit_cost: number | null;
  amount: number;
  selling_price: number | null;
  supplier_name: string | null;
  reference_number?: string | null;
  receive_source?: 'manual' | 'purchase-code' | 'unknown' | null;
  is_manual_inventory_entry?: boolean;
  can_edit_inventory_record?: boolean;
  status: string;
  product: {
    id: number;
    name: string;
    sku: string;
    unit: string;
    selling_unit: string;
    selling_unit_source?: string;
    base_unit: string;
    quantity_per_selling_unit?: number;
    allow_other_quantity?: boolean;
    default_pos_quantity_mode?: 'selling_unit' | 'other_quantity' | 'combined';
    metadata?: Record<string, unknown>;
    category: {
      name: string;
      code: string;
    } | null;
  };
  branch: {
    id: number;
    name: string;
    code: string;
  };
  stock_location: {
    id: number;
    name: string;
    code: string;
    location_type: string;
  };
  metadata: Record<string, unknown>;
};

export type PharmaProductsResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  products: PharmaProduct[];
  pagination?: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number | null;
    to: number | null;
  };
};


export type PharmaProductCategoriesResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  categories: PharmaProductCategory[];
};

export type PharmaInventoryLocationsResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  locations: PharmaStockLocation[];
};

export type PharmaInventoryBatchesResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  batches: PharmaStockBatch[];
  meta?: {
    total: number;
    returned: number;
    per_page: number | null;
    offset: number;
    next_offset: number | null;
    limited: boolean;
  };
};

export type PharmaInventorySummaryResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  summary: {
    product_categories_count: number;
    products_count: number;
    stock_locations_count: number;
    stock_batches_count: number;
    total_quantity_on_hand: number;
    estimated_stock_value: number;
    estimated_stock_cost_value?: number;
    estimated_stock_retail_value?: number;
    estimated_potential_margin_value?: number;
    expired_batches_count?: number;
    low_stock_products_count: number;
    near_expiry_batches_180_days_count: number;
    inventory_value_weekly_trend?: {
      basis: 'retail_value';
      currency: 'RWF';
      week_start: string;
      week_end: string;
      as_of: string;
      labels: string[];
      points: Array<{
        date: string;
        label: string;
        value: number | null;
        is_future: boolean;
      }>;
      history_available: boolean;
      recorded_movement_count: number;
      unmapped_movement_count: number;
      direction:
        | 'growing'
        | 'reducing'
        | 'stable';
      delta_value: number;
      method: string;
      method_note: string;
    };
    inventory_value_by_category?: Array<{
      category_name: string;
      inventory_value: number;
      quantity_on_hand: number;
      stock_batches_count: number;
      priced_batches_count: number;
      missing_price_batches_count: number;
      currency: 'RWF';
      valuation_basis: 'retail_selling_price';
    }>;
  };
  low_stock_products: PharmaProduct[];
};

export async function getPharmaProducts(
  token: string,
  tenantSlug: string,
  options?: {
    search?: string;
    perPage?: number;
    status?: string;
  },
): Promise<PharmaProductsResponse> {
  const params = new URLSearchParams();

  if (options?.search) params.set('search', options.search);
  if (options?.perPage) params.set('per_page', String(options.perPage));
  if (options?.status) params.set('status', options.status);

  const query = params.toString();

  return getJsonWithTenant<PharmaProductsResponse>(
    token,
    `/pharmaco/products${query ? `?${query}` : ''}`,
    tenantSlug,
  );
}

export async function getPharmaProductCategories(
  token: string,
  tenantSlug: string,
): Promise<PharmaProductCategoriesResponse> {
  return getJsonWithTenant<PharmaProductCategoriesResponse>(
    token,
    '/pharmaco/product-categories',
    tenantSlug,
  );
}

export async function getPharmaInventoryLocations(
  token: string,
  tenantSlug: string,
): Promise<PharmaInventoryLocationsResponse> {
  return getJsonWithTenant<PharmaInventoryLocationsResponse>(
    token,
    '/pharmaco/inventory/locations',
    tenantSlug,
  );
}

export async function getPharmaInventoryBatches(
  token: string,
  tenantSlug: string,
  expiringWithinDays?: number,
  options?: {
    search?: string;
    perPage?: number;
    sellableOnly?: boolean;

    offset?: number;},
): Promise<PharmaInventoryBatchesResponse> {
  const params = new URLSearchParams();

  if (expiringWithinDays) params.set('expiring_within_days', String(expiringWithinDays));
  if (options?.search) params.set('search', options.search);
  if (options?.perPage) params.set('per_page', String(options.perPage));

  if (
    options?.offset !== undefined
    && options.offset >= 0
  ) {
    params.set('offset', String(options.offset));
  }
  if (options?.sellableOnly) params.set('sellable_only', '1');

  const query = params.toString();

  return getJsonWithTenant<PharmaInventoryBatchesResponse>(
    token,
    `/pharmaco/inventory/batches${query ? `?${query}` : ''}`,
    tenantSlug,
  );
}

/**
 * Load the complete tenant inventory batch register.
 *
 * Each HTTP request remains limited to 150 records. The helper
 * follows the backend offset contract until meta.limited is
 * false and verifies the combined count against meta.total.
 */
export async function getAllPharmaInventoryBatches(
  token: string,
  tenantSlug: string,
  expiringWithinDays?: number,
  options?: {
    search?: string;
    sellableOnly?: boolean;
  },
): Promise<PharmaInventoryBatchesResponse> {
  const perPage = 150;
  const maximumSegments = 200;

  let offset = 0;
  let expectedTotal: number | null = null;
  let firstResponse:
    | PharmaInventoryBatchesResponse
    | null = null;

  const batchesById = new Map<
    number,
    PharmaStockBatch
  >();

  for (
    let segment = 0;
    segment < maximumSegments;
    segment += 1
  ) {
    const response =
      await getPharmaInventoryBatches(
        token,
        tenantSlug,
        expiringWithinDays,
        {
          search: options?.search,
          sellableOnly:
            options?.sellableOnly,
          perPage,
          offset,
        },
      );

    if (!firstResponse) {
      firstResponse = response;
    }

    const responseBatches = Array.isArray(
      response.batches,
    )
      ? response.batches
      : [];

    responseBatches.forEach((batch) => {
      batchesById.set(batch.id, batch);
    });

    expectedTotal = Number(
      response.meta?.total
        ?? expectedTotal
        ?? responseBatches.length,
    );

    const limited = Boolean(
      response.meta?.limited,
    );

    if (!limited) {
      break;
    }

    const nextOffset = Number(
      response.meta?.next_offset
        ?? offset + responseBatches.length,
    );

    if (
      responseBatches.length === 0
      || !Number.isFinite(nextOffset)
      || nextOffset <= offset
    ) {
      throw new Error(
        'Inventory loading could not advance to the next record segment.',
      );
    }

    offset = nextOffset;

    if (segment === maximumSegments - 1) {
      throw new Error(
        'Inventory loading exceeded the controlled segment limit.',
      );
    }
  }

  const batches = Array.from(
    batchesById.values(),
  );

  if (
    expectedTotal !== null
    && batches.length < expectedTotal
  ) {
    throw new Error(
      `Inventory loading stopped at ${batches.length} of ${expectedTotal} records.`,
    );
  }

  return {
    ...(firstResponse ?? {
      tenant: {
        id: 0,
        name: tenantSlug,
        slug: tenantSlug,
      },
      batches: [],
    }),
    batches,
    meta: {
      total:
        expectedTotal ?? batches.length,
      returned: batches.length,
      per_page: perPage,
      offset: 0,
      next_offset: null,
      limited: false,
    },
  };
}



export async function getPharmaNearExpiryBatches(
  token: string,
  tenantSlug: string,
  days = 180,
  options?: {
    search?: string;
    perPage?: number;
  },
): Promise<PharmaInventoryBatchesResponse> {
  const params = new URLSearchParams();

  params.set('days', String(days));

  if (options?.search) params.set('search', options.search);
  if (options?.perPage) params.set('per_page', String(options.perPage));

  const query = params.toString();

  return getJsonWithTenant<PharmaInventoryBatchesResponse>(
    token,
    `/pharmaco/inventory/near-expiry-batches?${query}`,
    tenantSlug,
  );
}

export async function getPharmaInventorySummary(
  token: string,
  tenantSlug: string,
): Promise<PharmaInventorySummaryResponse> {
  return getJsonWithTenant<PharmaInventorySummaryResponse>(
    token,
    '/pharmaco/inventory/summary',
    tenantSlug,
  );
}


export type CreatePharmaProductPayload = {
  product_category_id?: number | null;
  name: string;
  generic_name?: string | null;
  brand_name?: string | null;
  sku: string;
  barcode?: string | null;
  registration_number?: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  unit: string;
  pack_size?: string | null;
  route_of_administration?: string | null;
  product_type: 'medicine' | 'consumable' | 'device' | 'service';
  regulatory_status: 'approved' | 'pending' | 'suspended' | 'unregistered';
  requires_prescription?: boolean;
  is_controlled?: boolean;
  reorder_level?: number;
  minimum_stock_level?: number;
  maximum_stock_level?: number | null;
  status?: 'active' | 'inactive' | 'discontinued';
};

export type UpdatePharmaProductPayload = Partial<CreatePharmaProductPayload>;

export type CreatePharmaProductCategoryPayload = {
  name: string;
  code: string;
  category_type?: string;
  status?: 'active' | 'inactive';
  description?: string | null;
};

export type UpdatePharmaProductCategoryPayload = Partial<CreatePharmaProductCategoryPayload>;

export type PharmaProductCategoryMutationResponse = {
  message: string;
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  category: PharmaProductCategory;
};

export type CreatePharmaStockLocationPayload = {
  branch_id: number;
  name: string;
  code: string;
  location_type?: string;
  status?: 'active' | 'inactive';
};

export type UpdatePharmaStockLocationPayload = Partial<Omit<CreatePharmaStockLocationPayload, 'branch_id'>>;

export type PharmaStockLocationMutationResponse = {
  message: string;
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  location: PharmaStockLocation;
};

export type PharmaProductMutationResponse = {
  message: string;
  product: PharmaProduct;
};

export type ReceivePharmaStockPayload = {
  product_id: number;
  stock_location_id: number;
  pharmaco_purchase_order_item_id?: number | null;
  batch_number: string;
  quantity: number;
  expiry_date?: string | null;
  received_at?: string | null;
  unit_cost?: number | null;
  selling_price?: number | null;
  supplier_name?: string | null;
  reference_number?: string | null;
  reason?: string | null;
  receive_source?: 'manual' | 'purchase-code';

  idempotency_key?: string;
  duplicate_override?: boolean;
  duplicate_check_token?: string | null;
  duplicate_override_reason?: string | null;
};

export type PharmaStockMovement = {
  id: number;
  uuid: string;
  movement_type: string;
  quantity: number;
  running_balance: number | null;
  reference_type: string | null;
  reference_number: string | null;
  reason: string | null;
  occurred_at: string | null;
  metadata: Record<string, unknown>;
};

export type PharmaPurchaseOrderReceipt = {
  purchase_order_id: number;
  purchase_order_item_id: number;
  po_number: string;
  purchase_order_status: string;
  purchase_order_receiving_status: string;
  item_status: string;
  quantity_ordered: number;
  quantity_received_before: number;
  quantity_received_after: number;
  remaining_quantity_after: number;
  supplier_name: string | null;
};

export type ReceivePharmaStockResponse = {
  message: string;
  batch: PharmaStockBatch;
  movement: PharmaStockMovement;
  purchase_order_receipt?: PharmaPurchaseOrderReceipt | null;
};

export async function createPharmaProduct(
  token: string,
  tenantSlug: string,
  payload: CreatePharmaProductPayload,
): Promise<PharmaProductMutationResponse> {
  return sendJsonWithTenant<PharmaProductMutationResponse>(
    token,
    '/pharmaco/products',
    tenantSlug,
    'POST',
    payload,
  );
}

export async function updatePharmaProduct(
  token: string,
  tenantSlug: string,
  productId: number,
  payload: UpdatePharmaProductPayload,
): Promise<PharmaProductMutationResponse> {
  return sendJsonWithTenant<PharmaProductMutationResponse>(
    token,
    `/pharmaco/products/${productId}`,
    tenantSlug,
    'PATCH',
    payload,
  );
}

export async function deletePharmaProduct(
  token: string,
  tenantSlug: string,
  productId: number,
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/pharmaco/products/${productId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationMessage = data?.errors
      ? Object.values(data.errors).flat().join(' ')
      : null;

    throw new Error(validationMessage || data?.message || 'Unable to delete product.');
  }

  return data as { message: string };
}

export async function createPharmaProductCategory(
  token: string,
  tenantSlug: string,
  payload: CreatePharmaProductCategoryPayload,
): Promise<PharmaProductCategoryMutationResponse> {
  return sendJsonWithTenant<PharmaProductCategoryMutationResponse>(
    token,
    '/pharmaco/product-categories',
    tenantSlug,
    'POST',
    payload,
  );
}

export async function updatePharmaProductCategory(
  token: string,
  tenantSlug: string,
  categoryId: number,
  payload: UpdatePharmaProductCategoryPayload,
): Promise<PharmaProductCategoryMutationResponse> {
  return sendJsonWithTenant<PharmaProductCategoryMutationResponse>(
    token,
    `/pharmaco/product-categories/${categoryId}`,
    tenantSlug,
    'PATCH',
    payload,
  );
}

export async function createPharmaStockLocation(
  token: string,
  tenantSlug: string,
  payload: CreatePharmaStockLocationPayload,
): Promise<PharmaStockLocationMutationResponse> {
  return sendJsonWithTenant<PharmaStockLocationMutationResponse>(
    token,
    '/pharmaco/inventory/locations',
    tenantSlug,
    'POST',
    payload,
  );
}

export async function updatePharmaStockLocation(
  token: string,
  tenantSlug: string,
  locationId: number,
  payload: UpdatePharmaStockLocationPayload,
): Promise<PharmaStockLocationMutationResponse> {
  return sendJsonWithTenant<PharmaStockLocationMutationResponse>(
    token,
    `/pharmaco/inventory/locations/${locationId}`,
    tenantSlug,
    'PATCH',
    payload,
  );
}

export async function deletePharmaStockLocation(
  token: string,
  tenantSlug: string,
  locationId: number,
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/pharmaco/inventory/locations/${locationId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationMessage = data?.errors
      ? Object.values(data.errors).flat().join(' ')
      : null;

    throw new Error(validationMessage || data?.message || 'Unable to delete stock location.');
  }

  return data as { message: string };
}

export async function receivePharmaStock(
  token: string,
  tenantSlug: string,
  payload: ReceivePharmaStockPayload,
): Promise<ReceivePharmaStockResponse> {
  return runDuplicateProtectedReceipt(
    payload,
    (nextPayload) =>
      sendJsonWithTenant<ReceivePharmaStockResponse>(
    token,
    '/pharmaco/inventory/receive',
    tenantSlug,
    'POST',
    nextPayload,
  ),
    {
      title: 'Review possible duplicate medicine receipt',
      recordLabel: 'Medicine product ID',
    },
  );
}

export type ProductBulkOperationResponse = {
  message: string;
  bulk_operation: {
    id: number;
    uuid: string;
    status: string;
    total_rows: number;
    processed_rows: number;
    failed_rows: number;
    summary: Record<string, unknown>;
  };
};

export type ProductBulkImportRow = Partial<CreatePharmaProductPayload> & {
  category_code?: string | null;
};


export async function updatePharmaStockBatch(
  token: string,
  tenantSlug: string,
  batchId: number,
  payload: {
    product_id: number;
    stock_location_id: number;
    batch_number: string;
    quantity: number;
    expiry_date?: string | null;
    unit_cost?: number | null;
    selling_price?: number | null;
    supplier_name?: string | null;
    reference_number?: string | null;
  },
) {
  return apiRequest<{
    message: string;
    batch: PharmaStockBatch;
  }>(token, tenantSlug, `/pharmaco/inventory/batches/${batchId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deletePharmaStockBatch(
  token: string,
  tenantSlug: string,
  batchId: number,
) {
  try {
    return await apiRequest<{
      message: string;
    }>(token, tenantSlug, `/pharmaco/inventory/batches/${batchId}`, {
      method: 'DELETE',
    });
  } catch (err) {
    return apiRequest<{
      message: string;
    }>(token, tenantSlug, `/pharmaco/inventory/batches/${batchId}/delete`, {
      method: 'POST',
    });
  }
}

export async function bulkImportPharmaProducts(
  token: string,
  tenantSlug: string,
  rows: ProductBulkImportRow[],
  mode: 'create_only' | 'upsert' = 'upsert',
): Promise<ProductBulkOperationResponse> {
  return sendJsonWithTenant<ProductBulkOperationResponse>(
    token,
    '/pharmaco/products/bulk-import',
    tenantSlug,
    'POST',
    { rows, mode },
  );
}

export async function bulkActionPharmaProducts(
  token: string,
  tenantSlug: string,
  payload: {
    ids: number[];
    action: 'approve' | 'activate' | 'deactivate' | 'discontinue' | 'update' | 'delete';
    values?: Record<string, unknown>;
  },
): Promise<ProductBulkOperationResponse> {
  return sendJsonWithTenant<ProductBulkOperationResponse>(
    token,
    '/pharmaco/products/bulk-action',
    tenantSlug,
    'POST',
    payload,
  );
}


export type PharmaCustomer = {
  id: number;
  uuid: string;
  first_name: string;
  last_name: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  customer_type: string;
  insurance_provider: string | null;
  insurance_membership_number: string | null;
  status: string;
};

export type PharmaPrescriptionAttachment = {
  original_name: string | null;
  mime_type: string | null;
  size: number | null;
  uploaded_at: string | null;
  download_path: string;
};

export type PharmaPrescription = {
  id: number;
  uuid: string;
  prescription_number: string;
  prescriber_name: string | null;
  prescriber_facility: string | null;
  prescriber_phone: string | null;
  issued_at: string | null;
  expires_at: string | null;
  status: string;
  notes: string | null;
  attachment?: PharmaPrescriptionAttachment | null;
  customer?: PharmaCustomer | null;
};

export type PharmaSaleItem = {
  id: number;
  uuid: string;
  product: {
    id: number;
    name: string;
    sku: string;
    category: {
      id: number;
      name: string;
      code: string;
    } | null;
  } | null;
  stock_batch: {
    id: number;
    batch_number: string;
    expiry_date: string | null;
  } | null;
  stock_location: {
    id: number;
    name: string;
    code: string;
  } | null;
  product_name_snapshot: string;
  sku_snapshot: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  requires_prescription: boolean;
  prescription_verified: boolean;
  status: string;
  metadata: Record<string, unknown>;
};

export type PharmaPayment = {
  id: number;
  uuid: string;
  amount: number;
  payment_method: string;
  status: string;
  entry_mode?: "live" | "historical" | string;
  business_date?: string | null;
  pos_session_id?: number | null;
  historical_approval_id?: number | null;
  is_historical?: boolean;
  reference_number: string | null;
  receipt_number: string | null;
  received_at: string | null;
  metadata: Record<string, unknown>;
};

export type PharmaSale = {
  id: number;
  uuid: string;
  sale_number: string;
  sale_type: string;
  status: string;
  entry_mode?: "live" | "historical" | string;
  business_date?: string | null;
  pos_session_id?: number | null;
  historical_reason?: string | null;
  historical_reference?: string | null;
  historical_approval_id?: number | null;
  is_historical?: boolean;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: string;
  sold_at: string | null;
  notes: string | null;
  branch: {
    id: number;
    name: string;
    code: string;
  } | null;
  customer: PharmaCustomer | null;
  prescription: PharmaPrescription | null;
  items_count: number | null;
  payments_count: number | null;
  created_at: string | null;
  items?: PharmaSaleItem[];
  payments?: PharmaPayment[];
};

export type PharmaCustomersResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  customers: PharmaCustomer[];
};

export type PharmaPrescriptionsResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  prescriptions: PharmaPrescription[];
};

export type PharmaSalesResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  sales: PharmaSale[];
};

export type PharmaSaleResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  sale: PharmaSale;
};

export async function getPharmaCustomers(
  token: string,
  tenantSlug: string,
): Promise<PharmaCustomersResponse> {
  return getJsonWithTenant<PharmaCustomersResponse>(token, '/pharmaco/customers', tenantSlug);
}

export async function getPharmaPrescriptions(
  token: string,
  tenantSlug: string,
): Promise<PharmaPrescriptionsResponse> {
  return getJsonWithTenant<PharmaPrescriptionsResponse>(token, '/pharmaco/prescriptions', tenantSlug);
}

export type PharmaSalesFilters = {
  status?: string;
  payment_status?: string;
  sale_type?: string;
  branch_id?: number;
  pos_session_id?: number;
};

function buildPharmaQueryString(params: Record<string, string | number | null | undefined>): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();

  return queryString ? `?${queryString}` : '';
}

export async function getPharmaSales(
  token: string,
  tenantSlug: string,
  filters: PharmaSalesFilters = {},
): Promise<PharmaSalesResponse> {
  const query = buildPharmaQueryString({
    status: filters.status,
    payment_status: filters.payment_status,
    sale_type: filters.sale_type,
    branch_id: filters.branch_id,
    pos_session_id: filters.pos_session_id,
  });

  return getJsonWithTenant<PharmaSalesResponse>(token, `/pharmaco/sales${query}`, tenantSlug);
}

export async function getPharmaSale(
  token: string,
  tenantSlug: string,
  saleId: number,
): Promise<PharmaSaleResponse> {
  return getJsonWithTenant<PharmaSaleResponse>(token, `/pharmaco/sales/${saleId}`, tenantSlug);
}

export type VoidPharmaSalePayload = {
  reason: string;
};

export type VoidPharmaSaleResponse = {
  message: string;
  sale: PharmaSale;
};

export async function voidPharmaSaleItem(
  token: string,
  tenantSlug: string,
  saleId: number,
  itemId: number,
  payload: VoidPharmaSalePayload,
): Promise<VoidPharmaSaleResponse> {
  return sendJsonWithTenant<VoidPharmaSaleResponse>(
    token,
    `/pharmaco/sales/${saleId}/items/${itemId}/void`,
    tenantSlug,
    'POST',
    payload,
  );
}

export async function voidPharmaSale(
  token: string,
  tenantSlug: string,
  saleId: number,
  payload: VoidPharmaSalePayload,
): Promise<VoidPharmaSaleResponse> {
  return sendJsonWithTenant<VoidPharmaSaleResponse>(
    token,
    `/pharmaco/sales/${saleId}/void`,
    tenantSlug,
    'POST',
    payload,
  );
}


export type ConfirmPharmaSalePayload = {
  items: Array<{
    sale_item_id: number;
    stock_batch_id: number;
    prescription_verified?: boolean;
  }>;
};

export type ConfirmPharmaSaleResponse = {
  message: string;
  sale: PharmaSale;
};

export async function confirmPharmaSale(
  token: string,
  tenantSlug: string,
  saleId: number,
  payload: ConfirmPharmaSalePayload,
): Promise<ConfirmPharmaSaleResponse> {
  return sendJsonWithTenant<ConfirmPharmaSaleResponse>(
    token,
    `/pharmaco/sales/${saleId}/confirm`,
    tenantSlug,
    'POST',
    payload,
  );
}


export type RecordPharmaPaymentPayload = {
  generate_receipt?: boolean;
  amount: number;
  payment_method: 'cash' | 'momo' | 'card' | 'insurance' | 'credit' | 'bank_transfer';
  reference_number?: string | null;
  received_at?: string | null;
  notes?: string | null;
};

export type RecordPharmaPaymentResponse = {
  message: string;
  payment: PharmaPayment;
  sale: PharmaSale;
};

export async function recordPharmaPayment(
  token: string,
  tenantSlug: string,
  saleId: number,
  payload: RecordPharmaPaymentPayload,
): Promise<RecordPharmaPaymentResponse> {
  return sendJsonWithTenant<RecordPharmaPaymentResponse>(
    token,
    `/pharmaco/sales/${saleId}/payments`,
    tenantSlug,
    'POST',
    payload,
  );
}


export type CreatePharmaCustomerPayload = {
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  customer_type?: string | null;
  insurance_provider?: string | null;
  insurance_membership_number?: string | null;
  status?: 'active' | 'inactive';
  notes?: string | null;
};

export type CreatePharmaCustomerResponse = {
  message: string;
  customer: PharmaCustomer;
};

export async function createPharmaCustomer(
  token: string,
  tenantSlug: string,
  payload: CreatePharmaCustomerPayload,
): Promise<CreatePharmaCustomerResponse> {
  return sendJsonWithTenant<CreatePharmaCustomerResponse>(
    token,
    '/pharmaco/customers',
    tenantSlug,
    'POST',
    payload,
  );
}

export type CreatePharmaPrescriptionPayload = {
  pharmaco_customer_id?: number | null;
  prescription_number?: string | null;
  prescriber_name?: string | null;
  prescriber_facility?: string | null;
  prescriber_phone?: string | null;
  issued_at?: string | null;
  expires_at?: string | null;
  status?: 'active' | 'used' | 'expired' | 'cancelled';
  notes?: string | null;
};

export type CreatePharmaPrescriptionResponse = {
  message: string;
  prescription: PharmaPrescription;
};

export async function createPharmaPrescription(
  token: string,
  tenantSlug: string,
  payload: CreatePharmaPrescriptionPayload,
): Promise<CreatePharmaPrescriptionResponse> {
  return sendJsonWithTenant<CreatePharmaPrescriptionResponse>(
    token,
    '/pharmaco/prescriptions',
    tenantSlug,
    'POST',
    payload,
  );
}


export type UpdatePharmaCustomerPayload =
  Partial<CreatePharmaCustomerPayload>;

export type UpdatePharmaPrescriptionPayload =
  Partial<CreatePharmaPrescriptionPayload>;

export type UpdatePharmaCustomerResponse = {
  message: string;
  customer: PharmaCustomer;
};

export type UpdatePharmaPrescriptionResponse = {
  message: string;
  prescription: PharmaPrescription;
};

export async function updatePharmaCustomer(
  token: string,
  tenantSlug: string,
  customerId: number,
  payload: UpdatePharmaCustomerPayload,
): Promise<UpdatePharmaCustomerResponse> {
  return sendJsonWithTenant<UpdatePharmaCustomerResponse>(
    token,
    `/pharmaco/customers/${customerId}`,
    tenantSlug,
    'PATCH',
    payload,
  );
}

export async function updatePharmaPrescription(
  token: string,
  tenantSlug: string,
  prescriptionId: number,
  payload: UpdatePharmaPrescriptionPayload,
): Promise<UpdatePharmaPrescriptionResponse> {
  return sendJsonWithTenant<UpdatePharmaPrescriptionResponse>(
    token,
    `/pharmaco/prescriptions/${prescriptionId}`,
    tenantSlug,
    'PATCH',
    payload,
  );
}

export async function uploadPharmaPrescriptionAttachment(
  token: string,
  tenantSlug: string,
  prescriptionId: number,
  attachment: File,
): Promise<UpdatePharmaPrescriptionResponse> {
  const body = new FormData();

  body.append('attachment', attachment);

  const response = await fetch(
    `${API_BASE_URL}/pharmaco/prescriptions/${prescriptionId}/attachment`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': tenantSlug,
      },
      body,
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationMessage = data?.errors
      ? Object.values(data.errors)
          .flat()
          .filter(Boolean)
          .join(' ')
      : '';

    throw new Error(
      validationMessage ||
        data?.message ||
        'Unable to upload the prescription attachment.',
    );
  }

  return data as UpdatePharmaPrescriptionResponse;
}

export async function downloadPharmaPrescriptionAttachment(
  token: string,
  tenantSlug: string,
  prescriptionId: number,
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/pharmaco/prescriptions/${prescriptionId}/attachment`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/octet-stream',
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': tenantSlug,
      },
    },
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    throw new Error(
      data?.message ||
        'Unable to download the prescription attachment.',
    );
  }

  return response.blob();
}

export type CreatePharmaSalePayload = {
  branch_id: number;
  pharmaco_customer_id?: number | null;
  pharmaco_prescription_id?: number | null;
  sale_type?: 'cash_sale' | 'prescription_sale' | 'insurance_sale' | 'credit_sale';
  discount_amount?: number;
  tax_amount?: number;
  notes?: string | null;
  items: Array<{
    product_id: number;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
    tax_amount?: number;
  }>;
};

export type CreatePharmaSaleResponse = {
  message: string;
  sale: PharmaSale;
};

export async function createPharmaSale(
  token: string,
  tenantSlug: string,
  payload: CreatePharmaSalePayload,
): Promise<CreatePharmaSaleResponse> {
  return sendJsonWithTenant<CreatePharmaSaleResponse>(
    token,
    '/pharmaco/sales',
    tenantSlug,
    'POST',
    payload,
  );
}

export type CheckoutPharmaSalePayload = {
  idempotency_key: string;
  branch_id: number;
  pharmaco_customer_id?: number | null;
  pharmaco_prescription_id?: number | null;
  sale_type?:
    | 'cash_sale'
    | 'prescription_sale'
    | 'insurance_sale'
    | 'credit_sale';
  discount_amount?: number;
  tax_amount?: number;
  notes?: string | null;
  items: Array<{
    product_id: number;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
    tax_amount?: number;
    stock_batch_id: number;
    prescription_verified?: boolean;
  }>;
  payment: {
    payment_method:
      | 'cash'
      | 'momo'
      | 'card'
      | 'insurance'
      | 'credit'
      | 'bank_transfer';
    generate_receipt?: boolean;
    reference_number?: string | null;
    received_at?: string | null;
    notes?: string | null;
  };
};

export type CheckoutPharmaSaleResponse = {
  message: string;
  idempotent: boolean;
  sale: PharmaSale;
  payment: PharmaPayment;
};

export async function checkoutPharmaSale(
  token: string,
  tenantSlug: string,
  payload: CheckoutPharmaSalePayload,
): Promise<CheckoutPharmaSaleResponse> {
  const createdResponse = await createPharmaSale(
    token,
    tenantSlug,
    {
      branch_id: payload.branch_id,
      pharmaco_customer_id: payload.pharmaco_customer_id,
      pharmaco_prescription_id: payload.pharmaco_prescription_id,
      sale_type: payload.sale_type,
      discount_amount: payload.discount_amount,
      tax_amount: payload.tax_amount,
      notes: payload.notes,
      items: payload.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        tax_amount: item.tax_amount,
      })),
    },
  );

  const createdItems = createdResponse.sale.items ?? [];

  if (createdItems.length !== payload.items.length) {
    throw new Error(
      'The POS sale was created, but the sale item count did not match the cart. Please review the sale before retrying payment.',
    );
  }

  const confirmedResponse = await confirmPharmaSale(
    token,
    tenantSlug,
    createdResponse.sale.id,
    {
      items: createdItems.map((saleItem, index) => ({
        sale_item_id: saleItem.id,
        stock_batch_id: payload.items[index]?.stock_batch_id,
        prescription_verified:
          payload.items[index]?.prescription_verified ?? false,
      })),
    },
  );

  const payableSale = confirmedResponse.sale;
  const payableAmount = Number(
    (payableSale as { total_amount?: number | string }).total_amount
      ?? (createdResponse.sale as { total_amount?: number | string }).total_amount
      ?? 0,
  );

  if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
    throw new Error(
      'The POS sale was dispensed, but the payable amount could not be resolved. Please review the sale before recording payment.',
    );
  }

  const paymentResponse = await recordPharmaPayment(
    token,
    tenantSlug,
    payableSale.id,
    {
      amount: payableAmount,
      payment_method: payload.payment.payment_method,
      generate_receipt: true,
      reference_number: payload.payment.reference_number,
      received_at: payload.payment.received_at,
      notes:
        payload.payment.notes
        ?? 'Customer receipt generated automatically at POS confirmation.',
    },
  );

  return {
    message: 'POS checkout completed successfully.',
    sale: paymentResponse.sale,
    payment: paymentResponse.payment,
    idempotent: false,
  };
}



export type PharmaSupplier = {
  id: number;
  uuid: string;
  supplier_code: string;
  name: string;
  legal_name: string | null;
  supplier_type: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  tax_identification_number: string | null;
  license_number: string | null;
  address: string | null;
  payment_terms: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string | null;
};

export type PharmaPurchaseType =
  | 'core_products'
  | 'general_items';

export type PharmaPurchaseOrderItem = {
  id: number;
  uuid: string;
  item_type?: 'core_product' | 'general_item';
  product: {
    id: number;
    name: string;
    sku: string;
    category: {
      id: number;
      name: string;
      code: string;
    } | null;
  } | null;
  item_name?: string | null;
  item_code?: string | null;
  category?: string | null;
  unit_of_measure?: string | null;
  product_name_snapshot: string;
  sku_snapshot: string | null;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  status: string;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type PharmaGeneralItemLocation = {
  id: number;
  uuid: string;
  name: string;
  code: string;
  location_type: string;
  status: string;
  description?: string | null;
  branch: {
    id: number;
    name: string;
    code: string;
  } | null;
};

export type PharmaGeneralItemLocationsResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  locations: PharmaGeneralItemLocation[];
};

export type ReceivePharmaGeneralPurchaseOrderPayload = {
  pharmaco_general_purchase_order_item_id: number;
  pharmaco_general_item_location_id: number;
  quantity_received: number;
  unit_cost?: number | null;
  reference_number?: string | null;
  received_at?: string | null;
  notes?: string | null;

  idempotency_key?: string;
  duplicate_override?: boolean;
  duplicate_check_token?: string | null;
  duplicate_override_reason?: string | null;
};

export type ReceivePharmaGeneralPurchaseOrderResponse = {
  message: string;
  purchase_order: {
    id: number;
    uuid: string;
    po_number: string;
    purchase_type: 'general_items';
    status: string;
  };
  purchase_order_item: {
    id: number;
    pharmaco_general_item_id: number;
    item_name: string;
    item_code: string | null;
    quantity_ordered: number;
    quantity_received: number;
    remaining_quantity: number;
    status: string;
  };
  stock: {
    id: number;
    quantity_on_hand: number;
    average_unit_cost: number;
    last_unit_cost: number;
  };
  movement: {
    id: number;
    uuid: string;
    movement_type: string;
    quantity: number;
    running_balance: number | null;
    reference_type: string | null;
    reference_number: string | null;
    reason: string | null;
    occurred_at: string | null;
  };
};

export type PharmaPurchaseOrder = {
  id: number;
  uuid: string;
  po_number: string;
  purchase_type: PharmaPurchaseType;
  status: string;
  order_date: string | null;
  expected_delivery_date: string | null;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  notes: string | null;
  supplier: PharmaSupplier | null;
  branch: {
    id: number;
    name: string;
    code: string;
  } | null;
  items_count: number | null;
  created_at: string | null;
  items?: PharmaPurchaseOrderItem[];
};

export type PharmaSuppliersResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  suppliers: PharmaSupplier[];
};

export type PharmaPurchaseOrdersResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  purchase_orders: PharmaPurchaseOrder[];
};

export type PharmaPurchaseOrderResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  purchase_order: PharmaPurchaseOrder;
};

export type CreatePharmaSupplierPayload = {
  supplier_code?: string | null;
  name: string;
  legal_name?: string | null;
  supplier_type: 'wholesaler' | 'manufacturer' | 'distributor' | 'importer' | 'other';
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_identification_number?: string | null;
  license_number?: string | null;
  address?: string | null;
  payment_terms?: string | null;
  status?: 'active' | 'inactive' | 'suspended';
  notes?: string | null;
};

export type CreatePharmaSupplierResponse = {
  message: string;
  supplier: PharmaSupplier;
};

export async function getPharmaSuppliers(
  token: string,
  tenantSlug: string,
): Promise<PharmaSuppliersResponse> {
  return getJsonWithTenant<PharmaSuppliersResponse>(token, '/pharmaco/suppliers', tenantSlug);
}

export async function createPharmaSupplier(
  token: string,
  tenantSlug: string,
  payload: CreatePharmaSupplierPayload,
): Promise<CreatePharmaSupplierResponse> {
  return sendJsonWithTenant<CreatePharmaSupplierResponse>(
    token,
    '/pharmaco/suppliers',
    tenantSlug,
    'POST',
    payload,
  );
}

type CreatePharmaPurchaseOrderCommonPayload = {
  branch_id: number;
  pharmaco_supplier_id: number;
  order_date?: string | null;
  expected_delivery_date?: string | null;
  discount_amount?: number;
  tax_amount?: number;
  shipping_amount?: number;
  notes?: string | null;
};

export type CreatePharmaCorePurchaseOrderPayload =
  CreatePharmaPurchaseOrderCommonPayload & {
    purchase_type?: 'core_products';
    items: Array<{
      product_id: number;
      quantity_ordered: number;
      unit_cost: number;
      discount_amount?: number;
      tax_amount?: number;
      notes?: string | null;
    }>;
    general_items?: never;
  };

export type CreatePharmaGeneralItemsPurchaseOrderPayload =
  CreatePharmaPurchaseOrderCommonPayload & {
    purchase_type: 'general_items';
    items?: never;
    general_items: Array<{
      general_item_id: number;
      quantity_ordered: number;
      unit_cost: number;
      discount_amount?: number;
      tax_amount?: number;
      notes?: string | null;
    }>;
  };

export type CreatePharmaPurchaseOrderPayload =
  | CreatePharmaCorePurchaseOrderPayload
  | CreatePharmaGeneralItemsPurchaseOrderPayload;

export type CreatePharmaPurchaseOrderResponse = {
  message: string;
  purchase_order: PharmaPurchaseOrder;
};

export async function getPharmaPurchaseOrders(
  token: string,
  tenantSlug: string,
): Promise<PharmaPurchaseOrdersResponse> {
  return getJsonWithTenant<PharmaPurchaseOrdersResponse>(token, '/pharmaco/purchase-orders', tenantSlug);
}

export async function getPharmaPurchaseOrder(
  token: string,
  tenantSlug: string,
  purchaseOrderId: number,
): Promise<PharmaPurchaseOrderResponse> {
  return getJsonWithTenant<PharmaPurchaseOrderResponse>(
    token,
    `/pharmaco/purchase-orders/${purchaseOrderId}`,
    tenantSlug,
  );
}

export async function getPharmaGeneralItemLocations(
  token: string,
  tenantSlug: string,
): Promise<PharmaGeneralItemLocationsResponse> {
  return getJsonWithTenant<PharmaGeneralItemLocationsResponse>(
    token,
    '/pharmaco/general-item-locations',
    tenantSlug,
  );
}

export async function receivePharmaGeneralPurchaseOrder(
  token: string,
  tenantSlug: string,
  purchaseOrderId: number,
  payload: ReceivePharmaGeneralPurchaseOrderPayload,
): Promise<ReceivePharmaGeneralPurchaseOrderResponse> {
  return runDuplicateProtectedReceipt(
    payload,
    (nextPayload) =>
      sendJsonWithTenant<ReceivePharmaGeneralPurchaseOrderResponse>(
    token,
    `/pharmaco/purchase-orders/${purchaseOrderId}/general-items/receive`,
    tenantSlug,
    'POST',
    nextPayload,
  ),
    {
      title: 'Review possible duplicate General Item receipt',
      recordLabel: 'Purchase Order line ID',
    },
  );
}

export async function createPharmaPurchaseOrder(
  token: string,
  tenantSlug: string,
  payload: CreatePharmaPurchaseOrderPayload,
): Promise<CreatePharmaPurchaseOrderResponse> {
  return sendJsonWithTenant<CreatePharmaPurchaseOrderResponse>(
    token,
    '/pharmaco/purchase-orders',
    tenantSlug,
    'POST',
    payload,
  );
}


export type UpdatePharmaSupplierPayload = Partial<CreatePharmaSupplierPayload>;

export type UpdatePharmaSupplierResponse = {
  message: string;
  supplier: PharmaSupplier;
};

export async function updatePharmaSupplier(
  token: string,
  tenantSlug: string,
  supplierId: number,
  payload: UpdatePharmaSupplierPayload,
): Promise<UpdatePharmaSupplierResponse> {
  return sendJsonWithTenant<UpdatePharmaSupplierResponse>(
    token,
    `/pharmaco/suppliers/${supplierId}`,
    tenantSlug,
    'PATCH',
    payload,
  );
}

export type ControlPharmaPurchaseOrderResponse = {
  message: string;
  purchase_order: PharmaPurchaseOrder;
};

export async function approvePharmaPurchaseOrder(
  token: string,
  tenantSlug: string,
  purchaseOrderId: number,
): Promise<ControlPharmaPurchaseOrderResponse> {
  return sendJsonWithTenant<ControlPharmaPurchaseOrderResponse>(
    token,
    `/pharmaco/purchase-orders/${purchaseOrderId}/approve`,
    tenantSlug,
    'POST',
    {},
  );
}

export async function cancelPharmaPurchaseOrder(
  token: string,
  tenantSlug: string,
  purchaseOrderId: number,
  reason?: string,
): Promise<ControlPharmaPurchaseOrderResponse> {
  return sendJsonWithTenant<ControlPharmaPurchaseOrderResponse>(
    token,
    `/pharmaco/purchase-orders/${purchaseOrderId}/cancel`,
    tenantSlug,
    'POST',
    { reason: reason || null },
  );
}


export type PharmaSupplierInvoicePayment = {
  id: number;
  uuid: string;
  payment_number: string;
  amount: number;
  payment_method: string;
  reference_number?: string | null;
  status: string;
  paid_at?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type PharmaSupplierInvoiceItem = {
  id: number;
  uuid: string;
  purchase_order_item_id?: number | null;
  product?: PharmaProduct | null;
  product_name_snapshot: string;
  sku_snapshot?: string | null;
  quantity: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type PharmaSupplierInvoice = {
  id: number;
  uuid: string;
  invoice_number: string;
  supplier_invoice_number?: string | null;
  status: string;
  invoice_date?: string | null;
  due_date?: string | null;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  approved_at?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  supplier?: PharmaSupplier | null;
  purchase_order?: {
    id: number;
    po_number: string;
    status: string;
  } | null;
  items_count?: number | null;
  payments_count?: number | null;
  items?: PharmaSupplierInvoiceItem[];
  payments?: PharmaSupplierInvoicePayment[];
  created_at?: string | null;
};

export type TenantPayload = {
  id: number;
  uuid?: string | null;
  name: string;
  slug: string;
  code?: string | null;
  status?: string | null;
};

export type PharmaSupplierInvoicesResponse = {
  tenant: TenantPayload;
  supplier_invoices: PharmaSupplierInvoice[];
};

export type PharmaSupplierInvoiceResponse = {
  tenant: TenantPayload;
  supplier_invoice: PharmaSupplierInvoice;
};

export type CreatePharmaSupplierInvoicePayload = {
  pharmaco_supplier_id: number;
  pharmaco_purchase_order_id?: number | null;
  invoice_number?: string | null;
  supplier_invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  discount_amount?: number;
  tax_amount?: number;
  notes?: string | null;
  items: Array<{
    pharmaco_purchase_order_item_id?: number | null;
    product_id?: number | null;
    quantity: number;
    unit_cost: number;
    discount_amount?: number;
    tax_amount?: number;
    notes?: string | null;
  }>;
};

export type CreatePharmaSupplierInvoiceResponse = {
  message: string;
  supplier_invoice: PharmaSupplierInvoice;
};

export type ApprovePharmaSupplierInvoiceResponse = {
  message: string;
  supplier_invoice: PharmaSupplierInvoice;
};

export type RecordPharmaSupplierPaymentPayload = {
  amount: number;
  payment_method: 'cash' | 'momo' | 'card' | 'bank_transfer' | 'cheque' | 'credit';
  reference_number?: string | null;
  paid_at?: string | null;
  notes?: string | null;
};

export type RecordPharmaSupplierPaymentResponse = {
  message: string;
  supplier_payment: PharmaSupplierInvoicePayment;
  supplier_invoice: PharmaSupplierInvoice;
};

export async function getPharmaSupplierInvoices(
  token: string,
  tenantSlug: string,
): Promise<PharmaSupplierInvoicesResponse> {
  return getJsonWithTenant<PharmaSupplierInvoicesResponse>(
    token,
    '/pharmaco/supplier-invoices',
    tenantSlug,
  );
}

export async function getPharmaSupplierInvoice(
  token: string,
  tenantSlug: string,
  supplierInvoiceId: number,
): Promise<PharmaSupplierInvoiceResponse> {
  return getJsonWithTenant<PharmaSupplierInvoiceResponse>(
    token,
    `/pharmaco/supplier-invoices/${supplierInvoiceId}`,
    tenantSlug,
  );
}

export async function createPharmaSupplierInvoice(
  token: string,
  tenantSlug: string,
  payload: CreatePharmaSupplierInvoicePayload,
): Promise<CreatePharmaSupplierInvoiceResponse> {
  return sendJsonWithTenant<CreatePharmaSupplierInvoiceResponse>(
    token,
    '/pharmaco/supplier-invoices',
    tenantSlug,
    'POST',
    payload,
  );
}

export async function approvePharmaSupplierInvoice(
  token: string,
  tenantSlug: string,
  supplierInvoiceId: number,
): Promise<ApprovePharmaSupplierInvoiceResponse> {
  return sendJsonWithTenant<ApprovePharmaSupplierInvoiceResponse>(
    token,
    `/pharmaco/supplier-invoices/${supplierInvoiceId}/approve`,
    tenantSlug,
    'POST',
    {},
  );
}

export async function recordPharmaSupplierPayment(
  token: string,
  tenantSlug: string,
  supplierInvoiceId: number,
  payload: RecordPharmaSupplierPaymentPayload,
): Promise<RecordPharmaSupplierPaymentResponse> {
  return sendJsonWithTenant<RecordPharmaSupplierPaymentResponse>(
    token,
    `/pharmaco/supplier-invoices/${supplierInvoiceId}/payments`,
    tenantSlug,
    'POST',
    payload,
  );
}


export type PharmaReportPeriod = {
  start_date: string;
  end_date: string;
};

export type PharmaInventoryLocationValuation = {
  stock_location_id: number | null;
  location_name: string | null;
  branch_name: string | null;
  batch_count: number;
  total_quantity_on_hand: number;
  total_cost_value: number;
};

export type PharmaInventoryValuationReport = {
  batch_count: number;
  product_count: number;
  total_quantity_on_hand: number;
  total_cost_value: number;
  total_retail_value: number;
  estimated_margin_value: number;
  low_stock_batches: number;
  expired_batches: number;
  expiring_soon_batches: number;
  locations?: PharmaInventoryLocationValuation[];
};

export type PharmaSalesPaymentMethodSummary = {
  payment_method: string;
  payment_count: number;
  total_amount: number;
};

export type PharmaSalesSummaryReport = {
  sale_count: number;
  draft_sale_count: number;
  dispensed_sale_count: number;
  total_sales_amount: number;
  paid_amount: number;
  balance_amount: number;
  payments_collected: number;
  payment_methods?: PharmaSalesPaymentMethodSummary[];
};

export type PharmaProcurementStatusSummary = {
  status: string;
  purchase_order_count: number;
  total_amount: number;
};

export type PharmaProcurementSummaryReport = {
  purchase_order_count: number;
  draft_purchase_order_count: number;
  approved_purchase_order_count: number;
  received_purchase_order_count: number;
  cancelled_purchase_order_count: number;
  total_purchase_order_amount: number;
  status_summary?: PharmaProcurementStatusSummary[];
};

export type PharmaPayablesStatusSummary = {
  status: string;
  invoice_count: number;
  total_amount: number;
  balance_amount: number;
};

export type PharmaPayablesSummaryReport = {
  supplier_invoice_count: number;
  draft_invoice_count: number;
  approved_invoice_count: number;
  partially_paid_invoice_count: number;
  paid_invoice_count: number;
  overdue_invoice_count: number;
  total_invoice_amount: number;
  paid_amount: number;
  balance_amount: number;
  payments_recorded: number;
  status_summary?: PharmaPayablesStatusSummary[];
};

export type PharmaReportingOverviewResponse = {
  tenant: TenantPayload;
  period: PharmaReportPeriod;
  inventory: PharmaInventoryValuationReport;
  sales: PharmaSalesSummaryReport;
  procurement: PharmaProcurementSummaryReport;
  payables: PharmaPayablesSummaryReport;
};

export type PharmaInventoryValuationReportResponse = {
  tenant: TenantPayload;
  inventory: PharmaInventoryValuationReport;
};

export type PharmaSalesSummaryReportResponse = {
  tenant: TenantPayload;
  period: PharmaReportPeriod;
  sales: PharmaSalesSummaryReport;
};

export type PharmaProcurementSummaryReportResponse = {
  tenant: TenantPayload;
  period: PharmaReportPeriod;
  procurement: PharmaProcurementSummaryReport;
};

export type PharmaPayablesSummaryReportResponse = {
  tenant: TenantPayload;
  period: PharmaReportPeriod;
  payables: PharmaPayablesSummaryReport;
};



export type PharmaCustomerCreditExposureExportRow = {
  receivable_id: number;
  customer_id: number;
  customer_name: string | null;
  reference_number: string | null;
  status: string;
  original_amount: number;
  collected_amount: number;
  balance_amount: number;
  due_date: string | null;
  days_overdue: number;
  aging_bucket_code: string;
  aging_bucket_label: string;
};

export type PharmaCustomerCreditExposureExportResponse = {
  tenant: TenantPayload;
  period: {
    as_of_date: string;
  };
  export: {
    report: string;
    format: string;
    rows_count: number;
    generated_at: string;
  };
  rows: PharmaCustomerCreditExposureExportRow[];
};

export type PharmaCustomerCreditExposureAgingBucket = {
  code: string;
  label: string;
  balance: number;
  receivables_count: number;
};

export type PharmaCustomerCreditExposureReport = {
  open_balance: number;
  overdue_balance: number;
  current_balance: number;
  credit_limit_total: number;
  customers_on_credit: number;
  open_receivables_count: number;
  overdue_receivables_count: number;
  aging_buckets: PharmaCustomerCreditExposureAgingBucket[];
};

export type PharmaCustomerCreditExposureReportResponse = {
  tenant: TenantPayload;
  period: {
    as_of_date: string;
  };
  customer_credit_exposure: PharmaCustomerCreditExposureReport;
};

export type PharmaReportDateFilters = {
  start_date?: string;
  end_date?: string;
};

function reportDateQuery(filters?: PharmaReportDateFilters): string {
  const params = new URLSearchParams();

  if (filters?.start_date) {
    params.set('start_date', filters.start_date);
  }

  if (filters?.end_date) {
    params.set('end_date', filters.end_date);
  }

  const query = params.toString();

  return query ? `?${query}` : '';
}

export async function getPharmaReportingOverview(
  token: string,
  tenantSlug: string,
  filters?: PharmaReportDateFilters,
): Promise<PharmaReportingOverviewResponse> {
  return getJsonWithTenant<PharmaReportingOverviewResponse>(
    token,
    `/pharmaco/reports/overview${reportDateQuery(filters)}`,
    tenantSlug,
  );
}

export async function getPharmaInventoryValuationReport(
  token: string,
  tenantSlug: string,
): Promise<PharmaInventoryValuationReportResponse> {
  return getJsonWithTenant<PharmaInventoryValuationReportResponse>(
    token,
    '/pharmaco/reports/inventory-valuation',
    tenantSlug,
  );
}

export async function getPharmaSalesSummaryReport(
  token: string,
  tenantSlug: string,
  filters?: PharmaReportDateFilters,
): Promise<PharmaSalesSummaryReportResponse> {
  return getJsonWithTenant<PharmaSalesSummaryReportResponse>(
    token,
    `/pharmaco/reports/sales-summary${reportDateQuery(filters)}`,
    tenantSlug,
  );
}

export async function getPharmaProcurementSummaryReport(
  token: string,
  tenantSlug: string,
  filters?: PharmaReportDateFilters,
): Promise<PharmaProcurementSummaryReportResponse> {
  return getJsonWithTenant<PharmaProcurementSummaryReportResponse>(
    token,
    `/pharmaco/reports/procurement-summary${reportDateQuery(filters)}`,
    tenantSlug,
  );
}

export async function getPharmaPayablesSummaryReport(
  token: string,
  tenantSlug: string,
  filters?: PharmaReportDateFilters,
): Promise<PharmaPayablesSummaryReportResponse> {
  return getJsonWithTenant<PharmaPayablesSummaryReportResponse>(
    token,
    `/pharmaco/reports/payables-summary${reportDateQuery(filters)}`,
    tenantSlug,
  );
}



export async function getPharmaCustomerCreditExposureExport(
  token: string,
  tenantSlug: string,
): Promise<PharmaCustomerCreditExposureExportResponse> {
  return getJsonWithTenant<PharmaCustomerCreditExposureExportResponse>(
    token,
    '/pharmaco/reports/customer-credit-exposure/export',
    tenantSlug,
  );
}

export async function getPharmaCustomerCreditExposureReport(
  token: string,
  tenantSlug: string,
): Promise<PharmaCustomerCreditExposureReportResponse> {
  return getJsonWithTenant<PharmaCustomerCreditExposureReportResponse>(
    token,
    '/pharmaco/reports/customer-credit-exposure',
    tenantSlug,
  );
}


// -----------------------------------------------------------------------------
// Phase 11.2 customer credit receivables API
// -----------------------------------------------------------------------------

export type PharmaReceivableCustomer = {
  id: number;
  customer_code?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  email?: string | null;
  status?: string;
  credit_limit?: number;
  credit_balance?: number;
  credit_terms_days?: number | null;
  credit_status?: 'enabled' | 'disabled' | 'suspended' | string;
};

export type PharmaReceivablePayment = {
  id: number;
  uuid?: string;
  payment_number?: string;
  amount: number;
  payment_method: string;
  reference_number?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  status?: string;
};

export type PharmaReceivable = {
  id: number;
  uuid?: string;
  receivable_number: string;
  status: 'open' | 'partially_collected' | 'collected' | 'cancelled' | string;
  original_amount: number;
  paid_amount: number;
  balance_amount: number;
  issued_at?: string | null;
  due_date?: string | null;
  closed_at?: string | null;
  notes?: string | null;
  customer?: PharmaReceivableCustomer | null;
  payments?: PharmaReceivablePayment[];
};

export type PharmaReceivablesResponse = {
  receivables: PharmaReceivable[];
};

export type PharmaReceivableDetailResponse = {
  receivable: PharmaReceivable;
};

export type PharmaReceivableCustomersResponse = {
  customers: PharmaReceivableCustomer[];
};

export type PharmaUpdateCustomerCreditPayload = {
  credit_limit: number;
  credit_terms_days?: number | null;
  credit_status: 'enabled' | 'disabled' | 'suspended';
};

export type PharmaCreateReceivablePayload = {
  pharmaco_customer_id: number;
  amount: number;
  issued_at?: string | null;
  due_date?: string | null;
  notes?: string | null;
};

export type PharmaRecordReceivablePaymentPayload = {
  amount: number;
  payment_method: 'cash' | 'momo' | 'card' | 'bank_transfer' | 'cheque';
  reference_number?: string | null;
  paid_at?: string | null;
  notes?: string | null;
};

const getReceivablesTenantSlug = (): string => {
  if (typeof window === 'undefined') {
    return 'vitapharma';
  }

  return (
    window.localStorage.getItem('ubuzima.currentTenantSlug') ||
    window.localStorage.getItem('pharmaco.tenantSlug') ||
    'vitapharma'
  );
};

const receivablesRequest = async <T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');
  headers.set('X-Tenant-Slug', getReceivablesTenantSlug());

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildApiUrl(API_BASE_URL, path), {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const validationMessage =
      payload?.message ||
      Object.values(payload?.errors || {})
        .flat()
        .filter(Boolean)
        .join(' ');

    throw new Error(validationMessage || 'Customer receivables request failed.');
  }

  return payload as T;
};

export const getPharmaReceivables = async (
  token: string,
): Promise<PharmaReceivablesResponse> => {
  return receivablesRequest<PharmaReceivablesResponse>(
    '/pharmaco/receivables',
    token,
  );
};

export const getPharmaReceivable = async (
  token: string,
  receivableId: number,
): Promise<PharmaReceivableDetailResponse> => {
  return receivablesRequest<PharmaReceivableDetailResponse>(
    `/pharmaco/receivables/${receivableId}`,
    token,
  );
};

export const getPharmaReceivableCustomers = async (
  token: string,
): Promise<PharmaReceivableCustomersResponse> => {
  return receivablesRequest<PharmaReceivableCustomersResponse>(
    '/pharmaco/customers',
    token,
  );
};

export const updatePharmaCustomerCredit = async (
  token: string,
  customerId: number,
  payload: PharmaUpdateCustomerCreditPayload,
): Promise<{ message: string; customer: PharmaReceivableCustomer }> => {
  return receivablesRequest<{ message: string; customer: PharmaReceivableCustomer }>(
    `/pharmaco/customers/${customerId}/credit`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
};

export const createPharmaReceivable = async (
  token: string,
  payload: PharmaCreateReceivablePayload,
): Promise<{ message: string; receivable: PharmaReceivable }> => {
  return receivablesRequest<{ message: string; receivable: PharmaReceivable }>(
    '/pharmaco/receivables',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
};

export const recordPharmaReceivablePayment = async (
  token: string,
  receivableId: number,
  payload: PharmaRecordReceivablePaymentPayload,
): Promise<{
  message: string;
  receivable_payment: PharmaReceivablePayment;
  receivable: PharmaReceivable;
}> => {
  return receivablesRequest<{
    message: string;
    receivable_payment: PharmaReceivablePayment;
    receivable: PharmaReceivable;
  }>(
    `/pharmaco/receivables/${receivableId}/payments`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
};

export type PlatformContentSection = {
  id: number;
  section_key: string;
  eyebrow: string | null;
  title: string | null;
  body: string | null;
  content: Record<string, unknown>;
  style: Record<string, unknown>;
  sort_order: number;
  status: 'active' | 'hidden' | 'draft';
  updated_at: string | null;
};

export type PlatformContentPage = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  template: string;
  status: 'draft' | 'published' | 'archived';
  seo: Record<string, unknown>;
  style: Record<string, unknown>;
  published_at: string | null;
  sections: PlatformContentSection[];
};

export async function getPlatformManagementPages(token: string): Promise<{ pages: PlatformContentPage[] }> {
  const response = await fetch(`${API_BASE_URL}/platform-management/pages`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load platform content pages.');
  }

  return data as { pages: PlatformContentPage[] };
}

export async function updatePlatformContentPage(
  token: string,
  pageId: number,
  payload: Partial<Pick<PlatformContentPage, 'title' | 'description' | 'template' | 'status' | 'seo' | 'style'>>,
): Promise<{ page: PlatformContentPage }> {
  const response = await fetch(`${API_BASE_URL}/platform-management/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to update platform page.');
  }

  return data as { page: PlatformContentPage };
}

export async function updatePlatformContentSection(
  token: string,
  sectionId: number,
  payload: Partial<Pick<PlatformContentSection, 'eyebrow' | 'title' | 'body' | 'content' | 'style' | 'sort_order' | 'status'>>,
): Promise<{ section: PlatformContentSection }> {
  const response = await fetch(`${API_BASE_URL}/platform-management/sections/${sectionId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to update platform section.');
  }

  return data as { section: PlatformContentSection };
}

export type CorporateMailMessage = {
  id: number;
  uuid: string;
  folder_key: string | null;
  direction: string;
  subject: string;
  from_name: string | null;
  from_email: string;
  to_recipients: string[];
  cc_recipients: string[];
  body_preview: string | null;
  body: string | null;
  importance: string;
  status: string;
  read_at: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string | null;
  metadata: Record<string, unknown>;
};

export type CorporateMailOverview = {
  account: {
    id: number;
    display_name: string;
    email_address: string;
    provider: string;
    status: string;
    sync_status: string;
    last_synced_at: string | null;
    configuration: Record<string, unknown>;
  };
  folders: Array<{
    id: number;
    folder_key: string;
    name: string;
    unread_count: number;
  }>;
  active_folder: string | null;
  messages: CorporateMailMessage[];
};

export async function getCorporateMailOverview(
  token: string,
  folder = 'inbox',
): Promise<CorporateMailOverview> {
  const response = await fetch(`${API_BASE_URL}/corporate-mail/overview?folder=${encodeURIComponent(folder)}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load corporate mail.');
  }

  return data as CorporateMailOverview;
}

export async function sendCorporateMailMessage(
  token: string,
  payload: {
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
    importance?: 'low' | 'normal' | 'high';
  },
): Promise<{ message: string; mail_message: CorporateMailMessage }> {
  const response = await fetch(`${API_BASE_URL}/corporate-mail/messages`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationMessage = data?.errors ? Object.values(data.errors).flat().join(' ') : null;
    throw new Error(validationMessage || data?.message || 'Unable to send corporate mail.');
  }

  return data as { message: string; mail_message: CorporateMailMessage };
}

export type PharmacistChatConversation = {
  id: number;
  uuid: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  source_channel: string;
  status: string;
  priority: string;
  last_message_at: string | null;
  tenant: {
    id: number;
    name: string;
    slug: string;
  } | null;
  branch: {
    id: number;
    name: string;
    code: string;
  } | null;
  assigned_pharmacist: {
    id: number;
    name: string;
    email: string;
  } | null;
  latest_message: PharmacistChatMessage | null;
};

export type PharmacistChatMessage = {
  id: number;
  uuid: string;
  sender_type: string;
  sender_user_id: number | null;
  sender_display_name: string | null;
  body: string;
  read_at: string | null;
  created_at: string | null;
};

export async function getPharmacistChatConversations(
  token: string,
): Promise<{ conversations: PharmacistChatConversation[] }> {
  const response = await fetch(`${API_BASE_URL}/pharmacist-chat/conversations`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load pharmacist chats.');
  }

  return data as { conversations: PharmacistChatConversation[] };
}

export async function getPharmacistChatConversation(
  token: string,
  uuid: string,
): Promise<{ conversation: PharmacistChatConversation; messages: PharmacistChatMessage[] }> {
  const response = await fetch(`${API_BASE_URL}/pharmacist-chat/conversations/${uuid}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load chat conversation.');
  }

  return data as { conversation: PharmacistChatConversation; messages: PharmacistChatMessage[] };
}

export async function replyToPharmacistChat(
  token: string,
  uuid: string,
  body: string,
): Promise<{ message: string; chat_message: PharmacistChatMessage; conversation: PharmacistChatConversation }> {
  const response = await fetch(`${API_BASE_URL}/pharmacist-chat/conversations/${uuid}/messages`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to send chat reply.');
  }

  return data as { message: string; chat_message: PharmacistChatMessage; conversation: PharmacistChatConversation };
}

export async function updatePharmacistChatConversation(
  token: string,
  uuid: string,
  payload: Partial<Pick<PharmacistChatConversation, 'status' | 'priority'>>,
): Promise<{ message: string; conversation: PharmacistChatConversation }> {
  const response = await fetch(`${API_BASE_URL}/pharmacist-chat/conversations/${uuid}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to update chat conversation.');
  }

  return data as { message: string; conversation: PharmacistChatConversation };
}

export type DataLayerTable = {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
  row_count: number;
  editable: boolean;
  relationships: Array<{
    column: string;
    hint: string;
  }>;
};

export async function getDataLayerSchema(token: string): Promise<{ tables: DataLayerTable[]; guardrails: Record<string, unknown> }> {
  const response = await fetch(`${API_BASE_URL}/admin/data-layer/schema`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load data-layer schema.');
  }

  return data as { tables: DataLayerTable[]; guardrails: Record<string, unknown> };
}

export async function getDataLayerRows(
  token: string,
  table: string,
): Promise<{ table: string; editable: boolean; columns: string[]; rows: Array<Record<string, unknown>>; total_rows: number }> {
  const response = await fetch(`${API_BASE_URL}/admin/data-layer/tables/${encodeURIComponent(table)}/rows`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load table rows.');
  }

  return data as { table: string; editable: boolean; columns: string[]; rows: Array<Record<string, unknown>>; total_rows: number };
}

export async function runDataLayerSql(
  token: string,
  sql: string,
): Promise<{ message: string; results: Array<{ type: string; rows?: Array<Record<string, unknown>>; status?: string }> }> {
  const response = await fetch(`${API_BASE_URL}/admin/data-layer/sql`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationMessage = data?.errors ? Object.values(data.errors).flat().join(' ') : null;
    throw new Error(validationMessage || data?.message || 'Unable to run SQL.');
  }

  return data as { message: string; results: Array<{ type: string; rows?: Array<Record<string, unknown>>; status?: string }> };
}

export type AiCenterOverview = {
  providers: Array<Record<string, unknown>>;
  models: Array<Record<string, unknown>>;
  agents: Array<Record<string, unknown>>;
  recommendations: Array<AiRecommendation>;
  summary: {
    active_models: number;
    active_agents: number;
    pending_recommendations: number;
    implemented_recommendations: number;
  };
};

export type AiRecommendation = {
  id: number;
  recommendation_type: string;
  title: string;
  risk_level: string;
  confidence_score: number | null;
  explanation: string | null;
  data_source_summary: string | null;
  recommended_action: string | null;
  requires_approval: boolean;
  status: string;
  agent: {
    id: number;
    name: string;
    code: string;
  } | null;
  created_at: string | null;
};

export async function getAiCenterOverview(
  token: string,
  tenantSlug: string,
): Promise<AiCenterOverview> {
  return getJsonWithTenant<AiCenterOverview>(token, '/ai-center/overview', tenantSlug);
}

export async function activateAiDefaults(
  token: string,
  tenantSlug: string,
): Promise<{ message: string; models_count: number; agent: Record<string, unknown> }> {
  return sendJsonWithTenant<{ message: string; models_count: number; agent: Record<string, unknown> }>(
    token,
    '/ai-center/activate-defaults',
    tenantSlug,
    'POST',
    {},
  );
}

export async function generateInventoryAiRecommendations(
  token: string,
  tenantSlug: string,
): Promise<{ message: string; created_or_refreshed: number; recommendations: AiRecommendation[] }> {
  return sendJsonWithTenant<{ message: string; created_or_refreshed: number; recommendations: AiRecommendation[] }>(
    token,
    '/ai-center/recommendations/inventory/generate',
    tenantSlug,
    'POST',
    {},
  );
}

export async function updateAiRecommendationStatus(
  token: string,
  tenantSlug: string,
  recommendationId: number,
  status: 'approved' | 'rejected' | 'implemented',
): Promise<{ message: string; recommendation: AiRecommendation }> {
  return sendJsonWithTenant<{ message: string; recommendation: AiRecommendation }>(
    token,
    `/ai-center/recommendations/${recommendationId}`,
    tenantSlug,
    'PATCH',
    { status },
  );
}

export type SupportedLanguage = {
  code: 'en' | 'fr' | 'pt';
  name: string;
  native_name: string;
};

export type Market = {
  id: number;
  code: string;
  name: string;
  country_code: string;
  default_language: 'en' | 'fr' | 'pt';
  currency_code: string;
  timezone: string;
  service_radius_km: number;
  status: string;
  tenant_assignments_count?: number;
  service_providers_count?: number;
};

export type LocalizationContext = {
  supported_languages: SupportedLanguage[];
  selected_language: 'en' | 'fr' | 'pt';
  language_source: string;
  market: Market | null;
  ip_policy: {
    ip_address: string;
    country_code: string | null;
    restricted_to_market: string | null;
    allowed: boolean;
    message: string;
  };
};

export type TenantMarketAssignment = {
  id: number;
  status: string;
  service_radius_km: number | null;
  assigned_at: string | null;
  tenant: {
    id: number;
    name: string;
    slug: string;
    tenant_type: string;
    status: string;
  } | null;
  market: Market | null;
};

export type NearbyProvider = {
  id: number;
  uuid: string;
  name: string;
  provider_type: string;
  service_channels: string[];
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  service_radius_km: number | null;
  distance_km: number | null;
  tenant: {
    id: number;
    name: string;
    slug: string;
    website_url: string | null;
  } | null;
  branch: {
    id: number;
    name: string;
    code: string;
  } | null;
  market: {
    code: string;
    name: string;
  } | null;
};

export type SystemNotification = {
  id: number;
  uuid: string;
  title: string;
  body: string;
  notification_type: string;
  channel: string;
  audience_scope: string;
  status: string;
  published_at: string | null;
  read_at: string | null;
  tenant: {
    id: number;
    name: string;
    slug: string;
  } | null;
  market: {
    id: number;
    code: string;
    name: string;
  } | null;
};

export async function getLocalizationContext(): Promise<LocalizationContext> {
  const response = await fetch(`${API_BASE_URL}/localization/context`, {
    headers: { Accept: 'application/json' },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load localization context.');
  }

  return data as LocalizationContext;
}

export async function saveLocalizationPreference(
  token: string,
  payload: { language: 'en' | 'fr' | 'pt'; market_code?: string | null },
): Promise<{ message: string; preference: Record<string, unknown> }> {
  const response = await fetch(`${API_BASE_URL}/localization/preference`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to save localization preference.');
  }

  return data as { message: string; preference: Record<string, unknown> };
}

export async function getMarketAdminOverview(
  token: string,
): Promise<{ markets: Market[]; assignments: TenantMarketAssignment[]; provider_types: string[] }> {
  const response = await fetch(`${API_BASE_URL}/admin/markets`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load market management.');
  }

  return data as { markets: Market[]; assignments: TenantMarketAssignment[]; provider_types: string[] };
}

export async function assignTenantToMarket(
  token: string,
  payload: {
    tenant_slug: string;
    market_code: string;
    status?: string;
    service_radius_km?: number;
  },
): Promise<{ message: string; assignment: TenantMarketAssignment }> {
  const response = await fetch(`${API_BASE_URL}/admin/markets/assign-tenant`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to assign tenant market.');
  }

  return data as { message: string; assignment: TenantMarketAssignment };
}

export async function getNearbyProviders(params: {
  latitude?: number;
  longitude?: number;
  market_code?: string;
  provider_type?: string;
  limit?: number;
}): Promise<{ market: Market | null; providers: NearbyProvider[] }> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  const response = await fetch(`${API_BASE_URL}/nearby/providers${queryString ? `?${queryString}` : ''}`, {
    headers: { Accept: 'application/json' },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load nearby providers.');
  }

  return data as { market: Market | null; providers: NearbyProvider[] };
}

export async function getNotifications(
  token: string,
): Promise<{ unread_count: number; notifications: SystemNotification[] }> {
  const response = await fetch(`${API_BASE_URL}/notifications`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load notifications.');
  }

  return data as { unread_count: number; notifications: SystemNotification[] };
}

export async function createNotification(
  token: string,
  payload: {
    title: string;
    body: string;
    tenant_slug?: string | null;
    market_code?: string | null;
    notification_type?: string;
    audience_scope?: string;
    status?: 'draft' | 'published';
  },
): Promise<{ message: string; notification: SystemNotification }> {
  const response = await fetch(`${API_BASE_URL}/notifications`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationMessage = data?.errors ? Object.values(data.errors).flat().join(' ') : null;
    throw new Error(validationMessage || data?.message || 'Unable to create notification.');
  }

  return data as { message: string; notification: SystemNotification };
}

export async function markNotificationRead(token: string, notificationId: number): Promise<{ message: string; read_at: string }> {
  const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to mark notification as read.');
  }

  return data as { message: string; read_at: string };
}


async function apiRequest<T>(
  token: string,
  tenantSlug: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-Tenant-Slug', tenantSlug);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildApiUrl(API_BASE_URL, path), {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const validationMessage = payload?.errors
      ? Object.values(payload.errors).flat().filter(Boolean).join(' ')
      : '';

    throw new Error(validationMessage || payload?.message || 'Request failed.');
  }

  return payload as T;
}

export type TenantUserRoleTemplate = {
  code: string;
  name: string;
  description: string;
  permissions: string[];
};

export type TenantSecurityUser = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  job_title?: string | null;
  status?: string | null;
  security?: {
    two_factor_required: boolean;
    two_factor_enabled: boolean;
    must_change_password: boolean;
    last_login_at: string | null;
    trusted_devices_count: number;
    active_sessions_count: number;
  };
  roles: Array<{
    id: number;
    name: string;
    code: string;
    stored_code?: string;
    access_assignment_mode?:
      | 'predefined_role'
      | 'granular_permissions';
    permissions: string[];
  }>;
};

export async function getTenantSecurityRoleTemplates(token: string, tenantSlug: string) {
  return apiRequest<{
    roles: TenantUserRoleTemplate[];
  }>(token, tenantSlug, '/access-check/security/role-templates');
}

export async function getTenantSecurityUsers(token: string, tenantSlug: string) {
  return apiRequest<{
    tenant: { id: number; name: string; slug: string };
    users: TenantSecurityUser[];
  }>(token, tenantSlug, '/access-check/security/users');
}

export async function createTenantSecurityUser(
  token: string,
  tenantSlug: string,
  payload: {
    tenant_slug: string;
    name: string;
    email: string;
    phone?: string;
    job_title?: string;
    access_assignment_mode:
      | 'predefined_role'
      | 'granular_permissions';
    role_code: string;
    permissions?: string[];
    password?: string;
    status?: string;
    two_factor_required?: boolean;
  },
) {
  return apiRequest<{
    message: string;
    temporary_password: string;
    user: { id: number; name: string; email: string; phone?: string | null };
  }>(token, tenantSlug, '/access-check/security/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTenantSecurityUser(
  token: string,
  tenantSlug: string,
  userId: number,
  payload: {
    tenant_slug: string;
    name: string;
    email?: string;
    phone?: string;
    job_title?: string;
    access_assignment_mode:
      | 'predefined_role'
      | 'granular_permissions';
    role_code: string;
    permissions?: string[];
    status?: string;
    two_factor_required?: boolean;
  },
) {
  return apiRequest<{
    message: string;
  }>(token, tenantSlug, `/access-check/security/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTenantSecurityUser(
  token: string,
  tenantSlug: string,
  userId: number,
) {
  return apiRequest<{
    message: string;
  }>(token, tenantSlug, `/access-check/security/users/${userId}`, {
    method: 'DELETE',
  });
}


export type SecurityRiskLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'blocked';

export type SecurityOperationsUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  status:
    | 'active'
    | 'invited'
    | 'suspended'
    | 'inactive';
  branch: {
    id: number;
    name: string;
    code: string;
  } | null;
  roles: Array<{
    id: number;
    name: string;
    code: string;
    permissions_count: number;
  }>;
  security: {
    risk_level: SecurityRiskLevel;
    two_factor_required: boolean;
    two_factor_enabled: boolean;
    two_factor_confirmed_at: string | null;
    two_factor_last_verified_at: string | null;
    must_change_password: boolean;
    last_login_at: string | null;
    trusted_devices_count: number;
    active_sessions_count: number;
  };
  trusted_devices: Array<{
    id: number;
    device_name: string | null;
    ip_address: string | null;
    last_used_at: string | null;
    trusted_until: string | null;
  }>;
  sessions: Array<{
    id: number;
    name: string;
    abilities: string[];
    last_used_at: string | null;
    created_at: string | null;
    expires_at: string | null;
  }>;
};

export type SecurityOperationsResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  summary: {
    total_users: number;
    active_users: number;
    invited_users: number;
    suspended_users: number;
    inactive_users: number;
    two_factor_required: number;
    two_factor_enabled: number;
    two_factor_pending: number;
    password_change_required: number;
    active_sessions: number;
    trusted_devices: number;
    never_logged_in: number;
    high_risk_users: number;
    two_factor_compliance_percent: number;
  };
  users: SecurityOperationsUser[];
  generated_at: string;
};

export type SecurityUserAction =
  | 'force-password-change'
  | 'reset-two-factor'
  | 'revoke-trusted-devices'
  | 'revoke-sessions'
  | 'status';

export async function getSecurityOperations(
  token: string,
  tenantSlug: string,
): Promise<SecurityOperationsResponse> {
  return apiRequest<SecurityOperationsResponse>(
    token,
    tenantSlug,
    '/access-check/security/operations',
  );
}

export async function runSecurityUserAction(
  token: string,
  tenantSlug: string,
  userId: number,
  action: SecurityUserAction,
  payload: {
    status?: string;
    reason?: string;
  } = {},
): Promise<{
  message: string;
  revoked_count?: number;
  user: SecurityOperationsUser;
}> {
  return apiRequest(
    token,
    tenantSlug,
    `/access-check/security/users/${userId}/${action}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}


export type SodConflict = {
  code: string;
  severity: 'medium' | 'high' | 'critical';
  message: string;
  resource?: string;
  permissions: string[];
};

export type SodAssessment = {
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'blocked';
  permission_count: number;
  elevated_permission_count: number;
  elevated_permissions: string[];
  conflict_count: number;
  blocking_conflict_count: number;
  conflicts: SodConflict[];
  compliant: boolean;
};

export type GovernedRole = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  scope_type: string;
  status: string;
  role_type: 'managed' | 'custom';
  permissions: string[];
  permission_count: number;
  active_user_count: number;
  sod: SodAssessment;
};

export type PermissionCatalogueGroup = {
  group: string;
  permissions: Array<{
    id: number;
    code: string;
    name: string;
    description: string | null;
  }>;
};

export type RoleGovernanceResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  summary: {
    total_roles: number;
    custom_roles: number;
    managed_roles: number;
    active_roles: number;
    roles_with_conflicts: number;
  };
  roles: GovernedRole[];
  permission_catalogue:
    PermissionCatalogueGroup[];
  generated_at: string;
};

export type SecurityAuditEvent = {
  id: number;
  action: string;
  category: 'role' | 'user' | 'security';
  actor: {
    id: number;
    name: string;
    email: string;
  } | null;
  target: {
    type: string | null;
    id: number | null;
    user: {
      id: number;
      name: string;
      email: string;
    } | null;
    role_name: string | null;
  };
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
};

export type SecurityAuditTimelineResponse = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  summary: {
    event_count: number;
    user_events: number;
    role_events: number;
    security_events: number;
    unique_actors: number;
  };
  events: SecurityAuditEvent[];
  generated_at: string;
};

export async function getRoleGovernance(
  token: string,
  tenantSlug: string,
): Promise<RoleGovernanceResponse> {
  return apiRequest<RoleGovernanceResponse>(
    token,
    tenantSlug,
    '/access-check/security/roles',
  );
}

export async function assessRolePermissions(
  token: string,
  tenantSlug: string,
  permissions: string[],
): Promise<{
  assessment: SodAssessment;
}> {
  return apiRequest(
    token,
    tenantSlug,
    '/access-check/security/roles/assess',
    {
      method: 'POST',
      body: JSON.stringify({
        permissions,
      }),
    },
  );
}

export async function createGovernedRole(
  token: string,
  tenantSlug: string,
  payload: {
    name: string;
    description?: string;
    permissions: string[];
  },
): Promise<{
  message: string;
  role: GovernedRole;
}> {
  return apiRequest(
    token,
    tenantSlug,
    '/access-check/security/roles',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function updateGovernedRole(
  token: string,
  tenantSlug: string,
  roleId: number,
  payload: {
    name: string;
    description?: string;
    status?: string;
    permissions: string[];
  },
): Promise<{
  message: string;
  role: GovernedRole;
}> {
  return apiRequest(
    token,
    tenantSlug,
    `/access-check/security/roles/${roleId}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}

export async function cloneGovernedRole(
  token: string,
  tenantSlug: string,
  roleId: number,
  payload: {
    name?: string;
    description?: string;
  } = {},
): Promise<{
  message: string;
  role: GovernedRole;
}> {
  return apiRequest(
    token,
    tenantSlug,
    `/access-check/security/roles/${roleId}/clone`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function archiveGovernedRole(
  token: string,
  tenantSlug: string,
  roleId: number,
): Promise<{
  message: string;
  role: GovernedRole;
}> {
  return apiRequest(
    token,
    tenantSlug,
    `/access-check/security/roles/${roleId}/archive`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export async function getSecurityAuditTimeline(
  token: string,
  tenantSlug: string,
  filters: {
    search?: string;
    action?: string;
    actor_user_id?: number;
    from?: string;
    to?: string;
    limit?: number;
  } = {},
): Promise<SecurityAuditTimelineResponse> {
  const query = new URLSearchParams();

  Object.entries(filters).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        query.set(key, String(value));
      }
    },
  );

  const suffix = query.toString()
    ? `?${query.toString()}`
    : '';

  return apiRequest<SecurityAuditTimelineResponse>(
    token,
    tenantSlug,
    `/access-check/security/audit-timeline${suffix}`,
  );
}

/* AQUILA_INVENTORY_INTELLIGENCE_20260713 */

export type InventoryMovementDay = {
  date: string;
  day: string;
  short_day: string;
  is_today: boolean;
  is_future: boolean;
  receipts: number;
  issues: number;
  adjustments: number;
  net: number;
  transactions: number;
};

export type InventoryMovementHistoryRow = {
  id: number;
  movement_type: string;
  quantity: number;
  running_balance: number | null;
  reference_type: string | null;
  reference_number: string | null;
  reason: string | null;
  product_name: string;
  product_sku: string | null;
  branch_name: string | null;
  branch_code: string | null;
  occurred_at: string;
};

export type NearExpiryValuePoint = {
  date: string;
  day: string;
  short_day: string;
  value: number | null;
  is_today: boolean;
  is_future: boolean;
};

export type PharmaInventoryIntelligenceResponse = {
  period: {
    starts_on: string;
    ends_on: string;
    timezone: string;
    generated_at: string;
  };
  live_summary?: {
    movement_count: number;
    positive_quantity: number;
    negative_quantity: number;
    near_expiry_batches: number;
    near_expiry_units: number;
    near_expiry_value: number;
  };
  weekly_movements: {
    days: InventoryMovementDay[];
    totals: {
      receipts: number;
      issues: number;
      adjustments: number;
      net: number;
      transactions: number;
    };
    recent: InventoryMovementHistoryRow[];
  };
  near_expiry_value_trend: {
    threshold_days: number;
    points: NearExpiryValuePoint[];
    direction:
      | "increasing"
      | "decreasing"
      | "stable";
    delta: number;
    latest_value: number | null;
    data_source: string;
    is_estimated: boolean;
  };
};

export async function getPharmaInventoryIntelligence(
  token: string,
  tenantSlug: string,
  filters: {
    branchId?: number;
  } = {},
): Promise<PharmaInventoryIntelligenceResponse> {
  const query = new URLSearchParams();

  if (filters.branchId) {
    query.set(
      "branch_id",
      String(filters.branchId),
    );
  }

  const encoded = query.toString();

  return getJsonWithTenant<
    PharmaInventoryIntelligenceResponse
  >(
    token,
    tenantSlug,
    `/pharmaco/inventory/intelligence${
      encoded ? `?${encoded}` : ""
    }`,
  );
}

export async function resetSecurityUserPassword(
  token: string,
  tenantSlug: string,
  userId: number,
  payload: {
    password: string;
    password_confirmation: string;
    reason?: string;
  },
): Promise<{
  message: string;
  sessions_revoked: number;
  user: SecurityOperationsUser;
}> {
  return sendJsonWithTenant<{
    message: string;
    sessions_revoked: number;
    user: SecurityOperationsUser;
  }>(
    token,
    `/access-check/security/users/${userId}/reset-password`,
    tenantSlug,
    'POST',
    payload,
  );
}

export interface PharmaLiveBusinessAnalyticsSignal {
  label: string;
  value: number;
  detail: string;
}

export interface PharmaLiveBusinessAnalyticsResponse {
  message: string;
  business_date: string;
  sales_total: number;
  collections_total: number;
  open_balance: number;
  transaction_count: number;
  receipt_count: number;
  average_transaction_value: number;
  collection_ratio: number;
  payment_methods: Array<{
    payment_method: string | null;
    count: number;
    amount: number;
  }>;
  signals: PharmaLiveBusinessAnalyticsSignal[];
}

export interface PharmaRecentTransactionWithUser {
  id: number;
  sale_number: string | null;
  business_date: string | null;
  sold_at: string | null;
  created_at: string | null;
  created_by: number | null;
  total_amount: number;
  payment_status: string | null;
  payment_method: string | null;
  receipt_number: string | null;
  paid_amount: number | null;
  received_at: string | null;
  received_by: number | null;
  operator_name: string | null;
  operator_email: string | null;
}

function ubuzimaHandoverApiBase(): string {
  const configuredBase = String(import.meta.env.VITE_API_BASE_URL ?? '').trim();
  return configuredBase ? configuredBase.replace(/\/$/, '') : '/api/v1';
}

async function ubuzimaHandoverRequest<T>(
  token: string,
  tenantSlug: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${ubuzimaHandoverApiBase()}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
      'X-Tenant': tenantSlug,
      'X-Tenant-Code': tenantSlug,
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String((payload as { message?: unknown }).message ?? 'Request failed.')
      : 'Request failed.';

    throw new Error(message);
  }

  return payload as T;
}

export async function getPharmaLiveBusinessAnalytics(
  token: string,
  tenantSlug: string,
  businessDate?: string | null,
): Promise<PharmaLiveBusinessAnalyticsResponse> {
  const params = businessDate ? `?business_date=${encodeURIComponent(businessDate)}` : '';

  return ubuzimaHandoverRequest<PharmaLiveBusinessAnalyticsResponse>(
    token,
    tenantSlug,
    `/pharmaco/business-analytics/live${params}`,
  );
}

export async function getPharmaRecentTransactionsWithUsers(
  token: string,
  tenantSlug: string,
): Promise<{ message: string; transactions: PharmaRecentTransactionWithUser[] }> {
  return ubuzimaHandoverRequest<{ message: string; transactions: PharmaRecentTransactionWithUser[] }>(
    token,
    tenantSlug,
    '/pharmaco/pos/recent-transactions-with-users',
  );
}

export async function adminResetTenantSecurityUserPassword(
  token: string,
  tenantSlug: string,
  userId: number,
  payload: {
    password: string;
    password_confirmation: string;
    must_change_password?: boolean;
  },
): Promise<{
  message: string;
  sessions_revoked?: number;
  user?: unknown;
}> {
  return sendJsonWithTenant<{
    message: string;
    sessions_revoked?: number;
    user?: unknown;
  }>(
    token,
    `/security/users/${userId}/admin-reset-password`,
    tenantSlug,
    'POST',
    payload,
  );
}


export type TrendAnalysisArea =
  | 'inventory'
  | 'pos-sales'
  | 'general-stock'
  | 'insurance';

export type TrendAnalysisGranularity =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

export type TrendAnalysisPoint = {
  label: string;
  current: number;
  comparison: number;
  change_percent: number;
};

export type TrendAnalysisResponse = {
  area: TrendAnalysisArea;
  metric: string;
  granularity: TrendAnalysisGranularity;
  periods: {
    current: { start: string; end: string };
    comparison: { start: string; end: string };
  };
  summary: {
    current_total: number;
    comparison_total: number;
    variance_amount: number;
    variance_percent: number;
  };
  points: TrendAnalysisPoint[];
  insight: string;
};

export async function getPharmaTrendAnalysis(
  token: string,
  tenantSlug: string,
  params: {
    area: TrendAnalysisArea;
    metric: string;
    granularity: TrendAnalysisGranularity;
    current_start?: string;
    current_end?: string;
    comparison_start?: string;
    comparison_end?: string;
    branch_id?: number;
  },
): Promise<TrendAnalysisResponse> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  return apiRequest<TrendAnalysisResponse>(
    token,
    tenantSlug,
    `/v1/pharmaco/trend-analysis?${query.toString()}`,
  );
}

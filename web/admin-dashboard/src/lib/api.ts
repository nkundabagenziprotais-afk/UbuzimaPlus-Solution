export type LoginPayload = {
  email: string;
  password: string;
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

export type LoginResponse = {
  token_type: 'Bearer';
  access_token: string;
  profile: AccessProfile;
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

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000/api/v1';

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
      'Login failed. Please check your credentials and try again.';

    throw new Error(message);
  }

  return data as LoginResponse;
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
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

async function sendJsonWithTenant<T>(
  token: string,
  path: string,
  tenantSlug: string,
  method: 'POST' | 'PATCH',
  payload: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
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

    throw new Error(validationMessage || data?.message || 'Unable to save PharmaCo360 tenant data.');
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
  selling_price: number | null;
  supplier_name: string | null;
  status: string;
  product: {
    id: number;
    name: string;
    sku: string;
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
  };
  low_stock_products: PharmaProduct[];
};

export async function getPharmaProducts(
  token: string,
  tenantSlug: string,
): Promise<PharmaProductsResponse> {
  return getJsonWithTenant<PharmaProductsResponse>(token, '/pharmaco/products', tenantSlug);
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
): Promise<PharmaInventoryBatchesResponse> {
  const query = expiringWithinDays ? `?expiring_within_days=${expiringWithinDays}` : '';

  return getJsonWithTenant<PharmaInventoryBatchesResponse>(
    token,
    `/pharmaco/inventory/batches${query}`,
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

export async function receivePharmaStock(
  token: string,
  tenantSlug: string,
  payload: ReceivePharmaStockPayload,
): Promise<ReceivePharmaStockResponse> {
  return sendJsonWithTenant<ReceivePharmaStockResponse>(
    token,
    '/pharmaco/inventory/receive',
    tenantSlug,
    'POST',
    payload,
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

export type PharmaPurchaseOrderItem = {
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

export type PharmaPurchaseOrder = {
  id: number;
  uuid: string;
  po_number: string;
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

export type CreatePharmaPurchaseOrderPayload = {
  branch_id: number;
  pharmaco_supplier_id: number;
  order_date?: string | null;
  expected_delivery_date?: string | null;
  discount_amount?: number;
  tax_amount?: number;
  shipping_amount?: number;
  notes?: string | null;
  items: Array<{
    product_id: number;
    quantity_ordered: number;
    unit_cost: number;
    discount_amount?: number;
    tax_amount?: number;
    notes?: string | null;
  }>;
};

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
  return apiRequest<PharmaCustomerCreditExposureExportResponse>(
    "/api/v1/pharmaco/reports/customer-credit-exposure/export",
    {
      token,
      tenantSlug,
    },
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
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

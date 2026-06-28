export type LoginPayload = {
  email: string;
  password: string;
  device_name?: string;
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

  if (!response.ok) {
    const message =
      data?.message ||
      data?.errors?.email?.[0] ||
      'Login failed. Please check your credentials and try again.';

    throw new Error(message);
  }

  return data as LoginResponse;
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
  name: string;
  code: string;
  category_type: string;
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

export type PharmaProductMutationResponse = {
  message: string;
  product: PharmaProduct;
};

export type ReceivePharmaStockPayload = {
  product_id: number;
  stock_location_id: number;
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

export type ReceivePharmaStockResponse = {
  message: string;
  batch: PharmaStockBatch;
  movement: PharmaStockMovement;
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

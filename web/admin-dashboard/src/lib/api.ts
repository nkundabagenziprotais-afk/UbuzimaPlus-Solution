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

export async function logout(token: string): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

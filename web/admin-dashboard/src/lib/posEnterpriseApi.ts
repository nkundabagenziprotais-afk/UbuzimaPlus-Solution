const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api/v1';

export type EnterpriseStoredSession = {
  token: string;
  profile: {
    user: { id: number; name: string; email: string };
    permissions: string[];
    tenant_assignments?: Array<{
      tenant?: { id: number; name: string; slug: string };
      branch?: { id: number; name: string; code: string } | null;
    }>;
  };
};

export type PosSessionRecord = {
  id: number;
  uuid: string;
  business_date: string;
  status: 'open' | 'closed';
  opening_mode: string;
  close_mode: string | null;
  starting_cash: number;
  expected_cash: number | null;
  counted_cash: number | null;
  closing_cash_balance: number | null;
  cash_variance: number | null;
  till_zeroized: boolean;
  opened_at: string;
  closed_at: string | null;
  deposit_reference: string | null;
  branch: { id: number; name: string; code: string } | null;
  user: { id: number; name: string } | null;
};

export type PosTransaction = {
  id: number;
  sale_number: string;
  receipt_number: string | null;
  date_time: string | null;
  customer: string;
  prescription_number: string | null;
  payment_method: string;
  payment_status: string;
  status: string;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  item_count: number;
  items: Array<{ name: string; quantity: number; unit_price: number; line_total: number }>;
};

export function readEnterpriseStoredSession(): EnterpriseStoredSession | null {
  try {
    const raw = localStorage.getItem('ubuzima_admin_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EnterpriseStoredSession;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function tenantSlugFor(session: EnterpriseStoredSession): string {
  return session.profile.tenant_assignments?.[0]?.tenant?.slug || 'vitapharma';
}

async function requestJson<T>(
  session: EnterpriseStoredSession,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${session.token}`);
  headers.set('X-Tenant-Slug', tenantSlugFor(session));
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errors = data?.errors
      ? Object.values(data.errors as Record<string, unknown>)
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .filter(Boolean)
          .join(' ')
      : '';
    throw new Error(errors || data?.message || `Request failed (${response.status}).`);
  }

  return data as T;
}

export async function getCurrentPosSession(session: EnterpriseStoredSession): Promise<{
  business_date: string;
  can_open: boolean;
  session: PosSessionRecord | null;
}> {
  return requestJson(session, '/pharmaco/pos-sessions/current');
}

export async function openPosSession(
  session: EnterpriseStoredSession,
  payload: { branch_id: number; opening_mode: string; starting_cash: number; opening_note?: string },
): Promise<{ message: string; session: PosSessionRecord }> {
  return requestJson(session, '/pharmaco/pos-sessions/open', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function closePosSession(
  session: EnterpriseStoredSession,
  payload: {
    close_mode: string;
    till_zeroized: boolean;
    closing_cash_balance: number;
    counted_cash: number;
    deposit_reference?: string | null;
    closing_note?: string | null;
  },
): Promise<{ message: string; session: PosSessionRecord }> {
  return requestJson(session, '/pharmaco/pos-sessions/close', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getPosSessionTransactions(
  session: EnterpriseStoredSession,
): Promise<{ session: PosSessionRecord | null; transactions: PosTransaction[] }> {
  return requestJson(session, '/pharmaco/pos-sessions/transactions');
}

export async function getActiveBranches(session: EnterpriseStoredSession): Promise<Array<{ id: number; name: string; code: string }>> {
  const response = await requestJson<{ branches: Array<{ id: number; name: string; code: string; status: string }> }>(
    session,
    '/pharmaco/branches',
  );
  return response.branches.filter((branch) => branch.status === 'active');
}

export type SellableBatch = {
  id: number;
  batch_number: string;
  expiry_date: string | null;
  available_quantity: number;
  selling_price: number;
  product: { id: number; name: string; sku: string; requires_prescription?: boolean };
};

export async function getSellableBatches(session: EnterpriseStoredSession): Promise<SellableBatch[]> {
  const response = await requestJson<{ batches: SellableBatch[] }>(
    session,
    '/pharmaco/inventory/batches?per_page=1000&sellable_only=1',
  );
  return response.batches || [];
}

export async function postConfirmedPosSale(
  session: EnterpriseStoredSession,
  payload: {
    branchId: number;
    paymentMethod: 'cash' | 'momo' | 'card' | 'insurance' | 'credit';
    discountAmount: number;
    taxAmount: number;
    items: Array<{
      productId: number;
      stockBatchId: number;
      quantity: number;
      unitPrice: number;
      requiresPrescription: boolean;
      prescriptionVerified: boolean;
    }>;
  },
): Promise<{ sale: Record<string, unknown>; payment: Record<string, unknown> | null }> {
  const saleType = payload.paymentMethod === 'insurance'
    ? 'insurance_sale'
    : payload.paymentMethod === 'credit'
      ? 'credit_sale'
      : 'cash_sale';

  const created = await requestJson<{ sale: { id: number; total_amount: number; items: Array<{ id: number; product_id: number }> } }>(
    session,
    '/pharmaco/sales',
    {
      method: 'POST',
      body: JSON.stringify({
        branch_id: payload.branchId,
        sale_type: saleType,
        discount_amount: payload.discountAmount,
        tax_amount: payload.taxAmount,
        notes: 'Created from the enterprise POS counter.',
        items: payload.items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_amount: 0,
          tax_amount: 0,
        })),
      }),
    },
  );

  const confirmItems = created.sale.items.map((saleItem) => {
    const configured = payload.items.find((item) => item.productId === saleItem.product_id);
    if (!configured) throw new Error('Unable to match a sale item to its selected stock batch.');
    return {
      sale_item_id: saleItem.id,
      stock_batch_id: configured.stockBatchId,
      prescription_verified: configured.prescriptionVerified,
    };
  });

  const confirmed = await requestJson<{ sale: Record<string, unknown> }>(
    session,
    `/pharmaco/sales/${created.sale.id}/confirm`,
    { method: 'POST', body: JSON.stringify({ items: confirmItems }) },
  );

  if (payload.paymentMethod === 'credit') {
    return { sale: confirmed.sale, payment: null };
  }

  const payment = await requestJson<{ payment: Record<string, unknown>; sale: Record<string, unknown> }>(
    session,
    `/pharmaco/sales/${created.sale.id}/payments`,
    {
      method: 'POST',
      body: JSON.stringify({
        amount: Number(created.sale.total_amount),
        payment_method: payload.paymentMethod,
        reference_number: `POS-${Date.now()}`,
        notes: 'Payment captured at the enterprise POS counter.',
      }),
    },
  );

  return { sale: payment.sale, payment: payment.payment };
}

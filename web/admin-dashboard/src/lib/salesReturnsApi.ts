const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  '/api/v1';

export type SaleReturnStatus =
  | 'pending'
  | 'refunded'
  | 'rejected';

export type SaleReturnDisposition =
  | 'restock'
  | 'quarantine'
  | 'destroy'
  | 'no_restock';

export type SaleRefundMethod =
  | 'original_method'
  | 'cash'
  | 'momo'
  | 'card'
  | 'bank_transfer'
  | 'credit_note';

export interface SaleReturnItem {
  id: number;
  sale_item_id: number;
  product_id: number;
  stock_batch_id: number | null;
  quantity: number;
  unit_price: number;
  line_refund_amount: number;
  disposition: SaleReturnDisposition;
  reason: string | null;
  stock_restored: boolean;
  product_name: string | null;
  sku: string | null;
  batch_number: string | null;
  metadata: Record<string, unknown>;
}

export interface SaleReturn {
  id: number;
  uuid: string;
  return_number: string;
  status: SaleReturnStatus;
  reason: string;
  requested_refund_amount: number;
  approved_refund_amount: number | null;
  refund_method: SaleRefundMethod | null;
  refund_reference: string | null;
  credit_note_number: string | null;
  requested_at: string | null;
  approved_at: string | null;
  refunded_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  branch: {
    id: number;
    name: string;
  } | null;
  sale: {
    id: number;
    sale_number: string;
    status: string;
    payment_status: string;
    total_amount: number;
    paid_amount: number;
  } | null;
  items?: SaleReturnItem[];
}

export interface PaymentReconciliation {
  id: number;
  uuid: string;
  payment_id: number;
  reconciliation_status:
    | 'pending'
    | 'matched'
    | 'exception'
    | 'reversed';
  expected_amount: number;
  settled_amount: number;
  variance_amount: number;
  provider_reference: string | null;
  reconciled_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}

export interface SalesReturnsRequestContext {
  token: string;
  tenantSlug: string;
}

export interface CreateSaleReturnPayload {
  reason: string;
  refund_method?: SaleRefundMethod;
  notes?: string | null;
  items: Array<{
    sale_item_id: number;
    quantity: number;
    disposition: SaleReturnDisposition;
    reason?: string | null;
  }>;
}

export interface ApproveSaleReturnPayload {
  refund_method?: SaleRefundMethod;
  refund_reference?: string | null;
  notes?: string | null;
}

export interface RejectSaleReturnPayload {
  reason: string;
}

export interface ReconcilePaymentPayload {
  reconciliation_status:
    | 'pending'
    | 'matched'
    | 'exception'
    | 'reversed';
  settled_amount: number;
  provider_reference?: string | null;
  notes?: string | null;
}

async function requestJson<T>(
  context: SalesReturnsRequestContext,
  path: string,
  init: RequestInit,
): Promise<T> {
  const headers = new Headers(init.headers);

  headers.set('Accept', 'application/json');
  headers.set(
    'Authorization',
    `Bearer ${context.token}`,
  );
  headers.set(
    'X-Tenant-Slug',
    context.tenantSlug,
  );

  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...init,
      headers,
    },
  );

  const data: unknown = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const record =
      data && typeof data === 'object'
        ? data as Record<string, unknown>
        : {};

    const errors =
      record.errors &&
      typeof record.errors === 'object'
        ? Object.values(
            record.errors as Record<
              string,
              unknown
            >,
          )
            .flat()
            .filter(
              (value): value is string =>
                typeof value === 'string',
            )
            .join(' ')
        : '';

    const message =
      typeof record.message === 'string'
        ? record.message
        : '';

    throw new Error(
      errors ||
      message ||
      'Unable to complete the sales return request.',
    );
  }

  return data as T;
}

export function getSaleReturns(
  context: SalesReturnsRequestContext,
  filters: {
    status?: SaleReturnStatus;
    saleId?: number;
  } = {},
): Promise<{
  returns: SaleReturn[];
}> {
  const query = new URLSearchParams();

  if (filters.status) {
    query.set('status', filters.status);
  }

  if (filters.saleId) {
    query.set('sale_id', String(filters.saleId));
  }

  const suffix = query.toString()
    ? `?${query.toString()}`
    : '';

  return requestJson(
    context,
    `/pharmaco/sales/returns${suffix}`,
    { method: 'GET' },
  );
}

export function getSaleReturn(
  context: SalesReturnsRequestContext,
  saleReturnId: number,
): Promise<{
  return: SaleReturn;
}> {
  return requestJson(
    context,
    `/pharmaco/sales/returns/${saleReturnId}`,
    { method: 'GET' },
  );
}

export function createSaleReturn(
  context: SalesReturnsRequestContext,
  saleId: number,
  payload: CreateSaleReturnPayload,
): Promise<{
  message: string;
  return: SaleReturn;
}> {
  return requestJson(
    context,
    `/pharmaco/sales/${saleId}/returns`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function approveSaleReturn(
  context: SalesReturnsRequestContext,
  saleReturnId: number,
  payload: ApproveSaleReturnPayload,
): Promise<{
  message: string;
  return: SaleReturn;
}> {
  return requestJson(
    context,
    `/pharmaco/sales/returns/${saleReturnId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function rejectSaleReturn(
  context: SalesReturnsRequestContext,
  saleReturnId: number,
  payload: RejectSaleReturnPayload,
): Promise<{
  message: string;
  return: SaleReturn;
}> {
  return requestJson(
    context,
    `/pharmaco/sales/returns/${saleReturnId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function reconcilePharmaPayment(
  context: SalesReturnsRequestContext,
  paymentId: number,
  payload: ReconcilePaymentPayload,
): Promise<{
  message: string;
  reconciliation: PaymentReconciliation;
}> {
  return requestJson(
    context,
    `/pharmaco/sales/payments/${paymentId}/reconcile`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

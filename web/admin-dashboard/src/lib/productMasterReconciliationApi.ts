import {
  buildApiUrl,
  normalizeApiBaseUrl,
} from './apiBase';

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
);

export type ReconciliationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'hold';

export type ReconciliationSummary = {
  batches: number;
  rows: number;
  pending: number;
  approved: number;
  rejected: number;
  on_hold: number;
  missing_candidates: number;
  correction_candidates: number;
  duplicate_candidates: number;
  payer_prices: number;
};

export type ReconciliationSource = {
  id: number;
  source_key: string;
  source_name: string;
  source_version: string;
  status: string;
  imported_rows: number;
  matched_rows: number;
  review_rows: number;
  approved_rows: number;
  rejected_rows: number;
  completed_at: string | null;
};

export type ReconciliationProduct = {
  id: number;
  sku: string;
  name: string;
  generic_name: string | null;
  unit: string | null;
  status: string;
};

export type ReconciliationBatch = {
  id: number;
  source_key: string;
  source_name: string;
  source_version: string;
  status: string;
};

export type ReconciliationRow = {
  id: number;
  batch_id: number;
  source_row: number | null;
  source_code: string | null;
  product_name: string;
  generic_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  pack: string | null;
  selling_unit: string | null;
  source_price: string | number | null;
  currency: string | null;
  matched_product_id: number | null;
  match_method: string | null;
  match_score: string | number | null;
  proposed_action: string;
  review_status: ReconciliationStatus;
  review_notes: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  dependency_snapshot:
    | Record<string, unknown>
    | null;
  batch: ReconciliationBatch | null;
  matched_product: ReconciliationProduct | null;
};

export type DuplicateProposal = {
  id: number;
  record_a_product_id: number;
  record_b_product_id: number;
  match_basis: string | null;
  match_score: string | number | null;
  status: ReconciliationStatus;
  review_notes: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  dependency_snapshot:
    | Record<string, unknown>
    | null;
  record_a: ReconciliationProduct | null;
  record_b: ReconciliationProduct | null;
};

export type PayerPrice = {
  id: number;
  product_id: number;
  payer_code: string;
  payer_name: string;
  amount: string | number;
  currency: string;
  source_key: string;
  source_reference: string | null;
  effective_from: string | null;
  effective_to: string | null;
  status: string;
  product: ReconciliationProduct | null;
};

export type Paginated<T> = {
  current_page: number;
  data: T[];
  first_page_url?: string;
  from: number | null;
  last_page: number;
  last_page_url?: string;
  next_page_url?: string | null;
  path?: string;
  per_page: number;
  prev_page_url?: string | null;
  to: number | null;
  total: number;
};

type LaravelErrorPayload = {
  message?: string;
  errors?: Record<string, string[]>;
};

type RequestContext = {
  token: string;
  tenantSlug: string;
};

function requireContext(
  context: RequestContext,
): void {
  if (!context.token.trim()) {
    throw new Error(
      'Authentication token is required.',
    );
  }

  if (!context.tenantSlug.trim()) {
    throw new Error(
      'Tenant context is required.',
    );
  }
}

function queryString(
  values: Record<
    string,
    string | number | null | undefined
  >,
): string {
  const query = new URLSearchParams();

  Object.entries(values).forEach(
    ([key, value]) => {
      if (
        value !== undefined
        && value !== null
        && value !== ''
      ) {
        query.set(key, String(value));
      }
    },
  );

  const serialized = query.toString();

  return serialized
    ? `?${serialized}`
    : '';
}

async function requestJson<T>(
  context: RequestContext,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  requireContext(context);

  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');
  headers.set(
    'Authorization',
    `Bearer ${context.token.trim()}`,
  );
  headers.set(
    'X-Tenant-Slug',
    context.tenantSlug.trim(),
  );

  if (options.body !== undefined) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  const response = await fetch(
    buildApiUrl(API_BASE_URL, path),
    {
      ...options,
      headers,
      cache: 'no-store',
    },
  );

  const payload = await response
    .json()
    .catch(() => null) as
      | T
      | LaravelErrorPayload
      | null;

  if (!response.ok) {
    const errorPayload =
      payload as LaravelErrorPayload | null;

    const validationMessage =
      errorPayload?.errors
        ? Object.values(errorPayload.errors)
            .flat()
            .find(Boolean)
        : undefined;

    throw new Error(
      validationMessage
      || errorPayload?.message
      || `The Product Master request failed with status ${response.status}.`,
    );
  }

  if (payload === null) {
    throw new Error(
      'The Product Master server returned an empty response.',
    );
  }

  return payload as T;
}

export function getReconciliationSummary(
  context: RequestContext,
): Promise<{
  data: {
    summary: ReconciliationSummary;
    sources: ReconciliationSource[];
  };
}> {
  return requestJson(
    context,
    '/pharmaco/product-master/reconciliation/summary',
  );
}

export function getReconciliationRows(
  context: RequestContext,
  filters: {
    search?: string;
    source?: string;
    status?: ReconciliationStatus | '';
    action?: string;
    page?: number;
    perPage?: number;
  } = {},
): Promise<Paginated<ReconciliationRow>> {
  const query = queryString({
    search: filters.search,
    source: filters.source,
    status: filters.status,
    action: filters.action,
    page: filters.page,
    per_page: filters.perPage ?? 25,
  });

  return requestJson(
    context,
    `/pharmaco/product-master/reconciliation/rows${query}`,
  );
}

export function reviewReconciliationRow(
  context: RequestContext,
  rowId: number,
  payload: {
    status: ReconciliationStatus;
    notes?: string | null;
  },
): Promise<{
  message: string;
  data: ReconciliationRow;
}> {
  return requestJson(
    context,
    `/pharmaco/product-master/reconciliation/rows/${rowId}/review`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
}

export function getDuplicateProposals(
  context: RequestContext,
  filters: {
    status?: ReconciliationStatus | '';
    page?: number;
    perPage?: number;
  } = {},
): Promise<Paginated<DuplicateProposal>> {
  const query = queryString({
    status: filters.status,
    page: filters.page,
    per_page: filters.perPage ?? 25,
  });

  return requestJson(
    context,
    `/pharmaco/product-master/reconciliation/duplicates${query}`,
  );
}

export function reviewDuplicateProposal(
  context: RequestContext,
  proposalId: number,
  payload: {
    status: ReconciliationStatus;
    notes?: string | null;
  },
): Promise<{
  message: string;
  data: DuplicateProposal;
}> {
  return requestJson(
    context,
    `/pharmaco/product-master/reconciliation/duplicates/${proposalId}/review`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
}

export function getPayerPrices(
  context: RequestContext,
  filters: {
    search?: string;
    payer?: string;
    status?: string;
    page?: number;
    perPage?: number;
  } = {},
): Promise<Paginated<PayerPrice>> {
  const query = queryString({
    search: filters.search,
    payer: filters.payer,
    status: filters.status,
    page: filters.page,
    per_page: filters.perPage ?? 25,
  });

  return requestJson(
    context,
    `/pharmaco/product-master/reconciliation/payer-prices${query}`,
  );
}

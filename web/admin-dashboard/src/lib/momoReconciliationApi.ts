const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(
    /\/$/,
    '',
  ) || '/api/v1';

export type MomoParserTemplate = {
  id: number;
  uuid: string;
  name: string;
  sender_id: string;
  version: number;
  status: string;
  message_regex: string;
  timezone: string;
  sample_message: string | null;
  created_at: string | null;
};

export type MomoMessage = {
  id: number;
  uuid: string;
  sender_id: string;
  received_at: string | null;
  transaction_at: string | null;
  customer_name: string | null;
  phone_masked: string | null;
  amount: number | null;
  currency: string | null;
  provider_transaction_id: string | null;
  balance: number | null;
  et_id: string | null;
  parse_status: string;
  parse_confidence: number;
  ingestion_channel: string | null;
  reconciliation_status: string | null;
  reconciliation_decision: string | null;
};

export type MomoPosPayment = {
  id: number;
  receipt_number: string | null;
  payment_method: string;
  amount: number;
  reference_number: string | null;
  status: string;
  received_at: string | null;
};

export type MomoSaleSummary = {
  id: number;
  sale_number: string;
  sold_at: string | null;
  customer_name: string;
  customer_phone: string | null;
};

export type MomoReconciliation = {
  id: number;
  uuid: string;
  status: string;
  decision: string;
  confidence_score: number;
  amount_variance: number | null;
  matching_reasons: string[];
  reviewed_at: string | null;
  review_notes: string | null;
  momo_message: MomoMessage | null;
  pos_payment: MomoPosPayment | null;
  sale: MomoSaleSummary | null;
};

type RequestContext = {
  token: string;
  tenantSlug: string;
};

async function requestJson<T>(
  context: RequestContext,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization:
          `Bearer ${context.token}`,
        'Content-Type': 'application/json',
        'X-Tenant-Slug':
          context.tenantSlug,
        ...(options.headers ?? {}),
      },
    },
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const validation = data?.errors
      ? Object.values(data.errors)
          .flat()
          .filter(Boolean)
          .join(' ')
      : '';

    throw new Error(
      validation ||
        data?.message ||
        'The Mobile Money request failed.',
    );
  }

  return data as T;
}

export async function getMomoTemplates(
  context: RequestContext,
): Promise<{
  templates: MomoParserTemplate[];
}> {
  return requestJson(
    context,
    '/pharmaco/momo/parser-templates',
  );
}

export async function saveMomoTemplate(
  context: RequestContext,
  payload: {
    name: string;
    sender_id: string;
    message_regex: string;
    timezone: string;
    sample_message: string;
  },
): Promise<{
  message: string;
  template: MomoParserTemplate;
}> {
  return requestJson(
    context,
    '/pharmaco/momo/parser-templates',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function getMomoMessages(
  context: RequestContext,
): Promise<{
  messages: MomoMessage[];
}> {
  return requestJson(
    context,
    '/pharmaco/momo/messages',
  );
}

export async function ingestMomoMessage(
  context: RequestContext,
  payload: {
    sender_id: string;
    message_body: string;
    received_at?: string;
    device_uuid?: string;
  },
): Promise<{
  message: string;
  momo_message: MomoMessage;
}> {
  return requestJson(
    context,
    '/pharmaco/momo/messages/ingest',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function getMomoReconciliations(
  context: RequestContext,
): Promise<{
  reconciliations: MomoReconciliation[];
}> {
  return requestJson(
    context,
    '/pharmaco/momo/reconciliations',
  );
}

export async function approveMomoReconciliation(
  context: RequestContext,
  reconciliationId: number,
  payload: {
    decision:
      | 'matched_manually'
      | 'accepted_pos_only'
      | 'accepted_momo_only'
      | 'ignored';
    notes?: string;
  },
): Promise<{
  message: string;
  reconciliation: MomoReconciliation;
}> {
  return requestJson(
    context,
    `/pharmaco/momo/reconciliations/${reconciliationId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function rejectMomoReconciliation(
  context: RequestContext,
  reconciliationId: number,
  notes: string,
): Promise<{
  message: string;
}> {
  return requestJson(
    context,
    `/pharmaco/momo/reconciliations/${reconciliationId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ notes }),
    },
  );
}

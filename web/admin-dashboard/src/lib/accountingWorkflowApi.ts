export type AccountingJson = Record<string, unknown>;

export type AccountingApiContext = {
  token: string;
  tenantSlug: string;
};

export type AccountingAccount = AccountingJson & {
  id?: number;
  account_id?: number;
  code?: string;
  name?: string;
  account_type?: string;
  normal_balance?: string;
  is_active?: boolean | number | string;
};

export type JournalDraftLine = AccountingJson & {
  id?: number;
  line_number?: number;
  finance_chart_of_account_id?: number;
  description?: string | null;
  debit_amount?: number | string;
  credit_amount?: number | string;
  account?: AccountingAccount;
};

export type JournalDraft = AccountingJson & {
  id?: number;
  uuid: string;
  business_date?: string;
  reference?: string;
  description?: string;
  currency_code?: string;
  status?: string;
  version?: number;
  created_by?: number;
  submitted_by?: number;
  approved_by?: number;
  posted_by?: number;
  posted_journal_entry_id?: number | null;
  reversal_journal_entry_id?: number | null;
  created_at?: string;
  submitted_at?: string;
  approved_at?: string;
  posted_at?: string;
  lines?: JournalDraftLine[];
};

export type ApprovalAction = AccountingJson & {
  id?: number;
  uuid?: string;
  actor_id?: number | null;
  action?: string;
  previous_status?: string | null;
  new_status?: string;
  comment?: string | null;
  acted_at?: string;
};

export type ApprovalRequest = AccountingJson & {
  id?: number;
  uuid: string;
  workflow_type?: string;
  subject_uuid?: string | null;
  status?: string;
  requested_by?: number;
  requested_at?: string;
  decided_by?: number | null;
  decided_at?: string | null;
  decision_comment?: string | null;
  version?: number;
  subject?: JournalDraft;
  actions?: ApprovalAction[];
};

export type JournalDraftPayload = {
  business_date: string;
  reference: string;
  description: string;
  currency_code: 'RWF';
  lines: Array<{
    finance_chart_of_account_id: number;
    description?: string | null;
    debit_amount: number;
    credit_amount: number;
  }>;
};

export class AccountingApiError extends Error {
  readonly status: number;
  readonly validation: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    validation: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'AccountingApiError';
    this.status = status;
    this.validation = validation;
  }
}

function asObject(value: unknown): AccountingJson {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as AccountingJson
    : {};
}

function validationErrors(value: unknown): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  Object.entries(asObject(value)).forEach(([key, messages]) => {
    result[key] = Array.isArray(messages)
      ? messages.map((message) => String(message))
      : [String(messages)];
  });

  return result;
}

function firstValidationMessage(
  validation: Record<string, string[]>,
): string {
  for (const messages of Object.values(validation)) {
    if (messages[0]) return messages[0];
  }

  return '';
}

async function requestJson<T>(
  context: AccountingApiContext,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${context.token}`);
  headers.set('X-Tenant-Slug', context.tenantSlug);

  if (init.body !== undefined && init.body !== null) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(
    `/api/v1/pharmaco/accounting${path}`,
    { ...init, headers },
  );

  const body = await response.json().catch(() => ({})) as AccountingJson;

  if (!response.ok) {
    const validation = validationErrors(body.errors);

    throw new AccountingApiError(
      String(
        body.message
        ?? firstValidationMessage(validation)
        ?? 'The Accounting request could not be completed.',
      ),
      response.status,
      validation,
    );
  }

  return body as T;
}

function listFrom<T>(body: AccountingJson, keys: string[]): T[] {
  for (const key of keys) {
    if (Array.isArray(body[key])) return body[key] as T[];
  }

  if (Array.isArray(body.data)) return body.data as T[];

  const data = asObject(body.data);

  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key] as T[];
  }

  return [];
}

function recordFrom<T>(body: AccountingJson, key: string): T {
  if (body[key] && typeof body[key] === 'object') {
    return body[key] as T;
  }

  const data = asObject(body.data);

  if (data[key] && typeof data[key] === 'object') {
    return data[key] as T;
  }

  return data as T;
}

function statusQuery(status?: string): string {
  return status ? `?status=${encodeURIComponent(status)}` : '';
}

export async function listChartAccounts(
  context: AccountingApiContext,
): Promise<AccountingAccount[]> {
  const body = await requestJson<AccountingJson>(
    context,
    '/chart-of-accounts',
  );

  return listFrom<AccountingAccount>(
    body,
    ['accounts', 'chart_of_accounts', 'rows'],
  );
}

export async function listJournalDrafts(
  context: AccountingApiContext,
  status?: string,
): Promise<JournalDraft[]> {
  const body = await requestJson<AccountingJson>(
    context,
    `/journal-drafts${statusQuery(status)}`,
  );

  return listFrom<JournalDraft>(
    body,
    ['drafts', 'journal_drafts', 'rows'],
  );
}

export async function getJournalDraft(
  context: AccountingApiContext,
  draftUuid: string,
): Promise<JournalDraft> {
  const body = await requestJson<AccountingJson>(
    context,
    `/journal-drafts/${encodeURIComponent(draftUuid)}`,
  );

  return recordFrom<JournalDraft>(body, 'draft');
}

export async function createJournalDraft(
  context: AccountingApiContext,
  payload: JournalDraftPayload,
): Promise<JournalDraft> {
  const body = await requestJson<AccountingJson>(
    context,
    '/journal-drafts',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  return recordFrom<JournalDraft>(body, 'draft');
}

export async function updateJournalDraft(
  context: AccountingApiContext,
  draftUuid: string,
  payload: JournalDraftPayload,
): Promise<JournalDraft> {
  const body = await requestJson<AccountingJson>(
    context,
    `/journal-drafts/${encodeURIComponent(draftUuid)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );

  return recordFrom<JournalDraft>(body, 'draft');
}

export async function submitJournalDraft(
  context: AccountingApiContext,
  draftUuid: string,
): Promise<JournalDraft> {
  const body = await requestJson<AccountingJson>(
    context,
    `/journal-drafts/${encodeURIComponent(draftUuid)}/submit`,
    { method: 'POST', body: '{}' },
  );

  return recordFrom<JournalDraft>(body, 'draft');
}

export async function postJournalDraft(
  context: AccountingApiContext,
  draftUuid: string,
): Promise<AccountingJson> {
  return requestJson<AccountingJson>(
    context,
    `/journal-drafts/${encodeURIComponent(draftUuid)}/post`,
    { method: 'POST', body: '{}' },
  );
}

export async function reverseJournalDraft(
  context: AccountingApiContext,
  draftUuid: string,
  businessDate: string,
  reason: string,
): Promise<AccountingJson> {
  return requestJson<AccountingJson>(
    context,
    `/journal-drafts/${encodeURIComponent(draftUuid)}/reverse`,
    {
      method: 'POST',
      body: JSON.stringify({
        business_date: businessDate,
        reason,
      }),
    },
  );
}

export async function listApprovals(
  context: AccountingApiContext,
  status?: string,
): Promise<ApprovalRequest[]> {
  const body = await requestJson<AccountingJson>(
    context,
    `/approvals${statusQuery(status)}`,
  );

  return listFrom<ApprovalRequest>(
    body,
    ['approvals', 'approval_requests', 'rows'],
  );
}

export async function getApproval(
  context: AccountingApiContext,
  approvalUuid: string,
): Promise<ApprovalRequest> {
  const body = await requestJson<AccountingJson>(
    context,
    `/approvals/${encodeURIComponent(approvalUuid)}`,
  );

  return recordFrom<ApprovalRequest>(body, 'approval');
}

export async function approveApproval(
  context: AccountingApiContext,
  approvalUuid: string,
  comment: string,
): Promise<ApprovalRequest> {
  const body = await requestJson<AccountingJson>(
    context,
    `/approvals/${encodeURIComponent(approvalUuid)}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({
        comment: comment.trim() || null,
      }),
    },
  );

  return recordFrom<ApprovalRequest>(body, 'approval');
}

export async function rejectApproval(
  context: AccountingApiContext,
  approvalUuid: string,
  comment: string,
): Promise<ApprovalRequest> {
  const body = await requestJson<AccountingJson>(
    context,
    `/approvals/${encodeURIComponent(approvalUuid)}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({
        comment: comment.trim(),
      }),
    },
  );

  return recordFrom<ApprovalRequest>(body, 'approval');
}

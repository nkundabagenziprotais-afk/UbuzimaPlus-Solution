import {
  buildApiUrl,
  normalizeApiBaseUrl,
} from './apiBase';

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
);

export type PosSessionStatus =
  | "open"
  | "zeroized"
  | "closed";

export type PosSessionEventType =
  | "clock_in"
  | "clock_out"
  | "cash_drop"
  | "balance_clear"
  | "admin_reset"
  | string;

export interface PosSessionBranch {
  id: number;
  name: string;
  code?: string | null;
}

export interface PosSessionEvent {
  type: PosSessionEventType;
  amount: number | null;
  notes: string | null;
  created_at: string | null;
}

export interface PosSession {
  id: number;
  uuid: string;
  session_number: string;
  sequence_number: number;
  business_date: string | null;
  session_mode?: "live" | "historical" | string;
  historical_reason?: string | null;
  historical_reference?: string | null;
  historical_approval_id?: number | null;
  status: PosSessionStatus;
  branch: PosSessionBranch | null;
  opening_float_amount: number;
  expected_cash_amount: number;
  declared_cash_amount: number | null;
  cash_drop_amount: number;
  balance_clearance_amount: number;
  variance_amount: number | null;
  balance_cleared: boolean;
  can_close: boolean;
  reset_authorized: boolean;
  can_open_additional_session: boolean;
  reset_reason: string | null;
  reset_authorized_at: string | null;
  reset_authorized_by: number | null;
  opened_at: string | null;
  zeroized_at: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown>;
  events: PosSessionEvent[];
}

export interface PosSessionRequestContext {
  token: string;
  tenantSlug: string;
}

export interface CurrentPosSessionResponse {
  business_date: string;
  session: PosSession | null;
}

export interface PosSessionMutationResponse {
  message: string;
  session: PosSession;
}

export interface OpenPosSessionPayload {
  branch_id: number;
  opening_float_amount: number;
  opening_mode?: "fresh-start" | "handover";
  notes?: string;
}

export interface PosCashDropPayload {
  amount: number;
  notes?: string;
}

export interface ZeroizePosSessionPayload {
  declared_cash_amount: number;
  notes?: string;
}

export interface ClosePosSessionPayload {
  declared_cash_amount: number;
  closing_mode?: "handover" | "final-close";
  deposit_proof?: string;
  notes?: string;
}

export interface AdminResetPosSessionPayload {
  reason: string;
}

interface LaravelErrorPayload {
  message?: string;
  errors?: Record<string, string[]>;
}

export class PosSessionApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "PosSessionApiError";
    this.status = status;
    this.errors = errors;
  }
}

function requireContext(
  context: PosSessionRequestContext,
): void {
  if (!context.token.trim()) {
    throw new PosSessionApiError(
      "Authentication token is required.",
      401,
    );
  }

  if (!context.tenantSlug.trim()) {
    throw new PosSessionApiError(
      "Tenant context is required.",
      400,
    );
  }
}

function sessionPath(
  sessionId: number | string,
  action: string,
): string {
  return `/pharmaco/pos/sessions/${encodeURIComponent(
    String(sessionId),
  )}/${action}`;
}

async function requestPosSession<T>(
  context: PosSessionRequestContext,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  requireContext(context);

  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");
  headers.set(
    "Authorization",
    `Bearer ${context.token.trim()}`,
  );
  headers.set(
    "X-Tenant-Slug",
    context.tenantSlug.trim(),
  );

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(
    buildApiUrl(API_BASE_URL, path),
    {
      ...options,
      headers,
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

    const firstValidationMessage =
      errorPayload?.errors
        ? Object.values(errorPayload.errors)
            .flat()
            .find(Boolean)
        : undefined;

    throw new PosSessionApiError(
      firstValidationMessage
        || errorPayload?.message
        || `POS Session request failed with status ${response.status}.`,
      response.status,
      errorPayload?.errors || {},
    );
  }

  if (payload === null) {
    throw new PosSessionApiError(
      "The POS Session server returned an empty response.",
      response.status,
    );
  }

  return payload as T;
}

export function getCurrentPosSession(
  context: PosSessionRequestContext,
): Promise<CurrentPosSessionResponse> {
  return requestPosSession<CurrentPosSessionResponse>(
    context,
    "/pharmaco/pos/session/current",
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

export function openPosSession(
  context: PosSessionRequestContext,
  payload: OpenPosSessionPayload,
): Promise<PosSessionMutationResponse> {
  return requestPosSession<PosSessionMutationResponse>(
    context,
    "/pharmaco/pos/session/open",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function recordPosCashDrop(
  context: PosSessionRequestContext,
  sessionId: number | string,
  payload: PosCashDropPayload,
): Promise<PosSessionMutationResponse> {
  return requestPosSession<PosSessionMutationResponse>(
    context,
    sessionPath(sessionId, "cash-drop"),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function zeroizePosSession(
  context: PosSessionRequestContext,
  sessionId: number | string,
  payload: ZeroizePosSessionPayload,
): Promise<PosSessionMutationResponse> {
  return requestPosSession<PosSessionMutationResponse>(
    context,
    sessionPath(sessionId, "zeroize"),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function closePosSession(
  context: PosSessionRequestContext,
  sessionId: number | string,
  payload: ClosePosSessionPayload,
): Promise<PosSessionMutationResponse> {
  return requestPosSession<PosSessionMutationResponse>(
    context,
    sessionPath(sessionId, "close"),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function authorizePosSessionReset(
  context: PosSessionRequestContext,
  sessionId: number | string,
  payload: AdminResetPosSessionPayload,
): Promise<PosSessionMutationResponse> {
  return requestPosSession<PosSessionMutationResponse>(
    context,
    sessionPath(sessionId, "admin-reset"),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export interface HistoricalPosAvailabilityResponse {
  branch: PosSessionBranch;
  business_date: string;
  live_activity_exists: boolean;
  live_activity_count: number;
  live_activity_total: number;
  approval_required: boolean;
  approval_rule:
    | "admin_or_owner_code_required"
    | "historical_permission_only"
    | string;
}

export interface HistoricalPosApprovalUser {
  id: number;
  name: string;
  email: string;
}

export interface HistoricalPosApproval {
  id: number;
  uuid: string;
  branch_id: number;
  business_date: string;
  requested_by: number;
  approved_by: number | null;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "used"
    | "expired"
    | string;
  requires_code: boolean;
  failed_attempts: number;
  live_activity_count: number;
  live_activity_total: number;
  request_reason: string;
  historical_reference: string | null;
  decision_notes: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  expires_at: string | null;
  used_at: string | null;
  created_at: string | null;
  branch: PosSessionBranch | null;
  requester: HistoricalPosApprovalUser | null;
  approver: HistoricalPosApprovalUser | null;
}

export interface HistoricalApprovalResponse {
  message: string;
  approval: HistoricalPosApproval;
}

export interface HistoricalApprovalDecisionResponse
  extends HistoricalApprovalResponse {
  approval_code?: string;
}

export interface HistoricalApprovalsResponse {
  approvals: HistoricalPosApproval[];
}

export interface HistoricalPosSessionEvent {
  id: number;
  event_type: PosSessionEventType;
  amount: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
}

export interface HistoricalPosSessionRecord {
  id: number;
  uuid: string;
  session_number: string;
  sequence_number: number;
  session_mode: "historical";
  status: PosSessionStatus;
  business_date: string;
  historical_reason: string | null;
  historical_reference: string | null;
  historical_approval_id: number | null;
  opening_float_amount: number;
  expected_cash_amount: number;
  declared_cash_amount: number | null;
  cash_drop_amount: number;
  balance_clearance_amount: number;
  variance_amount: number | null;
  opened_at: string | null;
  zeroized_at: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown>;
  branch: PosSessionBranch | null;
  events: HistoricalPosSessionEvent[];
}

export interface HistoricalCurrentSessionResponse {
  business_date: string;
  session_mode: "historical";
  session: HistoricalPosSessionRecord | null;
}

export interface HistoricalOpenSessionPayload {
  branch_id: number;
  business_date: string;
  opening_float_amount: number;
  opening_mode?: "fresh-start" | "handover";
  historical_reason: string;
  historical_reference?: string;
  approval_id?: number;
  approval_code?: string;
  notes?: string;
}

export interface HistoricalOpenSessionResponse {
  message: string;
  historical_entry_warning: string;
  session: HistoricalPosSessionRecord;
}

function historicalQuery(
  values: Record<string, string | number | undefined>,
): string {
  const query = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });

  const encoded = query.toString();

  return encoded ? `?${encoded}` : "";
}

export function getHistoricalPosAvailability(
  context: PosSessionRequestContext,
  branchId: number,
  businessDate: string,
): Promise<HistoricalPosAvailabilityResponse> {
  return requestPosSession<HistoricalPosAvailabilityResponse>(
    context,
    `/pharmaco/pos/historical/availability${historicalQuery({
      branch_id: branchId,
      business_date: businessDate,
    })}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

export function getHistoricalPosSession(
  context: PosSessionRequestContext,
  businessDate: string,
): Promise<HistoricalCurrentSessionResponse> {
  return requestPosSession<HistoricalCurrentSessionResponse>(
    context,
    `/pharmaco/pos/historical/session/current${historicalQuery({
      business_date: businessDate,
    })}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

export function requestHistoricalPosApproval(
  context: PosSessionRequestContext,
  payload: {
    branch_id: number;
    business_date: string;
    request_reason: string;
    historical_reference?: string;
  },
): Promise<HistoricalApprovalResponse> {
  return requestPosSession<HistoricalApprovalResponse>(
    context,
    "/pharmaco/pos/historical/approvals",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function getHistoricalPosApprovals(
  context: PosSessionRequestContext,
  filters: {
    status?: string;
    branch_id?: number;
    business_date?: string;
  } = {},
): Promise<HistoricalApprovalsResponse> {
  return requestPosSession<HistoricalApprovalsResponse>(
    context,
    `/pharmaco/pos/historical/approvals${historicalQuery(filters)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

export function approveHistoricalPosApproval(
  context: PosSessionRequestContext,
  approvalId: number,
  decisionNotes?: string,
): Promise<HistoricalApprovalDecisionResponse> {
  return requestPosSession<HistoricalApprovalDecisionResponse>(
    context,
    `/pharmaco/pos/historical/approvals/${approvalId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({
        decision_notes: decisionNotes || undefined,
      }),
    },
  );
}

export function rejectHistoricalPosApproval(
  context: PosSessionRequestContext,
  approvalId: number,
  decisionNotes: string,
): Promise<HistoricalApprovalResponse> {
  return requestPosSession<HistoricalApprovalResponse>(
    context,
    `/pharmaco/pos/historical/approvals/${approvalId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        decision_notes: decisionNotes,
      }),
    },
  );
}

export function openHistoricalPosSession(
  context: PosSessionRequestContext,
  payload: HistoricalOpenSessionPayload,
): Promise<HistoricalOpenSessionResponse> {
  return requestPosSession<HistoricalOpenSessionResponse>(
    context,
    "/pharmaco/pos/historical/session/open",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/* AQUILA_POS_SESSION_ADMIN_CONTROL_20260713 */

export interface PosSessionAdminCashier {
  id: number;
  name: string;
  email: string;
}

export interface PosSessionAdminRecord
  extends PosSession {
  cashier: PosSessionAdminCashier | null;
  support_status: "normal" | "stuck";
  reset_authorizer:
    | PosSessionAdminCashier
    | null;
  can_force_close: boolean;
  can_reset_limit: boolean;
}

export interface PosSessionAdminSummary {
  total: number;
  open: number;
  zeroized: number;
  closed: number;
  stuck: number;
  reset_authorized: number;
}

export interface PosSessionAdminResponse {
  summary: PosSessionAdminSummary;
  sessions: PosSessionAdminRecord[];
  support_policy: {
    history_is_never_renumbered: boolean;
    reset_limit_authorizes_next_session: boolean;
    force_close_requires_reason: boolean;
    all_admin_actions_create_clock_events: boolean;
  };
}

export interface ForceClosePosSessionPayload {
  declared_cash_amount?: number;
  reason: string;
  authorize_next_session?: boolean;
}

export function getAdminPosSessions(
  context: PosSessionRequestContext,
  filters: {
    branch_id?: number;
    user_id?: number;
    status?: string;
    business_date?: string;
    search?: string;
    limit?: number;
  } = {},
): Promise<PosSessionAdminResponse> {
  return requestPosSession<PosSessionAdminResponse>(
    context,
    `/pharmaco/pos/sessions/admin${historicalQuery(
      filters,
    )}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

export function forceClosePosSession(
  context: PosSessionRequestContext,
  sessionId: number | string,
  payload: ForceClosePosSessionPayload,
): Promise<PosSessionMutationResponse> {
  return requestPosSession<PosSessionMutationResponse>(
    context,
    sessionPath(sessionId, "force-close"),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function resetPosSessionLimit(
  context: PosSessionRequestContext,
  sessionId: number | string,
  payload: AdminResetPosSessionPayload,
): Promise<PosSessionMutationResponse> {
  return requestPosSession<PosSessionMutationResponse>(
    context,
    sessionPath(sessionId, "reset-limit"),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

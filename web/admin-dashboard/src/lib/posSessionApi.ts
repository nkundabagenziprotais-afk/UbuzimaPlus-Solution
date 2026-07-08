const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "/api/v1"
).replace(/\/+$/, "");

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
    `${API_BASE_URL}${path}`,
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

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type PosSession,
  type PosSessionAdminRecord,
  type PosSessionAdminResponse,
  forceClosePosSession,
  getAdminPosSessions,
  resetPosSessionLimit,
} from "../lib/posSessionApi";

type Props = {
  token: string;
  tenantSlug: string;
  permissions: readonly string[];
  currentSession: PosSession | null;
  onSessionChanged: (
    session: PosSession,
    message: string,
  ) => void;
};

type SupportAction =
  | {
      type: "force-close";
      session: PosSessionAdminRecord;
    }
  | {
      type: "reset-limit";
      session: PosSessionAdminRecord;
    }
  | null;

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function dateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-RW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export function PosSessionAdminControl({
  token,
  tenantSlug,
  permissions,
  currentSession,
  onSessionChanged,
}: Props) {
  const canAdminister = permissions.some(
    (permission) =>
      permission === "pharmaco.pos.session.reset"
      || permission === "pos.session_support.edit"
      || permission === "roles.manage"
      || permission === "tenant.roles.manage",
  );

  const [data, setData] =
    useState<PosSessionAdminResponse | null>(null);

  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [action, setAction] =
    useState<SupportAction>(null);
  const [reason, setReason] = useState("");
  const [declaredCash, setDeclaredCash] =
    useState("");
  const [authorizeNext, setAuthorizeNext] =
    useState(false);

  const load = useCallback(async () => {
    if (!canAdminister || !tenantSlug) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await getAdminPosSessions(
        {
          token,
          tenantSlug,
        },
        {
          status,
          search: search.trim() || undefined,
          limit: 60,
        },
      );

      setData(response);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load POS session support information.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    canAdminister,
    search,
    status,
    tenantSlug,
    token,
  ]);

  useEffect(() => {
    void load();
  }, [load, currentSession?.id, currentSession?.status]);

  const visibleSessions = useMemo(
    () => data?.sessions ?? [],
    [data],
  );

  function openAction(
    nextAction: Exclude<SupportAction, null>,
  ) {
    setAction(nextAction);
    setReason("");
    setDeclaredCash(
      String(
        nextAction.session.expected_cash_amount,
      ),
    );
    setAuthorizeNext(false);
    setNotice("");
    setError("");
  }

  async function submitAction(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!action || reason.trim().length < 10) {
      setError(
        "Provide a clear support reason of at least 10 characters.",
      );
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const context = {
        token,
        tenantSlug,
      };

      const response =
        action.type === "force-close"
          ? await forceClosePosSession(
              context,
              action.session.id,
              {
                declared_cash_amount:
                  declaredCash.trim() === ""
                    ? undefined
                    : Number(declaredCash),
                reason: reason.trim(),
                authorize_next_session:
                  authorizeNext,
              },
            )
          : await resetPosSessionLimit(
              context,
              action.session.id,
              {
                reason: reason.trim(),
              },
            );

      setNotice(response.message);
      setAction(null);
      onSessionChanged(
        response.session,
        response.message,
      );
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to complete the POS support action.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!canAdminister) return null;

  return (
    <section className="pos-admin-control">
      <header className="pos-admin-control__header">
        <div>
          <span>Administrator support console</span>
          <h3>POS Session Admin Control</h3>
          <p>
            Inspect cashier sessions, resolve stuck tills,
            force-close an open session and authorize another
            daily session without deleting or renumbering history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing…" : "Refresh sessions"}
        </button>
      </header>

      {notice && (
        <div className="pos-admin-control__notice">
          {notice}
        </div>
      )}

      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      <div className="pos-admin-control__summary">
        <article>
          <span>Open sessions</span>
          <strong>{data?.summary.open ?? 0}</strong>
          <small>Currently active tills</small>
        </article>

        <article>
          <span>Stuck sessions</span>
          <strong>{data?.summary.stuck ?? 0}</strong>
          <small>Open for more than 12 hours</small>
        </article>

        <article>
          <span>Closed sessions</span>
          <strong>{data?.summary.closed ?? 0}</strong>
          <small>Within the current support window</small>
        </article>

        <article>
          <span>Resets authorized</span>
          <strong>
            {data?.summary.reset_authorized ?? 0}
          </strong>
          <small>Additional sessions approved</small>
        </article>
      </div>

      <div className="pos-admin-control__filters">
        <label>
          Session status
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="zeroized">Zeroized</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label>
          Cashier or session
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search cashier, email or session number"
          />
        </label>

        <button
          type="button"
          onClick={() => void load()}
        >
          Apply filters
        </button>
      </div>

      <div className="pos-admin-control__table-shell">
        <table>
          <thead>
            <tr>
              <th>Session</th>
              <th>Type</th>
              <th>Business Date</th>
              <th>Cashier / Branch</th>
              <th>Status</th>
              <th>Expected</th>
              <th>Variance</th>
              <th>Opened / Closed</th>
              <th>Support actions</th>
            </tr>
          </thead>

          <tbody>
            {visibleSessions.map((session) => (
              <tr key={session.id}>
                <td>
                  <strong>
                    {session.session_number}
                  </strong>
                  <small>
                    Sequence {session.sequence_number}
                    {" · "}
                    {session.business_date}
                  </small>
                </td>
                <td>
                  <span className="pos-admin-session-type">
                    {(session as { session_mode?: string | null }).session_mode === 'historical'
                      ? 'Historical'
                      : 'Live'}
                  </span>
                </td>
                <td>
                  {(session as { business_date?: string | null }).business_date || '—'}
                </td>

                <td>
                  <strong>
                    {session.cashier?.name
                      ?? "Unknown cashier"}
                  </strong>
                  <small>
                    {session.branch?.name
                      ?? "No branch"}
                  </small>
                </td>

                <td>
                  <span
                    className={
                      `pos-admin-status is-${session.status}`
                      + (
                        session.support_status === "stuck"
                          ? " is-stuck"
                          : ""
                      )
                    }
                  >
                    {session.support_status === "stuck"
                      ? "Stuck · "
                      : ""}
                    {statusLabel(session.status)}
                  </span>

                  {session.reset_authorized && (
                    <small>
                      Next session authorized
                    </small>
                  )}
                </td>

                <td>
                  <strong>
                    {money(
                      session.expected_cash_amount,
                    )}
                  </strong>
                  <small>
                    Declared{" "}
                    {session.declared_cash_amount === null
                      ? "not recorded"
                      : money(
                          session.declared_cash_amount,
                        )}
                  </small>
                </td>

                <td>
                  <strong>
                    {session.variance_amount === null
                      ? "Pending"
                      : money(
                          session.variance_amount,
                        )}
                  </strong>
                </td>

                <td>
                  <span>
                    {dateTime(session.opened_at)}
                  </span>
                  <small>
                    {session.closed_at
                      ? `Closed ${dateTime(
                          session.closed_at,
                        )}`
                      : "Still open"}
                  </small>
                </td>

                <td>
                  <div className="pos-admin-control__actions">
                    <button
                      type="button"
                      disabled={
                        !session.can_force_close
                      }
                      onClick={() =>
                        openAction({
                          type: "force-close",
                          session,
                        })
                      }
                    >
                      Force close
                    </button>

                    <button
                      type="button"
                      disabled={
                        !session.can_reset_limit
                      }
                      onClick={() =>
                        openAction({
                          type: "reset-limit",
                          session,
                        })
                      }
                    >
                      Reset session limit
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!isLoading
              && visibleSessions.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    No POS sessions match the selected
                    support filters.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>

      {action && (
        <div
          className="pos-admin-control__dialog-backdrop"
          role="presentation"
        >
          <form
            className="pos-admin-control__dialog"
            onSubmit={submitAction}
          >
            <header>
              <div>
                <span>
                  {action.type === "force-close"
                    ? "Emergency till resolution"
                    : "Additional-session authorization"}
                </span>
                <h4>
                  {action.type === "force-close"
                    ? "Force-close POS session"
                    : "Reset daily session limit"}
                </h4>
              </div>

              <button
                type="button"
                onClick={() => setAction(null)}
              >
                Close
              </button>
            </header>

            <div className="pos-admin-control__dialog-context">
              <strong>
                {action.session.session_number}
              </strong>
              <span>
                {action.session.cashier?.name
                  ?? "Unknown cashier"}
                {" · "}
                {action.session.branch?.name
                  ?? "No branch"}
              </span>
            </div>

            {action.type === "force-close" && (
              <>
                <label>
                  Declared physical cash
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={declaredCash}
                    onChange={(event) =>
                      setDeclaredCash(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="pos-admin-control__checkbox">
                  <input
                    type="checkbox"
                    checked={authorizeNext}
                    onChange={(event) =>
                      setAuthorizeNext(
                        event.target.checked,
                      )
                    }
                  />
                  Authorize the cashier to open another
                  session after this force-close
                </label>
              </>
            )}

            <label>
              Administrator support reason
              <textarea
                rows={4}
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                placeholder="Explain the incident, checks completed and why this support action is required."
                required
                minLength={10}
              />
            </label>

            <footer>
              <button
                type="button"
                onClick={() => setAction(null)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary"
                disabled={isSaving}
              >
                {isSaving
                  ? "Recording support action…"
                  : action.type === "force-close"
                    ? "Confirm force close"
                    : "Authorize another session"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

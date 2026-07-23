/* HISTORICAL_POS_NO_REASON_ADMIN_OWNER_BYPASS_FINAL_V1 */
/* HISTORICAL_POS_REASON_REMOVED_V1 */
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type HistoricalPosApproval,
  type HistoricalPosAvailabilityResponse,
  type HistoricalPosSessionRecord,
  type PosSession,
  approveHistoricalPosApproval,
  getHistoricalPosApprovals,
  getHistoricalPosAvailability,
  getHistoricalPosSession,
  openHistoricalPosSession,
  rejectHistoricalPosApproval,
  requestHistoricalPosApproval,
} from "../lib/posSessionApi";
import "./HistoricalPosWorkflow.css";

function historicalPosAutoReasonGlobal() {
  return 'Historical POS entry created through approved workflow.';
}

type HistoricalPosWorkflowProps = {
  token: string;
  tenantSlug: string;
  branchId: number | null;
  permissions: readonly string[];
  currentSession: PosSession | null;
  openingFloatAmount: number;
  openingMode: "fresh-start" | "handover";
  onSessionChanged: (
    session: PosSession,
    message: string,
  ) => void;
  onNotice: (message: string) => void;
};

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(date.getDate()).padStart(
    2,
    "0",
  );

  return `${year}-${month}-${day}`;
}

function historicalDateBounds(): {
  minimum: string;
  maximum: string;
} {
  const maximum = new Date();
  maximum.setDate(maximum.getDate() - 1);

  const minimum = new Date();
  minimum.setDate(minimum.getDate() - 90);

  return {
    minimum: localDateValue(minimum),
    maximum: localDateValue(maximum),
  };
}

function approvalStatusLabel(status: string): string {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function formatMoney(value: number): string {
  return `RWF ${Number(value || 0).toLocaleString(
    "en-RW",
    {
      maximumFractionDigits: 2,
    },
  )}`;
}

function normalizeHistoricalSession(
  session: HistoricalPosSessionRecord,
): PosSession {
  return {
    id: session.id,
    uuid: session.uuid,
    session_number: session.session_number,
    sequence_number: session.sequence_number,
    business_date: session.business_date,
    session_mode: "historical",
    historical_reason: historicalPosAutoReasonGlobal(),
    historical_reference:
      session.historical_reference,
    historical_approval_id:
      session.historical_approval_id,
    status: session.status,
    branch: session.branch,
    opening_float_amount:
      session.opening_float_amount,
    expected_cash_amount:
      session.expected_cash_amount,
    declared_cash_amount:
      session.declared_cash_amount,
    cash_drop_amount:
      session.cash_drop_amount,
    balance_clearance_amount:
      session.balance_clearance_amount,
    variance_amount: session.variance_amount,
    balance_cleared:
      session.status === "zeroized"
      || session.status === "closed",
    can_close: session.status === "zeroized",
    reset_authorized: false,
    can_open_additional_session: false,
    reset_reason: null,
    reset_authorized_at: null,
    reset_authorized_by: null,
    opened_at: session.opened_at,
    zeroized_at: session.zeroized_at,
    closed_at: session.closed_at,
    metadata: session.metadata || {},
    events: (session.events || []).map(
      (event) => ({
        type: event.event_type,
        amount: event.amount,
        notes: event.notes,
        created_at: event.created_at,
      }),
    ),
  };
}

export function HistoricalPosWorkflow({
  token,
  tenantSlug,
  branchId,
  permissions,
  currentSession,
  openingFloatAmount,
  openingMode,
  onSessionChanged,
  onNotice,
}: HistoricalPosWorkflowProps) {
  const dateBounds = useMemo(
    historicalDateBounds,
    [],
  );

  const storageKey = useMemo(
    () =>
      `ubuzima-historical-pos-date:${tenantSlug}`,
    [tenantSlug],
  );

  const [isExpanded, setIsExpanded] =
    useState(false);

  const [businessDate, setBusinessDate] =
    useState(dateBounds.maximum);

  const [historicalReason, setHistoricalReason] =
    useState("");

  const [
    historicalReference,
    setHistoricalReference,
  ] = useState("");

  const [openingFloat, setOpeningFloat] =
    useState(String(openingFloatAmount || 0));

  const [selectedOpeningMode, setSelectedOpeningMode] =
    useState<"fresh-start" | "handover">(
      openingMode,
    );

  const [availability, setAvailability] =
    useState<HistoricalPosAvailabilityResponse | null>(
      null,
    );

  const [approval, setApproval] =
    useState<HistoricalPosApproval | null>(null);

  const [approvalCode, setApprovalCode] =
    useState("");

  const [displayedOneTimeCode, setDisplayedOneTimeCode] =
    useState("");

  const [decisionNotes, setDecisionNotes] =
    useState("");

  const [pendingApprovals, setPendingApprovals] =
    useState<HistoricalPosApproval[]>([]);

  const [isChecking, setIsChecking] =
    useState(false);

  const [isRequesting, setIsRequesting] =
    useState(false);

  const [isOpening, setIsOpening] =
    useState(false);

  const [isLoadingQueue, setIsLoadingQueue] =
    useState(false);

  const [decisionApprovalId, setDecisionApprovalId] =
    useState<number | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const canView = permissions.includes(
    "pharmaco.pos.historical.view",
  );

  const canOpen = permissions.includes(
    "pharmaco.pos.historical.open",
  );

  const canApprove = permissions.includes(
    "pharmaco.pos.historical.approve",
  );

  const isHistoricalSession =
    currentSession?.session_mode === "historical";

  const activeNonHistoricalSession =
    currentSession !== null
    && currentSession.status !== "closed"
    && !isHistoricalSession;

  useEffect(() => {
    setOpeningFloat(
      String(openingFloatAmount || 0),
    );
  }, [openingFloatAmount]);

  useEffect(() => {
    setSelectedOpeningMode(openingMode);
  }, [openingMode]);

  useEffect(() => {
    const storedDate = localStorage.getItem(
      storageKey,
    );

    if (
      !storedDate
      || !canView
      || !token
      || !tenantSlug
    ) {
      return;
    }

    setBusinessDate(storedDate);

    let cancelled = false;

    void getHistoricalPosSession(
      {
        token,
        tenantSlug,
      },
      storedDate,
    )
      .then((response) => {
        if (
          cancelled
          || !response.session
          || response.session.status === "closed"
        ) {
          return;
        }

        onSessionChanged(
          normalizeHistoricalSession(
            response.session,
          ),
          `Historical POS session restored for ${storedDate}.`,
        );

        setIsExpanded(true);
      })
      .catch(() => {
        localStorage.removeItem(storageKey);
      });

    return () => {
      cancelled = true;
    };
  }, [
    canView,
    storageKey,
    tenantSlug,
    token,
  ]);

  if (!canView && !canOpen && !canApprove) {
    return null;
  }

  async function checkAvailability() {
    if (!branchId) {
      setErrorMessage(
        "Select your assigned branch to continue. If no branch appears, ask an administrator to confirm your branch assignment.",
      );
      return;
    }

    if (!businessDate) {
      setErrorMessage(
        "Select the historical business date.",
      );
      return;
    }

    setIsChecking(true);
    setErrorMessage("");
    setSuccessMessage("");
    setApproval(null);
    setApprovalCode("");
    setDisplayedOneTimeCode("");

    try {
      const response =
        await getHistoricalPosAvailability(
          {
            token,
            tenantSlug,
          },
          branchId,
          businessDate,
        );

      setAvailability(response);

      setSuccessMessage(
        response.approval_required
          ? "Live transactions already exist on this date. Admin or Owner authorization is required."
          : "No conflicting live activity was found. You may open the historical session directly.",
      );
    } catch (error: unknown) {
      setAvailability(null);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to check the historical date.",
      );
    } finally {
      setIsChecking(false);
    }
  }

  async function submitApprovalRequest() {
    if (!branchId) {
      setErrorMessage(
        "Select your assigned branch to continue. If no branch appears, ask an administrator to confirm your branch assignment.",
      );
      return;
    }


    setIsRequesting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await requestHistoricalPosApproval(
          {
            token,
            tenantSlug,
          },
          {
            branch_id: branchId,
            business_date: businessDate,
            request_reason: historicalPosAutoReasonGlobal(),
            historical_reference:
              historicalReference.trim()
              || undefined,
          },
        );

      setApproval(response.approval);
      setSuccessMessage(response.message);

      if (canApprove) {
        await loadApprovalQueue();
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to request authorization.",
      );
    } finally {
      setIsRequesting(false);
    }
  }

  async function loadApprovalQueue() {
    if (!canApprove || !branchId) {
      return;
    }

    setIsLoadingQueue(true);
    setErrorMessage("");

    try {
      const response =
        await getHistoricalPosApprovals(
          {
            token,
            tenantSlug,
          },
          {
            status: "pending",
            branch_id: branchId,
            business_date:
              businessDate || undefined,
          },
        );

      setPendingApprovals(response.approvals);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load pending approvals.",
      );
    } finally {
      setIsLoadingQueue(false);
    }
  }

  async function approveRequest(
    item: HistoricalPosApproval,
  ) {
    setDecisionApprovalId(item.id);
    setErrorMessage("");
    setSuccessMessage("");
    setDisplayedOneTimeCode("");

    try {
      const response =
        await approveHistoricalPosApproval(
          {
            token,
            tenantSlug,
          },
          item.id,
          decisionNotes.trim() || undefined,
        );

      setApproval(response.approval);

      if (response.approval_code) {
        setDisplayedOneTimeCode(
          response.approval_code,
        );

        setApprovalCode(response.approval_code);
      }

      setSuccessMessage(response.message);
      setDecisionNotes("");

      await loadApprovalQueue();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to approve this request.",
      );
    } finally {
      setDecisionApprovalId(null);
    }
  }

  async function rejectRequest(
    item: HistoricalPosApproval,
  ) {
    if (decisionNotes.trim().length < 5) {
      setErrorMessage(
        "Provide rejection notes of at least 5 characters.",
      );
      return;
    }

    setDecisionApprovalId(item.id);
    setErrorMessage("");
    setSuccessMessage("");
    setDisplayedOneTimeCode("");

    try {
      const response =
        await rejectHistoricalPosApproval(
          {
            token,
            tenantSlug,
          },
          item.id,
          decisionNotes.trim(),
        );

      setSuccessMessage(response.message);
      setDecisionNotes("");

      if (approval?.id === item.id) {
        setApproval(response.approval);
      }

      await loadApprovalQueue();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to reject this request.",
      );
    } finally {
      setDecisionApprovalId(null);
    }
  }

  function historicalPosAutoReason() {
    return `Historical POS session for business date ${businessDate || 'selected date'}`;
  }

  async function openHistoricalSession() {
    if (!canOpen) {
      setErrorMessage(
        "You do not have permission to open historical POS sessions.",
      );
      return;
    }

    if (!branchId) {
      setErrorMessage(
        "Select your assigned branch to continue. If no branch appears, ask an administrator to confirm your branch assignment.",
      );
      return;
    }

    if (!availability) {
      setErrorMessage(
        "Check the business date before opening the session.",
      );
      return;
    }


    const numericOpeningFloat = Number(
      openingFloat,
    );

    if (
      !Number.isFinite(numericOpeningFloat)
      || numericOpeningFloat < 0
    ) {
      setErrorMessage(
        "Enter a valid opening cash balance.",
      );
      return;
    }

    if (
      availability.approval_required
      && !approval?.id
    ) {
      setErrorMessage(
        "Request historical authorization before opening this session.",
      );
      return;
    }

    if (
      availability.approval_required
      && !/^\d{6}$/.test(approvalCode)
    ) {
      setErrorMessage(
        "Enter the six-digit Admin or Owner authorization code.",
      );
      return;
    }

    setIsOpening(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await openHistoricalPosSession(
          {
            token,
            tenantSlug,
          },
          {
            branch_id: branchId,
            business_date: businessDate,
            opening_float_amount:
              numericOpeningFloat,
            opening_mode:
              selectedOpeningMode,
            historical_reason: historicalPosAutoReasonGlobal(),
            historical_reference:
              historicalReference.trim()
              || undefined,
            approval_id:
              availability.approval_required
                ? approval?.id
                : undefined,
            approval_code:
              availability.approval_required
                ? approvalCode
                : undefined,
          },
        );

      const normalized =
        normalizeHistoricalSession(
          response.session,
        );

      localStorage.setItem(
        storageKey,
        businessDate,
      );

      onSessionChanged(
        normalized,
        response.message,
      );

      onNotice(
        `${response.message} ${response.historical_entry_warning}`,
      );

      setSuccessMessage(
        response.historical_entry_warning,
      );

      setApprovalCode("");
      setDisplayedOneTimeCode("");
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to open the historical POS session.",
      );
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <section
      className={[
        "historical-pos-workflow",
        isHistoricalSession
          ? "historical-pos-workflow--active"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Historical POS workflow" data-historical-pos-journey="guided-v1" data-hide-guidance="true"
    >
      {isHistoricalSession ? (
        <div
          className="historical-pos-banner"
          role="status"
        >
          <div className="historical-pos-banner__identity">
            <span className="historical-pos-badge">
              Historical session open
            </span>

            <div>
              <strong>
                Business date{" "}
                {currentSession.business_date}
              </strong>

              
            </div>
          </div>

          <div className="historical-pos-banner__details">
            <span>
              Session{" "}
              {currentSession.session_number}
            </span>

            {currentSession.historical_reference ? (
              <span>
                {currentSession.historical_reference}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="historical-pos-launch">
            <button
              type="button"
              className="historical-pos-toggle"
              onClick={() =>
                setIsExpanded((current) => !current)
              }
              aria-expanded={isExpanded}
            >
              {isExpanded
                ? "Close historical setup"
                : "Open historical POS session"}
            </button>
          </div>

          {isExpanded ? (
            <div className="historical-pos-body">
              {activeNonHistoricalSession ? (
                <div
                  className="historical-pos-message historical-pos-message--warning"
                  role="alert"
                >
                  Close the active Live POS session
                  before opening a historical
                  session.
                </div>
              ) : null}

              <div className="historical-pos-form-grid">
                <label>
                  <span>
                    Historical business date
                  </span>

                  <input
                    type="date"
                    min={dateBounds.minimum}
                    max={dateBounds.maximum}
                    value={businessDate}
                    onChange={(event) => {
                      setBusinessDate(
                        event.target.value,
                      );

                      setAvailability(null);
                      setApproval(null);
                      setApprovalCode("");
                      setDisplayedOneTimeCode("");
                    }}
                  />

                  <small>
                    Up to 90 days before today
                  </small>
                </label>

                <label>
                  <span>Opening mode</span>

                  <select
                    value={selectedOpeningMode}
                    onChange={(event) =>
                      setSelectedOpeningMode(
                        event.target.value as
                          | "fresh-start"
                          | "handover",
                      )
                    }
                  >
                    <option value="fresh-start">
                      Fresh historical session
                    </option>

                    <option value="handover">
                      Historical handover
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Opening cash balance
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={openingFloat}
                    onChange={(event) =>
                      setOpeningFloat(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Paper register or reference
                  </span>

                  <input
                    value={historicalReference}
                    maxLength={160}
                    placeholder="Register, invoice book or source reference"
                    onChange={(event) =>
                      setHistoricalReference(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="historical-pos-form-grid__wide">
                  <span>
                    Reason for historical entry
                  </span>

                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={historicalReason}
                    placeholder="Explain why these transactions were not recorded on the original business date."
                    onChange={(event) =>
                      setHistoricalReason(
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>

              <div className="historical-pos-actions">
                <button
                  type="button"
                  onClick={checkAvailability}
                  disabled={
                    isChecking
                    || isOpening
                    || activeNonHistoricalSession
                  }
                >
                  {isChecking
                    ? "Checking date..."
                    : "Check date"}
                </button>

                {canApprove ? (
                  <button
                    type="button"
                    className="historical-pos-secondary"
                    onClick={loadApprovalQueue}
                    disabled={
                      isLoadingQueue
                      || !branchId
                    }
                  >
                    {isLoadingQueue
                      ? "Loading approvals..."
                      : "Review approval queue"}
                  </button>
                ) : null}
              </div>

              {availability ? (
                <div
                  className={[
                    "historical-pos-conflict-card",
                    availability.approval_required
                      ? "historical-pos-conflict-card--conflict"
                      : "historical-pos-conflict-card--clear",
                  ].join(" ")}
                >
                  <div>
                    <span>
                      {availability.approval_required
                        ? "Authorization required"
                        : "No live conflict"}
                    </span>

                    <strong>
                      {availability.business_date}
                    </strong>
                  </div>

                  <div>
                    <span>Live transactions</span>

                    <strong>
                      {
                        availability.live_activity_count
                      }
                    </strong>
                  </div>

                  <div>
                    <span>Live value</span>

                    <strong>
                      {formatMoney(
                        availability.live_activity_total,
                      )}
                    </strong>
                  </div>
                </div>
              ) : null}

              {availability?.approval_required ? (
                <section className="historical-pos-approval-card">
                  <div>
                    <span>
                      Admin or Owner authorization
                    </span>

                    <h4>
                      Request a one-time opening code
                    </h4>

                    <p>
                      The code expires after ten
                      minutes and is locked after
                      three unsuccessful attempts.
                    </p>
                  </div>

                  <div className="historical-pos-actions">
                    <button
                      type="button"
                      onClick={
                        submitApprovalRequest
                      }
                      disabled={isRequesting}
                    >
                      {isRequesting
                        ? "Requesting..."
                        : approval
                          ? "Refresh request"
                          : "Request authorization"}
                    </button>
                  </div>

                  {approval ? (
                    <div className="historical-pos-approval-status">
                      <span>
                        Request #{approval.id}
                      </span>

                      <strong>
                        {approvalStatusLabel(
                          approval.status,
                        )}
                      </strong>

                      <small>
                        Attempts:{" "}
                        {approval.failed_attempts}/3
                      </small>

                      {approval.expires_at ? (
                        <small>
                          Expires{" "}
                          {new Date(
                            approval.expires_at,
                          ).toLocaleString()}
                        </small>
                      ) : null}
                    </div>
                  ) : null}

                  <label>
                    <span>
                      Six-digit authorization code
                    </span>

                    <input
                      className="historical-pos-code-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={approvalCode}
                      placeholder="000000"
                      onChange={(event) =>
                        setApprovalCode(
                          event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6),
                        )
                      }
                    />
                  </label>
                </section>
              ) : null}

              {displayedOneTimeCode ? (
                <div
                  className="historical-pos-one-time-code"
                  role="status"
                >
                  <span>
                    One-time authorization code
                  </span>

                  <strong>
                    {displayedOneTimeCode}
                  </strong>

                  <small>
                    Displayed once. Share it only
                    with the teller who requested
                    this historical session.
                  </small>
                </div>
              ) : null}

              {canApprove
              && pendingApprovals.length > 0 ? (
                <section className="historical-pos-queue">
                  <div className="historical-pos-queue__heading">
                    <div>
                      <span>
                        Admin / Owner review
                      </span>

                      <h4>
                        Pending historical
                        approvals
                      </h4>
                    </div>

                    <small>
                      {pendingApprovals.length}{" "}
                      pending
                    </small>
                  </div>

                  <label>
                    <span>
                      Approval or rejection notes
                    </span>

                    <textarea
                      rows={2}
                      value={decisionNotes}
                      placeholder="Record what was reviewed before making the decision."
                      onChange={(event) =>
                        setDecisionNotes(
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <div className="historical-pos-queue__items">
                    {pendingApprovals.map(
                      (item) => (
                        <article key={item.id}>
                          <div>
                            <strong>
                              {item.business_date}
                            </strong>

                            <span>
                              {item.requester?.name
                                || `User ${item.requested_by}`}
                            </span>

                            <small>
                              
                            </small>

                            <small>
                              {
                                item.live_activity_count
                              }{" "}
                              live transactions ·{" "}
                              {formatMoney(
                                item.live_activity_total,
                              )}
                            </small>
                          </div>

                          <div className="historical-pos-queue__actions">
                            <button
                              type="button"
                              onClick={() =>
                                approveRequest(item)
                              }
                              disabled={
                                decisionApprovalId
                                !== null
                              }
                            >
                              {decisionApprovalId
                              === item.id
                                ? "Processing..."
                                : "Approve & show code"}
                            </button>

                            <button
                              type="button"
                              className="historical-pos-danger"
                              onClick={() =>
                                rejectRequest(item)
                              }
                              disabled={
                                decisionApprovalId
                                !== null
                              }
                            >
                              Reject
                            </button>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                </section>
              ) : null}

              {errorMessage ? (
                <div
                  className="historical-pos-message historical-pos-message--error"
                  role="alert"
                >
                  {errorMessage}
                </div>
              ) : null}

              {successMessage ? (
                <div
                  className="historical-pos-message historical-pos-message--success"
                  role="status"
                >
                  {successMessage}
                </div>
              ) : null}

              <div className="historical-pos-open-row">
                <strong>
                  Open historical POS session
                </strong>

                <button
                  type="button"
                  className="historical-pos-primary"
                  onClick={openHistoricalSession}
                  disabled={
                    !canOpen
                    || !availability
                    || isOpening
                    || activeNonHistoricalSession
                  }
                >
                  {isOpening
                    ? "Opening session..."
                    : "Open historical session"}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

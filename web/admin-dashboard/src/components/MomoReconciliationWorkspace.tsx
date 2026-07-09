import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  type AccessProfile,
} from '../lib/api';

import {
  type MomoMessage,
  type MomoParserTemplate,
  type MomoReconciliation,
  approveMomoReconciliation,
  getMomoMessages,
  getMomoReconciliations,
  getMomoTemplates,
  ingestMomoMessage,
  rejectMomoReconciliation,
  saveMomoTemplate,
} from '../lib/momoReconciliationApi';

type Props = {
  token: string;
  profile: AccessProfile;
};

const sampleMessage =
  'You have received 213200 RWF from VITA PHARMA Ltd Ltd (*********980) at 2026-07-09 08:13:20. Balance: 444607 RWF. FT Id: 29074382317. ET Id: -.';

function asRecord(
  value: unknown,
): Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
    ? value as Record<string, unknown>
    : {};
}

function tenantSlugFrom(
  profile: AccessProfile,
): string {
  const profileRecord =
    asRecord(profile);

  const assignments =
    Array.isArray(
      profileRecord.tenant_assignments,
    )
      ? profileRecord.tenant_assignments
      : [];

  const assignment =
    asRecord(assignments[0]);

  const tenant =
    asRecord(assignment.tenant);

  return String(
    tenant.slug ??
    assignment.tenant_slug ??
    '',
  ).trim();
}

function canApprove(
  profile: AccessProfile,
): boolean {
  const profileRecord =
    asRecord(profile);

  const roles = Array.isArray(
    profileRecord.roles,
  )
    ? profileRecord.roles
    : [];

  return roles.some((value) => {
    const roleRecord =
      asRecord(value);

    const nestedRole =
      asRecord(roleRecord.role);

    const code = String(
      roleRecord.code ??
      nestedRole.code ??
      roleRecord.role_code ??
      '',
    )
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, '_');

    return (
      code === 'tenant_admin' ||
      code === 'owner' ||
      code === 'super_admin' ||
      code === 'platform_admin' ||
      code ===
        'ubuzima_plus_super_admin' ||
      code.endsWith('_admin')
    );
  });
}

function money(
  value: number | null | undefined,
): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function datePart(
  value: string | null | undefined,
): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'en-RW',
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    },
  ).format(date);
}

function timePart(
  value: string | null | undefined,
): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat(
    'en-RW',
    {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    },
  ).format(date);
}

function labelize(
  value: string | null | undefined,
): string {
  return String(value ?? '-')
    .replace(/[_-]+/g, ' ')
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

export function MomoReconciliationWorkspace({
  token,
  profile,
}: Props) {
  const tenantSlug = tenantSlugFrom(profile);
  const managerCanApprove =
    canApprove(profile);

  const context = useMemo(
    () => ({
      token,
      tenantSlug,
    }),
    [tenantSlug, token],
  );

  const [messages, setMessages] =
    useState<MomoMessage[]>([]);

  const [
    reconciliations,
    setReconciliations,
  ] = useState<MomoReconciliation[]>([]);

  const [templates, setTemplates] =
    useState<MomoParserTemplate[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [notice, setNotice] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [decisionFilter, setDecisionFilter] =
    useState('all');

  const [showParser, setShowParser] =
    useState(false);

  const [showImport, setShowImport] =
    useState(false);

  const [selectedReview, setSelectedReview] =
    useState<MomoReconciliation | null>(
      null,
    );

  const [senderId, setSenderId] =
    useState('M-Money');

  const [messageBody, setMessageBody] =
    useState(sampleMessage);

  const [templateName, setTemplateName] =
    useState(
      'Standard Mobile Money Receipt',
    );

  const [templateSender, setTemplateSender] =
    useState('M-Money');

  const [templateRegex, setTemplateRegex] =
    useState('');

  const [templateSample, setTemplateSample] =
    useState(sampleMessage);

  const [reviewDecision, setReviewDecision] =
    useState<
      | 'matched_manually'
      | 'accepted_pos_only'
      | 'accepted_momo_only'
      | 'ignored'
    >('matched_manually');

  const [reviewNotes, setReviewNotes] =
    useState('');

  const loadWorkspace = useCallback(
    async () => {
      if (!tenantSlug) {
        setError(
          'An active tenant assignment is required.',
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const [
          messageResponse,
          reconciliationResponse,
          templateResponse,
        ] = await Promise.all([
          getMomoMessages(context),
          getMomoReconciliations(context),
          getMomoTemplates(context),
        ]);

        setMessages(
          messageResponse.messages,
        );

        setReconciliations(
          reconciliationResponse
            .reconciliations,
        );

        setTemplates(
          templateResponse.templates,
        );

        const activeTemplate =
          templateResponse.templates.find(
            (template) =>
              template.status === 'active',
          ) ??
          templateResponse.templates[0];

        if (activeTemplate) {
          setTemplateName(
            activeTemplate.name,
          );

          setTemplateSender(
            activeTemplate.sender_id,
          );

          setTemplateRegex(
            activeTemplate.message_regex,
          );

          setTemplateSample(
            activeTemplate.sample_message ??
            sampleMessage,
          );

          setSenderId(
            activeTemplate.sender_id,
          );
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load Mobile Money reconciliation.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [context, tenantSlug],
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const filteredMessages =
    useMemo(() => {
      const normalized =
        search.trim().toLowerCase();

      return messages.filter(
        (message) =>
          !normalized ||
          [
            message.customer_name,
            message.phone_masked,
            message.amount,
            message
              .provider_transaction_id,
            message.parse_status,
            message
              .reconciliation_decision,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalized),
      );
    }, [messages, search]);

  const filteredReconciliations =
    useMemo(() => {
      const normalized =
        search.trim().toLowerCase();

      return reconciliations.filter(
        (reconciliation) => {
          const decisionMatches =
            decisionFilter === 'all' ||
            reconciliation.decision ===
              decisionFilter ||
            reconciliation.status ===
              decisionFilter;

          const searchMatches =
            !normalized ||
            [
              reconciliation.decision,
              reconciliation.status,
              reconciliation.sale
                ?.sale_number,
              reconciliation.sale
                ?.customer_name,
              reconciliation
                .momo_message
                ?.provider_transaction_id,
              reconciliation
                .momo_message
                ?.phone_masked,
              reconciliation
                .pos_payment
                ?.receipt_number,
              reconciliation
                .pos_payment
                ?.reference_number,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(normalized);

          return (
            decisionMatches &&
            searchMatches
          );
        },
      );
    }, [
      decisionFilter,
      reconciliations,
      search,
    ]);

  async function importMessage(
    event: FormEvent,
  ): Promise<void> {
    event.preventDefault();

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response =
        await ingestMomoMessage(
          context,
          {
            sender_id: senderId,
            message_body: messageBody,
          },
        );

      setNotice(response.message);
      setShowImport(false);

      await loadWorkspace();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to process the message.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveTemplate(
    event: FormEvent,
  ): Promise<void> {
    event.preventDefault();

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response =
        await saveMomoTemplate(
          context,
          {
            name: templateName,
            sender_id: templateSender,
            message_regex: templateRegex,
            timezone: 'Africa/Kigali',
            sample_message:
              templateSample,
          },
        );

      setNotice(response.message);
      setShowParser(false);

      await loadWorkspace();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to save the parser template.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function approveReview(): Promise<void> {
    if (!selectedReview) {
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response =
        await approveMomoReconciliation(
          context,
          selectedReview.id,
          {
            decision: reviewDecision,
            notes: reviewNotes,
          },
        );

      setNotice(response.message);
      setSelectedReview(null);
      setReviewNotes('');

      await loadWorkspace();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to approve the reconciliation.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function rejectReview(): Promise<void> {
    if (
      !selectedReview ||
      !reviewNotes.trim()
    ) {
      setError(
        'Enter a reason before rejecting the reconciliation.',
      );
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response =
        await rejectMomoReconciliation(
          context,
          selectedReview.id,
          reviewNotes,
        );

      setNotice(response.message);
      setSelectedReview(null);
      setReviewNotes('');

      await loadWorkspace();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to reject the reconciliation.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="momo-reconciliation-workspace">
      <header className="momo-reconciliation-header">
        <div>
          <span className="section-label">
            AI-assisted provider reconciliation
          </span>

          <h2>
            Mobile Money Payment Control
          </h2>

          <p>
            Provider messages are parsed using
            versioned templates and matched against
            POS Mobile Money payments using reference,
            amount, time, phone, and customer signals.
          </p>
        </div>

        <div className="momo-header-actions">
          <button
            type="button"
            onClick={() =>
              setShowParser(true)
            }
            disabled={!managerCanApprove}
          >
            Configure Parser
          </button>

          <button
            type="button"
            onClick={() =>
              setShowImport(true)
            }
          >
            Test / Import Message
          </button>

          <button
            type="button"
            onClick={() =>
              void loadWorkspace()
            }
            disabled={isLoading}
          >
            {isLoading
              ? 'Refreshing…'
              : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="momo-engine-status">
        <article>
          <span>Matching engine</span>
          <strong>Active</strong>
          <small>
            Rules-first confidence scoring
          </small>
        </article>

        <article>
          <span>Parser templates</span>
          <strong>{templates.length}</strong>
          <small>
            Admin-configurable and versioned
          </small>
        </article>

        <article>
          <span>Android collector</span>
          <strong>Not connected</strong>
          <small>
            Backend ingestion endpoint is ready
          </small>
        </article>

        <article>
          <span>Manager review</span>
          <strong>
            {
              reconciliations.filter(
                (item) =>
                  item.status === 'review' ||
                  item.status === 'exception',
              ).length
            }
          </strong>
          <small>
            Ambiguous or unmatched records
          </small>
        </article>
      </div>

      {error && (
        <div
          className="sales-control-message error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="sales-control-message success"
          role="status"
        >
          {notice}
        </div>
      )}

      <div className="momo-table-controls">
        <label>
          <span>
            Search MoMo and POS records
          </span>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Customer, phone, transaction, receipt, sale or status"
          />
        </label>

        <label>
          <span>Matching decision</span>

          <select
            value={decisionFilter}
            onChange={(event) =>
              setDecisionFilter(
                event.target.value,
              )
            }
          >
            <option value="all">
              All decisions
            </option>

            <option value="matched">
              Matched
            </option>

            <option value="review">
              Manager review
            </option>

            <option value="exception">
              Exceptions
            </option>

            <option value="approved">
              Approved
            </option>

            <option value="rejected">
              Rejected
            </option>
          </select>
        </label>
      </div>

      <section className="managed-sales-table-card">
        <div className="managed-sales-section-heading">
          <div>
            <span className="section-label">
              Mobile Money provider records
            </span>

            <h3>
              MoMo Payment Transactions Table
            </h3>

            <p>
              Records extracted from approved sender
              IDs. The original SMS is encrypted and
              retained for audit but is not exposed
              in this table.
            </p>
          </div>
        </div>

        <div className="managed-sales-table-wrap">
          <table className="managed-sales-table momo-payment-table">
            <thead>
              <tr>
                <th>SN</th>
                <th>Date</th>
                <th>Time</th>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>Amount</th>
                <th>Transaction ID</th>
                <th>Balance</th>
                <th>Parse Status</th>
                <th>Match Decision</th>
              </tr>
            </thead>

            <tbody>
              {filteredMessages.length ===
              0 ? (
                <tr>
                  <td colSpan={10}>
                    No Mobile Money messages have
                    been received. Connect the
                    Android collector or use Test /
                    Import Message to validate the
                    parser.
                  </td>
                </tr>
              ) : (
                filteredMessages.map(
                  (message, index) => (
                    <tr key={message.id}>
                      <td>{index + 1}</td>

                      <td>
                        {datePart(
                          message.transaction_at ??
                          message.received_at,
                        )}
                      </td>

                      <td>
                        {timePart(
                          message.transaction_at ??
                          message.received_at,
                        )}
                      </td>

                      <td>
                        {message.customer_name ??
                          '-'}
                      </td>

                      <td>
                        {message.phone_masked ??
                          '-'}
                      </td>

                      <td>
                        <strong>
                          {money(message.amount)}
                        </strong>
                      </td>

                      <td>
                        {message
                          .provider_transaction_id ??
                          '-'}
                      </td>

                      <td>
                        {money(message.balance)}
                      </td>

                      <td>
                        <span
                          className={`managed-sales-status ${message.parse_status}`}
                        >
                          {labelize(
                            message.parse_status,
                          )}
                        </span>
                      </td>

                      <td>
                        {labelize(
                          message
                            .reconciliation_decision,
                        )}
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="managed-sales-table-card">
        <div className="managed-sales-section-heading">
          <div>
            <span className="section-label">
              POS and provider comparison
            </span>

            <h3>
              MoMo and POS Reconciliation Table
            </h3>

            <p>
              The table begins from POS payments and
              also identifies provider transactions
              that do not exist in POS.
            </p>
          </div>
        </div>

        <div className="managed-sales-table-wrap">
          <table className="managed-sales-table momo-reconciliation-table">
            <thead>
              <tr>
                <th>SN</th>
                <th>POS Date</th>
                <th>POS Time</th>
                <th>Sale Number</th>
                <th>POS Customer</th>
                <th>Payment Mode</th>
                <th>POS Amount</th>
                <th>MoMo Date</th>
                <th>MoMo Time</th>
                <th>MoMo Customer</th>
                <th>MoMo Phone</th>
                <th>MoMo Amount</th>
                <th>Transaction ID</th>
                <th>AI Matching Decision</th>
                <th>Confidence</th>
                <th>Variance</th>
                <th>Review & Approval</th>
              </tr>
            </thead>

            <tbody>
              {filteredReconciliations
                .length === 0 ? (
                <tr>
                  <td colSpan={17}>
                    No reconciliation records are
                    available.
                  </td>
                </tr>
              ) : (
                filteredReconciliations.map(
                  (
                    reconciliation,
                    index,
                  ) => (
                    <tr
                      key={
                        reconciliation.id
                      }
                    >
                      <td>{index + 1}</td>

                      <td>
                        {datePart(
                          reconciliation
                            .pos_payment
                            ?.received_at ??
                          reconciliation.sale
                            ?.sold_at,
                        )}
                      </td>

                      <td>
                        {timePart(
                          reconciliation
                            .pos_payment
                            ?.received_at ??
                          reconciliation.sale
                            ?.sold_at,
                        )}
                      </td>

                      <td>
                        {reconciliation.sale
                          ?.sale_number ?? '-'}
                      </td>

                      <td>
                        {reconciliation.sale
                          ?.customer_name ?? '-'}
                      </td>

                      <td>
                        {labelize(
                          reconciliation
                            .pos_payment
                            ?.payment_method,
                        )}
                      </td>

                      <td>
                        {money(
                          reconciliation
                            .pos_payment?.amount,
                        )}
                      </td>

                      <td>
                        {datePart(
                          reconciliation
                            .momo_message
                            ?.transaction_at,
                        )}
                      </td>

                      <td>
                        {timePart(
                          reconciliation
                            .momo_message
                            ?.transaction_at,
                        )}
                      </td>

                      <td>
                        {reconciliation
                          .momo_message
                          ?.customer_name ?? '-'}
                      </td>

                      <td>
                        {reconciliation
                          .momo_message
                          ?.phone_masked ?? '-'}
                      </td>

                      <td>
                        {money(
                          reconciliation
                            .momo_message?.amount,
                        )}
                      </td>

                      <td>
                        {reconciliation
                          .momo_message
                          ?.provider_transaction_id ??
                          '-'}
                      </td>

                      <td>
                        <span
                          className={`momo-decision ${reconciliation.status}`}
                        >
                          {labelize(
                            reconciliation.decision,
                          )}
                        </span>
                      </td>

                      <td>
                        {
                          reconciliation
                            .confidence_score
                        }
                        %
                      </td>

                      <td>
                        {reconciliation
                          .amount_variance === null
                          ? '-'
                          : money(
                              reconciliation
                                .amount_variance,
                            )}
                      </td>

                      <td>
                        <button
                          type="button"
                          disabled={
                            !managerCanApprove ||
                            reconciliation.status ===
                              'approved'
                          }
                          onClick={() => {
                            setSelectedReview(
                              reconciliation,
                            );

                            setReviewDecision(
                              reconciliation
                                .momo_message &&
                              reconciliation
                                .pos_payment
                                ? 'matched_manually'
                                : reconciliation
                                    .pos_payment
                                  ? 'accepted_pos_only'
                                  : 'accepted_momo_only',
                            );
                          }}
                        >
                          {reconciliation.status ===
                          'approved'
                            ? 'Approved'
                            : 'Review / Approve'}
                        </button>
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showImport && (
        <div
          className="workspace-explicit-modal-backdrop is-open"
          role="presentation"
          onMouseDown={() =>
            setShowImport(false)
          }
        >
          <section
            className="workspace-explicit-modal momo-form-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Test or import Mobile Money message"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="workspace-explicit-modal-close"
              onClick={() =>
                setShowImport(false)
              }
            >
              ×
            </button>

            <div className="popup-form-heading">
              <span className="section-label">
                Parser and ingestion test
              </span>

              <h3>
                Test / Import MoMo Message
              </h3>

              <p className="muted">
                This validates the backend engine
                until the Android SMS collector is
                connected.
              </p>
            </div>

            <form
              className="momo-form-grid"
              onSubmit={importMessage}
            >
              <label>
                Sender ID
                <input
                  value={senderId}
                  onChange={(event) =>
                    setSenderId(
                      event.target.value,
                    )
                  }
                  required
                />
              </label>

              <label className="momo-form-wide">
                Message body
                <textarea
                  value={messageBody}
                  onChange={(event) =>
                    setMessageBody(
                      event.target.value,
                    )
                  }
                  rows={7}
                  required
                />
              </label>

              <div className="managed-detail-actions momo-form-wide">
                <button
                  type="button"
                  onClick={() =>
                    setShowImport(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving
                    ? 'Processing…'
                    : 'Process Message'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showParser && (
        <div
          className="workspace-explicit-modal-backdrop is-open"
          role="presentation"
          onMouseDown={() =>
            setShowParser(false)
          }
        >
          <section
            className="workspace-explicit-modal momo-parser-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Configure Mobile Money parser"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="workspace-explicit-modal-close"
              onClick={() =>
                setShowParser(false)
              }
            >
              ×
            </button>

            <div className="popup-form-heading">
              <span className="section-label">
                Versioned parser administration
              </span>

              <h3>
                Configure MoMo Message Structure
              </h3>

              <p className="muted">
                Expressions must retain the named
                groups amount, currency, customer,
                phone, datetime, balance,
                transaction_id, and et_id.
              </p>
            </div>

            <form
              className="momo-form-grid"
              onSubmit={saveTemplate}
            >
              <label>
                Template name
                <input
                  value={templateName}
                  onChange={(event) =>
                    setTemplateName(
                      event.target.value,
                    )
                  }
                  required
                />
              </label>

              <label>
                Sender ID
                <input
                  value={templateSender}
                  onChange={(event) =>
                    setTemplateSender(
                      event.target.value,
                    )
                  }
                  required
                />
              </label>

              <label className="momo-form-wide">
                Message regular expression
                <textarea
                  value={templateRegex}
                  onChange={(event) =>
                    setTemplateRegex(
                      event.target.value,
                    )
                  }
                  rows={9}
                  required
                />
              </label>

              <label className="momo-form-wide">
                Sample message
                <textarea
                  value={templateSample}
                  onChange={(event) =>
                    setTemplateSample(
                      event.target.value,
                    )
                  }
                  rows={5}
                />
              </label>

              <div className="managed-detail-actions momo-form-wide">
                <button
                  type="button"
                  onClick={() =>
                    setShowParser(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving
                    ? 'Saving…'
                    : 'Save New Version'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedReview && (
        <div
          className="workspace-explicit-modal-backdrop is-open"
          role="presentation"
          onMouseDown={() =>
            setSelectedReview(null)
          }
        >
          <section
            className="workspace-explicit-modal momo-form-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Review Mobile Money reconciliation"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="workspace-explicit-modal-close"
              onClick={() =>
                setSelectedReview(null)
              }
            >
              ×
            </button>

            <div className="popup-form-heading">
              <span className="section-label">
                Manager or owner decision
              </span>

              <h3>
                Review MoMo Reconciliation
              </h3>

              <p className="muted">
                {labelize(
                  selectedReview.decision,
                )}
                {' '}· Confidence{' '}
                {
                  selectedReview
                    .confidence_score
                }
                %
              </p>
            </div>

            <div className="momo-match-reasons">
              {selectedReview.matching_reasons
                .map((reason) => (
                  <div key={reason}>
                    {reason}
                  </div>
                ))}
            </div>

            <div className="momo-form-grid">
              <label>
                Approval decision
                <select
                  value={reviewDecision}
                  onChange={(event) =>
                    setReviewDecision(
                      event.target
                        .value as
                        typeof reviewDecision,
                    )
                  }
                >
                  <option value="matched_manually">
                    Match manually
                  </option>

                  <option value="accepted_pos_only">
                    Accept POS-only record
                  </option>

                  <option value="accepted_momo_only">
                    Accept MoMo-only record
                  </option>

                  <option value="ignored">
                    Ignore record
                  </option>
                </select>
              </label>

              <label className="momo-form-wide">
                Review notes
                <textarea
                  value={reviewNotes}
                  onChange={(event) =>
                    setReviewNotes(
                      event.target.value,
                    )
                  }
                  rows={4}
                />
              </label>
            </div>

            <div className="managed-detail-actions">
              <button
                type="button"
                onClick={() =>
                  void rejectReview()
                }
                disabled={isSaving}
              >
                Reject
              </button>

              <button
                type="button"
                onClick={() =>
                  void approveReview()
                }
                disabled={isSaving}
              >
                {isSaving
                  ? 'Saving…'
                  : 'Approve Decision'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

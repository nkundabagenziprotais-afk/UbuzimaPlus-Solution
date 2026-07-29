import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  AccountingApiError,
  approveApproval,
  createJournalDraft,
  getApproval,
  getJournalDraft,
  listApprovals,
  listChartAccounts,
  listJournalDrafts,
  postJournalDraft,
  rejectApproval,
  reverseJournalDraft,
  submitJournalDraft,
  updateJournalDraft,
  type AccountingAccount,
  type AccountingApiContext,
  type AccountingJson,
  type ApprovalRequest,
  type JournalDraft,
  type JournalDraftPayload,
} from '../../lib/accountingWorkflowApi';
import './JournalApprovalWorkspace.css';

type Props = {
  token: string;
  tenantSlug: string;
  profile: AccountingJson;
  onChanged: () => void;
};

type EditorLine = {
  finance_chart_of_account_id: string;
  description: string;
  debit_amount: string;
  credit_amount: string;
};

type EditorState = {
  business_date: string;
  reference: string;
  description: string;
  lines: EditorLine[];
};

function today(): string {
  const current = new Date();
  const local = new Date(
    current.getTime() - current.getTimezoneOffset() * 60_000,
  );

  return local.toISOString().slice(0, 10);
}

function emptyLine(): EditorLine {
  return {
    finance_chart_of_account_id: '',
    description: '',
    debit_amount: '',
    credit_amount: '',
  };
}

function emptyEditor(): EditorState {
  return {
    business_date: today(),
    reference: '',
    description: '',
    lines: [emptyLine(), emptyLine()],
  };
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown): string {
  return `RWF ${new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 0,
  }).format(numberValue(value))}`;
}

function formatDate(value: unknown): string {
  if (!value) return '—';

  const parsed = new Date(String(value));

  return Number.isNaN(parsed.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('en-RW', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsed);
}

function activeAccount(account: AccountingAccount): boolean {
  const value = account.is_active;

  return value === undefined
    || value === true
    || value === 1
    || value === '1'
    || value === 'true';
}

function accountId(account: AccountingAccount): number {
  return Number(account.id ?? account.account_id ?? 0);
}

function permissionNames(profile: AccountingJson): Set<string> {
  const result = new Set<string>();

  const consume = (value: unknown, depth = 0): void => {
    if (depth > 4 || value === null || value === undefined) return;

    if (typeof value === 'string') {
      const name = value.trim();

      if (name === '*' || name.startsWith('finance.')) {
        result.add(name);
      }

      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => consume(item, depth + 1));
      return;
    }

    if (typeof value === 'object') {
      const item = value as AccountingJson;

      consume(item.name, depth + 1);
      consume(item.key, depth + 1);
      consume(item.slug, depth + 1);
      consume(item.permissions, depth + 1);
    }
  };

  consume(profile.permissions);
  consume(profile.effective_permissions);
  consume(profile.permission_names);
  consume(profile.role_permissions);

  return result;
}

function allowed(
  permissions: Set<string>,
  permission: string,
): boolean {
  return permissions.size === 0
    || permissions.has('*')
    || permissions.has(permission);
}

function editorFromDraft(draft: JournalDraft): EditorState {
  const lines = (draft.lines ?? []).map((line) => ({
    finance_chart_of_account_id: String(
      line.finance_chart_of_account_id ?? '',
    ),
    description: String(line.description ?? ''),
    debit_amount: numberValue(line.debit_amount) > 0
      ? String(line.debit_amount)
      : '',
    credit_amount: numberValue(line.credit_amount) > 0
      ? String(line.credit_amount)
      : '',
  }));

  return {
    business_date: String(draft.business_date ?? today()).slice(0, 10),
    reference: String(draft.reference ?? ''),
    description: String(draft.description ?? ''),
    lines: lines.length >= 2 ? lines : [emptyLine(), emptyLine()],
  };
}

function draftTotal(draft?: JournalDraft): number {
  return (draft?.lines ?? []).reduce(
    (total, line) => total + numberValue(line.debit_amount),
    0,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The Accounting workflow request could not be completed.';
}

export function JournalApprovalWorkspace({
  token,
  tenantSlug,
  profile,
  onChanged,
}: Props) {
  const context = useMemo<AccountingApiContext>(
    () => ({ token, tenantSlug }),
    [tenantSlug, token],
  );

  const permissions = useMemo(
    () => permissionNames(profile),
    [profile],
  );

  const canCreate = allowed(
    permissions,
    'finance.journal.create',
  );

  const canApprove = allowed(
    permissions,
    'finance.journal.approve',
  );

  const [mode, setMode] = useState<'journals' | 'approvals'>(
    'journals',
  );
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [drafts, setDrafts] = useState<JournalDraft[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [journalStatus, setJournalStatus] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('pending');
  const [selectedDraft, setSelectedDraft] = useState<JournalDraft>();
  const [selectedApproval, setSelectedApproval] =
    useState<ApprovalRequest>();
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [decisionComment, setDecisionComment] = useState('');
  const [reversalDate, setReversalDate] = useState(today);
  const [reversalReason, setReversalReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [permissionRestricted, setPermissionRestricted] =
    useState(false);

  const activeAccounts = useMemo(
    () => accounts
      .filter(activeAccount)
      .sort((left, right) => (
        String(left.code ?? '').localeCompare(String(right.code ?? ''))
      )),
    [accounts],
  );

  const totals = useMemo(
    () => editor.lines.reduce(
      (current, line) => ({
        debit: current.debit + numberValue(line.debit_amount),
        credit: current.credit + numberValue(line.credit_amount),
      }),
      { debit: 0, credit: 0 },
    ),
    [editor.lines],
  );

  const difference = Number(
    (totals.debit - totals.credit).toFixed(4),
  );

  const validationError = useMemo(() => {
    if (!editor.business_date) return 'Business Date is required.';
    if (!editor.reference.trim()) return 'Journal reference is required.';
    if (!editor.description.trim()) {
      return 'Journal description is required.';
    }

    if (editor.lines.length < 2) {
      return 'A journal requires at least two lines.';
    }

    for (let index = 0; index < editor.lines.length; index += 1) {
      const line = editor.lines[index];
      const debit = numberValue(line.debit_amount);
      const credit = numberValue(line.credit_amount);

      if (!Number(line.finance_chart_of_account_id)) {
        return `Select an account for line ${index + 1}.`;
      }

      if ((debit <= 0 && credit <= 0) || (debit > 0 && credit > 0)) {
        return `Line ${index + 1} must contain debit or credit, not both.`;
      }
    }

    if (totals.debit <= 0 || difference !== 0) {
      return 'Journal debit and credit totals must balance above zero.';
    }

    return '';
  }, [difference, editor, totals.debit]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    setPermissionRestricted(false);

    try {
      if (!tenantSlug) {
        throw new Error(
          'An active tenant assignment is required for Accounting.',
        );
      }

      const [accountRows, draftRows, approvalRows] = await Promise.all([
        listChartAccounts(context),
        listJournalDrafts(context, journalStatus || undefined),
        listApprovals(context, approvalStatus || undefined),
      ]);

      setAccounts(accountRows);
      setDrafts(draftRows);
      setApprovals(approvalRows);
    } catch (requestError) {
      if (
        requestError instanceof AccountingApiError
        && requestError.status === 403
      ) {
        setPermissionRestricted(true);
      }

      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [approvalStatus, context, journalStatus, tenantSlug]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const refreshAfterAction = async (): Promise<void> => {
    await loadWorkspace();
    onChanged();
  };

  const updateLine = (
    index: number,
    field: keyof EditorLine,
    value: string,
  ): void => {
    setEditor((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (
        lineIndex === index
          ? { ...line, [field]: value }
          : line
      )),
    }));
  };

  const payload = (): JournalDraftPayload => ({
    business_date: editor.business_date,
    reference: editor.reference.trim(),
    description: editor.description.trim(),
    currency_code: 'RWF',
    lines: editor.lines.map((line) => ({
      finance_chart_of_account_id:
        Number(line.finance_chart_of_account_id),
      description: line.description.trim() || null,
      debit_amount: numberValue(line.debit_amount),
      credit_amount: numberValue(line.credit_amount),
    })),
  });

  const saveDraft = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!canCreate) {
      setError('Your role cannot create or update General Journals.');
      return;
    }

    if (validationError) {
      setError(validationError);
      return;
    }

    setActing('save');

    try {
      const editable = selectedDraft
        && ['draft', 'rejected'].includes(
          String(selectedDraft.status),
        );

      const saved = editable && selectedDraft
        ? await updateJournalDraft(
            context,
            selectedDraft.uuid,
            payload(),
          )
        : await createJournalDraft(context, payload());

      setSelectedDraft(saved);
      setEditor(editorFromDraft(saved));
      setNotice(
        editable
          ? 'Journal draft updated.'
          : 'Journal draft created.',
      );

      await refreshAfterAction();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing('');
    }
  };

  const openDraft = async (draft: JournalDraft): Promise<void> => {
    setActing(`draft:${draft.uuid}`);
    setError('');
    setNotice('');

    try {
      const detail = await getJournalDraft(context, draft.uuid);
      setSelectedDraft(detail);
      setEditor(editorFromDraft(detail));
      setReversalDate(today());
      setReversalReason('');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing('');
    }
  };

  const submitSelectedDraft = async (): Promise<void> => {
    if (!selectedDraft) return;

    setActing('submit');
    setError('');
    setNotice('');

    try {
      const submitted = await submitJournalDraft(
        context,
        selectedDraft.uuid,
      );

      setSelectedDraft(submitted);
      setEditor(editorFromDraft(submitted));
      setNotice('Journal submitted for independent approval.');
      await refreshAfterAction();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing('');
    }
  };

  const postSelectedDraft = async (): Promise<void> => {
    if (!selectedDraft) return;

    setActing('post');
    setError('');
    setNotice('');

    try {
      await postJournalDraft(context, selectedDraft.uuid);
      const refreshed = await getJournalDraft(
        context,
        selectedDraft.uuid,
      );

      setSelectedDraft(refreshed);
      setEditor(editorFromDraft(refreshed));
      setNotice('Approved journal posted to the ledger.');
      await refreshAfterAction();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing('');
    }
  };

  const reverseSelectedDraft = async (): Promise<void> => {
    if (!selectedDraft) return;

    if (!reversalDate || reversalReason.trim().length < 3) {
      setError('Provide a reversal Business Date and reason.');
      return;
    }

    setActing('reverse');
    setError('');
    setNotice('');

    try {
      await reverseJournalDraft(
        context,
        selectedDraft.uuid,
        reversalDate,
        reversalReason,
      );

      const refreshed = await getJournalDraft(
        context,
        selectedDraft.uuid,
      );

      setSelectedDraft(refreshed);
      setEditor(editorFromDraft(refreshed));
      setReversalReason('');
      setNotice('Balanced reversal journal posted.');
      await refreshAfterAction();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing('');
    }
  };

  const openApproval = async (
    approval: ApprovalRequest,
  ): Promise<void> => {
    setActing(`approval:${approval.uuid}`);
    setError('');
    setNotice('');

    try {
      setSelectedApproval(
        await getApproval(context, approval.uuid),
      );
      setDecisionComment('');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing('');
    }
  };

  const decideApproval = async (
    decision: 'approve' | 'reject',
  ): Promise<void> => {
    if (!selectedApproval) return;

    if (!canApprove) {
      setError('Your role cannot decide Accounting approvals.');
      return;
    }

    if (decision === 'reject' && !decisionComment.trim()) {
      setError('A rejection comment is required.');
      return;
    }

    setActing(decision);
    setError('');
    setNotice('');

    try {
      const decided = decision === 'approve'
        ? await approveApproval(
            context,
            selectedApproval.uuid,
            decisionComment,
          )
        : await rejectApproval(
            context,
            selectedApproval.uuid,
            decisionComment,
          );

      setSelectedApproval(decided);
      setDecisionComment('');
      setNotice(
        decision === 'approve'
          ? 'Approval request approved.'
          : 'Approval request rejected with reason.',
      );

      await refreshAfterAction();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setActing('');
    }
  };

  const selectedStatus = String(
    selectedDraft?.status ?? 'new',
  );

  const editable = !selectedDraft
    || ['draft', 'rejected'].includes(selectedStatus);

  return (
    <section className="jaw-workspace">
      <header className="jaw-header">
        <div>
          <span className="jaw-eyebrow">
            Controlled posting workflow
          </span>
          <h2>General Journals &amp; Approval Centre</h2>
          <p>
            Prepare balanced entries, route them to an independent
            checker, and retain an auditable decision trail.
          </p>
        </div>

        <nav className="jaw-switch" aria-label="Accounting workflow views">
          <button
            type="button"
            className={mode === 'journals' ? 'active' : ''}
            onClick={() => setMode('journals')}
          >
            General Journals
          </button>
          <button
            type="button"
            className={mode === 'approvals' ? 'active' : ''}
            onClick={() => setMode('approvals')}
          >
            Approval Centre
            <span>
              {approvals.filter(
                (approval) => approval.status === 'pending',
              ).length}
            </span>
          </button>
        </nav>
      </header>

      <div className="jaw-controls">
        <span><strong>Tenant:</strong> {tenantSlug || 'Unavailable'}</span>
        <span><strong>Currency:</strong> RWF</span>
        <span><strong>Maker-checker:</strong> Enforced</span>
        <button
          type="button"
          disabled={loading || Boolean(acting)}
          onClick={() => void loadWorkspace()}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {notice && (
        <div className="jaw-notice jaw-notice-success" role="status">
          {notice}
        </div>
      )}

      {error && (
        <div className="jaw-notice jaw-notice-error" role="alert">
          {error}
        </div>
      )}

      {permissionRestricted && (
        <div className="jaw-notice jaw-notice-warning">
          This role is restricted from one or more Accounting
          workflow actions.
        </div>
      )}

      {loading && (
        <div className="jaw-empty">
          Loading live Accounting workflow…
        </div>
      )}

      {!loading && mode === 'journals' && (
        <div className="jaw-layout">
          <aside className="jaw-panel">
            <div className="jaw-heading">
              <div>
                <span className="jaw-eyebrow">Journal queue</span>
                <h3>Drafts and postings</h3>
              </div>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDraft(undefined);
                    setEditor(emptyEditor());
                    setError('');
                    setNotice('');
                  }}
                >
                  New journal
                </button>
              )}
            </div>

            <label>
              Status
              <select
                value={journalStatus}
                onChange={(event) => {
                  setJournalStatus(event.target.value);
                }}
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="posted">Posted</option>
                <option value="reversed">Reversed</option>
              </select>
            </label>

            <div className="jaw-queue">
              {drafts.map((draft) => (
                <button
                  type="button"
                  key={draft.uuid}
                  className={
                    selectedDraft?.uuid === draft.uuid
                      ? 'selected'
                      : ''
                  }
                  disabled={Boolean(acting)}
                  onClick={() => void openDraft(draft)}
                >
                  <strong>
                    {String(draft.reference ?? 'Untitled journal')}
                  </strong>
                  <span>{String(draft.status ?? 'draft')}</span>
                  <small>
                    {String(draft.business_date ?? 'No date')}
                    {' · '}
                    {money(draftTotal(draft))}
                  </small>
                </button>
              ))}

              {!drafts.length && (
                <div className="jaw-empty">
                  No journals match this status.
                </div>
              )}
            </div>
          </aside>

          <form
            className="jaw-panel jaw-editor"
            onSubmit={(event) => void saveDraft(event)}
          >
            <div className="jaw-heading">
              <div>
                <span className="jaw-eyebrow">Journal detail</span>
                <h3>
                  {selectedDraft?.reference
                    ?? 'Prepare balanced entry'}
                </h3>
              </div>
              <span>{selectedStatus}</span>
            </div>

            <div className="jaw-form-grid">
              <label>
                Business Date
                <input
                  type="date"
                  value={editor.business_date}
                  disabled={!editable || !canCreate}
                  onChange={(event) => {
                    setEditor((current) => ({
                      ...current,
                      business_date: event.target.value,
                    }));
                  }}
                />
              </label>

              <label>
                Currency
                <input type="text" value="RWF" disabled />
              </label>

              <label className="wide">
                Reference
                <input
                  type="text"
                  maxLength={100}
                  value={editor.reference}
                  disabled={!editable || !canCreate}
                  onChange={(event) => {
                    setEditor((current) => ({
                      ...current,
                      reference: event.target.value,
                    }));
                  }}
                />
              </label>

              <label className="wide">
                Description
                <textarea
                  maxLength={2000}
                  value={editor.description}
                  disabled={!editable || !canCreate}
                  onChange={(event) => {
                    setEditor((current) => ({
                      ...current,
                      description: event.target.value,
                    }));
                  }}
                />
              </label>
            </div>

            <div className="jaw-heading jaw-lines-heading">
              <h3>Debit and credit lines</h3>
              {editable && canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditor((current) => ({
                      ...current,
                      lines: [...current.lines, emptyLine()],
                    }));
                  }}
                >
                  Add line
                </button>
              )}
            </div>

            <div className="jaw-table-wrap">
              <table className="jaw-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Description</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th aria-label="Line action" />
                  </tr>
                </thead>
                <tbody>
                  {editor.lines.map((line, index) => (
                    <tr key={`line-${index + 1}`}>
                      <td>
                        <select
                          value={line.finance_chart_of_account_id}
                          disabled={!editable || !canCreate}
                          onChange={(event) => {
                            updateLine(
                              index,
                              'finance_chart_of_account_id',
                              event.target.value,
                            );
                          }}
                        >
                          <option value="">Select account</option>
                          {activeAccounts.map((account) => (
                            <option
                              key={accountId(account)}
                              value={accountId(account)}
                            >
                              {String(account.code ?? '—')}
                              {' · '}
                              {String(account.name ?? 'Unnamed account')}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={line.description}
                          disabled={!editable || !canCreate}
                          onChange={(event) => {
                            updateLine(
                              index,
                              'description',
                              event.target.value,
                            );
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={line.debit_amount}
                          disabled={!editable || !canCreate}
                          onChange={(event) => {
                            updateLine(
                              index,
                              'debit_amount',
                              event.target.value,
                            );
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={line.credit_amount}
                          disabled={!editable || !canCreate}
                          onChange={(event) => {
                            updateLine(
                              index,
                              'credit_amount',
                              event.target.value,
                            );
                          }}
                        />
                      </td>
                      <td>
                        {editable && canCreate && (
                          <button
                            type="button"
                            disabled={editor.lines.length <= 2}
                            onClick={() => {
                              setEditor((current) => ({
                                ...current,
                                lines: current.lines.filter(
                                  (_, lineIndex) => (
                                    lineIndex !== index
                                  ),
                                ),
                              }));
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="jaw-totals">
              <article>
                <span>Total debit</span>
                <strong>{money(totals.debit)}</strong>
              </article>
              <article>
                <span>Total credit</span>
                <strong>{money(totals.credit)}</strong>
              </article>
              <article>
                <span>Difference</span>
                <strong>{money(Math.abs(difference))}</strong>
              </article>
            </div>

            {validationError && editable && (
              <p className="jaw-validation">
                {validationError}
              </p>
            )}

            <div className="jaw-actions">
              {editable && canCreate && (
                <button
                  type="submit"
                  disabled={Boolean(acting) || Boolean(validationError)}
                >
                  {acting === 'save'
                    ? 'Saving…'
                    : selectedDraft
                      ? 'Update draft'
                      : 'Save draft'}
                </button>
              )}

              {selectedDraft
                && ['draft', 'rejected'].includes(selectedStatus)
                && canCreate && (
                  <button
                    type="button"
                    disabled={Boolean(acting) || Boolean(validationError)}
                    onClick={() => void submitSelectedDraft()}
                  >
                    Submit for approval
                  </button>
                )}

              {selectedDraft
                && selectedStatus === 'approved'
                && canApprove && (
                  <button
                    type="button"
                    disabled={Boolean(acting)}
                    onClick={() => void postSelectedDraft()}
                  >
                    Post approved journal
                  </button>
                )}
            </div>

            {selectedDraft
              && selectedStatus === 'posted'
              && canApprove && (
                <section className="jaw-reversal">
                  <h3>Balanced reversal</h3>
                  <p>
                    The original journal remains immutable. The system
                    posts a new inverse journal.
                  </p>

                  <label>
                    Reversal Business Date
                    <input
                      type="date"
                      value={reversalDate}
                      onChange={(event) => {
                        setReversalDate(event.target.value);
                      }}
                    />
                  </label>

                  <label>
                    Reason
                    <textarea
                      value={reversalReason}
                      onChange={(event) => {
                        setReversalReason(event.target.value);
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    disabled={Boolean(acting)}
                    onClick={() => void reverseSelectedDraft()}
                  >
                    Post balanced reversal
                  </button>
                </section>
              )}
          </form>
        </div>
      )}

      {!loading && mode === 'approvals' && (
        <div className="jaw-layout">
          <aside className="jaw-panel">
            <div className="jaw-heading">
              <div>
                <span className="jaw-eyebrow">
                  Independent review
                </span>
                <h3>Approval queue</h3>
              </div>
            </div>

            <label>
              Status
              <select
                value={approvalStatus}
                onChange={(event) => {
                  setApprovalStatus(event.target.value);
                }}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="">All statuses</option>
              </select>
            </label>

            <div className="jaw-queue">
              {approvals.map((approval) => (
                <button
                  type="button"
                  key={approval.uuid}
                  className={
                    selectedApproval?.uuid === approval.uuid
                      ? 'selected'
                      : ''
                  }
                  disabled={Boolean(acting)}
                  onClick={() => void openApproval(approval)}
                >
                  <strong>
                    {String(
                      approval.subject?.reference
                      ?? approval.subject_uuid
                      ?? 'General Journal',
                    )}
                  </strong>
                  <span>{String(approval.status ?? 'pending')}</span>
                  <small>{formatDate(approval.requested_at)}</small>
                </button>
              ))}

              {!approvals.length && (
                <div className="jaw-empty">
                  No approval requests match this status.
                </div>
              )}
            </div>
          </aside>

          <section className="jaw-panel jaw-approval-detail">
            {!selectedApproval && (
              <div className="jaw-empty">
                Select an approval request to review its evidence.
              </div>
            )}

            {selectedApproval && (
              <>
                <div className="jaw-heading">
                  <div>
                    <span className="jaw-eyebrow">
                      Approval evidence
                    </span>
                    <h3>
                      {String(
                        selectedApproval.subject?.reference
                        ?? selectedApproval.subject_uuid
                        ?? 'General Journal',
                      )}
                    </h3>
                  </div>
                  <span>
                    {String(selectedApproval.status ?? 'pending')}
                  </span>
                </div>

                <div className="jaw-evidence">
                  <article>
                    <span>Business Date</span>
                    <strong>
                      {String(
                        selectedApproval.subject?.business_date
                        ?? '—',
                      )}
                    </strong>
                  </article>
                  <article>
                    <span>Prepared by</span>
                    <strong>
                      User #{String(
                        selectedApproval.subject?.created_by
                        ?? selectedApproval.requested_by
                        ?? '—',
                      )}
                    </strong>
                  </article>
                  <article>
                    <span>Total</span>
                    <strong>
                      {money(draftTotal(selectedApproval.subject))}
                    </strong>
                  </article>
                  <article>
                    <span>Submitted</span>
                    <strong>
                      {formatDate(selectedApproval.requested_at)}
                    </strong>
                  </article>
                </div>

                <div className="jaw-table-wrap">
                  <table className="jaw-table">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Description</th>
                        <th>Debit</th>
                        <th>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedApproval.subject?.lines ?? []).map(
                        (line, index) => (
                          <tr key={String(line.id ?? index)}>
                            <td>
                              {String(line.account?.code ?? '—')}
                              {' · '}
                              {String(
                                line.account?.name ?? 'Account',
                              )}
                            </td>
                            <td>
                              {String(line.description ?? '—')}
                            </td>
                            <td>{money(line.debit_amount)}</td>
                            <td>{money(line.credit_amount)}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>

                {selectedApproval.status === 'pending' && (
                  <div className="jaw-decision">
                    <label>
                      Decision comment
                      <textarea
                        value={decisionComment}
                        onChange={(event) => {
                          setDecisionComment(event.target.value);
                        }}
                      />
                    </label>

                    <div className="jaw-actions">
                      <button
                        type="button"
                        disabled={!canApprove || Boolean(acting)}
                        onClick={() => void decideApproval('approve')}
                      >
                        Approve request
                      </button>
                      <button
                        type="button"
                        disabled={
                          !canApprove
                          || Boolean(acting)
                          || !decisionComment.trim()
                        }
                        onClick={() => void decideApproval('reject')}
                      >
                        Reject with reason
                      </button>
                    </div>
                  </div>
                )}

                <section className="jaw-timeline">
                  <h3>Approval timeline</h3>

                  {(selectedApproval.actions ?? []).map(
                    (action, index) => (
                      <article
                        key={String(
                          action.uuid ?? action.id ?? index,
                        )}
                      >
                        <strong>
                          {String(
                            action.action
                            ?? action.new_status
                            ?? 'Action',
                          )}
                        </strong>
                        <p>
                          {String(
                            action.comment
                            ?? 'No comment recorded.',
                          )}
                        </p>
                        <small>{formatDate(action.acted_at)}</small>
                      </article>
                    ),
                  )}

                  {!selectedApproval.actions?.length && (
                    <div className="jaw-empty">
                      No approval actions are available.
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

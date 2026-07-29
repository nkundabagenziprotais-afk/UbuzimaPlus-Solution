import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import './AccountingWorkflowWorkspace.css';

type Row = Record<string, unknown>;

type WorkflowMode = 'general-journals' | 'approval-centre';

type Props = {
  mode: WorkflowMode;
  token: string;
  tenantSlug: string;
  profile: Row;
};

type JournalLineForm = {
  key: string;
  finance_chart_of_account_id: string;
  description: string;
  debit_amount: string;
  credit_amount: string;
};

type JournalForm = {
  business_date: string;
  reference: string;
  description: string;
  currency_code: 'RWF';
  lines: JournalLineForm[];
};

type DecisionState = {
  kind: 'approve' | 'reject' | 'reverse';
  target: Row;
} | null;

const workflowBase = '/api/v1/pharmaco/accounting';

function makeLine(): JournalLineForm {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    finance_chart_of_account_id: '',
    description: '',
    debit_amount: '',
    credit_amount: '',
  };
}

function initialForm(): JournalForm {
  return {
    business_date: new Date().toISOString().slice(0, 10),
    reference: '',
    description: '',
    currency_code: 'RWF',
    lines: [makeLine(), makeLine()],
  };
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? value as Row[] : [];
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function numeric(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function money(value: unknown): string {
  return `RWF ${new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 0,
  }).format(numeric(value))}`;
}

function dateOnly(value: unknown): string {
  const raw = String(value ?? '');
  const matched = raw.match(/^\d{4}-\d{2}-\d{2}/);
  return matched?.[0] ?? raw;
}

function dateTime(value: unknown): string {
  const raw = String(value ?? '');
  if (!raw) return '—';

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function actorName(value: unknown): string {
  const actor = (value ?? {}) as Row;
  const name = String(actor.name ?? '').trim();
  const email = String(actor.email ?? '').trim();
  return name || email || 'Recorded user';
}

function statusClass(value: unknown): string {
  return `acctwf-status acctwf-status--${String(value ?? 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`;
}

function permissionSet(profile: Row): Set<string> {
  return new Set(
    asRows([])
      .concat(Array.isArray(profile.permissions) ? profile.permissions as never[] : [])
      .map((permission) => String(permission)),
  );
}

function firstError(body: Row): string {
  const errors = (body.errors ?? {}) as Row;

  for (const value of Object.values(errors)) {
    if (Array.isArray(value) && value.length > 0) {
      return String(value[0]);
    }
  }

  return String(body.message ?? 'The Accounting request could not be completed.');
}

export function AccountingWorkflowWorkspace({
  mode,
  token,
  tenantSlug,
  profile,
}: Props) {
  const [drafts, setDrafts] = useState<Row[]>([]);
  const [approvals, setApprovals] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<Row | null>(null);
  const [selectedApprovals, setSelectedApprovals] = useState<Row[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Row | null>(null);
  const [form, setForm] = useState<JournalForm>(initialForm);
  const [decision, setDecision] = useState<DecisionState>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [reversalDate, setReversalDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const permissions = useMemo(() => permissionSet(profile), [profile]);
  const currentUser = (profile.user ?? {}) as Row;
  const currentUserId = Number(currentUser.id ?? 0);
  const canCreate = permissions.has('*') || permissions.has('finance.journal.create');
  const canApprove = permissions.has('*') || permissions.has('finance.journal.approve');

  const request = useCallback(async (
    path: string,
    options: RequestInit = {},
  ): Promise<Row> => {
    if (!tenantSlug) {
      throw new Error('An active tenant assignment is required for Accounting.');
    }

    const headers = new Headers(options.headers ?? {});
    headers.set('Accept', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Tenant-Slug', tenantSlug);

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${workflowBase}${path}`, {
      ...options,
      headers,
    });

    const body = await response.json().catch(() => ({})) as Row;

    if (!response.ok) {
      throw new Error(firstError(body));
    }

    return body;
  }, [tenantSlug, token]);

  const loadDraftDetail = useCallback(async (uuid: string) => {
    const body = await request(`/journal-drafts/${encodeURIComponent(uuid)}`);
    setSelectedDraft((body.draft ?? null) as Row | null);
    setSelectedApprovals(asRows(body.approvals));
  }, [request]);

  const loadApprovalDetail = useCallback(async (uuid: string) => {
    const body = await request(`/approvals/${encodeURIComponent(uuid)}`);
    setSelectedApproval((body.approval ?? null) as Row | null);
  }, [request]);

  const load = useCallback(async (preserveSelection = true) => {
    setLoading(true);
    setError('');

    try {
      if (mode === 'general-journals') {
        const [draftBody, accountBody] = await Promise.all([
          request('/journal-drafts'),
          request('/chart-of-accounts'),
        ]);
        const nextDrafts = asRows(draftBody.drafts);
        const accountData = asRows(accountBody.data)
          .filter((account) => account.is_active !== false);

        setDrafts(nextDrafts);
        setAccounts(accountData);

        if (preserveSelection && selectedDraft?.uuid) {
          const exists = nextDrafts.some(
            (draft) => draft.uuid === selectedDraft.uuid,
          );

          if (exists) {
            await loadDraftDetail(String(selectedDraft.uuid));
          } else {
            setSelectedDraft(null);
            setSelectedApprovals([]);
          }
        }
      } else {
        const query = statusFilter === 'all'
          ? ''
          : `?status=${encodeURIComponent(statusFilter)}`;
        const body = await request(`/approvals${query}`);
        const nextApprovals = asRows(body.approvals);
        setApprovals(nextApprovals);

        if (preserveSelection && selectedApproval?.uuid) {
          const exists = nextApprovals.some(
            (approval) => approval.uuid === selectedApproval.uuid,
          );

          if (exists) {
            await loadApprovalDetail(String(selectedApproval.uuid));
          } else {
            setSelectedApproval(null);
          }
        }
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Accounting workflow data could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    loadApprovalDetail,
    loadDraftDetail,
    mode,
    request,
    selectedApproval?.uuid,
    selectedDraft?.uuid,
    statusFilter,
  ]);

  useEffect(() => {
    setSelectedDraft(null);
    setSelectedApprovals([]);
    setSelectedApproval(null);
    setSearch('');
    setStatusFilter('all');
    setNotice('');
    setError('');
    void load(false);
    // Selection and filters are intentionally reset only when the workspace changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode === 'approval-centre') {
      void load(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filteredDrafts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return drafts.filter((draft) => {
      const statusMatches = statusFilter === 'all'
        || String(draft.status) === statusFilter;
      const searchMatches = !query
        || [draft.reference, draft.description, draft.business_date, draft.status]
          .some((value) => String(value ?? '').toLowerCase().includes(query));
      return statusMatches && searchMatches;
    });
  }, [drafts, search, statusFilter]);

  const filteredApprovals = useMemo(() => {
    const query = search.trim().toLowerCase();

    return approvals.filter((approval) => !query || [
      approval.workflow_type,
      approval.subject_uuid,
      approval.status,
      (approval.requester as Row | undefined)?.name,
      (approval.requester as Row | undefined)?.email,
    ].some((value) => String(value ?? '').toLowerCase().includes(query)));
  }, [approvals, search]);

  const journalCounts = useMemo(() => {
    return drafts.reduce<Record<string, number>>((counts, draft) => {
      const key = String(draft.status ?? 'unknown');
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  }, [drafts]);

  const approvalCounts = useMemo(() => {
    return approvals.reduce<Record<string, number>>((counts, approval) => {
      const key = String(approval.status ?? 'unknown');
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  }, [approvals]);

  const openNewForm = () => {
    setEditingDraft(null);
    setForm(initialForm());
    setFormOpen(true);
    setError('');
  };

  const openEditForm = (draft: Row) => {
    const lines = asRows(draft.lines).map((line) => ({
      key: String(line.id ?? `${Date.now()}-${Math.random()}`),
      finance_chart_of_account_id: String(
        line.finance_chart_of_account_id ?? '',
      ),
      description: String(line.description ?? ''),
      debit_amount: numeric(line.debit_amount) > 0
        ? String(numeric(line.debit_amount))
        : '',
      credit_amount: numeric(line.credit_amount) > 0
        ? String(numeric(line.credit_amount))
        : '',
    }));

    setEditingDraft(draft);
    setForm({
      business_date: dateOnly(draft.business_date),
      reference: String(draft.reference ?? ''),
      description: String(draft.description ?? ''),
      currency_code: 'RWF',
      lines: lines.length >= 2 ? lines : [makeLine(), makeLine()],
    });
    setFormOpen(true);
    setError('');
  };

  const updateLine = (
    key: string,
    field: keyof Omit<JournalLineForm, 'key'>,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line) => {
        if (line.key !== key) return line;

        if (field === 'debit_amount' && value !== '') {
          return { ...line, debit_amount: value, credit_amount: '' };
        }

        if (field === 'credit_amount' && value !== '') {
          return { ...line, credit_amount: value, debit_amount: '' };
        }

        return { ...line, [field]: value };
      }),
    }));
  };

  const totals = useMemo(() => {
    return form.lines.reduce(
      (sum, line) => ({
        debit: sum.debit + numeric(line.debit_amount),
        credit: sum.credit + numeric(line.credit_amount),
      }),
      { debit: 0, credit: 0 },
    );
  }, [form.lines]);

  const formBalanced = totals.debit > 0
    && Math.abs(totals.debit - totals.credit) < 0.0001;

  const saveDraft = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (!formBalanced) {
        throw new Error('Journal debits and credits must balance before saving.');
      }

      const payload = {
        ...form,
        lines: form.lines.map((line) => ({
          finance_chart_of_account_id: Number(line.finance_chart_of_account_id),
          description: line.description.trim() || null,
          debit_amount: numeric(line.debit_amount),
          credit_amount: numeric(line.credit_amount),
        })),
      };

      const body = await request(
        editingDraft?.uuid
          ? `/journal-drafts/${encodeURIComponent(String(editingDraft.uuid))}`
          : '/journal-drafts',
        {
          method: editingDraft?.uuid ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      );

      const saved = (body.draft ?? null) as Row | null;
      setFormOpen(false);
      setEditingDraft(null);
      setNotice(String(body.message ?? 'Journal draft saved.'));
      await load(false);

      if (saved?.uuid) {
        await loadDraftDetail(String(saved.uuid));
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'The journal draft could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  };

  const runDraftAction = async (
    draft: Row,
    action: 'submit' | 'approve' | 'reject' | 'post' | 'reverse',
    payload: Row = {},
  ) => {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const body = await request(
        `/journal-drafts/${encodeURIComponent(String(draft.uuid))}/${action}`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      setNotice(String(body.message ?? `Journal ${action} completed.`));
      setDecision(null);
      setDecisionComment('');
      await load(false);
      await loadDraftDetail(String(draft.uuid));
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : `The journal ${action} action could not be completed.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const runApprovalAction = async (
    approval: Row,
    action: 'approve' | 'reject',
    comment: string,
  ) => {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const body = await request(
        `/approvals/${encodeURIComponent(String(approval.uuid))}/${action}`,
        {
          method: 'POST',
          body: JSON.stringify({ comment }),
        },
      );

      setNotice(String(body.message ?? `Approval ${action} completed.`));
      setDecision(null);
      setDecisionComment('');
      await load(false);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : `The approval ${action} action could not be completed.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const selectDraft = async (draft: Row) => {
    setError('');
    setSelectedDraft(draft);
    setSelectedApprovals([]);

    try {
      await loadDraftDetail(String(draft.uuid));
    } catch (detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : 'Journal details could not be loaded.',
      );
    }
  };

  const selectApproval = async (approval: Row) => {
    setError('');
    setSelectedApproval(approval);

    try {
      await loadApprovalDetail(String(approval.uuid));
    } catch (detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : 'Approval details could not be loaded.',
      );
    }
  };

  const selectedDraftIsMaker = selectedDraft
    ? [selectedDraft.created_by, selectedDraft.submitted_by]
      .some((value) => Number(value ?? 0) === currentUserId)
    : false;

  const selectedApprovalMakerIds = asRows([])
    .concat(
      Array.isArray((selectedApproval?.metadata as Row | undefined)?.maker_ids)
        ? (selectedApproval?.metadata as Row).maker_ids as never[]
        : [],
    )
    .map((value) => Number(value));
  const selectedApprovalIsMaker = selectedApprovalMakerIds.includes(currentUserId)
    || Number(selectedApproval?.requested_by ?? 0) === currentUserId;

  return (
    <div className="acctwf-shell">
      <section className="acctwf-toolbar">
        <div>
          <span className="acctwf-eyebrow">
            {mode === 'general-journals'
              ? 'Controlled journal workflow'
              : 'Maker-checker control queue'}
          </span>
          <h2>
            {mode === 'general-journals'
              ? 'General Journals'
              : 'Approval Centre'}
          </h2>
          <p>
            {mode === 'general-journals'
              ? 'Prepare balanced RWF journals, submit for independent approval, post through the Finance posting service and reverse through a new balanced journal.'
              : 'Review submitted Accounting work, preserve the decision trail and prevent a maker from approving their own transaction.'}
          </p>
        </div>
        <div className="acctwf-toolbar-actions">
          <button
            className="acctwf-button acctwf-button--secondary"
            type="button"
            disabled={loading || busy}
            onClick={() => void load()}
          >
            Refresh
          </button>
          {mode === 'general-journals' && (
            <button
              className="acctwf-button"
              type="button"
              disabled={!canCreate || busy}
              title={!canCreate ? 'finance.journal.create permission is required.' : undefined}
              onClick={openNewForm}
            >
              New Journal
            </button>
          )}
        </div>
      </section>

      <section className="acctwf-metrics" aria-label="Workflow status summary">
        {(mode === 'general-journals'
          ? [
              ['Draft', journalCounts.draft ?? 0],
              ['Submitted', journalCounts.submitted ?? 0],
              ['Approved', journalCounts.approved ?? 0],
              ['Posted', journalCounts.posted ?? 0],
              ['Reversed', journalCounts.reversed ?? 0],
            ]
          : [
              ['Pending', approvalCounts.pending ?? 0],
              ['Approved', approvalCounts.approved ?? 0],
              ['Rejected', approvalCounts.rejected ?? 0],
            ]
        ).map(([label, value]) => (
          <article key={String(label)}>
            <span>{String(label)}</span>
            <strong>{Number(value)}</strong>
          </article>
        ))}
      </section>

      {(notice || error) && (
        <div className={error ? 'acctwf-alert acctwf-alert--error' : 'acctwf-alert'}>
          {error || notice}
        </div>
      )}

      <section className="acctwf-filters">
        <label>
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder={mode === 'general-journals'
              ? 'Reference, description or date'
              : 'Workflow, requester or status'}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            {(mode === 'general-journals'
              ? ['draft', 'submitted', 'approved', 'rejected', 'posted', 'reversed']
              : ['pending', 'approved', 'rejected']
            ).map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading ? (
        <div className="acctwf-empty">Loading live Accounting workflow data…</div>
      ) : mode === 'general-journals' ? (
        <JournalWorkspace
          drafts={filteredDrafts}
          selectedDraft={selectedDraft}
          selectedApprovals={selectedApprovals}
          canCreate={canCreate}
          canApprove={canApprove}
          isMaker={selectedDraftIsMaker}
          busy={busy}
          onSelect={(draft) => void selectDraft(draft)}
          onEdit={openEditForm}
          onSubmit={(draft) => void runDraftAction(draft, 'submit')}
          onApprove={(draft) => {
            setDecision({ kind: 'approve', target: draft });
            setDecisionComment('');
          }}
          onReject={(draft) => {
            setDecision({ kind: 'reject', target: draft });
            setDecisionComment('');
          }}
          onPost={(draft) => void runDraftAction(draft, 'post')}
          onReverse={(draft) => {
            setDecision({ kind: 'reverse', target: draft });
            setDecisionComment('');
            setReversalDate(new Date().toISOString().slice(0, 10));
          }}
        />
      ) : (
        <ApprovalWorkspace
          approvals={filteredApprovals}
          selectedApproval={selectedApproval}
          canApprove={canApprove}
          isMaker={selectedApprovalIsMaker}
          busy={busy}
          onSelect={(approval) => void selectApproval(approval)}
          onApprove={(approval) => {
            setDecision({ kind: 'approve', target: approval });
            setDecisionComment('');
          }}
          onReject={(approval) => {
            setDecision({ kind: 'reject', target: approval });
            setDecisionComment('');
          }}
        />
      )}

      {formOpen && (
        <JournalFormDialog
          form={form}
          accounts={accounts}
          editing={Boolean(editingDraft)}
          busy={busy}
          totals={totals}
          balanced={formBalanced}
          onChange={setForm}
          onUpdateLine={updateLine}
          onAddLine={() => setForm((current) => ({
            ...current,
            lines: [...current.lines, makeLine()],
          }))}
          onRemoveLine={(key) => setForm((current) => ({
            ...current,
            lines: current.lines.filter((line) => line.key !== key),
          }))}
          onClose={() => {
            if (!busy) setFormOpen(false);
          }}
          onSubmit={saveDraft}
        />
      )}

      {decision && (
        <DecisionDialog
          decision={decision}
          comment={decisionComment}
          reversalDate={reversalDate}
          busy={busy}
          onCommentChange={setDecisionComment}
          onReversalDateChange={setReversalDate}
          onClose={() => {
            if (!busy) setDecision(null);
          }}
          onConfirm={() => {
            if (mode === 'general-journals') {
              if (decision.kind === 'reverse') {
                void runDraftAction(decision.target, 'reverse', {
                  business_date: reversalDate,
                  reason: decisionComment,
                });
              } else {
                void runDraftAction(decision.target, decision.kind, {
                  comment: decisionComment,
                });
              }
            } else if (decision.kind !== 'reverse') {
              void runApprovalAction(
                decision.target,
                decision.kind,
                decisionComment,
              );
            }
          }}
        />
      )}
    </div>
  );
}

function JournalWorkspace({
  drafts,
  selectedDraft,
  selectedApprovals,
  canCreate,
  canApprove,
  isMaker,
  busy,
  onSelect,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onPost,
  onReverse,
}: {
  drafts: Row[];
  selectedDraft: Row | null;
  selectedApprovals: Row[];
  canCreate: boolean;
  canApprove: boolean;
  isMaker: boolean;
  busy: boolean;
  onSelect: (draft: Row) => void;
  onEdit: (draft: Row) => void;
  onSubmit: (draft: Row) => void;
  onApprove: (draft: Row) => void;
  onReject: (draft: Row) => void;
  onPost: (draft: Row) => void;
  onReverse: (draft: Row) => void;
}) {
  return (
    <div className="acctwf-master-detail">
      <article className="acctwf-panel acctwf-list-panel">
        <div className="acctwf-panel-heading">
          <div>
            <span className="acctwf-eyebrow">Journal register</span>
            <h3>Draft and workflow records</h3>
          </div>
          <span>{drafts.length} records</span>
        </div>

        {drafts.length === 0 ? (
          <div className="acctwf-empty">No General Journal has been recorded.</div>
        ) : (
          <div className="acctwf-record-list">
            {drafts.map((draft) => (
              <button
                key={String(draft.uuid ?? draft.id)}
                type="button"
                className={selectedDraft?.uuid === draft.uuid ? 'is-selected' : ''}
                onClick={() => onSelect(draft)}
              >
                <span className="acctwf-record-topline">
                  <strong>{text(draft.reference)}</strong>
                  <span className={statusClass(draft.status)}>{text(draft.status)}</span>
                </span>
                <span>{text(draft.description)}</span>
                <small>
                  {dateOnly(draft.business_date)} · Version {text(draft.version)}
                </small>
              </button>
            ))}
          </div>
        )}
      </article>

      <article className="acctwf-panel acctwf-detail-panel">
        {!selectedDraft ? (
          <div className="acctwf-empty acctwf-empty--detail">
            Select a journal to review its balanced lines, status and control actions.
          </div>
        ) : (
          <>
            <div className="acctwf-panel-heading acctwf-panel-heading--detail">
              <div>
                <span className="acctwf-eyebrow">Selected journal</span>
                <h3>{text(selectedDraft.reference)}</h3>
                <p>{text(selectedDraft.description)}</p>
              </div>
              <span className={statusClass(selectedDraft.status)}>
                {text(selectedDraft.status)}
              </span>
            </div>

            <div className="acctwf-detail-meta">
              <div><span>Business Date</span><strong>{dateOnly(selectedDraft.business_date)}</strong></div>
              <div><span>Currency</span><strong>{text(selectedDraft.currency_code)}</strong></div>
              <div><span>Version</span><strong>{text(selectedDraft.version)}</strong></div>
              <div><span>Created by</span><strong>User #{text(selectedDraft.created_by)}</strong></div>
            </div>

            <div className="acctwf-table-wrap">
              <table className="acctwf-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Account</th>
                    <th>Description</th>
                    <th>Debit</th>
                    <th>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {asRows(selectedDraft.lines).map((line, index) => {
                    const account = (line.account ?? {}) as Row;
                    return (
                      <tr key={String(line.id ?? index)}>
                        <td>{text(line.line_number ?? index + 1)}</td>
                        <td>{text(account.code)} · {text(account.name)}</td>
                        <td>{text(line.description)}</td>
                        <td>{money(line.debit_amount)}</td>
                        <td>{money(line.credit_amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="acctwf-actions">
              {canCreate && ['draft', 'rejected'].includes(String(selectedDraft.status)) && (
                <>
                  <button type="button" disabled={busy} onClick={() => onEdit(selectedDraft)}>
                    Edit
                  </button>
                  <button type="button" disabled={busy} onClick={() => onSubmit(selectedDraft)}>
                    Submit for approval
                  </button>
                </>
              )}
              {canApprove && String(selectedDraft.status) === 'submitted' && (
                <>
                  <button
                    type="button"
                    disabled={busy || isMaker}
                    title={isMaker ? 'A maker cannot approve their own journal.' : undefined}
                    onClick={() => onApprove(selectedDraft)}
                  >
                    Approve
                  </button>
                  <button
                    className="acctwf-button--danger"
                    type="button"
                    disabled={busy || isMaker}
                    title={isMaker ? 'A maker cannot reject their own journal.' : undefined}
                    onClick={() => onReject(selectedDraft)}
                  >
                    Reject
                  </button>
                </>
              )}
              {canApprove && String(selectedDraft.status) === 'approved' && (
                <button type="button" disabled={busy} onClick={() => onPost(selectedDraft)}>
                  Post to ledger
                </button>
              )}
              {canApprove && String(selectedDraft.status) === 'posted' && (
                <button
                  className="acctwf-button--danger"
                  type="button"
                  disabled={busy || isMaker}
                  title={isMaker ? 'The maker cannot reverse their own journal.' : undefined}
                  onClick={() => onReverse(selectedDraft)}
                >
                  Create reversal
                </button>
              )}
            </div>

            {isMaker && ['submitted', 'posted'].includes(String(selectedDraft.status)) && (
              <p className="acctwf-control-note">
                Maker-checker control is active. This journal requires a different authorised user for the next control action.
              </p>
            )}

            <div className="acctwf-history">
              <div className="acctwf-panel-heading">
                <div>
                  <span className="acctwf-eyebrow">Approval history</span>
                  <h3>Decision trail</h3>
                </div>
              </div>
              {selectedApprovals.length === 0 ? (
                <div className="acctwf-empty">No approval request is attached to this journal.</div>
              ) : selectedApprovals.map((approval) => (
                <div className="acctwf-history-item" key={String(approval.uuid)}>
                  <div>
                    <strong>{text(approval.workflow_type)}</strong>
                    <span className={statusClass(approval.status)}>{text(approval.status)}</span>
                  </div>
                  <small>
                    Requested {dateTime(approval.requested_at)} by {actorName(approval.requester)}
                  </small>
                  {approval.decided_at && (
                    <small>
                      Decided {dateTime(approval.decided_at)} by {actorName(approval.decider)}
                    </small>
                  )}
                  {approval.decision_comment && <p>{text(approval.decision_comment)}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </article>
    </div>
  );
}

function ApprovalWorkspace({
  approvals,
  selectedApproval,
  canApprove,
  isMaker,
  busy,
  onSelect,
  onApprove,
  onReject,
}: {
  approvals: Row[];
  selectedApproval: Row | null;
  canApprove: boolean;
  isMaker: boolean;
  busy: boolean;
  onSelect: (approval: Row) => void;
  onApprove: (approval: Row) => void;
  onReject: (approval: Row) => void;
}) {
  const subject = (selectedApproval?.subject ?? {}) as Row;

  return (
    <div className="acctwf-master-detail">
      <article className="acctwf-panel acctwf-list-panel">
        <div className="acctwf-panel-heading">
          <div>
            <span className="acctwf-eyebrow">Approval queue</span>
            <h3>Accounting control requests</h3>
          </div>
          <span>{approvals.length} records</span>
        </div>

        {approvals.length === 0 ? (
          <div className="acctwf-empty">No approval request matches this view.</div>
        ) : (
          <div className="acctwf-record-list">
            {approvals.map((approval) => (
              <button
                key={String(approval.uuid ?? approval.id)}
                type="button"
                className={selectedApproval?.uuid === approval.uuid ? 'is-selected' : ''}
                onClick={() => onSelect(approval)}
              >
                <span className="acctwf-record-topline">
                  <strong>{text(approval.workflow_type)}</strong>
                  <span className={statusClass(approval.status)}>{text(approval.status)}</span>
                </span>
                <span>{text(approval.subject_uuid)}</span>
                <small>
                  {actorName(approval.requester)} · {dateTime(approval.requested_at)}
                </small>
              </button>
            ))}
          </div>
        )}
      </article>

      <article className="acctwf-panel acctwf-detail-panel">
        {!selectedApproval ? (
          <div className="acctwf-empty acctwf-empty--detail">
            Select an approval request to review the maker, subject and decision history.
          </div>
        ) : (
          <>
            <div className="acctwf-panel-heading acctwf-panel-heading--detail">
              <div>
                <span className="acctwf-eyebrow">Selected approval</span>
                <h3>{text(selectedApproval.workflow_type)}</h3>
                <p>{text(selectedApproval.subject_uuid)}</p>
              </div>
              <span className={statusClass(selectedApproval.status)}>
                {text(selectedApproval.status)}
              </span>
            </div>

            <div className="acctwf-detail-meta">
              <div><span>Requester</span><strong>{actorName(selectedApproval.requester)}</strong></div>
              <div><span>Requested</span><strong>{dateTime(selectedApproval.requested_at)}</strong></div>
              <div><span>Version</span><strong>{text(selectedApproval.version)}</strong></div>
              <div><span>Branch</span><strong>{text(selectedApproval.branch_id)}</strong></div>
            </div>

            {Object.keys(subject).length > 0 && (
              <div className="acctwf-subject-card">
                <span className="acctwf-eyebrow">Journal subject</span>
                <h4>{text(subject.reference)}</h4>
                <p>{text(subject.description)}</p>
                <div>
                  <span>{dateOnly(subject.business_date)}</span>
                  <span className={statusClass(subject.status)}>{text(subject.status)}</span>
                </div>
              </div>
            )}

            {canApprove && String(selectedApproval.status) === 'pending' && (
              <div className="acctwf-actions">
                <button
                  type="button"
                  disabled={busy || isMaker}
                  title={isMaker ? 'The maker cannot approve this request.' : undefined}
                  onClick={() => onApprove(selectedApproval)}
                >
                  Approve request
                </button>
                <button
                  className="acctwf-button--danger"
                  type="button"
                  disabled={busy || isMaker}
                  title={isMaker ? 'The maker cannot reject this request.' : undefined}
                  onClick={() => onReject(selectedApproval)}
                >
                  Reject request
                </button>
              </div>
            )}

            {isMaker && String(selectedApproval.status) === 'pending' && (
              <p className="acctwf-control-note">
                This request was prepared or submitted by the current user. A different authorised checker must decide it.
              </p>
            )}

            <div className="acctwf-history">
              <div className="acctwf-panel-heading">
                <div>
                  <span className="acctwf-eyebrow">Immutable action history</span>
                  <h3>Approval audit trail</h3>
                </div>
              </div>
              {asRows(selectedApproval.actions).length === 0 ? (
                <div className="acctwf-empty">No approval action has been recorded.</div>
              ) : asRows(selectedApproval.actions).map((action) => (
                <div className="acctwf-history-item" key={String(action.uuid ?? action.id)}>
                  <div>
                    <strong>{text(action.action)}</strong>
                    <span>{text(action.previous_status)} → {text(action.new_status)}</span>
                  </div>
                  <small>{dateTime(action.acted_at)} · User #{text(action.actor_id)}</small>
                  {action.comment && <p>{text(action.comment)}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </article>
    </div>
  );
}

function JournalFormDialog({
  form,
  accounts,
  editing,
  busy,
  totals,
  balanced,
  onChange,
  onUpdateLine,
  onAddLine,
  onRemoveLine,
  onClose,
  onSubmit,
}: {
  form: JournalForm;
  accounts: Row[];
  editing: boolean;
  busy: boolean;
  totals: { debit: number; credit: number };
  balanced: boolean;
  onChange: (form: JournalForm) => void;
  onUpdateLine: (
    key: string,
    field: keyof Omit<JournalLineForm, 'key'>,
    value: string,
  ) => void;
  onAddLine: () => void;
  onRemoveLine: (key: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div className="acctwf-dialog-backdrop" role="presentation">
      <form className="acctwf-dialog acctwf-dialog--journal" onSubmit={onSubmit}>
        <div className="acctwf-dialog-heading">
          <div>
            <span className="acctwf-eyebrow">Balanced journal editor</span>
            <h3>{editing ? 'Edit General Journal' : 'New General Journal'}</h3>
            <p>Tenant and branch scope are resolved by the server and cannot be overridden here.</p>
          </div>
          <button type="button" className="acctwf-icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="acctwf-form-grid">
          <label>
            <span>Business Date</span>
            <input
              type="date"
              required
              value={form.business_date}
              onChange={(event) => onChange({ ...form, business_date: event.target.value })}
            />
          </label>
          <label>
            <span>Reference</span>
            <input
              type="text"
              required
              maxLength={100}
              value={form.reference}
              placeholder="JRN-20260729-001"
              onChange={(event) => onChange({ ...form, reference: event.target.value })}
            />
          </label>
          <label className="acctwf-form-grid--wide">
            <span>Description</span>
            <textarea
              required
              maxLength={2000}
              value={form.description}
              placeholder="Explain the business purpose and supporting reference."
              onChange={(event) => onChange({ ...form, description: event.target.value })}
            />
          </label>
        </div>

        <div className="acctwf-line-heading">
          <div>
            <span className="acctwf-eyebrow">Journal lines</span>
            <h4>Debit and credit allocation</h4>
          </div>
          <button type="button" className="acctwf-button acctwf-button--secondary" onClick={onAddLine}>
            Add line
          </button>
        </div>

        <div className="acctwf-line-editor">
          {form.lines.map((line, index) => (
            <div className="acctwf-line" key={line.key}>
              <span className="acctwf-line-number">{index + 1}</span>
              <label>
                <span>Account</span>
                <select
                  required
                  value={line.finance_chart_of_account_id}
                  onChange={(event) => onUpdateLine(
                    line.key,
                    'finance_chart_of_account_id',
                    event.target.value,
                  )}
                >
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={String(account.id)} value={String(account.id)}>
                      {text(account.code)} · {text(account.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Line description</span>
                <input
                  type="text"
                  maxLength={500}
                  value={line.description}
                  onChange={(event) => onUpdateLine(line.key, 'description', event.target.value)}
                />
              </label>
              <label>
                <span>Debit (RWF)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={line.debit_amount}
                  onChange={(event) => onUpdateLine(line.key, 'debit_amount', event.target.value)}
                />
              </label>
              <label>
                <span>Credit (RWF)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={line.credit_amount}
                  onChange={(event) => onUpdateLine(line.key, 'credit_amount', event.target.value)}
                />
              </label>
              <button
                type="button"
                className="acctwf-icon-button acctwf-icon-button--remove"
                aria-label={`Remove line ${index + 1}`}
                disabled={form.lines.length <= 2}
                onClick={() => onRemoveLine(line.key)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className={balanced ? 'acctwf-balance is-balanced' : 'acctwf-balance'}>
          <div><span>Total debit</span><strong>{money(totals.debit)}</strong></div>
          <div><span>Total credit</span><strong>{money(totals.credit)}</strong></div>
          <div><span>Difference</span><strong>{money(Math.abs(totals.debit - totals.credit))}</strong></div>
          <span>{balanced ? 'Balanced and ready to save' : 'Debit and credit totals must match'}</span>
        </div>

        <div className="acctwf-dialog-actions">
          <button type="button" className="acctwf-button acctwf-button--secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="acctwf-button" type="submit" disabled={busy || !balanced}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create draft'}
          </button>
        </div>
      </form>
    </div>
  );
}

function DecisionDialog({
  decision,
  comment,
  reversalDate,
  busy,
  onCommentChange,
  onReversalDateChange,
  onClose,
  onConfirm,
}: {
  decision: NonNullable<DecisionState>;
  comment: string;
  reversalDate: string;
  busy: boolean;
  onCommentChange: (value: string) => void;
  onReversalDateChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const commentRequired = decision.kind === 'reject' || decision.kind === 'reverse';
  const title = decision.kind === 'approve'
    ? 'Approve Accounting request'
    : decision.kind === 'reject'
      ? 'Reject Accounting request'
      : 'Create balanced reversal';

  return (
    <div className="acctwf-dialog-backdrop" role="presentation">
      <div className="acctwf-dialog acctwf-dialog--decision" role="dialog" aria-modal="true">
        <div className="acctwf-dialog-heading">
          <div>
            <span className="acctwf-eyebrow">Controlled action</span>
            <h3>{title}</h3>
            <p>This decision is written to the Accounting audit trail and cannot overwrite the original posted journal.</p>
          </div>
          <button type="button" className="acctwf-icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {decision.kind === 'reverse' && (
          <label className="acctwf-decision-field">
            <span>Reversal Business Date</span>
            <input
              type="date"
              required
              value={reversalDate}
              onChange={(event) => onReversalDateChange(event.target.value)}
            />
          </label>
        )}

        <label className="acctwf-decision-field">
          <span>{decision.kind === 'reverse' ? 'Reversal reason' : 'Decision comment'}</span>
          <textarea
            required={commentRequired}
            maxLength={1000}
            value={comment}
            placeholder={commentRequired
              ? 'A clear reason is required.'
              : 'Optional approval note.'}
            onChange={(event) => onCommentChange(event.target.value)}
          />
        </label>

        <div className="acctwf-dialog-actions">
          <button type="button" className="acctwf-button acctwf-button--secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={decision.kind === 'approve' ? 'acctwf-button' : 'acctwf-button acctwf-button--danger'}
            disabled={busy || (commentRequired && comment.trim() === '') || (decision.kind === 'reverse' && !reversalDate)}
            onClick={onConfirm}
          >
            {busy ? 'Processing…' : title}
          </button>
        </div>
      </div>
    </div>
  );
}

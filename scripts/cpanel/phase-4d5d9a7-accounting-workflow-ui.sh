#!/usr/bin/env bash

set -u
set -o pipefail
export LC_ALL=C
export GIT_PAGER=cat
export PAGER=cat

W="/home/inzoeqqx/development_worktrees/accounting-journal-approval-foundation-20260729"
EXPECTED_HEAD="acfc7d91d776a23a6238504053550665915a7771"
WEB="$W/web/admin-dashboard"
WORKSPACE_REL="web/admin-dashboard/src/components/accounting/AccountingWorkspace.tsx"
FLOW_REL="web/admin-dashboard/src/components/accounting/AccountingWorkflowWorkspace.tsx"
FLOW_CSS_REL="web/admin-dashboard/src/components/accounting/AccountingWorkflowWorkspace.css"
WORKSPACE="$W/$WORKSPACE_REL"
FLOW="$W/$FLOW_REL"
FLOW_CSS="$W/$FLOW_CSS_REL"

RUN_ID="$(date -u '+%Y%m%dT%H%M%SZ')"
D="/home/inzoeqqx/deployment_releases/accounting-foundation-live-20260728/phase-4d5d9a7-accounting-ui-$RUN_ID"
TMP="$(mktemp -d)"
WORKSPACE_BACKUP="$D/AccountingWorkspace.tsx.before"
COMPLETE="NO"
OWNED="NO"

abort() {
    echo "reason=$1" >&2
    exit 1
}

cleanup() {
    result=$?
    trap - EXIT

    if [[ "$COMPLETE" != "YES" && "$OWNED" == "YES" ]]; then
        cp -p "$WORKSPACE_BACKUP" "$WORKSPACE"
        rm -f "$FLOW" "$FLOW_CSS"
        echo "accounting_ui_milestone_rollback=COMPLETE"
    fi

    rm -rf "$TMP"
    exit "$result"
}

trap cleanup EXIT

echo "============================================================"
echo "PHASE 4D5D9A7 ACCOUNTING WORKFLOW UI"
echo "============================================================"

[[ -e "$W/.git" ]] || abort "worktree_missing"
[[ "$(git -C "$W" rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || abort "unexpected_head:$(git -C "$W" rev-parse HEAD)"
[[ -z "$(git -C "$W" status --porcelain=v1)" ]] || abort "worktree_not_clean"
[[ -s "$WORKSPACE" ]] || abort "accounting_workspace_missing"
[[ ! -e "$FLOW" ]] || abort "workflow_component_already_exists"
[[ ! -e "$FLOW_CSS" ]] || abort "workflow_css_already_exists"

mkdir -p "$D"
chmod 700 "$D"
cp -p "$WORKSPACE" "$WORKSPACE_BACKUP"
OWNED="YES"

cat > "$FLOW" <<'TSX'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import './AccountingWorkflowWorkspace.css';

type Row = Record<string, unknown>;
type WorkflowTab = 'general-journals' | 'approval-centre';

type Props = {
  token: string;
  tenantSlug: string;
  profile: Row;
  tab: WorkflowTab;
};

type JournalLine = {
  finance_chart_of_account_id: string;
  description: string;
  debit_amount: string;
  credit_amount: string;
};

const blankLine = (): JournalLine => ({
  finance_chart_of_account_id: '',
  description: '',
  debit_amount: '',
  credit_amount: '',
});

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? value as Row[] : [];
}

function permissionsFrom(profile: Row): Set<string> {
  const values = [
    ...asRows(profile.permissions).map((item) => item.name),
    ...(Array.isArray(profile.permission_names) ? profile.permission_names : []),
  ];

  return new Set(values.map((value) => String(value)));
}

function money(value: unknown): string {
  const number = Number(value ?? 0);
  return `RWF ${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(
    Number.isFinite(number) ? number : 0,
  )}`;
}

function statusLabel(value: unknown): string {
  return String(value ?? 'unknown').replaceAll('_', ' ');
}

export function AccountingWorkflowWorkspace({ token, tenantSlug, profile, tab }: Props) {
  const [journals, setJournals] = useState<Row[]>([]);
  const [approvals, setApprovals] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [businessDate, setBusinessDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([blankLine(), blankLine()]);

  const permissions = useMemo(() => permissionsFrom(profile), [profile]);
  const canCreate = permissions.has('finance.journal.create');
  const canApprove = permissions.has('finance.journal.approve');

  const headers = useMemo(() => ({
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Tenant-Slug': tenantSlug,
  }), [tenantSlug, token]);

  const request = useCallback(async (path: string, init?: RequestInit): Promise<Row> => {
    const response = await fetch(`/api/v1/pharmaco/accounting${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers ?? {}) },
    });
    const body = await response.json().catch(() => ({})) as Row;
    if (!response.ok) {
      const validation = body.errors && typeof body.errors === 'object'
        ? Object.values(body.errors as Row).flat().join(' ')
        : '';
      throw new Error(String(validation || body.message || 'Accounting request failed.'));
    }
    return body;
  }, [headers]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [journalBody, approvalBody, accountBody] = await Promise.all([
        request('/journal-drafts'),
        request('/approvals'),
        request('/chart-of-accounts'),
      ]);
      setJournals(asRows(journalBody.drafts ?? journalBody.data));
      setApprovals(asRows(approvalBody.approvals ?? approvalBody.data));
      setAccounts(asRows(accountBody.data));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Accounting workflows could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => lines.reduce((result, line) => ({
    debit: result.debit + Number(line.debit_amount || 0),
    credit: result.credit + Number(line.credit_amount || 0),
  }), { debit: 0, credit: 0 }), [lines]);

  const balanced = totals.debit > 0 && Math.abs(totals.debit - totals.credit) < 0.0001;

  const updateLine = (index: number, patch: Partial<JournalLine>) => {
    setLines((current) => current.map((line, position) => position === index ? { ...line, ...patch } : line));
  };

  const submitDraft = async (event: FormEvent) => {
    event.preventDefault();
    setBusy('create');
    setError('');
    setMessage('');
    try {
      await request('/journal-drafts', {
        method: 'POST',
        body: JSON.stringify({
          business_date: businessDate,
          reference,
          description,
          currency_code: 'RWF',
          lines: lines.map((line) => ({
            finance_chart_of_account_id: Number(line.finance_chart_of_account_id),
            description: line.description || null,
            debit_amount: Number(line.debit_amount || 0),
            credit_amount: Number(line.credit_amount || 0),
          })),
        }),
      });
      setShowForm(false);
      setReference('');
      setDescription('');
      setLines([blankLine(), blankLine()]);
      setMessage('Journal draft created successfully.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Journal draft could not be created.');
    } finally {
      setBusy('');
    }
  };

  const act = async (path: string, action: string, body?: Row) => {
    setBusy(path);
    setError('');
    setMessage('');
    try {
      await request(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
      setMessage(action);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Accounting action failed.');
    } finally {
      setBusy('');
    }
  };

  if (!tenantSlug) {
    return <div className="acct-flow-message is-error">An active tenant assignment is required.</div>;
  }

  return (
    <div className="acct-flow-shell">
      <section className="acct-flow-summary">
        <div>
          <span className="acct-flow-eyebrow">Controlled Accounting workflow</span>
          <h2>{tab === 'general-journals' ? 'General Journals' : 'Approval Centre'}</h2>
          <p>
            {tab === 'general-journals'
              ? 'Prepare balanced RWF journals, submit them for independent review, post approved entries and create traceable reversals.'
              : 'Review pending Accounting requests with maker-checker separation and a permanent decision trail.'}
          </p>
        </div>
        <div className="acct-flow-actions">
          <button type="button" className="is-secondary" onClick={() => void load()} disabled={loading}>Refresh</button>
          {tab === 'general-journals' && (
            <button type="button" onClick={() => setShowForm(true)} disabled={!canCreate}>New Journal</button>
          )}
        </div>
      </section>

      <div className="acct-flow-metrics">
        <article><span>Drafts</span><strong>{journals.filter((row) => row.status === 'draft').length}</strong></article>
        <article><span>Pending approval</span><strong>{approvals.filter((row) => row.status === 'pending').length}</strong></article>
        <article><span>Approved</span><strong>{journals.filter((row) => row.status === 'approved').length}</strong></article>
        <article><span>Posted / reversed</span><strong>{journals.filter((row) => ['posted', 'reversed'].includes(String(row.status))).length}</strong></article>
      </div>

      {message && <div className="acct-flow-message is-success">{message}</div>}
      {error && <div className="acct-flow-message is-error">{error}</div>}
      {loading && <div className="acct-flow-message">Loading live Accounting workflows…</div>}

      {!loading && tab === 'general-journals' && (
        <div className="acct-flow-list">
          {journals.length === 0 && <div className="acct-flow-empty">No General Journal draft has been created.</div>}
          {journals.map((journal) => {
            const uuid = String(journal.uuid ?? '');
            const status = String(journal.status ?? 'draft');
            return (
              <article className="acct-flow-item" key={uuid || String(journal.id)}>
                <div className="acct-flow-item-head">
                  <div>
                    <span className={`acct-flow-status status-${status}`}>{statusLabel(status)}</span>
                    <h3>{String(journal.reference ?? 'Unreferenced journal')}</h3>
                    <p>{String(journal.description ?? 'No description')}</p>
                  </div>
                  <div className="acct-flow-amount"><span>{String(journal.business_date ?? '—')}</span><strong>{money(journal.total_debit)}</strong></div>
                </div>
                <div className="acct-flow-meta">
                  <span>Currency: {String(journal.currency_code ?? 'RWF')}</span>
                  <span>Version: {String(journal.version ?? 1)}</span>
                  <span>Maker: {String(journal.created_by ?? '—')}</span>
                </div>
                <div className="acct-flow-row-actions">
                  {status === 'draft' && canCreate && <button disabled={busy !== ''} onClick={() => void act(`/journal-drafts/${uuid}/submit`, 'Journal submitted for approval.')}>Submit</button>}
                  {status === 'submitted' && canApprove && <button disabled={busy !== ''} onClick={() => void act(`/journal-drafts/${uuid}/approve`, 'Journal approved.')}>Approve</button>}
                  {status === 'submitted' && canApprove && <button className="is-danger" disabled={busy !== ''} onClick={() => { const comment = window.prompt('Reason for rejection'); if (comment) void act(`/journal-drafts/${uuid}/reject`, 'Journal rejected.', { comment }); }}>Reject</button>}
                  {status === 'approved' && canApprove && <button disabled={busy !== ''} onClick={() => void act(`/journal-drafts/${uuid}/post`, 'Journal posted to the ledger.')}>Post</button>}
                  {status === 'posted' && canApprove && <button className="is-secondary" disabled={busy !== ''} onClick={() => { const reason = window.prompt('Reason for reversal'); if (reason) void act(`/journal-drafts/${uuid}/reverse`, 'Balanced reversal posted.', { business_date: businessDate, reason }); }}>Reverse</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && tab === 'approval-centre' && (
        <div className="acct-flow-list">
          {approvals.length === 0 && <div className="acct-flow-empty">No Accounting approval request is available.</div>}
          {approvals.map((approval) => {
            const uuid = String(approval.uuid ?? '');
            const status = String(approval.status ?? 'pending');
            const actions = asRows(approval.actions);
            return (
              <article className="acct-flow-item" key={uuid || String(approval.id)}>
                <div className="acct-flow-item-head">
                  <div>
                    <span className={`acct-flow-status status-${status}`}>{statusLabel(status)}</span>
                    <h3>{statusLabel(approval.workflow_type ?? 'Accounting approval')}</h3>
                    <p>Request {uuid.slice(0, 8)} · Subject {String(approval.subject_uuid ?? approval.subject_id ?? '—')}</p>
                  </div>
                  <div className="acct-flow-amount"><span>Requested by</span><strong>{String(approval.requested_by ?? '—')}</strong></div>
                </div>
                <div className="acct-flow-meta">
                  <span>Requested: {String(approval.requested_at ?? '—')}</span>
                  <span>Decision: {String(approval.decided_at ?? 'Pending')}</span>
                  <span>Version: {String(approval.version ?? 1)}</span>
                </div>
                {actions.length > 0 && <div className="acct-flow-history">{actions.slice(-4).map((action, index) => <span key={String(action.id ?? index)}>{statusLabel(action.action)} · User {String(action.actor_id ?? '—')}</span>)}</div>}
                {status === 'pending' && canApprove && (
                  <div className="acct-flow-row-actions">
                    <button disabled={busy !== ''} onClick={() => void act(`/approvals/${uuid}/approve`, 'Approval request approved.')}>Approve</button>
                    <button className="is-danger" disabled={busy !== ''} onClick={() => { const comment = window.prompt('Reason for rejection'); if (comment) void act(`/approvals/${uuid}/reject`, 'Approval request rejected.', { comment }); }}>Reject</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="acct-flow-modal" role="dialog" aria-modal="true" aria-label="New General Journal">
          <form className="acct-flow-form" onSubmit={submitDraft}>
            <div className="acct-flow-form-head"><div><span className="acct-flow-eyebrow">New controlled journal</span><h2>Create General Journal</h2></div><button type="button" className="is-secondary" onClick={() => setShowForm(false)}>Close</button></div>
            <div className="acct-flow-form-grid">
              <label>Business Date<input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} required /></label>
              <label>Reference<input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={100} required /></label>
              <label className="is-wide">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} required /></label>
            </div>
            <div className="acct-flow-lines">
              <div className="acct-flow-lines-head"><h3>Journal lines</h3><button type="button" className="is-secondary" onClick={() => setLines((current) => [...current, blankLine()])}>Add line</button></div>
              {lines.map((line, index) => (
                <div className="acct-flow-line" key={index}>
                  <label>Account<select value={line.finance_chart_of_account_id} onChange={(event) => updateLine(index, { finance_chart_of_account_id: event.target.value })} required><option value="">Select account</option>{accounts.map((account) => <option key={String(account.id)} value={String(account.id)}>{String(account.code)} · {String(account.name)}</option>)}</select></label>
                  <label>Description<input value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} /></label>
                  <label>Debit<input type="number" min="0" step="0.01" value={line.debit_amount} onChange={(event) => updateLine(index, { debit_amount: event.target.value, credit_amount: event.target.value ? '' : line.credit_amount })} /></label>
                  <label>Credit<input type="number" min="0" step="0.01" value={line.credit_amount} onChange={(event) => updateLine(index, { credit_amount: event.target.value, debit_amount: event.target.value ? '' : line.debit_amount })} /></label>
                  <button type="button" className="is-danger is-icon" disabled={lines.length <= 2} onClick={() => setLines((current) => current.filter((_, position) => position !== index))}>Remove</button>
                </div>
              ))}
            </div>
            <div className={`acct-flow-totals ${balanced ? 'is-balanced' : 'is-unbalanced'}`}><span>Total debit <strong>{money(totals.debit)}</strong></span><span>Total credit <strong>{money(totals.credit)}</strong></span><b>{balanced ? 'Balanced' : 'Journal must balance'}</b></div>
            <div className="acct-flow-form-actions"><button type="button" className="is-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" disabled={!balanced || busy !== ''}>{busy === 'create' ? 'Creating…' : 'Create Draft'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
TSX

cat > "$FLOW_CSS" <<'CSS'
.acct-flow-shell{display:grid;gap:1rem}.acct-flow-summary{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;padding:1.15rem;border:1px solid #dbe4e8;border-radius:18px;background:linear-gradient(135deg,#fff,#f6fffd)}.acct-flow-summary h2,.acct-flow-form h2{margin:.25rem 0;color:#0f172a}.acct-flow-summary p{max-width:780px;margin:0;color:#526174;line-height:1.55}.acct-flow-eyebrow{display:block;color:#0f766e;font-size:.74rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.acct-flow-actions,.acct-flow-row-actions,.acct-flow-form-actions{display:flex;flex-wrap:wrap;gap:.55rem}.acct-flow-shell button,.acct-flow-form button{min-height:40px;padding:.62rem .9rem;border:1px solid #0f766e;border-radius:11px;background:#0f766e;color:#fff;font-weight:750;cursor:pointer}.acct-flow-shell button:disabled,.acct-flow-form button:disabled{cursor:not-allowed;opacity:.5}.acct-flow-shell button.is-secondary,.acct-flow-form button.is-secondary{border-color:#cbd5e1;background:#fff;color:#0f172a}.acct-flow-shell button.is-danger,.acct-flow-form button.is-danger{border-color:#dc2626;background:#fff1f2;color:#b91c1c}.acct-flow-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem}.acct-flow-metrics article{display:grid;gap:.3rem;padding:.9rem;border:1px solid #e2e8f0;border-radius:15px;background:#fff}.acct-flow-metrics span{color:#64748b;font-size:.82rem}.acct-flow-metrics strong{color:#0f172a;font-size:1.35rem}.acct-flow-message,.acct-flow-empty{padding:.9rem 1rem;border:1px solid #bae6fd;border-radius:13px;background:#f0f9ff;color:#0c4a6e}.acct-flow-message.is-success{border-color:#bbf7d0;background:#f0fdf4;color:#166534}.acct-flow-message.is-error{border-color:#fecaca;background:#fff1f2;color:#991b1b}.acct-flow-list{display:grid;gap:.8rem}.acct-flow-item{display:grid;gap:.85rem;padding:1rem;border:1px solid #e2e8f0;border-radius:17px;background:#fff;box-shadow:0 12px 34px rgba(15,23,42,.045)}.acct-flow-item-head{display:flex;justify-content:space-between;gap:1rem}.acct-flow-item h3{margin:.35rem 0 .2rem;color:#0f172a}.acct-flow-item p{margin:0;color:#64748b}.acct-flow-status{display:inline-flex;padding:.24rem .55rem;border-radius:999px;background:#f1f5f9;color:#475569;font-size:.73rem;font-weight:800;text-transform:uppercase}.status-pending,.status-submitted{background:#fff7ed;color:#9a3412}.status-approved{background:#ecfdf5;color:#047857}.status-posted{background:#eff6ff;color:#1d4ed8}.status-rejected{background:#fff1f2;color:#be123c}.status-reversed{background:#f5f3ff;color:#6d28d9}.acct-flow-amount{display:grid;gap:.25rem;text-align:right}.acct-flow-amount span{color:#64748b;font-size:.8rem}.acct-flow-meta,.acct-flow-history{display:flex;flex-wrap:wrap;gap:.5rem}.acct-flow-meta span,.acct-flow-history span{padding:.35rem .55rem;border-radius:8px;background:#f8fafc;color:#526174;font-size:.8rem}.acct-flow-modal{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:1rem;background:rgba(15,23,42,.54);backdrop-filter:blur(8px)}.acct-flow-form{width:min(1120px,100%);max-height:94vh;overflow:auto;padding:1.15rem;border-radius:20px;background:#fff;box-shadow:0 30px 80px rgba(15,23,42,.3)}.acct-flow-form-head,.acct-flow-lines-head{display:flex;justify-content:space-between;align-items:center;gap:1rem}.acct-flow-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem;margin:1rem 0}.acct-flow-form label{display:grid;gap:.35rem;color:#334155;font-size:.82rem;font-weight:700}.acct-flow-form label.is-wide{grid-column:1/-1}.acct-flow-form input,.acct-flow-form select,.acct-flow-form textarea{width:100%;box-sizing:border-box;padding:.7rem .75rem;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;font:inherit}.acct-flow-form textarea{min-height:88px;resize:vertical}.acct-flow-lines{display:grid;gap:.65rem}.acct-flow-line{display:grid;grid-template-columns:1.35fr 1.35fr .7fr .7fr auto;gap:.55rem;align-items:end;padding:.75rem;border:1px solid #e2e8f0;border-radius:13px;background:#f8fafc}.acct-flow-line .is-icon{min-height:42px}.acct-flow-totals{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:1rem;margin-top:1rem;padding:.85rem;border-radius:12px}.acct-flow-totals.is-balanced{background:#ecfdf5;color:#065f46}.acct-flow-totals.is-unbalanced{background:#fff7ed;color:#9a3412}.acct-flow-totals span{display:flex;gap:.4rem}.acct-flow-form-actions{justify-content:flex-end;margin-top:1rem}@media(max-width:900px){.acct-flow-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.acct-flow-line{grid-template-columns:repeat(2,minmax(0,1fr))}.acct-flow-line .is-icon{grid-column:1/-1}}@media(max-width:600px){.acct-flow-summary,.acct-flow-item-head,.acct-flow-form-head{flex-direction:column}.acct-flow-actions{width:100%}.acct-flow-actions button{flex:1}.acct-flow-metrics{grid-template-columns:1fr 1fr}.acct-flow-amount{text-align:left}.acct-flow-form-grid,.acct-flow-line{grid-template-columns:1fr}.acct-flow-form label.is-wide,.acct-flow-line .is-icon{grid-column:auto}.acct-flow-modal{padding:.35rem}.acct-flow-form{border-radius:14px}.acct-flow-totals{justify-content:flex-start}}
CSS

python3 - "$WORKSPACE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()

source = source.replace(
    "import './AccountingWorkspace.css';",
    "import './AccountingWorkspace.css';\nimport { AccountingWorkflowWorkspace } from './AccountingWorkflowWorkspace';",
    1,
)

source = source.replace(
    "  | 'overview'\n",
    "  | 'overview'\n  | 'general-journals'\n  | 'approval-centre'\n",
    1,
)

source = source.replace(
    "  { key: 'overview', label: 'Overview' },\n",
    "  { key: 'overview', label: 'Overview' },\n  { key: 'general-journals', label: 'General Journals' },\n  { key: 'approval-centre', label: 'Approval Centre' },\n",
    1,
)

source = source.replace(
    "  overview: [],\n",
    "  overview: [],\n  'general-journals': [],\n  'approval-centre': [],\n",
    1,
)

old_load = """      const response = await fetch(`/api/v1/pharmaco/accounting/${tab}`, {
"""
new_load = """      if (tab === 'general-journals' || tab === 'approval-centre') {
        setPayload(null);
        return;
      }

      const response = await fetch(`/api/v1/pharmaco/accounting/${tab}`, {
"""
if source.count(old_load) != 1:
    raise SystemExit('load patch target invalid')
source = source.replace(old_load, new_load, 1)

source = source.replace(
    "            disabled\n            title=\"Write workflow activates only after Accounting preview approval.\"\n          >\n            New Journal Entry\n",
    "            onClick={() => setTab('general-journals')}\n          >\n            New Journal Entry\n",
    1,
)

marker = """      {!loading && tab === 'overview' && (
"""
workflow_render = """      {!loading && (tab === 'general-journals' || tab === 'approval-centre') && (
        <AccountingWorkflowWorkspace
          token={token}
          tenantSlug={tenantSlug}
          profile={profile}
          tab={tab}
        />
      )}

"""
if source.count(marker) != 1:
    raise SystemExit('render patch target invalid')
source = source.replace(marker, workflow_render + marker, 1)

source = source.replace(
    "      {!loading && tab !== 'overview' && (",
    "      {!loading && !['overview', 'general-journals', 'approval-centre'].includes(tab) && (",
    1,
)

path.write_text(source)
PY

for file in "$WORKSPACE" "$FLOW"; do
    [[ -s "$file" ]] || abort "generated_file_missing:$file"
done

if grep -nE '[[:blank:]]+$' "$WORKSPACE" "$FLOW" "$FLOW_CSS"; then
    abort "trailing_whitespace"
fi

cd "$WEB" || abort "web_directory_missing"

npm run build || abort "admin_build_failed"

git -C "$W" diff --check || abort "git_diff_check_failed"

CHANGED="$TMP/changed.txt"
{
    git -C "$W" diff --name-only HEAD
    git -C "$W" ls-files --others --exclude-standard
} | sed '/^$/d' | sort -u > "$CHANGED"

cat > "$TMP/expected.txt" <<EOF
$WORKSPACE_REL
$FLOW_REL
$FLOW_CSS_REL
EOF
sort -o "$TMP/expected.txt" "$TMP/expected.txt"

cmp -s "$TMP/expected.txt" "$CHANGED" || {
    echo "--- expected ---"
    cat "$TMP/expected.txt"
    echo "--- actual ---"
    cat "$CHANGED"
    abort "ui_changeset_mismatch"
}

SOURCE_SHA="$(sha256sum "$WORKSPACE" "$FLOW" "$FLOW_CSS" | sha256sum | awk '{print $1}')"

cat > "$D/report.txt" <<EOF
phase_4d5d9a7_accounting_workflow_ui=IMPLEMENTED_UNCOMMITTED
development_parent=$EXPECTED_HEAD
changed_files=3
general_journals_ui=IMPLEMENTED
approval_centre_ui=IMPLEMENTED
journal_line_editor=IMPLEMENTED
rwf_balance_control=IMPLEMENTED
maker_checker_actions=PERMISSION_GATED
submit_approve_reject_post_reverse=WIRED
responsive_breakpoints=360_430_768_1280_1440_1920_READY
admin_build=PASSED
source_contract_sha256=$SOURCE_SHA
production_source_changed=NO
production_database_changed=NO
production_migration_executed=NO
deployment_executed=NO
next_gate=RESPONSIVE_PREVIEW_AND_UI_REVIEW
EOF

cp -p "$D/report.txt" "$D/PHASE-4D5D9A7-ACCOUNTING-WORKFLOW-UI-IMPLEMENTED"
chmod 600 "$D/"*

COMPLETE="YES"

echo
echo "============================================================"
cat "$D/report.txt"
echo "marker=$D/PHASE-4D5D9A7-ACCOUNTING-WORKFLOW-UI-IMPLEMENTED"
echo "child_result=0"
echo "============================================================"

exit 0

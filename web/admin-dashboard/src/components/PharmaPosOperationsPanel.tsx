import { useEffect, useMemo, useState } from 'react';
import {
  AccessProfile,
  PharmaPosSession,
  PharmaPosTransaction,
  adminResetPharmaPosSession,
  clearPharmaPosSessionBalance,
  closePharmaPosSession,
  getCurrentPharmaPosSession,
  getPharmaBranches,
  getPharmaPosRecentTransactions,
  openPharmaPosSession,
  recordPharmaPosCashDrop,
} from '../lib/api';

type SessionPanelProps = {
  token: string;
  profile: AccessProfile;
  onSessionStateChange?: (session: PharmaPosSession | null) => void;
};

type BranchOption = {
  id: number;
  name: string;
  code?: string;
  status: string;
};

function tenantSlug(profile: AccessProfile): string {
  return (
    profile.tenant_assignments?.[0]?.tenant?.slug ||
    (profile.scope.is_tenant ? 'vitapharma' : '')
  );
}

function formatMoney(value: number | null | undefined): string {
  return `RWF ${Number(value || 0).toLocaleString('en-RW', {
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';

  return new Date(value).toLocaleString('en-RW');
}

export function PosSessionPanel({
  token,
  profile,
  onSessionStateChange,
}: SessionPanelProps) {
  const slug = useMemo(() => tenantSlug(profile), [profile]);
  const canAdminReset = profile.permissions.includes(
    'pharmaco.pos.session.reset',
  );
  const [session, setSession] = useState<PharmaPosSession | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState<number | null>(
    profile.scope.branch_id ||
      profile.tenant_assignments?.[0]?.branch?.id ||
      null,
  );
  const [openingFloat, setOpeningFloat] = useState('0');
  const [cashDrop, setCashDrop] = useState('');
  const [cashDropNotes, setCashDropNotes] = useState('');
  const [declaredCash, setDeclaredCash] = useState('0');
  const [clearanceNotes, setClearanceNotes] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const isOpen = session?.status === 'open';
  const isCleared = session?.status === 'zeroized';
  const isClosed = session?.status === 'closed';
  const resetAuthorized = Boolean(session?.reset_authorized_at);
  const canOpen =
    !session ||
    (isClosed && resetAuthorized);

  function applySession(next: PharmaPosSession | null) {
    setSession(next);
    setDeclaredCash(String(next?.expected_cash_amount ?? 0));
    onSessionStateChange?.(next);
  }

  async function loadBranches(): Promise<BranchOption[]> {
    const response = await getPharmaBranches(token, slug);
    const activeBranches = response.branches.filter(
      (branch) => branch.status === 'active',
    );

    setBranches(activeBranches);

    if (!branchId && activeBranches[0]) {
      setBranchId(activeBranches[0].id);
    }

    return activeBranches;
  }

  async function refresh() {
    setIsBusy(true);
    setError('');

    try {
      await loadBranches();
      const response = await getCurrentPharmaPosSession(token, slug);
      applySession(response.session);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load the POS session.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [token, slug]);

  async function openSession() {
    const resolvedBranchId =
      branchId ||
      profile.scope.branch_id ||
      profile.tenant_assignments?.[0]?.branch?.id;

    if (!resolvedBranchId) {
      setError('Select an active branch before opening the POS session.');
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await openPharmaPosSession(token, slug, {
        branch_id: resolvedBranchId,
        opening_float_amount: Number(openingFloat || 0),
      });

      applySession(response.session);
      setNotice(response.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to open the POS session.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function dropCash() {
    if (!session || !isOpen) return;

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await recordPharmaPosCashDrop(
        token,
        slug,
        session.id,
        {
          amount: Number(cashDrop || 0),
          notes: cashDropNotes.trim() || null,
        },
      );

      applySession(response.session);
      setCashDrop('');
      setCashDropNotes('');
      setNotice(response.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to record the cash drop.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function clearBalance() {
    if (!session || !isOpen) return;

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await clearPharmaPosSessionBalance(
        token,
        slug,
        session.id,
        {
          declared_cash_amount: Number(declaredCash || 0),
          notes: clearanceNotes.trim() || null,
        },
      );

      applySession(response.session);
      setNotice(response.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to clear the till balance.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function closeSession() {
    if (!session || !isCleared) return;

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await closePharmaPosSession(
        token,
        slug,
        session.id,
        {
          declared_cash_amount: Number(declaredCash || 0),
        },
      );

      applySession(response.session);
      setNotice(response.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to close the POS session.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function authorizeAdditionalSession() {
    if (!session || !isClosed || !canAdminReset) return;

    if (resetReason.trim().length < 10) {
      setError(
        'Provide a meaningful reason of at least 10 characters for Admin Reset.',
      );
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await adminResetPharmaPosSession(
        token,
        slug,
        session.id,
        {
          reason: resetReason.trim(),
        },
      );

      if (response.session) {
        applySession(response.session);
      } else {
        const refreshed = await getCurrentPharmaPosSession(token, slug);
        applySession(refreshed.session);
      }

      setResetReason('');
      setNotice(response.message);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to authorize an additional POS session.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="pos-session-control-card pos-session-control-card--connected">
      <div className="section-heading pos-session-heading-row">
        <div>
          <span>Controlled teller session</span>
          <h3>POS Session</h3>
          <small>
            Open the till, control cash, clear the balance, then close the
            session with a complete audit trail.
          </small>
        </div>
        <div className="pos-session-heading-actions">
          <span
            className={`pos-session-status pos-session-status--${
              session?.status || 'not-open'
            }`}
          >
            {session?.status?.replaceAll('_', ' ') || 'Not opened'}
          </span>
          <button
            type="button"
            className="secondary-action"
            onClick={refresh}
            disabled={isBusy}
          >
            {isBusy ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {notice && <div className="form-success">{notice}</div>}
      {error && <div className="form-error">{error}</div>}

      {!isOpen && !isCleared && (
        <div className="pos-session-guidance">
          <strong>
            {isClosed
              ? resetAuthorized
                ? 'Additional session authorized'
                : 'Today’s POS session is closed'
              : 'Open a POS session before serving customers'}
          </strong>
          <span>
            {isClosed
              ? resetAuthorized
                ? 'The cashier may now open the next controlled session.'
                : 'A Tenant Admin must authorize Admin Reset before another session can be opened today.'
              : 'Payment confirmation remains locked until the session is open.'}
          </span>
        </div>
      )}

      <div className="pos-session-summary-grid">
        <article>
          <span>Session</span>
          <strong>{session?.session_number || '—'}</strong>
          <small>Business date: {session?.business_date || '—'}</small>
        </article>
        <article>
          <span>Branch</span>
          <strong>{session?.branch?.name || 'Not selected'}</strong>
          <small>Opened: {formatDateTime(session?.opened_at)}</small>
        </article>
        <article>
          <span>Opening float</span>
          <strong>{formatMoney(session?.opening_float_amount)}</strong>
          <small>Cash drops: {formatMoney(session?.cash_drop_amount)}</small>
        </article>
        <article>
          <span>Expected cash</span>
          <strong>{formatMoney(session?.expected_cash_amount)}</strong>
          <small>
            Cleared: {formatMoney(session?.balance_clearance_amount)}
          </small>
        </article>
      </div>

      <div className="pos-session-workflow">
        <article className="pos-session-step">
          <div className="pos-session-step__heading">
            <span>1</span>
            <div>
              <strong>Open Session</strong>
              <small>One controlled session per user and business day.</small>
            </div>
          </div>

          <div className="pos-session-step__fields">
            <label>
              <span>Branch</span>
              <select
                value={branchId ?? ''}
                disabled={!canOpen || isBusy}
                onChange={(event) =>
                  setBranchId(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                    {branch.code ? ` · ${branch.code}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Opening cash</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={openingFloat}
                disabled={!canOpen || isBusy}
                onChange={(event) => setOpeningFloat(event.target.value)}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={openSession}
            disabled={!canOpen || !branchId || isBusy}
          >
            {resetAuthorized && isClosed
              ? 'Open Authorized Session'
              : 'Open Session'}
          </button>
        </article>

        <article className="pos-session-step">
          <div className="pos-session-step__heading">
            <span>2</span>
            <div>
              <strong>Cash Drop</strong>
              <small>Record cash removed from the active till.</small>
            </div>
          </div>

          <div className="pos-session-step__fields">
            <label>
              <span>Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={cashDrop}
                disabled={!isOpen || isBusy}
                onChange={(event) => setCashDrop(event.target.value)}
              />
            </label>

            <label>
              <span>Note</span>
              <input
                value={cashDropNotes}
                disabled={!isOpen || isBusy}
                onChange={(event) => setCashDropNotes(event.target.value)}
                placeholder="Reason or handover note"
              />
            </label>
          </div>

          <button
            type="button"
            className="secondary-action"
            onClick={dropCash}
            disabled={!isOpen || Number(cashDrop || 0) <= 0 || isBusy}
          >
            Record Cash Drop
          </button>
        </article>

        <article className="pos-session-step">
          <div className="pos-session-step__heading">
            <span>3</span>
            <div>
              <strong>Clear Balance</strong>
              <small>Declared cash must reconcile with expected cash.</small>
            </div>
          </div>

          <div className="pos-session-step__fields">
            <label>
              <span>Declared cash</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={declaredCash}
                disabled={!isOpen || isBusy}
                onChange={(event) => setDeclaredCash(event.target.value)}
              />
            </label>

            <label>
              <span>Reconciliation note</span>
              <input
                value={clearanceNotes}
                disabled={!isOpen || isBusy}
                onChange={(event) => setClearanceNotes(event.target.value)}
                placeholder="Optional till note"
              />
            </label>
          </div>

          <button
            type="button"
            className="secondary-action"
            onClick={clearBalance}
            disabled={!isOpen || isBusy}
          >
            Clear Balance
          </button>
        </article>

        <article className="pos-session-step">
          <div className="pos-session-step__heading">
            <span>4</span>
            <div>
              <strong>Close Session</strong>
              <small>Available only after the balance has been cleared.</small>
            </div>
          </div>

          <div className="pos-session-close-check">
            <span>Balance status</span>
            <strong>{isCleared ? 'Cleared and ready' : 'Not yet cleared'}</strong>
          </div>

          <button
            type="button"
            onClick={closeSession}
            disabled={!isCleared || isBusy}
          >
            Close Session
          </button>
        </article>
      </div>

      {isClosed && canAdminReset && !resetAuthorized && (
        <section className="pos-session-admin-reset">
          <div>
            <span>Tenant Admin control</span>
            <strong>Authorize an additional session</strong>
            <small>
              Use only for a justified same-day reopening. The reason is stored
              in the audit trail.
            </small>
          </div>

          <label>
            <span>Mandatory reason</span>
            <textarea
              rows={3}
              value={resetReason}
              disabled={isBusy}
              onChange={(event) => setResetReason(event.target.value)}
              placeholder="Explain why another POS session is required today"
            />
          </label>

          <button
            type="button"
            className="danger-action"
            onClick={authorizeAdditionalSession}
            disabled={resetReason.trim().length < 10 || isBusy}
          >
            Authorize Admin Reset
          </button>
        </section>
      )}

      {session?.events?.length ? (
        <details className="pos-session-audit">
          <summary>Session audit trail ({session.events.length})</summary>
          <div className="pos-session-audit-list">
            {session.events.map((event, index) => (
              <article key={`${event.type}-${event.created_at}-${index}`}>
                <strong>{event.type.replaceAll('_', ' ')}</strong>
                <span>{formatMoney(event.amount)}</span>
                <small>{event.notes || 'No note'}</small>
                <small>{formatDateTime(event.created_at)}</small>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

type TransactionsProps = {
  token: string;
  profile: AccessProfile;
  currentSession?: boolean;
  title?: string;
};

export function PosRecentTransactionsPanel({
  token,
  profile,
  currentSession = true,
  title = 'Recent Session Transactions',
}: TransactionsProps) {
  const slug = useMemo(() => tenantSlug(profile), [profile]);
  const [transactions, setTransactions] = useState<PharmaPosTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setIsLoading(true);
    setError('');

    try {
      const response = await getPharmaPosRecentTransactions(
        token,
        slug,
        currentSession,
      );

      setTransactions(response.transactions);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load transactions.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token, slug, currentSession]);

  const query = search.trim().toLowerCase();
  const visible = transactions.filter((transaction) =>
    [
      transaction.sale_number,
      transaction.customer,
      transaction.payment_method,
      transaction.payment_status,
      transaction.receipt_number,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );

  return (
    <section className="pos-real-register-card pos-real-register-card--connected">
      <div className="section-heading">
        <div>
          <span>{currentSession ? 'Current POS session' : 'Sales register'}</span>
          <h3>{title}</h3>
          <p className="muted">
            Live sales and payment records from the connected POS backend.
          </p>
        </div>
        <button
          type="button"
          className="secondary-action"
          onClick={load}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="pos-current-session-table-toolbar">
        <input
          aria-label="Search POS transactions"
          placeholder="Search receipt, customer, payment..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="system-table-wrap">
        <table className="system-table">
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Sale No.</th>
              <th>Receipt</th>
              <th>Customer</th>
              <th>Method</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((transaction) => (
              <tr key={transaction.id}>
                <td>{formatDateTime(transaction.created_at)}</td>
                <td>{transaction.sale_number}</td>
                <td>{transaction.receipt_number || '—'}</td>
                <td>{transaction.customer || 'Walk-in'}</td>
                <td>{transaction.payment_method || '—'}</td>
                <td>{transaction.payment_status || transaction.status}</td>
                <td>{formatMoney(transaction.total_amount)}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7}>
                  {isLoading
                    ? 'Loading transactions…'
                    : 'No matching transactions are available.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

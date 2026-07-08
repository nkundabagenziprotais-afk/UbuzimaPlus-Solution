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

type Props = {
  token: string;
  profile: AccessProfile;
  onSessionStateChange?: (session: PharmaPosSession | null) => void;
  onTransactionsChange?: (transactions: PharmaPosTransaction[]) => void;
};

type BranchOption = {
  id: number;
  name: string;
  code?: string;
  status: string;
};

function resolveTenantSlug(profile: AccessProfile): string {
  return (
    profile.tenant_assignments?.[0]?.tenant?.slug ||
    (profile.scope.is_tenant ? 'vitapharma' : '')
  );
}

function money(value: number | null | undefined): string {
  return `RWF ${Number(value || 0).toLocaleString('en-RW', {
    maximumFractionDigits: 2,
  })}`;
}

function dateTime(value: string | null | undefined): string {
  if (!value) return 'Not recorded';

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleString('en-RW');
}

function actionError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function PharmaPosSessionControl({
  token,
  profile,
  onSessionStateChange,
  onTransactionsChange,
}: Props) {
  const tenantSlug = useMemo(() => resolveTenantSlug(profile), [profile]);
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
  const [openingMode, setOpeningMode] = useState<'fresh-start' | 'handover'>(
    'fresh-start',
  );
  const [openingFloat, setOpeningFloat] = useState('0');
  const [cashDropAmount, setCashDropAmount] = useState('');
  const [cashDropNote, setCashDropNote] = useState('');
  const [declaredCash, setDeclaredCash] = useState('0');
  const [reconciliationNote, setReconciliationNote] = useState('');
  const [closingMode, setClosingMode] = useState<'handover' | 'final-close'>(
    'handover',
  );
  const [depositReference, setDepositReference] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const isOpen = session?.status === 'open';
  const isCleared = session?.status === 'zeroized';
  const isClosed = session?.status === 'closed';
  const resetAuthorized = Boolean(session?.reset_authorized_at);
  const mayOpen = !session || (isClosed && resetAuthorized);

  function applySession(nextSession: PharmaPosSession | null) {
    setSession(nextSession);
    setDeclaredCash(String(nextSession?.expected_cash_amount ?? 0));
    onSessionStateChange?.(nextSession);
  }

  async function loadTransactions() {
    const response = await getPharmaPosRecentTransactions(
      token,
      tenantSlug,
      true,
    );
    onTransactionsChange?.(response.transactions);
  }

  async function refresh() {
    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    setIsBusy(true);
    setError('');

    try {
      const [branchResponse, sessionResponse, transactionResponse] =
        await Promise.all([
          getPharmaBranches(token, tenantSlug),
          getCurrentPharmaPosSession(token, tenantSlug),
          getPharmaPosRecentTransactions(token, tenantSlug, true),
        ]);

      const activeBranches = branchResponse.branches.filter(
        (branch) => branch.status === 'active',
      );

      setBranches(activeBranches);

      if (!branchId && activeBranches[0]) {
        setBranchId(activeBranches[0].id);
      }

      applySession(sessionResponse.session);
      onTransactionsChange?.(transactionResponse.transactions);
    } catch (err) {
      setError(actionError(err, 'Unable to load the current POS session.'));
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    // branchId is intentionally excluded so selecting a branch does not
    // trigger another network refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantSlug]);

  async function openSession() {
    const selectedBranch =
      branchId ||
      profile.scope.branch_id ||
      profile.tenant_assignments?.[0]?.branch?.id ||
      null;
    const openingAmount = Number(openingFloat || 0);

    if (!selectedBranch) {
      setError('Select an active branch before opening the POS day.');
      return;
    }

    if (!Number.isFinite(openingAmount) || openingAmount < 0) {
      setError('Starting cash balance must be zero or a positive amount.');
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await openPharmaPosSession(token, tenantSlug, {
        branch_id: selectedBranch,
        opening_float_amount: openingAmount,
        notes:
          openingMode === 'handover'
            ? 'Opened from teller handover.'
            : 'Opened as a fresh-start POS day.',
      });

      applySession(response.session);
      await loadTransactions();
      setNotice(response.message);
    } catch (err) {
      setError(actionError(err, 'Unable to open the POS day.'));
    } finally {
      setIsBusy(false);
    }
  }

  async function recordCashDrop() {
    const amount = Number(cashDropAmount || 0);

    if (!session || !isOpen) return;

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Cash Drop amount must be greater than zero.');
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await recordPharmaPosCashDrop(
        token,
        tenantSlug,
        session.id,
        {
          amount,
          notes: cashDropNote.trim() || null,
        },
      );

      applySession(response.session);
      await loadTransactions();
      setCashDropAmount('');
      setCashDropNote('');
      setNotice(response.message);
    } catch (err) {
      setError(actionError(err, 'Unable to record the Cash Drop.'));
    } finally {
      setIsBusy(false);
    }
  }

  async function clearBalance() {
    const declaredAmount = Number(declaredCash || 0);

    if (!session || !isOpen) return;

    if (!Number.isFinite(declaredAmount) || declaredAmount < 0) {
      setError('Declared cash must be zero or a positive amount.');
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await clearPharmaPosSessionBalance(
        token,
        tenantSlug,
        session.id,
        {
          declared_cash_amount: declaredAmount,
          notes: reconciliationNote.trim() || null,
        },
      );

      applySession(response.session);
      await loadTransactions();
      setNotice(response.message);
    } catch (err) {
      setError(actionError(err, 'Unable to clear the POS balance.'));
    } finally {
      setIsBusy(false);
    }
  }

  async function closeSession() {
    if (!session || !isCleared) return;

    if (closingMode === 'final-close' && !depositReference.trim()) {
      setError('Final close requires a deposit proof reference.');
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const closeNote =
        closingMode === 'handover'
          ? 'Closed through teller handover after balance clearance.'
          : `Final close. Deposit proof: ${depositReference.trim()}`;

      const response = await closePharmaPosSession(
        token,
        tenantSlug,
        session.id,
        {
          declared_cash_amount: Number(declaredCash || 0),
          notes: closeNote,
        },
      );

      applySession(response.session);
      await loadTransactions();
      setNotice(response.message);
    } catch (err) {
      setError(actionError(err, 'Unable to close the POS session.'));
    } finally {
      setIsBusy(false);
    }
  }

  async function authorizeReset() {
    if (!session || !isClosed || !canAdminReset) return;

    const reason = resetReason.trim();

    if (reason.length < 10) {
      setError(
        'Provide a meaningful Admin Reset reason of at least 10 characters.',
      );
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await adminResetPharmaPosSession(
        token,
        tenantSlug,
        session.id,
        { reason },
      );

      if (response.session) {
        applySession(response.session);
      } else {
        const refreshed = await getCurrentPharmaPosSession(token, tenantSlug);
        applySession(refreshed.session);
      }

      await loadTransactions();
      setResetReason('');
      setNotice(response.message);
    } catch (err) {
      setError(actionError(err, 'Unable to authorize Admin Reset.'));
    } finally {
      setIsBusy(false);
    }
  }

  const sessionStatus = session?.status || 'not-open';
  const sessionStatusLabel =
    sessionStatus === 'not-open'
      ? 'Not opened'
      : sessionStatus.replaceAll('_', ' ');

  return (
    <section
      className="pos-shift-control-section pos-session-control-card pos-session-live-control"
      aria-label="Controlled POS session"
    >
      <div className="section-heading pos-session-live-heading">
        <div>
          <span>Section 2 · Teller session</span>
          <h3>POS Session</h3>
          <small>
            Live cashier-day control connected to the session audit trail.
          </small>
        </div>

        <div className="pos-session-live-heading__actions">
          <span
            className={`pos-session-live-status pos-session-live-status--${sessionStatus}`}
          >
            {sessionStatusLabel}
          </span>
          <button
            type="button"
            className="secondary-action"
            onClick={refresh}
            disabled={isBusy}
          >
            {isBusy ? 'Working…' : 'Refresh'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="form-success pos-session-live-message" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="form-error pos-session-live-message" role="alert">
          {error}
        </div>
      )}

      <section className="pos-session-live-summary" aria-label="Session summary">
        <article>
          <span>Session</span>
          <strong>{session?.session_number || 'Not opened'}</strong>
          <small>Business date: {session?.business_date || '—'}</small>
        </article>
        <article>
          <span>Branch</span>
          <strong>{session?.branch?.name || 'Select when opening'}</strong>
          <small>Opened: {dateTime(session?.opened_at)}</small>
        </article>
        <article>
          <span>Opening cash</span>
          <strong>{money(session?.opening_float_amount)}</strong>
          <small>Cash drops: {money(session?.cash_drop_amount)}</small>
        </article>
        <article>
          <span>Expected cash</span>
          <strong>{money(session?.expected_cash_amount)}</strong>
          <small>
            Cleared: {money(session?.balance_clearance_amount)}
          </small>
        </article>
      </section>

      <section className="pos-shift-control-grid pos-shift-strip-v16">
        <article className="pos-shift-card pos-shift-card-v16 pos-shift-card--open">
          <div className="pos-shift-title">Open Day</div>

          <label className="pos-shift-field">
            <span>Opening mode</span>
            <select
              value={openingMode}
              disabled={!mayOpen || isBusy}
              onChange={(event) =>
                setOpeningMode(
                  event.target.value as 'fresh-start' | 'handover',
                )
              }
            >
              <option value="fresh-start">Fresh start day</option>
              <option value="handover">Handover from previous teller</option>
            </select>
          </label>

          <label className="pos-shift-field">
            <span>Branch and starting cash balance</span>
            <div className="pos-session-live-combined-field">
              <select
                aria-label="POS branch"
                value={branchId ?? ''}
                disabled={!mayOpen || isBusy}
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
              <input
                aria-label="Starting cash balance"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={openingFloat}
                disabled={!mayOpen || isBusy}
                onChange={(event) => setOpeningFloat(event.target.value)}
              />
            </div>
          </label>

          <button
            type="button"
            onClick={openSession}
            disabled={!mayOpen || !branchId || isBusy}
          >
            {isClosed && resetAuthorized ? 'Open Again' : 'Open Day'}
          </button>
        </article>

        <article className="pos-shift-card pos-shift-card-v16 pos-shift-card--cash-drop">
          <div className="pos-shift-title">Cash Drop</div>

          <label className="pos-shift-field">
            <span>Amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={cashDropAmount}
              disabled={!isOpen || isBusy}
              onChange={(event) => setCashDropAmount(event.target.value)}
              placeholder="0"
            />
          </label>

          <label className="pos-shift-field">
            <span>Reason or handover note</span>
            <input
              value={cashDropNote}
              disabled={!isOpen || isBusy}
              onChange={(event) => setCashDropNote(event.target.value)}
              placeholder="Cash removed from till"
            />
          </label>

          <button
            type="button"
            className="secondary-action"
            onClick={recordCashDrop}
            disabled={!isOpen || Number(cashDropAmount || 0) <= 0 || isBusy}
          >
            Record
          </button>
        </article>

        <article className="pos-shift-card pos-shift-card-v16 pos-shift-card--clear">
          <div className="pos-shift-title">Clear</div>

          <label className="pos-shift-field">
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

          <label className="pos-shift-field">
            <span>Reconciliation note</span>
            <input
              value={reconciliationNote}
              disabled={!isOpen || isBusy}
              onChange={(event) => setReconciliationNote(event.target.value)}
              placeholder="Optional till reconciliation note"
            />
          </label>

          <button
            type="button"
            className="secondary-action"
            onClick={clearBalance}
            disabled={!isOpen || isBusy}
          >
            Clear Balance
          </button>
        </article>

        <article className="pos-shift-card pos-shift-card-v16 pos-shift-card--close">
          <div className="pos-shift-title">Close Day</div>

          <label className="pos-shift-field">
            <span>Closing mode</span>
            <select
              value={closingMode}
              disabled={!isCleared || isBusy}
              onChange={(event) =>
                setClosingMode(
                  event.target.value as 'handover' | 'final-close',
                )
              }
            >
              <option value="handover">Handover to incoming staff</option>
              <option value="final-close">
                Final close with manager deposit proof
              </option>
            </select>
          </label>

          {closingMode === 'final-close' ? (
            <label className="pos-shift-field">
              <span>Deposit proof reference</span>
              <input
                value={depositReference}
                disabled={!isCleared || isBusy}
                onChange={(event) => setDepositReference(event.target.value)}
                placeholder="Deposit slip, bank ref, MoMo ref"
              />
            </label>
          ) : (
            <div className="pos-shift-field pos-session-live-readonly">
              <span>Balance status</span>
              <strong>
                {isCleared ? 'Cleared and ready to close' : 'Clear first'}
              </strong>
            </div>
          )}

          <button
            type="button"
            onClick={closeSession}
            disabled={!isCleared || isBusy}
          >
            Close Day
          </button>
        </article>

        {isClosed && canAdminReset && !resetAuthorized && (
          <article className="pos-shift-card pos-shift-card-v16 pos-shift-card--admin-reset">
            <div className="pos-shift-title">Admin Reset</div>

            <div className="pos-shift-field pos-session-live-readonly">
              <span>Controlled reopening</span>
              <strong>Tenant Admin authorization required</strong>
            </div>

            <label className="pos-shift-field">
              <span>Mandatory reason</span>
              <textarea
                rows={2}
                value={resetReason}
                disabled={isBusy}
                onChange={(event) => setResetReason(event.target.value)}
                placeholder="Explain why another session is required today"
              />
            </label>

            <button
              type="button"
              className="danger-action"
              onClick={authorizeReset}
              disabled={resetReason.trim().length < 10 || isBusy}
            >
              Authorize
            </button>
          </article>
        )}
      </section>

      {!isOpen && !isCleared && (
        <div className="pos-session-live-guidance" role="status">
          <strong>
            {isClosed
              ? resetAuthorized
                ? 'Additional session authorized'
                : 'Today’s POS session is closed'
              : 'Open the POS day before confirming a payment'}
          </strong>
          <span>
            {isClosed
              ? resetAuthorized
                ? 'The cashier may open the next controlled session.'
                : canAdminReset
                  ? 'Provide an Admin Reset reason to authorize another same-day session.'
                  : 'A Tenant Admin must authorize another same-day session.'
              : 'Product search and cart preparation remain available, but payment confirmation is locked.'}
          </span>
        </div>
      )}

      {session?.events?.length ? (
        <details className="pos-session-live-audit">
          <summary>Session audit trail ({session.events.length})</summary>
          <div>
            {session.events.map((event, index) => {
              const eventName =
                event.type || event.event_type || 'session_event';

              return (
                <article key={`${eventName}-${event.created_at}-${index}`}>
                  <strong>{eventName.replaceAll('_', ' ')}</strong>
                  <span>{money(event.amount)}</span>
                  <small>{event.notes || 'No note recorded'}</small>
                  <small>{dateTime(event.created_at)}</small>
                </article>
              );
            })}
          </div>
        </details>
      ) : null}
    </section>
  );
}

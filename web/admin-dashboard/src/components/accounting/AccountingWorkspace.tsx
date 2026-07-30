import { useCallback, useEffect, useMemo, useState } from 'react';
import './AccountingWorkspace.css';
import { JournalApprovalWorkspace } from './JournalApprovalWorkspace';

type TabKey =
  | 'overview'
  | 'journal-register'
  | 'general-ledger'
  | 'trial-balance'
  | 'chart-of-accounts'
  | 'account-mappings'
  | 'business-dates'
  | 'periods'
  | 'readiness';

type Row = Record<string, unknown>;

type Props = {
  token: string;
  profile: Row;
  onBack: () => void;
  onMainDashboard: () => void;
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'journal-register', label: 'Journal Register' },
  { key: 'general-ledger', label: 'General Ledger' },
  { key: 'trial-balance', label: 'Trial Balance' },
  { key: 'chart-of-accounts', label: 'Chart of Accounts' },
  { key: 'account-mappings', label: 'Account Mappings' },
  { key: 'business-dates', label: 'Business Dates' },
  { key: 'periods', label: 'Accounting Periods' },
  { key: 'readiness', label: 'Control Readiness' },
];

const columns: Record<TabKey, Array<[string, string]>> = {
  overview: [],
  'journal-register': [
    ['journal_number', 'Journal'],
    ['business_date', 'Business Date'],
    ['source_module', 'Module'],
    ['source_type', 'Source'],
    ['status', 'Status'],
    ['total_debit', 'Debit'],
    ['total_credit', 'Credit'],
  ],
  'general-ledger': [
    ['business_date', 'Business Date'],
    ['journal_number', 'Journal'],
    ['code', 'Account'],
    ['name', 'Account name'],
    ['debit', 'Debit'],
    ['credit', 'Credit'],
    ['description', 'Description'],
  ],
  'trial-balance': [
    ['code', 'Code'],
    ['name', 'Account'],
    ['account_type', 'Type'],
    ['debit', 'Debit'],
    ['credit', 'Credit'],
    ['balance', 'Balance'],
  ],
  'chart-of-accounts': [
    ['code', 'Code'],
    ['name', 'Account'],
    ['account_type', 'Type'],
    ['normal_balance', 'Normal balance'],
    ['is_active', 'Active'],
  ],
  'account-mappings': [
    ['mapping_key', 'Mapping'],
    ['account_code', 'Code'],
    ['account_name', 'Account'],
    ['payment_method', 'Method'],
    ['is_active', 'Active'],
  ],
  'business-dates': [
    ['business_date', 'Business Date'],
    ['sale_count', 'Sales'],
    ['sales_total', 'Sales total'],
    ['paid_total', 'Paid total'],
  ],
  periods: [
    ['name', 'Period'],
    ['starts_on', 'Starts'],
    ['ends_on', 'Ends'],
    ['status', 'Status'],
    ['is_locked', 'Locked'],
  ],
  readiness: [
    ['label', 'Control'],
    ['value', 'Status'],
  ],
};

function money(value: unknown): string {
  const number = Number(value ?? 0);

  return `RWF ${new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0)}`;
}

function rowsFrom(payload: unknown): Row[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as Row).data;
  return Array.isArray(data) ? data as Row[] : [];
}

function ReadinessRows(payload: unknown): Row[] {
  const data = ((payload as Row | null)?.data ?? {}) as Row;

  return Object.entries(data)
    .filter(([key]) => !['tenant_id', 'branch_id'].includes(key))
    .map(([label, value]) => ({
      label: label.replaceAll('_', ' '),
      value: typeof value === 'boolean' ? (value ? 'Ready' : 'Blocked') : value,
    }));
}


function activeTenantSlug(profile: Row): string {
  const assignments = Array.isArray(profile.tenant_assignments)
    ? profile.tenant_assignments as Row[]
    : [];

  const activeAssignments = assignments.filter((assignment) => {
    const tenant = (assignment.tenant ?? {}) as Row;

    return assignment.status === 'active'
      && typeof tenant.slug === 'string'
      && tenant.slug.trim() !== '';
  });

  const scope = (profile.scope ?? {}) as Row;
  const scopeTenantId = Number(scope.tenant_id ?? 0);

  const selected = scopeTenantId > 0
    ? activeAssignments.find((assignment) => {
        const tenant = (assignment.tenant ?? {}) as Row;

        return Number(tenant.id ?? 0) === scopeTenantId;
      })
    : activeAssignments.length === 1
      ? activeAssignments[0]
      : undefined;

  const tenant = (selected?.tenant ?? {}) as Row;

  return typeof tenant.slug === 'string'
    ? tenant.slug.trim()
    : '';
}

export function AccountingWorkspace({
  token,
  profile,
  onBack,
  onMainDashboard,
}: Props) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [payload, setPayload] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const tenantSlug = useMemo(
    () => activeTenantSlug(profile),
    [profile],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      if (!tenantSlug) {
        throw new Error(
          'An active tenant assignment is required for Accounting.',
        );
      }

      const response = await fetch(`/api/v1/pharmaco/accounting/${tab}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Slug': tenantSlug,
        },
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          String((body as Row).message ?? 'Accounting data could not be loaded.'),
        );
      }

      setPayload(body);
    } catch (error) {
      setPayload(null);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Accounting data could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [tab, tenantSlug, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => tab === 'readiness' ? ReadinessRows(payload) : rowsFrom(payload),
    [payload, tab],
  );

  const root = ((payload as Row | null)?.data ?? {}) as Row;
  const kpis = (root.kpis ?? {}) as Row;
  const pnl = (root.profit_and_loss ?? {}) as Row;
  const maxPnl = Math.max(
    Number(pnl.income ?? 0),
    Number(pnl.expenses ?? 0),
    1,
  );

  const accountBalances = Array.isArray(root.account_balances)
    ? root.account_balances as Row[]
    : [];
  const expenseCategories = Array.isArray(root.expense_categories)
    ? root.expense_categories as Row[]
    : [];
  const reconciliation = Array.isArray(root.reconciliation)
    ? root.reconciliation as Row[]
    : [];
  const tasks = Array.isArray(root.tasks) ? root.tasks as Row[] : [];
  const recentJournals = Array.isArray(root.recent_journals)
    ? root.recent_journals as Row[]
    : [];

  return (
    <section className="acct-workspace">
      <header className="acct-hero">
        <div>
          <button className="acct-back" type="button" onClick={onBack}>
            ← Back to Finance
          </button>
          <span className="acct-eyebrow">Accounting control centre</span>
          <h1>Accounting Overview</h1>
          <p>
            Review the live ledger, Business Dates, mappings, reconciliation signals,
            periods and journal activity without changing original Sales or payments.
          </p>
        </div>
        <div className="acct-hero-actions">
          <button
            type="button"
            onClick={() => setTab('journal-register')}
          >
            New Journal Entry
          </button>
          <button className="acct-secondary" type="button" onClick={onMainDashboard}>
            Main Dashboard
          </button>
        </div>
      </header>

      <nav className="acct-tabs" aria-label="Accounting workspaces">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'is-active' : ''}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {message && <div className="acct-message">{message}</div>}
      {loading && <div className="acct-message">Loading live Accounting data…</div>}

      {!loading && tab === 'overview' && (
        <div className="acct-grid">
          <div className="acct-kpis">
            {[
              ['Net income', kpis.net_income],
              ['Cash & MoMo balance', kpis.cash_and_momo_balance],
              ['Receivables', kpis.receivables],
              ['Payables', kpis.payables],
            ].map(([label, value]) => (
              <article className="acct-kpi" key={String(label)}>
                <span>{String(label)}</span>
                <strong>{money(value)}</strong>
                <small>Live posted and shadow-posted ledger balance</small>
              </article>
            ))}
          </div>

          <article className="acct-card acct-card--wide">
            <div className="acct-card-heading">
              <div>
                <span className="acct-eyebrow">Profit and loss</span>
                <h2>Income against expenses</h2>
              </div>
              <span>{String(root.business_date ?? 'No Business Date')}</span>
            </div>
            <div className="acct-bars">
              {[
                ['Income', pnl.income],
                ['Expenses', pnl.expenses],
              ].map(([label, value]) => (
                <div className="acct-bar-row" key={String(label)}>
                  <span>{String(label)}</span>
                  <div className="acct-bar-track">
                    <div
                      className="acct-bar-fill"
                      style={{
                        width: `${Math.max(
                          (Number(value ?? 0) / maxPnl) * 100,
                          2,
                        )}%`,
                      }}
                    />
                  </div>
                  <strong>{money(value)}</strong>
                </div>
              ))}
            </div>
            <div className="acct-net">
              <span>Net income</span>
              <strong>{money(pnl.net_income)}</strong>
            </div>
          </article>

          <article className="acct-card">
            <CardTitle eyebrow="Account balance summary" title="Key accounts" />
            <CompactRows
              rows={accountBalances}
              label={(row) => `${String(row.code)} · ${String(row.name)}`}
              value={(row) => money(row.balance)}
              empty="No ledger balances are available."
            />
          </article>

          <article className="acct-card">
            <CardTitle eyebrow="Expenses by category" title="Ledger expense accounts" />
            <CompactRows
              rows={expenseCategories}
              label={(row) => `${String(row.code)} · ${String(row.name)}`}
              value={(row) => money(row.balance)}
              empty="No expense balances are available."
            />
          </article>

          <article className="acct-card">
            <CardTitle eyebrow="Cash & MoMo reconciliation" title="System totals" />
            <CompactRows
              rows={reconciliation}
              label={(row) => String(row.payment_method).toUpperCase()}
              value={(row) => money(row.system_amount)}
              empty="No payment totals are available for the latest Business Date."
            />
            <p className="acct-note">
              Actual amount and variance posting remain disabled until workflow approval.
            </p>
          </article>

          <article className="acct-card">
            <CardTitle eyebrow="Key tasks" title="Control attention" />
            <CompactRows
              rows={tasks}
              label={(row) => String(row.label)}
              value={(row) => String(row.count ?? 0)}
              empty="No Accounting control tasks are open."
            />
          </article>

          <article className="acct-card acct-card--wide">
            <CardTitle eyebrow="Recent journal entries" title="Latest recognised activity" />
            <DataTable
              rows={recentJournals}
              columns={[
                ['journal_number', 'Journal'],
                ['business_date', 'Business Date'],
                ['source_type', 'Source'],
                ['status', 'Status'],
                ['total_debit', 'Debit'],
                ['total_credit', 'Credit'],
              ]}
            />
          </article>

          <article className="acct-card">
            <CardTitle eyebrow="Accounting period" title="Current control window" />
            <p>
              {root.accounting_period
                ? `${String((root.accounting_period as Row).name)} · ${String(
                    (root.accounting_period as Row).status,
                  )}`
                : 'No Accounting period is configured.'}
            </p>
            <CardTitle eyebrow="Accounting insight" title="Current note" />
            <p>{String(root.insight ?? 'No Accounting insight is available.')}</p>
          </article>

          <article className="acct-card acct-card--wide">
            <CardTitle eyebrow="Quick actions" title="Review-ready workspaces" />
            <div className="acct-quick-actions">
              {tabs.filter((item) => !['overview'].includes(item.key)).map((item) => (
                <button key={item.key} type="button" onClick={() => setTab(item.key)}>
                  {item.label}
                </button>
              ))}
            </div>
          </article>
        </div>
      )}

      {!loading && tab === 'journal-register' && (
        <div className="acct-workflow-register">
          <JournalApprovalWorkspace
            token={token}
            tenantSlug={tenantSlug}
            profile={profile}
            onChanged={() => void load()}
          />

          <article className="acct-card acct-card--register">
            <div className="acct-card-heading">
              <div>
                <span className="acct-eyebrow">Posted ledger</span>
                <h2>Journal Register</h2>
              </div>
              <button
                className="acct-secondary"
                type="button"
                onClick={() => void load()}
              >
                Refresh
              </button>
            </div>

            <DataTable
              rows={rows}
              columns={columns['journal-register']}
            />
          </article>
        </div>
      )}

      {!loading && tab !== 'overview' && tab !== 'journal-register' && (
        <article className="acct-card acct-card--register">
          <div className="acct-card-heading">
            <div>
              <span className="acct-eyebrow">Read-only live workspace</span>
              <h2>{tabs.find((item) => item.key === tab)?.label}</h2>
            </div>
            <button className="acct-secondary" type="button" onClick={() => void load()}>
              Refresh
            </button>
          </div>
          <DataTable rows={rows} columns={columns[tab]} />
        </article>
      )}
    </section>
  );
}

function CardTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="acct-card-heading">
      <div>
        <span className="acct-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function CompactRows({
  rows,
  label,
  value,
  empty,
}: {
  rows: Row[];
  label: (row: Row) => string;
  value: (row: Row) => string;
  empty: string;
}) {
  if (rows.length === 0) return <p>{empty}</p>;

  return (
    <div className="acct-compact">
      {rows.map((row, index) => (
        <div key={String(row.id ?? row.account_id ?? row.label ?? index)}>
          <span>{label(row)}</span>
          <strong>{value(row)}</strong>
        </div>
      ))}
    </div>
  );
}

function DataTable({
  rows,
  columns,
}: {
  rows: Row[];
  columns: Array<[string, string]>;
}) {
  if (rows.length === 0) {
    return <div className="acct-empty">No live records are available.</div>;
  }

  const moneyKeys = new Set([
    'total_debit',
    'total_credit',
    'debit',
    'credit',
    'balance',
    'sales_total',
    'paid_total',
  ]);

  return (
    <div className="acct-table-wrap">
      <table className="acct-table">
        <thead>
          <tr>
            {columns.map(([, label]) => <th key={label}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? row.journal_number ?? index)}>
              {columns.map(([key]) => (
                <td key={key}>
                  {moneyKeys.has(key)
                    ? money(row[key])
                    : String(row[key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

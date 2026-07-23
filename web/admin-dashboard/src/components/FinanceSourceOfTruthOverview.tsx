import { useEffect, useState } from 'react';
import {
  getPharmaFinancePosShadowReconciliationReport,
  type PharmaFinancePosShadowReconciliationReport,
} from '../lib/api';

type Props = {
  token: string;
  profile: any;
};

function tenantSlugFromProfile(profile: any): string {
  return (
    profile?.tenant_assignments?.[0]?.tenant?.slug
    || profile?.tenant?.slug
    || profile?.scope?.tenant_slug
    || 'vitapharma'
  );
}

function isoDate(daysBack = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);

  return date.toISOString().slice(0, 10);
}

function money(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function FinanceSourceOfTruthOverview({ token, profile }: Props) {
  const [from, setFrom] = useState(() => isoDate(30));
  const [to, setTo] = useState(() => isoDate(0));
  const [report, setReport] = useState<PharmaFinancePosShadowReconciliationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const tenantSlug = tenantSlugFromProfile(profile);
  const summary = report?.summary;

  async function loadReport() {
    setIsLoading(true);
    setError('');

    try {
      const response = await getPharmaFinancePosShadowReconciliationReport(
        token,
        tenantSlug,
        { from, to },
      );

      setReport(response.data);
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : 'Unable to load Finance reconciliation report.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isReconciled = Boolean(summary?.is_reconciled);

  return (
    <section className="finance-source-truth-page">
      <section className="finance-authority-banner">
        <div>
          <p className="eyebrow">Finance source of truth</p>
          <h2>Financial authority control center</h2>
          <p>
            Module dashboards remain active. Finance supplies money values after each
            module reaches reconciliation readiness.
          </p>
        </div>

        <div className="finance-authority-status-card">
          <span>Current mode</span>
          <strong>Shadow Mode</strong>
          <small>{isReconciled ? 'Ready for staged dashboard switch' : 'Monitoring'}</small>
        </div>

        <div className="finance-authority-status-card">
          <span>Dashboard policy</span>
          <strong>Dashboards stay</strong>
          <small>Financial cards will fetch from Finance APIs.</small>
        </div>
      </section>

      <section className="finance-filter-bar">
        <label>
          <span>Business Date From</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>

        <label>
          <span>Business Date To</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>

        <button type="button" onClick={() => void loadReport()} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </section>

      {error && <div className="form-error">{error}</div>}

      <section className="finance-kpi-grid">
        <article className="finance-kpi-card">
          <span>POS completed payments</span>
          <strong>{money(summary?.pos_completed_payments_total)} RWF</strong>
          <small>Operational POS dashboard remains active.</small>
        </article>

        <article className="finance-kpi-card">
          <span>Finance shadow postings</span>
          <strong>{money(summary?.finance_shadow_payment_total)} RWF</strong>
          <small>Source: Finance shadow ledger.</small>
        </article>

        <article className="finance-kpi-card">
          <span>Difference</span>
          <strong>{money(summary?.difference)} RWF</strong>
          <small>{isReconciled ? 'Shadow validated.' : 'Needs review.'}</small>
        </article>

        <article className="finance-kpi-card">
          <span>Dashboard readiness</span>
          <strong>{isReconciled ? 'Ready' : 'Not ready'}</strong>
          <small>Financial switch requires clean reconciliation.</small>
        </article>
      </section>

      <section className="finance-kpi-grid">
        <article className="finance-kpi-card">
          <span>Missing Finance postings</span>
          <strong>{summary?.missing_finance_postings_count ?? 0}</strong>
          <small>Completed POS payments without Finance shadow journal.</small>
        </article>

        <article className="finance-kpi-card">
          <span>Orphan Finance postings</span>
          <strong>{summary?.orphan_finance_shadow_postings_count ?? 0}</strong>
          <small>Finance shadow entries without matching source payment.</small>
        </article>

        <article className="finance-kpi-card">
          <span>Source label</span>
          <strong>Shadow Validated</strong>
          <small>Finance is validating before becoming authoritative.</small>
        </article>

        <article className="finance-kpi-card">
          <span>Next integration</span>
          <strong>POS Sales Revenue</strong>
          <small>Pending Finance revenue posting.</small>
        </article>
      </section>
    </section>
  );
}

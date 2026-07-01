import { type FormEvent, useEffect, useState } from 'react';
import {
  AccessProfile,
  LocalizationContext,
  Market,
  TenantMarketAssignment,
  assignTenantToMarket,
  getLocalizationContext,
  getMarketAdminOverview,
  saveLocalizationPreference,
} from '../lib/api';

type MarketLocalizationPanelProps = {
  token: string;
  profile: AccessProfile;
};

export function MarketLocalizationPanel({ token, profile }: MarketLocalizationPanelProps) {
  const [localization, setLocalization] = useState<LocalizationContext | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [assignments, setAssignments] = useState<TenantMarketAssignment[]>([]);
  const [language, setLanguage] = useState<'en' | 'fr' | 'pt'>('en');
  const [tenantSlug, setTenantSlug] = useState(profile.tenant_assignments[0]?.tenant.slug ?? 'vitapharma');
  const [marketCode, setMarketCode] = useState('RW');
  const [radius, setRadius] = useState(12);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const canManageMarkets = profile.permissions.includes('markets.manage');

  async function loadContext() {
    setIsLoading(true);
    setError('');

    try {
      const context = await getLocalizationContext();
      setLocalization(context);
      setLanguage(context.selected_language);
      setMarketCode(context.market?.code ?? 'RW');

      if (canManageMarkets) {
        const overview = await getMarketAdminOverview(token);
        setMarkets(overview.markets);
        setAssignments(overview.assignments);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load market and localization data.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadContext();
  }, [token, canManageMarkets]);

  async function handleSavePreference() {
    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await saveLocalizationPreference(token, {
        language,
        market_code: marketCode,
      });
      setMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save language preference.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAssignTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageMarkets) return;

    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await assignTenantToMarket(token, {
        tenant_slug: tenantSlug,
        market_code: marketCode,
        status: 'active',
        service_radius_km: radius,
      });
      setMessage(response.message);
      setAssignments((current) => [response.assignment, ...current.filter((item) => item.id !== response.assignment.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to assign tenant to market.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="panel wide market-localization-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Market and Localization</h2>
          <p className="muted">
            Control market visibility, default language, currency, timezone, and tenant service availability.
          </p>
        </div>
        <button type="button" onClick={loadContext} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <section className="market-context-grid">
        <article>
          <span className="section-label">Detected context</span>
          <strong>{localization?.market?.name ?? 'No active market detected'}</strong>
          <p>{localization?.ip_policy.message ?? 'Loading localization context.'}</p>
          <small>IP: {localization?.ip_policy.ip_address ?? 'Unknown'} · Country: {localization?.ip_policy.country_code ?? 'Unknown'}</small>
        </article>

        <article>
          <span className="section-label">Language preference</span>
          <div className="inline-form-grid">
            <label>
              Language
              <select value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'fr' | 'pt')}>
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="pt">Portuguese</option>
              </select>
            </label>
            <label>
              Market
              <input value={marketCode} onChange={(event) => setMarketCode(event.target.value.toUpperCase())} />
            </label>
          </div>
          <button type="button" onClick={handleSavePreference} disabled={isSaving}>
            Save preference
          </button>
        </article>
      </section>

      {canManageMarkets && (
        <section className="market-admin-layout">
          <form className="market-assignment-form" onSubmit={handleAssignTenant}>
            <h3>Assign tenant to market</h3>
            <div className="inline-form-grid">
              <label>
                Tenant slug
                <input value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} required />
              </label>
              <label>
                Market code
                <input value={marketCode} onChange={(event) => setMarketCode(event.target.value.toUpperCase())} required />
              </label>
              <label>
                Radius km
                <input type="number" min="1" max="500" value={radius} onChange={(event) => setRadius(Number(event.target.value))} />
              </label>
            </div>
            <button type="submit" disabled={isSaving}>Save assignment</button>
          </form>

          <div className="market-list">
            {markets.map((market) => (
              <article key={market.code}>
                <strong>{market.name}</strong>
                <span>{market.code} · {market.default_language.toUpperCase()} · {market.currency_code}</span>
                <small>{market.tenant_assignments_count ?? 0} tenants · {market.service_providers_count ?? 0} providers</small>
              </article>
            ))}
          </div>

          <div className="assignment-list">
            {assignments.map((assignment) => (
              <article key={assignment.id}>
                <strong>{assignment.tenant?.name ?? 'Tenant'}</strong>
                <span>{assignment.market?.name ?? 'Market'} · {assignment.status}</span>
                <small>{assignment.service_radius_km ?? assignment.market?.service_radius_km ?? 0} km service radius</small>
              </article>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

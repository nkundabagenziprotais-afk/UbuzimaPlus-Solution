import { type FormEvent, useEffect, useState } from 'react';
import { NearbyProvider, getNearbyProviders } from '../lib/api';

export function NearbyProvidersPanel() {
  const [latitude, setLatitude] = useState(-1.9441);
  const [longitude, setLongitude] = useState(30.0619);
  const [marketCode, setMarketCode] = useState('RW');
  const [providerType, setProviderType] = useState('retail_pharmacy');
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [marketName, setMarketName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadProviders() {
    setIsLoading(true);
    setError('');

    try {
      const response = await getNearbyProviders({
        latitude,
        longitude,
        market_code: marketCode,
        provider_type: providerType,
        limit: 12,
      });
      setProviders(response.providers);
      setMarketName(response.market?.name ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load nearby providers.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProviders();
  }, []);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadProviders();
  }

  return (
    <article className="panel wide nearby-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Nearby Service Providers</h2>
          <p className="muted">
            Preview the customer-mobile discovery logic that recommends providers by market, service type, and distance.
          </p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form className="nearby-search-form" onSubmit={handleSearch}>
        <label>
          Latitude
          <input type="number" step="0.000001" value={latitude} onChange={(event) => setLatitude(Number(event.target.value))} />
        </label>
        <label>
          Longitude
          <input type="number" step="0.000001" value={longitude} onChange={(event) => setLongitude(Number(event.target.value))} />
        </label>
        <label>
          Market
          <input value={marketCode} onChange={(event) => setMarketCode(event.target.value.toUpperCase())} />
        </label>
        <label>
          Provider type
          <select value={providerType} onChange={(event) => setProviderType(event.target.value)}>
            <option value="retail_pharmacy">Retail pharmacy</option>
            <option value="wholesale_pharmacy">Wholesale pharmacy</option>
            <option value="clinic">Clinic</option>
            <option value="veterinary">Veterinary</option>
          </select>
        </label>
        <button type="submit" disabled={isLoading}>{isLoading ? 'Searching...' : 'Find providers'}</button>
      </form>

      <div className="provider-results">
        <span className="section-label">{marketName || 'Market'} results</span>
        {providers.map((provider) => (
          <article key={provider.uuid}>
            <div>
              <strong>{provider.name}</strong>
              <span>{provider.tenant?.name ?? 'Provider'} · {provider.branch?.name ?? 'Main service'}</span>
            </div>
            <p>{provider.address ?? 'Address pending'} · {provider.phone ?? 'Phone pending'}</p>
            <small>
              {provider.distance_km !== null ? `${provider.distance_km} km away` : 'Distance pending'} · {provider.service_channels.join(', ')}
            </small>
          </article>
        ))}
        {providers.length === 0 && !isLoading && <p className="muted">No providers matched this search yet.</p>}
      </div>
    </article>
  );
}

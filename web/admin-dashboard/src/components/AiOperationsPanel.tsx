import { useEffect, useState } from 'react';
import {
  AiCenterOverview,
  AiRecommendation,
  AccessProfile,
  activateAiDefaults,
  generateInventoryAiRecommendations,
  getAiCenterOverview,
  updateAiRecommendationStatus,
} from '../lib/api';

type AiOperationsPanelProps = {
  token: string;
  profile: AccessProfile;
};

export function AiOperationsPanel({ token, profile }: AiOperationsPanelProps) {
  const [overview, setOverview] = useState<AiCenterOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const tenantSlug =
    profile.tenant_assignments?.[0]?.tenant?.slug ||
    (profile.scope.is_tenant ? 'vitapharma' : 'vitapharma');

  async function load() {
    setIsLoading(true);
    setError('');

    try {
      const response = await getAiCenterOverview(token, tenantSlug);
      setOverview(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load AI Center.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token, tenantSlug]);

  async function handleActivate() {
    setIsGenerating(true);
    setError('');
    setMessage('');

    try {
      const response = await activateAiDefaults(token, tenantSlug);
      setMessage(response.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to activate AI defaults.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setError('');
    setMessage('');

    try {
      const response = await generateInventoryAiRecommendations(token, tenantSlug);
      setMessage(`${response.message} ${response.created_or_refreshed} recommendation(s) refreshed.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate AI recommendations.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function changeStatus(recommendation: AiRecommendation, status: 'approved' | 'rejected' | 'implemented') {
    setError('');
    setMessage('');

    try {
      const response = await updateAiRecommendationStatus(token, tenantSlug, recommendation.id, status);
      setMessage(response.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update recommendation.');
    }
  }

  return (
    <article className="panel wide ai-operations-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Operational AI Center</h2>
          <p className="muted">
            Active local AI models generate governed recommendations from real tenant data. Sensitive changes stay in review.
          </p>
        </div>
        <div className="panel-button-row">
          <button type="button" onClick={handleActivate} disabled={isGenerating}>
            Activate AI models
          </button>
          <button type="button" onClick={handleGenerate} disabled={isGenerating}>
            Generate stock insights
          </button>
          <button type="button" onClick={load} disabled={isLoading}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <section className="ai-summary-strip">
        <div>
          <span>Active models</span>
          <strong>{overview?.summary.active_models ?? 0}</strong>
        </div>
        <div>
          <span>Active agents</span>
          <strong>{overview?.summary.active_agents ?? 0}</strong>
        </div>
        <div>
          <span>Pending review</span>
          <strong>{overview?.summary.pending_recommendations ?? 0}</strong>
        </div>
        <div>
          <span>Implemented</span>
          <strong>{overview?.summary.implemented_recommendations ?? 0}</strong>
        </div>
      </section>

      <section className="ai-registry-grid">
        <div>
          <h3>Models</h3>
          {(overview?.models ?? []).slice(0, 12).map((model) => (
            <article key={String(model.code)}>
              <strong>{String(model.name)}</strong>
              <span>{String(model.status)} · {String(model.risk_level)}</span>
            </article>
          ))}
        </div>
        <div>
          <h3>Agents</h3>
          {(overview?.agents ?? []).map((agent) => (
            <article key={String(agent.code)}>
              <strong>{String(agent.name)}</strong>
              <span>{String(agent.status)} · {String(agent.risk_level)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="ai-recommendation-queue">
        <h3>Recommendation approval queue</h3>
        {(overview?.recommendations ?? []).map((recommendation) => (
          <article key={recommendation.id}>
            <div>
              <span>{recommendation.recommendation_type}</span>
              <h4>{recommendation.title}</h4>
              <p>{recommendation.explanation}</p>
              <small>
                Confidence {recommendation.confidence_score ?? 'n/a'} · Risk {recommendation.risk_level} · {recommendation.status}
              </small>
            </div>
            <div>
              <button type="button" onClick={() => changeStatus(recommendation, 'approved')}>
                Approve
              </button>
              <button type="button" onClick={() => changeStatus(recommendation, 'implemented')}>
                Implement
              </button>
              <button type="button" onClick={() => changeStatus(recommendation, 'rejected')}>
                Reject
              </button>
            </div>
          </article>
        ))}
        {overview && overview.recommendations.length === 0 && (
          <p className="muted">No recommendations yet. Generate stock insights to create an approval queue.</p>
        )}
      </section>
    </article>
  );
}

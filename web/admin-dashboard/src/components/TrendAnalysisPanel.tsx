import { useEffect, useMemo, useState } from 'react';
import {
  getPharmaTrendAnalysis,
  type TrendAnalysisArea,
  type TrendAnalysisGranularity,
  type TrendAnalysisResponse,
} from '../lib/api';

type TrendPoint = {
  label: string;
  current: number;
  comparison: number;
  change_percent: number;
};

const areaOptions: Array<{ value: TrendAnalysisArea; label: string }> = [
  { value: 'inventory', label: 'Inventory' },
  { value: 'pos-sales', label: 'POS Sales' },
  { value: 'general-stock', label: 'General Stock' },
  { value: 'insurance', label: 'Insurance' },
];

const metricOptions: Record<TrendAnalysisArea, Array<{ value: string; label: string }>> = {
  inventory: [
    { value: 'movement_quantity', label: 'Movement quantity' },
    { value: 'receipts', label: 'Receipts quantity' },
    { value: 'issues', label: 'Issued quantity' },
    { value: 'transactions', label: 'Movement records' },
    { value: 'adjustments', label: 'Adjustment pressure' },
  ],
  'pos-sales': [
    { value: 'gross_sales', label: 'Gross sales' },
    { value: 'transactions', label: 'Transactions' },
    { value: 'average_basket', label: 'Average basket' },
  ],
  'general-stock': [
    { value: 'stock_value', label: 'Stock value' },
    { value: 'stock_units', label: 'Stock units' },
    { value: 'near_expiry_value', label: 'Near-expiry exposure value' },
    { value: 'low_stock', label: 'Low-stock exposure' },
  ],
  insurance: [
    { value: 'insured_sales', label: 'Insured sales value' },
    { value: 'insurer_contribution', label: 'Insurer contribution' },
    { value: 'claim_count', label: 'Claim count' },
  ],
};

type Props = {
  token: string;
  profile: unknown;
  title?: string;
  defaultArea?: TrendAnalysisArea;
};

function profileTenantSlug(profile: unknown): string {
  if (!profile || typeof profile !== 'object') {
    return '';
  }

  const profileRecord = profile as Record<string, unknown>;
  const tenant = profileRecord.tenant;

  if (!tenant || typeof tenant !== 'object') {
    return '';
  }

  const tenantRecord = tenant as Record<string, unknown>;
  const slug = tenantRecord.slug;

  return typeof slug === 'string' ? slug : '';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function defaultDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function TrendAnalysisPanel({
  token,
  profile,
  title = 'Trend Analysis',
  defaultArea = 'inventory',
}: Props) {
  const tenantSlug = profileTenantSlug(profile);
  const [area, setArea] = useState<TrendAnalysisArea>(defaultArea);
  const [metric, setMetric] = useState(metricOptions[defaultArea][0]?.value || '');
  const [granularity, setGranularity] = useState<TrendAnalysisGranularity>('day');
  const [periodAStart, setPeriodAStart] = useState(defaultDate(-6));
  const [periodAEnd, setPeriodAEnd] = useState(defaultDate(0));
  const [periodBStart, setPeriodBStart] = useState(defaultDate(-13));
  const [periodBEnd, setPeriodBEnd] = useState(defaultDate(-7));
  const [data, setData] = useState<TrendAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!token || !tenantSlug) {
      return;
    }

    let cancelled = false;

    async function loadTrend() {
      setIsLoading(true);
      setNotice('');

      try {
        const response = await getPharmaTrendAnalysis(token, tenantSlug, {
          area,
          metric,
          granularity,
          current_start: periodAStart,
          current_end: periodAEnd,
          comparison_start: periodBStart,
          comparison_end: periodBEnd,
        });

        if (!cancelled) {
          setData(response);
        }
      } catch (error) {
        if (!cancelled) {
          setNotice(
            error instanceof Error
              ? error.message
              : 'Unable to load trend analysis.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTrend();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    tenantSlug,
    area,
    metric,
    granularity,
    periodAStart,
    periodAEnd,
    periodBStart,
    periodBEnd,
  ]);

  const points = useMemo<TrendPoint[]>(() => data?.points || [], [data]);
  const maximum = Math.max(
    1,
    ...points.flatMap((point) => [point.current, point.comparison]),
  );

  return (
    <section className="trend-analysis-panel">
      <div className="section-heading">
        <div>
          <span>Live business intelligence</span>
          <h3>{title}</h3>
        </div>
        {isLoading ? <small>Loading live trend…</small> : null}
      </div>

      <div className="trend-analysis-controls">
        <label>
          Area
          <select
            value={area}
            onChange={(event) => {
              const nextArea = event.target.value as TrendAnalysisArea;
              setArea(nextArea);
              setMetric(metricOptions[nextArea][0]?.value || '');
            }}
          >
            {areaOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Metric
          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value)}
          >
            {metricOptions[area].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Compare by
          <select
            value={granularity}
            onChange={(event) => setGranularity(event.target.value as TrendAnalysisGranularity)}
          >
            <option value="day">Days</option>
            <option value="week">Weeks</option>
            <option value="month">Months</option>
            <option value="quarter">Quarters</option>
            <option value="year">Years</option>
          </select>
        </label>

        <label>
          Current start
          <input
            type="date"
            value={periodAStart}
            onChange={(event) => setPeriodAStart(event.target.value)}
          />
        </label>

        <label>
          Current end
          <input
            type="date"
            value={periodAEnd}
            onChange={(event) => setPeriodAEnd(event.target.value)}
          />
        </label>

        <label>
          Compare start
          <input
            type="date"
            value={periodBStart}
            onChange={(event) => setPeriodBStart(event.target.value)}
          />
        </label>

        <label>
          Compare end
          <input
            type="date"
            value={periodBEnd}
            onChange={(event) => setPeriodBEnd(event.target.value)}
          />
        </label>
      </div>

      {notice ? <p className="form-error">{notice}</p> : null}

      <div className="trend-analysis-summary">
        <article>
          <span>Current period</span>
          <strong>{formatNumber(data?.summary.current_total || 0)}</strong>
        </article>
        <article>
          <span>Comparison period</span>
          <strong>{formatNumber(data?.summary.comparison_total || 0)}</strong>
        </article>
        <article>
          <span>Variance</span>
          <strong>
            {(data?.summary.variance_percent || 0) >= 0 ? '+' : ''}
            {(data?.summary.variance_percent || 0).toFixed(1)}%
          </strong>
        </article>
      </div>

      <div className="trend-analysis-chart">
        {points.length ? (
          points.map((point) => (
            <div key={point.label}>
              <span>
                <i
                  title={`Current: ${formatNumber(point.current)}`}
                  style={{
                    height: `${Math.max(6, (point.current / maximum) * 100)}%`,
                  }}
                />
                <b
                  title={`Comparison: ${formatNumber(point.comparison)}`}
                  style={{
                    height: `${Math.max(6, (point.comparison / maximum) * 100)}%`,
                  }}
                />
              </span>
              <strong>{point.label}</strong>
              <small>{formatNumber(point.current)}</small>
            </div>
          ))
        ) : (
          <p className="insurance-muted">
            No live trend records were found for this comparison.
          </p>
        )}
      </div>

      <div className="trend-analysis-table">
        <table>
          <thead>
            <tr>
              <th>Period point</th>
              <th>Current</th>
              <th>Comparison</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.label}>
                <td>{point.label}</td>
                <td>{formatNumber(point.current)}</td>
                <td>{formatNumber(point.comparison)}</td>
                <td>
                  {point.change_percent >= 0 ? '+' : ''}
                  {point.change_percent.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <article className="trend-analysis-insight">
        <strong>AI business interpretation</strong>
        <p>{data?.insight || 'Select periods to generate a live business interpretation.'}</p>
      </article>
    </section>
  );
}

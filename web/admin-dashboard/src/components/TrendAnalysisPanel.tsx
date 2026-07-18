import { useMemo, useState } from 'react';

type TrendArea = 'inventory' | 'pos-sales' | 'general-stock' | 'insurance';
type TrendGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

type TrendPoint = {
  label: string;
  current: number;
  comparison: number;
};

const areaOptions: Array<{ value: TrendArea; label: string }> = [
  { value: 'inventory', label: 'Inventory' },
  { value: 'pos-sales', label: 'POS Sales' },
  { value: 'general-stock', label: 'General Stock' },
  { value: 'insurance', label: 'Insurance' },
];

const metricOptions: Record<TrendArea, Array<{ value: string; label: string }>> = {
  inventory: [
    { value: 'movement_quantity', label: 'Movement quantity' },
    { value: 'near_expiry_value', label: 'Near-expiry exposure value' },
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
    { value: 'low_stock', label: 'Low-stock exposure' },
  ],
  insurance: [
    { value: 'insured_sales', label: 'Insured sales value' },
    { value: 'insurer_contribution', label: 'Insurer contribution' },
    { value: 'claim_count', label: 'Claim count' },
  ],
};

type Props = {
  title?: string;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 0,
  }).format(value);
}

export function TrendAnalysisPanel({ title = 'Trend Analysis' }: Props) {
  const [area, setArea] = useState<TrendArea>('inventory');
  const [metric, setMetric] = useState('movement_quantity');
  const [granularity, setGranularity] = useState<TrendGranularity>('week');
  const [periodA, setPeriodA] = useState('');
  const [periodB, setPeriodB] = useState('');

  const demoSeries = useMemo<TrendPoint[]>(() => {
    return ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map((label, index) => {
      const base = (index + 1) * 120;
      const current = base + (area === 'insurance' ? 300 : 80);
      const comparison = base * 0.85 + (index % 2 === 0 ? 40 : -25);

      return {
        label,
        current,
        comparison,
      };
    });
  }, [area, metric, granularity, periodA, periodB]);

  const totalCurrent = demoSeries.reduce((sum, point) => sum + point.current, 0);
  const totalComparison = demoSeries.reduce((sum, point) => sum + point.comparison, 0);
  const variance = totalComparison === 0
    ? 0
    : ((totalCurrent - totalComparison) / totalComparison) * 100;

  const maximum = Math.max(
    1,
    ...demoSeries.flatMap((point) => [point.current, point.comparison]),
  );

  const insight =
    variance > 10
      ? 'The current period is materially higher than the comparison period. Review the drivers and confirm whether this is demand growth, pricing impact, or stock movement pressure.'
      : variance < -10
        ? 'The current period is materially lower than the comparison period. Investigate stock availability, POS activity, insurance claims, or purchasing delays.'
        : 'The current and comparison periods are broadly stable. Continue monitoring for operational drift.';

  return (
    <section className="trend-analysis-panel">
      <div className="section-heading">
        <div>
          <span>Trend analysis foundation</span>
          <h3>{title}</h3>
        </div>
      </div>

      <div className="trend-analysis-controls">
        <label>
          Area
          <select
            value={area}
            onChange={(event) => {
              const nextArea = event.target.value as TrendArea;
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
            onChange={(event) => setGranularity(event.target.value as TrendGranularity)}
          >
            <option value="day">Days</option>
            <option value="week">Weeks</option>
            <option value="month">Months</option>
            <option value="quarter">Quarters</option>
            <option value="year">Years</option>
          </select>
        </label>

        <label>
          Current period
          <input
            value={periodA}
            onChange={(event) => setPeriodA(event.target.value)}
            placeholder="Example: 2026-W29 or 2026-07"
          />
        </label>

        <label>
          Compare with
          <input
            value={periodB}
            onChange={(event) => setPeriodB(event.target.value)}
            placeholder="Example: 2026-W28 or 2026-06"
          />
        </label>
      </div>

      <div className="trend-analysis-summary">
        <article>
          <span>Current period</span>
          <strong>{formatNumber(totalCurrent)}</strong>
        </article>
        <article>
          <span>Comparison period</span>
          <strong>{formatNumber(totalComparison)}</strong>
        </article>
        <article>
          <span>Variance</span>
          <strong>{variance >= 0 ? '+' : ''}{variance.toFixed(1)}%</strong>
        </article>
      </div>

      <div className="trend-analysis-chart">
        {demoSeries.map((point) => (
          <div key={point.label}>
            <span>
              <i style={{ height: `${Math.max(6, (point.current / maximum) * 100)}%` }} />
              <b style={{ height: `${Math.max(6, (point.comparison / maximum) * 100)}%` }} />
            </span>
            <strong>{point.label}</strong>
          </div>
        ))}
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
            {demoSeries.map((point) => {
              const change = point.comparison === 0
                ? 0
                : ((point.current - point.comparison) / point.comparison) * 100;

              return (
                <tr key={point.label}>
                  <td>{point.label}</td>
                  <td>{formatNumber(point.current)}</td>
                  <td>{formatNumber(point.comparison)}</td>
                  <td>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <article className="trend-analysis-insight">
        <strong>Business interpretation preview</strong>
        <p>{insight}</p>
        <small>
          Live comparison data will be connected through the trend-analysis API
          so Inventory, POS Sales, General Stock and Insurance can compare
          days, weeks, months, quarters and years using real records.
        </small>
      </article>
    </section>
  );
}

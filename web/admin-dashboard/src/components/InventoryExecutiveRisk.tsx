import {
  type CSSProperties,
  useMemo,
} from 'react';

type Props = {
  valuation: unknown;
};

type UnknownRecord =
  Record<string, unknown>;

type RiskMetric = {
  key: string;
  label: string;
  value: number;
  className: string;
};

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function numeric(
  value: unknown,
): number {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === 'string' &&
    value.trim() !== ''
  ) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function text(
  value: unknown,
  fallback: string,
): string {
  return typeof value === 'string' &&
    value.trim() !== ''
    ? value.trim()
    : fallback;
}

function formatRwf(
  value: number,
): string {
  return `RWF ${new Intl.NumberFormat(
    'en-RW',
    {
      maximumFractionDigits: 0,
    },
  ).format(value)}`;
}

function formatNumber(
  value: number,
  maximumFractionDigits = 0,
): string {
  return new Intl.NumberFormat(
    'en-RW',
    {
      maximumFractionDigits,
    },
  ).format(value);
}

export function InventoryExecutiveRisk({
  valuation,
  showGeneralStock = false,
}: Props & {
  showGeneralStock?: boolean;
}) {
  const analytics = useMemo(() => {
    const response = isRecord(valuation)
      ? valuation
      : {};

    const inventory = isRecord(
      response.inventory,
    )
      ? response.inventory
      : response;

    const risk = isRecord(
      inventory.risk_mix,
    )
      ? inventory.risk_mix
      : {};

    const general = isRecord(
      inventory.general_stock,
    )
      ? inventory.general_stock
      : {};

    const totalValue = numeric(
      risk.total_inventory_value,
    );

    const metrics: RiskMetric[] = [
      {
        key: 'expired',
        label: 'Expired / quarantined',
        value: numeric(
          risk.expired_quarantined_value,
        ),
        className: 'is-expired',
      },
      {
        key: 'near-expiry',
        label: 'Near expiry',
        value: numeric(
          risk.near_expiry_value,
        ),
        className: 'is-near-expiry',
      },
      {
        key: 'low-stock',
        label: 'Low stock',
        value: numeric(
          risk.low_stock_value,
        ),
        className: 'is-low-stock',
      },
      {
        key: 'slow',
        label: 'Slow / excess',
        value: numeric(
          risk.slow_overstock_value,
        ),
        className: 'is-slow',
      },
      {
        key: 'healthy',
        label: 'Healthy stock',
        value: numeric(
          risk.healthy_stock_value,
        ),
        className: 'is-healthy',
      },
    ];

    const percentages =
      metrics.map((metric) => ({
        ...metric,
        percentage:
          totalValue > 0
            ? (
                metric.value /
                totalValue
              ) * 100
            : 0,
      }));

    const generalCards = [
      {
        label: 'General Stock Value',
        value: formatRwf(
          numeric(general.total_value),
        ),
        detail:
          'Consumables, devices, supplies, and equipment',
      },
      {
        label: 'Below Minimum',
        value: formatNumber(
          numeric(
            general.items_below_minimum,
          ),
        ),
        detail:
          'Items requiring replenishment attention',
      },
      {
        label: 'Shortage Exposure',
        value: formatRwf(
          numeric(
            general
              .estimated_shortage_exposure_value,
          ),
        ),
        detail:
          'Estimated retail value exposed to shortage',
      },
      {
        label: 'Slow-moving Value',
        value: formatRwf(
          numeric(
            general.slow_moving_value,
          ),
        ),
        detail:
          'Value with weak recent consumption',
      },
      {
        label: 'Average Stock Cover',
        value:
          general
            .average_stock_cover_days === null
            ? 'Not available'
            : `${formatNumber(
                numeric(
                  general
                    .average_stock_cover_days,
                ),
                1,
              )} days`,
        detail:
          'Estimated cover from recent outbound movement',
      },
      {
        label: 'Predicted Stock-outs',
        value: formatNumber(
          numeric(
            general
              .predicted_stockout_items,
          ),
        ),
        detail:
          'Items with short cover or reorder deficit',
      },
      {
        label: 'Recommended Reorder',
        value: formatRwf(
          numeric(
            general
              .recommended_reorder_value,
          ),
        ),
        detail:
          'Estimated cost to restore minimum levels',
      },
      {
        label: 'AI Health Score',
        value: `${formatNumber(
          numeric(
            general.ai_health_score,
          ),
          0,
        )}/100`,
        detail: text(
          general.ai_recommendation,
          'No recommendation is currently available.',
        ),
      },
    ];

    return {
      totalValue,
      totalAtRisk: numeric(
        risk.total_value_at_risk,
      ),
      riskPercent: numeric(
        risk.value_at_risk_percent,
      ),
      recommendation: text(
        risk.executive_recommendation,
        'No executive recommendation is currently available.',
      ),
      percentages,
      generalCards,
      generalItemCount: numeric(
        general.item_count,
      ),
    };
  }, [valuation]);

  const [
    expired,
    nearExpiry,
    lowStock,
    slow,
  ] = analytics.percentages;

  const donutStyle = {
    '--risk-expired':
      `${expired?.percentage ?? 0}%`,
    '--risk-near-expiry':
      `${nearExpiry?.percentage ?? 0}%`,
    '--risk-low-stock':
      `${lowStock?.percentage ?? 0}%`,
    '--risk-slow':
      `${slow?.percentage ?? 0}%`,
  } as CSSProperties;

  return (
    <>
      {!showGeneralStock && (
      <article className="inventory-executive-risk-panel">
        <header>
          <div>
            <small>
              Executive financial exposure
            </small>
            <h3>Inventory Risk Mix</h3>
          </div>

          <span>
            Cost-value basis
          </span>
        </header>

        <div className="inventory-executive-risk-layout">
          <div
            className="inventory-executive-risk-donut"
            style={donutStyle}
            aria-label="Inventory financial risk distribution"
          >
            <span>
              <strong>
                {formatRwf(
                  analytics.totalAtRisk,
                )}
              </strong>
              <small>
                {analytics.riskPercent
                  .toFixed(1)}% at risk
              </small>
            </span>
          </div>

          <div className="inventory-executive-risk-legend">
            {analytics.percentages.map(
              (metric) => (
                <div
                  key={metric.key}
                  className={metric.className}
                >
                  <i />

                  <span>
                    {metric.label}
                  </span>

                  <strong>
                    {formatRwf(
                      metric.value,
                    )}
                  </strong>

                  <small>
                    {metric.percentage
                      .toFixed(1)}%
                  </small>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="inventory-executive-risk-summary">
          <div>
            <span>
              Total inventory value
            </span>
            <strong>
              {formatRwf(
                analytics.totalValue,
              )}
            </strong>
          </div>

          <div>
            <span>
              Total value at risk
            </span>
            <strong>
              {formatRwf(
                analytics.totalAtRisk,
              )}
            </strong>
          </div>

          <div>
            <span>
              Healthy value
            </span>
            <strong>
              {formatRwf(
                analytics.percentages
                  .find(
                    (metric) =>
                      metric.key ===
                      'healthy',
                  )?.value ?? 0,
              )}
            </strong>
          </div>
        </div>

      </article>
      )}

      {showGeneralStock && (
<section className="general-stock-executive-section">
        <header className="platform-heading-card">
          <div>
            <p className="eyebrow">
              AI-assisted stock intelligence
            </p>
            <h2>General Stock Items</h2>
            <span>
              {formatNumber(
                analytics.generalItemCount,
              )}{' '}
              classified item(s)
            </span>
          </div>
        </header>

        <div className="general-stock-executive-grid">
          {analytics.generalCards.map(
            (card) => (
              <article
                key={card.label}
                className="general-stock-executive-card"
              >
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.detail}</small>
              </article>
            ),
          )}
        </div>
      </section>
      )}
    </>
  );
}

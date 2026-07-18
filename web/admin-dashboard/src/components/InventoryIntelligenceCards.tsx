import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type AccessProfile,
  type PharmaInventoryIntelligenceResponse,
  getPharmaInventoryIntelligence,
} from "../lib/api";
import type {
  InventoryView,
} from "./ProductInventoryPreview";

type Props = {
  token: string;
  profile: AccessProfile;
  onOpenWorkspace: (
    workspace: InventoryView,
  ) => void;
};

function tenantSlug(profile: AccessProfile): string {
  const activeAssignment =
    profile.tenant_assignments?.find(
      (assignment) =>
        assignment.status === "active"
        && Boolean(assignment.tenant?.slug),
    );

  if (activeAssignment?.tenant?.slug) {
    return activeAssignment.tenant.slug;
  }

  const assignedTenant =
    profile.tenant_assignments?.find(
      (assignment) =>
        Boolean(assignment.tenant?.slug),
    );

  return assignedTenant?.tenant?.slug ?? "";
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function movementLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export function InventoryIntelligenceCards({
  token,
  profile,
  onOpenWorkspace,
}: Props) {
  const slug = tenantSlug(profile);

  const [data, setData] =
    useState<
      PharmaInventoryIntelligenceResponse | null
    >(null);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] =
    useState(false);

  useEffect(() => {
    if (!slug) return;

    let active = true;

    setIsLoading(true);
    setError("");

    void getPharmaInventoryIntelligence(
      token,
      slug,
    )
      .then((response) => {
        if (active) setData(response);
      })
      .catch((loadError) => {
        if (!active) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load inventory intelligence.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug, token]);

  // Inventory intelligence may return a partial response after
  // validation, permission, tenant, or upstream data errors.
  // Normalize every nested collection and numeric total before render.
  const weeklyMovements = data?.weekly_movements;
  const liveSummary = data?.live_summary;

  const weeklyMovementDays = Array.isArray(
    weeklyMovements?.days,
  )
    ? weeklyMovements.days
    : [];

  const weeklyMovementRecent = Array.isArray(
    weeklyMovements?.recent,
  )
    ? weeklyMovements.recent
    : [];

  const weeklyMovementTotals = {
    receipts: Number(
      weeklyMovements?.totals?.receipts
      ?? liveSummary?.positive_quantity
      ?? 0,
    ),
    issues: Number(
      weeklyMovements?.totals?.issues
      ?? liveSummary?.negative_quantity
      ?? 0,
    ),
    adjustments: Number(
      weeklyMovements?.totals?.adjustments ?? 0,
    ),
    net: Number(
      weeklyMovements?.totals?.net ?? 0,
    ),
    transactions: Number(
      weeklyMovements?.totals?.transactions
      ?? liveSummary?.movement_count
      ?? 0,
    ),
  };

  const nearExpirySource =
    data?.near_expiry_value_trend;

  const nearExpiryDirection =
    nearExpirySource?.direction === "increasing"
    || nearExpirySource?.direction === "decreasing"
    || nearExpirySource?.direction === "stable"
      ? nearExpirySource.direction
      : "stable";

  const nearExpiryDeltaCandidate = Number(
    nearExpirySource?.delta ?? 0,
  );

  const nearExpiryLatestCandidate =
    nearExpirySource?.latest_value;

  const nearExpiryTrend = {
    points: Array.isArray(
      nearExpirySource?.points,
    )
      ? nearExpirySource.points
      : [],
    direction: nearExpiryDirection,
    delta: Number.isFinite(
      nearExpiryDeltaCandidate,
    )
      ? nearExpiryDeltaCandidate
      : 0,
    latest_value:
      nearExpiryLatestCandidate === null
      || nearExpiryLatestCandidate === undefined
        ? null
        : (
            Number.isFinite(
              Number(nearExpiryLatestCandidate),
            )
              ? Number(nearExpiryLatestCandidate)
              : null
          ),
  };

  const movementMaximum = useMemo(() => {
    if (!data) return 1;

    return Math.max(
      1,
      ...weeklyMovementDays.flatMap(
        (day) => [
          day.receipts,
          day.issues,
          day.adjustments,
        ],
      ),
    );
  }, [data]);

  const expiryPoints = useMemo(() => {
    const points =
      nearExpiryTrend.points
      ?? [];

    const available = points.filter(
      (point) => point.value !== null,
    );

    const maximum = Math.max(
      1,
      ...available.map(
        (point) => point.value ?? 0,
      ),
    );

    const minimum = Math.min(
      ...available.map(
        (point) => point.value ?? 0,
      ),
      maximum,
    );

    const range = Math.max(
      1,
      maximum - minimum,
    );

    return points.map((point, index) => ({
      ...point,
      x:
        points.length <= 1
          ? 50
          : (index / (points.length - 1)) * 100,
      y:
        point.value === null
          ? null
          : 88
            - (
                (
                  point.value - minimum
                ) / range
              ) * 70,
    }));
  }, [data]);

  const polyline = expiryPoints
    .filter(
      (
        point,
      ): point is typeof point & { y: number } =>
        point.y !== null,
    )
    .map(
      (point) =>
        `${point.x},${point.y}`,
    )
    .join(" ");

  const nearExpiryExposure =
    nearExpiryTrend.latest_value
    ?? liveSummary?.near_expiry_value
    ?? 0;

  const issueReceiptRatio =
    weeklyMovementTotals.receipts > 0
      ? (
          weeklyMovementTotals.issues
          / weeklyMovementTotals.receipts
        ) * 100
      : weeklyMovementTotals.issues > 0
        ? 100
        : 0;

  const adjustmentPressure =
    weeklyMovementTotals.transactions > 0
      ? (
          weeklyMovementTotals.adjustments
          / Math.max(
              1,
              weeklyMovementTotals.receipts
              + weeklyMovementTotals.issues
              + weeklyMovementTotals.adjustments,
            )
        ) * 100
      : 0;

  const actionSignal =
    nearExpiryTrend.direction === "increasing"
      ? "Prioritize expiry reduction"
      : weeklyMovementTotals.net < 0
        ? "Review replenishment"
        : weeklyMovementTotals.transactions === 0
          ? "No movement this week"
          : "Inventory flow is active";

  const actionHint =
    nearExpiryTrend.direction === "increasing"
      ? "Near-expiry value is growing; review transfers, markdowns or supplier follow-up."
      : weeklyMovementTotals.net < 0
        ? "Issued quantity is higher than receipts; check reorder levels and fast movers."
        : weeklyMovementTotals.transactions === 0
          ? "No signed stock movement was found for this week."
          : "Receipts, issues and adjustments are being captured for decision support.";

  const decisionCards = [
    {
      label: "Weekly receipts",
      value: weeklyMovementTotals.receipts.toLocaleString("en-RW"),
      hint: "Units received into inventory this week.",
      tone: "positive",
    },
    {
      label: "Weekly issues",
      value: weeklyMovementTotals.issues.toLocaleString("en-RW"),
      hint: "Units issued, sold, transferred or deducted this week.",
      tone: "warning",
    },
    {
      label: "Net movement",
      value: weeklyMovementTotals.net.toLocaleString("en-RW"),
      hint:
        weeklyMovementTotals.net >= 0
          ? "Inventory increased or remained stable this week."
          : "Inventory reduced this week; review replenishment.",
      tone:
        weeklyMovementTotals.net >= 0
          ? "positive"
          : "danger",
    },
    {
      label: "Movement records",
      value: weeklyMovementTotals.transactions.toLocaleString("en-RW"),
      hint: "Signed stock movement transactions feeding audit history.",
      tone: "neutral",
    },
    {
      label: "Issue pressure",
      value: `${Math.round(issueReceiptRatio)}%`,
      hint: "Issues compared with receipts. High values may indicate replenishment pressure.",
      tone: issueReceiptRatio > 80 ? "danger" : "neutral",
    },
    {
      label: "Adjustment pressure",
      value: `${Math.round(adjustmentPressure)}%`,
      hint: "Share of stock activity affected by adjustments, counts or transfers.",
      tone: adjustmentPressure > 20 ? "warning" : "neutral",
    },
    {
      label: "Near-expiry exposure",
      value: money(nearExpiryExposure),
      hint: "Current value of inventory at expiry risk within the configured window.",
      tone:
        nearExpiryExposure > 0
          ? "warning"
          : "positive",
    },
    {
      label: "Recommended action",
      value: actionSignal,
      hint: actionHint,
      tone:
        nearExpiryTrend.direction === "increasing"
        || weeklyMovementTotals.net < 0
          ? "danger"
          : "positive",
    },
  ];

  if (!slug) {
    return (
      <article className="inventory-home-chart-panel">
        <header>
          <small>Inventory intelligence</small>
          <strong>Tenant context required</strong>
        </header>
        <p>
          Assign this user to an active tenant before
          loading inventory movement intelligence.
        </p>
      </article>
    );
  }

  return (
    <>
      <section className="inventory-intelligence-decision-grid">
        {decisionCards.map((card) => (
          <article
            key={card.label}
            className={`inventory-intelligence-decision-card is-${card.tone}`}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      <article className="inventory-home-chart-panel inventory-intelligence-card">
        <header>
          <div>
            <small>
              Signed stock movement records
            </small>
            <strong>
              Weekly Inventory Movement History
            </strong>
          </div>

          <button
            type="button"
            onClick={() =>
              onOpenWorkspace(
                "product-inventory",
              )
            }
          >
            Open inventory
          </button>
        </header>

        {isLoading && !data && (
          <p>Loading weekly movement history…</p>
        )}

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="inventory-intelligence-totals">
              <span>
                <strong>
                  {weeklyMovementTotals.receipts
                    .toLocaleString("en-RW")}
                </strong>
                <small>Units received</small>
              </span>

              <span>
                <strong>
                  {weeklyMovementTotals.issues
                    .toLocaleString("en-RW")}
                </strong>
                <small>Units issued</small>
              </span>

              <span>
                <strong>
                  {weeklyMovementTotals.adjustments
                    .toLocaleString("en-RW")}
                </strong>
                <small>Adjusted / transferred</small>
              </span>

              <span>
                <strong>
                  {weeklyMovementTotals.transactions}
                </strong>
                <small>Movement records</small>
              </span>
            </div>

            <div className="inventory-movement-week">
              {weeklyMovementDays.map(
                (day) => (
                  <div
                    key={day.date}
                    className={
                      `inventory-movement-day`
                      + (
                        day.is_today
                          ? " is-today"
                          : ""
                      )
                      + (
                        day.is_future
                          ? " is-future"
                          : ""
                      )
                    }
                  >
                    <div className="inventory-movement-bars">
                      <i
                        className="is-receipt"
                        style={{
                          height: `${
                            (
                              day.receipts
                              / movementMaximum
                            ) * 100
                          }%`,
                        }}
                        title={`Receipts ${day.receipts}`}
                      />
                      <i
                        className="is-issue"
                        style={{
                          height: `${
                            (
                              day.issues
                              / movementMaximum
                            ) * 100
                          }%`,
                        }}
                        title={`Issues ${day.issues}`}
                      />
                      <i
                        className="is-adjustment"
                        style={{
                          height: `${
                            (
                              day.adjustments
                              / movementMaximum
                            ) * 100
                          }%`,
                        }}
                        title={`Adjustments ${day.adjustments}`}
                      />
                    </div>

                    <strong>{day.short_day}</strong>
                    <small>
                      {day.transactions}
                    </small>
                  </div>
                ),
              )}
            </div>

            <div className="inventory-movement-legend">
              <span className="is-receipt">
                Receipts
              </span>
              <span className="is-issue">
                Issues
              </span>
              <span className="is-adjustment">
                Adjustments
              </span>
            </div>

            <div className="inventory-recent-movement-list">
              {weeklyMovementRecent
                .slice(0, 5)
                .map((movement) => (
                  <div key={movement.id}>
                    <span>
                      <strong>
                        {movement.product_name}
                      </strong>
                      <small>
                        {movementLabel(
                          movement.movement_type,
                        )}
                        {" · "}
                        {movement.branch_code
                          ?? movement.branch_name
                          ?? "Tenant"}
                      </small>
                    </span>

                    <b
                      className={
                        movement.quantity >= 0
                          ? "is-positive"
                          : "is-negative"
                      }
                    >
                      {movement.quantity >= 0
                        ? "+"
                        : ""}
                      {movement.quantity.toLocaleString(
                        "en-RW",
                      )}
                    </b>
                  </div>
                ))}

              {weeklyMovementRecent
                .length === 0 && weeklyMovementTotals.transactions > 0 && (
                <p>
                  {weeklyMovementTotals.transactions.toLocaleString("en-RW")}
                  {" "}signed stock movements exist this week. Recent movement
                  details will appear once product history is loaded.
                </p>
              )}

              {weeklyMovementRecent
                .length === 0 && weeklyMovementTotals.transactions === 0 && (
                <p>
                  No signed stock movements were recorded during this week.
                </p>
              )}
            </div>
          </>
        )}
      </article>

      <article className="inventory-home-chart-panel inventory-intelligence-card">
        <header>
          <div>
            <small>
              S M T W T F S · 180-day exposure
            </small>
            <strong>
              Near Expiry Inventory Movement
            </strong>
          </div>

          <button
            type="button"
            onClick={() =>
              onOpenWorkspace("near-expiry")
            }
          >
            Review batches
          </button>
        </header>

        {data && (
          <>
            <div className="inventory-expiry-trend-summary">
              <span>
                <strong>
                  {money(
                    nearExpiryTrend
                      .latest_value,
                  )}
                </strong>
                <small>Latest exposure value</small>
              </span>

              <span
                className={
                  `inventory-expiry-direction is-`
                  + nearExpiryTrend
                    .direction
                }
              >
                {nearExpiryTrend
                  .direction}
                <small>
                  {nearExpiryTrend
                    .delta >= 0
                    ? "+"
                    : ""}
                  {money(
                    nearExpiryTrend
                      .delta,
                  )}
                </small>
              </span>
            </div>

            <div className="inventory-expiry-line-chart">
              <svg
                viewBox="0 0 100 100"
                role="img"
                aria-label="Near expiry inventory value from Sunday to Saturday"
                preserveAspectRatio="none"
              >
                <polyline points={polyline} />

                {expiryPoints.map((point) =>
                  point.y === null
                    ? null
                    : (
                      <circle
                        key={point.date}
                        cx={point.x}
                        cy={point.y}
                        r={point.is_today ? 2.7 : 2}
                      />
                    ),
                )}
              </svg>

              <div>
                {expiryPoints.map((point) => (
                  <span
                    key={point.date}
                    className={
                      point.is_today
                        ? "is-today"
                        : ""
                    }
                  >
                    <strong>
                      {point.short_day}
                    </strong>
                    <small>
                      {point.value === null
                        ? "—"
                        : money(point.value)}
                    </small>
                  </span>
                ))}
              </div>
            </div>

            <p className="inventory-intelligence-note">
              Values are reconstructed from current batch
              balances and signed stock movements. Increasing
              exposure requires expiry actions, transfers or
              supplier follow-up.
            </p>
          </>
        )}
      </article>
    </>
  );
}

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
      weeklyMovements?.totals?.receipts ?? 0,
    ),
    issues: Number(
      weeklyMovements?.totals?.issues ?? 0,
    ),
    adjustments: Number(
      weeklyMovements?.totals?.adjustments ?? 0,
    ),
    transactions: Number(
      weeklyMovements?.totals?.transactions ?? 0,
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
      data?.near_expiry_value_trend.points
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
                .length === 0 && (
                <p>
                  No signed stock movements were recorded
                  during this week.
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
                    data.near_expiry_value_trend
                      .latest_value,
                  )}
                </strong>
                <small>Latest exposure value</small>
              </span>

              <span
                className={
                  `inventory-expiry-direction is-`
                  + data.near_expiry_value_trend
                    .direction
                }
              >
                {data.near_expiry_value_trend
                  .direction}
                <small>
                  {data.near_expiry_value_trend
                    .delta >= 0
                    ? "+"
                    : ""}
                  {money(
                    data.near_expiry_value_trend
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

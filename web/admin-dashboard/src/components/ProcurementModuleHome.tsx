import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AccessProfile,
  PharmaPurchaseOrder,
  PharmaSupplier,
  getPharmaPurchaseOrders,
  getPharmaSuppliers,
} from '../lib/api';

type ProcurementWorkspaceItem<TWorkspaceKey extends string> = {
  key: TWorkspaceKey;
  label: string;
  description?: string;
};

type ProcurementModuleHomeProps<TWorkspaceKey extends string> = {
  token: string;
  profile: AccessProfile;
  workspaceItems: Array<ProcurementWorkspaceItem<TWorkspaceKey>>;
  onOpen: (workspace: TWorkspaceKey) => void;
};

type ProcurementHomeState = {
  suppliers: PharmaSupplier[];
  purchaseOrders: PharmaPurchaseOrder[];
};

type StatusSlice = {
  key: string;
  label: string;
  value: number;
  className: string;
};

function tenantSlugFrom(profile: AccessProfile): string {
  return (
    profile.tenant_assignments?.[0]?.tenant?.slug ||
    (profile.scope.is_tenant ? 'vitapharma' : '')
  );
}

function money(value: number): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value);
}

function percentage(value: number): string {
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

function normalizedStatus(status: string | null | undefined): string {
  return String(status || 'unknown')
    .trim()
    .toLowerCase()
    .replaceAll(' ', '_');
}

function workspacePermission(
  key: string,
): string[] {
  const map: Record<string, string[]> = {
    'create-supplier': [
      'pharmaco.procurement.suppliers.manage',
    ],
    'supplier-list': [
      'pharmaco.procurement.view',
    ],
    'create-purchase-order': [
      'pharmaco.procurement.purchase_order.create',
    ],
    'outstanding-purchase-orders': [
      'pharmaco.procurement.view',
    ],
    'receive-purchase-order': [
      'pharmaco.product_inventory.receive',
      'pharmaco.procurement.purchase_order.receive',
    ],
    'received-purchase-orders': [
      'pharmaco.procurement.view',
    ],
  };

  return map[key] ?? [
    'pharmaco.procurement.view',
  ];
}

function workspaceIcon(key: string): string {
  const icons: Record<string, string> = {
    'create-supplier': 'SU',
    'supplier-list': 'SL',
    'create-purchase-order': 'PO',
    'outstanding-purchase-orders': 'OP',
    'receive-purchase-order': 'GR',
    'received-purchase-orders': 'RC',
  };

  return icons[key] ?? 'PR';
}

export function ProcurementModuleHome<
  TWorkspaceKey extends string,
>({
  token,
  profile,
  workspaceItems,
  onOpen,
}: ProcurementModuleHomeProps<TWorkspaceKey>) {
  const [state, setState] =
    useState<ProcurementHomeState>({
      suppliers: [],
      purchaseOrders: [],
    });

  const [isLoading, setIsLoading] =
    useState(false);
  const [error, setError] =
    useState('');
  const [lastRefreshedAt, setLastRefreshedAt] =
    useState<Date | null>(null);

  const tenantSlug = useMemo(
    () => tenantSlugFrom(profile),
    [profile],
  );

  const permissions = profile.permissions ?? [];

  const canViewProcurement =
    permissions.includes(
      'pharmaco.procurement.view',
    );

  const canSeeFinancials =
    permissions.some((permission) =>
      [
        'pharmaco.procurement.invoice.manage',
        'pharmaco.procurement.invoice.approve',
        'pharmaco.procurement.payment.view',
        'pharmaco.procurement.payment.manage',
      ].includes(permission),
    );

  const visibleWorkspaces = useMemo(
    () =>
      workspaceItems.filter((workspace) =>
        workspacePermission(workspace.key).every(
          (permission) =>
            permissions.includes(permission),
        ),
      ),
    [permissions, workspaceItems],
  );

  async function loadAnalytics() {
    if (!tenantSlug) {
      setError(
        'No tenant assignment is available for this Procurement workspace.',
      );
      return;
    }

    if (!canViewProcurement) {
      setError(
        'Procurement viewing permission is required.',
      );
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const [suppliers, purchaseOrders] =
        await Promise.all([
          getPharmaSuppliers(
            token,
            tenantSlug,
          ),
          getPharmaPurchaseOrders(
            token,
            tenantSlug,
          ),
        ]);

      setState({
        suppliers: suppliers.suppliers,
        purchaseOrders:
          purchaseOrders.purchase_orders,
      });

      setLastRefreshedAt(new Date());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load Procurement analytics.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
  }, [tenantSlug]);

  const analytics = useMemo(() => {
    const purchaseOrders =
      state.purchaseOrders;

    const suppliers =
      state.suppliers;

    const statusCount = new Map<string, number>();

    purchaseOrders.forEach((purchaseOrder) => {
      const key = normalizedStatus(
        purchaseOrder.status,
      );

      statusCount.set(
        key,
        (statusCount.get(key) ?? 0) + 1,
      );
    });

    const draftCount =
      statusCount.get('draft') ?? 0;

    const approvedCount =
      statusCount.get('approved') ?? 0;

    const partialCount =
      statusCount.get(
        'partially_received',
      ) ?? 0;

    const receivedCount =
      (statusCount.get('received') ?? 0) +
      (statusCount.get(
        'fully_received',
      ) ?? 0);

    const cancelledCount =
      statusCount.get('cancelled') ?? 0;

    const activeSuppliers =
      suppliers.filter(
        (supplier) =>
          normalizedStatus(
            supplier.status,
          ) === 'active',
      ).length;

    const totalValue =
      purchaseOrders.reduce(
        (sum, purchaseOrder) =>
          sum +
          Number(
            purchaseOrder.total_amount ??
              0,
          ),
        0,
      );

    const openValue =
      purchaseOrders
        .filter(
          (purchaseOrder) =>
            ![
              'received',
              'fully_received',
              'cancelled',
            ].includes(
              normalizedStatus(
                purchaseOrder.status,
              ),
            ),
        )
        .reduce(
          (sum, purchaseOrder) =>
            sum +
            Number(
              purchaseOrder.total_amount ??
                0,
            ),
          0,
        );

    const receivingProgress =
      purchaseOrders.length > 0
        ? (
            receivedCount +
            partialCount * 0.5
          ) /
          purchaseOrders.length *
          100
        : 0;

    const approvalAttention =
      draftCount;

    const supplierOrderCounts =
      new Map<
        string,
        {
          name: string;
          count: number;
          value: number;
        }
      >();

    purchaseOrders.forEach(
      (purchaseOrder) => {
        const supplierName =
          purchaseOrder.supplier?.name ??
          'Supplier not assigned';

        const current =
          supplierOrderCounts.get(
            supplierName,
          ) ?? {
            name: supplierName,
            count: 0,
            value: 0,
          };

        current.count += 1;
        current.value += Number(
          purchaseOrder.total_amount ?? 0,
        );

        supplierOrderCounts.set(
          supplierName,
          current,
        );
      },
    );

    const supplierConcentration =
      Array.from(
        supplierOrderCounts.values(),
      )
        .sort(
          (left, right) =>
            right.count - left.count ||
            right.value - left.value,
        )
        .slice(0, 5);

    const statusSlices: StatusSlice[] = [
      {
        key: 'draft',
        label: 'Draft',
        value: draftCount,
        className: 'draft',
      },
      {
        key: 'approved',
        label: 'Approved',
        value: approvedCount,
        className: 'approved',
      },
      {
        key: 'partial',
        label: 'Partially received',
        value: partialCount,
        className: 'partial',
      },
      {
        key: 'received',
        label: 'Received',
        value: receivedCount,
        className: 'received',
      },
      {
        key: 'cancelled',
        label: 'Cancelled',
        value: cancelledCount,
        className: 'cancelled',
      },
    ].filter(
      (slice) => slice.value > 0,
    );

    return {
      supplierCount: suppliers.length,
      activeSuppliers,
      purchaseOrderCount:
        purchaseOrders.length,
      totalValue,
      openValue,
      receivingProgress,
      approvalAttention,
      approvedCount,
      partialCount,
      receivedCount,
      statusSlices,
      supplierConcentration,
    };
  }, [state]);

  const maximumSupplierOrders =
    Math.max(
      1,
      ...analytics.supplierConcentration.map(
        (supplier) => supplier.count,
      ),
    );

  return (
    <section
      className="pos-sales-overview procurement-module-home"
      data-work-package="AQUILA_PROCUREMENT_PACKAGE_3A_HOME_ANALYTICS"
    >
      <header className="procurement-home-title-card platform-heading-card">
        <div>
          <span className="procurement-home-eyebrow">
            Pharmaceutical supply operations
          </span>

          <h1>Procurement Operations</h1>

          <p>
            Move from supplier management to purchase
            orders, approvals and receiving through
            focused operational pages.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAnalytics()}
          disabled={
            isLoading ||
            !canViewProcurement
          }
        >
          {isLoading
            ? 'Refreshing…'
            : 'Refresh Procurement'}
        </button>
      </header>

      {error && (
        <div
          className="form-error procurement-home-state"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="pos-overview-modules procurement-home-menu-section">
        <div className="procurement-home-section-heading platform-heading-card">
          <div>
            <span className="procurement-home-eyebrow">
              Procurement menu
            </span>

            <h2>Choose where you want to work</h2>

            <p>
              Each card opens one focused register or
              controlled operation.
            </p>
          </div>

          <span className="pos-overview-count">
            {visibleWorkspaces.length} pages
          </span>
        </div>

        <div className="pos-overview-module-grid procurement-home-menu-grid">
          {visibleWorkspaces.map(
            (workspace, index) => (
              <button
                key={workspace.key}
                type="button"
                className="pos-overview-module-card procurement-home-menu-card"
                onClick={() =>
                  onOpen(workspace.key)
                }
              >
                <span className="pos-overview-module-index">
                  {String(index + 1).padStart(
                    2,
                    '0',
                  )}
                </span>

                <span
                  className="pos-overview-module-icon procurement-home-menu-icon"
                  aria-hidden="true"
                >
                  {workspaceIcon(
                    workspace.key,
                  )}
                </span>

                <span className="pos-overview-module-content procurement-home-menu-title">
                  <strong>
                    {workspace.label}
                  </strong>
                </span>

                <span
                  className="pos-overview-module-arrow"
                  aria-hidden="true"
                >
                  →
                </span>
              </button>
            ),
          )}
        </div>
      </section>

      <section className="procurement-home-analytics">
        <div className="procurement-home-section-heading platform-heading-card">
          <div>
            <span className="procurement-home-eyebrow">
              AI-assisted operating intelligence
            </span>

            <h2>AI Procurement Analytics</h2>

            <p>
              Practical signals derived from the
              current supplier and purchase-order
              records.
            </p>
          </div>

          <span className="pos-overview-live-indicator">
            <i />
            {lastRefreshedAt
              ? `Updated ${lastRefreshedAt.toLocaleTimeString(
                  'en-RW',
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                  },
                )}`
              : 'Awaiting refresh'}
          </span>
        </div>

        {isLoading && (
          <div className="procurement-home-loading">
            Loading Procurement analytics…
          </div>
        )}

        {!isLoading && (
          <>
            <div className="procurement-home-kpi-grid">
              <article className="procurement-home-kpi primary">
                <span>Active suppliers</span>
                <strong>
                  {analytics.activeSuppliers}
                </strong>
                <small>
                  {analytics.supplierCount} total
                  supplier records
                </small>
              </article>

              <article className="procurement-home-kpi">
                <span>Purchase orders</span>
                <strong>
                  {analytics.purchaseOrderCount}
                </strong>
                <small>
                  {analytics.approvedCount} approved
                  and {analytics.partialCount}{' '}
                  partially received
                </small>
              </article>

              <article className="procurement-home-kpi attention">
                <span>Approval attention</span>
                <strong>
                  {analytics.approvalAttention}
                </strong>
                <small>
                  Draft purchase orders requiring
                  controlled review
                </small>
              </article>

              <article className="procurement-home-kpi">
                <span>Receiving progress</span>
                <strong>
                  {percentage(
                    analytics.receivingProgress,
                  )}
                </strong>
                <small>
                  {analytics.receivedCount} fully
                  received purchase orders
                </small>
              </article>

              <article className="procurement-home-kpi financial">
                <span>Total procurement value</span>
                <strong>
                  {canSeeFinancials
                    ? money(
                        analytics.totalValue,
                      )
                    : 'Restricted'}
                </strong>
                <small>
                  Financial visibility follows the
                  assigned Procurement role
                </small>
              </article>

              <article className="procurement-home-kpi financial">
                <span>Open commitment</span>
                <strong>
                  {canSeeFinancials
                    ? money(
                        analytics.openValue,
                      )
                    : 'Restricted'}
                </strong>
                <small>
                  Value not yet fully received or
                  cancelled
                </small>
              </article>
            </div>

            <div className="procurement-home-chart-grid">
              <article className="procurement-home-chart-card">
                <header>
                  <div>
                    <span className="procurement-home-eyebrow">
                      Operational distribution
                    </span>

                    <h3>
                      Purchase-order status
                    </h3>
                  </div>

                  <strong>
                    {analytics.purchaseOrderCount}
                  </strong>
                </header>

                {analytics.statusSlices.length ===
                0 ? (
                  <div className="procurement-home-empty-chart">
                    No purchase-order status data is
                    available yet.
                  </div>
                ) : (
                  <div className="procurement-status-chart">
                    {analytics.statusSlices.map(
                      (slice) => {
                        const share =
                          analytics.purchaseOrderCount >
                          0
                            ? slice.value /
                              analytics.purchaseOrderCount *
                              100
                            : 0;

                        return (
                          <div
                            key={slice.key}
                            className="procurement-status-row"
                          >
                            <div>
                              <span
                                className={`procurement-status-dot ${slice.className}`}
                              />
                              <strong>
                                {slice.label}
                              </strong>
                              <small>
                                {slice.value} order
                                {slice.value === 1
                                  ? ''
                                  : 's'}
                              </small>
                            </div>

                            <div className="procurement-status-track">
                              <i
                                className={
                                  slice.className
                                }
                                style={{
                                  width:
                                    percentage(
                                      share,
                                    ),
                                }}
                              />
                            </div>

                            <b>
                              {percentage(share)}
                            </b>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </article>

              <article className="procurement-home-chart-card">
                <header>
                  <div>
                    <span className="procurement-home-eyebrow">
                      Supplier concentration
                    </span>

                    <h3>
                      Purchase orders by supplier
                    </h3>
                  </div>

                  <strong>
                    {
                      analytics.supplierConcentration
                        .length
                    }
                  </strong>
                </header>

                {analytics.supplierConcentration
                  .length === 0 ? (
                  <div className="procurement-home-empty-chart">
                    Supplier order activity will
                    appear after purchase orders are
                    recorded.
                  </div>
                ) : (
                  <div className="procurement-supplier-chart">
                    {analytics.supplierConcentration.map(
                      (supplier) => (
                        <div
                          className="procurement-supplier-row"
                          key={supplier.name}
                        >
                          <div>
                            <strong>
                              {supplier.name}
                            </strong>

                            <small>
                              {supplier.count} purchase
                              order
                              {supplier.count === 1
                                ? ''
                                : 's'}
                            </small>
                          </div>

                          <div className="procurement-supplier-bar">
                            <i
                              style={{
                                width:
                                  percentage(
                                    supplier.count /
                                      maximumSupplierOrders *
                                      100,
                                  ),
                              }}
                            />
                          </div>

                          <b>
                            {canSeeFinancials
                              ? money(
                                  supplier.value,
                                )
                              : `${supplier.count}`}
                          </b>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </article>

              <article className="procurement-home-chart-card procurement-home-insight-card">
                <header>
                  <div>
                    <span className="procurement-home-eyebrow">
                      Management interpretation
                    </span>

                    <h3>
                      Procurement attention
                    </h3>
                  </div>
                </header>

                <div className="procurement-insight-list">
                  <div>
                    <strong>
                      Approval queue
                    </strong>

                    <span>
                      {analytics.approvalAttention >
                      0
                        ? `${analytics.approvalAttention} draft purchase order(s) need approval review.`
                        : 'No draft purchase-order approval queue is currently highlighted.'}
                    </span>
                  </div>

                  <div>
                    <strong>
                      Receiving follow-up
                    </strong>

                    <span>
                      {analytics.partialCount > 0
                        ? `${analytics.partialCount} purchase order(s) are partially received and require quantity follow-up.`
                        : 'No partially received purchase order currently requires follow-up.'}
                    </span>
                  </div>

                  <div>
                    <strong>
                      Supplier coverage
                    </strong>

                    <span>
                      {analytics.activeSuppliers > 0
                        ? `${analytics.activeSuppliers} active supplier(s) are available for controlled ordering.`
                        : 'No active supplier is currently available for new purchase orders.'}
                    </span>
                  </div>

                  <div>
                    <strong>
                      Human approval
                    </strong>

                    <span>
                      Analytics are decision support
                      only. Purchase-order approval,
                      receiving and financial actions
                      remain permission controlled.
                    </span>
                  </div>
                </div>
              </article>
            </div>
          </>
        )}
      </section>
    </section>
  );
}

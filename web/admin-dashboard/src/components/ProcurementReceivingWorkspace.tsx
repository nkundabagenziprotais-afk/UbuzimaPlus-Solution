import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AccessProfile,
  PharmaPurchaseOrder,
  PharmaPurchaseOrderItem,
  PharmaStockLocation,
  getPharmaInventoryLocations,
  getPharmaPurchaseOrder,
  getPharmaPurchaseOrders,
  receivePharmaStock,
} from '../lib/api';
import { InventoryPopupForm } from './InventoryPopupForm';
import {
  GeneralItemPurchaseOrderReceivingWorkspace,
} from './GeneralItemPurchaseOrderReceivingWorkspace';

type Props = {
  token: string;
  profile: AccessProfile;
};

type ReceiveForm = {
  purchase_order_item_id: string;
  stock_location_id: string;
  batch_number: string;
  quantity: string;
  expiry_date: string;
  unit_cost: string;
  selling_price: string;
};

type ReceivingTableSettings = {
  density: 'compact' | 'comfortable' | 'tall';
  fontSize: number;
  widthPreset: 'compact' | 'balanced' | 'wide';
  wrapText: boolean;
  stickyActions: boolean;
};

const tableSettingsKey =
  'ubuzima.procurement.receiving-table.v1';

const defaultTableSettings:
  ReceivingTableSettings = {
    density: 'comfortable',
    fontSize: 13,
    widthPreset: 'balanced',
    wrapText: false,
    stickyActions: true,
  };

function tenantSlugFrom(
  profile: AccessProfile,
): string {
  return (
    profile.tenant_assignments?.[0]?.tenant?.slug ||
    (profile.scope.is_tenant ? 'vitapharma' : '')
  );
}

function normalizedText(
  value: unknown,
): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function normalizedStatus(
  value: unknown,
): string {
  return normalizedText(value).replaceAll(
    ' ',
    '_',
  );
}

function numberFrom(
  value: string,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function dateLabel(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Not recorded';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('en-RW', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function money(
  value: number | null | undefined,
): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function blankReceiveForm(
  locationId = '',
): ReceiveForm {
  return {
    purchase_order_item_id: '',
    stock_location_id: locationId,
    batch_number: '',
    quantity: '',
    expiry_date: '',
    unit_cost: '',
    selling_price: '',
  };
}

function loadTableSettings():
  ReceivingTableSettings {
  if (typeof window === 'undefined') {
    return defaultTableSettings;
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(
        tableSettingsKey,
      ) ?? '{}',
    ) as Partial<ReceivingTableSettings>;

    return {
      density:
        stored.density === 'compact' ||
        stored.density === 'tall'
          ? stored.density
          : 'comfortable',
      fontSize:
        typeof stored.fontSize === 'number'
          ? Math.max(
              12,
              Math.min(16, stored.fontSize),
            )
          : 13,
      widthPreset:
        stored.widthPreset === 'compact' ||
        stored.widthPreset === 'wide'
          ? stored.widthPreset
          : 'balanced',
      wrapText: stored.wrapText === true,
      stickyActions:
        stored.stickyActions !== false,
    };
  } catch {
    return defaultTableSettings;
  }
}

function remainingQuantity(
  item: PharmaPurchaseOrderItem,
): number {
  return Math.max(
    Number(item.quantity_ordered) -
      Number(item.quantity_received),
    0,
  );
}

export function ProcurementReceivingWorkspace({
  token,
  profile,
}: Props) {
  const [purchaseOrders, setPurchaseOrders] =
    useState<PharmaPurchaseOrder[]>([]);
  const [locations, setLocations] =
    useState<PharmaStockLocation[]>([]);

  const [
    selectedPurchaseOrder,
    setSelectedPurchaseOrder,
  ] = useState<PharmaPurchaseOrder | null>(null);

  const [
    viewingPurchaseOrder,
    setViewingPurchaseOrder,
  ] = useState<PharmaPurchaseOrder | null>(null);

  const [receiveForm, setReceiveForm] =
    useState<ReceiveForm>(
      blankReceiveForm(),
    );

  const [isReceiveOpen, setIsReceiveOpen] =
    useState(false);
  const [searchTerm, setSearchTerm] =
    useState('');
  const [statusFilter, setStatusFilter] =
    useState('all');
  const [branchFilter, setBranchFilter] =
    useState('all');

  const [tableSettings, setTableSettings] =
    useState<ReceivingTableSettings>(
      loadTableSettings,
    );

  const [isLoading, setIsLoading] =
    useState(false);
  const [isLoadingDetail, setIsLoadingDetail] =
    useState(false);
  const [isReceiving, setIsReceiving] =
    useState(false);

  const [notice, setNotice] =
    useState('');
  const [error, setError] =
    useState('');

  const tenantSlug = useMemo(
    () => tenantSlugFrom(profile),
    [profile],
  );

  const permissions =
    profile.permissions ?? [];

  const canViewProcurement =
    permissions.includes(
      'pharmaco.procurement.view',
    );

  const canViewInventory =
    permissions.includes(
      'pharmaco.inventory.view',
    );

  const canReceivePurchaseOrders =
    permissions.includes(
      'pharmaco.product_inventory.receive',
    ) &&
    permissions.includes(
      'pharmaco.procurement.purchase_order.receive',
    );

  const canSeeFinancials =
    permissions.some((permission) =>
      [
        'pharmaco.procurement.purchase_order.create',
        'pharmaco.procurement.purchase_order.approve',
        'pharmaco.procurement.invoice.manage',
        'pharmaco.procurement.invoice.approve',
        'pharmaco.procurement.payment.view',
        'pharmaco.procurement.payment.manage',
      ].includes(permission),
    );

  async function loadWorkspace() {
    if (!tenantSlug) {
      setError(
        'No tenant assignment is available for this account.',
      );
      return;
    }

    if (
      !canViewProcurement ||
      !canViewInventory
    ) {
      setError(
        'Procurement and Inventory viewing permissions are required.',
      );
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const [
        purchaseOrderResponse,
        locationResponse,
      ] = await Promise.all([
        getPharmaPurchaseOrders(
          token,
          tenantSlug,
        ),
        getPharmaInventoryLocations(
          token,
          tenantSlug,
        ),
      ]);

      setPurchaseOrders(
        purchaseOrderResponse.purchase_orders,
      );
      setLocations(
        locationResponse.locations,
      );

      setReceiveForm((current) => ({
        ...current,
        stock_location_id:
          current.stock_location_id ||
          String(
            locationResponse.locations[0]?.id ??
              '',
          ),
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load receiving information.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [tenantSlug]);

  const eligiblePurchaseOrders =
    useMemo(
      () =>
        purchaseOrders.filter(
          (purchaseOrder) =>
            purchaseOrder.purchase_type ===
              'core_products' &&
            [
              'approved',
              'partially_received',
            ].includes(
              normalizedStatus(
                purchaseOrder.status,
              ),
            ),
        ),
      [purchaseOrders],
    );

  const branchOptions = useMemo(() => {
    const branches = new Map<
      number,
      {
        id: number;
        name: string;
      }
    >();

    purchaseOrders.forEach((purchaseOrder) => {
      if (purchaseOrder.branch?.id) {
        branches.set(
          purchaseOrder.branch.id,
          {
            id: purchaseOrder.branch.id,
            name:
              purchaseOrder.branch.name,
          },
        );
      }
    });

    return Array.from(
      branches.values(),
    ).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [purchaseOrders]);

  const filteredPurchaseOrders =
    useMemo(() => {
      const query =
        normalizedText(searchTerm);

      return eligiblePurchaseOrders.filter(
        (purchaseOrder) => {
          const searchMatches =
            !query ||
            [
              purchaseOrder.po_number,
              purchaseOrder.supplier?.name,
              purchaseOrder.supplier
                ?.supplier_code,
              purchaseOrder.branch?.name,
              purchaseOrder.branch?.code,
              purchaseOrder.status,
              purchaseOrder.notes,
            ].some((value) =>
              normalizedText(value).includes(
                query,
              ),
            );

          const statusMatches =
            statusFilter === 'all' ||
            normalizedStatus(
              purchaseOrder.status,
            ) === statusFilter;

          const branchMatches =
            branchFilter === 'all' ||
            purchaseOrder.branch?.id ===
              Number(branchFilter);

          return (
            searchMatches &&
            statusMatches &&
            branchMatches
          );
        },
      );
    }, [
      eligiblePurchaseOrders,
      searchTerm,
      statusFilter,
      branchFilter,
    ]);

  const selectedItems =
    selectedPurchaseOrder?.items ?? [];

  const selectedReceiveItem =
    selectedItems.find(
      (item) =>
        item.id ===
        Number(
          receiveForm.purchase_order_item_id,
        ),
    );

  const selectedRemainingQuantity =
    selectedReceiveItem
      ? remainingQuantity(
          selectedReceiveItem,
        )
      : 0;

  const availableLocations =
    locations.filter((location) => {
      if (
        !selectedPurchaseOrder?.branch?.id
      ) {
        return true;
      }

      return (
        location.branch.id ===
        selectedPurchaseOrder.branch.id
      );
    });

  async function loadPurchaseOrderDetail(
    purchaseOrderId: number,
  ): Promise<PharmaPurchaseOrder | null> {
    setIsLoadingDetail(true);
    setError('');

    try {
      const response =
        await getPharmaPurchaseOrder(
          token,
          tenantSlug,
          purchaseOrderId,
        );

      return response.purchase_order;
    } catch (detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : 'Unable to load Purchase Order details.',
      );

      return null;
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function configureReceiveForm(
    purchaseOrder: PharmaPurchaseOrder,
  ) {
    const firstOpenItem =
      (purchaseOrder.items ?? []).find(
        (item) =>
          remainingQuantity(item) > 0,
      );

    const firstLocation =
      locations.find(
        (location) =>
          !purchaseOrder.branch?.id ||
          location.branch.id ===
            purchaseOrder.branch.id,
      );

    setReceiveForm(
      blankReceiveForm(
        String(firstLocation?.id ?? ''),
      ),
    );

    if (firstOpenItem) {
      setReceiveForm((current) => ({
        ...current,
        purchase_order_item_id:
          String(firstOpenItem.id),
        quantity:
          String(
            remainingQuantity(
              firstOpenItem,
            ),
          ),
        unit_cost:
          String(
            firstOpenItem.unit_cost ?? '',
          ),
      }));
    }
  }

  async function openReceive(
    purchaseOrder?: PharmaPurchaseOrder,
  ) {
    if (!canReceivePurchaseOrders) {
      setError(
        'Product receiving and Procurement receiving permissions are required.',
      );
      return;
    }

    setError('');
    setNotice('');
    setIsReceiveOpen(true);

    if (!purchaseOrder) {
      setSelectedPurchaseOrder(null);
      setReceiveForm(
        blankReceiveForm(
          String(locations[0]?.id ?? ''),
        ),
      );
      return;
    }

    const detail =
      await loadPurchaseOrderDetail(
        purchaseOrder.id,
      );

    if (!detail) {
      return;
    }

    setSelectedPurchaseOrder(detail);
    configureReceiveForm(detail);
  }

  async function choosePurchaseOrder(
    purchaseOrderId: string,
  ) {
    if (!purchaseOrderId) {
      setSelectedPurchaseOrder(null);
      setReceiveForm(
        blankReceiveForm(
          String(locations[0]?.id ?? ''),
        ),
      );
      return;
    }

    const detail =
      await loadPurchaseOrderDetail(
        Number(purchaseOrderId),
      );

    if (!detail) {
      return;
    }

    setSelectedPurchaseOrder(detail);
    configureReceiveForm(detail);
  }

  async function openView(
    purchaseOrder: PharmaPurchaseOrder,
  ) {
    const detail =
      await loadPurchaseOrderDetail(
        purchaseOrder.id,
      );

    if (detail) {
      setViewingPurchaseOrder(detail);
    }
  }

  function closeReceive() {
    setIsReceiveOpen(false);
    setSelectedPurchaseOrder(null);
    setReceiveForm(
      blankReceiveForm(
        String(locations[0]?.id ?? ''),
      ),
    );
  }

  async function submitReceiving() {
    if (!canReceivePurchaseOrders) {
      setError(
        'Product receiving and Procurement receiving permissions are required.',
      );
      return;
    }

    if (
      !selectedPurchaseOrder ||
      !selectedReceiveItem?.product?.id
    ) {
      setError(
        'Select a Purchase Order item.',
      );
      return;
    }

    if (
      !receiveForm.stock_location_id ||
      !receiveForm.batch_number.trim() ||
      numberFrom(receiveForm.quantity) <= 0
    ) {
      setError(
        'Select a stock location, enter a batch number and provide a valid quantity.',
      );
      return;
    }

    if (
      numberFrom(receiveForm.quantity) >
      selectedRemainingQuantity
    ) {
      setError(
        `Received quantity cannot exceed the remaining quantity of ${selectedRemainingQuantity}.`,
      );
      return;
    }

    setIsReceiving(true);
    setError('');
    setNotice('');

    try {
      const response =
        await receivePharmaStock(
          token,
          tenantSlug,
          {
            product_id:
              selectedReceiveItem.product.id,
            stock_location_id:
              Number(
                receiveForm.stock_location_id,
              ),
            pharmaco_purchase_order_item_id:
              selectedReceiveItem.id,
            batch_number:
              receiveForm.batch_number.trim(),
            quantity:
              numberFrom(
                receiveForm.quantity,
              ),
            expiry_date:
              receiveForm.expiry_date ||
              null,
            unit_cost:
              receiveForm.unit_cost
                ? numberFrom(
                    receiveForm.unit_cost,
                  )
                : null,
            selling_price:
              receiveForm.selling_price
                ? numberFrom(
                    receiveForm.selling_price,
                  )
                : null,
            reason:
              'Stock received through the focused Procurement receiving workspace.',
          },
        );

      const refreshedOrders =
        await getPharmaPurchaseOrders(
          token,
          tenantSlug,
        );

      setPurchaseOrders(
        refreshedOrders.purchase_orders,
      );

      closeReceive();

      setNotice(
        `${response.message} Reference: ${response.movement.reference_number}.`,
      );
    } catch (receiveError) {
      setError(
        receiveError instanceof Error
          ? receiveError.message
          : 'Unable to receive stock.',
      );
    } finally {
      setIsReceiving(false);
    }
  }

  function updateTableSetting<
    TKey extends keyof ReceivingTableSettings,
  >(
    key: TKey,
    value: ReceivingTableSettings[TKey],
  ) {
    setTableSettings((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          tableSettingsKey,
          JSON.stringify(next),
        );
      }

      return next;
    });
  }

  function resetTableSettings() {
    setTableSettings(
      defaultTableSettings,
    );

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(
        tableSettingsKey,
      );
    }

    setNotice(
      'Receiving table settings restored.',
    );
  }

  const tableClassName = [
    'procurement-register-table',
    'procurement-receiving-table',
    `procurement-register-density--${tableSettings.density}`,
    `procurement-register-width--${tableSettings.widthPreset}`,
    tableSettings.wrapText
      ? 'procurement-register-wrap--on'
      : 'procurement-register-wrap--off',
    tableSettings.stickyActions
      ? 'procurement-register-sticky-actions'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const tableStyle = {
    '--procurement-table-font-size':
      `${tableSettings.fontSize}px`,
  } as CSSProperties;

  if (!canViewProcurement) {
    return null;
  }

  return (
    <section
      className="procurement-register-workspace"
      data-procurement-register="receiving"
    >
      <header className="procurement-register-header">
        <div>
          <span className="section-label">
            Goods receiving
          </span>

          <h1>Purchase Order Receiving</h1>

          <p>
            Review approved Purchase Orders through
            separate pharmaceutical and General Item
            receiving flows. Each stock domain keeps
            its own locations, quantities and ledger.
          </p>
        </div>

        <div className="procurement-register-header-actions">
          <button
            type="button"
            onClick={() => void loadWorkspace()}
            disabled={isLoading}
          >
            {isLoading
              ? 'Refreshing…'
              : 'Refresh'}
          </button>

          {canReceivePurchaseOrders && (
            <button
              type="button"
              className="primary"
              onClick={() =>
                void openReceive()
              }
            >
              Receive Pharmaceutical PO
            </button>
          )}
        </div>
      </header>

      {error && (
        <div
          className="form-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="form-success"
          role="status"
        >
          {notice}
        </div>
      )}

      <GeneralItemPurchaseOrderReceivingWorkspace
        token={token}
        profile={profile}
      />

      <section className="procurement-register-toolbar">
        <label className="procurement-register-search">
          <span>
            Search receiving queue
          </span>

          <input
            type="search"
            value={searchTerm}
            placeholder="PO number, supplier, branch, status or notes"
            onChange={(event) =>
              setSearchTerm(
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>Status</span>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
          >
            <option value="all">
              Approved and partial
            </option>
            <option value="approved">
              Approved
            </option>
            <option value="partially_received">
              Partially received
            </option>
          </select>
        </label>

        <label>
          <span>Branch</span>

          <select
            value={branchFilter}
            onChange={(event) =>
              setBranchFilter(
                event.target.value,
              )
            }
          >
            <option value="all">
              All branches
            </option>

            {branchOptions.map((branch) => (
              <option
                key={branch.id}
                value={branch.id}
              >
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        <div className="procurement-register-result-count">
          <strong>
            {filteredPurchaseOrders.length}
          </strong>
          <span>
            of {eligiblePurchaseOrders.length}{' '}
            receivable orders
          </span>
        </div>
      </section>

      <details className="admin-table-settings-panel">
        <summary className="admin-table-settings-panel__summary">
          <span>
            Table Management and Labelling
          </span>
          <small>
            Receiving queue settings
          </small>
        </summary>

        <div className="admin-table-settings-panel__content">
          <div className="procurement-table-management">
            <label>
              Font size
              <input
                type="range"
                min="12"
                max="16"
                value={tableSettings.fontSize}
                onChange={(event) =>
                  updateTableSetting(
                    'fontSize',
                    Number(
                      event.target.value,
                    ),
                  )
                }
              />
              <small>
                {tableSettings.fontSize}px
              </small>
            </label>

            <label>
              Density
              <select
                value={tableSettings.density}
                onChange={(event) =>
                  updateTableSetting(
                    'density',
                    event.target.value as
                      ReceivingTableSettings['density'],
                  )
                }
              >
                <option value="compact">
                  Compact
                </option>
                <option value="comfortable">
                  Comfortable
                </option>
                <option value="tall">
                  Tall
                </option>
              </select>
            </label>

            <label>
              Column width
              <select
                value={
                  tableSettings.widthPreset
                }
                onChange={(event) =>
                  updateTableSetting(
                    'widthPreset',
                    event.target.value as
                      ReceivingTableSettings['widthPreset'],
                  )
                }
              >
                <option value="compact">
                  Compact
                </option>
                <option value="balanced">
                  Balanced
                </option>
                <option value="wide">
                  Wide
                </option>
              </select>
            </label>

            <label className="procurement-table-toggle">
              <input
                type="checkbox"
                checked={
                  tableSettings.wrapText
                }
                onChange={(event) =>
                  updateTableSetting(
                    'wrapText',
                    event.target.checked,
                  )
                }
              />
              Wrap table text
            </label>

            <label className="procurement-table-toggle">
              <input
                type="checkbox"
                checked={
                  tableSettings.stickyActions
                }
                onChange={(event) =>
                  updateTableSetting(
                    'stickyActions',
                    event.target.checked,
                  )
                }
              />
              Sticky action column
            </label>

            <button
              type="button"
              onClick={resetTableSettings}
            >
              Reset table settings
            </button>
          </div>
        </div>
      </details>

      <section className="procurement-register-card">
        <div className="procurement-register-table-wrap">
          <table
            className={tableClassName}
            style={tableStyle}
          >
            <thead>
              <tr>
                <th>PO number</th>
                <th>Supplier</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Order date</th>
                <th>Expected delivery</th>
                <th>Items</th>
                <th>Total value</th>
                <th>Receiving readiness</th>
                <th className="procurement-register-actions-column">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredPurchaseOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="procurement-register-empty"
                  >
                    {isLoading
                      ? 'Loading receiving queue…'
                      : 'No approved or partially received pharmaceutical Purchase Order matches the current filters.'}
                  </td>
                </tr>
              ) : (
                filteredPurchaseOrders.map(
                  (purchaseOrder) => (
                    <tr key={purchaseOrder.id}>
                      <td>
                        <strong>
                          {purchaseOrder.po_number}
                        </strong>
                        <small>
                          {purchaseOrder.notes ||
                            'No notes'}
                        </small>
                      </td>

                      <td>
                        <strong>
                          {purchaseOrder.supplier
                            ?.name ||
                            'Not assigned'}
                        </strong>
                        <small>
                          {purchaseOrder.supplier
                            ?.supplier_code ||
                            'No supplier code'}
                        </small>
                      </td>

                      <td>
                        <strong>
                          {purchaseOrder.branch
                            ?.name ||
                            'Not assigned'}
                        </strong>
                        <small>
                          {purchaseOrder.branch
                            ?.code ||
                            'No branch code'}
                        </small>
                      </td>

                      <td>
                        <span
                          className={`procurement-status-badge status-${normalizedStatus(
                            purchaseOrder.status,
                          )}`}
                        >
                          {purchaseOrder.status.replaceAll(
                            '_',
                            ' ',
                          )}
                        </span>
                      </td>

                      <td>
                        {dateLabel(
                          purchaseOrder.order_date,
                        )}
                      </td>

                      <td>
                        {dateLabel(
                          purchaseOrder.expected_delivery_date,
                        )}
                      </td>

                      <td>
                        {purchaseOrder.items_count ??
                          purchaseOrder.items
                            ?.length ??
                          0}
                      </td>

                      <td>
                        {canSeeFinancials
                          ? money(
                              purchaseOrder.total_amount,
                            )
                          : 'Restricted'}
                      </td>

                      <td>
                        <span className="procurement-receiving-readiness">
                          {normalizedStatus(
                            purchaseOrder.status,
                          ) ===
                          'partially_received'
                            ? 'Continue receiving'
                            : 'Ready to receive'}
                        </span>
                      </td>

                      <td className="procurement-register-actions-column">
                        <div className="procurement-row-actions">
                          <button
                            type="button"
                            disabled={
                              isLoadingDetail
                            }
                            onClick={() =>
                              void openView(
                                purchaseOrder,
                              )
                            }
                          >
                            View
                          </button>

                          {canReceivePurchaseOrders && (
                            <button
                              type="button"
                              className="primary"
                              disabled={
                                isLoadingDetail
                              }
                              onClick={() =>
                                void openReceive(
                                  purchaseOrder,
                                )
                              }
                            >
                              Receive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <InventoryPopupForm
        id="procurement-receiving-form"
        title="Receive Purchase Order"
        description="Capture the selected Purchase Order item, receiving location, batch, expiry, quantity and pricing information."
        eyebrow="Goods receiving operation"
        footerNote="Receiving updates stock and Purchase Order quantities through the protected receiving endpoint."
        open={isReceiveOpen}
        onClose={closeReceive}
      >
        <form
          className="procurement-popup-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitReceiving();
          }}
        >
          <div className="procurement-popup-form-grid">
            <label className="procurement-popup-form-wide">
              Purchase Order
              <select
                data-popup-autofocus="true"
                value={
                  selectedPurchaseOrder?.id ??
                  ''
                }
                onChange={(event) =>
                  void choosePurchaseOrder(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select Purchase Order
                </option>

                {eligiblePurchaseOrders.map(
                  (purchaseOrder) => (
                    <option
                      key={purchaseOrder.id}
                      value={purchaseOrder.id}
                    >
                      {purchaseOrder.po_number} ·{' '}
                      {purchaseOrder.supplier
                        ?.name ||
                        'No supplier'}
                    </option>
                  ),
                )}
              </select>
            </label>

            {selectedPurchaseOrder && (
              <>
                <div className="procurement-receiving-summary procurement-popup-form-wide">
                  <div>
                    <span>Supplier</span>
                    <strong>
                      {selectedPurchaseOrder
                        .supplier?.name ||
                        'Not assigned'}
                    </strong>
                  </div>

                  <div>
                    <span>Branch</span>
                    <strong>
                      {selectedPurchaseOrder
                        .branch?.name ||
                        'Not assigned'}
                    </strong>
                  </div>

                  <div>
                    <span>Status</span>
                    <strong>
                      {selectedPurchaseOrder.status.replaceAll(
                        '_',
                        ' ',
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Remaining item quantity</span>
                    <strong>
                      {selectedRemainingQuantity}
                    </strong>
                  </div>
                </div>

                <label className="procurement-popup-form-wide">
                  Purchase Order item
                  <select
                    value={
                      receiveForm.purchase_order_item_id
                    }
                    onChange={(event) => {
                      const item =
                        selectedItems.find(
                          (entry) =>
                            entry.id ===
                            Number(
                              event.target.value,
                            ),
                        );

                      setReceiveForm(
                        (current) => ({
                          ...current,
                          purchase_order_item_id:
                            event.target.value,
                          quantity: item
                            ? String(
                                remainingQuantity(
                                  item,
                                ),
                              )
                            : '',
                          unit_cost: item
                            ? String(
                                item.unit_cost,
                              )
                            : current.unit_cost,
                        }),
                      );
                    }}
                  >
                    <option value="">
                      Select Purchase Order item
                    </option>

                    {selectedItems
                      .filter(
                        (item) =>
                          remainingQuantity(
                            item,
                          ) > 0,
                      )
                      .map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.product_name_snapshot}{' '}
                          · remaining{' '}
                          {remainingQuantity(item)}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Stock location
                  <select
                    value={
                      receiveForm.stock_location_id
                    }
                    onChange={(event) =>
                      setReceiveForm(
                        (current) => ({
                          ...current,
                          stock_location_id:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    <option value="">
                      Select stock location
                    </option>

                    {availableLocations.map(
                      (location) => (
                        <option
                          key={location.id}
                          value={location.id}
                        >
                          {location.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  Batch number
                  <input
                    value={
                      receiveForm.batch_number
                    }
                    required
                    onChange={(event) =>
                      setReceiveForm(
                        (current) => ({
                          ...current,
                          batch_number:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Quantity received
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    max={
                      selectedRemainingQuantity
                    }
                    value={
                      receiveForm.quantity
                    }
                    required
                    onChange={(event) =>
                      setReceiveForm(
                        (current) => ({
                          ...current,
                          quantity:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Expiry date
                  <input
                    type="date"
                    value={
                      receiveForm.expiry_date
                    }
                    onChange={(event) =>
                      setReceiveForm(
                        (current) => ({
                          ...current,
                          expiry_date:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Unit cost
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      receiveForm.unit_cost
                    }
                    onChange={(event) =>
                      setReceiveForm(
                        (current) => ({
                          ...current,
                          unit_cost:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Selling price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      receiveForm.selling_price
                    }
                    onChange={(event) =>
                      setReceiveForm(
                        (current) => ({
                          ...current,
                          selling_price:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </>
            )}
          </div>

          <div className="procurement-popup-actions">
            <button
              type="button"
              onClick={closeReceive}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary"
              disabled={
                isReceiving ||
                !selectedPurchaseOrder
              }
            >
              {isReceiving
                ? 'Receiving…'
                : 'Receive Stock'}
            </button>
          </div>
        </form>
      </InventoryPopupForm>

      <InventoryPopupForm
        id="procurement-receiving-view"
        title={
          viewingPurchaseOrder?.po_number ??
          'Purchase Order Receiving Detail'
        }
        description="Review ordered, received and remaining quantities before starting a receiving operation."
        eyebrow="Receiving review"
        footerNote="This view is read-only. Use Receive to capture new stock."
        open={
          viewingPurchaseOrder !== null
        }
        onClose={() =>
          setViewingPurchaseOrder(null)
        }
      >
        {viewingPurchaseOrder && (
          <div className="procurement-po-detail">
            <div className="procurement-detail-grid">
              <div>
                <span>Supplier</span>
                <strong>
                  {viewingPurchaseOrder.supplier
                    ?.name ||
                    'Not assigned'}
                </strong>
              </div>

              <div>
                <span>Branch</span>
                <strong>
                  {viewingPurchaseOrder.branch
                    ?.name ||
                    'Not assigned'}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  {viewingPurchaseOrder.status.replaceAll(
                    '_',
                    ' ',
                  )}
                </strong>
              </div>

              <div>
                <span>Expected delivery</span>
                <strong>
                  {dateLabel(
                    viewingPurchaseOrder.expected_delivery_date,
                  )}
                </strong>
              </div>
            </div>

            <div className="procurement-po-detail-table-wrap">
              <table className="procurement-po-detail-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Ordered</th>
                    <th>Received</th>
                    <th>Remaining</th>
                    <th>Unit cost</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {(
                    viewingPurchaseOrder.items ??
                    []
                  ).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>
                          {item.product_name_snapshot}
                        </strong>
                        <small>
                          {item.sku_snapshot ||
                            item.product?.sku ||
                            'No SKU'}
                        </small>
                      </td>
                      <td>
                        {item.quantity_ordered}
                      </td>
                      <td>
                        {item.quantity_received}
                      </td>
                      <td>
                        {remainingQuantity(item)}
                      </td>
                      <td>
                        {canSeeFinancials
                          ? money(item.unit_cost)
                          : 'Restricted'}
                      </td>
                      <td>
                        {item.status.replaceAll(
                          '_',
                          ' ',
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </InventoryPopupForm>
    </section>
  );
}

import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AccessProfile,
  PharmaGeneralItemLocation,
  PharmaPurchaseOrder,
  PharmaPurchaseOrderItem,
  ReceivePharmaGeneralPurchaseOrderResponse,
  getPharmaGeneralItemLocations,
  getPharmaPurchaseOrder,
  getPharmaPurchaseOrders,
  receivePharmaGeneralPurchaseOrder,
} from '../lib/api';
import { InventoryPopupForm } from './InventoryPopupForm';

type Props = {
  token: string;
  profile: AccessProfile;
};

type GeneralReceivingForm = {
  purchase_order_item_id: string;
  general_item_location_id: string;
  quantity_received: string;
  unit_cost: string;
  reference_number: string;
  received_at: string;
  notes: string;
};

function tenantSlugFrom(
  profile: AccessProfile,
): string {
  return (
    profile.tenant_assignments?.[0]?.tenant?.slug ||
    (profile.scope.is_tenant ? 'vitapharma' : '')
  );
}

function normalizedStatus(
  value: unknown,
): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll(' ', '_');
}

function numberFrom(
  value: string,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
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

function itemLabel(
  item: PharmaPurchaseOrderItem,
): string {
  const name =
    item.item_name ||
    item.product_name_snapshot ||
    'General Item';

  const code =
    item.item_code ||
    item.sku_snapshot;

  return code
    ? `${name} · ${code}`
    : name;
}

function blankForm(
  locationId = '',
): GeneralReceivingForm {
  return {
    purchase_order_item_id: '',
    general_item_location_id: locationId,
    quantity_received: '',
    unit_cost: '',
    reference_number: '',
    received_at:
      new Date().toISOString().slice(0, 10),
    notes: '',
  };
}

export function GeneralItemPurchaseOrderReceivingWorkspace({
  token,
  profile,
}: Props) {
  const [purchaseOrders, setPurchaseOrders] =
    useState<PharmaPurchaseOrder[]>([]);

  const [locations, setLocations] =
    useState<PharmaGeneralItemLocation[]>([]);

  const [
    selectedPurchaseOrder,
    setSelectedPurchaseOrder,
  ] = useState<PharmaPurchaseOrder | null>(
    null,
  );

  const [form, setForm] =
    useState<GeneralReceivingForm>(
      blankForm(),
    );

  const [latestReceipt, setLatestReceipt] =
    useState<ReceivePharmaGeneralPurchaseOrderResponse | null>(
      null,
    );

  const [isLoading, setIsLoading] =
    useState(false);

  const [isLoadingDetail, setIsLoadingDetail] =
    useState(false);

  const [isReceiving, setIsReceiving] =
    useState(false);

  const [isOpen, setIsOpen] =
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

  const canView =
    permissions.includes(
      'pharmaco.procurement.view',
    );

  const canReceive =
    permissions.includes(
      'pharmaco.procurement.purchase_order.receive',
    );

  const eligiblePurchaseOrders =
    useMemo(
      () =>
        purchaseOrders.filter(
          (purchaseOrder) =>
            purchaseOrder.purchase_type ===
              'general_items' &&
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

  const selectedItems =
    (selectedPurchaseOrder?.items ?? [])
      .filter(
        (item) =>
          remainingQuantity(item) > 0,
      );

  const selectedItem =
    selectedItems.find(
      (item) =>
        item.id ===
        Number(
          form.purchase_order_item_id,
        ),
    );

  const selectedRemainingQuantity =
    selectedItem
      ? remainingQuantity(selectedItem)
      : 0;

  const availableLocations =
    locations.filter(
      (location) =>
        location.status === 'active' &&
        (
          !selectedPurchaseOrder
            ?.branch?.id ||
          location.branch?.id ===
            selectedPurchaseOrder.branch.id
        ),
    );

  async function loadWorkspace() {
    if (!tenantSlug || !canView) {
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
        getPharmaGeneralItemLocations(
          token,
          tenantSlug,
        ),
      ]);

      setPurchaseOrders(
        purchaseOrderResponse.purchase_orders,
      );

      setLocations(
        locationResponse.locations.filter(
          (location) =>
            location.status === 'active',
        ),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load General Item receiving.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [tenantSlug]);

  function configureForm(
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
          location.status === 'active' &&
          (
            !purchaseOrder.branch?.id ||
            location.branch?.id ===
              purchaseOrder.branch.id
          ),
      );

    setForm({
      ...blankForm(
        String(firstLocation?.id ?? ''),
      ),
      purchase_order_item_id:
        firstOpenItem
          ? String(firstOpenItem.id)
          : '',
      quantity_received:
        firstOpenItem
          ? String(
              remainingQuantity(
                firstOpenItem,
              ),
            )
          : '',
      unit_cost:
        firstOpenItem
          ? String(
              firstOpenItem.unit_cost ?? '',
            )
          : '',
    });
  }

  async function selectPurchaseOrder(
    purchaseOrderId: number,
  ) {
    setIsLoadingDetail(true);
    setError('');

    try {
      const response =
        await getPharmaPurchaseOrder(
          token,
          tenantSlug,
          purchaseOrderId,
        );

      if (
        response.purchase_order
          .purchase_type !== 'general_items'
      ) {
        throw new Error(
          'Only General Items Purchase Orders can use this receiving workspace.',
        );
      }

      setSelectedPurchaseOrder(
        response.purchase_order,
      );

      configureForm(
        response.purchase_order,
      );

      setIsOpen(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load the General Items Purchase Order.',
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function closeReceiving() {
    setIsOpen(false);
    setSelectedPurchaseOrder(null);
    setForm(blankForm());
  }

  async function submitReceiving() {
    if (!canReceive) {
      setError(
        'Procurement receiving permission is required.',
      );
      return;
    }

    if (
      !selectedPurchaseOrder ||
      !selectedItem
    ) {
      setError(
        'Select a General Item Purchase Order line.',
      );
      return;
    }

    const selectedLocation =
      availableLocations.find(
        (location) =>
          location.id ===
          Number(
            form.general_item_location_id,
          ),
      );

    if (!selectedLocation) {
      setError(
        'Select an active General Item location for the Purchase Order branch.',
      );
      return;
    }

    const quantity =
      numberFrom(
        form.quantity_received,
      );

    if (quantity <= 0) {
      setError(
        'Enter a receiving quantity greater than zero.',
      );
      return;
    }

    if (
      quantity >
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
        await receivePharmaGeneralPurchaseOrder(
          token,
          tenantSlug,
          selectedPurchaseOrder.id,
          {
            pharmaco_general_purchase_order_item_id:
              selectedItem.id,
            pharmaco_general_item_location_id:
              selectedLocation.id,
            quantity_received:
              quantity,
            unit_cost:
              form.unit_cost
                ? numberFrom(
                    form.unit_cost,
                  )
                : null,
            reference_number:
              form.reference_number.trim() ||
              null,
            received_at:
              form.received_at ||
              null,
            notes:
              form.notes.trim() ||
              null,
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

      setLatestReceipt(response);

      setNotice(
        `${response.message} ${response.purchase_order_item.item_name}: ${response.purchase_order_item.quantity_received} of ${response.purchase_order_item.quantity_ordered} received.`,
      );

      window.dispatchEvent(
        new CustomEvent(
          'ubuzima:general-items-stock-changed',
          {
            detail: {
              purchaseOrderId:
                response.purchase_order.id,
              stockId:
                response.stock.id,
              movementId:
                response.movement.id,
            },
          },
        ),
      );

      closeReceiving();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to receive the General Item Purchase Order.',
      );
    } finally {
      setIsReceiving(false);
    }
  }

  if (!canView) {
    return null;
  }

  return (
    <section className="general-po-receiving-workspace">
      <header className="general-po-receiving-header">
        <div>
          <span>General Items Stock</span>

          <h2>
            General Item Purchase Order Receiving
          </h2>

          <p>
            Receive approved operational items into
            branch-specific General Item Stock. This
            flow does not create pharmaceutical batches.
          </p>
        </div>

        <div className="general-po-receiving-actions">
          <button
            type="button"
            onClick={() =>
              void loadWorkspace()
            }
            disabled={isLoading}
          >
            {isLoading
              ? 'Refreshing…'
              : 'Refresh General Items'}
          </button>
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

      {latestReceipt && (
        <div className="general-po-latest-receipt">
          <div>
            <span>Latest receipt</span>
            <strong>
              {latestReceipt.purchase_order.po_number}
            </strong>
          </div>

          <div>
            <span>Item</span>
            <strong>
              {latestReceipt.purchase_order_item.item_name}
            </strong>
          </div>

          <div>
            <span>Stock balance</span>
            <strong>
              {latestReceipt.stock.quantity_on_hand}
            </strong>
          </div>

          <div>
            <span>Movement reference</span>
            <strong>
              {latestReceipt.movement.reference_number ||
                'Recorded'}
            </strong>
          </div>
        </div>
      )}

      <div className="general-po-receiving-table-scroll">
        <table>
          <thead>
            <tr>
              <th>PO number</th>
              <th>Supplier</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Items</th>
              <th>Readiness</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {eligiblePurchaseOrders.length ===
            0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="procurement-register-empty"
                >
                  {isLoading
                    ? 'Loading General Item Purchase Orders…'
                    : 'No approved or partially received General Item Purchase Order is waiting.'}
                </td>
              </tr>
            ) : (
              eligiblePurchaseOrders.map(
                (purchaseOrder) => (
                  <tr key={purchaseOrder.id}>
                    <td>
                      <strong>
                        {purchaseOrder.po_number}
                      </strong>

                      <small>
                        General Items Purchase
                      </small>
                    </td>

                    <td>
                      {purchaseOrder.supplier?.name ||
                        'Not assigned'}
                    </td>

                    <td>
                      {purchaseOrder.branch?.name ||
                        'Not assigned'}
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
                      {purchaseOrder.items_count ??
                        purchaseOrder.items?.length ??
                        0}
                    </td>

                    <td>
                      {normalizedStatus(
                        purchaseOrder.status,
                      ) ===
                      'partially_received'
                        ? 'Continue receiving'
                        : 'Ready to receive'}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="primary"
                        disabled={
                          !canReceive ||
                          isLoadingDetail
                        }
                        onClick={() =>
                          void selectPurchaseOrder(
                            purchaseOrder.id,
                          )
                        }
                      >
                        {isLoadingDetail
                          ? 'Opening…'
                          : 'Receive'}
                      </button>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>

      <InventoryPopupForm
        id="general-item-po-receiving"
        title="Receive General Item Purchase Order"
        description="Capture an approved General Item line, branch stock location, quantity, cost and receipt reference."
        eyebrow="General Item Stock receiving"
        footerNote="This operation updates only General Item Stock, its movement ledger and the Purchase Order receiving status."
        open={isOpen}
        onClose={closeReceiving}
      >
        <form
          className="procurement-popup-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitReceiving();
          }}
        >
          {selectedPurchaseOrder && (
            <>
              <div className="general-po-receiving-context">
                <div>
                  <span>Purchase Order</span>
                  <strong>
                    {selectedPurchaseOrder.po_number}
                  </strong>
                </div>

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
              </div>

              <div className="procurement-popup-form-grid">
                <label className="procurement-popup-form-wide">
                  General Item Purchase Order line

                  <select
                    data-popup-autofocus="true"
                    value={
                      form.purchase_order_item_id
                    }
                    onChange={(event) => {
                      const item =
                        selectedItems.find(
                          (candidate) =>
                            candidate.id ===
                            Number(
                              event.target.value,
                            ),
                        );

                      setForm(
                        (current) => ({
                          ...current,
                          purchase_order_item_id:
                            event.target.value,
                          quantity_received:
                            item
                              ? String(
                                  remainingQuantity(
                                    item,
                                  ),
                                )
                              : '',
                          unit_cost:
                            item
                              ? String(
                                  item.unit_cost ??
                                    '',
                                )
                              : '',
                        }),
                      );
                    }}
                  >
                    <option value="">
                      Select General Item line
                    </option>

                    {selectedItems.map(
                      (item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {itemLabel(item)} · remaining{' '}
                          {remainingQuantity(item)}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                {selectedItem && (
                  <div className="general-po-line-quantities procurement-popup-form-wide">
                    <div>
                      <span>Ordered</span>
                      <strong>
                        {selectedItem.quantity_ordered}
                      </strong>
                    </div>

                    <div>
                      <span>Already received</span>
                      <strong>
                        {selectedItem.quantity_received}
                      </strong>
                    </div>

                    <div>
                      <span>Remaining</span>
                      <strong>
                        {selectedRemainingQuantity}
                      </strong>
                    </div>

                    <div>
                      <span>Unit</span>
                      <strong>
                        {selectedItem.unit_of_measure ||
                          'unit'}
                      </strong>
                    </div>
                  </div>
                )}

                <label>
                  General Item location

                  <select
                    value={
                      form.general_item_location_id
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          general_item_location_id:
                            event.target.value,
                        }),
                      )
                    }
                  >
                    <option value="">
                      Select active location
                    </option>

                    {availableLocations.map(
                      (location) => (
                        <option
                          key={location.id}
                          value={location.id}
                        >
                          {location.name} ·{' '}
                          {location.code}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  Quantity received

                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    max={
                      selectedRemainingQuantity ||
                      undefined
                    }
                    value={
                      form.quantity_received
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          quantity_received:
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
                    value={form.unit_cost}
                    onChange={(event) =>
                      setForm(
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
                  Receipt reference

                  <input
                    value={
                      form.reference_number
                    }
                    placeholder="GRN or delivery note"
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          reference_number:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Received date

                  <input
                    type="date"
                    value={form.received_at}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          received_at:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>

                <label className="procurement-popup-form-wide">
                  Receiving notes

                  <textarea
                    rows={3}
                    value={form.notes}
                    placeholder="Condition, delivery note or receiving remarks"
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          notes:
                            event.target.value,
                        }),
                      )
                    }
                  />
                </label>
              </div>

              {availableLocations.length ===
                0 && (
                <div
                  className="form-error"
                  role="alert"
                >
                  No active General Item location exists
                  for this Purchase Order branch. Create
                  the location under General Items
                  Management before receiving.
                </div>
              )}

              <div className="procurement-popup-actions">
                <button
                  type="button"
                  onClick={closeReceiving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={
                    isReceiving ||
                    !selectedItem ||
                    availableLocations.length ===
                      0
                  }
                >
                  {isReceiving
                    ? 'Receiving…'
                    : 'Receive General Item Stock'}
                </button>
              </div>
            </>
          )}
        </form>
      </InventoryPopupForm>
    </section>
  );
}

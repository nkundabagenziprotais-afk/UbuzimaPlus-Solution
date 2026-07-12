import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AccessProfile,
  PharmaBranch,
  PharmaProduct,
  PharmaPurchaseOrder,
  PharmaPurchaseOrderItem,
  PharmaSupplier,
  approvePharmaPurchaseOrder,
  cancelPharmaPurchaseOrder,
  createPharmaProduct,
  createPharmaPurchaseOrder,
  getPharmaBranches,
  getPharmaProducts,
  getPharmaPurchaseOrder,
  getPharmaPurchaseOrders,
  getPharmaSuppliers,
} from '../lib/api';
import { InventoryPopupForm } from './InventoryPopupForm';

type Props = {
  token: string;
  profile: AccessProfile;
  initialMode:
    | 'create'
    | 'outstanding'
    | 'received';
};

type PurchaseType =
  | 'core_products'
  | 'general_items';

type CorePurchaseOrderLineForm = {
  product_id: string;
  product_search: string;
  quantity_ordered: string;
  unit_cost: string;
  discount_amount: string;
  tax_amount: string;
  notes: string;
};

type GeneralItemMasterRecord = {
  id: number;
  uuid: string;
  name: string;
  code: string;
  unit_of_measure: string;
  reorder_level: number;
  minimum_stock_level: number;
  track_stock: boolean;
  status: string;
  description: string | null;
  total_quantity_on_hand: number | null;
  category: {
    id: number;
    uuid?: string;
    name: string;
    code: string;
    status?: string;
  } | null;
  preferred_supplier: {
    id: number;
    name: string;
    supplier_code: string;
  } | null;
};

type GeneralPurchaseOrderLineForm = {
  general_item_id: string;
  general_item_search: string;
  quantity_ordered: string;
  unit_cost: string;
  discount_amount: string;
  tax_amount: string;
  notes: string;
};

type QuickProductForm = {
  name: string;
  generic_name: string;
  sku: string;
  unit: string;
};

type PurchaseOrderForm = {
  purchase_type: PurchaseType;
  branch_id: string;
  pharmaco_supplier_id: string;
  order_date: string;
  expected_delivery_date: string;
  discount_amount: string;
  tax_amount: string;
  shipping_amount: string;
  notes: string;
  core_items: CorePurchaseOrderLineForm[];
  general_items: GeneralPurchaseOrderLineForm[];
};

type PurchaseOrderFormMode =
  | 'create'
  | 'replicate'
  | null;

const procurementApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(
    /\/$/,
    '',
  ) || '/api/v1';

function generalItemFromPurchaseOrderLine(
  item: PharmaPurchaseOrderItem,
): GeneralItemMasterRecord | null {
  const extendedItem = item as unknown as {
    general_item?:
      | GeneralItemMasterRecord
      | null;
  };

  return extendedItem.general_item ?? null;
}

function generalItemLabel(
  item: GeneralItemMasterRecord,
): string {
  return `${item.name} · ${item.code}`;
}

type PurchaseOrderTableSettings = {
  density: 'compact' | 'comfortable' | 'tall';
  fontSize: number;
  widthPreset: 'compact' | 'balanced' | 'wide';
  wrapText: boolean;
  stickyActions: boolean;
};

const tableSettingsKey =
  'ubuzima.procurement.purchase-order-table.v1';

const defaultTableSettings:
  PurchaseOrderTableSettings = {
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

function numberFrom(
  value: string,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
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
  return normalizedText(value)
    .replaceAll(' ', '_');
}

function blankCoreLine():
  CorePurchaseOrderLineForm {
  return {
    product_id: '',
    product_search: '',
    quantity_ordered: '1',
    unit_cost: '',
    discount_amount: '0',
    tax_amount: '0',
    notes: '',
  };
}

function blankGeneralLine():
  GeneralPurchaseOrderLineForm {
  return {
    general_item_id: '',
    general_item_search: '',
    quantity_ordered: '1',
    unit_cost: '',
    discount_amount: '0',
    tax_amount: '0',
    notes: '',
  };
}

function blankQuickProductForm():
  QuickProductForm {
  return {
    name: '',
    generic_name: '',
    sku: '',
    unit: 'unit',
  };
}

function blankPurchaseOrderForm(
  branchId = '',
  supplierId = '',
): PurchaseOrderForm {
  return {
    purchase_type: 'core_products',
    branch_id: branchId,
    pharmaco_supplier_id: supplierId,
    order_date:
      new Date().toISOString().slice(0, 10),
    expected_delivery_date: '',
    discount_amount: '0',
    tax_amount: '0',
    shipping_amount: '0',
    notes: '',
    core_items: [blankCoreLine()],
    general_items: [blankGeneralLine()],
  };
}

function loadTableSettings():
  PurchaseOrderTableSettings {
  if (typeof window === 'undefined') {
    return defaultTableSettings;
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(
        tableSettingsKey,
      ) ?? '{}',
    ) as Partial<PurchaseOrderTableSettings>;

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

function formFromPurchaseOrder(
  purchaseOrder: PharmaPurchaseOrder,
): PurchaseOrderForm {
  const purchaseType =
    purchaseOrder.purchase_type === 'general_items'
      ? 'general_items'
      : 'core_products';

  const detailItems =
    purchaseOrder.items ?? [];

  return {
    purchase_type: purchaseType,
    branch_id:
      purchaseOrder.branch?.id
        ? String(purchaseOrder.branch.id)
        : '',
    pharmaco_supplier_id:
      purchaseOrder.supplier?.id
        ? String(purchaseOrder.supplier.id)
        : '',
    order_date:
      new Date().toISOString().slice(0, 10),
    expected_delivery_date:
      purchaseOrder.expected_delivery_date ?? '',
    discount_amount:
      String(purchaseOrder.discount_amount ?? 0),
    tax_amount:
      String(purchaseOrder.tax_amount ?? 0),
    shipping_amount:
      String(purchaseOrder.shipping_amount ?? 0),
    notes:
      `Replicated from ${purchaseOrder.po_number}. ${
        purchaseOrder.notes ?? ''
      }`.trim(),
    core_items:
      purchaseType === 'core_products' &&
      detailItems.length > 0
        ? detailItems.map((item) => ({
            product_id:
              item.product?.id
                ? String(item.product.id)
                : '',
            product_search:
              item.product_name_snapshot
                ? `${item.product_name_snapshot} · ${
                    item.sku_snapshot ??
                    item.product?.sku ??
                    ''
                  }`.replace(/ · $/, '')
                : '',
            quantity_ordered:
              String(item.quantity_ordered),
            unit_cost:
              String(item.unit_cost),
            discount_amount:
              String(item.discount_amount ?? 0),
            tax_amount:
              String(item.tax_amount ?? 0),
            notes: item.notes ?? '',
          }))
        : [blankCoreLine()],
    general_items:
      purchaseType === 'general_items' &&
      detailItems.length > 0
        ? detailItems.map((item) => {
            const masterItem =
              generalItemFromPurchaseOrderLine(
                item,
              );

            return {
              general_item_id:
                masterItem?.id
                  ? String(masterItem.id)
                  : '',
              general_item_search:
                masterItem
                  ? generalItemLabel(masterItem)
                  : `${
                      item.item_name ??
                      item.product_name_snapshot ??
                      ''
                    }${
                      item.item_code
                        ? ` · ${item.item_code}`
                        : ''
                    }`,
              quantity_ordered:
                String(item.quantity_ordered),
              unit_cost:
                String(item.unit_cost),
              discount_amount:
                String(item.discount_amount ?? 0),
              tax_amount:
                String(item.tax_amount ?? 0),
              notes: item.notes ?? '',
            };
          })
        : [blankGeneralLine()],
  };
}

export function ProcurementPurchaseOrderWorkspace({
  token,
  profile,
  initialMode,
}: Props) {
  const [branches, setBranches] =
    useState<PharmaBranch[]>([]);
  const [products, setProducts] =
    useState<PharmaProduct[]>([]);

  const [
    generalItemMaster,
    setGeneralItemMaster,
  ] = useState<GeneralItemMasterRecord[]>([]);

  const [suppliers, setSuppliers] =
    useState<PharmaSupplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] =
    useState<PharmaPurchaseOrder[]>([]);

  const [searchTerm, setSearchTerm] =
    useState('');
  const [statusFilter, setStatusFilter] =
    useState('all');
  const [supplierFilter, setSupplierFilter] =
    useState('all');

  const [form, setForm] =
    useState<PurchaseOrderForm>(
      blankPurchaseOrderForm(),
    );
  const [formMode, setFormMode] =
    useState<PurchaseOrderFormMode>(null);

  const [
    quickProductLineIndex,
    setQuickProductLineIndex,
  ] = useState<number | null>(null);

  const [
    quickProductForm,
    setQuickProductForm,
  ] = useState<QuickProductForm>(
    blankQuickProductForm(),
  );

  const [
    isCreatingQuickProduct,
    setIsCreatingQuickProduct,
  ] = useState(false);

  const [viewingPurchaseOrder, setViewingPurchaseOrder] =
    useState<PharmaPurchaseOrder | null>(null);
  const [
    approvingPurchaseOrder,
    setApprovingPurchaseOrder,
  ] = useState<PharmaPurchaseOrder | null>(null);
  const [
    cancellingPurchaseOrder,
    setCancellingPurchaseOrder,
  ] = useState<PharmaPurchaseOrder | null>(null);

  const [cancelReason, setCancelReason] =
    useState('');

  const [tableSettings, setTableSettings] =
    useState<PurchaseOrderTableSettings>(
      loadTableSettings,
    );

  const [isLoading, setIsLoading] =
    useState(false);
  const [isSaving, setIsSaving] =
    useState(false);
  const [isLoadingDetail, setIsLoadingDetail] =
    useState(false);
  const [isApproving, setIsApproving] =
    useState(false);
  const [isCancelling, setIsCancelling] =
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

  const canCreatePurchaseOrders =
    permissions.includes(
      'pharmaco.procurement.purchase_order.create',
    );

  const canApprovePurchaseOrders =
    permissions.includes(
      'pharmaco.procurement.purchase_order.approve',
    );

  const canReadBranches =
    permissions.includes('branches.view');

  const canReadProducts =
    permissions.includes(
      'pharmaco.product_master.view',
    );

  const canManageProductMaster =
    permissions.includes(
      'pharmaco.product_master.manage',
    );

  const canSeeFinancials =
    canCreatePurchaseOrders ||
    canApprovePurchaseOrders ||
    permissions.some((permission) =>
      [
        'pharmaco.procurement.invoice.manage',
        'pharmaco.procurement.invoice.approve',
        'pharmaco.procurement.payment.view',
        'pharmaco.procurement.payment.manage',
      ].includes(permission),
    );

  const activeBranches =
    branches.filter(
      (branch) => branch.status === 'active',
    );

  const activeProducts =
    products.filter(
      (product) => product.status === 'active',
    );

  const activeGeneralItems =
    generalItemMaster.filter(
      (item) => item.status === 'active',
    );

  const activeSuppliers =
    suppliers.filter(
      (supplier) => supplier.status === 'active',
    );

  const purchaseOrderTotal = useMemo(() => {
    const sourceItems =
      form.purchase_type === 'general_items'
        ? form.general_items
        : form.core_items;

    const lineTotal =
      sourceItems.reduce(
        (sum, item) => {
          const gross =
            numberFrom(item.quantity_ordered) *
            numberFrom(item.unit_cost);

          return (
            sum +
            Math.max(
              gross -
                numberFrom(item.discount_amount) +
                numberFrom(item.tax_amount),
              0,
            )
          );
        },
        0,
      );

    return Math.max(
      lineTotal -
        numberFrom(form.discount_amount) +
        numberFrom(form.tax_amount) +
        numberFrom(form.shipping_amount),
      0,
    );
  }, [form]);

  async function loadGeneralItemMaster() {
    if (!tenantSlug || !canViewProcurement) {
      return;
    }

    const response = await fetch(
      `${procurementApiBaseUrl}/pharmaco/general-items?status=active`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Slug': tenantSlug,
        },
      },
    );

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload &&
        typeof payload === 'object' &&
        'message' in payload &&
        typeof payload.message === 'string'
          ? payload.message
          : 'Unable to load General Item Master records.';

      throw new Error(message);
    }

    const typedPayload = payload as {
      items?: GeneralItemMasterRecord[];
    };

    setGeneralItemMaster(
      (typedPayload.items ?? []).sort(
        (left, right) =>
          left.name.localeCompare(right.name),
      ),
    );
  }

  async function loadWorkspace() {
    if (!tenantSlug) {
      setError(
        'No tenant assignment is available for this account.',
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
      await loadGeneralItemMaster();

      const requests: [
        ReturnType<typeof getPharmaPurchaseOrders>,
        Promise<{ suppliers: PharmaSupplier[] }>,
        Promise<{ branches: PharmaBranch[] }>,
        Promise<{ products: PharmaProduct[] }>,
      ] = [
        getPharmaPurchaseOrders(
          token,
          tenantSlug,
        ),
        getPharmaSuppliers(
          token,
          tenantSlug,
        ),
        canReadBranches
          ? getPharmaBranches(
              token,
              tenantSlug,
            )
          : Promise.resolve({
              branches: [],
            }),
        canReadProducts
          ? getPharmaProducts(
              token,
              tenantSlug,
            )
          : Promise.resolve({
              products: [],
            }),
      ];

      const [
        purchaseOrderResponse,
        supplierResponse,
        branchResponse,
        productResponse,
      ] = await Promise.all(requests);

      setPurchaseOrders(
        purchaseOrderResponse.purchase_orders,
      );
      setSuppliers(
        supplierResponse.suppliers,
      );
      setBranches(
        branchResponse.branches,
      );
      setProducts(
        productResponse.products,
      );

      setForm((current) => ({
        ...current,
        branch_id:
          current.branch_id ||
          String(
            branchResponse.branches.find(
              (branch) =>
                branch.status === 'active',
            )?.id ?? '',
          ),
        pharmaco_supplier_id:
          current.pharmaco_supplier_id ||
          String(
            supplierResponse.suppliers.find(
              (supplier) =>
                supplier.status === 'active',
            )?.id ?? '',
          ),
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load purchase orders.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [tenantSlug]);

  useEffect(() => {
    if (
      initialMode === 'create' &&
      canCreatePurchaseOrders
    ) {
      setFormMode('create');
    }
  }, [
    initialMode,
    canCreatePurchaseOrders,
  ]);

  const filteredPurchaseOrders =
    useMemo(() => {
      const query =
        normalizedText(searchTerm);

      return purchaseOrders.filter(
        (purchaseOrder) => {
          const status =
            normalizedStatus(
              purchaseOrder.status,
            );

          const modeMatches =
            initialMode === 'received'
              ? [
                  'received',
                  'fully_received',
                ].includes(status)
              : initialMode === 'outstanding'
                ? ![
                    'received',
                    'fully_received',
                    'cancelled',
                  ].includes(status)
                : true;

          const searchMatches =
            !query ||
            [
              purchaseOrder.po_number,
              purchaseOrder.purchase_type,
              purchaseOrder.status,
              purchaseOrder.supplier?.name,
              purchaseOrder.supplier
                ?.supplier_code,
              purchaseOrder.branch?.name,
              purchaseOrder.branch?.code,
              purchaseOrder.notes,
            ].some((value) =>
              normalizedText(value).includes(
                query,
              ),
            );

          const statusMatches =
            statusFilter === 'all' ||
            status === statusFilter;

          const supplierMatches =
            supplierFilter === 'all' ||
            purchaseOrder.supplier?.id ===
              Number(supplierFilter);

          return (
            modeMatches &&
            searchMatches &&
            statusMatches &&
            supplierMatches
          );
        },
      );
    }, [
      purchaseOrders,
      searchTerm,
      statusFilter,
      supplierFilter,
      initialMode,
    ]);

  function openCreate() {
    setForm(
      blankPurchaseOrderForm(
        String(
          activeBranches[0]?.id ?? '',
        ),
        String(
          activeSuppliers[0]?.id ?? '',
        ),
      ),
    );
    setFormMode('create');
    setError('');
    setNotice('');
  }

  function closeForm() {
    setFormMode(null);
    setForm(
      blankPurchaseOrderForm(
        String(
          activeBranches[0]?.id ?? '',
        ),
        String(
          activeSuppliers[0]?.id ?? '',
        ),
      ),
    );
  }

  function updateCoreLine(
    index: number,
    patch: Partial<CorePurchaseOrderLineForm>,
  ) {
    setForm((current) => ({
      ...current,
      core_items: current.core_items.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                ...patch,
              }
            : item,
      ),
    }));
  }

  function removeCoreLine(
    index: number,
  ) {
    setForm((current) => {
      const nextItems =
        current.core_items.filter(
          (_, itemIndex) =>
            itemIndex !== index,
        );

      return {
        ...current,
        core_items:
          nextItems.length > 0
            ? nextItems
            : [blankCoreLine()],
      };
    });
  }

  function updateGeneralLine(
    index: number,
    patch: Partial<GeneralPurchaseOrderLineForm>,
  ) {
    setForm((current) => ({
      ...current,
      general_items:
        current.general_items.map(
          (item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  ...patch,
                }
              : item,
        ),
    }));
  }

  function removeGeneralLine(
    index: number,
  ) {
    setForm((current) => {
      const nextItems =
        current.general_items.filter(
          (_, itemIndex) =>
            itemIndex !== index,
        );

      return {
        ...current,
        general_items:
          nextItems.length > 0
            ? nextItems
            : [blankGeneralLine()],
      };
    });
  }

  function coreProductLabel(
    product: PharmaProduct,
  ): string {
    return `${product.name} · ${product.sku}`;
  }

  function matchingCoreProducts(
    searchValue: string,
  ): PharmaProduct[] {
    const query =
      normalizedText(searchValue);

    if (!query) {
      return activeProducts.slice(0, 8);
    }

    return activeProducts
      .filter((product) =>
        [
          product.name,
          product.generic_name,
          product.brand_name,
          product.sku,
          product.barcode,
          product.category?.name,
        ].some((value) =>
          normalizedText(value).includes(query),
        ),
      )
      .slice(0, 8);
  }

  function matchingGeneralItems(
    searchValue: string,
  ): GeneralItemMasterRecord[] {
    const query =
      normalizedText(searchValue);

    if (!query) {
      return activeGeneralItems.slice(0, 8);
    }

    return activeGeneralItems
      .filter((item) =>
        [
          item.name,
          item.code,
          item.category?.name,
          item.category?.code,
          item.unit_of_measure,
          item.description,
          item.preferred_supplier?.name,
        ].some((value) =>
          normalizedText(value).includes(query),
        ),
      )
      .slice(0, 8);
  }

  function selectGeneralItem(
    lineIndex: number,
    item: GeneralItemMasterRecord,
  ) {
    updateGeneralLine(lineIndex, {
      general_item_id: String(item.id),
      general_item_search:
        generalItemLabel(item),
    });

    setError('');
    setNotice(
      `${item.name} selected from General Item Master.`,
    );
  }

  function selectCoreProduct(
    lineIndex: number,
    product: PharmaProduct,
  ) {
    updateCoreLine(lineIndex, {
      product_id: String(product.id),
      product_search:
        coreProductLabel(product),
    });

    setError('');
    setNotice(
      `${product.name} selected from Product Master.`,
    );
  }

  function openQuickProductCreate(
    lineIndex: number,
  ) {
    if (!canManageProductMaster) {
      setError(
        'The product does not exist in Product Master. Product Master management permission is required to create it.',
      );
      return;
    }

    const searchValue =
      form.core_items[lineIndex]
        ?.product_search
        .trim() ?? '';

    setQuickProductLineIndex(lineIndex);
    setQuickProductForm({
      ...blankQuickProductForm(),
      name: searchValue,
    });
    setError('');
    setNotice('');
  }

  function closeQuickProductCreate() {
    setQuickProductLineIndex(null);
    setQuickProductForm(
      blankQuickProductForm(),
    );
  }

  async function saveQuickProduct() {
    if (
      quickProductLineIndex === null ||
      !canManageProductMaster
    ) {
      return;
    }

    if (
      !quickProductForm.name.trim() ||
      !quickProductForm.sku.trim() ||
      !quickProductForm.unit.trim()
    ) {
      setError(
        'Product name, drug code/SKU and unit are required.',
      );
      return;
    }

    setIsCreatingQuickProduct(true);
    setError('');
    setNotice('');

    try {
      const response =
        await createPharmaProduct(
          token,
          tenantSlug,
          {
            name:
              quickProductForm.name.trim(),
            generic_name:
              quickProductForm.generic_name.trim() ||
              null,
            sku:
              quickProductForm.sku.trim(),
            unit:
              quickProductForm.unit.trim(),
            product_type: 'medicine',
            regulatory_status: 'approved',
            requires_prescription: false,
            is_controlled: false,
            reorder_level: 0,
            minimum_stock_level: 0,
            status: 'active',
          },
        );

      setProducts((current) => {
        const withoutDuplicate =
          current.filter(
            (product) =>
              product.id !==
              response.product.id,
          );

        return [
          ...withoutDuplicate,
          response.product,
        ].sort((left, right) =>
          left.name.localeCompare(right.name),
        );
      });

      selectCoreProduct(
        quickProductLineIndex,
        response.product,
      );

      closeQuickProductCreate();

      setNotice(
        `${response.product.name} was created in Product Master and selected for this Core Products Purchase.`,
      );
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : 'Unable to create the Product Master record.',
      );
    } finally {
      setIsCreatingQuickProduct(false);
    }
  }

  async function savePurchaseOrder() {
    if (!canCreatePurchaseOrders) {
      setError(
        'Purchase-order creation permission is required.',
      );
      return;
    }

    if (
      !form.branch_id ||
      !form.pharmaco_supplier_id
    ) {
      setError(
        'Select an active branch and supplier.',
      );
      return;
    }

    const commonPayload = {
      branch_id:
        Number(form.branch_id),
      pharmaco_supplier_id:
        Number(form.pharmaco_supplier_id),
      order_date:
        form.order_date || null,
      expected_delivery_date:
        form.expected_delivery_date || null,
      discount_amount:
        numberFrom(form.discount_amount),
      tax_amount:
        numberFrom(form.tax_amount),
      shipping_amount:
        numberFrom(form.shipping_amount),
      notes:
        form.notes.trim() || null,
    };

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response =
        form.purchase_type === 'general_items'
          ? await createPharmaPurchaseOrder(
              token,
              tenantSlug,
              {
                ...commonPayload,
                purchase_type: 'general_items',
                general_items:
                  form.general_items
                    .filter(
                      (item) =>
                        item.general_item_id &&
                        numberFrom(
                          item.quantity_ordered,
                        ) > 0,
                    )
                    .map((item) => ({
                      general_item_id:
                        Number(
                          item.general_item_id,
                        ),
                      quantity_ordered:
                        numberFrom(
                          item.quantity_ordered,
                        ),
                      unit_cost:
                        numberFrom(item.unit_cost),
                      discount_amount:
                        numberFrom(
                          item.discount_amount,
                        ),
                      tax_amount:
                        numberFrom(
                          item.tax_amount,
                        ),
                      notes:
                        item.notes.trim() ||
                        null,
                    })),
              },
            )
          : await createPharmaPurchaseOrder(
              token,
              tenantSlug,
              {
                ...commonPayload,
                purchase_type: 'core_products',
                items:
                  form.core_items
                    .filter(
                      (item) =>
                        item.product_id &&
                        numberFrom(
                          item.quantity_ordered,
                        ) > 0,
                    )
                    .map((item) => ({
                      product_id:
                        Number(item.product_id),
                      quantity_ordered:
                        numberFrom(
                          item.quantity_ordered,
                        ),
                      unit_cost:
                        numberFrom(item.unit_cost),
                      discount_amount:
                        numberFrom(
                          item.discount_amount,
                        ),
                      tax_amount:
                        numberFrom(
                          item.tax_amount,
                        ),
                      notes:
                        item.notes.trim() ||
                        null,
                    })),
              },
            );

      const refreshed =
        await getPharmaPurchaseOrders(
          token,
          tenantSlug,
        );

      setPurchaseOrders(
        refreshed.purchase_orders,
      );

      setViewingPurchaseOrder(
        response.purchase_order,
      );

      setNotice(response.message);
      closeForm();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save purchase order.',
      );
    } finally {
      setIsSaving(false);
    }
  }

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
          : 'Unable to load purchase-order details.',
      );

      return null;
    } finally {
      setIsLoadingDetail(false);
    }
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

  async function openReplicate(
    purchaseOrder: PharmaPurchaseOrder,
  ) {
    if (!canCreatePurchaseOrders) {
      setError(
        'Purchase-order creation permission is required.',
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

    setForm(
      formFromPurchaseOrder(detail),
    );
    setFormMode('replicate');
  }

  async function confirmApproval() {
    if (
      !approvingPurchaseOrder ||
      !canApprovePurchaseOrders
    ) {
      return;
    }

    setIsApproving(true);
    setError('');
    setNotice('');

    try {
      const response =
        await approvePharmaPurchaseOrder(
          token,
          tenantSlug,
          approvingPurchaseOrder.id,
        );

      setPurchaseOrders((current) =>
        current.map((purchaseOrder) =>
          purchaseOrder.id ===
          response.purchase_order.id
            ? response.purchase_order
            : purchaseOrder,
        ),
      );

      setApprovingPurchaseOrder(null);
      setNotice(response.message);
    } catch (approvalError) {
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : 'Unable to approve purchase order.',
      );
    } finally {
      setIsApproving(false);
    }
  }

  async function confirmCancellation() {
    if (
      !cancellingPurchaseOrder ||
      !canApprovePurchaseOrders
    ) {
      return;
    }

    setIsCancelling(true);
    setError('');
    setNotice('');

    try {
      const response =
        await cancelPharmaPurchaseOrder(
          token,
          tenantSlug,
          cancellingPurchaseOrder.id,
          cancelReason.trim(),
        );

      setPurchaseOrders((current) =>
        current.map((purchaseOrder) =>
          purchaseOrder.id ===
          response.purchase_order.id
            ? response.purchase_order
            : purchaseOrder,
        ),
      );

      setCancellingPurchaseOrder(null);
      setCancelReason('');
      setNotice(response.message);
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : 'Unable to cancel purchase order.',
      );
    } finally {
      setIsCancelling(false);
    }
  }

  function updateTableSetting<
    TKey extends keyof PurchaseOrderTableSettings,
  >(
    key: TKey,
    value:
      PurchaseOrderTableSettings[TKey],
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
      'Purchase Order table settings restored.',
    );
  }

  const tableClassName = [
    'procurement-register-table',
    'procurement-purchase-order-table',
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

  const pageTitle =
    initialMode === 'received'
      ? 'Received Purchase Orders'
      : initialMode === 'outstanding'
        ? 'Outstanding Purchase Orders'
        : 'Purchase Order Register';

  if (!canViewProcurement) {
    return null;
  }

  return (
    <section
      className="procurement-register-workspace"
      data-procurement-register="purchase-orders"
    >
      <header className="procurement-register-header">
        <div>
          <span className="section-label">
            Purchase-order management
          </span>

          <h1>{pageTitle}</h1>

          <p>
            Search, review, replicate, approve and
            cancel purchase orders through a
            controlled table-first workspace.
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

          {canCreatePurchaseOrders && (
            <button
              type="button"
              className="primary"
              onClick={openCreate}
            >
              Add New Purchase Order
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

      <section className="procurement-register-toolbar procurement-po-toolbar">
        <label className="procurement-register-search">
          <span>Search purchase orders</span>

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
              All statuses
            </option>
            <option value="draft">
              Draft
            </option>
            <option value="approved">
              Approved
            </option>
            <option value="partially_received">
              Partially received
            </option>
            <option value="received">
              Received
            </option>
            <option value="fully_received">
              Fully received
            </option>
            <option value="cancelled">
              Cancelled
            </option>
          </select>
        </label>

        <label>
          <span>Supplier</span>

          <select
            value={supplierFilter}
            onChange={(event) =>
              setSupplierFilter(
                event.target.value,
              )
            }
          >
            <option value="all">
              All suppliers
            </option>

            {suppliers.map((supplier) => (
              <option
                key={supplier.id}
                value={supplier.id}
              >
                {supplier.name}
              </option>
            ))}
          </select>
        </label>

        <div className="procurement-register-result-count">
          <strong>
            {filteredPurchaseOrders.length}
          </strong>
          <span>
            of {purchaseOrders.length} orders
          </span>
        </div>
      </section>

      <details className="admin-table-settings-panel">
        <summary className="admin-table-settings-panel__summary">
          <span>
            Table Management and Labelling
          </span>
          <small>
            Purchase Order register settings
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
                      PurchaseOrderTableSettings['density'],
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
                      PurchaseOrderTableSettings['widthPreset'],
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
                <th>Order date</th>
                <th>Expected delivery</th>
                <th>Items</th>
                <th>Status</th>
                <th>Total value</th>
                <th className="procurement-register-actions-column">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredPurchaseOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="procurement-register-empty"
                  >
                    {isLoading
                      ? 'Loading purchase orders…'
                      : 'No purchase order matches the current page, search and filters.'}
                  </td>
                </tr>
              ) : (
                filteredPurchaseOrders.map(
                  (purchaseOrder) => {
                    const status =
                      normalizedStatus(
                        purchaseOrder.status,
                      );

                    const canApprove =
                      canApprovePurchaseOrders &&
                      status === 'draft';

                    const canCancel =
                      canApprovePurchaseOrders &&
                      ![
                        'received',
                        'fully_received',
                        'cancelled',
                      ].includes(status);

                    return (
                      <tr
                        key={purchaseOrder.id}
                      >
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
                          <span
                            className={`procurement-status-badge status-${status}`}
                          >
                            {purchaseOrder.status.replaceAll(
                              '_',
                              ' ',
                            )}
                          </span>
                        </td>

                        <td>
                          {canSeeFinancials
                            ? money(
                                purchaseOrder.total_amount,
                              )
                            : 'Restricted'}
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

                            {canCreatePurchaseOrders && (
                              <button
                                type="button"
                                disabled={
                                  isLoadingDetail
                                }
                                onClick={() =>
                                  void openReplicate(
                                    purchaseOrder,
                                  )
                                }
                              >
                                Replicate
                              </button>
                            )}

                            {canApprove && (
                              <button
                                type="button"
                                className="success"
                                onClick={() =>
                                  setApprovingPurchaseOrder(
                                    purchaseOrder,
                                  )
                                }
                              >
                                Approve
                              </button>
                            )}

                            {canCancel && (
                              <button
                                type="button"
                                className="warning"
                                onClick={() => {
                                  setCancellingPurchaseOrder(
                                    purchaseOrder,
                                  );
                                  setCancelReason('');
                                }}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <InventoryPopupForm
        id="procurement-purchase-order-form"
        title={
          formMode === 'replicate'
            ? 'Replicate Purchase Order'
            : 'Add New Purchase Order'
        }
        description={
          formMode === 'replicate'
            ? 'Review the copied purchase-order information before creating a new controlled draft.'
            : 'Choose Core Products Purchase or General Items Purchase, then create a controlled draft for the approved supplier and branch.'
        }
        eyebrow="Procurement operation"
        footerNote="Creating a purchase order does not approve or receive it. Those actions remain separately controlled."
        open={formMode !== null}
        onClose={closeForm}
      >
        <form
          className="procurement-popup-form procurement-po-popup-form"
          onSubmit={(event) => {
            event.preventDefault();
            void savePurchaseOrder();
          }}
        >
          <section
            className="procurement-purchase-type-selector"
            aria-label="Purchase type"
          >
            <button
              type="button"
              className={
                form.purchase_type ===
                'core_products'
                  ? 'active'
                  : ''
              }
              aria-pressed={
                form.purchase_type ===
                'core_products'
              }
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  purchase_type:
                    'core_products',
                  core_items:
                    current.core_items.length > 0
                      ? current.core_items
                      : [blankCoreLine()],
                }))
              }
            >
              <strong>
                Core Products Purchase
              </strong>
              <span>
                Only active products from Product Master can be ordered.
              </span>
            </button>

            <button
              type="button"
              className={
                form.purchase_type ===
                'general_items'
                  ? 'active'
                  : ''
              }
              aria-pressed={
                form.purchase_type ===
                'general_items'
              }
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  purchase_type:
                    'general_items',
                  general_items:
                    current.general_items.length > 0
                      ? current.general_items
                      : [blankGeneralLine()],
                }))
              }
            >
              <strong>
                General Items Purchase
              </strong>
              <span>
                Select reusable records from General Item Master. Category, item code and unit remain controlled master data outside pharmaceutical Product Inventory.
              </span>
            </button>
          </section>

          <div className="procurement-popup-form-grid">
            <label>
              Branch
              <select
                data-popup-autofocus="true"
                value={form.branch_id}
                required
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    branch_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">
                  Select branch
                </option>

                {activeBranches.map((branch) => (
                  <option
                    key={branch.id}
                    value={branch.id}
                  >
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Supplier
              <select
                value={
                  form.pharmaco_supplier_id
                }
                required
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pharmaco_supplier_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">
                  Select supplier
                </option>

                {activeSuppliers.map(
                  (supplier) => (
                    <option
                      key={supplier.id}
                      value={supplier.id}
                    >
                      {supplier.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Order date
              <input
                type="date"
                value={form.order_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    order_date:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Expected delivery date
              <input
                type="date"
                value={
                  form.expected_delivery_date
                }
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expected_delivery_date:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Order discount
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discount_amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    discount_amount:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Order tax
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.tax_amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tax_amount:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Shipping amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.shipping_amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    shipping_amount:
                      event.target.value,
                  }))
                }
              />
            </label>

            <div className="procurement-po-preview">
              <span>
                Purchase Order preview
              </span>
              <strong>
                {money(purchaseOrderTotal)}
              </strong>
            </div>

            <label className="procurement-popup-form-wide">
              Notes
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <section className="procurement-po-line-section">
            <header>
              <div>
                <span className="section-label">
                  {form.purchase_type ===
                  'core_products'
                    ? 'Core Products Purchase'
                    : 'General Items Purchase'}
                </span>

                <h3>
                  {form.purchase_type ===
                  'core_products'
                    ? 'Product Master products and quantities'
                    : 'General Item Master records and quantities'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setForm((current) =>
                    current.purchase_type ===
                    'core_products'
                      ? {
                          ...current,
                          core_items: [
                            ...current.core_items,
                            blankCoreLine(),
                          ],
                        }
                      : {
                          ...current,
                          general_items: [
                            ...current.general_items,
                            blankGeneralLine(),
                          ],
                        },
                  )
                }
              >
                {form.purchase_type ===
                'core_products'
                  ? 'Add Product Line'
                  : 'Add General Item'}
              </button>
            </header>

            {form.purchase_type ===
            'core_products' ? (
              <div className="procurement-po-line-list">
                {form.core_items.map(
                  (item, index) => {
                    const matches =
                      matchingCoreProducts(
                        item.product_search,
                      );

                    const selectedProduct =
                      activeProducts.find(
                        (product) =>
                          String(product.id) ===
                          item.product_id,
                      );

                    const productMissing =
                      item.product_search.trim()
                        .length >= 2 &&
                      !item.product_id &&
                      matches.length === 0;

                    return (
                      <article
                        key={index}
                        className="procurement-po-line-card procurement-core-product-line"
                      >
                        <label className="procurement-po-product-field">
                          Product from Product Master

                          <input
                            type="search"
                            value={
                              item.product_search
                            }
                            placeholder="Search by product name, generic name, SKU or barcode"
                            autoComplete="off"
                            onChange={(event) =>
                              updateCoreLine(
                                index,
                                {
                                  product_search:
                                    event.target
                                      .value,
                                  product_id: '',
                                },
                              )
                            }
                          />

                          {item.product_search.trim() &&
                            !selectedProduct &&
                            matches.length > 0 && (
                              <div className="procurement-product-search-results">
                                {matches.map(
                                  (product) => (
                                    <button
                                      key={
                                        product.id
                                      }
                                      type="button"
                                      onClick={() =>
                                        selectCoreProduct(
                                          index,
                                          product,
                                        )
                                      }
                                    >
                                      <strong>
                                        {product.name}
                                      </strong>

                                      <span>
                                        {product.generic_name ||
                                          'Generic name not recorded'}
                                      </span>

                                      <small>
                                        SKU: {product.sku}
                                      </small>
                                    </button>
                                  ),
                                )}
                              </div>
                            )}

                          {selectedProduct && (
                            <div className="procurement-selected-product">
                              <strong>
                                {selectedProduct.name}
                              </strong>

                              <span>
                                {selectedProduct.generic_name ||
                                  'Generic name not recorded'}
                              </span>

                              <small>
                                SKU: {selectedProduct.sku}
                              </small>
                            </div>
                          )}

                          {productMissing && (
                            <div
                              className="procurement-product-missing"
                              role="status"
                            >
                              <strong>
                                Product does not exist in Product Master.
                              </strong>

                              <span>
                                Create the Product Master record before adding stock or completing this Core Products Purchase.
                              </span>

                              {canManageProductMaster ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openQuickProductCreate(
                                      index,
                                    )
                                  }
                                >
                                  Create Product in Product Master
                                </button>
                              ) : (
                                <small>
                                  Product Master management permission is required. Ask an authorised Product Master user to create it.
                                </small>
                              )}
                            </div>
                          )}
                        </label>

                        <label>
                          Quantity
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={
                              item.quantity_ordered
                            }
                            onChange={(event) =>
                              updateCoreLine(
                                index,
                                {
                                  quantity_ordered:
                                    event.target
                                      .value,
                                },
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
                            value={item.unit_cost}
                            onChange={(event) =>
                              updateCoreLine(
                                index,
                                {
                                  unit_cost:
                                    event.target
                                      .value,
                                },
                              )
                            }
                          />
                        </label>

                        <label>
                          Discount
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              item.discount_amount
                            }
                            onChange={(event) =>
                              updateCoreLine(
                                index,
                                {
                                  discount_amount:
                                    event.target
                                      .value,
                                },
                              )
                            }
                          />
                        </label>

                        <label>
                          Tax
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              item.tax_amount
                            }
                            onChange={(event) =>
                              updateCoreLine(
                                index,
                                {
                                  tax_amount:
                                    event.target
                                      .value,
                                },
                              )
                            }
                          />
                        </label>

                        <label className="procurement-po-line-notes">
                          Line notes
                          <input
                            value={item.notes}
                            onChange={(event) =>
                              updateCoreLine(
                                index,
                                {
                                  notes:
                                    event.target
                                      .value,
                                },
                              )
                            }
                          />
                        </label>

                        <button
                          type="button"
                          className="danger procurement-po-remove-line"
                          onClick={() =>
                            removeCoreLine(index)
                          }
                        >
                          Remove
                        </button>
                      </article>
                    );
                  },
                )}
              </div>
            ) : (
              <div className="procurement-po-line-list">
                {form.general_items.map(
                  (item, index) => {
                    const matches =
                      matchingGeneralItems(
                        item.general_item_search,
                      );

                    const selectedGeneralItem =
                      activeGeneralItems.find(
                        (masterItem) =>
                          String(masterItem.id) ===
                          item.general_item_id,
                      );

                    const itemMissing =
                      item.general_item_search
                        .trim().length >= 2 &&
                      !item.general_item_id &&
                      matches.length === 0;

                    return (
                      <article
                        key={index}
                        className="procurement-po-line-card procurement-general-item-line procurement-general-master-line"
                      >
                        <label className="procurement-po-product-field">
                          General Item from General Item Master

                          <input
                            type="search"
                            value={
                              item.general_item_search
                            }
                            placeholder="Search by item name, code, category or unit"
                            autoComplete="off"
                            onChange={(event) =>
                              updateGeneralLine(
                                index,
                                {
                                  general_item_search:
                                    event.target.value,
                                  general_item_id: '',
                                },
                              )
                            }
                          />

                          {item.general_item_search.trim() &&
                            !selectedGeneralItem &&
                            matches.length > 0 && (
                              <div className="procurement-product-search-results procurement-general-item-search-results">
                                {matches.map(
                                  (masterItem) => (
                                    <button
                                      key={masterItem.id}
                                      type="button"
                                      onClick={() =>
                                        selectGeneralItem(
                                          index,
                                          masterItem,
                                        )
                                      }
                                    >
                                      <strong>
                                        {masterItem.name}
                                      </strong>

                                      <span>
                                        {masterItem.category
                                          ?.name ??
                                          'Unclassified General Item'}
                                      </span>

                                      <small>
                                        Code:{' '}
                                        {masterItem.code}{' '}
                                        · Unit:{' '}
                                        {
                                          masterItem.unit_of_measure
                                        }
                                      </small>
                                    </button>
                                  ),
                                )}
                              </div>
                            )}

                          {selectedGeneralItem && (
                            <div className="procurement-selected-product procurement-selected-general-item">
                              <strong>
                                {selectedGeneralItem.name}
                              </strong>

                              <span>
                                {selectedGeneralItem
                                  .category?.name ??
                                  'Unclassified General Item'}
                              </span>

                              <small>
                                Code:{' '}
                                {selectedGeneralItem.code}{' '}
                                · Unit:{' '}
                                {
                                  selectedGeneralItem.unit_of_measure
                                }
                              </small>
                            </div>
                          )}

                          {itemMissing && (
                            <div
                              className="procurement-product-missing"
                              role="status"
                            >
                              <strong>
                                General Item does not exist in General Item Master.
                              </strong>

                              <span>
                                Create and classify the item under Procurement → General Item Master before using it in a Purchase Order.
                              </span>

                              <small>
                                Item name, code, category and unit cannot be entered as uncontrolled free text.
                              </small>
                            </div>
                          )}
                        </label>

                        <div className="procurement-general-item-master-facts">
                          <div>
                            <span>Item code</span>
                            <strong>
                              {selectedGeneralItem
                                ?.code ??
                                'Select an item'}
                            </strong>
                          </div>

                          <div>
                            <span>Category</span>
                            <strong>
                              {selectedGeneralItem
                                ?.category?.name ??
                                'Controlled by master'}
                            </strong>
                          </div>

                          <div>
                            <span>Unit</span>
                            <strong>
                              {selectedGeneralItem
                                ?.unit_of_measure ??
                                'Controlled by master'}
                            </strong>
                          </div>
                        </div>

                        <label>
                          Quantity
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={item.quantity_ordered}
                            onChange={(event) =>
                              updateGeneralLine(
                                index,
                                {
                                  quantity_ordered:
                                    event.target.value,
                                },
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
                            value={item.unit_cost}
                            onChange={(event) =>
                              updateGeneralLine(
                                index,
                                {
                                  unit_cost:
                                    event.target.value,
                                },
                              )
                            }
                          />
                        </label>

                        <label>
                          Discount
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount_amount}
                            onChange={(event) =>
                              updateGeneralLine(
                                index,
                                {
                                  discount_amount:
                                    event.target.value,
                                },
                              )
                            }
                          />
                        </label>

                        <label>
                          Tax
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.tax_amount}
                            onChange={(event) =>
                              updateGeneralLine(
                                index,
                                {
                                  tax_amount:
                                    event.target.value,
                                },
                              )
                            }
                          />
                        </label>

                        <label className="procurement-po-line-notes">
                          Line notes
                          <input
                            value={item.notes}
                            onChange={(event) =>
                              updateGeneralLine(
                                index,
                                {
                                  notes:
                                    event.target.value,
                                },
                              )
                            }
                          />
                        </label>

                        <button
                          type="button"
                          className="danger procurement-po-remove-line"
                          onClick={() =>
                            removeGeneralLine(index)
                          }
                        >
                          Remove
                        </button>
                      </article>
                    );
                  },
                )}
              </div>
            )}
          </section>

          <div className="procurement-popup-actions">
            <button
              type="button"
              onClick={closeForm}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary"
              disabled={isSaving}
            >
              {isSaving
                ? 'Saving…'
                : 'Create Purchase Order'}
            </button>
          </div>
        </form>
      </InventoryPopupForm>

      <InventoryPopupForm
        id="procurement-quick-product-master-create"
        title="Create Product Master Record"
        description="The searched product was not found. Create the minimum approved Product Master record, then return automatically to the current Core Products Purchase."
        eyebrow="Product Master quick creation"
        footerNote="The Purchase Order form remains open. The newly created product will be selected automatically."
        open={quickProductLineIndex !== null}
        onClose={closeQuickProductCreate}
      >
        <form
          className="procurement-quick-product-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveQuickProduct();
          }}
        >
          <label>
            Product name
            <input
              data-popup-autofocus="true"
              value={quickProductForm.name}
              onChange={(event) =>
                setQuickProductForm(
                  (current) => ({
                    ...current,
                    name: event.target.value,
                  }),
                )
              }
              required
            />
          </label>

          <label>
            Generic name
            <input
              value={
                quickProductForm.generic_name
              }
              onChange={(event) =>
                setQuickProductForm(
                  (current) => ({
                    ...current,
                    generic_name:
                      event.target.value,
                  }),
                )
              }
            />
          </label>

          <label>
            Drug code / SKU
            <input
              value={quickProductForm.sku}
              onChange={(event) =>
                setQuickProductForm(
                  (current) => ({
                    ...current,
                    sku: event.target.value,
                  }),
                )
              }
              required
            />
          </label>

          <label>
            Unit
            <input
              value={quickProductForm.unit}
              onChange={(event) =>
                setQuickProductForm(
                  (current) => ({
                    ...current,
                    unit: event.target.value,
                  }),
                )
              }
              required
            />
          </label>

          <div className="procurement-popup-actions procurement-quick-product-actions">
            <button
              type="button"
              onClick={closeQuickProductCreate}
            >
              Return to Purchase Order
            </button>

            <button
              type="submit"
              className="primary"
              disabled={
                isCreatingQuickProduct
              }
            >
              {isCreatingQuickProduct
                ? 'Creating…'
                : 'Create and Select Product'}
            </button>
          </div>
        </form>
      </InventoryPopupForm>

      <InventoryPopupForm
        id="procurement-purchase-order-view"
        title={
          viewingPurchaseOrder?.po_number ??
          'Purchase Order Details'
        }
        description="Review the complete Purchase Order, item quantities and current approval or receiving status."
        eyebrow="Purchase Order record"
        footerNote="This view is read-only. Approval, cancellation and receiving remain separate controlled actions."
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
                <span>Purchase type</span>
                <strong>
                  {viewingPurchaseOrder.purchase_type ===
                  'general_items'
                    ? 'General Items Purchase'
                    : 'Core Products Purchase'}
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
                <span>Order date</span>
                <strong>
                  {dateLabel(
                    viewingPurchaseOrder.order_date,
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

              <div>
                <span>Total value</span>
                <strong>
                  {canSeeFinancials
                    ? money(
                        viewingPurchaseOrder.total_amount,
                      )
                    : 'Restricted'}
                </strong>
              </div>

              <div className="procurement-detail-wide">
                <span>Notes</span>
                <strong>
                  {viewingPurchaseOrder.notes ||
                    'No notes recorded'}
                </strong>
              </div>
            </div>

            <div className="procurement-po-detail-table-wrap">
              <table className="procurement-po-detail-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Ordered</th>
                    <th>Received</th>
                    <th>Remaining</th>
                    <th>Unit cost</th>
                    <th>Line total</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {(
                    viewingPurchaseOrder.items ??
                    []
                  ).map(
                    (
                      item:
                        PharmaPurchaseOrderItem,
                    ) => (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {item.item_name ||
                              item.product_name_snapshot}
                          </strong>
                          <small>
                            {item.item_type ===
                            'general_item'
                              ? [
                                  item.item_code,
                                  item.category,
                                  item.unit_of_measure,
                                ]
                                  .filter(Boolean)
                                  .join(' · ') ||
                                'General item'
                              : item.sku_snapshot ||
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
                          {Math.max(
                            Number(
                              item.quantity_ordered,
                            ) -
                              Number(
                                item.quantity_received,
                              ),
                            0,
                          )}
                        </td>
                        <td>
                          {canSeeFinancials
                            ? money(item.unit_cost)
                            : 'Restricted'}
                        </td>
                        <td>
                          {canSeeFinancials
                            ? money(item.line_total)
                            : 'Restricted'}
                        </td>
                        <td>
                          {item.status.replaceAll(
                            '_',
                            ' ',
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </InventoryPopupForm>

      <InventoryPopupForm
        id="procurement-purchase-order-approval"
        title="Approve Purchase Order"
        description="Confirm that this draft Purchase Order has been reviewed and is ready for controlled downstream processing."
        eyebrow="Purchase Order approval"
        footerNote="Approval is recorded through the protected Procurement approval endpoint."
        open={
          approvingPurchaseOrder !== null
        }
        onClose={() =>
          setApprovingPurchaseOrder(null)
        }
      >
        {approvingPurchaseOrder && (
          <div className="procurement-confirmation">
            <strong>
              {approvingPurchaseOrder.po_number}
            </strong>

            <p>
              Supplier:{' '}
              {approvingPurchaseOrder.supplier
                ?.name ||
                'Not assigned'}
              . Total:{' '}
              {canSeeFinancials
                ? money(
                    approvingPurchaseOrder.total_amount,
                  )
                : 'Restricted'}.
            </p>

            <div className="procurement-popup-actions">
              <button
                type="button"
                onClick={() =>
                  setApprovingPurchaseOrder(null)
                }
              >
                Keep as Draft
              </button>

              <button
                type="button"
                className="primary"
                disabled={isApproving}
                onClick={() =>
                  void confirmApproval()
                }
              >
                {isApproving
                  ? 'Approving…'
                  : 'Approve Purchase Order'}
              </button>
            </div>
          </div>
        )}
      </InventoryPopupForm>

      <InventoryPopupForm
        id="procurement-purchase-order-cancellation"
        title="Cancel Purchase Order"
        description="Confirm this controlled cancellation and record the reason for the audit trail."
        eyebrow="Purchase Order cancellation"
        footerNote="Cancellation preserves the Purchase Order record and its audit history."
        open={
          cancellingPurchaseOrder !== null
        }
        onClose={() => {
          setCancellingPurchaseOrder(null);
          setCancelReason('');
        }}
      >
        {cancellingPurchaseOrder && (
          <div className="procurement-confirmation">
            <strong>
              {cancellingPurchaseOrder.po_number}
            </strong>

            <p>
              Cancellation prevents further approval
              or receiving against this Purchase
              Order.
            </p>

            <label className="procurement-confirmation-reason">
              Cancellation reason
              <textarea
                rows={3}
                value={cancelReason}
                placeholder="Record why this Purchase Order is being cancelled"
                onChange={(event) =>
                  setCancelReason(
                    event.target.value,
                  )
                }
              />
            </label>

            <div className="procurement-popup-actions">
              <button
                type="button"
                onClick={() => {
                  setCancellingPurchaseOrder(null);
                  setCancelReason('');
                }}
              >
                Keep Purchase Order
              </button>

              <button
                type="button"
                className="danger"
                disabled={isCancelling}
                onClick={() =>
                  void confirmCancellation()
                }
              >
                {isCancelling
                  ? 'Cancelling…'
                  : 'Cancel Purchase Order'}
              </button>
            </div>
          </div>
        )}
      </InventoryPopupForm>
    </section>
  );
}

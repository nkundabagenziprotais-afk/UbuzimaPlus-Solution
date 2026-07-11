import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AccessProfile } from '../lib/api';

export type GeneralItemsWorkspaceMode =
  | 'overview'
  | 'categories'
  | 'master'
  | 'stock'
  | 'receiving'
  | 'usage';

type Props = {
  token: string;
  profile: AccessProfile;
  initialMode: GeneralItemsWorkspaceMode;
};

type Category = {
  id: number;
  uuid: string;
  name: string;
  code: string;
  status: string;
  description: string | null;
  items_count: number | null;
};

type Supplier = {
  id: number;
  name: string;
  supplier_code: string;
  status: string;
};

type Branch = {
  id: number;
  name: string;
  code: string;
  status: string;
};

type GeneralItem = {
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
  category: Category | null;
  preferred_supplier: Supplier | null;
};

type Location = {
  id: number;
  uuid: string;
  name: string;
  code: string;
  location_type: string;
  status: string;
  description: string | null;
  stocks_count: number | null;
  branch: Branch | null;
};

type Stock = {
  id: number;
  uuid: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  available_quantity: number;
  average_unit_cost: number;
  last_unit_cost: number;
  stock_value: number;
  last_received_at: string | null;
  last_issued_at: string | null;
  item: GeneralItem | null;
  location: Location | null;
};

type Movement = {
  id: number;
  uuid: string;
  movement_type: string;
  quantity: number;
  unit_cost: number;
  total_value: number;
  running_balance: number;
  reference_type: string | null;
  reference_number: string | null;
  reason: string | null;
  occurred_at: string | null;
  item: GeneralItem | null;
  location: Location | null;
  performed_by: {
    id: number;
    name: string;
    email: string;
  } | null;
};

type Summary = {
  categories_count: number;
  items_count: number;
  locations_count: number;
  stock_records_count: number;
  quantity_on_hand: number;
  stock_value: number;
  low_stock_items_count: number;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  '/api/v1';

function tenantSlugFromProfile(
  profile: AccessProfile,
): string {
  const flexibleProfile = profile as unknown as {
    scope?: {
      tenant_slug?: string | null;
    };
    tenant?: {
      slug?: string | null;
    };
    assignments?: Array<{
      status?: string;
      tenant?: {
        slug?: string | null;
      };
    }>;
  };

  return String(
    flexibleProfile.scope?.tenant_slug ||
      flexibleProfile.tenant?.slug ||
      flexibleProfile.assignments?.find(
        (assignment) =>
          assignment.status === 'active',
      )?.tenant?.slug ||
      '',
  );
}

function money(value: number): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function quantity(value: number): string {
  return new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 3,
  }).format(value || 0);
}

function dateTime(value: string | null): string {
  if (!value) return 'Not recorded';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('en-GB');
}

function messageFromPayload(
  payload: unknown,
  fallback: string,
): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message;
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'errors' in payload &&
    payload.errors &&
    typeof payload.errors === 'object'
  ) {
    const firstError = Object.values(
      payload.errors as Record<string, unknown>,
    ).flat()[0];

    if (typeof firstError === 'string') {
      return firstError;
    }
  }

  return fallback;
}

async function requestJson<T>(
  token: string,
  tenantSlug: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': tenantSlug,
        ...(init.body
          ? {
              'Content-Type': 'application/json',
            }
          : {}),
        ...(init.headers ?? {}),
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
    throw new Error(
      messageFromPayload(
        payload,
        `Request failed with HTTP ${response.status}.`,
      ),
    );
  }

  return payload as T;
}

const blankCategory = {
  name: '',
  code: '',
  description: '',
};

const blankItem = {
  category_id: '',
  supplier_id: '',
  name: '',
  code: '',
  unit_of_measure: 'unit',
  reorder_level: '0',
  minimum_stock_level: '0',
  track_stock: true,
  description: '',
};

const blankLocation = {
  branch_id: '',
  name: '',
  code: '',
  location_type: 'store',
  description: '',
};

const blankMovement = {
  branch_id: '',
  item_id: '',
  location_id: '',
  quantity: '',
  unit_cost: '',
  reference_number: '',
  reason: '',
};

export function GeneralItemsManagementWorkspace({
  token,
  profile,
  initialMode,
}: Props) {
  const tenantSlug =
    tenantSlugFromProfile(profile);

  const permissions =
    profile.permissions ?? [];

  const canManage =
    permissions.length === 0 ||
    permissions.includes(
      'pharmaco.procurement.purchase_order.create',
    );

  const canReceive =
    permissions.length === 0 ||
    permissions.includes(
      'pharmaco.procurement.purchase_order.receive',
    );

  const [mode, setMode] =
    useState<GeneralItemsWorkspaceMode>(
      initialMode,
    );

  const [summary, setSummary] =
    useState<Summary | null>(null);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [items, setItems] =
    useState<GeneralItem[]>([]);

  const [locations, setLocations] =
    useState<Location[]>([]);

  const [stocks, setStocks] =
    useState<Stock[]>([]);

  const [movements, setMovements] =
    useState<Movement[]>([]);

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [branches, setBranches] =
    useState<Branch[]>([]);

  const [categoryForm, setCategoryForm] =
    useState(blankCategory);

  const [itemForm, setItemForm] =
    useState(blankItem);

  const [locationForm, setLocationForm] =
    useState(blankLocation);

  const [receiveForm, setReceiveForm] =
    useState(blankMovement);

  const [issueForm, setIssueForm] =
    useState(blankMovement);

  const [search, setSearch] =
    useState('');

  const [categoryFilter, setCategoryFilter] =
    useState('');

  const [isLoading, setIsLoading] =
    useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [notice, setNotice] =
    useState('');

  const [error, setError] =
    useState('');

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  async function loadWorkspace() {
    if (!tenantSlug) {
      setError(
        'No tenant assignment is available for this account.',
      );
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const [
        summaryResponse,
        categoryResponse,
        itemResponse,
        locationResponse,
        stockResponse,
        movementResponse,
        supplierResponse,
        branchResponse,
      ] = await Promise.all([
        requestJson<{
          summary: Summary;
        }>(
          token,
          tenantSlug,
          '/pharmaco/general-item-stock/summary',
        ),
        requestJson<{
          categories: Category[];
        }>(
          token,
          tenantSlug,
          '/pharmaco/general-item-categories',
        ),
        requestJson<{
          items: GeneralItem[];
        }>(
          token,
          tenantSlug,
          '/pharmaco/general-items',
        ),
        requestJson<{
          locations: Location[];
        }>(
          token,
          tenantSlug,
          '/pharmaco/general-item-locations',
        ),
        requestJson<{
          stocks: Stock[];
        }>(
          token,
          tenantSlug,
          '/pharmaco/general-item-stock',
        ),
        requestJson<{
          movements: Movement[];
        }>(
          token,
          tenantSlug,
          '/pharmaco/general-item-movements',
        ),
        requestJson<{
          suppliers: Supplier[];
        }>(
          token,
          tenantSlug,
          '/pharmaco/suppliers',
        ),
        requestJson<{
          branches: Branch[];
        }>(
          token,
          tenantSlug,
          '/pharmaco/branches',
        ),
      ]);

      const activeCategories =
        categoryResponse.categories.filter(
          (category) =>
            category.status === 'active',
        );

      const activeItems =
        itemResponse.items.filter(
          (item) => item.status === 'active',
        );

      const activeLocations =
        locationResponse.locations.filter(
          (location) =>
            location.status === 'active',
        );

      const activeBranches =
        branchResponse.branches.filter(
          (branch) =>
            branch.status === 'active',
        );

      setSummary(summaryResponse.summary);
      setCategories(categoryResponse.categories);
      setItems(itemResponse.items);
      setLocations(locationResponse.locations);
      setStocks(stockResponse.stocks);
      setMovements(movementResponse.movements);
      setSuppliers(
        supplierResponse.suppliers.filter(
          (supplier) =>
            supplier.status === 'active',
        ),
      );
      setBranches(activeBranches);

      setItemForm((current) => ({
        ...current,
        category_id:
          current.category_id ||
          String(activeCategories[0]?.id ?? ''),
      }));

      setLocationForm((current) => ({
        ...current,
        branch_id:
          current.branch_id ||
          String(activeBranches[0]?.id ?? ''),
      }));

      setReceiveForm((current) => {
        const branchId =
          current.branch_id ||
          String(activeBranches[0]?.id ?? '');

        const firstLocation =
          activeLocations.find(
            (location) =>
              String(location.branch?.id ?? '') ===
              branchId,
          ) ?? activeLocations[0];

        return {
          ...current,
          branch_id: branchId,
          item_id:
            current.item_id ||
            String(activeItems[0]?.id ?? ''),
          location_id:
            current.location_id ||
            String(firstLocation?.id ?? ''),
        };
      });

      setIssueForm((current) => {
        const branchId =
          current.branch_id ||
          String(activeBranches[0]?.id ?? '');

        const firstLocation =
          activeLocations.find(
            (location) =>
              String(location.branch?.id ?? '') ===
              branchId,
          ) ?? activeLocations[0];

        return {
          ...current,
          branch_id: branchId,
          item_id:
            current.item_id ||
            String(activeItems[0]?.id ?? ''),
          location_id:
            current.location_id ||
            String(firstLocation?.id ?? ''),
        };
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load General Items Management.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();

    const refreshGeneralItems =
      () => {
        void loadWorkspace();
      };

    window.addEventListener(
      'ubuzima:general-items-stock-changed',
      refreshGeneralItems,
    );

    return () => {
      window.removeEventListener(
        'ubuzima:general-items-stock-changed',
        refreshGeneralItems,
      );
    };
  }, [tenantSlug]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.code.toLowerCase().includes(term) ||
        item.category?.name
          .toLowerCase()
          .includes(term);

      const matchesCategory =
        !categoryFilter ||
        String(item.category?.id ?? '') ===
          categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, items, search]);

  const lowStockItems = useMemo(
    () =>
      items.filter(
        (item) =>
          Number(
            item.total_quantity_on_hand ?? 0,
          ) <= Number(item.reorder_level),
      ),
    [items],
  );

  const activeItems = items.filter(
    (item) => item.status === 'active',
  );

  const activeCategories = categories.filter(
    (category) =>
      category.status === 'active',
  );

  const activeLocations = locations.filter(
    (location) =>
      location.status === 'active',
  );

  function locationsForBranch(
    branchId: string,
  ): Location[] {
    return activeLocations.filter(
      (location) =>
        String(location.branch?.id ?? '') ===
        branchId,
    );
  }

  async function seedDefaultCategories() {
    if (!canManage) {
      setError(
        'General Item administration permission is required.',
      );
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await requestJson<{
        message: string;
      }>(
        token,
        tenantSlug,
        '/pharmaco/general-item-categories/seed-defaults',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      setNotice(response.message);
      await loadWorkspace();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create the default categories.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function createCategory(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!canManage) {
      setError(
        'General Item administration permission is required.',
      );
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await requestJson<{
        message: string;
      }>(
        token,
        tenantSlug,
        '/pharmaco/general-item-categories',
        {
          method: 'POST',
          body: JSON.stringify({
            name: categoryForm.name,
            code: categoryForm.code,
            description:
              categoryForm.description || null,
            status: 'active',
          }),
        },
      );

      setCategoryForm(blankCategory);
      setNotice(response.message);
      await loadWorkspace();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create the category.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function createItem(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!canManage) {
      setError(
        'General Item Master administration permission is required.',
      );
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await requestJson<{
        message: string;
      }>(
        token,
        tenantSlug,
        '/pharmaco/general-items',
        {
          method: 'POST',
          body: JSON.stringify({
            pharmaco_general_item_category_id:
              Number(itemForm.category_id),
            preferred_supplier_id:
              itemForm.supplier_id
                ? Number(itemForm.supplier_id)
                : null,
            name: itemForm.name,
            code: itemForm.code,
            unit_of_measure:
              itemForm.unit_of_measure,
            reorder_level:
              Number(itemForm.reorder_level || 0),
            minimum_stock_level:
              Number(
                itemForm.minimum_stock_level || 0,
              ),
            track_stock:
              itemForm.track_stock,
            status: 'active',
            description:
              itemForm.description || null,
          }),
        },
      );

      setItemForm({
        ...blankItem,
        category_id:
          String(activeCategories[0]?.id ?? ''),
      });

      setNotice(response.message);
      await loadWorkspace();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create the General Item Master record.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function createLocation(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!canManage) {
      setError(
        'General Item location administration permission is required.',
      );
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await requestJson<{
        message: string;
      }>(
        token,
        tenantSlug,
        '/pharmaco/general-item-locations',
        {
          method: 'POST',
          body: JSON.stringify({
            branch_id:
              Number(locationForm.branch_id),
            name: locationForm.name,
            code: locationForm.code,
            location_type:
              locationForm.location_type,
            status: 'active',
            description:
              locationForm.description || null,
          }),
        },
      );

      setLocationForm({
        ...blankLocation,
        branch_id:
          String(branches[0]?.id ?? ''),
      });

      setNotice(response.message);
      await loadWorkspace();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create the stock location.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitMovement(
    event: FormEvent,
    movementType: 'receive' | 'issue',
  ) {
    event.preventDefault();

    if (!canReceive) {
      setError(
        'General Item stock movement permission is required.',
      );
      return;
    }

    const movementForm =
      movementType === 'receive'
        ? receiveForm
        : issueForm;

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await requestJson<{
        message: string;
      }>(
        token,
        tenantSlug,
        `/pharmaco/general-item-stock/${movementType}`,
        {
          method: 'POST',
          body: JSON.stringify({
            branch_id:
              Number(movementForm.branch_id),
            pharmaco_general_item_id:
              Number(movementForm.item_id),
            pharmaco_general_item_location_id:
              Number(movementForm.location_id),
            quantity:
              Number(movementForm.quantity),
            unit_cost:
              movementType === 'receive'
                ? Number(
                    movementForm.unit_cost || 0,
                  )
                : undefined,
            reference_type:
              movementType === 'receive'
                ? 'general_item_receipt'
                : 'general_item_usage',
            reference_number:
              movementForm.reference_number ||
              null,
            reason:
              movementForm.reason || null,
          }),
        },
      );

      const resetForm = {
        ...blankMovement,
        branch_id:
          movementForm.branch_id,
        item_id:
          movementForm.item_id,
        location_id:
          movementForm.location_id,
      };

      if (movementType === 'receive') {
        setReceiveForm(resetForm);
      } else {
        setIssueForm(resetForm);
      }

      setNotice(response.message);
      await loadWorkspace();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to record the stock movement.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const navigation: Array<{
    key: GeneralItemsWorkspaceMode;
    label: string;
  }> = [
    {
      key: 'overview',
      label: 'Overview',
    },
    {
      key: 'categories',
      label: 'Categories',
    },
    {
      key: 'master',
      label: 'General Item Master',
    },
    {
      key: 'stock',
      label: 'General Item Stock',
    },
    {
      key: 'receiving',
      label: 'Receiving',
    },
    {
      key: 'usage',
      label: 'Issues and Usage',
    },
  ];

  return (
    <section className="general-items-workspace">
      <header className="general-items-workspace-header">
        <div>
          <span className="section-label">
            Procurement control domain
          </span>
          <h2>General Items Management</h2>
          <p>
            Manage non-sale operational items separately
            from pharmaceutical Product Inventory while
            retaining shared suppliers, approvals and
            Purchase Order controls.
          </p>
        </div>

        <button
          type="button"
          className="secondary-action"
          onClick={() => void loadWorkspace()}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <nav className="general-items-workspace-navigation">
        {navigation.map((item) => (
          <button
            type="button"
            key={item.key}
            className={
              mode === item.key ? 'active' : ''
            }
            onClick={() => setMode(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="general-items-message error">
          {error}
        </div>
      )}

      {notice && (
        <div className="general-items-message success">
          {notice}
        </div>
      )}

      {mode === 'overview' && (
        <>
          <div className="general-items-summary-grid">
            <article>
              <span>Master records</span>
              <strong>
                {summary?.items_count ?? 0}
              </strong>
              <small>
                Reusable operational items
              </small>
            </article>

            <article>
              <span>Categories</span>
              <strong>
                {summary?.categories_count ?? 0}
              </strong>
              <small>
                Admin-controlled classification
              </small>
            </article>

            <article>
              <span>Quantity on hand</span>
              <strong>
                {quantity(
                  summary?.quantity_on_hand ?? 0,
                )}
              </strong>
              <small>
                Across all General Item stores
              </small>
            </article>

            <article>
              <span>Stock value</span>
              <strong>
                {money(summary?.stock_value ?? 0)}
              </strong>
              <small>
                Weighted average valuation
              </small>
            </article>

            <article>
              <span>Low-stock items</span>
              <strong>
                {summary?.low_stock_items_count ??
                  0}
              </strong>
              <small>
                At or below reorder level
              </small>
            </article>

            <article>
              <span>Stock locations</span>
              <strong>
                {summary?.locations_count ?? 0}
              </strong>
              <small>
                Branch-controlled stores
              </small>
            </article>
          </div>

          <div className="general-items-overview-grid">
            <article className="general-items-panel">
              <header>
                <div>
                  <span className="section-label">
                    Attention required
                  </span>
                  <h3>Low-stock watch</h3>
                </div>
              </header>

              {lowStockItems.length === 0 ? (
                <p className="muted">
                  No General Item is currently at or
                  below its reorder level.
                </p>
              ) : (
                <div className="general-items-compact-list">
                  {lowStockItems
                    .slice(0, 8)
                    .map((item) => (
                      <div key={item.id}>
                        <span>
                          <strong>{item.name}</strong>
                          <small>
                            {item.category?.name ??
                              'Unclassified'}
                          </small>
                        </span>
                        <b>
                          {quantity(
                            item.total_quantity_on_hand ??
                              0,
                          )}{' '}
                          {item.unit_of_measure}
                        </b>
                      </div>
                    ))}
                </div>
              )}
            </article>

            <article className="general-items-panel">
              <header>
                <div>
                  <span className="section-label">
                    Recent ledger
                  </span>
                  <h3>Latest movements</h3>
                </div>
              </header>

              {movements.length === 0 ? (
                <p className="muted">
                  No General Item receiving or usage
                  movement has been recorded.
                </p>
              ) : (
                <div className="general-items-compact-list">
                  {movements
                    .slice(0, 8)
                    .map((movement) => (
                      <div key={movement.id}>
                        <span>
                          <strong>
                            {movement.item?.name ??
                              'General Item'}
                          </strong>
                          <small>
                            {movement.movement_type} ·{' '}
                            {dateTime(
                              movement.occurred_at,
                            )}
                          </small>
                        </span>
                        <b>
                          {movement.quantity > 0
                            ? '+'
                            : ''}
                          {quantity(
                            movement.quantity,
                          )}
                        </b>
                      </div>
                    ))}
                </div>
              )}
            </article>
          </div>
        </>
      )}

      {mode === 'categories' && (
        <div className="general-items-two-column">
          <form
            className="general-items-panel general-items-form"
            onSubmit={createCategory}
          >
            <header>
              <div>
                <span className="section-label">
                  Admin setup
                </span>
                <h3>Create General Item Category</h3>
              </div>
            </header>

            <label>
              Category name
              <input
                required
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Hygiene and Sanitation"
              />
            </label>

            <label>
              Category code
              <input
                required
                value={categoryForm.code}
                onChange={(event) =>
                  setCategoryForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                placeholder="HYG"
              />
            </label>

            <label>
              Description
              <textarea
                value={
                  categoryForm.description
                }
                onChange={(event) =>
                  setCategoryForm((current) => ({
                    ...current,
                    description:
                      event.target.value,
                  }))
                }
                placeholder="Items used for hygiene and facility sanitation."
              />
            </label>

            <div className="general-items-form-actions">
              <button
                type="submit"
                disabled={
                  isSaving || !canManage
                }
              >
                Create category
              </button>

              <button
                type="button"
                className="secondary-action"
                disabled={
                  isSaving || !canManage
                }
                onClick={() =>
                  void seedDefaultCategories()
                }
              >
                Load 12 standard categories
              </button>
            </div>
          </form>

          <article className="general-items-panel">
            <header>
              <div>
                <span className="section-label">
                  Classification register
                </span>
                <h3>Configured categories</h3>
              </div>
              <span className="general-items-count">
                {categories.length}
              </span>
            </header>

            <div className="general-items-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Category</th>
                    <th>Items</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td>{category.code}</td>
                      <td>
                        <strong>
                          {category.name}
                        </strong>
                        <small>
                          {category.description ||
                            'No description'}
                        </small>
                      </td>
                      <td>
                        {category.items_count ?? 0}
                      </td>
                      <td>
                        <span
                          className={`general-items-status is-${category.status}`}
                        >
                          {category.status}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        No category has been
                        configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}

      {mode === 'master' && (
        <>
          <form
            className="general-items-panel general-items-form"
            onSubmit={createItem}
          >
            <header>
              <div>
                <span className="section-label">
                  Reusable purchasing master
                </span>
                <h3>Create General Item Master Record</h3>
              </div>
            </header>

            <div className="general-items-form-grid">
              <label>
                Item name
                <input
                  required
                  value={itemForm.name}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="A4 Printing Paper"
                />
              </label>

              <label>
                Item code
                <input
                  required
                  value={itemForm.code}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  placeholder="OFF-PAPER-A4"
                />
              </label>

              <label>
                Category
                <select
                  required
                  value={itemForm.category_id}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      category_id:
                        event.target.value,
                    }))
                  }
                >
                  <option value="">
                    Select category
                  </option>
                  {activeCategories.map(
                    (category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Unit of measure
                <select
                  value={
                    itemForm.unit_of_measure
                  }
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      unit_of_measure:
                        event.target.value,
                    }))
                  }
                >
                  <option value="unit">Unit</option>
                  <option value="piece">Piece</option>
                  <option value="box">Box</option>
                  <option value="pack">Pack</option>
                  <option value="ream">Ream</option>
                  <option value="bottle">
                    Bottle
                  </option>
                  <option value="litre">
                    Litre
                  </option>
                  <option value="kilogram">
                    Kilogram
                  </option>
                  <option value="roll">Roll</option>
                  <option value="set">Set</option>
                </select>
              </label>

              <label>
                Preferred supplier
                <select
                  value={itemForm.supplier_id}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      supplier_id:
                        event.target.value,
                    }))
                  }
                >
                  <option value="">
                    No preferred supplier
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

              <label>
                Reorder level
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={
                    itemForm.reorder_level
                  }
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      reorder_level:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Minimum stock level
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={
                    itemForm.minimum_stock_level
                  }
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      minimum_stock_level:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <label className="general-items-checkbox">
                <input
                  type="checkbox"
                  checked={itemForm.track_stock}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      track_stock:
                        event.target.checked,
                    }))
                  }
                />
                Track this item in General Item Stock
              </label>
            </div>

            <label>
              Description
              <textarea
                value={itemForm.description}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    description:
                      event.target.value,
                  }))
                }
              />
            </label>

            <div className="general-items-form-actions">
              <button
                type="submit"
                disabled={
                  isSaving || !canManage
                }
              >
                Create General Item
              </button>
            </div>
          </form>

          <article className="general-items-panel">
            <header className="general-items-register-header">
              <div>
                <span className="section-label">
                  General Item Master
                </span>
                <h3>Reusable operational items</h3>
              </div>

              <div className="general-items-register-filters">
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search item, code or category"
                />

                <select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    All categories
                  </option>
                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </header>

            <div className="general-items-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>General item</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th>On hand</th>
                    <th>Reorder</th>
                    <th>Supplier</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.code}</td>
                      <td>
                        <strong>{item.name}</strong>
                        <small>
                          {item.description ||
                            'No description'}
                        </small>
                      </td>
                      <td>
                        {item.category?.name ??
                          'Unclassified'}
                      </td>
                      <td>
                        {item.unit_of_measure}
                      </td>
                      <td>
                        {quantity(
                          item.total_quantity_on_hand ??
                            0,
                        )}
                      </td>
                      <td>
                        {quantity(
                          item.reorder_level,
                        )}
                      </td>
                      <td>
                        {item.preferred_supplier
                          ?.name ?? 'Not assigned'}
                      </td>
                      <td>
                        <span
                          className={`general-items-status is-${item.status}`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={8}>
                        No General Item Master
                        record matches the selected
                        filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}

      {mode === 'stock' && (
        <>
          <div className="general-items-two-column">
            <form
              className="general-items-panel general-items-form"
              onSubmit={createLocation}
            >
              <header>
                <div>
                  <span className="section-label">
                    Stock setup
                  </span>
                  <h3>Create General Item Location</h3>
                </div>
              </header>

              <label>
                Branch
                <select
                  required
                  value={
                    locationForm.branch_id
                  }
                  onChange={(event) =>
                    setLocationForm(
                      (current) => ({
                        ...current,
                        branch_id:
                          event.target.value,
                      }),
                    )
                  }
                >
                  <option value="">
                    Select branch
                  </option>
                  {branches.map((branch) => (
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
                Location name
                <input
                  required
                  value={locationForm.name}
                  onChange={(event) =>
                    setLocationForm(
                      (current) => ({
                        ...current,
                        name: event.target.value,
                      }),
                    )
                  }
                  placeholder="Main General Store"
                />
              </label>

              <label>
                Location code
                <input
                  required
                  value={locationForm.code}
                  onChange={(event) =>
                    setLocationForm(
                      (current) => ({
                        ...current,
                        code: event.target.value,
                      }),
                    )
                  }
                  placeholder="GEN-STORE"
                />
              </label>

              <label>
                Location type
                <select
                  value={
                    locationForm.location_type
                  }
                  onChange={(event) =>
                    setLocationForm(
                      (current) => ({
                        ...current,
                        location_type:
                          event.target.value,
                      }),
                    )
                  }
                >
                  <option value="store">Store</option>
                  <option value="warehouse">
                    Warehouse
                  </option>
                  <option value="department">
                    Department
                  </option>
                  <option value="cupboard">
                    Cupboard
                  </option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                Description
                <textarea
                  value={
                    locationForm.description
                  }
                  onChange={(event) =>
                    setLocationForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <div className="general-items-form-actions">
                <button
                  type="submit"
                  disabled={
                    isSaving || !canManage
                  }
                >
                  Create location
                </button>
              </div>
            </form>

            <article className="general-items-panel">
              <header>
                <div>
                  <span className="section-label">
                    Storage structure
                  </span>
                  <h3>General Item Locations</h3>
                </div>
                <span className="general-items-count">
                  {locations.length}
                </span>
              </header>

              <div className="general-items-compact-list">
                {locations.map((location) => (
                  <div key={location.id}>
                    <span>
                      <strong>
                        {location.name}
                      </strong>
                      <small>
                        {location.branch?.name ??
                          'Branch not available'}{' '}
                        · {location.location_type}
                      </small>
                    </span>
                    <b>{location.code}</b>
                  </div>
                ))}

                {locations.length === 0 && (
                  <p className="muted">
                    No General Item location has
                    been created.
                  </p>
                )}
              </div>
            </article>
          </div>

          <article className="general-items-panel">
            <header>
              <div>
                <span className="section-label">
                  General Item Stock
                </span>
                <h3>Current stock balances</h3>
              </div>
              <span className="general-items-count">
                {stocks.length}
              </span>
            </header>

            <div className="general-items-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>On hand</th>
                    <th>Available</th>
                    <th>Average cost</th>
                    <th>Stock value</th>
                    <th>Last received</th>
                    <th>Last issued</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock) => (
                    <tr key={stock.id}>
                      <td>
                        <strong>
                          {stock.item?.name ??
                            'General Item'}
                        </strong>
                        <small>
                          {stock.item?.code ?? ''}
                        </small>
                      </td>
                      <td>
                        {stock.item?.category
                          ?.name ?? 'Unclassified'}
                      </td>
                      <td>
                        {stock.location?.name ??
                          'Location unavailable'}
                      </td>
                      <td>
                        {quantity(
                          stock.quantity_on_hand,
                        )}
                      </td>
                      <td>
                        {quantity(
                          stock.available_quantity,
                        )}
                      </td>
                      <td>
                        {money(
                          stock.average_unit_cost,
                        )}
                      </td>
                      <td>
                        {money(stock.stock_value)}
                      </td>
                      <td>
                        {dateTime(
                          stock.last_received_at,
                        )}
                      </td>
                      <td>
                        {dateTime(
                          stock.last_issued_at,
                        )}
                      </td>
                    </tr>
                  ))}

                  {stocks.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        No General Item stock balance
                        has been recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}

      {mode === 'receiving' && (
        <div className="general-items-two-column">
          <form
            className="general-items-panel general-items-form"
            onSubmit={(event) =>
              void submitMovement(
                event,
                'receive',
              )
            }
          >
            <header>
              <div>
                <span className="section-label">
                  Stock receipt
                </span>
                <h3>Receive General Item Stock</h3>
              </div>
            </header>

            <label>
              Branch
              <select
                required
                value={receiveForm.branch_id}
                onChange={(event) => {
                  const branchId =
                    event.target.value;

                  const firstLocation =
                    locationsForBranch(branchId)[0];

                  setReceiveForm((current) => ({
                    ...current,
                    branch_id: branchId,
                    location_id: String(
                      firstLocation?.id ?? '',
                    ),
                  }));
                }}
              >
                <option value="">
                  Select branch
                </option>
                {branches.map((branch) => (
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
              General Item Master
              <select
                required
                value={receiveForm.item_id}
                onChange={(event) =>
                  setReceiveForm((current) => ({
                    ...current,
                    item_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">
                  Select General Item
                </option>
                {activeItems.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name} — {item.code}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Stock location
              <select
                required
                value={receiveForm.location_id}
                onChange={(event) =>
                  setReceiveForm((current) => ({
                    ...current,
                    location_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">
                  Select location
                </option>
                {locationsForBranch(
                  receiveForm.branch_id,
                ).map((location) => (
                  <option
                    key={location.id}
                    value={location.id}
                  >
                    {location.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Quantity received
              <input
                required
                type="number"
                min="0.001"
                step="0.001"
                value={receiveForm.quantity}
                onChange={(event) =>
                  setReceiveForm((current) => ({
                    ...current,
                    quantity:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Unit cost
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={receiveForm.unit_cost}
                onChange={(event) =>
                  setReceiveForm((current) => ({
                    ...current,
                    unit_cost:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Reference number
              <input
                value={
                  receiveForm.reference_number
                }
                onChange={(event) =>
                  setReceiveForm((current) => ({
                    ...current,
                    reference_number:
                      event.target.value,
                  }))
                }
                placeholder="GRN-GEN-001"
              />
            </label>

            <label>
              Receiving note
              <textarea
                value={receiveForm.reason}
                onChange={(event) =>
                  setReceiveForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
              />
            </label>

            <div className="general-items-form-actions">
              <button
                type="submit"
                disabled={
                  isSaving || !canReceive
                }
              >
                Receive stock
              </button>
            </div>
          </form>

          <article className="general-items-panel">
            <header>
              <div>
                <span className="section-label">
                  Receiving history
                </span>
                <h3>Recent receipts</h3>
              </div>
            </header>

            <div className="general-items-compact-list">
              {movements
                .filter(
                  (movement) =>
                    movement.movement_type ===
                    'received',
                )
                .slice(0, 20)
                .map((movement) => (
                  <div key={movement.id}>
                    <span>
                      <strong>
                        {movement.item?.name ??
                          'General Item'}
                      </strong>
                      <small>
                        {movement.location?.name ??
                          'Location unavailable'}{' '}
                        ·{' '}
                        {dateTime(
                          movement.occurred_at,
                        )}
                      </small>
                    </span>
                    <b>
                      +{quantity(movement.quantity)}
                    </b>
                  </div>
                ))}

              {movements.filter(
                (movement) =>
                  movement.movement_type ===
                  'received',
              ).length === 0 && (
                <p className="muted">
                  No General Item receipt has been
                  recorded.
                </p>
              )}
            </div>
          </article>
        </div>
      )}

      {mode === 'usage' && (
        <div className="general-items-two-column">
          <form
            className="general-items-panel general-items-form"
            onSubmit={(event) =>
              void submitMovement(
                event,
                'issue',
              )
            }
          >
            <header>
              <div>
                <span className="section-label">
                  Controlled usage
                </span>
                <h3>Issue General Item Stock</h3>
              </div>
            </header>

            <label>
              Branch
              <select
                required
                value={issueForm.branch_id}
                onChange={(event) => {
                  const branchId =
                    event.target.value;

                  const firstLocation =
                    locationsForBranch(branchId)[0];

                  setIssueForm((current) => ({
                    ...current,
                    branch_id: branchId,
                    location_id: String(
                      firstLocation?.id ?? '',
                    ),
                  }));
                }}
              >
                <option value="">
                  Select branch
                </option>
                {branches.map((branch) => (
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
              General Item Master
              <select
                required
                value={issueForm.item_id}
                onChange={(event) =>
                  setIssueForm((current) => ({
                    ...current,
                    item_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">
                  Select General Item
                </option>
                {activeItems.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name} — {item.code}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Stock location
              <select
                required
                value={issueForm.location_id}
                onChange={(event) =>
                  setIssueForm((current) => ({
                    ...current,
                    location_id:
                      event.target.value,
                  }))
                }
              >
                <option value="">
                  Select location
                </option>
                {locationsForBranch(
                  issueForm.branch_id,
                ).map((location) => (
                  <option
                    key={location.id}
                    value={location.id}
                  >
                    {location.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Quantity issued
              <input
                required
                type="number"
                min="0.001"
                step="0.001"
                value={issueForm.quantity}
                onChange={(event) =>
                  setIssueForm((current) => ({
                    ...current,
                    quantity:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Usage reference
              <input
                value={
                  issueForm.reference_number
                }
                onChange={(event) =>
                  setIssueForm((current) => ({
                    ...current,
                    reference_number:
                      event.target.value,
                  }))
                }
                placeholder="ISSUE-ADMIN-001"
              />
            </label>

            <label>
              Department or usage reason
              <textarea
                required
                value={issueForm.reason}
                onChange={(event) =>
                  setIssueForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                placeholder="Issued to Administration for monthly operations."
              />
            </label>

            <div className="general-items-form-actions">
              <button
                type="submit"
                disabled={
                  isSaving || !canReceive
                }
              >
                Issue stock
              </button>
            </div>
          </form>

          <article className="general-items-panel">
            <header>
              <div>
                <span className="section-label">
                  Usage history
                </span>
                <h3>Recent issues</h3>
              </div>
            </header>

            <div className="general-items-compact-list">
              {movements
                .filter(
                  (movement) =>
                    movement.movement_type ===
                    'issued',
                )
                .slice(0, 20)
                .map((movement) => (
                  <div key={movement.id}>
                    <span>
                      <strong>
                        {movement.item?.name ??
                          'General Item'}
                      </strong>
                      <small>
                        {movement.reason ||
                          'Usage reason not recorded'}{' '}
                        ·{' '}
                        {dateTime(
                          movement.occurred_at,
                        )}
                      </small>
                    </span>
                    <b>
                      {quantity(movement.quantity)}
                    </b>
                  </div>
                ))}

              {movements.filter(
                (movement) =>
                  movement.movement_type ===
                  'issued',
              ).length === 0 && (
                <p className="muted">
                  No General Item usage has been
                  recorded.
                </p>
              )}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

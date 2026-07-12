import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type FormEvent,
} from 'react';

import {
  InventoryModuleHome,
} from './InventoryModuleHome';

type Props = Omit<
  ComponentProps<typeof InventoryModuleHome>,
  'presentation'
>;

type Workspace =
  | 'overview'
  | 'categories'
  | 'master'
  | 'stock'
  | 'usage'
  | 'analytics';

type ModalKey =
  | 'category'
  | 'item'
  | 'location'
  | 'receive'
  | 'issue';

type Category = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  status: string;
};

type Item = {
  id: number;
  category_id?: number | null;
  category_name?: string | null;
  code: string;
  name: string;
  description?: string | null;
  unit_of_measure: string;
  track_stock: boolean | number;
  minimum_stock_level: number | string;
  reorder_quantity: number | string;
  standard_unit_cost: number | string;
  status: string;
};

type Location = {
  id: number;
  code: string;
  name: string;
  status: string;
};

type Stock = {
  id: number;
  pharmaco_general_item_id: number;
  pharmaco_general_item_location_id: number;
  item_code: string;
  item_name: string;
  unit_of_measure: string;
  minimum_stock_level: number | string;
  location_code: string;
  location_name: string;
  quantity_on_hand: number | string;
  average_unit_cost: number | string;
  stock_value: number | string;
};

type Movement = {
  id: number;
  movement_type: string;
  item_code: string;
  item_name: string;
  location_name: string;
  unit_of_measure: string;
  quantity: number | string;
  unit_cost: number | string;
  department?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at: string;
};

type Overview = {
  summary: {
    category_count: number;
    item_count: number;
    location_count: number;
    stock_value: number;
    below_minimum_count: number;
  };
  recent_movements: Movement[];
};

const workspaceOptions: Array<{
  key: Workspace;
  label: string;
  description: string;
}> = [
  {
    key: 'overview',
    label: 'General Items Management',
    description:
      'Operational control and recent activity',
  },
  {
    key: 'categories',
    label: 'General Items Category',
    description:
      'Classification and reporting groups',
  },
  {
    key: 'master',
    label: 'General Items Master',
    description:
      'Reusable item records and reorder rules',
  },
  {
    key: 'stock',
    label: 'General Item Stock',
    description:
      'Locations, balances and receiving',
  },
  {
    key: 'usage',
    label: 'General Item Issues and Usage',
    description:
      'Department issues and movement history',
  },
  {
    key: 'analytics',
    label: 'AI Stock Analytics',
    description:
      'Exposure, cover and replenishment signals',
  },
];

function numberValue(
  value: number | string | null | undefined,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatNumber(
  value: number | string | null | undefined,
): string {
  return new Intl.NumberFormat(
    'en-RW',
    {
      maximumFractionDigits: 2,
    },
  ).format(numberValue(value));
}

function formatRwf(
  value: number | string | null | undefined,
): string {
  return new Intl.NumberFormat(
    'en-RW',
    {
      style: 'currency',
      currency: 'RWF',
      maximumFractionDigits: 0,
    },
  ).format(numberValue(value));
}

/* AQUILA_GENERAL_ITEMS_TABLE_POPUP_20260711 */
export function GeneralStockItemsModule(
  props: Props,
) {
  const [workspace, setWorkspace] =
    useState<Workspace>('overview');

  const [activeModal, setActiveModal] =
    useState<ModalKey | null>(null);

  const [overview, setOverview] =
    useState<Overview | null>(null);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [items, setItems] =
    useState<Item[]>([]);

  const [locations, setLocations] =
    useState<Location[]>([]);

  const [stock, setStock] =
    useState<Stock[]>([]);

  const [movements, setMovements] =
    useState<Movement[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [notice, setNotice] =
    useState('');

  const [categoryForm, setCategoryForm] =
    useState({
      code: '',
      name: '',
      description: '',
    });

  const [itemForm, setItemForm] =
    useState({
      category_id: '',
      code: '',
      name: '',
      description: '',
      unit_of_measure: 'unit',
      minimum_stock_level: '0',
      reorder_quantity: '0',
      standard_unit_cost: '0',
    });

  const [locationForm, setLocationForm] =
    useState({
      code: '',
      name: '',
    });

  const [receiveForm, setReceiveForm] =
    useState({
      item_id: '',
      location_id: '',
      quantity: '',
      unit_cost: '',
      reference: '',
      notes: '',
    });

  const [issueForm, setIssueForm] =
    useState({
      item_id: '',
      location_id: '',
      quantity: '',
      department: '',
      reference: '',
      notes: '',
    });

  const tenantSlug = useMemo(
    () =>
      props.profile.tenant_assignments
        ?.[0]?.tenant?.slug
      ?? (
        props.profile.scope.is_tenant
          ? 'vitapharma'
          : ''
      ),
    [props.profile],
  );

  const apiBase =
    import.meta.env.VITE_API_BASE_URL
    ?? '/api/v1';

  const request = useCallback(
    async <T,>(
      path: string,
      options?: RequestInit,
    ): Promise<T> => {
      if (!tenantSlug) {
        throw new Error(
          'No tenant assignment is available for General Stock Items.',
        );
      }

      const response = await fetch(
        `${apiBase}/tenants/${encodeURIComponent(
          tenantSlug,
        )}/pharmaco360/general-items${path}`,
        {
          ...options,
          headers: {
            Accept: 'application/json',
            Authorization:
              `Bearer ${props.token}`,
            'Content-Type':
              'application/json',
            ...(options?.headers ?? {}),
          },
        },
      );

      const payload = await response.json()
        .catch(() => ({}));

      if (!response.ok) {
        const validation =
          payload.errors
            ? Object.values(
                payload.errors as Record<
                  string,
                  string[]
                >,
              )
                .flat()
                .join(' ')
            : '';

        throw new Error(
          validation
          || payload.message
          || 'General Items request failed.',
        );
      }

      return payload as T;
    },
    [
      apiBase,
      props.token,
      tenantSlug,
    ],
  );

  const loadAll = useCallback(
    async () => {
      setIsLoading(true);
      setError('');

      try {
        const [
          overviewResponse,
          categoryResponse,
          itemResponse,
          locationResponse,
          stockResponse,
          movementResponse,
        ] = await Promise.all([
          request<Overview>('/overview'),
          request<{
            categories: Category[];
          }>('/categories'),
          request<{
            items: Item[];
          }>('/items'),
          request<{
            locations: Location[];
          }>('/locations'),
          request<{
            stock: Stock[];
          }>('/stock'),
          request<{
            movements: Movement[];
          }>('/movements'),
        ]);

        setOverview(overviewResponse);
        setCategories(
          categoryResponse.categories,
        );
        setItems(itemResponse.items);
        setLocations(
          locationResponse.locations,
        );
        setStock(stockResponse.stock);
        setMovements(
          movementResponse.movements,
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load General Items.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [request],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!activeModal) {
      document.body.classList.remove(
        'general-items-modal-open',
      );

      return;
    }

    const closeOnEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        setActiveModal(null);
      }
    };

    document.body.classList.add(
      'general-items-modal-open',
    );

    window.addEventListener(
      'keydown',
      closeOnEscape,
    );

    return () => {
      document.body.classList.remove(
        'general-items-modal-open',
      );

      window.removeEventListener(
        'keydown',
        closeOnEscape,
      );
    };
  }, [activeModal]);

  async function submit(
    action: () => Promise<unknown>,
    successMessage: string,
  ) {
    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      await action();
      setNotice(successMessage);
      setActiveModal(null);
      await loadAll();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to save General Item information.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function submitCategory(
    event: FormEvent,
  ) {
    event.preventDefault();

    void submit(
      () =>
        request('/categories', {
          method: 'POST',
          body: JSON.stringify(
            categoryForm,
          ),
        }),
      'General Item category created.',
    ).then(() =>
      setCategoryForm({
        code: '',
        name: '',
        description: '',
      }),
    );
  }

  function submitItem(
    event: FormEvent,
  ) {
    event.preventDefault();

    void submit(
      () =>
        request('/items', {
          method: 'POST',
          body: JSON.stringify({
            ...itemForm,
            category_id:
              itemForm.category_id
                ? Number(
                    itemForm.category_id,
                  )
                : null,
            track_stock: true,
            minimum_stock_level:
              numberValue(
                itemForm
                  .minimum_stock_level,
              ),
            reorder_quantity:
              numberValue(
                itemForm
                  .reorder_quantity,
              ),
            standard_unit_cost:
              numberValue(
                itemForm
                  .standard_unit_cost,
              ),
          }),
        }),
      'General Item created.',
    ).then(() =>
      setItemForm({
        category_id: '',
        code: '',
        name: '',
        description: '',
        unit_of_measure: 'unit',
        minimum_stock_level: '0',
        reorder_quantity: '0',
        standard_unit_cost: '0',
      }),
    );
  }

  function submitLocation(
    event: FormEvent,
  ) {
    event.preventDefault();

    void submit(
      () =>
        request('/locations', {
          method: 'POST',
          body: JSON.stringify(
            locationForm,
          ),
        }),
      'General Item location created.',
    ).then(() =>
      setLocationForm({
        code: '',
        name: '',
      }),
    );
  }

  function submitReceive(
    event: FormEvent,
  ) {
    event.preventDefault();

    void submit(
      () =>
        request('/receiving', {
          method: 'POST',
          body: JSON.stringify({
            ...receiveForm,
            item_id: Number(
              receiveForm.item_id,
            ),
            location_id: Number(
              receiveForm.location_id,
            ),
            quantity: numberValue(
              receiveForm.quantity,
            ),
            unit_cost: numberValue(
              receiveForm.unit_cost,
            ),
          }),
        }),
      'General Item stock received.',
    ).then(() =>
      setReceiveForm({
        item_id: '',
        location_id: '',
        quantity: '',
        unit_cost: '',
        reference: '',
        notes: '',
      }),
    );
  }

  function submitIssue(
    event: FormEvent,
  ) {
    event.preventDefault();

    void submit(
      () =>
        request('/usage', {
          method: 'POST',
          body: JSON.stringify({
            ...issueForm,
            item_id: Number(
              issueForm.item_id,
            ),
            location_id: Number(
              issueForm.location_id,
            ),
            quantity: numberValue(
              issueForm.quantity,
            ),
          }),
        }),
      'General Item stock issued.',
    ).then(() =>
      setIssueForm({
        item_id: '',
        location_id: '',
        quantity: '',
        department: '',
        reference: '',
        notes: '',
      }),
    );
  }

  return (
    <section
      className="general-stock-items-module-shell"
      aria-labelledby="general-stock-items-title"
    >
      <header className="general-stock-items-module-header">
        <div>
          <p className="eyebrow">
            Operational stock control
          </p>

          <h1 id="general-stock-items-title">
            General Stock Items
          </h1>

          <p>
            Manage categories, master records,
            locations, receiving, balances,
            departmental issues and usage separately
            from pharmaceutical Product Inventory.
          </p>
        </div>

        <span className="general-stock-items-status">
          Operational module
        </span>

        {/* AQUILA_GENERAL_ITEMS_HEADER_ACTIONS_20260712 */}
        <div className="general-stock-items-module-header-actions">
          <button
            type="button"
            onClick={() => {
              setWorkspace('categories');
              setActiveModal('category');
            }}
          >
            New category
          </button>

          <button
            type="button"
            onClick={() => {
              setWorkspace('master');
              setActiveModal('item');
            }}
          >
            New General Item
          </button>

          <button
            type="button"
            onClick={() => {
              setWorkspace('stock');
              setActiveModal('receive');
            }}
          >
            Receive stock
          </button>
        </div>
      </header>

      <nav
        className="general-stock-workspace-navigation"
        aria-label="General Stock workspaces"
      >
        {workspaceOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={
              workspace === option.key
                ? 'is-active'
                : ''
            }
            onClick={() =>
              setWorkspace(option.key)
            }
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </nav>

      {error && (
        <div
          className="notice error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div className="notice success">
          {notice}
        </div>
      )}

      {workspace === 'analytics' ? (
        <InventoryModuleHome
          {...props}
          presentation="general-stock"
        />
      ) : isLoading ? (
        <div className="inventory-professional-state">
          Loading General Items…
        </div>
      ) : (
        <>
          {workspace === 'overview' && (
            <section className="general-items-workspace">
              <div className="general-items-summary-grid">
                <article>
                  <span>Categories</span>
                  <strong>
                    {overview?.summary
                      .category_count ?? 0}
                  </strong>
                </article>

                <article>
                  <span>Master items</span>
                  <strong>
                    {overview?.summary
                      .item_count ?? 0}
                  </strong>
                </article>

                <article>
                  <span>Stock locations</span>
                  <strong>
                    {overview?.summary
                      .location_count ?? 0}
                  </strong>
                </article>

                <article>
                  <span>General stock value</span>
                  <strong>
                    {formatRwf(
                      overview?.summary
                        .stock_value,
                    )}
                  </strong>
                </article>

                <article>
                  <span>Below minimum</span>
                  <strong>
                    {overview?.summary
                      .below_minimum_count ?? 0}
                  </strong>
                </article>
              </div>

              <article className="general-items-panel general-items-management-register">
                <header className="general-items-panel-header">
                  <div>
                    <small>
                      Table management
                    </small>
                    <h2>
                      General Items Management
                    </h2>
                    <p>
                      Review master records and open
                      controlled popup forms for new
                      categories, items, locations,
                      receipts and issues.
                    </p>
                  </div>

                  <div className="general-items-panel-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setWorkspace('categories');
                        setActiveModal('category');
                      }}
                    >
                      New category
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setWorkspace('master');
                        setActiveModal('item');
                      }}
                    >
                      New item
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setWorkspace('stock');
                        setActiveModal('receive');
                      }}
                    >
                      Receive stock
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setWorkspace('usage');
                        setActiveModal('issue');
                      }}
                    >
                      Issue stock
                    </button>
                  </div>
                </header>

                <div className="general-items-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Unit</th>
                        <th>Minimum level</th>
                        <th>Reorder quantity</th>
                        <th>Standard cost</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            No General Item master
                            records have been created.
                          </td>
                        </tr>
                      ) : items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>
                              {item.name}
                            </strong>
                            <small>
                              {item.code}
                            </small>
                          </td>

                          <td>
                            {item.category_name
                              ?? 'Unclassified'}
                          </td>

                          <td>
                            {item.unit_of_measure}
                          </td>

                          <td>
                            {formatNumber(
                              item.minimum_stock_level,
                            )}
                          </td>

                          <td>
                            {formatNumber(
                              item.reorder_quantity,
                            )}
                          </td>

                          <td>
                            {formatRwf(
                              item.standard_unit_cost,
                            )}
                          </td>

                          <td>
                            <span className="general-items-stock-status is-healthy">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="general-items-panel">
                <header>
                  <div>
                    <small>Recent activity</small>
                    <h2>
                      General Item movements
                    </h2>
                  </div>
                </header>

                <MovementTable
                  movements={
                    overview
                      ?.recent_movements
                    ?? []
                  }
                />
              </article>
            </section>
          )}

          {workspace === 'categories' && (
            <section className="general-items-two-column">
              <form
                className={`general-items-panel general-items-form general-items-popup ${activeModal === 'category' ? 'is-open' : ''}`}
                onSubmit={submitCategory}
                role="dialog"
                aria-modal="true"
                aria-label="Create General Item category"
              >
                <button
                  type="button"
                  className="general-items-popup-close"
                  onClick={() =>
                    setActiveModal(null)
                  }
                >
                  Close
                </button>
                <header>
                  <div>
                    <small>
                      Classification control
                    </small>
                    <h2>
                      General Items Category
                    </h2>
                  </div>
                </header>

                <label>
                  Category code
                  <input
                    required
                    maxLength={100}
                    value={
                      categoryForm.code
                    }
                    onChange={(event) =>
                      setCategoryForm(
                        (current) => ({
                          ...current,
                          code:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Category name
                  <input
                    required
                    maxLength={191}
                    value={
                      categoryForm.name
                    }
                    onChange={(event) =>
                      setCategoryForm(
                        (current) => ({
                          ...current,
                          name:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Description
                  <textarea
                    value={
                      categoryForm
                        .description
                    }
                    onChange={(event) =>
                      setCategoryForm(
                        (current) => ({
                          ...current,
                          description:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving
                    ? 'Saving…'
                    : 'Create category'}
                </button>
              </form>

              <article className="general-items-panel">
                <header className="general-items-panel-header">
                  <div>
                    <small>
                      Active classification
                    </small>
                    <h2>
                      Category register
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveModal('category')
                    }
                  >
                    New category
                  </button>
                </header>

                <div className="general-items-compact-list">
                  {categories.length === 0 ? (
                    <p>
                      No General Item categories
                      have been created.
                    </p>
                  ) : categories.map(
                    (category) => (
                      <div key={category.id}>
                        <span>
                          <strong>
                            {category.name}
                          </strong>
                          <small>
                            {category.code}
                          </small>
                        </span>
                        <em>
                          {category.status}
                        </em>
                      </div>
                    ),
                  )}
                </div>
              </article>
            </section>
          )}

          {workspace === 'master' && (
            <section className="general-items-two-column">
              <form
                className={`general-items-panel general-items-form general-items-popup ${activeModal === 'item' ? 'is-open' : ''}`}
                onSubmit={submitItem}
                role="dialog"
                aria-modal="true"
                aria-label="Create General Item master record"
              >
                <button
                  type="button"
                  className="general-items-popup-close"
                  onClick={() =>
                    setActiveModal(null)
                  }
                >
                  Close
                </button>
                <header>
                  <div>
                    <small>
                      Controlled item record
                    </small>
                    <h2>
                      General Items Master
                    </h2>
                  </div>
                </header>

                <label>
                  Category
                  <select
                    value={
                      itemForm.category_id
                    }
                    onChange={(event) =>
                      setItemForm(
                        (current) => ({
                          ...current,
                          category_id:
                            event.target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="">
                      Unclassified
                    </option>
                    {categories.map(
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
                  Item code
                  <input
                    required
                    maxLength={100}
                    value={itemForm.code}
                    onChange={(event) =>
                      setItemForm(
                        (current) => ({
                          ...current,
                          code:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Item name
                  <input
                    required
                    maxLength={191}
                    value={itemForm.name}
                    onChange={(event) =>
                      setItemForm(
                        (current) => ({
                          ...current,
                          name:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Unit of measure
                  <input
                    required
                    maxLength={50}
                    value={
                      itemForm
                        .unit_of_measure
                    }
                    onChange={(event) =>
                      setItemForm(
                        (current) => ({
                          ...current,
                          unit_of_measure:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <div className="general-items-form-grid">
                  <label>
                    Minimum level
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={
                        itemForm
                          .minimum_stock_level
                      }
                      onChange={(event) =>
                        setItemForm(
                          (current) => ({
                            ...current,
                            minimum_stock_level:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label>
                    Reorder quantity
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={
                        itemForm
                          .reorder_quantity
                      }
                      onChange={(event) =>
                        setItemForm(
                          (current) => ({
                            ...current,
                            reorder_quantity:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>
                </div>

                <label>
                  Standard unit cost
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      itemForm
                        .standard_unit_cost
                    }
                    onChange={(event) =>
                      setItemForm(
                        (current) => ({
                          ...current,
                          standard_unit_cost:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Description
                  <textarea
                    value={
                      itemForm.description
                    }
                    onChange={(event) =>
                      setItemForm(
                        (current) => ({
                          ...current,
                          description:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving
                    ? 'Saving…'
                    : 'Create General Item'}
                </button>
              </form>

              <article className="general-items-panel">
                <header className="general-items-panel-header">
                  <div>
                    <small>
                      Controlled master data
                    </small>
                    <h2>
                      General Item register
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveModal('item')
                    }
                  >
                    New General Item
                  </button>
                </header>

                <div className="general-items-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Unit</th>
                        <th>Minimum</th>
                        <th>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>
                              {item.name}
                            </strong>
                            <small>
                              {item.code}
                            </small>
                          </td>
                          <td>
                            {item.category_name
                              ?? 'Unclassified'}
                          </td>
                          <td>
                            {item.unit_of_measure}
                          </td>
                          <td>
                            {formatNumber(
                              item.minimum_stock_level,
                            )}
                          </td>
                          <td>
                            {formatRwf(
                              item.standard_unit_cost,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          )}

          {workspace === 'stock' && (
            <section className="general-items-workspace">
              <div className="general-items-two-column">
                <form
                className={`general-items-panel general-items-form general-items-popup ${activeModal === 'location' ? 'is-open' : ''}`}
                onSubmit={submitLocation}
                role="dialog"
                aria-modal="true"
                aria-label="Create General Item stock location"
              >
                <button
                  type="button"
                  className="general-items-popup-close"
                  onClick={() =>
                    setActiveModal(null)
                  }
                >
                  Close
                </button>
                  <header>
                    <div>
                      <small>
                        Storage structure
                      </small>
                      <h2>
                        General Item location
                      </h2>
                    </div>
                  </header>

                  <label>
                    Location code
                    <input
                      required
                      maxLength={100}
                      value={
                        locationForm.code
                      }
                      onChange={(event) =>
                        setLocationForm(
                          (current) => ({
                            ...current,
                            code:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label>
                    Location name
                    <input
                      required
                      maxLength={191}
                      value={
                        locationForm.name
                      }
                      onChange={(event) =>
                        setLocationForm(
                          (current) => ({
                            ...current,
                            name:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isSaving}
                  >
                    Create location
                  </button>
                </form>

                <form
                className={`general-items-panel general-items-form general-items-popup ${activeModal === 'receive' ? 'is-open' : ''}`}
                onSubmit={submitReceive}
                role="dialog"
                aria-modal="true"
                aria-label="Receive General Item stock"
              >
                <button
                  type="button"
                  className="general-items-popup-close"
                  onClick={() =>
                    setActiveModal(null)
                  }
                >
                  Close
                </button>
                  <header>
                    <div>
                      <small>
                        Receiving transaction
                      </small>
                      <h2>
                        Receive General Item stock
                      </h2>
                    </div>
                  </header>

                  <label>
                    Item
                    <select
                      required
                      value={
                        receiveForm.item_id
                      }
                      onChange={(event) =>
                        setReceiveForm(
                          (current) => ({
                            ...current,
                            item_id:
                              event.target
                                .value,
                          }),
                        )
                      }
                    >
                      <option value="">
                        Select item
                      </option>
                      {items.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Location
                    <select
                      required
                      value={
                        receiveForm
                          .location_id
                      }
                      onChange={(event) =>
                        setReceiveForm(
                          (current) => ({
                            ...current,
                            location_id:
                              event.target
                                .value,
                          }),
                        )
                      }
                    >
                      <option value="">
                        Select location
                      </option>
                      {locations.map(
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

                  <div className="general-items-form-grid">
                    <label>
                      Quantity
                      <input
                        required
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={
                          receiveForm.quantity
                        }
                        onChange={(event) =>
                          setReceiveForm(
                            (current) => ({
                              ...current,
                              quantity:
                                event.target
                                  .value,
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
                          receiveForm
                            .unit_cost
                        }
                        onChange={(event) =>
                          setReceiveForm(
                            (current) => ({
                              ...current,
                              unit_cost:
                                event.target
                                  .value,
                            }),
                          )
                        }
                      />
                    </label>
                  </div>

                  <label>
                    Reference
                    <input
                      maxLength={100}
                      value={
                        receiveForm.reference
                      }
                      onChange={(event) =>
                        setReceiveForm(
                          (current) => ({
                            ...current,
                            reference:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isSaving}
                  >
                    Receive stock
                  </button>
                </form>
              </div>

              <article className="general-items-panel">
                <header className="general-items-panel-header">
                  <div>
                    <small>
                      Current balances
                    </small>
                    <h2>
                      General Item Stock
                    </h2>
                  </div>

                  <div className="general-items-panel-actions">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal('location')
                      }
                    >
                      New location
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal('receive')
                      }
                    >
                      Receive stock
                    </button>
                  </div>
                </header>

                <div className="general-items-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Location</th>
                        <th>Quantity</th>
                        <th>Average cost</th>
                        <th>Stock value</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stock.map((row) => {
                        const belowMinimum =
                          numberValue(
                            row.quantity_on_hand,
                          )
                          < numberValue(
                            row.minimum_stock_level,
                          );

                        return (
                          <tr key={row.id}>
                            <td>
                              <strong>
                                {row.item_name}
                              </strong>
                              <small>
                                {row.item_code}
                              </small>
                            </td>
                            <td>
                              {row.location_name}
                            </td>
                            <td>
                              {formatNumber(
                                row.quantity_on_hand,
                              )}{' '}
                              {row.unit_of_measure}
                            </td>
                            <td>
                              {formatRwf(
                                row.average_unit_cost,
                              )}
                            </td>
                            <td>
                              {formatRwf(
                                row.stock_value,
                              )}
                            </td>
                            <td>
                              <span
                                className={
                                  belowMinimum
                                    ? 'general-items-stock-status is-warning'
                                    : 'general-items-stock-status is-healthy'
                                }
                              >
                                {belowMinimum
                                  ? 'Below minimum'
                                  : 'Healthy'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          )}

          {workspace === 'usage' && (
            <section className="general-items-two-column">
              <form
                className={`general-items-panel general-items-form general-items-popup ${activeModal === 'issue' ? 'is-open' : ''}`}
                onSubmit={submitIssue}
                role="dialog"
                aria-modal="true"
                aria-label="Issue General Item stock"
              >
                <button
                  type="button"
                  className="general-items-popup-close"
                  onClick={() =>
                    setActiveModal(null)
                  }
                >
                  Close
                </button>
                <header>
                  <div>
                    <small>
                      Controlled release
                    </small>
                    <h2>
                      General Item issue
                    </h2>
                  </div>
                </header>

                <label>
                  Item
                  <select
                    required
                    value={issueForm.item_id}
                    onChange={(event) =>
                      setIssueForm(
                        (current) => ({
                          ...current,
                          item_id:
                            event.target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="">
                      Select item
                    </option>
                    {items.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Location
                  <select
                    required
                    value={
                      issueForm.location_id
                    }
                    onChange={(event) =>
                      setIssueForm(
                        (current) => ({
                          ...current,
                          location_id:
                            event.target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="">
                      Select location
                    </option>
                    {locations.map(
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
                  Quantity
                  <input
                    required
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={issueForm.quantity}
                    onChange={(event) =>
                      setIssueForm(
                        (current) => ({
                          ...current,
                          quantity:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Department or user
                  <input
                    maxLength={191}
                    value={
                      issueForm.department
                    }
                    onChange={(event) =>
                      setIssueForm(
                        (current) => ({
                          ...current,
                          department:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Reference
                  <input
                    maxLength={100}
                    value={
                      issueForm.reference
                    }
                    onChange={(event) =>
                      setIssueForm(
                        (current) => ({
                          ...current,
                          reference:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  Usage notes
                  <textarea
                    value={issueForm.notes}
                    onChange={(event) =>
                      setIssueForm(
                        (current) => ({
                          ...current,
                          notes:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSaving}
                >
                  Issue General Item
                </button>
              </form>

              <article className="general-items-panel">
                <header className="general-items-panel-header">
                  <div>
                    <small>
                      Chronological register
                    </small>
                    <h2>
                      General Item Issues and Usage
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveModal('issue')
                    }
                  >
                    Issue General Item
                  </button>
                </header>

                <MovementTable
                  movements={movements}
                />
              </article>
            </section>
          )}
        </>
      )}
    </section>
  );
}

function MovementTable({
  movements,
}: {
  movements: Movement[];
}) {
  if (movements.length === 0) {
    return (
      <p>
        No General Item movements have been
        recorded.
      </p>
    );
  }

  return (
    <div className="general-items-table-scroll">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Movement</th>
            <th>Item</th>
            <th>Location</th>
            <th>Quantity</th>
            <th>Department</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td>
                {new Date(
                  movement.created_at,
                ).toLocaleString()}
              </td>
              <td>
                {movement.movement_type}
              </td>
              <td>
                <strong>
                  {movement.item_name}
                </strong>
                <small>
                  {movement.item_code}
                </small>
              </td>
              <td>
                {movement.location_name}
              </td>
              <td>
                {formatNumber(
                  movement.quantity,
                )}{' '}
                {movement.unit_of_measure}
              </td>
              <td>
                {movement.department ?? '—'}
              </td>
              <td>
                {movement.reference ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

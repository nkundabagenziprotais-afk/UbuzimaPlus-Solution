import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AccessProfile,
  PharmaSupplier,
  createPharmaSupplier,
  getPharmaSuppliers,
  updatePharmaSupplier,
} from '../lib/api';
import { InventoryPopupForm } from './InventoryPopupForm';

type Props = {
  token: string;
  profile: AccessProfile;
  initialMode: 'create' | 'list';
};

type SupplierForm = {
  name: string;
  legal_name: string;
  supplier_code: string;
  supplier_type:
    | 'wholesaler'
    | 'manufacturer'
    | 'distributor'
    | 'importer'
    | 'other';
  contact_person: string;
  phone: string;
  email: string;
  tax_identification_number: string;
  license_number: string;
  address: string;
  payment_terms: string;
  status: 'active' | 'inactive' | 'suspended';
  notes: string;
};

type SupplierFormMode =
  | 'create'
  | 'edit'
  | 'replicate'
  | null;

type SupplierTableSettings = {
  density: 'compact' | 'comfortable' | 'tall';
  fontSize: number;
  widthPreset: 'compact' | 'balanced' | 'wide';
  wrapText: boolean;
  stickyActions: boolean;
};

const tableSettingsKey =
  'ubuzima.procurement.supplier-table.v1';

const defaultTableSettings: SupplierTableSettings = {
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

function blankSupplierForm(): SupplierForm {
  return {
    name: '',
    legal_name: '',
    supplier_code: '',
    supplier_type: 'wholesaler',
    contact_person: '',
    phone: '',
    email: '',
    tax_identification_number: '',
    license_number: '',
    address: '',
    payment_terms: 'Net 30',
    status: 'active',
    notes: '',
  };
}

function formFromSupplier(
  supplier: PharmaSupplier,
): SupplierForm {
  return {
    name: supplier.name ?? '',
    legal_name: supplier.legal_name ?? '',
    supplier_code: supplier.supplier_code ?? '',
    supplier_type:
      supplier.supplier_type === 'manufacturer' ||
      supplier.supplier_type === 'distributor' ||
      supplier.supplier_type === 'importer' ||
      supplier.supplier_type === 'other'
        ? supplier.supplier_type
        : 'wholesaler',
    contact_person: supplier.contact_person ?? '',
    phone: supplier.phone ?? '',
    email: supplier.email ?? '',
    tax_identification_number:
      supplier.tax_identification_number ?? '',
    license_number: supplier.license_number ?? '',
    address: supplier.address ?? '',
    payment_terms: supplier.payment_terms ?? '',
    status:
      supplier.status === 'inactive' ||
      supplier.status === 'suspended'
        ? supplier.status
        : 'active',
    notes:
      typeof supplier.metadata?.notes === 'string'
        ? supplier.metadata.notes
        : '',
  };
}

function normalizedText(
  value: unknown,
): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
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

function loadTableSettings(): SupplierTableSettings {
  if (typeof window === 'undefined') {
    return defaultTableSettings;
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(
        tableSettingsKey,
      ) ?? '{}',
    ) as Partial<SupplierTableSettings>;

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

export function ProcurementSupplierWorkspace({
  token,
  profile,
  initialMode,
}: Props) {
  const [suppliers, setSuppliers] = useState<
    PharmaSupplier[]
  >([]);

  const [searchTerm, setSearchTerm] =
    useState('');
  const [statusFilter, setStatusFilter] =
    useState('all');
  const [typeFilter, setTypeFilter] =
    useState('all');

  const [formMode, setFormMode] =
    useState<SupplierFormMode>(null);
  const [form, setForm] =
    useState<SupplierForm>(
      blankSupplierForm(),
    );

  const [selectedSupplier, setSelectedSupplier] =
    useState<PharmaSupplier | null>(null);
  const [viewingSupplier, setViewingSupplier] =
    useState<PharmaSupplier | null>(null);
  const [
    statusChangeSupplier,
    setStatusChangeSupplier,
  ] = useState<PharmaSupplier | null>(null);

  const [tableSettings, setTableSettings] =
    useState<SupplierTableSettings>(
      loadTableSettings,
    );

  const [isLoading, setIsLoading] =
    useState(false);
  const [isSaving, setIsSaving] =
    useState(false);
  const [isChangingStatus, setIsChangingStatus] =
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

  const canManageSuppliers =
    permissions.includes(
      'pharmaco.procurement.suppliers.manage',
    );

  async function loadSuppliers() {
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
      const response =
        await getPharmaSuppliers(
          token,
          tenantSlug,
        );

      setSuppliers(response.suppliers);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load suppliers.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSuppliers();
  }, [tenantSlug]);

  useEffect(() => {
    if (
      initialMode === 'create' &&
      canManageSuppliers
    ) {
      setSelectedSupplier(null);
      setForm(blankSupplierForm());
      setFormMode('create');
    }
  }, [initialMode, canManageSuppliers]);

  const filteredSuppliers = useMemo(() => {
    const query = normalizedText(searchTerm);

    return suppliers.filter((supplier) => {
      const matchesSearch =
        !query ||
        [
          supplier.name,
          supplier.legal_name,
          supplier.supplier_code,
          supplier.contact_person,
          supplier.phone,
          supplier.email,
          supplier.payment_terms,
          supplier.license_number,
        ].some((value) =>
          normalizedText(value).includes(query),
        );

      const matchesStatus =
        statusFilter === 'all' ||
        supplier.status === statusFilter;

      const matchesType =
        typeFilter === 'all' ||
        supplier.supplier_type === typeFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType
      );
    });
  }, [
    suppliers,
    searchTerm,
    statusFilter,
    typeFilter,
  ]);

  function openCreate() {
    setSelectedSupplier(null);
    setForm(blankSupplierForm());
    setFormMode('create');
    setError('');
    setNotice('');
  }

  function openEdit(
    supplier: PharmaSupplier,
  ) {
    setSelectedSupplier(supplier);
    setForm(formFromSupplier(supplier));
    setFormMode('edit');
    setError('');
    setNotice('');
  }

  function openReplicate(
    supplier: PharmaSupplier,
  ) {
    const replicated =
      formFromSupplier(supplier);

    setSelectedSupplier(null);
    setForm({
      ...replicated,
      name: `${supplier.name} Copy`,
      legal_name: '',
      supplier_code: '',
      status: 'active',
    });
    setFormMode('replicate');
    setError('');
    setNotice('');
  }

  function closeForm() {
    setFormMode(null);
    setSelectedSupplier(null);
    setForm(blankSupplierForm());
  }

  async function saveSupplier() {
    if (!canManageSuppliers) {
      setError(
        'Supplier management permission is required.',
      );
      return;
    }

    if (!form.name.trim()) {
      setError('Supplier name is required.');
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    const payload = {
      name: form.name.trim(),
      legal_name:
        form.legal_name.trim() || null,
      supplier_code:
        form.supplier_code.trim() || null,
      supplier_type: form.supplier_type,
      contact_person:
        form.contact_person.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      tax_identification_number:
        form.tax_identification_number.trim() ||
        null,
      license_number:
        form.license_number.trim() || null,
      address: form.address.trim() || null,
      payment_terms:
        form.payment_terms.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    try {
      if (
        formMode === 'edit' &&
        selectedSupplier
      ) {
        const response =
          await updatePharmaSupplier(
            token,
            tenantSlug,
            selectedSupplier.id,
            payload,
          );

        setSuppliers((current) =>
          current.map((supplier) =>
            supplier.id === response.supplier.id
              ? response.supplier
              : supplier,
          ),
        );

        setNotice(response.message);
      } else {
        const response =
          await createPharmaSupplier(
            token,
            tenantSlug,
            payload,
          );

        setSuppliers((current) => [
          response.supplier,
          ...current,
        ]);

        setNotice(response.message);
      }

      closeForm();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save supplier.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmStatusChange() {
    if (
      !statusChangeSupplier ||
      !canManageSuppliers
    ) {
      return;
    }

    const nextStatus =
      statusChangeSupplier.status === 'active'
        ? 'inactive'
        : 'active';

    setIsChangingStatus(true);
    setError('');
    setNotice('');

    try {
      const response =
        await updatePharmaSupplier(
          token,
          tenantSlug,
          statusChangeSupplier.id,
          {
            status: nextStatus,
          },
        );

      setSuppliers((current) =>
        current.map((supplier) =>
          supplier.id === response.supplier.id
            ? response.supplier
            : supplier,
        ),
      );

      setStatusChangeSupplier(null);
      setNotice(response.message);
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : 'Unable to update supplier status.',
      );
    } finally {
      setIsChangingStatus(false);
    }
  }

  function updateTableSetting<
    TKey extends keyof SupplierTableSettings,
  >(
    key: TKey,
    value: SupplierTableSettings[TKey],
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
    setTableSettings(defaultTableSettings);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(
        tableSettingsKey,
      );
    }

    setNotice(
      'Supplier table settings restored.',
    );
  }

  const tableClassName = [
    'procurement-register-table',
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
      data-procurement-register="suppliers"
    >
      <header className="procurement-register-header">
        <div>
          <span className="section-label">
            Supplier management
          </span>

          <h1>Supplier Register</h1>

          <p>
            Search, review and maintain supplier
            profiles without embedding operational
            forms inside the page.
          </p>
        </div>

        <div className="procurement-register-header-actions">
          <button
            type="button"
            onClick={() => void loadSuppliers()}
            disabled={isLoading}
          >
            {isLoading
              ? 'Refreshing…'
              : 'Refresh'}
          </button>

          {canManageSuppliers && (
            <button
              type="button"
              className="primary"
              onClick={openCreate}
            >
              Add New Supplier
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

      <section className="procurement-register-toolbar">
        <label className="procurement-register-search">
          <span>Search suppliers</span>

          <input
            type="search"
            value={searchTerm}
            placeholder="Name, code, contact, phone, email or terms"
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
            <option value="active">
              Active
            </option>
            <option value="inactive">
              Inactive
            </option>
            <option value="suspended">
              Suspended
            </option>
          </select>
        </label>

        <label>
          <span>Supplier type</span>

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(
                event.target.value,
              )
            }
          >
            <option value="all">
              All types
            </option>
            <option value="wholesaler">
              Wholesaler
            </option>
            <option value="manufacturer">
              Manufacturer
            </option>
            <option value="distributor">
              Distributor
            </option>
            <option value="importer">
              Importer
            </option>
            <option value="other">
              Other
            </option>
          </select>
        </label>

        <div className="procurement-register-result-count">
          <strong>
            {filteredSuppliers.length}
          </strong>
          <span>
            of {suppliers.length} suppliers
          </span>
        </div>
      </section>

      <details className="admin-table-settings-panel">
        <summary className="admin-table-settings-panel__summary">
          <span>
            Table Management and Labelling
          </span>
          <small>Supplier register settings</small>
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
                      SupplierTableSettings['density'],
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
                      SupplierTableSettings['widthPreset'],
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
                <th>Supplier code</th>
                <th>Supplier</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Phone / Email</th>
                <th>Payment terms</th>
                <th>Status</th>
                <th>Created</th>
                <th className="procurement-register-actions-column">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="procurement-register-empty"
                  >
                    {isLoading
                      ? 'Loading suppliers…'
                      : 'No supplier matches the current search and filters.'}
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map(
                  (supplier) => (
                    <tr key={supplier.id}>
                      <td>
                        <strong>
                          {supplier.supplier_code}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {supplier.name}
                        </strong>
                        <small>
                          {supplier.legal_name ||
                            'Legal name not recorded'}
                        </small>
                      </td>

                      <td>
                        {supplier.supplier_type.replaceAll(
                          '_',
                          ' ',
                        )}
                      </td>

                      <td>
                        {supplier.contact_person ||
                          'Not assigned'}
                      </td>

                      <td>
                        <span>
                          {supplier.phone ||
                            'No phone'}
                        </span>
                        <small>
                          {supplier.email ||
                            'No email'}
                        </small>
                      </td>

                      <td>
                        {supplier.payment_terms ||
                          'Not defined'}
                      </td>

                      <td>
                        <span
                          className={`procurement-status-badge status-${supplier.status}`}
                        >
                          {supplier.status}
                        </span>
                      </td>

                      <td>
                        {dateLabel(
                          supplier.created_at,
                        )}
                      </td>

                      <td className="procurement-register-actions-column">
                        <div className="procurement-row-actions">
                          <button
                            type="button"
                            onClick={() =>
                              setViewingSupplier(
                                supplier,
                              )
                            }
                          >
                            View
                          </button>

                          {canManageSuppliers && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  openEdit(
                                    supplier,
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openReplicate(
                                    supplier,
                                  )
                                }
                              >
                                Replicate
                              </button>

                              <button
                                type="button"
                                className={
                                  supplier.status ===
                                  'active'
                                    ? 'warning'
                                    : 'success'
                                }
                                onClick={() =>
                                  setStatusChangeSupplier(
                                    supplier,
                                  )
                                }
                              >
                                {supplier.status ===
                                'active'
                                  ? 'Deactivate'
                                  : 'Reactivate'}
                              </button>
                            </>
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
        id="procurement-supplier-form"
        title={
          formMode === 'edit'
            ? 'Edit Supplier'
            : formMode === 'replicate'
              ? 'Replicate Supplier'
              : 'Add New Supplier'
        }
        description={
          formMode === 'edit'
            ? 'Update the selected supplier profile. Existing audit and permission controls remain active.'
            : 'Capture a complete supplier profile for controlled Procurement operations.'
        }
        eyebrow="Procurement operation"
        footerNote="Supplier changes remain permission controlled and tenant isolated."
        open={formMode !== null}
        onClose={closeForm}
      >
        <form
          className="procurement-popup-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveSupplier();
          }}
        >
          <div className="procurement-popup-form-grid">
            <label>
              Supplier name
              <input
                data-popup-autofocus="true"
                value={form.name}
                required
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Legal name
              <input
                value={form.legal_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    legal_name:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Supplier code
              <input
                value={form.supplier_code}
                placeholder="Auto-generated when empty"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    supplier_code:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Supplier type
              <select
                value={form.supplier_type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    supplier_type:
                      event.target.value as
                        SupplierForm['supplier_type'],
                  }))
                }
              >
                <option value="wholesaler">
                  Wholesaler
                </option>
                <option value="manufacturer">
                  Manufacturer
                </option>
                <option value="distributor">
                  Distributor
                </option>
                <option value="importer">
                  Importer
                </option>
                <option value="other">
                  Other
                </option>
              </select>
            </label>

            <label>
              Contact person
              <input
                value={form.contact_person}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contact_person:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Phone
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Payment terms
              <input
                value={form.payment_terms}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    payment_terms:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Tax identification number
              <input
                value={
                  form.tax_identification_number
                }
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tax_identification_number:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              License number
              <input
                value={form.license_number}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    license_number:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status:
                      event.target.value as
                        SupplierForm['status'],
                  }))
                }
              >
                <option value="active">
                  Active
                </option>
                <option value="inactive">
                  Inactive
                </option>
                <option value="suspended">
                  Suspended
                </option>
              </select>
            </label>

            <label className="procurement-popup-form-wide">
              Address
              <textarea
                rows={2}
                value={form.address}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    address:
                      event.target.value,
                  }))
                }
              />
            </label>

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
                : formMode === 'edit'
                  ? 'Update Supplier'
                  : 'Save Supplier'}
            </button>
          </div>
        </form>
      </InventoryPopupForm>

      <InventoryPopupForm
        id="procurement-supplier-view"
        title={
          viewingSupplier?.name ??
          'Supplier Details'
        }
        description="Review the complete supplier profile and current operating status."
        eyebrow="Supplier record"
        footerNote="This view is read-only. Use Edit for controlled profile changes."
        open={viewingSupplier !== null}
        onClose={() =>
          setViewingSupplier(null)
        }
      >
        {viewingSupplier && (
          <div className="procurement-detail-grid">
            <div>
              <span>Supplier code</span>
              <strong>
                {viewingSupplier.supplier_code}
              </strong>
            </div>

            <div>
              <span>Supplier type</span>
              <strong>
                {viewingSupplier.supplier_type.replaceAll(
                  '_',
                  ' ',
                )}
              </strong>
            </div>

            <div>
              <span>Legal name</span>
              <strong>
                {viewingSupplier.legal_name ||
                  'Not recorded'}
              </strong>
            </div>

            <div>
              <span>Status</span>
              <strong>
                {viewingSupplier.status}
              </strong>
            </div>

            <div>
              <span>Contact person</span>
              <strong>
                {viewingSupplier.contact_person ||
                  'Not assigned'}
              </strong>
            </div>

            <div>
              <span>Phone</span>
              <strong>
                {viewingSupplier.phone ||
                  'Not recorded'}
              </strong>
            </div>

            <div>
              <span>Email</span>
              <strong>
                {viewingSupplier.email ||
                  'Not recorded'}
              </strong>
            </div>

            <div>
              <span>Payment terms</span>
              <strong>
                {viewingSupplier.payment_terms ||
                  'Not defined'}
              </strong>
            </div>

            <div>
              <span>Tax identification</span>
              <strong>
                {viewingSupplier.tax_identification_number ||
                  'Not recorded'}
              </strong>
            </div>

            <div>
              <span>License number</span>
              <strong>
                {viewingSupplier.license_number ||
                  'Not recorded'}
              </strong>
            </div>

            <div className="procurement-detail-wide">
              <span>Address</span>
              <strong>
                {viewingSupplier.address ||
                  'Not recorded'}
              </strong>
            </div>

            <div className="procurement-detail-wide">
              <span>Created</span>
              <strong>
                {dateLabel(
                  viewingSupplier.created_at,
                )}
              </strong>
            </div>
          </div>
        )}
      </InventoryPopupForm>

      <InventoryPopupForm
        id="procurement-supplier-status"
        title={
          statusChangeSupplier?.status ===
          'active'
            ? 'Deactivate Supplier'
            : 'Reactivate Supplier'
        }
        description="Confirm this controlled supplier-status change."
        eyebrow="Supplier status control"
        footerNote="Supplier history remains retained for audit and linked Procurement records."
        open={statusChangeSupplier !== null}
        onClose={() =>
          setStatusChangeSupplier(null)
        }
      >
        {statusChangeSupplier && (
          <div className="procurement-confirmation">
            <strong>
              {statusChangeSupplier.name}
            </strong>

            <p>
              {statusChangeSupplier.status ===
              'active'
                ? 'Deactivation prevents this supplier from being used for new controlled purchasing while preserving existing orders and audit history.'
                : 'Reactivation returns this supplier to active Procurement selection.'}
            </p>

            <div className="procurement-popup-actions">
              <button
                type="button"
                onClick={() =>
                  setStatusChangeSupplier(null)
                }
              >
                Keep Current Status
              </button>

              <button
                type="button"
                className={
                  statusChangeSupplier.status ===
                  'active'
                    ? 'danger'
                    : 'primary'
                }
                disabled={isChangingStatus}
                onClick={() =>
                  void confirmStatusChange()
                }
              >
                {isChangingStatus
                  ? 'Updating…'
                  : statusChangeSupplier.status ===
                      'active'
                    ? 'Deactivate Supplier'
                    : 'Reactivate Supplier'}
              </button>
            </div>
          </div>
        )}
      </InventoryPopupForm>
    </section>
  );
}

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  type AccessProfile,
  type PharmaCustomer,
  type PharmaPrescription,
  type PharmaSale,
  downloadPharmaPrescriptionAttachment,
  getPharmaCustomers,
  getPharmaPrescriptions,
  getPharmaSales,
  updatePharmaCustomer,
  updatePharmaPrescription,
  uploadPharmaPrescriptionAttachment,
} from '../lib/api';

type Props = {
  token: string;
  profile: AccessProfile;
  mode: 'customers' | 'prescriptions';
};

type CustomerRow = {
  customer: PharmaCustomer;
  amount: number;
  outstanding: number;
  paymentStatus: string;
  typeLabel: string;
};

type PrescriptionRow = {
  prescription: PharmaPrescription;
  amount: number;
  drugs: string;
  customerName: string;
  customerPhone: string;
  customerType: string;
};

type CustomerFormState = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  customer_type: string;
  insurance_provider: string;
  insurance_membership_number: string;
  status: 'active' | 'inactive';
};

type PrescriptionFormState = {
  pharmaco_customer_id: string;
  prescription_number: string;
  prescriber_name: string;
  prescriber_facility: string;
  prescriber_phone: string;
  issued_at: string;
  expires_at: string;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  notes: string;
};

const customerColumns = [
  ['sn', 'SN'],
  ['customer', 'Customer'],
  ['phone', 'Customer Tel'],
  ['type', 'Customer Type'],
  ['payment', 'Payment Status'],
  ['amount', 'Amount'],
  ['actions', 'Open Details'],
] as const;

const prescriptionColumns = [
  ['sn', 'SN'],
  ['name', 'Name'],
  ['phone', 'Customer Tel'],
  ['type', 'Customer Type'],
  ['drugs', 'Prescribed Drugs'],
  ['amount', 'Amount'],
  ['attachment', 'Attachment'],
  ['actions', 'Open Details'],
] as const;

function asRecord(
  value: unknown,
): Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
    ? value as Record<string, unknown>
    : {};
}

function tenantSlugFrom(
  profile: AccessProfile,
): string {
  const assignments = Array.isArray(
    profile.tenant_assignments,
  )
    ? profile.tenant_assignments
    : [];

  const assignment = asRecord(assignments[0]);
  const tenant = asRecord(assignment.tenant);

  return String(tenant.slug ?? '').trim();
}

function money(value: number): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value);
}

function labelize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function customerTypeLabel(
  customer: PharmaCustomer | null | undefined,
): string {
  if (!customer) {
    return 'Walk-in';
  }

  const rawType = String(
    customer.customer_type ?? '',
  )
    .trim()
    .toLowerCase();

  if (
    customer.insurance_provider ||
    rawType.includes('insurance')
  ) {
    return 'Insurance Customer';
  }

  if (
    rawType.includes('corporate') ||
    rawType.includes('company')
  ) {
    return 'Corporate Customer';
  }

  if (
    rawType.includes('credit')
  ) {
    return 'Credit Customer';
  }

  if (
    rawType.includes('walk')
  ) {
    return 'Walk-in';
  }

  return rawType
    ? labelize(rawType)
    : 'Registered Customer';
}

function customerFormFrom(
  customer: PharmaCustomer,
): CustomerFormState {
  return {
    first_name: customer.first_name ?? '',
    last_name: customer.last_name ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    customer_type:
      customer.customer_type ?? 'patient',
    insurance_provider:
      customer.insurance_provider ?? '',
    insurance_membership_number:
      customer.insurance_membership_number ?? '',
    status:
      customer.status === 'inactive'
        ? 'inactive'
        : 'active',
  };
}

function prescriptionFormFrom(
  prescription: PharmaPrescription,
): PrescriptionFormState {
  return {
    pharmaco_customer_id:
      prescription.customer?.id
        ? String(prescription.customer.id)
        : '',
    prescription_number:
      prescription.prescription_number ?? '',
    prescriber_name:
      prescription.prescriber_name ?? '',
    prescriber_facility:
      prescription.prescriber_facility ?? '',
    prescriber_phone:
      prescription.prescriber_phone ?? '',
    issued_at:
      prescription.issued_at ?? '',
    expires_at:
      prescription.expires_at ?? '',
    status:
      prescription.status === 'used' ||
      prescription.status === 'expired' ||
      prescription.status === 'cancelled'
        ? prescription.status
        : 'active',
    notes:
      prescription.notes ?? '',
  };
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');

  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): void {
  const csv = [
    headers.map(csvCell).join(','),
    ...rows.map((row) =>
      row.map(csvCell).join(','),
    ),
  ].join('\n');

  const blob = new Blob(
    [csv],
    {
      type: 'text/csv;charset=utf-8',
    },
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

export function CustomerPrescriptionManagementWorkspace({
  token,
  profile,
  mode,
}: Props) {
  const tenantSlug = tenantSlugFrom(profile);

  const [customers, setCustomers] =
    useState<PharmaCustomer[]>([]);

  const [prescriptions, setPrescriptions] =
    useState<PharmaPrescription[]>([]);

  const [sales, setSales] =
    useState<PharmaSale[]>([]);

  const [search, setSearch] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState('all');

  const [typeFilter, setTypeFilter] =
    useState('all');

  const [page, setPage] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(10);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [notice, setNotice] =
    useState('');

  const [error, setError] =
    useState('');

  const [
    showColumnManagement,
    setShowColumnManagement,
  ] = useState(false);

  const customerDefaultColumns =
    customerColumns.map(
      ([key]) => key,
    );

  const prescriptionDefaultColumns =
    prescriptionColumns.map(
      ([key]) => key,
    );

  const [visibleColumns, setVisibleColumns] =
    useState<string[]>(
      mode === 'customers'
        ? customerDefaultColumns
        : prescriptionDefaultColumns,
    );

  const [
    selectedCustomer,
    setSelectedCustomer,
  ] = useState<PharmaCustomer | null>(null);

  const [
    selectedPrescription,
    setSelectedPrescription,
  ] = useState<PharmaPrescription | null>(null);

  const [customerForm, setCustomerForm] =
    useState<CustomerFormState | null>(null);

  const [
    prescriptionForm,
    setPrescriptionForm,
  ] = useState<PrescriptionFormState | null>(null);

  const [
    prescriptionAttachment,
    setPrescriptionAttachment,
  ] = useState<File | null>(null);

  const loadWorkspace = useCallback(
    async () => {
      if (!tenantSlug) {
        setError(
          'An active tenant assignment is required.',
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const [
          customerResponse,
          prescriptionResponse,
          salesResponse,
        ] = await Promise.all([
          getPharmaCustomers(
            token,
            tenantSlug,
          ),
          getPharmaPrescriptions(
            token,
            tenantSlug,
          ),
          getPharmaSales(
            token,
            tenantSlug,
          ),
        ]);

        setCustomers(
          customerResponse.customers,
        );

        setPrescriptions(
          prescriptionResponse.prescriptions,
        );

        setSales(
          salesResponse.sales,
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load the managed register.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      tenantSlug,
      token,
    ],
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    typeFilter,
    pageSize,
    mode,
  ]);

  useEffect(() => {
    setVisibleColumns(
      mode === 'customers'
        ? customerDefaultColumns
        : prescriptionDefaultColumns,
    );
  }, [mode]);

  const customerRows =
    useMemo<CustomerRow[]>(() => {
      return customers.map((customer) => {
        const linkedSales = sales.filter(
          (sale) =>
            sale.customer?.id === customer.id,
        );

        const amount = linkedSales.reduce(
          (sum, sale) =>
            sum +
            Number(sale.total_amount ?? 0),
          0,
        );

        const outstanding = linkedSales.reduce(
          (sum, sale) =>
            sum +
            Number(sale.balance_amount ?? 0),
          0,
        );

        let paymentStatus =
          'No Transactions';

        if (linkedSales.length > 0) {
          paymentStatus =
            outstanding > 0
              ? 'Outstanding'
              : linkedSales.every(
                  (sale) =>
                    sale.payment_status === 'paid',
                )
                ? 'Paid'
                : 'Pending';
        }

        return {
          customer,
          amount,
          outstanding,
          paymentStatus,
          typeLabel:
            customerTypeLabel(customer),
        };
      });
    }, [
      customers,
      sales,
    ]);

  const prescriptionRows =
    useMemo<PrescriptionRow[]>(() => {
      return prescriptions.map(
        (prescription) => {
          const linkedSales = sales.filter(
            (sale) =>
              sale.prescription?.id ===
              prescription.id,
          );

          const amount = linkedSales.reduce(
            (sum, sale) =>
              sum +
              Number(sale.total_amount ?? 0),
            0,
          );

          const drugs = Array.from(
            new Set(
              linkedSales.flatMap(
                (sale) =>
                  (sale.items ?? []).map(
                    (item) =>
                      item.product_name_snapshot ||
                      item.product?.name ||
                      'Medicine',
                  ),
              ),
            ),
          ).join(', ');

          return {
            prescription,
            amount,
            drugs:
              drugs ||
              prescription.notes ||
              'Not yet linked to a dispensed item',
            customerName:
              prescription.customer?.full_name ||
              'Walk-in / unlinked patient',
            customerPhone:
              prescription.customer?.phone ||
              '-',
            customerType:
              customerTypeLabel(
                prescription.customer,
              ),
          };
        },
      );
    }, [
      prescriptions,
      sales,
    ]);

  const filteredCustomerRows =
    useMemo(() => {
      const normalizedSearch =
        search.trim().toLowerCase();

      return customerRows.filter((row) => {
        const statusMatches =
          statusFilter === 'all' ||
          row.paymentStatus
            .toLowerCase()
            .replace(/\s+/g, '_') ===
            statusFilter;

        const typeMatches =
          typeFilter === 'all' ||
          row.typeLabel === typeFilter;

        const searchMatches =
          !normalizedSearch ||
          [
            row.customer.full_name,
            row.customer.phone,
            row.customer.email,
            row.typeLabel,
            row.paymentStatus,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch);

        return (
          statusMatches &&
          typeMatches &&
          searchMatches
        );
      });
    }, [
      customerRows,
      search,
      statusFilter,
      typeFilter,
    ]);

  const filteredPrescriptionRows =
    useMemo(() => {
      const normalizedSearch =
        search.trim().toLowerCase();

      return prescriptionRows.filter(
        (row) => {
          const statusMatches =
            statusFilter === 'all' ||
            row.prescription.status ===
              statusFilter;

          const typeMatches =
            typeFilter === 'all' ||
            row.customerType === typeFilter;

          const searchMatches =
            !normalizedSearch ||
            [
              row.customerName,
              row.customerPhone,
              row.customerType,
              row.drugs,
              row.prescription
                .prescription_number,
              row.prescription.prescriber_name,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(normalizedSearch);

          return (
            statusMatches &&
            typeMatches &&
            searchMatches
          );
        },
      );
    }, [
      prescriptionRows,
      search,
      statusFilter,
      typeFilter,
    ]);

  const activeRows =
    mode === 'customers'
      ? filteredCustomerRows
      : filteredPrescriptionRows;

  const pageCount = Math.max(
    1,
    Math.ceil(
      activeRows.length / pageSize,
    ),
  );

  const safePage = Math.min(
    page,
    pageCount,
  );

  const paginatedCustomerRows =
    filteredCustomerRows.slice(
      (safePage - 1) * pageSize,
      safePage * pageSize,
    );

  const paginatedPrescriptionRows =
    filteredPrescriptionRows.slice(
      (safePage - 1) * pageSize,
      safePage * pageSize,
    );

  const typeOptions = Array.from(
    new Set(
      (
        mode === 'customers'
          ? customerRows.map(
              (row) => row.typeLabel,
            )
          : prescriptionRows.map(
              (row) => row.customerType,
            )
      ).filter(Boolean),
    ),
  ).sort();

  function columnVisible(
    key: string,
  ): boolean {
    return visibleColumns.includes(key);
  }

  function toggleColumn(
    key: string,
  ): void {
    setVisibleColumns((current) =>
      current.includes(key)
        ? current.filter(
            (column) => column !== key,
          )
        : [...current, key],
    );
  }

  function openCustomer(
    customer: PharmaCustomer,
  ): void {
    setSelectedCustomer(customer);
    setCustomerForm(
      customerFormFrom(customer),
    );
    setError('');
    setNotice('');
  }

  function openPrescription(
    prescription: PharmaPrescription,
  ): void {
    setSelectedPrescription(
      prescription,
    );
    setPrescriptionForm(
      prescriptionFormFrom(
        prescription,
      ),
    );
    setPrescriptionAttachment(null);
    setError('');
    setNotice('');
  }

  async function saveCustomer(
    event: FormEvent,
  ): Promise<void> {
    event.preventDefault();

    if (
      !selectedCustomer ||
      !customerForm
    ) {
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response =
        await updatePharmaCustomer(
          token,
          tenantSlug,
          selectedCustomer.id,
          {
            first_name:
              customerForm.first_name.trim(),
            last_name:
              customerForm.last_name.trim() ||
              null,
            phone:
              customerForm.phone.trim() ||
              null,
            email:
              customerForm.email.trim() ||
              null,
            customer_type:
              customerForm.customer_type,
            insurance_provider:
              customerForm
                .insurance_provider
                .trim() || null,
            insurance_membership_number:
              customerForm
                .insurance_membership_number
                .trim() || null,
            status: customerForm.status,
          },
        );

      setCustomers((current) =>
        current.map((customer) =>
          customer.id === response.customer.id
            ? response.customer
            : customer,
        ),
      );

      setSelectedCustomer(
        response.customer,
      );

      setCustomerForm(
        customerFormFrom(
          response.customer,
        ),
      );

      setNotice(response.message);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update the customer.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function savePrescription(
    event: FormEvent,
  ): Promise<void> {
    event.preventDefault();

    if (
      !selectedPrescription ||
      !prescriptionForm
    ) {
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const updateResponse =
        await updatePharmaPrescription(
          token,
          tenantSlug,
          selectedPrescription.id,
          {
            pharmaco_customer_id:
              prescriptionForm
                .pharmaco_customer_id
                ? Number(
                    prescriptionForm
                      .pharmaco_customer_id,
                  )
                : null,
            prescription_number:
              prescriptionForm
                .prescription_number
                .trim(),
            prescriber_name:
              prescriptionForm
                .prescriber_name
                .trim() || null,
            prescriber_facility:
              prescriptionForm
                .prescriber_facility
                .trim() || null,
            prescriber_phone:
              prescriptionForm
                .prescriber_phone
                .trim() || null,
            issued_at:
              prescriptionForm.issued_at ||
              null,
            expires_at:
              prescriptionForm.expires_at ||
              null,
            status:
              prescriptionForm.status,
            notes:
              prescriptionForm.notes.trim() ||
              null,
          },
        );

      let savedPrescription =
        updateResponse.prescription;

      if (prescriptionAttachment) {
        const uploadResponse =
          await uploadPharmaPrescriptionAttachment(
            token,
            tenantSlug,
            selectedPrescription.id,
            prescriptionAttachment,
          );

        savedPrescription =
          uploadResponse.prescription;
      }

      setPrescriptions((current) =>
        current.map((prescription) =>
          prescription.id ===
          savedPrescription.id
            ? savedPrescription
            : prescription,
        ),
      );

      setSelectedPrescription(
        savedPrescription,
      );

      setPrescriptionForm(
        prescriptionFormFrom(
          savedPrescription,
        ),
      );

      setPrescriptionAttachment(null);

      setNotice(
        prescriptionAttachment
          ? 'Prescription and attachment updated successfully.'
          : updateResponse.message,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update the prescription.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function downloadAttachment(
    prescription: PharmaPrescription,
  ): Promise<void> {
    setError('');

    try {
      const blob =
        await downloadPharmaPrescriptionAttachment(
          token,
          tenantSlug,
          prescription.id,
        );

      const url =
        URL.createObjectURL(blob);

      const anchor =
        document.createElement('a');

      anchor.href = url;
      anchor.download =
        prescription.attachment
          ?.original_name ||
        `prescription-${prescription.prescription_number}`;

      anchor.click();

      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to download the attachment.',
      );
    }
  }

  function exportRows(): void {
    if (mode === 'customers') {
      downloadCsv(
        'customers-and-patients.csv',
        [
          'SN',
          'Customer',
          'Customer Tel',
          'Customer Type',
          'Payment Status',
          'Amount',
        ],
        filteredCustomerRows.map(
          (row, index) => [
            index + 1,
            row.customer.full_name,
            row.customer.phone || '-',
            row.typeLabel,
            row.paymentStatus,
            row.amount,
          ],
        ),
      );

      return;
    }

    downloadCsv(
      'prescription-management.csv',
      [
        'SN',
        'Name',
        'Customer Tel',
        'Customer Type',
        'Prescribed Drugs',
        'Amount',
        'Attachment',
      ],
      filteredPrescriptionRows.map(
        (row, index) => [
          index + 1,
          row.customerName,
          row.customerPhone,
          row.customerType,
          row.drugs,
          row.amount,
          row.prescription.attachment
            ?.original_name ||
            'Not attached',
        ],
      ),
    );
  }

  const availableColumns =
    mode === 'customers'
      ? customerColumns
      : prescriptionColumns;

  return (
    <section className="managed-register-workspace">
      <header className="managed-register-header">
        <div>
          <span className="section-label">
            Live POS-sourced register
          </span>

          <h2>
            {mode === 'customers'
              ? 'Customer & Patient Table'
              : 'Prescription Management Table'}
          </h2>

          <p>
            {mode === 'customers'
              ? 'Customer identity, category, payment exposure, and transaction value are derived from POS customer and sales records.'
              : 'Prescription, customer, medicine, transaction, and attachment information is connected to the POS dispensing workflow.'}
          </p>
        </div>

        <div className="managed-register-header-actions">
          <button
            type="button"
            onClick={() =>
              setShowColumnManagement(
                (current) => !current,
              )
            }
          >
            Manage columns
          </button>

          <button
            type="button"
            onClick={exportRows}
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={() =>
              void loadWorkspace()
            }
            disabled={isLoading}
          >
            {isLoading
              ? 'Refreshing…'
              : 'Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <div
          className="sales-control-message error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="sales-control-message success"
          role="status"
        >
          {notice}
        </div>
      )}

      {showColumnManagement && (
        <div className="managed-column-control">
          <div>
            <strong>
              Visible table columns
            </strong>

            <small>
              Choose the information displayed in
              this workspace.
            </small>
          </div>

          <div>
            {availableColumns.map(
              ([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={columnVisible(key)}
                    onChange={() =>
                      toggleColumn(key)
                    }
                  />

                  <span>{label}</span>
                </label>
              ),
            )}
          </div>
        </div>
      )}

      <div className="managed-register-toolbar">
        <label>
          <span>Search</span>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder={
              mode === 'customers'
                ? 'Customer, phone, email, type or payment status'
                : 'Patient, phone, prescription, prescriber or medicine'
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

            {mode === 'customers' ? (
              <>
                <option value="paid">
                  Paid
                </option>
                <option value="outstanding">
                  Outstanding
                </option>
                <option value="pending">
                  Pending
                </option>
                <option value="no_transactions">
                  No transactions
                </option>
              </>
            ) : (
              <>
                <option value="active">
                  Active
                </option>
                <option value="used">
                  Used
                </option>
                <option value="expired">
                  Expired
                </option>
                <option value="cancelled">
                  Cancelled
                </option>
              </>
            )}
          </select>
        </label>

        <label>
          <span>Customer type</span>

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(
                event.target.value,
              )
            }
          >
            <option value="all">
              All customer types
            </option>

            {typeOptions.map((type) => (
              <option
                key={type}
                value={type}
              >
                {type}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Rows per page</span>

          <select
            value={pageSize}
            onChange={(event) =>
              setPageSize(
                Number(event.target.value),
              )
            }
          >
            <option value={5}>5 rows</option>
            <option value={10}>10 rows</option>
            <option value={15}>15 rows</option>
            <option value={25}>25 rows</option>
          </select>
        </label>
      </div>

      <div className="managed-register-table-wrap">
        <table className="managed-register-table">
          <thead>
            {mode === 'customers' ? (
              <tr>
                {columnVisible('sn') && <th>SN</th>}
                {columnVisible('customer') && <th>Customer</th>}
                {columnVisible('phone') && <th>Customer Tel</th>}
                {columnVisible('type') && <th>Customer Type</th>}
                {columnVisible('payment') && <th>Payment Status</th>}
                {columnVisible('amount') && <th>Amount</th>}
                {columnVisible('actions') && <th>Open Details</th>}
              </tr>
            ) : (
              <tr>
                {columnVisible('sn') && <th>SN</th>}
                {columnVisible('name') && <th>Name</th>}
                {columnVisible('phone') && <th>Customer Tel</th>}
                {columnVisible('type') && <th>Customer Type</th>}
                {columnVisible('drugs') && <th>Prescribed Drugs</th>}
                {columnVisible('amount') && <th>Amount</th>}
                {columnVisible('attachment') && <th>Attachment</th>}
                {columnVisible('actions') && <th>Open Details</th>}
              </tr>
            )}
          </thead>

          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={
                    visibleColumns.length
                  }
                >
                  Loading the managed register…
                </td>
              </tr>
            )}

            {!isLoading &&
              mode === 'customers' &&
              paginatedCustomerRows.map(
                (row, index) => (
                  <tr key={row.customer.id}>
                    {columnVisible('sn') && (
                      <td>
                        {(safePage - 1) *
                          pageSize +
                          index +
                          1}
                      </td>
                    )}

                    {columnVisible('customer') && (
                      <td>
                        <strong>
                          {row.customer.full_name}
                        </strong>

                        <small>
                          {row.customer.email || '-'}
                        </small>
                      </td>
                    )}

                    {columnVisible('phone') && (
                      <td>
                        {row.customer.phone || '-'}
                      </td>
                    )}

                    {columnVisible('type') && (
                      <td>
                        {row.typeLabel}
                      </td>
                    )}

                    {columnVisible('payment') && (
                      <td>
                        <span
                          className={`managed-status ${row.paymentStatus
                            .toLowerCase()
                            .replace(/\s+/g, '-')}`}
                        >
                          {row.paymentStatus}
                        </span>

                        {row.outstanding > 0 && (
                          <small>
                            {money(row.outstanding)}
                            {' '}outstanding
                          </small>
                        )}
                      </td>
                    )}

                    {columnVisible('amount') && (
                      <td>
                        <strong>
                          {money(row.amount)}
                        </strong>
                      </td>
                    )}

                    {columnVisible('actions') && (
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            openCustomer(
                              row.customer,
                            )
                          }
                        >
                          View / Update
                        </button>
                      </td>
                    )}
                  </tr>
                ),
              )}

            {!isLoading &&
              mode === 'prescriptions' &&
              paginatedPrescriptionRows.map(
                (row, index) => (
                  <tr
                    key={row.prescription.id}
                  >
                    {columnVisible('sn') && (
                      <td>
                        {(safePage - 1) *
                          pageSize +
                          index +
                          1}
                      </td>
                    )}

                    {columnVisible('name') && (
                      <td>
                        <strong>
                          {row.customerName}
                        </strong>

                        <small>
                          {
                            row.prescription
                              .prescription_number
                          }
                        </small>
                      </td>
                    )}

                    {columnVisible('phone') && (
                      <td>
                        {row.customerPhone}
                      </td>
                    )}

                    {columnVisible('type') && (
                      <td>
                        {row.customerType}
                      </td>
                    )}

                    {columnVisible('drugs') && (
                      <td className="managed-drug-cell">
                        {row.drugs}
                      </td>
                    )}

                    {columnVisible('amount') && (
                      <td>
                        <strong>
                          {money(row.amount)}
                        </strong>
                      </td>
                    )}

                    {columnVisible('attachment') && (
                      <td>
                        {row.prescription
                          .attachment ? (
                          <button
                            type="button"
                            className="managed-link-button"
                            onClick={() =>
                              void downloadAttachment(
                                row.prescription,
                              )
                            }
                          >
                            {
                              row.prescription
                                .attachment
                                .original_name
                            }
                          </button>
                        ) : (
                          <span className="managed-status missing">
                            Not attached
                          </span>
                        )}
                      </td>
                    )}

                    {columnVisible('actions') && (
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            openPrescription(
                              row.prescription,
                            )
                          }
                        >
                          View / Update
                        </button>
                      </td>
                    )}
                  </tr>
                ),
              )}

            {!isLoading &&
              activeRows.length === 0 && (
                <tr>
                  <td
                    colSpan={
                      visibleColumns.length
                    }
                  >
                    No records match the selected
                    table controls.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>

      <footer className="managed-register-pagination">
        <span>
          Showing{' '}
          {activeRows.length === 0
            ? 0
            : (safePage - 1) *
                pageSize +
              1}
          {' '}to{' '}
          {Math.min(
            safePage * pageSize,
            activeRows.length,
          )}
          {' '}of {activeRows.length}
        </span>

        <div>
          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.max(
                  1,
                  current - 1,
                ),
              )
            }
            disabled={safePage <= 1}
          >
            Previous
          </button>

          <strong>
            Page {safePage} of {pageCount}
          </strong>

          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.min(
                  pageCount,
                  current + 1,
                ),
              )
            }
            disabled={
              safePage >= pageCount
            }
          >
            Next
          </button>
        </div>
      </footer>

      {selectedCustomer &&
        customerForm && (
          <div
            className="workspace-explicit-modal-backdrop is-open"
            role="presentation"
            onMouseDown={() =>
              setSelectedCustomer(null)
            }
          >
            <section
              className="workspace-explicit-modal managed-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Customer details"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                className="workspace-explicit-modal-close"
                onClick={() =>
                  setSelectedCustomer(null)
                }
                aria-label="Close customer details"
              >
                ×
              </button>

              <div className="popup-form-heading">
                <span className="section-label">
                  Customer record
                </span>

                <h3>
                  {selectedCustomer.full_name}
                </h3>

                <p className="muted">
                  View and update the information
                  captured through the POS workflow.
                </p>
              </div>

              <form
                className="managed-detail-form"
                onSubmit={saveCustomer}
              >
                <div className="managed-detail-grid">
                  <label>
                    First name
                    <input
                      value={
                        customerForm.first_name
                      }
                      onChange={(event) =>
                        setCustomerForm({
                          ...customerForm,
                          first_name:
                            event.target.value,
                        })
                      }
                      required
                    />
                  </label>

                  <label>
                    Last name
                    <input
                      value={
                        customerForm.last_name
                      }
                      onChange={(event) =>
                        setCustomerForm({
                          ...customerForm,
                          last_name:
                            event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Customer telephone
                    <input
                      value={customerForm.phone}
                      onChange={(event) =>
                        setCustomerForm({
                          ...customerForm,
                          phone:
                            event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      value={customerForm.email}
                      onChange={(event) =>
                        setCustomerForm({
                          ...customerForm,
                          email:
                            event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Customer type
                    <select
                      value={
                        customerForm.customer_type
                      }
                      onChange={(event) =>
                        setCustomerForm({
                          ...customerForm,
                          customer_type:
                            event.target.value,
                        })
                      }
                    >
                      <option value="walk_in">
                        Walk-in
                      </option>
                      <option value="patient">
                        Registered Customer
                      </option>
                      <option value="insurance">
                        Insurance Customer
                      </option>
                      <option value="corporate">
                        Corporate Customer
                      </option>
                      <option value="credit">
                        Credit Customer
                      </option>
                    </select>
                  </label>

                  <label>
                    Status
                    <select
                      value={customerForm.status}
                      onChange={(event) =>
                        setCustomerForm({
                          ...customerForm,
                          status:
                            event.target
                              .value as
                              | 'active'
                              | 'inactive',
                        })
                      }
                    >
                      <option value="active">
                        Active
                      </option>
                      <option value="inactive">
                        Inactive
                      </option>
                    </select>
                  </label>

                  <label>
                    Insurance provider
                    <input
                      value={
                        customerForm
                          .insurance_provider
                      }
                      onChange={(event) =>
                        setCustomerForm({
                          ...customerForm,
                          insurance_provider:
                            event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Membership number
                    <input
                      value={
                        customerForm
                          .insurance_membership_number
                      }
                      onChange={(event) =>
                        setCustomerForm({
                          ...customerForm,
                          insurance_membership_number:
                            event.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="managed-detail-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCustomer(null)
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                  >
                    {isSaving
                      ? 'Saving…'
                      : 'Update customer'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

      {selectedPrescription &&
        prescriptionForm && (
          <div
            className="workspace-explicit-modal-backdrop is-open"
            role="presentation"
            onMouseDown={() =>
              setSelectedPrescription(null)
            }
          >
            <section
              className="workspace-explicit-modal managed-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Prescription details"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                className="workspace-explicit-modal-close"
                onClick={() =>
                  setSelectedPrescription(null)
                }
                aria-label="Close prescription details"
              >
                ×
              </button>

              <div className="popup-form-heading">
                <span className="section-label">
                  Prescription record
                </span>

                <h3>
                  {
                    selectedPrescription
                      .prescription_number
                  }
                </h3>

                <p className="muted">
                  Update the clinical record and
                  attach the prescription now or
                  later.
                </p>
              </div>

              <form
                className="managed-detail-form"
                onSubmit={savePrescription}
              >
                <div className="managed-detail-grid">
                  <label>
                    Customer / Patient
                    <select
                      value={
                        prescriptionForm
                          .pharmaco_customer_id
                      }
                      onChange={(event) =>
                        setPrescriptionForm({
                          ...prescriptionForm,
                          pharmaco_customer_id:
                            event.target.value,
                        })
                      }
                    >
                      <option value="">
                        Walk-in / unlinked patient
                      </option>

                      {customers.map(
                        (customer) => (
                          <option
                            key={customer.id}
                            value={customer.id}
                          >
                            {customer.full_name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label>
                    Prescription number
                    <input
                      value={
                        prescriptionForm
                          .prescription_number
                      }
                      onChange={(event) =>
                        setPrescriptionForm({
                          ...prescriptionForm,
                          prescription_number:
                            event.target.value,
                        })
                      }
                      required
                    />
                  </label>

                  <label>
                    Prescriber
                    <input
                      value={
                        prescriptionForm
                          .prescriber_name
                      }
                      onChange={(event) =>
                        setPrescriptionForm({
                          ...prescriptionForm,
                          prescriber_name:
                            event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Prescriber facility
                    <input
                      value={
                        prescriptionForm
                          .prescriber_facility
                      }
                      onChange={(event) =>
                        setPrescriptionForm({
                          ...prescriptionForm,
                          prescriber_facility:
                            event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Prescriber telephone
                    <input
                      value={
                        prescriptionForm
                          .prescriber_phone
                      }
                      onChange={(event) =>
                        setPrescriptionForm({
                          ...prescriptionForm,
                          prescriber_phone:
                            event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Status
                    <select
                      value={
                        prescriptionForm.status
                      }
                      onChange={(event) =>
                        setPrescriptionForm({
                          ...prescriptionForm,
                          status:
                            event.target
                              .value as
                              PrescriptionFormState['status'],
                        })
                      }
                    >
                      <option value="active">
                        Active
                      </option>
                      <option value="used">
                        Used
                      </option>
                      <option value="expired">
                        Expired
                      </option>
                      <option value="cancelled">
                        Cancelled
                      </option>
                    </select>
                  </label>

                  <label>
                    Issued date
                    <input
                      type="date"
                      value={
                        prescriptionForm.issued_at
                      }
                      onChange={(event) =>
                        setPrescriptionForm({
                          ...prescriptionForm,
                          issued_at:
                            event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Expiry date
                    <input
                      type="date"
                      value={
                        prescriptionForm.expires_at
                      }
                      onChange={(event) =>
                        setPrescriptionForm({
                          ...prescriptionForm,
                          expires_at:
                            event.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="managed-detail-wide">
                    Clinical or prescribed-drug notes
                    <textarea
                      value={
                        prescriptionForm.notes
                      }
                      onChange={(event) =>
                        setPrescriptionForm({
                          ...prescriptionForm,
                          notes:
                            event.target.value,
                        })
                      }
                      rows={4}
                    />
                  </label>

                  <label className="managed-detail-wide">
                    Prescription attachment
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(event) =>
                        setPrescriptionAttachment(
                          event.target.files?.[0] ??
                          null,
                        )
                      }
                    />

                    <small>
                      PDF, JPG, PNG, or WebP. Maximum
                      size 10 MB. Existing attachment:
                      {' '}
                      {selectedPrescription
                        .attachment?.original_name ||
                        'None'}
                    </small>
                  </label>
                </div>

                <div className="managed-detail-actions">
                  {selectedPrescription
                    .attachment && (
                    <button
                      type="button"
                      onClick={() =>
                        void downloadAttachment(
                          selectedPrescription,
                        )
                      }
                    >
                      Download current attachment
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPrescription(null)
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                  >
                    {isSaving
                      ? 'Saving…'
                      : 'Update prescription'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
    </section>
  );
}

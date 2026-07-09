import {
  Component,
  type ErrorInfo,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  type AccessProfile,
  type PharmaPayment,
  type PharmaSale,
  getPharmaSale,
  getPharmaSales,
} from '../lib/api';

import {
  type PaymentReconciliation,
  type SaleRefundMethod,
  type SaleReturn,
  type SaleReturnDisposition,
  type SalesReturnsRequestContext,
  approveSaleReturn,
  createSaleReturn,
  getSaleReturns,
  reconcilePharmaPayment,
  rejectSaleReturn,
} from '../lib/salesReturnsApi';

type SalesReturnsWorkspaceProps = {
  token: string;
  profile: AccessProfile;
  mode: 'sales' | 'payments';
};

type ReturnQuantityState = Record<number, string>;
type ReturnDispositionState =
  Record<number, SaleReturnDisposition>;

const refundMethods: Array<{
  value: SaleRefundMethod;
  label: string;
}> = [
  {
    value: 'credit_note',
    label: 'Credit note',
  },
  {
    value: 'original_method',
    label: 'Original payment method',
  },
  {
    value: 'cash',
    label: 'Cash',
  },
  {
    value: 'momo',
    label: 'Mobile money',
  },
  {
    value: 'card',
    label: 'Card',
  },
  {
    value: 'bank_transfer',
    label: 'Bank transfer',
  },
];

const dispositionOptions: Array<{
  value: SaleReturnDisposition;
  label: string;
  description: string;
}> = [
  {
    value: 'quarantine',
    label: 'Quarantine',
    description:
      'Hold the item for pharmacist or quality review.',
  },
  {
    value: 'restock',
    label: 'Restock',
    description:
      'Return an unopened and verified item to available stock.',
  },
  {
    value: 'destroy',
    label: 'Destroy',
    description:
      'Record the item for controlled destruction.',
  },
  {
    value: 'no_restock',
    label: 'No restock',
    description:
      'Refund without restoring inventory.',
  },
];

function tenantSlugFrom(
  profile: AccessProfile,
): string {
  const assignments = Array.isArray(
    profile.tenant_assignments,
  )
    ? profile.tenant_assignments
    : [];

  return assignments[0]?.tenant?.slug ?? '';
}

function normalizePermission(
  permission: string,
): string {
  return permission
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '.');
}

function profileCanManageRefunds(
  profile: AccessProfile,
): boolean {
  const roles = Array.isArray(profile.roles)
    ? profile.roles
    : [];

  const profilePermissions = Array.isArray(
    profile.permissions,
  )
    ? profile.permissions
    : [];

  const adminRoleCodes = new Set([
    'admin',
    'administrator',
    'super_admin',
    'system_admin',
    'platform_admin',
    'solution_admin',
    'tenant_admin',
    'owner',
    'ubuzima_plus_super_admin',
  ]);

  const hasAdminRole = roles.some((role) => {
    const code = role.code
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, '_');

    return (
      adminRoleCodes.has(code) ||
      code.endsWith('_admin') ||
      code.includes('_admin_')
    );
  });

  if (hasAdminRole) {
    return true;
  }

  const permissions = new Set(
    profilePermissions
      .filter(
        (permission): permission is string =>
          typeof permission === 'string',
      )
      .map(normalizePermission),
  );

  return permissions.has('pharmaco.pos.refund');
}

function money(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function dateTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Not recorded';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-RW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function statusClass(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

function customerName(sale: PharmaSale): string {
  if (!sale.customer) {
    return 'Walk-in customer';
  }

  const firstName =
    'first_name' in sale.customer
      ? String(sale.customer.first_name ?? '')
      : '';

  const lastName =
    'last_name' in sale.customer
      ? String(sale.customer.last_name ?? '')
      : '';

  const fullName = `${firstName} ${lastName}`.trim();

  return (
    fullName ||
    sale.customer.phone ||
    sale.customer.email ||
    'Registered customer'
  );
}

function paymentLabel(
  payment: PharmaPayment,
): string {
  const method = payment.payment_method
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );

  return payment.receipt_number
    ? `${method} · ${payment.receipt_number}`
    : method;
}


function managedSalesRecord(
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

function managedSalesText(
  value: unknown,
  fallback = '-',
): string {
  const text = String(value ?? '').trim();

  return text || fallback;
}

function managedSalesNumber(
  value: unknown,
): number {
  const number = Number(value ?? 0);

  return Number.isFinite(number)
    ? number
    : 0;
}

function managedSalesMoney(
  value: unknown,
): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(
    managedSalesNumber(value),
  );
}

function managedSalesDate(
  value: unknown,
): string {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return '-';
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat(
    'en-RW',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date);
}

function managedSalesCustomer(
  sale: PharmaSale,
): string {
  const record = managedSalesRecord(
    sale.customer,
  );

  const fullName = managedSalesText(
    record.full_name,
    '',
  );

  if (fullName) {
    return fullName;
  }

  const firstName = managedSalesText(
    record.first_name,
    '',
  );

  const lastName = managedSalesText(
    record.last_name,
    '',
  );

  return (
    `${firstName} ${lastName}`.trim() ||
    managedSalesText(
      record.phone,
      '',
    ) ||
    managedSalesText(
      record.email,
      '',
    ) ||
    'Walk-in customer'
  );
}

function managedSalesLabel(
  value: unknown,
): string {
  return managedSalesText(value)
    .replace(/[_-]+/g, ' ')
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function SalesReturnsWorkspaceContent({
  token,
  profile,
  mode,
}: SalesReturnsWorkspaceProps) {
  const tenantSlug = tenantSlugFrom(profile);
  const canManageRefunds =
    profileCanManageRefunds(profile);

  const context = useMemo<SalesReturnsRequestContext>(
    () => ({
      token,
      tenantSlug,
    }),
    [tenantSlug, token],
  );

  const [sales, setSales] = useState<PharmaSale[]>([]);

  const [managedSaleSearch, setManagedSaleSearch] =
    useState('');

  const [managedSaleStatus, setManagedSaleStatus] =
    useState('all');

  const [
    managedPaymentStatus,
    setManagedPaymentStatus,
  ] = useState('all');

  const [managedSaleType, setManagedSaleType] =
    useState('all');

  const [managedDateFrom, setManagedDateFrom] =
    useState('');

  const [managedDateTo, setManagedDateTo] =
    useState('');

  const [managedRowLimit, setManagedRowLimit] =
    useState(5);

  const [
    activeOperationsModal,
    setActiveOperationsModal,
  ] = useState<
    | 'details'
    | 'return'
    | 'approval'
    | 'reconciliation'
    | null
  >(null);

  const [paymentSearch, setPaymentSearch] =
    useState('');

  const [
    paymentMethodFilter,
    setPaymentMethodFilter,
  ] = useState('all');

  const [
    paymentStatusFilter,
    setPaymentStatusFilter,
  ] = useState('all');

  const [paymentDateFrom, setPaymentDateFrom] =
    useState('');

  const [paymentDateTo, setPaymentDateTo] =
    useState('');

  const [
    paymentMinimumAmount,
    setPaymentMinimumAmount,
  ] = useState('');

  const [
    paymentMaximumAmount,
    setPaymentMaximumAmount,
  ] = useState('');

  const [paymentRowLimit, setPaymentRowLimit] =
    useState(15);

  const [returns, setReturns] = useState<SaleReturn[]>(
    [],
  );
  const [selectedSaleId, setSelectedSaleId] =
    useState<number | null>(null);
  const [saleDetail, setSaleDetail] =
    useState<PharmaSale | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] =
    useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState('');
  const [saleStatus, setSaleStatus] = useState('all');

  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnMethod, setReturnMethod] =
    useState<SaleRefundMethod>('credit_note');
  const [returnQuantities, setReturnQuantities] =
    useState<ReturnQuantityState>({});
  const [returnDispositions, setReturnDispositions] =
    useState<ReturnDispositionState>({});

  const [decisionReturnId, setDecisionReturnId] =
    useState<number | null>(null);
  const [decisionMethod, setDecisionMethod] =
    useState<SaleRefundMethod>('credit_note');
  const [decisionReference, setDecisionReference] =
    useState('');
  const [decisionNotes, setDecisionNotes] =
    useState('');

  const [selectedPaymentId, setSelectedPaymentId] =
    useState<number | null>(null);
  const [reconciliationStatus, setReconciliationStatus] =
    useState<
      'pending' | 'matched' | 'exception' | 'reversed'
    >('matched');
  const [settledAmount, setSettledAmount] =
    useState('');
  const [providerReference, setProviderReference] =
    useState('');
  const [reconciliationNotes, setReconciliationNotes] =
    useState('');
  const [
    latestReconciliation,
    setLatestReconciliation,
  ] = useState<PaymentReconciliation | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!tenantSlug) {
      setError(
        'No active tenant assignment is available for this workspace.',
      );
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const [salesResponse, returnsResponse] =
        await Promise.all([
          getPharmaSales(token, tenantSlug),
          canManageRefunds
            ? getSaleReturns(context)
            : Promise.resolve({
                returns: [] as SaleReturn[],
              }),
        ]);

      const nextSales = Array.isArray(
        salesResponse.sales,
      )
        ? salesResponse.sales
        : [];

      const nextReturns = Array.isArray(
        returnsResponse.returns,
      )
        ? returnsResponse.returns
        : [];

      const detailedSales = await Promise.all(
        nextSales.map(async (sale) => {
          try {
            const response = await getPharmaSale(
              token,
              tenantSlug,
              sale.id,
            );

            return response.sale;
          } catch {
            return sale;
          }
        }),
      );

      setSales(detailedSales);
      setReturns(nextReturns);

      setSelectedSaleId((currentId) => {
        if (
          currentId &&
          detailedSales.some(
            (sale) => sale.id === currentId,
          )
        ) {
          return currentId;
        }

        return null;
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load sales operations.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    canManageRefunds,
    context,
    tenantSlug,
    token,
  ]);

  const loadSaleDetail = useCallback(
    async (saleId: number) => {
      if (!tenantSlug) {
        return;
      }

      setIsLoadingDetail(true);
      setError('');

      try {
        const response = await getPharmaSale(
          token,
          tenantSlug,
          saleId,
        );

        setSaleDetail(response.sale);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load the selected sale.',
        );
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [tenantSlug, token],
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!selectedSaleId) {
      setSaleDetail(null);
      return;
    }

    void loadSaleDetail(selectedSaleId);
  }, [loadSaleDetail, selectedSaleId]);

  const selectedSale = useMemo(() => {
    if (
      saleDetail &&
      saleDetail.id === selectedSaleId
    ) {
      return saleDetail;
    }

    return (
      sales.find(
        (sale) => sale.id === selectedSaleId,
      ) ?? null
    );
  }, [saleDetail, sales, selectedSaleId]);

  const filteredSales = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return sales.filter((sale) => {
      const statusMatches =
        saleStatus === 'all' ||
        sale.status === saleStatus ||
        sale.payment_status === saleStatus;

      if (!statusMatches) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchable = [
        sale.sale_number,
        customerName(sale),
        sale.status,
        sale.payment_status,
        sale.branch?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [saleStatus, sales, search]);

  const selectedSaleReturns = useMemo(
    () =>
      returns.filter(
        (saleReturn) =>
          saleReturn.sale?.id === selectedSaleId,
      ),
    [returns, selectedSaleId],
  );

  const pendingReturns = useMemo(
    () =>
      returns.filter(
        (saleReturn) =>
          saleReturn.status === 'pending',
      ),
    [returns],
  );

  const issuedCreditNotes = useMemo(
    () =>
      returns.filter(
        (saleReturn) =>
          Boolean(saleReturn.credit_note_number),
      ),
    [returns],
  );

  const selectedReturn = useMemo(() => {
    if (decisionReturnId) {
      return (
        returns.find(
          (saleReturn) =>
            saleReturn.id === decisionReturnId,
        ) ?? null
      );
    }

    return pendingReturns[0] ?? null;
  }, [
    decisionReturnId,
    pendingReturns,
    returns,
  ]);

  const selectedPayment = useMemo(() => {
    const payments = selectedSale?.payments ?? [];

    if (selectedPaymentId) {
      return (
        payments.find(
          (payment) =>
            payment.id === selectedPaymentId,
        ) ?? null
      );
    }

    return payments[0] ?? null;
  }, [selectedPaymentId, selectedSale]);

  useEffect(() => {
    const payments = selectedSale?.payments ?? [];

    if (payments.length === 0) {
      setSelectedPaymentId(null);
      setSettledAmount('');
      return;
    }

    setSelectedPaymentId((currentId) => {
      if (
        currentId &&
        payments.some(
          (payment) => payment.id === currentId,
        )
      ) {
        return currentId;
      }

      return payments[0].id;
    });
  }, [selectedSale]);

  useEffect(() => {
    if (!selectedPayment) {
      return;
    }

    setSettledAmount(
      String(selectedPayment.amount),
    );
  }, [selectedPayment]);

  const totalSalesValue = useMemo(
    () =>
      sales.reduce(
        (total, sale) =>
          total + Number(sale.total_amount),
        0,
      ),
    [sales],
  );

  const totalCollected = useMemo(
    () =>
      sales.reduce(
        (total, sale) =>
          total + Number(sale.paid_amount),
        0,
      ),
    [sales],
  );

  const totalOutstanding = useMemo(
    () =>
      sales.reduce(
        (total, sale) =>
          total + Number(sale.balance_amount),
        0,
      ),
    [sales],
  );

  const managedFilteredSales = useMemo(() => {
    const normalizedSearch =
      managedSaleSearch
        .trim()
        .toLowerCase();

    return sales.filter((sale) => {
      const record =
        managedSalesRecord(sale);

      const dateValue = String(
        record.sold_at ??
        record.created_at ??
        '',
      ).slice(0, 10);

      const searchMatches =
        !normalizedSearch ||
        [
          record.sale_number,
          managedSalesCustomer(sale),
          record.sale_type,
          record.status,
          record.payment_status,
          record.total_amount,
          record.balance_amount,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);

      const saleStatusMatches =
        managedSaleStatus === 'all' ||
        String(record.status ?? '') ===
          managedSaleStatus;

      const paymentStatusMatches =
        managedPaymentStatus === 'all' ||
        String(
          record.payment_status ?? '',
        ) === managedPaymentStatus;

      const saleTypeMatches =
        managedSaleType === 'all' ||
        String(record.sale_type ?? '') ===
          managedSaleType;

      const dateFromMatches =
        !managedDateFrom ||
        (
          dateValue &&
          dateValue >= managedDateFrom
        );

      const dateToMatches =
        !managedDateTo ||
        (
          dateValue &&
          dateValue <= managedDateTo
        );

      return (
        searchMatches &&
        saleStatusMatches &&
        paymentStatusMatches &&
        saleTypeMatches &&
        dateFromMatches &&
        dateToMatches
      );
    });
  }, [
    managedDateFrom,
    managedDateTo,
    managedPaymentStatus,
    managedSaleSearch,
    managedSaleStatus,
    managedSaleType,
    sales,
  ]);

  const managedVisibleSales =
    managedFilteredSales.slice(
      0,
      managedRowLimit,
    );

  const managedPendingReturns = useMemo(
    () =>
      returns.filter((saleReturn) => {
        const record =
          managedSalesRecord(saleReturn);

        return String(
          record.status ?? '',
        ).toLowerCase() === 'pending';
      }),
    [returns],
  );

  function clearManagedSaleFilters(): void {
    setManagedSaleSearch('');
    setManagedSaleStatus('all');
    setManagedPaymentStatus('all');
    setManagedSaleType('all');
    setManagedDateFrom('');
    setManagedDateTo('');
    setManagedRowLimit(5);
  }

  function exportManagedSales(): void {
    const headers = [
      'SN',
      'Date',
      'Sale Number',
      'Customer',
      'Sale Type',
      'Payment Status',
      'Sale Status',
      'Items',
      'Total',
      'Paid',
      'Balance',
    ];

    const rows = managedFilteredSales.map(
      (sale, index) => {
        const record =
          managedSalesRecord(sale);

        return [
          index + 1,
          managedSalesDate(
            record.sold_at ??
            record.created_at,
          ),
          managedSalesText(
            record.sale_number,
          ),
          managedSalesCustomer(sale),
          managedSalesLabel(
            record.sale_type,
          ),
          managedSalesLabel(
            record.payment_status,
          ),
          managedSalesLabel(
            record.status,
          ),
          managedSalesNumber(
            record.items_count ??
            sale.items?.length,
          ),
          managedSalesNumber(
            record.total_amount,
          ),
          managedSalesNumber(
            record.paid_amount,
          ),
          managedSalesNumber(
            record.balance_amount,
          ),
        ];
      },
    );

    const csvCell = (
      value: unknown,
    ) =>
      `"${String(value ?? '')
        .replace(/"/g, '""')}"`;

    const csv = [
      headers.map(csvCell).join(','),
      ...rows.map((row) =>
        row.map(csvCell).join(','),
      ),
    ].join('\n');

    const blob = new Blob(
      [csv],
      {
        type:
          'text/csv;charset=utf-8',
      },
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement('a');

    anchor.href = url;
    anchor.download =
      'sales-register.csv';

    anchor.click();

    URL.revokeObjectURL(url);
  }

  function selectSale(saleId: number) {
    setSelectedSaleId(saleId);
    setNotice('');
    setError('');
    setReturnQuantities({});
    setReturnDispositions({});
    setLatestReconciliation(null);
  }

  async function submitReturn(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedSale) {
      setError('Select a sale before creating a return.');
      return;
    }

    if (!canManageRefunds) {
      setError(
        'Your account does not have refund approval permission.',
      );
      return;
    }

    const items = (selectedSale.items ?? [])
      .map((item) => ({
        sale_item_id: item.id,
        quantity: Number(
          returnQuantities[item.id] ?? 0,
        ),
        disposition:
          returnDispositions[item.id] ??
          'quarantine',
      }))
      .filter((item) => item.quantity > 0);

    if (!returnReason.trim()) {
      setError('Enter the reason for the return.');
      return;
    }

    if (items.length === 0) {
      setError(
        'Enter a return quantity for at least one sale item.',
      );
      return;
    }

    const invalidItem = items.find((returnItem) => {
      const saleItem = selectedSale.items?.find(
        (item) =>
          item.id === returnItem.sale_item_id,
      );

      return (
        !saleItem ||
        returnItem.quantity >
          Number(saleItem.quantity)
      );
    });

    if (invalidItem) {
      setError(
        'A return quantity cannot exceed the original sold quantity.',
      );
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await createSaleReturn(
        context,
        selectedSale.id,
        {
          reason: returnReason.trim(),
          refund_method: returnMethod,
          notes: returnNotes.trim() || null,
          items,
        },
      );

      setNotice(
        `${response.message} Return ${response.return.return_number} is awaiting approval.`,
      );
      setReturnReason('');
      setReturnNotes('');
      setReturnQuantities({});
      setReturnDispositions({});

      await loadWorkspace();
      await loadSaleDetail(selectedSale.id);
      setActiveOperationsModal(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to submit the return.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function approveSelectedReturn() {
    if (!selectedReturn) {
      setError('Select a pending return.');
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await approveSaleReturn(
        context,
        selectedReturn.id,
        {
          refund_method: decisionMethod,
          refund_reference:
            decisionReference.trim() || null,
          notes: decisionNotes.trim() || null,
        },
      );

      const creditNote = response.return
        .credit_note_number
        ? ` Credit note: ${response.return.credit_note_number}.`
        : '';

      setNotice(`${response.message}${creditNote}`);
      setDecisionReturnId(null);
      setDecisionReference('');
      setDecisionNotes('');

      await loadWorkspace();

      if (selectedSaleId) {
        await loadSaleDetail(selectedSaleId);
      }

      setActiveOperationsModal(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to approve the return.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function rejectSelectedReturn() {
    if (!selectedReturn) {
      setError('Select a pending return.');
      return;
    }

    if (!decisionNotes.trim()) {
      setError(
        'Enter the rejection reason before rejecting the return.',
      );
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await rejectSaleReturn(
        context,
        selectedReturn.id,
        {
          reason: decisionNotes.trim(),
        },
      );

      setNotice(response.message);
      setDecisionReturnId(null);
      setDecisionReference('');
      setDecisionNotes('');

      await loadWorkspace();
      setActiveOperationsModal(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to reject the return.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitReconciliation(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedPayment) {
      setError('Select a payment to reconcile.');
      return;
    }

    if (!canManageRefunds) {
      setError(
        'Your account does not have payment reconciliation permission.',
      );
      return;
    }

    const amount = Number(settledAmount);

    if (
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      setError('Enter a valid settled amount.');
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await reconcilePharmaPayment(
        context,
        selectedPayment.id,
        {
          reconciliation_status:
            reconciliationStatus,
          settled_amount: amount,
          provider_reference:
            providerReference.trim() || null,
          notes:
            reconciliationNotes.trim() || null,
        },
      );

      setLatestReconciliation(
        response.reconciliation,
      );
      setNotice(response.message);
      setProviderReference('');
      setReconciliationNotes('');
      await loadWorkspace();
      setActiveOperationsModal(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to reconcile the payment.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const paymentRows = useMemo(
    () =>
      sales.flatMap((sale) =>
        (sale.payments ?? []).map(
          (payment) => ({
            sale,
            payment,
          }),
        ),
      ),
    [sales],
  );

  const filteredPaymentRows = useMemo(() => {
    const normalizedSearch =
      paymentSearch.trim().toLowerCase();

    const minimumAmount =
      paymentMinimumAmount === ''
        ? null
        : Number(paymentMinimumAmount);

    const maximumAmount =
      paymentMaximumAmount === ''
        ? null
        : Number(paymentMaximumAmount);

    return paymentRows.filter(
      ({ sale, payment }) => {
        const paymentDate =
          String(
            payment.received_at ??
            sale.sold_at ??
            '',
          ).slice(0, 10);

        const searchMatches =
          !normalizedSearch ||
          [
            payment.receipt_number,
            payment.reference_number,
            payment.payment_method,
            payment.status,
            payment.amount,
            sale.sale_number,
            customerName(sale),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch);

        const methodMatches =
          paymentMethodFilter === 'all' ||
          payment.payment_method ===
            paymentMethodFilter;

        const statusMatches =
          paymentStatusFilter === 'all' ||
          payment.status ===
            paymentStatusFilter;

        const fromMatches =
          !paymentDateFrom ||
          (
            paymentDate &&
            paymentDate >= paymentDateFrom
          );

        const toMatches =
          !paymentDateTo ||
          (
            paymentDate &&
            paymentDate <= paymentDateTo
          );

        const amount =
          Number(payment.amount ?? 0);

        const minimumMatches =
          minimumAmount === null ||
          !Number.isFinite(minimumAmount) ||
          amount >= minimumAmount;

        const maximumMatches =
          maximumAmount === null ||
          !Number.isFinite(maximumAmount) ||
          amount <= maximumAmount;

        return (
          searchMatches &&
          methodMatches &&
          statusMatches &&
          fromMatches &&
          toMatches &&
          minimumMatches &&
          maximumMatches
        );
      },
    );
  }, [
    paymentDateFrom,
    paymentDateTo,
    paymentMaximumAmount,
    paymentMethodFilter,
    paymentMinimumAmount,
    paymentRows,
    paymentSearch,
    paymentStatusFilter,
  ]);

  const visiblePaymentRows =
    filteredPaymentRows.slice(
      0,
      paymentRowLimit,
    );

  const providerPaymentRows =
    filteredPaymentRows.filter(
      ({ payment }) =>
        payment.payment_method !== 'cash',
    );

  function closeOperationsModal(): void {
    setActiveOperationsModal(null);
    setError('');
  }

  function openSaleDetails(
    saleId: number,
  ): void {
    selectSale(saleId);
    setActiveOperationsModal('details');
  }

  function openReturnRequest(
    saleId: number,
  ): void {
    selectSale(saleId);
    setActiveOperationsModal('return');
  }

  function openReturnApproval(
    saleReturn: SaleReturn,
  ): void {
    setDecisionReturnId(saleReturn.id);

    if (saleReturn.sale?.id) {
      selectSale(saleReturn.sale.id);
    }

    setActiveOperationsModal('approval');
  }

  function openPaymentReconciliation(
    sale: PharmaSale,
    payment: PharmaPayment,
  ): void {
    selectSale(sale.id);
    setSelectedPaymentId(payment.id);
    setSettledAmount(
      String(payment.amount),
    );
    setLatestReconciliation(null);
    setActiveOperationsModal(
      'reconciliation',
    );
  }

  function clearPaymentFilters(): void {
    setPaymentSearch('');
    setPaymentMethodFilter('all');
    setPaymentStatusFilter('all');
    setPaymentDateFrom('');
    setPaymentDateTo('');
    setPaymentMinimumAmount('');
    setPaymentMaximumAmount('');
    setPaymentRowLimit(15);
  }

  function exportPaymentRows(): void {
    const headers = [
      'SN',
      'Date and Time',
      'Receipt',
      'Sale Number',
      'Customer',
      'Payment Method',
      'Amount',
      'Reference',
      'Status',
    ];

    const rows =
      filteredPaymentRows.map(
        ({ sale, payment }, index) => [
          index + 1,
          dateTime(
            payment.received_at ??
            sale.sold_at,
          ),
          payment.receipt_number ??
            `Payment ${payment.id}`,
          sale.sale_number,
          customerName(sale),
          payment.payment_method,
          payment.amount,
          payment.reference_number ?? '',
          payment.status,
        ],
      );

    const csvCell = (
      value: unknown,
    ) =>
      `"${String(value ?? '')
        .replace(/"/g, '""')}"`;

    const csv = [
      headers.map(csvCell).join(','),
      ...rows.map((row) =>
        row.map(csvCell).join(','),
      ),
    ].join('\n');

    const blob = new Blob(
      [csv],
      {
        type:
          'text/csv;charset=utf-8',
      },
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement('a');

    anchor.href = url;
    anchor.download =
      'receipts-and-payments.csv';

    anchor.click();

    URL.revokeObjectURL(url);
  }

  return (
    <section className="sales-control-workspace operational-register-workspace">
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

      {mode === 'sales' ? (
        <>
          <section className="managed-sales-toolbar-card">
            <header>
              <div>
                <span className="section-label">
                  Sales register controls
                </span>

                <h2>Sales Register</h2>

                <p>
                  Search and control sales, open
                  transaction details, submit return
                  requests, and review refund decisions.
                </p>
              </div>

              <div className="managed-sales-toolbar-actions">
                <button
                  type="button"
                  onClick={
                    clearManagedSaleFilters
                  }
                >
                  Clear filters
                </button>

                <button
                  type="button"
                  onClick={exportManagedSales}
                >
                  Export CSV
                </button>

                <button
                  type="button"
                  onClick={() =>
                    window.print()
                  }
                >
                  Print table
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void loadWorkspace()
                  }
                  disabled={
                    isLoading || isSaving
                  }
                >
                  {isLoading
                    ? 'Refreshing…'
                    : 'Refresh'}
                </button>
              </div>
            </header>

            <div className="managed-sales-filter-grid">
              <label className="managed-sales-search-filter">
                <span>Search transactions</span>

                <input
                  type="search"
                  value={managedSaleSearch}
                  onChange={(event) =>
                    setManagedSaleSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Sale number, customer, status, type or amount"
                />
              </label>

              <label>
                <span>Sale status</span>

                <select
                  value={managedSaleStatus}
                  onChange={(event) =>
                    setManagedSaleStatus(
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
                  <option value="confirmed">
                    Confirmed
                  </option>
                  <option value="dispensed">
                    Dispensed
                  </option>
                  <option value="cancelled">
                    Cancelled
                  </option>
                  <option value="returned">
                    Returned
                  </option>
                </select>
              </label>

              <label>
                <span>Payment status</span>

                <select
                  value={
                    managedPaymentStatus
                  }
                  onChange={(event) =>
                    setManagedPaymentStatus(
                      event.target.value,
                    )
                  }
                >
                  <option value="all">
                    All payments
                  </option>
                  <option value="unpaid">
                    Unpaid
                  </option>
                  <option value="partially_paid">
                    Partially paid
                  </option>
                  <option value="paid">
                    Paid
                  </option>
                  <option value="refunded">
                    Refunded
                  </option>
                  <option value="partially_refunded">
                    Partially refunded
                  </option>
                </select>
              </label>

              <label>
                <span>Sale type</span>

                <select
                  value={managedSaleType}
                  onChange={(event) =>
                    setManagedSaleType(
                      event.target.value,
                    )
                  }
                >
                  <option value="all">
                    All sale types
                  </option>
                  <option value="cash_sale">
                    Cash sale
                  </option>
                  <option value="prescription_sale">
                    Prescription sale
                  </option>
                  <option value="insurance_sale">
                    Insurance sale
                  </option>
                  <option value="credit_sale">
                    Credit sale
                  </option>
                </select>
              </label>

              <label>
                <span>Date from</span>

                <input
                  type="date"
                  value={managedDateFrom}
                  onChange={(event) =>
                    setManagedDateFrom(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>Date to</span>

                <input
                  type="date"
                  value={managedDateTo}
                  onChange={(event) =>
                    setManagedDateTo(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>Rows displayed</span>

                <select
                  value={managedRowLimit}
                  onChange={(event) =>
                    setManagedRowLimit(
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                >
                  <option value={5}>
                    5 rows
                  </option>
                  <option value={10}>
                    10 rows
                  </option>
                  <option value={15}>
                    15 rows
                  </option>
                  <option value={25}>
                    25 rows
                  </option>
                </select>
              </label>
            </div>

            <div className="managed-sales-filter-result">
              <strong>
                {managedFilteredSales.length}
              </strong>

              <span>
                transaction
                {managedFilteredSales.length === 1
                  ? ''
                  : 's'}{' '}
                match the selected controls
              </span>
            </div>
          </section>

          <section className="managed-sales-table-card">
            <div className="managed-sales-section-heading">
              <div>
                <span className="section-label">
                  Transaction register
                </span>

                <h3>
                  Recent and filtered sales
                </h3>

                <p>
                  Open transaction details or begin a
                  controlled return from the action
                  column.
                </p>
              </div>
            </div>

            <div className="managed-sales-table-wrap">
              <table className="managed-sales-table managed-sales-main-table">
                <thead>
                  <tr>
                    <th>SN</th>
                    <th>Date</th>
                    <th>Sale Number</th>
                    <th>Customer</th>
                    <th>Sale Type</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {managedVisibleSales.length === 0 ? (
                    <tr>
                      <td colSpan={11}>
                        No sales match the selected
                        filters.
                      </td>
                    </tr>
                  ) : (
                    managedVisibleSales.map(
                      (sale, index) => {
                        const record =
                          managedSalesRecord(sale);

                        return (
                          <tr key={sale.id}>
                            <td>{index + 1}</td>

                            <td>
                              {managedSalesDate(
                                record.sold_at ??
                                record.created_at,
                              )}
                            </td>

                            <td>
                              <strong>
                                {sale.sale_number}
                              </strong>
                            </td>

                            <td>
                              {managedSalesCustomer(
                                sale,
                              )}
                            </td>

                            <td>
                              {managedSalesLabel(
                                sale.sale_type,
                              )}
                            </td>

                            <td>
                              <span
                                className={`managed-sales-status ${sale.payment_status}`}
                              >
                                {managedSalesLabel(
                                  sale.payment_status,
                                )}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`managed-sales-status ${sale.status}`}
                              >
                                {managedSalesLabel(
                                  sale.status,
                                )}
                              </span>
                            </td>

                            <td>
                              {sale.items?.length ??
                                managedSalesNumber(
                                  record.items_count,
                                )}
                            </td>

                            <td>
                              <strong>
                                {money(
                                  sale.total_amount,
                                )}
                              </strong>
                            </td>

                            <td>
                              {money(
                                sale.balance_amount,
                              )}
                            </td>

                            <td>
                              <div className="managed-sales-row-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openSaleDetails(
                                      sale.id,
                                    )
                                  }
                                >
                                  Open Details
                                </button>

                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() =>
                                    openReturnRequest(
                                      sale.id,
                                    )
                                  }
                                >
                                  Return Request
                                </button>
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

          <section className="managed-sales-table-card">
            <div className="managed-sales-section-heading">
              <div>
                <span className="section-label">
                  Return and refund register
                </span>

                <h3>Return History Table</h3>

                <p>
                  Submitted return requests, requested
                  and approved amounts, refund methods,
                  decisions, and credit-note references.
                </p>
              </div>
            </div>

            <div className="managed-sales-table-wrap">
              <table className="managed-sales-table managed-return-history-table">
                <thead>
                  <tr>
                    <th>SN</th>
                    <th>Return Number</th>
                    <th>Sale Number</th>
                    <th>Requested</th>
                    <th>Approved</th>
                    <th>Refund Method</th>
                    <th>Status</th>
                    <th>Credit Note</th>
                    <th>Requested At</th>
                    <th>Approved At</th>
                    <th>Open</th>
                  </tr>
                </thead>

                <tbody>
                  {returns.length === 0 ? (
                    <tr>
                      <td colSpan={11}>
                        No return history is currently
                        available.
                      </td>
                    </tr>
                  ) : (
                    returns.map(
                      (saleReturn, index) => (
                        <tr key={saleReturn.id}>
                          <td>{index + 1}</td>

                          <td>
                            <strong>
                              {
                                saleReturn.return_number
                              }
                            </strong>
                          </td>

                          <td>
                            {saleReturn.sale
                              ?.sale_number ?? '-'}
                          </td>

                          <td>
                            {money(
                              saleReturn
                                .requested_refund_amount,
                            )}
                          </td>

                          <td>
                            {money(
                              saleReturn
                                .approved_refund_amount,
                            )}
                          </td>

                          <td>
                            {managedSalesLabel(
                              saleReturn
                                .refund_method,
                            )}
                          </td>

                          <td>
                            <span
                              className={`managed-sales-status ${saleReturn.status}`}
                            >
                              {managedSalesLabel(
                                saleReturn.status,
                              )}
                            </span>
                          </td>

                          <td>
                            {saleReturn
                              .credit_note_number ??
                              '-'}
                          </td>

                          <td>
                            {dateTime(
                              saleReturn.requested_at,
                            )}
                          </td>

                          <td>
                            {dateTime(
                              saleReturn.approved_at,
                            )}
                          </td>

                          <td>
                            <button
                              type="button"
                              disabled={
                                !saleReturn.sale?.id
                              }
                              onClick={() => {
                                if (
                                  saleReturn.sale?.id
                                ) {
                                  openSaleDetails(
                                    saleReturn
                                      .sale.id,
                                  );
                                }
                              }}
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="managed-sales-table-card managed-refund-approval-card">
            <div className="managed-sales-section-heading">
              <div>
                <span className="section-label">
                  Controlled refund decisions
                </span>

                <h3>
                  Refund Approval Queue Table
                </h3>

                <p>
                  Pending requests requiring an
                  authorized refund, rejection,
                  credit-note, or original-payment
                  decision.
                </p>
              </div>

              <strong className="managed-sales-queue-count">
                {pendingReturns.length}{' '}
                pending
              </strong>
            </div>

            <div className="managed-sales-table-wrap">
              <table className="managed-sales-table managed-refund-queue-table">
                <thead>
                  <tr>
                    <th>SN</th>
                    <th>Return Number</th>
                    <th>Sale Number</th>
                    <th>Requested Refund</th>
                    <th>Preferred Method</th>
                    <th>Requested At</th>
                    <th>Reason</th>
                    <th>Permission</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {pendingReturns.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        There are no pending refund
                        approvals.
                      </td>
                    </tr>
                  ) : (
                    pendingReturns.map(
                      (saleReturn, index) => (
                        <tr key={saleReturn.id}>
                          <td>{index + 1}</td>

                          <td>
                            <strong>
                              {
                                saleReturn.return_number
                              }
                            </strong>
                          </td>

                          <td>
                            {saleReturn.sale
                              ?.sale_number ?? '-'}
                          </td>

                          <td>
                            <strong>
                              {money(
                                saleReturn
                                  .requested_refund_amount,
                              )}
                            </strong>
                          </td>

                          <td>
                            {managedSalesLabel(
                              saleReturn
                                .refund_method,
                            )}
                          </td>

                          <td>
                            {dateTime(
                              saleReturn.requested_at,
                            )}
                          </td>

                          <td>
                            {saleReturn.reason}
                          </td>

                          <td>
                            {canManageRefunds
                              ? 'Authorized'
                              : 'View only'}
                          </td>

                          <td>
                            <button
                              type="button"
                              disabled={
                                !canManageRefunds
                              }
                              onClick={() =>
                                openReturnApproval(
                                  saleReturn,
                                )
                              }
                            >
                              Review Decision
                            </button>
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="managed-sales-toolbar-card managed-payment-toolbar">
            <header>
              <div>
                <span className="section-label">
                  Receipt and payment controls
                </span>

                <h2>Receipts & Payments</h2>

                <p>
                  Search payments, review provider
                  references, reconcile exceptions,
                  and trace issued credit notes.
                </p>
              </div>

              <div className="managed-sales-toolbar-actions">
                <button
                  type="button"
                  onClick={clearPaymentFilters}
                >
                  Clear Filters
                </button>

                <button
                  type="button"
                  onClick={exportPaymentRows}
                >
                  Export CSV
                </button>

                <button
                  type="button"
                  onClick={() =>
                    window.print()
                  }
                >
                  Print Table
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void loadWorkspace()
                  }
                  disabled={
                    isLoading || isSaving
                  }
                >
                  {isLoading
                    ? 'Refreshing…'
                    : 'Refresh'}
                </button>
              </div>
            </header>

            <div className="managed-payment-filter-grid">
              <label className="managed-payment-search">
                <span>Search</span>

                <input
                  type="search"
                  value={paymentSearch}
                  onChange={(event) =>
                    setPaymentSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Receipt, sale, customer, reference or amount"
                />
              </label>

              <label>
                <span>Payment method</span>

                <select
                  value={paymentMethodFilter}
                  onChange={(event) =>
                    setPaymentMethodFilter(
                      event.target.value,
                    )
                  }
                >
                  <option value="all">
                    All methods
                  </option>
                  <option value="cash">
                    Cash
                  </option>
                  <option value="momo">
                    Mobile Money
                  </option>
                  <option value="card">
                    Card
                  </option>
                  <option value="insurance">
                    Insurance
                  </option>
                  <option value="credit">
                    Credit
                  </option>
                  <option value="bank_transfer">
                    Bank transfer
                  </option>
                </select>
              </label>

              <label>
                <span>Payment status</span>

                <select
                  value={paymentStatusFilter}
                  onChange={(event) =>
                    setPaymentStatusFilter(
                      event.target.value,
                    )
                  }
                >
                  <option value="all">
                    All statuses
                  </option>
                  <option value="completed">
                    Completed
                  </option>
                  <option value="pending">
                    Pending
                  </option>
                  <option value="failed">
                    Failed
                  </option>
                  <option value="reversed">
                    Reversed
                  </option>
                </select>
              </label>

              <label>
                <span>Date from</span>

                <input
                  type="date"
                  value={paymentDateFrom}
                  onChange={(event) =>
                    setPaymentDateFrom(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>Date to</span>

                <input
                  type="date"
                  value={paymentDateTo}
                  onChange={(event) =>
                    setPaymentDateTo(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>Minimum amount</span>

                <input
                  type="number"
                  min="0"
                  value={paymentMinimumAmount}
                  onChange={(event) =>
                    setPaymentMinimumAmount(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>Maximum amount</span>

                <input
                  type="number"
                  min="0"
                  value={paymentMaximumAmount}
                  onChange={(event) =>
                    setPaymentMaximumAmount(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>Rows displayed</span>

                <select
                  value={paymentRowLimit}
                  onChange={(event) =>
                    setPaymentRowLimit(
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                >
                  <option value={10}>
                    10 rows
                  </option>
                  <option value={15}>
                    15 rows
                  </option>
                  <option value={25}>
                    25 rows
                  </option>
                  <option value={50}>
                    50 rows
                  </option>
                </select>
              </label>
            </div>

            <div className="managed-sales-filter-result">
              <strong>
                {filteredPaymentRows.length}
              </strong>

              <span>
                payment
                {filteredPaymentRows.length === 1
                  ? ''
                  : 's'}{' '}
                match the selected controls
              </span>
            </div>
          </section>

          <section className="managed-sales-table-card">
            <div className="managed-sales-section-heading">
              <div>
                <span className="section-label">
                  Live payment register
                </span>

                <h3>
                  Receipts and Payments Table
                </h3>

                <p>
                  Receipt number, transaction,
                  customer, payment method, amount,
                  provider reference, and status.
                </p>
              </div>
            </div>

            <div className="managed-sales-table-wrap">
              <table className="managed-sales-table managed-payment-table">
                <thead>
                  <tr>
                    <th>SN</th>
                    <th>Date & Time</th>
                    <th>Receipt</th>
                    <th>Sale Number</th>
                    <th>Customer</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {visiblePaymentRows.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        No payments match the selected
                        filters.
                      </td>
                    </tr>
                  ) : (
                    visiblePaymentRows.map(
                      (
                        {
                          sale,
                          payment,
                        },
                        index,
                      ) => (
                        <tr key={payment.id}>
                          <td>{index + 1}</td>

                          <td>
                            {dateTime(
                              payment.received_at ??
                              sale.sold_at,
                            )}
                          </td>

                          <td>
                            <strong>
                              {payment
                                .receipt_number ??
                                `Payment ${payment.id}`}
                            </strong>
                          </td>

                          <td>
                            {sale.sale_number}
                          </td>

                          <td>
                            {customerName(sale)}
                          </td>

                          <td>
                            {managedSalesLabel(
                              payment
                                .payment_method,
                            )}
                          </td>

                          <td>
                            <strong>
                              {money(
                                payment.amount,
                              )}
                            </strong>
                          </td>

                          <td>
                            {payment
                              .reference_number ??
                              '-'}
                          </td>

                          <td>
                            <span
                              className={`managed-sales-status ${payment.status}`}
                            >
                              {managedSalesLabel(
                                payment.status,
                              )}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              disabled={
                                !canManageRefunds
                              }
                              onClick={() =>
                                openPaymentReconciliation(
                                  sale,
                                  payment,
                                )
                              }
                            >
                              Reconcile
                            </button>
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="managed-payment-two-column">
            <section className="managed-sales-table-card">
              <div className="managed-sales-section-heading">
                <div>
                  <span className="section-label">
                    Provider settlement control
                  </span>

                  <h3>
                    Provider Settlement Control
                  </h3>

                  <p>
                    Non-cash payments requiring
                    provider-reference or settlement
                    confirmation.
                  </p>
                </div>
              </div>

              <div className="managed-sales-table-wrap">
                <table className="managed-sales-table managed-reconciliation-table">
                  <thead>
                    <tr>
                      <th>SN</th>
                      <th>Receipt</th>
                      <th>Method</th>
                      <th>Expected</th>
                      <th>Reference</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {providerPaymentRows.length ===
                    0 ? (
                      <tr>
                        <td colSpan={7}>
                          No provider payments require
                          reconciliation.
                        </td>
                      </tr>
                    ) : (
                      providerPaymentRows
                        .slice(0, 15)
                        .map(
                          (
                            {
                              sale,
                              payment,
                            },
                            index,
                          ) => (
                            <tr key={payment.id}>
                              <td>{index + 1}</td>

                              <td>
                                {payment
                                  .receipt_number ??
                                  `Payment ${payment.id}`}
                              </td>

                              <td>
                                {managedSalesLabel(
                                  payment
                                    .payment_method,
                                )}
                              </td>

                              <td>
                                <strong>
                                  {money(
                                    payment.amount,
                                  )}
                                </strong>
                              </td>

                              <td>
                                {payment
                                  .reference_number ??
                                  'Not captured'}
                              </td>

                              <td>
                                {managedSalesLabel(
                                  payment.status,
                                )}
                              </td>

                              <td>
                                <button
                                  type="button"
                                  disabled={
                                    !canManageRefunds
                                  }
                                  onClick={() =>
                                    openPaymentReconciliation(
                                      sale,
                                      payment,
                                    )
                                  }
                                >
                                  Open Form
                                </button>
                              </td>
                            </tr>
                          ),
                        )
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="managed-sales-table-card">
              <div className="managed-sales-section-heading">
                <div>
                  <span className="section-label">
                    Approved return credits
                  </span>

                  <h3>
                    Approved Return Credits
                  </h3>

                  <p>
                    Credit notes issued through
                    approved return and refund
                    workflows.
                  </p>
                </div>
              </div>

              <div className="managed-sales-table-wrap">
                <table className="managed-sales-table managed-credit-note-table">
                  <thead>
                    <tr>
                      <th>SN</th>
                      <th>Credit Note</th>
                      <th>Return</th>
                      <th>Sale</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Issued</th>
                    </tr>
                  </thead>

                  <tbody>
                    {issuedCreditNotes.length ===
                    0 ? (
                      <tr>
                        <td colSpan={7}>
                          No credit notes have been
                          issued.
                        </td>
                      </tr>
                    ) : (
                      issuedCreditNotes.map(
                        (
                          saleReturn,
                          index,
                        ) => (
                          <tr
                            key={saleReturn.id}
                          >
                            <td>{index + 1}</td>

                            <td>
                              <strong>
                                {
                                  saleReturn
                                    .credit_note_number
                                }
                              </strong>
                            </td>

                            <td>
                              {
                                saleReturn
                                  .return_number
                              }
                            </td>

                            <td>
                              {saleReturn.sale
                                ?.sale_number ?? '-'}
                            </td>

                            <td>
                              {money(
                                saleReturn
                                  .approved_refund_amount ??
                                saleReturn
                                  .requested_refund_amount,
                              )}
                            </td>

                            <td>
                              {managedSalesLabel(
                                saleReturn
                                  .refund_method,
                              )}
                            </td>

                            <td>
                              {dateTime(
                                saleReturn.refunded_at ??
                                saleReturn.approved_at,
                              )}
                            </td>
                          </tr>
                        ),
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        </>
      )}

      {activeOperationsModal === 'details' && (
        <div
          className="workspace-explicit-modal-backdrop is-open"
          role="presentation"
          onMouseDown={closeOperationsModal}
        >
          <section
            className="workspace-explicit-modal sales-operation-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Transaction details"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="workspace-explicit-modal-close"
              onClick={closeOperationsModal}
              aria-label="Close transaction details"
            >
              ×
            </button>

            <div className="popup-form-heading">
              <span className="section-label">
                Transaction details
              </span>

              <h3>
                {selectedSale?.sale_number ??
                  'Loading transaction…'}
              </h3>

              {selectedSale && (
                <p className="muted">
                  {customerName(selectedSale)} ·{' '}
                  {selectedSale.branch?.name ??
                    'Main branch'}
                </p>
              )}
            </div>

            {!selectedSale ? (
              <div className="sales-control-loading">
                Loading transaction details…
              </div>
            ) : (
              <>
                <div className="sales-operation-summary-grid">
                  <article>
                    <span>Status</span>
                    <strong>
                      {managedSalesLabel(
                        selectedSale.status,
                      )}
                    </strong>
                  </article>

                  <article>
                    <span>Payment</span>
                    <strong>
                      {managedSalesLabel(
                        selectedSale
                          .payment_status,
                      )}
                    </strong>
                  </article>

                  <article>
                    <span>Total</span>
                    <strong>
                      {money(
                        selectedSale
                          .total_amount,
                      )}
                    </strong>
                  </article>

                  <article>
                    <span>Balance</span>
                    <strong>
                      {money(
                        selectedSale
                          .balance_amount,
                      )}
                    </strong>
                  </article>
                </div>

                <section className="modal-operational-table">
                  <div className="managed-sales-section-heading">
                    <div>
                      <h3>
                        Dispensed Items Table
                      </h3>

                      <p>
                        Product, batch, quantity,
                        pricing, returnability, and
                        prescription control.
                      </p>
                    </div>
                  </div>

                  <div className="managed-sales-table-wrap">
                    <table className="managed-sales-table managed-dispensed-table">
                      <thead>
                        <tr>
                          <th>SN</th>
                          <th>Product</th>
                          <th>SKU</th>
                          <th>Batch</th>
                          <th>Quantity</th>
                          <th>Returned</th>
                          <th>Returnable</th>
                          <th>Unit Price</th>
                          <th>Discount</th>
                          <th>Line Total</th>
                          <th>Rx Control</th>
                          <th>Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {(selectedSale.items ?? [])
                          .map(
                            (
                              item,
                              index,
                            ) => {
                              const record =
                                managedSalesRecord(
                                  item,
                                );

                              const quantity =
                                managedSalesNumber(
                                  record.quantity,
                                );

                              const returned =
                                managedSalesNumber(
                                  record.returned_quantity,
                                );

                              return (
                                <tr key={item.id}>
                                  <td>
                                    {index + 1}
                                  </td>

                                  <td>
                                    <strong>
                                      {managedSalesText(
                                        record
                                          .product_name_snapshot,
                                      )}
                                    </strong>
                                  </td>

                                  <td>
                                    {managedSalesText(
                                      record
                                        .sku_snapshot,
                                    )}
                                  </td>

                                  <td>
                                    {managedSalesText(
                                      managedSalesRecord(
                                        record
                                          .stock_batch,
                                      )
                                        .batch_number,
                                    )}
                                  </td>

                                  <td>
                                    {quantity}
                                  </td>

                                  <td>
                                    {returned}
                                  </td>

                                  <td>
                                    <strong>
                                      {Math.max(
                                        0,
                                        quantity -
                                          returned,
                                      )}
                                    </strong>
                                  </td>

                                  <td>
                                    {money(
                                      managedSalesNumber(
                                        record
                                          .unit_price,
                                      ),
                                    )}
                                  </td>

                                  <td>
                                    {money(
                                      managedSalesNumber(
                                        record
                                          .discount_amount,
                                      ),
                                    )}
                                  </td>

                                  <td>
                                    <strong>
                                      {money(
                                        managedSalesNumber(
                                          record
                                            .line_total,
                                        ),
                                      )}
                                    </strong>
                                  </td>

                                  <td>
                                    {record
                                      .requires_prescription
                                      ? record
                                          .prescription_verified
                                        ? 'Verified'
                                        : 'Review required'
                                      : 'Not required'}
                                  </td>

                                  <td>
                                    {managedSalesLabel(
                                      record.status,
                                    )}
                                  </td>
                                </tr>
                              );
                            },
                          )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </section>
        </div>
      )}

      {activeOperationsModal === 'return' && (
        <div
          className="workspace-explicit-modal-backdrop is-open"
          role="presentation"
          onMouseDown={closeOperationsModal}
        >
          <section
            className="workspace-explicit-modal sales-operation-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Create return request"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="workspace-explicit-modal-close"
              onClick={closeOperationsModal}
              aria-label="Close return request"
            >
              ×
            </button>

            <div className="popup-form-heading">
              <span className="section-label">
                Controlled return workflow
              </span>

              <h3>Create Return Request</h3>

              <p className="muted">
                Select returned quantities and
                inventory dispositions for{' '}
                {selectedSale?.sale_number ??
                  'the selected transaction'}.
              </p>
            </div>

            {!selectedSale ? (
              <div className="sales-control-loading">
                Loading transaction items…
              </div>
            ) : (
              <form
                className="operational-modal-form"
                onSubmit={submitReturn}
              >
                <div className="managed-sales-table-wrap">
                  <table className="managed-sales-table managed-return-request-table">
                    <thead>
                      <tr>
                        <th>SN</th>
                        <th>Product</th>
                        <th>Sold</th>
                        <th>Return Quantity</th>
                        <th>Disposition</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(selectedSale.items ?? [])
                        .map(
                          (
                            item,
                            index,
                          ) => {
                            const record =
                              managedSalesRecord(
                                item,
                              );

                            return (
                              <tr key={item.id}>
                                <td>
                                  {index + 1}
                                </td>

                                <td>
                                  <strong>
                                    {managedSalesText(
                                      record
                                        .product_name_snapshot,
                                    )}
                                  </strong>
                                </td>

                                <td>
                                  {managedSalesNumber(
                                    record.quantity,
                                  )}
                                </td>

                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    max={
                                      managedSalesNumber(
                                        record.quantity,
                                      )
                                    }
                                    step="0.001"
                                    value={
                                      returnQuantities[
                                        item.id
                                      ] ?? ''
                                    }
                                    onChange={(event) =>
                                      setReturnQuantities(
                                        (
                                          current,
                                        ) => ({
                                          ...current,
                                          [item.id]:
                                            event
                                              .target
                                              .value,
                                        }),
                                      )
                                    }
                                  />
                                </td>

                                <td>
                                  <select
                                    value={
                                      returnDispositions[
                                        item.id
                                      ] ??
                                      'quarantine'
                                    }
                                    onChange={(event) =>
                                      setReturnDispositions(
                                        (
                                          current,
                                        ) => ({
                                          ...current,
                                          [item.id]:
                                            event
                                              .target
                                              .value as SaleReturnDisposition,
                                        }),
                                      )
                                    }
                                  >
                                    {dispositionOptions.map(
                                      (
                                        option,
                                      ) => (
                                        <option
                                          key={
                                            option.value
                                          }
                                          value={
                                            option.value
                                          }
                                        >
                                          {
                                            option.label
                                          }
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </td>
                              </tr>
                            );
                          },
                        )}
                    </tbody>
                  </table>
                </div>

                <div className="operational-form-grid">
                  <label>
                    <span>Return reason</span>

                    <textarea
                      value={returnReason}
                      onChange={(event) =>
                        setReturnReason(
                          event.target.value,
                        )
                      }
                      rows={3}
                      required
                    />
                  </label>

                  <label>
                    <span>Refund method</span>

                    <select
                      value={returnMethod}
                      onChange={(event) =>
                        setReturnMethod(
                          event.target
                            .value as SaleRefundMethod,
                        )
                      }
                    >
                      {refundMethods.map(
                        (method) => (
                          <option
                            key={method.value}
                            value={method.value}
                          >
                            {method.label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="operational-form-wide">
                    <span>Return notes</span>

                    <textarea
                      value={returnNotes}
                      onChange={(event) =>
                        setReturnNotes(
                          event.target.value,
                        )
                      }
                      rows={3}
                    />
                  </label>
                </div>

                <div className="managed-detail-actions">
                  <button
                    type="button"
                    onClick={closeOperationsModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      !canManageRefunds ||
                      isSaving
                    }
                  >
                    {isSaving
                      ? 'Submitting…'
                      : 'Submit Return Request'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {activeOperationsModal === 'approval' && (
        <div
          className="workspace-explicit-modal-backdrop is-open"
          role="presentation"
          onMouseDown={closeOperationsModal}
        >
          <section
            className="workspace-explicit-modal sales-operation-modal sales-decision-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Refund approval decision"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="workspace-explicit-modal-close"
              onClick={closeOperationsModal}
              aria-label="Close approval decision"
            >
              ×
            </button>

            <div className="popup-form-heading">
              <span className="section-label">
                Manager or owner approval
              </span>

              <h3>
                Refund Approval Decision
              </h3>

              <p className="muted">
                {selectedReturn
                  ? `${selectedReturn.return_number} · ${money(
                      selectedReturn
                        .requested_refund_amount,
                    )}`
                  : 'Select a pending return.'}
              </p>
            </div>

            {selectedReturn && (
              <div className="operational-modal-form">
                <div className="sales-operation-summary-grid">
                  <article>
                    <span>Sale</span>
                    <strong>
                      {selectedReturn.sale
                        ?.sale_number ?? '-'}
                    </strong>
                  </article>

                  <article>
                    <span>Requested</span>
                    <strong>
                      {money(
                        selectedReturn
                          .requested_refund_amount,
                      )}
                    </strong>
                  </article>

                  <article>
                    <span>Reason</span>
                    <strong>
                      {selectedReturn.reason}
                    </strong>
                  </article>
                </div>

                <div className="operational-form-grid">
                  <label>
                    <span>Refund method</span>

                    <select
                      value={decisionMethod}
                      onChange={(event) =>
                        setDecisionMethod(
                          event.target
                            .value as SaleRefundMethod,
                        )
                      }
                    >
                      {refundMethods.map(
                        (method) => (
                          <option
                            key={method.value}
                            value={method.value}
                          >
                            {method.label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label>
                    <span>
                      Refund or provider reference
                    </span>

                    <input
                      value={decisionReference}
                      onChange={(event) =>
                        setDecisionReference(
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label className="operational-form-wide">
                    <span>
                      Decision notes or rejection
                      reason
                    </span>

                    <textarea
                      value={decisionNotes}
                      onChange={(event) =>
                        setDecisionNotes(
                          event.target.value,
                        )
                      }
                      rows={4}
                    />
                  </label>
                </div>

                <div className="managed-detail-actions">
                  <button
                    type="button"
                    onClick={rejectSelectedReturn}
                    disabled={
                      !canManageRefunds ||
                      isSaving
                    }
                  >
                    Reject Return
                  </button>

                  <button
                    type="button"
                    onClick={approveSelectedReturn}
                    disabled={
                      !canManageRefunds ||
                      isSaving
                    }
                  >
                    Approve Refund
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {activeOperationsModal ===
        'reconciliation' && (
        <div
          className="workspace-explicit-modal-backdrop is-open"
          role="presentation"
          onMouseDown={closeOperationsModal}
        >
          <section
            className="workspace-explicit-modal sales-operation-modal reconciliation-operation-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Payment reconciliation"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="workspace-explicit-modal-close"
              onClick={closeOperationsModal}
              aria-label="Close reconciliation"
            >
              ×
            </button>

            <div className="popup-form-heading">
              <span className="section-label">
                Provider settlement control
              </span>

              <h3>Payment Reconciliation</h3>

              <p className="muted">
                Compare the POS payment with the
                provider or settlement record.
              </p>
            </div>

            <form
              className="operational-modal-form"
              onSubmit={submitReconciliation}
            >
              <div className="operational-form-grid">
                <label>
                  <span>Selected payment</span>

                  <input
                    value={
                      selectedPayment
                        ? paymentLabel(
                            selectedPayment,
                          )
                        : 'Loading payment…'
                    }
                    readOnly
                  />
                </label>

                <label>
                  <span>Expected amount</span>

                  <input
                    value={
                      selectedPayment
                        ? money(
                            selectedPayment.amount,
                          )
                        : ''
                    }
                    readOnly
                  />
                </label>

                <label>
                  <span>
                    Reconciliation status
                  </span>

                  <select
                    value={reconciliationStatus}
                    onChange={(event) =>
                      setReconciliationStatus(
                        event.target
                          .value as
                          | 'pending'
                          | 'matched'
                          | 'exception'
                          | 'reversed',
                      )
                    }
                    disabled={
                      !canManageRefunds
                    }
                  >
                    <option value="matched">
                      Matched
                    </option>
                    <option value="exception">
                      Exception
                    </option>
                    <option value="pending">
                      Pending verification
                    </option>
                    <option value="reversed">
                      Reversed
                    </option>
                  </select>
                </label>

                <label>
                  <span>Settled amount</span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settledAmount}
                    onChange={(event) =>
                      setSettledAmount(
                        event.target.value,
                      )
                    }
                    required
                  />
                </label>

                <label>
                  <span>Provider reference</span>

                  <input
                    value={providerReference}
                    onChange={(event) =>
                      setProviderReference(
                        event.target.value,
                      )
                    }
                    placeholder="Gateway or settlement reference"
                  />
                </label>

                <label>
                  <span>
                    Reconciliation notes
                  </span>

                  <input
                    value={reconciliationNotes}
                    onChange={(event) =>
                      setReconciliationNotes(
                        event.target.value,
                      )
                    }
                    placeholder="Exception or review note"
                  />
                </label>
              </div>

              {selectedPayment && (
                <div className="sales-control-reconciliation-preview">
                  <span>
                    Expected{' '}
                    <strong>
                      {money(
                        selectedPayment.amount,
                      )}
                    </strong>
                  </span>

                  <span>
                    Settled{' '}
                    <strong>
                      {money(
                        Number(
                          settledAmount || 0,
                        ),
                      )}
                    </strong>
                  </span>

                  <span>
                    Variance{' '}
                    <strong>
                      {money(
                        Number(
                          settledAmount || 0,
                        ) -
                          Number(
                            selectedPayment.amount,
                          ),
                      )}
                    </strong>
                  </span>
                </div>
              )}

              {latestReconciliation && (
                <div className="sales-control-message success">
                  Latest reconciliation:{' '}
                  {
                    latestReconciliation
                      .reconciliation_status
                  }
                  {' '}· Variance{' '}
                  {money(
                    latestReconciliation
                      .variance_amount,
                  )}
                </div>
              )}

              <div className="managed-detail-actions">
                <button
                  type="button"
                  onClick={closeOperationsModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    !canManageRefunds ||
                    !selectedPayment ||
                    isSaving
                  }
                >
                  {isSaving
                    ? 'Saving…'
                    : 'Save Reconciliation'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

type SalesReturnsWorkspaceErrorBoundaryProps = {
  children: ReactNode;
};

type SalesReturnsWorkspaceErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class SalesReturnsWorkspaceErrorBoundary extends Component<
  SalesReturnsWorkspaceErrorBoundaryProps,
  SalesReturnsWorkspaceErrorBoundaryState
> {
  state: SalesReturnsWorkspaceErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(
    error: unknown,
  ): SalesReturnsWorkspaceErrorBoundaryState {
    return {
      hasError: true,
      message:
        error instanceof Error
          ? error.message
          : 'The sales workspace encountered an unexpected error.',
    };
  }

  componentDidCatch(
    error: unknown,
    errorInfo: ErrorInfo,
  ): void {
    console.error(
      'SalesReturnsWorkspace runtime error',
      error,
      errorInfo,
    );
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section className="sales-control-workspace">
          <div
            className="sales-control-message error"
            role="alert"
          >
            <strong>
              The sales workspace could not be displayed.
            </strong>
            <div>
              {this.state.message}
            </div>
            <div>
              Refresh the page after checking the active
              tenant and user permissions.
            </div>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

export function SalesReturnsWorkspace(
  props: SalesReturnsWorkspaceProps,
) {
  return (
    <SalesReturnsWorkspaceErrorBoundary>
      <SalesReturnsWorkspaceContent {...props} />
    </SalesReturnsWorkspaceErrorBoundary>
  );
}

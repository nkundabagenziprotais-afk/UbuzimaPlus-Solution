import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  type AccessProfile,
  getPharmaCustomers,
  getPharmaPrescriptions,
  getPharmaSales,
} from '../lib/api';

type PosModuleWorkspaceHeaderProps = {
  token: string;
  profile: AccessProfile;
  workspace: string;
};

type UnknownRecord = Record<string, unknown>;

type MetricCard = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone:
    | 'standard'
    | 'positive'
    | 'warning'
    | 'critical'
    | 'information';
};

type ControlDefinition = {
  title: string;
  detail: string;
  state: 'active' | 'required' | 'monitored';
};

type WorkspaceConfiguration = {
  eyebrow: string;
  title: string;
  subtitle: string;
  trendTitle: string;
  distributionTitle: string;
  controlsTitle: string;
  controls: ControlDefinition[];
};

type DailyPoint = {
  key: string;
  label: string;
  value: number;
  secondary: number;
};

type StatusSlice = {
  label: string;
  value: number;
  className: string;
};

const workspaceConfigurations:
  Record<string, WorkspaceConfiguration> = {
    'dispensing-review': {
      eyebrow:
        'Medication safety and clinical assurance',
      title: 'Pharmacist Review',
      subtitle:
        'Prioritize professional review, verify safe dispensing, resolve clinical exceptions, and preserve a complete decision trail.',
      trendTitle:
        'Prescription review workload',
      distributionTitle:
        'Clinical review status',
      controlsTitle:
        'Controls built into Pharmacist Review',
      controls: [
        {
          title: 'Independent verification',
          detail:
            'Clinical approval is separated from sale preparation and dispensing.',
          state: 'required',
        },
        {
          title: 'Patient safety checks',
          detail:
            'Identity, prescription status, allergies, dosage, and medicine risks remain visible.',
          state: 'active',
        },
        {
          title: 'Clinical intervention record',
          detail:
            'Exceptions, decisions, reasons, and professional actions remain auditable.',
          state: 'monitored',
        },
        {
          title: 'Controlled completion',
          detail:
            'Dispensing completion follows review and authorization status.',
          state: 'active',
        },
      ],
    },

    customers: {
      eyebrow:
        'Customer and patient relationship management',
      title: 'Customers & Patients',
      subtitle:
        'Maintain reliable identity, contact, consent, clinical alerts, insurance information, credit exposure, and purchase history.',
      trendTitle:
        'Customer registration activity',
      distributionTitle:
        'Profile completeness',
      controlsTitle:
        'Controls built into Customers & Patients',
      controls: [
        {
          title: 'Positive identification',
          detail:
            'Customer and patient identity is confirmed before clinical or financial activity.',
          state: 'required',
        },
        {
          title: 'Privacy and consent',
          detail:
            'Personal and clinical information remains role-controlled and purpose-limited.',
          state: 'active',
        },
        {
          title: 'Clinical alerts',
          detail:
            'Allergies, warnings, and relevant patient risks remain visible during dispensing.',
          state: 'monitored',
        },
        {
          title: 'Credit governance',
          detail:
            'Outstanding balances, limits, insurance, and payer exposure remain controlled.',
          state: 'active',
        },
      ],
    },

    prescriptions: {
      eyebrow:
        'Prescription lifecycle management',
      title: 'Prescription Management',
      subtitle:
        'Control prescription intake, validation, professional review, partial fulfilment, expiry, completion, and traceability.',
      trendTitle:
        'Prescription intake and fulfilment',
      distributionTitle:
        'Prescription lifecycle status',
      controlsTitle:
        'Controls built into Prescription Management',
      controls: [
        {
          title: 'Validation before fulfilment',
          detail:
            'Prescriber, patient, medicine, dosage, validity, and status checks precede dispensing.',
          state: 'required',
        },
        {
          title: 'Partial-fill accountability',
          detail:
            'Each partial supply retains remaining quantity, date, and responsible user.',
          state: 'active',
        },
        {
          title: 'Validity and expiry',
          detail:
            'Expired, cancelled, completed, or invalid prescriptions cannot continue unnoticed.',
          state: 'monitored',
        },
        {
          title: 'End-to-end traceability',
          detail:
            'Prescription, sale, dispensing event, batch, and responsible staff remain connected.',
          state: 'active',
        },
      ],
    },

    'sales-performance': {
      eyebrow:
        'Transaction governance and customer protection',
      title: 'Sales Register & Returns',
      subtitle:
        'Review sales history, investigate transactions, process controlled returns, approve refunds, and maintain credit-note traceability.',
      trendTitle:
        'Sales and collections trend',
      distributionTitle:
        'Transaction and payment status',
      controlsTitle:
        'Controls built into Sales Register & Returns',
      controls: [
        {
          title: 'Immutable sale history',
          detail:
            'Completed transactions remain traceable rather than silently overwritten.',
          state: 'active',
        },
        {
          title: 'Controlled returns',
          detail:
            'Return quantities, reasons, disposition, evidence, and source sale are captured.',
          state: 'required',
        },
        {
          title: 'Refund authorization',
          detail:
            'Refund approval follows permission and role-based authority.',
          state: 'monitored',
        },
        {
          title: 'Stock and credit-note linkage',
          detail:
            'Approved outcomes retain inventory and financial reconciliation references.',
          state: 'active',
        },
      ],
    },

    'payment-receipt': {
      eyebrow:
        'Receipt, settlement, and reconciliation control',
      title: 'Receipts & Payments',
      subtitle:
        'Review receipts, payment methods, settlement status, collection performance, reconciliation, and payment variances.',
      trendTitle:
        'Collection and settlement trend',
      distributionTitle:
        'Payment health',
      controlsTitle:
        'Controls built into Receipts & Payments',
      controls: [
        {
          title: 'Receipt-to-sale traceability',
          detail:
            'Each receipt remains connected to the originating sale and recorded payment.',
          state: 'active',
        },
        {
          title: 'Daily reconciliation',
          detail:
            'Cash, mobile money, card, bank, insurance, and other settlements are matched.',
          state: 'required',
        },
        {
          title: 'Variance investigation',
          detail:
            'Shortages, overages, failed settlements, and mismatches require review and notes.',
          state: 'monitored',
        },
        {
          title: 'Sensitive-data protection',
          detail:
            'Payment views avoid exposing prohibited card or account authentication data.',
          state: 'active',
        },
      ],
    },

    pos: {
      eyebrow:
        'Safe and controlled point of sale',
      title: 'POS Counter',
      subtitle:
        'Process customer sales and dispensing through a controlled, responsive, and auditable point-of-sale workflow.',
      trendTitle:
        'Daily transaction activity',
      distributionTitle:
        'Transaction status',
      controlsTitle:
        'Controls built into POS Counter',
      controls: [
        {
          title: 'Product verification',
          detail:
            'The selected medicine, unit, quantity, batch, and price are confirmed.',
          state: 'required',
        },
        {
          title: 'Expiry awareness',
          detail:
            'Batch and expiry information remains available during dispensing.',
          state: 'active',
        },
        {
          title: 'Payment confirmation',
          detail:
            'Sale completion follows valid payment or authorized credit handling.',
          state: 'monitored',
        },
        {
          title: 'Audit trail',
          detail:
            'Cashier, session, customer, items, payment, and completion remain traceable.',
          state: 'active',
        },
      ],
    },
  };

function asRecord(
  value: unknown,
): UnknownRecord {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
    ? value as UnknownRecord
    : {};
}

function extractList(
  response: unknown,
  preferredKey: string,
): UnknownRecord[] {
  if (Array.isArray(response)) {
    return response.map(asRecord);
  }

  const responseRecord = asRecord(response);

  const preferred =
    responseRecord[preferredKey];

  if (Array.isArray(preferred)) {
    return preferred.map(asRecord);
  }

  const data = responseRecord.data;

  if (Array.isArray(data)) {
    return data.map(asRecord);
  }

  const dataRecord = asRecord(data);

  const nested =
    dataRecord[preferredKey];

  return Array.isArray(nested)
    ? nested.map(asRecord)
    : [];
}

function tenantSlugFrom(
  profile: AccessProfile,
): string {
  const assignments = Array.isArray(
    profile.tenant_assignments,
  )
    ? profile.tenant_assignments
    : [];

  const assignment =
    asRecord(assignments[0]);

  const tenant =
    asRecord(assignment.tenant);

  return String(
    tenant.slug ?? '',
  ).trim();
}

function profileIsAdministrator(
  profile: AccessProfile,
): boolean {
  const roles = Array.isArray(profile.roles)
    ? profile.roles
    : [];

  return roles.some((role) => {
    const roleRecord = asRecord(role);

    const rawCode =
      typeof role === 'string'
        ? role
        : roleRecord.code ??
          roleRecord.name ??
          '';

    const code = String(rawCode)
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, '_');

    return (
      code === 'tenant_admin' ||
      code === 'super_admin' ||
      code === 'platform_admin' ||
      code === 'owner' ||
      code.endsWith('_admin')
    );
  });
}

function stringValue(
  record: UnknownRecord,
  keys: string[],
): string {
  for (const key of keys) {
    const value = record[key];

    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return '';
}

function numberValue(
  record: UnknownRecord,
  keys: string[],
): number {
  for (const key of keys) {
    const parsed = Number(
      record[key],
    );

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function statusOf(
  record: UnknownRecord,
): string {
  return stringValue(
    record,
    [
      'status',
      'payment_status',
      'dispensing_status',
      'prescription_status',
    ],
  )
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
}

function statusIncludes(
  record: UnknownRecord,
  fragments: string[],
): boolean {
  const status = statusOf(record);

  return fragments.some(
    (fragment) =>
      status.includes(fragment),
  );
}

function dateFrom(
  record: UnknownRecord,
): Date | null {
  const raw = stringValue(
    record,
    [
      'sold_at',
      'dispensed_at',
      'issued_at',
      'prescribed_at',
      'registered_at',
      'completed_at',
      'created_at',
      'updated_at',
    ],
  );

  if (!raw) {
    return null;
  }

  const date = new Date(raw);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function dateKey(
  date: Date,
): string {
  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1,
    ).padStart(2, '0'),
    String(
      date.getDate(),
    ).padStart(2, '0'),
  ].join('-');
}

function shortDay(
  date: Date,
): string {
  return new Intl.DateTimeFormat(
    'en-RW',
    {
      weekday: 'short',
      day: 'numeric',
    },
  ).format(date);
}

function money(
  value: number,
): string {
  return new Intl.NumberFormat(
    'en-RW',
    {
      style: 'currency',
      currency: 'RWF',
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function percentage(
  numerator: number,
  denominator: number,
): string {
  if (denominator <= 0) {
    return '0%';
  }

  return `${Math.round(
    (numerator / denominator) * 100,
  )}%`;
}

function loadVisibility(
  storageKey: string,
  defaults: string[],
): string[] {
  try {
    const stored =
      window.localStorage.getItem(
        storageKey,
      );

    if (!stored) {
      return defaults;
    }

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed)
      ? parsed.filter(
          (value): value is string =>
            typeof value === 'string',
        )
      : defaults;
  } catch {
    return defaults;
  }
}

function buildDailyTrend(
  records: UnknownRecord[],
  secondaryValue?: (
    record: UnknownRecord,
  ) => number,
): DailyPoint[] {
  const today = new Date();

  const days = Array.from(
    { length: 7 },
    (_, index) => {
      const date = new Date(today);

      date.setHours(0, 0, 0, 0);
      date.setDate(
        today.getDate() - (6 - index),
      );

      return {
        date,
        key: dateKey(date),
        label: shortDay(date),
        value: 0,
        secondary: 0,
      };
    },
  );

  const byKey = new Map(
    days.map(
      (day) => [day.key, day],
    ),
  );

  records.forEach((record) => {
    const recordDate =
      dateFrom(record);

    if (!recordDate) {
      return;
    }

    const day =
      byKey.get(dateKey(recordDate));

    if (!day) {
      return;
    }

    day.value += 1;

    if (secondaryValue) {
      day.secondary +=
        secondaryValue(record);
    }
  });

  return days.map(
    ({
      key,
      label,
      value,
      secondary,
    }) => ({
      key,
      label,
      value,
      secondary,
    }),
  );
}

export function PosModuleWorkspaceHeader({
  token,
  profile,
  workspace,
}: PosModuleWorkspaceHeaderProps) {
  const tenantSlug =
    tenantSlugFrom(profile);

  const isAdministrator =
    profileIsAdministrator(profile);

  const configuration =
    workspaceConfigurations[workspace] ??
    workspaceConfigurations.pos;

  const [customers, setCustomers] =
    useState<UnknownRecord[]>([]);

  const [prescriptions, setPrescriptions] =
    useState<UnknownRecord[]>([]);

  const [sales, setSales] =
    useState<UnknownRecord[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [notice, setNotice] =
    useState('');

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const [
    showCardConfiguration,
    setShowCardConfiguration,
  ] = useState(false);

  const loadIntelligence =
    useCallback(async () => {
      if (!tenantSlug) {
        setNotice(
          'An active tenant assignment is required to load workspace intelligence.',
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice('');

      const customerRequest =
        getPharmaCustomers as unknown as (
          tokenValue: string,
          tenantValue: string,
        ) => Promise<unknown>;

      const prescriptionRequest =
        getPharmaPrescriptions as unknown as (
          tokenValue: string,
          tenantValue: string,
        ) => Promise<unknown>;

      const salesRequest =
        getPharmaSales as unknown as (
          tokenValue: string,
          tenantValue: string,
        ) => Promise<unknown>;

      const results =
        await Promise.allSettled([
          customerRequest(
            token,
            tenantSlug,
          ),
          prescriptionRequest(
            token,
            tenantSlug,
          ),
          salesRequest(
            token,
            tenantSlug,
          ),
        ]);

      const [
        customerResult,
        prescriptionResult,
        salesResult,
      ] = results;

      if (
        customerResult.status ===
        'fulfilled'
      ) {
        setCustomers(
          extractList(
            customerResult.value,
            'customers',
          ),
        );
      }

      if (
        prescriptionResult.status ===
        'fulfilled'
      ) {
        setPrescriptions(
          extractList(
            prescriptionResult.value,
            'prescriptions',
          ),
        );
      }

      if (
        salesResult.status ===
        'fulfilled'
      ) {
        setSales(
          extractList(
            salesResult.value,
            'sales',
          ),
        );
      }

      const failureCount =
        results.filter(
          (result) =>
            result.status === 'rejected',
        ).length;

      if (failureCount > 0) {
        setNotice(
          failureCount === results.length
            ? 'Operational insights are temporarily unavailable. Sales functions remain available below.'
            : 'Some indicators could not be refreshed. Available live information is shown.',
        );
      }

      setLastUpdated(new Date());
      setIsLoading(false);
    }, [
      tenantSlug,
      token,
    ]);

  useEffect(() => {
    void loadIntelligence();
  }, [loadIntelligence]);

  const intelligence = useMemo(() => {
    const totalSales = sales.reduce(
      (sum, sale) =>
        sum +
        numberValue(
          sale,
          [
            'total_amount',
            'grand_total',
            'amount',
          ],
        ),
      0,
    );

    const collected = sales.reduce(
      (sum, sale) =>
        sum +
        numberValue(
          sale,
          [
            'paid_amount',
            'amount_paid',
            'collected_amount',
          ],
        ),
      0,
    );

    const outstanding = sales.reduce(
      (sum, sale) =>
        sum +
        numberValue(
          sale,
          [
            'balance_amount',
            'outstanding_amount',
            'balance',
          ],
        ),
      0,
    );

    const pendingPrescriptions =
      prescriptions.filter(
        (record) =>
          statusIncludes(
            record,
            [
              'pending',
              'received',
              'submitted',
              'awaiting',
              'active',
            ],
          ),
      );

    const completedPrescriptions =
      prescriptions.filter(
        (record) =>
          statusIncludes(
            record,
            [
              'complete',
              'fulfilled',
              'dispensed',
              'closed',
            ],
          ),
      );

    const partialPrescriptions =
      prescriptions.filter(
        (record) =>
          statusIncludes(
            record,
            [
              'partial',
              'partially',
            ],
          ),
      );

    const paymentExceptions =
      sales.filter(
        (record) =>
          numberValue(
            record,
            [
              'balance_amount',
              'outstanding_amount',
              'balance',
            ],
          ) > 0 ||
          statusIncludes(
            record,
            [
              'partial',
              'pending',
              'failed',
              'unpaid',
              'exception',
            ],
          ),
      );

    const profilesWithContact =
      customers.filter(
        (record) =>
          Boolean(
            stringValue(
              record,
              [
                'phone',
                'phone_number',
                'mobile',
                'email',
              ],
            ),
          ),
      );

    const profilesWithAlerts =
      customers.filter(
        (record) => {
          const allergies =
            record.allergies;

          const alerts =
            record.clinical_alerts;

          return (
            (
              Array.isArray(allergies) &&
              allergies.length > 0
            ) ||
            (
              typeof allergies === 'string' &&
              allergies.trim() !== ''
            ) ||
            (
              Array.isArray(alerts) &&
              alerts.length > 0
            ) ||
            (
              typeof alerts === 'string' &&
              alerts.trim() !== ''
            )
          );
        },
      );

    const salesTrend =
      buildDailyTrend(
        sales,
        (sale) =>
          numberValue(
            sale,
            [
              'paid_amount',
              'amount_paid',
            ],
          ),
      );

    const prescriptionTrend =
      buildDailyTrend(
        prescriptions,
      );

    const customerTrend =
      buildDailyTrend(
        customers,
      );

    return {
      totalSales,
      collected,
      outstanding,
      pendingPrescriptions,
      completedPrescriptions,
      partialPrescriptions,
      paymentExceptions,
      profilesWithContact,
      profilesWithAlerts,
      salesTrend,
      prescriptionTrend,
      customerTrend,
    };
  }, [
    customers,
    prescriptions,
    sales,
  ]);

  const cards = useMemo<MetricCard[]>(() => {
    if (
      workspace ===
      'dispensing-review'
    ) {
      return [
        {
          id: 'review-queue',
          label: 'Awaiting review',
          value: String(
            intelligence
              .pendingPrescriptions
              .length,
          ),
          detail:
            'Prescriptions requiring professional validation or action.',
          tone:
            intelligence
              .pendingPrescriptions
              .length > 0
              ? 'warning'
              : 'positive',
        },
        {
          id: 'completed-review',
          label: 'Completed',
          value: String(
            intelligence
              .completedPrescriptions
              .length,
          ),
          detail:
            'Prescriptions recorded as fulfilled, dispensed, or closed.',
          tone: 'positive',
        },
        {
          id: 'partial-review',
          label: 'Partial fulfilment',
          value: String(
            intelligence
              .partialPrescriptions
              .length,
          ),
          detail:
            'Prescriptions needing completion or follow-up.',
          tone:
            intelligence
              .partialPrescriptions
              .length > 0
              ? 'information'
              : 'standard',
        },
        {
          id: 'clinical-alerts',
          label: 'Patient alerts',
          value: String(
            intelligence
              .profilesWithAlerts
              .length,
          ),
          detail:
            'Customer or patient profiles carrying recorded clinical alerts.',
          tone:
            intelligence
              .profilesWithAlerts
              .length > 0
              ? 'critical'
              : 'standard',
        },
      ];
    }

    if (workspace === 'customers') {
      return [
        {
          id: 'profiles',
          label: 'Customer and patient profiles',
          value: String(
            customers.length,
          ),
          detail:
            'Profiles available to the active tenant.',
          tone: 'information',
        },
        {
          id: 'contact-quality',
          label: 'Contact completeness',
          value: percentage(
            intelligence
              .profilesWithContact
              .length,
            customers.length,
          ),
          detail:
            'Profiles containing a usable phone number or email address.',
          tone: 'positive',
        },
        {
          id: 'profile-alerts',
          label: 'Clinical alerts',
          value: String(
            intelligence
              .profilesWithAlerts
              .length,
          ),
          detail:
            'Profiles carrying allergy or clinical-warning information.',
          tone:
            intelligence
              .profilesWithAlerts
              .length > 0
              ? 'critical'
              : 'standard',
        },
        {
          id: 'linked-prescriptions',
          label: 'Prescription records',
          value: String(
            prescriptions.length,
          ),
          detail:
            'Prescription records available for relationship and history review.',
          tone: 'information',
        },
      ];
    }

    if (
      workspace === 'prescriptions'
    ) {
      return [
        {
          id: 'prescription-register',
          label: 'Prescription register',
          value: String(
            prescriptions.length,
          ),
          detail:
            'Prescriptions available to the active tenant.',
          tone: 'information',
        },
        {
          id: 'pending-validation',
          label: 'Awaiting validation',
          value: String(
            intelligence
              .pendingPrescriptions
              .length,
          ),
          detail:
            'Prescriptions requiring validation, review, or action.',
          tone:
            intelligence
              .pendingPrescriptions
              .length > 0
              ? 'warning'
              : 'positive',
        },
        {
          id: 'partial-fill',
          label: 'Partial fulfilment',
          value: String(
            intelligence
              .partialPrescriptions
              .length,
          ),
          detail:
            'Partially supplied prescriptions requiring traceable follow-up.',
          tone:
            intelligence
              .partialPrescriptions
              .length > 0
              ? 'warning'
              : 'standard',
        },
        {
          id: 'completed-prescriptions',
          label: 'Completed',
          value: String(
            intelligence
              .completedPrescriptions
              .length,
          ),
          detail:
            'Prescriptions recorded as fulfilled, dispensed, or closed.',
          tone: 'positive',
        },
      ];
    }

    if (
      workspace ===
      'sales-performance'
    ) {
      return [
        {
          id: 'sales-count',
          label: 'Sales register',
          value: String(
            sales.length,
          ),
          detail:
            'Transactions available for review.',
          tone: 'information',
        },
        {
          id: 'sales-value',
          label: 'Recorded sales',
          value: money(
            intelligence.totalSales,
          ),
          detail:
            'Gross value of available sales transactions.',
          tone: 'positive',
        },
        {
          id: 'sales-collected',
          label: 'Collected',
          value: money(
            intelligence.collected,
          ),
          detail:
            'Value collected against the available sales register.',
          tone: 'positive',
        },
        {
          id: 'sales-outstanding',
          label: 'Outstanding balance',
          value: money(
            intelligence.outstanding,
          ),
          detail:
            'Value remaining unpaid or unsettled.',
          tone:
            intelligence.outstanding > 0
              ? 'warning'
              : 'positive',
        },
        {
          id: 'transaction-exceptions',
          label: 'Payment exceptions',
          value: String(
            intelligence
              .paymentExceptions
              .length,
          ),
          detail:
            'Sales carrying a balance, pending, failed, or partial-payment state.',
          tone:
            intelligence
              .paymentExceptions
              .length > 0
              ? 'critical'
              : 'positive',
        },
      ];
    }

    if (
      workspace ===
      'payment-receipt'
    ) {
      return [
        {
          id: 'payment-collected',
          label: 'Total collected',
          value: money(
            intelligence.collected,
          ),
          detail:
            'Collected value recorded against available sales.',
          tone: 'positive',
        },
        {
          id: 'payment-outstanding',
          label: 'Outstanding settlement',
          value: money(
            intelligence.outstanding,
          ),
          detail:
            'Value remaining unpaid or unsettled.',
          tone:
            intelligence.outstanding > 0
              ? 'warning'
              : 'positive',
        },
        {
          id: 'payment-exceptions',
          label: 'Payment exceptions',
          value: String(
            intelligence
              .paymentExceptions
              .length,
          ),
          detail:
            'Transactions requiring settlement or variance review.',
          tone:
            intelligence
              .paymentExceptions
              .length > 0
              ? 'critical'
              : 'positive',
        },
        {
          id: 'collection-rate',
          label: 'Collection efficiency',
          value: percentage(
            intelligence.collected,
            intelligence.totalSales,
          ),
          detail:
            'Collected value compared with recorded sales.',
          tone: 'information',
        },
        {
          id: 'receipt-register',
          label: 'Receipt-linked sales',
          value: String(
            sales.length,
          ),
          detail:
            'Sales available for receipt and payment review.',
          tone: 'standard',
        },
      ];
    }

    return [
      {
        id: 'transactions',
        label: 'Transactions',
        value: String(
          sales.length,
        ),
        detail:
          'Transactions available to the active tenant.',
        tone: 'information',
      },
      {
        id: 'sales',
        label: 'Sales value',
        value: money(
          intelligence.totalSales,
        ),
        detail:
          'Total recorded transaction value.',
        tone: 'positive',
      },
      {
        id: 'collected',
        label: 'Collected',
        value: money(
          intelligence.collected,
        ),
        detail:
          'Value collected against recorded sales.',
        tone: 'positive',
      },
      {
        id: 'outstanding',
        label: 'Outstanding',
        value: money(
          intelligence.outstanding,
        ),
        detail:
          'Value remaining unpaid or unsettled.',
        tone:
          intelligence.outstanding > 0
            ? 'warning'
            : 'positive',
      },
    ];
  }, [
    customers.length,
    intelligence,
    prescriptions.length,
    sales.length,
    workspace,
  ]);

  const trend = useMemo(() => {
    if (workspace === 'customers') {
      return intelligence.customerTrend;
    }

    if (
      workspace ===
        'dispensing-review' ||
      workspace ===
        'prescriptions'
    ) {
      return intelligence.prescriptionTrend;
    }

    return intelligence.salesTrend;
  }, [
    intelligence,
    workspace,
  ]);

  const statusSlices =
    useMemo<StatusSlice[]>(() => {
      if (
        workspace ===
          'dispensing-review' ||
        workspace ===
          'prescriptions'
      ) {
        return [
          {
            label: 'Awaiting action',
            value:
              intelligence
                .pendingPrescriptions
                .length,
            className: 'warning',
          },
          {
            label: 'Completed',
            value:
              intelligence
                .completedPrescriptions
                .length,
            className: 'positive',
          },
          {
            label: 'Partial',
            value:
              intelligence
                .partialPrescriptions
                .length,
            className: 'information',
          },
        ];
      }

      if (workspace === 'customers') {
        return [
          {
            label: 'Contact available',
            value:
              intelligence
                .profilesWithContact
                .length,
            className: 'positive',
          },
          {
            label: 'Clinical alerts',
            value:
              intelligence
                .profilesWithAlerts
                .length,
            className: 'critical',
          },
          {
            label: 'Other profiles',
            value: Math.max(
              0,
              customers.length -
                intelligence
                  .profilesWithContact
                  .length,
            ),
            className: 'standard',
          },
        ];
      }

      return [
        {
          label: 'Collected',
          value:
            intelligence.collected,
          className: 'positive',
        },
        {
          label: 'Outstanding',
          value:
            intelligence.outstanding,
          className: 'warning',
        },
        {
          label: 'Exceptions',
          value:
            intelligence
              .paymentExceptions
              .length,
          className: 'critical',
        },
      ];
    }, [
      customers.length,
      intelligence,
      workspace,
    ]);

  const visibilityKey =
    `ubuzimaplus:module-cards:${tenantSlug || 'tenant'}:${workspace}`;

  const defaultCardIds = useMemo(
    () => cards.map((card) => card.id),
    [cards],
  );

  const [
    visibleCardIds,
    setVisibleCardIds,
  ] = useState<string[]>(
    defaultCardIds,
  );

  useEffect(() => {
    setVisibleCardIds(
      loadVisibility(
        visibilityKey,
        defaultCardIds,
      ),
    );
  }, [
    defaultCardIds,
    visibilityKey,
  ]);

  const saveVisibleCards = (
    next: string[],
  ) => {
    setVisibleCardIds(next);

    try {
      window.localStorage.setItem(
        visibilityKey,
        JSON.stringify(next),
      );
    } catch {
      // The page remains usable when browser
      // storage is unavailable.
    }
  };

  const visibleCards =
    cards.filter(
      (card) =>
        visibleCardIds.includes(
          card.id,
        ),
    );

  const maximumTrendValue =
    Math.max(
      ...trend.map(
        (point) =>
          Math.max(
            point.value,
            point.secondary,
          ),
      ),
      1,
    );

  const totalDistribution =
    Math.max(
      statusSlices.reduce(
        (sum, slice) =>
          sum + slice.value,
        0,
      ),
      1,
    );

  let cumulativeDegrees = 0;

  const gradientStops =
    statusSlices.map(
      (slice, index) => {
        const start =
          cumulativeDegrees;

        const degrees =
          (
            slice.value /
            totalDistribution
          ) * 360;

        cumulativeDegrees += degrees;

        const colour =
          index === 0
            ? '#237a53'
            : index === 1
              ? '#d2a03b'
              : '#7183c3';

        return `${colour} ${start}deg ${cumulativeDegrees}deg`;
      },
    );

  if (
    cumulativeDegrees < 360
  ) {
    gradientStops.push(
      `#e5ebe7 ${cumulativeDegrees}deg 360deg`,
    );
  }

  return (
    <section className="professional-module-header">
      <header className="professional-module-hero">
        <div className="professional-module-heading">
          <span className="professional-module-eyebrow">
            {configuration.eyebrow}
          </span>

          <h1>{configuration.title}</h1>

          <p>{configuration.subtitle}</p>
        </div>

        <div className="professional-module-hero-actions">
          <div className="professional-module-live-status">
            <i
              className={
                isLoading
                  ? 'loading'
                  : 'ready'
              }
            />

            <span>
              {isLoading
                ? 'Refreshing live indicators'
                : lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString(
                      [],
                      {
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )}`
                  : 'Live operational indicators'}
            </span>
          </div>

          {isAdministrator && (
            <button
              type="button"
              className="professional-module-configure"
              onClick={() =>
                setShowCardConfiguration(
                  (current) => !current,
                )
              }
            >
              {showCardConfiguration
                ? 'Close card settings'
                : 'Customize team cards'}
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              void loadIntelligence()
            }
            disabled={isLoading}
          >
            {isLoading
              ? 'Refreshing…'
              : 'Refresh'}
          </button>
        </div>
      </header>

      {notice && (
        <div
          className="professional-module-notice"
          role="status"
        >
          {notice}
        </div>
      )}

      {showCardConfiguration &&
        isAdministrator && (
          <section className="professional-module-configuration">
            <div>
              <span className="professional-module-eyebrow">
                Administrator control
              </span>

              <h2>Team card visibility</h2>

              <p>
                Choose the summary cards visible in
                this workspace.
              </p>
            </div>

            <div className="professional-module-card-options">
              {cards.map((card) => (
                <label key={card.id}>
                  <input
                    type="checkbox"
                    checked={visibleCardIds.includes(
                      card.id,
                    )}
                    onChange={() => {
                      const next =
                        visibleCardIds.includes(
                          card.id,
                        )
                          ? visibleCardIds.filter(
                              (id) =>
                                id !== card.id,
                            )
                          : [
                              ...visibleCardIds,
                              card.id,
                            ];

                      saveVisibleCards(next);
                    }}
                  />

                  <span>{card.label}</span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                saveVisibleCards(
                  defaultCardIds,
                )
              }
            >
              Restore all cards
            </button>
          </section>
        )}

      <div className="professional-module-metric-grid">
        {visibleCards.map((card) => (
          <article
            key={card.id}
            className={`professional-module-metric ${card.tone}`}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </div>

      <div className="professional-module-visual-grid">
        <article className="professional-module-chart-card">
          <div className="professional-module-card-heading">
            <div>
              <span className="professional-module-eyebrow">
                Seven-day activity
              </span>

              <h2>
                {configuration.trendTitle}
              </h2>
            </div>
          </div>

          <div className="professional-module-bar-chart">
            {trend.map((point) => (
              <div
                className="professional-module-bar-column"
                key={point.key}
              >
                <div className="professional-module-bar-area">
                  <i
                    className="primary"
                    style={{
                      height: `${Math.max(
                        5,
                        (
                          point.value /
                          maximumTrendValue
                        ) * 100,
                      )}%`,
                    }}
                    title={`${point.label}: ${point.value}`}
                  />

                  {point.secondary > 0 && (
                    <i
                      className="secondary"
                      style={{
                        height: `${Math.max(
                          5,
                          (
                            point.secondary /
                            maximumTrendValue
                          ) * 100,
                        )}%`,
                      }}
                      title={`${point.label}: ${point.secondary}`}
                    />
                  )}
                </div>

                <span>{point.label}</span>
              </div>
            ))}
          </div>

          <div className="professional-module-chart-legend">
            <span>
              <i className="primary" />
              Activity
            </span>

            {trend.some(
              (point) =>
                point.secondary > 0,
            ) && (
              <span>
                <i className="secondary" />
                Collection value
              </span>
            )}
          </div>
        </article>

        <article className="professional-module-chart-card">
          <div className="professional-module-card-heading">
            <div>
              <span className="professional-module-eyebrow">
                Operational distribution
              </span>

              <h2>
                {configuration.distributionTitle}
              </h2>
            </div>
          </div>

          <div className="professional-module-donut-layout">
            <div
              className="professional-module-donut"
              style={{
                background:
                  `conic-gradient(${gradientStops.join(
                    ', ',
                  )})`,
              }}
            >
              <div>
                <strong>
                  {statusSlices.reduce(
                    (sum, slice) =>
                      sum + slice.value,
                    0,
                  ).toLocaleString('en-RW')}
                </strong>

                <span>Total signals</span>
              </div>
            </div>

            <div className="professional-module-distribution-list">
              {statusSlices.map(
                (slice) => (
                  <div key={slice.label}>
                    <i
                      className={
                        slice.className
                      }
                    />

                    <span>
                      {slice.label}
                    </span>

                    <strong>
                      {slice.value.toLocaleString(
                        'en-RW',
                      )}
                    </strong>
                  </div>
                ),
              )}
            </div>
          </div>
        </article>
      </div>

      {![
        'dispensing-review',
        'customers',
        'prescriptions',
        'sales-performance',
        'payment-receipt',
      ].includes(workspace) && (
      <section className="professional-module-controls">
          <div className="professional-module-controls-heading">
            <span className="professional-module-eyebrow">
              Governance and safety
            </span>

            <h2>
              {configuration.controlsTitle}
            </h2>

            <p>
              These controls remain part of the
              operational workflow and its audit trail.
            </p>
          </div>

          <div className="professional-module-control-grid">
            {configuration.controls.map(
              (control, index) => (
                <article key={control.title}>
                  <div>
                    <span>
                      {String(index + 1).padStart(
                        2,
                        '0',
                      )}
                    </span>

                    <i
                      className={
                        control.state
                      }
                    >
                      {control.state}
                    </i>
                  </div>

                  <strong>
                    {control.title}
                  </strong>

                  <p>{control.detail}</p>
                </article>
              ),
            )}
          </div>
        </section>
      )}
    </section>
  );
}

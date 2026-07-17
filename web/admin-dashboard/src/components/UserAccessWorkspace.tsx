import { FormEvent, useEffect, useMemo, useState } from 'react';
import { APP_DATA_REFRESH_EVENT, requestAppDataRefresh } from '../lib/appRefresh';
import {
  createTenantSecurityUser,
  getTenantSecurityRoleTemplates,
  getTenantSecurityUsers,
  type TenantSecurityUser,
  type TenantUserRoleTemplate,
  updateTenantSecurityUser,
  deleteTenantSecurityUser,
} from '../lib/api';

type Props = {
  token: string;
  tenantSlug?: string;
};

type PermissionAction = 'view' | 'add' | 'edit' | 'delete' | 'approve';

type PermissionMatrixResource = {
  label: string;
  description: string;
  permissions: Partial<Record<PermissionAction, string>>;
};

type PermissionMatrixGroup = {
  title: string;
  description: string;
  resources: PermissionMatrixResource[];
};

const permissionActions: PermissionAction[] = ['view', 'add', 'edit', 'delete', 'approve'];

const permissionMatrix: PermissionMatrixGroup[] = [
  {
    title: 'Inventory',
    description: 'Product Master, stock batches, receiving, locations, low stock, expiry review, and inventory customization.',
    resources: [
      {
        label: 'Inventory Dashboard',
        description: 'Inventory overview, stock position, alerts, and summary cards.',
        permissions: { view: 'inventory.dashboard.view' },
      },
      {
        label: 'Product Master',
        description: 'Commercial products used by stock, pricing, and POS.',
        permissions: {
          view: 'inventory.products.view',
          add: 'inventory.products.add',
          edit: 'inventory.products.edit',
          delete: 'inventory.products.delete',
        },
      },
      {
        label: 'Inventory Batches',
        description: 'Batch quantities, cost, expiry date, margin, and selling price.',
        permissions: {
          view: 'inventory.batches.view',
          add: 'inventory.batches.add',
          edit: 'inventory.batches.edit',
          delete: 'inventory.batches.delete',
        },
      },
      {
        label: 'Receiving',
        description: 'Receive stock against Product Master.',
        permissions: {
          view: 'inventory.receiving.view',
          add: 'inventory.receiving.add',
          edit: 'inventory.receiving.edit',
          delete: 'inventory.receiving.delete',
        },
      },
      {
        label: 'Stock Locations',
        description: 'Branches, stores, shelves, and inventory holding points.',
        permissions: {
          view: 'inventory.locations.view',
          add: 'inventory.locations.add',
          edit: 'inventory.locations.edit',
          delete: 'inventory.locations.delete',
        },
      },
      {
        label: 'Low Stock',
        description: 'Low stock monitoring and replenishment attention.',
        permissions: {
          view: 'inventory.low_stock.view',
          add: 'inventory.low_stock.add',
          edit: 'inventory.low_stock.edit',
          delete: 'inventory.low_stock.delete',
        },
      },
      {
        label: 'Expiry Review',
        description: 'Near-expiry, expired, and expiry-risk reviews.',
        permissions: {
          view: 'inventory.expiry_review.view',
          add: 'inventory.expiry_review.add',
          edit: 'inventory.expiry_review.edit',
          delete: 'inventory.expiry_review.delete',
        },
      },
      {
        label: 'Expiry Labels',
        description: 'Expiry thresholds, colour mapping, and label rules.',
        permissions: {
          view: 'inventory.expiry_labels.view',
          edit: 'inventory.expiry_labels.edit',
        },
      },
      {
        label: 'Table Settings',
        description: 'Table style, density, font size, wrapping, and sticky columns.',
        permissions: {
          view: 'inventory.table_settings.view',
          edit: 'inventory.table_settings.edit',
        },
      },
    ],
  },
  {
    title: 'POS and Sales',
    description: 'Sales register, receipts, returns, payments, insurance handling, and cashier close.',
    resources: [
      {
        label: 'Sales Register',
        description: 'Create and manage counter sales.',
        permissions: {
          view: 'pos.sales.view',
          add: 'pos.sales.add',
          edit: 'pos.sales.edit',
          delete: 'pos.sales.delete',
        },
      },
      {
        label: 'Receipts',
        description: 'Receipt viewing, correction, and reprint control.',
        permissions: {
          view: 'pos.receipts.view',
          add: 'pos.receipts.add',
          edit: 'pos.receipts.edit',
          delete: 'pos.receipts.delete',
        },
      },
      {
        label: 'Returns',
        description: 'Returns, refunds, and returned item review.',
        permissions: {
          view: 'pos.returns.view',
          add: 'pos.returns.add',
          edit: 'pos.returns.edit',
          delete: 'pos.returns.delete',
        },
      },
      {
        label: 'Payments',
        description: 'Cash, card, mobile money, and insurance payment handling.',
        permissions: {
          view: 'pos.payments.view',
          add: 'pos.payments.add',
          edit: 'pos.payments.edit',
          delete: 'pos.payments.delete',
        },
      },
      {
        label: 'Insurance',
        description: 'Insurance-linked sales and claim preparation.',
        permissions: {
          view: 'pos.insurance.view',
          add: 'pos.insurance.add',
          edit: 'pos.insurance.edit',
          delete: 'pos.insurance.delete',
        },
      },
      {
        label: 'Cashier Close',
        description: 'Shift close, daily close, and cashier reconciliation.',
        permissions: {
          view: 'pos.cashier_close.view',
          add: 'pos.cashier_close.add',
          edit: 'pos.cashier_close.edit',
        },
      },
      {
        label: 'POS Session Administration',
        description: 'Review POS sessions, force-close abandoned sessions, and reset daily session limits.',
        permissions: {
          view: 'pos.session_support.view',
          edit: 'pos.session_support.edit',
        },
      },
      {
        label: 'Historical POS Sessions',
        description: 'View, open, record, and approve controlled historical POS sessions.',
        permissions: {
          view: 'pharmaco.pos.historical.view',
          add: 'pharmaco.pos.historical.open',
          edit: 'pharmaco.pos.historical.record',
          approve: 'pharmaco.pos.historical.approve',
        },
      },
    ],
  },
  {
    title: 'Procurement and Suppliers',
    description: 'Suppliers, purchase orders, receiving, and dispatch coordination.',
    resources: [
      {
        label: 'Suppliers',
        description: 'Supplier registry and supplier profile control.',
        permissions: {
          view: 'procurement.suppliers.view',
          add: 'procurement.suppliers.add',
          edit: 'procurement.suppliers.edit',
          delete: 'procurement.suppliers.delete',
        },
      },
      {
        label: 'Purchase Orders',
        description: 'Purchase order planning and approval preparation.',
        permissions: {
          view: 'procurement.purchase_orders.view',
          add: 'procurement.purchase_orders.add',
          edit: 'procurement.purchase_orders.edit',
          delete: 'procurement.purchase_orders.delete',
        },
      },
      {
        label: 'Receiving',
        description: 'Supplier delivery and received item confirmation.',
        permissions: {
          view: 'procurement.receiving.view',
          add: 'procurement.receiving.add',
          edit: 'procurement.receiving.edit',
          delete: 'procurement.receiving.delete',
        },
      },
      {
        label: 'Dispatch',
        description: 'Dispatch and stock movement coordination.',
        permissions: {
          view: 'procurement.dispatch.view',
          add: 'procurement.dispatch.add',
          edit: 'procurement.dispatch.edit',
          delete: 'procurement.dispatch.delete',
        },
      },
    ],
  },
  {
    title: 'Insurance Management',
    description: 'Insurance configuration, memberships, eligibility, claims, reconciliation and audit evidence.',
    resources: [
      {
        label: 'Insurance dashboard',
        description: 'View insurance operating summaries and readiness indicators.',
        permissions: { view: 'insurance.dashboard.view' },
      },
      {
        label: 'Partners, schemes and price rules',
        description: 'Configure insurers, schemes, price lists, product prices and contribution rules.',
        permissions: {
          view: 'insurance.configuration.view',
          add: 'insurance.configuration.manage',
          edit: 'insurance.configuration.manage',
          delete: 'insurance.configuration.manage',
        },
      },
      {
        label: 'Memberships and eligibility',
        description: 'Review member coverage and perform eligibility checks.',
        permissions: {
          view: 'insurance.memberships.view',
          add: 'insurance.memberships.manage',
          edit: 'insurance.memberships.manage',
        },
      },
      {
        label: 'Claims',
        description: 'Create, review, adjudicate and settle insurance claims.',
        permissions: {
          view: 'insurance.claims.view',
          add: 'insurance.claims.create',
          edit: 'insurance.claims.adjudicate',
          delete: 'insurance.claims.payments',
        },
      },
      {
        label: 'Reconciliation',
        description: 'Review and manage insurer reconciliation.',
        permissions: {
          view: 'insurance.reconciliation.view',
          edit: 'insurance.reconciliation.manage',
        },
      },
      {
        label: 'Insurance audit',
        description: 'View controlled insurance audit evidence.',
        permissions: { view: 'insurance.audit.view' },
      },
    ],
  },

  {
    title: 'Finance',
    description: 'Payables, receivables, payments, reconciliation, and finance dashboard access.',
    resources: [
      {
        label: 'Finance Dashboard',
        description: 'Finance summary and operational indicators.',
        permissions: { view: 'finance.dashboard.view' },
      },
      {
        label: 'Payables',
        description: 'Supplier bills and payable tracking.',
        permissions: {
          view: 'finance.payables.view',
          add: 'finance.payables.add',
          edit: 'finance.payables.edit',
          delete: 'finance.payables.delete',
        },
      },
      {
        label: 'Receivables',
        description: 'Customer, insurer, and partner receivable control.',
        permissions: {
          view: 'finance.receivables.view',
          add: 'finance.receivables.add',
          edit: 'finance.receivables.edit',
          delete: 'finance.receivables.delete',
        },
      },
      {
        label: 'Payments',
        description: 'Payment records and settlement operations.',
        permissions: {
          view: 'finance.payments.view',
          add: 'finance.payments.add',
          edit: 'finance.payments.edit',
          delete: 'finance.payments.delete',
        },
      },
      {
        label: 'Reconciliation',
        description: 'Cash, bank, mobile money, and settlement reconciliation.',
        permissions: {
          view: 'finance.reconciliation.view',
          add: 'finance.reconciliation.add',
          edit: 'finance.reconciliation.edit',
          delete: 'finance.reconciliation.delete',
        },
      },
    ],
  },
  {
    title: 'Users, Roles, and Security',
    description: 'Staff users, role assignment, permission control, 2FA, and audit review.',
    resources: [
      {
        label: 'Staff Users',
        description: 'User list, user detail, and staff profile access.',
        permissions: {
          view: 'users.staff.view',
          add: 'users.staff.add',
          edit: 'users.staff.edit',
          delete: 'users.staff.delete',
        },
      },
      {
        label: 'User Status',
        description: 'Deactivate or reactivate user access while preserving audit history.',
        permissions: {
          view: 'users.staff.view',
          edit: 'users.staff.deactivate',
        },
      },
      {
        label: 'Roles',
        description: 'Role templates and role assignment.',
        permissions: {
          view: 'security.roles.view',
          add: 'security.roles.add',
          edit: 'security.roles.edit',
          delete: 'security.roles.delete',
        },
      },
      {
        label: 'Permissions',
        description: 'Fine-grained permission assignment.',
        permissions: {
          view: 'security.permissions.view',
          add: 'security.permissions.add',
          edit: 'security.permissions.edit',
          delete: 'security.permissions.delete',
        },
      },
      {
        label: 'Two-Factor Authentication',
        description: '2FA policy and trusted device management.',
        permissions: {
          view: 'security.two_factor.view',
          add: 'security.two_factor.add',
          edit: 'security.two_factor.edit',
          delete: 'security.two_factor.delete',
        },
      },
      {
        label: 'Audit Trail',
        description: 'Security and activity audit review.',
        permissions: {
          view: 'security.audit.view',
          add: 'security.audit.add',
          edit: 'security.audit.edit',
          delete: 'security.audit.delete',
        },
      },
    ],
  },
  {
    title: 'Reports',
    description: 'Inventory, sales, finance, procurement, and audit reports.',
    resources: [
      {
        label: 'Inventory Reports',
        description: 'Inventory report review and export preparation.',
        permissions: {
          view: 'reports.inventory.view',
          add: 'reports.inventory.add',
          edit: 'reports.inventory.edit',
          delete: 'reports.inventory.delete',
        },
      },
      {
        label: 'Sales Reports',
        description: 'Sales reporting and cashier performance review.',
        permissions: {
          view: 'reports.sales.view',
          add: 'reports.sales.add',
          edit: 'reports.sales.edit',
          delete: 'reports.sales.delete',
        },
      },
      {
        label: 'Finance Reports',
        description: 'Finance reporting and settlement review.',
        permissions: {
          view: 'reports.finance.view',
          add: 'reports.finance.add',
          edit: 'reports.finance.edit',
          delete: 'reports.finance.delete',
        },
      },
      {
        label: 'Procurement Reports',
        description: 'Supplier and purchase reporting.',
        permissions: {
          view: 'reports.procurement.view',
          add: 'reports.procurement.add',
          edit: 'reports.procurement.edit',
          delete: 'reports.procurement.delete',
        },
      },
      {
        label: 'Audit Reports',
        description: 'Audit, compliance, and security reports.',
        permissions: {
          view: 'reports.audit.view',
          add: 'reports.audit.add',
          edit: 'reports.audit.edit',
          delete: 'reports.audit.delete',
        },
      },
    ],
  },
  {
    title: 'Communications and Platform',
    description: 'Notifications, email, chat, tenant setup, branches, and platform areas.',
    resources: [
      {
        label: 'Notifications',
        description: 'Notification center and scheduled communications.',
        permissions: {
          view: 'communications.notifications.view',
          add: 'communications.notifications.add',
          edit: 'communications.notifications.edit',
          delete: 'communications.notifications.delete',
        },
      },
      {
        label: 'Corporate Email',
        description: 'Corporate email and message templates.',
        permissions: {
          view: 'communications.email.view',
          add: 'communications.email.add',
          edit: 'communications.email.edit',
          delete: 'communications.email.delete',
        },
      },
      {
        label: 'Pharmacist Chat',
        description: 'In-app and WhatsApp communication workspace.',
        permissions: {
          view: 'communications.chat.view',
          add: 'communications.chat.add',
          edit: 'communications.chat.edit',
          delete: 'communications.chat.delete',
        },
      },
      {
        label: 'Tenant Profile',
        description: 'Tenant identity and operational setup.',
        permissions: {
          view: 'tenant.profile.view',
          add: 'tenant.profile.add',
          edit: 'tenant.profile.edit',
          delete: 'tenant.profile.delete',
        },
      },
      {
        label: 'Branches',
        description: 'Branch and location setup.',
        permissions: {
          view: 'tenant.branches.view',
          add: 'tenant.branches.add',
          edit: 'tenant.branches.edit',
          delete: 'tenant.branches.delete',
        },
      },
      {
        label: 'Platform Settings',
        description: 'Platform configuration and application controls.',
        permissions: {
          view: 'settings.platform.view',
          add: 'settings.platform.add',
          edit: 'settings.platform.edit',
          delete: 'settings.platform.delete',
        },
      },
    ],
  },
];

const allGranularPermissions = Array.from(
  new Set(
    permissionMatrix.flatMap((group) =>
      group.resources.flatMap((resource) =>
        permissionActions
          .map((action) => resource.permissions[action])
          .filter((permission): permission is string => Boolean(permission)),
      ),
    ),
  ),
).sort();

const validGranularPermissionSet = new Set(allGranularPermissions);

const legacyPermissionMap: Record<string, string[]> = {
  'tenant.dashboard.view': ['tenant.profile.view'],
  'roles.manage': ['security.roles.view', 'security.roles.add', 'security.roles.edit', 'security.permissions.view', 'security.permissions.edit'],
  'users.view': ['users.staff.view'],
  'users.create': ['users.staff.add'],
  'users.update': ['users.staff.edit'],
  'users.permissions.edit': ['security.permissions.view', 'security.permissions.edit'],
  'pharmaco.pos.use': ['pos.sales.view', 'pos.sales.add', 'pos.receipts.view', 'pos.payments.view'],
  'pharmaco.pos.session.reset': ['pos.session_support.view', 'pos.session_support.edit'],
  'pharmaco.sales.view': ['pos.sales.view', 'pos.receipts.view'],
  'pharmaco.sales.create': ['pos.sales.add', 'pos.payments.add'],
  'pharmaco.sales.manage': ['pos.sales.view', 'pos.receipts.view', 'pos.returns.view', 'pos.payments.view', 'pos.insurance.view'],
  'pharmaco.inventory.manage': [
    'inventory.dashboard.view',
    'inventory.products.view',
    'inventory.batches.view',
    'inventory.receiving.view',
    'inventory.locations.view',
    'inventory.low_stock.view',
    'inventory.expiry_review.view',
  ],
  'pharmaco.suppliers.manage': [
    'procurement.suppliers.view',
    'procurement.purchase_orders.view',
    'procurement.receiving.view',
    'procurement.dispatch.view',
  ],
  'pharmaco.procurement.view': ['procurement.suppliers.view', 'procurement.purchase_orders.view', 'procurement.receiving.view'],
  'pharmaco.procurement.suppliers.manage': ['procurement.suppliers.view'],
  'pharmaco.procurement.purchase_order.create': ['procurement.purchase_orders.view'],
  'pharmaco.procurement.purchase_order.approve': ['procurement.purchase_orders.view'],
  'pharmaco.procurement.purchase_order.receive': ['procurement.receiving.view'],
  'pharmaco.product_inventory.receive': ['inventory.receiving.view', 'procurement.receiving.view'],
  'pharmaco.procurement.invoice.manage': ['finance.payables.view'],
  'pharmaco.procurement.invoice.approve': ['finance.payables.view'],
  'pharmaco.procurement.payment.view': ['finance.payables.view'],
  'pharmaco.procurement.payment.manage': ['finance.payables.view'],
  'pharmaco.procurement.supplier_performance.view': ['procurement.suppliers.view'],
  'pharmaco.finance.view': ['finance.dashboard.view', 'finance.payables.view', 'finance.receivables.view'],
  'pharmaco.reports.view': ['reports.inventory.view', 'reports.sales.view', 'reports.finance.view'],
  'notifications.manage': ['communications.notifications.view', 'communications.notifications.add', 'communications.notifications.edit'],
  'ai.use': ['ai.governance.view'],
  'audit.logs.view': ['security.audit.view', 'reports.audit.view'],
};

const defaultStaffPermissions = [
  'tenant.profile.view',
  'pos.sales.view',
  'pos.sales.add',
  'pos.receipts.view',
  'pos.payments.view',
];

type AccessAssignmentMode =
  | 'predefined_role'
  | 'granular_permissions';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  job_title: '',
  access_assignment_mode:
    'predefined_role' as AccessAssignmentMode,
  role_code: 'cashier',
  permissions: [] as string[],
  password: '',
  status: 'active',
  two_factor_required: true,
};

function normalizePermissionKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizePermissionList(permissions: string[]) {
  const normalized = new Set<string>();

  permissions.forEach((permission) => {
    const key = normalizePermissionKey(permission);
    const replacements = legacyPermissionMap[key];

    if (replacements?.length) {
      replacements.forEach((item) => normalized.add(item));
      return;
    }

    if (validGranularPermissionSet.has(key)) {
      normalized.add(key);
    }
  });

  return Array.from(normalized).sort();
}

function permissionCountLabel(count: number) {
  return `${count} permission${count === 1 ? '' : 's'}`;
}

function statusClassName(status?: string) {
  const normalized = normalizePermissionKey(status || 'active');

  if (normalized === 'active') return 'status-chip status-chip--active';
  if (normalized === 'invited' || normalized === 'pending') return 'status-chip status-chip--pending';
  if (normalized === 'suspended' || normalized === 'inactive') return 'status-chip status-chip--blocked';

  return 'status-chip';
}

export function UserAccessWorkspace({ token, tenantSlug = 'vitapharma' }: Props) {
  const [roles, setRoles] = useState<TenantUserRoleTemplate[]>([]);
  const [users, setUsers] = useState<TenantSecurityUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<TenantSecurityUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const normalizedRolePermissionMap = useMemo(() => {
    const entries = roles.map((role) => [role.code, normalizePermissionList(role.permissions)] as const);

    return new Map(entries);
  }, [roles]);

  async function loadSecurityUsers() {
    const [roleResponse, userResponse] = await Promise.all([
      getTenantSecurityRoleTemplates(token, tenantSlug),
      getTenantSecurityUsers(token, tenantSlug),
    ]);

    setRoles(roleResponse.roles);
    setUsers(userResponse.users);
  }

  useEffect(() => {
    loadSecurityUsers().catch((err) => {
      setError(err instanceof Error ? err.message : 'Unable to load users and roles.');
    });
  }, [token, tenantSlug]);

  useEffect(() => {
    function handleSecurityRefresh(event: Event) {
      const area = (event as CustomEvent<{ area?: string }>).detail?.area ?? 'all';

      if (area === 'all' || area === 'security') {
        void loadSecurityUsers();
      }
    }

    function handleVisibleRefresh() {
      if (document.visibilityState === 'visible') {
        void loadSecurityUsers();
      }
    }

    window.addEventListener(APP_DATA_REFRESH_EVENT, handleSecurityRefresh);
    document.addEventListener('visibilitychange', handleVisibleRefresh);

    return () => {
      window.removeEventListener(APP_DATA_REFRESH_EVENT, handleSecurityRefresh);
      document.removeEventListener('visibilitychange', handleVisibleRefresh);
    };
  }, [token, tenantSlug]);

  function selectRole(code: string) {
    const role = roles.find((item) => item.code === code);

    setForm((current) => ({
      ...current,
      role_code: code,
      permissions: [],
      job_title:
        current.job_title || role?.name || '',
    }));
  }

  function selectAccessAssignmentMode(
    mode: AccessAssignmentMode,
  ) {
    setForm((current) => {
      if (mode === 'predefined_role') {
        const availableRole =
          roles.find(
            (role) => role.code === current.role_code,
          ) ?? roles[0];

        return {
          ...current,
          access_assignment_mode: mode,
          role_code:
            availableRole?.code || 'cashier',
          permissions: [],
          job_title:
            current.job_title
            || availableRole?.name
            || '',
        };
      }

      return {
        ...current,
        access_assignment_mode: mode,
        role_code: 'custom-access',
        permissions:
          normalizePermissionList(
            current.permissions,
          ).length > 0
            ? normalizePermissionList(
                current.permissions,
              )
            : [...defaultStaffPermissions],
      };
    });
  }

  function togglePermission(permission: string) {
    setForm((current) => {
      const normalized = normalizePermissionKey(permission);
      const currentPermissions = new Set(normalizePermissionList(current.permissions));

      if (currentPermissions.has(normalized)) {
        currentPermissions.delete(normalized);
      } else {
        currentPermissions.add(normalized);
      }

      return {
        ...current,
        permissions: Array.from(currentPermissions).sort(),
      };
    });
  }

  function setResourcePermissions(resource: PermissionMatrixResource, selected: boolean) {
    const permissions = permissionActions
      .map((action) => resource.permissions[action])
      .filter((permission): permission is string => Boolean(permission));

    setForm((current) => {
      const next = new Set(normalizePermissionList(current.permissions));

      permissions.forEach((permission) => {
        if (selected) {
          next.add(permission);
        } else {
          next.delete(permission);
        }
      });

      return {
        ...current,
        permissions: Array.from(next).sort(),
      };
    });
  }

  function editUser(user: TenantSecurityUser) {
    const role = user.roles[0];
    const accessAssignmentMode:
      AccessAssignmentMode =
        role?.access_assignment_mode
        === 'granular_permissions'
          ? 'granular_permissions'
          : 'predefined_role';

    const cleanRoleCode =
      accessAssignmentMode
      === 'granular_permissions'
        ? 'custom-access'
        : (
          roles.find(
            (template) =>
              role?.code === template.code
              || role?.code?.endsWith(
                `-${template.code}`,
              ),
          )?.code
          || role?.code?.replace(
            `${tenantSlug}-`,
            '',
          )
          || 'cashier'
        );

    setEditingUserId(user.id);
    setIsEditorOpen(true);
    setTemporaryPassword('');
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      job_title:
        user.job_title ?? role?.name ?? '',
      access_assignment_mode:
        accessAssignmentMode,
      role_code: cleanRoleCode,
      permissions:
        accessAssignmentMode
        === 'granular_permissions'
          ? normalizePermissionList(
              role?.permissions?.length
                ? role.permissions
                : ['tenant.profile.view'],
            )
          : [],
      password: '',
      status: user.status || 'active',
      two_factor_required:
        user.security
          ?.two_factor_required ?? true,
    });
    setNotice(
      `Editing ${user.name}. Choose either a pre-defined role or individual granular permissions, then save.`,
    );
  }

  function requestDeleteUser(user: TenantSecurityUser) {
    setPendingDeleteUser(user);
    setError('');
    setNotice(`Confirm deactivation for ${user.name}. Audit history and previous transactions will be retained.`);
  }

  async function confirmDeleteUser() {
    if (!pendingDeleteUser) return;

    setIsDeletingUser(true);
    setError('');
    setNotice('');

    try {
      const response = await deleteTenantSecurityUser(token, tenantSlug, pendingDeleteUser.id);
      setNotice(response.message);
      setPendingDeleteUser(null);
      requestAppDataRefresh('security');
      await loadSecurityUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to deactivate user access.');
    } finally {
      setIsDeletingUser(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setFieldErrors({});
    setNotice('');
    setTemporaryPassword('');

    const payloadPermissions =
      form.access_assignment_mode
      === 'granular_permissions'
        ? normalizePermissionList(
            form.permissions,
          )
        : [];

    const normalizedName = form.name.trim();
    const normalizedEmail = form.email.trim().toLowerCase();
    const normalizedPhone = form.phone.trim();
    const normalizedJobTitle = form.job_title.trim();

    const validationErrors: Record<string, string> = {};

    if (!normalizedName) {
      validationErrors.name =
        'Enter the staff member’s full name.';
    }

    if (!normalizedEmail) {
      validationErrors.email =
        'Enter the email address used for sign-in.';
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedEmail,
      )
    ) {
      validationErrors.email =
        'Enter a valid professional email address.';
    }

    if (
      form.access_assignment_mode === 'predefined_role'
      && !form.role_code
    ) {
      validationErrors.role_code =
        'Select a role for this user.';
    }

    if (
      form.access_assignment_mode === 'granular_permissions'
      && payloadPermissions.length === 0
    ) {
      validationErrors.permissions =
        'Select at least one permission.';
    }

    if (
      !editingUserId
      && form.password
      && form.password.length < 8
    ) {
      validationErrors.password =
        'The temporary password must contain at least 8 characters.';
    }

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError(
        'Review the highlighted information before saving the user.',
      );
      return;
    }

    setIsSaving(true);

    try {
      if (editingUserId) {
        const response = await updateTenantSecurityUser(token, tenantSlug, editingUserId, {
          tenant_slug: tenantSlug,
          name: normalizedName,
          email: normalizedEmail,
          phone: normalizedPhone,
          job_title: normalizedJobTitle,
          access_assignment_mode:
            form.access_assignment_mode,
          role_code:
            form.access_assignment_mode
            === 'predefined_role'
              ? form.role_code
              : 'custom-access',
          permissions:
            form.access_assignment_mode
            === 'granular_permissions'
              ? payloadPermissions
              : undefined,
          status: form.status,
          two_factor_required:
            form.two_factor_required,        });

        setNotice(response.message);
      } else {
        const response = await createTenantSecurityUser(token, tenantSlug, {
          tenant_slug: tenantSlug,
          name: normalizedName,
          email: normalizedEmail,
          phone: normalizedPhone,
          job_title: normalizedJobTitle,
          access_assignment_mode:
            form.access_assignment_mode,
          role_code:
            form.access_assignment_mode
            === 'predefined_role'
              ? form.role_code
              : 'custom-access',
          permissions:
            form.access_assignment_mode
            === 'granular_permissions'
              ? payloadPermissions
              : undefined,
          password:
            form.password || undefined,
          status: form.status,
          two_factor_required:
            form.two_factor_required,        });

        setTemporaryPassword(response.temporary_password);
        setNotice(`${response.message} Share the temporary password securely and ask the user to change it after login.`);
      }

      setForm(emptyForm);
      setFieldErrors({});
      setEditingUserId(null);
      setIsEditorOpen(false);
      requestAppDataRefresh('security');
      await loadSecurityUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save user.');
    } finally {
      setIsSaving(false);
    }
  }

  const selectedRole =
    form.access_assignment_mode
    === 'predefined_role'
      ? roles.find(
          (role) =>
            role.code === form.role_code,
        )
      : undefined;
  const selectedPermissionSet = new Set(normalizePermissionList(form.permissions));

  return (
    <section className="tenant-user-security-panel tenant-user-security-console">
      <div className="section-heading tenant-user-console-heading">
        <div>
          <p className="eyebrow">International user access standard</p>
          <h2>User management and permission assignment</h2>
          <span>
            Review the staff directory below. Create or edit a user in a focused pop-up without crowding the landing page.
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingUserId(null);
            setForm(emptyForm);
            setTemporaryPassword('');
            setError('');
            setNotice('');
            setIsEditorOpen(true);
          }}
        >
          New user
        </button>
      </div>
      {notice && <div className="notice success">{notice}</div>}
      {error && <div className="notice error">{error}</div>}
      {temporaryPassword && (
        <div className="tenant-user-password-box">
          <strong>Temporary password</strong>
          <span>{temporaryPassword}</span>
          <small>Copy it now. This value is shown only after creation.</small>
        </div>
      )}

      {pendingDeleteUser && (
        <div className="tenant-user-delete-confirmation">
          <div>
            <strong>Deactivate user access</strong>
            <span>
              {pendingDeleteUser.name} will no longer access this tenant. Sales history, audit records, and previous assignments remain retained.
            </span>
          </div>
          <div>
            <button type="button" disabled={isDeletingUser} onClick={() => setPendingDeleteUser(null)}>
              Cancel
            </button>
            <button type="button" className="danger" disabled={isDeletingUser} onClick={() => void confirmDeleteUser()}>
              {isDeletingUser ? 'Deactivating access…' : 'Deactivate access'}
            </button>
          </div>
        </div>
      )}

      {isEditorOpen && (
        <div
          className="tenant-user-editor-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              setIsEditorOpen(false);
            }
          }}
        >
          <section
            className="tenant-user-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tenant-user-editor-title"
          >
            <header className="tenant-user-editor-modal__header">
              <div>
                <p className="eyebrow">{editingUserId ? 'Modify user access' : 'Create user access'}</p>
                <h3 id="tenant-user-editor-title">
                  {editingUserId ? `Edit ${form.name || 'user'}` : 'Create a new staff user'}
                </h3>
                <span>
                  Choose one access method: assign a pre-defined tenant role or configure an individual Granular Permission Matrix.
                </span>
              </div>
              <button
                type="button"
                aria-label="Close user editor"
                disabled={isSaving}
                onClick={() => setIsEditorOpen(false)}
              >
                ×
              </button>
            </header>

            <form
              className="tenant-user-form-grid tenant-user-form-grid--professional tenant-user-form-grid--modal"
              onSubmit={handleSubmit}
              noValidate
            >
              {/* AQUILA_PROFESSIONAL_USER_FORM_20260712 */}
              {(error || Object.keys(fieldErrors).length > 0) && (
                <div
                  className="tenant-user-form-error-summary"
                  role="alert"
                  aria-live="assertive"
                >
                  <strong>Unable to save the user yet</strong>
                  <span>
                    {error || 'Review the information below and try again.'}
                  </span>

                  {Object.keys(fieldErrors).length > 0 && (
                    <ul>
                      {Object.entries(fieldErrors).map(
                        ([field, message]) => (
                          <li key={field}>{message}</li>
                        ),
                      )}
                    </ul>
                  )}
                </div>
              )}
        <div className="tenant-user-form-section tenant-user-form-section--identity">
          <div className="tenant-user-form-section-heading">
            <strong>Staff identity</strong>
            <span>Basic login and staff details.</span>
          </div>

          <label>
            Full name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>

          <label>
            Email / login
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </label>

          <label>
            Phone
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>

          <label>
            Job title
            <input value={form.job_title} onChange={(event) => setForm({ ...form, job_title: event.target.value })} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          {!editingUserId && (
            <label>
              Temporary password
              <input
                type="text"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Leave blank to auto-generate"
              />
            </label>
          )}
        </div>

        {/* AQUILA_USER_ACCESS_ASSIGNMENT_MODES_20260712 */}
        <section className="tenant-user-access-mode-section">
          <div className="tenant-user-form-section-heading">
            <strong>Access assignment method</strong>
            <span>
              Select one method. Pre-defined roles are best for standard responsibilities; granular permissions are for exceptional users whose duties do not match an existing role.
            </span>
          </div>

          <div
            className="tenant-user-access-mode-options"
            role="radiogroup"
            aria-label="User access assignment method"
          >
            <label
              className={`tenant-user-access-mode-card ${
                form.access_assignment_mode
                === 'predefined_role'
                  ? 'is-selected'
                  : ''
              }`}
            >
              <input
                type="radio"
                name="access-assignment-mode"
                value="predefined_role"
                checked={
                  form.access_assignment_mode
                  === 'predefined_role'
                }
                onChange={() =>
                  selectAccessAssignmentMode(
                    'predefined_role',
                  )
                }
              />

              <span>
                <strong>Pre-defined role</strong>
                <small>
                  Assign an existing tenant role with its approved permission set. Permissions cannot be changed for this individual user.
                </small>
              </span>
            </label>

            <label
              className={`tenant-user-access-mode-card ${
                form.access_assignment_mode
                === 'granular_permissions'
                  ? 'is-selected'
                  : ''
              }`}
            >
              <input
                type="radio"
                name="access-assignment-mode"
                value="granular_permissions"
                checked={
                  form.access_assignment_mode
                  === 'granular_permissions'
                }
                onChange={() =>
                  selectAccessAssignmentMode(
                    'granular_permissions',
                  )
                }
              />

              <span>
                <strong>Granular Permission Matrix</strong>
                <small>
                  Create an individual tenant-scoped access profile when no existing role accurately fits the user.
                </small>
              </span>
            </label>
          </div>
        </section>

        {form.access_assignment_mode === 'predefined_role' && (
        <div className="tenant-user-form-section tenant-user-form-section--role">
          <div className="tenant-user-form-section-heading">
            <strong>Role template</strong>
            <span>Select the approved tenant role that best matches this user’s standard responsibilities.</span>
          </div>

          <label>
            Role
            <select value={form.role_code} onChange={(event) => selectRole(event.target.value)}>
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>

          {selectedRole && (
            <div className="tenant-user-selected-role-card">
              <strong>{selectedRole.name}</strong>
              <span>{selectedRole.description}</span>
              <small>
                {permissionCountLabel(normalizedRolePermissionMap.get(selectedRole.code)?.length ?? selectedRole.permissions.length)} available after normalization
              </small>
            </div>
          )}

          <div className="tenant-user-permission-summary">
            <strong>{selectedPermissionSet.size}</strong>
            <span>permissions included in the selected role</span>
          </div>
        </div>
        )}

        <section className="tenant-user-security-policy-card">
          <div>
            <strong>
              Two-factor authentication policy
            </strong>
            <span>
              Require this user to enrol and verify
              an authenticator before accessing
              protected staff workspaces.
            </span>
          </div>

          <label>
            <input
              type="checkbox"
              checked={
                form.two_factor_required
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  two_factor_required:
                    event.target.checked,
                }))
              }
            />

            <span>
              {form.two_factor_required
                ? '2FA required'
                : '2FA optional'}
            </span>
          </label>
        </section>

        {form.access_assignment_mode === 'granular_permissions' && (
        <div className="tenant-user-permissions tenant-user-permissions--matrix">
          <div className="tenant-user-form-section-heading">
            <strong>Granular permission matrix</strong>
            <span>Assign only what the user needs. Each resource is separated into View, Add, Edit, and Delete.</span>
          </div>

          <div className="tenant-permission-assignment-matrix">
            {permissionMatrix.map((group) => (
              <section key={group.title} className="tenant-permission-assignment-group">
                <div className="tenant-permission-assignment-group__header">
                  <div>
                    <h3>{group.title}</h3>
                    <p>{group.description}</p>
                  </div>
                </div>

                <div className="tenant-permission-table-shell">
                  <table className="tenant-permission-table">
                    <thead>
                      <tr>
                        <th scope="col">Resource</th>
                        {permissionActions.map((action) => (
                          <th key={action} scope="col">
                            {action}
                          </th>
                        ))}
                        <th scope="col">All</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.resources.map((resource) => {
                        const resourcePermissions = permissionActions
                          .map((action) => resource.permissions[action])
                          .filter((permission): permission is string => Boolean(permission));
                        const allSelected = resourcePermissions.length > 0 && resourcePermissions.every((permission) => selectedPermissionSet.has(permission));

                        return (
                          <tr key={`${group.title}-${resource.label}`}>
                            <td>
                              <strong>{resource.label}</strong>
                              <span>{resource.description}</span>
                            </td>
                            {permissionActions.map((action) => {
                              const permission = resource.permissions[action];

                              return (
                                <td key={action}>
                                  {permission ? (
                                    <label className="permission-checkbox" title={permission}>
                                      <input
                                        type="checkbox"
                                        checked={selectedPermissionSet.has(permission)}
                                        onChange={() => togglePermission(permission)}
                                      />
                                      <span>{selectedPermissionSet.has(permission) ? 'Allowed' : 'Blocked'}</span>
                                    </label>
                                  ) : (
                                    <span className="permission-not-applicable">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td>
                              {resourcePermissions.length > 0 ? (
                                <label className="permission-checkbox permission-checkbox--all">
                                  <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={(event) => setResourcePermissions(resource, event.target.checked)}
                                  />
                                  <span>All</span>
                                </label>
                              ) : (
                                <span className="permission-not-applicable">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </div>
        )}

        <div className="inventory-form-actions tenant-user-form-actions">
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving user…' : editingUserId ? 'Update user access' : 'Create user'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingUserId(null);
              setForm(emptyForm);
              setTemporaryPassword('');
              setIsEditorOpen(false);
            }}
          >
            Cancel
          </button>
        </div>
            </form>
          </section>
        </div>
      )}

      <section className="tenant-user-directory-panel">
        <div className="tenant-user-directory-panel__header">
          <div>
            <h3>Staff directory</h3>
            <p>Review staff identity, role, status, and access actions.</p>
          </div>
        </div>

        <div className="tenant-user-directory-table-shell">
          <table className="tenant-user-directory-table">
            <thead>
              <tr>
                <th scope="col">Staff member</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Security</th>
                <th scope="col">Permissions</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6}>No tenant users found yet.</td>
                </tr>
              ) : (
                users.map((user) => {
                  const role = user.roles[0];
                  const normalizedUserPermissions = normalizePermissionList(role?.permissions ?? []);

                  return (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                        {user.phone && <small>{user.phone}</small>}
                      </td>
                      <td>
                        <strong>{role?.name ?? 'No role assigned'}</strong>
                        <span>{user.job_title ?? 'No job title'}</span>
                      </td>
                      <td>
                        <span className={statusClassName(user.status ?? undefined)}>{user.status ?? 'active'}</span>
                      </td>
                      <td>
                        <div className="tenant-user-security-state">
                          <strong>
                            {user.security
                              ?.two_factor_enabled
                              ? '2FA active'
                              : user.security
                                  ?.two_factor_required
                                ? '2FA required'
                                : '2FA optional'}
                          </strong>

                          <span>
                            {user.security
                              ?.active_sessions_count ?? 0}
                            {' '}active session(s)
                          </span>

                          <small>
                            {user.security
                              ?.last_login_at
                              ? `Last login ${new Date(
                                  user.security
                                    .last_login_at,
                                ).toLocaleString()}`
                              : 'Never logged in'}
                          </small>
                        </div>
                      </td>

                      <td>
                        {permissionCountLabel(
                          normalizedUserPermissions
                            .length,
                        )}
                      </td>
                      <td>
                        <span className="table-action-row tenant-user-list-actions">
                          <button type="button" onClick={() => editUser(user)}>
                            {user.status === 'inactive' ? 'Review / reactivate' : 'Edit access'}
                          </button>
                          {user.status !== 'inactive' && (
                            <button type="button" className="danger" onClick={() => requestDeleteUser(user)}>
                              Deactivate
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

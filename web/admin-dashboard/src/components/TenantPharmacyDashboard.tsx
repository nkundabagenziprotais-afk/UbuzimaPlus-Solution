import { useEffect, useMemo, useState } from 'react';
import {
  AccessProfile,
  PharmaCustomer,
  PharmaInventoryBatchesResponse,
  PharmaInventorySummaryResponse,
  PharmaProduct,
  PharmaProductsResponse,
  PharmaPrescription,
  PharmaSale,
  getPharmaCustomers,
  getPharmaInventoryBatches,
  getPharmaInventorySummary,
  getPharmaPrescriptions,
  getPharmaProducts,
  getPharmaSales,
} from '../lib/api';

type TenantDashboardSection =
  | 'pos'
  | 'inventory'
  | 'suppliers'
  | 'finance'
  | 'reports'
  | 'tenant-setup'
  | 'security'
  | 'corporate-email'
  | 'pharmacist-chat'
  | 'notifications';

type Props = {
  token: string;
  profile: AccessProfile;
  onOpenSection: (section: TenantDashboardSection) => void;
};

type DashboardState = {
  summary: PharmaInventorySummaryResponse | null;
  products: PharmaProduct[];
  batches: PharmaInventoryBatchesResponse['batches'];
  nearExpiryBatches: PharmaInventoryBatchesResponse['batches'];
  sales: PharmaSale[];
  customers: PharmaCustomer[];
  prescriptions: PharmaPrescription[];
};

const emptyDashboardState: DashboardState = {
  summary: null,
  products: [],
  batches: [],
  nearExpiryBatches: [],
  sales: [],
  customers: [],
  prescriptions: [],
};

function tenantSlugFromProfile(profile: AccessProfile): string {
  return (
    profile.tenant_assignments?.[0]?.tenant?.slug ||
    (profile.scope.is_tenant ? 'vitapharma' : '')
  );
}

function tenantNameFromProfile(profile: AccessProfile): string {
  return profile.tenant_assignments?.[0]?.tenant?.name ?? 'VitaPharma';
}

function money(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: 'RWF',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function number(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-RW', {
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

function shortDate(value: string | null | undefined): string {
  if (!value) return 'No date';

  return new Intl.DateTimeFormat('en-RW', {
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

function isToday(value: string | null | undefined): boolean {
  if (!value) return false;

  const input = new Date(value);
  const today = new Date();

  return input.toDateString() === today.toDateString();
}

export function TenantPharmacyDashboard({ token, profile, onOpenSection }: Props) {
  const [state, setState] = useState<DashboardState>(emptyDashboardState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const tenantSlug = useMemo(() => tenantSlugFromProfile(profile), [profile]);
  const tenantName = useMemo(() => tenantNameFromProfile(profile), [profile]);
  const permissions = new Set(
    profile.permissions.map(
      (permission) => permission.toLowerCase(),
    ),
  );

  const hasPermission = (...codes: string[]) =>
    codes.some(
      (code) => permissions.has(code.toLowerCase()),
    );

  const roleTokens = (profile.roles ?? [])
    .flatMap((role) => [role.code, role.name])
    .map((role) =>
      String(role ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_'),
    );

  const hasRole = (...codes: string[]) =>
    roleTokens.some((role) =>
      codes.some(
        (code) =>
          role === code
          || role.endsWith(`_${code}`)
          || role.includes(`_${code}_`),
      ),
    );

  const isCashier = hasRole('cashier');
  const isInventoryOfficer =
    hasRole('inventory_officer');
  const isFinanceOfficer =
    hasRole('finance_officer');
  const isProcurementOfficer =
    hasRole('procurement_officer');

  const canUseSales = hasPermission(
    'pharmaco.pos.use',
    'pharmaco.sales.view',
    'pharmaco.sales.create',
    'pharmaco.sales.manage',
    'pos.sales.view',
  );

  const canLoadManagementSales =
    canUseSales
    && !isCashier;

  const canUseInventory = hasPermission(
    'pharmaco.inventory.view',
    'pharmaco.inventory.manage',
    'inventory.dashboard.view',
  );

  const canUseSuppliers =
    hasPermission(
      'pharmaco.procurement.view',
      'procurement.suppliers.view',
    )
    && hasPermission(
      'branches.view',
      'tenant.branches.view',
    )
    && hasPermission(
      'pharmaco.product_master.view',
      'inventory.products.view',
    )
    && hasPermission(
      'pharmaco.inventory.view',
      'inventory.dashboard.view',
    );

  const canUseReports = hasPermission(
    'pharmaco.reports.view',
    'pharmaco.sales.manage',
    'pharmaco.inventory.manage',
    'pharmaco.procurement.view',
    'pharmaco.procurement.payment.view',
    'reports.sales.view',
    'reports.inventory.view',
    'reports.procurement.view',
    'reports.finance.view',
  );

  const canManageUsers = hasPermission(
    'roles.manage',
    'tenant.roles.manage',
    'users.manage',
    'users.staff.view',
    'security.users.view',
  );

  const canViewFinancialSummary =
    isFinanceOfficer
    || hasPermission(
      'pharmaco.finance.view',
      'finance.dashboard.view',
      'finance.receivables.view',
      'finance.payables.view',
    );

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (!tenantSlug) {
        setError('No tenant assignment is available for this account.');
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const [
          summaryResponse,
          productsResponse,
          batchesResponse,
          nearExpiryResponse,
          salesResponse,
          customersResponse,
          prescriptionsResponse,
        ] = await Promise.all([
          canUseInventory ? getPharmaInventorySummary(token, tenantSlug) : Promise.resolve(null),
          canUseInventory ? getPharmaProducts(token, tenantSlug) : Promise.resolve(null),
          canUseInventory ? getPharmaInventoryBatches(token, tenantSlug) : Promise.resolve(null),
          canUseInventory ? getPharmaInventoryBatches(token, tenantSlug, 180) : Promise.resolve(null),
          canLoadManagementSales ? getPharmaSales(token, tenantSlug) : Promise.resolve(null),
          canLoadManagementSales ? getPharmaCustomers(token, tenantSlug) : Promise.resolve(null),
          canLoadManagementSales ? getPharmaPrescriptions(token, tenantSlug) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setState({
          summary: summaryResponse as PharmaInventorySummaryResponse | null,
          products: (productsResponse as PharmaProductsResponse | null)?.products ?? [],
          batches: (batchesResponse as PharmaInventoryBatchesResponse | null)?.batches ?? [],
          nearExpiryBatches: (nearExpiryResponse as PharmaInventoryBatchesResponse | null)?.batches ?? [],
          sales: salesResponse?.sales ?? [],
          customers: customersResponse?.customers ?? [],
          prescriptions: prescriptionsResponse?.prescriptions ?? [],
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load tenant dashboard.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [canLoadManagementSales, canUseInventory, tenantSlug, token]);

  const operations = useMemo(() => {
    const todaySales = state.sales.filter((sale) => isToday(sale.sold_at ?? sale.created_at));
    const draftSales = state.sales.filter((sale) => sale.status === 'draft');
    const openBalance = state.sales.reduce((sum, sale) => sum + Number(sale.balance_amount ?? 0), 0);
    const todayValue = todaySales.reduce((sum, sale) => sum + Number(sale.total_amount ?? 0), 0);
    const paidToday = todaySales.reduce((sum, sale) => sum + Number(sale.paid_amount ?? 0), 0);
    const expiringSoon = state.nearExpiryBatches.filter((batch) => batch.available_quantity > 0);

    return {
      todaySales,
      draftSales,
      openBalance,
      todayValue,
      paidToday,
      expiringSoon,
      lowStockProducts: state.summary?.low_stock_products ?? [],
    };
  }, [state]);

  const productShelf = useMemo(() => {
    return [...state.products]
      .sort((left, right) => {
        const leftLow = left.stock_summary?.is_below_reorder_level ? 0 : 1;
        const rightLow = right.stock_summary?.is_below_reorder_level ? 0 : 1;

        return leftLow - rightLow || left.name.localeCompare(right.name);
      })
      .slice(0, 8);
  }, [state.products]);

  function productPrice(product: PharmaProduct): string {
    const batch = state.batches
      .filter((entry) => entry.product.id === product.id && entry.selling_price !== null)
      .sort((left, right) => {
        const leftExpiry = left.expiry_date ? new Date(left.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
        const rightExpiry = right.expiry_date ? new Date(right.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;

        return leftExpiry - rightExpiry;
      })[0];

    return batch?.selling_price === null || batch?.selling_price === undefined
      ? 'Price pending'
      : money(batch.selling_price);
  }

  const quickActions = [
    {
      label: 'Start POS sale',
      detail: 'Counter cart, prescription check, payment',
      section: 'pos' as const,
      enabled: canUseSales,
    },
    {
      label: 'Review stock',
      detail: 'Products, batches, expiry, reorder',
      section: 'inventory' as const,
      enabled: canUseInventory,
    },
    {
      label: 'Receive supplier stock',
      detail: 'Purchase order and receiving workflow',
      section: 'suppliers' as const,
      enabled: canUseSuppliers,
    },
    {
      label: 'Open daily reports',
      detail: 'Sales, inventory, finance, close view',
      section: 'reports' as const,
      enabled: canUseReports,
    },
    {
      label: 'Manage users',
      detail: 'Roles, scope, 2FA, tenant setup',
      section: 'security' as const,
      enabled: canManageUsers,
    },
    {
      label: 'Customer messages',
      detail: 'Pharmacist chat and notices',
      section: 'pharmacist-chat' as const,
      enabled: profile.permissions.includes('pharmaco.chat.manage'),
    },
  ];

  if (isCashier) {
    return (
      <section
        className={
          'tenant-command-dashboard '
          + 'tenant-command-dashboard--cashier'
        }
        aria-busy={isLoading}
      >
        <div className="tenant-command-hero">
          <div>
            <p className="eyebrow">
              Cashier workspace
            </p>

            <h2>
              {tenantName} point-of-sale operations
            </h2>

            <p className="muted">
              Open your till, serve customers, record payments,
              issue receipts, review your current session and
              complete cashier close.
            </p>
          </div>

          <div className="tenant-command-status">
            <span>
              Permission-limited workspace
            </span>
            <strong>Cashier</strong>
            <small>{profile.user.email}</small>
          </div>
        </div>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <div className="tenant-kpi-strip">
          <article>
            <span>Assigned workspace</span>
            <strong>POS</strong>
            <small>
              Sales, payments, receipts and cashier close
            </small>
          </article>

          <article>
            <span>Data boundary</span>
            <strong>Protected</strong>
            <small>
              Administrative and executive figures are hidden
            </small>
          </article>

          <article>
            <span>Session support</span>
            <strong>Admin assisted</strong>
            <small>
              Authorized managers can resolve stuck sessions
            </small>
          </article>
        </div>

        <div className="tenant-action-grid">
          <button
            type="button"
            disabled={!canUseSales}
            onClick={() => onOpenSection('pos')}
          >
            <strong>Open POS workspace</strong>
            <span>
              Start or continue your cashier session
            </span>
          </button>

          <button
            type="button"
            disabled={
              !hasPermission('notifications.view')
            }
            onClick={() =>
              onOpenSection('notifications')
            }
          >
            <strong>
              View operational notices
            </strong>
            <span>
              Branch instructions and service announcements
            </span>
          </button>
        </div>
      </section>
    );
  }

  const dashboardEyebrow = isInventoryOfficer
    ? 'Inventory officer dashboard'
    : isFinanceOfficer
      ? 'Finance officer dashboard'
      : isProcurementOfficer
        ? 'Procurement officer dashboard'
        : 'Tenant management dashboard';

  const dashboardTitle = isInventoryOfficer
    ? `${tenantName} inventory control`
    : isFinanceOfficer
      ? `${tenantName} finance control`
      : isProcurementOfficer
        ? `${tenantName} procurement control`
        : `${tenantName} daily pharmacy control`;

  return (
    <section className="tenant-command-dashboard" aria-busy={isLoading}>
      <div className="tenant-command-hero">
        <div>
          <p className="eyebrow">{dashboardEyebrow}</p>
          <h2>{dashboardTitle}</h2>
          <p className="muted">
            Start from what matters today: counter sales, stock risk, customer service, supplier work,
            and the next management review.
          </p>
        </div>
        <div className="tenant-command-status">
          <span>{isLoading ? 'Refreshing' : 'Live workspace'}</span>
          <strong>{profile.scope.type}</strong>
          <small>{profile.user.email}</small>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="tenant-kpi-strip">
        <article>
          <span>Today sales</span>
          <strong>{money(operations.todayValue)}</strong>
          <small>{operations.todaySales.length} transactions</small>
        </article>
        <article>
          <span>Paid today</span>
          <strong>{money(operations.paidToday)}</strong>
          <small>{operations.draftSales.length} draft sales need review</small>
        </article>
        <article>
          <span>Low stock</span>
          <strong>{operations.lowStockProducts.length}</strong>
          <small>Products at or below reorder level</small>
        </article>
        <article>
          <span>Expiry watch</span>
          <strong>{operations.expiringSoon.length}</strong>
          <small>Active batches within 180 days</small>
        </article>
        {canViewFinancialSummary && (
          <article>
            <span>Open balance</span>
            <strong>
              {money(operations.openBalance)}
            </strong>
            <small>
              Unpaid or partially paid sales
            </small>
          </article>
        )}
      </div>

      <div className="tenant-action-grid">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={!action.enabled}
            onClick={() => onOpenSection(action.section)}
          >
            <strong>{action.label}</strong>
            <span>{action.detail}</span>
          </button>
        ))}
      </div>

      <div className="tenant-dashboard-grid">
        <article className="tenant-focus-panel">
          <div className="section-heading">
            <div>
              <h3>Counter and dispensing queue</h3>
              <span>Open the POS when there is a draft, balance, or walk-in sale.</span>
            </div>
            <button type="button" onClick={() => onOpenSection('pos')} disabled={!canUseSales}>
              Open POS
            </button>
          </div>

          {state.sales.length === 0 ? (
            <p className="muted">No sales loaded for this tenant yet.</p>
          ) : (
            <div className="tenant-activity-list">
              {state.sales.slice(0, 5).map((sale) => (
                <div key={sale.id}>
                  <strong>{sale.sale_number}</strong>
                  <span>{sale.customer?.full_name ?? 'Walk-in customer'} · {sale.status.replaceAll('_', ' ')}</span>
                  <small>{money(sale.total_amount)} · balance {money(sale.balance_amount)}</small>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="tenant-focus-panel">
          <div className="section-heading">
            <div>
              <h3>Stock that needs attention</h3>
              <span>Low quantity, expiry, and batch signals appear automatically.</span>
            </div>
            <button type="button" onClick={() => onOpenSection('inventory')} disabled={!canUseInventory}>
              Inventory
            </button>
          </div>

          <div className="tenant-alert-list">
            {operations.lowStockProducts.slice(0, 3).map((product) => (
              <div key={`low-${product.id}`}>
                <strong>{product.name}</strong>
                <span>Available {number(product.stock_summary?.available_quantity)} {product.unit}</span>
                <small>Reorder level {number(product.reorder_level)}</small>
              </div>
            ))}
            {operations.expiringSoon.slice(0, 3).map((batch) => (
              <div key={`expiry-${batch.id}`}>
                <strong>{batch.product.name}</strong>
                <span>Batch {batch.batch_number} · expires {shortDate(batch.expiry_date)}</span>
                <small>{number(batch.available_quantity)} units available</small>
              </div>
            ))}
            {operations.lowStockProducts.length === 0 && operations.expiringSoon.length === 0 && (
              <p className="muted">No stock exceptions are visible in the current data.</p>
            )}
          </div>
        </article>
      </div>

      <article className="tenant-product-shelf">
        <div className="section-heading">
          <div>
            <h3>Product shelf</h3>
            <span>Presented for retail pharmacy work: price, stock, category, and RX control.</span>
          </div>
          <button type="button" onClick={() => onOpenSection('inventory')} disabled={!canUseInventory}>
            Manage products
          </button>
        </div>

        <div className="tenant-product-grid">
          {productShelf.map((product) => (
            <article key={product.id}>
              <div>
                <span className={product.requires_prescription ? 'rx-chip' : 'otc-chip'}>
                  {product.requires_prescription ? 'RX' : 'OTC'}
                </span>
                {product.stock_summary?.is_below_reorder_level && <span className="risk-chip">Low stock</span>}
              </div>
              <strong>{product.name}</strong>
              <small>{product.category?.name ?? 'Uncategorised'} · {product.sku}</small>
              <p>{product.generic_name || product.brand_name || product.dosage_form || 'Retail pharmacy item'}</p>
              <footer>
                <span>{productPrice(product)}</span>
                <span>{number(product.stock_summary?.available_quantity)} {product.unit}</span>
              </footer>
            </article>
          ))}

          {productShelf.length === 0 && (
            <p className="muted">Products will appear here when the inventory module is available to this user.</p>
          )}
        </div>
      </article>

      <div className="tenant-dashboard-grid">
        <article className="tenant-focus-panel">
          <h3>Customer care</h3>
          <p className="muted">
            {state.customers.length} customers and {state.prescriptions.length} prescriptions are available
            to the POS workflow.
          </p>
          <button type="button" onClick={() => onOpenSection('pharmacist-chat')}>
            Open pharmacist chat
          </button>
        </article>

        <article className="tenant-focus-panel">
          <h3>Management work</h3>
          <p className="muted">
            Configure branches, staff security, notifications, email, and tenant details from focused pages
            instead of a crowded landing screen.
          </p>
          <div className="tenant-management-actions">
            <button type="button" onClick={() => onOpenSection('tenant-setup')}>Tenant setup</button>
            <button type="button" onClick={() => onOpenSection('corporate-email')}>Email</button>
            <button type="button" onClick={() => onOpenSection('notifications')}>Notifications</button>
          </div>
        </article>
      </div>
    </section>
  );
}

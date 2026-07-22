import { useState, type CSSProperties, type ReactNode } from 'react';

export type UbuzimaMobileAppScreen =
  | 'business'
  | 'inventory'
  | 'sales'
  | 'procurement'
  | 'general-stock'
  | 'more';

export type UbuzimaMobileTone = 'olive' | 'red' | 'teal' | 'gold' | 'blue';

export type UbuzimaMobileAppAction = {
  key: string;
  label: string;
  detail: string;
  icon: string;
  tone?: UbuzimaMobileTone;
  onPress: () => void;
};

export type UbuzimaMobileAppMetric = {
  key: string;
  label: string;
  value: string;
  helper: string;
  tone?: UbuzimaMobileTone;
};

export type UbuzimaMobileDailyPosSummary = {
  dateLabel: string;
  salesTotal: string;
  collectionsTotal: string;
  transactionCount: string;
  status: string;
};

export type UbuzimaMobileDailyPosTransaction = {
  key: string;
  saleNumber: string;
  amount: string;
  method: string;
  status: string;
  operator: string;
  timeLabel: string;
  businessDate: string;
  receiptNumber?: string;
};

export type UbuzimaMobileAppMenuItem = {
  key: string;
  label: string;
  description: string;
  icon: string;
  status?: string;
  onPress: () => void;
};

export type UbuzimaMobileAppMenuGroup = {
  key: string;
  label: string;
  items: UbuzimaMobileAppMenuItem[];
};

export type UbuzimaMobileAppNavItem = {
  key: string;
  label: string;
  icon: string;
  screen: UbuzimaMobileAppScreen;
};

export type UbuzimaMobileAppWorkbench = {
  eyebrow: string;
  title: string;
  summary: string;
  status: string;
  actions: UbuzimaMobileAppAction[];
};

type UbuzimaMobileAppProps = {
  activeScreen: UbuzimaMobileAppScreen;
  brandLogoSrc: string;
  currentWorkspace: string;
  installAvailable: boolean;
  isInstalling: boolean;
  isIosDevice: boolean;
  isOnline: boolean;
  isStandalone: boolean;
  isSyncing: boolean;
  dailyPosSummary: UbuzimaMobileDailyPosSummary;
  dailyPosTransactions: UbuzimaMobileDailyPosTransaction[];
  liveMetricBars?: number[];
  menuGroups: UbuzimaMobileAppMenuGroup[];
  metrics: UbuzimaMobileAppMetric[];
  navigationItems: UbuzimaMobileAppNavItem[];
  primaryActions: UbuzimaMobileAppAction[];
  procurementActions: UbuzimaMobileAppAction[];
  generalStockActions: UbuzimaMobileAppAction[];
  profileAvatarUrl: string;
  profileInitials: string;
  profileInstitution: string;
  profileName: string;
  salesActions: UbuzimaMobileAppAction[];
  stockActions: UbuzimaMobileAppAction[];
  syncLabel: string;
  unreadMailCount: number;
  workbench: UbuzimaMobileAppWorkbench;
  onChangePassword: () => void;
  onCorporateEmail: () => void;
  onInstall: () => void;
  onOpenBusinessOverview: () => void;
  onRefresh: () => void;
  onScreenChange: (screen: UbuzimaMobileAppScreen) => void;
  onSignOut: () => void;
};

function toneClass(tone: UbuzimaMobileTone = 'olive') {
  return `ubuzima-native-tone-${tone}`;
}

function IconSvg({ children }: { children: ReactNode }) {
  return (
    <span className="ubuzima-native-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        {children}
      </svg>
    </span>
  );
}

function AppIcon({ name }: { name: string }) {
  switch (name.toUpperCase()) {
    case 'HM':
      return (
        <IconSvg>
          <path d="M3.5 11.4 12 4.5l8.5 6.9" />
          <path d="M6.5 10.7v8.8h11v-8.8" />
          <path d="M10 19.5v-5h4v5" />
        </IconSvg>
      );
    case 'POS':
      return (
        <IconSvg>
          <path d="M6.5 4.5h11v15h-11z" />
          <path d="M9 8h6" />
          <path d="M9 11h6" />
          <path d="M9 15h2.2" />
          <path d="M13.6 15H15" />
        </IconSvg>
      );
    case 'ST':
    case 'BT':
      return (
        <IconSvg>
          <path d="M4.5 8.2 12 4.5l7.5 3.7-7.5 3.7z" />
          <path d="M4.5 8.2v7.6l7.5 3.7 7.5-3.7V8.2" />
          <path d="M12 11.9v7.6" />
        </IconSvg>
      );
    case 'PO':
    case 'OP':
      return (
        <IconSvg>
          <path d="M8 5.5h8" />
          <path d="M7 8.5h10" />
          <path d="M6.5 4.5h11v15h-11z" />
          <path d="M9 13h6" />
          <path d="M9 16h4" />
        </IconSvg>
      );
    case 'GS':
      return (
        <IconSvg>
          <path d="M5 6h14v4H5z" />
          <path d="M6.5 10v8h11v-8" />
          <path d="M9 14h6" />
        </IconSvg>
      );
    case 'MN':
      return (
        <IconSvg>
          <circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="17" cy="7" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="7" cy="17" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="17" cy="17" r="1.4" fill="currentColor" stroke="none" />
        </IconSvg>
      );
    case 'LOW':
    case 'EXP':
      return (
        <IconSvg>
          <path d="M12 5.5 20 19H4z" />
          <path d="M12 10v3.8" />
          <path d="M12 16.7v.1" />
        </IconSvg>
      );
    case 'PM':
    case 'RX':
      return (
        <IconSvg>
          <path d="M8.1 14.2 14.2 8a3 3 0 1 1 4.3 4.3l-6.2 6.1a3 3 0 0 1-4.2-4.2z" />
          <path d="m11.2 11.1 3.6 3.6" />
        </IconSvg>
      );
    case 'RC':
      return (
        <IconSvg>
          <path d="M5 5.5h14v13H5z" />
          <path d="M8 11.5h2.4l1.6 2.3 1.6-2.3H16" />
          <path d="M12 5.5v6" />
        </IconSvg>
      );
    case 'OV':
      return (
        <IconSvg>
          <path d="M5 5.5h6v6H5z" />
          <path d="M13 5.5h6v4.2h-6z" />
          <path d="M13 12.5h6v6H13z" />
          <path d="M5 14.3h6v4.2H5z" />
        </IconSvg>
      );
    case 'IM':
      return (
        <IconSvg>
          <path d="M5.5 7.5h13" />
          <path d="M5.5 12h13" />
          <path d="M5.5 16.5h8" />
          <path d="M4 7.5h.1" />
          <path d="M4 12h.1" />
          <path d="M4 16.5h.1" />
        </IconSvg>
      );
    case 'US':
      return (
        <IconSvg>
          <path d="M7 7h10v10H7z" />
          <path d="M9 15 15 9" />
          <path d="M11.4 9H15v3.6" />
        </IconSvg>
      );
    case 'REG':
      return (
        <IconSvg>
          <path d="M6.5 5h11v14l-2-1.1-2 1.1-2-1.1-2 1.1-3-1.6z" />
          <path d="M9 9h6" />
          <path d="M9 12h6" />
          <path d="M9 15h3" />
        </IconSvg>
      );
    case 'PAY':
      return (
        <IconSvg>
          <path d="M4.5 7h15v10h-15z" />
          <path d="M4.5 10h15" />
          <path d="M8 14.5h3" />
        </IconSvg>
      );
    case 'FN':
      return (
        <IconSvg>
          <path d="M4.5 19h15" />
          <path d="M6 17V9" />
          <path d="M11 17V6" />
          <path d="M16 17v-4" />
        </IconSvg>
      );
    case 'SEARCH':
    case 'SC':
      return (
        <IconSvg>
          <circle cx="10.5" cy="10.5" r="5.4" />
          <path d="m15 15 4 4" />
        </IconSvg>
      );
    case 'MAIL':
      return (
        <IconSvg>
          <path d="M4.5 7h15v10h-15z" />
          <path d="m5.5 8 6.5 5 6.5-5" />
        </IconSvg>
      );
    case 'LOCK':
      return (
        <IconSvg>
          <path d="M7 10h10v9H7z" />
          <path d="M9 10V7.8a3 3 0 0 1 6 0V10" />
        </IconSvg>
      );
    case 'SYNC':
      return (
        <IconSvg>
          <path d="M18.5 8.2A6.7 6.7 0 0 0 6.8 6.5L5 8.3" />
          <path d="M5 5.2v3.1h3.1" />
          <path d="M5.5 15.8a6.7 6.7 0 0 0 11.7 1.7l1.8-1.8" />
          <path d="M19 18.8v-3.1h-3.1" />
        </IconSvg>
      );
    default:
      return (
        <span className="ubuzima-native-icon ubuzima-native-icon--text" aria-hidden="true">
          <abbr>{name.slice(0, 3)}</abbr>
        </span>
      );
  }
}

function BusinessMetricCard({
  metric,
  onPress,
}: {
  metric: UbuzimaMobileAppMetric;
  onPress?: () => void;
}) {
  const content = (
    <>
      <AppIcon name={metricIconName(metric.key)} />
      <span>{metric.label}</span>
      <strong className={valueFitClass(metric.value)}>{metric.value}</strong>
      <small>{metric.helper}</small>
    </>
  );

  if (onPress) {
    return (
      <button
        key={metric.key}
        type="button"
        className={`ubuzima-native-balance-card ${toneClass(metric.tone)}`}
        onClick={onPress}
      >
        {content}
      </button>
    );
  }

  return (
    <article
      key={metric.key}
      className={`ubuzima-native-balance-card ${toneClass(metric.tone)}`}
    >
      {content}
    </article>
  );
}

function metricIconName(key: string) {
  if (key.includes('revenue') || key.includes('sales')) return 'FN';
  if (key.includes('stock') || key.includes('inventory')) return 'ST';
  if (key.includes('alert')) return 'LOW';
  return 'OV';
}

function paymentIconName(method: string) {
  if (method === 'Cash') return 'FN';
  if (method === 'Momo' || method === 'Credit') return 'PAY';
  if (method === 'Insurance') return 'RX';
  return 'PAY';
}

function valueFitClass(value: string | undefined) {
  const compactLength = (value ?? '').replace(/\s+/g, '').length;

  if (compactLength >= 18) return 'ubuzima-native-value ubuzima-native-value--xs';
  if (compactLength >= 14) return 'ubuzima-native-value ubuzima-native-value--sm';
  if (compactLength >= 10) return 'ubuzima-native-value ubuzima-native-value--md';

  return 'ubuzima-native-value';
}

function AppSection({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ubuzima-native-section">
      <div className="ubuzima-native-section__heading">
        <div className="ubuzima-native-section__title">
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {action ? <div className="ubuzima-native-section__action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ActionGrid({
  actions,
  compact = false,
}: {
  actions: UbuzimaMobileAppAction[];
  compact?: boolean;
}) {
  if (actions.length === 0) {
    return (
      <div className="ubuzima-native-empty" role="status">
        <AppIcon name="LOCK" />
        <strong>No actions available</strong>
      </div>
    );
  }

  return (
    <div className={compact ? 'ubuzima-native-action-grid compact' : 'ubuzima-native-action-grid'}>
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          className={`ubuzima-native-action ${toneClass(action.tone)}`}
          onClick={action.onPress}
        >
          <AppIcon name={action.icon} />
          <strong>{action.label}</strong>
        </button>
      ))}
    </div>
  );
}

export function UbuzimaMobileApp({
  activeScreen,
  brandLogoSrc,
  currentWorkspace,
  installAvailable,
  isInstalling,
  isIosDevice,
  isOnline,
  isStandalone,
  isSyncing,
  dailyPosSummary,
  dailyPosTransactions,
  liveMetricBars = [],
  menuGroups,
  metrics,
  navigationItems,
  primaryActions,
  procurementActions,
  generalStockActions,
  profileAvatarUrl,
  profileInitials,
  profileInstitution,
  profileName,
  salesActions,
  stockActions,
  syncLabel,
  unreadMailCount,
  workbench,
  onChangePassword,
  onCorporateEmail,
  onInstall,
  onOpenBusinessOverview,
  onRefresh,
  onScreenChange,
  onSignOut,
}: UbuzimaMobileAppProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [isMetricSheetOpen, setIsMetricSheetOpen] = useState(false);
  const [isIosInstallSheetOpen, setIsIosInstallSheetOpen] = useState(false);
  const activeNavScreen =
    navigationItems.find((item) => item.screen === activeScreen)?.screen ?? '';
  const heroAction = primaryActions[0];
  const actionByKey = (actions: UbuzimaMobileAppAction[], key: string) =>
    actions.find((action) => action.key === key);
  const primaryMetric = metrics.find((metric) => metric.key === 'gross-sales') ?? metrics[0];
  const grossRevenueMetric = metrics.find((metric) => metric.key === 'gross-revenue');
  const heroMetrics = [primaryMetric, grossRevenueMetric].filter(
    (metric): metric is UbuzimaMobileAppMetric => Boolean(metric),
  );
  const businessPositionMetrics = metrics.filter(
    (metric) => !heroMetrics.some((heroMetric) => heroMetric.key === metric.key),
  );
  const posCounterAction = actionByKey(salesActions, 'pos-counter') ?? heroAction;
  const dailyPosTransactionCount = Number(dailyPosSummary.transactionCount.replace(/[^0-9.-]/g, ''));
  const hasDailyPosSummaryActivity = Number.isFinite(dailyPosTransactionCount) && dailyPosTransactionCount > 0;
  const fallbackTrendBars = [42, 58, 52, 71, 63, 84, 76];
  const trendBars = (liveMetricBars.length > 0 ? liveMetricBars : fallbackTrendBars)
    .slice(0, 7)
    .map((height) => Math.max(8, Math.min(100, Math.round(height))));
  const chartStatusLabel = liveMetricBars.length > 0 ? 'Live' : isOnline ? 'Ready' : 'Saved';
  const canInstallApp = installAvailable && !isStandalone;
  const canShowIosInstall = isIosDevice && !isStandalone;
  const installStatusLabel = isStandalone
    ? 'Installed app'
    : canInstallApp
      ? 'Install available'
      : canShowIosInstall
        ? 'iPhone ready'
        : 'Browser access';
  const installStatusDetail = isStandalone
    ? 'Standalone mode is active'
    : canInstallApp
      ? 'Add Ubuzima+ to this phone'
      : canShowIosInstall
        ? 'Use Add to Home Screen from Safari'
        : 'Use the phone browser install option';
  const paymentChannels = ['Cash', 'Momo', 'Insurance', 'Credit'].map((method) => ({
    method,
    action:
      method === 'Credit'
        ? actionByKey(salesActions, 'finance-flow') ?? actionByKey(salesActions, 'payment-receipt') ?? posCounterAction
        : method === 'Cash'
          ? posCounterAction ?? actionByKey(salesActions, 'payment-receipt')
          : actionByKey(salesActions, 'payment-receipt') ?? posCounterAction,
  }));
  const inventoryReviewChips = [
    { label: 'Low stock', action: actionByKey(stockActions, 'stock-low') },
    { label: 'Near expiry', action: actionByKey(stockActions, 'stock-expiry') },
    { label: 'Batch list', action: actionByKey(stockActions, 'stock-batches') },
    { label: 'Shelf view', action: actionByKey(stockActions, 'stock-batches') ?? actionByKey(stockActions, 'stock-master') },
    { label: 'Locations', action: actionByKey(stockActions, 'stock-master') },
    { label: 'Receiving', action: actionByKey(procurementActions, 'receiving') },
  ].filter((chip): chip is { label: string; action: UbuzimaMobileAppAction } => Boolean(chip.action));

  function toggleGroup(groupKey: string, fallbackOpen: boolean) {
    setOpenGroups((current) => ({
      ...current,
      [groupKey]: !(current[groupKey] ?? fallbackOpen),
    }));
  }

  function changeScreen(screen: UbuzimaMobileAppScreen) {
    setIsMetricSheetOpen(false);
    onScreenChange(screen);
  }

  function renderBusinessScreen() {
    const openSalesRegister = actionByKey(salesActions, 'sales-performance')?.onPress ?? posCounterAction?.onPress;

    return (
      <>
        <section className="ubuzima-native-business-hero" aria-label="Business Overview">
          <div className="ubuzima-native-business-hero__top">
            <div>
              <span>Admin Business Overview</span>
              <strong>{profileInstitution}</strong>
            </div>
            <button type="button" onClick={onOpenBusinessOverview}>
              View
            </button>
          </div>

          <div className="ubuzima-native-business-hero__comparison" aria-label="Gross sales and gross revenue">
            {heroMetrics.map((metric) => (
              <button
                key={metric.key}
                type="button"
                className="ubuzima-native-business-hero__balance"
                onClick={onOpenBusinessOverview}
              >
                <span>{metric.label}</span>
                <strong className={valueFitClass(metric.value)}>
                  {metric.value}
                </strong>
                <small>{metric.helper}</small>
              </button>
            ))}
          </div>

          <div className="ubuzima-native-business-hero__analytics" aria-hidden="true">
            <div>
              <span>Live pulse</span>
              <strong>{chartStatusLabel}</strong>
            </div>
            <div className="ubuzima-native-mini-chart">
              {trendBars.map((height, index) => (
                <i
                  key={`${height}-${index}`}
                  style={{ '--bar-height': `${height}%` } as CSSProperties}
                />
              ))}
            </div>
          </div>

          <div className="ubuzima-native-business-hero__chips" aria-label="Business overview status">
            <span>{isOnline ? 'Synced' : 'Offline'}</span>
            <span>{isStandalone ? 'Installed' : 'App mode'}</span>
          </div>
        </section>

        {!isOnline && (
          <div className="ubuzima-native-offline" role="status">
            <strong>Offline mode</strong>
            <span>Saved pages remain available while the connection returns.</span>
          </div>
        )}

        {installAvailable && !isStandalone && (
          <button
            type="button"
            className="ubuzima-native-install-card"
            onClick={onInstall}
            disabled={isInstalling}
          >
            <AppIcon name="HM" />
            <span>
              <strong>{isInstalling ? 'Opening install' : 'Add to phone'}</strong>
              <small>{installStatusDetail}</small>
            </span>
          </button>
        )}

        <AppSection eyebrow={workbench.eyebrow} title={workbench.title}>
          <ActionGrid actions={workbench.actions} compact />
        </AppSection>

        <AppSection
          eyebrow="Performance"
          title="Business position"
          action={
            businessPositionMetrics.length > 2 ? (
              <button
                type="button"
                onClick={() => setIsMetricSheetOpen(true)}
                aria-haspopup="dialog"
              >
                More
              </button>
            ) : undefined
          }
        >
          <div className="ubuzima-native-balance-grid" aria-label="Business position metrics">
            {businessPositionMetrics.map((metric) => (
              <BusinessMetricCard
                key={metric.key}
                metric={metric}
                onPress={onOpenBusinessOverview}
              />
            ))}
          </div>
        </AppSection>

        <AppSection
          eyebrow="Daily POS"
          title="Live transactions"
          action={
            openSalesRegister ? (
              <button type="button" onClick={openSalesRegister}>
                Open
              </button>
            ) : undefined
          }
        >
          <button
            type="button"
            className="ubuzima-native-pos-daily-summary"
            onClick={openSalesRegister}
            disabled={!openSalesRegister}
          >
            <span>
              <small>{dailyPosSummary.dateLabel}</small>
              <strong>{dailyPosSummary.salesTotal}</strong>
            </span>
            <span>
              <small>Collections</small>
              <strong>{dailyPosSummary.collectionsTotal}</strong>
            </span>
            <span>
              <small>Transactions</small>
              <strong>{dailyPosSummary.transactionCount}</strong>
            </span>
            <em>{dailyPosSummary.status}</em>
          </button>

          {dailyPosTransactions.length === 0 ? (
            <div className="ubuzima-native-pos-daily-empty" role="status">
              <AppIcon name="REG" />
              <span>
                <strong>
                  {hasDailyPosSummaryActivity
                    ? 'Transaction details are syncing'
                    : 'No POS transactions yet today'}
                </strong>
                <small>
                  {hasDailyPosSummaryActivity
                    ? 'The daily totals are live. Tap Open for the full POS register.'
                    : 'Tap Sync after sales are recorded on the website.'}
                </small>
              </span>
            </div>
          ) : (
            <div className="ubuzima-native-pos-daily-list">
              {dailyPosTransactions.map((transaction) => (
                <button
                  key={transaction.key}
                  type="button"
                  onClick={openSalesRegister}
                  disabled={!openSalesRegister}
                >
                  <span className="ubuzima-native-pos-daily-list__time">
                    {transaction.timeLabel}
                  </span>
                  <span className="ubuzima-native-pos-daily-list__body">
                    <strong>{transaction.saleNumber}</strong>
                    <small>
                      {transaction.operator}
                      {' / '}
                      {transaction.method}
                    </small>
                  </span>
                  <span className="ubuzima-native-pos-daily-list__amount">
                    <strong>{transaction.amount}</strong>
                    <small>{transaction.status}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </AppSection>

        <AppSection eyebrow="Services" title="Quick access">
          <ActionGrid actions={primaryActions} />
        </AppSection>
      </>
    );
  }

  function renderSalesScreen() {
    return (
      <>
        <section className="ubuzima-native-pos-terminal" aria-label="POS and Sales">
          <div className="ubuzima-native-pos-terminal__status">
            <span>POS and Sales</span>
            <strong className={valueFitClass(primaryMetric?.value)}>
              {primaryMetric?.value ?? 'RWF 0'}
            </strong>
          </div>
          <button
            type="button"
            className="ubuzima-native-search-row"
            onClick={posCounterAction?.onPress}
          >
            <AppIcon name="SEARCH" />
            <strong>Search medicine or scan code</strong>
          </button>
          <button
            type="button"
            className="ubuzima-native-cart-preview"
            onClick={posCounterAction?.onPress}
          >
            <div>
              <span>Cart</span>
              <strong>0 items</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>RWF 0</strong>
            </div>
          </button>
        </section>

        <AppSection eyebrow="Sales" title="Counter services">
          <ActionGrid actions={salesActions} />
        </AppSection>

        <AppSection eyebrow="Payment" title="Channels">
          <div className="ubuzima-native-payment-grid">
            {paymentChannels.map(({ method, action }) => (
              <button key={method} type="button" onClick={action?.onPress}>
                <AppIcon name={paymentIconName(method)} />
                <span>{method}</span>
              </button>
            ))}
          </div>
        </AppSection>
      </>
    );
  }

  function renderInventoryScreen() {
    return (
      <>
        <section className="ubuzima-native-stock-hero" aria-label="Stock control">
          <div>
            <span>Inventory</span>
            <strong>Stock position</strong>
          </div>
          <button type="button" onClick={stockActions[0]?.onPress}>
            Open
          </button>
        </section>

        <AppSection eyebrow="Inventory" title="Stock services">
          <ActionGrid actions={stockActions} />
        </AppSection>

        <AppSection eyebrow="Filters" title="Review">
          <div className="ubuzima-native-chip-grid">
            {inventoryReviewChips.map((chip) => (
              <button key={chip.label} type="button" onClick={chip.action.onPress}>
                {chip.label}
              </button>
            ))}
          </div>
        </AppSection>
      </>
    );
  }

  function renderProcurementScreen() {
    return (
      <>
        <section className="ubuzima-native-sales-card" aria-label="Procurement">
          <div>
            <span>Procurement</span>
            <h1>Orders</h1>
          </div>
          <button
            type="button"
            className="ubuzima-native-sales-card__figures"
            onClick={procurementActions[0]?.onPress}
          >
            <span>Desk</span>
            <AppIcon name="PO" />
            <strong>Orders</strong>
          </button>
        </section>

        <AppSection eyebrow="Procurement" title="Supplier services">
          <ActionGrid actions={procurementActions} />
        </AppSection>
      </>
    );
  }

  function renderGeneralStockScreen() {
    return (
      <>
        <section className="ubuzima-native-stock-hero" aria-label="General Stock">
          <div>
            <span>General Stock</span>
            <strong>Operational items</strong>
          </div>
          <button type="button" onClick={generalStockActions[0]?.onPress}>
            Open
          </button>
        </section>

        <AppSection eyebrow="General Stock" title="Store services">
          <ActionGrid actions={generalStockActions} />
        </AppSection>
      </>
    );
  }

  function renderMoreScreen() {
    return (
      <>
        <section className="ubuzima-native-profile-card" aria-label="Profile">
          <div className="ubuzima-native-avatar">
            {profileAvatarUrl ? (
              <img src={profileAvatarUrl} alt={profileName} />
            ) : (
              <span>{profileInitials}</span>
            )}
          </div>
          <div>
            <span>Signed in</span>
            <strong>{profileName}</strong>
            <small>{profileInstitution}</small>
          </div>
        </section>

        <div className="ubuzima-native-account-actions">
          <button type="button" onClick={onCorporateEmail}>
            <AppIcon name="MAIL" />
            <span>Corporate Email</span>
          </button>
          <button type="button" onClick={onChangePassword}>
            <AppIcon name="LOCK" />
            <span>Change Password</span>
          </button>
        </div>

        <AppSection eyebrow="Device" title="App readiness">
          <div className="ubuzima-native-device-list">
            {canInstallApp ? (
              <button
                type="button"
                className="ubuzima-native-device-item is-action"
                onClick={onInstall}
                disabled={isInstalling}
              >
                <AppIcon name="HM" />
                <span>
                  <strong>{isInstalling ? 'Opening install' : installStatusLabel}</strong>
                  <small>{installStatusDetail}</small>
                </span>
              </button>
            ) : (
              <article className="ubuzima-native-device-item">
                <AppIcon name="HM" />
                <span>
                  <strong>{installStatusLabel}</strong>
                  <small>{installStatusDetail}</small>
                </span>
              </article>
            )}

            {canShowIosInstall && (
              <button
                type="button"
                className="ubuzima-native-device-item is-action is-ios"
                onClick={() => setIsIosInstallSheetOpen(true)}
              >
                <AppIcon name="HM" />
                <span>
                  <strong>iPhone installation</strong>
                  <small>Add Ubuzima+ to the Home Screen</small>
                </span>
              </button>
            )}

            <article className="ubuzima-native-device-item">
              <AppIcon name="MAIL" />
              <span>
                <strong>SMS reconciliation</strong>
                <small>Native Android consent module required</small>
              </span>
            </article>

            <article className="ubuzima-native-device-item">
              <AppIcon name="SYNC" />
              <span>
                <strong>Offline shell</strong>
                <small>{isOnline ? 'Ready for network changes' : 'Saved shell is active'}</small>
              </span>
            </article>
          </div>
        </AppSection>

        <AppSection eyebrow="Modules" title="Full app menu">
          <div className="ubuzima-native-menu-list">
            {menuGroups.map((group, index) => {
              const defaultOpen = index < 2;
              const isOpen = openGroups[group.key] ?? defaultOpen;

              return (
                <article key={group.key} className="ubuzima-native-menu-group">
                  <button
                    type="button"
                    className="ubuzima-native-menu-group__title"
                    aria-expanded={isOpen}
                    onClick={() => toggleGroup(group.key, defaultOpen)}
                  >
                    <strong>{group.label}</strong>
                    <span>{isOpen ? 'Close' : 'Open'}</span>
                  </button>

                  {isOpen && (
                    <div className="ubuzima-native-menu-group__items">
                      {group.items.map((item) => (
                        <button key={item.key} type="button" onClick={item.onPress}>
                          <AppIcon name={item.icon} />
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </AppSection>

        <button type="button" className="ubuzima-native-signout" onClick={onSignOut}>
          Sign out
        </button>
      </>
    );
  }

  function renderScreen() {
    if (activeScreen === 'sales') return renderSalesScreen();
    if (activeScreen === 'inventory') return renderInventoryScreen();
    if (activeScreen === 'procurement') return renderProcurementScreen();
    if (activeScreen === 'general-stock') return renderGeneralStockScreen();
    if (activeScreen === 'more') return renderMoreScreen();

    return renderBusinessScreen();
  }

  return (
    <section className="ubuzima-native-app" aria-label="Ubuzima+ mobile app">
      <header className="ubuzima-native-topbar">
        <button
          type="button"
          className="ubuzima-native-brand"
          onClick={() => changeScreen('business')}
        >
          <img src={brandLogoSrc} alt="" />
          <span>
            <strong>Ubuzima+</strong>
            <small>{profileInstitution}</small>
          </span>
        </button>

        <div className="ubuzima-native-topbar__actions">
          <button
            type="button"
            className={isSyncing ? 'is-syncing' : undefined}
            onClick={onRefresh}
            disabled={isSyncing}
            aria-busy={isSyncing}
          >
            {syncLabel}
          </button>
          <button
            type="button"
            className="ubuzima-native-avatar-button"
            onClick={() => changeScreen('more')}
            aria-label="Open profile and menu"
          >
            {profileAvatarUrl ? (
              <img src={profileAvatarUrl} alt={profileName} />
            ) : (
              <span>{profileInitials}</span>
            )}
          </button>
        </div>
      </header>

      <main key={activeScreen} className="ubuzima-native-content">{renderScreen()}</main>

      {isMetricSheetOpen && activeScreen === 'business' && (
        <div className="ubuzima-native-sheet" role="presentation">
          <button
            type="button"
            className="ubuzima-native-sheet__backdrop"
            onClick={() => setIsMetricSheetOpen(false)}
            aria-label="Close business position"
          />
          <section
            className="ubuzima-native-sheet__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ubuzima-native-business-position-title"
          >
            <header>
              <div>
                <span>Performance</span>
                <h2 id="ubuzima-native-business-position-title">Business position</h2>
              </div>
              <button type="button" onClick={() => setIsMetricSheetOpen(false)}>
                Close
              </button>
            </header>
            <div className="ubuzima-native-sheet__grid">
              {businessPositionMetrics.map((metric) => (
                <BusinessMetricCard
                  key={metric.key}
                  metric={metric}
                  onPress={() => {
                    setIsMetricSheetOpen(false);
                    onOpenBusinessOverview();
                  }}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {isIosInstallSheetOpen && (
        <div className="ubuzima-native-sheet" role="presentation">
          <button
            type="button"
            className="ubuzima-native-sheet__backdrop"
            onClick={() => setIsIosInstallSheetOpen(false)}
            aria-label="Close iPhone installation guide"
          />
          <section
            className="ubuzima-native-sheet__panel ubuzima-native-ios-install-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ubuzima-native-ios-install-title"
          >
            <header>
              <div>
                <span>Device app readiness</span>
                <h2 id="ubuzima-native-ios-install-title">Install on iPhone</h2>
              </div>
              <button type="button" onClick={() => setIsIosInstallSheetOpen(false)}>
                Close
              </button>
            </header>
            <div className="ubuzima-native-ios-steps">
              <article>
                <strong>1</strong>
                <span>Open this admin page in Safari.</span>
              </article>
              <article>
                <strong>2</strong>
                <span>Tap the Share button.</span>
              </article>
              <article>
                <strong>3</strong>
                <span>Choose Add to Home Screen and confirm.</span>
              </article>
            </div>
          </section>
        </div>
      )}

      <nav className="ubuzima-native-tabbar" aria-label="Mobile app navigation">
        {navigationItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={activeNavScreen === item.screen ? 'active' : ''}
            onClick={() => changeScreen(item.screen)}
          >
            <AppIcon name={item.icon} />
            <small>{item.label}</small>
          </button>
        ))}
      </nav>
    </section>
  );
}

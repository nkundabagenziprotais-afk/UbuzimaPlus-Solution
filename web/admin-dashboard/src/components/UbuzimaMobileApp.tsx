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
  isOnline: boolean;
  isStandalone: boolean;
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
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="ubuzima-native-section">
      <div className="ubuzima-native-section__heading">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
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
        <span>Access depends on your staff role.</span>
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
          <small>{action.detail}</small>
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
  isOnline,
  isStandalone,
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
  const activeNavScreen =
    navigationItems.find((item) => item.screen === activeScreen)?.screen ?? '';
  const heroAction = primaryActions[0];
  const primaryMetric = metrics[0];
  const secondaryMetrics = metrics.slice(1, 4);
  const paymentActions = salesActions.slice(0, 3);
  const trendBars = [42, 58, 52, 71, 63, 84, 76];
  const canInstallApp = installAvailable && !isStandalone;
  const installStatusLabel = isStandalone
    ? 'Installed app'
    : canInstallApp
      ? 'Install available'
      : 'Browser access';
  const installStatusDetail = isStandalone
    ? 'Standalone mode is active'
    : canInstallApp
      ? 'Add Ubuzima+ to this phone'
      : 'Use the phone browser install option';

  function toggleGroup(groupKey: string, fallbackOpen: boolean) {
    setOpenGroups((current) => ({
      ...current,
      [groupKey]: !(current[groupKey] ?? fallbackOpen),
    }));
  }

  function renderBusinessScreen() {
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

          <div className="ubuzima-native-business-hero__balance">
            <span>{primaryMetric?.label ?? 'Gross sales'}</span>
            <strong className={valueFitClass(primaryMetric?.value)}>
              {primaryMetric?.value ?? 'RWF 0'}
            </strong>
            <small>{primaryMetric?.helper ?? 'Today business position'}</small>
          </div>

          <div className="ubuzima-native-business-hero__analytics" aria-hidden="true">
            <div>
              <span>7-day pulse</span>
              <strong>{isOnline ? 'Stable' : 'Saved'}</strong>
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
              <small>Standalone access from the phone home screen</small>
            </span>
          </button>
        )}

        <AppSection eyebrow={workbench.eyebrow} title={workbench.title}>
          <div className="ubuzima-native-workbench-card">
            <div>
              <span>{workbench.status}</span>
              <p>{workbench.summary}</p>
            </div>
          </div>
          <ActionGrid actions={workbench.actions} compact />
        </AppSection>

        <AppSection eyebrow="Performance" title="Business position">
          <div className="ubuzima-native-balance-grid">
            {secondaryMetrics.map((metric) => (
              <article
                key={metric.key}
                className={`ubuzima-native-balance-card ${toneClass(metric.tone)}`}
              >
                <AppIcon name={metricIconName(metric.key)} />
                <span>{metric.label}</span>
                <strong className={valueFitClass(metric.value)}>{metric.value}</strong>
                <small>{metric.helper}</small>
              </article>
            ))}
          </div>
        </AppSection>

        <AppSection eyebrow="Services" title="Quick access">
          <ActionGrid actions={primaryActions} />
        </AppSection>

        <AppSection eyebrow="Focus" title="Today">
          <div className="ubuzima-native-task-list">
            <button type="button" onClick={() => onScreenChange('sales')}>
              <AppIcon name="POS" />
              <strong>POS and Sales</strong>
              <small>Counter, receipts, payments, and daily close</small>
            </button>
            <button type="button" onClick={() => onScreenChange('inventory')}>
              <AppIcon name="ST" />
              <strong>Inventory control</strong>
              <small>Low stock, expiry, batches, shelf, and product master</small>
            </button>
            <button type="button" onClick={() => onScreenChange('procurement')}>
              <AppIcon name="PO" />
              <strong>Procurement</strong>
              <small>Suppliers, purchase orders, receiving, and follow-up</small>
            </button>
          </div>
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
            onClick={heroAction?.onPress}
          >
            <AppIcon name="SEARCH" />
            <strong>Search medicine or scan code</strong>
          </button>
          <div className="ubuzima-native-cart-preview">
            <div>
              <span>Cart</span>
              <strong>0 items</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>RWF 0</strong>
            </div>
          </div>
        </section>

        <AppSection eyebrow="Sales" title="Counter services">
          <ActionGrid actions={salesActions} />
        </AppSection>

        <AppSection eyebrow="Payment" title="Channels">
          <div className="ubuzima-native-payment-grid">
            {['Cash', 'Momo', 'Insurance', 'Credit'].map((method) => (
              <button key={method} type="button" onClick={paymentActions[0]?.onPress}>
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
            <small>Product master, shelf, batches, and expiry controls</small>
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
            {['Low stock', 'Near expiry', 'Batch list', 'Shelf view', 'Locations', 'Receiving'].map((label) => (
              <button key={label} type="button" onClick={stockActions[0]?.onPress}>
                {label}
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
            <p>Suppliers, purchase orders, receiving</p>
          </div>
          <div className="ubuzima-native-sales-card__figures">
            <span>Desk</span>
            <AppIcon name="PO" />
            <strong>Orders</strong>
            <small>{currentWorkspace}</small>
          </div>
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
            <small>Categories, master items, stock, receiving, and usage</small>
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
          onClick={() => onScreenChange('business')}
        >
          <img src={brandLogoSrc} alt="" />
          <span>
            <strong>Ubuzima+</strong>
            <small>{profileInstitution}</small>
          </span>
        </button>

        <div className="ubuzima-native-topbar__actions">
          {installAvailable && !isStandalone ? (
            <button type="button" onClick={onInstall} disabled={isInstalling}>
              {isInstalling ? 'Opening' : 'Get app'}
            </button>
          ) : (
            <button type="button" onClick={onRefresh}>
              Sync
            </button>
          )}
          <button
            type="button"
            className="ubuzima-native-avatar-button"
            onClick={() => onScreenChange('more')}
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

      <nav className="ubuzima-native-tabbar" aria-label="Mobile app navigation">
        {navigationItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={activeNavScreen === item.screen ? 'active' : ''}
            onClick={() => onScreenChange(item.screen)}
          >
            <AppIcon name={item.icon} />
            <small>{item.label}</small>
          </button>
        ))}
      </nav>
    </section>
  );
}

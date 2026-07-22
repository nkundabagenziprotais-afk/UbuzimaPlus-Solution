
function installUbuzimaNativeMobileDrawerV2(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const mobileQuery = window.matchMedia('(max-width: 1024px)');

  function nodeText(node: Element | null): string {
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function findSidebar(): HTMLElement | null {
    const selectors = [
      '[data-ubuzima-detected-sidebar="true"]',
      '[data-admin-sidebar]',
      '[data-sidebar]',
      '.admin-sidebar',
      '.dashboard-sidebar',
      '.dashboard-shell-sidebar',
      '.side-nav',
      '.left-menu',
      '.module-sidebar',
      '.app-sidebar',
      '.admin-navigation',
      '.dashboard-navigation',
      'aside',
    ];

    for (const selector of selectors) {
      const candidate = document.querySelector<HTMLElement>(selector);

      if (!candidate) {
        continue;
      }

      const text = nodeText(candidate);

      if (/Dashboard|Home|Business|Inventory|Sales|POS|Procurement|Finance|Reports|Settings|Users|Admin|Pharma/i.test(text)) {
        candidate.dataset.ubuzimaDetectedSidebar = 'true';
        candidate.classList.add('ubuzima-native-drawer-panel');
        return candidate;
      }
    }

    return null;
  }

  function ensureOverlay(): HTMLButtonElement {
    let overlay = document.querySelector<HTMLButtonElement>('.ubuzima-native-drawer-overlay');

    if (!overlay) {
      overlay = document.createElement('button');
      overlay.type = 'button';
      overlay.className = 'ubuzima-native-drawer-overlay';
      overlay.setAttribute('aria-label', 'Close menu');
      document.body.appendChild(overlay);
      overlay.addEventListener('click', closeDrawer);
    }

    return overlay;
  }

  function openDrawer(): void {
    if (!mobileQuery.matches) {
      return;
    }

    const sidebar = findSidebar();

    if (!sidebar) {
      return;
    }

    ensureOverlay();
    root.classList.add('ubuzima-native-drawer-open');
    sidebar.classList.add('ubuzima-native-drawer-open');
  }

  function closeDrawer(): void {
    root.classList.remove('ubuzima-native-drawer-open');

    document.querySelectorAll<HTMLElement>(
      '.ubuzima-native-drawer-panel, .ubuzima-mobile-sidebar, [data-ubuzima-detected-sidebar="true"]',
    ).forEach((sidebar) => {
      sidebar.classList.remove('ubuzima-native-drawer-open');
      sidebar.classList.remove('ubuzima-mobile-sidebar-open');
    });
  }

  function toggleDrawer(): void {
    if (root.classList.contains('ubuzima-native-drawer-open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  function bindControls(): void {
    document.querySelectorAll<HTMLButtonElement>(
      '.ubuzima-mobile-appbar-menu, .ubuzima-mobile-bottom-nav [data-mobile-module="more"], .ubuzima-mobile-menu-button',
    ).forEach((button) => {
      if (button.dataset.ubuzimaDrawerBound === 'true') {
        return;
      }

      button.dataset.ubuzimaDrawerBound = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleDrawer();
      });
    });

    const sidebar = findSidebar();

    if (sidebar && sidebar.dataset.ubuzimaDrawerSelectionBound !== 'true') {
      sidebar.dataset.ubuzimaDrawerSelectionBound = 'true';

      sidebar.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;

        if (!target) {
          return;
        }

        if (target.closest('a,button,[role="button"],[data-module],[data-view]')) {
          window.setTimeout(closeDrawer, 120);
        }
      });
    }
  }

  function sync(): void {
    root.classList.toggle('ubuzima-native-mobile-v2', mobileQuery.matches);

    if (!mobileQuery.matches) {
      closeDrawer();
      return;
    }

    findSidebar();
    ensureOverlay();
    bindControls();
  }

  sync();
  window.setTimeout(sync, 300);
  window.setTimeout(sync, 1000);
  window.setInterval(sync, 1800);
  window.addEventListener('resize', sync, { passive: true });
  window.addEventListener('orientationchange', sync, { passive: true });

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
}

// The authenticated React app now owns the phone app shell and drawer.



function installUbuzimaNativeMobileInterfaceV1(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const mobileQuery = window.matchMedia('(max-width: 1024px)');

  const primaryModules = [
    { key: 'dashboard', label: 'Home', match: /Dashboard|Home/i, icon: '⌂' },
    { key: 'business', label: 'Business', match: /Business Overview|Business/i, icon: '▣' },
    { key: 'inventory', label: 'Inventory', match: /Inventory/i, icon: '▤' },
    { key: 'sales', label: 'Sales', match: /Sales|POS/i, icon: '◉' },
  ];

  function textOf(node: Element | null): string {
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function findNavigationTargets(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('a,button,[role="button"],[data-module],[data-view]'))
      .filter((node) => {
        const text = textOf(node);
        return /Dashboard|Home|Business|Inventory|Sales|POS|Procurement|Finance|Reports|Settings|Users|Admin/i.test(text);
      });
  }

  function clickModule(match: RegExp): void {
    const target = findNavigationTargets().find((node) => match.test(textOf(node)));

    if (target) {
      target.click();
      window.setTimeout(() => {
        root.classList.remove('ubuzima-mobile-menu-open');
        document.querySelector<HTMLElement>('.ubuzima-mobile-sidebar')?.classList.remove('ubuzima-mobile-sidebar-open');
      }, 140);
    }
  }

  function ensureAppBar(): void {
    if (document.querySelector('.ubuzima-mobile-appbar')) {
      return;
    }

    const bar = document.createElement('div');
    bar.className = 'ubuzima-mobile-appbar';
    bar.innerHTML = `
      <button class="ubuzima-mobile-appbar-menu" type="button" aria-label="Open menu">
        <span></span><span></span><span></span>
      </button>
      <div class="ubuzima-mobile-appbar-brand">
        <img src="/admin/assets/ubuzima-logo.png" alt="" />
        <div>
          <strong>Ubuzima+</strong>
          <small>Admin app</small>
        </div>
      </div>
      <button class="ubuzima-mobile-appbar-action" type="button" aria-label="Refresh">↻</button>
    `;
    document.body.appendChild(bar);

    bar.querySelector<HTMLButtonElement>('.ubuzima-mobile-appbar-menu')?.addEventListener('click', () => {
      const existingMenuButton = document.querySelector<HTMLButtonElement>('.ubuzima-mobile-menu-button');
      if (existingMenuButton) {
        existingMenuButton.click();
      } else {
        root.classList.toggle('ubuzima-mobile-menu-open');
      }
    });

    bar.querySelector<HTMLButtonElement>('.ubuzima-mobile-appbar-action')?.addEventListener('click', () => {
      const refreshButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => /refresh|reload|apply/i.test(textOf(button)));

      if (refreshButton) {
        refreshButton.click();
      } else {
        window.dispatchEvent(new Event('ubuzima:refresh'));
      }
    });
  }

  function ensureBottomNav(): void {
    if (document.querySelector('.ubuzima-mobile-bottom-nav')) {
      return;
    }

    const nav = document.createElement('nav');
    nav.className = 'ubuzima-mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Primary mobile navigation');

    primaryModules.forEach((module) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.mobileModule = module.key;
      button.innerHTML = `<span>${module.icon}</span><small>${module.label}</small>`;
      button.addEventListener('click', () => clickModule(module.match));
      nav.appendChild(button);
    });

    const more = document.createElement('button');
    more.type = 'button';
    more.dataset.mobileModule = 'more';
    more.innerHTML = '<span>☰</span><small>More</small>';
    more.addEventListener('click', () => {
      const menuButton = document.querySelector<HTMLButtonElement>('.ubuzima-mobile-menu-button');
      if (menuButton) {
        menuButton.click();
      } else {
        root.classList.toggle('ubuzima-mobile-menu-open');
      }
    });

    nav.appendChild(more);
    document.body.appendChild(nav);
  }

  function ensureQuickModuleStrip(): void {
    const existing = document.querySelector('.ubuzima-mobile-quick-strip');

    if (existing || !mobileQuery.matches) {
      return;
    }

    const firstMain =
      document.querySelector<HTMLElement>('.dashboard-scroll-panel') ||
      document.querySelector<HTMLElement>('.module-content') ||
      document.querySelector<HTMLElement>('main');

    if (!firstMain) {
      return;
    }

    const strip = document.createElement('section');
    strip.className = 'ubuzima-mobile-quick-strip';
    strip.innerHTML = `
      <button type="button" data-quick-module="business"><span>▣</span><strong>Business</strong><small>Overview</small></button>
      <button type="button" data-quick-module="inventory"><span>▤</span><strong>Inventory</strong><small>Stock</small></button>
      <button type="button" data-quick-module="sales"><span>◉</span><strong>Sales</strong><small>POS</small></button>
      <button type="button" data-quick-module="reports"><span>▥</span><strong>Reports</strong><small>Analytics</small></button>
    `;

    strip.querySelector<HTMLButtonElement>('[data-quick-module="business"]')?.addEventListener('click', () => clickModule(/Business Overview|Business/i));
    strip.querySelector<HTMLButtonElement>('[data-quick-module="inventory"]')?.addEventListener('click', () => clickModule(/Inventory/i));
    strip.querySelector<HTMLButtonElement>('[data-quick-module="sales"]')?.addEventListener('click', () => clickModule(/Sales|POS/i));
    strip.querySelector<HTMLButtonElement>('[data-quick-module="reports"]')?.addEventListener('click', () => clickModule(/Reports|Analytics/i));

    firstMain.prepend(strip);
  }

  function tagMobileCards(): void {
    const cardSelectors = [
      'article',
      '.dashboard-card',
      '.business-overview-card',
      '.inventory-analytics-request-card',
      '.review-card',
      '.kpi-card',
      '.overview-kpi-card',
      '.business-overview-kpi-card',
    ];

    document.querySelectorAll<HTMLElement>(cardSelectors.join(',')).forEach((card) => {
      card.classList.add('ubuzima-mobile-app-card');
    });

    document.querySelectorAll<HTMLElement>(
      '.inventory-analytics-request-kpis, .business-overview-kpi-grid, .overview-kpi-grid, .kpi-grid',
    ).forEach((grid) => {
      grid.classList.add('ubuzima-mobile-kpi-carousel');
    });
  }

  function sync(): void {
    const isMobile = mobileQuery.matches;
    root.classList.toggle('ubuzima-native-mobile-interface', isMobile);

    if (!isMobile) {
      return;
    }

    ensureAppBar();
    ensureBottomNav();
    ensureQuickModuleStrip();
    tagMobileCards();
  }

  sync();
  window.setTimeout(sync, 500);
  window.setTimeout(sync, 1500);
  window.setInterval(sync, 2500);
  window.addEventListener('resize', sync, { passive: true });
  window.addEventListener('orientationchange', sync, { passive: true });

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
}

// The legacy injected mobile interface remains inactive to avoid duplicate controls.



type UbuzimaBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: string; platform: string }>;
};

function installUbuzimaMobileAppShellNavigation(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const mobileQuery = window.matchMedia('(max-width: 1024px)');
  const compactQuery = window.matchMedia('(max-width: 780px)');

  let sidebar: HTMLElement | null = null;
  let menuButton: HTMLButtonElement | null = null;
  let overlay: HTMLButtonElement | null = null;

  function findSidebar(): HTMLElement | null {
    const selectors = [
      '[data-admin-sidebar]',
      '[data-sidebar]',
      '.admin-sidebar',
      '.dashboard-sidebar',
      '.dashboard-shell-sidebar',
      '.sidebar',
      '.side-nav',
      '.left-menu',
      '.module-sidebar',
      '.app-sidebar',
      '.admin-navigation',
      '.dashboard-navigation',
      'aside',
    ];

    for (const selector of selectors) {
      const candidate = document.querySelector<HTMLElement>(selector);

      if (!candidate) {
        continue;
      }

      const text = candidate.textContent ?? '';
      const hasNavigationContent =
        /Dashboard|Inventory|Business|Sales|Procurement|Finance|Reports|Settings|Users|Admin|Pharma/i.test(text);

      if (hasNavigationContent) {
        candidate.dataset.ubuzimaDetectedSidebar = 'true';
        return candidate;
      }
    }

    return null;
  }

  function ensureControls(): void {
    if (!menuButton) {
      menuButton = document.createElement('button');
      menuButton.type = 'button';
      menuButton.className = 'ubuzima-mobile-menu-button';
      menuButton.setAttribute('aria-label', 'Open menu');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.innerHTML = '<span></span><span></span><span></span>';
      document.body.appendChild(menuButton);

      menuButton.addEventListener('click', () => {
        if (root.classList.contains('ubuzima-mobile-menu-open')) {
          closeMenu();
        } else {
          openMenu();
        }
      });
    }

    if (!overlay) {
      overlay = document.createElement('button');
      overlay.type = 'button';
      overlay.className = 'ubuzima-mobile-menu-overlay';
      overlay.setAttribute('aria-label', 'Close menu');
      document.body.appendChild(overlay);
      overlay.addEventListener('click', closeMenu);
    }
  }

  function openMenu(): void {
    if (!mobileQuery.matches || !sidebar) {
      return;
    }

    root.classList.add('ubuzima-mobile-menu-open');
    sidebar.classList.add('ubuzima-mobile-sidebar-open');
    menuButton?.setAttribute('aria-expanded', 'true');
  }

  function closeMenu(): void {
    root.classList.remove('ubuzima-mobile-menu-open');
    sidebar?.classList.remove('ubuzima-mobile-sidebar-open');
    menuButton?.setAttribute('aria-expanded', 'false');
  }

  function bindSidebarCloseOnSelection(): void {
    if (!sidebar || sidebar.dataset.ubuzimaMobileNavBound === 'true') {
      return;
    }

    sidebar.dataset.ubuzimaMobileNavBound = 'true';

    sidebar.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;

      if (!target) {
        return;
      }

      const interactive = target.closest('a,button,[role="button"],[data-module],[data-view]');

      if (!interactive) {
        return;
      }

      window.setTimeout(closeMenu, 120);
    });
  }

  function sync(): void {
    const isMobile = mobileQuery.matches;
    const isCompact = compactQuery.matches;

    root.classList.toggle('ubuzima-app-shell-mobile', isMobile);
    root.classList.toggle('ubuzima-app-shell-compact', isCompact);

    sidebar = findSidebar();

    if (sidebar) {
      sidebar.classList.toggle('ubuzima-mobile-sidebar', isMobile);
      bindSidebarCloseOnSelection();
    }

    ensureControls();

    if (!isMobile) {
      closeMenu();
    }
  }

  sync();

  window.addEventListener('resize', sync, { passive: true });
  window.addEventListener('orientationchange', sync, { passive: true });
  window.setInterval(sync, 1500);

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
}

function installUbuzimaInstallAppPrompt(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  let deferredPrompt: UbuzimaBeforeInstallPromptEvent | null = null;
  const notifyInstallChange = (isAvailable: boolean) => {
    window.dispatchEvent(
      new CustomEvent('ubuzima:pwa-install-change', {
        detail: { isAvailable },
      }),
    );
  };

  async function promptForInstall(): Promise<void> {
    if (!deferredPrompt) {
      notifyInstallChange(false);
      return;
    }

    await deferredPrompt.prompt().catch(() => undefined);
    await deferredPrompt.userChoice?.catch(() => undefined);
    deferredPrompt = null;
    notifyInstallChange(false);
    window.dispatchEvent(new CustomEvent('ubuzima:pwa-install-complete'));
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as UbuzimaBeforeInstallPromptEvent;
    notifyInstallChange(true);
  });

  window.addEventListener('ubuzima:pwa-install-request', () => {
    void promptForInstall();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyInstallChange(false);
    window.dispatchEvent(new CustomEvent('ubuzima:pwa-install-complete'));
  });
}

installUbuzimaInstallAppPrompt();



type DashboardSharedMetric = {
  label: string;
  valueText: string;
  valueNumber: number;
  updatedAt: number;
};

function installDashboardAnalyticsConsistencyLayer(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const storageKey = 'ubuzimaSharedDashboardAnalyticsMetricsV1';
  const maxAgeMs = 30 * 60 * 1000;

  const labelAliases: Record<string, string> = {
    'gross sales': 'Gross Sales',
    'gross revenue': 'Gross Revenue',
    'net revenue': 'Net Revenue',
    'total inventory value': 'Total Inventory Value',
    'inventory value': 'Total Inventory Value',
    'stock on hand count': 'Stock on Hand Count',
    'low stock value': 'Low Stock Value',
    'low stock count': 'Low Stock Count',
    'near expiry value': 'Near Expiry Value',
    'near expiry count': 'Near Expiry Count',
    'expired value': 'Expired Value',
    'expired count': 'Expired Count',
    'expired stock value': 'Expired Value',
    'stock received value': 'Stock Received Value',
    'stock received count': 'Stock Received Count',
    'stock issued value': 'Stock Issued Value',
    'stock issued count': 'Stock Issued Count',
    'turnover value': 'Turnover Value',
    'turnover count': 'Turnover Count',
  };

  function normalizeText(value: string | null | undefined): string {
    return (value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function canonicalLabel(value: string | null | undefined): string | null {
    const normalized = normalizeText(value);

    if (!normalized) {
      return null;
    }

    if (labelAliases[normalized]) {
      return labelAliases[normalized];
    }

    const found = Object.entries(labelAliases).find(([key]) => normalized.includes(key));

    return found?.[1] ?? null;
  }

  function parseNumber(value: string | null | undefined): number {
    const parsed = Number((value ?? '').replace(/[^0-9.-]/g, ''));

    return Number.isFinite(parsed) ? parsed : 0;
  }

  function readCache(): Record<string, DashboardSharedMetric> {
    try {
      const raw = window.localStorage.getItem(storageKey);

      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as Record<string, DashboardSharedMetric>;
      const now = Date.now();

      return Object.fromEntries(
        Object.entries(parsed).filter(([, metric]) =>
          metric &&
          Number.isFinite(metric.valueNumber) &&
          metric.valueNumber > 0 &&
          now - metric.updatedAt <= maxAgeMs,
        ),
      );
    } catch {
      return {};
    }
  }

  function writeCache(metrics: Record<string, DashboardSharedMetric>): void {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(metrics));
    } catch {
      // Storage is an enhancement only.
    }
  }

  function pageLooksLikeBusinessOverview(): boolean {
    const bodyText = document.body.textContent ?? '';
    const hasBusinessOverview = /Business Overview/i.test(bodyText);
    const hasInventoryAnalytics = /Inventory Analytics/i.test(bodyText);

    return hasBusinessOverview && !hasInventoryAnalytics;
  }

  function metricCards(): HTMLElement[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          'article',
          '.dashboard-card',
          '.business-overview-card',
          '.review-card',
          '.inventory-analytics-request-kpis article',
          '.overview-kpi-card',
          '.business-overview-kpi-card',
        ].join(','),
      ),
    );
  }

  function labelFromCard(card: HTMLElement): string | null {
    const labelNode =
      card.querySelector<HTMLElement>('small') ||
      card.querySelector<HTMLElement>('[data-kpi-label]') ||
      card.querySelector<HTMLElement>('.kpi-label') ||
      card.querySelector<HTMLElement>('h4') ||
      card.querySelector<HTMLElement>('h3');

    return canonicalLabel(labelNode?.textContent);
  }

  function valueNodeFromCard(card: HTMLElement): HTMLElement | null {
    return (
      card.querySelector<HTMLElement>('strong') ||
      card.querySelector<HTMLElement>('[data-kpi-value]') ||
      card.querySelector<HTMLElement>('.kpi-value') ||
      null
    );
  }

  function collectBusinessOverviewMetrics(): void {
    if (!pageLooksLikeBusinessOverview()) {
      return;
    }

    const existing = readCache();
    const now = Date.now();

    metricCards().forEach((card) => {
      const label = labelFromCard(card);
      const valueNode = valueNodeFromCard(card);

      if (!label || !valueNode) {
        return;
      }

      const valueText = valueNode.textContent?.trim() ?? '';
      const valueNumber = parseNumber(valueText);

      if (valueNumber <= 0) {
        return;
      }

      existing[label] = {
        label,
        valueText,
        valueNumber,
        updatedAt: now,
      };
    });

    writeCache(existing);
  }

  function applySharedMetrics(): void {
    const cached = readCache();

    if (Object.keys(cached).length === 0) {
      return;
    }

    const sourceIsBusinessOverview = pageLooksLikeBusinessOverview();

    metricCards().forEach((card) => {
      const label = labelFromCard(card);
      const valueNode = valueNodeFromCard(card);

      if (!label || !valueNode || !cached[label]) {
        return;
      }

      const currentText = valueNode.textContent?.trim() ?? '';
      const currentNumber = parseNumber(currentText);
      const sharedMetric = cached[label];

      if (sourceIsBusinessOverview && currentNumber > 0) {
        return;
      }

      if (currentNumber <= 0 || currentText !== sharedMetric.valueText) {
        valueNode.textContent = sharedMetric.valueText;
        card.dataset.sharedAnalyticsSynced = 'true';
      }
    });
  }

  function sync(): void {
    collectBusinessOverviewMetrics();
    applySharedMetrics();
  }

  window.setTimeout(sync, 500);
  window.setTimeout(sync, 1500);
  window.setTimeout(sync, 3500);
  window.setInterval(sync, 5000);

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

installDashboardAnalyticsConsistencyLayer();



function installUbuzimaMobileWebExperience(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;

  function syncMobileAppMode(): void {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    const isMobileWidth = window.matchMedia('(max-width: 780px)').matches;

    root.classList.toggle('ubuzima-mobile-web', isMobileWidth);
    root.classList.toggle('ubuzima-standalone-webapp', isStandalone);
  }

  syncMobileAppMode();

  window.addEventListener('resize', syncMobileAppMode, { passive: true });
  window.addEventListener('orientationchange', syncMobileAppMode, { passive: true });

  const canUseServiceWorker =
    'serviceWorker' in navigator &&
    (window.isSecureContext ||
      ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname));

  if (canUseServiceWorker) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => {
        // Service worker is an enhancement only.
      });
    });
  }
}

installUbuzimaMobileWebExperience();


if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('businessOverviewInventoryRiskOverviewLastGoodHtml');
  } catch {
    // Ignore storage cleanup failures.
  }
}



import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

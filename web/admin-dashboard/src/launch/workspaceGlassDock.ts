const BUILD_MARKER =
  'UBIZIMA_WORKSPACE_DOCK_REFINED_V4';

const ICON_REGISTRY_MARKER =
  'UBIZIMA_STABLE_ICON_REGISTRY_V4';

const NAVIGATION_MARKER =
  'UBIZIMA_AUTHORITATIVE_MENU_CLICK_WITH_SUBMENU_FALLBACK_V4';

const GLASS_MARKER =
  'UBIZIMA_REAL_GLASS_TRANSPARENCY_V4';

const RECENT_MARKER =
  'UBIZIMA_RECENT_TASK_CARDS_V4';

const RENDER_MARKER =
  'UBIZIMA_SIGNATURE_GUARDED_RENDER_V4';

const MINIMUM_WIDTH = 768;
const MAXIMUM_RECENT = 4;

const ROOT_CLASS =
  'ubuzima-workspace-dock-refined-v4';

const STYLE_ID =
  'ubuzima-workspace-dock-refined-v4-style';

const DOCK_ATTRIBUTE =
  'data-ubuzima-workspace-dock';

const RECENT_STORAGE_KEY =
  'ubuzima_workspace_dock_recent_v4';

const BUNDLED_ICON_REGISTRY_MARKER =
  'UBIZIMA_BUNDLED_REVIEWED_ICON_REGISTRY_V4B';

const ICON_REGISTRY: Record<string, string> = {
  'admin.svg': new URL(
    '../assets/dock-icons/admin.svg',
    import.meta.url,
  ).href,
  'ai.svg': new URL(
    '../assets/dock-icons/ai.svg',
    import.meta.url,
  ).href,
  'dashboard.svg': new URL(
    '../assets/dock-icons/dashboard.svg',
    import.meta.url,
  ).href,
  'email.svg': new URL(
    '../assets/dock-icons/email.svg',
    import.meta.url,
  ).href,
  'finance.svg': new URL(
    '../assets/dock-icons/finance.svg',
    import.meta.url,
  ).href,
  'general-stock.svg': new URL(
    '../assets/dock-icons/general-stock.svg',
    import.meta.url,
  ).href,
  'home.svg': new URL(
    '../assets/dock-icons/home.svg',
    import.meta.url,
  ).href,
  'insurance.svg': new URL(
    '../assets/dock-icons/insurance.svg',
    import.meta.url,
  ).href,
  'inventory.svg': new URL(
    '../assets/dock-icons/inventory.svg',
    import.meta.url,
  ).href,
  'module.svg': new URL(
    '../assets/dock-icons/module.svg',
    import.meta.url,
  ).href,
  'pharmacy.svg': new URL(
    '../assets/dock-icons/pharmacy.svg',
    import.meta.url,
  ).href,
  'pos.svg': new URL(
    '../assets/dock-icons/pos.svg',
    import.meta.url,
  ).href,
  'procurement.svg': new URL(
    '../assets/dock-icons/procurement.svg',
    import.meta.url,
  ).href,
  'product-master.svg': new URL(
    '../assets/dock-icons/product-master.svg',
    import.meta.url,
  ).href,
  'reports.svg': new URL(
    '../assets/dock-icons/reports.svg',
    import.meta.url,
  ).href,
  'sales.svg': new URL(
    '../assets/dock-icons/sales.svg',
    import.meta.url,
  ).href,
  'settings.svg': new URL(
    '../assets/dock-icons/settings.svg',
    import.meta.url,
  ).href,
  'suppliers.svg': new URL(
    '../assets/dock-icons/suppliers.svg',
    import.meta.url,
  ).href,
  'tenant.svg': new URL(
    '../assets/dock-icons/tenant.svg',
    import.meta.url,
  ).href,
  'users.svg': new URL(
    '../assets/dock-icons/users.svg',
    import.meta.url,
  ).href,
};

type DockModule = {
  key: string;
  label: string;
  icon: string;
  active: boolean;
};

type RecentWorkspace = {
  key: string;
  label: string;
  icon: string;
  scrollTop: number;
  updatedAt: number;
};

declare global {
  interface Window {
    __ubuzimaWorkspaceDockRefinedV4?: boolean;
  }
}

let renderTimer = 0;
let lastStructureSignature = '';
let lastActiveKey = '';
let isRendering = false;

function isLikelyPhone(): boolean {
  const userAgent =
    navigator.userAgent || '';

  return (
    /iPhone|iPod|Windows Phone|IEMobile/i
      .test(userAgent)
    || (
      /Android/i.test(userAgent)
      && /Mobile/i.test(userAgent)
    )
  );
}

function shouldRenderDock(): boolean {
  return (
    window.innerWidth >= MINIMUM_WIDTH
    && !isLikelyPhone()
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normaliseKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function iconNameFor(
  key: string,
  label: string,
): string {
  const identity =
    `${key} ${label}`.toLowerCase();

  if (
    key === 'dashboard'
    || key === 'overview'
    || identity.includes('dashboard')
    || identity.includes('business overview')
  ) {
    return 'dashboard.svg';
  }

  if (
    key === 'pos'
    || identity.includes('point of sale')
    || identity.includes('pos and sales')
  ) {
    return 'pos.svg';
  }

  if (
    identity.includes('product master')
    || key === 'product-master'
  ) {
    return 'product-master.svg';
  }

  if (
    identity.includes('general stock')
    || key === 'general-stock'
  ) {
    return 'general-stock.svg';
  }

  if (
    identity.includes('inventory')
    || identity.includes('stock control')
  ) {
    return 'inventory.svg';
  }

  if (
    identity.includes('procurement')
    || identity.includes('purchase order')
  ) {
    return 'procurement.svg';
  }

  if (
    identity.includes('supplier')
  ) {
    return 'suppliers.svg';
  }

  if (
    identity.includes('finance')
    || identity.includes('account')
    || identity.includes('reconciliation')
  ) {
    return 'finance.svg';
  }

  if (
    identity.includes('insurance')
    || identity.includes('claim')
  ) {
    return 'insurance.svg';
  }

  if (
    identity.includes('corporate email')
    || identity.includes('communication')
    || identity.includes('mail')
  ) {
    return 'email.svg';
  }

  if (
    identity.includes('artificial intelligence')
    || identity.includes('ai ')
    || key.startsWith('ai')
  ) {
    return 'ai.svg';
  }

  if (
    identity.includes('report')
    || identity.includes('analytics')
    || identity.includes('business intelligence')
  ) {
    return 'reports.svg';
  }

  if (
    identity.includes('sale')
  ) {
    return 'sales.svg';
  }

  if (
    identity.includes('tenant')
    || identity.includes('branch')
    || identity.includes('institution')
  ) {
    return 'tenant.svg';
  }

  if (
    identity.includes('user')
    || identity.includes('profile')
    || identity.includes('access')
  ) {
    return 'users.svg';
  }

  if (
    identity.includes('admin')
    || identity.includes('platform management')
  ) {
    return 'admin.svg';
  }

  if (
    identity.includes('setting')
    || identity.includes('configuration')
  ) {
    return 'settings.svg';
  }

  if (
    identity.includes('pharmacy')
    || identity.includes('dispensing')
  ) {
    return 'pharmacy.svg';
  }

  if (
    identity.includes('home')
  ) {
    return 'home.svg';
  }

  return 'module.svg';
}

function iconUrl(
  key: string,
  label: string,
): string {
  const iconName =
    iconNameFor(
      key,
      label,
    );

  return (
    ICON_REGISTRY[iconName]
    || ICON_REGISTRY['module.svg']
  );
}

function findMenuSection(
  key: string,
): HTMLElement | null {
  const sections =
    document.querySelectorAll<HTMLElement>(
      '.sidebar[data-admin-sidebar] '
      + '.principal-menu-section'
      + '[data-principal-menu]',
    );

  for (const section of sections) {
    if (
      section.dataset.principalMenu
      === key
    ) {
      return section;
    }
  }

  return null;
}

function sourceButtonForKey(
  key: string,
): HTMLButtonElement | null {
  if (
    key === 'dashboard'
    || key === 'overview'
  ) {
    const dashboardButton =
      document.querySelector(
        '.sidebar[data-admin-sidebar] '
        + '.principal-menu-button'
        + '[data-section="overview"]',
      );

    return (
      dashboardButton
      instanceof HTMLButtonElement
        ? dashboardButton
        : null
    );
  }

  const section =
    findMenuSection(key);

  if (!section) {
    return null;
  }

  const button =
    section.querySelector(
      '.principal-menu-button'
      + '[data-section]',
    );

  return (
    button instanceof HTMLButtonElement
      ? button
      : null
  );
}

function moduleIsActive(
  key: string,
): boolean {
  if (
    key === 'dashboard'
    || key === 'overview'
  ) {
    return Boolean(
      sourceButtonForKey('dashboard')
        ?.classList.contains('active'),
    );
  }

  const section =
    findMenuSection(key);

  const button =
    sourceButtonForKey(key);

  return Boolean(
    section?.classList.contains('active')
    || button?.classList.contains('active')
    || button?.getAttribute(
      'aria-current',
    ) === 'page'
  );
}

function discoverModules(): DockModule[] {
  const modules: DockModule[] = [];
  const seen = new Set<string>();

  const dashboardButton =
    sourceButtonForKey('dashboard');

  if (dashboardButton) {
    modules.push({
      key: 'dashboard',
      label:
        dashboardButton
          .querySelector<HTMLElement>(
            '.principal-menu-title',
          )
          ?.textContent
          ?.trim()
        || 'Dashboard',
      icon:
        iconUrl(
          'dashboard',
          'Dashboard',
        ),
      active:
        moduleIsActive('dashboard'),
    });

    seen.add('dashboard');
  }

  document
    .querySelectorAll<HTMLElement>(
      '.sidebar[data-admin-sidebar] '
      + '.principal-menu-section'
      + '[data-principal-menu]',
    )
    .forEach((section) => {
      const button =
        section.querySelector(
          '.principal-menu-button'
          + '[data-section]',
        );

      if (
        !(button instanceof HTMLButtonElement)
      ) {
        return;
      }

      const rawKey =
        section.dataset.principalMenu
        || button.dataset.section
        || '';

      const title =
        button.querySelector<HTMLElement>(
          '.principal-menu-title',
        );

      const label =
        title?.textContent?.trim()
        || button.textContent?.trim()
        || rawKey
        || 'Module';

      const key =
        rawKey
        || normaliseKey(label);

      if (
        !key
        || seen.has(key)
      ) {
        return;
      }

      modules.push({
        key,
        label,
        icon:
          iconUrl(
            key,
            label,
          ),
        active:
          moduleIsActive(key),
      });

      seen.add(key);
    });

  return modules;
}

function currentScrollTop(): number {
  const panel =
    document.querySelector<HTMLElement>(
      '.dashboard-scroll-panel',
    );

  if (panel) {
    return panel.scrollTop;
  }

  return (
    document.scrollingElement?.scrollTop
    ?? window.scrollY
    ?? 0
  );
}

function restoreScrollTop(
  scrollTop: number,
): void {
  const safeScrollTop =
    Number.isFinite(scrollTop)
      ? Math.max(0, scrollTop)
      : 0;

  const apply = (): void => {
    const panel =
      document.querySelector<HTMLElement>(
        '.dashboard-scroll-panel',
      );

    if (panel) {
      panel.scrollTop = safeScrollTop;
      return;
    }

    window.scrollTo({
      top: safeScrollTop,
      left: 0,
      behavior: 'auto',
    });
  };

  window.setTimeout(
    apply,
    220,
  );

  window.setTimeout(
    apply,
    520,
  );
}

function readRecent(): RecentWorkspace[] {
  try {
    const raw =
      sessionStorage.getItem(
        RECENT_STORAGE_KEY,
      );

    if (!raw) {
      return [];
    }

    const parsed: unknown =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const entries: RecentWorkspace[] = [];

    parsed.forEach((entry) => {
      if (
        typeof entry !== 'object'
        || entry === null
      ) {
        return;
      }

      const record =
        entry as Partial<RecentWorkspace>;

      if (
        typeof record.key !== 'string'
        || typeof record.label !== 'string'
      ) {
        return;
      }

      entries.push({
        key: record.key,
        label: record.label,
        icon:
          typeof record.icon === 'string'
            ? record.icon
            : iconUrl(
              record.key,
              record.label,
            ),
        scrollTop:
          typeof record.scrollTop
          === 'number'
            ? record.scrollTop
            : 0,
        updatedAt:
          typeof record.updatedAt
          === 'number'
            ? record.updatedAt
            : Date.now(),
      });
    });

    return entries.slice(
      0,
      MAXIMUM_RECENT,
    );
  } catch {
    return [];
  }
}

function writeRecent(
  entries: RecentWorkspace[],
): void {
  try {
    sessionStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify(
        entries.slice(
          0,
          MAXIMUM_RECENT,
        ),
      ),
    );
  } catch {
    // Navigation remains available
    // when session storage is unavailable.
  }
}

function rememberWorkspace(
  module: DockModule,
  scrollTop: number,
): void {
  const entries =
    readRecent().filter(
      (entry) =>
        entry.key !== module.key,
    );

  entries.unshift({
    key: module.key,
    label: module.label,
    icon: module.icon,
    scrollTop,
    updatedAt: Date.now(),
  });

  writeRecent(entries);
}

function rememberCurrentWorkspace(): void {
  const modules =
    discoverModules();

  const current =
    modules.find(
      (module) => module.active,
    );

  if (!current) {
    return;
  }

  rememberWorkspace(
    current,
    currentScrollTop(),
  );
}

function removeRecentWorkspace(
  key: string,
): void {
  writeRecent(
    readRecent().filter(
      (entry) => entry.key !== key,
    ),
  );
}

function recentTaskText(
  module: DockModule,
): string {
  const identity =
    `${module.key} ${module.label}`
      .toLowerCase();

  if (
    identity.includes('pos')
    || identity.includes('sale')
  ) {
    return 'Resume sales work';
  }

  if (
    identity.includes('inventory')
    || identity.includes('stock')
  ) {
    return 'Continue stock work';
  }

  if (
    identity.includes('supplier')
    || identity.includes('procurement')
  ) {
    return 'Continue supply work';
  }

  if (
    identity.includes('finance')
  ) {
    return 'Review finance work';
  }

  if (
    identity.includes('report')
    || identity.includes('analytics')
  ) {
    return 'Continue analysis';
  }

  if (
    identity.includes('email')
    || identity.includes('communication')
  ) {
    return 'Return to messages';
  }

  return 'Resume workspace';
}

function invokeAuthoritativeMenu(
  key: string,
): boolean {
  const sourceButton =
    sourceButtonForKey(key);

  if (!sourceButton) {
    return false;
  }

  sourceButton.click();

  window.dispatchEvent(
    new CustomEvent(
      'ubuzima:workspace-dock-navigation',
      {
        detail: {
          key,
          marker:
            NAVIGATION_MARKER,
        },
      },
    ),
  );

  if (
    key === 'dashboard'
    || key === 'overview'
  ) {
    return true;
  }

  window.setTimeout(
    () => {
      if (moduleIsActive(key)) {
        return;
      }

      const refreshedSection =
        findMenuSection(key);

      const firstSubmenuButton =
        refreshedSection
          ?.querySelector(
            '.tree-child-submenu '
            + 'button[data-section]'
            + '[data-submenu]',
          );

      if (
        firstSubmenuButton
        instanceof HTMLButtonElement
      ) {
        firstSubmenuButton.click();

        window.dispatchEvent(
          new CustomEvent(
            'ubuzima:workspace-dock-submenu-fallback',
            {
              detail: {
                key,
                marker:
                  NAVIGATION_MARKER,
              },
            },
          ),
        );
      }
    },
    140,
  );

  return true;
}

function navigateToModule(
  key: string,
  restoreScroll?: number,
): void {
  const modules =
    discoverModules();

  const target =
    modules.find(
      (module) => module.key === key,
    );

  if (!target) {
    removeRecentWorkspace(key);
    scheduleRender(true);
    return;
  }

  rememberCurrentWorkspace();

  const invoked =
    invokeAuthoritativeMenu(key);

  if (!invoked) {
    removeRecentWorkspace(key);
    scheduleRender(true);
    return;
  }

  window.setTimeout(
    () => {
      const refreshedTarget =
        discoverModules().find(
          (module) =>
            module.key === key,
        )
        || target;

      rememberWorkspace(
        refreshedTarget,
        restoreScroll ?? 0,
      );

      if (
        typeof restoreScroll === 'number'
      ) {
        restoreScrollTop(
          restoreScroll,
        );
      }

      scheduleRender(true);
    },
    340,
  );
}

function injectStyles(): void {
  if (
    document.getElementById(
      STYLE_ID,
    )
  ) {
    return;
  }

  const style =
    document.createElement('style');

  style.id = STYLE_ID;

  style.textContent = `
    @media (min-width: 768px) {
      html.${ROOT_CLASS} {
        --ubuzima-workspace-dock-safe-area:
          118px;
      }

      html.${ROOT_CLASS}
        .sidebar[data-admin-sidebar] {
        display: none !important;
      }

      html.${ROOT_CLASS}
        .dashboard-shell {
        grid-template-columns:
          minmax(0, 1fr) !important;
      }

      html.${ROOT_CLASS}
        .dashboard-main {
        grid-column: 1 / -1 !important;
        width: 100% !important;
        max-width: none !important;
        margin-left: 0 !important;
        padding-bottom:
          var(
            --ubuzima-workspace-dock-safe-area
          ) !important;
      }

      html.${ROOT_CLASS}
        .dashboard-scroll-panel,
      html.${ROOT_CLASS}
        .section-page,
      html.${ROOT_CLASS}
        main {
        scroll-padding-bottom:
          var(
            --ubuzima-workspace-dock-safe-area
          ) !important;
      }

      .ubuzima-workspace-dock-v4 {
        position: fixed;
        z-index: 9998;
        left: 50%;
        bottom:
          max(
            13px,
            env(safe-area-inset-bottom)
          );

        width:
          min(
            1380px,
            calc(100vw - 28px)
          );
        min-width: 0;
        max-width:
          calc(100vw - 28px);

        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          minmax(250px, 410px);
        align-items: stretch;
        gap: 8px;

        padding: 8px;

        border:
          1px solid
          rgba(255, 255, 255, 0.66);
        border-radius: 25px;

        background:
          linear-gradient(
            138deg,
            rgba(255, 255, 255, 0.34),
            rgba(240, 253, 250, 0.20)
              48%,
            rgba(226, 245, 241, 0.26)
          );

        box-shadow:
          0 26px 72px
            rgba(15, 35, 33, 0.20),
          0 8px 24px
            rgba(15, 118, 110, 0.08),
          inset 0 1px 0
            rgba(255, 255, 255, 0.82),
          inset 0 -1px 0
            rgba(255, 255, 255, 0.24);

        -webkit-backdrop-filter:
          blur(28px)
          saturate(1.72)
          contrast(1.03);

        backdrop-filter:
          blur(28px)
          saturate(1.72)
          contrast(1.03);

        transform:
          translateX(-50%);

        isolation: isolate;
        overflow: visible;
        box-sizing: border-box;
      }

      .ubuzima-workspace-dock-v4::before {
        content: '';
        position: absolute;
        z-index: -1;
        inset: 1px;
        border-radius: 23px;

        background:
          linear-gradient(
            115deg,
            rgba(255, 255, 255, 0.24),
            transparent 42%,
            rgba(15, 118, 110, 0.04)
          );

        pointer-events: none;
      }

      .ubuzima-workspace-dock-v4__modules {
        min-width: 0;

        display: flex;
        align-items: center;
        gap: 6px;

        padding: 5px 7px;

        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;

        border:
          1px solid
          rgba(255, 255, 255, 0.42);
        border-radius: 18px;

        background:
          rgba(255, 255, 255, 0.10);

        box-shadow:
          inset 0 1px 0
            rgba(255, 255, 255, 0.46);
      }

      .ubuzima-workspace-dock-v4__modules
        ::-webkit-scrollbar {
        display: none;
      }

      .ubuzima-workspace-dock-v4__module {
        position: relative;

        width: 64px;
        min-width: 64px;
        height: 64px;
        min-height: 64px;
        flex: 0 0 64px;

        display: grid;
        grid-template-rows:
          39px 14px;
        place-items: center;
        align-content: center;
        gap: 2px;

        padding: 4px 3px;

        border:
          1px solid
          rgba(255, 255, 255, 0.38);
        border-radius: 17px;

        background:
          rgba(255, 255, 255, 0.17);

        color: #153e38;
        cursor: pointer;

        box-shadow:
          inset 0 1px 0
            rgba(255, 255, 255, 0.55);

        transform: none !important;
        scale: 1 !important;

        transition:
          background-color 120ms ease,
          border-color 120ms ease,
          box-shadow 120ms ease;

        contain:
          layout paint;
        box-sizing: border-box;
      }

      .ubuzima-workspace-dock-v4__module:hover {
        background:
          rgba(255, 255, 255, 0.34);
        border-color:
          rgba(255, 255, 255, 0.72);
        box-shadow:
          0 8px 18px
            rgba(20, 83, 73, 0.10),
          inset 0 1px 0
            rgba(255, 255, 255, 0.70);

        transform: none !important;
        scale: 1 !important;
      }

      .ubuzima-workspace-dock-v4__module.is-active {
        background:
          rgba(226, 248, 243, 0.60);
        border-color:
          rgba(15, 118, 110, 0.34);

        box-shadow:
          0 0 0 2px
            rgba(15, 118, 110, 0.10),
          0 8px 18px
            rgba(15, 118, 110, 0.10),
          inset 0 1px 0
            rgba(255, 255, 255, 0.84);
      }

      .ubuzima-workspace-dock-v4__icon-shell {
        width: 39px;
        min-width: 39px;
        height: 39px;
        min-height: 39px;

        display: grid;
        place-items: center;

        border-radius: 13px;

        background:
          rgba(255, 255, 255, 0.30);

        box-shadow:
          inset 0 1px 0
            rgba(255, 255, 255, 0.64);

        overflow: hidden;
      }

      .ubuzima-workspace-dock-v4__icon {
        width: 31px !important;
        min-width: 31px !important;
        max-width: 31px !important;
        height: 31px !important;
        min-height: 31px !important;
        max-height: 31px !important;

        display: block !important;
        object-fit: contain !important;

        opacity: 1 !important;
        visibility: visible !important;

        transform: none !important;
        scale: 1 !important;
        filter: none !important;

        pointer-events: none;
        user-select: none;
      }

      .ubuzima-workspace-dock-v4__module-label {
        width: 100%;
        min-width: 0;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        color: #244b45;

        font-size: 9px;
        font-weight: 850;
        line-height: 1;
        letter-spacing: -0.01em;
        text-align: center;
      }

      .ubuzima-workspace-dock-v4__active-dot {
        position: absolute;
        left: 50%;
        bottom: 2px;

        width: 4px;
        height: 4px;

        border-radius: 999px;
        background: transparent;

        transform:
          translateX(-50%);
      }

      .ubuzima-workspace-dock-v4__module.is-active
        .ubuzima-workspace-dock-v4__active-dot {
        background: #0f766e;
        box-shadow:
          0 0 0 2px
            rgba(255, 255, 255, 0.70);
      }

      .ubuzima-workspace-dock-v4__recent {
        min-width: 0;

        display: grid;
        grid-template-rows:
          auto minmax(0, 1fr);
        gap: 5px;

        padding: 6px;

        border:
          1px solid
          rgba(255, 255, 255, 0.50);
        border-radius: 18px;

        background:
          linear-gradient(
            145deg,
            rgba(255, 255, 255, 0.22),
            rgba(238, 252, 248, 0.13)
          );

        box-shadow:
          inset 0 1px 0
            rgba(255, 255, 255, 0.62);
      }

      .ubuzima-workspace-dock-v4__recent-header {
        min-width: 0;

        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;

        padding: 0 4px;
      }

      .ubuzima-workspace-dock-v4__recent-heading {
        min-width: 0;

        display: flex;
        align-items: center;
        gap: 7px;
      }

      .ubuzima-workspace-dock-v4__recent-heading
        strong {
        color: #173f39;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.02em;
      }

      .ubuzima-workspace-dock-v4__recent-count {
        min-width: 19px;
        height: 19px;

        display: inline-grid;
        place-items: center;

        border:
          1px solid
          rgba(15, 118, 110, 0.16);
        border-radius: 999px;

        background:
          rgba(255, 255, 255, 0.38);
        color: #0f766e;

        font-size: 9px;
        font-weight: 950;
      }

      .ubuzima-workspace-dock-v4__recent-list {
        min-width: 0;

        display: flex;
        align-items: stretch;
        gap: 6px;

        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
      }

      .ubuzima-workspace-dock-v4__recent-list
        ::-webkit-scrollbar {
        display: none;
      }

      .ubuzima-workspace-dock-v4__recent-card {
        position: relative;

        width: 150px;
        min-width: 150px;
        min-height: 57px;
        flex: 0 0 150px;

        display: grid;
        grid-template-columns:
          minmax(0, 1fr) auto;

        border:
          1px solid
          rgba(255, 255, 255, 0.44);
        border-radius: 14px;

        background:
          rgba(255, 255, 255, 0.22);

        box-shadow:
          inset 0 1px 0
            rgba(255, 255, 255, 0.56);

        overflow: hidden;
        box-sizing: border-box;
      }

      .ubuzima-workspace-dock-v4__recent-card.is-current {
        border-color:
          rgba(15, 118, 110, 0.30);
        background:
          rgba(226, 248, 243, 0.42);
      }

      .ubuzima-workspace-dock-v4__recent-open {
        min-width: 0;

        display: grid;
        grid-template-columns:
          34px minmax(0, 1fr);
        align-items: center;
        gap: 7px;

        padding: 6px 3px 6px 7px;

        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        text-align: left;

        transform: none !important;
        scale: 1 !important;
      }

      .ubuzima-workspace-dock-v4__recent-icon-shell {
        width: 34px;
        min-width: 34px;
        height: 34px;
        min-height: 34px;

        display: grid;
        place-items: center;

        border:
          1px solid
          rgba(255, 255, 255, 0.44);
        border-radius: 11px;

        background:
          rgba(255, 255, 255, 0.30);
      }

      .ubuzima-workspace-dock-v4__recent-icon {
        width: 27px !important;
        min-width: 27px !important;
        max-width: 27px !important;
        height: 27px !important;
        min-height: 27px !important;
        max-height: 27px !important;

        display: block !important;
        object-fit: contain !important;

        transform: none !important;
        scale: 1 !important;
        filter: none !important;

        pointer-events: none;
      }

      .ubuzima-workspace-dock-v4__recent-copy {
        min-width: 0;

        display: grid;
        gap: 2px;
      }

      .ubuzima-workspace-dock-v4__recent-copy
        small {
        color: #57817a;
        font-size: 7px;
        font-weight: 900;
        line-height: 1;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .ubuzima-workspace-dock-v4__recent-copy
        strong {
        min-width: 0;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        color: #173f39;
        font-size: 10px;
        font-weight: 900;
        line-height: 1.08;
      }

      .ubuzima-workspace-dock-v4__recent-copy
        span {
        min-width: 0;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        color: #648780;
        font-size: 8px;
        font-weight: 750;
        line-height: 1;
      }

      .ubuzima-workspace-dock-v4__recent-close {
        width: 23px;
        min-width: 23px;

        display: grid;
        place-items: center;

        padding: 0;

        border: 0;
        border-left:
          1px solid
          rgba(255, 255, 255, 0.30);

        background:
          rgba(255, 255, 255, 0.12);
        color: #55746f;

        cursor: pointer;
        font-size: 14px;
        font-weight: 800;

        transform: none !important;
        scale: 1 !important;
      }

      .ubuzima-workspace-dock-v4__recent-close:hover {
        background:
          rgba(255, 255, 255, 0.34);
        color: #9f3030;
      }

      .ubuzima-workspace-dock-v4__recent-empty {
        min-width: 210px;

        display: flex;
        align-items: center;

        padding: 8px 10px;

        border:
          1px dashed
          rgba(15, 118, 110, 0.18);
        border-radius: 13px;

        color: #62817c;
        background:
          rgba(255, 255, 255, 0.14);

        font-size: 9px;
        font-weight: 750;
        line-height: 1.25;
      }
    }

    @media (
      min-width: 768px
    ) and (
      max-width: 1023px
    ) {
      .ubuzima-workspace-dock-v4 {
        grid-template-columns:
          minmax(0, 1fr)
          minmax(210px, 35vw);
      }

      .ubuzima-workspace-dock-v4__module {
        width: 59px;
        min-width: 59px;
        flex-basis: 59px;
      }

      .ubuzima-workspace-dock-v4__recent-card {
        width: 132px;
        min-width: 132px;
        flex-basis: 132px;
      }

      .ubuzima-workspace-dock-v4__recent-copy
        span {
        display: none;
      }
    }

    @supports not (
      (
        -webkit-backdrop-filter:
          blur(1px)
      )
      or
      (
        backdrop-filter:
          blur(1px)
      )
    ) {
      .ubuzima-workspace-dock-v4 {
        background:
          rgba(244, 252, 250, 0.92);
      }
    }

    @media (max-width: 767px) {
      .ubuzima-workspace-dock-v4 {
        display: none !important;
      }
    }
  `;

  document.head.appendChild(style);
}

function removeDock(): void {
  document
    .querySelector(
      `[${DOCK_ATTRIBUTE}]`,
    )
    ?.remove();

  document.documentElement
    .classList.remove(
      ROOT_CLASS,
    );

  document.documentElement
    .removeAttribute(
      'data-ubuzima-workspace-dock-build',
    );

  lastStructureSignature = '';
  lastActiveKey = '';
}

function ensureDock(): HTMLElement {
  const existing =
    document.querySelector<HTMLElement>(
      `[${DOCK_ATTRIBUTE}]`,
    );

  if (
    existing
    && existing.dataset
      .ubuzimaWorkspaceDockBuild
      === BUILD_MARKER
  ) {
    return existing;
  }

  existing?.remove();

  const dock =
    document.createElement('nav');

  dock.className =
    'ubuzima-workspace-dock-v4';

  dock.setAttribute(
    DOCK_ATTRIBUTE,
    BUILD_MARKER,
  );

  dock.setAttribute(
    'data-ubuzima-workspace-dock-build',
    BUILD_MARKER,
  );

  dock.setAttribute(
    'data-icon-registry-marker',
    ICON_REGISTRY_MARKER,
  );

  dock.setAttribute(
    'data-bundled-icon-registry-marker',
    BUNDLED_ICON_REGISTRY_MARKER,
  );

  dock.setAttribute(
    'data-navigation-marker',
    NAVIGATION_MARKER,
  );

  dock.setAttribute(
    'data-glass-marker',
    GLASS_MARKER,
  );

  dock.setAttribute(
    'data-recent-marker',
    RECENT_MARKER,
  );

  dock.setAttribute(
    'data-render-marker',
    RENDER_MARKER,
  );

  dock.setAttribute(
    'aria-label',
    'Ubuzima workspace dock',
  );

  dock.addEventListener(
    'click',
    handleDockClick,
  );

  dock.addEventListener(
    'error',
    handleIconError,
    true,
  );

  dock.addEventListener(
    'dragstart',
    (event) => {
      event.preventDefault();
    },
  );

  document.body.appendChild(dock);

  return dock;
}

function normalisedRecent(
  modules: DockModule[],
): RecentWorkspace[] {
  const moduleMap =
    new Map(
      modules.map(
        (module) => [
          module.key,
          module,
        ],
      ),
    );

  const entries: RecentWorkspace[] = [];

  readRecent().forEach((entry) => {
    const module =
      moduleMap.get(entry.key);

    if (!module) {
      return;
    }

    entries.push({
      ...entry,
      label: module.label,
      icon: module.icon,
    });
  });

  return entries.slice(
    0,
    MAXIMUM_RECENT,
  );
}

function moduleMarkup(
  module: DockModule,
): string {
  return `
    <button
      type="button"
      class="
        ubuzima-workspace-dock-v4__module
        ${module.active ? 'is-active' : ''}
      "
      data-workspace-module-key="${escapeHtml(module.key)}"
      aria-label="Open ${escapeHtml(module.label)}"
      aria-pressed="${module.active ? 'true' : 'false'}"
      title="${escapeHtml(module.label)}"
    >
      <span
        class="ubuzima-workspace-dock-v4__icon-shell"
        aria-hidden="true"
      >
        <img
          class="ubuzima-workspace-dock-v4__icon"
          src="${escapeHtml(module.icon)}"
          alt=""
          draggable="false"
          data-dock-stable-icon="${ICON_REGISTRY_MARKER}"
        />
      </span>

      <span
        class="ubuzima-workspace-dock-v4__module-label"
      >
        ${escapeHtml(module.label)}
      </span>

      <span
        class="ubuzima-workspace-dock-v4__active-dot"
        aria-hidden="true"
      ></span>
    </button>
  `;
}

function recentMarkup(
  entry: RecentWorkspace,
  module: DockModule,
): string {
  const current =
    module.active;

  return `
    <article
      class="
        ubuzima-workspace-dock-v4__recent-card
        ${current ? 'is-current' : ''}
      "
      data-recent-task-key="${escapeHtml(entry.key)}"
    >
      <button
        type="button"
        class="ubuzima-workspace-dock-v4__recent-open"
        data-recent-open-key="${escapeHtml(entry.key)}"
        aria-label="Resume ${escapeHtml(entry.label)}"
      >
        <span
          class="ubuzima-workspace-dock-v4__recent-icon-shell"
          aria-hidden="true"
        >
          <img
            class="ubuzima-workspace-dock-v4__recent-icon"
            src="${escapeHtml(module.icon)}"
            alt=""
            draggable="false"
            data-dock-stable-icon="${ICON_REGISTRY_MARKER}"
          />
        </span>

        <span
          class="ubuzima-workspace-dock-v4__recent-copy"
        >
          <small>
            ${current ? 'Current task' : 'Recent task'}
          </small>

          <strong>
            ${escapeHtml(entry.label)}
          </strong>

          <span>
            ${escapeHtml(recentTaskText(module))}
          </span>
        </span>
      </button>

      <button
        type="button"
        class="ubuzima-workspace-dock-v4__recent-close"
        data-recent-close-key="${escapeHtml(entry.key)}"
        aria-label="Close ${escapeHtml(entry.label)} from recent tasks"
        title="Close recent task"
      >
        ×
      </button>
    </article>
  `;
}

function renderDock(
  forceStructure = false,
): void {
  if (isRendering) {
    return;
  }

  if (!shouldRenderDock()) {
    removeDock();
    return;
  }

  isRendering = true;

  try {
    injectStyles();

    document.documentElement
      .classList.add(
        ROOT_CLASS,
      );

    const modules =
      discoverModules();

    if (modules.length === 0) {
      removeDock();
      return;
    }

    const recent =
      normalisedRecent(modules);

    const activeModule =
      modules.find(
        (module) => module.active,
      );

    const activeKey =
      activeModule?.key || '';

    const moduleSignature =
      modules.map(
        (module) =>
          `${module.key}:${module.label}:${module.icon}`,
      )
      .join('|');

    const recentSignature =
      recent.map(
        (entry) =>
          `${entry.key}:${entry.label}`,
      )
      .join('|');

    const structureSignature =
      `${moduleSignature}::${recentSignature}`;

    const dock =
      ensureDock();

    if (
      forceStructure
      || structureSignature
        !== lastStructureSignature
      || !dock.firstElementChild
    ) {
      const moduleMap =
        new Map(
          modules.map(
            (module) => [
              module.key,
              module,
            ],
          ),
        );

      const recentCards =
        recent.map((entry) => {
          const module =
            moduleMap.get(entry.key);

          return module
            ? recentMarkup(
              entry,
              module,
            )
            : '';
        })
        .join('');

      dock.innerHTML = `
        <section
          class="ubuzima-workspace-dock-v4__modules"
          aria-label="Available modules"
        >
          ${modules.map(moduleMarkup).join('')}
        </section>

        <section
          class="ubuzima-workspace-dock-v4__recent"
          aria-label="Recent tasks"
        >
          <header
            class="ubuzima-workspace-dock-v4__recent-header"
          >
            <div
              class="ubuzima-workspace-dock-v4__recent-heading"
            >
              <strong>Recent tasks</strong>

              <span
                class="ubuzima-workspace-dock-v4__recent-count"
                aria-label="${recent.length} recent tasks"
              >
                ${recent.length}
              </span>
            </div>
          </header>

          <div
            class="ubuzima-workspace-dock-v4__recent-list"
          >
            ${
              recentCards
              || `
                <div
                  class="ubuzima-workspace-dock-v4__recent-empty"
                >
                  Open a module to build your recent workspace list.
                </div>
              `
            }
          </div>
        </section>
      `;

      lastStructureSignature =
        structureSignature;
    }

    dock
      .querySelectorAll<HTMLElement>(
        '[data-workspace-module-key]',
      )
      .forEach((button) => {
        const key =
          button.dataset
            .workspaceModuleKey
          || '';

        const active =
          key === activeKey;

        button.classList.toggle(
          'is-active',
          active,
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false',
        );
      });

    dock
      .querySelectorAll<HTMLElement>(
        '[data-recent-task-key]',
      )
      .forEach((card) => {
        const key =
          card.dataset.recentTaskKey
          || '';

        card.classList.toggle(
          'is-current',
          key === activeKey,
        );

        const taskLabel =
          card.querySelector('small');

        if (taskLabel) {
          taskLabel.textContent =
            key === activeKey
              ? 'Current task'
              : 'Recent task';
        }
      });

    dock.setAttribute(
      'data-module-count',
      String(modules.length),
    );

    dock.setAttribute(
      'data-recent-workspace-count',
      String(recent.length),
    );

    dock.setAttribute(
      'data-recent-workspace-limit',
      String(MAXIMUM_RECENT),
    );

    dock.setAttribute(
      'data-icon-render-mode',
      'bundled-reviewed-svg-assets',
    );

    dock.setAttribute(
      'data-render-mode',
      'signature-guarded',
    );

    dock.setAttribute(
      'data-navigation-mode',
      'authoritative-menu-click-with-submenu-fallback',
    );

    dock.setAttribute(
      'data-glass-mode',
      'transparent-blur-saturation',
    );

    document.documentElement
      .setAttribute(
        'data-ubuzima-workspace-dock-build',
        BUILD_MARKER,
      );

    lastActiveKey = activeKey;
  } finally {
    isRendering = false;
  }
}

function handleIconError(
  event: Event,
): void {
  const target =
    event.target;

  if (
    !(target instanceof HTMLImageElement)
    || !target.hasAttribute(
      'data-dock-stable-icon',
    )
  ) {
    return;
  }

  if (
    target.dataset
      .dockFallbackApplied
    === 'true'
  ) {
    return;
  }

  target.dataset
    .dockFallbackApplied =
    'true';

  target.src =
    ICON_REGISTRY['module.svg'];
}

function handleDockClick(
  event: MouseEvent,
): void {
  const target =
    event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const closeButton =
    target.closest(
      '[data-recent-close-key]',
    );

  if (
    closeButton
    instanceof HTMLButtonElement
  ) {
    const key =
      closeButton.dataset
        .recentCloseKey
      || '';

    if (key) {
      removeRecentWorkspace(key);
      scheduleRender(true);
    }

    return;
  }

  const recentButton =
    target.closest(
      '[data-recent-open-key]',
    );

  if (
    recentButton
    instanceof HTMLButtonElement
  ) {
    const key =
      recentButton.dataset
        .recentOpenKey
      || '';

    const entry =
      readRecent().find(
        (candidate) =>
          candidate.key === key,
      );

    if (
      key
      && entry
    ) {
      navigateToModule(
        key,
        entry.scrollTop,
      );
    }

    return;
  }

  const moduleButton =
    target.closest(
      '[data-workspace-module-key]',
    );

  if (
    moduleButton
    instanceof HTMLButtonElement
  ) {
    const key =
      moduleButton.dataset
        .workspaceModuleKey
      || '';

    if (key) {
      navigateToModule(key);
    }
  }
}

function scheduleRender(
  forceStructure = false,
): void {
  window.clearTimeout(renderTimer);

  renderTimer =
    window.setTimeout(
      () => {
        renderDock(forceStructure);
      },
      90,
    );
}

function mutationBelongsToDock(
  mutation: MutationRecord,
): boolean {
  const target =
    mutation.target;

  const element =
    target instanceof Element
      ? target
      : target.parentElement;

  return Boolean(
    element?.closest(
      `[${DOCK_ATTRIBUTE}]`,
    ),
  );
}

function startDock(): void {
  if (
    window
      .__ubuzimaWorkspaceDockRefinedV4
  ) {
    return;
  }

  window
    .__ubuzimaWorkspaceDockRefinedV4 =
    true;

  renderDock(true);

  const observer =
    new MutationObserver(
      (mutations) => {
        const relevant =
          mutations.some(
            (mutation) =>
              !mutationBelongsToDock(
                mutation,
              ),
          );

        if (relevant) {
          scheduleRender(false);
        }
      },
    );

  observer.observe(
    document.body,
    {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'class',
        'aria-current',
        'aria-expanded',
        'data-section',
        'data-principal-menu',
      ],
    },
  );

  document.addEventListener(
    'click',
    (event) => {
      const target =
        event.target;

      if (
        target instanceof Element
        && !target.closest(
          `[${DOCK_ATTRIBUTE}]`,
        )
      ) {
        window.setTimeout(
          () => scheduleRender(false),
          60,
        );

        window.setTimeout(
          () => scheduleRender(false),
          240,
        );
      }
    },
    true,
  );

  window.addEventListener(
    'resize',
    () => scheduleRender(false),
    {
      passive: true,
    },
  );

  window.addEventListener(
    'orientationchange',
    () => scheduleRender(false),
    {
      passive: true,
    },
  );

  window.addEventListener(
    'pageshow',
    () => scheduleRender(true),
  );

  window.addEventListener(
    'popstate',
    () => scheduleRender(false),
  );

  window.addEventListener(
    'hashchange',
    () => scheduleRender(false),
  );

  window.addEventListener(
    'ubuzima:app-ready',
    () => scheduleRender(true),
  );

  window.setTimeout(
    () => renderDock(true),
    400,
  );

  window.setTimeout(
    () => renderDock(false),
    1200,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    startDock,
    {
      once: true,
    },
  );
} else {
  startDock();
}

export {};

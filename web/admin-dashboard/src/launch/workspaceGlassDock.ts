const BUILD_MARKER =
  'UBIZIMA_CONTINUOUS_MAC_WORKSPACE_DOCK_V7';

const ICON_MARKER =
  'UBIZIMA_AI_STYLE_PICTURE_ICON_FAMILY_V6';

const PHOTO_ICON_MARKER =
  'UBIZIMA_REAL_PICTURE_ICONS_NO_INITIALS_V6';

const PERFORMANCE_MARKER =
  'UBIZIMA_IMMEDIATE_DOCK_NAVIGATION_V6';

const CENTERING_MARKER =
  'UBIZIMA_SINGLE_CONTINUOUS_DOCK_RAIL_V7';

const STABILITY_MARKER =
  'UBIZIMA_RELIABLE_PERMISSION_MENU_BOOTSTRAP_V6D';

const EXPOSURE_MARKER =
  'UBIZIMA_MAIN_MODULES_OWN_DOCK_WIDTH_V7';

const RECENT_PRIORITY_MARKER =
  'UBIZIMA_RECENT_TASKS_REDUCE_BEFORE_MAIN_MODULES_V7';

const MAGNIFICATION_MARKER =
  'UBIZIMA_POINTER_DISTANCE_MAGNIFICATION_V7';

const CONTINUOUS_GLASS_MARKER =
  'UBIZIMA_SINGLE_CONTINUOUS_GLASS_CAPSULE_V7';

const OVERFLOW_MARKER =
  'UBIZIMA_MAIN_SCROLL_ONLY_AS_FINAL_FALLBACK_V7';

const PROFILE_VISIBILITY_MARKER =
  'UBIZIMA_SOLID_OPAQUE_PROFILE_POPOVER_V7C';

const SEPARATOR_VISIBILITY_MARKER =
  'UBIZIMA_HIGH_CONTRAST_MENU_RECENT_SEPARATOR_V7C';

const MOBILE_TASKBAR_REMOVAL_MARKER =
  'UBIZIMA_MOBILE_APP_TASKBAR_REMOVED_V7D';

const MOBILE_TASKBAR_STYLE_ID =
  'ubuzima-mobile-no-taskbar-v7d-style';

const MOUNT_MARKER =
  'UBIZIMA_SIDEBAR_HIDE_AFTER_DOCK_MOUNT_V6D';

const MINIMUM_MODULE_SIZE = 44;
const MAXIMUM_MODULE_SIZE = 57;
const RECENT_ICON_SIZE = 49;

const PROFILE_MARKER =
  'UBIZIMA_DOCK_PROFILE_HUB_V5';

const HEADER_MARKER =
  'UBIZIMA_SHARED_HEADER_RELOCATION_V5';

const RECENT_MARKER =
  'UBIZIMA_MAC_STYLE_ICON_ONLY_RECENT_TASKS_V7';

const GLASS_MARKER =
  'UBIZIMA_CONTINUOUS_GLASS_TRANSPARENCY_V7';

const NAVIGATION_MARKER =
  'UBIZIMA_ZERO_DELAY_AUTHORITATIVE_NAVIGATION_V6';

const MINIMUM_WIDTH = 768;
const MAXIMUM_RECENT = 3;

const ROOT_CLASS =
  'ubuzima-workspace-dock-v5-active';

const DOCK_ATTRIBUTE =
  'data-ubuzima-workspace-dock-v5';

const STYLE_ID =
  'ubuzima-workspace-dock-v5-style';

const TOOLTIP_ID =
  'ubuzima-workspace-dock-v5-tooltip';

const RECENT_STORAGE_KEY =
  'ubuzima_workspace_dock_recent_v5';

type DockModule = {
  key: string;
  label: string;
  icon: string;
  active: boolean;
  badge: number;
};

type RecentWorkspace = {
  key: string;
  label: string;
  scrollTop: number;
  updatedAt: number;
};

type ProfileSnapshot = {
  name: string;
  initials: string;
  language: string;
  websiteLabel: string;
  hasWebsite: boolean;
};

declare global {
  interface Window {
    __ubuzimaWorkspaceDockV5?: boolean;
  }
}

let renderFrame = 0;
let forceNextRender = false;
let navigationSequence = 0;
let pendingActiveKey = '';
let lastStructureSignature = '';
let isRendering = false;
let profileOpen = false;

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

function shouldSuppressDockForMobile(): boolean {
  return (
    isLikelyPhone()
    || window.matchMedia(
      '(max-width: 767px)',
    ).matches
  );
}

function installMobileTaskbarRemovalStyle(): void {
  if (
    document.getElementById(
      MOBILE_TASKBAR_STYLE_ID,
    )
  ) {
    return;
  }

  const style =
    document.createElement('style');

  style.id =
    MOBILE_TASKBAR_STYLE_ID;

  style.textContent = `
    @media (max-width: 767px) {
      .ubuzima-workspace-dock-v5,
      .ubuzima-workspace-dock-v4,
      .ubuzima-glass-workspace-dock,
      .desktop-dock,
      .source-dock,
      .desktop-taskbar,
      .workspace-taskbar,
      .taskbar,
      [data-ubuzima-workspace-dock-v5],
      [data-ubuzima-workspace-dock-v4],
      [data-ubuzima-workspace-dock-preview] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    }

    html[data-ubuzima-mobile-taskbar-removed="true"]
      .ubuzima-workspace-dock-v5,
    html[data-ubuzima-mobile-taskbar-removed="true"]
      .ubuzima-workspace-dock-v4,
    html[data-ubuzima-mobile-taskbar-removed="true"]
      .ubuzima-glass-workspace-dock,
    html[data-ubuzima-mobile-taskbar-removed="true"]
      .desktop-dock,
    html[data-ubuzima-mobile-taskbar-removed="true"]
      .source-dock,
    html[data-ubuzima-mobile-taskbar-removed="true"]
      .desktop-taskbar,
    html[data-ubuzima-mobile-taskbar-removed="true"]
      .workspace-taskbar,
    html[data-ubuzima-mobile-taskbar-removed="true"]
      .taskbar,
    html[data-ubuzima-mobile-taskbar-removed="true"]
      [data-ubuzima-workspace-dock-v5],
    html[data-ubuzima-mobile-taskbar-removed="true"]
      [data-ubuzima-workspace-dock-v4],
    html[data-ubuzima-mobile-taskbar-removed="true"]
      [data-ubuzima-workspace-dock-preview] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;

  document.head.appendChild(style);
}

function removeMobileTaskbarDom(): void {
  const selectors = [
    '[data-ubuzima-workspace-dock-v5]',
    '[data-ubuzima-workspace-dock-v4]',
    '[data-ubuzima-workspace-dock-preview]',
    '.ubuzima-workspace-dock-v5',
    '.ubuzima-workspace-dock-v4',
    '.ubuzima-glass-workspace-dock',
    '.desktop-dock',
    '.source-dock',
    '.desktop-taskbar',
    '.workspace-taskbar',
    '.taskbar',
    '[class*="taskbar"]',
    '[id*="taskbar"]',
  ];

  document
    .querySelectorAll<HTMLElement>(
      selectors.join(','),
    )
    .forEach((element) => {
      if (
        element.classList.contains(
          'ubuzima-mobile-bottom-nav',
        )
      ) {
        return;
      }

      element.remove();
    });
}

function enforceMobileNoTaskbar(): void {
  if (!shouldSuppressDockForMobile()) {
    return;
  }

  installMobileTaskbarRemovalStyle();

  document.documentElement
    .classList.remove(ROOT_CLASS);

  document.documentElement
    .setAttribute(
      'data-ubuzima-mobile-taskbar-removed',
      'true',
    );

  document.documentElement
    .setAttribute(
      'data-ubuzima-mobile-taskbar-removal-marker',
      MOBILE_TASKBAR_REMOVAL_MARKER,
    );

  document.documentElement
    .removeAttribute(
      'data-ubuzima-workspace-dock-mounted',
    );

  document.documentElement
    .setAttribute(
      'data-ubuzima-workspace-dock-bootstrap',
      'mobile-taskbar-disabled',
    );

  removeMobileTaskbarDom();
  hideTooltip();
}

function shouldRenderDock(): boolean {
  return (
    window.innerWidth >= MINIMUM_WIDTH
    && !shouldSuppressDockForMobile()
  );
}

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normaliseKey(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hashValue(
  value: string,
): number {
  let hash = 2166136261;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^= value.charCodeAt(index);

    hash = Math.imul(
      hash,
      16777619,
    );
  }

  return hash >>> 0;
}

type DockIconName =
  | 'admin.svg'
  | 'ai.svg'
  | 'dashboard.svg'
  | 'email.svg'
  | 'finance.svg'
  | 'general-stock.svg'
  | 'home.svg'
  | 'insurance.svg'
  | 'inventory.svg'
  | 'module.svg'
  | 'pharmacy.svg'
  | 'pos.svg'
  | 'procurement.svg'
  | 'product-master.svg'
  | 'reports.svg'
  | 'sales.svg'
  | 'settings.svg'
  | 'suppliers.svg'
  | 'tenant.svg'
  | 'users.svg';

const DOCK_ICON_ASSETS:
  Record<DockIconName, string> = {
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

const FALLBACK_PICTURE_CACHE =
  new Map<string, string>();

function semanticIconName(
  key: string,
  label: string,
): DockIconName | null {
  const identity =
    `${key} ${label}`.toLowerCase();

  if (
    key === 'dashboard'
    || key === 'overview'
    || identity.includes(
      'business overview',
    )
  ) {
    return 'dashboard.svg';
  }

  if (
    key === 'corporate-email'
    || identity.includes('email')
    || identity.includes('mail')
    || identity.includes(
      'communication',
    )
  ) {
    return 'email.svg';
  }

  if (
    identity.includes(
      'artificial intelligence',
    )
    || identity.includes(' ai')
    || key === 'ai'
    || key.startsWith('ai-')
  ) {
    return 'ai.svg';
  }

  if (
    identity.includes(
      'product master',
    )
  ) {
    return 'product-master.svg';
  }

  if (
    identity.includes(
      'general stock',
    )
  ) {
    return 'general-stock.svg';
  }

  if (
    identity.includes(
      'point of sale',
    )
    || key === 'pos'
    || key.startsWith('pos-')
  ) {
    return 'pos.svg';
  }

  if (
    identity.includes('inventory')
    || identity.includes(
      'stock control',
    )
    || identity.includes(
      'stock pick',
    )
  ) {
    return 'inventory.svg';
  }

  if (
    identity.includes('procurement')
    || identity.includes(
      'purchase order',
    )
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
    || identity.includes('accounting')
    || identity.includes('ledger')
    || identity.includes(
      'reconciliation',
    )
  ) {
    return 'finance.svg';
  }

  if (
    identity.includes('insurance')
    || identity.includes('claim')
    || identity.includes('payer')
  ) {
    return 'insurance.svg';
  }

  if (
    identity.includes('report')
    || identity.includes('analytics')
    || identity.includes(
      'business intelligence',
    )
  ) {
    return 'reports.svg';
  }

  if (
    identity.includes('sales')
    || identity.includes(
      'sales register',
    )
  ) {
    return 'sales.svg';
  }

  if (
    identity.includes('pharmacy')
    || identity.includes(
      'dispensing',
    )
    || identity.includes(
      'prescription',
    )
  ) {
    return 'pharmacy.svg';
  }

  if (
    identity.includes('tenant')
    || identity.includes('branch')
    || identity.includes(
      'institution',
    )
  ) {
    return 'tenant.svg';
  }

  if (
    identity.includes('user')
    || identity.includes('staff')
    || identity.includes('role')
    || identity.includes(
      'permission',
    )
    || identity.includes('access')
    || identity.includes('profile')
  ) {
    return 'users.svg';
  }

  if (
    identity.includes('admin')
    || identity.includes(
      'platform management',
    )
  ) {
    return 'admin.svg';
  }

  if (
    identity.includes('setting')
    || identity.includes(
      'configuration',
    )
  ) {
    return 'settings.svg';
  }

  if (
    identity.includes('home')
  ) {
    return 'home.svg';
  }

  return null;
}

function fallbackPictureDataUri(
  key: string,
  label: string,
): string {
  const cacheKey =
    `${key}:${label}`;

  const cached =
    FALLBACK_PICTURE_CACHE.get(
      cacheKey,
    );

  if (cached) {
    return cached;
  }

  const hash =
    hashValue(cacheKey);

  const firstHue =
    hash % 360;

  const secondHue =
    (
      firstHue
      + 58
      + (
        hash % 67
      )
    ) % 360;

  const rotation =
    hash % 180;

  const point =
    15
    + (
      hash % 20
    );

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      role="img"
      aria-label="${escapeHtml(label)}"
    >
      <defs>
        <linearGradient
          id="fallback-gradient"
          x1="4"
          y1="5"
          x2="59"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset="0"
            stop-color="hsl(${firstHue} 91% 63%)"
          />

          <stop
            offset="1"
            stop-color="hsl(${secondHue} 84% 48%)"
          />
        </linearGradient>
      </defs>

      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="18"
        fill="url(#fallback-gradient)"
      />

      <circle
        cx="19"
        cy="17"
        r="12"
        fill="white"
        fill-opacity="0.18"
      />

      <g
        transform="rotate(${rotation} 32 32)"
        fill="none"
        stroke="white"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M${point} 32h${49 - point}"
        />

        <path
          d="M32 ${point}v${49 - point}"
        />

        <rect
          x="19"
          y="19"
          width="26"
          height="26"
          rx="9"
          stroke-opacity="0.72"
        />

        <circle
          cx="32"
          cy="32"
          r="7"
          fill="white"
          fill-opacity="0.20"
        />
      </g>
    </svg>
  `;

  const uri =
    'data:image/svg+xml;charset=UTF-8,'
    + encodeURIComponent(
      svg.trim(),
    );

  FALLBACK_PICTURE_CACHE.set(
    cacheKey,
    uri,
  );

  return uri;
}

function moduleIconUrl(
  key: string,
  label: string,
): string {
  const semantic =
    semanticIconName(
      key,
      label,
    );

  if (semantic) {
    return DOCK_ICON_ASSETS[
      semantic
    ];
  }

  return fallbackPictureDataUri(
    key,
    label,
  );
}

function moduleHue(
  key: string,
): number {
  return hashValue(key) % 360;
}

function profileFallbackInitials(
  name: string,
): string {
  const words =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (words.length === 0) {
    return 'U';
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    (
      words[0][0]
      || ''
    )
    + (
      words[
        words.length - 1
      ][0]
      || ''
    )
  ).toUpperCase();
}

function sourceButtonForKey(
  key: string,
): HTMLButtonElement | null {
  if (
    key === 'dashboard'
    || key === 'overview'
  ) {
    const dashboard =
      document.querySelector(
        '.sidebar[data-admin-sidebar] '
        + '.principal-menu-button'
        + '[data-section="overview"]',
      );

    return (
      dashboard
      instanceof HTMLButtonElement
        ? dashboard
        : null
    );
  }

  if (key === 'corporate-email') {
    const emailButton =
      document.querySelector(
        '.dashboard-header '
        + '.header-mail-button',
      );

    return (
      emailButton
      instanceof HTMLButtonElement
        ? emailButton
        : null
    );
  }

  const section =
    document.querySelector<HTMLElement>(
      '.sidebar[data-admin-sidebar] '
      + `.principal-menu-section`
      + `[data-principal-menu="${CSS.escape(key)}"]`,
    );

  const button =
    section?.querySelector(
      '.principal-menu-button'
      + '[data-section]',
    );

  return (
    button
    instanceof HTMLButtonElement
      ? button
      : null
  );
}

function currentHeaderTitle(): string {
  return (
    document
      .querySelector<HTMLElement>(
        '.dashboard-title-card h1',
      )
      ?.textContent
      ?.trim()
    || ''
  );
}

function moduleIsActive(
  key: string,
): boolean {
  if (key === 'corporate-email') {
    return (
      currentHeaderTitle()
        .toLowerCase()
        .includes(
          'corporate email',
        )
    );
  }

  const button =
    sourceButtonForKey(key);

  const section =
    button?.closest(
      '.principal-menu-section',
    );

  return Boolean(
    button?.classList
      .contains('active')
    || button?.getAttribute(
      'aria-current',
    ) === 'page'
    || section?.classList
      .contains('active')
  );
}

function unreadEmailCount(): number {
  const badge =
    document.querySelector<HTMLElement>(
      '.dashboard-header '
      + '.header-mail-button '
      + '.action-badge',
    );

  const parsed =
    Number(
      badge?.textContent?.trim()
      || 0,
    );

  return Number.isFinite(parsed)
    ? Math.max(
      0,
      parsed,
    )
    : 0;
}

function discoverModules(): DockModule[] {
  const modules: DockModule[] = [];
  const seen = new Set<string>();

  const dashboard =
    sourceButtonForKey('dashboard');

  if (dashboard) {
    modules.push({
      key: 'dashboard',
      label:
        dashboard
          .querySelector<HTMLElement>(
            '.principal-menu-title',
          )
          ?.textContent
          ?.trim()
        || 'Dashboard',
      icon:
        moduleIconUrl(
          'dashboard',
          'Dashboard',
        ),
      active:
        moduleIsActive(
          'dashboard',
        ),
      badge: 0,
    });

    seen.add('dashboard');
  }

  const emailButton =
    sourceButtonForKey(
      'corporate-email',
    );

  if (emailButton) {
    modules.push({
      key: 'corporate-email',
      label: 'Corporate Email',
      icon:
        moduleIconUrl(
          'corporate-email',
          'Corporate Email',
        ),
      active:
        moduleIsActive(
          'corporate-email',
        ),
      badge:
        unreadEmailCount(),
    });

    seen.add(
      'corporate-email',
    );
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
        !(
          button
          instanceof HTMLButtonElement
        )
      ) {
        return;
      }

      const rawKey =
        section.dataset
          .principalMenu
        || button.dataset.section
        || '';

      const label =
        button
          .querySelector<HTMLElement>(
            '.principal-menu-title',
          )
          ?.textContent
          ?.trim()
        || button
          .textContent
          ?.trim()
        || rawKey
        || 'Module';

      const key =
        rawKey
        || normaliseKey(label);

      if (
        !key
        || seen.has(key)
        || key === 'overview'
        || key === 'corporate-email'
      ) {
        return;
      }

      modules.push({
        key,
        label,
        icon:
          moduleIconUrl(
            key,
            label,
          ),
        active:
          moduleIsActive(key),
        badge: 0,
      });

      seen.add(key);
    });

  return modules;
}

function profileSnapshot(): ProfileSnapshot {
  const avatarImage =
    document.querySelector<HTMLImageElement>(
      '.dashboard-header '
      + '.profile-avatar-button img',
    );

  const avatarText =
    document.querySelector<HTMLElement>(
      '.dashboard-header '
      + '.profile-avatar-button span',
    );

  const name =
    avatarImage?.alt?.trim()
    || 'Staff Profile';

  const initials =
    avatarText?.textContent?.trim()
    || profileFallbackInitials(name);

  const language =
    document
      .querySelector<HTMLElement>(
        '.dashboard-header '
        + '.language-corner-button',
      )
      ?.textContent
      ?.trim()
    || 'Language';

  const websiteAnchor =
    document.querySelector<HTMLAnchorElement>(
      '.dashboard-header-center-actions '
      + 'a[target="_blank"]',
    );

  return {
    name,
    initials,
    language,
    websiteLabel:
      websiteAnchor
        ?.textContent
        ?.trim()
      || 'Visit Website',
    hasWebsite:
      Boolean(
        websiteAnchor?.href,
      ),
  };
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
    document.scrollingElement
      ?.scrollTop
    ?? window.scrollY
    ?? 0
  );
}

function restoreScrollTop(
  value: number,
): void {
  const scrollTop =
    Number.isFinite(value)
      ? Math.max(0, value)
      : 0;

  const apply = (): void => {
    const panel =
      document.querySelector<HTMLElement>(
        '.dashboard-scroll-panel',
      );

    if (panel) {
      panel.scrollTop =
        scrollTop;

      return;
    }

    window.scrollTo({
      top: scrollTop,
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
        || typeof record.label
          !== 'string'
      ) {
        return;
      }

      entries.push({
        key: record.key,
        label: record.label,
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
    // Dock navigation remains available.
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
    scrollTop,
    updatedAt: Date.now(),
  });

  writeRecent(entries);
}

function rememberCurrentWorkspace(): void {
  const current =
    discoverModules().find(
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

function removeRecent(
  key: string,
): void {
  writeRecent(
    readRecent().filter(
      (entry) =>
        entry.key !== key,
    ),
  );
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

  return readRecent()
    .filter(
      (entry) =>
        moduleMap.has(entry.key),
    )
    .map((entry) => ({
      ...entry,
      label:
        moduleMap.get(
          entry.key,
        )?.label
        || entry.label,
    }))
    .slice(
      0,
      MAXIMUM_RECENT,
    );
}

function applyOptimisticActiveState(
  key: string,
): void {
  const dock =
    document.querySelector<HTMLElement>(
      `[${DOCK_ATTRIBUTE}]`,
    );

  if (!dock) {
    return;
  }

  dock
    .querySelectorAll<HTMLElement>(
      '[data-workspace-module-key]',
    )
    .forEach((button) => {
      const active =
        button.dataset
          .workspaceModuleKey
        === key;

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
      card.classList.toggle(
        'is-current',
        card.dataset
          .recentTaskKey
        === key,
      );
    });

  dock.setAttribute(
    'data-pending-active-key',
    key,
  );
}

function invokeModule(
  key: string,
): boolean {
  const button =
    sourceButtonForKey(key);

  if (!button) {
    return false;
  }

  try {
    button.focus({
      preventScroll: true,
    });
  } catch {
    button.focus();
  }

  button.click();

  window.dispatchEvent(
    new CustomEvent(
      'ubuzima:workspace-dock-navigation',
      {
        detail: {
          key,
          marker:
            NAVIGATION_MARKER,
          response:
            'immediate-primary-click',
        },
      },
    ),
  );

  if (
    key === 'dashboard'
    || key === 'corporate-email'
  ) {
    return true;
  }

  const section =
    document.querySelector<HTMLElement>(
      '.sidebar[data-admin-sidebar] '
      + '.principal-menu-section'
      + `[data-principal-menu="${CSS.escape(key)}"]`,
    );

  const firstChild =
    section?.querySelector(
      '.tree-child-submenu '
      + 'button[data-section]'
      + '[data-submenu]',
    );

  if (
    firstChild
    instanceof HTMLButtonElement
  ) {
    window.requestAnimationFrame(
      () => {
        if (!moduleIsActive(key)) {
          firstChild.click();

          window.dispatchEvent(
            new CustomEvent(
              'ubuzima:workspace-dock-submenu-navigation',
              {
                detail: {
                  key,
                  marker:
                    NAVIGATION_MARKER,
                  response:
                    'next-animation-frame',
                },
              },
            ),
          );
        }
      },
    );
  }

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
      (module) =>
        module.key === key,
    );

  if (!target) {
    removeRecent(key);
    scheduleRender(true);
    return;
  }

  const sequence =
    ++navigationSequence;

  pendingActiveKey =
    key;

  rememberCurrentWorkspace();

  rememberWorkspace(
    target,
    restoreScroll ?? 0,
  );

  profileOpen = false;

  hideTooltip();

  applyOptimisticActiveState(
    key,
  );

  if (!invokeModule(key)) {
    pendingActiveKey = '';
    removeRecent(key);
    scheduleRender(true);
    return;
  }

  scheduleRender(false);

  if (
    typeof restoreScroll
    === 'number'
  ) {
    window.requestAnimationFrame(
      () => {
        if (
          sequence
          === navigationSequence
        ) {
          restoreScrollTop(
            restoreScroll,
          );
        }
      },
    );
  }

  window.requestAnimationFrame(
    () => {
      if (
        sequence
        !== navigationSequence
      ) {
        return;
      }

      scheduleRender(false);

      window.requestAnimationFrame(
        () => {
          if (
            sequence
            === navigationSequence
          ) {
            scheduleRender(false);
          }
        },
      );
    },
  );

  window.setTimeout(
    () => {
      if (
        sequence
        !== navigationSequence
      ) {
        return;
      }

      const active =
        discoverModules().find(
          (module) =>
            module.active,
        )?.key
        || '';

      if (
        active === key
      ) {
        pendingActiveKey = '';
      }

      scheduleRender(false);
    },
    180,
  );
}

function findButtonByText(
  root: ParentNode,
  label: string,
): HTMLButtonElement | null {
  const expected =
    label.trim().toLowerCase();

  const buttons =
    root.querySelectorAll<HTMLButtonElement>(
      'button',
    );

  for (const button of buttons) {
    const text =
      button
        .textContent
        ?.trim()
        .toLowerCase()
      || '';

    if (text === expected) {
      return button;
    }
  }

  return null;
}

function ensureOriginalProfileMenu(
  callback: (
    popover: HTMLElement,
  ) => void,
): void {
  const existing =
    document.querySelector<HTMLElement>(
      '.dashboard-header '
      + '.profile-popover',
    );

  if (existing) {
    callback(existing);
    return;
  }

  const avatarButton =
    document.querySelector<HTMLButtonElement>(
      '.dashboard-header '
      + '.profile-avatar-button',
    );

  avatarButton?.click();

  window.setTimeout(
    () => {
      const popover =
        document.querySelector<HTMLElement>(
          '.dashboard-header '
          + '.profile-popover',
        );

      if (popover) {
        callback(popover);
      }
    },
    70,
  );
}

function performProfileAction(
  action: string,
): void {
  profileOpen = false;

  if (action === 'language') {
    document
      .querySelector<HTMLButtonElement>(
        '.dashboard-header '
        + '.language-corner-button',
      )
      ?.click();

    window.setTimeout(
      () => scheduleRender(true),
      120,
    );

    return;
  }

  if (action === 'website') {
    const anchor =
      document.querySelector<HTMLAnchorElement>(
        '.dashboard-header-center-actions '
        + 'a[target="_blank"]',
      );

    if (anchor?.href) {
      window.open(
        anchor.href,
        '_blank',
        'noopener,noreferrer',
      );
    }

    scheduleRender(true);
    return;
  }

  if (action === 'back') {
    const buttons =
      document.querySelectorAll<HTMLButtonElement>(
        '.dashboard-header-center-actions button',
      );

    for (const button of buttons) {
      if (
        button.textContent
          ?.trim()
          .toLowerCase()
        === 'back'
      ) {
        button.click();
        break;
      }
    }

    scheduleRender(true);
    return;
  }

  if (action === 'sign-out') {
    document
      .querySelector<HTMLButtonElement>(
        '.sidebar[data-admin-sidebar] '
        + '.logout-button',
      )
      ?.click();

    return;
  }

  const label =
    action === 'edit-profile'
      ? 'Edit Profile'
      : action === 'change-password'
        ? 'Change Password'
        : '';

  if (!label) {
    scheduleRender(true);
    return;
  }

  ensureOriginalProfileMenu(
    (popover) => {
      findButtonByText(
        popover,
        label,
      )?.click();

      scheduleRender(true);
    },
  );
}

function ensureTooltip(): HTMLElement {
  const existing =
    document.getElementById(
      TOOLTIP_ID,
    );

  if (existing) {
    return existing;
  }

  const tooltip =
    document.createElement('div');

  tooltip.id =
    TOOLTIP_ID;

  tooltip.className =
    'ubuzima-workspace-dock-v5__tooltip';

  tooltip.setAttribute(
    'role',
    'tooltip',
  );

  document.body.appendChild(
    tooltip,
  );

  return tooltip;
}

function showTooltip(
  target: HTMLElement,
): void {
  const label =
    target.dataset.dockTooltip
    || '';

  if (!label) {
    return;
  }

  const tooltip =
    ensureTooltip();

  tooltip.textContent =
    label;

  tooltip.classList.add(
    'is-visible',
  );

  const rect =
    target.getBoundingClientRect();

  const tooltipRect =
    tooltip.getBoundingClientRect();

  const left =
    Math.min(
      window.innerWidth
        - tooltipRect.width
        - 10,
      Math.max(
        10,
        rect.left
          + (
            rect.width
            / 2
          )
          - (
            tooltipRect.width
            / 2
          ),
      ),
    );

  const top =
    Math.max(
      8,
      rect.top
        - tooltipRect.height
        - 10,
    );

  tooltip.style.left =
    `${left}px`;

  tooltip.style.top =
    `${top}px`;
}

function hideTooltip(): void {
  document
    .getElementById(
      TOOLTIP_ID,
    )
    ?.classList.remove(
      'is-visible',
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

  style.id =
    STYLE_ID;

  style.textContent = `
    @media (min-width: 768px) {
      html.${ROOT_CLASS} {
        --ubuzima-workspace-dock-safe-area:
          96px;
      }

      html.${ROOT_CLASS}
        .sidebar[data-admin-sidebar] {
        display: none !important;
      }

      html.${ROOT_CLASS}
        .dashboard-header.dashboard-header--fixed.dashboard-header--refined,
      html.${ROOT_CLASS}
        .mail-notification-banner {
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
        padding-top: 0 !important;
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

      .ubuzima-workspace-dock-v5 {
        position: fixed;
        z-index: 9998;
        left: 50%;
        bottom:
          max(
            12px,
            env(safe-area-inset-bottom)
          );

        width:
          min(
            1420px,
            calc(100vw - 26px)
          );
        height: 76px;
        max-width:
          calc(100vw - 26px);

        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          minmax(220px, 390px);
        align-items: stretch;
        gap: 7px;

        padding: 7px;

        border:
          1px solid
          rgba(255, 255, 255, 0.50);
        border-radius: 25px;

        background:
          linear-gradient(
            138deg,
            rgba(255, 255, 255, 0.17),
            rgba(225, 249, 243, 0.08)
              48%,
            rgba(207, 239, 233, 0.13)
          );

        box-shadow:
          0 28px 74px
            rgba(13, 39, 35, 0.20),
          0 8px 25px
            rgba(15, 118, 110, 0.07),
          inset 0 1px 0
            rgba(255, 255, 255, 0.62),
          inset 0 -1px 0
            rgba(255, 255, 255, 0.12);

        -webkit-backdrop-filter:
          blur(32px)
          saturate(1.82)
          contrast(1.04);

        backdrop-filter:
          blur(32px)
          saturate(1.82)
          contrast(1.04);

        transform:
          translateX(-50%);

        isolation: isolate;
        overflow: visible;
        box-sizing: border-box;
      }

      .ubuzima-workspace-dock-v5::before {
        content: '';
        position: absolute;
        z-index: -1;
        inset: 1px;

        border-radius: 23px;

        background:
          linear-gradient(
            118deg,
            rgba(255, 255, 255, 0.17),
            transparent 38%,
            rgba(29, 181, 160, 0.035)
          );

        pointer-events: none;
      }

      .ubuzima-workspace-dock-v5__modules {
        min-width: 0;

        display: flex;
        align-items: center;
        gap: 5px;

        padding: 4px 6px;

        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;

        border:
          1px solid
          rgba(255, 255, 255, 0.30);
        border-radius: 18px;

        background:
          rgba(255, 255, 255, 0.055);

        box-shadow:
          inset 0 1px 0
            rgba(255, 255, 255, 0.32);
      }

      .ubuzima-workspace-dock-v5__modules::-webkit-scrollbar,
      .ubuzima-workspace-dock-v5__recent-list::-webkit-scrollbar {
        display: none;
      }

      .ubuzima-workspace-dock-v5__module,
      .ubuzima-workspace-dock-v5__profile {
        position: relative;

        width: 57px;
        min-width: 57px;
        height: 57px;
        min-height: 57px;
        flex: 0 0 57px;

        display: grid;
        place-items: center;

        padding: 4px;

        border:
          1px solid
          rgba(255, 255, 255, 0.30);
        border-radius: 17px;

        background:
          rgba(255, 255, 255, 0.08);

        color: #153e38;
        cursor: pointer;

        box-shadow:
          inset 0 1px 0
            rgba(255, 255, 255, 0.40);

        transition:
          background-color 120ms ease,
          border-color 120ms ease,
          box-shadow 120ms ease;

        transform: none !important;
        scale: 1 !important;
        box-sizing: border-box;
      }

      .ubuzima-workspace-dock-v5__module:hover,
      .ubuzima-workspace-dock-v5__module:focus-visible,
      .ubuzima-workspace-dock-v5__profile:hover,
      .ubuzima-workspace-dock-v5__profile:focus-visible {
        outline: none;

        background:
          rgba(255, 255, 255, 0.24);

        border-color:
          rgba(255, 255, 255, 0.62);

        box-shadow:
          0 8px 18px
            rgba(20, 83, 73, 0.10),
          inset 0 1px 0
            rgba(255, 255, 255, 0.62);
      }

      .ubuzima-workspace-dock-v5__module.is-active,
      .ubuzima-workspace-dock-v5__profile.is-open {
        background:
          rgba(224, 249, 243, 0.37);

        border-color:
          rgba(15, 118, 110, 0.35);

        box-shadow:
          0 0 0 2px
            rgba(15, 118, 110, 0.08),
          0 8px 18px
            rgba(15, 118, 110, 0.10),
          inset 0 1px 0
            rgba(255, 255, 255, 0.72);
      }

      .ubuzima-workspace-dock-v5__icon {
        width: 43px !important;
        min-width: 43px !important;
        max-width: 43px !important;
        height: 43px !important;
        min-height: 43px !important;
        max-height: 43px !important;

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

      .ubuzima-workspace-dock-v5__active-dot {
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

      .ubuzima-workspace-dock-v5__module.is-active
        .ubuzima-workspace-dock-v5__active-dot {
        background: #0f766e;

        box-shadow:
          0 0 0 2px
            rgba(255, 255, 255, 0.72);
      }

      .ubuzima-workspace-dock-v5__badge {
        position: absolute;
        top: -4px;
        right: -4px;

        min-width: 18px;
        height: 18px;

        display: grid;
        place-items: center;

        padding: 0 4px;

        border:
          2px solid
          rgba(245, 255, 252, 0.86);
        border-radius: 999px;

        background: #d94646;
        color: white;

        font-size: 8px;
        font-weight: 950;
        line-height: 1;
      }

      .ubuzima-workspace-dock-v5__divider {
        width: 1px;
        min-width: 1px;
        height: 36px;
        flex: 0 0 1px;

        margin: 0 2px;

        background:
          linear-gradient(
            transparent,
            rgba(255, 255, 255, 0.54),
            transparent
          );
      }

      .ubuzima-workspace-dock-v5__recent {
        min-width: 0;

        display: grid;
        grid-template-rows:
          18px 43px;
        gap: 3px;

        padding: 4px 5px;

        border:
          1px solid
          rgba(255, 255, 255, 0.31);
        border-radius: 18px;

        background:
          rgba(255, 255, 255, 0.055);

        box-shadow:
          inset 0 1px 0
            rgba(255, 255, 255, 0.34);

        overflow: hidden;
        box-sizing: border-box;
      }

      .ubuzima-workspace-dock-v5__recent-header {
        min-width: 0;

        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;

        padding: 0 3px;
      }

      .ubuzima-workspace-dock-v5__recent-header strong {
        color: #1c4b44;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.04em;
      }

      .ubuzima-workspace-dock-v5__recent-count {
        min-width: 17px;
        height: 17px;

        display: inline-grid;
        place-items: center;

        border:
          1px solid
          rgba(15, 118, 110, 0.16);
        border-radius: 999px;

        background:
          rgba(255, 255, 255, 0.23);

        color: #0f766e;

        font-size: 8px;
        font-weight: 950;
      }

      .ubuzima-workspace-dock-v5__recent-list {
        min-width: 0;
        height: 43px;

        display: flex;
        align-items: stretch;
        gap: 5px;

        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
      }

      .ubuzima-workspace-dock-v5__recent-card {
        position: relative;

        width: 126px;
        min-width: 126px;
        height: 43px;
        min-height: 43px;
        flex: 0 0 126px;

        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          20px;

        border:
          1px solid
          rgba(255, 255, 255, 0.31);
        border-radius: 13px;

        background:
          rgba(255, 255, 255, 0.075);

        box-shadow:
          inset 0 1px 0
            rgba(255, 255, 255, 0.35);

        overflow: hidden;
        box-sizing: border-box;
      }

      .ubuzima-workspace-dock-v5__recent-card.is-current {
        border-color:
          rgba(15, 118, 110, 0.30);

        background:
          rgba(224, 249, 243, 0.25);
      }

      .ubuzima-workspace-dock-v5__recent-open {
        min-width: 0;
        height: 41px;

        display: grid;
        grid-template-columns:
          31px minmax(0, 1fr);
        align-items: center;
        gap: 6px;

        padding: 4px 3px 4px 5px;

        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        text-align: left;

        transform: none !important;
        scale: 1 !important;
      }

      .ubuzima-workspace-dock-v5__recent-icon {
        width: 31px !important;
        min-width: 31px !important;
        max-width: 31px !important;
        height: 31px !important;
        min-height: 31px !important;
        max-height: 31px !important;

        display: block !important;
        object-fit: contain !important;

        transform: none !important;
        scale: 1 !important;
        filter: none !important;

        pointer-events: none;
      }

      .ubuzima-workspace-dock-v5__recent-name {
        min-width: 0;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        color: #173f39;

        font-size: 9px;
        font-weight: 900;
        line-height: 1.05;
      }

      .ubuzima-workspace-dock-v5__recent-close {
        width: 20px;
        min-width: 20px;
        height: 41px;

        display: grid;
        place-items: center;

        padding: 0;

        border: 0;
        border-left:
          1px solid
          rgba(255, 255, 255, 0.20);

        background:
          rgba(255, 255, 255, 0.04);
        color: #64827c;

        cursor: pointer;
        font-size: 13px;
        font-weight: 850;

        transform: none !important;
        scale: 1 !important;
      }

      .ubuzima-workspace-dock-v5__recent-close:hover {
        background:
          rgba(255, 255, 255, 0.21);
        color: #9f3030;
      }

      .ubuzima-workspace-dock-v5__recent-empty {
        width: 100%;
        height: 43px;

        display: flex;
        align-items: center;

        padding: 0 9px;

        border:
          1px dashed
          rgba(15, 118, 110, 0.17);
        border-radius: 12px;

        color: #62817c;
        background:
          rgba(255, 255, 255, 0.045);

        font-size: 8px;
        font-weight: 750;
        line-height: 1.2;

        box-sizing: border-box;
      }

      .ubuzima-workspace-dock-v5__profile-popover {
        position: absolute;
        z-index: 2;
        left: 7px;
        bottom: calc(100% + 10px);

        width: min(310px, calc(100vw - 32px));

        display: grid;
        gap: 8px;

        padding: 11px;

        border:
          1px solid
          rgba(255, 255, 255, 0.55);
        border-radius: 19px;

        background:
          linear-gradient(
            145deg,
            rgba(255, 255, 255, 0.55),
            rgba(229, 249, 244, 0.34)
          );

        box-shadow:
          0 22px 58px
            rgba(13, 39, 35, 0.23),
          inset 0 1px 0
            rgba(255, 255, 255, 0.75);

        -webkit-backdrop-filter:
          blur(30px)
          saturate(1.76);

        backdrop-filter:
          blur(30px)
          saturate(1.76);
      }

      .ubuzima-workspace-dock-v5__profile-summary {
        display: grid;
        grid-template-columns:
          42px minmax(0, 1fr);
        align-items: center;
        gap: 9px;

        padding: 3px;
      }

      .ubuzima-workspace-dock-v5__profile-summary img {
        width: 42px;
        height: 42px;

        display: block;

        border-radius: 14px;
      }

      .ubuzima-workspace-dock-v5__profile-summary div {
        min-width: 0;

        display: grid;
        gap: 2px;
      }

      .ubuzima-workspace-dock-v5__profile-summary strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        color: #173f39;
        font-size: 12px;
        font-weight: 900;
      }

      .ubuzima-workspace-dock-v5__profile-summary small {
        color: #62817c;
        font-size: 8px;
        font-weight: 750;
      }

      .ubuzima-workspace-dock-v5__profile-actions {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 6px;
      }

      .ubuzima-workspace-dock-v5__profile-action {
        min-width: 0;
        min-height: 35px;

        display: flex;
        align-items: center;
        justify-content: center;

        padding: 6px 8px;

        border:
          1px solid
          rgba(255, 255, 255, 0.55);
        border-radius: 11px;

        background:
          rgba(255, 255, 255, 0.26);
        color: #244b45;

        cursor: pointer;
        font-size: 9px;
        font-weight: 850;
        text-align: center;
        text-decoration: none;

        box-shadow:
          inset 0 1px 0
            rgba(255, 255, 255, 0.55);
      }

      .ubuzima-workspace-dock-v5__profile-action:hover,
      .ubuzima-workspace-dock-v5__profile-action:focus-visible {
        outline: none;

        background:
          rgba(255, 255, 255, 0.48);

        border-color:
          rgba(15, 118, 110, 0.25);
      }

      .ubuzima-workspace-dock-v5__profile-action--danger {
        color: #9f3030;
      }

      .ubuzima-workspace-dock-v5__tooltip {
        position: fixed;
        z-index: 2147483000;

        max-width: 210px;

        padding: 6px 9px;

        border:
          1px solid
          rgba(255, 255, 255, 0.55);
        border-radius: 9px;

        background:
          rgba(20, 55, 49, 0.90);
        color: white;

        box-shadow:
          0 8px 20px
            rgba(8, 31, 27, 0.20);

        opacity: 0;
        visibility: hidden;
        pointer-events: none;

        font-size: 9px;
        font-weight: 800;
        line-height: 1.15;

        transition:
          opacity 90ms ease,
          visibility 90ms ease;
      }

      .ubuzima-workspace-dock-v5__tooltip.is-visible {
        opacity: 1;
        visibility: visible;
      }
    }

    @media (
      min-width: 768px
    ) and (
      max-width: 1023px
    ) {
      .ubuzima-workspace-dock-v5 {
        grid-template-columns:
          minmax(0, 1fr)
          minmax(190px, 34vw);
      }

      .ubuzima-workspace-dock-v5__module,
      .ubuzima-workspace-dock-v5__profile {
        width: 53px;
        min-width: 53px;
        flex-basis: 53px;
      }

      .ubuzima-workspace-dock-v5__icon {
        width: 40px !important;
        min-width: 40px !important;
        max-width: 40px !important;
        height: 40px !important;
        min-height: 40px !important;
        max-height: 40px !important;
      }

      .ubuzima-workspace-dock-v5__recent-card {
        width: 112px;
        min-width: 112px;
        flex-basis: 112px;
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
      .ubuzima-workspace-dock-v5 {
        background:
          rgba(241, 251, 248, 0.90);
      }

      .ubuzima-workspace-dock-v5__profile-popover {
        background:
          rgba(241, 251, 248, 0.96);
      }
    }

    @media (max-width: 767px) {
      .ubuzima-workspace-dock-v5,
      .ubuzima-workspace-dock-v5__tooltip {
        display: none !important;
      }
    }
  `;

  style.textContent += `
    @media (min-width: 1200px) {
      .ubuzima-workspace-dock-v5 {
        width:
          min(
            1500px,
            calc(100vw - 24px)
          );

        grid-template-columns:
          minmax(260px, 370px)
          minmax(0, 1fr)
          minmax(260px, 370px);
      }

      .ubuzima-workspace-dock-v6__balance {
        display: block;
        grid-column: 1;
        min-width: 0;
      }

      .ubuzima-workspace-dock-v5__modules {
        grid-column: 2;
        min-width: 0;
        justify-content: safe center;
      }

      .ubuzima-workspace-dock-v5__recent {
        grid-column: 3;
        min-width: 0;
      }
    }

    @media (
      min-width: 768px
    ) and (
      max-width: 1199px
    ) {
      .ubuzima-workspace-dock-v5 {
        grid-template-columns:
          minmax(0, 1fr)
          minmax(210px, 34vw);
      }

      .ubuzima-workspace-dock-v6__balance {
        display: none;
      }

      .ubuzima-workspace-dock-v5__modules {
        grid-column: 1;
        justify-content: safe center;
      }

      .ubuzima-workspace-dock-v5__recent {
        grid-column: 2;
      }
    }

    @media (min-width: 768px) {
      .ubuzima-workspace-dock-v5__module,
      .ubuzima-workspace-dock-v5__profile {
        background:
          linear-gradient(
            145deg,
            hsl(
              var(--dock-icon-hue)
              88%
              68%
              / 0.18
            ),
            hsl(
              calc(
                var(--dock-icon-hue)
                + 48
              )
              84%
              52%
              / 0.08
            )
          );

        contain:
          layout paint style;
      }

      .ubuzima-workspace-dock-v5__icon-shell {
        width: 45px;
        min-width: 45px;
        height: 45px;
        min-height: 45px;

        display: grid;
        place-items: center;

        border:
          1px solid
          rgba(255, 255, 255, 0.30);

        border-radius: 14px;

        background:
          linear-gradient(
            145deg,
            hsl(
              var(--dock-icon-hue)
              92%
              70%
              / 0.23
            ),
            rgba(255, 255, 255, 0.10)
          );

        box-shadow:
          inset 0 1px 0
            rgba(255, 255, 255, 0.45),
          0 4px 10px
            rgba(17, 61, 53, 0.08);

        overflow: hidden;
        box-sizing: border-box;
      }

      .ubuzima-workspace-dock-v5__icon {
        width: 35px !important;
        min-width: 35px !important;
        max-width: 35px !important;
        height: 35px !important;
        min-height: 35px !important;
        max-height: 35px !important;

        object-fit: contain !important;

        filter:
          drop-shadow(
            0 2px 2px
            rgba(20, 55, 49, 0.08)
          ) !important;
      }

      .ubuzima-workspace-dock-v5__recent-card {
        width: 134px;
        min-width: 134px;
        height: 45px;
        min-height: 45px;
        flex-basis: 134px;
      }

      .ubuzima-workspace-dock-v5__recent-open {
        height: 43px;

        grid-template-columns:
          36px minmax(0, 1fr);

        gap: 6px;

        padding:
          4px 3px
          4px 5px;
      }

      .ubuzima-workspace-dock-v5__recent-icon-shell {
        width: 34px;
        min-width: 34px;
        height: 34px;
        min-height: 34px;

        display: grid;
        place-items: center;

        border:
          1px solid
          rgba(255, 255, 255, 0.30);

        border-radius: 10px;

        background:
          linear-gradient(
            145deg,
            hsl(
              var(--dock-icon-hue)
              91%
              68%
              / 0.22
            ),
            rgba(255, 255, 255, 0.11)
          );

        box-shadow:
          inset 0 1px 0
            rgba(255, 255, 255, 0.38);

        overflow: hidden;
        box-sizing: border-box;
      }

      .ubuzima-workspace-dock-v5__recent-icon {
        width: 26px !important;
        min-width: 26px !important;
        max-width: 26px !important;
        height: 26px !important;
        min-height: 26px !important;
        max-height: 26px !important;

        display: block !important;
        object-fit: contain !important;

        filter:
          drop-shadow(
            0 1px 2px
            rgba(20, 55, 49, 0.08)
          ) !important;
      }

      .ubuzima-workspace-dock-v5__recent-name {
        padding-right: 2px;

        font-size: 9px;
        line-height: 1.05;
      }

      .ubuzima-workspace-dock-v5__recent-close {
        height: 43px;
      }

      .ubuzima-workspace-dock-v5__recent-list {
        align-items: center;
      }
    }
  `;

  style.textContent += `
    @media (min-width: 768px) {
      .ubuzima-workspace-dock-v5__modules {
        --ubuzima-dock-module-size:
          57px;

        justify-content:
          safe center;
      }

      .ubuzima-workspace-dock-v5__modules.is-fully-exposed {
        overflow-x: hidden;
        justify-content:
          safe center;
      }

      .ubuzima-workspace-dock-v5__modules.is-overflowing {
        overflow-x: auto;
        justify-content:
          flex-start;

        scroll-snap-type:
          x proximity;

        overscroll-behavior-x:
          contain;
      }

      .ubuzima-workspace-dock-v5__module,
      .ubuzima-workspace-dock-v5__profile {
        width:
          var(
            --ubuzima-dock-module-size
          ) !important;

        min-width:
          var(
            --ubuzima-dock-module-size
          ) !important;

        max-width:
          var(
            --ubuzima-dock-module-size
          ) !important;

        height:
          var(
            --ubuzima-dock-module-size
          ) !important;

        min-height:
          var(
            --ubuzima-dock-module-size
          ) !important;

        max-height:
          var(
            --ubuzima-dock-module-size
          ) !important;

        flex-basis:
          var(
            --ubuzima-dock-module-size
          ) !important;
      }

      .ubuzima-workspace-dock-v5__modules.is-overflowing
        .ubuzima-workspace-dock-v5__module,
      .ubuzima-workspace-dock-v5__modules.is-overflowing
        .ubuzima-workspace-dock-v5__profile {
        scroll-snap-align:
          center;
      }

      .ubuzima-workspace-dock-v5__icon-shell {
        width:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 12px
          ) !important;

        min-width:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 12px
          ) !important;

        max-width:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 12px
          ) !important;

        height:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 12px
          ) !important;

        min-height:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 12px
          ) !important;

        max-height:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 12px
          ) !important;
      }

      .ubuzima-workspace-dock-v5__icon {
        width:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 22px
          ) !important;

        min-width:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 22px
          ) !important;

        max-width:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 22px
          ) !important;

        height:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 22px
          ) !important;

        min-height:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 22px
          ) !important;

        max-height:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 22px
          ) !important;
      }
    }
  `;

  style.textContent += `
    @media (min-width: 768px) {
      .ubuzima-workspace-dock-v5 {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 0 !important;

        width: max-content;
        min-width: 0;
        max-width:
          calc(100vw - 24px) !important;

        height: 76px !important;
        padding: 7px !important;

        overflow: visible !important;

        border:
          1px solid
          rgba(255, 255, 255, 0.54) !important;

        border-radius:
          25px !important;

        background:
          linear-gradient(
            138deg,
            rgba(255, 255, 255, 0.16),
            rgba(226, 248, 243, 0.075)
              46%,
            rgba(204, 239, 231, 0.12)
          ) !important;

        box-shadow:
          0 30px 78px
            rgba(10, 42, 36, 0.21),
          0 8px 24px
            rgba(15, 118, 110, 0.065),
          inset 0 1px 0
            rgba(255, 255, 255, 0.68),
          inset 0 -1px 0
            rgba(255, 255, 255, 0.11) !important;

        -webkit-backdrop-filter:
          blur(34px)
          saturate(1.88)
          contrast(1.04) !important;

        backdrop-filter:
          blur(34px)
          saturate(1.88)
          contrast(1.04) !important;
      }

      .ubuzima-workspace-dock-v6__balance {
        display: none !important;
      }

      .ubuzima-workspace-dock-v5__modules {
        --ubuzima-dock-module-size:
          57px;

        flex:
          0 1 auto !important;

        min-width: 0 !important;
        height: 62px !important;

        display: flex !important;
        align-items: flex-end !important;
        justify-content:
          safe center !important;
        gap: 5px !important;

        padding:
          3px 5px 2px !important;

        border: 0 !important;
        border-radius: 0 !important;

        background:
          transparent !important;

        box-shadow:
          none !important;

        overflow-x:
          hidden !important;
        overflow-y:
          visible !important;

        scrollbar-width: none;
      }

      .ubuzima-workspace-dock-v5__modules.is-fully-exposed {
        overflow:
          visible !important;
      }

      .ubuzima-workspace-dock-v5__modules.is-overflowing {
        flex:
          1 1 auto !important;

        justify-content:
          flex-start !important;

        overflow-x:
          auto !important;
        overflow-y:
          visible !important;

        scroll-snap-type:
          x proximity;

        overscroll-behavior-x:
          contain;
      }

      .ubuzima-workspace-dock-v5__modules.is-overflowing
        .ubuzima-workspace-dock-v5__profile,
      .ubuzima-workspace-dock-v5__modules.is-overflowing
        .ubuzima-workspace-dock-v5__module {
        scroll-snap-align:
          center;
      }

      .ubuzima-workspace-dock-v5__profile,
      .ubuzima-workspace-dock-v5__module {
        width:
          var(
            --ubuzima-dock-module-size
          ) !important;

        min-width:
          var(
            --ubuzima-dock-module-size
          ) !important;

        max-width:
          var(
            --ubuzima-dock-module-size
          ) !important;

        height:
          var(
            --ubuzima-dock-module-size
          ) !important;

        min-height:
          var(
            --ubuzima-dock-module-size
          ) !important;

        max-height:
          var(
            --ubuzima-dock-module-size
          ) !important;

        flex:
          0 0
          var(
            --ubuzima-dock-module-size
          ) !important;

        transform-origin:
          center bottom !important;

        transform:
          translateY(
            calc(
              -1
              * var(
                --mac-dock-lift,
                0px
              )
            )
          )
          scale(
            var(
              --mac-dock-scale,
              1
            )
          ) !important;

        transition:
          transform
            88ms
            cubic-bezier(
              0.22,
              1,
              0.36,
              1
            ),
          background-color
            100ms ease,
          border-color
            100ms ease,
          box-shadow
            100ms ease !important;

        will-change:
          transform;
      }

      .ubuzima-workspace-dock-v5__icon-shell {
        width:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 12px
          ) !important;

        min-width:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 12px
          ) !important;

        max-width:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 12px
          ) !important;

        height:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 12px
          ) !important;

        min-height:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 12px
          ) !important;

        max-height:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 12px
          ) !important;
      }

      .ubuzima-workspace-dock-v5__icon {
        width:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 22px
          ) !important;

        min-width:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 22px
          ) !important;

        max-width:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 22px
          ) !important;

        height:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 22px
          ) !important;

        min-height:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 22px
          ) !important;

        max-height:
          calc(
            var(
              --ubuzima-dock-module-size
            )
            - 22px
          ) !important;
      }

      .ubuzima-workspace-dock-v7__separator {
        width: 1px;
        min-width: 1px;
        height: 38px;
        flex: 0 0 1px;

        margin:
          0 5px;

        border-radius:
          999px;

        background:
          linear-gradient(
            transparent,
            rgba(255, 255, 255, 0.72),
            rgba(15, 118, 110, 0.15),
            transparent
          );

        box-shadow:
          1px 0 0
            rgba(0, 0, 0, 0.035);
      }

      .ubuzima-workspace-dock-v7__separator[hidden] {
        display:
          none !important;
      }

      .ubuzima-workspace-dock-v5__recent {
        width: auto !important;
        min-width: 0 !important;
        height: 62px !important;
        flex: 0 0 auto !important;

        display: flex !important;
        align-items: flex-end !important;

        padding:
          3px 3px 2px !important;

        border: 0 !important;
        border-radius: 0 !important;

        background:
          transparent !important;

        box-shadow:
          none !important;

        overflow:
          visible !important;
      }

      .ubuzima-workspace-dock-v5__recent[hidden] {
        display:
          none !important;
      }

      .ubuzima-workspace-dock-v5__recent-header,
      .ubuzima-workspace-dock-v5__recent-count,
      .ubuzima-workspace-dock-v5__recent-empty,
      .ubuzima-workspace-dock-v5__recent-name {
        display:
          none !important;
      }

      .ubuzima-workspace-dock-v5__recent-list {
        width: auto !important;
        height: 57px !important;

        display: flex !important;
        align-items: flex-end !important;
        gap: 4px !important;

        overflow:
          visible !important;
      }

      .ubuzima-workspace-dock-v5__recent-card {
        position: relative;

        width:
          ${RECENT_ICON_SIZE}px !important;

        min-width:
          ${RECENT_ICON_SIZE}px !important;

        max-width:
          ${RECENT_ICON_SIZE}px !important;

        height: 57px !important;
        min-height: 57px !important;
        max-height: 57px !important;

        flex:
          0 0
          ${RECENT_ICON_SIZE}px !important;

        display:
          block !important;

        border: 0 !important;
        border-radius: 16px !important;

        background:
          transparent !important;

        box-shadow:
          none !important;

        overflow:
          visible !important;
      }

      .ubuzima-workspace-dock-v5__recent-card[hidden] {
        display:
          none !important;
      }

      .ubuzima-workspace-dock-v5__recent-open {
        position: relative;

        width:
          ${RECENT_ICON_SIZE}px !important;

        min-width:
          ${RECENT_ICON_SIZE}px !important;

        max-width:
          ${RECENT_ICON_SIZE}px !important;

        height: 57px !important;
        min-height: 57px !important;
        max-height: 57px !important;

        display: grid !important;
        place-items: center !important;

        padding: 4px !important;

        border:
          1px solid
          rgba(255, 255, 255, 0.30) !important;

        border-radius:
          16px !important;

        background:
          linear-gradient(
            145deg,
            hsl(
              var(
                --dock-icon-hue
              )
              91%
              69%
              / 0.18
            ),
            rgba(255, 255, 255, 0.075)
          ) !important;

        box-shadow:
          inset 0 1px 0
            rgba(255, 255, 255, 0.42) !important;

        transform-origin:
          center bottom !important;

        transform:
          translateY(
            calc(
              -1
              * var(
                --mac-dock-lift,
                0px
              )
            )
          )
          scale(
            var(
              --mac-dock-scale,
              1
            )
          ) !important;

        transition:
          transform
            88ms
            cubic-bezier(
              0.22,
              1,
              0.36,
              1
            ),
          background-color
            100ms ease,
          border-color
            100ms ease,
          box-shadow
            100ms ease !important;

        will-change:
          transform;
      }

      .ubuzima-workspace-dock-v5__recent-card.is-current
        .ubuzima-workspace-dock-v5__recent-open {
        border-color:
          rgba(15, 118, 110, 0.38) !important;

        background:
          rgba(224, 249, 243, 0.31) !important;

        box-shadow:
          0 0 0 2px
            rgba(15, 118, 110, 0.08),
          inset 0 1px 0
            rgba(255, 255, 255, 0.66) !important;
      }

      .ubuzima-workspace-dock-v5__recent-card.is-current
        .ubuzima-workspace-dock-v5__active-dot {
        background:
          #0f766e;

        box-shadow:
          0 0 0 2px
            rgba(255, 255, 255, 0.72);
      }

      .ubuzima-workspace-dock-v5__recent-icon-shell {
        width: 41px !important;
        min-width: 41px !important;
        max-width: 41px !important;

        height: 41px !important;
        min-height: 41px !important;
        max-height: 41px !important;

        display: grid !important;
        place-items: center !important;

        border-radius:
          13px !important;

        overflow:
          hidden !important;
      }

      .ubuzima-workspace-dock-v5__recent-icon {
        width: 33px !important;
        min-width: 33px !important;
        max-width: 33px !important;

        height: 33px !important;
        min-height: 33px !important;
        max-height: 33px !important;

        display:
          block !important;

        object-fit:
          contain !important;
      }

      .ubuzima-workspace-dock-v5__recent-close {
        position: absolute;
        z-index: 260;
        top: -5px;
        right: -5px;

        width: 17px !important;
        min-width: 17px !important;
        max-width: 17px !important;

        height: 17px !important;
        min-height: 17px !important;
        max-height: 17px !important;

        display: grid !important;
        place-items: center !important;

        padding: 0 !important;

        border:
          1px solid
          rgba(255, 255, 255, 0.72) !important;

        border-radius:
          999px !important;

        background:
          rgba(25, 55, 51, 0.88) !important;

        color:
          white !important;

        font-size:
          11px !important;

        line-height:
          1 !important;

        opacity: 0;
        visibility: hidden;
        pointer-events: none;

        transform: none !important;

        transition:
          opacity 90ms ease,
          visibility 90ms ease,
          background-color 90ms ease !important;
      }

      .ubuzima-workspace-dock-v5__recent-card:hover
        .ubuzima-workspace-dock-v5__recent-close,
      .ubuzima-workspace-dock-v5__recent-card:focus-within
        .ubuzima-workspace-dock-v5__recent-close {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }

      .ubuzima-workspace-dock-v5__recent-close:hover {
        background:
          rgba(158, 42, 42, 0.94) !important;
      }
    }

    @media (
      min-width: 768px
    ) and (
      max-width: 1023px
    ) {
      .ubuzima-workspace-dock-v5 {
        max-width:
          calc(100vw - 16px) !important;
      }
    }
  `;

  style.textContent += `
    @media (min-width: 768px) {
      .ubuzima-workspace-dock-v5__profile-popover {
        opacity: 1 !important;

        color-scheme: light;

        background:
          linear-gradient(
            180deg,
            #ffffff 0%,
            #f3fbf8 100%
          ) !important;

        border:
          1px solid
          #cbded8 !important;

        box-shadow:
          0 28px 72px
            rgba(10, 42, 36, 0.30),
          0 8px 24px
            rgba(15, 118, 110, 0.12),
          0 0 0 1px
            rgba(255, 255, 255, 0.92),
          inset 0 1px 0
            #ffffff !important;

        -webkit-backdrop-filter:
          none !important;

        backdrop-filter:
          none !important;

        isolation: isolate;
      }

      .ubuzima-workspace-dock-v5__profile-popover::before {
        content: '';

        position: absolute;
        z-index: -1;

        inset: 0;

        border-radius: inherit;

        background:
          #f7fffc;

        opacity: 1;

        pointer-events: none;
      }

      .ubuzima-workspace-dock-v5__profile-summary {
        border:
          1px solid
          #dcebe7;

        border-radius:
          14px;

        background:
          #ffffff;

        box-shadow:
          inset 0 1px 0
            #ffffff;
      }

      .ubuzima-workspace-dock-v5__profile-summary strong {
        color:
          #123c35 !important;

        text-shadow:
          none !important;
      }

      .ubuzima-workspace-dock-v5__profile-summary small {
        color:
          #55766f !important;

        text-shadow:
          none !important;
      }

      .ubuzima-workspace-dock-v5__profile-action {
        border-color:
          #d4e5e0 !important;

        background:
          #ffffff !important;

        color:
          #183f39 !important;

        box-shadow:
          0 2px 7px
            rgba(18, 60, 53, 0.055),
          inset 0 1px 0
            #ffffff !important;

        text-shadow:
          none !important;
      }

      .ubuzima-workspace-dock-v5__profile-action:hover,
      .ubuzima-workspace-dock-v5__profile-action:focus-visible {
        border-color:
          #88b8ad !important;

        background:
          #eaf7f3 !important;

        color:
          #0e5c51 !important;
      }

      .ubuzima-workspace-dock-v5__profile-action:disabled {
        border-color:
          #e2ece9 !important;

        background:
          #f4f8f7 !important;

        color:
          #91a5a0 !important;

        opacity: 1 !important;
      }

      .ubuzima-workspace-dock-v5__profile-action--danger {
        border-color:
          #efcdcd !important;

        background:
          #fff8f8 !important;

        color:
          #a52f2f !important;
      }

      .ubuzima-workspace-dock-v5__profile-action--danger:hover,
      .ubuzima-workspace-dock-v5__profile-action--danger:focus-visible {
        border-color:
          #d99a9a !important;

        background:
          #ffeded !important;

        color:
          #8f2222 !important;
      }

      .ubuzima-workspace-dock-v7__separator {
        width:
          2px !important;

        min-width:
          2px !important;

        max-width:
          2px !important;

        height:
          46px !important;

        min-height:
          46px !important;

        flex:
          0 0 2px !important;

        align-self:
          center !important;

        margin:
          0 8px !important;

        border-radius:
          999px !important;

        background:
          linear-gradient(
            to bottom,
            transparent 0%,
            rgba(15, 118, 110, 0.30) 14%,
            rgba(15, 118, 110, 0.78) 48%,
            rgba(15, 118, 110, 0.48) 72%,
            transparent 100%
          ) !important;

        box-shadow:
          1px 0 0
            rgba(255, 255, 255, 0.88),
          -1px 0 0
            rgba(18, 60, 53, 0.07),
          0 0 12px
            rgba(15, 118, 110, 0.13) !important;

        opacity:
          1 !important;

        visibility:
          visible !important;
      }

      .ubuzima-workspace-dock-v7__separator[hidden] {
        display:
          none !important;
      }
    }
  `;

  document.head.appendChild(
    style,
  );
}

let macDockFitFrame = 0;
let magnificationFrame = 0;
let magnificationPointerX = 0;

function resetDockMagnification(): void {
  const dock =
    document.querySelector<HTMLElement>(
      `[${DOCK_ATTRIBUTE}]`,
    );

  if (!dock) {
    return;
  }

  dock
    .querySelectorAll<HTMLElement>(
      '.ubuzima-workspace-dock-v5__profile, '
      + '.ubuzima-workspace-dock-v5__module, '
      + '.ubuzima-workspace-dock-v5__recent-open',
    )
    .forEach((button) => {
      button.style.removeProperty(
        '--mac-dock-scale',
      );

      button.style.removeProperty(
        '--mac-dock-lift',
      );

      button.style.removeProperty(
        'z-index',
      );
    });
}

function applyDockMagnification(): void {
  const dock =
    document.querySelector<HTMLElement>(
      `[${DOCK_ATTRIBUTE}]`,
    );

  if (!dock) {
    return;
  }

  const buttons =
    Array.from(
      dock.querySelectorAll<HTMLElement>(
        '.ubuzima-workspace-dock-v5__profile, '
        + '.ubuzima-workspace-dock-v5__module, '
        + '.ubuzima-workspace-dock-v5__recent-open',
      ),
    ).filter(
      (button) =>
        !button.closest<HTMLElement>(
          '[hidden]',
        ),
    );

  buttons.forEach((button) => {
    const rect =
      button.getBoundingClientRect();

    const centre =
      rect.left
      + (
        rect.width / 2
      );

    const distance =
      Math.abs(
        magnificationPointerX
        - centre,
      );

    let scale = 1;

    if (distance <= 30) {
      scale = 1.34;
    } else if (distance <= 72) {
      scale = 1.16;
    } else if (distance <= 118) {
      scale = 1.07;
    }

    const lift =
      Math.max(
        0,
        Math.round(
          (
            scale - 1
          ) * 28,
        ),
      );

    button.style.setProperty(
      '--mac-dock-scale',
      scale.toFixed(3),
    );

    button.style.setProperty(
      '--mac-dock-lift',
      `${lift}px`,
    );

    button.style.zIndex =
      scale > 1
        ? String(
          Math.round(
            scale * 100,
          ),
        )
        : '';
  });
}

function scheduleDockMagnification(
  clientX: number,
): void {
  magnificationPointerX =
    clientX;

  if (magnificationFrame) {
    return;
  }

  magnificationFrame =
    window.requestAnimationFrame(
      () => {
        magnificationFrame = 0;
        applyDockMagnification();
      },
    );
}

function handleDockPointerMove(
  event: PointerEvent,
): void {
  if (
    event.pointerType
    && event.pointerType !== 'mouse'
  ) {
    return;
  }

  scheduleDockMagnification(
    event.clientX,
  );
}

function fitMacDock(): void {
  const dock =
    document.querySelector<HTMLElement>(
      `[${DOCK_ATTRIBUTE}]`,
    );

  const rail =
    dock?.querySelector<HTMLElement>(
      '.ubuzima-workspace-dock-v5__modules',
    );

  if (
    !dock
    || !rail
  ) {
    return;
  }

  const mainButtons =
    rail.querySelectorAll<HTMLElement>(
      '.ubuzima-workspace-dock-v5__profile, '
      + '.ubuzima-workspace-dock-v5__module',
    );

  const moduleCount =
    mainButtons.length;

  if (moduleCount === 0) {
    return;
  }

  const recentSection =
    dock.querySelector<HTMLElement>(
      '[data-recent-section]',
    );

  const recentSeparator =
    dock.querySelector<HTMLElement>(
      '[data-recent-separator]',
    );

  const recentItems =
    Array.from(
      dock.querySelectorAll<HTMLElement>(
        '[data-recent-task-key]',
      ),
    );

  const maximumDockWidth =
    Math.max(
      320,
      window.innerWidth - 24,
    );

  const dockPadding = 14;
  const railPadding = 10;
  const mainGap = 5;
  const dividerWidth = 5;
  const recentGap = 4;
  const recentSectionPadding = 6;
  const recentSeparatorWidth = 11;

  const mainWidth = (
    size: number,
  ): number =>
    railPadding
    + dividerWidth
    + (
      moduleCount * size
    )
    + (
      moduleCount * mainGap
    );

  const recentWidth = (
    count: number,
  ): number => {
    if (count <= 0) {
      return 0;
    }

    return (
      recentSeparatorWidth
      + recentSectionPadding
      + (
        count * RECENT_ICON_SIZE
      )
      + (
        Math.max(
          0,
          count - 1,
        ) * recentGap
      )
    );
  };

  const totalWidth = (
    size: number,
    recentCount: number,
  ): number =>
    dockPadding
    + mainWidth(size)
    + recentWidth(recentCount);

  let visibleRecentCount =
    Math.min(
      MAXIMUM_RECENT,
      recentItems.length,
    );

  while (
    visibleRecentCount > 0
    && totalWidth(
      MAXIMUM_MODULE_SIZE,
      visibleRecentCount,
    ) > maximumDockWidth
  ) {
    visibleRecentCount -= 1;
  }

  let moduleSize =
    MAXIMUM_MODULE_SIZE;

  if (
    totalWidth(
      moduleSize,
      visibleRecentCount,
    ) > maximumDockWidth
  ) {
    visibleRecentCount = 0;

    const fixedMainWidth =
      dockPadding
      + railPadding
      + dividerWidth
      + (
        moduleCount * mainGap
      );

    moduleSize =
      Math.floor(
        (
          maximumDockWidth
          - fixedMainWidth
        )
        / moduleCount,
      );

    moduleSize =
      Math.max(
        MINIMUM_MODULE_SIZE,
        Math.min(
          MAXIMUM_MODULE_SIZE,
          moduleSize,
        ),
      );
  }

  const mainOverflowing =
    totalWidth(
      moduleSize,
      visibleRecentCount,
    ) > maximumDockWidth;

  recentItems.forEach(
    (
      item,
      index,
    ) => {
      item.hidden =
        index >= visibleRecentCount;
    },
  );

  if (recentSection) {
    recentSection.hidden =
      visibleRecentCount === 0;
  }

  if (recentSeparator) {
    recentSeparator.hidden =
      visibleRecentCount === 0;
  }

  rail.style.setProperty(
    '--ubuzima-dock-module-size',
    `${moduleSize}px`,
  );

  rail.classList.toggle(
    'is-overflowing',
    mainOverflowing,
  );

  rail.classList.toggle(
    'is-fully-exposed',
    !mainOverflowing,
  );

  const requestedWidth =
    Math.ceil(
      totalWidth(
        moduleSize,
        visibleRecentCount,
      ),
    );

  const appliedWidth =
    Math.min(
      maximumDockWidth,
      requestedWidth,
    );

  dock.style.width =
    `${appliedWidth}px`;

  dock.classList.toggle(
    'has-recent-tasks',
    visibleRecentCount > 0,
  );

  dock.setAttribute(
    'data-main-module-priority',
    'true',
  );

  dock.setAttribute(
    'data-main-module-count',
    String(moduleCount),
  );

  dock.setAttribute(
    'data-visible-recent-count',
    String(visibleRecentCount),
  );

  dock.setAttribute(
    'data-stored-recent-count',
    String(recentItems.length),
  );

  dock.setAttribute(
    'data-applied-module-size',
    String(moduleSize),
  );

  dock.setAttribute(
    'data-main-overflow-mode',
    mainOverflowing
      ? 'horizontal-scroll-final-fallback'
      : 'all-main-modules-exposed',
  );

  dock.setAttribute(
    'data-space-reduction-order',
    'recent-tasks-then-main-size-then-main-scroll',
  );
}

function scheduleMacDockFit(): void {
  if (macDockFitFrame) {
    return;
  }

  macDockFitFrame =
    window.requestAnimationFrame(
      () => {
        macDockFitFrame = 0;
        fitMacDock();
      },
    );
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
      'data-ubuzima-workspace-dock-v5-build',
    );

  document.documentElement
    .removeAttribute(
      'data-ubuzima-workspace-dock-mounted',
    );

  document.documentElement
    .setAttribute(
      'data-ubuzima-workspace-dock-bootstrap',
      'waiting',
    );

  hideTooltip();
  profileOpen = false;
  lastStructureSignature = '';
}

function ensureDock(): HTMLElement {
  const existing =
    document.querySelector<HTMLElement>(
      `[${DOCK_ATTRIBUTE}]`,
    );

  if (
    existing
    && existing.dataset
      .ubuzimaWorkspaceDockV5
      === BUILD_MARKER
  ) {
    return existing;
  }

  existing?.remove();

  const dock =
    document.createElement('nav');

  dock.className =
    'ubuzima-workspace-dock-v5';

  dock.setAttribute(
    DOCK_ATTRIBUTE,
    BUILD_MARKER,
  );

  dock.setAttribute(
    'data-ubuzima-workspace-dock-v5-build',
    BUILD_MARKER,
  );

  dock.setAttribute(
    'data-colourful-icon-family',
    ICON_MARKER,
  );

  dock.setAttribute(
    'data-profile-hub-marker',
    PROFILE_MARKER,
  );

  dock.setAttribute(
    'data-header-relocation-marker',
    HEADER_MARKER,
  );

  dock.setAttribute(
    'data-recent-task-marker',
    RECENT_MARKER,
  );

  dock.setAttribute(
    'data-glass-marker',
    GLASS_MARKER,
  );

  dock.setAttribute(
    'data-navigation-marker',
    NAVIGATION_MARKER,
  );

  dock.setAttribute(
    'data-photo-icon-marker',
    PHOTO_ICON_MARKER,
  );

  dock.setAttribute(
    'data-performance-marker',
    PERFORMANCE_MARKER,
  );

  dock.setAttribute(
    'data-v6b-typecheck-fix',
    'UBIZIMA_PROFILE_FALLBACK_TYPECHECK_FIX_V6B',
  );

  dock.setAttribute(
    'data-centering-marker',
    CENTERING_MARKER,
  );

  dock.setAttribute(
    'data-stability-marker',
    STABILITY_MARKER,
  );

  dock.setAttribute(
    'data-exposure-marker',
    EXPOSURE_MARKER,
  );

  dock.setAttribute(
    'data-recent-priority-marker',
    RECENT_PRIORITY_MARKER,
  );

  dock.setAttribute(
    'data-magnification-marker',
    MAGNIFICATION_MARKER,
  );

  dock.setAttribute(
    'data-continuous-glass-marker',
    CONTINUOUS_GLASS_MARKER,
  );

  dock.setAttribute(
    'data-overflow-marker',
    OVERFLOW_MARKER,
  );

  dock.setAttribute(
    'data-profile-visibility-marker',
    PROFILE_VISIBILITY_MARKER,
  );

  dock.setAttribute(
    'data-separator-visibility-marker',
    SEPARATOR_VISIBILITY_MARKER,
  );

  dock.setAttribute(
    'data-profile-popover-visual',
    'solid-opaque-high-contrast',
  );

  dock.setAttribute(
    'data-menu-recent-separator',
    'visible-high-contrast-vertical',
  );

  dock.setAttribute(
    'data-mobile-taskbar-removal-marker',
    MOBILE_TASKBAR_REMOVAL_MARKER,
  );

  dock.setAttribute(
    'data-mobile-scope',
    'desktop-tablet-only-no-phone-taskbar',
  );

  dock.setAttribute(
    'data-mount-marker',
    MOUNT_MARKER,
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
    'mouseover',
    handleDockMouseOver,
  );

  dock.addEventListener(
    'mouseout',
    handleDockMouseOut,
  );

  dock.addEventListener(
    'focusin',
    handleDockFocusIn,
  );

  dock.addEventListener(
    'focusout',
    handleDockFocusOut,
  );

  dock.addEventListener(
    'dragstart',
    (event) => {
      event.preventDefault();
    },
  );

  dock.addEventListener(
    'pointermove',
    handleDockPointerMove,
    {
      passive: true,
    },
  );

  dock.addEventListener(
    'pointerleave',
    resetDockMagnification,
  );

  dock.addEventListener(
    'pointercancel',
    resetDockMagnification,
  );

  document.body.appendChild(
    dock,
  );

  return dock;
}

function profileButtonMarkup(
  snapshot: ProfileSnapshot,
): string {
  const profileIcon =
    moduleIconUrl(
      'profile',
      snapshot.name === 'Staff Profile'
        ? 'Profile'
        : snapshot.name,
    );

  return `
    <button
      type="button"
      class="
        ubuzima-workspace-dock-v5__profile
        ${profileOpen ? 'is-open' : ''}
      "
      data-profile-toggle="true"
      data-dock-tooltip="Profile"
      data-photo-icon-source="${PHOTO_ICON_MARKER}"
      aria-label="Open Profile"
      aria-expanded="${profileOpen ? 'true' : 'false'}"
      title="Profile"
      style="--dock-icon-hue: ${moduleHue('profile')};"
    >
      <span
        class="ubuzima-workspace-dock-v5__icon-shell"
        aria-hidden="true"
      >
        <img
          class="ubuzima-workspace-dock-v5__icon"
          src="${profileIcon}"
          alt=""
          draggable="false"
        />
      </span>
    </button>
  `;
}

function moduleMarkup(
  module: DockModule,
): string {
  const badge =
    module.badge > 0
      ? `
        <span
          class="ubuzima-workspace-dock-v5__badge"
          aria-label="${module.badge} unread"
        >
          ${
            module.badge > 99
              ? '99+'
              : module.badge
          }
        </span>
      `
      : '';

  return `
    <button
      type="button"
      class="
        ubuzima-workspace-dock-v5__module
        ${module.active ? 'is-active' : ''}
      "
      data-workspace-module-key="${escapeHtml(module.key)}"
      data-dock-tooltip="${escapeHtml(module.label)}"
      data-photo-icon-source="${PHOTO_ICON_MARKER}"
      data-semantic-icon-key="${escapeHtml(module.key)}"
      aria-label="Open ${escapeHtml(module.label)}"
      aria-pressed="${module.active ? 'true' : 'false'}"
      title="${escapeHtml(module.label)}"
      style="--dock-icon-hue: ${moduleHue(module.key)};"
    >
      <span
        class="ubuzima-workspace-dock-v5__icon-shell"
        aria-hidden="true"
      >
        <img
          class="ubuzima-workspace-dock-v5__icon"
          src="${module.icon}"
          alt=""
          draggable="false"
        />
      </span>

      ${badge}

      <span
        class="ubuzima-workspace-dock-v5__active-dot"
        aria-hidden="true"
      ></span>
    </button>
  `;
}

function recentMarkup(
  entry: RecentWorkspace,
  module: DockModule,
): string {
  return `
    <article
      class="
        ubuzima-workspace-dock-v5__recent-card
        ${module.active ? 'is-current' : ''}
      "
      data-recent-task-key="${escapeHtml(entry.key)}"
      style="--dock-icon-hue: ${moduleHue(module.key)};"
    >
      <button
        type="button"
        class="ubuzima-workspace-dock-v5__recent-open"
        data-recent-open-key="${escapeHtml(entry.key)}"
        data-dock-tooltip="${escapeHtml(entry.label)}"
        aria-label="Open ${escapeHtml(entry.label)}"
        title="${escapeHtml(entry.label)}"
      >
        <span
          class="ubuzima-workspace-dock-v5__recent-icon-shell"
          aria-hidden="true"
        >
          <img
            class="ubuzima-workspace-dock-v5__recent-icon"
            src="${module.icon}"
            alt=""
            draggable="false"
          />
        </span>

        <span
          class="ubuzima-workspace-dock-v5__active-dot"
          aria-hidden="true"
        ></span>
      </button>

      <button
        type="button"
        class="ubuzima-workspace-dock-v5__recent-close"
        data-recent-close-key="${escapeHtml(entry.key)}"
        data-dock-tooltip="Close ${escapeHtml(entry.label)}"
        aria-label="Close ${escapeHtml(entry.label)} from recent tasks"
      >
        ×
      </button>
    </article>
  `;
}

function profilePopoverMarkup(
  snapshot: ProfileSnapshot,
): string {
  if (!profileOpen) {
    return '';
  }

  const icon =
    moduleIconUrl(
      'profile',
      snapshot.name === 'Staff Profile'
        ? 'Profile'
        : snapshot.name,
    );

  return `
    <section
      class="ubuzima-workspace-dock-v5__profile-popover"
      data-profile-popover="true"
      aria-label="Profile and workspace controls"
    >
      <div
        class="ubuzima-workspace-dock-v5__profile-summary"
      >
        <img
          src="${icon}"
          alt=""
          draggable="false"
        />

        <div>
          <strong>
            ${escapeHtml(snapshot.name)}
          </strong>

          <small>
            Profile, language and workspace controls
          </small>
        </div>
      </div>

      <div
        class="ubuzima-workspace-dock-v5__profile-actions"
      >
        <button
          type="button"
          class="ubuzima-workspace-dock-v5__profile-action"
          data-profile-action="edit-profile"
        >
          Edit Profile
        </button>

        <button
          type="button"
          class="ubuzima-workspace-dock-v5__profile-action"
          data-profile-action="change-password"
        >
          Change Password
        </button>

        <button
          type="button"
          class="ubuzima-workspace-dock-v5__profile-action"
          data-profile-action="language"
        >
          Language · ${escapeHtml(snapshot.language)}
        </button>

        <button
          type="button"
          class="ubuzima-workspace-dock-v5__profile-action"
          data-profile-action="website"
          ${snapshot.hasWebsite ? '' : 'disabled'}
        >
          ${escapeHtml(snapshot.websiteLabel)}
        </button>

        <button
          type="button"
          class="ubuzima-workspace-dock-v5__profile-action"
          data-profile-action="back"
        >
          Back
        </button>

        <button
          type="button"
          class="
            ubuzima-workspace-dock-v5__profile-action
            ubuzima-workspace-dock-v5__profile-action--danger
          "
          data-profile-action="sign-out"
        >
          Sign Out
        </button>
      </div>
    </section>
  `;
}

function renderDock(
  forceStructure = false,
): void {
  if (isRendering) {
    return;
  }

  if (shouldSuppressDockForMobile()) {
    enforceMobileNoTaskbar();
    return;
  }

  if (!shouldRenderDock()) {
    removeDock();
    return;
  }

  isRendering = true;

  try {
    injectStyles();

    const modules =
      discoverModules();

    if (modules.length === 0) {
      document.documentElement
        .setAttribute(
          'data-ubuzima-workspace-dock-bootstrap',
          'waiting-for-permission-menu',
        );

      return;
    }

    document.documentElement
      .classList.add(
        ROOT_CLASS,
      );

    const recent =
      normalisedRecent(modules);

    const snapshot =
      profileSnapshot();

    const signature =
      JSON.stringify({
        profileOpen,
        profileName: snapshot.name,
        language: snapshot.language,
        website:
          snapshot.websiteLabel,
        modules:
          modules.map(
            (module) => ({
              key: module.key,
              label: module.label,
              badge: module.badge,
            }),
          ),
        recent:
          recent.map(
            (entry) => ({
              key: entry.key,
              label: entry.label,
            }),
          ),
      });

    const dock =
      ensureDock();

    if (
      forceStructure
      || signature
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
        ${profilePopoverMarkup(snapshot)}

        <section
          class="ubuzima-workspace-dock-v5__modules"
          aria-label="Available modules"
        >
          ${profileButtonMarkup(snapshot)}

          <span
            class="ubuzima-workspace-dock-v5__divider"
            aria-hidden="true"
          ></span>

          ${modules.map(moduleMarkup).join('')}
        </section>

        ${
          recentCards
            ? `
              <span
                class="ubuzima-workspace-dock-v7__separator"
                data-recent-separator="true"
                aria-hidden="true"
              ></span>

              <section
                class="ubuzima-workspace-dock-v5__recent"
                data-recent-section="true"
                aria-label="Recent tasks"
              >
                <div
                  class="ubuzima-workspace-dock-v5__recent-list"
                >
                  ${recentCards}
                </div>
              </section>
            `
            : ''
        }
      `;

      lastStructureSignature =
        signature;
    }

    const discoveredActiveKey =
      modules.find(
        (module) => module.active,
      )?.key
      || '';

    if (
      pendingActiveKey
      && discoveredActiveKey
        === pendingActiveKey
    ) {
      pendingActiveKey = '';
    }

    const activeKey =
      pendingActiveKey
      || discoveredActiveKey;

    dock
      .querySelectorAll<HTMLElement>(
        '[data-workspace-module-key]',
      )
      .forEach((button) => {
        const active =
          button.dataset
            .workspaceModuleKey
          === activeKey;

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
        card.classList.toggle(
          'is-current',
          card.dataset
            .recentTaskKey
          === activeKey,
        );
      });

    dock.setAttribute(
      'data-module-count',
      String(modules.length),
    );

    dock.setAttribute(
      'data-recent-task-count',
      String(recent.length),
    );

    dock.setAttribute(
      'data-recent-task-limit',
      String(MAXIMUM_RECENT),
    );

    dock.setAttribute(
      'data-icon-mode',
      'semantic-picture-images-no-initials',
    );

    dock.setAttribute(
      'data-ai-icon-source',
      'original-ai-svg-picture',
    );

    dock.setAttribute(
      'data-label-mode',
      'tooltip-only',
    );

    dock.setAttribute(
      'data-header-mode',
      'hidden-controls-relocated-to-profile',
    );

    dock.setAttribute(
      'data-recent-card-mode',
      'mac-icon-only-recent-section',
    );

    dock.setAttribute(
      'data-glass-mode',
      'low-opacity-deep-blur',
    );

    document.documentElement
      .setAttribute(
        'data-ubuzima-workspace-dock-v5-build',
        BUILD_MARKER,
      );

    document.documentElement
      .setAttribute(
        'data-ubuzima-workspace-dock-mounted',
        'true',
      );

    document.documentElement
      .setAttribute(
        'data-ubuzima-workspace-dock-bootstrap',
        'mounted',
      );

    dock.setAttribute(
      'data-module-exposure-policy',
      'main-modules-before-recent-tasks',
    );

    dock.setAttribute(
      'data-sidebar-replacement-state',
      'mounted-before-hide',
    );

    scheduleMacDockFit();
  } finally {
    isRendering = false;
  }
}

function handleDockClick(
  event: MouseEvent,
): void {
  const target =
    event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const profileToggle =
    target.closest(
      '[data-profile-toggle]',
    );

  if (
    profileToggle
    instanceof HTMLButtonElement
  ) {
    profileOpen =
      !profileOpen;

    hideTooltip();
    scheduleRender(true);
    return;
  }

  const profileAction =
    target.closest(
      '[data-profile-action]',
    );

  if (
    profileAction
    instanceof HTMLButtonElement
  ) {
    performProfileAction(
      profileAction.dataset
        .profileAction
      || '',
    );

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
      removeRecent(key);
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

function handleDockMouseOver(
  event: MouseEvent,
): void {
  const target =
    event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const tooltipTarget =
    target.closest<HTMLElement>(
      '[data-dock-tooltip]',
    );

  if (tooltipTarget) {
    showTooltip(
      tooltipTarget,
    );
  }
}

function handleDockMouseOut(
  event: MouseEvent,
): void {
  const target =
    event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const tooltipTarget =
    target.closest<HTMLElement>(
      '[data-dock-tooltip]',
    );

  if (!tooltipTarget) {
    return;
  }

  const related =
    event.relatedTarget;

  if (
    related instanceof Node
    && tooltipTarget.contains(
      related,
    )
  ) {
    return;
  }

  hideTooltip();
}

function handleDockFocusIn(
  event: FocusEvent,
): void {
  const target =
    event.target;

  if (
    target instanceof HTMLElement
    && target.matches(
      '[data-dock-tooltip]',
    )
  ) {
    showTooltip(target);
  }
}

function handleDockFocusOut(): void {
  hideTooltip();
}

function scheduleRender(
  forceStructure = false,
): void {
  forceNextRender =
    forceNextRender
    || forceStructure;

  if (renderFrame) {
    return;
  }

  renderFrame =
    window.requestAnimationFrame(
      () => {
        const force =
          forceNextRender;

        forceNextRender =
          false;

        renderFrame =
          0;

        renderDock(force);
      },
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
      .__ubuzimaWorkspaceDockV5
  ) {
    return;
  }

  window
    .__ubuzimaWorkspaceDockV5 =
    true;

  if (shouldSuppressDockForMobile()) {
    enforceMobileNoTaskbar();

    window.addEventListener(
      'resize',
      enforceMobileNoTaskbar,
      {
        passive: true,
      },
    );

    window.addEventListener(
      'orientationchange',
      enforceMobileNoTaskbar,
      {
        passive: true,
      },
    );

    window.addEventListener(
      'pageshow',
      enforceMobileNoTaskbar,
    );

    return;
  }

  let activationFrame = 0;

  let observedSidebar:
    Element | null = null;

  let observedHeader:
    Element | null = null;

  const targetedObserver =
    new MutationObserver(
      () => {
        scheduleRender(false);
        scheduleMacDockFit();
      },
    );

  const targetedOptions:
    MutationObserverInit = {
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
    };

  const bindTargetedObservers =
    (): void => {
      const sidebar =
        document.querySelector(
          '.sidebar[data-admin-sidebar]',
        );

      const header =
        document.querySelector(
          '.dashboard-header',
        );

      if (
        sidebar === observedSidebar
        && header === observedHeader
      ) {
        return;
      }

      targetedObserver.disconnect();

      if (sidebar) {
        targetedObserver.observe(
          sidebar,
          targetedOptions,
        );
      }

      if (header) {
        targetedObserver.observe(
          header,
          targetedOptions,
        );
      }

      observedSidebar =
        sidebar;

      observedHeader =
        header;
    };

  const activateDock =
    (): boolean => {
      bindTargetedObservers();

      renderDock(false);

      const sidebar =
        document.querySelector(
          '.sidebar[data-admin-sidebar]',
        );

      const dock =
        document.querySelector(
          `[${DOCK_ATTRIBUTE}]`,
        );

      const mounted =
        Boolean(
          sidebar
          && dock
          && discoverModules().length > 0
          && document.documentElement
            .getAttribute(
              'data-ubuzima-workspace-dock-mounted',
            )
            === 'true',
        );

      document.documentElement
        .setAttribute(
          'data-ubuzima-workspace-dock-bootstrap',
          mounted
            ? 'mounted'
            : 'waiting-for-permission-menu',
        );

      if (mounted) {
        scheduleMacDockFit();
      }

      return mounted;
    };

  const requestActivation =
    (): void => {
      if (activationFrame) {
        return;
      }

      activationFrame =
        window.requestAnimationFrame(
          () => {
            activationFrame = 0;
            activateDock();
          },
        );
    };

  const structureObserver =
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
          requestActivation();
        }
      },
    );

  structureObserver.observe(
    document.body,
    {
      subtree: true,
      childList: true,
    },
  );

  document.documentElement
    .setAttribute(
      'data-ubuzima-workspace-dock-bootstrap',
      'starting',
    );

  requestActivation();

  [
    80,
    180,
    360,
    700,
    1200,
    2200,
    3500,
  ].forEach((delay) => {
    window.setTimeout(
      () => {
        const mounted =
          document.documentElement
            .getAttribute(
              'data-ubuzima-workspace-dock-mounted',
            )
          === 'true';

        if (!mounted) {
          requestActivation();
        }
      },
      delay,
    );
  });

  document.addEventListener(
    'click',
    (event) => {
      const target =
        event.target;

      if (
        !(
          target
          instanceof Element
        )
        || target.closest(
          `[${DOCK_ATTRIBUTE}]`,
        )
      ) {
        return;
      }

      if (profileOpen) {
        profileOpen = false;
        scheduleRender(true);
        return;
      }

      scheduleRender(false);
      scheduleMacDockFit();
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key === 'Escape'
        && profileOpen
      ) {
        profileOpen = false;
        hideTooltip();
        scheduleRender(true);
      }
    },
  );

  window.addEventListener(
    'resize',
    () => {
      scheduleRender(false);
      scheduleMacDockFit();
    },
    {
      passive: true,
    },
  );

  window.addEventListener(
    'orientationchange',
    () => {
      scheduleRender(false);
      scheduleMacDockFit();
    },
    {
      passive: true,
    },
  );

  window.addEventListener(
    'pageshow',
    () => requestActivation(),
  );

  window.addEventListener(
    'popstate',
    () => {
      scheduleRender(false);
      scheduleMacDockFit();
    },
  );

  window.addEventListener(
    'hashchange',
    () => {
      scheduleRender(false);
      scheduleMacDockFit();
    },
  );

  window.addEventListener(
    'ubuzima:app-ready',
    () => requestActivation(),
  );
}

if (
  document.readyState
  === 'loading'
) {
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

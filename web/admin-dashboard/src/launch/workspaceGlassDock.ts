const BUILD_MARKER =
  'UBIZIMA_GLASS_WORKSPACE_DOCK_PRODUCTION_V3';

const MINIMUM_WIDTH = 768;
const MAXIMUM_RECENT = 4;

const RECENT_STORAGE_KEY =
  'ubuzima.workspace-dock.production-v3.recent';

type DockModule = {
  key: string;
  label: string;
  button: HTMLButtonElement;
  active: boolean;
};

type RecentWorkspace = {
  key: string;
  label: string;
  scrollY: number;
  updatedAt: number;
};

type DockPreviewWindow = Window & {
  __ubuzimaWorkspaceDockProductionV3?: boolean;
};

const workspaceDockWindow =
  window as DockPreviewWindow;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normaliseKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hashValue(value: string): number {
  let hash = 0;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash = (
      (hash * 31)
      + value.charCodeAt(index)
    ) >>> 0;
  }

  return hash;
}

function accentFor(value: string): string {
  const accents = [
    '#147a68',
    '#276db3',
    '#6c55aa',
    '#a96820',
    '#a94158',
    '#33786d',
    '#5366a4',
    '#8a6030',
    '#3d7356',
    '#884d80',
  ];

  return accents[
    hashValue(value) % accents.length
  ];
}

function shortCode(label: string): string {
  const words = label
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return (
      words[0].charAt(0)
      + words[1].charAt(0)
    ).toUpperCase();
  }

  return label
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase();
}

function moduleCategory(
  key: string,
  label: string,
): string {
  const identity =
    `${key} ${label}`.toLowerCase();

  if (
    identity.includes('overview')
    || identity.includes('dashboard')
    || identity.includes('home')
  ) {
    return 'overview';
  }

  if (
    identity.includes('pos')
    || identity.includes('sale')
    || identity.includes('checkout')
  ) {
    return 'pos';
  }

  if (
    identity.includes('inventory')
    || identity.includes('stock')
    || identity.includes('product')
    || identity.includes('warehouse')
  ) {
    return 'inventory';
  }

  if (
    identity.includes('procurement')
    || identity.includes('supplier')
    || identity.includes('purchase')
    || identity.includes('receiving')
  ) {
    return 'procurement';
  }

  if (
    identity.includes('insurance')
    || identity.includes('claim')
  ) {
    return 'insurance';
  }

  if (
    identity.includes('finance')
    || identity.includes('payment')
    || identity.includes('expense')
    || identity.includes('receivable')
    || identity.includes('account')
  ) {
    return 'finance';
  }

  if (
    identity.includes('prescription')
    || identity.includes('patient')
    || identity.includes('customer')
    || identity.includes('pharmacy')
  ) {
    return 'clinical';
  }

  if (
    identity.includes('report')
    || identity.includes('analytics')
    || identity.includes('insight')
  ) {
    return 'reports';
  }

  if (
    identity.includes('user')
    || identity.includes('staff')
    || identity.includes('role')
    || identity.includes('access')
  ) {
    return 'users';
  }

  if (
    identity.includes('setting')
    || identity.includes('configuration')
    || identity.includes('notification')
    || identity.includes('communication')
    || identity.includes('automation')
  ) {
    return 'settings';
  }

  return 'module';
}

function moduleIllustration(
  key: string,
  label: string,
): string {
  const identity = `${key} ${label}`;
  const accent = accentFor(identity);
  const category = moduleCategory(
    key,
    label,
  );

  const code = escapeHtml(
    shortCode(label),
  );

  const gradientId =
    `dock-gradient-${hashValue(identity)}`;

  const start = `
    <svg
      viewBox="0 0 72 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="${gradientId}"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop
            offset="0"
            stop-color="${accent}"
            stop-opacity="0.98"
          />
          <stop
            offset="1"
            stop-color="${accent}"
            stop-opacity="0.58"
          />
        </linearGradient>
      </defs>

      <rect
        x="4"
        y="4"
        width="64"
        height="56"
        rx="15"
        fill="url(#${gradientId})"
      />

      <rect
        x="5"
        y="5"
        width="62"
        height="54"
        rx="14"
        fill="none"
        stroke="rgba(255,255,255,0.48)"
      />
  `;

  const end = `
      <circle
        cx="57"
        cy="13"
        r="8"
        fill="rgba(255,255,255,0.20)"
      />

      <text
        x="57"
        y="16"
        text-anchor="middle"
        font-size="7"
        font-weight="800"
        fill="#ffffff"
      >${code}</text>
    </svg>
  `;

  if (category === 'overview') {
    return `${start}
      <rect x="14" y="17" width="17" height="13" rx="3" fill="rgba(255,255,255,0.88)"/>
      <rect x="35" y="17" width="22" height="13" rx="3" fill="rgba(255,255,255,0.60)"/>
      <rect x="14" y="34" width="43" height="13" rx="3" fill="rgba(255,255,255,0.24)"/>
      <path d="M18 42 L25 38 L32 43 L39 35 L47 39 L54 32" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    ${end}`;
  }

  if (category === 'pos') {
    return `${start}
      <rect x="12" y="15" width="29" height="33" rx="5" fill="rgba(255,255,255,0.88)"/>
      <rect x="17" y="20" width="19" height="8" rx="2" fill="${accent}" opacity="0.42"/>
      <circle cx="20" cy="35" r="2" fill="${accent}"/>
      <circle cx="27" cy="35" r="2" fill="${accent}"/>
      <circle cx="34" cy="35" r="2" fill="${accent}"/>
      <path d="M44 20 H58 V49 L54 46 L50 49 L46 46 L42 49 V24 A4 4 0 0 1 46 20Z" fill="rgba(255,255,255,0.60)"/>
      <path d="M47 28 H54 M47 33 H54 M47 38 H52" stroke="${accent}" stroke-width="1.8" stroke-linecap="round"/>
    ${end}`;
  }

  if (category === 'inventory') {
    return `${start}
      <path d="M14 19 H58 M14 33 H58 M14 47 H58" stroke="rgba(255,255,255,0.68)" stroke-width="2"/>
      <rect x="17" y="12" width="13" height="10" rx="2" fill="rgba(255,255,255,0.88)"/>
      <rect x="34" y="12" width="18" height="10" rx="2" fill="rgba(255,255,255,0.48)"/>
      <rect x="18" y="25" width="18" height="10" rx="2" fill="rgba(255,255,255,0.52)"/>
      <rect x="40" y="25" width="14" height="10" rx="2" fill="rgba(255,255,255,0.86)"/>
      <rect x="23" y="39" width="16" height="10" rx="2" fill="rgba(255,255,255,0.78)"/>
      <rect x="43" y="39" width="10" height="10" rx="2" fill="rgba(255,255,255,0.42)"/>
    ${end}`;
  }

  if (category === 'procurement') {
    return `${start}
      <rect x="12" y="15" width="26" height="34" rx="4" fill="rgba(255,255,255,0.85)"/>
      <rect x="19" y="11" width="12" height="7" rx="3" fill="rgba(255,255,255,0.55)"/>
      <path d="M18 26 H32 M18 32 H32 M18 38 H28" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>
      <path d="M41 29 H54 L60 36 V46 H42Z" fill="rgba(255,255,255,0.58)"/>
      <circle cx="46" cy="47" r="4" fill="#ffffff"/>
      <circle cx="56" cy="47" r="4" fill="#ffffff"/>
    ${end}`;
  }

  if (category === 'insurance') {
    return `${start}
      <path d="M25 14 L40 19 V31 C40 41 33 47 25 51 C17 47 10 41 10 31 V19Z" fill="rgba(255,255,255,0.86)"/>
      <path d="M25 23 V40 M17 31 H33" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
      <rect x="40" y="20" width="20" height="28" rx="4" fill="rgba(255,255,255,0.52)"/>
      <path d="M45 28 H55 M45 34 H55 M45 40 H52" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
    ${end}`;
  }

  if (category === 'finance') {
    return `${start}
      <rect x="12" y="15" width="38" height="35" rx="5" fill="rgba(255,255,255,0.84)"/>
      <path d="M22 15 V50" stroke="${accent}" stroke-width="2"/>
      <path d="M28 24 H43 M28 31 H43 M28 38 H40" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="52" cy="42" r="10" fill="rgba(255,255,255,0.64)"/>
      <path d="M49 38 C54 35 57 40 53 42 C48 44 50 48 55 46" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>
    ${end}`;
  }

  if (category === 'clinical') {
    return `${start}
      <rect x="13" y="18" width="22" height="31" rx="5" fill="rgba(255,255,255,0.82)"/>
      <rect x="18" y="13" width="12" height="8" rx="3" fill="rgba(255,255,255,0.55)"/>
      <path d="M19 31 H29 M24 26 V36" stroke="${accent}" stroke-width="2.7" stroke-linecap="round"/>
      <path d="M41 16 H57 V49 H39 V20Z" fill="rgba(255,255,255,0.52)"/>
      <text x="48" y="32" text-anchor="middle" font-size="12" font-weight="900" fill="#ffffff">Rx</text>
      <path d="M44 38 H53 M44 43 H51" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round"/>
    ${end}`;
  }

  if (category === 'reports') {
    return `${start}
      <rect x="13" y="13" width="45" height="38" rx="5" fill="rgba(255,255,255,0.82)"/>
      <rect x="20" y="33" width="6" height="11" rx="2" fill="${accent}"/>
      <rect x="30" y="26" width="6" height="18" rx="2" fill="${accent}" opacity="0.78"/>
      <rect x="40" y="20" width="6" height="24" rx="2" fill="${accent}" opacity="0.58"/>
      <path d="M18 24 L28 20 L37 23 L50 16" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>
    ${end}`;
  }

  if (category === 'users') {
    return `${start}
      <rect x="12" y="16" width="26" height="32" rx="5" fill="rgba(255,255,255,0.82)"/>
      <circle cx="25" cy="26" r="6" fill="${accent}" opacity="0.62"/>
      <path d="M17 42 C18 34 32 34 33 42" fill="${accent}" opacity="0.62"/>
      <rect x="40" y="20" width="20" height="27" rx="4" fill="rgba(255,255,255,0.48)"/>
      <circle cx="50" cy="29" r="4" fill="#ffffff"/>
      <path d="M44 41 C45 35 55 35 56 41" fill="#ffffff"/>
    ${end}`;
  }

  if (category === 'settings') {
    return `${start}
      <path d="M16 22 H56 M16 32 H56 M16 42 H56" stroke="rgba(255,255,255,0.76)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="29" cy="22" r="5" fill="#ffffff"/>
      <circle cx="45" cy="32" r="5" fill="#ffffff"/>
      <circle cx="24" cy="42" r="5" fill="#ffffff"/>
      <circle cx="29" cy="22" r="2" fill="${accent}"/>
      <circle cx="45" cy="32" r="2" fill="${accent}"/>
      <circle cx="24" cy="42" r="2" fill="${accent}"/>
    ${end}`;
  }

  return `${start}
    <rect x="14" y="15" width="18" height="15" rx="4" fill="rgba(255,255,255,0.86)"/>
    <rect x="38" y="15" width="18" height="15" rx="4" fill="rgba(255,255,255,0.52)"/>
    <rect x="14" y="35" width="18" height="15" rx="4" fill="rgba(255,255,255,0.52)"/>
    <rect x="38" y="35" width="18" height="15" rx="4" fill="rgba(255,255,255,0.86)"/>
  ${end}`;
}

function isLikelyPhone(): boolean {
  return (
    window.matchMedia(
      '(pointer: coarse)',
    ).matches
    && Math.min(
      window.screen.width,
      window.screen.height,
    ) < 700
  );
}

function shouldRenderDock(): boolean {
  return (
    window.innerWidth >= MINIMUM_WIDTH
    && !isLikelyPhone()
  );
}

function readRecent(): RecentWorkspace[] {
  try {
    const stored =
      sessionStorage.getItem(
        RECENT_STORAGE_KEY,
      );

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => (
        entry
        && typeof entry.key === 'string'
        && typeof entry.label === 'string'
      ))
      .map((entry) => ({
        key: String(entry.key),
        label: String(entry.label),
        scrollY: Number(entry.scrollY || 0),
        updatedAt: Number(
          entry.updatedAt || Date.now(),
        ),
      }))
      .slice(0, MAXIMUM_RECENT);
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
        entries.slice(0, MAXIMUM_RECENT),
      ),
    );
  } catch {
    // Navigation remains available without persistence.
  }
}

function discoverModules(): DockModule[] {
  const modules: DockModule[] = [];
  const seen = new Set<string>();

  document
    .querySelectorAll<HTMLElement>(
      '.principal-menu-title',
    )
    .forEach((title) => {
      const label =
        title.textContent?.trim() || '';

      if (
        label.toLowerCase() !== 'dashboard'
      ) {
        return;
      }

      const button =
        title.closest('button');

      if (
        !(button instanceof HTMLButtonElement)
        || seen.has('dashboard')
      ) {
        return;
      }

      modules.push({
        key: 'dashboard',
        label,
        button,
        active: (
          button.classList.contains('active')
          || button.getAttribute(
            'aria-current',
          ) === 'page'
        ),
      });

      seen.add('dashboard');
    });

  document
    .querySelectorAll<HTMLElement>(
      '.principal-menu-section[data-principal-menu]',
    )
    .forEach((section) => {
      const button =
        section.querySelector(
          '.principal-menu-button',
        );

      if (
        !(button instanceof HTMLButtonElement)
      ) {
        return;
      }

      const title =
        button.querySelector<HTMLElement>(
          '.principal-menu-title',
        );

      const label =
        title?.textContent?.trim()
        || button.textContent?.trim()
        || section.dataset.principalMenu
        || 'Module';

      const key =
        section.dataset.principalMenu
        || button.dataset.principalMenu
        || normaliseKey(label);

      if (!key || seen.has(key)) {
        return;
      }

      modules.push({
        key,
        label,
        button,
        active: (
          section.classList.contains('active')
          || button.classList.contains('active')
          || button.getAttribute(
            'aria-current',
          ) === 'page'
        ),
      });

      seen.add(key);
    });

  return modules;
}

function findSidebar(
  modules: DockModule[],
): HTMLElement | null {
  const firstButton = modules[0]?.button;

  if (!firstButton) {
    return null;
  }

  const direct =
    firstButton.closest(
      'aside, nav, [class*="sidebar"], [class*="principal-menu"]',
    );

  if (direct instanceof HTMLElement) {
    return direct;
  }

  const requiredSections =
    document.querySelectorAll(
      '.principal-menu-section',
    ).length;

  let candidate: HTMLElement | null =
    firstButton.parentElement;

  while (
    candidate
    && candidate !== document.body
  ) {
    const sectionCount =
      candidate.querySelectorAll(
        '.principal-menu-section',
      ).length;

    if (
      sectionCount >= Math.max(
        1,
        requiredSections,
      )
    ) {
      return candidate;
    }

    candidate = candidate.parentElement;
  }

  return null;
}

function applyFullWidthLayout(
  modules: DockModule[],
): void {
  const sidebar = findSidebar(modules);

  if (sidebar) {
    sidebar.setAttribute(
      'data-ubuzima-legacy-sidebar-preview',
      'hidden',
    );

    const parent = sidebar.parentElement;

    if (parent) {
      parent.setAttribute(
        'data-ubuzima-workspace-layout-preview',
        'full-width',
      );
    }
  }

  document
    .querySelectorAll<HTMLElement>('main')
    .forEach((main) => {
      if (!main.parentElement?.closest('main')) {
        main.setAttribute(
          'data-ubuzima-workspace-main-preview',
          'full-width',
        );
      }
    });
}

function restoreLayout(): void {
  document
    .querySelectorAll<HTMLElement>(
      '[data-ubuzima-legacy-sidebar-preview]',
    )
    .forEach((element) => {
      element.removeAttribute(
        'data-ubuzima-legacy-sidebar-preview',
      );
    });

  document
    .querySelectorAll<HTMLElement>(
      '[data-ubuzima-workspace-layout-preview]',
    )
    .forEach((element) => {
      element.removeAttribute(
        'data-ubuzima-workspace-layout-preview',
      );
    });

  document
    .querySelectorAll<HTMLElement>(
      '[data-ubuzima-workspace-main-preview]',
    )
    .forEach((element) => {
      element.removeAttribute(
        'data-ubuzima-workspace-main-preview',
      );
    });
}

function activeScrollContainer(): HTMLElement | null {
  const main =
    document.querySelector<HTMLElement>(
      '[data-ubuzima-workspace-main-preview]',
    );

  if (
    main
    && main.scrollHeight > main.clientHeight
  ) {
    return main;
  }

  return null;
}

function currentScrollPosition(): number {
  const container =
    activeScrollContainer();

  return container
    ? container.scrollTop
    : window.scrollY;
}

function restoreScrollPosition(
  scrollY: number,
): void {
  const container =
    activeScrollContainer();

  if (container) {
    container.scrollTo({
      top: scrollY,
      behavior: 'auto',
    });

    return;
  }

  window.scrollTo({
    top: scrollY,
    behavior: 'auto',
  });
}

function saveCurrentWorkspace(
  module: DockModule | undefined,
): void {
  if (!module) {
    return;
  }

  const recent =
    readRecent().filter(
      (entry) => entry.key !== module.key,
    );

  recent.unshift({
    key: module.key,
    label: module.label,
    scrollY: currentScrollPosition(),
    updatedAt: Date.now(),
  });

  writeRecent(recent);
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

function navigateToModule(
  key: string,
): void {
  const modules = discoverModules();

  const target = modules.find(
    (module) => module.key === key,
  );

  if (!target) {
    removeRecentWorkspace(key);
    scheduleRender();
    return;
  }

  const current = modules.find(
    (module) => module.active,
  );

  if (current?.key === target.key) {
    return;
  }

  const targetState =
    readRecent().find(
      (entry) => entry.key === target.key,
    );

  saveCurrentWorkspace(current);
  removeRecentWorkspace(target.key);

  target.button.click();

  window.setTimeout(() => {
    restoreScrollPosition(
      targetState?.scrollY || 0,
    );

    scheduleRender();
  }, 180);

  window.setTimeout(
    scheduleRender,
    500,
  );
}

function injectStyles(): void {
  if (
    document.getElementById(
      'ubuzima-workspace-dock-production-v3-styles',
    )
  ) {
    return;
  }

  const style =
    document.createElement('style');

  style.id =
    'ubuzima-workspace-dock-production-v3-styles';

  style.textContent = `
    :root {
      --ubuzima-workspace-dock-safe-area: 132px;
    }

    [data-ubuzima-legacy-sidebar-preview="hidden"] {
      display: none !important;
      width: 0 !important;
      min-width: 0 !important;
      max-width: 0 !important;
      flex-basis: 0 !important;
      overflow: hidden !important;
    }

    [data-ubuzima-workspace-layout-preview="full-width"] {
      grid-template-columns:
        minmax(0, 1fr) !important;
      padding-left: 0 !important;
      margin-left: 0 !important;
    }

    [data-ubuzima-workspace-main-preview="full-width"] {
      width: 100% !important;
      min-width: 0 !important;
      max-width: none !important;
      margin-left: 0 !important;
      padding-bottom:
        var(--ubuzima-workspace-dock-safe-area)
        !important;
      box-sizing: border-box !important;
    }

    .ubuzima-glass-workspace-dock {
      position: fixed;
      z-index: 2147482000;
      left: 50%;
      bottom:
        max(
          18px,
          env(safe-area-inset-bottom)
        );

      transform: translateX(-50%);

      display: grid;
      grid-template-columns:
        minmax(0, 1fr)
        minmax(220px, 278px);

      align-items: stretch;

      width:
        min(
          1180px,
          calc(100vw - 40px)
        );

      min-height: 88px;
      max-height: 112px;

      padding: 9px;
      gap: 9px;

      border:
        1px solid
        rgba(255, 255, 255, 0.34);

      border-radius: 25px;

      background:
        linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.24),
          rgba(255, 255, 255, 0.08)
        );

      box-shadow:
        0 22px 54px
          rgba(16, 28, 42, 0.22),
        0 7px 18px
          rgba(16, 28, 42, 0.12),
        inset 0 1px 0
          rgba(255, 255, 255, 0.58);

      -webkit-backdrop-filter:
        blur(24px)
        saturate(150%);

      backdrop-filter:
        blur(24px)
        saturate(150%);

      box-sizing: border-box;
      isolation: isolate;
    }

    .ubuzima-glass-workspace-dock::before {
      content: "";
      position: absolute;
      inset: 1px 10px auto;
      height: 1px;
      border-radius: 100%;

      background:
        linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.76),
          transparent
        );

      pointer-events: none;
    }

    .ubuzima-glass-workspace-dock__modules {
      display: flex;
      align-items: center;
      gap: 7px;

      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;

      padding: 3px 5px 5px;

      scrollbar-width: thin;
      scrollbar-color:
        rgba(68, 88, 108, 0.26)
        transparent;
    }

    .ubuzima-glass-workspace-dock__module {
      position: relative;

      display: grid;
      grid-template-rows: 58px 16px;
      align-items: center;
      justify-items: center;

      flex: 0 0 68px;
      width: 68px;
      height: 78px;

      padding: 0;
      border: 0;
      border-radius: 17px;

      color: #172735;
      background: transparent;
      cursor: pointer;

      box-sizing: border-box;

      transition:
        background 150ms ease,
        box-shadow 150ms ease;
    }

    .ubuzima-glass-workspace-dock__module:hover,
    .ubuzima-glass-workspace-dock__module:focus-visible {
      background:
        rgba(255, 255, 255, 0.23);

      box-shadow:
        inset 0 0 0 1px
        rgba(255, 255, 255, 0.30);

      outline: none;
    }

    .ubuzima-glass-workspace-dock__visual {
      display: block;
      width: 58px;
      height: 54px;

      transform:
        translateY(0)
        scale(1);

      transform-origin: 50% 100%;

      filter:
        drop-shadow(
          0 7px 7px
          rgba(20, 34, 49, 0.18)
        );

      transition:
        transform
          170ms
          cubic-bezier(.2, .8, .2, 1),
        filter 170ms ease;
    }

    .ubuzima-glass-workspace-dock__module:hover
      .ubuzima-glass-workspace-dock__visual,
    .ubuzima-glass-workspace-dock__module:focus-visible
      .ubuzima-glass-workspace-dock__visual {
      transform:
        translateY(-4px)
        scale(1.10);

      filter:
        drop-shadow(
          0 10px 9px
          rgba(20, 34, 49, 0.24)
        );
    }

    .ubuzima-glass-workspace-dock__label {
      display: block;
      width: 64px;

      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      font-size: 9px;
      font-weight: 750;
      line-height: 1;
      text-align: center;
    }

    .ubuzima-glass-workspace-dock__module.is-active::after {
      content: "";

      position: absolute;
      left: 50%;
      bottom: -1px;

      width: 22px;
      height: 3px;

      border-radius: 100px;

      background:
        linear-gradient(
          90deg,
          transparent,
          var(--dock-accent),
          transparent
        );

      box-shadow:
        0 0 8px
        var(--dock-accent);

      transform: translateX(-50%);
    }

    .ubuzima-glass-workspace-dock__recent {
      display: grid;
      grid-template-rows: auto 1fr;

      min-width: 0;
      padding: 8px 9px;

      border-left:
        1px solid
        rgba(255, 255, 255, 0.30);

      border-radius: 18px;

      background:
        rgba(255, 255, 255, 0.13);

      box-shadow:
        inset 0 0 0 1px
        rgba(255, 255, 255, 0.16);

      overflow: hidden;
    }

    .ubuzima-glass-workspace-dock__recent-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;

      margin-bottom: 5px;
    }

    .ubuzima-glass-workspace-dock__recent-title {
      color: #1a2c39;
      font-size: 10px;
      font-weight: 850;
      letter-spacing: 0.02em;
    }

    .ubuzima-glass-workspace-dock__badge {
      padding: 3px 6px;

      border:
        1px solid
        rgba(31, 122, 104, 0.22);

      border-radius: 99px;

      color: #1f6d60;
      background:
        rgba(255, 255, 255, 0.36);

      font-size: 7px;
      font-weight: 900;
      letter-spacing: 0.08em;
    }

    .ubuzima-glass-workspace-dock__recent-list {
      display: flex;
      align-items: center;
      gap: 5px;

      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;

      scrollbar-width: thin;
    }

    .ubuzima-glass-workspace-dock__recent-item {
      display: grid;
      grid-template-columns:
        31px
        minmax(45px, 1fr)
        18px;

      align-items: center;
      gap: 4px;

      flex: 0 0 114px;
      min-width: 114px;
      max-width: 132px;
      height: 42px;

      padding: 4px 4px 4px 5px;

      border:
        1px solid
        rgba(255, 255, 255, 0.30);

      border-radius: 13px;

      color: #1a2a37;
      background:
        rgba(255, 255, 255, 0.20);

      box-sizing: border-box;
    }

    .ubuzima-glass-workspace-dock__recent-open {
      display: contents;
      color: inherit;
      cursor: pointer;
    }

    .ubuzima-glass-workspace-dock__recent-visual {
      width: 31px;
      height: 28px;
      overflow: hidden;
    }

    .ubuzima-glass-workspace-dock__recent-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      font-size: 8.5px;
      font-weight: 800;
    }

    .ubuzima-glass-workspace-dock__recent-close {
      display: grid;
      place-items: center;

      width: 18px;
      height: 18px;
      padding: 0;

      border: 0;
      border-radius: 50%;

      color: #425361;
      background:
        rgba(255, 255, 255, 0.32);

      font-size: 12px;
      line-height: 1;
      cursor: pointer;
    }

    .ubuzima-glass-workspace-dock__recent-close:hover,
    .ubuzima-glass-workspace-dock__recent-close:focus-visible {
      color: #8c2f3d;
      background:
        rgba(255, 255, 255, 0.58);
      outline: none;
    }

    .ubuzima-glass-workspace-dock__empty {
      display: flex;
      align-items: center;

      min-height: 38px;

      color:
        rgba(30, 47, 61, 0.66);

      font-size: 8.5px;
      font-weight: 650;
      line-height: 1.25;
    }

    @media (max-width: 1024px) {
      :root {
        --ubuzima-workspace-dock-safe-area:
          122px;
      }

      .ubuzima-glass-workspace-dock {
        grid-template-columns:
          minmax(0, 1fr)
          218px;

        width:
          calc(100vw - 24px);

        bottom: 12px;
        border-radius: 22px;
      }

      .ubuzima-glass-workspace-dock__module {
        grid-template-rows: 53px 14px;
        flex-basis: 60px;
        width: 60px;
        height: 72px;
      }

      .ubuzima-glass-workspace-dock__visual {
        width: 53px;
        height: 49px;
      }

      .ubuzima-glass-workspace-dock__label {
        width: 56px;
        font-size: 8px;
      }

      .ubuzima-glass-workspace-dock__recent-item {
        flex-basis: 102px;
        min-width: 102px;
      }
    }

    @media (max-width: 767px) {
      .ubuzima-glass-workspace-dock {
        display: none !important;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .ubuzima-glass-workspace-dock *,
      .ubuzima-glass-workspace-dock *::before,
      .ubuzima-glass-workspace-dock *::after {
        transition: none !important;
        animation: none !important;
      }
    }

    @supports not (
      (backdrop-filter: blur(2px))
      or
      (-webkit-backdrop-filter: blur(2px))
    ) {
      .ubuzima-glass-workspace-dock {
        background:
          rgba(242, 247, 249, 0.95);
      }
    }
  `;

  document.head.appendChild(style);
}

function ensureDock(): HTMLElement {
  const existing =
    document.querySelector<HTMLElement>(
      '[data-ubuzima-workspace-dock]',
    );

  if (existing) {
    return existing;
  }

  const dock =
    document.createElement('nav');

  dock.className =
    'ubuzima-glass-workspace-dock';

  dock.setAttribute(
    'data-ubuzima-workspace-dock',
    BUILD_MARKER,
  );

  dock.setAttribute(
    'aria-label',
    'Ubuzima workspace dock',
  );

  document.body.appendChild(dock);

  return dock;
}

function renderDock(): void {
  if (!shouldRenderDock()) {
    document
      .querySelector(
        '[data-ubuzima-workspace-dock]',
      )
      ?.remove();

    restoreLayout();
    return;
  }

  injectStyles();

  const modules = discoverModules();

  if (modules.length === 0) {
    document
      .querySelector(
        '[data-ubuzima-workspace-dock]',
      )
      ?.remove();

    return;
  }

  applyFullWidthLayout(modules);

  const current = modules.find(
    (module) => module.active,
  );

  const __ubuzimaRecentWorkspaceCandidates =
    readRecent()
      .filter((entry) => (
        entry.key !== current?.key
        && modules.some(
          (module) =>
            module.key === entry.key,
        )
      ))
      .slice(0, MAXIMUM_RECENT);

  const MAX_RECENT_WORKSPACES = 4;
  const RECENT_LIMIT_MARKER =
    'UBIZIMA_WORKSPACE_RECENT_LIMIT_4';
  const recent =
    __ubuzimaRecentWorkspaceCandidates.slice(
      0,
      MAX_RECENT_WORKSPACES,
    );

  const moduleMarkup =
    modules.map((module) => {
      const accent = accentFor(
        `${module.key} ${module.label}`,
      );

      return `
        <button
          type="button"
          class="
            ubuzima-glass-workspace-dock__module
            ${module.active ? 'is-active' : ''}
          "
          data-workspace-module-key="${escapeHtml(module.key)}"
          aria-label="${escapeHtml(module.label)}"
          aria-current="${module.active ? 'page' : 'false'}"
          title="${escapeHtml(module.label)}"
          style="--dock-accent:${accent}"
        >
          <span
            class="ubuzima-glass-workspace-dock__visual"
          >
            ${moduleIllustration(
              module.key,
              module.label,
            )}
          </span>

          <span
            class="ubuzima-glass-workspace-dock__label"
          >
            ${escapeHtml(module.label)}
          </span>
        </button>
      `;
    }).join('');

  const recentMarkup =
    recent.length > 0
      ? recent.map((entry) => `
        <div
          class="ubuzima-glass-workspace-dock__recent-item"
          title="${escapeHtml(entry.label)}"
        >
          <button
            type="button"
            class="ubuzima-glass-workspace-dock__recent-open"
            data-recent-open-key="${escapeHtml(entry.key)}"
            aria-label="Open ${escapeHtml(entry.label)}"
          >
            <span
              class="ubuzima-glass-workspace-dock__recent-visual"
            >
              ${moduleIllustration(
                entry.key,
                entry.label,
              )}
            </span>

            <span
              class="ubuzima-glass-workspace-dock__recent-label"
            >
              ${escapeHtml(entry.label)}
            </span>
          </button>

          <button
            type="button"
            class="ubuzima-glass-workspace-dock__recent-close"
            data-recent-close-key="${escapeHtml(entry.key)}"
            aria-label="Close ${escapeHtml(entry.label)} from recent workspaces"
            title="Close recent workspace"
          >
            ×
          </button>
        </div>
      `).join('')
      : `
        <div
          class="ubuzima-glass-workspace-dock__empty"
        >
          Open another module and it will appear
          here for quick task switching.
        </div>
      `;

  const dock = ensureDock();

  dock.innerHTML = `
    <div
      class="ubuzima-glass-workspace-dock__modules"
      aria-label="Available modules"
    >
      ${moduleMarkup}
    </div>

    <section
      class="ubuzima-glass-workspace-dock__recent"
      aria-label="Recent workspaces"
    >
      <div
        class="ubuzima-glass-workspace-dock__recent-header"
      >
        <span
          class="ubuzima-glass-workspace-dock__recent-title"
        >
          Recent workspaces
        </span>

        <span
          class="ubuzima-glass-workspace-dock__badge"
        >
          PREVIEW
        </span>
      </div>

      <div
        class="ubuzima-glass-workspace-dock__recent-list"
      >
        ${recentMarkup}
      </div>
    </section>
  `;

  dock.setAttribute(
    'data-module-count',
    String(modules.length),
  );

  dock.setAttribute(
    'data-recent-workspace-limit',
    String(MAX_RECENT_WORKSPACES),
  );

  dock.setAttribute(
    'data-recent-workspace-limit-marker',
    RECENT_LIMIT_MARKER,
  );

  dock.setAttribute(
    'data-recent-workspace-count',
    String(recent.length),
  );

  document.documentElement.setAttribute(
    'data-ubuzima-workspace-dock-build',
    BUILD_MARKER,
  );
}

function handleDockClick(
  event: MouseEvent,
): void {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const closeButton =
    target.closest(
      '[data-recent-close-key]',
    );

  if (closeButton instanceof HTMLElement) {
    const key =
      closeButton.dataset.recentCloseKey;

    if (key) {
      removeRecentWorkspace(key);
      scheduleRender();
    }

    return;
  }

  const recentButton =
    target.closest(
      '[data-recent-open-key]',
    );

  if (recentButton instanceof HTMLElement) {
    const key =
      recentButton.dataset.recentOpenKey;

    if (key) {
      navigateToModule(key);
    }

    return;
  }

  const moduleButton =
    target.closest(
      '[data-workspace-module-key]',
    );

  if (moduleButton instanceof HTMLElement) {
    const key =
      moduleButton.dataset.workspaceModuleKey;

    if (key) {
      navigateToModule(key);
    }
  }
}

let renderTimer = 0;

function scheduleRender(): void {
  window.clearTimeout(renderTimer);

  renderTimer = window.setTimeout(
    renderDock,
    100,
  );
}

function startWorkspaceDock(): void {
  if (
    workspaceDockWindow
      .__ubuzimaWorkspaceDockProductionV3
  ) {
    return;
  }

  workspaceDockWindow
    .__ubuzimaWorkspaceDockProductionV3 = true;

  document.addEventListener(
    'click',
    handleDockClick,
  );

  const observer =
    new MutationObserver((mutations) => {
      const onlyDockChanges =
        mutations.every((mutation) => (
          mutation.target instanceof Element
          && Boolean(
            mutation.target.closest(
              '[data-ubuzima-workspace-dock]',
            ),
          )
        ));

      if (!onlyDockChanges) {
        scheduleRender();
      }
    });

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'class',
        'aria-current',
        'data-principal-menu',
      ],
    },
  );

  window.addEventListener(
    'resize',
    scheduleRender,
    {
      passive: true,
    },
  );

  window.addEventListener(
    'popstate',
    scheduleRender,
  );

  window.setTimeout(
    renderDock,
    40,
  );

  window.setTimeout(
    renderDock,
    400,
  );

  window.setTimeout(
    renderDock,
    1200,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    startWorkspaceDock,
    {
      once: true,
    },
  );
} else {
  startWorkspaceDock();
}

export {};

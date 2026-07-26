const BUILD_MARKER =
  'UBIZIMA_WORKSPACE_DOCK_REFINED_V5';

const ICON_MARKER =
  'UBIZIMA_COLOURFUL_UNIQUE_ICON_FAMILY_V5';

const PROFILE_MARKER =
  'UBIZIMA_DOCK_PROFILE_HUB_V5';

const HEADER_MARKER =
  'UBIZIMA_SHARED_HEADER_RELOCATION_V5';

const RECENT_MARKER =
  'UBIZIMA_FIXED_RECENT_TASK_CARDS_V5';

const GLASS_MARKER =
  'UBIZIMA_DEEP_GLASS_TRANSPARENCY_V5';

const NAVIGATION_MARKER =
  'UBIZIMA_AUTHORITATIVE_NAVIGATION_V5';

const MINIMUM_WIDTH = 768;
const MAXIMUM_RECENT = 4;

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

let renderTimer = 0;
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

function shouldRenderDock(): boolean {
  return (
    window.innerWidth >= MINIMUM_WIDTH
    && !isLikelyPhone()
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

function iconInitials(
  label: string,
): string {
  const words =
    label
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (words.length === 0) {
    return 'U+';
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    words[0][0]
    + words[
      words.length - 1
    ][0]
  ).toUpperCase();
}

function colourfulIconDataUri(
  key: string,
  label: string,
): string {
  const hash =
    hashValue(
      `${key}:${label}`,
    );

  const firstHue =
    hash % 360;

  const secondHue =
    (
      firstHue
      + 58
      + (
        hash % 47
      )
    ) % 360;

  const accentHue =
    (
      firstHue
      + 176
    ) % 360;

  const initials =
    iconInitials(label);

  const orbitX =
    15
    + (
      hash % 13
    );

  const orbitY =
    13
    + (
      (
        hash >>> 5
      ) % 15
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
          id="g"
          x1="5"
          y1="4"
          x2="58"
          y2="61"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset="0"
            stop-color="hsl(${firstHue} 92% 62%)"
          />
          <stop
            offset="0.52"
            stop-color="hsl(${secondHue} 88% 56%)"
          />
          <stop
            offset="1"
            stop-color="hsl(${accentHue} 90% 48%)"
          />
        </linearGradient>

        <radialGradient
          id="shine"
          cx="0"
          cy="0"
          r="1"
          gradientTransform="translate(20 12) rotate(58) scale(47)"
        >
          <stop
            stop-color="white"
            stop-opacity="0.74"
          />
          <stop
            offset="1"
            stop-color="white"
            stop-opacity="0"
          />
        </radialGradient>

        <filter
          id="shadow"
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="4"
            flood-color="hsl(${firstHue} 65% 22%)"
            flood-opacity="0.25"
          />
        </filter>
      </defs>

      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="18"
        fill="url(#g)"
        filter="url(#shadow)"
      />

      <circle
        cx="${orbitX}"
        cy="${orbitY}"
        r="13"
        fill="url(#shine)"
      />

      <circle
        cx="49"
        cy="47"
        r="12"
        fill="white"
        fill-opacity="0.11"
      />

      <path
        d="M13 42C22 28 34 22 51 17"
        fill="none"
        stroke="white"
        stroke-opacity="0.17"
        stroke-width="3"
        stroke-linecap="round"
      />

      <rect
        x="13"
        y="13"
        width="38"
        height="38"
        rx="13"
        fill="white"
        fill-opacity="0.13"
        stroke="white"
        stroke-opacity="0.21"
      />

      <text
        x="32"
        y="38"
        text-anchor="middle"
        fill="white"
        font-family="Inter, Arial, sans-serif"
        font-size="${initials.length > 2 ? 14 : 17}"
        font-weight="850"
        letter-spacing="-0.8"
      >
        ${escapeHtml(initials)}
      </text>

      <circle
        cx="49"
        cy="15"
        r="3.5"
        fill="white"
        fill-opacity="0.82"
      />
    </svg>
  `;

  return (
    'data:image/svg+xml;charset=UTF-8,'
    + encodeURIComponent(
      svg.trim(),
    )
  );
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
        colourfulIconDataUri(
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
        colourfulIconDataUri(
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
          colourfulIconDataUri(
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
    || iconInitials(name);

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

function invokeModule(
  key: string,
): boolean {
  const button =
    sourceButtonForKey(key);

  if (!button) {
    return false;
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

  window.setTimeout(
    () => {
      if (moduleIsActive(key)) {
        return;
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
        firstChild.click();
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
      (module) =>
        module.key === key,
    );

  if (!target) {
    removeRecent(key);
    scheduleRender(true);
    return;
  }

  rememberCurrentWorkspace();

  if (!invokeModule(key)) {
    removeRecent(key);
    scheduleRender(true);
    return;
  }

  profileOpen = false;

  window.setTimeout(
    () => {
      const refreshed =
        discoverModules().find(
          (module) =>
            module.key === key,
        )
        || target;

      rememberWorkspace(
        refreshed,
        restoreScroll ?? 0,
      );

      if (
        typeof restoreScroll
        === 'number'
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

  document.head.appendChild(
    style,
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

  document.body.appendChild(
    dock,
  );

  return dock;
}

function profileButtonMarkup(
  snapshot: ProfileSnapshot,
): string {
  const profileIcon =
    colourfulIconDataUri(
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
      aria-label="Open Profile"
      aria-expanded="${profileOpen ? 'true' : 'false'}"
      title="Profile"
    >
      <img
        class="ubuzima-workspace-dock-v5__icon"
        src="${profileIcon}"
        alt=""
        draggable="false"
      />
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
      data-colourful-icon-identity="${escapeHtml(module.key)}"
      aria-label="Open ${escapeHtml(module.label)}"
      aria-pressed="${module.active ? 'true' : 'false'}"
      title="${escapeHtml(module.label)}"
    >
      <img
        class="ubuzima-workspace-dock-v5__icon"
        src="${module.icon}"
        alt=""
        draggable="false"
      />

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
    >
      <button
        type="button"
        class="ubuzima-workspace-dock-v5__recent-open"
        data-recent-open-key="${escapeHtml(entry.key)}"
        data-dock-tooltip="${escapeHtml(entry.label)}"
        aria-label="Open ${escapeHtml(entry.label)}"
        title="${escapeHtml(entry.label)}"
      >
        <img
          class="ubuzima-workspace-dock-v5__recent-icon"
          src="${module.icon}"
          alt=""
          draggable="false"
        />

        <span
          class="ubuzima-workspace-dock-v5__recent-name"
        >
          ${escapeHtml(entry.label)}
        </span>
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
    colourfulIconDataUri(
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

        <section
          class="ubuzima-workspace-dock-v5__recent"
          aria-label="Recent tasks"
        >
          <header
            class="ubuzima-workspace-dock-v5__recent-header"
          >
            <strong>Recent Tasks</strong>

            <span
              class="ubuzima-workspace-dock-v5__recent-count"
              aria-label="${recent.length} recent tasks"
            >
              ${recent.length}
            </span>
          </header>

          <div
            class="ubuzima-workspace-dock-v5__recent-list"
          >
            ${
              recentCards
              || `
                <div
                  class="ubuzima-workspace-dock-v5__recent-empty"
                >
                  Open a module to create a recent task.
                </div>
              `
            }
          </div>
        </section>
      `;

      lastStructureSignature =
        signature;
    }

    const activeKey =
      modules.find(
        (module) => module.active,
      )?.key
      || '';

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
      'colourful-deterministic-unique',
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
      'fixed-height-icon-and-name',
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
  window.clearTimeout(
    renderTimer,
  );

  renderTimer =
    window.setTimeout(
      () => {
        renderDock(
          forceStructure,
        );
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
      .__ubuzimaWorkspaceDockV5
  ) {
    return;
  }

  window
    .__ubuzimaWorkspaceDockV5 =
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
      characterData: true,
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
        if (profileOpen) {
          profileOpen = false;
          scheduleRender(true);
          return;
        }

        window.setTimeout(
          () => scheduleRender(false),
          70,
        );

        window.setTimeout(
          () => scheduleRender(false),
          250,
        );
      }
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

  window.setTimeout(
    () => renderDock(true),
    400,
  );

  window.setTimeout(
    () => renderDock(false),
    1200,
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

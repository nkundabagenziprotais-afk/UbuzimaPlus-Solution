const BUILD_MARKER =
  'UBIZIMA_PERMANENT_TASKBAR_REMOVAL_PREVIEW_V2B';

const RUNTIME_MARKER =
  'UBIZIMA_TASKBAR_DOM_REMOVAL_RUNTIME_V2B';

const ROOT_CLASS =
  'ubuzima-permanent-taskbar-removal-v2b';

const STYLE_ID =
  'ubuzima-permanent-taskbar-removal-v2b-style';

const TASKBAR_SELECTORS = [
  '.ubuzima-permanent-taskbar',
  '[data-ubuzima-permanent-taskbar]',
  '#ubuzima-taskbar',
  '.ubuzima-taskbar',
  '#ubuzima-desktop-dock',
  '.ubuzima-desktop-dock',
  '[data-ubuzima-desktop-dock]',
  '[data-ubuzima-permanent-dock]',
];

type TaskbarRemovalWindow = Window & {
  __ubuzimaPermanentTaskbarRemovalV2B?: boolean;
};

const taskbarWindow =
  window as TaskbarRemovalWindow;

let removalTimer = 0;
let totalRemoved = 0;

function desktopOrTablet(): boolean {
  return window.innerWidth >= 768;
}

function ensureRemovalStyle(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style =
    document.createElement('style');

  style.id = STYLE_ID;

  style.textContent = `
    @media (min-width: 768px) {
      html.${ROOT_CLASS} {
        --ubuzima-taskbar-height: 0px !important;
        --ubuzima-dock-height: 0px !important;
        --ubuzima-bottom-nav-height: 0px !important;
      }

      html.${ROOT_CLASS}
        .ubuzima-permanent-taskbar,
      html.${ROOT_CLASS}
        [data-ubuzima-permanent-taskbar],
      html.${ROOT_CLASS}
        #ubuzima-taskbar,
      html.${ROOT_CLASS}
        .ubuzima-taskbar,
      html.${ROOT_CLASS}
        #ubuzima-desktop-dock,
      html.${ROOT_CLASS}
        .ubuzima-desktop-dock,
      html.${ROOT_CLASS}
        [data-ubuzima-desktop-dock],
      html.${ROOT_CLASS}
        [data-ubuzima-permanent-dock],
      html.${ROOT_CLASS}
        [data-ubuzima-workspace-dock-preview],
      html.${ROOT_CLASS}
        .ubuzima-glass-workspace-dock {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transform: none !important;
      }

      html.${ROOT_CLASS} body {
        padding-bottom: 0 !important;
      }
    }
  `;

  document.head.appendChild(style);
}

function removeTaskbarNodes(): number {
  if (!desktopOrTablet()) {
    return 0;
  }

  let removedNow = 0;

  document
    .querySelectorAll<HTMLElement>(
      TASKBAR_SELECTORS.join(','),
    )
    .forEach((candidate) => {
      candidate.remove();
      removedNow += 1;
    });

  totalRemoved += removedNow;

  document.documentElement.setAttribute(
    'data-ubuzima-taskbar-nodes-removed',
    String(totalRemoved),
  );

  return removedNow;
}

function ensureBadge(): void {
  if (
    document.querySelector(
      '[data-ubuzima-taskbar-removal-preview-v2b]',
    )
  ) {
    return;
  }

  const badge =
    document.createElement('div');

  badge.setAttribute(
    'data-ubuzima-taskbar-removal-preview-v2b',
    BUILD_MARKER,
  );

  badge.textContent =
    'OLD TASKBAR REMOVED V2B';

  Object.assign(
    badge.style,
    {
      position: 'fixed',
      zIndex: '2147483000',
      top: '12px',
      right: '12px',
      padding: '6px 9px',
      border:
        '1px solid rgba(31,122,104,0.28)',
      borderRadius: '999px',
      color: '#145d51',
      background:
        'rgba(245,255,252,0.94)',
      boxShadow:
        '0 6px 16px rgba(20,45,40,0.12)',
      backdropFilter: 'blur(12px)',
      fontSize: '9px',
      fontWeight: '900',
      letterSpacing: '0.08em',
      pointerEvents: 'none',
    },
  );

  document.body.appendChild(badge);
}

function removeBadge(): void {
  document
    .querySelector(
      '[data-ubuzima-taskbar-removal-preview-v2b]',
    )
    ?.remove();
}

function applyTaskbarRemoval(): void {
  ensureRemovalStyle();

  if (!desktopOrTablet()) {
    document.documentElement.classList.remove(
      ROOT_CLASS,
    );

    document.documentElement.removeAttribute(
      'data-ubuzima-permanent-taskbar-removal',
    );

    document.documentElement.removeAttribute(
      'data-ubuzima-taskbar-removal-runtime',
    );

    removeBadge();
    return;
  }

  document.documentElement.classList.add(
    ROOT_CLASS,
  );

  document.documentElement.setAttribute(
    'data-ubuzima-permanent-taskbar-removal',
    BUILD_MARKER,
  );

  document.documentElement.setAttribute(
    'data-ubuzima-taskbar-removal-runtime',
    RUNTIME_MARKER,
  );

  document.documentElement.removeAttribute(
    'data-ubuzima-workspace-dock-runtime',
  );

  document.documentElement.removeAttribute(
    'data-ubuzima-workspace-dock-build',
  );

  removeTaskbarNodes();
  ensureBadge();
}

function scheduleTaskbarRemoval(): void {
  window.clearTimeout(removalTimer);

  removalTimer = window.setTimeout(
    applyTaskbarRemoval,
    20,
  );
}

function startTaskbarRemoval(): void {
  if (
    taskbarWindow
      .__ubuzimaPermanentTaskbarRemovalV2B
  ) {
    return;
  }

  taskbarWindow
    .__ubuzimaPermanentTaskbarRemovalV2B =
    true;

  applyTaskbarRemoval();

  const observer =
    new MutationObserver(
      scheduleTaskbarRemoval,
    );

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true,
    },
  );

  window.addEventListener(
    'resize',
    scheduleTaskbarRemoval,
    {
      passive: true,
    },
  );

  window.addEventListener(
    'orientationchange',
    scheduleTaskbarRemoval,
    {
      passive: true,
    },
  );

  window.addEventListener(
    'pageshow',
    scheduleTaskbarRemoval,
  );

  window.setInterval(
    applyTaskbarRemoval,
    500,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    startTaskbarRemoval,
    {
      once: true,
    },
  );
} else {
  startTaskbarRemoval();
}

export {};

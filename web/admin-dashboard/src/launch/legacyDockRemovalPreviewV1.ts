const BUILD_MARKER =
  'UBIZIMA_LEGACY_DOCK_REMOVAL_PREVIEW_V1';

const ROOT_CLASS =
  'ubuzima-legacy-dock-removal-preview-v1';

const STYLE_ID =
  'ubuzima-legacy-dock-removal-preview-v1-style';

type RemovalPreviewWindow = Window & {
  __ubuzimaLegacyDockRemovalPreviewV1?: boolean;
};

const previewWindow =
  window as RemovalPreviewWindow;

let resizeTimer = 0;

function ensureStyle(): void {
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
        .ubuzima-mobile-bottom-nav,
      html.${ROOT_CLASS}
        #ubuzima-desktop-dock,
      html.${ROOT_CLASS}
        .ubuzima-desktop-dock,
      html.${ROOT_CLASS}
        [data-ubuzima-desktop-dock],
      html.${ROOT_CLASS}
        [data-ubuzima-permanent-taskbar],
      html.${ROOT_CLASS}
        #ubuzima-taskbar,
      html.${ROOT_CLASS}
        .ubuzima-taskbar,
      html.${ROOT_CLASS}
        [id*="desktop-dock"],
      html.${ROOT_CLASS}
        [class*="desktop-dock"],
      html.${ROOT_CLASS}
        [id*="desktopDock"],
      html.${ROOT_CLASS}
        [class*="desktopDock"],
      html.${ROOT_CLASS}
        [id*="source-dock"],
      html.${ROOT_CLASS}
        [class*="source-dock"],
      html.${ROOT_CLASS}
        [data-source-dock],
      html.${ROOT_CLASS}
        [id*="taskbar"],
      html.${ROOT_CLASS}
        [class*="taskbar"],
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

function ensureBadge(): void {
  if (
    document.querySelector(
      '[data-ubuzima-legacy-dock-removal-preview]',
    )
  ) {
    return;
  }

  const badge =
    document.createElement('div');

  badge.setAttribute(
    'data-ubuzima-legacy-dock-removal-preview',
    BUILD_MARKER,
  );

  badge.textContent =
    'OLD DOCK REMOVAL PREVIEW';

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
        'rgba(245,255,252,0.92)',
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
      '[data-ubuzima-legacy-dock-removal-preview]',
    )
    ?.remove();
}

function synchroniseRemoval(): void {
  ensureStyle();

  if (window.innerWidth < 768) {
    document.documentElement.classList.remove(
      ROOT_CLASS,
    );

    document.documentElement.removeAttribute(
      'data-ubuzima-legacy-dock-removal',
    );

    removeBadge();
    return;
  }

  document.documentElement.classList.add(
    ROOT_CLASS,
  );

  document.documentElement.setAttribute(
    'data-ubuzima-legacy-dock-removal',
    BUILD_MARKER,
  );

  document.documentElement.removeAttribute(
    'data-ubuzima-workspace-dock-runtime',
  );

  document.documentElement.removeAttribute(
    'data-ubuzima-workspace-dock-build',
  );

  ensureBadge();
}

function scheduleSynchronisation(): void {
  window.clearTimeout(resizeTimer);

  resizeTimer = window.setTimeout(
    synchroniseRemoval,
    50,
  );
}

function startRemovalPreview(): void {
  if (
    previewWindow
      .__ubuzimaLegacyDockRemovalPreviewV1
  ) {
    return;
  }

  previewWindow
    .__ubuzimaLegacyDockRemovalPreviewV1 =
    true;

  synchroniseRemoval();

  window.addEventListener(
    'resize',
    scheduleSynchronisation,
    {
      passive: true,
    },
  );

  window.addEventListener(
    'orientationchange',
    scheduleSynchronisation,
    {
      passive: true,
    },
  );

  window.addEventListener(
    'pageshow',
    scheduleSynchronisation,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    startRemovalPreview,
    {
      once: true,
    },
  );
} else {
  startRemovalPreview();
}

export {};

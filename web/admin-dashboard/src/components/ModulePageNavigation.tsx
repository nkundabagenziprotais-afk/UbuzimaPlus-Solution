type ModulePageNavigationProps = {
  platformDashboardLabel: string;
  onExitToMainDashboard: () => void;
  onOpenPlatformDashboard: () => void;
  onBack: () => void;
  showMainDashboardExit?: boolean;
};

function ExitIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M15 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
      <path d="M9 12h11" />
    </svg>
  );
}

export function ModulePageNavigation({
  platformDashboardLabel,
  onExitToMainDashboard,
  onOpenPlatformDashboard,
  onBack,
  showMainDashboardExit = true,
}: ModulePageNavigationProps) {
  return (
    <nav
      className="module-page-navigation"
      aria-label="Module page navigation"
    >
      {showMainDashboardExit && (
        <button
          type="button"
          className="module-page-navigation-exit"
          onClick={onExitToMainDashboard}
        >
          <ExitIcon />
          <span>Exit to Main Dashboard</span>
        </button>
      )}

      <div className="module-page-navigation-context">
        <span className="module-page-navigation-label">
          Current platform
        </span>
        <strong>{platformDashboardLabel}</strong>
      </div>

      <div className="module-page-navigation-actions">
        <button
          type="button"
          onClick={onOpenPlatformDashboard}
        >
          <DashboardIcon />
          <span>{platformDashboardLabel}</span>
        </button>

        <button
          type="button"
          className="module-page-navigation-back"
          onClick={onBack}
        >
          <BackIcon />
          <span>Back</span>
        </button>
      </div>
    </nav>
  );
}

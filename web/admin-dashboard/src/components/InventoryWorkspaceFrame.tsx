import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

type InventoryWorkspaceFrameProps = {
  activeView: string;
  onOpenHome: () => void;
  children: ReactNode;
};

const workspaceTitles: Record<string, string> = {
  overview: 'Inventory',
  'product-inventory': 'Product Inventory',
  'product-master': 'Product Master',
  batches: 'Batches and Expiry',
  'near-expiry': 'Near-expiry Stock',
  'low-stock': 'Low-stock Priorities',
  locations: 'Stock Locations',
  shelf: 'Retail Product Shelf',
};

function workspaceTitle(activeView: string): string {
  return (
    workspaceTitles[activeView] ??
    activeView
      .replaceAll('-', ' ')
      .replace(/\b\w/g, (character) =>
        character.toUpperCase(),
      )
  );
}

export function InventoryWorkspaceFrame({
  activeView,
  onOpenHome,
  children,
}: InventoryWorkspaceFrameProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const [hasPopupAction, setHasPopupAction] =
    useState(false);

  const title = workspaceTitle(activeView);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHasPopupAction(
        Boolean(
          contentRef.current?.querySelector(
            '[data-inventory-popup] > .inventory-popup-form__trigger',
          ),
        ),
      );
    });

    return () =>
      window.cancelAnimationFrame(frame);
  }, [activeView, children]);

  function openFirstPopup() {
    const trigger =
      contentRef.current?.querySelector<HTMLElement>(
        '[data-inventory-popup] > .inventory-popup-form__trigger',
      );

    trigger?.click();
  }

  return (
    <section
      className="pos-unified-module-page inventory-pos-parity-workspace"
      data-inventory-workspace={activeView}
      data-work-package="AQUILA_INVENTORY_WORK_PACKAGE_2E_PROFESSIONAL_UPGRADE"
      data-foundation-correction="AQUILA_INVENTORY_WORK_PACKAGE_2F_FOUNDATION_CORRECTION"
    >
      <div className="module-page-sticky-header">
        <nav
          className="module-page-navigation"
          aria-label="Inventory workspace navigation"
        >
          <button
            type="button"
            className="module-page-navigation-exit"
            onClick={onOpenHome}
          >
            Inventory Home
          </button>

          <div className="module-page-navigation-context">
            <span className="module-page-navigation-label">
              Inventory
            </span>

            <strong>{title}</strong>
          </div>

          <div className="module-page-navigation-actions">
            {hasPopupAction && (
              <button
                type="button"
                className="primary"
                onClick={openFirstPopup}
              >
                Open Action
              </button>
            )}

            <button
              type="button"
              className="module-page-navigation-back"
              onClick={onOpenHome}
            >
              Back to Menu
            </button>
          </div>
        </nav>

      </div>

      <div
        ref={contentRef}
        className="module-page-scroll-content inventory-pos-parity-content inventory-professional-registers"
      >
        {children}
      </div>
    </section>
  );
}

import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

type InventoryPopupFormProps = {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  triggerLabel?: string;
  open?: boolean;
  onClose?: () => void;
};

export function InventoryPopupForm({
  id,
  title,
  description,
  children,
  triggerLabel,
  open,
  onClose,
}: InventoryPopupFormProps) {
  const titleId = useId();
  const descriptionId = useId();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = typeof open === 'boolean';
  const isOpen = isControlled ? open : internalOpen;

  function requestClose() {
    if (!isControlled) {
      setInternalOpen(false);
    }

    onClose?.();
  }

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousBodyOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const preferredControl =
        dialogRef.current?.querySelector<HTMLElement>(
          '[data-popup-autofocus="true"], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
        );

      if (preferredControl) {
        preferredControl.focus({
          preventScroll: true,
        });
      } else {
        dialogRef.current?.focus({
          preventScroll: true,
        });
      }
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.clearTimeout(focusTimer);

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );

      document.body.style.overflow =
        previousBodyOverflow;

      const previousFocus =
        previousFocusRef.current ??
        triggerRef.current;

      if (
        previousFocus &&
        document.contains(previousFocus)
      ) {
        previousFocus.focus({
          preventScroll: true,
        });
      }
    };
  }, [isOpen]);

  const popup = isOpen ? (
    <div
      className="inventory-popup-form__backdrop"
      data-inventory-popup-backdrop
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        id={id}
        className="inventory-popup-form__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className="inventory-popup-form__header">
          <div>
            <p className="inventory-popup-form__eyebrow">
              Inventory operation
            </p>

            <h2 id={titleId}>{title}</h2>

            <p id={descriptionId}>
              {description}
            </p>
          </div>

          <button
            type="button"
            className="inventory-popup-form__close"
            aria-label={`Close ${title}`}
            onClick={requestClose}
          >
            ×
          </button>
        </header>

        <div className="inventory-popup-form__content">
          {children}
        </div>

        <footer className="inventory-popup-form__footer">
          <span>
            Existing permissions, validation and audit controls remain active.
          </span>

          <button
            type="button"
            className="secondary"
            onClick={requestClose}
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  ) : null;

  return (
    <div
      className="inventory-popup-form"
      data-inventory-popup
    >
      {triggerLabel && !isControlled && (
        <button
          ref={triggerRef}
          type="button"
          className="inventory-popup-form__trigger"
          onClick={() => setInternalOpen(true)}
        >
          {triggerLabel}
        </button>
      )}

      {popup && typeof document !== 'undefined'
        ? createPortal(
            popup,
            document.body,
          )
        : null}
    </div>
  );
}

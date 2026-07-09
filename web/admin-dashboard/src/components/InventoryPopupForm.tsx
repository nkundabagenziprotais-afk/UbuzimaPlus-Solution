import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

type InventoryPopupFormProps = {
  id: string;
  title: string;
  description: string;
  triggerLabel: string;
  children: ReactNode;
};

export function InventoryPopupForm({
  id,
  title,
  description,
  triggerLabel,
  children,
}: InventoryPopupFormProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);

  function closePopup() {
    const details = detailsRef.current;

    if (!details) {
      return;
    }

    details.open = false;
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closePopup();
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [isOpen]);

  return (
    <details
      ref={detailsRef}
      id={id}
      className="inventory-popup-form"
      data-inventory-popup
      onToggle={(event) =>
        setIsOpen(event.currentTarget.open)
      }
    >
      <summary className="inventory-popup-form__trigger">
        {triggerLabel}
      </summary>

      <div
        className="inventory-popup-form__backdrop"
        onMouseDown={(event) => {
          if (
            event.target === event.currentTarget
          ) {
            closePopup();
          }
        }}
      >
        <section
          className="inventory-popup-form__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onMouseDown={(event) =>
            event.stopPropagation()
          }
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
              onClick={closePopup}
            >
              ×
            </button>
          </header>

          <div className="inventory-popup-form__content">
            {children}
          </div>

          <footer className="inventory-popup-form__footer">
            <span>
              Existing permissions, validation and audit
              controls remain active.
            </span>

            <button
              type="button"
              className="secondary"
              onClick={closePopup}
            >
              Close
            </button>
          </footer>
        </section>
      </div>
    </details>
  );
}

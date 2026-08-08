(() => {
  "use strict";

  const VERSION =
    "2026.08.pos-quantity-price-central-lock-v1";

  if (
    window
      .__UBUZIMA_POS_QUANTITY_PRICE_CENTRAL_LOCK_V1__
  ) {
    return;
  }

  let applications =
    0;

  function important(
    element,
    property,
    value,
  ) {
    element
      ?.style
      ?.setProperty(
        property,
        value,
        "important",
      );
  }

  function lock() {
    const backdrops =
      document.querySelectorAll(
        ".pos-quantity-dialog-backdrop,"
        + ".ubuzima-pos-confirmation-backdrop",
      );

    for (
      const backdrop
      of backdrops
    ) {
      important(
        backdrop,
        "position",
        "fixed",
      );

      important(
        backdrop,
        "inset",
        "0",
      );

      important(
        backdrop,
        "display",
        "grid",
      );

      important(
        backdrop,
        "place-items",
        "center",
      );
    }

    const dialogs =
      document.querySelectorAll(
        ".pos-quantity-dialog,"
        + ".ubuzima-pos-confirmation-dialog",
      );

    for (
      const dialog
      of dialogs
    ) {
      important(
        dialog,
        "position",
        "fixed",
      );

      important(
        dialog,
        "left",
        "50%",
      );

      important(
        dialog,
        "top",
        "50%",
      );

      important(
        dialog,
        "right",
        "auto",
      );

      important(
        dialog,
        "bottom",
        "auto",
      );

      important(
        dialog,
        "transform",
        "translate(-50%, -50%)",
      );

      dialog.dataset
        .ubuzimaCentralPopupLock =
        "v1";
    }

    if (
      backdrops.length
      ||
      dialogs.length
    ) {
      applications +=
        1;
    }
  }

  function schedule() {
    if (
      typeof window
        .requestAnimationFrame ===
        "function"
    ) {
      window.requestAnimationFrame(
        () => {
          window.requestAnimationFrame(
            lock,
          );
        },
      );
    } else {
      window.setTimeout(
        lock,
        0,
      );
    }

    window.setTimeout(
      lock,
      60,
    );
  }

  /*
   * Event-driven positioning only.
   * No event is cancelled or stopped.
   */
  document.addEventListener(
    "click",
    schedule,
    true,
  );

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Enter"
        ||
        event.key === " "
        ||
        event.key === "Escape"
      ) {
        schedule();
      }
    },
    true,
  );

  window.addEventListener(
    "resize",
    schedule,
  );

  window.addEventListener(
    "pageshow",
    schedule,
  );

  schedule();

  window
    .__UBUZIMA_POS_QUANTITY_PRICE_CENTRAL_LOCK_V1__ =
    Object.freeze({
      version:
        VERSION,

      lock:
        schedule,

      diagnostics() {
        return {
          version:
            VERSION,

          applications,

          position:
            "FIXED_TRUE_CENTER",

          desktop:
            "QUANTITY_LEFT_PRICE_RIGHT",

          mobile:
            "ONE_COLUMN",

          prevent_default:
            false,

          propagation_blocking:
            false,

          submit_interception:
            false,

          checkout_interception:
            false,

          mutation_observer:
            false,

          interval_polling:
            false,
        };
      },
    });
})();

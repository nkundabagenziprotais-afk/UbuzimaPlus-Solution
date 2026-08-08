(() => {
  "use strict";

  const VERSION =
    "2026.08.sales-recording-integrity-v3-2-latest-amendments";

  const ROOT_SELECTOR =
    ".pos-transaction-setup-section";

  const DEFAULT_PHONE_HELPERS = [
    "optional. exactly 9 digits when provided.",
    "optional. if entered, exactly 9 digits are required.",
    "enter exactly 9 digits when provided."
  ];

  const state = {
    scans: 0,
    discountHidden: false,
    defaultPhoneHelperHidden: false,
    customerNamePresent: false,
    customerPhoneTinPresent: false,
    validationMessageVisible: false
  };

  let scheduled = false;

  function clean(value) {
    return String(
      value || ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function lower(value) {
    return clean(value)
      .toLowerCase();
  }

  function labelText(label) {
    const span =
      label.querySelector(
        "span"
      );

    return lower(
      span
        ? span.textContent
        : label.textContent
    );
  }

  function labels(root) {
    return Array.from(
      root.querySelectorAll(
        "label"
      )
    );
  }

  function findLabel(
    root,
    wanted
  ) {
    const target =
      wanted.toLowerCase();

    return (
      labels(root).find(
        label =>
          labelText(label) ===
          target
      ) || null
    );
  }

  function hideDiscount(root) {
    const label =
      findLabel(
        root,
        "discount amount"
      );

    if (!label) {
      state.discountHidden =
        false;

      return;
    }

    label.hidden = true;

    label.style.setProperty(
      "display",
      "none",
      "important"
    );

    label.setAttribute(
      "aria-hidden",
      "true"
    );

    label.dataset
      .ubuzimaSalesIntegrityV32Discount =
      "hidden";

    state.discountHidden = true;
  }

  function preserveCustomerFields(root) {
    const name =
      findLabel(
        root,
        "customer name"
      );

    const phoneTin =
      findLabel(
        root,
        "customer phone/tin"
      );

    state.customerNamePresent =
      Boolean(name);

    state.customerPhoneTinPresent =
      Boolean(phoneTin);

    /*
     * IMPORTANT:
     * V3.2 never creates, replaces, hides,
     * removes or moves these fields.
     *
     * They remain fully owned by exact V2.
     */
    return {
      name,
      phoneTin
    };
  }

  function applyPhoneHelper(
    phoneTin
  ) {
    if (!phoneTin) {
      state
        .defaultPhoneHelperHidden =
        false;

      state
        .validationMessageVisible =
        false;

      return;
    }

    const candidates =
      Array.from(
        phoneTin.querySelectorAll(
          "small"
        )
      );

    let defaultHidden =
      false;

    let validationVisible =
      false;

    for (
      const helper
      of candidates
    ) {
      const text =
        lower(
          helper.textContent
        );

      const isDefault =
        DEFAULT_PHONE_HELPERS
          .includes(text)
        ||
        (
          text.includes(
            "optional"
          )
          &&
          text.includes(
            "9 digit"
          )
        );

      if (isDefault) {
        helper.hidden = true;

        helper.style.setProperty(
          "display",
          "none",
          "important"
        );

        helper.dataset
          .ubuzimaSalesIntegrityV32DefaultHelper =
          "hidden";

        defaultHidden = true;

        continue;
      }

      /*
       * Never hide a validation message.
       * If V2 changes the helper text to an error,
       * it must immediately become visible.
       */
      if (
        text.includes(
          "must contain exactly 9 digits"
        )
        ||
        (
          text.includes(
            "exactly 9 digits"
          )
          &&
          !text.includes(
            "optional"
          )
        )
      ) {
        helper.hidden = false;

        helper.style.removeProperty(
          "display"
        );

        helper.removeAttribute(
          "aria-hidden"
        );

        validationVisible = true;
      }
    }

    state
      .defaultPhoneHelperHidden =
      defaultHidden;

    state
      .validationMessageVisible =
      validationVisible;
  }

  function apply() {
    scheduled = false;

    const root =
      document.querySelector(
        ROOT_SELECTOR
      );

    if (!root) {
      return;
    }

    state.scans += 1;

    hideDiscount(
      root
    );

    const customer =
      preserveCustomerFields(
        root
      );

    applyPhoneHelper(
      customer.phoneTin
    );
  }

  function schedule() {
    if (scheduled) {
      return;
    }

    scheduled = true;

    window.requestAnimationFrame(
      apply
    );
  }

  /*
   * React may replace Transaction Set-UP nodes.
   * Observe rendering only so the two tiny visual
   * amendments survive a legitimate V2 rerender.
   *
   * No network interception.
   * No checkout interception.
   * No receipt interception.
   */
  const observer =
    new MutationObserver(
      schedule
    );

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true,
      characterData: true
    }
  );

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      schedule,
      {
        once: true
      }
    );
  } else {
    schedule();
  }

  window
    .__UBUZIMA_SALES_INTEGRITY_V3_2__ =
    Object.freeze({
      version:
        VERSION,

      inspect() {
        const root =
          document.querySelector(
            ROOT_SELECTOR
          );

        const name =
          root
            ? findLabel(
                root,
                "customer name"
              )
            : null;

        const phoneTin =
          root
            ? findLabel(
                root,
                "customer phone/tin"
              )
            : null;

        const discount =
          root
            ? findLabel(
                root,
                "discount amount"
              )
            : null;

        return {
          version:
            VERSION,

          parentV2Present:
            Boolean(
              document.querySelector(
                'script[data-ubuzima-sales-recording-integrity-extension="v2"]'
              )
            ),

          customerNameVisible:
            Boolean(
              name
              &&
              !name.hidden
            ),

          customerPhoneTinVisible:
            Boolean(
              phoneTin
              &&
              !phoneTin.hidden
            ),

          discountAmountVisible:
            Boolean(
              discount
              &&
              !discount.hidden
              &&
              getComputedStyle(
                discount
              ).display !==
                "none"
            ),

          defaultPhoneHelperHidden:
            state
              .defaultPhoneHelperHidden,

          validationMessageVisible:
            state
              .validationMessageVisible,

          checkoutInterception:
            false,

          receiptInterception:
            false,

          recentPosModified:
            false,

          salesRegisterModified:
            false,

          cartModified:
            false,

          scans:
            state.scans
        };
      }
    });

  console.log(
    "Ubuzima+ Sales Integrity V3.2 amendment sidecar active",
    VERSION
  );
})();

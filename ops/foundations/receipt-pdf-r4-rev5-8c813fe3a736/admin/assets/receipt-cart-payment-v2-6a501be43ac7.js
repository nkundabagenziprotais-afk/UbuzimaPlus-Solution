(() => {
  "use strict";

  const VERSION =
    "2026.08.receipt-confirmed-cart-payment-v2";

  const STORAGE_KEY =
    "ubuzima.pos.receipt.confirmed-cart.v1";

  if (
    window.__ubuzimaConfirmedCartReceiptV1R1
  ) {
    return;
  }

  window.__ubuzimaConfirmedCartReceiptV1R1 =
    VERSION;

  function number(value) {
    const parsed =
      Number(
        String(value ?? "")
          .replaceAll(",", "")
          .replace(/[^\d.-]/g, "")
      );

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function moneyFrom(text) {
    const match =
      String(text ?? "")
        .match(
          /RWF\s*([\d,]+(?:\.\d+)?)/i
        );

    return match
      ? number(match[1])
      : 0;
  }

  function normalizeLabel(value) {
    return String(
      value ?? "",
    )
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function summaryMoney(
    summary,
    labels,
  ) {
    if (!summary) {
      return 0;
    }

    const wanted =
      labels.map(
        normalizeLabel,
      );

    const cards =
      Array.from(
        summary.querySelectorAll(
          ".pos-summary-field-card"
        )
      );

    for (
      const card of cards
    ) {
      const label =
        normalizeLabel(
          card.querySelector(
            "span"
          )?.textContent
        );

      if (
        !wanted.includes(
          label
        )
      ) {
        continue;
      }

      return moneyFrom(
        card.querySelector(
          "strong"
        )?.textContent
      );
    }

    return 0;
  }

  function paymentMethod() {
    const setup =
      document.querySelector(
        ".pos-transaction-setup-section"
      );

    if (!setup) {
      return {
        value:
          "unknown",

        label:
          "Unknown"
      };
    }

    const labels =
      Array.from(
        setup.querySelectorAll(
          "label"
        )
      );

    const field =
      labels.find(
        label =>
          normalizeLabel(
            label.querySelector(
              "span"
            )?.textContent
          ) ===
            "payment method"
      );

    const select =
      field?.querySelector(
        "select"
      );

    if (!select) {
      return {
        value:
          "unknown",

        label:
          "Unknown"
      };
    }

    return {
      value:
        String(
          select.value ||
          "unknown"
        ),

      label:
        String(
          select.options[
            select.selectedIndex
          ]?.textContent ||
          select.value ||
          "Unknown"
        )
          .replace(/\s+/g, " ")
          .trim()
    };
  }

  function paymentSummary(
    summary,
  ) {
    const subtotal =
      summaryMoney(
        summary,
        [
          "Sub-Total",
          "Subtotal"
        ]
      );

    const discount =
      summaryMoney(
        summary,
        [
          "Discount"
        ]
      );

    const netDiscount =
      summaryMoney(
        summary,
        [
          "Net Discount"
        ]
      );

    const tax =
      summaryMoney(
        summary,
        [
          "Tax"
        ]
      );

    const total =
      summaryMoney(
        summary,
        [
          "Total Amount",
          "Total"
        ]
      );

    const customerPayment =
      summaryMoney(
        summary,
        [
          "Customer Payment"
        ]
      );

    const insurerPayment =
      summaryMoney(
        summary,
        [
          "Insurer Payment"
        ]
      );

    const method =
      paymentMethod();

    const paid =
      customerPayment +
      insurerPayment;

    const balance =
      Math.max(
        total - paid,
        0
      );

    return {
      subtotal:
        subtotal,

      discount:
        discount,

      net_discount:
        netDiscount,

      tax:
        tax,

      total:
        total,

      customer_payment:
        customerPayment,

      insurer_payment:
        insurerPayment,

      paid:
        paid,

      balance:
        balance,

      payment_method:
        method.value,

      payment_method_label:
        method.label,

      payment_amount:
        total
    };
  }

  function activeCart() {
    const carts =
      Array.from(
        document.querySelectorAll(
          ".pos-sale-cart-section" +
          "[data-pos-cart-build='atomic-visible-cart-v1']"
        )
      );

    return (
      carts.find(
        cart =>
          Number(
            cart.dataset.posCartLines ||
            0
          ) > 0
      ) ||
      carts[0] ||
      null
    );
  }

  function readRow(row) {
    const cells =
      Array.from(
        row.querySelectorAll("td")
      );

    if (
      cells.length < 3
    ) {
      return null;
    }

    const name =
      String(
        cells[0]
          .querySelector("strong")
          ?.textContent ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim();

    const quantity =
      number(
        row.querySelector(
          "input[type='number']"
        )?.value
      );

    /*
     * Product cell contains:
     *
     * Total <qty> <unit> ·
     * RWF <unitPrice> / <baseUnit>
     */
    const unitPrice =
      moneyFrom(
        cells[0].textContent
      );

    /*
     * Third cell is the line total:
     *
     * RWF <quantity * unitPrice>
     */
    const lineTotal =
      moneyFrom(
        cells[2].textContent
      );

    if (
      !name ||
      quantity <= 0
    ) {
      return null;
    }

    return {
      product_name:
        name,

      quantity:
        quantity,

      unit_price:
        unitPrice,

      line_total:
        lineTotal > 0
          ? lineTotal
          : quantity * unitPrice
    };
  }

  function captureConfirmedCart(
    summaryElement = null
  ) {
    const cart =
      activeCart();

    if (!cart) {
      throw new Error(
        "Active POS cart is unavailable."
      );
    }

    const rows =
      Array.from(
        cart.querySelectorAll(
          ".pos-cart-table tbody tr"
        )
      ).filter(
        row =>
          row.querySelector(
            ".pos-cart-remove-button"
          )
      );

    const items =
      rows
        .map(readRow)
        .filter(Boolean);

    const expected =
      Number(
        cart.dataset.posCartLines ||
        0
      );

    if (
      expected > 0 &&
      items.length !== expected
    ) {
      throw new Error(
        `Cart extraction mismatch: ${items.length}/${expected}`
      );
    }

    if (
      items.length === 0
    ) {
      throw new Error(
        "Confirmed cart contains no products."
      );
    }

    const summary =
      summaryElement ||
      document.querySelector(
        ".pos-payment-summary-section" +
        "[data-pos-summary-build='atomic-payment-summary-v1']"
      );

    const capturedPayment =
      paymentSummary(
        summary
      );

    const snapshot = {
      version:
        2,

      captured_at:
        Date.now(),

      cart_signature:
        cart.dataset
          .posCartSignature ||
        null,

      line_count:
        items.length,

      unit_count:
        Number(
          cart.dataset.posCartUnits ||
          0
        ),

      claimed_sale_id:
        null,

      items:
        items,

      payment_summary:
        capturedPayment
    };

    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        snapshot
      )
    );

    console.log(
      "Ubuzima confirmed cart captured",
      snapshot
    );

    return snapshot;
  }

  /*
   * Remove only the obsolete per-product helper
   * message:
   *
   * "<product> added ... Selling amount: RWF ..."
   *
   * Other validation / error messages remain.
   */
  function hideOldAddedNotice() {
    document
      .querySelectorAll(
        ".pos-confirmation-notice, .form-success"
      )
      .forEach(
        element => {
          const text =
            String(
              element.textContent ||
              ""
            )
              .replace(/\s+/g, " ")
              .trim();

          const obsolete =
            /\badded\s*:/i.test(text) &&
            /\bselling\s+amount\s*:/i.test(
              text
            );

          if (obsolete) {
            element.style.setProperty(
              "display",
              "none",
              "important"
            );

            element.dataset
              .ubuzimaOldAddedNotice =
              "hidden";
          }
        }
      );
  }

  function scheduleNoticeCleanup() {
    window.setTimeout(
      hideOldAddedNotice,
      0
    );

    window.setTimeout(
      hideOldAddedNotice,
      80
    );

    window.setTimeout(
      hideOldAddedNotice,
      220
    );
  }

  document.addEventListener(
    "click",
    event => {
      scheduleNoticeCleanup();

      const target =
        event.target;

      const button =
        target &&
        typeof target.closest ===
          "function"
          ? target.closest("button")
          : null;

      if (!button) {
        return;
      }

      const summary =
        button.closest(
          ".pos-payment-summary-section"
        );

      if (!summary) {
        return;
      }

      const label =
        String(
          button.textContent ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      const isConfirm =
        label ===
          "confirm transaction" ||
        label ===
          "confirm payment";

      if (!isConfirm) {
        return;
      }

      /*
       * Capture listener runs before React's
       * onClick can complete checkout and clear
       * the cart.
       */
      try {
        captureConfirmedCart(
          summary
        );
      } catch (error) {
        console.error(
          "Ubuzima cart capture failed:",
          error
        );
      }
    },
    true
  );

  scheduleNoticeCleanup();

  window.__UBUZIMA_CART_RECEIPT_TEST__ =
    Object.freeze({
      captureConfirmedCart,
      storageKey:
        STORAGE_KEY
    });

  console.log(
    "Ubuzima+ confirmed-cart capture active",
    VERSION
  );
})();

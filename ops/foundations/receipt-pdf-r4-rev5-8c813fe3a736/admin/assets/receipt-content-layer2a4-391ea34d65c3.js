(() => {
  "use strict";

  const CONFIRMED_CART_KEY =
    "ubuzima.pos.receipt.confirmed-cart.v1";

  const CONFIRMED_CART_MAX_AGE =
    15 * 60 * 1000;

  function readConfirmedCart(
    saleId,
  ) {
    try {
      const raw =
        sessionStorage.getItem(
          CONFIRMED_CART_KEY,
        );

      if (!raw) {
        return null;
      }

      const snapshot =
        JSON.parse(raw);

      const age =
        Date.now() -
        Number(
          snapshot?.captured_at ||
          0,
        );

      if (
        !Number.isFinite(age) ||
        age < 0 ||
        age >
          CONFIRMED_CART_MAX_AGE
      ) {
        sessionStorage.removeItem(
          CONFIRMED_CART_KEY,
        );

        return null;
      }

      const items =
        Array.isArray(
          snapshot?.items,
        )
          ? snapshot.items
          : [];

      if (
        items.length === 0
      ) {
        return null;
      }

      const expected =
        Number(
          snapshot?.line_count ||
          0,
        );

      if (
        expected > 0 &&
        items.length !== expected
      ) {
        return null;
      }

      const claimed =
        snapshot
          ?.claimed_sale_id;

      if (
        claimed !== null &&
        claimed !== undefined &&
        String(claimed) !==
          String(saleId)
      ) {
        return null;
      }

      return snapshot;
    } catch (error) {
      console.error(
        "Confirmed cart read failed:",
        error,
      );

      return null;
    }
  }

  function applyConfirmedCart(
    invoice,
    saleId,
    reprint,
  ) {
    /*
     * Historical/reprint receipts remain based
     * entirely on persisted invoice items.
     */
    if (reprint) {
      return invoice;
    }

    const snapshot =
      readConfirmedCart(
        saleId,
      );

    if (!snapshot) {
      return invoice;
    }

    const items =
      snapshot.items.map(
        item => ({
          product_name:
            String(
              item?.product_name ||
              "Unspecified product",
            ),

          quantity:
            Number(
              item?.quantity ||
              0,
            ),

          unit_price:
            Number(
              item?.unit_price ||
              0,
            ),

          line_total:
            Number(
              item?.line_total ||
              0,
            ),
        }),
      );

    sessionStorage.setItem(
      CONFIRMED_CART_KEY,
      JSON.stringify({
        ...snapshot,

        claimed_sale_id:
          String(saleId),
      }),
    );

    console.log(
      "Ubuzima receipt items from confirmed cart",
      {
        saleId:
          String(saleId),

        lineCount:
          items.length,

        products:
          items.map(
            item =>
              item.product_name
          ),
      },
    );

    const payment =
      snapshot?.payment_summary;

    const hasPaymentSummary =
      payment &&
      typeof payment ===
        "object";

    const totals =
      hasPaymentSummary
        ? {
            ...(
              invoice?.totals ||
              {}
            ),

            subtotal_amount:
              Number(
                payment.subtotal ||
                0
              ),

            discount_amount:
              Number(
                payment.discount ||
                0
              ),

            tax_amount:
              Number(
                payment.tax ||
                0
              ),

            total_amount:
              Number(
                payment.total ||
                0
              ),

            paid_amount:
              Number(
                payment.paid ||
                0
              ),

            balance_amount:
              Number(
                payment.balance ||
                0
              ),
          }
        : invoice?.totals;

    const payments =
      hasPaymentSummary
        ? [
            {
              method:
                String(
                  payment.payment_method ||
                  "unknown"
                ),

              amount:
                Number(
                  payment.payment_amount ||
                  payment.total ||
                  0
                ),

              status:
                "paid",
            },
          ]
        : invoice?.payments;

    console.log(
      "Ubuzima receipt payment source",
      {
        source:
          hasPaymentSummary
            ? "confirmed-payment-summary"
            : "persisted-invoice",

        subtotal:
          totals?.subtotal_amount,

        discount:
          totals?.discount_amount,

        tax:
          totals?.tax_amount,

        total:
          totals?.total_amount,

        paid:
          totals?.paid_amount,

        balance:
          totals?.balance_amount,

        paymentMethod:
          payments?.[0]?.method,

        paymentAmount:
          payments?.[0]?.amount,
      },
    );

    return {
      ...invoice,

      items:
        items,

      totals:
        totals,

      payments:
        payments,

      receipt_product_source:
        "confirmed-cart",

      receipt_payment_source:
        hasPaymentSummary
          ? "confirmed-payment-summary"
          : "persisted-invoice",
    };
  }

  const VERSION =
    "2026.08.receipt-content-layer2a4-cart-payment-summary";

  if (
    window.__ubuzimaReceiptContentLayer2A1Final
  ) {
    return;
  }

  window.__ubuzimaReceiptContentLayer2A1Final =
    VERSION;

  function first(...values) {
    for (const value of values) {
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }

    return null;
  }

  function parseJson(raw) {
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function storageValue(storage, key) {
    try {
      return storage?.getItem(key) || null;
    } catch (_) {
      return null;
    }
  }

  function session() {
    for (const storage of [
      window.localStorage,
      window.sessionStorage,
    ]) {
      const value =
        parseJson(
          storageValue(
            storage,
            "ubuzima_admin_session",
          ),
        );

      if (value) return value;
    }

    return null;
  }

  function token() {
    const current =
      session();

    return first(
      current?.token,
      current?.access_token,
      current?.accessToken,

      storageValue(
        window.localStorage,
        "ubuzima.token",
      ),

      storageValue(
        window.sessionStorage,
        "ubuzima.token",
      ),

      storageValue(
        window.localStorage,
        "access_token",
      ),

      storageValue(
        window.sessionStorage,
        "access_token",
      ),

      storageValue(
        window.localStorage,
        "authToken",
      ),

      storageValue(
        window.sessionStorage,
        "authToken",
      ),
    );
  }

  function tenantSlug() {
    const current =
      session();

    return first(
      storageValue(
        window.sessionStorage,
        "ubuzima.currentTenantSlug",
      ),

      storageValue(
        window.localStorage,
        "ubuzima.currentTenantSlug",
      ),

      storageValue(
        window.sessionStorage,
        "pharmaco.tenantSlug",
      ),

      storageValue(
        window.localStorage,
        "pharmaco.tenantSlug",
      ),

      current
        ?.profile
        ?.tenant_assignments
        ?.[0]
        ?.tenant
        ?.slug,

      current
        ?.user
        ?.tenant_assignments
        ?.[0]
        ?.tenant
        ?.slug,

      current?.profile?.tenant?.slug,
      current?.user?.tenant?.slug,
    );
  }

  function escapeHtml(value) {
    return String(
      value ?? "",
    )
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function number(value) {
    const parsed =
      Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function money(value) {
    return new Intl.NumberFormat(
      "en-RW",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      },
    ).format(
      number(value),
    );
  }

  function quantity(value) {
    return new Intl.NumberFormat(
      "en-RW",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      },
    ).format(
      number(value),
    );
  }

  function readableDate(value) {
    if (!value) {
      return "—";
    }

    let raw =
      String(value).trim();

    if (
      /^\d{4}-\d{2}-\d{2} \d{2}:/.test(
        raw,
      )
    ) {
      raw =
        raw.replace(
          " ",
          "T",
        );
    }

    const date =
      new Date(raw);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return String(value);
    }

    const formatter =
      new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone:
            "Africa/Kigali",

          day:
            "2-digit",

          month:
            "short",

          year:
            "numeric",

          hour:
            "2-digit",

          minute:
            "2-digit",

          hourCycle:
            "h23",
        },
      );

    const parts =
      Object.fromEntries(
        formatter
          .formatToParts(date)
          .filter(
            part =>
              part.type !==
              "literal",
          )
          .map(
            part => [
              part.type,
              part.value,
            ],
          ),
      );

    return (
      `${parts.day} ` +
      `${parts.month} ` +
      `${parts.year}, ` +
      `${parts.hour}:` +
      `${parts.minute}`
    );
  }

  function resolveSaleId(context) {
    return first(
      context?.sale?.id,
      context?.sale?.sale_id,
      context?.saleMeta?.id,
      context?.saleMeta?.sale_id,
      context?.payment?.sale_id,
      context?.payment?.sale?.id,
    );
  }

  function productName(item) {
    return first(
      item?.product_name,
      item?.name,
      item?.description,
      item?.sku,
      "Unspecified product",
    );
  }

  function customerName(invoice) {
    return first(
      invoice?.customer?.name,
      invoice?.customer?.full_name,
      invoice?.customer_name,
      "—",
    );
  }

  function customerTin(invoice) {
    return first(
      invoice?.customer?.tin,
      invoice
        ?.customer
        ?.tax_identification_number,
      invoice?.customer?.tax_id,
      invoice?.customer?.tax_number,
      invoice?.customer_tin,
      invoice?.customer_tax_id,
      "—",
    );
  }

  function buildReceiptHtml(
    invoice,
    reprint = false,
  ) {
    const products =
      Array.isArray(
        invoice?.items,
      )
        ? invoice.items
        : [];

    const productRows =
      products
        .map(
          (item, index) => `
<tr
  data-receipt-product-line="1"
  data-product-index="${index}"
>
  <td class="receipt-product">
    ${index + 1}.
    ${escapeHtml(
      productName(item),
    )}
  </td>

  <td class="receipt-number receipt-qty">
    ${escapeHtml(
      quantity(
        item?.quantity,
      ),
    )}
  </td>

  <td class="receipt-number">
    ${escapeHtml(
      money(
        item?.unit_price,
      ),
    )}
  </td>

  <td class="receipt-number">
    ${escapeHtml(
      money(
        item?.line_total,
      ),
    )}
  </td>
</tr>
          `,
        )
        .join("");

    const totals =
      invoice?.totals || {};

    const payments =
      Array.isArray(
        invoice?.payments,
      )
        ? invoice.payments
        : [];

    const paymentRows =
      payments
        .map(
          payment => `
<div class="receipt-pair">
  <span>
    ${escapeHtml(
      first(
        payment?.method,
        payment?.payment_method,
        "Payment",
      ),
    )}
  </span>

  <strong>
    RWF ${escapeHtml(
      money(
        payment?.amount,
      ),
    )}
  </strong>
</div>
          `,
        )
        .join("");

    const issuedAt =
      first(
        invoice?.issued_at,
        invoice?.transaction_date,
        invoice?.sale_date,
        invoice?.sold_at,
        invoice?.created_at,
      );

    const label =
      reprint ||
      invoice?.is_reprint
        ? "INVOICE REPRINT"
        : first(
            invoice?.document_label,
            "SALES INVOICE",
          );

    return `
<main
  class="ubuzima-receipt-paper"
  data-dynamic-receipt-layer="2a1"
  data-sale-id="${escapeHtml(
    invoice?.sale_id || "",
  )}"
>
  <header class="receipt-center">
    <h1>
      ${escapeHtml(
        first(
          invoice?.pharmacy_profile?.trading_name,
          invoice?.pharmacy_profile?.legal_name,
          invoice?.tenant?.name,
          "Ubuzima+",
        ),
      )}
    </h1>

    <div class="receipt-branch">
      ${escapeHtml(
        first(
          invoice?.branch?.name,
          invoice?.branch?.code,
          "—",
        ),
      )}
    </div>

    ${
      invoice?.branch?.address
        ? `
          <div>
            ${escapeHtml(
              invoice.branch.address,
            )}
          </div>
        `
        : ""
    }

    ${
      first(
        invoice?.pharmacy_profile?.primary_phone,
        invoice?.branch?.phone,
      )
        ? `
          <div>
            Phone:
            ${escapeHtml(
              first(
                invoice?.pharmacy_profile?.primary_phone,
                invoice?.branch?.phone,
              ),
            )}
          </div>
        `
        : ""
    }

    ${
      invoice?.pharmacy_profile?.tin
        ? `
          <div>
            Pharmacy TIN:
            ${escapeHtml(
              invoice.pharmacy_profile.tin,
            )}
          </div>
        `
        : ""
    }

    <div class="receipt-document">
      ${escapeHtml(label)}
    </div>
  </header>

  <section class="receipt-section">
    <div class="receipt-pair">
      <span>Invoice</span>
      <strong>
        ${escapeHtml(
          first(
            invoice?.invoice_number,
            "—",
          ),
        )}
      </strong>
    </div>

    <div class="receipt-pair">
      <span>Reference</span>
      <strong>
        ${escapeHtml(
          first(
            invoice?.sale_reference,
            invoice?.invoice_number,
            "—",
          ),
        )}
      </strong>
    </div>

    <div class="receipt-pair">
      <span>Date</span>
      <strong>
        ${escapeHtml(
          readableDate(
            issuedAt,
          ),
        )}
      </strong>
    </div>

    <div class="receipt-pair">
      <span>Cashier</span>
      <strong>
        ${escapeHtml(
          first(
            invoice?.cashier?.name,
            invoice?.cashier_name,
            "—",
          ),
        )}
      </strong>
    </div>
  </section>

  <section
    class="receipt-section receipt-customer"
  >
    <div class="receipt-pair">
      <span>Customer Name</span>
      <strong data-customer-name>
        ${escapeHtml(
          customerName(invoice),
        )}
      </strong>
    </div>

    <div class="receipt-pair">
      <span>Customer TIN</span>
      <strong data-customer-tin>
        ${escapeHtml(
          customerTin(invoice),
        )}
      </strong>
    </div>
  </section>

  <table class="receipt-items">
    <thead>
      <tr>
        <th>Product</th>
        <th class="receipt-number">Qty</th>
        <th class="receipt-number">Unit</th>
        <th class="receipt-number">Amount</th>
      </tr>
    </thead>

    <tbody>
      ${
        productRows ||
        `
          <tr>
            <td
              colspan="4"
              class="receipt-empty"
            >
              No persisted sale items.
            </td>
          </tr>
        `
      }
    </tbody>
  </table>

  <section class="receipt-section receipt-totals">
    <div class="receipt-pair">
      <span>Subtotal</span>
      <strong>
        RWF ${escapeHtml(
          money(
            totals?.subtotal_amount,
          ),
        )}
      </strong>
    </div>

    <div class="receipt-pair">
      <span>Discount</span>
      <strong>
        RWF ${escapeHtml(
          money(
            totals?.discount_amount,
          ),
        )}
      </strong>
    </div>

    <div class="receipt-pair">
      <span>Tax</span>
      <strong>
        RWF ${escapeHtml(
          money(
            totals?.tax_amount,
          ),
        )}
      </strong>
    </div>

    <div class="receipt-pair receipt-grand-total">
      <span>Total</span>
      <strong>
        RWF ${escapeHtml(
          money(
            totals?.total_amount,
          ),
        )}
      </strong>
    </div>

    ${
      paymentRows
        ? `
          <div class="receipt-payment-title">
            Payment
          </div>
          ${paymentRows}
        `
        : ""
    }

    <div class="receipt-pair">
      <span>Paid</span>
      <strong>
        RWF ${escapeHtml(
          money(
            totals?.paid_amount,
          ),
        )}
      </strong>
    </div>

    <div class="receipt-pair">
      <span>Balance</span>
      <strong>
        RWF ${escapeHtml(
          money(
            totals?.balance_amount,
          ),
        )}
      </strong>
    </div>
  </section>

  <footer class="receipt-footer">
    Thank you.
  </footer>
</main>
    `;
  }

  async function fetchInvoice(
    saleId,
    reprint,
  ) {
    const authToken =
      token();

    const tenant =
      tenantSlug();

    if (!authToken) {
      throw new Error(
        "Authenticated session is unavailable.",
      );
    }

    if (!tenant) {
      throw new Error(
        "Receipt tenant context is unavailable.",
      );
    }

    const response =
      await fetch(
        `/api/v1/pharmaco/sales/${encodeURIComponent(
          String(saleId),
        )}/invoice${
          reprint
            ? "?reprint=1"
            : ""
        }`,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${authToken}`,

            "X-Tenant-Slug":
              String(tenant),
          },

          credentials:
            "same-origin",

          cache:
            "no-store",
        },
      );

    let payload = null;

    try {
      payload =
        await response.json();
    } catch (_) {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        payload?.message ||
        `Receipt request failed (${response.status}).`,
      );
    }

    const invoice =
      payload?.invoice ??
      payload;

    if (
      !invoice ||
      typeof invoice !==
        "object"
    ) {
      throw new Error(
        "Persisted invoice payload is unavailable.",
      );
    }

    return invoice;
  }

  function cleanReceiptText(element) {
    return String(
      element?.textContent || "",
    )
      .replace(
        /\n[ \t]+/g,
        "\n",
      )
      .replace(
        /\n{3,}/g,
        "\n\n",
      )
      .trim();
  }

  function removeCurrentDialog() {
    document
      .querySelectorAll(
        "[data-receipt-layer2a1-shell]",
      )
      .forEach(
        element =>
          element.remove(),
      );

    document.body.classList.remove(
      "receipt-layer2a1-printing",
    );
  }

  function openDialog(
    context,
    reprint = false,
  ) {
    removeCurrentDialog();

    const saleId =
      resolveSaleId(
        context,
      );

    const shell =
      document.createElement(
        "div",
      );

    shell.setAttribute(
      "data-receipt-layer2a1-shell",
      "1",
    );

    shell.innerHTML = `
<style>
[data-receipt-layer2a1-shell] {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(15,23,42,.52);
  font-family:
    Inter,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.receipt-dialog {
  width: min(470px,96vw);
  max-height: 94vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 14px;
  background: #fff;
  box-shadow:
    0 24px 70px rgba(15,23,42,.24);
}

.receipt-dialog-header {
  padding: 15px 18px;
  border-bottom: 1px solid #e5e7eb;
}

.receipt-dialog-header h2 {
  margin: 0;
  color: #172033;
  font-size: 17px;
}

.receipt-status {
  padding: 8px 18px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
}

.receipt-status[data-state="error"] {
  background: #fef2f2;
  color: #991b1b;
}

.receipt-paper-wrap {
  overflow: auto;
  padding: 18px;
  background: #f1f5f9;
}

.ubuzima-receipt-paper {
  box-sizing: border-box;
  width: 80mm;
  max-width: 100%;
  margin: 0 auto;
  padding: 5mm 4mm;
  background: #fff;
  color: #111827;
  font-family:
    "Courier New",
    ui-monospace,
    monospace;
  font-size: 11px;
  line-height: 1.4;
  box-shadow:
    0 2px 14px rgba(15,23,42,.12);
}

.ubuzima-receipt-paper h1 {
  margin: 0 0 3px;
  font-size: 16px;
}

.receipt-center {
  text-align: center;
}

.receipt-branch {
  margin-top: 2px;
  font-weight: 700;
}

.receipt-document {
  margin-top: 9px;
  padding: 5px 0;
  border-top: 1px dashed #334155;
  border-bottom: 1px dashed #334155;
  font-weight: 800;
  letter-spacing: .05em;
}

.receipt-section {
  padding: 8px 0;
  border-bottom: 1px dashed #94a3b8;
}

.receipt-customer {
  padding-left: 4px;
  padding-right: 4px;
  background: #f8fafc;
}

.receipt-pair {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 2px 0;
}

.receipt-pair strong {
  text-align: right;
  overflow-wrap: anywhere;
}

.receipt-items {
  width: 100%;
  margin: 8px 0;
  border-collapse: collapse;
  table-layout: fixed;
}

.receipt-items th,
.receipt-items td {
  padding: 4px 2px;
  vertical-align: top;
  border-bottom: 1px dotted #cbd5e1;
}

.receipt-items th:first-child,
.receipt-items td:first-child {
  width: 46%;
  text-align: left;
  overflow-wrap: anywhere;
}

.receipt-items th:nth-child(2),
.receipt-items td:nth-child(2) {
  width: 12%;
}

.receipt-items th:nth-child(3),
.receipt-items td:nth-child(3) {
  width: 19%;
}

.receipt-items th:nth-child(4),
.receipt-items td:nth-child(4) {
  width: 23%;
}

.receipt-number {
  text-align: right;
}

.receipt-grand-total {
  margin-top: 5px;
  padding-top: 5px;
  border-top: 1px solid #111827;
  font-size: 12px;
}

.receipt-payment-title {
  margin-top: 7px;
  font-weight: 800;
}

.receipt-empty {
  padding: 12px 2px !important;
  text-align: center !important;
  color: #991b1b;
}

.receipt-footer {
  padding-top: 10px;
  text-align: center;
  font-weight: 700;
}

.receipt-actions {
  display: grid;
  grid-template-columns:
    repeat(2,minmax(0,1fr));
  gap: 8px;
  padding: 14px 18px 18px;
  border-top: 1px solid #e5e7eb;
}

.receipt-actions button {
  min-height: 40px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #1f2937;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.receipt-actions button:first-child {
  border-color: #166534;
  background: #166534;
  color: #fff;
}

.receipt-actions button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

@media (max-width:430px) {
  [data-receipt-layer2a1-shell] {
    padding: 8px;
  }

  .receipt-dialog {
    width: 100%;
    max-height: 97vh;
    border-radius: 10px;
  }

  .receipt-paper-wrap {
    padding: 10px;
  }

  .receipt-actions {
    padding: 10px;
  }
}

@media print {
  @page {
    size: 80mm auto;
    margin: 0;
  }

  body.receipt-layer2a1-printing
  > *:not(
    [data-receipt-layer2a1-shell]
  ) {
    display: none !important;
  }

  body.receipt-layer2a1-printing
  [data-receipt-layer2a1-shell] {
    position: static !important;
    inset: auto !important;
    display: block !important;
    padding: 0 !important;
    background: #fff !important;
  }

  body.receipt-layer2a1-printing
  .receipt-dialog {
    display: block !important;
    width: 80mm !important;
    max-height: none !important;
    overflow: visible !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  body.receipt-layer2a1-printing
  .receipt-dialog-header,
  body.receipt-layer2a1-printing
  .receipt-status,
  body.receipt-layer2a1-printing
  .receipt-actions {
    display: none !important;
  }

  body.receipt-layer2a1-printing
  .receipt-paper-wrap {
    overflow: visible !important;
    padding: 0 !important;
    background: #fff !important;
  }

  body.receipt-layer2a1-printing
  .ubuzima-receipt-paper {
    width: 72mm !important;
    max-width: 72mm !important;
    margin: 0 auto !important;
    padding: 3mm 2mm !important;
    box-shadow: none !important;
  }
}
</style>

<section
  class="receipt-dialog"
  role="dialog"
  aria-modal="true"
  aria-label="Receipt preview"
>
  <header class="receipt-dialog-header">
    <h2>Receipt Preview</h2>
  </header>

  <div
    class="receipt-status"
    data-receipt-status
    data-state="loading"
  >
    Loading receipt…
  </div>

  <div
    class="receipt-paper-wrap"
    data-receipt-paper
  ></div>

  <footer class="receipt-actions">
    <button
      type="button"
      data-receipt-print
      disabled
    >
      Hard Copy Print
    </button>

    <button
      type="button"
      data-receipt-whatsapp
      disabled
    >
      WhatsApp
    </button>

    <button
      type="button"
      data-receipt-email
      disabled
    >
      Email
    </button>

    <button
      type="button"
      data-receipt-close
    >
      Close
    </button>
  </footer>
</section>
    `;

    document.body.appendChild(
      shell,
    );

    const status =
      shell.querySelector(
        "[data-receipt-status]",
      );

    const paper =
      shell.querySelector(
        "[data-receipt-paper]",
      );

    const printButton =
      shell.querySelector(
        "[data-receipt-print]",
      );

    const whatsapp =
      shell.querySelector(
        "[data-receipt-whatsapp]",
      );

    const email =
      shell.querySelector(
        "[data-receipt-email]",
      );

    const close =
      shell.querySelector(
        "[data-receipt-close]",
      );

    let receiptText = "";
    let receiptTitle =
      "Sales Receipt";

    const closeDialog =
      () => {
        document.body.classList.remove(
          "receipt-layer2a1-printing",
        );

        shell.remove();
      };

    close?.addEventListener(
      "click",
      closeDialog,
    );

    shell.addEventListener(
      "click",
      event => {
        if (
          event.target === shell
        ) {
          closeDialog();
        }
      },
    );

    printButton?.addEventListener(
      "click",
      () => {
        if (
          printButton.disabled
        ) {
          return;
        }

        document.body.classList.add(
          "receipt-layer2a1-printing",
        );

        const cleanup =
          () => {
            document.body.classList.remove(
              "receipt-layer2a1-printing",
            );
          };

        window.addEventListener(
          "afterprint",
          cleanup,
          {
            once: true,
          },
        );

        window.print();

        window.setTimeout(
          cleanup,
          1500,
        );
      },
    );

    whatsapp?.addEventListener(
      "click",
      () => {
        if (
          whatsapp.disabled ||
          !receiptText
        ) {
          return;
        }

        window.open(
          `https://wa.me/?text=${encodeURIComponent(
            `${receiptTitle}\n\n${receiptText}`,
          )}`,
          "_blank",
          "noopener,noreferrer",
        );
      },
    );

    email?.addEventListener(
      "click",
      () => {
        if (
          email.disabled ||
          !receiptText
        ) {
          return;
        }

        window.location.href =
          `mailto:?subject=${encodeURIComponent(
            `Receipt - ${receiptTitle}`,
          )}&body=${encodeURIComponent(
            receiptText,
          )}`;
      },
    );

    const load =
      async () => {
        if (!saleId) {
          status.dataset.state =
            "error";

          status.textContent =
            "Receipt opened, but the completed sale ID could not be resolved.";

          return;
        }

        try {
          let invoice =
            await fetchInvoice(
              saleId,
              reprint,
            );

          invoice =
            applyConfirmedCart(
              invoice,
              saleId,
              reprint,
            );

          paper.innerHTML =
            buildReceiptHtml(
              invoice,
              reprint,
            );

          const receipt =
            paper.querySelector(
              "[data-dynamic-receipt-layer='2a1']",
            );

          receiptText =
            cleanReceiptText(
              receipt,
            );

          receiptTitle =
            first(
              invoice?.invoice_number,
              invoice?.sale_reference,
              "Sales Receipt",
            );

          const lineCount =
            Array.isArray(
              invoice?.items,
            )
              ? invoice.items.length
              : 0;

          status.dataset.state =
            "ready";

          status.textContent =
            `${lineCount} product line(s) loaded`;

          printButton.disabled =
            false;

          whatsapp.disabled =
            false;

          email.disabled =
            false;
        } catch (error) {
          console.error(
            "[Ubuzima+ Receipt Layer 2A.1]",
            error,
          );

          status.dataset.state =
            "error";

          status.textContent =
            "Receipt could not be loaded: " +
            (
              error instanceof Error
                ? error.message
                : "Unknown error"
            );
        }
      };

    void load();

    return true;
  }

  function install() {
    const existing =
      window.UbuzimaReceipt;

    if (
      !existing ||
      typeof existing.openReceipt !==
        "function"
    ) {
      window.setTimeout(
        install,
        100,
      );

      return;
    }

    if (
      existing.version ===
      VERSION
    ) {
      return;
    }

    window.UbuzimaReceipt =
      Object.freeze({
        ...existing,

        version:
          VERSION,

        openReceipt(context) {
          return openDialog(
            context,
            false,
          );
        },

        openReprint(context) {
          return openDialog(
            context,
            true,
          );
        },
      });

    console.log(
      "Ubuzima+ Receipt Layer 2A.1 active",
      VERSION,
    );
  }

  window.__UBUZIMA_RECEIPT_LAYER2A1_TEST__ =
    Object.freeze({
      buildReceiptHtml,
      readableDate,
      applyConfirmedCart,
    });

  install();
})();

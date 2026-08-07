(function () {
  'use strict';

  const VERSION =
    '2026.08.layer2a-persisted-receipt-v6.3';

  function object(value) {
    return Boolean(
      value
      && typeof value === 'object'
      && !Array.isArray(value)
    );
  }

  function first() {
    for (const value of arguments) {
      if (
        value !== null
        && value !== undefined
        && String(value).trim() !== ''
      ) {
        return value;
      }
    }

    return null;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function number(value, decimals) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return value ?? '—';
    }

    return new Intl.NumberFormat(
      'en-RW',
      {
        maximumFractionDigits: decimals,
      },
    ).format(parsed);
  }

  function money(value) {
    return number(value, 2);
  }

  function quantity(value) {
    return number(value, 3);
  }

  function storageValue(storage, key) {
    try {
      const value = storage.getItem(key);

      return value
        ? String(value).trim()
        : null;
    } catch (_error) {
      return null;
    }
  }

  function parseJson(value) {
    try {
      return value
        ? JSON.parse(value)
        : null;
    } catch (_error) {
      return null;
    }
  }

  function tenantSlug() {
    for (const key of [
      'pharmaco.tenantSlug',
      'ubuzima.currentTenantSlug',
    ]) {
      const local =
        storageValue(
          window.localStorage,
          key,
        );

      if (local) {
        return local;
      }

      const session =
        storageValue(
          window.sessionStorage,
          key,
        );

      if (session) {
        return session;
      }
    }

    for (const raw of [
      storageValue(
        window.localStorage,
        'ubuzima_admin_session',
      ),

      storageValue(
        window.sessionStorage,
        'ubuzima_admin_session',
      ),
    ]) {
      const parsed = parseJson(raw);

      const value = first(
        parsed?.tenantSlug,
        parsed?.tenant_slug,
        parsed?.tenant?.slug,
      );

      if (value) {
        return String(value);
      }
    }

    return null;
  }

  function normalize(payload) {
    const root =
      object(payload?.data)
        ? payload.data
        : payload;

    const invoice =
      object(root?.invoice)
        ? root.invoice
        : root;

    const items =
      Array.isArray(invoice?.items)
        ? invoice.items
        : (
            Array.isArray(invoice?.product_lines)
              ? invoice.product_lines
              : (
                  Array.isArray(root?.product_lines)
                    ? root.product_lines
                    : []
                )
          );

    const totals =
      object(invoice?.totals)
        ? invoice.totals
        : {};

    const payments =
      Array.isArray(invoice?.payments)
        ? invoice.payments
        : [];

    return {
      invoice,
      items,
      totals,
      payments,
    };
  }

  function receiptNumber(invoice, payments) {
    const payment =
      payments.find(
        (item) =>
          item
          && String(
            item.status ?? ''
          ).toLowerCase() !== 'void',
      )
      || payments[0]
      || {};

    return first(
      payment?.receipt_number,
      invoice?.receipt_number,
      invoice?.invoice_number,
      '—',
    );
  }

  function buildHtml(
    normalized,
    requestedReprint,
  ) {
    const {
      invoice,
      items,
      totals,
      payments,
    } = normalized;

    if (
      !Array.isArray(items)
      || items.length === 0
    ) {
      throw new Error(
        'Persisted invoice contains no sale items.',
      );
    }

    const receipt =
      receiptNumber(
        invoice,
        payments,
      );

    const documentLabel =
      first(
        invoice?.document_label,
        requestedReprint
          ? 'INVOICE REPRINT'
          : 'SALES INVOICE',
      );

    const invoiceNumber =
      first(
        invoice?.invoice_number,
        invoice?.sale_reference,
        '—',
      );

    const date =
      first(
        invoice?.issued_at,
        invoice?.business_date,
        '—',
      );

    const tenant =
      first(
        invoice?.tenant?.name,
        'Vita Pharma',
      );

    const branch =
      first(
        invoice?.branch?.name,
        '—',
      );

    const branchAddress =
      first(
        invoice?.branch?.address,
        null,
      );

    const branchPhone =
      first(
        invoice?.branch?.phone,
        null,
      );

    const cashier =
      first(
        invoice?.cashier?.name,
        '—',
      );

    const customer =
      first(
        invoice?.customer?.name,
        invoice?.customer?.full_name,
        'Walk-in customer',
      );

    const productRows =
      items.map(
        (item) => `
<tr data-receipt-product="true">
  <td class="product">
    ${escapeHtml(
      first(
        item?.product_name,
        item?.product_name_snapshot,
        item?.name,
        'Unnamed product',
      ),
    )}
  </td>

  <td class="number">
    ${quantity(item?.quantity)}
  </td>

  <td class="number">
    ${money(item?.unit_price)}
  </td>

  <td class="number">
    ${money(item?.line_total)}
  </td>
</tr>`,
      ).join('');

    const paymentRows =
      payments.length
        ? payments.map(
            (payment) => `
<div class="row small">
  <span>
    ${escapeHtml(
      first(
        payment?.method,
        payment?.payment_method,
        'Payment',
      ),
    )}
  </span>

  <strong>
    RWF ${money(payment?.amount)}
  </strong>
</div>`,
          ).join('')
        : `
<div class="row small">
  <span>Payment</span>
  <strong>—</strong>
</div>`;

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">

<title>
${escapeHtml(documentLabel)} ${escapeHtml(invoiceNumber)}
</title>

<style>
@page {
  size: 80mm auto;
  margin: 3mm;
}

html,
body {
  width: 74mm;
  margin: 0;
  padding: 0;
  background: #fff;
  color: #111;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10px;
  line-height: 1.35;
}

* {
  box-sizing: border-box;
}

.receipt {
  width: 74mm;
}

.header {
  text-align: center;
  margin-bottom: 3mm;
}

.header h1 {
  margin: 0;
  font-size: 15px;
}

.header .label {
  margin-top: 1mm;
  font-size: 9px;
  font-weight: 700;
}

.section {
  border-top: 1px dashed #222;
  padding-top: 2mm;
  margin-top: 2mm;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 3mm;
  margin: 0.7mm 0;
}

.row span {
  color: #444;
}

.row strong {
  text-align: right;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin-top: 2mm;
}

th,
td {
  padding: 1mm 0.5mm;
  vertical-align: top;
  border-bottom: 1px dotted #aaa;
}

th {
  font-size: 9px;
  text-align: left;
}

.product {
  width: 43%;
}

.number {
  text-align: right;
}

.grand {
  border-top: 1px solid #111;
  border-bottom: 1px solid #111;
  margin: 1mm 0;
  padding: 1.2mm 0;
  font-size: 12px;
}

.small {
  font-size: 9px;
}

.footer {
  text-align: center;
  font-size: 9px;
}

.reprint {
  margin-top: 2mm;
  font-weight: 700;
  letter-spacing: 1px;
}
</style>
</head>

<body>

<main class="receipt">

<header class="header">
  <h1>${escapeHtml(tenant)}</h1>

  <div class="label">
    ${escapeHtml(documentLabel)}
  </div>

  ${
    requestedReprint
      ? '<div class="reprint">REPRINT COPY</div>'
      : ''
  }
</header>

<section class="section">

<div class="row">
  <span>Receipt</span>
  <strong>${escapeHtml(receipt)}</strong>
</div>

<div class="row">
  <span>Invoice</span>
  <strong>${escapeHtml(invoiceNumber)}</strong>
</div>

<div class="row">
  <span>Date</span>
  <strong>${escapeHtml(date)}</strong>
</div>

<div class="row">
  <span>Branch</span>
  <strong>${escapeHtml(branch)}</strong>
</div>

${
  branchAddress
    ? `
<div class="row">
  <span>Address</span>
  <strong>${escapeHtml(branchAddress)}</strong>
</div>`
    : ''
}

${
  branchPhone
    ? `
<div class="row">
  <span>Phone</span>
  <strong>${escapeHtml(branchPhone)}</strong>
</div>`
    : ''
}

<div class="row">
  <span>Cashier</span>
  <strong>${escapeHtml(cashier)}</strong>
</div>

<div class="row">
  <span>Customer</span>
  <strong>${escapeHtml(customer)}</strong>
</div>

</section>

<table>

<thead>
<tr>
  <th class="product">Product</th>
  <th class="number">Qty</th>
  <th class="number">Unit</th>
  <th class="number">Amount</th>
</tr>
</thead>

<tbody>
${productRows}
</tbody>

</table>

<section class="section">

<div class="row">
  <span>Subtotal</span>
  <strong>
    RWF ${money(totals?.subtotal_amount)}
  </strong>
</div>

<div class="row">
  <span>Discount</span>
  <strong>
    RWF ${money(totals?.discount_amount)}
  </strong>
</div>

<div class="row">
  <span>Tax</span>
  <strong>
    RWF ${money(totals?.tax_amount)}
  </strong>
</div>

<div class="row grand">
  <span>Total</span>
  <strong>
    RWF ${money(totals?.total_amount)}
  </strong>
</div>

<div class="row">
  <span>Paid</span>
  <strong>
    RWF ${money(totals?.paid_amount)}
  </strong>
</div>

<div class="row">
  <span>Balance</span>
  <strong>
    RWF ${money(totals?.balance_amount)}
  </strong>
</div>

</section>

<section class="section">
${paymentRows}
</section>

<footer class="section footer">
  Thank you.
</footer>

</main>

</body>
</html>`;
  }

  function showReceiptPreview(html) {
    return new Promise(
      (resolve, reject) => {
        const SHELL_ID =
          'ubuzima-receipt-preview';

        const STYLE_ID =
          'ubuzima-receipt-preview-style';

        const existingShell =
          document.getElementById(
            SHELL_ID,
          );

        const existingStyle =
          document.getElementById(
            STYLE_ID,
          );

        existingShell?.remove();
        existingStyle?.remove();

        const parser =
          new DOMParser();

        const parsed =
          parser.parseFromString(
            html,
            'text/html',
          );

        const receipt =
          parsed.querySelector(
            'main.receipt',
          );

        if (!receipt) {
          reject(
            new Error(
              'Receipt content could not be prepared.',
            ),
          );

          return;
        }

        const rows =
          receipt.querySelectorAll(
            '[data-receipt-product="true"]',
          );

        const textContent =
          String(
            receipt.textContent
            || '',
          ).trim();

        if (rows.length === 0) {
          reject(
            new Error(
              'Receipt has no product lines.',
            ),
          );

          return;
        }

        if (textContent.length < 20) {
          reject(
            new Error(
              'Receipt has no visible transaction details.',
            ),
          );

          return;
        }

        const shell =
          document.createElement(
            'section',
          );

        shell.id = SHELL_ID;

        shell.setAttribute(
          'role',
          'dialog',
        );

        shell.setAttribute(
          'aria-modal',
          'true',
        );

        shell.setAttribute(
          'aria-label',
          'Receipt Preview',
        );

        shell.innerHTML = `
<div class="urp-panel">

  <header class="urp-toolbar">
    <div>
      <strong>Receipt Preview</strong>
      <span>Verify the transaction before printing</span>
    </div>

    <button
      type="button"
      class="urp-close"
      data-receipt-close
    >
      Close
    </button>
  </header>

  <div class="urp-scroll">
    <div
      id="ubuzima-receipt-print-area"
      class="urp-paper"
    >
      ${receipt.outerHTML}
    </div>
  </div>

  <footer class="urp-actions">
    <button
      type="button"
      class="urp-secondary"
      data-receipt-close
    >
      Close
    </button>

    <button
      type="button"
      class="urp-primary"
      data-receipt-print
    >
      Print Receipt
    </button>
  </footer>

</div>`;

        const style =
          document.createElement(
            'style',
          );

        style.id = STYLE_ID;

        style.textContent = `
#${SHELL_ID} {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483000 !important;
  display: flex !important;
  align-items: flex-start !important;
  justify-content: center !important;
  padding: 24px !important;
  overflow: auto !important;
  background: rgba(15, 23, 42, 0.62) !important;
}

#${SHELL_ID},
#${SHELL_ID} * {
  box-sizing: border-box !important;
}

#${SHELL_ID} .urp-panel {
  width: min(94vw, 430px) !important;
  max-width: 430px !important;
  margin: auto !important;
  overflow: hidden !important;
  border: 1px solid #dce5df !important;
  border-radius: 14px !important;
  background: #f7faf8 !important;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28) !important;
}

#${SHELL_ID} .urp-toolbar {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 16px !important;
  padding: 14px 16px !important;
  border-bottom: 1px solid #dce5df !important;
  background: #ffffff !important;
}

#${SHELL_ID} .urp-toolbar strong {
  display: block !important;
  color: #17372a !important;
  font-size: 15px !important;
}

#${SHELL_ID} .urp-toolbar span {
  display: block !important;
  margin-top: 2px !important;
  color: #64748b !important;
  font-size: 11px !important;
}

#${SHELL_ID} button {
  cursor: pointer !important;
  font: inherit !important;
}

#${SHELL_ID} .urp-close {
  border: 0 !important;
  background: transparent !important;
  color: #475569 !important;
  font-weight: 700 !important;
}

#${SHELL_ID} .urp-scroll {
  display: flex !important;
  justify-content: center !important;
  padding: 18px !important;
  overflow: auto !important;
}

#${SHELL_ID} .urp-paper {
  width: 74mm !important;
  max-width: 100% !important;
  min-height: 80mm !important;
  padding: 3mm !important;
  background: #ffffff !important;
  color: #111111 !important;
  box-shadow: 0 2px 16px rgba(15, 23, 42, 0.12) !important;
}

#${SHELL_ID} .receipt {
  display: block !important;
  width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  color: #111111 !important;
  background: #ffffff !important;
  font-family: Arial, Helvetica, sans-serif !important;
  font-size: 10px !important;
  line-height: 1.35 !important;
}

#${SHELL_ID} .header {
  text-align: center !important;
  margin-bottom: 3mm !important;
}

#${SHELL_ID} .header h1 {
  margin: 0 !important;
  font-size: 15px !important;
}

#${SHELL_ID} .header .label {
  margin-top: 1mm !important;
  font-size: 9px !important;
  font-weight: 700 !important;
}

#${SHELL_ID} .section {
  margin-top: 2mm !important;
  padding-top: 2mm !important;
  border-top: 1px dashed #222 !important;
}

#${SHELL_ID} .row {
  display: flex !important;
  justify-content: space-between !important;
  gap: 3mm !important;
  margin: 0.7mm 0 !important;
}

#${SHELL_ID} .row span {
  color: #444 !important;
}

#${SHELL_ID} .row strong {
  text-align: right !important;
}

#${SHELL_ID} table {
  width: 100% !important;
  border-collapse: collapse !important;
  table-layout: fixed !important;
  margin-top: 2mm !important;
}

#${SHELL_ID} th,
#${SHELL_ID} td {
  padding: 1mm 0.5mm !important;
  vertical-align: top !important;
  border-bottom: 1px dotted #aaa !important;
}

#${SHELL_ID} th {
  font-size: 9px !important;
  text-align: left !important;
}

#${SHELL_ID} .product {
  width: 43% !important;
}

#${SHELL_ID} .number {
  text-align: right !important;
}

#${SHELL_ID} .grand {
  margin: 1mm 0 !important;
  padding: 1.2mm 0 !important;
  border-top: 1px solid #111 !important;
  border-bottom: 1px solid #111 !important;
  font-size: 12px !important;
}

#${SHELL_ID} .small {
  font-size: 9px !important;
}

#${SHELL_ID} .footer {
  text-align: center !important;
  font-size: 9px !important;
}

#${SHELL_ID} .urp-actions {
  display: flex !important;
  justify-content: flex-end !important;
  gap: 10px !important;
  padding: 14px 16px !important;
  border-top: 1px solid #dce5df !important;
  background: #ffffff !important;
}

#${SHELL_ID} .urp-primary,
#${SHELL_ID} .urp-secondary {
  min-height: 40px !important;
  padding: 9px 16px !important;
  border-radius: 9px !important;
  font-weight: 700 !important;
}

#${SHELL_ID} .urp-primary {
  border: 1px solid #405516 !important;
  background: #405516 !important;
  color: #ffffff !important;
}

#${SHELL_ID} .urp-secondary {
  border: 1px solid #cbd5e1 !important;
  background: #ffffff !important;
  color: #334155 !important;
}

@media (max-width: 430px) {
  #${SHELL_ID} {
    padding: 10px !important;
  }

  #${SHELL_ID} .urp-panel {
    width: 100% !important;
  }

  #${SHELL_ID} .urp-scroll {
    padding: 10px !important;
  }

  #${SHELL_ID} .urp-actions {
    position: sticky !important;
    bottom: 0 !important;
  }
}

@media print {
  @page {
    margin: 3mm;
  }

  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
  }

  body > * {
    display: none !important;
  }

  body > #${SHELL_ID} {
    display: block !important;
    position: static !important;
    width: 74mm !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    background: #ffffff !important;
  }

  #${SHELL_ID} .urp-panel {
    display: block !important;
    width: 74mm !important;
    max-width: 74mm !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: #ffffff !important;
  }

  #${SHELL_ID} .urp-toolbar,
  #${SHELL_ID} .urp-actions {
    display: none !important;
  }

  #${SHELL_ID} .urp-scroll {
    display: block !important;
    padding: 0 !important;
    overflow: visible !important;
  }

  #${SHELL_ID} .urp-paper {
    display: block !important;
    width: 74mm !important;
    max-width: 74mm !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    background: #ffffff !important;
  }
}
`;

        document.head.appendChild(
          style,
        );

        document.body.appendChild(
          shell,
        );

        const closePreview = () => {
          document.removeEventListener(
            'keydown',
            onKeyDown,
          );

          shell.remove();
          style.remove();
        };

        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            closePreview();
          }
        };

        document.addEventListener(
          'keydown',
          onKeyDown,
        );

        shell
          .querySelectorAll(
            '[data-receipt-close]',
          )
          .forEach(
            (button) => {
              button.addEventListener(
                'click',
                closePreview,
              );
            },
          );

        shell.addEventListener(
          'click',
          (event) => {
            if (event.target === shell) {
              closePreview();
            }
          },
        );

        const printButton =
          shell.querySelector(
            '[data-receipt-print]',
          );

        if (!printButton) {
          closePreview();

          reject(
            new Error(
              'Receipt Print action is unavailable.',
            ),
          );

          return;
        }

        printButton.addEventListener(
          'click',
          () => {
            console.info(
              '[Ubuzima+ visible receipt print]',
              {
                productRows:
                  shell.querySelectorAll(
                    '[data-receipt-product="true"]',
                  ).length,

                textLength:
                  String(
                    shell.textContent
                    || '',
                  ).trim().length,
              },
            );

            window.print();
          },
        );

        window.requestAnimationFrame(
          () => {
            const paper =
              shell.querySelector(
                '#ubuzima-receipt-print-area',
              );

            if (
              !paper
              || paper.getBoundingClientRect()
                .height <= 0
            ) {
              closePreview();

              reject(
                new Error(
                  'Receipt preview could not be displayed.',
                ),
              );

              return;
            }

            resolve(true);
          },
        );
      },
    );
  }

  async function requestInvoice(
    saleId,
    token,
    reprint,
  ) {
    if (!saleId) {
      throw new Error(
        'Completed sale ID is unavailable.',
      );
    }

    if (!token) {
      throw new Error(
        'Authenticated session is unavailable.',
      );
    }

    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const slug = tenantSlug();

    if (slug) {
      headers['X-Tenant-Slug'] = slug;
    }

    const response =
      await fetch(
        `/api/v1/pharmaco/sales/${encodeURIComponent(
          String(saleId),
        )}/invoice${
          reprint
            ? '?reprint=1'
            : ''
        }`,
        {
          method: 'GET',
          headers,
          credentials: 'same-origin',
          cache: 'no-store',
        },
      );

    let payload = null;

    try {
      payload =
        await response.json();
    } catch (_error) {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        payload?.message
        || `Receipt request failed (${response.status}).`,
      );
    }

    return normalize(payload);
  }

  async function execute(
    saleId,
    token,
    reprint,
  ) {
    try {
      const normalized =
        await requestInvoice(
          saleId,
          token,
          reprint,
        );

      const html =
        buildHtml(
          normalized,
          reprint,
        );

      await showReceiptPreview(html);

      return true;
    } catch (error) {
      console.error(
        '[Ubuzima+ persisted receipt]',
        error,
      );

      window.alert(
        `Receipt could not be printed. ${
          error instanceof Error
            ? error.message
            : 'Please try again.'
        }`,
      );

      return false;
    }
  }

  window.UbuzimaReceipt =
    Object.freeze({
      version: VERSION,

      printOriginal(
        saleId,
        token,
      ) {
        return execute(
          saleId,
          token,
          false,
        );
      },

      printReprint(
        saleId,
        token,
      ) {
        return execute(
          saleId,
          token,
          true,
        );
      },
    });
})();

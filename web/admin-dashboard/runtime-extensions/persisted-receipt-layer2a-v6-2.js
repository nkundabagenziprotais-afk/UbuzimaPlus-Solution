(function () {
  'use strict';

  const VERSION =
    '2026.08.layer2a-persisted-receipt-v6.2';

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

  function printHtml(html) {
    return new Promise(
      (resolve, reject) => {
        const ROOT_ID =
          'ubuzima-receipt-print-root';

        const STYLE_ID =
          'ubuzima-receipt-print-style';

        const cleanupStale = () => {
          document
            .getElementById(ROOT_ID)
            ?.remove();

          document
            .getElementById(STYLE_ID)
            ?.remove();
        };

        cleanupStale();

        const parser =
          new DOMParser();

        const sourceDocument =
          parser.parseFromString(
            html,
            'text/html',
          );

        const sourceReceipt =
          sourceDocument.querySelector(
            'main.receipt',
          );

        if (!sourceReceipt) {
          reject(
            new Error(
              'Printable receipt content is unavailable.',
            ),
          );

          return;
        }

        const sourceRows =
          sourceReceipt.querySelectorAll(
            '[data-receipt-product="true"]',
          );

        const sourceText =
          String(
            sourceReceipt.textContent
            || '',
          ).trim();

        if (sourceRows.length === 0) {
          reject(
            new Error(
              'Receipt contains no product lines.',
            ),
          );

          return;
        }

        if (sourceText.length < 20) {
          reject(
            new Error(
              'Receipt contains no visible transaction content.',
            ),
          );

          return;
        }

        const root =
          document.createElement(
            'section',
          );

        root.id = ROOT_ID;

        root.setAttribute(
          'data-ubuzima-receipt-print',
          'true',
        );

        /*
         * Keep a real, fully laid-out receipt in the TOP-LEVEL
         * document. It sits off-screen during normal application
         * use and becomes the sole visible body child only for
         * print media.
         */
        Object.assign(
          root.style,
          {
            position: 'fixed',
            left: '-100000px',
            top: '0',
            width: '74mm',
            margin: '0',
            padding: '0',
            background: '#ffffff',
            color: '#111111',
            pointerEvents: 'none',
          },
        );

        root.innerHTML =
          sourceReceipt.outerHTML;

        const style =
          document.createElement(
            'style',
          );

        style.id = STYLE_ID;

        style.textContent = `
#${ROOT_ID} {
  position: fixed !important;
  left: -100000px !important;
  top: 0 !important;
  width: 74mm !important;
  min-width: 74mm !important;
  max-width: 74mm !important;
  margin: 0 !important;
  padding: 0 !important;
  background: #ffffff !important;
  color: #111111 !important;
  font-family: Arial, Helvetica, sans-serif !important;
  font-size: 10px !important;
  line-height: 1.35 !important;
}

#${ROOT_ID},
#${ROOT_ID} * {
  box-sizing: border-box !important;
}

#${ROOT_ID} .receipt {
  display: block !important;
  width: 74mm !important;
  min-width: 74mm !important;
  max-width: 74mm !important;
  margin: 0 !important;
  padding: 0 !important;
  background: #ffffff !important;
  color: #111111 !important;
}

#${ROOT_ID} .header {
  text-align: center !important;
  margin-bottom: 3mm !important;
}

#${ROOT_ID} .header h1 {
  margin: 0 !important;
  font-size: 15px !important;
}

#${ROOT_ID} .header .label {
  margin-top: 1mm !important;
  font-size: 9px !important;
  font-weight: 700 !important;
}

#${ROOT_ID} .section {
  border-top: 1px dashed #222 !important;
  margin-top: 2mm !important;
  padding-top: 2mm !important;
}

#${ROOT_ID} .row {
  display: flex !important;
  justify-content: space-between !important;
  align-items: flex-start !important;
  gap: 3mm !important;
  margin: 0.7mm 0 !important;
}

#${ROOT_ID} .row span {
  color: #444 !important;
}

#${ROOT_ID} .row strong {
  text-align: right !important;
}

#${ROOT_ID} table {
  width: 100% !important;
  border-collapse: collapse !important;
  table-layout: fixed !important;
  margin-top: 2mm !important;
}

#${ROOT_ID} th,
#${ROOT_ID} td {
  padding: 1mm 0.5mm !important;
  vertical-align: top !important;
  border-bottom: 1px dotted #aaa !important;
}

#${ROOT_ID} th {
  font-size: 9px !important;
  text-align: left !important;
}

#${ROOT_ID} .product {
  width: 43% !important;
}

#${ROOT_ID} .number {
  text-align: right !important;
}

#${ROOT_ID} .grand {
  border-top: 1px solid #111 !important;
  border-bottom: 1px solid #111 !important;
  margin: 1mm 0 !important;
  padding: 1.2mm 0 !important;
  font-size: 12px !important;
}

#${ROOT_ID} .small {
  font-size: 9px !important;
}

#${ROOT_ID} .footer {
  text-align: center !important;
  font-size: 9px !important;
}

#${ROOT_ID} .reprint {
  margin-top: 2mm !important;
  font-weight: 700 !important;
  letter-spacing: 1px !important;
}

@media print {
  @page {
    size: 80mm 297mm;
    margin: 3mm;
  }

  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    width: auto !important;
    min-width: 0 !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    background: #ffffff !important;
  }

  body > * {
    display: none !important;
  }

  body > #${ROOT_ID} {
    display: block !important;
    position: static !important;
    left: auto !important;
    top: auto !important;
    width: 74mm !important;
    min-width: 74mm !important;
    max-width: 74mm !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #111111 !important;
    pointer-events: auto !important;
  }

  body > #${ROOT_ID},
  body > #${ROOT_ID} * {
    visibility: visible !important;
  }
}
`;

        document.head.appendChild(
          style,
        );

        document.body.appendChild(
          root,
        );

        const renderedRows =
          root.querySelectorAll(
            '[data-receipt-product="true"]',
          );

        const renderedText =
          String(
            root.textContent
            || '',
          ).trim();

        if (renderedRows.length === 0) {
          cleanupStale();

          reject(
            new Error(
              'Top-level receipt contains no product lines.',
            ),
          );

          return;
        }

        if (renderedText.length < 20) {
          cleanupStale();

          reject(
            new Error(
              'Top-level receipt contains no visible content.',
            ),
          );

          return;
        }

        const prepareAndPrint =
          async () => {
            try {
              if (
                document.fonts
                && document.fonts.ready
              ) {
                await document.fonts.ready;
              }
            } catch (_error) {
              // Font readiness is non-critical.
            }

            await new Promise(
              (ready) => {
                window.requestAnimationFrame(
                  () => {
                    window.requestAnimationFrame(
                      ready,
                    );
                  },
                );
              },
            );

            await new Promise(
              (ready) => {
                window.setTimeout(
                  ready,
                  250,
                );
              },
            );

            const finalRows =
              root.querySelectorAll(
                '[data-receipt-product="true"]',
              ).length;

            const finalTextLength =
              String(
                root.textContent
                || '',
              ).trim().length;

            const rect =
              root.getBoundingClientRect();

            console.info(
              '[Ubuzima+ top-level receipt print-ready]',
              {
                version:
                  '2026.08.layer2a-persisted-receipt-v6.2',

                productRows:
                  finalRows,

                textLength:
                  finalTextLength,

                rootWidth:
                  rect.width,

                rootHeight:
                  rect.height,
              },
            );

            if (
              finalRows === 0
              || finalTextLength < 20
              || rect.width <= 0
              || rect.height <= 0
            ) {
              cleanupStale();

              reject(
                new Error(
                  'Receipt failed final print-layout validation.',
                ),
              );

              return;
            }

            let completed = false;
            let emergencyTimer = null;

            const cleanup = () => {
              if (completed) {
                return;
              }

              completed = true;

              if (emergencyTimer) {
                window.clearTimeout(
                  emergencyTimer,
                );
              }

              window.setTimeout(
                cleanupStale,
                1000,
              );

              resolve(true);
            };

            window.addEventListener(
              'afterprint',
              cleanup,
              {
                once: true,
              },
            );

            try {
              /*
               * IMPORTANT:
               * This prints the top-level Admin document.
               * @media print hides every normal application
               * child and displays only the temporary receipt.
               */
              window.print();

              emergencyTimer =
                window.setTimeout(
                  cleanup,
                  120000,
                );
            } catch (error) {
              cleanupStale();
              reject(error);
            }
          };

        prepareAndPrint().catch(
          (error) => {
            cleanupStale();
            reject(error);
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

      await printHtml(html);

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

(function () {
  'use strict';

  const VERSION =
    '2026.08.layer2a-persisted-receipt-v6.1';

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
        const frame =
          document.createElement('iframe');

        frame.setAttribute(
          'title',
          'Ubuzima receipt print frame',
        );

        frame.setAttribute(
          'aria-hidden',
          'true',
        );

        /*
         * IMPORTANT:
         * Chrome can generate a blank print preview when a
         * sub-frame is rendered at 1px × 1px or opacity:0.
         *
         * Keep the print document fully laid out at the
         * physical receipt width, but position it far outside
         * the visible application viewport.
         */
        Object.assign(
          frame.style,
          {
            position: 'fixed',
            left: '-10000px',
            top: '0',
            width: '80mm',
            height: '1200px',
            border: '0',
            margin: '0',
            padding: '0',
            background: '#ffffff',
            pointerEvents: 'none',
          },
        );

        let completed = false;
        let fallbackTimer = null;

        const removeFrame = () => {
          window.setTimeout(
            () => {
              try {
                frame.remove();
              } catch (_error) {
                // No-op.
              }
            },
            1500,
          );
        };

        const complete = () => {
          if (completed) {
            return;
          }

          completed = true;

          if (fallbackTimer) {
            window.clearTimeout(
              fallbackTimer,
            );
          }

          removeFrame();

          resolve(true);
        };

        frame.addEventListener(
          'load',
          async () => {
            const targetWindow =
              frame.contentWindow;

            const targetDocument =
              frame.contentDocument;

            if (
              !targetWindow
              || !targetDocument
            ) {
              frame.remove();

              reject(
                new Error(
                  'Receipt print frame is unavailable.',
                ),
              );

              return;
            }

            const productRows =
              targetDocument.querySelectorAll(
                '[data-receipt-product="true"]',
              );

            const bodyText =
              String(
                targetDocument.body?.innerText
                || '',
              ).trim();

            if (productRows.length === 0) {
              frame.remove();

              reject(
                new Error(
                  'Receipt rendered without product lines.',
                ),
              );

              return;
            }

            if (bodyText.length < 20) {
              frame.remove();

              reject(
                new Error(
                  'Receipt document rendered without visible content.',
                ),
              );

              return;
            }

            /*
             * Give the iframe a real content height before
             * printing. This prevents Chromium from treating
             * the print target as an effectively empty 1px
             * viewport.
             */
            const documentHeight =
              Math.max(
                targetDocument.documentElement
                  ?.scrollHeight
                  || 0,

                targetDocument.body
                  ?.scrollHeight
                  || 0,

                600,
              );

            frame.style.height =
              `${Math.min(
                Math.max(
                  documentHeight + 80,
                  600,
                ),
                6000,
              )}px`;

            try {
              if (
                targetDocument.fonts
                && targetDocument.fonts.ready
              ) {
                await targetDocument.fonts.ready;
              }
            } catch (_error) {
              // Fonts are not critical for printing.
            }

            /*
             * Wait for two complete browser paint cycles,
             * then a short layout-settle period.
             */
            await new Promise(
              (paintReady) => {
                window.requestAnimationFrame(
                  () => {
                    window.requestAnimationFrame(
                      paintReady,
                    );
                  },
                );
              },
            );

            await new Promise(
              (settled) => {
                window.setTimeout(
                  settled,
                  250,
                );
              },
            );

            const finalRows =
              targetDocument.querySelectorAll(
                '[data-receipt-product="true"]',
              ).length;

            const finalTextLength =
              String(
                targetDocument.body?.innerText
                || '',
              ).trim().length;

            console.info(
              '[Ubuzima+ receipt print-ready]',
              {
                version:
                  '2026.08.layer2a-persisted-receipt-v6.1',

                productRows:
                  finalRows,

                textLength:
                  finalTextLength,

                frameWidth:
                  frame.offsetWidth,

                frameHeight:
                  frame.offsetHeight,

                documentHeight,
              },
            );

            if (
              finalRows === 0
              || finalTextLength < 20
            ) {
              frame.remove();

              reject(
                new Error(
                  'Receipt content disappeared before printing.',
                ),
              );

              return;
            }

            targetWindow.addEventListener(
              'afterprint',
              complete,
              {
                once: true,
              },
            );

            try {
              targetWindow.focus();

              /*
               * Keep the iframe alive while Chrome builds
               * the preview. Cleanup happens only afterprint
               * or after the long emergency timer.
               */
              targetWindow.print();

              fallbackTimer =
                window.setTimeout(
                  complete,
                  120000,
                );
            } catch (error) {
              frame.remove();
              reject(error);
            }
          },
          {
            once: true,
          },
        );

        frame.srcdoc = html;

        document.body.appendChild(frame);
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

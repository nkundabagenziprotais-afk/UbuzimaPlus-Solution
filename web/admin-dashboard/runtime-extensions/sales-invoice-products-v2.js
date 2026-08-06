(function () {
  'use strict';

  if (window.__UBUZIMA_SALES_DOCUMENTS_V2__) {
    return;
  }

  var VERSION =
    '2026.08.sales-invoice-products-v2';

  var SALES_SUFFIX =
    '/pharmaco/sales';

  var CHECKOUT_SUFFIX =
    '/pharmaco/sales/checkout';

  if (typeof window.fetch !== 'function') {
    return;
  }

  var originalFetch =
    window.fetch.bind(window);

  var state = {
    sales: [],
    requestHeaders: null,
    credentials: 'same-origin',
    salesResponsesCaptured: 0,
    checkoutResponsesCaptured: 0,
    tablesPatched: 0,
    rowsPatched: 0,
    invoicePrints: 0,
    blockedPopups: 0,
    usedRequestPassthroughs: 0,
    redundantPaymentSummariesRemoved: 0
  };

  function requestUrl(input) {
    var value =
      typeof input === 'string'
        ? input
        : (
          input &&
          typeof input.url === 'string'
            ? input.url
            : ''
        );

    if (!value) {
      return null;
    }

    try {
      return new URL(
        value,
        window.location.href
      );
    } catch (error) {
      return null;
    }
  }

  function requestMethod(input, init) {
    return String(
      (
        init &&
        init.method
      ) ||
      (
        input &&
        input.method
      ) ||
      'GET'
    ).toUpperCase();
  }

  function pathEndsWith(
    pathname,
    suffix
  ) {
    return pathname
      .replace(/\/+$/, '')
      .endsWith(suffix);
  }

  function captureContext(input, init) {
    var headerSource =
      (
        init &&
        init.headers
      ) ||
      (
        input &&
        input.headers
      ) ||
      null;

    try {
      state.requestHeaders =
        headerSource
          ? new Headers(headerSource)
          : null;
    } catch (error) {
      state.requestHeaders = null;
    }

    state.credentials =
      (
        init &&
        init.credentials
      ) ||
      (
        input &&
        input.credentials
      ) ||
      'same-origin';

    if (
      input instanceof Request &&
      input.bodyUsed
    ) {
      state.usedRequestPassthroughs += 1;
    }
  }

  function cloneJson(response) {
    var contentType =
      response.headers.get(
        'content-type'
      ) || '';

    if (
      !response.ok ||
      contentType.indexOf(
        'application/json'
      ) === -1
    ) {
      return Promise.resolve(null);
    }

    return response.clone()
      .json()
      .catch(function () {
        return null;
      });
  }

  function normalizeSales(payload) {
    if (
      payload &&
      Array.isArray(payload.sales)
    ) {
      return payload.sales;
    }

    if (
      payload &&
      payload.data &&
      Array.isArray(
        payload.data.sales
      )
    ) {
      return payload.data.sales;
    }

    if (
      payload &&
      Array.isArray(payload.data)
    ) {
      return payload.data;
    }

    return [];
  }

  function saleId(sale) {
    var value =
      Number(
        sale &&
        (
          sale.id ||
          sale.sale_id
        )
      );

    return Number.isInteger(value) &&
      value > 0
        ? value
        : null;
  }

  function saleIdentifier(sale) {
    var value =
      sale &&
      (
        sale.sale_number ||
        sale.invoice_number ||
        sale.reference_number ||
        sale.reference ||
        sale.id
      );

    return value === null ||
      value === undefined
        ? ''
        : String(value);
  }

  function productLines(sale) {
    var lines =
      sale &&
      (
        sale.product_lines ||
        sale.items
      );

    return Array.isArray(lines)
      ? lines
      : [];
  }

  function numeric(value) {
    var parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function quantity(value) {
    var parsed = numeric(value);

    if (
      Math.abs(
        parsed - Math.round(parsed)
      ) < 0.0001
    ) {
      return String(
        Math.round(parsed)
      );
    }

    return parsed
      .toFixed(3)
      .replace(/0+$/, '')
      .replace(/\.$/, '');
  }

  function productName(line) {
    return String(
      line &&
      (
        line.product_name ||
        line.product_name_snapshot ||
        (
          line.product &&
          (
            line.product.name ||
            line.product.trade_name ||
            line.product.generic_name
          )
        ) ||
        'Unspecified product'
      )
    );
  }

  function productSummary(sale) {
    var lines = productLines(sale);

    if (!lines.length) {
      return 'No product lines';
    }

    return lines.map(
      function (line) {
        return (
          productName(line) +
          ' × ' +
          quantity(line.quantity)
        );
      }
    ).join(', ');
  }

  function escapeHtml(value) {
    return String(
      value === null ||
      value === undefined
        ? ''
        : value
    )
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMoney(value) {
    return numeric(value)
      .toLocaleString(
        undefined,
        {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      );
  }

  function saleDate(sale) {
    return String(
      sale &&
      (
        sale.completed_at ||
        sale.confirmed_at ||
        sale.sale_date ||
        sale.created_at ||
        ''
      )
    );
  }

  function saleTotal(sale) {
    return numeric(
      sale &&
      (
        sale.total_amount ||
        (
          sale.totals &&
          sale.totals.total_amount
        )
      )
    );
  }

  function findSaleForText(text) {
    var value = String(text || '');

    for (
      var index = 0;
      index < state.sales.length;
      index += 1
    ) {
      var identifier =
        saleIdentifier(
          state.sales[index]
        );

      if (
        identifier &&
        value.indexOf(identifier) !== -1
      ) {
        return state.sales[index];
      }
    }

    return null;
  }

  function createReprintButton(sale) {
    var button =
      document.createElement('button');

    button.type = 'button';
    button.textContent = 'Reprint';

    button.setAttribute(
      'data-ubuzima-reprint-sale-id',
      String(saleId(sale) || '')
    );

    button.style.cssText = [
      'border:1px solid #0f766e',
      'background:#ffffff',
      'color:#0f766e',
      'border-radius:8px',
      'padding:6px 10px',
      'font:inherit',
      'font-size:12px',
      'font-weight:700',
      'cursor:pointer',
      'white-space:nowrap'
    ].join(';');

    return button;
  }

  function tableLooksLikeSales(table) {
    var header =
      table.querySelector('thead');

    var text =
      header
        ? header.textContent || ''
        : '';

    return /sale|invoice|reference|transaction|amount|total|status/i
      .test(text);
  }

  function patchTables() {
    var tables =
      document.querySelectorAll('table');

    tables.forEach(
      function (table) {
        if (!tableLooksLikeSales(table)) {
          return;
        }

        var rows =
          Array.prototype.slice.call(
            table.querySelectorAll(
              'tbody tr'
            )
          );

        if (!rows.length) {
          return;
        }

        var matchedRows =
          rows.map(
            function (row) {
              return {
                row: row,
                sale:
                  findSaleForText(
                    row.textContent
                  )
              };
            }
          ).filter(
            function (entry) {
              return Boolean(entry.sale);
            }
          );

        if (!matchedRows.length) {
          return;
        }

        var headerRow =
          table.querySelector(
            'thead tr'
          );

        if (
          headerRow &&
          !headerRow.querySelector(
            '[data-ubuzima-products-header]'
          )
        ) {
          var productsHeader =
            document.createElement('th');

          productsHeader.textContent =
            'Product(s)';

          productsHeader.setAttribute(
            'data-ubuzima-products-header',
            'true'
          );

          productsHeader.style.minWidth =
            '220px';

          var invoiceHeader =
            document.createElement('th');

          invoiceHeader.textContent =
            'Invoice';

          invoiceHeader.setAttribute(
            'data-ubuzima-invoice-header',
            'true'
          );

          invoiceHeader.style.minWidth =
            '100px';

          headerRow.appendChild(
            productsHeader
          );

          headerRow.appendChild(
            invoiceHeader
          );

          state.tablesPatched += 1;
        }

        matchedRows.forEach(
          function (entry) {
            if (
              entry.row.querySelector(
                '[data-ubuzima-products-cell]'
              )
            ) {
              return;
            }

            var productsCell =
              document.createElement('td');

            productsCell.setAttribute(
              'data-ubuzima-products-cell',
              'true'
            );

            productsCell.textContent =
              productSummary(entry.sale);

            productsCell.style.cssText = [
              'min-width:220px',
              'white-space:normal',
              'line-height:1.45',
              'font-size:12px'
            ].join(';');

            var invoiceCell =
              document.createElement('td');

            invoiceCell.setAttribute(
              'data-ubuzima-invoice-cell',
              'true'
            );

            invoiceCell.appendChild(
              createReprintButton(
                entry.sale
              )
            );

            entry.row.appendChild(
              productsCell
            );

            entry.row.appendChild(
              invoiceCell
            );

            state.rowsPatched += 1;
          }
        );
      }
    );
  }

  function scheduleRender() {
    var frame = 0;
    var maximumFrames = 60;

    function renderFrame() {
      patchTables();
      removeRedundantPaymentSummaryText();
      mountDock();

      frame += 1;

      if (
        frame < maximumFrames &&
        state.sales.length
      ) {
        window.requestAnimationFrame(
          renderFrame
        );
      }
    }

    window.requestAnimationFrame(
      renderFrame
    );
  }

  function csvValue(value) {
    var text =
      String(
        value === null ||
        value === undefined
          ? ''
          : value
      );

    return (
      '"' +
      text.replace(/"/g, '""') +
      '"'
    );
  }

  function exportCsv() {
    var rows = [
      [
        'Sale number',
        'Date',
        'Products',
        'Total',
        'Status'
      ]
    ];

    state.sales.forEach(
      function (sale) {
        rows.push([
          saleIdentifier(sale),
          saleDate(sale),
          productSummary(sale),
          saleTotal(sale),
          sale.status || ''
        ]);
      }
    );

    var csv =
      rows.map(
        function (row) {
          return row.map(
            csvValue
          ).join(',');
        }
      ).join('\n');

    var blob =
      new Blob(
        [csv],
        {
          type:
            'text/csv;charset=utf-8'
        }
      );

    var url =
      URL.createObjectURL(blob);

    var anchor =
      document.createElement('a');

    anchor.href = url;
    anchor.download =
      'sales-with-products.csv';

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  function mountDock() {
    if (
      !state.sales.length ||
      document.getElementById(
        'ubuzima-sales-documents-v1-button'
      )
    ) {
      return;
    }

    var button =
      document.createElement('button');

    button.id =
      'ubuzima-sales-documents-v1-button';

    button.type = 'button';
    button.textContent =
      'Sales documents';

    button.setAttribute(
      'data-ubuzima-sales-panel-open',
      'true'
    );

    button.style.cssText = [
      'position:fixed',
      'right:20px',
      'bottom:84px',
      'z-index:2147482000',
      'border:0',
      'border-radius:999px',
      'padding:11px 16px',
      'background:#0f766e',
      'color:#ffffff',
      'font:inherit',
      'font-size:13px',
      'font-weight:800',
      'box-shadow:0 10px 28px rgba(15,118,110,.28)',
      'cursor:pointer'
    ].join(';');

    document.body.appendChild(button);
  }

  function closePanel() {
    var panel =
      document.getElementById(
        'ubuzima-sales-documents-v1-panel'
      );

    if (panel) {
      panel.remove();
    }
  }

  function openPanel() {
    closePanel();

    var overlay =
      document.createElement('div');

    overlay.id =
      'ubuzima-sales-documents-v1-panel';

    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483000',
      'background:rgba(15,23,42,.54)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:18px'
    ].join(';');

    var panel =
      document.createElement('div');

    panel.style.cssText = [
      'width:min(1100px,96vw)',
      'max-height:90vh',
      'overflow:auto',
      'background:#ffffff',
      'border-radius:18px',
      'box-shadow:0 28px 80px rgba(15,23,42,.32)',
      'padding:20px',
      'color:#0f172a'
    ].join(';');

    var rows =
      state.sales.map(
        function (sale) {
          return [
            '<tr>',
            '<td>',
            escapeHtml(
              saleIdentifier(sale)
            ),
            '</td>',
            '<td>',
            escapeHtml(
              saleDate(sale)
            ),
            '</td>',
            '<td style="min-width:260px;white-space:normal">',
            escapeHtml(
              productSummary(sale)
            ),
            '</td>',
            '<td style="text-align:right">',
            escapeHtml(
              formatMoney(
                saleTotal(sale)
              )
            ),
            '</td>',
            '<td>',
            '<button type="button" ',
            'data-ubuzima-reprint-sale-id="',
            escapeHtml(
              saleId(sale) || ''
            ),
            '" style="border:1px solid #0f766e;',
            'background:white;color:#0f766e;',
            'border-radius:8px;padding:6px 10px;',
            'font-weight:700;cursor:pointer">',
            'Reprint',
            '</button>',
            '</td>',
            '</tr>'
          ].join('');
        }
      ).join('');

    panel.innerHTML = [
      '<div style="display:flex;align-items:flex-start;',
      'justify-content:space-between;gap:16px;margin-bottom:16px">',
      '<div>',
      '<h2 style="margin:0 0 5px;font-size:20px">Sales documents</h2>',
      '<p style="margin:0;color:#64748b;font-size:13px">',
      'Persisted products, quantities and invoice reprints.',
      '</p>',
      '</div>',
      '<div style="display:flex;gap:8px">',
      '<button type="button" data-ubuzima-sales-export="true" ',
      'style="border:1px solid #cbd5e1;background:white;',
      'border-radius:9px;padding:8px 12px;font-weight:700;cursor:pointer">',
      'Export CSV',
      '</button>',
      '<button type="button" data-ubuzima-sales-panel-close="true" ',
      'style="border:0;background:#e2e8f0;',
      'border-radius:9px;padding:8px 12px;font-weight:700;cursor:pointer">',
      'Close',
      '</button>',
      '</div>',
      '</div>',
      '<div style="overflow:auto">',
      '<table style="width:100%;border-collapse:collapse;font-size:13px">',
      '<thead><tr>',
      '<th style="text-align:left;padding:10px;border-bottom:1px solid #e2e8f0">Sale</th>',
      '<th style="text-align:left;padding:10px;border-bottom:1px solid #e2e8f0">Date</th>',
      '<th style="text-align:left;padding:10px;border-bottom:1px solid #e2e8f0">Product(s)</th>',
      '<th style="text-align:right;padding:10px;border-bottom:1px solid #e2e8f0">Total</th>',
      '<th style="text-align:left;padding:10px;border-bottom:1px solid #e2e8f0">Invoice</th>',
      '</tr></thead>',
      '<tbody>',
      rows,
      '</tbody></table>',
      '</div>'
    ].join('');

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  function invoiceHtml(invoice) {
    var items =
      Array.isArray(invoice.items)
        ? invoice.items
        : [];

    var payments =
      Array.isArray(invoice.payments)
        ? invoice.payments
        : [];

    var itemRows =
      items.map(
        function (line) {
          return [
            '<tr>',
            '<td>',
            escapeHtml(
              line.product_name ||
              'Unspecified product'
            ),
            '</td>',
            '<td class="number">',
            escapeHtml(
              quantity(line.quantity)
            ),
            '</td>',
            '<td class="number">',
            escapeHtml(
              formatMoney(
                line.unit_price
              )
            ),
            '</td>',
            '<td class="number">',
            escapeHtml(
              formatMoney(
                line.line_total
              )
            ),
            '</td>',
            '</tr>'
          ].join('');
        }
      ).join('');

    var paymentText =
      payments.map(
        function (payment) {
          return (
            String(
              payment.method ||
              'Payment'
            ) +
            ': ' +
            formatMoney(
              payment.amount
            )
          );
        }
      ).join(' · ');

    var totals =
      invoice.totals || {};

    return [
      '<!doctype html>',
      '<html><head><meta charset="utf-8">',
      '<title>',
      escapeHtml(
        invoice.document_label ||
        'Sales invoice'
      ),
      '</title>',
      '<style>',
      'body{font-family:Arial,sans-serif;color:#111827;margin:28px;}',
      '.header{display:flex;justify-content:space-between;gap:24px;',
      'border-bottom:2px solid #0f766e;padding-bottom:16px;margin-bottom:18px;}',
      'h1{font-size:22px;margin:0 0 6px;color:#0f766e;}',
      '.muted{color:#64748b;font-size:12px;line-height:1.5;}',
      'table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px;}',
      'th,td{padding:9px;border-bottom:1px solid #e5e7eb;text-align:left;}',
      'th{background:#f8fafc;}',
      '.number{text-align:right;}',
      '.totals{margin-left:auto;margin-top:18px;width:320px;font-size:13px;}',
      '.totals div{display:flex;justify-content:space-between;padding:5px 0;}',
      '.grand{font-size:16px;font-weight:700;border-top:2px solid #111827;',
      'margin-top:5px;padding-top:9px!important;}',
      '.reprint{display:inline-block;background:#fef3c7;color:#92400e;',
      'padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;}',
      '@media print{body{margin:8mm}}',
      '</style></head><body>',
      '<div class="header"><div>',
      '<h1>',
      escapeHtml(
        invoice.tenant &&
        invoice.tenant.name
          ? invoice.tenant.name
          : 'Sales invoice'
      ),
      '</h1>',
      '<div class="muted">',
      escapeHtml(
        invoice.branch &&
        invoice.branch.name
          ? invoice.branch.name
          : ''
      ),
      '<br>',
      escapeHtml(
        invoice.branch &&
        invoice.branch.address
          ? invoice.branch.address
          : ''
      ),
      '</div></div><div style="text-align:right">',
      invoice.is_reprint
        ? '<span class="reprint">REPRINT</span>'
        : '',
      '<div style="font-weight:700;margin-top:7px">',
      escapeHtml(
        invoice.invoice_number ||
        ''
      ),
      '</div>',
      '<div class="muted">',
      escapeHtml(
        invoice.issued_at ||
        ''
      ),
      '</div></div></div>',
      '<div class="muted">',
      'Customer: ',
      escapeHtml(
        invoice.customer &&
        invoice.customer.name
          ? invoice.customer.name
          : 'Walk-in customer'
      ),
      '<br>Cashier: ',
      escapeHtml(
        invoice.cashier &&
        invoice.cashier.name
          ? invoice.cashier.name
          : ''
      ),
      '</div>',
      '<table><thead><tr>',
      '<th>Product</th>',
      '<th class="number">Qty</th>',
      '<th class="number">Unit price</th>',
      '<th class="number">Amount</th>',
      '</tr></thead><tbody>',
      itemRows,
      '</tbody></table>',
      '<div class="totals">',
      '<div><span>Subtotal</span><strong>',
      escapeHtml(
        formatMoney(
          totals.subtotal_amount
        )
      ),
      '</strong></div>',
      '<div><span>Discount</span><strong>',
      escapeHtml(
        formatMoney(
          totals.discount_amount
        )
      ),
      '</strong></div>',
      '<div><span>Tax</span><strong>',
      escapeHtml(
        formatMoney(
          totals.tax_amount
        )
      ),
      '</strong></div>',
      '<div class="grand"><span>Total</span><strong>',
      escapeHtml(
        formatMoney(
          totals.total_amount
        )
      ),
      '</strong></div>',
      '<div><span>Paid</span><strong>',
      escapeHtml(
        formatMoney(
          totals.paid_amount
        )
      ),
      '</strong></div>',
      '<div><span>Balance</span><strong>',
      escapeHtml(
        formatMoney(
          totals.balance_amount
        )
      ),
      '</strong></div>',
      '</div>',
      '<p class="muted" style="margin-top:22px">',
      escapeHtml(paymentText),
      '</p>',
      '</body></html>'
    ].join('');
  }

  function toast(message) {
    var existing =
      document.getElementById(
        'ubuzima-sales-documents-v1-toast'
      );

    if (existing) {
      existing.remove();
    }

    var element =
      document.createElement('div');

    element.id =
      'ubuzima-sales-documents-v1-toast';

    element.textContent = message;

    element.style.cssText = [
      'position:fixed',
      'right:20px',
      'bottom:145px',
      'z-index:2147483640',
      'max-width:340px',
      'background:#0f172a',
      'color:white',
      'border-radius:10px',
      'padding:11px 14px',
      'font:inherit',
      'font-size:13px',
      'box-shadow:0 16px 40px rgba(15,23,42,.32)'
    ].join(';');

    document.body.appendChild(element);

    window.setTimeout(
      function () {
        element.remove();
      },
      4500
    );
  }

  function renderInvoice(
    invoice,
    printWindow
  ) {
    var target =
      printWindow ||
      window.open('', '_blank');

    if (!target) {
      state.blockedPopups += 1;

      toast(
        'Invoice pop-up was blocked. Allow pop-ups and select Reprint again.'
      );

      return;
    }

    target.document.open();
    target.document.write(
      invoiceHtml(invoice)
    );
    target.document.close();

    state.invoicePrints += 1;

    target.focus();

    window.setTimeout(
      function () {
        target.print();
      },
      250
    );
  }

  function preopenInvoiceWindow() {
    var target =
      window.open('', '_blank');

    if (target) {
      target.document.open();
      target.document.write(
        '<p style="font-family:Arial,sans-serif;padding:24px">Preparing invoice…</p>'
      );
      target.document.close();
    }

    return target;
  }

  function invoiceUrl(id, reprint) {
    var url =
      new URL(
        '/api/v1/pharmaco/sales/' +
        encodeURIComponent(String(id)) +
        '/invoice',
        window.location.origin
      );

    if (reprint) {
      url.searchParams.set(
        'reprint',
        '1'
      );
    }

    return url;
  }

  async function printSaleInvoice(
    id,
    reprint,
    preopenedWindow
  ) {
    if (!id) {
      if (preopenedWindow) {
        preopenedWindow.close();
      }

      toast(
        'The selected sale does not have a valid identifier.'
      );

      return;
    }

    var headers =
      state.requestHeaders
        ? new Headers(
            state.requestHeaders
          )
        : new Headers();

    headers.set(
      'Accept',
      'application/json'
    );

    var response =
      await originalFetch(
        new Request(
          invoiceUrl(id, reprint)
            .toString(),
          {
            method: 'GET',
            headers: headers,
            credentials:
              state.credentials ||
              'same-origin',
            cache: 'no-store'
          }
        )
      );

    if (!response.ok) {
      if (preopenedWindow) {
        preopenedWindow.close();
      }

      toast(
        'The invoice could not be loaded.'
      );

      return;
    }

    var payload =
      await response.json();

    var invoice =
      payload &&
      (
        payload.invoice ||
        (
          payload.data &&
          payload.data.invoice
        )
      );

    if (!invoice) {
      if (preopenedWindow) {
        preopenedWindow.close();
      }

      toast(
        'The invoice response was incomplete.'
      );

      return;
    }

    renderInvoice(
      invoice,
      preopenedWindow
    );
  }

  function checkoutSaleId(payload) {
    var candidates = [
      payload &&
        payload.sale &&
        payload.sale.id,

      payload &&
        payload.data &&
        payload.data.sale &&
        payload.data.sale.id,

      payload &&
        payload.data &&
        payload.data.id,

      payload &&
        payload.result &&
        payload.result.sale &&
        payload.result.sale.id,

      payload &&
        payload.checkout &&
        payload.checkout.sale &&
        payload.checkout.sale.id,

      payload &&
        payload.sale_id
    ];

    for (
      var index = 0;
      index < candidates.length;
      index += 1
    ) {
      var parsed =
        Number(candidates[index]);

      if (
        Number.isInteger(parsed) &&
        parsed > 0
      ) {
        return parsed;
      }
    }

    return null;
  }

  function normalizeSummaryText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function redundantSummaryText(value) {
    var text =
      normalizeSummaryText(value);

    if (
      !text ||
      text.length > 600
    ) {
      return false;
    }

    var lower =
      text.toLowerCase();

    return (
      lower.indexOf(' added:') > 0 &&
      /selling\s+amount\s*:/i.test(text) &&
      /RWF\s*[\d,.]+/i.test(text)
    );
  }

  function removeRedundantPaymentSummaryText() {
    if (
      typeof document === 'undefined' ||
      typeof document.querySelectorAll !==
        'function'
    ) {
      return 0;
    }

    var removed = 0;

    var elements =
      document.querySelectorAll(
        'p,div,span,small,li'
      );

    Array.prototype.forEach.call(
      elements,
      function (element) {
        if (!element) {
          return;
        }

        var children =
          element.children || [];

        var fullText =
          String(
            element.textContent || ''
          );

        if (
          children.length === 0 &&
          redundantSummaryText(fullText)
        ) {
          if (
            typeof element.remove ===
            'function'
          ) {
            element.remove();
          } else {
            element.textContent = '';
          }

          removed += 1;
          return;
        }

        var childNodes =
          Array.prototype.slice.call(
            element.childNodes || []
          );

        var ownTextNodes =
          childNodes.filter(
            function (node) {
              return (
                node &&
                node.nodeType === 3
              );
            }
          );

        var ownText =
          ownTextNodes.map(
            function (node) {
              return node.nodeValue || '';
            }
          ).join(' ');

        if (
          ownTextNodes.length &&
          redundantSummaryText(ownText)
        ) {
          ownTextNodes.forEach(
            function (node) {
              node.nodeValue = '';
            }
          );

          removed += 1;
        }
      }
    );

    state.redundantPaymentSummariesRemoved +=
      removed;

    return removed;
  }

  function schedulePaymentSummaryCleanup() {
    var frame = 0;
    var maximumFrames = 30;

    function cleanFrame() {
      removeRedundantPaymentSummaryText();

      frame += 1;

      if (frame < maximumFrames) {
        window.requestAnimationFrame(
          cleanFrame
        );
      }
    }

    window.requestAnimationFrame(
      cleanFrame
    );
  }

  window.fetch = async function (
    input,
    init
  ) {
    var url =
      requestUrl(input);

    if (
      !url ||
      url.href.indexOf(
        SALES_SUFFIX
      ) === -1
    ) {
      return originalFetch(
        input,
        init
      );
    }

    var method =
      requestMethod(
        input,
        init
      );

    var salesList =
      method === 'GET' &&
      pathEndsWith(
        url.pathname,
        SALES_SUFFIX
      );

    var checkout =
      method === 'POST' &&
      pathEndsWith(
        url.pathname,
        CHECKOUT_SUFFIX
      );

    captureContext(
      input,
      init
    );

    if (!salesList && !checkout) {
      var directResponse =
        await originalFetch(
          input,
          init
        );

      schedulePaymentSummaryCleanup();

      return directResponse;
    }

    var printWindow =
      checkout
        ? preopenInvoiceWindow()
        : null;

    var response =
      await originalFetch(
        input,
        init
      );

    schedulePaymentSummaryCleanup();

    if (salesList) {
      cloneJson(response)
        .then(function (payload) {
          state.sales =
            normalizeSales(payload);

          state.salesResponsesCaptured += 1;

          if (state.sales.length) {
            scheduleRender();
          }
        });
    }

    if (checkout) {
      cloneJson(response)
        .then(function (payload) {
          if (!response.ok) {
            if (printWindow) {
              printWindow.close();
            }

            return;
          }

          state.checkoutResponsesCaptured += 1;

          return printSaleInvoice(
            checkoutSaleId(payload),
            false,
            printWindow
          );
        });
    }

    return response;
  };

  document.addEventListener(
    'click',
    function (event) {
      var target =
        event.target instanceof Element
          ? event.target
          : null;

      if (!target) {
        return;
      }

      schedulePaymentSummaryCleanup();

      var reprintButton =
        target.closest(
          '[data-ubuzima-reprint-sale-id]'
        );

      if (reprintButton) {
        event.preventDefault();

        var printWindow =
          preopenInvoiceWindow();

        printSaleInvoice(
          Number(
            reprintButton.getAttribute(
              'data-ubuzima-reprint-sale-id'
            )
          ),
          true,
          printWindow
        );

        return;
      }

      if (
        target.closest(
          '[data-ubuzima-sales-panel-open]'
        )
      ) {
        event.preventDefault();
        openPanel();
        return;
      }

      if (
        target.closest(
          '[data-ubuzima-sales-panel-close]'
        )
      ) {
        event.preventDefault();
        closePanel();
        return;
      }

      if (
        target.closest(
          '[data-ubuzima-sales-export]'
        )
      ) {
        event.preventDefault();
        exportCsv();
        return;
      }

      if (state.sales.length) {
        window.requestAnimationFrame(
          patchTables
        );
      }
    },
    true
  );

  window.addEventListener(
    'popstate',
    function () {
      if (state.sales.length) {
        scheduleRender();
      }
    }
  );

  window.__UBUZIMA_SALES_DOCUMENTS_V2__ = {
    version: VERSION,

    diagnostics: function () {
      return {
        version: VERSION,
        sales_loaded:
          state.sales.length,
        sales_responses_captured:
          state.salesResponsesCaptured,
        checkout_responses_captured:
          state.checkoutResponsesCaptured,
        tables_patched:
          state.tablesPatched,
        rows_patched:
          state.rowsPatched,
        invoice_prints:
          state.invoicePrints,
        blocked_popups:
          state.blockedPopups,
        used_request_passthroughs:
          state.usedRequestPassthroughs,
        redundant_payment_summaries_removed:
          state.redundantPaymentSummariesRemoved,
        inventory_interception:
          false,
        unrelated_request_interception:
          false,
        mutation_observer:
          false,
        polling_interval:
          false
      };
    },

    openPanel: openPanel,
    exportCsv: exportCsv,
    cleanupPaymentSummary:
      removeRedundantPaymentSummaryText,

    reprint: function (id) {
      return printSaleInvoice(
        Number(id),
        true,
        preopenInvoiceWindow()
      );
    }
  };

  console.info(
    '[UbuzimaPlus] Sales invoice and product-line extension loaded.',
    VERSION
  );
}());

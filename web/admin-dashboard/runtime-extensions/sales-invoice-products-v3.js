(function () {
  'use strict';

  if (window.__UBUZIMA_SALES_DOCUMENTS_V3__) {
    return;
  }

  var VERSION =
    '2026.08.sales-invoice-products-v3';

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
    redundantPaymentSummariesRemoved: 0,
    receiptRenderAttempts: 0,
    receiptReadyPrints: 0,
    blankReceiptPreventions: 0
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

    var totals =
      invoice.totals || {};

    var tenantName =
      invoice.tenant &&
      invoice.tenant.name
        ? invoice.tenant.name
        : 'Sales receipt';

    var branchName =
      invoice.branch &&
      invoice.branch.name
        ? invoice.branch.name
        : '';

    var branchAddress =
      invoice.branch &&
      invoice.branch.address
        ? invoice.branch.address
        : '';

    var branchPhone =
      invoice.branch &&
      invoice.branch.phone
        ? invoice.branch.phone
        : '';

    var customerName =
      invoice.customer &&
      invoice.customer.name
        ? invoice.customer.name
        : 'Walk-in customer';

    var cashierName =
      invoice.cashier &&
      invoice.cashier.name
        ? invoice.cashier.name
        : '';

    var itemRows =
      items.map(
        function (line) {
          var name =
            line.product_name ||
            'Unspecified product';

          return [
            '<div class="item">',
            '<div class="item-name">',
            escapeHtml(name),
            '</div>',
            '<div class="item-values">',
            '<span>',
            escapeHtml(
              quantity(line.quantity)
            ),
            ' × ',
            escapeHtml(
              formatMoney(
                line.unit_price
              )
            ),
            '</span>',
            '<strong>',
            escapeHtml(
              formatMoney(
                line.line_total
              )
            ),
            '</strong>',
            '</div>',
            '</div>'
          ].join('');
        }
      ).join('');

    var paymentRows =
      payments.map(
        function (payment) {
          return [
            '<div class="row">',
            '<span>',
            escapeHtml(
              payment.method ||
              'Payment'
            ),
            '</span>',
            '<strong>',
            escapeHtml(
              formatMoney(
                payment.amount
              )
            ),
            '</strong>',
            '</div>'
          ].join('');
        }
      ).join('');

    return [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>',
      escapeHtml(
        invoice.invoice_number ||
        'Sales receipt'
      ),
      '</title>',
      '<style>',
      '@page{size:80mm auto;margin:0;}',
      '*{box-sizing:border-box;}',
      'html,body{',
      'width:80mm;',
      'min-width:80mm;',
      'margin:0;',
      'padding:0;',
      'background:#fff;',
      'color:#000;',
      '}',
      'body{',
      'font-family:"Courier New",Courier,monospace;',
      'font-size:11px;',
      'line-height:1.35;',
      '-webkit-print-color-adjust:exact;',
      'print-color-adjust:exact;',
      '}',
      '.receipt{',
      'width:72mm;',
      'max-width:72mm;',
      'margin:0 auto;',
      'padding:4mm 0 6mm;',
      'overflow:visible;',
      '}',
      '.center{text-align:center;}',
      '.store{font-size:15px;font-weight:800;text-transform:uppercase;}',
      '.branch{font-size:11px;margin-top:2px;}',
      '.meta{font-size:10px;margin-top:2px;}',
      '.separator{',
      'border-top:1px dashed #000;',
      'margin:8px 0;',
      'height:0;',
      '}',
      '.row{',
      'display:flex;',
      'justify-content:space-between;',
      'align-items:flex-start;',
      'gap:8px;',
      'padding:2px 0;',
      '}',
      '.row span{max-width:46mm;}',
      '.row strong{text-align:right;white-space:nowrap;}',
      '.item{padding:4px 0;}',
      '.item-name{font-weight:700;overflow-wrap:anywhere;}',
      '.item-values{',
      'display:flex;',
      'justify-content:space-between;',
      'gap:8px;',
      'padding-top:2px;',
      '}',
      '.item-values strong{white-space:nowrap;}',
      '.total{font-size:14px;font-weight:900;}',
      '.reprint{',
      'display:inline-block;',
      'border:1px solid #000;',
      'padding:2px 6px;',
      'margin-top:5px;',
      'font-weight:800;',
      '}',
      '.footer{font-size:10px;margin-top:10px;}',
      '@media screen{',
      'body{margin:0 auto;}',
      '.receipt{box-shadow:none;}',
      '}',
      '@media print{',
      'html,body{',
      'width:80mm!important;',
      'min-width:80mm!important;',
      'height:auto!important;',
      'overflow:visible!important;',
      '}',
      '.receipt{',
      'width:72mm!important;',
      'max-width:72mm!important;',
      'margin:0 auto!important;',
      'padding:3mm 0 5mm!important;',
      '}',
      '}',
      '</style>',
      '</head>',
      '<body>',
      '<main class="receipt" data-ubuzima-receipt-ready="true">',
      '<header class="center">',
      '<div class="store">',
      escapeHtml(tenantName),
      '</div>',
      branchName
        ? '<div class="branch">' +
          escapeHtml(branchName) +
          '</div>'
        : '',
      branchAddress
        ? '<div class="meta">' +
          escapeHtml(branchAddress) +
          '</div>'
        : '',
      branchPhone
        ? '<div class="meta">Tel: ' +
          escapeHtml(branchPhone) +
          '</div>'
        : '',
      invoice.is_reprint
        ? '<div class="reprint">REPRINT</div>'
        : '',
      '</header>',
      '<div class="separator"></div>',
      '<div class="row">',
      '<span>Receipt</span>',
      '<strong>',
      escapeHtml(
        invoice.invoice_number ||
        ''
      ),
      '</strong>',
      '</div>',
      '<div class="row">',
      '<span>Date</span>',
      '<strong>',
      escapeHtml(
        invoice.issued_at ||
        ''
      ),
      '</strong>',
      '</div>',
      '<div class="row">',
      '<span>Customer</span>',
      '<strong>',
      escapeHtml(customerName),
      '</strong>',
      '</div>',
      cashierName
        ? [
            '<div class="row">',
            '<span>Cashier</span>',
            '<strong>',
            escapeHtml(cashierName),
            '</strong>',
            '</div>'
          ].join('')
        : '',
      '<div class="separator"></div>',
      '<div class="row">',
      '<strong>ITEM</strong>',
      '<strong>AMOUNT</strong>',
      '</div>',
      itemRows ||
        '<div class="center">No product lines</div>',
      '<div class="separator"></div>',
      '<div class="row">',
      '<span>Subtotal</span>',
      '<strong>',
      escapeHtml(
        formatMoney(
          totals.subtotal_amount
        )
      ),
      '</strong>',
      '</div>',
      numeric(totals.discount_amount) !== 0
        ? [
            '<div class="row">',
            '<span>Discount</span>',
            '<strong>-',
            escapeHtml(
              formatMoney(
                totals.discount_amount
              )
            ),
            '</strong>',
            '</div>'
          ].join('')
        : '',
      numeric(totals.tax_amount) !== 0
        ? [
            '<div class="row">',
            '<span>Tax</span>',
            '<strong>',
            escapeHtml(
              formatMoney(
                totals.tax_amount
              )
            ),
            '</strong>',
            '</div>'
          ].join('')
        : '',
      '<div class="row total">',
      '<span>TOTAL RWF</span>',
      '<strong>',
      escapeHtml(
        formatMoney(
          totals.total_amount
        )
      ),
      '</strong>',
      '</div>',
      '<div class="row">',
      '<span>Paid</span>',
      '<strong>',
      escapeHtml(
        formatMoney(
          totals.paid_amount
        )
      ),
      '</strong>',
      '</div>',
      '<div class="row">',
      '<span>Balance</span>',
      '<strong>',
      escapeHtml(
        formatMoney(
          totals.balance_amount
        )
      ),
      '</strong>',
      '</div>',
      paymentRows
        ? '<div class="separator"></div>' +
          paymentRows
        : '',
      '<div class="separator"></div>',
      '<footer class="center footer">',
      '<div>Thank you for your purchase.</div>',
      '<div>Please keep this receipt.</div>',
      '</footer>',
      '</main>',
      '</body>',
      '</html>'
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
      preopenInvoiceWindow();

    if (!target) {
      state.blockedPopups += 1;

      toast(
        'Receipt pop-up was blocked. Allow pop-ups and select Reprint again.'
      );

      return;
    }

    var expectedNumber =
      String(
        invoice.invoice_number || ''
      );

    target.document.open();
    target.document.write(
      invoiceHtml(invoice)
    );
    target.document.close();

    function receiptIsReady() {
      try {
        var marker =
          target.document.querySelector(
            '[data-ubuzima-receipt-ready="true"]'
          );

        var text =
          String(
            target.document.body
              ? target.document.body.textContent
              : ''
          )
            .replace(/\s+/g, ' ')
            .trim();

        return Boolean(
          marker &&
          text.length > 40 &&
          (
            !expectedNumber ||
            text.indexOf(
              expectedNumber
            ) !== -1
          )
        );
      } catch (error) {
        return false;
      }
    }

    function invokePrint() {
      if (!receiptIsReady()) {
        state.blankReceiptPreventions += 1;

        toast(
          'The receipt was not ready for printing. Select Reprint again.'
        );

        return;
      }

      state.receiptReadyPrints += 1;
      state.invoicePrints += 1;

      target.focus();
      target.print();
    }

    function afterPaint() {
      var frame =
        typeof target.requestAnimationFrame ===
          'function'
          ? target.requestAnimationFrame.bind(
              target
            )
          : window.requestAnimationFrame.bind(
              window
            );

      frame(function () {
        frame(function () {
          invokePrint();
        });
      });
    }

    function afterFonts() {
      try {
        if (
          target.document.fonts &&
          target.document.fonts.ready &&
          typeof target.document.fonts
            .ready.then === 'function'
        ) {
          target.document.fonts.ready
            .then(afterPaint)
            .catch(afterPaint);

          return;
        }
      } catch (error) {
        // Continue with normal paint waiting.
      }

      afterPaint();
    }

    function waitForReceipt(attempt) {
      state.receiptRenderAttempts += 1;

      if (receiptIsReady()) {
        afterFonts();
        return;
      }

      if (attempt >= 60) {
        state.blankReceiptPreventions += 1;

        toast(
          'Receipt content did not finish rendering. Select Reprint again.'
        );

        return;
      }

      var defer =
        typeof target.setTimeout ===
          'function'
          ? target.setTimeout.bind(target)
          : window.setTimeout.bind(window);

      defer(
        function () {
          waitForReceipt(
            attempt + 1
          );
        },
        50
      );
    }

    waitForReceipt(0);
  }

  function preopenInvoiceWindow() {
    var target =
      window.open(
        '',
        '_blank',
        'popup=yes,width=420,height=720'
      );

    if (target) {
      target.document.open();

      target.document.write(
        [
          '<!doctype html>',
          '<html><head>',
          '<meta charset="utf-8">',
          '<title>Preparing receipt</title>',
          '<style>',
          'body{',
          'font-family:Arial,sans-serif;',
          'padding:24px;',
          'color:#334155;',
          'text-align:center;',
          '}',
          '</style>',
          '</head><body>',
          '<p>Preparing receipt…</p>',
          '</body></html>'
        ].join('')
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

  window.__UBUZIMA_SALES_DOCUMENTS_V3__ = {
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
        receipt_render_attempts:
          state.receiptRenderAttempts,
        receipt_ready_prints:
          state.receiptReadyPrints,
        blank_receipt_preventions:
          state.blankReceiptPreventions,
        receipt_paper_width:
          '80mm',
        receipt_printable_width:
          '72mm',
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

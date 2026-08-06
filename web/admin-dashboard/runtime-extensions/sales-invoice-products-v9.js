(function () {
  'use strict';

  if (window.__UBUZIMA_SALES_DOCUMENTS_V9__) {
    return;
  }

  var VERSION =
    '2026.08.sales-invoice-products-v9';

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
    blankReceiptPreventions: 0,
    receiptModalOpens: 0,
    receiptPrintActions: 0,
    receiptWhatsAppActions: 0,
    receiptEmailActions: 0,
    cartTablesStabilized: 0,
    cartRowsStabilized: 0,
    receiptDirectRenders: 0,
    receiptDirectRenderFailures: 0,
    receiptPrintDocuments: 0,
    receiptPrintFailures: 0,
    checkoutSuppressionActivations: 0,
    blankCheckoutWindowsSuppressed: 0,
    allowedNonblankWindows: 0,
    suppressedPopupDocumentWrites: 0,
    latestCheckoutSaleId: null,
    checkoutSalesRetained: 0,
    automaticReceiptOpens: 0,
    manualReceiptSelections: 0,
    globalBlankWindowsSuppressed: 0,
    blankTargetNavigationsNeutralized: 0,
    checkoutFocusRestorations: 0,
    duplicateAdminWindowsSuppressed: 0,
    duplicateAdminTargetsPrevented: 0,
    exactCurrentPageWindowsSuppressed: 0
  };

  var originalWindowOpen =
    typeof window.open === 'function'
      ? window.open.bind(window)
      : null;

  var checkoutBlankWindowSuppressionUntil =
    0;

  function activateCheckoutBlankWindowSuppression() {
    checkoutBlankWindowSuppressionUntil =
      Date.now() + 30000;

    state.checkoutSuppressionActivations += 1;
  }

  function checkoutBlankWindowSuppressionActive() {
    return (
      Date.now() <
      checkoutBlankWindowSuppressionUntil
    );
  }

  function blankWindowRequest(value) {
    var text =
      value === null ||
      value === undefined
        ? ''
        : String(value).trim();

    return (
      text === '' ||
      text === 'about:blank' ||
      text === 'about:blank#blocked'
    );
  }

  function suppressedPopupShim() {
    var html = '';

    var body = {
      textContent: ''
    };

    var documentShim = {
      body: body,

      open: function () {
        html = '';
        body.textContent = '';
      },

      write: function (value) {
        html += String(value || '');

        body.textContent =
          html
            .replace(
              /<style[\s\S]*?<\/style>/gi,
              ' '
            )
            .replace(
              /<script[\s\S]*?<\/script>/gi,
              ' '
            )
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        state.suppressedPopupDocumentWrites +=
          1;
      },

      close: function () {},

      querySelector: function () {
        return null;
      }
    };

    return {
      closed: false,
      document: documentShim,

      focus: function () {},

      blur: function () {},

      print: function () {},

      close: function () {
        this.closed = true;
      },

      setTimeout: function (
        callback,
        delay
      ) {
        return window.setTimeout(
          callback,
          delay
        );
      },

      requestAnimationFrame:
        function (callback) {
          return window
            .requestAnimationFrame(
              callback
            );
        },

      location: {
        href: 'about:blank'
      },

      __ubuzimaSuppressedBlankPopup:
        true
    };
  }

  function normalizePathname(
    pathname
  ) {
    var value =
      String(pathname || '/')
        .replace(/\/+$/, '');

    return value || '/';
  }

  function resolveWindowUrl(value) {
    try {
      if (
        value === null ||
        value === undefined ||
        String(value).trim() === ''
      ) {
        return null;
      }

      return new URL(
        String(value),
        window.location.href
      );
    } catch (error) {
      return null;
    }
  }

  function duplicateAdminWindowRequest(
    value,
    target
  ) {
    var candidate =
      resolveWindowUrl(value);

    var current =
      resolveWindowUrl(
        window.location.href
      );

    if (
      !candidate ||
      !current
    ) {
      return false;
    }

    var targetName =
      String(
        target || '_blank'
      ).toLowerCase();

    if (
      targetName !== '_blank'
    ) {
      return false;
    }

    var currentPath =
      normalizePathname(
        current.pathname
      );

    var candidatePath =
      normalizePathname(
        candidate.pathname
      );

    var sameAdminRoute =
      candidate.origin ===
        current.origin &&
      candidatePath ===
        currentPath &&
      currentPath === '/admin';

    if (!sameAdminRoute) {
      return false;
    }

    var exactCurrentPage =
      candidate.href ===
        current.href;

    return (
      exactCurrentPage ||
      checkoutBlankWindowSuppressionActive()
    );
  }

  window.open = function (
    url,
    target,
    features
  ) {
    if (blankWindowRequest(url)) {
      state.blankCheckoutWindowsSuppressed +=
        1;

      state.globalBlankWindowsSuppressed +=
        1;

      return suppressedPopupShim();
    }

    if (
      duplicateAdminWindowRequest(
        url,
        target
      )
    ) {
      state.duplicateAdminWindowsSuppressed +=
        1;

      try {
        var candidate =
          resolveWindowUrl(url);

        if (
          candidate &&
          candidate.href ===
            window.location.href
        ) {
          state.exactCurrentPageWindowsSuppressed +=
            1;
        }
      } catch (error) {
        // Suppression remains active.
      }

      return suppressedPopupShim();
    }

    state.allowedNonblankWindows += 1;

    if (!originalWindowOpen) {
      return null;
    }

    return originalWindowOpen(
      url,
      target,
      features
    );
  };

  function blankNavigationRequest(
    value
  ) {
    var text =
      value === null ||
      value === undefined
        ? ''
        : String(value).trim();

    return (
      blankWindowRequest(text) ||
      text === '#' ||
      /^javascript:\s*(void\s*\(\s*0\s*\)|;?)$/i
        .test(text)
    );
  }

  function neutralizeBlankTarget(
    element
  ) {
    if (
      !element ||
      typeof element.getAttribute !==
        'function'
    ) {
      return false;
    }

    var target =
      String(
        element.getAttribute(
          'target'
        ) || ''
      ).toLowerCase();

    if (target !== '_blank') {
      return false;
    }

    var destination =
      element.getAttribute(
        'href'
      );

    if (
      destination === null
    ) {
      destination =
        element.getAttribute(
          'action'
        );
    }

    var blankDestination =
      blankNavigationRequest(
        destination
      );

    var duplicateAdminDestination =
      duplicateAdminWindowRequest(
        destination,
        target
      );

    if (
      !blankDestination &&
      !duplicateAdminDestination
    ) {
      return false;
    }

    if (duplicateAdminDestination) {
      state.duplicateAdminTargetsPrevented +=
        1;
    }

    element.setAttribute(
      'target',
      '_self'
    );

    state.blankTargetNavigationsNeutralized +=
      1;

    return true;
  }

  document.addEventListener(
    'click',
    function (event) {
      var target =
        event.target instanceof Element
          ? event.target
          : null;

      if (
        target &&
        typeof target.closest ===
          'function'
      ) {
        var duplicateTarget =
          target.closest(
            'a[target="_blank"],button[formtarget="_blank"]'
          );

        if (
          neutralizeBlankTarget(
            duplicateTarget
          )
        ) {
          event.preventDefault();
        }
      }
    },
    true
  );

  document.addEventListener(
    'submit',
    function (event) {
      var form =
        event.target instanceof Element
          ? event.target
          : null;

      if (
        neutralizeBlankTarget(form)
      ) {
        event.preventDefault();
      }
    },
    true
  );

  function triggerText(element) {
    if (!element) {
      return '';
    }

    return String(
      element.textContent ||
      element.value ||
      element.getAttribute(
        'aria-label'
      ) ||
      element.getAttribute(
        'title'
      ) ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function paymentConfirmationTrigger(element) {
    if (
      !element ||
      typeof element.closest !==
        'function'
    ) {
      return false;
    }

    var control =
      element.closest(
        'button,[role="button"],input[type="submit"],a'
      );

    if (!control) {
      return false;
    }

    var controlText =
      triggerText(control);

    var actionMatch =
      /confirm|complete|finish|checkout|finali[sz]e|process|pay|payment|sale/
        .test(controlText);

    if (!actionMatch) {
      return false;
    }

    var scope =
      control.closest(
        '[role="dialog"],form,section,main'
      );

    var scopeText =
      triggerText(
        scope || document.body
      );

    return (
      /payment|checkout|sale|cart|customer|cash|amount|balance|transaction/
        .test(scopeText)
    );
  }

  function explicitPrintReceiptTrigger(
    element
  ) {
    if (
      !element ||
      typeof element.closest !==
        'function'
    ) {
      return false;
    }

    var control =
      element.closest(
        'button,[role="button"],a,input[type="button"],input[type="submit"]'
      );

    if (!control) {
      return false;
    }

    if (
      control.closest(
        '[data-ubuzima-receipt-modal]'
      )
    ) {
      return false;
    }

    if (
      control.hasAttribute(
        'data-ubuzima-reprint-sale-id'
      )
    ) {
      return false;
    }

    var text =
      triggerText(control);

    return (
      /\bprint\s+(receipt|invoice)\b/i
        .test(text) ||
      /\b(receipt|invoice)\s+print\b/i
        .test(text) ||
      /\bview\s+(receipt|invoice)\b/i
        .test(text) ||
      /\bopen\s+(receipt|invoice)\b/i
        .test(text)
    );
  }

  document.addEventListener(
    'click',
    function (event) {
      var target =
        event.target instanceof Element
          ? event.target
          : null;

      if (
        paymentConfirmationTrigger(target)
      ) {
        activateCheckoutBlankWindowSuppression();
      }

      if (
        explicitPrintReceiptTrigger(
          target
        ) &&
        state.latestCheckoutSaleId
      ) {
        event.preventDefault();
        event.stopPropagation();

        if (
          typeof event
            .stopImmediatePropagation ===
            'function'
        ) {
          event.stopImmediatePropagation();
        }

        state.manualReceiptSelections +=
          1;

        printSaleInvoice(
          state.latestCheckoutSaleId,
          false,
          null
        ).catch(
          function () {
            toast(
              'The receipt could not be opened. Please try again.'
            );
          }
        );
      }
    },
    true
  );

  document.addEventListener(
    'submit',
    function (event) {
      var form =
        event.target instanceof Element
          ? event.target
          : null;

      var formText =
        triggerText(form);

      if (
        /payment|checkout|sale|cart|cash|amount|balance|transaction/
          .test(formText)
      ) {
        activateCheckoutBlankWindowSuppression();
      }
    },
    true
  );

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
      stabilizeCartProductColumns();
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

  function receiptShareText(invoice) {
    var totals =
      invoice.totals || {};

    var lines = [];

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

    lines.push(tenantName);

    if (branchName) {
      lines.push(branchName);
    }

    lines.push(
      'Receipt: ' +
      String(
        invoice.invoice_number || ''
      )
    );

    if (invoice.issued_at) {
      lines.push(
        'Date: ' +
        String(invoice.issued_at)
      );
    }

    lines.push('');
    lines.push('Items:');

    var items =
      Array.isArray(invoice.items)
        ? invoice.items
        : [];

    items.forEach(
      function (item) {
        lines.push(
          '- ' +
          String(
            item.product_name ||
            'Unspecified product'
          ) +
          ' × ' +
          quantity(item.quantity) +
          ' = RWF ' +
          formatMoney(
            item.line_total
          )
        );
      }
    );

    lines.push('');
    lines.push(
      'Total: RWF ' +
      formatMoney(
        totals.total_amount
      )
    );

    lines.push(
      'Paid: RWF ' +
      formatMoney(
        totals.paid_amount
      )
    );

    lines.push(
      'Balance: RWF ' +
      formatMoney(
        totals.balance_amount
      )
    );

    lines.push('');
    lines.push(
      'Thank you for your purchase.'
    );

    return lines.join('\n');
  }

  function closeReceiptModal() {
    var current =
      document.getElementById(
        'ubuzima-receipt-modal-v4'
      );

    if (current) {
      current.remove();
    }
  }

  function receiptActionButton(
    label,
    action,
    background,
    color
  ) {
    var button =
      document.createElement(
        'button'
      );

    button.type = 'button';
    button.textContent = label;

    button.setAttribute(
      'data-ubuzima-receipt-action',
      action
    );

    button.style.cssText = [
      'border:0',
      'border-radius:9px',
      'padding:10px 12px',
      'min-height:42px',
      'font:inherit',
      'font-size:13px',
      'font-weight:800',
      'cursor:pointer',
      'background:' + background,
      'color:' + color,
      'white-space:nowrap'
    ].join(';');

    return button;
  }

  function receiptDocumentParts(invoice) {
    var parser =
      new DOMParser();

    var parsed =
      parser.parseFromString(
        invoiceHtml(invoice),
        'text/html'
      );

    var receipt =
      parsed.querySelector(
        '[data-ubuzima-receipt-ready="true"]'
      );

    var style =
      parsed.querySelector('style');

    var text =
      receipt
        ? String(
            receipt.textContent || ''
          )
            .replace(/\s+/g, ' ')
            .trim()
        : '';

    return {
      receipt: receipt,
      styleText:
        style
          ? style.textContent || ''
          : '',
      text: text
    };
  }

  function renderReceiptDirectly(
    invoice,
    host
  ) {
    var parts =
      receiptDocumentParts(invoice);

    if (
      !parts.receipt ||
      parts.text.length < 40
    ) {
      state.receiptDirectRenderFailures +=
        1;

      return false;
    }

    var receiptMarkup =
      parts.receipt.outerHTML;

    if (
      typeof host.attachShadow ===
        'function'
    ) {
      var shadow =
        host.attachShadow({
          mode: 'open'
        });

      shadow.innerHTML = [
        '<style>',
        ':host{',
        'display:block;',
        'width:80mm;',
        'max-width:100%;',
        'margin:0 auto;',
        'background:#fff;',
        'color:#000;',
        'font-family:"Courier New",Courier,monospace;',
        '}',
        parts.styleText,
        '</style>',
        receiptMarkup
      ].join('');
    } else {
      host.innerHTML = [
        '<style>',
        '[data-ubuzima-receipt-preview="direct-v5"]{',
        'font-family:"Courier New",Courier,monospace;',
        'background:#fff;',
        'color:#000;',
        '}',
        parts.styleText,
        '</style>',
        receiptMarkup
      ].join('');
    }

    var visibleText =
      host.shadowRoot
        ? String(
            host.shadowRoot.textContent ||
            ''
          )
        : String(
            host.textContent || ''
          );

    visibleText =
      visibleText
        .replace(/\s+/g, ' ')
        .trim();

    if (
      visibleText.length < 40 ||
      (
        invoice.invoice_number &&
        visibleText.indexOf(
          String(
            invoice.invoice_number
          )
        ) === -1
      )
    ) {
      state.receiptDirectRenderFailures +=
        1;

      return false;
    }

    state.receiptDirectRenders += 1;

    return true;
  }

  function printReceiptDocument(invoice) {
    var iframe =
      document.createElement('iframe');

    iframe.setAttribute(
      'data-ubuzima-receipt-print-frame',
      'v5'
    );

    iframe.setAttribute(
      'aria-hidden',
      'true'
    );

    iframe.style.cssText = [
      'position:fixed',
      'left:-10000px',
      'top:0',
      'width:80mm',
      'height:1px',
      'border:0',
      'opacity:0',
      'pointer-events:none'
    ].join(';');

    document.body.appendChild(iframe);

    var frameWindow =
      iframe.contentWindow;

    var frameDocument =
      iframe.contentDocument ||
      (
        frameWindow &&
        frameWindow.document
      );

    if (
      !frameWindow ||
      !frameDocument
    ) {
      iframe.remove();

      state.receiptPrintFailures += 1;
      state.blankReceiptPreventions += 1;

      toast(
        'The receipt print document could not be created.'
      );

      return;
    }

    frameDocument.open();

    frameDocument.write(
      invoiceHtml(invoice)
    );

    frameDocument.close();

    state.receiptPrintDocuments += 1;

    var attempts = 0;
    var maximumAttempts = 100;

    function cleanupFrame() {
      window.setTimeout(
        function () {
          if (iframe.parentNode) {
            iframe.remove();
          }
        },
        1500
      );
    }

    function receiptIsReady() {
      try {
        var marker =
          frameDocument.querySelector(
            '[data-ubuzima-receipt-ready="true"]'
          );

        var text =
          String(
            frameDocument.body
              ? frameDocument.body.textContent
              : ''
          )
            .replace(/\s+/g, ' ')
            .trim();

        return Boolean(
          marker &&
          text.length >= 40 &&
          (
            !invoice.invoice_number ||
            text.indexOf(
              String(
                invoice.invoice_number
              )
            ) !== -1
          )
        );
      } catch (error) {
        return false;
      }
    }

    function printAfterPaint() {
      var frame =
        typeof frameWindow
          .requestAnimationFrame ===
          'function'
          ? frameWindow
              .requestAnimationFrame
              .bind(frameWindow)
          : window
              .requestAnimationFrame
              .bind(window);

      frame(function () {
        frame(function () {
          if (!receiptIsReady()) {
            state.receiptPrintFailures +=
              1;

            state.blankReceiptPreventions +=
              1;

            toast(
              'Receipt content was not ready for printing.'
            );

            cleanupFrame();
            return;
          }

          state.receiptReadyPrints += 1;
          state.receiptPrintActions += 1;
          state.invoicePrints += 1;

          frameWindow.focus();
          frameWindow.print();

          cleanupFrame();
        });
      });
    }

    function afterFonts() {
      try {
        if (
          frameDocument.fonts &&
          frameDocument.fonts.ready &&
          typeof frameDocument.fonts
            .ready.then === 'function'
        ) {
          frameDocument.fonts.ready
            .then(printAfterPaint)
            .catch(printAfterPaint);

          return;
        }
      } catch (error) {
        // Continue with paint verification.
      }

      printAfterPaint();
    }

    function waitUntilReady() {
      attempts += 1;
      state.receiptRenderAttempts += 1;

      if (receiptIsReady()) {
        afterFonts();
        return;
      }

      if (
        attempts >= maximumAttempts
      ) {
        state.receiptPrintFailures += 1;
        state.blankReceiptPreventions += 1;

        toast(
          'Receipt content did not finish loading for printing.'
        );

        cleanupFrame();
        return;
      }

      window.setTimeout(
        waitUntilReady,
        40
      );
    }

    waitUntilReady();
  }

  function renderInvoice(invoice) {
    closeReceiptModal();

    var overlay =
      document.createElement('div');

    overlay.id =
      'ubuzima-receipt-modal-v5';

    overlay.setAttribute(
      'data-ubuzima-receipt-modal',
      '80mm-v5'
    );

    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483600',
      'background:rgba(15,23,42,.64)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:10px',
      'overflow:auto'
    ].join(';');

    var panel =
      document.createElement('section');

    panel.setAttribute(
      'role',
      'dialog'
    );

    panel.setAttribute(
      'aria-modal',
      'true'
    );

    panel.setAttribute(
      'aria-label',
      'Receipt preview'
    );

    panel.style.cssText = [
      'width:min(380px,calc(100vw - 20px))',
      'max-height:calc(100vh - 20px)',
      'display:flex',
      'flex-direction:column',
      'overflow:hidden',
      'background:#f8fafc',
      'border-radius:18px',
      'box-shadow:0 30px 90px rgba(15,23,42,.4)'
    ].join(';');

    var header =
      document.createElement('header');

    header.style.cssText = [
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:12px',
      'padding:13px 14px',
      'background:#ffffff',
      'border-bottom:1px solid #e2e8f0'
    ].join(';');

    var heading =
      document.createElement('div');

    heading.innerHTML = [
      '<strong style="display:block;font-size:15px;color:#0f172a">',
      'Receipt preview',
      '</strong>',
      '<span style="display:block;margin-top:2px;font-size:11px;color:#64748b">',
      '80 mm thermal receipt',
      '</span>'
    ].join('');

    var closeTop =
      receiptActionButton(
        'Close',
        'close',
        '#e2e8f0',
        '#0f172a'
      );

    closeTop.style.padding =
      '7px 10px';

    closeTop.style.minHeight =
      '34px';

    header.appendChild(heading);
    header.appendChild(closeTop);

    var previewArea =
      document.createElement('div');

    previewArea.style.cssText = [
      'display:flex',
      'justify-content:center',
      'align-items:flex-start',
      'padding:12px',
      'overflow:auto',
      'background:#cbd5e1',
      'min-height:300px',
      'max-height:calc(100vh - 170px)'
    ].join(';');

    var receiptHost =
      document.createElement('div');

    receiptHost.setAttribute(
      'data-ubuzima-receipt-preview',
      'direct-v5'
    );

    receiptHost.style.cssText = [
      'display:block',
      'width:80mm',
      'max-width:100%',
      'min-height:120px',
      'background:#ffffff',
      'box-shadow:0 7px 24px rgba(15,23,42,.2)'
    ].join(';');

    var rendered =
      renderReceiptDirectly(
        invoice,
        receiptHost
      );

    var footer =
      document.createElement('footer');

    footer.style.cssText = [
      'display:grid',
      'grid-template-columns:repeat(3,minmax(0,1fr))',
      'gap:8px',
      'padding:12px',
      'background:#ffffff',
      'border-top:1px solid #e2e8f0'
    ].join(';');

    var printButton =
      receiptActionButton(
        'Print',
        'print',
        '#0f766e',
        '#ffffff'
      );

    var whatsappButton =
      receiptActionButton(
        'WhatsApp',
        'whatsapp',
        '#16a34a',
        '#ffffff'
      );

    var emailButton =
      receiptActionButton(
        'Email',
        'email',
        '#2563eb',
        '#ffffff'
      );

    printButton.disabled =
      !rendered;

    printButton.style.opacity =
      rendered ? '1' : '.55';

    printButton.style.cursor =
      rendered
        ? 'pointer'
        : 'not-allowed';

    footer.appendChild(printButton);
    footer.appendChild(
      whatsappButton
    );
    footer.appendChild(emailButton);

    if (rendered) {
      previewArea.appendChild(
        receiptHost
      );
    } else {
      var errorMessage =
        document.createElement('div');

      errorMessage.style.cssText = [
        'width:100%',
        'padding:22px',
        'background:#fff',
        'border-radius:10px',
        'color:#991b1b',
        'font-size:13px',
        'text-align:center'
      ].join(';');

      errorMessage.textContent =
        'The receipt content could not be displayed.';

      previewArea.appendChild(
        errorMessage
      );
    }

    panel.appendChild(header);
    panel.appendChild(previewArea);
    panel.appendChild(footer);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    state.receiptModalOpens += 1;

    overlay.addEventListener(
      'click',
      function (event) {
        var target =
          event.target instanceof Element
            ? event.target
            : null;

        if (!target) {
          return;
        }

        if (
          target === overlay ||
          target.closest(
            '[data-ubuzima-receipt-action="close"]'
          )
        ) {
          closeReceiptModal();
          return;
        }

        if (
          target.closest(
            '[data-ubuzima-receipt-action="print"]'
          )
        ) {
          if (!rendered) {
            state.blankReceiptPreventions +=
              1;

            toast(
              'The receipt content is unavailable for printing.'
            );

            return;
          }

          printReceiptDocument(
            invoice
          );

          return;
        }

        if (
          target.closest(
            '[data-ubuzima-receipt-action="whatsapp"]'
          )
        ) {
          state.receiptWhatsAppActions +=
            1;

          window.open(
            'https://wa.me/?text=' +
            encodeURIComponent(
              receiptShareText(invoice)
            ),
            '_blank',
            'noopener,noreferrer'
          );

          return;
        }

        if (
          target.closest(
            '[data-ubuzima-receipt-action="email"]'
          )
        ) {
          state.receiptEmailActions +=
            1;

          var subject =
            'Receipt ' +
            String(
              invoice.invoice_number ||
              ''
            );

          window.location.href =
            'mailto:?subject=' +
            encodeURIComponent(subject) +
            '&body=' +
            encodeURIComponent(
              receiptShareText(invoice)
            );
        }
      }
    );

    document.addEventListener(
      'keydown',
      function closeOnEscape(event) {
        if (
          event.key !== 'Escape'
        ) {
          return;
        }

        document.removeEventListener(
          'keydown',
          closeOnEscape
        );

        closeReceiptModal();
      }
    );
  }

  function preopenInvoiceWindow() {
    return null;
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
      !document.body
    ) {
      return 0;
    }

    var removed = 0;

    function matchesSummary(value) {
      var text =
        String(value || '')
          .replace(/\u00a0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      if (
        !text ||
        text.length > 700
      ) {
        return false;
      }

      return (
        /\badded\s*:/i.test(text) &&
        /selling\s+amount\s*:/i.test(text) &&
        /RWF\s*[\d,.]+/i.test(text)
      );
    }

    if (
      typeof document.createTreeWalker ===
        'function' &&
      typeof NodeFilter !== 'undefined'
    ) {
      var walker =
        document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT
        );

      var nodes = [];
      var current;

      while (
        (
          current =
            walker.nextNode()
        )
      ) {
        nodes.push(current);
      }

      nodes.forEach(
        function (node) {
          if (
            !node ||
            !matchesSummary(
              node.nodeValue
            )
          ) {
            return;
          }

          var parent =
            node.parentElement;

          node.nodeValue = '';

          if (
            parent &&
            String(
              parent.textContent || ''
            ).trim() === '' &&
            parent.childElementCount === 0 &&
            typeof parent.remove ===
              'function'
          ) {
            parent.remove();
          }

          removed += 1;
        }
      );
    }

    if (
      typeof document.querySelectorAll ===
        'function'
    ) {
      var elements =
        document.querySelectorAll(
          'p,div,span,small,li,[role="status"],[aria-live]'
        );

      Array.prototype.forEach.call(
        elements,
        function (element) {
          if (
            !element ||
            !matchesSummary(
              element.textContent
            )
          ) {
            return;
          }

          if (
            element.childElementCount <= 3 &&
            typeof element.remove ===
              'function'
          ) {
            element.remove();
          } else {
            var childNodes =
              Array.prototype.slice.call(
                element.childNodes || []
              );

            childNodes.forEach(
              function (node) {
                if (
                  node &&
                  node.nodeType === 3
                ) {
                  node.nodeValue = '';
                }
              }
            );

            if (element.style) {
              element.style.display =
                'none';
            }
          }

          removed += 1;
        }
      );
    }

    state.redundantPaymentSummariesRemoved +=
      removed;

    return removed;
  }

  function headerText(cell) {
    return String(
      cell &&
      cell.textContent
        ? cell.textContent
        : ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function cartTableColumns(table) {
    var headers =
      Array.prototype.slice.call(
        table.querySelectorAll(
          'thead th'
        )
      );

    if (!headers.length) {
      return null;
    }

    var labels =
      headers.map(headerText);

    var productIndex =
      labels.findIndex(
        function (label) {
          return (
            label === 'product' ||
            label === 'products' ||
            label.indexOf('product') !== -1 ||
            label.indexOf('medicine') !== -1 ||
            label === 'item'
          );
        }
      );

    var quantityIndex =
      labels.findIndex(
        function (label) {
          return (
            label === 'qty' ||
            label.indexOf('quantity') !== -1
          );
        }
      );

    var priceIndex =
      labels.findIndex(
        function (label) {
          return (
            label.indexOf('unit price') !== -1 ||
            label === 'price'
          );
        }
      );

    var totalIndex =
      labels.findIndex(
        function (label) {
          return (
            label === 'total' ||
            label.indexOf('amount') !== -1
          );
        }
      );

    var actionIndex =
      labels.findIndex(
        function (label) {
          return (
            label.indexOf('action') !== -1 ||
            label === ''
          );
        }
      );

    if (
      productIndex < 0 ||
      quantityIndex < 0 ||
      (
        priceIndex < 0 &&
        totalIndex < 0
      )
    ) {
      return null;
    }

    return {
      headers: headers,
      product: productIndex,
      quantity: quantityIndex,
      price: priceIndex,
      total: totalIndex,
      action: actionIndex
    };
  }

  function applyColumnWidth(
    rows,
    index,
    width,
    productColumn
  ) {
    if (index < 0) {
      return;
    }

    rows.forEach(
      function (row) {
        var cell =
          row.children &&
          row.children[index]
            ? row.children[index]
            : null;

        if (!cell || !cell.style) {
          return;
        }

        cell.style.width = width;
        cell.style.maxWidth = width;
        cell.style.minWidth = '0';

        if (productColumn) {
          cell.style.whiteSpace =
            'normal';

          cell.style.overflowWrap =
            'anywhere';

          cell.style.wordBreak =
            'break-word';

          cell.style.overflow =
            'hidden';

          cell.style.textOverflow =
            'ellipsis';
        } else {
          cell.style.whiteSpace =
            'nowrap';

          cell.style.overflow =
            'hidden';

          cell.style.textOverflow =
            'ellipsis';
        }
      }
    );
  }

  function stabilizeCartProductColumns() {
    if (
      typeof document === 'undefined' ||
      typeof document.querySelectorAll !==
        'function'
    ) {
      return 0;
    }

    var stabilized = 0;

    var tables =
      document.querySelectorAll(
        'table'
      );

    Array.prototype.forEach.call(
      tables,
      function (table) {
        if (
          !table ||
          !table.style
        ) {
          return;
        }

        var columns =
          cartTableColumns(table);

        if (!columns) {
          return;
        }

        table.style.width = '100%';
        table.style.maxWidth = '100%';
        table.style.tableLayout =
          'fixed';

        table.setAttribute(
          'data-ubuzima-cart-columns',
          'stable-v4'
        );

        var rows =
          Array.prototype.slice.call(
            table.querySelectorAll(
              'tr'
            )
          );

        applyColumnWidth(
          rows,
          columns.product,
          '36%',
          true
        );

        applyColumnWidth(
          rows,
          columns.quantity,
          '78px',
          false
        );

        applyColumnWidth(
          rows,
          columns.price,
          '104px',
          false
        );

        applyColumnWidth(
          rows,
          columns.total,
          '104px',
          false
        );

        applyColumnWidth(
          rows,
          columns.action,
          '62px',
          false
        );

        state.cartRowsStabilized +=
          Math.max(
            0,
            rows.length - 1
          );

        stabilized += 1;
      }
    );

    state.cartTablesStabilized +=
      stabilized;

    return stabilized;
  }

  function scheduleInterfaceCleanup() {
    var frame = 0;
    var maximumFrames = 120;

    function cleanFrame() {
      removeRedundantPaymentSummaryText();
      stabilizeCartProductColumns();

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

  function schedulePaymentSummaryCleanup() {
    scheduleInterfaceCleanup();
  }

  function scheduleCartColumnStability() {
    scheduleInterfaceCleanup();
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

    if (checkout) {
      activateCheckoutBlankWindowSuppression();
    }

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

    var printWindow = null;

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
            return;
          }

          state.checkoutResponsesCaptured += 1;

          var completedSaleId =
            checkoutSaleId(payload);

          if (
            completedSaleId !== null &&
            completedSaleId !== undefined &&
            completedSaleId !== ''
          ) {
            state.latestCheckoutSaleId =
              Number(completedSaleId);

            state.checkoutSalesRetained +=
              1;
          }

          scheduleInterfaceCleanup();

          try {
            window.focus();

            state.checkoutFocusRestorations +=
              1;
          } catch (error) {
            // Remaining on the POS page does not
            // depend on browser focus support.
          }
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
      scheduleCartColumnStability();

      var reprintButton =
        target.closest(
          '[data-ubuzima-reprint-sale-id]'
        );

      if (reprintButton) {
        event.preventDefault();

        printSaleInvoice(
          Number(
            reprintButton.getAttribute(
              'data-ubuzima-reprint-sale-id'
            )
          ),
          true,
          null
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

  window.__UBUZIMA_SALES_DOCUMENTS_V9__ = {
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
        receipt_modal_opens:
          state.receiptModalOpens,
        receipt_print_actions:
          state.receiptPrintActions,
        receipt_whatsapp_actions:
          state.receiptWhatsAppActions,
        receipt_email_actions:
          state.receiptEmailActions,
        cart_tables_stabilized:
          state.cartTablesStabilized,
        cart_rows_stabilized:
          state.cartRowsStabilized,
        receipt_direct_renders:
          state.receiptDirectRenders,
        receipt_direct_render_failures:
          state.receiptDirectRenderFailures,
        receipt_print_documents:
          state.receiptPrintDocuments,
        receipt_print_failures:
          state.receiptPrintFailures,
        receipt_preview_mode:
          'direct-shadow-dom',
        receipt_print_mode:
          'verified-hidden-document',
        checkout_blank_window_suppression:
          'capture-and-fetch-v6',
        checkout_suppression_activations:
          state.checkoutSuppressionActivations,
        blank_checkout_windows_suppressed:
          state.blankCheckoutWindowsSuppressed,
        allowed_nonblank_windows:
          state.allowedNonblankWindows,
        suppressed_popup_document_writes:
          state.suppressedPopupDocumentWrites,
        latest_checkout_sale_id:
          state.latestCheckoutSaleId,
        checkout_sales_retained:
          state.checkoutSalesRetained,
        automatic_receipt_opens:
          state.automaticReceiptOpens,
        manual_receipt_selections:
          state.manualReceiptSelections,
        receipt_open_policy:
          'manual-print-receipt-only',
        blank_window_policy:
          'globally-block-empty-and-about-blank',
        global_blank_windows_suppressed:
          state.globalBlankWindowsSuppressed,
        blank_target_navigations_neutralized:
          state.blankTargetNavigationsNeutralized,
        checkout_focus_restorations:
          state.checkoutFocusRestorations,
        duplicate_admin_window_policy:
          'block-same-origin-admin-during-checkout',
        duplicate_admin_windows_suppressed:
          state.duplicateAdminWindowsSuppressed,
        duplicate_admin_targets_prevented:
          state.duplicateAdminTargetsPrevented,
        exact_current_page_windows_suppressed:
          state.exactCurrentPageWindowsSuppressed,
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
    stabilizeCartColumns:
      stabilizeCartProductColumns,
    previewReceipt:
      renderInvoice,
    receiptShareText:
      receiptShareText,
    suppressBlankCheckoutWindows:
      activateCheckoutBlankWindowSuppression,
    openLatestReceipt:
      function () {
        if (!state.latestCheckoutSaleId) {
          toast(
            'No completed transaction is available for receipt printing.'
          );

          return Promise.resolve(null);
        }

        state.manualReceiptSelections +=
          1;

        return printSaleInvoice(
          state.latestCheckoutSaleId,
          false,
          null
        );
      },

    reprint: function (id) {
      return printSaleInvoice(
        Number(id),
        true,
        null
      );
    }
  };

  scheduleInterfaceCleanup();

  console.info(
    '[UbuzimaPlus] Sales invoice and product-line extension loaded.',
    VERSION
  );
}());

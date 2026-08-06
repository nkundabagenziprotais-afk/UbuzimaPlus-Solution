(function () {
  'use strict';

  var VERSION =
    '2026.08.pos-receipt-recent-ui-v11b';

  if (
    window.__UBUZIMA_POS_RECEIPT_RECENT_UI_V11B__
  ) {
    return;
  }

  var nativeFetch =
    typeof window.fetch === 'function'
      ? window.fetch.bind(window)
      : null;

  var state = {
    headers: new Headers({
      Accept: 'application/json'
    }),

    sales: [],
    invoiceCache: new Map(),
    latestSaleId: null,

    refreshRunning: false,
    refreshAttempts: 0,
    refreshSuccesses: 0,

    recentRowsRendered: 0,
    verboseNoticesRemoved: 0,
    receiptLoads: 0,
    receiptFailures: 0,
    receiptOpen: false
  };

  function clean(value) {
    return String(
      value === null ||
      value === undefined
        ? ''
        : value
    ).trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function amount(value) {
    var parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function escapeHtml(value) {
    return clean(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function money(value) {
    return (
      'RWF ' +
      amount(value).toLocaleString(
        'en-RW',
        {
          maximumFractionDigits: 2
        }
      )
    );
  }

  function dateLabel(value) {
    if (!value) {
      return 'Not recorded';
    }

    var parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return clean(value);
    }

    return parsed.toLocaleString(
      'en-GB',
      {
        dateStyle: 'medium',
        timeStyle: 'short'
      }
    );
  }

  function resolveUrl(input) {
    try {
      if (typeof input === 'string') {
        return new URL(
          input,
          window.location.href
        );
      }

      if (
        input &&
        typeof input.url === 'string'
      ) {
        return new URL(
          input.url,
          window.location.href
        );
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  function captureHeaders(
    input,
    init
  ) {
    try {
      var incoming = new Headers();

      if (
        typeof Request !== 'undefined' &&
        input instanceof Request
      ) {
        input.headers.forEach(
          function (value, key) {
            incoming.set(key, value);
          }
        );
      }

      if (init && init.headers) {
        new Headers(
          init.headers
        ).forEach(
          function (value, key) {
            incoming.set(key, value);
          }
        );
      }

      [
        'Authorization',
        'X-Tenant',
        'X-Tenant-Slug',
        'X-Branch-Id',
        'X-POS-Session-Id'
      ].forEach(function (name) {
        if (incoming.has(name)) {
          state.headers.set(
            name,
            incoming.get(name)
          );
        }
      });
    } catch (error) {
      // Existing application requests remain untouched.
    }
  }

  function extractSaleId(payload) {
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

      payload && payload.id,

      payload &&
        payload.payment &&
        payload.payment.pharmaco_sale_id,

      payload &&
        payload.data &&
        payload.data.payment &&
        payload.data.payment.pharmaco_sale_id
    ];

    for (
      var index = 0;
      index < candidates.length;
      index += 1
    ) {
      var candidate =
        Number(candidates[index]);

      if (
        Number.isInteger(candidate) &&
        candidate > 0
      ) {
        return candidate;
      }
    }

    return null;
  }

  if (nativeFetch) {
    window.fetch = function (
      input,
      init
    ) {
      var requestUrl =
        resolveUrl(input);

      captureHeaders(
        input,
        init
      );

      return nativeFetch(
        input,
        init
      ).then(function (response) {
        if (
          !requestUrl ||
          requestUrl.origin !==
            window.location.origin
        ) {
          return response;
        }

        var method = clean(
          (
            init &&
            init.method
          ) ||
          (
            typeof Request !== 'undefined' &&
            input instanceof Request
              ? input.method
              : 'GET'
          )
        ).toUpperCase();

        var transactionResponse =
          method === 'POST' &&
          (
            requestUrl.pathname ===
              '/api/v1/pharmaco/sales' ||

            requestUrl.pathname ===
              '/api/v1/pharmaco/sales/checkout' ||

            /\/api\/v1\/pharmaco\/sales\/\d+\/confirm$/
              .test(requestUrl.pathname) ||

            /\/api\/v1\/pharmaco\/sales\/\d+\/payments$/
              .test(requestUrl.pathname)
          );

        if (
          transactionResponse &&
          response.ok
        ) {
          response
            .clone()
            .json()
            .then(function (payload) {
              var id =
                extractSaleId(payload);

              if (id) {
                state.latestSaleId = id;
              }

              window.setTimeout(
                refreshRecentSales,
                300
              );

              window.setTimeout(
                refreshRecentSales,
                1400
              );
            })
            .catch(function () {
              window.setTimeout(
                refreshRecentSales,
                600
              );
            });
        }

        return response;
      });
    };
  }

  function apiGet(path) {
    if (!nativeFetch) {
      return Promise.reject(
        new Error(
          'Browser fetch is unavailable.'
        )
      );
    }

    var headers =
      new Headers(state.headers);

    headers.set(
      'Accept',
      'application/json'
    );

    return nativeFetch(
      path,
      {
        method: 'GET',
        headers: headers,
        credentials: 'same-origin',
        cache: 'no-store'
      }
    ).then(function (response) {
      if (!response.ok) {
        throw new Error(
          'Request failed with status ' +
          response.status +
          '.'
        );
      }

      return response.json();
    });
  }

  function firstArray(candidates) {
    for (
      var index = 0;
      index < candidates.length;
      index += 1
    ) {
      if (
        Array.isArray(
          candidates[index]
        )
      ) {
        return candidates[index];
      }
    }

    return [];
  }

  function normalizeSales(payload) {
    return firstArray([
      payload &&
        payload.data &&
        payload.data.data,

      payload &&
        payload.sales &&
        payload.sales.data,

      payload &&
        payload.data &&
        payload.data.sales,

      payload && payload.sales,
      payload && payload.data,
      payload
    ]);
  }

  function normalizeInvoice(payload) {
    return (
      (
        payload &&
        payload.invoice
      ) ||

      (
        payload &&
        payload.data &&
        payload.data.invoice
      ) ||

      (
        payload &&
        payload.data
      ) ||

      payload ||

      {}
    );
  }

  function saleId(sale) {
    return Number(
      sale &&
      (
        sale.id ||
        sale.sale_id
      )
    ) || 0;
  }

  function saleNumber(sale) {
    return clean(
      sale &&
      (
        sale.sale_number ||
        sale.invoice_number ||
        sale.sale_reference ||
        sale.reference
      )
    ) || 'Unnumbered sale';
  }

  function saleLines(sale) {
    var cachedInvoice =
      sale &&
      sale._aquilaInvoice;

    return firstArray([
      sale && sale.product_lines,
      sale && sale.items,
      sale && sale.lines,

      cachedInvoice &&
        cachedInvoice.product_lines,

      cachedInvoice &&
        cachedInvoice.items,

      cachedInvoice &&
        cachedInvoice.lines
    ]);
  }

  function invoiceLines(invoice) {
    return firstArray([
      invoice && invoice.product_lines,
      invoice && invoice.items,
      invoice && invoice.lines,

      invoice &&
        invoice.sale &&
        invoice.sale.items
    ]);
  }

  function lineName(line) {
    return clean(
      line &&
      (
        line.product_name ||
        line.product_name_snapshot ||
        line.name ||
        line.sku ||
        line.sku_snapshot ||

        (
          line.product &&
          line.product.name
        )
      )
    ) || 'Product';
  }

  function productSummary(sale) {
    var lines =
      saleLines(sale);

    if (!lines.length) {
      return 'Receipt details available';
    }

    return lines.map(
      function (line) {
        return (
          lineName(line) +
          ' × ' +
          amount(line.quantity)
        );
      }
    ).join(', ');
  }

  function fetchInvoice(
    id,
    reprint
  ) {
    var numericId =
      Number(id);

    if (
      !Number.isInteger(numericId) ||
      numericId <= 0
    ) {
      return Promise.reject(
        new Error(
          'The completed transaction could not be identified.'
        )
      );
    }

    if (
      !reprint &&
      state.invoiceCache.has(numericId)
    ) {
      return Promise.resolve(
        state.invoiceCache.get(numericId)
      );
    }

    return apiGet(
      '/api/v1/pharmaco/sales/' +
      numericId +
      '/invoice' +
      (
        reprint
          ? '?reprint=1'
          : ''
      )
    ).then(function (payload) {
      var invoice =
        normalizeInvoice(payload);

      if (!reprint) {
        state.invoiceCache.set(
          numericId,
          invoice
        );
      }

      return invoice;
    });
  }

  function enrichSales(sales) {
    return Promise.all(
      sales.map(function (sale) {
        if (
          saleLines(sale).length ||
          !saleId(sale)
        ) {
          return Promise.resolve(sale);
        }

        return fetchInvoice(
          saleId(sale),
          false
        )
          .then(function (invoice) {
            sale._aquilaInvoice =
              invoice;

            return sale;
          })
          .catch(function () {
            return sale;
          });
      })
    );
  }

  function findRecentHeading() {
    return Array.from(
      document.querySelectorAll(
        'h1,h2,h3,h4,h5,strong'
      )
    ).find(function (element) {
      return lower(
        element.textContent
      ).includes(
        'recent transactions'
      );
    }) || null;
  }

  function recentTableHtml(sales) {
    var rows =
      sales.map(function (sale) {
        var id = saleId(sale);

        return (
          '<tr>' +

          '<td><strong>' +
          escapeHtml(
            saleNumber(sale)
          ) +
          '</strong></td>' +

          '<td>' +
          escapeHtml(
            dateLabel(
              sale.sold_at ||
              sale.created_at ||
              sale.business_date
            )
          ) +
          '</td>' +

          '<td class="aquila-v11b-products">' +
          escapeHtml(
            productSummary(sale)
          ) +
          '</td>' +

          '<td>' +
          escapeHtml(
            money(
              sale.total_amount ||
              sale.total ||
              sale.amount
            )
          ) +
          '</td>' +

          '<td>' +
          escapeHtml(
            sale.payment_status ||
            sale.status ||
            'Recorded'
          ) +
          '</td>' +

          '<td>' +
          '<button type="button" ' +
          'data-aquila-v11b-receipt="' +
          escapeHtml(id) +
          '">Receipt</button>' +
          '</td>' +

          '</tr>'
        );
      }).join('');

    if (!rows) {
      rows =
        '<tr>' +
        '<td colspan="6">' +
        'No completed transactions were returned.' +
        '</td>' +
        '</tr>';
    }

    return (
      '<div class="aquila-v11b-toolbar">' +
      '<strong>Latest saved transactions</strong>' +
      '<button type="button" ' +
      'data-aquila-v11b-refresh>' +
      'Refresh' +
      '</button>' +
      '</div>' +

      '<div class="aquila-v11b-scroll">' +
      '<table>' +

      '<thead>' +
      '<tr>' +
      '<th>Transaction</th>' +
      '<th>Date</th>' +
      '<th>Products</th>' +
      '<th>Total</th>' +
      '<th>Status</th>' +
      '<th>Action</th>' +
      '</tr>' +
      '</thead>' +

      '<tbody>' +
      rows +
      '</tbody>' +

      '</table>' +
      '</div>'
    );
  }

  function renderRecentSales() {
    var heading =
      findRecentHeading();

    if (!heading) {
      return false;
    }

    var root =
      heading.closest(
        'section,article'
      ) ||
      heading.parentElement;

    if (!root) {
      return false;
    }

    var mount =
      root.querySelector(
        '[data-aquila-v11b-recent]'
      );

    if (!mount) {
      mount =
        document.createElement('div');

      mount.setAttribute(
        'data-aquila-v11b-recent',
        'true'
      );

      heading.insertAdjacentElement(
        'afterend',
        mount
      );

      var existingTable =
        root.querySelector('table');

      if (
        existingTable &&
        !existingTable.closest(
          '[data-aquila-v11b-recent]'
        )
      ) {
        var existingText =
          lower(
            existingTable.textContent
          );

        var meaningfulRows =
          existingTable.querySelectorAll(
            'tbody tr'
          ).length;

        if (
          meaningfulRows === 0 ||
          existingText.includes(
            'no transaction'
          ) ||
          existingText.includes(
            'no data'
          )
        ) {
          existingTable.setAttribute(
            'data-aquila-v11b-original-empty',
            'true'
          );

          existingTable.style.display =
            'none';
        }
      }
    }

    mount.innerHTML =
      recentTableHtml(
        state.sales
      );

    state.recentRowsRendered =
      state.sales.length;

    return true;
  }

  function refreshRecentSales() {
    if (state.refreshRunning) {
      return Promise.resolve();
    }

    state.refreshRunning = true;
    state.refreshAttempts += 1;

    return apiGet(
      '/api/v1/pharmaco/sales' +
      '?page=1&per_page=12'
    )
      .then(function (payload) {
        var sales =
          normalizeSales(payload)
            .filter(function (sale) {
              return (
                lower(sale.status) !==
                'voided'
              );
            })
            .slice(0, 12);

        return enrichSales(sales);
      })
      .then(function (sales) {
        state.sales = sales;
        state.refreshSuccesses += 1;

        renderRecentSales();
      })
      .catch(function () {
        renderRecentSales();
      })
      .finally(function () {
        state.refreshRunning = false;
      });
  }

  function removeVerboseNotices() {
    var pattern =
      /\badded\s*:[\s\S]*selling\s+amount\s*:/i;

    Array.from(
      document.querySelectorAll(
        '[role="alert"],' +
        '.alert,.toast,.notice,.notification,' +
        '[class*="message"],p,small'
      )
    ).forEach(function (element) {
      var content =
        clean(element.textContent);

      if (
        content.length > 0 &&
        content.length < 700 &&
        pattern.test(content)
      ) {
        element.remove();

        state.verboseNoticesRemoved +=
          1;
      }
    });
  }

  function modalElement() {
    var modal =
      document.querySelector(
        '[data-aquila-v11b-modal]'
      );

    if (modal) {
      return modal;
    }

    modal =
      document.createElement('div');

    modal.setAttribute(
      'data-aquila-v11b-modal',
      'true'
    );

    modal.hidden = true;

    document.body.appendChild(modal);

    return modal;
  }

  function receiptHtml(invoice) {
    var lines =
      invoiceLines(invoice);

    var totals =
      invoice.totals ||
      invoice.summary ||
      invoice;

    var tenant =
      invoice.tenant || {};

    var branch =
      invoice.branch || {};

    var customer =
      invoice.customer || {};

    var cashier =
      invoice.cashier || {};

    var payments =
      Array.isArray(invoice.payments)
        ? invoice.payments
        : [];

    var lineRows =
      lines.map(function (line) {
        return (
          '<tr>' +

          '<td>' +
          escapeHtml(
            lineName(line)
          ) +
          '</td>' +

          '<td>' +
          escapeHtml(
            amount(line.quantity)
          ) +
          '</td>' +

          '<td>' +
          escapeHtml(
            money(line.unit_price)
          ) +
          '</td>' +

          '<td>' +
          escapeHtml(
            money(
              line.line_total ||
              line.total
            )
          ) +
          '</td>' +

          '</tr>'
        );
      }).join('');

    if (!lineRows) {
      lineRows =
        '<tr>' +
        '<td colspan="4">' +
        '<strong>Receipt data is incomplete.</strong><br>' +
        'No persisted product lines were returned.' +
        '</td>' +
        '</tr>';
    }

    var paymentRows =
      payments.map(function (payment) {
        return (
          '<div>' +
          '<span>' +
          escapeHtml(
            payment.method ||
            payment.payment_method ||
            'Payment'
          ) +
          '</span>' +

          '<strong>' +
          escapeHtml(
            money(payment.amount)
          ) +
          '</strong>' +
          '</div>'
        );
      }).join('');

    return (
      '<div class="aquila-v11b-backdrop" ' +
      'data-aquila-v11b-close></div>' +

      '<section class="aquila-v11b-card" ' +
      'role="dialog" aria-modal="true">' +

      '<div class="aquila-v11b-actions">' +
      '<button type="button" ' +
      'data-aquila-v11b-print>' +
      'Print' +
      '</button>' +

      '<button type="button" ' +
      'data-aquila-v11b-close>' +
      'Close' +
      '</button>' +
      '</div>' +

      '<article class="aquila-v11b-paper">' +

      '<header>' +
      '<strong>' +
      escapeHtml(
        tenant.name ||
        branch.name ||
        'Ubuzima+'
      ) +
      '</strong>' +

      '<span>' +
      escapeHtml(
        branch.name || ''
      ) +
      '</span>' +

      '<small>' +
      escapeHtml(
        branch.address ||
        branch.phone ||
        ''
      ) +
      '</small>' +
      '</header>' +

      '<div class="aquila-v11b-meta">' +

      '<div>' +
      '<span>Receipt</span>' +
      '<strong>' +
      escapeHtml(
        invoice.invoice_number ||
        invoice.sale_number ||
        invoice.sale_reference ||
        'Unnumbered'
      ) +
      '</strong>' +
      '</div>' +

      '<div>' +
      '<span>Date</span>' +
      '<strong>' +
      escapeHtml(
        dateLabel(
          invoice.issued_at ||
          invoice.sold_at ||
          invoice.created_at
        )
      ) +
      '</strong>' +
      '</div>' +

      '<div>' +
      '<span>Customer</span>' +
      '<strong>' +
      escapeHtml(
        customer.name ||
        'Walk-in customer'
      ) +
      '</strong>' +
      '</div>' +

      '<div>' +
      '<span>Cashier</span>' +
      '<strong>' +
      escapeHtml(
        cashier.name ||
        'Not recorded'
      ) +
      '</strong>' +
      '</div>' +

      '</div>' +

      '<table>' +
      '<thead>' +
      '<tr>' +
      '<th>Product</th>' +
      '<th>Qty</th>' +
      '<th>Price</th>' +
      '<th>Total</th>' +
      '</tr>' +
      '</thead>' +

      '<tbody>' +
      lineRows +
      '</tbody>' +
      '</table>' +

      '<div class="aquila-v11b-totals">' +

      '<div>' +
      '<span>Subtotal</span>' +
      '<strong>' +
      escapeHtml(
        money(
          totals.subtotal_amount
        )
      ) +
      '</strong>' +
      '</div>' +

      '<div>' +
      '<span>Discount</span>' +
      '<strong>' +
      escapeHtml(
        money(
          totals.discount_amount
        )
      ) +
      '</strong>' +
      '</div>' +

      '<div>' +
      '<span>Tax</span>' +
      '<strong>' +
      escapeHtml(
        money(
          totals.tax_amount
        )
      ) +
      '</strong>' +
      '</div>' +

      '<div class="grand">' +
      '<span>Total</span>' +
      '<strong>' +
      escapeHtml(
        money(
          totals.total_amount ||
          invoice.total_amount
        )
      ) +
      '</strong>' +
      '</div>' +

      '<div>' +
      '<span>Paid</span>' +
      '<strong>' +
      escapeHtml(
        money(
          totals.paid_amount ||
          invoice.paid_amount
        )
      ) +
      '</strong>' +
      '</div>' +

      '<div>' +
      '<span>Balance</span>' +
      '<strong>' +
      escapeHtml(
        money(
          totals.balance_amount ||
          invoice.balance_amount
        )
      ) +
      '</strong>' +
      '</div>' +

      '</div>' +

      '<div class="aquila-v11b-payments">' +
      paymentRows +
      '</div>' +

      '<footer>' +
      'Thank you for your business.' +
      '</footer>' +

      '</article>' +
      '</section>'
    );
  }

  function showReceipt(
    id,
    reprint
  ) {
    state.receiptLoads += 1;

    return fetchInvoice(
      id,
      reprint
    )
      .then(function (invoice) {
        var modal =
          modalElement();

        modal.innerHTML =
          receiptHtml(invoice);

        modal.hidden = false;

        document.body.classList.add(
          'aquila-v11b-open'
        );

        state.receiptOpen = true;
      })
      .catch(function (error) {
        state.receiptFailures += 1;

        throw error;
      });
  }

  function closeReceipt() {
    var modal =
      modalElement();

    modal.hidden = true;
    modal.innerHTML = '';

    document.body.classList.remove(
      'aquila-v11b-open'
    );

    document.body.classList.remove(
      'aquila-v11b-printing'
    );

    state.receiptOpen = false;
  }

  function printReceipt() {
    document.body.classList.add(
      'aquila-v11b-printing'
    );

    var cleanup =
      function () {
        document.body.classList.remove(
          'aquila-v11b-printing'
        );

        window.removeEventListener(
          'afterprint',
          cleanup
        );
      };

    window.addEventListener(
      'afterprint',
      cleanup
    );

    window.print();

    window.setTimeout(
      cleanup,
      1500
    );
  }

  function receiptIdFromContext(target) {
    var explicit =
      target.closest(
        '[data-aquila-v11b-receipt]'
      );

    if (explicit) {
      return Number(
        explicit.getAttribute(
          'data-aquila-v11b-receipt'
        )
      );
    }

    var row =
      target.closest('tr');

    if (row) {
      var rowText =
        lower(row.textContent);

      var matched =
        state.sales.find(
          function (sale) {
            return rowText.includes(
              lower(
                saleNumber(sale)
              )
            );
          }
        );

      if (matched) {
        return saleId(matched);
      }
    }

    return (
      state.latestSaleId ||
      (
        state.sales[0]
          ? saleId(state.sales[0])
          : null
      )
    );
  }

  document.addEventListener(
    'click',
    function (event) {
      var rawTarget =
        event.target;

      if (
        !rawTarget ||
        typeof rawTarget.closest !==
          'function'
      ) {
        return;
      }

      if (
        rawTarget.closest(
          '[data-aquila-v11b-close]'
        )
      ) {
        event.preventDefault();
        closeReceipt();
        return;
      }

      var target =
        rawTarget.closest(
          'button,a'
        );

      if (!target) {
        return;
      }

      if (
        target.hasAttribute(
          'data-aquila-v11b-refresh'
        )
      ) {
        event.preventDefault();
        void refreshRecentSales();
        return;
      }

      if (
        target.hasAttribute(
          'data-aquila-v11b-print'
        )
      ) {
        event.preventDefault();
        printReceipt();
        return;
      }

      var label =
        lower(target.textContent);

      var receiptAction =
        target.hasAttribute(
          'data-aquila-v11b-receipt'
        ) ||
        label === 'receipt' ||
        label === 'print receipt' ||
        label === 'view receipt' ||
        label === 'reprint' ||
        label === 'reprint receipt' ||
        label === 'print invoice' ||
        label === 'view invoice';

      if (!receiptAction) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      var id =
        receiptIdFromContext(target);

      void showReceipt(
        id,
        label.includes('reprint')
      ).catch(function (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : 'The receipt could not be loaded.'
        );
      });
    },
    true
  );

  var style =
    document.createElement('style');

  style.setAttribute(
    'data-aquila-v11b-style',
    'true'
  );

  style.textContent = `
    [data-aquila-v11b-recent] {
      margin-top: 14px;
      border: 1px solid #dbe6e0;
      border-radius: 12px;
      overflow: hidden;
      background: #fff;
    }

    .aquila-v11b-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      background: #f5faf7;
      border-bottom: 1px solid #e2ebe6;
    }

    .aquila-v11b-scroll {
      width: 100%;
      overflow-x: auto;
    }

    [data-aquila-v11b-recent] table {
      width: 100%;
      min-width: 840px;
      border-collapse: collapse;
    }

    [data-aquila-v11b-recent] th,
    [data-aquila-v11b-recent] td {
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid #edf2ef;
    }

    .aquila-v11b-products {
      min-width: 260px;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    [data-aquila-v11b-modal][hidden] {
      display: none !important;
    }

    [data-aquila-v11b-modal] {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      display: grid;
      place-items: center;
      padding: 20px;
    }

    .aquila-v11b-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, .58);
    }

    .aquila-v11b-card {
      position: relative;
      z-index: 1;
      width: min(420px, 100%);
      max-height: calc(100vh - 40px);
      overflow: auto;
      border-radius: 14px;
      background: #edf3f0;
      box-shadow: 0 24px 70px rgba(0, 0, 0, .25);
    }

    .aquila-v11b-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px;
    }

    .aquila-v11b-paper {
      width: min(80mm, calc(100% - 24px));
      margin: 0 auto 12px;
      padding: 14px;
      background: #fff;
      color: #111827;
      font: 12px/1.4 Arial, sans-serif;
    }

    .aquila-v11b-paper header {
      display: grid;
      gap: 3px;
      margin-bottom: 12px;
      text-align: center;
    }

    .aquila-v11b-paper table {
      width: 100%;
      margin: 10px 0;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .aquila-v11b-paper th,
    .aquila-v11b-paper td {
      padding: 5px 3px;
      border-bottom: 1px dashed #9ca3af;
      overflow-wrap: anywhere;
    }

    .aquila-v11b-meta,
    .aquila-v11b-totals,
    .aquila-v11b-payments {
      display: grid;
      gap: 5px;
    }

    .aquila-v11b-meta > div,
    .aquila-v11b-totals > div,
    .aquila-v11b-payments > div {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }

    .aquila-v11b-totals .grand {
      margin-top: 4px;
      padding-top: 6px;
      border-top: 2px solid #111827;
      font-size: 14px;
    }

    .aquila-v11b-paper footer {
      margin-top: 14px;
      text-align: center;
      font-weight: 700;
    }

    body.aquila-v11b-open {
      overflow: hidden;
    }

    @media print {
      body.aquila-v11b-printing * {
        visibility: hidden !important;
      }

      body.aquila-v11b-printing
      [data-aquila-v11b-modal],
      body.aquila-v11b-printing
      [data-aquila-v11b-modal] * {
        visibility: visible !important;
      }

      body.aquila-v11b-printing
      [data-aquila-v11b-modal] {
        position: absolute !important;
        inset: 0 auto auto 0 !important;
        display: block !important;
        padding: 0 !important;
      }

      body.aquila-v11b-printing
      .aquila-v11b-backdrop,
      body.aquila-v11b-printing
      .aquila-v11b-actions {
        display: none !important;
      }

      body.aquila-v11b-printing
      .aquila-v11b-card {
        width: 80mm !important;
        max-height: none !important;
        overflow: visible !important;
        box-shadow: none !important;
        background: #fff !important;
      }

      body.aquila-v11b-printing
      .aquila-v11b-paper {
        width: 72mm !important;
        margin: 0 !important;
      }

      @page {
        size: 80mm auto;
        margin: 0;
      }
    }
  `;

  document.head.appendChild(style);

  var observer =
    new MutationObserver(
      function () {
        window.requestAnimationFrame(
          function () {
            removeVerboseNotices();
            renderRecentSales();
          }
        );
      }
    );

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

  function initialRefresh() {
    removeVerboseNotices();
    renderRecentSales();

    void refreshRecentSales()
      .finally(function () {
        if (
          state.refreshSuccesses === 0 &&
          state.refreshAttempts < 12
        ) {
          window.setTimeout(
            initialRefresh,
            1500
          );
        }
      });
  }

  window
    .__UBUZIMA_POS_RECEIPT_RECENT_UI_V11B__ = {
      version: VERSION,

      refresh: refreshRecentSales,

      receipt: showReceipt,

      diagnostics: function () {
        return {
          version: VERSION,

          latest_sale_id:
            state.latestSaleId,

          refresh_attempts:
            state.refreshAttempts,

          refresh_successes:
            state.refreshSuccesses,

          recent_rows_rendered:
            state.recentRowsRendered,

          verbose_notices_removed:
            state.verboseNoticesRemoved,

          receipt_loads:
            state.receiptLoads,

          receipt_failures:
            state.receiptFailures,

          receipt_open:
            state.receiptOpen,

          automatic_receipt_opening:
            false,

          browser_window_opening:
            false
        };
      }
    };

  window.setTimeout(
    initialRefresh,
    500
  );

  console.info(
    '[UbuzimaPlus] POS receipt and recent transactions UI loaded.',
    VERSION
  );
}());

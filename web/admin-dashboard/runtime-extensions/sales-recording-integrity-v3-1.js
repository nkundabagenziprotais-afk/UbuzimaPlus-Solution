(() => {
  'use strict';

  const VERSION =
    '2026.08.sales-recording-integrity-runtime-v2';

  if (
    window.__UBUZIMA_SALES_RECORDING_INTEGRITY_V2__
  ) {
    return;
  }

  /*
   * The wrapper intentionally sits outside the existing
   * POS-terminal fetch wrapper. All unrelated requests are
   * passed through unchanged.
   */
  const previousFetch =
    window.fetch.bind(window);

  const state = {
    customerName: '',
    customerPhoneTin: '',

    recentSearch: '',
    salesSearch: '',

    recentSales: new Map(),
    registerSales: new Map(),

    recentSeen: false,
    registerSeen: false,

    transactionMounted: false,
    recentMounted: false,
    registerMounted: false,

    hiddenIneligible: 0,
  };

  function text(value) {
    return String(
      value ?? '',
    ).trim();
  }

  function norm(value) {
    return text(value)
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function asNumber(value) {
    const parsed =
      Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function requestUrl(input) {
    try {
      return new URL(
        input instanceof Request
          ? input.url
          : String(input),
        window.location.href,
      );
    } catch (_error) {
      return null;
    }
  }

  function requestMethod(
    input,
    init,
  ) {
    return text(
      init?.method
      ?? (
        input instanceof Request
          ? input.method
          : 'GET'
      ),
    ).toUpperCase() || 'GET';
  }

  function matchesEndpoint(
    url,
    suffix,
  ) {
    return Boolean(
      url
      && url.pathname.endsWith(
        suffix,
      ),
    );
  }

  function customerFromRegistered(
    customer,
  ) {
    if (!customer) {
      return '';
    }

    if (
      typeof customer === 'string'
    ) {
      return text(customer);
    }

    const direct =
      text(
        customer.full_name
        ?? customer.name,
      );

    if (direct) {
      return direct;
    }

    return [
      text(customer.first_name),
      text(customer.last_name),
    ]
      .filter(Boolean)
      .join(' ');
  }

  function customerName(
    sale,
    fallback = '',
  ) {
    return (
      text(
        sale?.transaction_customer_name,
      )
      || text(
        sale?.customer_name,
      )
      || customerFromRegistered(
        sale?.customer,
      )
      || text(fallback)
      || 'Walk-in customer'
    );
  }

  function phoneTin(sale) {
    return (
      text(
        sale
          ?.transaction_customer_phone_tin,
      )
      || text(
        sale?.customer_phone_tin,
      )
      || text(
        sale?.customer?.phone_tin,
      )
      || ''
    );
  }

  function quantity(value) {
    return asNumber(
      value,
    ).toLocaleString(
      'en-RW',
      {
        maximumFractionDigits: 3,
      },
    );
  }

  function productLine(item) {
    if (
      typeof item === 'string'
    ) {
      return text(item);
    }

    if (!item) {
      return '';
    }

    const ready =
      text(item.label);

    if (ready) {
      return ready;
    }

    const name =
      text(
        item.name
        ?? item.product_name
        ?? item.product_name_snapshot
        ?? item.product?.name,
      );

    if (!name) {
      return '';
    }

    const rawQty =
      item.quantity
      ?? item.qty;

    if (
      rawQty === undefined
      || rawQty === null
      || text(rawQty) === ''
    ) {
      return name;
    }

    return (
      name
      + ' × '
      + quantity(rawQty)
    );
  }

  function productsText(sale) {
    if (
      typeof sale?.product_summary
        === 'string'
      && text(sale.product_summary)
    ) {
      return text(
        sale.product_summary,
      );
    }

    if (
      typeof sale?.products
        === 'string'
      && text(sale.products)
    ) {
      return text(
        sale.products,
      );
    }

    const candidates = [
      sale?.product_summary,
      sale?.products,
      sale?.items,
    ];

    for (
      const candidate
      of candidates
    ) {
      if (
        !Array.isArray(candidate)
        || candidate.length === 0
      ) {
        continue;
      }

      const result =
        candidate
          .map(productLine)
          .filter(Boolean)
          .join(', ');

      if (result) {
        return result;
      }
    }

    return '—';
  }

  function operationalSale(sale) {
    return (
      norm(sale?.status)
        === 'dispensed'
      && norm(
        sale?.payment_status,
      ) === 'paid'
    );
  }

  function payloadArray(
    payload,
    names,
  ) {
    for (
      const name
      of names
    ) {
      if (
        Array.isArray(
          payload?.[name],
        )
      ) {
        return payload[name];
      }
    }

    if (
      Array.isArray(
        payload?.data,
      )
    ) {
      return payload.data;
    }

    if (
      payload?.data
      && typeof payload.data
        === 'object'
    ) {
      for (
        const name
        of names
      ) {
        if (
          Array.isArray(
            payload.data[name],
          )
        ) {
          return (
            payload.data[name]
          );
        }
      }
    }

    return [];
  }

  function cacheBySaleNumber(
    collection,
    target,
  ) {
    for (
      const sale
      of collection
    ) {
      const key =
        text(
          sale?.sale_number,
        );

      if (key) {
        target.set(
          key,
          sale,
        );
      }
    }
  }

  function inspectPayload(
    payload,
    type,
  ) {
    if (
      type === 'recent'
    ) {
      state.recentSeen =
        true;

      cacheBySaleNumber(
        payloadArray(
          payload,
          [
            'transactions',
            'sales',
          ],
        ),
        state.recentSales,
      );
    }

    if (
      type === 'register'
    ) {
      state.registerSeen =
        true;

      cacheBySaleNumber(
        payloadArray(
          payload,
          [
            'sales',
          ],
        ),
        state.registerSales,
      );
    }

    if (
      type === 'checkout'
      && payload?.sale
    ) {
      const number =
        text(
          payload.sale.sale_number,
        );

      if (number) {
        state.recentSales.set(
          number,
          payload.sale,
        );

        state.registerSales.set(
          number,
          payload.sale,
        );
      }
    }

    scheduleRefresh();
  }

  function inspectResponse(
    response,
    type,
  ) {
    try {
      response
        .clone()
        .json()
        .then(
          (payload) =>
            inspectPayload(
              payload,
              type,
            ),
        )
        .catch(() => {});
    } catch (_error) {
      // Read-only response inspection must never block POS.
    }
  }

  function validPhoneTin() {
    return (
      state.customerPhoneTin === ''
      || /^[0-9]{9}$/.test(
        state.customerPhoneTin,
      )
    );
  }

  function phoneInput() {
    return document.querySelector(
      '[data-aquila-sales-customer-input="phone-tin"]',
    );
  }

  function applyPhoneValidity(
    show = false,
  ) {
    const input =
      phoneInput();

    const help =
      document.querySelector(
        '[data-aquila-sales-phone-help]',
      );

    const valid =
      validPhoneTin();

    const message =
      (
        !valid
        && show
      )
        ? (
            'Customer Phone/TIN must '
            + 'contain exactly 9 digits.'
          )
        : '';

    if (
      input instanceof
        HTMLInputElement
    ) {
      input.setCustomValidity(
        message,
      );

      input.setAttribute(
        'aria-invalid',
        message
          ? 'true'
          : 'false',
      );
    }

    if (help) {
      help.textContent =
        message
        || (
          'Optional. Exactly 9 digits '
          + 'when provided.'
        );
    }

    return valid;
  }

  function makeField(
    kind,
  ) {
    const label =
      document.createElement(
        'label',
      );

    label.dataset
      .aquilaSalesCustomerField =
        kind;

    const title =
      document.createElement(
        'span',
      );

    const input =
      document.createElement(
        'input',
      );

    input.autocomplete =
      'off';

    if (
      kind === 'name'
    ) {
      title.textContent =
        'Customer Name';

      input.type = 'text';
      input.maxLength = 191;

      input.placeholder =
        'Optional walk-in customer name';

      input.value =
        state.customerName;

      input.dataset
        .aquilaSalesCustomerInput =
          'name';
    } else {
      title.textContent =
        'Customer Phone/TIN';

      input.type = 'text';
      input.inputMode =
        'numeric';

      input.maxLength = 9;
      input.pattern =
        '[0-9]{9}';

      input.placeholder =
        'Optional · 9 digits';

      input.value =
        state.customerPhoneTin;

      input.dataset
        .aquilaSalesCustomerInput =
          'phone-tin';
    }

    label.append(
      title,
      input,
    );

    if (
      kind === 'phone-tin'
    ) {
      const help =
        document.createElement(
          'small',
        );

      help.dataset
        .aquilaSalesPhoneHelp =
          '1';

      help.textContent =
        'Optional. Exactly 9 digits '
        + 'when provided.';

      label.append(
        help,
      );
    }

    return label;
  }

  function mountTransactionFields() {
    const section =
      document.querySelector(
        '.pos-transaction-setup-section',
      );

    const grid =
      section?.querySelector(
        '.pos-field-grid',
      );

    if (!grid) {
      state.transactionMounted =
        false;

      return;
    }

    let name =
      grid.querySelector(
        '[data-aquila-sales-customer-field="name"]',
      );

    let phone =
      grid.querySelector(
        '[data-aquila-sales-customer-field="phone-tin"]',
      );

    const customerType =
      Array.from(
        grid.querySelectorAll(
          ':scope > label',
        ),
      ).find(
        (label) => (
          norm(
            label.querySelector(
              'span',
            )?.textContent,
          )
          === 'customer type'
        ),
      );

    if (!name) {
      name =
        makeField('name');

      if (customerType) {
        customerType.after(
          name,
        );
      } else {
        grid.prepend(
          name,
        );
      }
    }

    if (!phone) {
      phone =
        makeField(
          'phone-tin',
        );

      name.after(
        phone,
      );
    }

    const nameControl =
      name.querySelector(
        'input',
      );

    const phoneControl =
      phone.querySelector(
        'input',
      );

    if (
      nameControl instanceof
        HTMLInputElement
      && nameControl.value
        !== state.customerName
    ) {
      nameControl.value =
        state.customerName;
    }

    if (
      phoneControl instanceof
        HTMLInputElement
      && phoneControl.value
        !== state.customerPhoneTin
    ) {
      phoneControl.value =
        state.customerPhoneTin;
    }

    applyPhoneValidity(false);

    state.transactionMounted =
      true;
  }

  async function enrichedCheckout(
    input,
    init,
  ) {
    if (
      !validPhoneTin()
    ) {
      applyPhoneValidity(true);

      const control =
        phoneInput();

      if (
        control instanceof
          HTMLInputElement
      ) {
        control.focus();
        control.reportValidity();
      }

      throw new Error(
        'Customer Phone/TIN must '
        + 'contain exactly 9 digits.',
      );
    }

    const request =
      input instanceof Request
        ? input
        : null;

    let rawBody = null;

    if (
      init
      && typeof init.body
        === 'string'
    ) {
      rawBody =
        init.body;
    }

    if (
      rawBody === null
      && request
    ) {
      rawBody =
        await request
          .clone()
          .text();
    }

    if (
      rawBody === null
      || rawBody.trim() === ''
    ) {
      throw new Error(
        'Atomic checkout payload is unavailable.',
      );
    }

    let payload;

    try {
      payload =
        JSON.parse(rawBody);
    } catch (_error) {
      throw new Error(
        'Atomic checkout payload is not valid JSON.',
      );
    }

    if (
      !payload
      || typeof payload
        !== 'object'
      || Array.isArray(payload)
    ) {
      throw new Error(
        'Atomic checkout payload has an invalid structure.',
      );
    }

    /*
     * Narrow delta only.
     *
     * Existing session, terminal, branch, cart,
     * payment, FEFO and transaction data remain
     * untouched.
     */
    payload.customer_name =
      state.customerName.trim()
      || null;

    payload.customer_phone_tin =
      state.customerPhoneTin.trim()
      || null;

    const body =
      JSON.stringify(payload);

    const headers =
      new Headers(
        init?.headers
        ?? request?.headers
        ?? undefined,
      );

    if (
      !headers.has(
        'Content-Type',
      )
    ) {
      headers.set(
        'Content-Type',
        'application/json',
      );
    }

    if (request) {
      return {
        input:
          new Request(
            request,
            {
              ...(init ?? {}),
              method:
                requestMethod(
                  request,
                  init,
                ),
              headers,
              body,
            },
          ),

        init: undefined,
      };
    }

    return {
      input,

      init: {
        ...(init ?? {}),
        headers,
        body,
      },
    };
  }

  function clearCustomerFields() {
    state.customerName = '';
    state.customerPhoneTin = '';

    const name =
      document.querySelector(
        '[data-aquila-sales-customer-input="name"]',
      );

    const phone =
      phoneInput();

    if (
      name instanceof
        HTMLInputElement
    ) {
      name.value = '';
    }

    if (
      phone instanceof
        HTMLInputElement
    ) {
      phone.value = '';
    }

    applyPhoneValidity(false);
  }

  window.fetch =
    async function salesIntegrityFetch(
      input,
      init,
    ) {
      const url =
        requestUrl(input);

      const method =
        requestMethod(
          input,
          init,
        );

      const checkout =
        method === 'POST'
        && matchesEndpoint(
          url,
          '/pharmaco/sales/checkout',
        );

      const recent =
        method === 'GET'
        && matchesEndpoint(
          url,
          '/pharmaco/pos/recent-transactions',
        );

      const register =
        method === 'GET'
        && matchesEndpoint(
          url,
          '/pharmaco/sales',
        );

      let nextInput =
        input;

      let nextInit =
        init;

      if (checkout) {
        const enriched =
          await enrichedCheckout(
            input,
            init,
          );

        nextInput =
          enriched.input;

        nextInit =
          enriched.init;
      }

      const response =
        await previousFetch(
          nextInput,
          nextInit,
        );

      if (
        recent
        && response.ok
      ) {
        inspectResponse(
          response,
          'recent',
        );
      }

      if (
        register
        && response.ok
      ) {
        inspectResponse(
          response,
          'register',
        );
      }

      if (
        checkout
        && response.ok
      ) {
        inspectResponse(
          response,
          'checkout',
        );

        clearCustomerFields();
      }

      return response;
    };

  function headers(table) {
    return Array.from(
      table.querySelectorAll(
        'thead th',
      ),
    );
  }

  function headerIndex(
    table,
    candidates,
  ) {
    const wanted =
      candidates.map(norm);

    return headers(
      table,
    ).findIndex(
      (cell) =>
        wanted.includes(
          norm(cell.textContent),
        ),
    );
  }

  function newHeader(
    label,
    marker,
  ) {
    const cell =
      document.createElement(
        'th',
      );

    cell.textContent =
      label;

    cell.setAttribute(
      marker,
      '1',
    );

    return cell;
  }

  function newCell(
    value,
    marker,
    wrap = false,
  ) {
    const cell =
      document.createElement(
        'td',
      );

    cell.textContent =
      value || '—';

    cell.setAttribute(
      marker,
      '1',
    );

    if (wrap) {
      cell.style.whiteSpace =
        'normal';

      cell.style.overflowWrap =
        'anywhere';

      cell.style.minWidth =
        '230px';

      cell.style.maxWidth =
        '380px';

      cell.style.lineHeight =
        '1.35';
    }

    return cell;
  }

  function ensureColumns(
    table,
    prefix,
  ) {
    const row =
      table.querySelector(
        'thead tr',
      );

    if (!row) {
      return;
    }

    const customer =
      headers(table).find(
        (cell) =>
          norm(cell.textContent)
            === 'customer',
      );

    if (!customer) {
      return;
    }

    const phoneMarker =
      `data-aquila-${prefix}-phone`;

    const productsMarker =
      `data-aquila-${prefix}-products`;

    let phone =
      row.querySelector(
        `th[${phoneMarker}]`,
      );

    let products =
      row.querySelector(
        `th[${productsMarker}]`,
      );

    if (!phone) {
      phone =
        newHeader(
          'Phone/TIN',
          phoneMarker,
        );

      customer.after(
        phone,
      );
    }

    if (!products) {
      products =
        newHeader(
          'Products',
          productsMarker,
        );

      products.style.whiteSpace =
        'normal';

      products.style.minWidth =
        '230px';

      phone.after(
        products,
      );
    }
  }

  function recentTable() {
    return (
      document.querySelector(
        '.pos-recent-transactions-bottom table.system-table',
      )
      ?? null
    );
  }

  function mountRecentExtraSearch(
    section,
  ) {
    const toolbar =
      section?.querySelector(
        '.pos-current-session-table-toolbar',
      );

    if (!toolbar) {
      return;
    }

    const original =
      toolbar.querySelector(
        'input[aria-label="Search recent transactions"],'
        + 'input[aria-label="Search current session transactions"]',
      );

    if (
      original instanceof
        HTMLInputElement
    ) {
      original.placeholder =
        'Search sale, customer, type or status…';
    }

    if (
      toolbar.querySelector(
        '[data-aquila-recent-product-phone-search]',
      )
    ) {
      return;
    }

    const input =
      document.createElement(
        'input',
      );

    input.type = 'search';

    input.placeholder =
      'Product / Phone-TIN';

    input.setAttribute(
      'aria-label',
      'Search recent sales by product or Phone/TIN',
    );

    input.dataset
      .aquilaRecentProductPhoneSearch =
        '1';

    input.value =
      state.recentSearch;

    if (original) {
      original.after(
        input,
      );
    } else {
      toolbar.prepend(
        input,
      );
    }

    const select =
      toolbar.querySelector(
        'select[aria-label="Filter recent transactions"],'
        + 'select[aria-label="Filter current session transactions"]',
      );

    if (
      select instanceof
        HTMLSelectElement
    ) {
      const pending =
        Array.from(
          select.options,
        ).find(
          (option) =>
            option.value === 'pending',
        );

      pending?.remove();

      const all =
        Array.from(
          select.options,
        ).find(
          (option) =>
            option.value === 'all',
        );

      if (all) {
        all.textContent =
          'Completed POS sales';
      }

      if (
        select.value
        === 'pending'
      ) {
        select.value =
          all
            ? 'all'
            : (
                select.options[0]
                  ?.value
                ?? ''
              );

        select.dispatchEvent(
          new Event(
            'change',
            {
              bubbles: true,
            },
          ),
        );
      }
    }
  }

  function saleFromMaps(
    saleNumber,
  ) {
    const key =
      text(saleNumber);

    return (
      state.recentSales.get(key)
      ?? state.registerSales.get(key)
      ?? null
    );
  }

  function applyRecent() {
    const table =
      recentTable();

    if (!table) {
      state.recentMounted =
        false;

      return;
    }

    const section =
      table.closest(
        '.pos-recent-transactions-bottom',
      );

    mountRecentExtraSearch(
      section,
    );

    const saleIndex =
      headerIndex(
        table,
        [
          'Sale No.',
          'Sale Number',
        ],
      );

    const customerIndex =
      headerIndex(
        table,
        [
          'Customer',
        ],
      );

    if (
      saleIndex < 0
      || customerIndex < 0
    ) {
      return;
    }

    ensureColumns(
      table,
      'recent',
    );

    const query =
      norm(
        state.recentSearch,
      );

    for (
      const row
      of table.querySelectorAll(
        'tbody tr',
      )
    ) {
      const empty =
        row.querySelector(
          'td[colspan]',
        );

      if (empty) {
        if (
          !empty.dataset
            .aquilaRecentAdjusted
        ) {
          empty.colSpan =
            Number(
              empty.colSpan,
            ) + 2;

          empty.dataset
            .aquilaRecentAdjusted =
              '1';
        }

        continue;
      }

      const originalCells =
        Array.from(
          row.querySelectorAll(
            ':scope > td:not([data-aquila-recent-phone]):not([data-aquila-recent-products])',
          ),
        );

      const saleNumber =
        originalCells[
          saleIndex
        ]?.textContent;

      const sale =
        saleFromMaps(
          saleNumber,
        );

      if (!sale) {
        continue;
      }

      /*
       * Backend is the primary recent-sales eligibility
       * authority, but hide any accidental ineligible row
       * if one reaches the runtime.
       */
      if (
        !operationalSale(
          sale,
        )
      ) {
        row.hidden = true;
        continue;
      }

      const customerCell =
        originalCells[
          customerIndex
        ];

      if (!customerCell) {
        continue;
      }

      const customer =
        customerName(
          sale,
          customerCell.textContent,
        );

      const phone =
        phoneTin(sale);

      const products =
        productsText(sale);

      customerCell.textContent =
        customer;

      let phoneCell =
        row.querySelector(
          'td[data-aquila-recent-phone]',
        );

      let productsCell =
        row.querySelector(
          'td[data-aquila-recent-products]',
        );

      if (!phoneCell) {
        phoneCell =
          newCell(
            phone,
            'data-aquila-recent-phone',
          );

        customerCell.after(
          phoneCell,
        );
      }

      if (!productsCell) {
        productsCell =
          newCell(
            products,
            'data-aquila-recent-products',
            true,
          );

        phoneCell.after(
          productsCell,
        );
      }

      phoneCell.textContent =
        phone || '—';

      productsCell.textContent =
        products;

      const searchable =
        norm(
          [
            saleNumber,
            customer,
            phone,
            products,
          ].join(' '),
        );

      row.hidden =
        Boolean(
          query
          && !searchable.includes(
            query,
          ),
        );
    }

    state.recentMounted =
      true;
  }

  function registerTable() {
    return (
      document.querySelector(
        'table.managed-sales-main-table',
      )
      ?? null
    );
  }

  function mountRegisterExtraSearch(
    table,
  ) {
    const workspace =
      table.closest(
        '.sales-control-workspace',
      );

    const grid =
      workspace?.querySelector(
        '.managed-sales-filter-grid',
      );

    if (!grid) {
      return;
    }

    const standard =
      grid.querySelector(
        'input[type="search"]',
      );

    if (
      standard instanceof
        HTMLInputElement
    ) {
      standard.placeholder =
        'Sale number, customer, status, type or amount';
    }

    if (
      grid.querySelector(
        '[data-aquila-register-product-phone-field]',
      )
    ) {
      return;
    }

    const label =
      document.createElement(
        'label',
      );

    label.className =
      'managed-sales-search-filter';

    label.dataset
      .aquilaRegisterProductPhoneField =
        '1';

    const span =
      document.createElement(
        'span',
      );

    span.textContent =
      'Product / Phone-TIN';

    const input =
      document.createElement(
        'input',
      );

    input.type = 'search';

    input.placeholder =
      'Product name or Phone/TIN';

    input.setAttribute(
      'aria-label',
      'Search Sales Register by product or Phone/TIN',
    );

    input.dataset
      .aquilaRegisterProductPhoneSearch =
        '1';

    input.value =
      state.salesSearch;

    label.append(
      span,
      input,
    );

    grid.append(
      label,
    );
  }

  function visibleEligibility(
    table,
    originalCells,
    sale,
  ) {
    if (sale) {
      return operationalSale(
        sale,
      );
    }

    const paymentIndex =
      headerIndex(
        table,
        [
          'Payment',
          'Payment Status',
        ],
      );

    const statusIndex =
      headerIndex(
        table,
        [
          'Status',
          'Sale Status',
        ],
      );

    if (
      paymentIndex < 0
      || statusIndex < 0
    ) {
      /*
       * Never manufacture eligibility when the runtime
       * cannot prove status. Leave the row untouched.
       */
      return null;
    }

    return (
      norm(
        originalCells[
          paymentIndex
        ]?.textContent,
      ) === 'paid'
      && norm(
        originalCells[
          statusIndex
        ]?.textContent,
      ) === 'dispensed'
    );
  }

  function applyRegister() {
    const table =
      registerTable();

    if (!table) {
      state.registerMounted =
        false;

      return;
    }

    mountRegisterExtraSearch(
      table,
    );

    const saleIndex =
      headerIndex(
        table,
        [
          'Sale Number',
          'Sale No.',
        ],
      );

    const customerIndex =
      headerIndex(
        table,
        [
          'Customer',
        ],
      );

    if (
      saleIndex < 0
      || customerIndex < 0
    ) {
      return;
    }

    ensureColumns(
      table,
      'register',
    );

    const query =
      norm(
        state.salesSearch,
      );

    let hiddenIneligible = 0;

    for (
      const row
      of table.querySelectorAll(
        'tbody tr',
      )
    ) {
      const empty =
        row.querySelector(
          'td[colspan]',
        );

      if (empty) {
        if (
          !empty.dataset
            .aquilaRegisterAdjusted
        ) {
          empty.colSpan =
            Number(
              empty.colSpan,
            ) + 2;

          empty.dataset
            .aquilaRegisterAdjusted =
              '1';
        }

        continue;
      }

      const originalCells =
        Array.from(
          row.querySelectorAll(
            ':scope > td:not([data-aquila-register-phone]):not([data-aquila-register-products])',
          ),
        );

      const saleNumber =
        originalCells[
          saleIndex
        ]?.textContent;

      const sale =
        saleFromMaps(
          saleNumber,
        );

      const eligibility =
        visibleEligibility(
          table,
          originalCells,
          sale,
        );

      if (
        eligibility === false
      ) {
        row.hidden = true;
        hiddenIneligible += 1;
        continue;
      }

      const customerCell =
        originalCells[
          customerIndex
        ];

      if (!customerCell) {
        continue;
      }

      if (!sale) {
        /*
         * Status can still be protected by visible table
         * values, but Products/Phone-TIN require serialized
         * backend sale data. Do not invent it.
         */
        continue;
      }

      const customer =
        customerName(
          sale,
          customerCell.textContent,
        );

      const phone =
        phoneTin(sale);

      const products =
        productsText(sale);

      customerCell.textContent =
        customer;

      let phoneCell =
        row.querySelector(
          'td[data-aquila-register-phone]',
        );

      let productsCell =
        row.querySelector(
          'td[data-aquila-register-products]',
        );

      if (!phoneCell) {
        phoneCell =
          newCell(
            phone,
            'data-aquila-register-phone',
          );

        customerCell.after(
          phoneCell,
        );
      }

      if (!productsCell) {
        productsCell =
          newCell(
            products,
            'data-aquila-register-products',
            true,
          );

        phoneCell.after(
          productsCell,
        );
      }

      phoneCell.textContent =
        phone || '—';

      productsCell.textContent =
        products;

      const searchable =
        norm(
          [
            saleNumber,
            customer,
            phone,
            products,
          ].join(' '),
        );

      row.hidden =
        Boolean(
          query
          && !searchable.includes(
            query,
          ),
        );
    }

    state.hiddenIneligible =
      hiddenIneligible;

    state.registerMounted =
      true;
  }

  function csvEscape(value) {
    return (
      '"'
      + String(
        value ?? '',
      ).replace(
        /"/g,
        '""',
      )
      + '"'
    );
  }

  function exportCurrentRegister() {
    const table =
      registerTable();

    if (!table) {
      return false;
    }

    const headerCells =
      Array.from(
        table.querySelectorAll(
          'thead th',
        ),
      );

    const exportIndexes = [];

    const headings = [];

    headerCells.forEach(
      (cell, index) => {
        if (
          norm(cell.textContent)
          === 'actions'
        ) {
          return;
        }

        exportIndexes.push(
          index,
        );

        headings.push(
          text(cell.textContent),
        );
      },
    );

    const rows = [];

    for (
      const row
      of table.querySelectorAll(
        'tbody tr',
      )
    ) {
      if (
        row.hidden
        || row.querySelector(
          'td[colspan]',
        )
      ) {
        continue;
      }

      const cells =
        Array.from(
          row.querySelectorAll(
            ':scope > td',
          ),
        );

      rows.push(
        exportIndexes.map(
          (index) =>
            text(
              cells[index]
                ?.textContent,
            ),
        ),
      );
    }

    const csv =
      [
        headings,
        ...rows,
      ]
        .map(
          (row) =>
            row
              .map(csvEscape)
              .join(','),
        )
        .join('\r\n');

    const blob =
      new Blob(
        [csv],
        {
          type:
            'text/csv;charset=utf-8',
        },
      );

    const url =
      URL.createObjectURL(
        blob,
      );

    const link =
      document.createElement(
        'a',
      );

    link.href = url;

    link.download =
      'sales-register-paid-dispensed.csv';

    document.body.append(
      link,
    );

    link.click();
    link.remove();

    URL.revokeObjectURL(
      url,
    );

    return true;
  }

  function refresh() {
    mountTransactionFields();
    applyRecent();
    applyRegister();
  }

  /*
   * Bounded refresh only.
   *
   * No MutationObserver.
   * No setInterval.
   * No permanent polling.
   */
  function scheduleRefresh() {
    for (
      const delay
      of [
        0,
        40,
        120,
        300,
        700,
        1400,
      ]
    ) {
      window.setTimeout(
        () => {
          try {
            refresh();
          } catch (error) {
            console.warn(
              '[Ubuzima+] Sales Integrity refresh failed.',
              error,
            );
          }
        },
        delay,
      );
    }
  }

  document.addEventListener(
    'input',
    (event) => {
      const target =
        event.target;

      if (
        !(target instanceof
          HTMLInputElement)
      ) {
        return;
      }

      if (
        target.dataset
          .aquilaSalesCustomerInput
        === 'name'
      ) {
        state.customerName =
          target.value.slice(
            0,
            191,
          );

        return;
      }

      if (
        target.dataset
          .aquilaSalesCustomerInput
        === 'phone-tin'
      ) {
        const digits =
          target.value
            .replace(
              /\D/g,
              '',
            )
            .slice(
              0,
              9,
            );

        target.value =
          digits;

        state.customerPhoneTin =
          digits;

        applyPhoneValidity(
          false,
        );

        return;
      }

      if (
        target.dataset
          .aquilaRecentProductPhoneSearch
      ) {
        state.recentSearch =
          target.value;

        scheduleRefresh();
        return;
      }

      if (
        target.dataset
          .aquilaRegisterProductPhoneSearch
      ) {
        state.salesSearch =
          target.value;

        scheduleRefresh();
        return;
      }

      scheduleRefresh();
    },
    true,
  );

  document.addEventListener(
    'change',
    () => {
      scheduleRefresh();
    },
    true,
  );

  document.addEventListener(
    'click',
    (event) => {
      const source =
        event.target;

      const button =
        source instanceof Element
          ? source.closest(
              'button',
            )
          : null;

      if (button) {
        const label =
          norm(
            button.textContent,
          );

        const confirm =
          label.includes(
            'confirm transaction',
          )
          && Boolean(
            button.closest(
              '.pos-payment-summary-section',
            )
            || button.closest(
              '.pos-confirmation-rail',
            )
          );

        if (
          confirm
          && !validPhoneTin()
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          applyPhoneValidity(
            true,
          );

          const control =
            phoneInput();

          if (
            control instanceof
              HTMLInputElement
          ) {
            control.focus();
            control.reportValidity();
          }

          return;
        }

        const registerExport =
          label === 'export csv'
          && Boolean(
            button.closest(
              '.managed-sales-toolbar-card',
            )
          );

        if (
          registerExport
          && registerTable()
        ) {
          /*
           * Export exactly the currently visible operational
           * Sales Register, including Products and Phone/TIN.
           */
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          applyRegister();

          exportCurrentRegister();

          return;
        }
      }

      scheduleRefresh();
    },
    true,
  );

  window.addEventListener(
    'popstate',
    scheduleRefresh,
  );

  window.addEventListener(
    'load',
    scheduleRefresh,
    {
      once: true,
    },
  );

  if (
    document.readyState
    === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      scheduleRefresh,
      {
        once: true,
      },
    );
  } else {
    scheduleRefresh();
  }

  window
    .__UBUZIMA_SALES_RECORDING_INTEGRITY_V2__ =
    {
      version: VERSION,

      refresh:
        scheduleRefresh,

      diagnostics() {
        return {
          version: VERSION,

          architecture:
            'SAFE_UI_RUNTIME_EXTENSION',

          core_main_replaced:
            false,

          css_replaced:
            false,

          atomic_checkout:
            'PRESERVED_AND_ENRICHED',

          customer_name:
            true,

          customer_phone_tin:
            true,

          phone_rule:
            'OPTIONAL_EXACT_9_DIGITS',

          recent_api_seen:
            state.recentSeen,

          register_api_seen:
            state.registerSeen,

          recent_cached:
            state.recentSales.size,

          register_cached:
            state.registerSales.size,

          transaction_fields_mounted:
            state.transactionMounted,

          recent_table_mounted:
            state.recentMounted,

          sales_register_mounted:
            state.registerMounted,

          ineligible_register_rows_hidden:
            state.hiddenIneligible,

          receipt_interception:
            false,

          inventory_interception:
            false,

          finance_interception:
            false,

          mutation_observer:
            false,

          polling:
            false,
        };
      },
    };

  console.info(
    '[Ubuzima+] Sales Recording Integrity runtime V2 loaded.',
    VERSION,
  );
})();

;(() => {
  "use strict";

  /*
   * AQUILA_SALES_RECORDING_INTEGRITY_V3_1
   *
   * Narrow visual amendment only.
   *
   * Parent:
   *   Exact approved Sales Recording Integrity V2.
   *
   * This amendment does NOT:
   *   - replace the React application;
   *   - change checkout logic;
   *   - change Phone/TIN validation;
   *   - intercept receipt/invoice requests;
   *   - modify Receipt R4 Rev5 sidecars.
   */

  if (
    window
      .__UBUZIMA_SALES_RECORDING_INTEGRITY_V3_1__
  ) {
    return;
  }

  const normalize =
    (value) =>
      String(
        value ?? "",
      )
        .replace(
          /\s+/g,
          " ",
        )
        .trim()
        .toLowerCase();

  function transactionRoots() {
    const direct =
      Array.from(
        document.querySelectorAll(
          ".pos-transaction-setup-section",
        ),
      );

    if (direct.length) {
      return direct;
    }

    const roots = [];

    for (
      const heading
      of document.querySelectorAll(
        "h1,h2,h3,h4,h5,h6,strong",
      )
    ) {
      const text =
        normalize(
          heading.textContent,
        );

      if (
        !text.includes(
          "transaction set-up",
        )
        &&
        !text.includes(
          "transaction setup",
        )
      ) {
        continue;
      }

      const root =
        heading.closest(
          "section,article,form",
        )
        ||
        heading.parentElement;

      if (
        root
        && !roots.includes(root)
      ) {
        roots.push(root);
      }
    }

    return roots;
  }

  function fieldTitle(label) {
    const directSpan =
      Array.from(
        label.children || [],
      ).find(
        (child) =>
          child.tagName
            ?.toLowerCase()
          === "span",
      );

    if (directSpan) {
      return normalize(
        directSpan.textContent,
      );
    }

    const input =
      label.querySelector(
        "input,select,textarea",
      );

    if (!input) {
      return normalize(
        label.textContent,
      );
    }

    const clone =
      label.cloneNode(true);

    for (
      const field
      of clone.querySelectorAll(
        "input,select,textarea,small",
      )
    ) {
      field.remove();
    }

    return normalize(
      clone.textContent,
    );
  }

  function hideNode(node) {
    if (!node) {
      return;
    }

    node.hidden =
      true;

    node.style.display =
      "none";

    node.setAttribute(
      "aria-hidden",
      "true",
    );
  }

  function applyAmendments() {
    for (
      const root
      of transactionRoots()
    ) {
      /*
       * Amendment 1:
       * Remove Discount Amount from Transaction Set-UP UI.
       *
       * We hide only its field container/label.
       * No checkout financial calculations are changed.
       */
      for (
        const label
        of root.querySelectorAll(
          "label",
        )
      ) {
        const title =
          fieldTitle(label);

        if (
          title
          === "discount amount"
        ) {
          hideNode(
            label,
          );

          continue;
        }

        /*
         * Amendment 2:
         * Keep Customer Phone/TIN itself and all V2 validation.
         * Hide only the helper copy.
         */
        if (
          title
          === "customer phone/tin"
        ) {
          for (
            const helper
            of label.querySelectorAll(
              "small",
            )
          ) {
            hideNode(
              helper,
            );
          }

          const input =
            label.querySelector(
              "input",
            );

          if (input) {
            input.removeAttribute(
              "aria-describedby",
            );
          }
        }
      }

      /*
       * Catch the exact helper even if React rendered it
       * outside the label element.
       */
      for (
        const helper
        of root.querySelectorAll(
          "small,p",
        )
      ) {
        if (
          normalize(
            helper.textContent,
          ).includes(
            "optional. exactly 9 digits when provided",
          )
        ) {
          hideNode(
            helper,
          );
        }
      }
    }
  }

  function refresh() {
    const delays = [
      0,
      50,
      180,
      400,
      800,
      1500,
      2500,
    ];

    for (
      const delay
      of delays
    ) {
      window.setTimeout(
        applyAmendments,
        delay,
      );
    }
  }

  if (
    document.readyState
    === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      refresh,
      {
        once: true,
      },
    );
  } else {
    refresh();
  }

  for (
    const eventName
    of [
      "click",
      "input",
      "change",
    ]
  ) {
    document.addEventListener(
      eventName,
      refresh,
      true,
    );
  }

  for (
    const eventName
    of [
      "hashchange",
      "popstate",
      "ubuzima:app-ready",
      "ubuzima:refresh",
    ]
  ) {
    window.addEventListener(
      eventName,
      refresh,
    );
  }

  window
    .__UBUZIMA_SALES_RECORDING_INTEGRITY_V3_1__ =
    {
      version:
        "sales-recording-integrity-v3-1",

      refresh,

      diagnostics() {
        const visibleDiscount =
          Array.from(
            document.querySelectorAll(
              "label",
            ),
          ).some(
            (label) =>
              fieldTitle(label)
              === "discount amount"
              &&
              !label.hidden
              &&
              label.style.display
              !== "none",
          );

        const helperStillVisible =
          Array.from(
            document.querySelectorAll(
              "small,p",
            ),
          ).some(
            (node) =>
              normalize(
                node.textContent,
              ).includes(
                "optional. exactly 9 digits when provided",
              )
              &&
              !node.hidden
              &&
              node.style.display
              !== "none",
          );

        return {
          core_main_replaced:
            false,

          css_replaced:
            false,

          receipt_sidecars_replaced:
            false,

          receipt_interception_added:
            false,

          discount_amount_visible:
            visibleDiscount,

          phone_helper_visible:
            helperStillVisible,

          phone_rule:
            "OPTIONAL_EXACT_9_DIGITS",

          receipt_customer_source:
            "PERSISTED_TRANSACTION_METADATA",
        };
      },
    };

  refresh();
})();

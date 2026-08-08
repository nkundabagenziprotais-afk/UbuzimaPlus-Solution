(() => {
  "use strict";

  const VERSION =
    "2026.08.sales-recording-integrity-v3.3-hydration";

  if (
    window.__UBUZIMA_SALES_RECORDING_INTEGRITY_V3_3__
  ) {
    return;
  }

  const state = {
    auth: "",
    tenant: "",
    branchId: null,

    checkoutCaptured: false,
    currentSale: null,

    recentApiSeen: false,
    salesApiSeen: false,

    recentCache: new Map(),
    salesCache: new Map(),

    recentTableFound: false,
    salesRegisterFound: false,

    recentRowsInjected: 0,
    recentRowsEnriched: 0,
    registerRowsInjected: 0,
    registerRowsEnriched: 0,

    receiptOpenCount: 0,
    receiptFailureCount: 0,

    popupCenterOverride: false,
    lastError: "",
  };

  const CURRENT_SALE_KEY =
    "ubuzima.sales.integrity.v3.3.current-sale";

  const previousFetch =
    window.fetch.bind(window);

  function clean(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value).trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function numberOrNull(value) {
    const parsed =
      Number(value);

    return Number.isFinite(parsed) &&
      parsed > 0
      ? parsed
      : null;
  }

  function safeJson(value) {
    if (
      value &&
      typeof value === "object"
    ) {
      return value;
    }

    if (
      typeof value !== "string" ||
      value.trim() === ""
    ) {
      return {};
    }

    try {
      const parsed =
        JSON.parse(value);

      return (
        parsed &&
        typeof parsed === "object"
      )
        ? parsed
        : {};
    } catch (_) {
      return {};
    }
  }

  function storageObjects() {
    const values = [];

    for (
      const storage of [
        window.sessionStorage,
        window.localStorage,
      ]
    ) {
      if (!storage) {
        continue;
      }

      for (
        const key of [
          "ubuzima_admin_session",
          "ubuzima.admin.session",
          "ubuzima.session",
        ]
      ) {
        try {
          const raw =
            storage.getItem(key);

          if (!raw) {
            continue;
          }

          values.push(
            safeJson(raw)
          );
        } catch (_) {}
      }
    }

    return values;
  }

  function firstDeep(
    object,
    candidates,
    depth = 0,
  ) {
    if (
      !object ||
      typeof object !== "object" ||
      depth > 4
    ) {
      return "";
    }

    for (
      const key of candidates
    ) {
      if (
        Object.prototype
          .hasOwnProperty
          .call(object, key)
      ) {
        const value =
          object[key];

        if (
          typeof value === "string" ||
          typeof value === "number"
        ) {
          const text =
            clean(value);

          if (text) {
            return text;
          }
        }
      }
    }

    for (
      const value of Object.values(object)
    ) {
      if (
        value &&
        typeof value === "object"
      ) {
        const found =
          firstDeep(
            value,
            candidates,
            depth + 1,
          );

        if (found) {
          return found;
        }
      }
    }

    return "";
  }

  function resolveStoredContext() {
    if (!state.auth) {
      for (
        const object of storageObjects()
      ) {
        const token =
          firstDeep(
            object,
            [
              "token",
              "access_token",
              "accessToken",
              "bearer_token",
            ],
          );

        if (token) {
          state.auth =
            token.toLowerCase()
              .startsWith("bearer ")
              ? token
              : `Bearer ${token}`;

          break;
        }
      }
    }

    if (!state.tenant) {
      for (
        const storage of [
          window.localStorage,
          window.sessionStorage,
        ]
      ) {
        if (!storage) {
          continue;
        }

        for (
          const key of [
            "ubuzima.currentTenantSlug",
            "pharmaco.tenantSlug",
            "ubuzima.tenantSlug",
          ]
        ) {
          try {
            const value =
              clean(
                storage.getItem(key),
              );

            if (value) {
              state.tenant =
                value;

              break;
            }
          } catch (_) {}
        }

        if (state.tenant) {
          break;
        }
      }

      if (!state.tenant) {
        for (
          const object of storageObjects()
        ) {
          const slug =
            clean(
              object?.tenant_slug ||
              object?.tenantSlug ||
              object?.tenant?.slug ||
              object?.profile?.tenant?.slug ||
              object?.user?.tenant?.slug ||
              object?.session?.tenant?.slug,
            );

          if (slug) {
            state.tenant =
              slug;

            break;
          }
        }
      }
    }

    if (!state.branchId) {
      try {
        const terminal =
          window
            .__UBUZIMA_POS_TERMINAL_V5__;

        if (
          terminal &&
          typeof terminal.diagnostics ===
            "function"
        ) {
          const diagnostics =
            terminal.diagnostics();

          state.branchId =
            numberOrNull(
              diagnostics?.branch_id,
            );
        }
      } catch (_) {}
    }
  }

  function requestInfo(
    input,
    init,
  ) {
    let rawUrl = "";

    if (
      typeof input === "string" ||
      input instanceof URL
    ) {
      rawUrl =
        String(input);
    } else if (
      input &&
      typeof input.url === "string"
    ) {
      rawUrl =
        input.url;
    }

    let url = null;

    try {
      url =
        new URL(
          rawUrl,
          window.location.origin,
        );
    } catch (_) {
      return null;
    }

    let method =
      clean(
        init?.method ||
        (
          input &&
          typeof input.method === "string"
            ? input.method
            : "GET"
        ),
      ).toUpperCase();

    if (!method) {
      method = "GET";
    }

    const headers =
      new Headers();

    try {
      if (
        input &&
        typeof input === "object" &&
        input.headers
      ) {
        new Headers(
          input.headers,
        ).forEach(
          (value, key) => {
            headers.set(
              key,
              value,
            );
          },
        );
      }
    } catch (_) {}

    try {
      if (init?.headers) {
        new Headers(
          init.headers,
        ).forEach(
          (value, key) => {
            headers.set(
              key,
              value,
            );
          },
        );
      }
    } catch (_) {}

    const authorization =
      clean(
        headers.get("Authorization"),
      );

    const tenant =
      clean(
        headers.get("X-Tenant-Slug") ||
        headers.get("X-Tenant"),
      );

    if (authorization) {
      state.auth =
        authorization;
    }

    if (tenant) {
      state.tenant =
        tenant;
    }

    const branch =
      numberOrNull(
        url.searchParams.get(
          "branch_id",
        ),
      );

    if (branch) {
      state.branchId =
        branch;
    }

    let body =
      init?.body;

    if (
      method === "POST" &&
      body &&
      typeof body === "string"
    ) {
      try {
        const payload =
          JSON.parse(body);

        const bodyBranch =
          numberOrNull(
            payload?.branch_id,
          );

        if (bodyBranch) {
          state.branchId =
            bodyBranch;
        }
      } catch (_) {}
    }

    return {
      url,
      method,
    };
  }

  function metadataOf(sale) {
    return safeJson(
      sale?.metadata,
    );
  }

  function customerNameOf(sale) {
    const metadata =
      metadataOf(sale);

    return (
      clean(
        sale?.transaction_customer_name,
      ) ||
      clean(
        metadata
          ?.transaction_customer_name,
      ) ||
      clean(
        metadata
          ?.transaction_customer
          ?.name,
      ) ||
      clean(
        metadata
          ?.walk_in_customer
          ?.name,
      ) ||
      clean(
        sale?.walk_in_customer?.name,
      ) ||
      clean(
        sale?.customer?.full_name,
      ) ||
      clean(
        sale?.customer?.name,
      ) ||
      clean(
        sale?.pharmaco_customer
          ?.full_name,
      ) ||
      clean(
        sale?.pharmaco_customer
          ?.name,
      ) ||
      clean(
        sale?.customer_name,
      ) ||
      "Walk-in"
    );
  }

  function customerPhoneTinOf(
    sale,
  ) {
    const metadata =
      metadataOf(sale);

    return (
      clean(
        sale
          ?.transaction_customer_phone_tin,
      ) ||
      clean(
        metadata
          ?.transaction_customer_phone_tin,
      ) ||
      clean(
        metadata
          ?.transaction_customer
          ?.phone_tin,
      ) ||
      clean(
        metadata
          ?.walk_in_customer
          ?.phone_tin,
      ) ||
      clean(
        sale
          ?.walk_in_customer
          ?.phone_tin,
      ) ||
      clean(
        sale?.customer?.phone_tin,
      ) ||
      clean(
        sale?.customer?.tin,
      ) ||
      clean(
        sale?.customer?.phone,
      ) ||
      clean(
        sale
          ?.pharmaco_customer
          ?.phone_tin,
      ) ||
      clean(
        sale
          ?.pharmaco_customer
          ?.tin,
      ) ||
      clean(
        sale
          ?.pharmaco_customer
          ?.phone,
      ) ||
      clean(
        sale?.customer_phone_tin,
      )
    );
  }

  function itemName(item) {
    return (
      clean(
        item?.product_name_snapshot,
      ) ||
      clean(
        item?.product_name,
      ) ||
      clean(
        item?.name,
      ) ||
      clean(
        item?.product?.name,
      ) ||
      clean(
        item?.product
          ?.product_name,
      ) ||
      "Product"
    );
  }

  function itemQuantity(item) {
    const value =
      Number(
        item?.quantity ??
        item?.qty ??
        0,
      );

    return Number.isFinite(value)
      ? value
      : 0;
  }

  function itemsOf(sale) {
    for (
      const candidate of [
        sale?.items,
        sale?.products,
        sale?.sale_items,
      ]
    ) {
      if (
        Array.isArray(candidate) &&
        candidate.length > 0
      ) {
        return candidate;
      }
    }

    return [];
  }

  function productsOf(sale) {
    const direct =
      clean(
        sale?.product_summary,
      );

    if (direct) {
      return direct;
    }

    const items =
      itemsOf(sale);

    if (items.length === 0) {
      return (
        clean(
          sale?.products_summary,
        ) ||
        clean(
          sale?.products,
        )
      );
    }

    return items
      .map(
        item => {
          const name =
            itemName(item);

          const quantity =
            itemQuantity(item);

          return quantity > 0
            ? `${name} × ${quantity}`
            : name;
        },
      )
      .filter(Boolean)
      .join("; ");
  }

  function itemCountOf(sale) {
    const items =
      itemsOf(sale);

    if (items.length > 0) {
      return items.length;
    }

    const value =
      Number(
        sale?.items_count ??
        sale?.item_count ??
        0,
      );

    return Number.isFinite(value)
      ? value
      : 0;
  }

  function saleNumberOf(sale) {
    return (
      clean(
        sale?.sale_number,
      ) ||
      clean(
        sale?.sale_no,
      ) ||
      clean(
        sale?.number,
      ) ||
      clean(
        sale?.reference,
      )
    );
  }

  function eligible(sale) {
    return (
      lower(sale?.status) ===
        "dispensed" &&
      lower(
        sale?.payment_status,
      ) === "paid"
    );
  }

  function mergeSale(
    current,
    incoming,
  ) {
    if (!current) {
      return incoming;
    }

    const merged = {
      ...current,
      ...incoming,
    };

    if (
      itemsOf(incoming).length === 0 &&
      itemsOf(current).length > 0
    ) {
      merged.items =
        itemsOf(current);
    }

    if (
      !clean(
        incoming
          ?.transaction_customer_name,
      ) &&
      clean(
        current
          ?.transaction_customer_name,
      )
    ) {
      merged.transaction_customer_name =
        current.transaction_customer_name;
    }

    if (
      !clean(
        incoming
          ?.transaction_customer_phone_tin,
      ) &&
      clean(
        current
          ?.transaction_customer_phone_tin,
      )
    ) {
      merged.transaction_customer_phone_tin =
        current.transaction_customer_phone_tin;
    }

    return merged;
  }

  function cacheSale(
    map,
    sale,
  ) {
    const number =
      saleNumberOf(sale);

    if (!number) {
      return;
    }

    map.set(
      number,
      mergeSale(
        map.get(number),
        sale,
      ),
    );
  }

  function cacheList(
    map,
    list,
  ) {
    for (
      const sale of list
    ) {
      if (
        sale &&
        typeof sale === "object"
      ) {
        cacheSale(
          map,
          sale,
        );
      }
    }
  }

  function listFrom(
    payload,
    keys,
  ) {
    if (Array.isArray(payload)) {
      return payload;
    }

    for (
      const key of keys
    ) {
      const value =
        payload?.[key];

      if (Array.isArray(value)) {
        return value;
      }

      if (
        value &&
        Array.isArray(value.data)
      ) {
        return value.data;
      }
    }

    if (
      payload?.data &&
      Array.isArray(
        payload.data.data,
      )
    ) {
      return payload.data.data;
    }

    return [];
  }

  function captureCurrentSale(
    payload,
  ) {
    const root =
      payload?.data &&
      typeof payload.data ===
        "object"
        ? payload.data
        : payload;

    const sale =
      root?.sale ??
      root?.transaction ??
      root?.pharmaco_sale ??
      null;

    if (
      !sale ||
      typeof sale !== "object"
    ) {
      return;
    }

    const saleId =
      numberOrNull(
        sale?.id ??
        root?.sale_id,
      );

    if (!saleId) {
      return;
    }

    const payment =
      root?.payment &&
      typeof root.payment ===
        "object"
        ? root.payment
        : {};

    const record = {
      sale_id:
        saleId,

      sale_number:
        saleNumberOf(sale) ||
        clean(
          root?.sale_number,
        ),

      receipt_number:
        clean(
          payment?.receipt_number ||
          root?.receipt_number,
        ),

      customer_name:
        customerNameOf(sale),

      customer_phone_tin:
        customerPhoneTinOf(sale),

      captured_at:
        Date.now(),
    };

    state.currentSale =
      record;

    state.checkoutCaptured =
      true;

    try {
      window.sessionStorage
        .setItem(
          CURRENT_SALE_KEY,
          JSON.stringify(record),
        );
    } catch (_) {}

    cacheSale(
      state.salesCache,
      sale,
    );

    cacheSale(
      state.recentCache,
      sale,
    );
  }

  function restoreCurrentSale() {
    try {
      const raw =
        window.sessionStorage
          .getItem(
            CURRENT_SALE_KEY,
          );

      const parsed =
        safeJson(raw);

      if (
        numberOrNull(
          parsed?.sale_id,
        )
      ) {
        state.currentSale =
          parsed;
      }
    } catch (_) {}
  }

  async function inspectResponse(
    info,
    response,
  ) {
    if (!response?.ok) {
      return;
    }

    const path =
      info.url.pathname;

    const isCheckout =
      info.method === "POST" &&
      path.endsWith(
        "/pharmaco/sales/checkout",
      );

    const isRecent =
      info.method === "GET" &&
      path.endsWith(
        "/pharmaco/pos/recent-transactions",
      );

    const isSales =
      info.method === "GET" &&
      path.endsWith(
        "/pharmaco/sales",
      );

    if (
      !isCheckout &&
      !isRecent &&
      !isSales
    ) {
      return;
    }

    let payload = null;

    try {
      payload =
        await response.json();
    } catch (_) {
      return;
    }

    if (isCheckout) {
      captureCurrentSale(
        payload,
      );

      scheduleRefresh(250);
      scheduleRefresh(900);
      scheduleRefresh(2200);

      return;
    }

    if (isRecent) {
      state.recentApiSeen =
        true;

      cacheList(
        state.recentCache,
        listFrom(
          payload,
          [
            "transactions",
            "sales",
            "data",
          ],
        ),
      );
    }

    if (isSales) {
      state.salesApiSeen =
        true;

      cacheList(
        state.salesCache,
        listFrom(
          payload,
          [
            "sales",
            "transactions",
            "data",
          ],
        ),
      );
    }

    hydrateTables();
  }

  window.fetch =
    async function (
      input,
      init,
    ) {
      const info =
        requestInfo(
          input,
          init,
        );

      const response =
        await previousFetch(
          input,
          init,
        );

      if (info) {
        try {
          void inspectResponse(
            info,
            response.clone(),
          );
        } catch (_) {}
      }

      return response;
    };

  function authHeaders() {
    resolveStoredContext();

    const headers =
      new Headers({
        Accept:
          "application/json",
      });

    if (state.auth) {
      headers.set(
        "Authorization",
        state.auth,
      );
    }

    if (state.tenant) {
      headers.set(
        "X-Tenant-Slug",
        state.tenant,
      );
    }

    return headers;
  }

  function withBranch(path) {
    const url =
      new URL(
        path,
        window.location.origin,
      );

    if (state.branchId) {
      url.searchParams.set(
        "branch_id",
        String(
          state.branchId,
        ),
      );
    }

    return (
      url.pathname +
      url.search
    );
  }

  async function ownGet(
    path,
  ) {
    const headers =
      authHeaders();

    if (
      !headers.get(
        "Authorization",
      ) ||
      !headers.get(
        "X-Tenant-Slug",
      )
    ) {
      return null;
    }

    const response =
      await previousFetch(
        withBranch(path),
        {
          method: "GET",
          headers,
          credentials:
            "same-origin",
          cache:
            "no-store",
        },
      );

    if (!response.ok) {
      throw new Error(
        `Hydration request failed: ${response.status}`,
      );
    }

    return response.json();
  }

  function normalizeHeader(value) {
    return lower(value)
      .replace(
        /[^a-z0-9]+/g,
        " ",
      )
      .trim();
  }

  function headerCells(table) {
    return Array.from(
      table.querySelectorAll(
        "thead th",
      ),
    );
  }

  function headerIndex(
    table,
    candidates,
  ) {
    const expected =
      candidates.map(
        normalizeHeader,
      );

    return headerCells(table)
      .findIndex(
        cell =>
          expected.includes(
            normalizeHeader(
              cell.textContent,
            ),
          ),
      );
  }

  function ensureColumn(
    table,
    label,
    afterCandidates,
    attr,
  ) {
    let index =
      headerIndex(
        table,
        [label],
      );

    if (index >= 0) {
      return index;
    }

    const headers =
      headerCells(table);

    if (headers.length === 0) {
      return -1;
    }

    let after =
      headerIndex(
        table,
        afterCandidates,
      );

    if (after < 0) {
      after =
        headers.length - 1;
    }

    const th =
      document.createElement(
        "th",
      );

    th.textContent =
      label;

    th.setAttribute(
      attr,
      "1",
    );

    const reference =
      headers[after];

    reference.parentElement
      ?.insertBefore(
        th,
        reference.nextSibling,
      );

    for (
      const row of table.querySelectorAll(
        "tbody tr",
      )
    ) {
      if (
        row.hasAttribute(
          "data-ubuzima-v33-row",
        )
      ) {
        continue;
      }

      const td =
        document.createElement(
          "td",
        );

      td.setAttribute(
        attr,
        "1",
      );

      const cells =
        Array.from(row.cells);

      const cellReference =
        cells[after];

      if (cellReference) {
        row.insertBefore(
          td,
          cellReference.nextSibling,
        );
      } else {
        row.appendChild(td);
      }
    }

    return after + 1;
  }

  function saleForNumber(
    number,
  ) {
    return (
      state.salesCache.get(
        number,
      ) ||
      state.recentCache.get(
        number,
      ) ||
      null
    );
  }

  function findSaleNumberInRow(
    table,
    row,
  ) {
    const index =
      headerIndex(
        table,
        [
          "Sale No.",
          "Sale No",
          "Sale Number",
          "Sale",
          "Reference",
        ],
      );

    if (index >= 0) {
      const value =
        clean(
          row.cells[index]
            ?.textContent,
        );

      if (value) {
        return value;
      }
    }

    const text =
      clean(
        row.textContent,
      );

    for (
      const number of new Set([
        ...state.salesCache.keys(),
        ...state.recentCache.keys(),
      ])
    ) {
      if (
        text.includes(number)
      ) {
        return number;
      }
    }

    return "";
  }

  function setCell(
    row,
    index,
    value,
    wrap = false,
  ) {
    if (
      index < 0 ||
      !row.cells[index]
    ) {
      return;
    }

    row.cells[index]
      .textContent =
        clean(value) || "—";

    if (wrap) {
      row.cells[index]
        .style.whiteSpace =
          "normal";

      row.cells[index]
        .style.overflowWrap =
          "anywhere";

      row.cells[index]
        .style.minWidth =
          "10rem";
    }
  }

  function applySaleToRow(
    table,
    row,
    sale,
    kind,
  ) {
    const customerIndex =
      headerIndex(
        table,
        ["Customer"],
      );

    const phoneIndex =
      headerIndex(
        table,
        [
          "Phone/TIN",
          "Phone TIN",
          "Customer Phone/TIN",
        ],
      );

    const productsIndex =
      headerIndex(
        table,
        ["Products"],
      );

    const itemsIndex =
      headerIndex(
        table,
        ["Items"],
      );

    setCell(
      row,
      customerIndex,
      customerNameOf(sale),
      true,
    );

    setCell(
      row,
      phoneIndex,
      customerPhoneTinOf(sale),
      true,
    );

    setCell(
      row,
      productsIndex,
      productsOf(sale),
      true,
    );

    if (
      kind === "register" &&
      itemsIndex >= 0
    ) {
      setCell(
        row,
        itemsIndex,
        itemCountOf(sale),
      );
    }
  }

  function looksPlaceholder(
    row,
  ) {
    if (!row) {
      return false;
    }

    if (
      row.cells.length === 1
    ) {
      return true;
    }

    return /no\s+(recent\s+)?(sales|transactions)|no\s+records|nothing\s+to\s+show/i
      .test(
        clean(
          row.textContent,
        ),
      );
  }

  function removeInjectedRows(
    table,
  ) {
    table
      .querySelectorAll(
        "tbody tr[data-ubuzima-v33-row]",
      )
      .forEach(
        row => row.remove(),
      );
  }

  function sortedEligibleSales() {
    const merged =
      new Map();

    for (
      const map of [
        state.salesCache,
        state.recentCache,
      ]
    ) {
      for (
        const [key, value]
        of map.entries()
      ) {
        merged.set(
          key,
          mergeSale(
            merged.get(key),
            value,
          ),
        );
      }
    }

    return Array.from(
      merged.values(),
    )
      .filter(eligible)
      .sort(
        (a, b) => {
          const aTime =
            Date.parse(
              clean(
                a?.sold_at ||
                a?.transaction_timestamp ||
                a?.created_at,
              ),
            ) || 0;

          const bTime =
            Date.parse(
              clean(
                b?.sold_at ||
                b?.transaction_timestamp ||
                b?.created_at,
              ),
            ) || 0;

          if (bTime !== aTime) {
            return bTime - aTime;
          }

          return (
            Number(b?.id || 0) -
            Number(a?.id || 0)
          );
        },
      );
  }

  function valueForHeader(
    header,
    sale,
  ) {
    const key =
      normalizeHeader(header);

    if (
      key === "sn" ||
      key === "no"
    ) {
      return "";
    }

    if (
      key.includes(
        "transaction timestamp",
      ) ||
      key === "date"
    ) {
      return (
        clean(
          sale?.transaction_timestamp,
        ) ||
        clean(
          sale?.sold_at,
        ) ||
        clean(
          sale?.created_at,
        )
      );
    }

    if (
      key.includes(
        "business date",
      )
    ) {
      return clean(
        sale?.business_date,
      );
    }

    if (
      key.includes("sale no") ||
      key.includes(
        "sale number",
      ) ||
      key === "sale"
    ) {
      return saleNumberOf(sale);
    }

    if (
      key === "customer"
    ) {
      return customerNameOf(sale);
    }

    if (
      key.includes("phone") ||
      key.includes("tin")
    ) {
      return customerPhoneTinOf(
        sale,
      );
    }

    if (
      key === "products"
    ) {
      return productsOf(sale);
    }

    if (
      key === "items"
    ) {
      return itemCountOf(sale);
    }

    if (
      key.includes(
        "sale type",
      ) ||
      key === "type"
    ) {
      return clean(
        sale?.sale_type,
      );
    }

    if (
      key === "method" ||
      key.includes(
        "payment method",
      )
    ) {
      return (
        clean(
          sale?.payment_method,
        ) ||
        clean(
          sale?.payment?.method,
        )
      );
    }

    if (
      key === "payment" ||
      key.includes(
        "payment status",
      )
    ) {
      return clean(
        sale?.payment_status,
      );
    }

    if (
      key === "status" ||
      key.includes(
        "sale status",
      )
    ) {
      return clean(
        sale?.status,
      );
    }

    if (
      key === "total" ||
      key.includes(
        "total amount",
      )
    ) {
      return clean(
        sale?.total_amount ??
        sale?.total,
      );
    }

    if (
      key === "balance" ||
      key.includes(
        "balance amount",
      )
    ) {
      return clean(
        sale?.balance_amount ??
        sale?.balance,
      );
    }

    if (
      key === "actions" ||
      key === "action"
    ) {
      return "—";
    }

    return "—";
  }

  function makeInjectedRow(
    table,
    sale,
    serial,
  ) {
    const row =
      document.createElement(
        "tr",
      );

    row.setAttribute(
      "data-ubuzima-v33-row",
      "1",
    );

    const headers =
      headerCells(table);

    headers.forEach(
      header => {
        const td =
          document.createElement(
            "td",
          );

        let value =
          valueForHeader(
            header.textContent,
            sale,
          );

        if (
          normalizeHeader(
            header.textContent,
          ) === "sn"
        ) {
          value =
            String(serial);
        }

        td.textContent =
          clean(value) || "—";

        const normalized =
          normalizeHeader(
            header.textContent,
          );

        if (
          normalized === "customer" ||
          normalized === "products" ||
          normalized.includes("phone") ||
          normalized.includes("tin")
        ) {
          td.style.whiteSpace =
            "normal";

          td.style.overflowWrap =
            "anywhere";
        }

        row.appendChild(td);
      },
    );

    return row;
  }

  function prepareColumns(
    table,
    kind,
  ) {
    ensureColumn(
      table,
      "Phone/TIN",
      ["Customer"],
      `data-ubuzima-v33-${kind}-phone`,
    );

    ensureColumn(
      table,
      "Products",
      [
        "Phone/TIN",
        "Customer",
      ],
      `data-ubuzima-v33-${kind}-products`,
    );
  }

  function hydrateTable(
    table,
    kind,
    maxInjected,
  ) {
    prepareColumns(
      table,
      kind,
    );

    const body =
      table.tBodies?.[0] ||
      table.querySelector(
        "tbody",
      );

    if (!body) {
      return {
        injected: 0,
        enriched: 0,
      };
    }

    removeInjectedRows(
      table,
    );

    const nativeRows =
      Array.from(
        body.rows,
      );

    const nativeNumbers =
      new Set();

    let enriched = 0;

    for (
      const row of nativeRows
    ) {
      if (looksPlaceholder(row)) {
        continue;
      }

      const number =
        findSaleNumberInRow(
          table,
          row,
        );

      if (!number) {
        continue;
      }

      nativeNumbers.add(
        number,
      );

      const sale =
        saleForNumber(
          number,
        );

      if (!sale) {
        continue;
      }

      if (!eligible(sale)) {
        row.style.display =
          "none";

        continue;
      }

      row.style.removeProperty(
        "display",
      );

      applySaleToRow(
        table,
        row,
        sale,
        kind,
      );

      enriched += 1;
    }

    const eligibleSales =
      sortedEligibleSales();

    const missing =
      eligibleSales.filter(
        sale =>
          !nativeNumbers.has(
            saleNumberOf(sale),
          ),
      );

    let injected = 0;

    const selected =
      missing.slice(
        0,
        maxInjected,
      );

    for (
      let position =
        selected.length - 1;
      position >= 0;
      position -= 1
    ) {
      const sale =
        selected[position];

      body.insertBefore(
        makeInjectedRow(
          table,
          sale,
          position + 1,
        ),
        body.firstChild,
      );

      injected += 1;
    }

    for (
      const row of nativeRows
    ) {
      if (!looksPlaceholder(row)) {
        continue;
      }

      if (injected > 0) {
        row.style.display =
          "none";
      } else {
        row.style.removeProperty(
          "display",
        );

        if (
          row.cells.length === 1
        ) {
          row.cells[0].colSpan =
            headerCells(
              table,
            ).length;
        }
      }
    }

    return {
      injected,
      enriched,
    };
  }

  function findRecentTable() {
    const section =
      document.querySelector(
        ".pos-recent-transactions-bottom",
      );

    if (!section) {
      return null;
    }

    return section.querySelector(
      "table",
    );
  }

  function findRegisterTable() {
    return document.querySelector(
      ".managed-sales-main-table",
    );
  }

  function hydrateTables() {
    try {
      const recent =
        findRecentTable();

      state.recentTableFound =
        Boolean(recent);

      if (recent) {
        const result =
          hydrateTable(
            recent,
            "recent",
            20,
          );

        state.recentRowsInjected =
          result.injected;

        state.recentRowsEnriched =
          result.enriched;
      }

      const register =
        findRegisterTable();

      state.salesRegisterFound =
        Boolean(register);

      if (register) {
        const result =
          hydrateTable(
            register,
            "register",
            50,
          );

        state.registerRowsInjected =
          result.injected;

        state.registerRowsEnriched =
          result.enriched;
      }
    } catch (error) {
      state.lastError =
        error instanceof Error
          ? error.message
          : String(error);
    }
  }

  async function refreshData() {
    resolveStoredContext();

    try {
      const [
        recentPayload,
        salesPayload,
      ] =
        await Promise.all([
          ownGet(
            "/api/v1/pharmaco/pos/recent-transactions?current_session=0&limit=50&status=dispensed",
          ),
          ownGet(
            "/api/v1/pharmaco/sales?status=dispensed&payment_status=paid",
          ),
        ]);

      if (recentPayload) {
        state.recentApiSeen =
          true;

        cacheList(
          state.recentCache,
          listFrom(
            recentPayload,
            [
              "transactions",
              "sales",
              "data",
            ],
          ),
        );
      }

      if (salesPayload) {
        state.salesApiSeen =
          true;

        cacheList(
          state.salesCache,
          listFrom(
            salesPayload,
            [
              "sales",
              "transactions",
              "data",
            ],
          ),
        );
      }
    } catch (error) {
      state.lastError =
        error instanceof Error
          ? error.message
          : String(error);
    }

    hydrateTables();
  }

  function scheduleRefresh(delay) {
    window.setTimeout(
      () => {
        void refreshData();
      },
      delay,
    );
  }

  function installPopupCentering() {
    if (
      document.getElementById(
        "ubuzima-sales-v33-popup-centering",
      )
    ) {
      state.popupCenterOverride =
        true;

      return;
    }

    const style =
      document.createElement(
        "style",
      );

    style.id =
      "ubuzima-sales-v33-popup-centering";

    style.textContent = `
.pos-quantity-dialog-backdrop,
.ubuzima-pos-confirmation-backdrop {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100dvh !important;
  display: grid !important;
  place-items: center !important;
}

.pos-quantity-dialog,
.ubuzima-pos-confirmation-dialog {
  position: fixed !important;
  left: 50% !important;
  right: auto !important;
  top: calc(50% - 42px) !important;
  bottom: auto !important;
  transform: translate(-50%, -50%) !important;
  margin: 0 !important;
}

@media (max-width: 767px) {
  .pos-quantity-dialog,
  .ubuzima-pos-confirmation-dialog {
    top: 50% !important;
  }
}

[data-ubuzima-v33-recent-products],
[data-ubuzima-v33-register-products],
[data-ubuzima-v33-recent-phone],
[data-ubuzima-v33-register-phone] {
  white-space: normal !important;
  overflow-wrap: anywhere !important;
}
`;

    document.head.appendChild(
      style,
    );

    state.popupCenterOverride =
      true;
  }

  function isCurrentReceiptTrigger(
    target,
  ) {
    if (
      !(target instanceof Element)
    ) {
      return null;
    }

    const button =
      target.closest(
        ".pos-print-receipt-button, [data-ubuzima-receipt-safe-button='v5']",
      );

    if (!button) {
      return null;
    }

    if (
      button.matches(
        "[data-receipt-download]",
      ) ||
      button.closest(
        "[data-receipt-download]",
      )
    ) {
      return null;
    }

    if (
      button.closest(
        ".managed-sales-main-table, .pos-recent-transactions-bottom",
      )
    ) {
      return null;
    }

    return button;
  }

  function currentReceiptContext() {
    const current =
      state.currentSale;

    const saleId =
      numberOrNull(
        current?.sale_id,
      );

    if (!saleId) {
      return null;
    }

    return {
      sale: {
        id:
          saleId,
      },

      saleMeta: {
        id:
          saleId,
        sale_id:
          saleId,
        sale_number:
          clean(
            current
              ?.sale_number,
          ),
      },

      payment: {
        sale_id:
          saleId,
        sale_number:
          clean(
            current
              ?.sale_number,
          ),
        receipt_number:
          clean(
            current
              ?.receipt_number,
          ),
      },

      customer: {
        name:
          clean(
            current
              ?.customer_name,
          ),
        tin:
          clean(
            current
              ?.customer_phone_tin,
          ),
      },
    };
  }

  document.addEventListener(
    "click",
    event => {
      const receiptButton =
        isCurrentReceiptTrigger(
          event.target,
        );

      if (receiptButton) {
        const context =
          currentReceiptContext();

        const api =
          window.UbuzimaReceipt;

        if (
          context &&
          api &&
          typeof api.openReceipt ===
            "function"
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          try {
            const result =
              api.openReceipt(
                context,
              );

            state.receiptOpenCount +=
              1;

            if (
              result &&
              typeof result.catch ===
                "function"
            ) {
              result.catch(
                error => {
                  state.receiptFailureCount +=
                    1;

                  state.lastError =
                    error instanceof Error
                      ? error.message
                      : String(error);
                },
              );
            }
          } catch (error) {
            state.receiptFailureCount +=
              1;

            state.lastError =
              error instanceof Error
                ? error.message
                : String(error);
          }

          return;
        }
      }

      const button =
        event.target instanceof Element
          ? event.target.closest(
              "button, a, [role='button']",
            )
          : null;

      const text =
        lower(
          button?.textContent,
        );

      if (
        text.includes("refresh") ||
        text.includes("sales register") ||
        text.includes("recent") ||
        text === "sales"
      ) {
        scheduleRefresh(180);
        scheduleRefresh(700);
      }
    },
    true,
  );

  restoreCurrentSale();
  resolveStoredContext();
  installPopupCentering();

  window
    .__UBUZIMA_SALES_RECORDING_INTEGRITY_V3_3__ =
      Object.freeze({
        version:
          VERSION,

        refresh() {
          return refreshData();
        },

        diagnostics() {
          return {
            version:
              VERSION,

            auth_seen:
              Boolean(
                state.auth,
              ),

            tenant_seen:
              Boolean(
                state.tenant,
              ),

            branch_id:
              state.branchId,

            checkout_captured:
              state.checkoutCaptured,

            current_sale_id:
              state.currentSale
                ?.sale_id ??
              null,

            current_sale_number:
              state.currentSale
                ?.sale_number ??
              "",

            recent_api_seen:
              state.recentApiSeen,

            sales_api_seen:
              state.salesApiSeen,

            recent_cache_count:
              state.recentCache.size,

            sales_cache_count:
              state.salesCache.size,

            recent_table_found:
              state.recentTableFound,

            sales_register_found:
              state.salesRegisterFound,

            recent_rows_injected:
              state.recentRowsInjected,

            recent_rows_enriched:
              state.recentRowsEnriched,

            register_rows_injected:
              state.registerRowsInjected,

            register_rows_enriched:
              state.registerRowsEnriched,

            receipt_bridge_uses_current_checkout:
              true,

            receipt_bridge_open_count:
              state.receiptOpenCount,

            receipt_bridge_failure_count:
              state.receiptFailureCount,

            popup_center_override:
              state.popupCenterOverride,

            mutation_observer:
              false,

            polling:
              false,

            inventory_interception:
              false,

            finance_interception:
              false,

            receipt_download_interception:
              false,

            last_error:
              state.lastError,
          };
        },
      });

  scheduleRefresh(700);
  scheduleRefresh(1800);
  scheduleRefresh(4200);

  console.info(
    "[Ubuzima+] Sales Recording Integrity V3.3 loaded.",
    VERSION,
  );
})();

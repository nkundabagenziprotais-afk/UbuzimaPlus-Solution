(() => {
  "use strict";

  const VERSION =
    "2026.08.sales-recording-integrity-v3.4-final-ui";

  if (
    window
      .__UBUZIMA_SALES_RECORDING_INTEGRITY_V3_4__
  ) {
    return;
  }

  const state = {
    auth: "",
    tenant: "",
    branchId: null,

    recentCache:
      new Map(),

    salesCache:
      new Map(),

    recentTableFound:
      false,

    registerTableFound:
      false,

    recentInjected:
      0,

    recentEnriched:
      0,

    registerInjected:
      0,

    registerEnriched:
      0,

    recentStatusRemoved:
      false,

    recentDuplicatePhoneRemoved:
      0,

    recentDuplicateProductsRemoved:
      0,

    recentScrollEnabled:
      false,

    rwandaTimeFormat:
      "DD MMM YYYY, HH:mm CAT",

    popupAcceptedStyle:
      false,

    receiptInterception:
      false,

    receiptAdapterDelegated:
      true,

    lastError:
      "",
  };

  const parentFetch =
    window.fetch.bind(window);

  // ----------------------------------------------------------
  // Basic helpers
  // ----------------------------------------------------------

  function clean(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .replace(
        /\s+/g,
        " ",
      )
      .trim();
  }

  function lower(value) {
    return clean(value)
      .toLowerCase();
  }

  function numberOrNull(value) {
    const parsed =
      Number(value);

    return (
      Number.isFinite(parsed)
      &&
      parsed > 0
    )
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
      typeof value !== "string"
      ||
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

  function normalHeader(value) {
    return lower(value)
      .replace(
        /[^a-z0-9]+/g,
        " ",
      )
      .trim();
  }

  // ----------------------------------------------------------
  // Rwanda-friendly timestamp
  //
  // Example:
  //   2026-08-08T17:01:20.000000Z
  // becomes:
  //   08 Aug 2026, 19:01 CAT
  // ----------------------------------------------------------

  function normalizeIso(value) {
    const text =
      clean(value);

    if (!text) {
      return "";
    }

    return text.replace(
      /(\.\d{3})\d+Z$/i,
      "$1Z",
    );
  }

  function formatRwandaTimestamp(
    value,
  ) {
    const raw =
      normalizeIso(value);

    if (!raw) {
      return "";
    }

    const date =
      new Date(raw);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return clean(value);
    }

    try {
      const output =
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

            hour12:
              false,
          },
        ).format(date);

      return `${output} CAT`;
    } catch (_) {
      return clean(value);
    }
  }

  // ----------------------------------------------------------
  // Session / tenant / branch context
  // ----------------------------------------------------------

  function storedObjects() {
    const objects = [];

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
          const value =
            storage.getItem(key);

          if (value) {
            objects.push(
              safeJson(value),
            );
          }
        } catch (_) {}
      }
    }

    return objects;
  }

  function deepValue(
    object,
    candidates,
    depth = 0,
  ) {
    if (
      !object
      ||
      typeof object !== "object"
      ||
      depth > 4
    ) {
      return "";
    }

    for (
      const key
      of candidates
    ) {
      if (
        Object.prototype
          .hasOwnProperty
          .call(
            object,
            key,
          )
      ) {
        const value =
          clean(
            object[key],
          );

        if (value) {
          return value;
        }
      }
    }

    for (
      const value
      of Object.values(
        object,
      )
    ) {
      if (
        value &&
        typeof value === "object"
      ) {
        const found =
          deepValue(
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

  function resolveContext() {
    if (!state.auth) {
      for (
        const object
        of storedObjects()
      ) {
        const token =
          deepValue(
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
            token
              .toLowerCase()
              .startsWith(
                "bearer ",
              )
              ? token
              : `Bearer ${token}`;

          break;
        }
      }
    }

    if (!state.tenant) {
      for (
        const storage
        of [
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
                storage.getItem(
                  key,
                ),
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
          const object
          of storedObjects()
        ) {
          const slug =
            clean(
              object
                ?.tenant_slug
              ||
              object
                ?.tenantSlug
              ||
              object
                ?.tenant
                ?.slug
              ||
              object
                ?.profile
                ?.tenant
                ?.slug
              ||
              object
                ?.user
                ?.tenant
                ?.slug,
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
        const api =
          window
            .__UBUZIMA_POS_TERMINAL_V5__;

        if (
          api &&
          typeof api.diagnostics ===
            "function"
        ) {
          const diagnostics =
            api.diagnostics();

          state.branchId =
            numberOrNull(
              diagnostics
                ?.branch_id,
            );
        }
      } catch (_) {}
    }
  }

  function captureRequestContext(
    input,
    init,
  ) {
    let raw = "";

    if (
      typeof input === "string"
      ||
      input instanceof URL
    ) {
      raw =
        String(input);
    } else if (
      input &&
      typeof input.url ===
        "string"
    ) {
      raw =
        input.url;
    }

    let url;

    try {
      url =
        new URL(
          raw,
          location.origin,
        );
    } catch (_) {
      return null;
    }

    let method =
      clean(
        init?.method
        ||
        input?.method
        ||
        "GET",
      ).toUpperCase();

    if (!method) {
      method =
        "GET";
    }

    const headers =
      new Headers();

    try {
      if (
        input &&
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
        headers.get(
          "Authorization",
        ),
      );

    const tenant =
      clean(
        headers.get(
          "X-Tenant-Slug",
        )
        ||
        headers.get(
          "X-Tenant",
        ),
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

    return {
      url,
      method,
    };
  }

  // ----------------------------------------------------------
  // Sale values
  // ----------------------------------------------------------

  function metadataOf(sale) {
    return safeJson(
      sale?.metadata,
    );
  }

  function saleNumberOf(sale) {
    return (
      clean(
        sale
          ?.sale_number,
      )
      ||
      clean(
        sale
          ?.sale_no,
      )
      ||
      clean(
        sale
          ?.reference,
      )
      ||
      clean(
        sale
          ?.number,
      )
    );
  }

  function customerOf(sale) {
    const metadata =
      metadataOf(sale);

    return (
      clean(
        sale
          ?.transaction_customer_name,
      )
      ||
      clean(
        metadata
          ?.transaction_customer_name,
      )
      ||
      clean(
        metadata
          ?.walk_in_customer
          ?.name,
      )
      ||
      clean(
        sale
          ?.customer
          ?.full_name,
      )
      ||
      clean(
        sale
          ?.customer
          ?.name,
      )
      ||
      clean(
        sale
          ?.customer_name,
      )
      ||
      "Walk-in"
    );
  }

  function phoneTinOf(sale) {
    const metadata =
      metadataOf(sale);

    return (
      clean(
        sale
          ?.transaction_customer_phone_tin,
      )
      ||
      clean(
        metadata
          ?.transaction_customer_phone_tin,
      )
      ||
      clean(
        metadata
          ?.walk_in_customer
          ?.phone_tin,
      )
      ||
      clean(
        sale
          ?.customer
          ?.phone_tin,
      )
      ||
      clean(
        sale
          ?.customer
          ?.tin,
      )
      ||
      clean(
        sale
          ?.customer
          ?.phone,
      )
      ||
      clean(
        sale
          ?.customer_phone_tin,
      )
    );
  }

  function saleItems(sale) {
    for (
      const candidate
      of [
        sale?.items,
        sale?.products,
        sale?.sale_items,
      ]
    ) {
      if (
        Array.isArray(
          candidate,
        )
        &&
        candidate.length
      ) {
        return candidate;
      }
    }

    return [];
  }

  function itemName(item) {
    return (
      clean(
        item
          ?.product_name_snapshot,
      )
      ||
      clean(
        item
          ?.product_name,
      )
      ||
      clean(
        item
          ?.product
          ?.name,
      )
      ||
      clean(
        item
          ?.name,
      )
      ||
      "Product"
    );
  }

  function itemQuantity(item) {
    const value =
      Number(
        item
          ?.quantity
        ??
        item
          ?.qty
        ??
        0,
      );

    return Number.isFinite(
      value,
    )
      ? value
      : 0;
  }

  function productsOf(sale) {
    const direct =
      clean(
        sale
          ?.product_summary,
      );

    if (direct) {
      return direct;
    }

    const items =
      saleItems(sale);

    if (!items.length) {
      return clean(
        sale
          ?.products_summary,
      );
    }

    return items
      .map(
        item => {
          const name =
            itemName(item);

          const quantity =
            itemQuantity(
              item,
            );

          return (
            quantity > 0
          )
            ? `${name} × ${quantity}`
            : name;
        },
      )
      .filter(Boolean)
      .join("; ");
  }

  function itemCountOf(sale) {
    const items =
      saleItems(sale);

    if (items.length) {
      return items.length;
    }

    const value =
      Number(
        sale
          ?.items_count
        ??
        sale
          ?.item_count
        ??
        0,
      );

    return Number.isFinite(
      value,
    )
      ? value
      : 0;
  }

  function eligible(sale) {
    return (
      lower(
        sale?.status,
      ) ===
        "dispensed"
      &&
      lower(
        sale
          ?.payment_status,
      ) ===
        "paid"
    );
  }

  function mergeSale(
    oldSale,
    newSale,
  ) {
    if (!oldSale) {
      return newSale;
    }

    const merged = {
      ...oldSale,
      ...newSale,
    };

    if (
      saleItems(
        newSale,
      ).length === 0
      &&
      saleItems(
        oldSale,
      ).length > 0
    ) {
      merged.items =
        saleItems(
          oldSale,
        );
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

  function payloadList(
    payload,
  ) {
    if (
      Array.isArray(payload)
    ) {
      return payload;
    }

    for (
      const key of [
        "transactions",
        "sales",
        "data",
      ]
    ) {
      const value =
        payload?.[key];

      if (
        Array.isArray(value)
      ) {
        return value;
      }

      if (
        value &&
        Array.isArray(
          value.data,
        )
      ) {
        return value.data;
      }
    }

    if (
      payload?.data &&
      Array.isArray(
        payload
          .data
          .data,
      )
    ) {
      return payload
        .data
        .data;
    }

    return [];
  }

  function cachePayload(
    map,
    payload,
  ) {
    for (
      const sale
      of payloadList(
        payload,
      )
    ) {
      if (
        sale &&
        typeof sale ===
          "object"
      ) {
        cacheSale(
          map,
          sale,
        );
      }
    }
  }

  function allEligibleSales() {
    const merged =
      new Map();

    for (
      const map
      of [
        state.salesCache,
        state.recentCache,
      ]
    ) {
      for (
        const [number, sale]
        of map.entries()
      ) {
        merged.set(
          number,
          mergeSale(
            merged.get(number),
            sale,
          ),
        );
      }
    }

    return Array.from(
      merged.values(),
    )
      .filter(
        eligible,
      )
      .sort(
        (a, b) => {
          const aDate =
            Date.parse(
              normalizeIso(
                a?.transaction_timestamp
                ||
                a?.sold_at
                ||
                a?.created_at,
              ),
            ) || 0;

          const bDate =
            Date.parse(
              normalizeIso(
                b?.transaction_timestamp
                ||
                b?.sold_at
                ||
                b?.created_at,
              ),
            ) || 0;

          return (
            bDate - aDate
          );
        },
      );
  }

  // ----------------------------------------------------------
  // API refresh
  // ----------------------------------------------------------

  function apiHeaders() {
    resolveContext();

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

  function branchUrl(path) {
    const url =
      new URL(
        path,
        location.origin,
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
      url.pathname
      +
      url.search
    );
  }

  async function getJson(path) {
    const headers =
      apiHeaders();

    if (
      !headers.get(
        "Authorization",
      )
      ||
      !headers.get(
        "X-Tenant-Slug",
      )
    ) {
      return null;
    }

    const response =
      await parentFetch(
        branchUrl(path),
        {
          method:
            "GET",

          headers,

          credentials:
            "same-origin",

          cache:
            "no-store",
        },
      );

    if (!response.ok) {
      throw new Error(
        `Sales hydration HTTP ${response.status}`,
      );
    }

    return response.json();
  }

  async function refreshData() {
    resolveContext();

    try {
      const [
        recent,
        sales,
      ] =
        await Promise.all([
          getJson(
            "/api/v1/pharmaco/pos/recent-transactions?current_session=0&limit=50&status=dispensed",
          ),

          getJson(
            "/api/v1/pharmaco/sales?status=dispensed&payment_status=paid",
          ),
        ]);

      if (recent) {
        cachePayload(
          state.recentCache,
          recent,
        );
      }

      if (sales) {
        cachePayload(
          state.salesCache,
          sales,
        );
      }
    } catch (error) {
      state.lastError =
        error instanceof Error
          ? error.message
          : String(error);
    }

    repairAndHydrate();
  }

  // ----------------------------------------------------------
  // Table helpers
  // ----------------------------------------------------------

  function headers(table) {
    return Array.from(
      table.querySelectorAll(
        "thead th",
      ),
    );
  }

  function headerIndexes(
    table,
    candidates,
  ) {
    const wanted =
      candidates.map(
        normalHeader,
      );

    const indexes = [];

    headers(table)
      .forEach(
        (cell, index) => {
          if (
            wanted.includes(
              normalHeader(
                cell.textContent,
              ),
            )
          ) {
            indexes.push(
              index,
            );
          }
        },
      );

    return indexes;
  }

  function firstHeaderIndex(
    table,
    candidates,
  ) {
    const indexes =
      headerIndexes(
        table,
        candidates,
      );

    return indexes.length
      ? indexes[0]
      : -1;
  }

  function removeColumn(
    table,
    index,
  ) {
    if (index < 0) {
      return;
    }

    for (
      const row
      of table.querySelectorAll(
        "thead tr, tbody tr",
      )
    ) {
      const cell =
        row.children[index];

      if (cell) {
        cell.remove();
      }
    }
  }

  function removeDuplicateColumn(
    table,
    candidates,
  ) {
    const indexes =
      headerIndexes(
        table,
        candidates,
      );

    if (indexes.length <= 1) {
      return 0;
    }

    const extra =
      indexes
        .slice(1)
        .sort(
          (a, b) =>
            b - a,
        );

    for (
      const index
      of extra
    ) {
      removeColumn(
        table,
        index,
      );
    }

    return extra.length;
  }

  function removeAllColumns(
    table,
    candidates,
  ) {
    const indexes =
      headerIndexes(
        table,
        candidates,
      )
        .sort(
          (a, b) =>
            b - a,
        );

    for (
      const index
      of indexes
    ) {
      removeColumn(
        table,
        index,
      );
    }

    return indexes.length;
  }

  function rowSaleNumber(
    table,
    row,
  ) {
    const index =
      firstHeaderIndex(
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
      const number =
        clean(
          row.cells[index]
            ?.textContent,
        );

      if (number) {
        return number;
      }
    }

    const text =
      clean(
        row.textContent,
      );

    for (
      const number
      of new Set([
        ...state
          .recentCache
          .keys(),

        ...state
          .salesCache
          .keys(),
      ])
    ) {
      if (
        text.includes(
          number,
        )
      ) {
        return number;
      }
    }

    return "";
  }

  function saleFor(number) {
    return (
      state.salesCache
        .get(number)
      ||
      state.recentCache
        .get(number)
      ||
      null
    );
  }

  function placeholder(row) {
    const text =
      lower(
        row?.textContent,
      );

    return (
      row?.cells?.length ===
        1
      ||
      text.includes(
        "no recent sales",
      )
      ||
      text.includes(
        "no recent transactions",
      )
      ||
      text.includes(
        "no records",
      )
    );
  }

  function writeCell(
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
    }
  }

  function formatNativeTimestamp(
    table,
    row,
  ) {
    const index =
      firstHeaderIndex(
        table,
        [
          "Transaction Timestamp",
          "Timestamp",
        ],
      );

    if (
      index < 0
      ||
      !row.cells[index]
    ) {
      return;
    }

    const original =
      row.cells[index]
        .dataset
        .ubuzimaOriginalTimestamp
      ||
      clean(
        row.cells[index]
          .textContent,
      );

    if (!original) {
      return;
    }

    row.cells[index]
      .dataset
      .ubuzimaOriginalTimestamp =
        original;

    row.cells[index]
      .textContent =
        formatRwandaTimestamp(
          original,
        );
  }

  function enrichRow(
    table,
    row,
    sale,
    register,
  ) {
    const customerIndex =
      firstHeaderIndex(
        table,
        ["Customer"],
      );

    const phoneIndex =
      firstHeaderIndex(
        table,
        [
          "Phone/TIN",
          "Phone TIN",
          "Customer Phone/TIN",
        ],
      );

    const productsIndex =
      firstHeaderIndex(
        table,
        ["Products"],
      );

    const itemsIndex =
      firstHeaderIndex(
        table,
        ["Items"],
      );

    writeCell(
      row,
      customerIndex,
      customerOf(sale),
      true,
    );

    writeCell(
      row,
      phoneIndex,
      phoneTinOf(sale),
      true,
    );

    writeCell(
      row,
      productsIndex,
      productsOf(sale),
      true,
    );

    if (
      register &&
      itemsIndex >= 0
    ) {
      writeCell(
        row,
        itemsIndex,
        itemCountOf(sale),
      );
    }

    if (!register) {
      formatNativeTimestamp(
        table,
        row,
      );
    }
  }

  function valueForHeader(
    header,
    sale,
    serial,
  ) {
    const key =
      normalHeader(header);

    if (
      key === "sn"
      ||
      key === "no"
    ) {
      return String(serial);
    }

    if (
      key ===
        "transaction timestamp"
      ||
      key === "timestamp"
    ) {
      return formatRwandaTimestamp(
        sale
          ?.transaction_timestamp
        ||
        sale
          ?.sold_at
        ||
        sale
          ?.created_at,
      );
    }

    if (
      key ===
        "business date"
    ) {
      return clean(
        sale
          ?.business_date,
      );
    }

    if (
      key.includes(
        "sale no",
      )
      ||
      key.includes(
        "sale number",
      )
      ||
      key === "sale"
    ) {
      return saleNumberOf(
        sale,
      );
    }

    if (
      key === "customer"
    ) {
      return customerOf(
        sale,
      );
    }

    if (
      key.includes(
        "phone",
      )
      ||
      key.includes(
        "tin",
      )
    ) {
      return phoneTinOf(
        sale,
      );
    }

    if (
      key === "products"
    ) {
      return productsOf(
        sale,
      );
    }

    if (
      key === "items"
    ) {
      return itemCountOf(
        sale,
      );
    }

    if (
      key === "method"
      ||
      key.includes(
        "payment method",
      )
    ) {
      return (
        clean(
          sale
            ?.payment_method,
        )
        ||
        clean(
          sale
            ?.payment
            ?.method,
        )
      );
    }

    if (
      key === "total"
      ||
      key.includes(
        "total amount",
      )
    ) {
      return clean(
        sale
          ?.total_amount
        ??
        sale
          ?.total,
      );
    }

    if (
      key.includes(
        "original price",
      )
    ) {
      return clean(
        sale
          ?.original_price,
      );
    }

    if (
      key.includes(
        "used price",
      )
    ) {
      return clean(
        sale
          ?.used_price,
      );
    }

    if (
      key === "difference"
      ||
      key.includes(
        "price difference",
      )
    ) {
      return clean(
        sale
          ?.price_difference,
      );
    }

    if (
      key === "actions"
      ||
      key === "action"
    ) {
      return "—";
    }

    return "—";
  }

  function makeRow(
    table,
    sale,
    serial,
    kind,
  ) {
    const row =
      document.createElement(
        "tr",
      );

    row.dataset
      .ubuzimaSalesV34Row =
        kind;

    for (
      const header
      of headers(table)
    ) {
      const td =
        document.createElement(
          "td",
        );

      const key =
        normalHeader(
          header.textContent,
        );

      td.textContent =
        clean(
          valueForHeader(
            header.textContent,
            sale,
            serial,
          ),
        )
        ||
        "—";

      if (
        key === "customer"
        ||
        key === "products"
        ||
        key.includes(
          "phone",
        )
        ||
        key.includes(
          "tin",
        )
      ) {
        td.style.whiteSpace =
          "normal";

        td.style.overflowWrap =
          "anywhere";
      }

      row.appendChild(
        td,
      );
    }

    return row;
  }

  function removeV34Rows(table) {
    table
      .querySelectorAll(
        "tbody tr[data-ubuzima-sales-v34-row]",
      )
      .forEach(
        row => {
          row.remove();
        },
      );
  }

  // ----------------------------------------------------------
  // Recent Sales presentation correction
  // ----------------------------------------------------------

  function recentTable() {
    return document.querySelector(
      ".pos-recent-transactions-bottom table",
    );
  }

  function registerTable() {
    return document.querySelector(
      ".managed-sales-main-table",
    );
  }

  function fixRecentColumns(
    table,
  ) {
    state
      .recentDuplicatePhoneRemoved =
      removeDuplicateColumn(
        table,
        [
          "Phone/TIN",
          "Phone TIN",
          "Customer Phone/TIN",
        ],
      );

    state
      .recentDuplicateProductsRemoved =
      removeDuplicateColumn(
        table,
        ["Products"],
      );

    const removedStatus =
      removeAllColumns(
        table,
        ["Status"],
      );

    state.recentStatusRemoved =
      (
        removedStatus > 0
        ||
        firstHeaderIndex(
          table,
          ["Status"],
        ) < 0
      );
  }

  function enableRecentScrolling(
    table,
  ) {
    const section =
      table.closest(
        ".pos-recent-transactions-bottom",
      );

    const viewport =
      table.parentElement
      ||
      section;

    if (!viewport) {
      return;
    }

    viewport.dataset
      .ubuzimaSalesV34Scroll =
        "enabled";

    viewport.style
      .maxHeight =
        "min(58vh, 620px)";

    viewport.style
      .overflowY =
        "auto";

    viewport.style
      .overflowX =
        "auto";

    viewport.style
      .overscrollBehavior =
        "contain";

    viewport.style
      .scrollbarGutter =
        "stable";

    table.style
      .minWidth =
        "1180px";

    table.style
      .width =
        "100%";

    for (
      const th
      of table.querySelectorAll(
        "thead th",
      )
    ) {
      th.style.position =
        "sticky";

      th.style.top =
        "0";

      th.style.zIndex =
        "3";

      th.style.background =
        "#ffffff";
    }

    state.recentScrollEnabled =
      true;
  }

  function hydrateRecent(
    table,
  ) {
    fixRecentColumns(
      table,
    );

    enableRecentScrolling(
      table,
    );

    removeV34Rows(
      table,
    );

    const body =
      table.tBodies?.[0]
      ||
      table.querySelector(
        "tbody",
      );

    if (!body) {
      return;
    }

    const nativeRows =
      Array.from(
        body.rows,
      );

    const existing =
      new Set();

    let enriched =
      0;

    for (
      const row
      of nativeRows
    ) {
      if (
        placeholder(
          row,
        )
      ) {
        continue;
      }

      const number =
        rowSaleNumber(
          table,
          row,
        );

      if (!number) {
        formatNativeTimestamp(
          table,
          row,
        );

        continue;
      }

      existing.add(
        number,
      );

      const sale =
        saleFor(
          number,
        );

      if (
        sale &&
        eligible(sale)
      ) {
        enrichRow(
          table,
          row,
          sale,
          false,
        );

        enriched += 1;
      } else {
        formatNativeTimestamp(
          table,
          row,
        );
      }
    }

    const missing =
      allEligibleSales()
        .filter(
          sale =>
            !existing.has(
              saleNumberOf(
                sale,
              ),
            ),
        )
        .slice(
          0,
          20,
        );

    let injected =
      0;

    for (
      let i =
        missing.length - 1;
      i >= 0;
      i -= 1
    ) {
      body.insertBefore(
        makeRow(
          table,
          missing[i],
          i + 1,
          "recent",
        ),
        body.firstChild,
      );

      injected += 1;
    }

    for (
      const row
      of nativeRows
    ) {
      if (
        placeholder(
          row,
        )
        &&
        (
          injected > 0
          ||
          enriched > 0
        )
      ) {
        row.style.display =
          "none";
      }
    }

    state.recentInjected =
      injected;

    state.recentEnriched =
      enriched;
  }

  // ----------------------------------------------------------
  // Sales Register
  //
  // Already accepted in V3.3.
  // Keep hydration, but do not add/remove/reorder its columns.
  // ----------------------------------------------------------

  function hydrateRegister(
    table,
  ) {
    removeV34Rows(
      table,
    );

    const body =
      table.tBodies?.[0]
      ||
      table.querySelector(
        "tbody",
      );

    if (!body) {
      return;
    }

    const nativeRows =
      Array.from(
        body.rows,
      );

    const existing =
      new Set();

    let enriched =
      0;

    for (
      const row
      of nativeRows
    ) {
      if (
        placeholder(
          row,
        )
      ) {
        continue;
      }

      const number =
        rowSaleNumber(
          table,
          row,
        );

      if (!number) {
        continue;
      }

      existing.add(
        number,
      );

      const sale =
        saleFor(
          number,
        );

      if (
        sale &&
        eligible(sale)
      ) {
        enrichRow(
          table,
          row,
          sale,
          true,
        );

        enriched += 1;
      }
    }

    const missing =
      allEligibleSales()
        .filter(
          sale =>
            !existing.has(
              saleNumberOf(
                sale,
              ),
            ),
        )
        .slice(
          0,
          50,
        );

    let injected =
      0;

    for (
      let i =
        missing.length - 1;
      i >= 0;
      i -= 1
    ) {
      body.insertBefore(
        makeRow(
          table,
          missing[i],
          i + 1,
          "register",
        ),
        body.firstChild,
      );

      injected += 1;
    }

    for (
      const row
      of nativeRows
    ) {
      if (
        placeholder(
          row,
        )
        &&
        (
          injected > 0
          ||
          enriched > 0
        )
      ) {
        row.style.display =
          "none";
      }
    }

    state.registerInjected =
      injected;

    state.registerEnriched =
      enriched;
  }

  function repairAndHydrate() {
    try {
      const recent =
        recentTable();

      state.recentTableFound =
        Boolean(recent);

      if (recent) {
        hydrateRecent(
          recent,
        );
      }

      const register =
        registerTable();

      state.registerTableFound =
        Boolean(register);

      if (register) {
        hydrateRegister(
          register,
        );
      }
    } catch (error) {
      state.lastError =
        error instanceof Error
          ? error.message
          : String(error);
    }
  }

  // ----------------------------------------------------------
  // Fetch observation
  //
  // Data only.
  // NO Receipt interception.
  // NO Finance interception.
  // NO Inventory interception.
  // ----------------------------------------------------------

  async function inspectResponse(
    info,
    response,
  ) {
    if (!response?.ok) {
      return;
    }

    const path =
      info.url.pathname;

    const recent =
      info.method === "GET"
      &&
      path.endsWith(
        "/pharmaco/pos/recent-transactions",
      );

    const sales =
      info.method === "GET"
      &&
      path.endsWith(
        "/pharmaco/sales",
      );

    const checkout =
      info.method === "POST"
      &&
      path.endsWith(
        "/pharmaco/sales/checkout",
      );

    if (
      !recent
      &&
      !sales
      &&
      !checkout
    ) {
      return;
    }

    if (checkout) {
      window.setTimeout(
        () => {
          void refreshData();
        },
        350,
      );

      window.setTimeout(
        () => {
          void refreshData();
        },
        1200,
      );

      return;
    }

    let payload;

    try {
      payload =
        await response.json();
    } catch (_) {
      return;
    }

    if (recent) {
      cachePayload(
        state.recentCache,
        payload,
      );
    }

    if (sales) {
      cachePayload(
        state.salesCache,
        payload,
      );
    }

    repairAndHydrate();
  }

  window.fetch =
    async function (
      input,
      init,
    ) {
      const info =
        captureRequestContext(
          input,
          init,
        );

      const response =
        await parentFetch(
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

  // ----------------------------------------------------------
  // RESTORE EXACT ACCEPTED QUANTITY / PRICE POPUP
  //
  // This reproduces the previously accepted centered form:
  // - 500px desktop width
  // - two equal columns
  // - centered fixed dialog
  // - same compact quantity / price layout
  // - no side panel positioning
  // ----------------------------------------------------------

  function installAcceptedPopupStyle() {
    document
      .getElementById(
        "ubuzima-sales-v33-popup-centering",
      )
      ?.remove();

    if (
      document.getElementById(
        "ubuzima-sales-v34-accepted-popup",
      )
    ) {
      state.popupAcceptedStyle =
        true;

      return;
    }

    const style =
      document.createElement(
        "style",
      );

    style.id =
      "ubuzima-sales-v34-accepted-popup";

    style.textContent = `
html:not(.ubuzima-mobile-pwa-active) .pos-quantity-dialog-backdrop,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-backdrop {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100dvh !important;
  display: grid !important;
  place-items: center !important;
  padding: 16px !important;
  box-sizing: border-box !important;
}

html:not(.ubuzima-mobile-pwa-active) .pos-quantity-dialog,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog {
  position: fixed !important;
  left: 50% !important;
  right: auto !important;
  top: calc(50% - 42px) !important;
  bottom: auto !important;
  transform: translate(-50%, -50%) !important;

  z-index: 10031 !important;

  width: min(500px, calc(100vw - 34px)) !important;
  max-width: min(500px, calc(100vw - 34px)) !important;

  height: auto !important;
  min-height: 0 !important;
  max-height: min(430px, calc(100dvh - 142px)) !important;

  display: grid !important;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
  grid-auto-rows: auto !important;

  gap: 10px !important;
  align-content: start !important;

  margin: 0 !important;
  padding: 16px !important;

  border: 1px solid rgba(15, 118, 110, 0.16) !important;
  border-radius: 20px !important;

  background: #ffffff !important;
  color: #10211b !important;

  box-shadow: 0 30px 90px rgba(15, 23, 42, 0.34) !important;

  overflow: hidden !important;
  box-sizing: border-box !important;
}

html:not(.ubuzima-mobile-pwa-active) .pos-quantity-dialog__header,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog > header,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog > h1,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog > h2,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog > h3,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog > p,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-grid-item--full,
html:not(.ubuzima-mobile-pwa-active) .pos-quantity-readonly-grid,
html:not(.ubuzima-mobile-pwa-active) .pos-quantity-total-strip,
html:not(.ubuzima-mobile-pwa-active) .pos-quantity-dialog footer,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog footer,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog [class*="actions"],
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog .modal-footer {
  grid-column: 1 / -1 !important;
}

html:not(.ubuzima-mobile-pwa-active) .pos-quantity-dialog__header {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) auto !important;
  gap: 8px !important;
  align-items: start !important;
  padding: 0 0 4px !important;
}

html:not(.ubuzima-mobile-pwa-active) .pos-quantity-selling-unit-hero,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-grid-item--quantity {
  grid-column: 1 !important;
  grid-row: auto !important;
}

html:not(.ubuzima-mobile-pwa-active) .pos-quantity-price-override-card,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-grid-item--price {
  grid-column: 2 !important;
  grid-row: auto !important;
}

html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-grid {
  grid-column: 1 / -1 !important;

  display: grid !important;

  grid-template-columns:
    minmax(0, 1fr)
    minmax(0, 1fr) !important;

  gap: 10px !important;
  align-items: start !important;

  width: 100% !important;
  max-width: 100% !important;
}

html:not(.ubuzima-mobile-pwa-active) .pos-quantity-selling-unit-hero,
html:not(.ubuzima-mobile-pwa-active) .pos-quantity-price-override-card,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-field {
  min-width: 0 !important;

  display: grid !important;

  gap: 6px !important;
  align-content: start !important;

  margin: 0 !important;
  padding: 10px !important;

  border: 1px solid rgba(15, 118, 110, 0.12) !important;
  border-radius: 14px !important;

  background: #f8fbfa !important;

  box-shadow: none !important;
}

html:not(.ubuzima-mobile-pwa-active) .pos-quantity-dialog input,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog input,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog select {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;

  min-height: 42px !important;
  height: 42px !important;

  padding: 8px 10px !important;

  border-radius: 12px !important;

  box-sizing: border-box !important;
}

html:not(.ubuzima-mobile-pwa-active) .pos-quantity-readonly-grid {
  display: grid !important;

  grid-template-columns:
    repeat(3, minmax(0, 1fr)) !important;

  gap: 7px !important;
}

html:not(.ubuzima-mobile-pwa-active) .pos-quantity-total-strip {
  min-height: 40px !important;

  display: flex !important;

  align-items: center !important;
  justify-content: space-between !important;

  gap: 10px !important;

  padding: 9px 10px !important;

  border-radius: 14px !important;
}

html:not(.ubuzima-mobile-pwa-active) .pos-quantity-dialog footer,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog footer,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog [class*="actions"],
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog .modal-footer {
  display: flex !important;

  justify-content: flex-end !important;

  gap: 8px !important;

  margin: 0 !important;
  padding: 0 !important;
}

@media (max-width: 767px) {
  .pos-quantity-dialog,
  .ubuzima-pos-confirmation-dialog {
    top: 50% !important;

    width: min(420px, calc(100vw - 22px)) !important;
    max-width: min(420px, calc(100vw - 22px)) !important;

    max-height: min(410px, calc(100dvh - 28px)) !important;

    gap: 8px !important;

    padding: 13px !important;

    border-radius: 18px !important;
  }

  .pos-quantity-selling-unit-hero,
  .pos-quantity-price-override-card,
  .ubuzima-pos-confirmation-field {
    padding: 8px !important;
  }
}
`;

    document.head
      .appendChild(
        style,
      );

    state.popupAcceptedStyle =
      true;
  }

  // ----------------------------------------------------------
  // IMPORTANT RECEIPT BOUNDARY
  //
  // V3.4 intentionally DOES NOT intercept receipt clicks.
  //
  // The locked Adapter V5 already:
  //   - resolves the live React completed-sale handler;
  //   - captures real persisted sale context;
  //   - resolves tenant slug;
  //   - invokes the locked UbuzimaReceipt API.
  //
  // V3.4 therefore returns receipt ownership to Adapter V5.
  // ----------------------------------------------------------

  // No receipt click handler intentionally.

  // ----------------------------------------------------------
  // User-driven refresh hooks — no polling / no observer
  // ----------------------------------------------------------

  function scheduleRefresh() {
    for (
      const delay
      of [
        80,
        280,
        750,
      ]
    ) {
      window.setTimeout(
        () => {
          repairAndHydrate();
        },
        delay,
      );
    }
  }

  document.addEventListener(
    "click",
    event => {
      const target =
        event.target instanceof Element
          ? event.target.closest(
              "button,a,[role='button']",
            )
          : null;

      const text =
        lower(
          target?.textContent,
        );

      if (
        text.includes(
          "refresh",
        )
        ||
        text.includes(
          "sales",
        )
        ||
        text.includes(
          "recent",
        )
      ) {
        window.setTimeout(
          () => {
            void refreshData();
          },
          180,
        );
      }

      scheduleRefresh();
    },
    false,
  );

  window.addEventListener(
    "popstate",
    scheduleRefresh,
  );

  window.addEventListener(
    "hashchange",
    scheduleRefresh,
  );

  window.addEventListener(
    "resize",
    scheduleRefresh,
  );

  // ----------------------------------------------------------
  // Start
  // ----------------------------------------------------------

  resolveContext();

  installAcceptedPopupStyle();

  window
    .__UBUZIMA_SALES_RECORDING_INTEGRITY_V3_4__ =
      Object.freeze({
        version:
          VERSION,

        refresh() {
          return refreshData();
        },

        diagnostics() {
          const recent =
            recentTable();

          const statusCount =
            recent
              ? headerIndexes(
                  recent,
                  ["Status"],
                ).length
              : null;

          const phoneCount =
            recent
              ? headerIndexes(
                  recent,
                  [
                    "Phone/TIN",
                    "Phone TIN",
                    "Customer Phone/TIN",
                  ],
                ).length
              : null;

          const productsCount =
            recent
              ? headerIndexes(
                  recent,
                  ["Products"],
                ).length
              : null;

          return {
            version:
              VERSION,

            parent_v2_present:
              Boolean(
                document.querySelector(
                  'script[data-ubuzima-sales-recording-integrity-extension="v2"]',
                ),
              ),

            parent_v3_2_present:
              Boolean(
                document.querySelector(
                  'script[data-ubuzima-sales-recording-integrity-amendments="v3-2"]',
                ),
              ),

            rejected_v3_3_active:
              Boolean(
                document.querySelector(
                  'script[data-ubuzima-sales-recording-integrity-hydration="v3-3"]',
                ),
              ),

            current_v3_4_active:
              Boolean(
                document.querySelector(
                  'script[data-ubuzima-sales-recording-integrity-final-ui="v3-4"]',
                ),
              ),

            recent_table_found:
              state.recentTableFound,

            register_table_found:
              state.registerTableFound,

            recent_cache_count:
              state.recentCache.size,

            sales_cache_count:
              state.salesCache.size,

            recent_rows_injected:
              state.recentInjected,

            recent_rows_enriched:
              state.recentEnriched,

            register_rows_injected:
              state.registerInjected,

            register_rows_enriched:
              state.registerEnriched,

            recent_status_column_count:
              statusCount,

            recent_phone_tin_column_count:
              phoneCount,

            recent_products_column_count:
              productsCount,

            recent_status_removed:
              state.recentStatusRemoved,

            recent_duplicate_phone_removed:
              state.recentDuplicatePhoneRemoved,

            recent_duplicate_products_removed:
              state.recentDuplicateProductsRemoved,

            recent_vertical_scroll:
              state.recentScrollEnabled,

            rwanda_timestamp_format:
              state.rwandaTimeFormat,

            popup_accepted_centered_style:
              state.popupAcceptedStyle,

            receipt_interception:
              false,

            receipt_adapter_delegated:
              true,

            receipt_api_available:
              Boolean(
                window.UbuzimaReceipt
                &&
                typeof window
                  .UbuzimaReceipt
                  .openReceipt ===
                    "function",
              ),

            adapter_v5_marker:
              Boolean(
                window
                  .__ubuzimaReceiptIsolatedAdapterV5,
              ),

            mutation_observer:
              false,

            polling:
              false,

            inventory_interception:
              false,

            finance_interception:
              false,

            last_error:
              state.lastError,
          };
        },
      });

  window.setTimeout(
    () => {
      void refreshData();
    },
    650,
  );

  window.setTimeout(
    () => {
      void refreshData();
    },
    1800,
  );

  window.setTimeout(
    () => {
      void refreshData();
    },
    3800,
  );

  console.info(
    "[Ubuzima+] Sales Recording Integrity V3.4 loaded.",
    VERSION,
  );
})();

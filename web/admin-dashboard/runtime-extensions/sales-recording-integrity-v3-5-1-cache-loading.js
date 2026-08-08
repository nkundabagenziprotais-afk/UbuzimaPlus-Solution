(() => {
  "use strict";

  const VERSION =
    "2026.08.sales-recording-integrity-v3.5.1-cache-loading";

  if (
    window
      .__UBUZIMA_SALES_RECORDING_INTEGRITY_V3_5_1__
  ) {
    return;
  }

  const STARTED_AT =
    performance.now();

  const CACHE_PREFIX =
    "ubuzima.sales.integrity.v3.5.1";

  const CACHE_FRESH_MS =
    30_000;

  const CACHE_STALE_MAX_MS =
    300_000;

  const RECENT_COLUMNS = [
    "time",
    "sale",
    "customer",
    "products",
    "payment",
    "total",
  ];

  const parentFetch =
    window.fetch.bind(window);

  const inFlight =
    new Map();

  const state = {
    auth: "",
    tenant: "",
    branchId: null,

    recent:
      new Map(),

    sales:
      new Map(),

    cacheAt: {
      recent:
        0,

      sales:
        0,
    },

    cacheHydrated: {
      recent:
        false,

      sales:
        false,
    },

    cacheHits:
      0,

    cacheMisses:
      0,

    staleCacheHits:
      0,

    cacheWrites:
      0,

    cacheInvalidations:
      0,

    recentNetworkRequests:
      0,

    salesNetworkRequests:
      0,

    deduplicatedRequests:
      0,

    lastNetworkMs:
      0,

    firstCachePaintMs:
      null,

    firstNetworkPaintMs:
      null,

    recentTableFound:
      false,

    registerTableFound:
      false,

    recentRows:
      0,

    registerRows:
      0,

    recentColumns:
      [],

    popupAcceptedStyle:
      false,

    receiptInterception:
      false,

    receiptAdapterDelegated:
      true,

    lastError:
      "",
  };

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  function clean(value) {
    if (
      value === null
      ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function lower(value) {
    return clean(value)
      .toLowerCase();
  }

  function normal(value) {
    return lower(value)
      .replace(
        /[^a-z0-9]+/g,
        " ",
      )
      .trim();
  }

  function positiveNumber(
    value,
  ) {
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

  function safeObject(value) {
    if (
      value
      &&
      typeof value === "object"
    ) {
      return value;
    }

    if (
      typeof value !== "string"
      ||
      !value.trim()
    ) {
      return {};
    }

    try {
      const parsed =
        JSON.parse(value);

      return (
        parsed
        &&
        typeof parsed === "object"
      )
        ? parsed
        : {};
    } catch (_) {
      return {};
    }
  }

  function idle(callback) {
    if (
      typeof window
        .requestIdleCallback ===
        "function"
    ) {
      window.requestIdleCallback(
        callback,
        {
          timeout:
            300,
        },
      );

      return;
    }

    window.setTimeout(
      callback,
      20,
    );
  }

  // ----------------------------------------------------------
  // Rwanda date/time
  // ----------------------------------------------------------

  function isoDate(value) {
    return clean(value)
      .replace(
        /(\.\d{3})\d+Z$/i,
        "$1Z",
      );
  }

  function rwandaDateTime(
    value,
  ) {
    const raw =
      isoDate(value);

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
      const text =
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

      return `${text} CAT`;
    } catch (_) {
      return clean(value);
    }
  }

  // ----------------------------------------------------------
  // Context
  // ----------------------------------------------------------

  function sessionObjects() {
    const output = [];

    for (
      const storage
      of [
        window.sessionStorage,
        window.localStorage,
      ]
    ) {
      if (!storage) {
        continue;
      }

      for (
        const key
        of [
          "ubuzima_admin_session",
          "ubuzima.admin.session",
          "ubuzima.session",
        ]
      ) {
        try {
          const value =
            storage.getItem(key);

          if (value) {
            output.push(
              safeObject(value),
            );
          }
        } catch (_) {}
      }
    }

    return output;
  }

  function deepFind(
    object,
    names,
    depth = 0,
  ) {
    if (
      !object
      ||
      typeof object !==
        "object"
      ||
      depth > 4
    ) {
      return "";
    }

    for (
      const name
      of names
    ) {
      if (
        Object.prototype
          .hasOwnProperty
          .call(
            object,
            name,
          )
      ) {
        const value =
          clean(
            object[name],
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
        value
        &&
        typeof value ===
          "object"
      ) {
        const found =
          deepFind(
            value,
            names,
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
        of sessionObjects()
      ) {
        const token =
          deepFind(
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
          window.sessionStorage,
          window.localStorage,
        ]
      ) {
        if (!storage) {
          continue;
        }

        for (
          const key
          of [
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
          of sessionObjects()
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
        const terminal =
          window
            .__UBUZIMA_POS_TERMINAL_V5__;

        if (
          terminal
          &&
          typeof terminal
            .diagnostics ===
            "function"
        ) {
          state.branchId =
            positiveNumber(
              terminal
                .diagnostics()
                ?.branch_id,
            );
        }
      } catch (_) {}
    }
  }

  function observeContext(
    input,
    init,
  ) {
    let rawUrl = "";

    if (
      typeof input === "string"
      ||
      input instanceof URL
    ) {
      rawUrl =
        String(input);
    } else if (
      input
      &&
      typeof input.url ===
        "string"
    ) {
      rawUrl =
        input.url;
    }

    let url;

    try {
      url =
        new URL(
          rawUrl,
          location.origin,
        );
    } catch (_) {
      return null;
    }

    const method =
      clean(
        init?.method
        ||
        input?.method
        ||
        "GET",
      ).toUpperCase();

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
      positiveNumber(
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
  // Sales normalization
  // ----------------------------------------------------------

  function metadata(sale) {
    return safeObject(
      sale?.metadata,
    );
  }

  function saleNumber(sale) {
    return (
      clean(
        sale?.sale_number,
      )
      ||
      clean(
        sale?.sale_no,
      )
      ||
      clean(
        sale?.reference,
      )
      ||
      clean(
        sale?.number,
      )
    );
  }

  function customerName(sale) {
    const meta =
      metadata(sale);

    return (
      clean(
        sale
          ?.transaction_customer_name,
      )
      ||
      clean(
        meta
          ?.transaction_customer_name,
      )
      ||
      clean(
        meta
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
        sale?.customer_name,
      )
      ||
      "Walk-in"
    );
  }

  function phoneTin(sale) {
    const meta =
      metadata(sale);

    return (
      clean(
        sale
          ?.transaction_customer_phone_tin,
      )
      ||
      clean(
        meta
          ?.transaction_customer_phone_tin,
      )
      ||
      clean(
        meta
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

  function productName(item) {
    return (
      clean(
        item
          ?.product_name_snapshot,
      )
      ||
      clean(
        item?.product_name,
      )
      ||
      clean(
        item
          ?.product
          ?.name,
      )
      ||
      clean(
        item?.name,
      )
      ||
      "Product"
    );
  }

  function quantity(item) {
    const value =
      Number(
        item?.quantity
        ??
        item?.qty
        ??
        0,
      );

    return Number.isFinite(
      value,
    )
      ? value
      : 0;
  }

  function products(sale) {
    const direct =
      clean(
        sale
          ?.product_summary,
      )
      ||
      clean(
        sale
          ?.products_summary,
      );

    if (direct) {
      return direct;
    }

    return saleItems(sale)
      .map(
        item => {
          const name =
            productName(item);

          const qty =
            quantity(item);

          return qty > 0
            ? `${name} × ${qty}`
            : name;
        },
      )
      .filter(Boolean)
      .join("; ");
  }

  function paymentMethod(
    sale,
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
      ||
      clean(
        sale
          ?.payments
          ?.[0]
          ?.method,
      )
    );
  }

  function total(sale) {
    const value =
      Number(
        sale
          ?.total_amount
        ??
        sale?.total,
      );

    if (
      Number.isFinite(
        value,
      )
    ) {
      return (
        "RWF "
        +
        new Intl.NumberFormat(
          "en-US",
          {
            maximumFractionDigits:
              0,
          },
        ).format(value)
      );
    }

    return clean(
      sale
        ?.total_amount
      ??
      sale?.total,
    );
  }

  function eligible(sale) {
    return (
      lower(
        sale?.status,
      ) === "dispensed"
      &&
      lower(
        sale
          ?.payment_status,
      ) === "paid"
    );
  }

  function mergeSale(
    previous,
    next,
  ) {
    if (!previous) {
      return next;
    }

    const result = {
      ...previous,
      ...next,
    };

    if (
      saleItems(next)
        .length === 0
      &&
      saleItems(previous)
        .length > 0
    ) {
      result.items =
        saleItems(previous);
    }

    return result;
  }

  function placeSale(
    map,
    sale,
  ) {
    const number =
      saleNumber(sale);

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

  function listFromPayload(
    payload,
  ) {
    if (
      Array.isArray(
        payload,
      )
    ) {
      return payload;
    }

    for (
      const key
      of [
        "transactions",
        "sales",
        "data",
      ]
    ) {
      const value =
        payload?.[key];

      if (
        Array.isArray(
          value,
        )
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
      payload?.data
      &&
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

  function replaceMap(
    map,
    rows,
  ) {
    map.clear();

    for (
      const sale
      of rows
    ) {
      if (
        sale &&
        typeof sale ===
          "object"
      ) {
        placeSale(
          map,
          sale,
        );
      }
    }
  }

  function sortedEligible(
    map,
  ) {
    return Array.from(
      map.values(),
    )
      .filter(eligible)
      .sort(
        (a, b) => {
          const aTime =
            Date.parse(
              isoDate(
                a
                  ?.transaction_timestamp
                ||
                a?.sold_at
                ||
                a?.created_at,
              ),
            ) || 0;

          const bTime =
            Date.parse(
              isoDate(
                b
                  ?.transaction_timestamp
                ||
                b?.sold_at
                ||
                b?.created_at,
              ),
            ) || 0;

          return bTime - aTime;
        },
      );
  }

  // ----------------------------------------------------------
  // Session cache
  // ----------------------------------------------------------

  function mapFor(kind) {
    return (
      kind === "recent"
    )
      ? state.recent
      : state.sales;
  }

  function cacheKey(kind) {
    resolveContext();

    if (!state.tenant) {
      return "";
    }

    return [
      CACHE_PREFIX,
      state.tenant,
      state.branchId || 0,
      kind,
    ].join(":");
  }

  function currentCacheState(
    kind,
  ) {
    const timestamp =
      Number(
        state.cacheAt[kind],
      );

    if (
      !timestamp
      ||
      !state
        .cacheHydrated[kind]
    ) {
      return {
        found:
          false,

        fresh:
          false,

        stale:
          false,

        age:
          null,
      };
    }

    const age =
      Date.now()
      -
      timestamp;

    if (
      age >
      CACHE_STALE_MAX_MS
    ) {
      return {
        found:
          false,

        fresh:
          false,

        stale:
          false,

        age,
      };
    }

    return {
      found:
        true,

      fresh:
        age <=
          CACHE_FRESH_MS,

      stale:
        age >
          CACHE_FRESH_MS,

      age,
    };
  }

  function readSessionCache(
    kind,
  ) {
    const active =
      currentCacheState(
        kind,
      );

    if (active.found) {
      state.cacheHits +=
        1;

      if (active.stale) {
        state.staleCacheHits +=
          1;
      }

      return active;
    }

    const key =
      cacheKey(kind);

    if (!key) {
      return {
        found:
          false,

        fresh:
          false,

        stale:
          false,

        age:
          null,
      };
    }

    try {
      const raw =
        window
          .sessionStorage
          .getItem(key);

      if (!raw) {
        state.cacheMisses +=
          1;

        return {
          found:
            false,

          fresh:
            false,

          stale:
            false,

          age:
            null,
        };
      }

      const cached =
        JSON.parse(raw);

      const timestamp =
        Number(
          cached?.at,
        );

      const rows =
        Array.isArray(
          cached?.rows,
        )
          ? cached.rows
          : [];

      const age =
        Date.now()
        -
        timestamp;

      if (
        !Number.isFinite(
          timestamp,
        )
        ||
        age >
          CACHE_STALE_MAX_MS
      ) {
        window
          .sessionStorage
          .removeItem(key);

        state.cacheMisses +=
          1;

        return {
          found:
            false,

          fresh:
            false,

          stale:
            false,

          age:
            null,
        };
      }

      replaceMap(
        mapFor(kind),
        rows,
      );

      state.cacheAt[kind] =
        timestamp;

      state
        .cacheHydrated[kind] =
        true;

      state.cacheHits +=
        1;

      if (
        age >
        CACHE_FRESH_MS
      ) {
        state.staleCacheHits +=
          1;
      }

      if (
        state
          .firstCachePaintMs ===
        null
      ) {
        state
          .firstCachePaintMs =
          Math.round(
            performance.now()
            -
            STARTED_AT,
          );
      }

      return {
        found:
          true,

        fresh:
          age <=
            CACHE_FRESH_MS,

        stale:
          age >
            CACHE_FRESH_MS,

        age,
      };
    } catch (_) {
      state.cacheMisses +=
        1;

      return {
        found:
          false,

        fresh:
          false,

        stale:
          false,

        age:
          null,
      };
    }
  }

  function writeSessionCache(
    kind,
    rows,
  ) {
    const key =
      cacheKey(kind);

    if (!key) {
      return;
    }

    const timestamp =
      Date.now();

    const limit =
      kind === "recent"
        ? 30
        : 50;

    try {
      window
        .sessionStorage
        .setItem(
          key,
          JSON.stringify({
            at:
              timestamp,

            rows:
              rows.slice(
                0,
                limit,
              ),
          }),
        );

      state.cacheAt[kind] =
        timestamp;

      state
        .cacheHydrated[kind] =
        true;

      state.cacheWrites +=
        1;
    } catch (_) {}
  }

  function invalidateCache() {
    for (
      const kind
      of [
        "recent",
        "sales",
      ]
    ) {
      const key =
        cacheKey(kind);

      if (key) {
        try {
          window
            .sessionStorage
            .removeItem(key);
        } catch (_) {}
      }

      state.cacheAt[kind] =
        0;

      state
        .cacheHydrated[kind] =
        false;
    }

    state
      .cacheInvalidations +=
      1;
  }

  // ----------------------------------------------------------
  // API
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

  function apiUrl(path) {
    const url =
      new URL(
        path,
        location.origin,
      );

    if (state.branchId) {
      url
        .searchParams
        .set(
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

  function endpoint(kind) {
    return (
      kind === "recent"
    )
      ? "/api/v1/pharmaco/pos/recent-transactions?current_session=0&limit=30&status=dispensed"
      : "/api/v1/pharmaco/sales?status=dispensed&payment_status=paid";
  }

  async function fetchKind(
    kind,
  ) {
    resolveContext();

    if (
      !state.auth
      ||
      !state.tenant
    ) {
      return null;
    }

    const key =
      [
        kind,
        state.tenant,
        state.branchId || 0,
      ].join(":");

    if (
      inFlight.has(key)
    ) {
      state
        .deduplicatedRequests +=
        1;

      return inFlight.get(key);
    }

    const promise =
      (async () => {
        const started =
          performance.now();

        if (
          kind === "recent"
        ) {
          state
            .recentNetworkRequests +=
            1;
        } else {
          state
            .salesNetworkRequests +=
            1;
        }

        const response =
          await parentFetch(
            apiUrl(
              endpoint(kind),
            ),
            {
              method:
                "GET",

              headers:
                apiHeaders(),

              credentials:
                "same-origin",
            },
          );

        if (!response.ok) {
          throw new Error(
            `Sales API HTTP ${response.status}`,
          );
        }

        const payload =
          await response.json();

        const rows =
          listFromPayload(
            payload,
          ).filter(
            value =>
              value
              &&
              typeof value ===
                "object",
          );

        replaceMap(
          mapFor(kind),
          rows,
        );

        writeSessionCache(
          kind,
          rows,
        );

        state.lastNetworkMs =
          Math.round(
            performance.now()
            -
            started,
          );

        if (
          state
            .firstNetworkPaintMs ===
          null
        ) {
          state
            .firstNetworkPaintMs =
            Math.round(
              performance.now()
              -
              STARTED_AT,
            );
        }

        return rows;
      })();

    inFlight.set(
      key,
      promise,
    );

    try {
      return await promise;
    } finally {
      inFlight.delete(key);
    }
  }

  // ----------------------------------------------------------
  // Tables
  // ----------------------------------------------------------

  function recentTable() {
    return document
      .querySelector(
        ".pos-recent-transactions-bottom table",
      );
  }

  function registerTable() {
    return document
      .querySelector(
        ".managed-sales-main-table",
      );
  }

  function headerCells(
    table,
  ) {
    return Array.from(
      table.querySelectorAll(
        "thead th",
      ),
    );
  }

  function recentKey(value) {
    const text =
      normal(value);

    if (
      text ===
        "transaction timestamp"
      ||
      text === "timestamp"
      ||
      text === "time"
    ) {
      return "time";
    }

    if (
      text.includes(
        "sale no",
      )
      ||
      text.includes(
        "sale number",
      )
      ||
      text === "sale"
    ) {
      return "sale";
    }

    if (
      text === "customer"
    ) {
      return "customer";
    }

    if (
      text === "products"
    ) {
      return "products";
    }

    if (
      text === "method"
      ||
      text ===
        "payment method"
      ||
      text === "payment"
    ) {
      return "payment";
    }

    if (
      text === "total"
      ||
      text ===
        "total amount"
    ) {
      return "total";
    }

    return "";
  }

  function recentTitle(key) {
    return {
      time:
        "Time",

      sale:
        "Sale No.",

      customer:
        "Customer",

      products:
        "Products",

      payment:
        "Payment",

      total:
        "Total",
    }[key] || key;
  }

  function deleteColumn(
    table,
    index,
  ) {
    for (
      const row
      of table.querySelectorAll(
        "thead tr, tbody tr",
      )
    ) {
      row.children[index]
        ?.remove();
    }
  }

  function normalizeRecent(
    table,
  ) {
    const seen =
      new Set();

    const remove = [];

    headerCells(table)
      .forEach(
        (cell, index) => {
          const key =
            recentKey(
              cell.textContent,
            );

          if (
            !RECENT_COLUMNS
              .includes(key)
            ||
            seen.has(key)
          ) {
            remove.push(index);

            return;
          }

          seen.add(key);

          cell.textContent =
            recentTitle(key);
        },
      );

    remove
      .sort(
        (a, b) =>
          b - a,
      )
      .forEach(
        index =>
          deleteColumn(
            table,
            index,
          ),
      );

    for (
      const key
      of RECENT_COLUMNS
    ) {
      const exists =
        headerCells(table)
          .some(
            cell =>
              recentKey(
                cell.textContent,
              ) === key,
          );

      if (exists) {
        continue;
      }

      const th =
        document
          .createElement(
            "th",
          );

      th.textContent =
        recentTitle(key);

      table
        .querySelector(
          "thead tr",
        )
        ?.appendChild(th);

      for (
        const row
        of table.querySelectorAll(
          "tbody tr",
        )
      ) {
        row.appendChild(
          document
            .createElement(
              "td",
            ),
        );
      }
    }

    state.recentColumns =
      headerCells(table)
        .map(
          cell =>
            recentKey(
              cell.textContent,
            ),
        )
        .filter(Boolean);
  }

  function recentIndex(
    table,
    key,
  ) {
    return headerCells(table)
      .findIndex(
        cell =>
          recentKey(
            cell.textContent,
          ) === key,
      );
  }

  function registerIndex(
    table,
    labels,
  ) {
    const expected =
      labels.map(normal);

    return headerCells(table)
      .findIndex(
        cell =>
          expected.includes(
            normal(
              cell.textContent,
            ),
          ),
      );
  }

  function isPlaceholder(
    row,
  ) {
    if (!row) {
      return false;
    }

    const text =
      lower(
        row.textContent,
      );

    return (
      row.cells.length === 1
      ||
      text.includes(
        "no recent",
      )
      ||
      text.includes(
        "no records",
      )
      ||
      text.includes(
        "nothing to show",
      )
    );
  }

  function setCell(
    row,
    index,
    value,
    wrap = false,
  ) {
    if (
      index < 0
      ||
      !row.cells[index]
    ) {
      return;
    }

    row.cells[index]
      .textContent =
        clean(value) || "—";

    if (wrap) {
      row.cells[index]
        .style
        .whiteSpace =
          "normal";

      row.cells[index]
        .style
        .overflowWrap =
          "anywhere";
    }
  }

  function recentSaleNumber(
    table,
    row,
  ) {
    const index =
      recentIndex(
        table,
        "sale",
      );

    if (
      index >= 0
      &&
      row.cells[index]
    ) {
      return clean(
        row.cells[index]
          .textContent,
      );
    }

    return "";
  }

  function registerSaleNumber(
    table,
    row,
  ) {
    const index =
      registerIndex(
        table,
        [
          "Sale No.",
          "Sale No",
          "Sale Number",
          "Sale",
          "Reference",
        ],
      );

    if (
      index >= 0
      &&
      row.cells[index]
    ) {
      return clean(
        row.cells[index]
          .textContent,
      );
    }

    return "";
  }

  function saleFor(number) {
    return (
      state.sales.get(number)
      ||
      state.recent.get(number)
      ||
      null
    );
  }

  // ----------------------------------------------------------
  // Minimal Recent Sales
  // ----------------------------------------------------------

  function recentValues(sale) {
    return {
      time:
        rwandaDateTime(
          sale
            ?.transaction_timestamp
          ||
          sale?.sold_at
          ||
          sale?.created_at,
        ),

      sale:
        saleNumber(sale),

      customer:
        customerName(sale),

      products:
        products(sale),

      payment:
        paymentMethod(sale),

      total:
        total(sale),
    };
  }

  function enrichRecentRow(
    table,
    row,
    sale,
  ) {
    const value =
      recentValues(sale);

    setCell(
      row,
      recentIndex(
        table,
        "time",
      ),
      value.time,
    );

    setCell(
      row,
      recentIndex(
        table,
        "sale",
      ),
      value.sale,
    );

    setCell(
      row,
      recentIndex(
        table,
        "customer",
      ),
      value.customer,
      true,
    );

    setCell(
      row,
      recentIndex(
        table,
        "products",
      ),
      value.products,
      true,
    );

    setCell(
      row,
      recentIndex(
        table,
        "payment",
      ),
      value.payment,
    );

    setCell(
      row,
      recentIndex(
        table,
        "total",
      ),
      value.total,
    );
  }

  function makeRecentRow(
    table,
    sale,
  ) {
    const row =
      document.createElement(
        "tr",
      );

    row.dataset
      .ubuzimaV351Recent =
        "1";

    const values =
      recentValues(sale);

    for (
      const header
      of headerCells(table)
    ) {
      const key =
        recentKey(
          header.textContent,
        );

      const td =
        document
          .createElement(
            "td",
          );

      td.textContent =
        clean(
          values[key],
        ) || "—";

      if (
        key === "customer"
        ||
        key === "products"
      ) {
        td.style
          .whiteSpace =
            "normal";

        td.style
          .overflowWrap =
            "anywhere";
      }

      row.appendChild(td);
    }

    return row;
  }

  function styleRecent(
    table,
  ) {
    const viewport =
      table.parentElement;

    if (viewport) {
      viewport.style
        .maxHeight =
          "52vh";

      viewport.style
        .overflowY =
          "auto";

      viewport.style
        .overflowX =
          "auto";

      viewport.style
        .scrollbarGutter =
          "stable";

      viewport.style
        .overscrollBehavior =
          "contain";
    }

    table.style.minWidth =
      "760px";

    table.style.width =
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
  }

  function renderRecent() {
    const table =
      recentTable();

    state.recentTableFound =
      Boolean(table);

    if (!table) {
      return;
    }

    normalizeRecent(table);
    styleRecent(table);

    table
      .querySelectorAll(
        "tbody tr[data-ubuzima-v351-recent]",
      )
      .forEach(
        row => row.remove(),
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

    const existing =
      new Set();

    const nativeRows =
      Array.from(
        body.rows,
      );

    let enriched =
      0;

    for (
      const row
      of nativeRows
    ) {
      if (
        isPlaceholder(row)
      ) {
        continue;
      }

      const number =
        recentSaleNumber(
          table,
          row,
        );

      if (!number) {
        continue;
      }

      existing.add(number);

      const sale =
        saleFor(number);

      if (
        sale
        &&
        eligible(sale)
      ) {
        enrichRecentRow(
          table,
          row,
          sale,
        );

        enriched += 1;
      }
    }

    const missing =
      sortedEligible(
        state.recent,
      )
        .filter(
          sale =>
            !existing.has(
              saleNumber(sale),
            ),
        )
        .slice(
          0,
          20,
        );

    for (
      let index =
        missing.length - 1;
      index >= 0;
      index -= 1
    ) {
      body.insertBefore(
        makeRecentRow(
          table,
          missing[index],
        ),
        body.firstChild,
      );
    }

    if (
      enriched > 0
      ||
      missing.length > 0
    ) {
      for (
        const row
        of nativeRows
      ) {
        if (
          isPlaceholder(row)
        ) {
          row.style.display =
            "none";
        }
      }
    }

    state.recentRows =
      body.querySelectorAll(
        "tr",
      ).length;
  }

  // ----------------------------------------------------------
  // Sales Register full detail
  // ----------------------------------------------------------

  function enrichRegisterRow(
    table,
    row,
    sale,
  ) {
    setCell(
      row,
      registerIndex(
        table,
        ["Customer"],
      ),
      customerName(sale),
      true,
    );

    setCell(
      row,
      registerIndex(
        table,
        [
          "Phone/TIN",
          "Phone TIN",
          "Customer Phone/TIN",
        ],
      ),
      phoneTin(sale),
      true,
    );

    setCell(
      row,
      registerIndex(
        table,
        ["Products"],
      ),
      products(sale),
      true,
    );

    const itemIndex =
      registerIndex(
        table,
        ["Items"],
      );

    if (itemIndex >= 0) {
      setCell(
        row,
        itemIndex,
        saleItems(sale)
          .length,
      );
    }
  }

  function registerValue(
    label,
    sale,
  ) {
    const key =
      normal(label);

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
      return saleNumber(sale);
    }

    if (
      key === "customer"
    ) {
      return customerName(sale);
    }

    if (
      key.includes("phone")
      ||
      key.includes("tin")
    ) {
      return phoneTin(sale);
    }

    if (
      key === "products"
    ) {
      return products(sale);
    }

    if (
      key === "items"
    ) {
      return saleItems(sale)
        .length;
    }

    if (
      key === "method"
      ||
      key.includes(
        "payment method",
      )
    ) {
      return paymentMethod(
        sale,
      );
    }

    if (
      key === "total"
      ||
      key.includes(
        "total amount",
      )
    ) {
      return total(sale);
    }

    if (
      key.includes(
        "transaction timestamp",
      )
      ||
      key === "timestamp"
    ) {
      return rwandaDateTime(
        sale
          ?.transaction_timestamp
        ||
        sale?.sold_at
        ||
        sale?.created_at,
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
      key.includes(
        "payment status",
      )
    ) {
      return clean(
        sale
          ?.payment_status,
      );
    }

    if (
      key === "status"
    ) {
      return clean(
        sale?.status,
      );
    }

    return "—";
  }

  function makeRegisterRow(
    table,
    sale,
  ) {
    const row =
      document.createElement(
        "tr",
      );

    row.dataset
      .ubuzimaV351Register =
        "1";

    for (
      const header
      of headerCells(table)
    ) {
      const td =
        document
          .createElement(
            "td",
          );

      td.textContent =
        clean(
          registerValue(
            header.textContent,
            sale,
          ),
        ) || "—";

      const key =
        normal(
          header.textContent,
        );

      if (
        key === "customer"
        ||
        key === "products"
        ||
        key.includes("phone")
        ||
        key.includes("tin")
      ) {
        td.style
          .whiteSpace =
            "normal";

        td.style
          .overflowWrap =
            "anywhere";
      }

      row.appendChild(td);
    }

    return row;
  }

  function renderRegister() {
    const table =
      registerTable();

    state.registerTableFound =
      Boolean(table);

    if (!table) {
      return;
    }

    table
      .querySelectorAll(
        "tbody tr[data-ubuzima-v351-register]",
      )
      .forEach(
        row => row.remove(),
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

    const existing =
      new Set();

    const nativeRows =
      Array.from(
        body.rows,
      );

    let enriched =
      0;

    for (
      const row
      of nativeRows
    ) {
      if (
        isPlaceholder(row)
      ) {
        continue;
      }

      const number =
        registerSaleNumber(
          table,
          row,
        );

      if (!number) {
        continue;
      }

      existing.add(number);

      const sale =
        state.sales.get(
          number,
        );

      if (
        sale
        &&
        eligible(sale)
      ) {
        enrichRegisterRow(
          table,
          row,
          sale,
        );

        enriched += 1;
      }
    }

    const missing =
      sortedEligible(
        state.sales,
      )
        .filter(
          sale =>
            !existing.has(
              saleNumber(sale),
            ),
        )
        .slice(
          0,
          50,
        );

    for (
      let index =
        missing.length - 1;
      index >= 0;
      index -= 1
    ) {
      body.insertBefore(
        makeRegisterRow(
          table,
          missing[index],
        ),
        body.firstChild,
      );
    }

    if (
      enriched > 0
      ||
      missing.length > 0
    ) {
      for (
        const row
        of nativeRows
      ) {
        if (
          isPlaceholder(row)
        ) {
          row.style.display =
            "none";
        }
      }
    }

    state.registerRows =
      body.querySelectorAll(
        "tr",
      ).length;
  }

  // ----------------------------------------------------------
  // Cache first / revalidate
  // ----------------------------------------------------------

  async function ensureKind(
    kind,
    force = false,
  ) {
    const cache =
      readSessionCache(
        kind,
      );

    if (
      kind === "recent"
    ) {
      renderRecent();
    } else {
      renderRegister();
    }

    if (
      !force
      &&
      cache.found
      &&
      cache.fresh
    ) {
      return;
    }

    try {
      await fetchKind(kind);

      if (
        kind === "recent"
      ) {
        renderRecent();
      } else {
        renderRegister();
      }
    } catch (error) {
      state.lastError =
        error instanceof Error
          ? error.message
          : String(error);
    }
  }

  async function ensureVisible(
    force = false,
  ) {
    const recent =
      recentTable();

    const register =
      registerTable();

    state.recentTableFound =
      Boolean(recent);

    state.registerTableFound =
      Boolean(register);

    const jobs = [];

    if (recent) {
      jobs.push(
        ensureKind(
          "recent",
          force,
        ),
      );
    }

    if (register) {
      jobs.push(
        ensureKind(
          "sales",
          force,
        ),
      );
    }

    if (jobs.length) {
      await Promise.all(jobs);
    }
  }

  function scheduleVisible(
    force = false,
    delay = 100,
  ) {
    window.setTimeout(
      () => {
        idle(
          () => {
            void ensureVisible(
              force,
            );
          },
        );
      },
      delay,
    );
  }

  // ----------------------------------------------------------
  // Reuse core responses / checkout invalidation
  // ----------------------------------------------------------

  async function consumeResponse(
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

    if (checkout) {
      invalidateCache();

      scheduleVisible(
        true,
        350,
      );

      return;
    }

    if (
      !recent
      &&
      !sales
    ) {
      return;
    }

    try {
      const payload =
        await response.json();

      const rows =
        listFromPayload(
          payload,
        );

      const kind =
        recent
          ? "recent"
          : "sales";

      replaceMap(
        mapFor(kind),
        rows,
      );

      writeSessionCache(
        kind,
        rows,
      );

      if (
        kind === "recent"
        &&
        recentTable()
      ) {
        renderRecent();
      }

      if (
        kind === "sales"
        &&
        registerTable()
      ) {
        renderRegister();
      }
    } catch (_) {}
  }

  window.fetch =
    async function (
      input,
      init,
    ) {
      const info =
        observeContext(
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
          void consumeResponse(
            info,
            response.clone(),
          );
        } catch (_) {}

        /*
         * Only checks if Recent or Register is currently visible.
         * No V3.5.1 Sales request is made on unrelated screens.
         */
        scheduleVisible(
          false,
          80,
        );
      }

      return response;
    };

  // ----------------------------------------------------------
  // Accepted centered popup
  // ----------------------------------------------------------

  function installPopupStyle() {
    document
      .getElementById(
        "ubuzima-sales-v34-accepted-popup",
      )
      ?.remove();

    if (
      document.getElementById(
        "ubuzima-sales-v351-accepted-popup",
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
      "ubuzima-sales-v351-accepted-popup";

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

  width: min(500px, calc(100vw - 34px)) !important;
  max-width: min(500px, calc(100vw - 34px)) !important;

  max-height: min(430px, calc(100dvh - 142px)) !important;

  display: grid !important;

  grid-template-columns:
    minmax(0, 1fr)
    minmax(0, 1fr) !important;

  gap: 10px !important;

  margin: 0 !important;
  padding: 16px !important;

  border-radius: 20px !important;

  overflow: hidden !important;
  box-sizing: border-box !important;
}

html:not(.ubuzima-mobile-pwa-active) .pos-quantity-dialog__header,
html:not(.ubuzima-mobile-pwa-active) .pos-quantity-readonly-grid,
html:not(.ubuzima-mobile-pwa-active) .pos-quantity-total-strip,
html:not(.ubuzima-mobile-pwa-active) .pos-quantity-dialog footer,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog footer,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-dialog [class*="actions"] {
  grid-column: 1 / -1 !important;
}

html:not(.ubuzima-mobile-pwa-active) .pos-quantity-selling-unit-hero,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-grid-item--quantity {
  grid-column: 1 !important;
}

html:not(.ubuzima-mobile-pwa-active) .pos-quantity-price-override-card,
html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-grid-item--price {
  grid-column: 2 !important;
}

html:not(.ubuzima-mobile-pwa-active) .ubuzima-pos-confirmation-grid {
  grid-column: 1 / -1 !important;

  display: grid !important;

  grid-template-columns:
    minmax(0, 1fr)
    minmax(0, 1fr) !important;

  gap: 10px !important;
}

@media (max-width: 767px) {
  .pos-quantity-dialog,
  .ubuzima-pos-confirmation-dialog {
    top: 50% !important;

    width:
      min(
        420px,
        calc(100vw - 22px)
      ) !important;

    max-width:
      min(
        420px,
        calc(100vw - 22px)
      ) !important;
  }
}
`;

    document.head
      .appendChild(style);

    state.popupAcceptedStyle =
      true;
  }

  // ----------------------------------------------------------
  // User/navigation triggers
  // ----------------------------------------------------------

  document.addEventListener(
    "click",
    event => {
      const control =
        event.target instanceof Element
          ? event.target.closest(
              "button,a,[role='button']",
            )
          : null;

      const text =
        lower(
          control?.textContent,
        );

      const force =
        text === "refresh"
        ||
        text.includes(
          "refresh sales",
        );

      scheduleVisible(
        force,
        force
          ? 60
          : 140,
      );
    },
    false,
  );

  window.addEventListener(
    "popstate",
    () => {
      scheduleVisible(
        false,
        100,
      );
    },
  );

  window.addEventListener(
    "hashchange",
    () => {
      scheduleVisible(
        false,
        100,
      );
    },
  );

  // ----------------------------------------------------------
  // Diagnostics
  // ----------------------------------------------------------

  window
    .__UBUZIMA_SALES_RECORDING_INTEGRITY_V3_5_1__ =
      Object.freeze({
        version:
          VERSION,

        refresh() {
          return ensureVisible(
            true,
          );
        },

        diagnostics() {
          const recentCache =
            currentCacheState(
              "recent",
            );

          const salesCache =
            currentCacheState(
              "sales",
            );

          return {
            version:
              VERSION,

            lazy_loading:
              true,

            cache_strategy:
              "sessionStorage stale-while-revalidate",

            cache_scope:
              "tenant+branch",

            cache_fresh_ms:
              CACHE_FRESH_MS,

            cache_stale_max_ms:
              CACHE_STALE_MAX_MS,

            recent_cache_age_ms:
              recentCache.age,

            recent_cache_fresh:
              recentCache.fresh,

            sales_cache_age_ms:
              salesCache.age,

            sales_cache_fresh:
              salesCache.fresh,

            cache_hits:
              state.cacheHits,

            cache_misses:
              state.cacheMisses,

            cache_stale_hits:
              state.staleCacheHits,

            cache_writes:
              state.cacheWrites,

            cache_invalidations:
              state.cacheInvalidations,

            request_deduplications:
              state.deduplicatedRequests,

            recent_network_requests:
              state.recentNetworkRequests,

            sales_network_requests:
              state.salesNetworkRequests,

            last_network_ms:
              state.lastNetworkMs,

            first_cache_paint_ms:
              state.firstCachePaintMs,

            first_network_paint_ms:
              state.firstNetworkPaintMs,

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

            recent_table_found:
              state.recentTableFound,

            sales_register_found:
              state.registerTableFound,

            recent_cache_count:
              state.recent.size,

            sales_cache_count:
              state.sales.size,

            recent_rows:
              state.recentRows,

            sales_register_rows:
              state.registerRows,

            recent_column_count:
              state.recentColumns.length,

            recent_columns:
              state.recentColumns.slice(),

            recent_expected_columns:
              RECENT_COLUMNS.slice(),

            phone_tin_in_recent_sales:
              false,

            business_date_in_recent_sales:
              false,

            status_in_recent_sales:
              false,

            price_audit_in_recent_sales:
              false,

            full_detail_in_sales_register:
              true,

            rwanda_timezone:
              "Africa/Kigali",

            popup_accepted_centered_style:
              state.popupAcceptedStyle,

            receipt_interception:
              false,

            receipt_adapter_delegated:
              true,

            mutation_observer:
              false,

            polling:
              false,

            last_error:
              state.lastError,
          };
        },
      });

  resolveContext();

  installPopupStyle();

  /*
   * One lightweight visibility check.
   * It does not fetch Sales data unless a Sales table is present.
   */
  scheduleVisible(
    false,
    450,
  );

  console.info(
    "[Ubuzima+] Sales Integrity V3.5.1 loaded.",
    VERSION,
  );
})();

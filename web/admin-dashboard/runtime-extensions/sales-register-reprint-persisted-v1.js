(() => {
  "use strict";

  const VERSION =
    "2026.08.sales-register-reprint-persisted-v1";

  const GLOBAL =
    "__UBUZIMA_SALES_REGISTER_REPRINT_PERSISTED_V1__";

  if (window[GLOBAL]) {
    return;
  }

  const state = {
    observedSalesResponses: 0,
    mappedSales: 0,
    injectedButtons: 0,
    reprintAttempts: 0,
    reprintOpened: 0,
    missingSaleIds: 0,
    errors: 0,
    lastSaleId: null,
    lastSaleNumber: null,
    lastError: null,
  };

  const saleIds =
    new Map();

  const nativeFetch =
    window.fetch.bind(window);

  let injectScheduled =
    false;

  function clean(value) {
    return String(
      value ?? "",
    ).trim();
  }

  function positiveId(value) {
    const parsed =
      Number(value);

    return Number.isInteger(parsed)
      && parsed > 0
      ? parsed
      : null;
  }

  function normalSaleNumber(value) {
    return clean(value)
      .replace(/\s+/g, " ")
      .toUpperCase();
  }

  function rememberSale(
    saleNumber,
    saleId,
  ) {
    const number =
      normalSaleNumber(
        saleNumber,
      );

    const id =
      positiveId(
        saleId,
      );

    if (!number || !id) {
      return false;
    }

    const before =
      saleIds.size;

    saleIds.set(
      number,
      id,
    );

    state.mappedSales =
      saleIds.size;

    return saleIds.size !== before;
  }

  function collectSales(
    value,
    depth = 0,
    seen = new Set(),
  ) {
    if (
      value === null
      || value === undefined
      || depth > 8
    ) {
      return;
    }

    if (
      typeof value !== "object"
    ) {
      return;
    }

    if (
      seen.has(value)
    ) {
      return;
    }

    seen.add(value);

    if (
      !Array.isArray(value)
      && Object.prototype.hasOwnProperty.call(
        value,
        "sale_number",
      )
      && Object.prototype.hasOwnProperty.call(
        value,
        "id",
      )
    ) {
      rememberSale(
        value.sale_number,
        value.id,
      );
    }

    if (Array.isArray(value)) {
      value.forEach(
        item =>
          collectSales(
            item,
            depth + 1,
            seen,
          ),
      );

      return;
    }

    Object.keys(value)
      .forEach(
        key =>
          collectSales(
            value[key],
            depth + 1,
            seen,
          ),
      );
  }

  function requestDetails(
    input,
    init,
  ) {
    const method =
      clean(
        init?.method
        || (
          typeof Request !==
            "undefined"
          && input instanceof Request
            ? input.method
            : "GET"
        ),
      )
        .toUpperCase()
        || "GET";

    const rawUrl =
      typeof input === "string"
        ? input
        : (
          input
          && typeof input.url ===
            "string"
            ? input.url
            : ""
        );

    let pathname =
      "";

    try {
      pathname =
        new URL(
          rawUrl,
          window.location.origin,
        ).pathname;
    } catch (_) {
      pathname =
        rawUrl.split("?")[0];
    }

    const isSalesRead =
      method === "GET"
      && /\/pharmaco\/sales(?:\/\d+)?\/?$/.test(
        pathname,
      );

    return {
      method,
      pathname,
      isSalesRead,
    };
  }

  window.fetch =
    async function ubuzimaReprintObservedFetch(
      input,
      init,
    ) {
      const details =
        requestDetails(
          input,
          init,
        );

      const response =
        await nativeFetch(
          input,
          init,
        );

      if (
        details.isSalesRead
        && response.ok
      ) {
        response
          .clone()
          .json()
          .then(
            payload => {
              state.observedSalesResponses +=
                1;

              collectSales(
                payload,
              );

              scheduleInject();
            },
          )
          .catch(
            () => {
              /*
               * A non-JSON response is irrelevant
               * to the Sales Register map.
               */
            },
          );
      }

      return response;
    };

  function saleColumnIndex(
    table,
  ) {
    const headers =
      Array.from(
        table.querySelectorAll(
          "thead th",
        ),
      );

    return headers.findIndex(
      cell =>
        clean(
          cell.textContent,
        ).toLowerCase()
        === "sale number",
    );
  }

  function rowSaleNumber(
    row,
    table,
  ) {
    const index =
      saleColumnIndex(
        table,
      );

    if (index < 0) {
      return "";
    }

    const cells =
      Array.from(
        row.children,
      );

    const cell =
      cells[index];

    return clean(
      cell?.textContent,
    );
  }

  function resolveSaleId(
    saleNumber,
  ) {
    return saleIds.get(
      normalSaleNumber(
        saleNumber,
      ),
    ) || null;
  }

  async function receiptApi() {
    const started =
      Date.now();

    while (
      Date.now() - started
      < 4000
    ) {
      const api =
        window.UbuzimaReceipt;

      if (
        api
        && typeof api.openReprint ===
          "function"
      ) {
        return api;
      }

      await new Promise(
        resolve =>
          window.setTimeout(
            resolve,
            80,
          ),
      );
    }

    throw new Error(
      "Receipt reprint API is unavailable.",
    );
  }

  function setButtonState(
    button,
    saleNumber,
  ) {
    const id =
      resolveSaleId(
        saleNumber,
      );

    button.dataset.ubuzimaSaleId =
      id
        ? String(id)
        : "";

    button.disabled =
      !id;

    button.title =
      id
        ? (
          "Reprint persisted receipt for "
          + saleNumber
        )
        : (
          "Preparing persisted sale reference for "
          + saleNumber
        );
  }

  async function openReprint(
    button,
  ) {
    const saleNumber =
      clean(
        button.dataset
          .ubuzimaSaleNumber,
      );

    const saleId =
      resolveSaleId(
        saleNumber,
      );

    state.reprintAttempts +=
      1;

    state.lastSaleNumber =
      saleNumber || null;

    state.lastSaleId =
      saleId;

    if (!saleId) {
      state.missingSaleIds +=
        1;

      state.lastError =
        "Persisted sale ID is not available.";

      setButtonState(
        button,
        saleNumber,
      );

      return;
    }

    const normalLabel =
      "Reprint invoice";

    button.disabled =
      true;

    button.textContent =
      "Opening reprint…";

    try {
      const api =
        await receiptApi();

      const opened =
        api.openReprint({
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
              saleNumber,
          },

          payment: {
            sale_id:
              saleId,
          },
        });

      if (opened === false) {
        throw new Error(
          "Receipt reprint was not opened.",
        );
      }

      state.reprintOpened +=
        1;

      state.lastError =
        null;
    } catch (error) {
      state.errors +=
        1;

      state.lastError =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        "[Ubuzima+ persisted reprint]",
        error,
      );

      window.alert(
        "The saved receipt could not be reopened. "
        + "Please retry from Sales Register.",
      );
    } finally {
      button.textContent =
        normalLabel;

      setButtonState(
        button,
        saleNumber,
      );
    }
  }

  function injectReprintButtons() {
    injectScheduled =
      false;

    const tables =
      document.querySelectorAll(
        "table.managed-sales-main-table",
      );

    tables.forEach(
      table => {
        const rows =
          table.querySelectorAll(
            "tbody tr",
          );

        rows.forEach(
          row => {
            const actions =
              row.querySelector(
                ".managed-sales-row-actions",
              );

            if (!actions) {
              return;
            }

            const saleNumber =
              rowSaleNumber(
                row,
                table,
              );

            if (!saleNumber) {
              return;
            }

            let button =
              actions.querySelector(
                '[data-ubuzima-sales-register-reprint="v1"]',
              );

            if (!button) {
              button =
                document.createElement(
                  "button",
                );

              button.type =
                "button";

              button.className =
                "secondary";

              button.dataset
                .ubuzimaSalesRegisterReprint =
                "v1";

              button.textContent =
                "Reprint invoice";

              button.addEventListener(
                "click",
                event => {
                  event.preventDefault();
                  event.stopPropagation();

                  void openReprint(
                    button,
                  );
                },
              );

              actions.appendChild(
                button,
              );

              state.injectedButtons +=
                1;
            }

            button.dataset
              .ubuzimaSaleNumber =
              saleNumber;

            setButtonState(
              button,
              saleNumber,
            );
          },
        );
      },
    );
  }

  function scheduleInject() {
    if (injectScheduled) {
      return;
    }

    injectScheduled =
      true;

    window.requestAnimationFrame(
      injectReprintButtons,
    );
  }

  const observer =
    new MutationObserver(
      scheduleInject,
    );

  function start() {
    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
      },
    );

    scheduleInject();
  }

  window[GLOBAL] =
    Object.freeze({
      version:
        VERSION,

      diagnostics() {
        return {
          ...state,

          activeMappedSales:
            saleIds.size,

          activeButtons:
            document.querySelectorAll(
              '[data-ubuzima-sales-register-reprint="v1"]',
            ).length,
        };
      },

      refresh() {
        scheduleInject();

        return true;
      },

      saleIdFor(
        saleNumber,
      ) {
        return resolveSaleId(
          saleNumber,
        );
      },
    });

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      {
        once: true,
      },
    );
  } else {
    start();
  }

  console.info(
    "[Ubuzima+] Persisted Sales Register reprint active.",
    VERSION,
  );
})();

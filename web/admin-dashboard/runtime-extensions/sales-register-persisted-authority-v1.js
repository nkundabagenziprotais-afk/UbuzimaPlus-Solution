(() => {
  "use strict";

  const VERSION =
    "2026.08.sales-register-persisted-authority-v1";

  if (
    window
      .__UBUZIMA_SALES_REGISTER_PERSISTED_AUTHORITY_V1__
  ) {
    return;
  }

  const state = {
    sales:
      new Map(),

    responses:
      0,

    renders:
      0,

    lastError:
      null,
  };

  const clean =
    value =>
      String(
        value
        ?? "",
      ).trim();

  const normalize =
    value =>
      clean(
        value,
      )
        .toLowerCase()
        .replace(
          /\s+/g,
          " ",
        );

  function saleAuthority(
    sale,
  ) {
    const record =
      sale
      &&
      typeof sale === "object"
        ? sale
        : {};

    const persisted =
      record.sales_register
      &&
      typeof record.sales_register ===
        "object"
        ? record.sales_register
        : {};

    return {
      customerName:
        clean(
          persisted.customer_name
          ||
          record
            .transaction_customer_name
          ||
          record
            ?.customer
            ?.full_name
          ||
          record
            ?.customer
            ?.name
          ||
          "Walk-in customer",
        ),

      phoneTin:
        clean(
          persisted.phone_tin
          ||
          record
            .transaction_customer_phone_tin
          ||
          "",
        ),

      insuranceName:
        clean(
          persisted.insurance_name
          ||
          record
            .transaction_insurance_name
          ||
          "",
        ),
    };
  }

  function arraysFromPayload(
    payload,
  ) {
    const values = [];

    const add =
      value => {
        if (
          Array.isArray(
            value,
          )
        ) {
          values.push(
            value,
          );
        }
      };

    add(payload);
    add(payload?.data);
    add(payload?.sales);
    add(payload?.items);
    add(payload?.results);
    add(payload?.data?.data);
    add(payload?.data?.sales);
    add(payload?.data?.items);

    return values;
  }

  function ingest(
    payload,
  ) {
    for (
      const rows
      of arraysFromPayload(
        payload,
      )
    ) {
      for (
        const sale
        of rows
      ) {
        if (
          !sale
          ||
          typeof sale !==
            "object"
        ) {
          continue;
        }

        const saleNumber =
          clean(
            sale.sale_number
            ||
            sale.sale_no
            ||
            sale.number,
          );

        if (!saleNumber) {
          continue;
        }

        state.sales.set(
          saleNumber,
          sale,
        );
      }
    }
  }

  function headers(
    table,
  ) {
    return Array.from(
      table.querySelectorAll(
        "thead th",
      ),
    );
  }

  function headerIndex(
    table,
    predicate,
  ) {
    return headers(
      table,
    )
      .map(
        cell =>
          normalize(
            cell.textContent,
          ),
      )
      .findIndex(
        predicate,
      );
  }

  function salesRegisterTable() {
    for (
      const table
      of document.querySelectorAll(
        "table",
      )
    ) {
      const labels =
        headers(
          table,
        )
          .map(
            cell =>
              normalize(
                cell.textContent,
              ),
          );

      const phone =
        labels.some(
          label =>
            label.includes(
              "phone/tin",
            )
            ||
            label.includes(
              "phone / tin",
            ),
        );

      const products =
        labels.some(
          label =>
            label.includes(
              "products",
            ),
        );

      const sale =
        labels.some(
          label =>
            label.includes(
              "sale no",
            )
            ||
            label.includes(
              "sale number",
            ),
        );

      if (
        phone
        &&
        products
        &&
        sale
      ) {
        return table;
      }
    }

    return null;
  }

  function ensureCustomerNameHeader(
    table,
  ) {
    const headRow =
      table.querySelector(
        "thead tr",
      );

    if (!headRow) {
      return;
    }

    if (
      headerIndex(
        table,
        label =>
          label ===
            "customer name",
      )
      >= 0
    ) {
      return;
    }

    const phoneIndex =
      headerIndex(
        table,
        label =>
          label.includes(
            "phone/tin",
          )
          ||
          label.includes(
            "phone / tin",
          ),
      );

    if (
      phoneIndex < 0
    ) {
      return;
    }

    const th =
      document.createElement(
        "th",
      );

    th.textContent =
      "Customer Name";

    th.dataset
      .ubuzimaPersistedCustomerName =
      "v1";

    headRow.insertBefore(
      th,
      headRow.children[
        phoneIndex
      ]
      || null,
    );
  }

  function render() {
    const table =
      salesRegisterTable();

    if (!table) {
      return;
    }

    ensureCustomerNameHeader(
      table,
    );

    const headRow =
      table.querySelector(
        "thead tr",
      );

    if (!headRow) {
      return;
    }

    const labels =
      headers(
        table,
      )
        .map(
          cell =>
            normalize(
              cell.textContent,
            ),
        );

    const customerNameIndex =
      labels.findIndex(
        label =>
          label ===
            "customer name",
      );

    const phoneTinIndex =
      labels.findIndex(
        label =>
          label.includes(
            "phone/tin",
          )
          ||
          label.includes(
            "phone / tin",
          ),
      );

    const saleNumberIndex =
      labels.findIndex(
        label =>
          label.includes(
            "sale no",
          )
          ||
          label.includes(
            "sale number",
          ),
      );

    if (
      customerNameIndex < 0
      ||
      phoneTinIndex < 0
      ||
      saleNumberIndex < 0
    ) {
      return;
    }

    const expectedColumns =
      headRow.children.length;

    for (
      const row
      of table.querySelectorAll(
        "tbody tr",
      )
    ) {
      let cells =
        Array.from(
          row.children,
        );

      /*
       * Existing compiled Sales Register already has Phone/TIN.
       * Add Customer Name immediately before it.
       */
      if (
        cells.length ===
        expectedColumns - 1
      ) {
        const td =
          document.createElement(
            "td",
          );

        td.dataset
          .ubuzimaPersistedCustomerName =
          "v1";

        row.insertBefore(
          td,
          row.children[
            customerNameIndex
          ]
          || null,
        );

        cells =
          Array.from(
            row.children,
          );
      }

      if (
        cells.length <
        expectedColumns
      ) {
        continue;
      }

      const saleNumber =
        clean(
          cells[
            saleNumberIndex
          ]?.textContent,
        );

      if (!saleNumber) {
        continue;
      }

      const sale =
        state.sales.get(
          saleNumber,
        );

      if (!sale) {
        continue;
      }

      const authority =
        saleAuthority(
          sale,
        );

      const customerCell =
        cells[
          customerNameIndex
        ];

      const phoneCell =
        cells[
          phoneTinIndex
        ];

      if (customerCell) {
        customerCell.textContent =
          authority.customerName
          ||
          "Walk-in customer";

        customerCell.dataset
          .ubuzimaPersistedAuthority =
          "customer_name";
      }

      if (phoneCell) {
        phoneCell.textContent =
          authority.phoneTin
          ||
          "—";

        phoneCell.dataset
          .ubuzimaPersistedAuthority =
          "phone_tin";
      }
    }

    table.dataset
      .ubuzimaPersistedSalesAuthority =
      "v1";

    state.renders +=
      1;
  }

  function scheduleRender() {
    const run =
      () => {
        try {
          render();
        } catch (error) {
          state.lastError =
            String(
              error
              instanceof Error
                ? error.message
                : error,
            );
        }
      };

    if (
      typeof window
        .requestAnimationFrame ===
        "function"
    ) {
      window.requestAnimationFrame(
        () => {
          window.requestAnimationFrame(
            run,
          );
        },
      );
    } else {
      window.setTimeout(
        run,
        0,
      );
    }

    window.setTimeout(
      run,
      80,
    );
  }

  const parentFetch =
    window.fetch.bind(
      window,
    );

  window.fetch =
    async function(
      input,
      init,
    ) {
      const response =
        await parentFetch(
          input,
          init,
        );

      try {
        const requestUrl =
          typeof input ===
            "string"
            ? input
            : input?.url;

        const url =
          new URL(
            requestUrl,
            window.location.origin,
          );

        const method =
          String(
            init?.method
            ||
            (
              typeof input !==
                "string"
                ? input?.method
                : "GET"
            )
            ||
            "GET",
          ).toUpperCase();

        if (
          method === "GET"
          &&
          url.pathname.endsWith(
            "/pharmaco/sales",
          )
        ) {
          response
            .clone()
            .json()
            .then(
              payload => {
                ingest(
                  payload,
                );

                state.responses +=
                  1;

                scheduleRender();
              },
            )
            .catch(
              () => {},
            );
        }
      } catch (_) {
        /* transparent pass-through */
      }

      return response;
    };

  document.addEventListener(
    "click",
    event => {
      const target =
        event.target instanceof
          Element
          ? event.target
          : null;

      const label =
        normalize(
          target
            ?.closest(
              "button,a,[role='button']",
            )
            ?.textContent,
        );

      if (
        label.includes(
          "sales register",
        )
        ||
        salesRegisterTable()
      ) {
        scheduleRender();
      }
    },
    true,
  );

  document.addEventListener(
    "input",
    () => {
      if (
        salesRegisterTable()
      ) {
        scheduleRender();
      }
    },
    true,
  );

  document.addEventListener(
    "change",
    () => {
      if (
        salesRegisterTable()
      ) {
        scheduleRender();
      }
    },
    true,
  );

  window.addEventListener(
    "pageshow",
    scheduleRender,
  );

  window
    .__UBUZIMA_SALES_REGISTER_PERSISTED_AUTHORITY_V1__ =
    Object.freeze({
      version:
        VERSION,

      diagnostics() {
        return {
          version:
            VERSION,

          persisted_sales:
            state.sales.size,

          intercepted_sales_reads:
            state.responses,

          renders:
            state.renders,

          customer_name_source:
            "persisted_sale.sales_register.customer_name",

          phone_tin_source:
            "persisted_sale.sales_register.phone_tin",

          receipt_authority:
            "same_persisted_sale",

          transaction_setup_dom_read:
            false,

          local_storage_authority:
            false,

          session_storage_authority:
            false,

          mutation_observer:
            false,

          interval_polling:
            false,

          last_error:
            state.lastError,
        };
      },
    });
})();

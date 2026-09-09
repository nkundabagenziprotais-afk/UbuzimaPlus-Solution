/*
 * AQUILA_FINANCE_MONTHLY_REPORTING_R27
 *
 * Narrow ownership only.
 *
 * P&L:
 *   section.profit-loss-v1
 *
 * Native statement:
 *   article.profit-loss-v1__panel.profit-loss-v1__statement
 *
 * Balance Sheet:
 *   #aquila-finance-balance-sheet-r22
 *
 * No Finance-shell hiding.
 * No MutationObserver.
 * No polling.
 */
(() => {
  "use strict";

  const RELEASE =
    "2026.08.finance-monthly-reporting-r27-layout";

  if (
    window
      .__AQUILA_FINANCE_MONTHLY_REPORTING_R27__
      ?.release ===
    RELEASE
  ) {
    return;
  }

  const PNL_ENDPOINT =
    "/api/v1/pharmaco/finance/commercial/profit-loss/monthly-position";

  const BS_ENDPOINT =
    "/api/v1/pharmaco/finance/commercial/balance-sheet/monthly-position";

  const PNL_PANEL_ID =
    "aquila-pnl-monthly-r26";

  const BS_PANEL_ID =
    "aquila-bs-monthly-r26";

  const state = {
    asOf:
      today(),

    pnl:
      null,

    balance:
      null,

    pnlLoading:
      false,

    balanceLoading:
      false,

    pnlError:
      "",

    balanceError:
      "",

    pnlLoads:
      0,

    balanceLoads:
      0,

    syncRuns:
      0,
  };

  let scheduled =
    false;

  const timers =
    new Set();

  function today() {
    const date =
      new Date();

    date.setMinutes(
      date.getMinutes()
      -
      date.getTimezoneOffset()
    );

    return date
      .toISOString()
      .slice(
        0,
        10
      );
  }

  function clean(value) {
    return String(
      value ?? ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function esc(value) {
    return String(
      value ?? ""
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function number(value) {
    const parsed =
      Number(value);

    return Number.isFinite(
      parsed
    )
      ? parsed
      : 0;
  }

  function money(value) {
    return (
      "RWF "
      +
      new Intl.NumberFormat(
        "en-RW",
        {
          minimumFractionDigits:
            0,

          maximumFractionDigits:
            2,
        }
      ).format(
        number(value)
      )
    );
  }

  function pct(value) {
    if (
      value === null
      ||
      value === undefined
      ||
      value === ""
      ||
      !Number.isFinite(
        Number(value)
      )
    ) {
      return "—";
    }

    return (
      new Intl.NumberFormat(
        "en-RW",
        {
          minimumFractionDigits:
            1,

          maximumFractionDigits:
            1,
        }
      ).format(
        Number(value)
      )
      +
      "%"
    );
  }

  function accountClassLabel(value) {
    const raw =
      clean(value);

    if (!raw) {
      return "";
    }

    return raw
      .replace(
        /[_-]+/g,
        " "
      )
      .replace(
        /\b\w/g,
        character =>
          character.toUpperCase()
      );
  }

  function detailsCell(row) {
    const accountClass =
      accountClassLabel(
        row?.account_type
      );

    const isTotal =
      row?.account_type ===
        "total";

    return `
      <td class="aquila-r26-details">
        ${
          accountClass
          &&
          !isTotal
            ? `
                <span class="aquila-r27-account-class">
                  ${esc(accountClass)}
                </span>
              `
            : ""
        }

        <span class="aquila-r27-account-name">
          ${esc(row?.name || "—")}
        </span>

        ${
          row?.derived
            ? `
                <span class="aquila-r26-derived">
                  Derived
                </span>
              `
            : ""
        }
      </td>
    `;
  }

  function hashParams() {
    try {
      return new URLSearchParams(
        String(
          window.__AQUILA_FINANCE_BALANCE_R35_ROUTE__.compatHash() || ""
        ).replace(/^#/, "")
      );
    } catch (_) {
      return new URLSearchParams();
    }
  }

  function route() {
    const params =
      hashParams();

    return {
      section:
        params.get(
          "section"
        ),

      finance:
        params.get(
          "finance"
        ),
    };
  }

  function isPnlRoute() {

    /*
     * AQUILA_PNL_CASHFLOW_TABLE_STANDARD_R3_HASH_ROUTE_PRECEDENCE_FIX
     *
     * The native Finance workspace treats the hash route as the current
     * browser workspace. A stale query-string Finance value must not block
     * the already-mounted canonical Profit & Loss hash route.
     *
     * This is a reader-only compatibility guard. It does not write history,
     * location, route state, DOM state, or network state.
     */
    const aquilaQb31R3HashRoute =
      new URLSearchParams(
        String(
          window.location.hash || ""
        ).replace(
          /^#/,
          ""
        )
      );

    if (
      aquilaQb31R3HashRoute.get(
        "section"
      ) === "finance"
      &&
      aquilaQb31R3HashRoute.get(
        "finance"
      ) === "financial-statements"
    ) {
      const aquilaQb31R3Statement =
        aquilaQb31R3HashRoute.get(
          "statement"
        );

      if (
        aquilaQb31R3Statement
        === "balance-sheet"
      ) {
        return false;
      }

      if (
        aquilaQb31R3Statement
        === "profit-loss"
      ) {
        return true;
      }

      if (
        !aquilaQb31R3Statement
        &&
        document.querySelector(
          "section.profit-loss-v1"
        )
      ) {
        return true;
      }
    }

    const current =
      route();

    return (
      current.section ===
        "finance"
      &&
      current.finance ===
        "financial-statements"
    );
  }

  function isBalanceRoute() {
    const current =
      route();

    return (
      current.section ===
        "finance"
      &&
      current.finance ===
        "balance-sheet"
    );
  }

  function pnlRoot() {
    return document.querySelector(
      "section.profit-loss-v1"
    );
  }

  function pnlNativeStatement() {
    const root =
      pnlRoot();

    return (
      root?.querySelector(
        ":scope > article.profit-loss-v1__panel.profit-loss-v1__statement"
      )
      ||
      null
    );
  }

  function balanceRoot() {
    return document.getElementById(
      "aquila-finance-balance-sheet-r22"
    );
  }

  function storageRead(
    storage,
    key
  ) {
    try {
      return (
        storage
          ?.getItem(
            key
          )
        ||
        ""
      );
    } catch (_) {
      return "";
    }
  }

  function parseJson(raw) {
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(
        raw
      );
    } catch (_) {
      return null;
    }
  }

  function firstText(
    ...values
  ) {
    for (
      const value
      of values
    ) {
      if (
        typeof value ===
          "string"
        &&
        value.trim()
      ) {
        return value.trim();
      }
    }

    return "";
  }

  function auth() {
    const sessions = [
      parseJson(
        storageRead(
          localStorage,
          "ubuzima_admin_session"
        )
      ),

      parseJson(
        storageRead(
          sessionStorage,
          "ubuzima_admin_session"
        )
      ),
    ].filter(Boolean);

    let token =
      firstText(
        storageRead(
          localStorage,
          "ubuzima.token"
        ),

        storageRead(
          sessionStorage,
          "ubuzima.token"
        ),

        storageRead(
          localStorage,
          "access_token"
        ),

        storageRead(
          sessionStorage,
          "access_token"
        ),

        storageRead(
          localStorage,
          "authToken"
        ),

        storageRead(
          sessionStorage,
          "authToken"
        )
      );

    let tenant =
      firstText(
        storageRead(
          localStorage,
          "ubuzima.currentTenantSlug"
        ),

        storageRead(
          sessionStorage,
          "ubuzima.currentTenantSlug"
        ),

        storageRead(
          localStorage,
          "pharmaco.tenantSlug"
        ),

        storageRead(
          sessionStorage,
          "pharmaco.tenantSlug"
        )
      );

    for (
      const session
      of sessions
    ) {
      token ||=
        firstText(
          session?.token,
          session?.access_token,
          session?.accessToken
        );

      tenant ||=
        firstText(
          session?.tenant_slug,
          session?.tenantSlug,
          session?.tenant?.slug,
          session?.profile
            ?.tenant
            ?.slug,
          session?.profile
            ?.tenant_assignments
            ?.[0]
            ?.tenant
            ?.slug,
          session
            ?.tenant_assignments
            ?.[0]
            ?.tenant
            ?.slug
        );
    }

    return {
      token,
      tenant,
    };
  }

  async function apiGet(
    endpoint
  ) {
    const context =
      auth();

    if (!context.token) {
      throw new Error(
        "Secure Finance session could not be resolved."
      );
    }

    if (!context.tenant) {
      throw new Error(
        "Finance tenant context could not be resolved."
      );
    }

    const url =
      new URL(
        endpoint,
        location.origin
      );

    url.searchParams.set(
      "as_of",
      state.asOf
    );

    const response =
      await fetch(
        url.toString(),
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${context.token}`,

            "X-Tenant-Slug":
              context.tenant,
          },

          credentials:
            "include",

          cache:
            "no-store",
        }
      );

    let payload =
      null;

    try {
      payload =
        await response.json();
    } catch (_) {
      payload =
        null;
    }

    if (!response.ok) {
      throw new Error(
        payload?.message
        ||
        (
          "Finance report request failed with HTTP "
          + response.status
        )
      );
    }

    return payload;
  }

  function navigateFinance(
    finance
  ) {
    const params =
      hashParams();

    params.set(
      "section",
      "finance"
    );

    params.set(
      "finance",
      finance
    );

    params.set(
      "scrollY",
      "0"
    );

    if (finance === "balance-sheet") {
    /*
     * AQUILA_R38_BALANCE_CANONICAL_ROUTE
     *
     * R37 proved that Balance Sheet has one dedicated canonical
     * route contract:
     *
     * section=finance
     * finance=financial-statements
     * statement=balance-sheet
     *
     * Keep monthly reporting as a caller of the existing route
     * owner; do not create a competing legacy finance=balance-sheet
     * route and do not retain the retired aquila-bs marker.
     */
    params.set(
        "finance",
        "financial-statements"
    );

    params.set(
        "statement",
        "balance-sheet"
    );

    params.delete(
        "aquila-bs"
    );
} else {
    params.delete(
        "aquila-bs"
    );
}

    window.__AQUILA_FINANCE_BALANCE_R35_ROUTE__.setHash(params.toString());
  }

  function moneyTd(value) {
    const negative =
      number(value) < 0;

    return `
      <td
        class="aquila-r26-number${
          negative
            ? " aquila-r26-negative"
            : ""
        }"
      >
        ${esc(money(value))}
      </td>
    `;
  }

  function dashTd() {
    return `
      <td class="aquila-r26-number aquila-r26-missing">
        —
      </td>
    `;
  }

  function pctTd(value) {
    return `
      <td class="aquila-r26-number">
        ${esc(pct(value))}
      </td>
    `;
  }

  function pnlTotalRow(
    data,
    metric
  ) {
    const labels = {
      income:
        "Total Income",

      expenses:
        "Total Expenses",

      net_income:
        "Net Profit / (Loss)",
    };

    const currentYtd =
      number(
        data
          ?.totals
          ?.current_ytd
          ?.[metric]
      );

    const previousYtd =
      number(
        data
          ?.totals
          ?.previous_ytd
          ?.[metric]
      );

    return {
      code:
        "",

      name:
        labels[metric],

      account_type:
        "total",

      ytd_budget:
        null,

      ytd_actual:
        currentYtd,

      ytd_achieved_pct:
        null,

      previous_ytd_actual:
        previousYtd,

      ytd_yoy_change_pct:
        Math.abs(
          previousYtd
        ) <= 0.005
          ? null
          : (
              (
                currentYtd
                -
                previousYtd
              )
              /
              Math.abs(
                previousYtd
              )
            )
            * 100,

      months:
        Object.fromEntries(
          (
            data.periods
            || []
          ).map(
            period => {
              const current =
                number(
                  data
                    ?.totals
                    ?.months
                    ?.[period.key]
                    ?.current
                    ?.[metric]
                );

              const previous =
                number(
                  data
                    ?.totals
                    ?.months
                    ?.[period.key]
                    ?.previous
                    ?.[metric]
                );

              return [
                period.key,
                {
                  target:
                    null,

                  actual:
                    current,

                  achieved_pct:
                    null,

                  previous_actual:
                    previous,

                  yoy_change_pct:
                    Math.abs(
                      previous
                    ) <= 0.005
                      ? null
                      : (
                          (
                            current
                            -
                            previous
                          )
                          /
                          Math.abs(
                            previous
                          )
                        )
                        * 100,
                },
              ];
            }
          )
        ),
    };
  }

  function pnlPerformanceRow(
    row,
    periods,
    total = false
  ) {
    return `
      <tr
        class="${
          total
            ? "aquila-r26-total"
            : ""
        }"
      >
        ${detailsCell(row)}

        ${dashTd()}
        ${moneyTd(row.ytd_actual)}
        ${dashTd()}

        ${
          periods.map(
            period => {
              const month =
                row.months
                  ?.[period.key]
                || {};

              return (
                dashTd()
                +
                moneyTd(
                  month.actual
                )
                +
                dashTd()
              );
            }
          ).join("")
        }
      </tr>
    `;
  }

  function pnlYoyRow(
    row,
    periods,
    total = false
  ) {
    return `
      <tr
        class="${
          total
            ? "aquila-r26-total"
            : ""
        }"
      >
        ${detailsCell(row)}

        ${moneyTd(row.ytd_actual)}

        ${moneyTd(
          row.previous_ytd_actual
        )}

        ${pctTd(
          row.ytd_yoy_change_pct
        )}

        ${
          periods.map(
            period => {
              const month =
                row.months
                  ?.[period.key]
                || {};

              return (
                moneyTd(
                  month.actual
                )
                +
                moneyTd(
                  month.previous_actual
                )
                +
                pctTd(
                  month.yoy_change_pct
                )
              );
            }
          ).join("")
        }
      </tr>
    `;
  }

  function pnlSectionBody(
    data,
    mode
  ) {
    const periods =
      data.periods
      || [];

    const rows =
      data.rows
      || [];

    const groups = [
      [
        "Income",
        rows.filter(
          row =>
            row.account_type ===
            "income"
        ),
        pnlTotalRow(
          data,
          "income"
        ),
      ],

      [
        "Expenses",
        rows.filter(
          row =>
            row.account_type ===
            "expense"
        ),
        pnlTotalRow(
          data,
          "expenses"
        ),
      ],
    ];

    const colspan =
      mode === "performance"
        ? 4
          +
          (
            periods.length
            * 3
          )
        : 4
          +
          (
            periods.length
            * 3
          );

    const renderRow =
      mode === "performance"
        ? pnlPerformanceRow
        : pnlYoyRow;

    const body = [];

    for (
      const [
        label,
        groupRows,
        total,
      ]
      of groups
    ) {
      body.push(`
        <tr class="aquila-r26-group">
          <th colspan="${colspan}">
            ${esc(label)}
          </th>
        </tr>
      `);

      for (
        const row
        of groupRows
      ) {
        body.push(
          renderRow(
            row,
            periods,
            false
          )
        );
      }

      body.push(
        renderRow(
          total,
          periods,
          true
        )
      );
    }

    body.push(
      renderRow(
        pnlTotalRow(
          data,
          "net_income"
        ),
        periods,
        true
      )
    );

    return body.join("");
  }

  function pnlPerformanceTable(
    data
  ) {
    const periods =
      data.periods
      || [];

    return `
      <section class="aquila-r26-block">
        <div class="aquila-r26-block-title">
          <div>
            <span>Management Performance</span>

            <h3>
              Monthly Budget / Target vs Actual
            </h3>
          </div>

          <small>
            ${esc(data.year)}
          </small>
        </div>

        <div class="aquila-r26-scroll">
          <table class="aquila-r26-table">
            <thead>
              <tr>
                <th class="aquila-r26-details">
                  Details
                </th>

                <th>YTD Budget</th>
                <th>YTD Actual</th>
                <th>% Achieved</th>

                ${
                  periods.map(
                    period => `
                      <th>
                        ${esc(period.month)}
                        ${esc(period.target_label)}
                      </th>

                      <th>
                        ${esc(period.month)}
                        Actual
                      </th>

                      <th>
                        % Achieved
                      </th>
                    `
                  ).join("")
                }
              </tr>
            </thead>

            <tbody>
              ${
                pnlSectionBody(
                  data,
                  "performance"
                )
              }
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function pnlYoyTable(
    data
  ) {
    const periods =
      data.periods
      || [];

    return `
      <section class="aquila-r26-block">
        <div class="aquila-r26-block-title">
          <div>
            <span>Year-over-Year</span>

            <h3>
              YoY Trend
            </h3>
          </div>

          <small>
            ${esc(data.year)}
            vs
            ${esc(data.previous_year)}
          </small>
        </div>

        <div class="aquila-r26-scroll">
          <table class="aquila-r26-table">
            <thead>
              <tr>
                <th class="aquila-r26-details">
                  Details
                </th>

                <th>
                  YTD ${esc(data.year)} Actual
                </th>

                <th>
                  YTD ${esc(data.previous_year)} Actual
                </th>

                <th>
                  % Change
                </th>

                ${
                  periods.map(
                    period => `
                      <th>
                        ${esc(period.month)}
                        ${esc(data.year)}
                        Actual
                      </th>

                      <th>
                        ${esc(period.month)}
                        ${esc(data.previous_year)}
                        Actual
                      </th>

                      <th>
                        % Change
                      </th>
                    `
                  ).join("")
                }
              </tr>
            </thead>

            <tbody>
              ${
                pnlSectionBody(
                  data,
                  "yoy"
                )
              }
            </tbody>
          </table>
        </div>
      </section>
    `;
  }


  /*
   * AQUILA_QB3_1_PNL_COMPARATIVE_REPORTING
   *
   * SAME canonical P&L owner.
   *
   * No new route owner.
   * No document-level click owner.
   * No DOM observer owner.
   * No background interval.
   * No global fetch replacement.
   */

  const QB31_PANEL_ID =
    "aquila-qb31-pnl-management";

  const QB31_STYLE_ID =
    "aquila-qb31-pnl-style";

  const QB31_PNL_ENDPOINT =
    "/api/v1/pharmaco/finance/commercial/profit-loss";

  const QB31_GL_ENDPOINT =
    "/api/v1/pharmaco/accounting/general-ledger-report";

  let qb31Bundle = null;
  let qb31LoadingKey = "";
  let qb31Sequence = 0;


  function qb31Read(storage, key) {
    try {
      return storage.getItem(key) || "";
    } catch (_) {
      return "";
    }
  }


  function qb31Json(value) {
    try {
      return value
        ? JSON.parse(value)
        : null;
    } catch (_) {
      return null;
    }
  }


  function qb31First(...values) {
    return (
      values.find(
        value =>
          typeof value === "string"
          &&
          value.trim()
      )?.trim()
      ||
      ""
    );
  }


  function qb31Auth() {
    const sessions = [
      qb31Json(
        qb31Read(
          localStorage,
          "ubuzima_admin_session"
        )
      ),

      qb31Json(
        qb31Read(
          sessionStorage,
          "ubuzima_admin_session"
        )
      )
    ].filter(Boolean);

    let token =
      qb31First(
        qb31Read(
          localStorage,
          "ubuzima.token"
        ),

        qb31Read(
          sessionStorage,
          "ubuzima.token"
        ),

        qb31Read(
          localStorage,
          "access_token"
        ),

        qb31Read(
          sessionStorage,
          "access_token"
        ),

        qb31Read(
          localStorage,
          "authToken"
        ),

        qb31Read(
          sessionStorage,
          "authToken"
        )
      );

    let tenant =
      qb31First(
        qb31Read(
          localStorage,
          "ubuzima.currentTenantSlug"
        ),

        qb31Read(
          sessionStorage,
          "ubuzima.currentTenantSlug"
        ),

        qb31Read(
          localStorage,
          "pharmaco.tenantSlug"
        ),

        qb31Read(
          sessionStorage,
          "pharmaco.tenantSlug"
        )
      );

    for (const session of sessions) {
      token ||=
        qb31First(
          session?.token,
          session?.access_token,
          session?.accessToken,
          session?.authToken,
          session?.profile?.token,
          session?.profile?.access_token,
          session?.user?.token,
          session?.user?.access_token
        );

      tenant ||=
        qb31First(
          session?.tenant_slug,
          session?.tenantSlug,
          session?.tenant?.slug,
          session?.profile?.tenant_slug,
          session?.profile?.tenantSlug,
          session?.profile?.tenant?.slug,
          session?.profile
            ?.tenant_assignments
            ?.[0]
            ?.tenant
            ?.slug,
          session
            ?.tenant_assignments
            ?.[0]
            ?.tenant
            ?.slug
        );
    }

    token =
      String(
        token || ""
      )
        .replace(
          /^Bearer\s+/i,
          ""
        )
        .trim();

    tenant =
      String(
        tenant || ""
      ).trim();

    return {
      token,
      tenant
    };
  }


  function qb31Headers() {
    const auth =
      qb31Auth();

    const result = {
      Accept:
        "application/json",

      "X-Requested-With":
        "XMLHttpRequest"
    };

    if (auth.token) {
      result.Authorization =
        `Bearer ${auth.token}`;
    }

    if (auth.tenant) {
      result[
        "X-Tenant-Slug"
      ] =
        auth.tenant;
    }

    return result;
  }


  async function qb31Get(url) {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          credentials:
            "same-origin",

          headers:
            qb31Headers()
        }
      );

    const payload =
      await response
        .json()
        .catch(
          () => null
        );

    if (!response.ok) {
      throw new Error(
        payload?.message
        ||
        `Request failed (${response.status}).`
      );
    }

    return payload;
  }


  function qb31Body(payload) {
    if (
      payload
      &&
      payload.data
      &&
      !Array.isArray(
        payload.data
      )
    ) {
      return payload.data;
    }

    return payload || {};
  }


  function qb31Rows(payload) {
    const body =
      qb31Body(payload);

    if (Array.isArray(body.rows)) {
      return body.rows;
    }

    if (
      body.rows
      &&
      Array.isArray(
        body.rows.data
      )
    ) {
      return body.rows.data;
    }

    if (Array.isArray(body.data)) {
      return body.data;
    }

    return [];
  }


  function qb31Number(value) {
    if (
      value === null
      ||
      value === undefined
      ||
      value === ""
    ) {
      return null;
    }

    const result =
      Number(value);

    return Number.isFinite(result)
      ? result
      : null;
  }


  function qb31Metric(
    payload,
    key
  ) {
    const body =
      qb31Body(payload);

    if (
      body.summary
      &&
      !Array.isArray(
        body.summary
      )
    ) {
      const direct =
        qb31Number(
          body.summary[key]
        );

      if (direct !== null) {
        return direct;
      }
    }

    const summary =
      Array.isArray(
        body.summary
      )
        ? body.summary
        : [];

    const metric =
      summary.find(
        item =>
          String(
            item?.key
            ??
            item?.id
            ??
            item?.code
            ??
            ""
          )
            .trim()
            .toLowerCase()
          ===
          String(key)
            .trim()
            .toLowerCase()
      );

    return metric
      ? qb31Number(
          metric.value
          ??
          metric.amount
          ??
          metric.total
        )
      : null;
  }


  function qb31Escape(value) {
    return String(
      value ?? ""
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function qb31Money(value) {
    const number =
      qb31Number(value);

    if (number === null) {
      return "—";
    }

    return new Intl.NumberFormat(
      "en-RW",
      {
        style:
          "currency",

        currency:
          "RWF",

        minimumFractionDigits:
          0,

        maximumFractionDigits:
          0
      }
    ).format(number);
  }


  function qb31Percent(value) {
    const number =
      qb31Number(value);

    if (number === null) {
      return "—";
    }

    return (
      new Intl.NumberFormat(
        "en-RW",
        {
          minimumFractionDigits:
            1,

          maximumFractionDigits:
            1
        }
      ).format(number)
      +
      "%"
    );
  }


  function qb31Dates() {
    const current =
      qb31Body(
        state.pnl
      );

    const from =
      String(
        current?.from
        ??
        ""
      ).trim();

    const to =
      String(
        current?.to
        ??
        ""
      ).trim();

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(from)
      &&
      /^\d{4}-\d{2}-\d{2}$/.test(to)
    ) {
      return {
        from,
        to
      };
    }

    const root =
      pnlRoot();

    if (!root) {
      return null;
    }

    const values = [
      ...root.querySelectorAll(
        'input[type="date"]'
      )
    ]
      .map(
        input =>
          String(
            input.value
            ||
            ""
          ).trim()
      )
      .filter(
        value =>
          /^\d{4}-\d{2}-\d{2}$/
            .test(value)
      );

    return values.length >= 2
      ? {
          from:
            values[0],

          to:
            values[1]
        }
      : null;
  }


  function qb31PreviousYear(value) {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/
        .exec(value);

    if (!match) {
      return "";
    }

    const year =
      Number(match[1]) - 1;

    const month =
      Number(match[2]);

    const day =
      Number(match[3]);

    const maxDay =
      new Date(
        Date.UTC(
          year,
          month,
          0
        )
      ).getUTCDate();

    const safeDay =
      Math.min(
        day,
        maxDay
      );

    return (
      String(year)
      +
      "-"
      +
      String(month)
        .padStart(2, "0")
      +
      "-"
      +
      String(safeDay)
        .padStart(2, "0")
    );
  }


  function qb31Style() {
    if (
      document.getElementById(
        QB31_STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      QB31_STYLE_ID;

    style.textContent = `
      #${QB31_PANEL_ID} {
        margin-top: 18px;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        background: #fff;
        overflow: hidden;
      }

      #${QB31_PANEL_ID} .qb31-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 18px;
        border-bottom: 1px solid #e2e8f0;
      }

      #${QB31_PANEL_ID} .qb31-title {
        margin: 0;
        font-size: 16px;
        font-weight: 800;
        color: #172033;
      }

      #${QB31_PANEL_ID} .qb31-subtitle {
        margin: 4px 0 0;
        font-size: 12px;
        color: #64748b;
      }

      #${QB31_PANEL_ID} .qb31-period {
        font-size: 12px;
        color: #475569;
        text-align: right;
      }

      #${QB31_PANEL_ID} .qb31-status {
        padding: 11px 18px;
        font-size: 12px;
        color: #64748b;
        border-bottom: 1px solid #eef2f7;
      }

      #${QB31_PANEL_ID} .qb31-wrap {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      #${QB31_PANEL_ID} table {
        width: 100%;
        min-width: 760px;
        border-collapse: collapse;
      }

      #${QB31_PANEL_ID} th,
      #${QB31_PANEL_ID} td {
        padding: 11px 14px;
        border-bottom: 1px solid #eef2f7;
        font-size: 12px;
        vertical-align: middle;
      }

      #${QB31_PANEL_ID} th {
        text-align: left;
        background: #f8fafc;
        color: #475569;
      }

      #${QB31_PANEL_ID} .qb31-num {
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      #${QB31_PANEL_ID} .qb31-account {
        min-width: 210px;
      }

      #${QB31_PANEL_ID} .qb31-ledger-button {
        border: 1px solid #991a21;
        background: #fff;
        color: #991a21;
        border-radius: 8px;
        padding: 6px 9px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
      }

      #${QB31_PANEL_ID} .qb31-ledger {
        margin: 14px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
      }

      #${QB31_PANEL_ID} .qb31-ledger-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 11px 13px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        font-size: 12px;
      }

      #${QB31_PANEL_ID} .qb31-note {
        padding: 12px 18px;
        color: #64748b;
        background: #fafafa;
        font-size: 11px;
      }

      @media (max-width: 768px) {
        #${QB31_PANEL_ID} .qb31-head {
          display: block;
        }

        #${QB31_PANEL_ID} .qb31-period {
          margin-top: 8px;
          text-align: left;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }


  function qb31Panel() {
    qb31Style();

    const native =
      pnlNativeStatement();

    if (!native) {
      return null;
    }

    let panel =
      document.getElementById(
        QB31_PANEL_ID
      );

    if (!panel) {
      panel =
        document.createElement(
          "article"
        );

      panel.id =
        QB31_PANEL_ID;

      panel.innerHTML = `
        <div class="qb31-head">
          <div>
            <h3 class="qb31-title">
              Comparative Management Detail
            </h3>

            <p class="qb31-subtitle">
              Previous Year, % of Income and posted ledger drill-down.
            </p>
          </div>

          <div class="qb31-period"></div>
        </div>

        <div class="qb31-status">
          Preparing comparative reporting…
        </div>

        <div class="qb31-wrap qb31-table"></div>

        <div
          class="qb31-ledger"
          hidden>
        </div>

        <div class="qb31-note">
          Current, Comparison, Change and % Change remain unchanged
          in the approved statement above. Unsupported COGS or
          Gross Profit totals are not fabricated.
        </div>
      `;

      native.insertAdjacentElement(
        "afterend",
        panel
      );
    }

    return panel;
  }


  function qb31PnlUrl(
    from,
    to
  ) {
    return (
      QB31_PNL_ENDPOINT
      +
      "?from="
      +
      encodeURIComponent(from)
      +
      "&to="
      +
      encodeURIComponent(to)
      +
      "&page=1&per_page=500"
    );
  }


  function qb31PreviousMap(payload) {
    const map =
      new Map();

    qb31Rows(payload)
      .forEach(
        row => {
          const code =
            String(
              row?.code
              ??
              ""
            ).trim();

          if (code) {
            map.set(
              code,
              row
            );
          }
        }
      );

    return map;
  }



  /*
   * AQUILA_PNL_CASHFLOW_TABLE_STANDARD_R1\n   * AQUILA_PNL_CASHFLOW_TABLE_STANDARD_R2_BROWSER_OWNER_FIX
   *
   * Presentation standard only.
   *
   * Uses the EXISTING P&L monthly-position table already rendered
   * by this canonical owner.
   *
   * No API owner.
   * No route owner.
   * No background polling.
   * No observer.
   * No global click interception.
   */

  const QB31_CF_STYLE_ID =
    "aquila-pnl-cashflow-standard-style-r1";

  const QB31_CF_STANDARD_ATTR =
    "data-aquila-pnl-cashflow-standard";

  const QB31_CF_HOST_ATTR =
    "data-aquila-pnl-cashflow-host";


  function qb31CfClean(
    value
  ) {
    return String(
      value
      ??
      ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }


  function qb31CfParse(
    value
  ) {
    let raw =
      qb31CfClean(
        value
      );

    if (
      !raw
      ||
      raw === "—"
      ||
      raw === "-"
    ) {
      return null;
    }

    const negativeByBrackets =
      /^\(.*\)$/.test(
        raw
      );

    raw =
      raw
        .replace(
          /RWF/gi,
          ""
        )
        .replace(
          /,/g,
          ""
        )
        .replace(
          /%/g,
          ""
        )
        .replace(
          /\(/g,
          ""
        )
        .replace(
          /\)/g,
          ""
        )
        .replace(
          /\s+/g,
          ""
        );

    const number =
      Number(
        raw
      );

    if (
      !Number.isFinite(
        number
      )
    ) {
      return null;
    }

    return negativeByBrackets
      ?
      -Math.abs(
        number
      )
      :
      number;
  }


  function qb31CfMonthNumber(
    month
  ) {
    return [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december"
    ].indexOf(
      String(
        month
        ||
        ""
      ).toLowerCase()
    )
    +
    1;
  }


  function qb31CfShortMonth(
    month
  ) {
    const value =
      String(
        month
        ||
        ""
      );

    return value
      .slice(
        0,
        3
      )
      .toUpperCase();
  }


  function qb31CfHeader(
    month,
    year,
    index
  ) {
    if (index < 2) {
      return (
        String(
          month
        ).toUpperCase()
        +
        " "
        +
        String(
          year
        )
      );
    }

    return (
      qb31CfShortMonth(
        month
      )
      +
      " "
      +
      String(
        year
      )
    );
  }


  function qb31CfValue(
    raw,
    percentage
  ) {
    const number =
      qb31CfParse(
        raw
      );

    if (number === null) {
      return qb31CfClean(
        raw
      )
      ||
      "—";
    }

    return percentage
      ?
      qb31Percent(
        number
      )
      :
      qb31Money(
        number
      );
  }


  function qb31CfEnsureStyle() {
    if (
      document.getElementById(
        QB31_CF_STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      QB31_CF_STYLE_ID;

    style.textContent = `
      [${QB31_CF_HOST_ATTR}="1"]
      > :not([${QB31_CF_STANDARD_ATTR}="1"]) {
        display: none !important;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] {
        display: block;
        width: 100%;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] .qb31-cf-card {
        width: 100%;
        border: 1px solid #dce4eb;
        border-radius: 12px;
        background: #ffffff;
        overflow: hidden;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] .qb31-cf-card > header {
        padding: 14px 16px;
        border-bottom: 1px solid #e3e9ef;
        background: #ffffff;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] .qb31-cf-card > header h2 {
        margin: 0;
        color: #172033;
        font-size: 15px;
        font-weight: 800;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] .qb31-cf-scroll {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] table {
        width: 100%;
        min-width: 1240px;
        border-collapse: collapse;
        table-layout: auto;
        background: #ffffff;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] th,
      [${QB31_CF_STANDARD_ATTR}="1"] td {
        padding: 10px 12px;
        border-right: 1px solid #dfe6ec;
        border-bottom: 1px solid #dfe6ec;
        font-size: 12px;
        line-height: 1.35;
        vertical-align: middle;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] thead th {
        color: #53667e;
        background: #f8fafc;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .07em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] th:first-child,
      [${QB31_CF_STANDARD_ATTR}="1"] td:first-child {
        position: sticky;
        left: 0;
        z-index: 2;
        min-width: 260px;
        width: 260px;
        text-align: left;
        background: #ffffff;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] thead th:first-child {
        z-index: 4;
        background: #f8fafc;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] .qb31-cf-current {
        background: #eef8f3 !important;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] thead .qb31-cf-current {
        border-top: 2px solid #82bea4;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] .qb31-cf-previous {
        background: #eef4fb !important;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] thead .qb31-cf-previous {
        border-top: 2px solid #9eb8d8;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] .qb31-cf-change {
        background: #f7f2ea !important;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] .qb31-cf-change-pct {
        background: #f8f4ec !important;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] thead .qb31-cf-change,
      [${QB31_CF_STANDARD_ATTR}="1"] thead .qb31-cf-change-pct {
        border-top: 2px solid #d8b98d;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] .qb31-cf-num {
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] .qb31-cf-section td {
        position: static !important;
        background: #f8fafc !important;
        color: #1f2b3d;
        font-weight: 800;
        letter-spacing: .02em;
        text-transform: uppercase;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] .qb31-cf-total td {
        font-weight: 800;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] .qb31-cf-total td:first-child {
        font-weight: 800;
      }

      [${QB31_CF_STANDARD_ATTR}="1"] tbody tr:last-child td {
        border-bottom: 0;
      }

      @media (max-width: 768px) {
        [${QB31_CF_STANDARD_ATTR}="1"] table {
          min-width: 1120px;
        }

        [${QB31_CF_STANDARD_ATTR}="1"] th,
        [${QB31_CF_STANDARD_ATTR}="1"] td {
          padding: 9px 10px;
        }

        [${QB31_CF_STANDARD_ATTR}="1"] th:first-child,
        [${QB31_CF_STANDARD_ATTR}="1"] td:first-child {
          min-width: 220px;
          width: 220px;
        }
      }

      @media (max-width: 430px) {
        [${QB31_CF_STANDARD_ATTR}="1"] .qb31-cf-card > header {
          padding: 12px;
        }

        [${QB31_CF_STANDARD_ATTR}="1"] table {
          min-width: 1080px;
        }

        [${QB31_CF_STANDARD_ATTR}="1"] th:first-child,
        [${QB31_CF_STANDARD_ATTR}="1"] td:first-child {
          min-width: 190px;
          width: 190px;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }


  function qb31ApplyCashflowTableStandard() {
    qb31CfEnsureStyle();

    const root =
      pnlRoot();

    if (!root) {
      return false;
    }

    const host =
      document.getElementById(
        "aquila-pnl-monthly-r26"
      )
      ||
      root.querySelector(
        '[id^="aquila-pnl-monthly-"]'
      );

    if (!host) {
      return false;
    }

    const tables = [
      ...host.querySelectorAll(
        "table"
      )
    ].filter(
      table =>
        !table.closest(
          `[${QB31_CF_STANDARD_ATTR}="1"]`
        )
    );

    const monthPattern =
      /^(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?\s+Actual$/i;

    let sourceTable =
      null;

    let sourceHeaders =
      [];

    for (const table of tables) {
      const headers = [
        ...table.querySelectorAll(
          "thead th"
        )
      ].map(
        th =>
          qb31CfClean(
            th.textContent
          )
      );

      const actualMonthCount =
        headers.filter(
          header =>
            monthPattern.test(
              header
            )
        ).length;

      if (actualMonthCount >= 2) {
        sourceTable =
          table;

        sourceHeaders =
          headers;

        break;
      }
    }

    if (!sourceTable) {
      return false;
    }

    const months = [];

    sourceHeaders.forEach(
      (
        header,
        index
      ) => {
        const match =
          monthPattern.exec(
            header
          );

        if (!match) {
          return;
        }

        months.push(
          {
            index,
            name:
              match[1],

            monthNumber:
              qb31CfMonthNumber(
                match[1]
              )
          }
        );
      }
    );

    if (months.length < 2) {
      return false;
    }

    const selected =
      months.slice(
        0,
        8
      );

    const activeDates =
      qb31Dates();

    let year =
      Number(
        String(
          activeDates?.to
          ||
          ""
        ).slice(
          0,
          4
        )
      );

    if (
      !Number.isFinite(
        year
      )
    ) {
      year =
        new Date()
          .getFullYear();
    }

    let priorMonthNumber =
      null;

    const periodColumns =
      selected.map(
        (
          month,
          index
        ) => {
          if (
            index > 0
            &&
            priorMonthNumber !== null
            &&
            month.monthNumber >
              priorMonthNumber
          ) {
            year -= 1;
          }

          priorMonthNumber =
            month.monthNumber;

          return {
            ...month,

            year,

            label:
              qb31CfHeader(
                month.name,
                year,
                index
              )
          };
        }
      );

    const totalColumns =
      periodColumns.length
      +
      3;

    const sourceRows = [
      ...sourceTable.querySelectorAll(
        "tbody tr"
      )
    ];

    const rows =
      sourceRows.map(
        row => {
          const cells = [
            ...row.querySelectorAll(
              "th,td"
            )
          ];

          if (!cells.length) {
            return "";
          }

          const label =
            qb31CfClean(
              cells[0]
                ?.textContent
            );

          if (!label) {
            return "";
          }

          const rowClass =
            String(
              row.className
              ||
              ""
            );

          const isSection =
            cells.length === 1
            ||
            Number(
              cells[0]
                ?.colSpan
                ||
                1
            ) > 1
            ||
            /section|account-class/i
              .test(
                rowClass
              );

          if (isSection) {
            return `
              <tr class="qb31-cf-section">
                <td colspan="${totalColumns}">
                  ${qb31Escape(label)}
                </td>
              </tr>
            `;
          }

          const values =
            periodColumns.map(
              period =>
                qb31CfClean(
                  cells[
                    period.index
                  ]
                    ?.textContent
                )
            );

          const currentRaw =
            values[0]
            ??
            "";

          const previousRaw =
            values[1]
            ??
            "";

          const percentage =
            /margin|rate|percentage|%/i
              .test(
                label
              )
            ||
            currentRaw.includes(
              "%"
            )
            ||
            previousRaw.includes(
              "%"
            );

          const currentValue =
            qb31CfParse(
              currentRaw
            );

          const previousValue =
            qb31CfParse(
              previousRaw
            );

          const change =
            (
              currentValue !== null
              &&
              previousValue !== null
            )
              ?
              currentValue
              -
              previousValue
              :
              null;

          const percentChange =
            (
              change !== null
              &&
              previousValue !== null
            )
              ?
              (
                previousValue === 0
                  ?
                  (
                    currentValue === 0
                      ?
                      0
                      :
                      null
                  )
                  :
                  (
                    change
                    /
                    Math.abs(
                      previousValue
                    )
                    *
                    100
                  )
              )
              :
              null;

          const historical =
            values
              .slice(
                2
              )
              .map(
                raw => `
                  <td class="qb31-cf-num">
                    ${
                      qb31Escape(
                        qb31CfValue(
                          raw,
                          percentage
                        )
                      )
                    }
                  </td>
                `
              )
              .join("");

          const totalRow =
            /(^|\s)(total|net profit|net income|profit margin)(\s|$)/i
              .test(
                label
              )
            ||
            /total|summary/i
              .test(
                rowClass
              );

          return `
            <tr class="${totalRow ? "qb31-cf-total" : ""}">
              <td>
                ${qb31Escape(label)}
              </td>

              <td class="qb31-cf-num qb31-cf-current">
                ${
                  qb31Escape(
                    qb31CfValue(
                      currentRaw,
                      percentage
                    )
                  )
                }
              </td>

              <td class="qb31-cf-num qb31-cf-previous">
                ${
                  qb31Escape(
                    qb31CfValue(
                      previousRaw,
                      percentage
                    )
                  )
                }
              </td>

              <td class="qb31-cf-num qb31-cf-change">
                ${
                  change === null
                    ?
                    "—"
                    :
                    qb31Escape(
                      percentage
                        ?
                        qb31Percent(
                          change
                        )
                        :
                        qb31Money(
                          change
                        )
                    )
                }
              </td>

              <td class="qb31-cf-num qb31-cf-change-pct">
                ${
                  percentChange === null
                    ?
                    "—"
                    :
                    qb31Escape(
                      qb31Percent(
                        percentChange
                      )
                    )
                }
              </td>

              ${historical}
            </tr>
          `;
        }
      )
      .join("");

    const historicalHeaders =
      periodColumns
        .slice(
          2
        )
        .map(
          period => `
            <th class="qb31-cf-num">
              ${qb31Escape(period.label)}
            </th>
          `
        )
        .join("");

    let standard =
      host.querySelector(
        `[${QB31_CF_STANDARD_ATTR}="1"]`
      );

    if (!standard) {
      standard =
        document.createElement(
          "section"
        );

      standard.setAttribute(
        QB31_CF_STANDARD_ATTR,
        "1"
      );

      host.appendChild(
        standard
      );
    }

    standard.innerHTML = `
      <article class="qb31-cf-card">
        <header>
          <h2>
            Profit &amp; Loss Statement
          </h2>
        </header>

        <div class="qb31-cf-scroll">
          <table
            aria-label="Profit and Loss Statement monthly comparison"
          >
            <thead>
              <tr>
                <th>
                  Particulars
                </th>

                <th class="qb31-cf-num qb31-cf-current">
                  ${qb31Escape(periodColumns[0].label)}
                </th>

                <th class="qb31-cf-num qb31-cf-previous">
                  ${qb31Escape(periodColumns[1].label)}
                </th>

                <th class="qb31-cf-num qb31-cf-change">
                  Change
                </th>

                <th class="qb31-cf-num qb31-cf-change-pct">
                  % Change
                </th>

                ${historicalHeaders}
              </tr>
            </thead>

            <tbody>
              ${
                rows
                ||
                `
                  <tr>
                    <td colspan="${totalColumns}">
                      No authoritative monthly P&amp;L rows available.
                    </td>
                  </tr>
                `
              }
            </tbody>
          </table>
        </div>
      </article>
    `;

    host.setAttribute(
      QB31_CF_HOST_ATTR,
      "1"
    );

    /*
     * Browser truth fix R2:
     * once the standardized table exists,
     * it becomes the visible P&L statement.
     */

    host.hidden =
      false;

    host.style.setProperty(
      "display",
      "block",
      "important"
    );

    standard.hidden =
      false;

    standard.style.setProperty(
      "display",
      "block",
      "important"
    );

    const visibleNative =
      pnlNativeStatement();

    if (visibleNative) {
      visibleNative.hidden =
        true;

      visibleNative.style.setProperty(
        "display",
        "none",
        "important"
      );
    }

    /*
     * Make the statement table primary.
     * QB3.1 management detail remains immediately below it.
     */

    const native =
      pnlNativeStatement();

    const management =
      document.getElementById(
        QB31_PANEL_ID
      );

    if (
      native
      &&
      native.nextElementSibling !== host
    ) {
      native.insertAdjacentElement(
        "afterend",
        host
      );
    }

    if (
      management
      &&
      host.nextElementSibling !== management
    ) {
      host.insertAdjacentElement(
        "afterend",
        management
      );
    }

    return true;
  }

  function qb31Render(bundle) {
    const panel =
      qb31Panel();

    if (!panel) {
      return;
    }

    const currentRows =
      qb31Rows(
        bundle.current
      );

    const previousMap =
      qb31PreviousMap(
        bundle.previous
      );

    const income =
      qb31Metric(
        bundle.current,
        "income"
      );

    panel.querySelector(
      ".qb31-period"
    ).textContent =
      `${bundle.from} – ${bundle.to} · Previous Year ${bundle.previousFrom} – ${bundle.previousTo}`;

    panel.querySelector(
      ".qb31-status"
    ).textContent =
      currentRows.length
        ? `${currentRows.length} authoritative P&L account rows.`
        : "No authoritative P&L account rows.";

    const rows =
      currentRows.map(
        row => {
          const code =
            String(
              row?.code
              ??
              ""
            ).trim();

          const name =
            String(
              row?.name
              ??
              ""
            ).trim();

          const type =
            String(
              row?.account_type
              ??
              ""
            ).trim();

          const current =
            qb31Number(
              row?.balance
            );

          const previousRow =
            previousMap.get(
              code
            );

          const previous =
            previousRow
              ? qb31Number(
                  previousRow.balance
                )
              : null;

          const percent =
            (
              current !== null
              &&
              income !== null
              &&
              income !== 0
            )
              ? (
                  current
                  /
                  income
                  *
                  100
                )
              : null;

          return `
            <tr>
              <td class="qb31-account">
                <strong>${qb31Escape(code)}</strong>
                ${name ? `<div>${qb31Escape(name)}</div>` : ""}
              </td>

              <td>${qb31Escape(type || "—")}</td>

              <td class="qb31-num">
                ${qb31Money(current)}
              </td>

              <td class="qb31-num">
                ${qb31Money(previous)}
              </td>

              <td class="qb31-num">
                ${qb31Percent(percent)}
              </td>

              <td>
                ${
                  code
                    ? `<button
                         type="button"
                         class="qb31-ledger-button"
                         data-qb31-code="${qb31Escape(code)}"
                         data-qb31-name="${qb31Escape(name)}">
                         View Ledger
                       </button>`
                    : "—"
                }
              </td>
            </tr>
          `;
        }
      )
      .join("");

    const wrap =
      panel.querySelector(
        ".qb31-table"
      );

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Account</th>
            <th>Type</th>
            <th class="qb31-num">Current</th>
            <th class="qb31-num">Previous Year</th>
            <th class="qb31-num">% of Income</th>
            <th>Ledger</th>
          </tr>
        </thead>

        <tbody>
          ${
            rows
            ||
            `<tr>
               <td colspan="6">
                 No authoritative P&L rows available.
               </td>
             </tr>`
          }
        </tbody>
      </table>
    `;

    wrap.querySelectorAll(
      "[data-qb31-code]"
    ).forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            void qb31Ledger(
              button.getAttribute(
                "data-qb31-code"
              )
              ||
              "",

              button.getAttribute(
                "data-qb31-name"
              )
              ||
              ""
            );
          }
        );
      }
    );
  

}


  async function qb31Ledger(
    accountCode,
    accountName
  ) {
    if (
      !qb31Bundle
      ||
      !accountCode
    ) {
      return;
    }

    const panel =
      qb31Panel();

    if (!panel) {
      return;
    }

    const ledger =
      panel.querySelector(
        ".qb31-ledger"
      );

    ledger.hidden =
      false;

    ledger.innerHTML = `
      <div class="qb31-status">
        Loading posted ledger for ${qb31Escape(accountCode)}…
      </div>
    `;

    const url =
      QB31_GL_ENDPOINT
      +
      "?from="
      +
      encodeURIComponent(
        qb31Bundle.from
      )
      +
      "&to="
      +
      encodeURIComponent(
        qb31Bundle.to
      )
      +
      "&status=posted"
      +
      "&q="
      +
      encodeURIComponent(
        accountCode
      )
      +
      "&page=1&per_page=250";

    try {
      const payload =
        await qb31Get(url);

      const rows =
        qb31Rows(payload)
          .filter(
            row =>
              String(
                row?.code
                ??
                row?.account_code
                ??
                ""
              ).trim()
              ===
              accountCode
          );

      const body =
        rows.map(
          row => `
            <tr>
              <td>
                ${qb31Escape(
                  row?.business_date
                  ??
                  row?.date
                  ??
                  row?.posted_at
                  ??
                  "—"
                )}
              </td>

              <td>
                ${qb31Escape(
                  row?.journal_number
                  ??
                  row?.entry_number
                  ??
                  row?.reference
                  ??
                  "—"
                )}
              </td>

              <td>
                ${qb31Escape(
                  row?.description
                  ??
                  row?.memo
                  ??
                  "—"
                )}
              </td>

              <td class="qb31-num">
                ${qb31Money(row?.debit)}
              </td>

              <td class="qb31-num">
                ${qb31Money(row?.credit)}
              </td>
            </tr>
          `
        )
        .join("");

      ledger.innerHTML = `
        <div class="qb31-ledger-head">
          <strong>
            ${qb31Escape(accountCode)}
            ${
              accountName
                ? " · " + qb31Escape(accountName)
                : ""
            }
          </strong>

          <span>
            ${qb31Escape(qb31Bundle.from)}
            –
            ${qb31Escape(qb31Bundle.to)}
            · posted
          </span>
        </div>

        <div class="qb31-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Journal</th>
                <th>Description</th>
                <th class="qb31-num">Debit</th>
                <th class="qb31-num">Credit</th>
              </tr>
            </thead>

            <tbody>
              ${
                body
                ||
                `<tr>
                   <td colspan="5">
                     No posted transactions found for this account.
                   </td>
                 </tr>`
              }
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      ledger.innerHTML = `
        <div class="qb31-status">
          ${qb31Escape(
            error?.message
            ||
            "Unable to load posted ledger."
          )}
        </div>
      `;
    }
  }


  function qb31CsvCell(value) {
    return (
      '"'
      +
      String(
        value
        ??
        ""
      ).replace(
        /"/g,
        '""'
      )
      +
      '"'
    );
  }


  function qb31NativeCsvRows() {
    const table =
      pnlNativeStatement()
        ?.querySelector(
          "table"
        );

    if (!table) {
      return [];
    }

    return [
      ...table.querySelectorAll(
        "tr"
      )
    ].map(
      row =>
        [
          ...row.querySelectorAll(
            "th,td"
          )
        ].map(
          cell =>
            String(
              cell.textContent
              ||
              ""
            )
              .replace(
                /\s+/g,
                " "
              )
              .trim()
        )
    );
  }


  function qb31ExportCsv() {
    if (!qb31Bundle) {
      return false;
    }

    const lines = [];

    lines.push(
      [
        "Profit & Loss",
        qb31Bundle.from,
        qb31Bundle.to
      ]
        .map(qb31CsvCell)
        .join(",")
    );

    lines.push("");

    lines.push(
      qb31CsvCell(
        "Approved Comparative Statement"
      )
    );

    qb31NativeCsvRows()
      .forEach(
        row => {
          lines.push(
            row
              .map(qb31CsvCell)
              .join(",")
          );
        }
      );

    lines.push("");

    lines.push(
      qb31CsvCell(
        "QB3.1 Management Detail"
      )
    );

    lines.push(
      [
        "Account",
        "Name",
        "Type",
        "Current",
        "Previous Year",
        "% of Income"
      ]
        .map(qb31CsvCell)
        .join(",")
    );

    const previousMap =
      qb31PreviousMap(
        qb31Bundle.previous
      );

    const income =
      qb31Metric(
        qb31Bundle.current,
        "income"
      );

    qb31Rows(
      qb31Bundle.current
    )
      .forEach(
        row => {
          const code =
            String(
              row?.code
              ??
              ""
            ).trim();

          const current =
            qb31Number(
              row?.balance
            );

          const previousRow =
            previousMap.get(
              code
            );

          const previous =
            previousRow
              ? qb31Number(
                  previousRow.balance
                )
              : null;

          const percent =
            (
              current !== null
              &&
              income !== null
              &&
              income !== 0
            )
              ? (
                  current
                  /
                  income
                  *
                  100
                )
              : null;

          lines.push(
            [
              code,
              row?.name ?? "",
              row?.account_type ?? "",
              current ?? "",
              previous ?? "",
              percent ?? ""
            ]
              .map(qb31CsvCell)
              .join(",")
          );
        }
      );

    const blob =
      new Blob(
        [
          "\ufeff"
          +
          lines.join("\n")
        ],
        {
          type:
            "text/csv;charset=utf-8"
        }
      );

    const objectUrl =
      URL.createObjectURL(blob);

    const link =
      document.createElement(
        "a"
      );

    link.href =
      objectUrl;

    link.download =
      `profit-loss-${qb31Bundle.from}-to-${qb31Bundle.to}.csv`;

    document.body.appendChild(
      link
    );

    link.click();
    link.remove();

    URL.revokeObjectURL(
      objectUrl
    );

    return true;
  }


  async function qb31EnhancePnl() {
    if (!state.pnl) {
      return;
    }

    const panel =
      qb31Panel();

    const dates =
      qb31Dates();

    if (
      !panel
      ||
      !dates
    ) {
      return;
    }

    const previousFrom =
      qb31PreviousYear(
        dates.from
      );

    const previousTo =
      qb31PreviousYear(
        dates.to
      );

    if (
      !previousFrom
      ||
      !previousTo
    ) {
      return;
    }

    const key =
      [
        dates.from,
        dates.to,
        previousFrom,
        previousTo
      ].join("|");

    if (
      qb31Bundle
      &&
      qb31Bundle.key === key
    ) {
      qb31Render(
        qb31Bundle
      );

      return;
    }

    if (
      qb31LoadingKey === key
    ) {
      return;
    }

    qb31LoadingKey =
      key;

    const sequence =
      ++qb31Sequence;

    panel.querySelector(
      ".qb31-status"
    ).textContent =
      "Loading same-period Previous Year…";

    try {
      const previous =
        await qb31Get(
          qb31PnlUrl(
            previousFrom,
            previousTo
          )
        );

      if (
        sequence !==
        qb31Sequence
      ) {
        return;
      }

      qb31Bundle = {
        key,

        from:
          dates.from,

        to:
          dates.to,

        previousFrom,
        previousTo,

        current:
          state.pnl,

        previous
      };

      qb31LoadingKey =
        "";

      qb31Render(
        qb31Bundle
      );
    } catch (error) {
      qb31LoadingKey =
        "";

      panel.querySelector(
        ".qb31-status"
      ).textContent =
        error?.message
        ||
        "Unable to load Previous Year.";
    }
  }

  function renderPnl() {
    const root =
      pnlRoot();

    const nativeStatement =
      pnlNativeStatement();

    if (
      !root
      ||
      !nativeStatement
    ) {
      return false;
    }

    let panel =
      document.getElementById(
        PNL_PANEL_ID
      );

    if (
      panel
      &&
      panel.parentElement !==
        root
    ) {
      panel.remove();
      panel = null;
    }

    if (!panel) {
      panel =
        document.createElement(
          "article"
        );

      panel.id =
        PNL_PANEL_ID;

      nativeStatement
        .insertAdjacentElement(
          "afterend",
          panel
        );
    }

    if (
      state.pnlLoading
    ) {
      panel.innerHTML = `
        <div class="aquila-r26-loading">
          Loading monthly Profit & Loss…
        </div>
      `;

      root.removeAttribute(
        "data-aquila-r26-monthly-ready"
      );

      return true;
    }

    if (
      state.pnlError
    ) {
      panel.innerHTML = `
        <div class="aquila-r26-error">
          <strong>
            Monthly Profit & Loss could not be loaded.
          </strong>

          <span>
            ${esc(state.pnlError)}
          </span>
        </div>
      `;

      /*
       * Native statement MUST remain visible on failure.
       */
      root.removeAttribute(
        "data-aquila-r26-monthly-ready"
      );

      return true;
    }

    if (!state.pnl) {
      root.removeAttribute(
        "data-aquila-r26-monthly-ready"
      );

      return true;
    }

    const data =
      state.pnl;

    panel.innerHTML = `
      <div class="aquila-r26-shell">

        ${
          pnlPerformanceTable(
            data
          )
        }

        ${
          pnlYoyTable(
            data
          )
        }
      </div>
    `;

    /*
     * Only NOW is it safe to hide the exact native
     * statement panel.
     */
    root.setAttribute(
      "data-aquila-r26-monthly-ready",
      "1"
    );

    
    void qb31EnhancePnl();



    qb31ApplyCashflowTableStandard();

return true;
  }

  function balanceRow(
    row,
    periods
  ) {
    return `
      <tr>
        ${detailsCell(row)}

        ${dashTd()}

        ${moneyTd(
          row.ytd_actual
        )}

        ${dashTd()}

        ${
          periods.map(
            period =>
              moneyTd(
                row.months
                  ?.[period.key]
                ?? 0
              )
          ).join("")
        }
      </tr>
    `;
  }

  function balanceSection(
    section,
    periods
  ) {
    return `
      <tr class="aquila-r26-group">
        <th colspan="${
          4
          +
          periods.length
        }">
          ${esc(section.label)}
        </th>
      </tr>

      ${
        (
          section.rows
          || []
        ).map(
          row =>
            balanceRow(
              row,
              periods
            )
        ).join("")
      }

      <tr class="aquila-r26-total">
        <td class="aquila-r26-details">
          Total ${esc(section.label)}
        </td>

        ${dashTd()}

        ${moneyTd(
          section.ytd_actual
        )}

        ${dashTd()}

        ${
          periods.map(
            period =>
              moneyTd(
                section.months
                  ?.[period.key]
                ?? 0
              )
          ).join("")
        }
      </tr>
    `;
  }

  function renderBalance() {
    const root =
      balanceRoot();

    if (!root) {
      return false;
    }

    let panel =
      document.getElementById(
        BS_PANEL_ID
      );

    if (
      panel
      &&
      panel.parentElement !==
        root
    ) {
      panel.remove();
      panel = null;
    }

    if (!panel) {
      panel =
        document.createElement(
          "section"
        );

      panel.id =
        BS_PANEL_ID;

      root.appendChild(
        panel
      );
    }

    if (
      state.balanceLoading
    ) {
      panel.innerHTML = `
        <div class="aquila-r26-loading">
          Loading monthly Balance Sheet…
        </div>
      `;

      return true;
    }

    if (
      state.balanceError
    ) {
      panel.innerHTML = `
        <div class="aquila-r26-error">
          <strong>
            Monthly Balance Sheet could not be loaded.
          </strong>

          <span>
            ${esc(state.balanceError)}
          </span>
        </div>
      `;

      return true;
    }

    if (!state.balance) {
      return true;
    }

    const data =
      state.balance;

    panel.innerHTML = `
      <div class="aquila-r26-shell">

        <section class="aquila-r26-block">
          <div class="aquila-r26-block-title">
            <div>
              <span>
                Statement of Financial Position
              </span>

              <h3>
                Monthly Actual Position
              </h3>
            </div>
          </div>

          <div class="aquila-r26-scroll">
            <table class="aquila-r26-table aquila-r26-balance-table">
              <thead>
                <tr>
                  <th class="aquila-r26-details">
                    Details
                  </th>

                  <th>YTD Budget</th>
                  <th>YTD Actual</th>
                  <th>% Achieved</th>

                  ${
                    (
                      data.periods
                      || []
                    ).map(
                      period => `
                        <th>
                          ${esc(period.month)}
                          Actual
                        </th>
                      `
                    ).join("")
                  }
                </tr>
              </thead>

              <tbody>
                ${
                  balanceSection(
                    data.sections.assets,
                    data.periods
                  )
                }

                ${
                  balanceSection(
                    data.sections.liabilities,
                    data.periods
                  )
                }

                ${
                  balanceSection(
                    data.sections.equity,
                    data.periods
                  )
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;

    return true;
  }

  async function loadPnl(
    reason = "load"
  ) {
    if (
      state.pnlLoading
    ) {
      return;
    }

    state.pnlLoading =
      true;

    state.pnlError =
      "";

    renderPnl();

    try {
      state.pnl =
        await apiGet(
          PNL_ENDPOINT
        );

      state.pnlLoads +=
        1;

    } catch (error) {
      state.pnl =
        null;

      state.pnlError =
        error instanceof Error
          ? error.message
          : String(error);

    } finally {
      state.pnlLoading =
        false;

      if (
        isPnlRoute()
      ) {
        renderPnl();
      }
    }
  }

  async function loadBalance(
    reason = "load"
  ) {
    if (
      state.balanceLoading
    ) {
      return;
    }

    state.balanceLoading =
      true;

    state.balanceError =
      "";

    renderBalance();

    try {
      state.balance =
        await apiGet(
          BS_ENDPOINT
        );

      state.balanceLoads +=
        1;

    } catch (error) {
      state.balance =
        null;

      state.balanceError =
        error instanceof Error
          ? error.message
          : String(error);

    } finally {
      state.balanceLoading =
        false;

      if (
        isBalanceRoute()
      ) {
        renderBalance();
      }
    }
  }

  function cleanupPnl() {
    const root =
      pnlRoot();

    if (root) {
      root.removeAttribute(
        "data-aquila-r26-monthly-ready"
      );
    }

    const panel =
      document.getElementById(
        PNL_PANEL_ID
      );

    if (
      panel
      &&
      !isPnlRoute()
    ) {
      panel.remove();
    }
  }

  function cleanupBalance() {
    const panel =
      document.getElementById(
        BS_PANEL_ID
      );

    if (
      panel
      &&
      !isBalanceRoute()
    ) {
      panel.remove();
    }
  }

  function apply() {
    state.syncRuns +=
      1;

    if (
      isPnlRoute()
    ) {
      cleanupBalance();

      const root =
        pnlRoot();

      const native =
        pnlNativeStatement();

      if (
        !root
        ||
        !native
      ) {
        return false;
      }

      renderPnl();

      if (
        !state.pnl
        &&
        !state.pnlLoading
        &&
        !state.pnlError
      ) {
        void loadPnl(
          "route"
        );
      }

      return true;
    }

    cleanupPnl();

    if (
      isBalanceRoute()
    ) {
      const root =
        balanceRoot();

      if (!root) {
        return false;
      }

      renderBalance();

      if (
        !state.balance
        &&
        !state.balanceLoading
        &&
        !state.balanceError
      ) {
        void loadBalance(
          "route"
        );
      }

      return true;
    }

    cleanupBalance();

    return false;
  }

  function schedule() {
    if (scheduled) {
      return;
    }

    scheduled =
      true;

    queueMicrotask(
      () => {
        scheduled =
          false;

        apply();
      }
    );
  }

  function scheduleBurst() {
    for (
      const timer
      of timers
    ) {
      clearTimeout(
        timer
      );
    }

    timers.clear();

    for (
      const delay
      of [
        0,
        80,
        200,
        450,
        850,
        1400,
        2200,
        3200,
      ]
    ) {
      const timer =
        setTimeout(
          () => {
            timers.delete(
              timer
            );

            schedule();
          },
          delay
        );

      timers.add(
        timer
      );
    }
  }

  function csvCell(value) {
    return (
      '"'
      +
      String(
        value ?? ""
      ).replace(
        /"/g,
        '""'
      )
      +
      '"'
    );
  }

  function downloadCsv(
    filename,
    rows
  ) {
    const csv =
      rows.map(
        row =>
          row
            .map(csvCell)
            .join(",")
      ).join("\r\n");

    const blob =
      new Blob(
        [
          "\uFEFF",
          csv,
        ],
        {
          type:
            "text/csv;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href =
      url;

    anchor.download =
      filename;

    document.body
      .appendChild(
        anchor
      );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(
      url
    );
  }

  function exportPnl() {

    if (
      qb31Bundle
      &&
      qb31ExportCsv()
    ) {
      return;
    }


    const data =
      state.pnl;

    if (!data) {
      return;
    }

    const rows = [];

    const header = [
      "Details",
      "YTD Budget",
      "YTD Actual",
      "% Achieved",
    ];

    for (
      const period
      of data.periods
      || []
    ) {
      header.push(
        `${period.month} ${period.target_label}`,
        `${period.month} Actual`,
        "% Achieved"
      );
    }

    rows.push(
      [
        "Profit & Loss Monthly Position",
      ],
      [
        "As of",
        data.as_of,
      ],
      [],
      header
    );

    for (
      const row
      of data.rows
      || []
    ) {
      const output = [
        clean(
          `${accountClassLabel(row.account_type)} ${row.name || ""}`
        ),
        "",
        row.ytd_actual,
        "",
      ];

      for (
        const period
        of data.periods
        || []
      ) {
        output.push(
          "",
          row.months
            ?.[period.key]
            ?.actual
          ?? 0,
          ""
        );
      }

      rows.push(
        output
      );
    }

    rows.push(
      [],
      [
        "YoY Trend",
      ]
    );

    const yoyHeader = [
      "Details",
      `YTD ${data.year} Actual`,
      `YTD ${data.previous_year} Actual`,
      "% Change",
    ];

    for (
      const period
      of data.periods
      || []
    ) {
      yoyHeader.push(
        `${period.month} ${data.year} Actual`,
        `${period.month} ${data.previous_year} Actual`,
        "% Change"
      );
    }

    rows.push(
      yoyHeader
    );

    for (
      const row
      of data.rows
      || []
    ) {
      const output = [
        clean(
          `${accountClassLabel(row.account_type)} ${row.name || ""}`
        ),
        row.ytd_actual,
        row.previous_ytd_actual,
        row.ytd_yoy_change_pct
        ?? "",
      ];

      for (
        const period
        of data.periods
        || []
      ) {
        const month =
          row.months
            ?.[period.key]
          || {};

        output.push(
          month.actual
          ?? 0,
          month.previous_actual
          ?? 0,
          month.yoy_change_pct
          ?? ""
        );
      }

      rows.push(
        output
      );
    }

    downloadCsv(
      `profit-loss-monthly-${data.as_of}.csv`,
      rows
    );
  }

  function exportBalance() {
    const data =
      state.balance;

    if (!data) {
      return;
    }

    const rows = [
      [
        "Balance Sheet Monthly Position",
      ],

      [
        "As of",
        data.as_of,
      ],

      [],
    ];

    const header = [
      "Details",
      "YTD Budget",
      "YTD Actual",
      "% Achieved",
    ];

    for (
      const period
      of data.periods
      || []
    ) {
      header.push(
        `${period.month} Actual`
      );
    }

    rows.push(
      header
    );

    for (
      const sectionKey
      of [
        "assets",
        "liabilities",
        "equity",
      ]
    ) {
      const section =
        data.sections[
          sectionKey
        ];

      rows.push([
        section.label,
      ]);

      for (
        const row
        of section.rows
        || []
      ) {
        const output = [
          clean(
            `${accountClassLabel(row.account_type)} ${row.name || ""}`
          ),
          "",
          row.ytd_actual,
          "",
        ];

        for (
          const period
          of data.periods
          || []
        ) {
          output.push(
            row.months
              ?.[period.key]
            ?? 0
          );
        }

        rows.push(
          output
        );
      }
    }

    downloadCsv(
      `balance-sheet-monthly-${data.as_of}.csv`,
      rows
    );
  }

  function printCurrent() {
    window.print();
  }

  function onClick(event) {
    const target =
      event.target;

    if (
      !(target instanceof Element)
    ) {
      return;
    }

    const routeButton =
      target.closest(
        "[data-r26-route]"
      );

    if (routeButton) {
      event.preventDefault();

      navigateFinance(
        routeButton.getAttribute(
          "data-r26-route"
        )
      );

      return;
    }

    const action =
      target.closest(
        "[data-r26-action]"
      );

    if (action) {
      event.preventDefault();

      const value =
        action.getAttribute(
          "data-r26-action"
        );

      if (
        value === "refresh"
      ) {
        if (
          isPnlRoute()
        ) {
          state.pnl =
            null;

          state.pnlError =
            "";

          void loadPnl(
            "manual-refresh"
          );
        } else if (
          isBalanceRoute()
        ) {
          state.balance =
            null;

          state.balanceError =
            "";

          void loadBalance(
            "manual-refresh"
          );
        }
      } else if (
        value === "export"
      ) {
        if (
          isPnlRoute()
        ) {
          exportPnl();
        } else if (
          isBalanceRoute()
        ) {
          exportBalance();
        }
      } else if (
        value === "print"
      ) {
        printCurrent();
      }

      return;
    }

    /*
     * Native P&L Refresh / Filters and native Balance Sheet
     * controls may legitimately reconstruct their own content.
     * Use event-driven bounded resync afterwards.
     *
     * This is NOT polling and NOT a MutationObserver.
     */
    if (
      target.closest(
        "section.profit-loss-v1"
      )
      ||
      target.closest(
        "#aquila-finance-balance-sheet-r22"
      )
    ) {
      scheduleBurst();
    }
  }

  function onChange(event) {
    const target =
      event.target;

    if (
      !(target instanceof Element)
    ) {
      return;
    }

    if (
      target.getAttribute(
        "data-r26-control"
      ) ===
      "as-of"
    ) {
      state.asOf =
        target.value
        ||
        today();

      if (
        isPnlRoute()
      ) {
        state.pnl =
          null;

        state.pnlError =
          "";

        void loadPnl(
          "date-change"
        );
      } else if (
        isBalanceRoute()
      ) {
        state.balance =
          null;

        state.balanceError =
          "";

        void loadBalance(
          "date-change"
        );
      }

      return;
    }

    if (
      target.closest(
        "section.profit-loss-v1"
      )
      ||
      target.closest(
        "#aquila-finance-balance-sheet-r22"
      )
    ) {
      scheduleBurst();
    }
  }

  document.addEventListener(
    "click",
    onClick,
    true
  );

  document.addEventListener(
    "change",
    onChange,
    true
  );

  window.addEventListener(
    "hashchange",
    scheduleBurst
  );

  window.addEventListener(
    "pageshow",
    scheduleBurst
  );

  window
    .__AQUILA_FINANCE_MONTHLY_REPORTING_R27__ = {
      release:
        RELEASE,

      refresh() {
        if (
          isPnlRoute()
        ) {
          state.pnl =
            null;

          state.pnlError =
            "";

          return loadPnl(
            "console-refresh"
          );
        }

        if (
          isBalanceRoute()
        ) {
          state.balance =
            null;

          state.balanceError =
            "";

          return loadBalance(
            "console-refresh"
          );
        }

        return null;
      },

      diagnose() {
        const current =
          route();

        const pRoot =
          pnlRoot();

        const native =
          pnlNativeStatement();

        const bRoot =
          balanceRoot();

        return {
          release:
            RELEASE,

          section:
            current.section,

          finance:
            current.finance,

          asOf:
            state.asOf,

          pnlRootPresent:
            Boolean(
              pRoot
            ),

          pnlNativeStatementPresent:
            Boolean(
              native
            ),

          pnlNativeStatementHiddenByR26:
            Boolean(
              pRoot
              ?.getAttribute(
                "data-aquila-r26-monthly-ready"
              ) ===
              "1"
            ),

          pnlPanelPresent:
            Boolean(
              document.getElementById(
                PNL_PANEL_ID
              )
            ),

          pnlLoaded:
            Boolean(
              state.pnl
            ),

          pnlLoads:
            state.pnlLoads,

          pnlError:
            state.pnlError,

          pnlPeriodCount:
            state.pnl
              ?.periods
              ?.length
            ?? 0,

          pnlCurrentMonth:
            state.pnl
              ?.current_month
            ?? null,

          balanceRootPresent:
            Boolean(
              bRoot
            ),

          balancePanelPresent:
            Boolean(
              document.getElementById(
                BS_PANEL_ID
              )
            ),

          balanceLoaded:
            Boolean(
              state.balance
            ),

          balanceLoads:
            state.balanceLoads,

          balanceError:
            state.balanceError,

          balancePeriodCount:
            state.balance
              ?.periods
              ?.length
            ?? 0,

          balanceCurrentMonth:
            state.balance
              ?.current_month
            ?? null,

          duplicateReportChrome:
            false,

          detailsIdentity:
            "account_class_and_account_name",

          dataCellWrapping:
            false,

          numericAlignment:
            "right",

          initialColumnPriority:
            "details_ytd_current_month_then_scroll",

          budgetFabricated:
            false,

          missingBudgetDisplay:
            "dash",

          mutationObserver:
            false,

          continuousPolling:
            false,

          setInterval:
            false,

          financialWriteImplementation:
            false,

          r23Preserved:
            Boolean(
              window
                .__AQUILA_FINANCE_BALANCE_SHEET_R23__
            ),

          r24Preserved:
            Boolean(
              window
                .__AQUILA_FINANCE_BALANCE_SHEET_R24_ROUTE_DURABILITY__
            ),
        };
      },
    };

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      scheduleBurst,
      {
        once:
          true,
      }
    );
  } else {
    scheduleBurst();
  }
})();

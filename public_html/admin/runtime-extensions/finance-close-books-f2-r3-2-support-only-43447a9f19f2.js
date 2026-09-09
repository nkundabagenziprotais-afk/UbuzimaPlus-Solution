/* AQUILA_CLOSE_BOOKS_SUPPORT_ONLY_R8_1 */
(function () {
  "use strict";

  const RELEASE =
    "AQUILA_FINANCE_CLOSE_BOOKS_F2_R3_1";

  if (
    window.__AQUILA_FINANCE_CLOSE_BOOKS_F2_R3_1__
  ) {
    return;
  }

  const state = {
    loading: false,
    busy: false,
    periods: [],
    readiness: new Map(),
    readinessErrors: new Map(),
    actions: [],
    error: "",
    message: "",
    modal: null
  };

  const mountDelays = [
    0,
    100,
    250,
    550,
    1000,
    1800,
    3000,
    5000
  ];

  const text = value =>
    String(
      value == null
        ? ""
        : value
    ).trim();

  const esc = value =>
    text(value)
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );

  function visible(element) {

    if (
      !(element instanceof HTMLElement)
    ) {
      return false;
    }

    const style =
      getComputedStyle(
        element
      );

    if (
      style.display === "none"
      ||
      style.visibility === "hidden"
    ) {
      return false;
    }

    const rect =
      element.getBoundingClientRect();

    return (
      rect.width > 0
      &&
      rect.height > 0
    );
  }

  function context() {

    let params;

    try {
      params =
        new URLSearchParams(
          location.hash.replace(
            /^#/,
            ""
          )
        );
    } catch (_) {
      params =
        new URLSearchParams();
    }

    return {
      section:
        text(
          params.get(
            "section"
          )
        ),

      finance:
        text(
          params.get(
            "finance"
          )
        )
    };
  }

  function isAccounting() {

    const route =
      context();

    if (
      route.section === "finance"
      &&
      route.finance === "accounting"
    ) {
      return true;
    }

    const headings =
      Array.from(
        document.querySelectorAll(
          "h1,h2,h3"
        )
      ).filter(
        visible
      );

    return headings.some(
      heading => {
        const value =
          text(
            heading.textContent
          ).toLowerCase();

        return (
          value === "accounting"
          ||
          value.indexOf(
            "accounting workspace"
          ) >= 0
        );
      }
    );
  }

  function accountingStage() {

    if (!isAccounting()) {
      return null;
    }

    const explicit =
      Array.from(
        document.querySelectorAll(
          '[data-finance-module-stage="active"],[data-finance-stage],.module-section-stage'
        )
      )
        .filter(
          visible
        )[0];

    if (explicit) {
      return explicit;
    }

    const heading =
      Array.from(
        document.querySelectorAll(
          "h1,h2,h3"
        )
      )
        .filter(
          visible
        )
        .find(
          item =>
            text(
              item.textContent
            )
              .toLowerCase()
              .indexOf(
                "accounting"
              )
            >= 0
        );

    if (!heading) {
      return null;
    }

    return (
      heading.closest(
        ".section-page,.dedicated-module-page,[data-page],[data-workspace]"
      )
      ||
      heading.parentElement
    );
  }

  function readStorage(
    storage,
    key
  ) {
    try {
      return (
        storage.getItem(
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

    try {
      return raw
        ? JSON.parse(raw)
        : null;
    } catch (_) {
      return null;
    }
  }

  function auth() {

    const sessions = [
      parseJson(
        readStorage(
          localStorage,
          "ubuzima_admin_session"
        )
      ),

      parseJson(
        readStorage(
          sessionStorage,
          "ubuzima_admin_session"
        )
      )
    ].filter(Boolean);

    function first() {

      for (
        let index = 0;
        index < arguments.length;
        index += 1
      ) {
        const value =
          arguments[index];

        if (
          typeof value === "string"
          &&
          value.trim()
        ) {
          return value.trim();
        }
      }

      return "";
    }

    let token =
      first(
        readStorage(
          localStorage,
          "ubuzima.token"
        ),

        readStorage(
          sessionStorage,
          "ubuzima.token"
        ),

        readStorage(
          localStorage,
          "access_token"
        ),

        readStorage(
          sessionStorage,
          "access_token"
        ),

        readStorage(
          localStorage,
          "authToken"
        ),

        readStorage(
          sessionStorage,
          "authToken"
        )
      );

    let tenant =
      first(
        readStorage(
          localStorage,
          "ubuzima.currentTenantSlug"
        ),

        readStorage(
          sessionStorage,
          "ubuzima.currentTenantSlug"
        ),

        readStorage(
          localStorage,
          "pharmaco.tenantSlug"
        ),

        readStorage(
          sessionStorage,
          "pharmaco.tenantSlug"
        )
      );

    sessions.forEach(
      session => {

        if (!token) {
          token =
            first(
              session.token,
              session.access_token,
              session.accessToken,
              session.authToken
            );
        }

        if (!tenant) {
          tenant =
            first(
              session.tenant_slug,
              session.tenantSlug,
              session.tenant
                &&
                session.tenant.slug,
              session.profile
                &&
                session.profile.tenant_slug,
              session.profile
                &&
                session.profile.tenant
                &&
                session.profile.tenant.slug,
              session.profile
                &&
                session.profile.tenant_assignments
                &&
                session.profile.tenant_assignments[0]
                &&
                session.profile.tenant_assignments[0].tenant
                &&
                session.profile.tenant_assignments[0].tenant.slug
            );
        }
      }
    );

    return {
      token: token,
      tenant: tenant
    };
  }

  async function api(
    path,
    options
  ) {

    const session =
      auth();

    if (!session.token) {
      throw new Error(
        "Your Admin authentication token could not be resolved. Sign in again and reopen Finance."
      );
    }

    if (!session.tenant) {
      throw new Error(
        "The active tenant could not be resolved for this Finance workspace."
      );
    }

    const config =
      options
      ||
      {};

    const headers =
      new Headers(
        config.headers
        ||
        {}
      );

    headers.set(
      "Accept",
      "application/json"
    );

    headers.set(
      "Authorization",
      "Bearer "
      +
      session.token
    );

    headers.set(
      "X-Tenant-Slug",
      session.tenant
    );

    if (
      config.body
      &&
      !headers.has(
        "Content-Type"
      )
    ) {
      headers.set(
        "Content-Type",
        "application/json"
      );
    }

    const response =
      await fetch(
        path,
        Object.assign(
          {},
          config,
          {
            headers: headers,
            credentials:
              "include",
            cache:
              "no-store"
          }
        )
      );

    let payload = {};

    try {
      payload =
        await response.json();
    } catch (_) {
      payload = {};
    }

    if (!response.ok) {

      let message =
        text(
          payload.message
        );

      if (
        payload.errors
        &&
        typeof payload.errors ===
          "object"
      ) {
        const values = [];

        Object.keys(
          payload.errors
        ).forEach(
          key => {
            const item =
              payload.errors[key];

            if (
              Array.isArray(
                item
              )
            ) {
              item.forEach(
                value =>
                  values.push(
                    text(value)
                  )
              );
            } else {
              values.push(
                text(item)
              );
            }
          }
        );

        if (
          values.filter(Boolean).length
        ) {
          message =
            values
              .filter(Boolean)
              .join(" ");
        }
      }

      if (!message) {
        message =
          response.status === 403
            ? "Your current role does not permit this accounting action."
            : "Finance request failed with HTTP "
              +
              response.status
              +
              ".";
      }

      throw new Error(
        message
      );
    }

    return payload;
  }

  function arrayFrom(
    payload,
    candidates
  ) {

    const root =
      payload
      &&
      payload.data !== undefined
        ? payload.data
        : payload;

    if (
      Array.isArray(
        root
      )
    ) {
      return root;
    }

    if (
      root
      &&
      typeof root === "object"
    ) {
      for (
        let index = 0;
        index < candidates.length;
        index += 1
      ) {
        const value =
          root[
            candidates[index]
          ];

        if (
          Array.isArray(
            value
          )
        ) {
          return value;
        }
      }
    }

    return [];
  }

  function dates(value) {

    const raw =
      text(value).slice(
        0,
        10
      );

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        raw
      )
    ) {
      return raw || "—";
    }

    const parts =
      raw.split("-");

    const date =
      new Date(
        Date.UTC(
          Number(parts[0]),
          Number(parts[1]) - 1,
          Number(parts[2])
        )
      );

    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",

        timeZone:
          "UTC"
      }
    ).format(
      date
    );
  }

  function dateTime(value) {

    const raw =
      text(value);

    if (!raw) {
      return "—";
    }

    const date =
      new Date(
        raw.indexOf("T") >= 0
          ? raw
          : raw.replace(
              " ",
              "T"
            )
            +
            "Z"
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return raw;
    }

    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit"
      }
    ).format(
      date
    );
  }

  function title(value) {

    return text(
      value
    )
      .replace(
        /_/g,
        " "
      )
      .replace(
        /\b\w/g,
        function (
          character
        ) {
          return character
            .toUpperCase();
        }
      );
  }

  function badge(value) {

    const raw =
      text(value)
      ||
      "unknown";

    const key =
      raw
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          "-"
        );

    return (
      '<span class="aquila-f2r31-badge aquila-f2r31-badge--'
      +
      esc(key)
      +
      '">'
      +
      esc(
        title(raw)
      )
      +
      "</span>"
    );
  }

  function alertList(
    items,
    kind
  ) {

    if (
      !Array.isArray(
        items
      )
      ||
      !items.length
    ) {
      return "";
    }

    return (
      '<div class="aquila-f2r31-alert-list">'
      +
      items.map(
        function (item) {

          return (
            '<div class="aquila-f2r31-alert aquila-f2r31-alert--'
            +
            esc(kind)
            +
            '">'
            +
            '<span class="aquila-f2r31-alert__mark">'
            +
            (
              kind === "warning"
                ? "!"
                : "×"
            )
            +
            "</span>"
            +
            "<div>"
            +
            "<strong>"
            +
            esc(
              title(
                item.code
                ||
                (
                  kind === "warning"
                    ? "Warning"
                    : "Blocker"
                )
              )
            )
            +
            "</strong>"
            +
            "<p>"
            +
            esc(
              item.message
              ||
              ""
            )
            +
            "</p>"
            +
            "</div>"
            +
            "</div>"
          );
        }
      ).join("")
      +
      "</div>"
    );
  }

  const metricNames = {
    earlier_open_periods:
      "Earlier open periods",

    overlapping_periods:
      "Overlapping periods",

    shadow_journals:
      "Historical shadow journals",

    unresolved_shadow_journals:
      "Unresolved shadows",

    unbalanced_journal_headers:
      "Unbalanced journals",

    journal_line_mismatches:
      "Journal line mismatches",

    unsettled_journal_drafts:
      "Unsettled journal drafts",

    unsettled_expenses:
      "Unsettled expenses",

    approved_reporting_exclusions:
      "Approved reporting exceptions"
  };

  function metrics(values) {

    if (
      !values
      ||
      typeof values !== "object"
    ) {
      return "";
    }

    return (
      '<div class="aquila-f2r31-metrics">'
      +
      Object.keys(
        values
      ).map(
        function (key) {

          return (
            '<div class="aquila-f2r31-metric">'
            +
            "<span>"
            +
            esc(
              metricNames[key]
              ||
              title(key)
            )
            +
            "</span>"
            +
            "<strong>"
            +
            esc(
              values[key]
            )
            +
            "</strong>"
            +
            "</div>"
          );
        }
      ).join("")
      +
      "</div>"
    );
  }

  function periodCard(
    period
  ) {

    const id =
      Number(
        period.id
      );

    const status =
      text(
        period.status
      ).toLowerCase();

    const locked =
      period.is_locked === true
      ||
      Number(
        period.is_locked
      ) === 1;

    const ready =
      state.readiness.get(
        id
      );

    const readinessError =
      state.readinessErrors.get(
        id
      )
      ||
      "";

    const canClose =
      ready
      &&
      ready.ready_to_close === true;

    let action = "";

    if (
      status === "closed"
      &&
      locked
    ) {
      action =
        '<button type="button" '
        +
        'class="aquila-f2r31-button aquila-f2r31-button--secondary" '
        +
        'data-f2r31-action="request-reopen" '
        +
        'data-period-id="'
        +
        id
        +
        '" data-period-name="'
        +
        esc(
          period.name
          ||
          ""
        )
        +
        '">'
        +
        "Request reopen"
        +
        "</button>";
    }

    else if (
      status === "open"
      &&
      !locked
    ) {
      action =
        '<button type="button" '
        +
        'class="aquila-f2r31-button aquila-f2r31-button--primary" '
        +
        'data-f2r31-action="request-close" '
        +
        'data-period-id="'
        +
        id
        +
        '" data-period-name="'
        +
        esc(
          period.name
          ||
          ""
        )
        +
        '" '
        +
        (
          canClose
            ? ""
            : "disabled"
        )
        +
        ">"
        +
        "Request close"
        +
        "</button>";
    }

    return (
      '<article class="aquila-f2r31-period">'
      +
      '<header class="aquila-f2r31-period__header">'
      +
      "<div>"
      +
      '<div class="aquila-f2r31-eyebrow">Accounting period</div>'
      +
      "<h3>"
      +
      esc(
        period.name
        ||
        (
          "Period "
          +
          id
        )
      )
      +
      "</h3>"
      +
      "<p>"
      +
      esc(
        dates(
          period.starts_on
        )
      )
      +
      " – "
      +
      esc(
        dates(
          period.ends_on
        )
      )
      +
      "</p>"
      +
      "</div>"
      +
      '<div class="aquila-f2r31-badges">'
      +
      badge(
        period.status
        ||
        "unknown"
      )
      +
      badge(
        locked
          ? "Locked"
          : "Unlocked"
      )
      +
      (
        ready
          ? badge(
              canClose
                ? "Close ready"
                : "Action needed"
            )
          : ""
      )
      +
      "</div>"
      +
      "</header>"
      +
      (
        readinessError
          ? (
              '<div class="aquila-f2r31-inline-error">'
              +
              esc(
                readinessError
              )
              +
              "</div>"
            )
          : ""
      )
      +
      (
        ready
          ? (
              alertList(
                ready.blockers,
                "blocker"
              )
              +
              alertList(
                ready.warnings,
                "warning"
              )
              +
              metrics(
                ready.metrics
              )
            )
          : ""
      )
      +
      '<footer class="aquila-f2r31-period__footer">'
      +
      '<p class="aquila-f2r31-period__note">'
      +
      (
        canClose
          ? "Current accounting controls pass. An independent Finance checker is still required before the books are locked."
          : (
              status === "closed"
              &&
              locked
                ? "This period is closed and locked. Reopening is governed and requires independent approval."
                : "Resolve the listed accounting controls before requesting period close."
            )
      )
      +
      "</p>"
      +
      action
      +
      "</footer>"
      +
      "</article>"
    );
  }

  function actionCard(
    item
  ) {

    const pending =
      text(
        item.status
      ).toLowerCase()
      ===
      "requested";

    return (
      '<article class="aquila-f2r31-history">'
      +
      '<div class="aquila-f2r31-history__head">'
      +
      "<div>"
      +
      '<div class="aquila-f2r31-eyebrow">'
      +
      esc(
        title(
          item.action_type
          ||
          "Period"
        )
      )
      +
      " request"
      +
      "</div>"
      +
      "<h4>"
      +
      esc(
        item.period_name
        ||
        (
          "Accounting period #"
          +
          (
            item.accounting_period_id
            ||
            "—"
          )
        )
      )
      +
      "</h4>"
      +
      "</div>"
      +
      badge(
        item.status
        ||
        "unknown"
      )
      +
      "</div>"
      +
      '<p class="aquila-f2r31-history__reason">'
      +
      esc(
        item.reason
        ||
        "No reason recorded."
      )
      +
      "</p>"
      +
      '<dl class="aquila-f2r31-audit">'
      +
      "<div><dt>Requested by</dt><dd>"
      +
      esc(
        item.requested_by_name
        ||
        (
          item.requested_by
            ? "User "
              +
              item.requested_by
            : "—"
        )
      )
      +
      "</dd></div>"
      +
      "<div><dt>Requested</dt><dd>"
      +
      esc(
        dateTime(
          item.requested_at
        )
      )
      +
      "</dd></div>"
      +
      "<div><dt>Decided by</dt><dd>"
      +
      esc(
        item.decided_by_name
        ||
        (
          item.decided_by
            ? "User "
              +
              item.decided_by
            : "Pending"
        )
      )
      +
      "</dd></div>"
      +
      "<div><dt>Decision</dt><dd>"
      +
      esc(
        dateTime(
          item.decided_at
        )
      )
      +
      "</dd></div>"
      +
      "</dl>"
      +
      (
        pending
          ? (
              '<div class="aquila-f2r31-history__actions">'
              +
              '<button type="button" '
              +
              'class="aquila-f2r31-button aquila-f2r31-button--secondary" '
              +
              'data-f2r31-action="reject" '
              +
              'data-action-uuid="'
              +
              esc(
                item.uuid
              )
              +
              '" data-period-name="'
              +
              esc(
                item.period_name
                ||
                ""
              )
              +
              '">Reject</button>'
              +
              '<button type="button" '
              +
              'class="aquila-f2r31-button aquila-f2r31-button--primary" '
              +
              'data-f2r31-action="approve" '
              +
              'data-action-uuid="'
              +
              esc(
                item.uuid
              )
              +
              '" data-period-name="'
              +
              esc(
                item.period_name
                ||
                ""
              )
              +
              '">Approve</button>'
              +
              "</div>"
            )
          : (
              '<div class="aquila-f2r31-evidence">'
              +
              "<span>Readiness evidence "
              +
              (
                text(
                  item.readiness_sha256
                ).length === 64
                  ? "✓"
                  : "—"
              )
              +
              "</span>"
              +
              "<span>Execution evidence "
              +
              (
                text(
                  item.execution_sha256
                ).length === 64
                  ? "✓"
                  : "—"
              )
              +
              "</span>"
              +
              "</div>"
            )
      )
      +
      "</article>"
    );
  }

  function ensureWorkspace() {

    let root =
      document.getElementById(
        "aquila-finance-close-books-f2-r3-1"
      );

    if (root) {
      return root;
    }

    root =
      document.createElement(
        "section"
      );

    root.id =
      "aquila-finance-close-books-f2-r3-1";

    root.className =
      "aquila-f2r31-overlay";

    root.setAttribute(
      "aria-hidden",
      "true"
    );

    root.innerHTML =
      '<div class="aquila-f2r31-scrim" data-f2r31-action="close"></div>'
      +
      '<div class="aquila-f2r31-workspace" role="dialog" aria-modal="true">'
      +
      '<header class="aquila-f2r31-workspace__header">'
      +
      "<div>"
      +
      '<div class="aquila-f2r31-eyebrow">Finance &amp; Accounting</div>'
      +
      "<h1>Close Books</h1>"
      +
      "<p>Review period readiness, protect completed months and keep close or reopen decisions independently approved and auditable.</p>"
      +
      "</div>"
      +
      '<div class="aquila-f2r31-header-actions">'
      +
      '<button type="button" class="aquila-f2r31-icon" data-f2r31-action="refresh" title="Refresh">↻</button>'
      +
      '<button type="button" class="aquila-f2r31-icon" data-f2r31-action="close" title="Close">×</button>'
      +
      "</div>"
      +
      "</header>"
      +
      '<div class="aquila-f2r31-workspace__body">'
      +
      '<div id="aquila-f2r31-message" class="aquila-f2r31-message" hidden></div>'
      +
      '<div id="aquila-f2r31-content"></div>'
      +
      "</div>"
      +
      "</div>"
      +
      '<div id="aquila-f2r31-modal" class="aquila-f2r31-modal" aria-hidden="true"></div>';

    document.body.appendChild(
      root
    );

    return root;
  }

  function render() {

    const root =
      ensureWorkspace();

    const content =
      root.querySelector(
        "#aquila-f2r31-content"
      );

    const message =
      root.querySelector(
        "#aquila-f2r31-message"
      );

    if (!content) {
      return;
    }

    const notification =
      state.error
      ||
      state.message;

    if (message) {
      message.hidden =
        !notification;

      message.className =
        state.error
          ? "aquila-f2r31-message aquila-f2r31-message--error"
          : "aquila-f2r31-message aquila-f2r31-message--success";

      message.textContent =
        notification;
    }

    if (state.loading) {

      content.innerHTML =
        '<div class="aquila-f2r31-loading">'
        +
        '<span class="aquila-f2r31-spinner"></span>'
        +
        "Loading accounting controls…"
        +
        "</div>";

      return;
    }

    if (
      state.error
      &&
      !state.periods.length
    ) {

      content.innerHTML =
        '<div class="aquila-f2r31-empty">'
        +
        "<h3>Close Books could not be loaded</h3>"
        +
        "<p>"
        +
        esc(
          state.error
        )
        +
        "</p>"
        +
        '<button type="button" '
        +
        'class="aquila-f2r31-button aquila-f2r31-button--primary" '
        +
        'data-f2r31-action="refresh">Try again</button>'
        +
        "</div>";

      return;
    }

    const openCount =
      state.periods.filter(
        function (period) {
          return text(
            period.status
          ).toLowerCase()
          ===
          "open";
        }
      ).length;

    const readyCount =
      state.periods.filter(
        function (period) {
          const ready =
            state.readiness.get(
              Number(
                period.id
              )
            );

          return (
            ready
            &&
            ready.ready_to_close === true
          );
        }
      ).length;

    const pendingCount =
      state.actions.filter(
        function (item) {
          return text(
            item.status
          ).toLowerCase()
          ===
          "requested";
        }
      ).length;

    let blockers = 0;

    state.periods.forEach(
      function (period) {

        const ready =
          state.readiness.get(
            Number(
              period.id
            )
          );

        blockers +=
          ready
          &&
          Array.isArray(
            ready.blockers
          )
            ? ready.blockers.length
            : 0;
      }
    );

    content.innerHTML =
      '<section class="aquila-f2r31-summary">'
      +
      "<article><span>Accounting periods</span><strong>"
      +
      state.periods.length
      +
      "</strong><small>"
      +
      openCount
      +
      " currently open</small></article>"
      +
      "<article><span>Ready to close</span><strong>"
      +
      readyCount
      +
      "</strong><small>Passed current accounting controls</small></article>"
      +
      "<article><span>Pending decisions</span><strong>"
      +
      pendingCount
      +
      "</strong><small>Awaiting independent checker action</small></article>"
      +
      "<article><span>Open blockers</span><strong>"
      +
      blockers
      +
      "</strong><small>Across current accounting periods</small></article>"
      +
      "</section>"
      +
      '<section class="aquila-f2r31-control">'
      +
      '<span class="aquila-f2r31-control__mark">✓</span>'
      +
      "<div><strong>Maker/checker control is active</strong>"
      +
      "<p>The requester cannot approve or reject the same close or reopen request. The accounting engine remains the authority for execution.</p></div>"
      +
      "</section>"
      +
      '<section class="aquila-f2r31-section">'
      +
      '<div class="aquila-f2r31-section__head">'
      +
      "<div>"
      +
      '<div class="aquila-f2r31-eyebrow">Period control</div>'
      +
      "<h2>Accounting periods</h2>"
      +
      "<p>Periods close chronologically. Blockers and warnings come directly from the Finance close-readiness engine.</p>"
      +
      "</div>"
      +
      "</div>"
      +
      '<div class="aquila-f2r31-period-list">'
      +
      (
        state.periods.length
          ? state.periods.map(
              periodCard
            ).join("")
          : (
              '<div class="aquila-f2r31-empty">'
              +
              "<h3>No accounting periods found</h3>"
              +
              "</div>"
            )
      )
      +
      "</div>"
      +
      "</section>"
      +
      '<section class="aquila-f2r31-section">'
      +
      '<div class="aquila-f2r31-section__head">'
      +
      "<div>"
      +
      '<div class="aquila-f2r31-eyebrow">Audit &amp; approval</div>'
      +
      "<h2>Close / reopen history</h2>"
      +
      "<p>Request, decision and execution evidence remains available for review.</p>"
      +
      "</div>"
      +
      "</div>"
      +
      '<div class="aquila-f2r31-history-list">'
      +
      (
        state.actions.length
          ? state.actions.map(
              actionCard
            ).join("")
          : (
              '<div class="aquila-f2r31-empty">'
              +
              "<h3>No accounting-period actions yet</h3>"
              +
              "</div>"
            )
      )
      +
      "</div>"
      +
      "</section>";
  }

  async function load() {

    if (state.loading) {
      return;
    }

    state.loading = true;
    state.error = "";
    state.message = "";

    render();

    try {

      const periodPayload =
        await api(
          "/api/v1/pharmaco/accounting/periods"
        );

      state.periods =
        arrayFrom(
          periodPayload,
          [
            "periods",
            "items",
            "rows",
            "data"
          ]
        )
          .filter(
            function (period) {
              return (
                period
                &&
                period.id != null
              );
            }
          )
          .sort(
            function (a, b) {

              const first =
                text(
                  a.starts_on
                );

              const second =
                text(
                  b.starts_on
                );

              if (
                first < second
              ) {
                return -1;
              }

              if (
                first > second
              ) {
                return 1;
              }

              return (
                Number(a.id)
                -
                Number(b.id)
              );
            }
          );

      state.readiness =
        new Map();

      state.readinessErrors =
        new Map();

      const checks =
        await Promise.all(
          state.periods.map(
            async function (
              period
            ) {

              const id =
                Number(
                  period.id
                );

              try {

                const payload =
                  await api(
                    "/api/v1/pharmaco/accounting/periods/"
                    +
                    id
                    +
                    "/close-readiness"
                  );

                return {
                  id:
                    id,

                  data:
                    payload
                    &&
                    payload.data
                      ? payload.data
                      : payload,

                  error:
                    ""
                };

              } catch (error) {

                return {
                  id:
                    id,

                  data:
                    null,

                  error:
                    error instanceof Error
                      ? error.message
                      : "Readiness unavailable."
                };
              }
            }
          )
        );

      checks.forEach(
        function (item) {

          if (item.data) {
            state.readiness.set(
              item.id,
              item.data
            );
          }

          if (item.error) {
            state.readinessErrors.set(
              item.id,
              item.error
            );
          }
        }
      );

      const actionPayload =
        await api(
          "/api/v1/pharmaco/accounting/period-close-actions?limit=100"
        );

      state.actions =
        arrayFrom(
          actionPayload,
          [
            "actions",
            "items",
            "rows",
            "data"
          ]
        );

    } catch (error) {

      state.error =
        error instanceof Error
          ? error.message
          : "Close Books could not be loaded.";

    } finally {

      state.loading = false;

      render();
    }
  }

  function openWorkspace() {

    const root =
      ensureWorkspace();

    root.classList.add(
      "is-open"
    );

    root.setAttribute(
      "aria-hidden",
      "false"
    );

    document.documentElement
      .classList.add(
        "aquila-f2r31-open"
      );

    load();
  }

  function closeWorkspace() {

    const root =
      document.getElementById(
        "aquila-finance-close-books-f2-r3-1"
      );

    if (root) {

      root.classList.remove(
        "is-open"
      );

      root.setAttribute(
        "aria-hidden",
        "true"
      );
    }

    closeModal();

    document.documentElement
      .classList.remove(
        "aquila-f2r31-open"
      );
  }

  function ensureLauncher() {

    const stage =
      accountingStage();

    if (!stage) {
      return false;
    }

    const existing =
      document.getElementById(
        "aquila-finance-close-books-launcher-r3-1"
      );

    if (
      existing
      &&
      existing.isConnected
    ) {
      return true;
    }

    const launcher =
      document.createElement(
        "section"
      );

    launcher.id =
      "aquila-finance-close-books-launcher-r3-1";

    launcher.className =
      "aquila-f2r31-launcher";

    launcher.innerHTML =
      '<div class="aquila-f2r31-launcher__mark">✓</div>'
      +
      '<div class="aquila-f2r31-launcher__copy">'
      +
      '<div class="aquila-f2r31-eyebrow">Accounting control</div>'
      +
      "<h3>Close Books</h3>"
      +
      "<p>Review period readiness, protect completed months and manage governed close or reopen approvals.</p>"
      +
      "</div>"
      +
      '<button id="aquila-f2r31-open" type="button" '
      +
      'class="aquila-f2r31-button aquila-f2r31-button--primary">'
      +
      "Open Close Books"
      +
      "</button>";

    launcher.setAttribute(
      "data-aquila-close-books-support-only",
      "1"
    );

    launcher.setAttribute(
      "aria-hidden",
      "true"
    );

    launcher.hidden = true;

    launcher.style.setProperty(
      "display",
      "none",
      "important"
    );

    launcher.style.setProperty(
      "visibility",
      "hidden",
      "important"
    );

    launcher.style.setProperty(
      "pointer-events",
      "none",
      "important"
    );

    /*
     * Keep the workflow source available to the canonical
     * Accounting button, but never render a visible Accounting
     * banner or launcher.
     */
    stage.insertBefore(
      launcher,
      stage.firstChild
    );

    return true;
  }

  function scheduleMount() {

    mountDelays.forEach(
      function (delay) {

        setTimeout(
          function () {

            if (
              isAccounting()
            ) {
              ensureLauncher();
            }
          },
          delay
        );
      }
    );
  }

  function modalElement() {

    return ensureWorkspace()
      .querySelector(
        "#aquila-f2r31-modal"
      );
  }

  function closeModal() {

    state.modal =
      null;

    const modal =
      modalElement();

    if (!modal) {
      return;
    }

    modal.classList.remove(
      "is-open"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    modal.innerHTML = "";
  }

  function openModal(
    config
  ) {

    state.modal =
      config;

    const required =
      config.mode ===
        "request-close"
      ||
      config.mode ===
        "request-reopen"
      ||
      config.mode ===
        "reject";

    const danger =
      config.mode ===
        "request-reopen"
      ||
      config.mode ===
        "reject";

    const modal =
      modalElement();

    modal.innerHTML =
      '<div class="aquila-f2r31-modal__scrim" data-f2r31-action="cancel-modal"></div>'
      +
      '<section class="aquila-f2r31-modal__card" role="dialog" aria-modal="true">'
      +
      "<header>"
      +
      "<div>"
      +
      '<div class="aquila-f2r31-eyebrow">Governed accounting action</div>'
      +
      "<h3>"
      +
      esc(
        config.title
      )
      +
      "</h3>"
      +
      "<p>"
      +
      esc(
        config.subtitle
      )
      +
      "</p>"
      +
      "</div>"
      +
      '<button type="button" class="aquila-f2r31-icon" data-f2r31-action="cancel-modal">×</button>'
      +
      "</header>"
      +
      '<div class="aquila-f2r31-modal__body">'
      +
      "<label>"
      +
      "<span>"
      +
      (
        required
          ? "Reason / decision note"
          : "Decision note (optional)"
      )
      +
      "</span>"
      +
      '<textarea id="aquila-f2r31-note" rows="5" maxlength="1000" '
      +
      (
        required
          ? "required"
          : ""
      )
      +
      "></textarea>"
      +
      "<small>"
      +
      (
        required
          ? "A meaningful explanation becomes part of the accounting audit trail."
          : "The backend remains authoritative for permission and maker/checker enforcement."
      )
      +
      "</small>"
      +
      "</label>"
      +
      "</div>"
      +
      "<footer>"
      +
      '<button type="button" class="aquila-f2r31-button aquila-f2r31-button--ghost" data-f2r31-action="cancel-modal">Cancel</button>'
      +
      '<button type="button" class="aquila-f2r31-button '
      +
      (
        danger
          ? "aquila-f2r31-button--danger"
          : "aquila-f2r31-button--primary"
      )
      +
      '" data-f2r31-action="submit-modal">'
      +
      esc(
        config.submitLabel
      )
      +
      "</button>"
      +
      "</footer>"
      +
      "</section>";

    modal.classList.add(
      "is-open"
    );

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    setTimeout(
      function () {

        const textarea =
          modal.querySelector(
            "#aquila-f2r31-note"
          );

        if (textarea) {
          textarea.focus();
        }
      },
      0
    );
  }

  async function submitModal() {

    if (
      !state.modal
      ||
      state.busy
    ) {
      return;
    }

    const config =
      state.modal;

    const modal =
      modalElement();

    const textarea =
      modal.querySelector(
        "#aquila-f2r31-note"
      );

    const note =
      text(
        textarea
        &&
        textarea.value
      );

    const required =
      config.mode ===
        "request-close"
      ||
      config.mode ===
        "request-reopen"
      ||
      config.mode ===
        "reject";

    if (
      required
      &&
      note.length < 10
    ) {

      if (textarea) {
        textarea.classList.add(
          "is-invalid"
        );

        textarea.focus();
      }

      return;
    }

    state.busy = true;

    const submit =
      modal.querySelector(
        '[data-f2r31-action="submit-modal"]'
      );

    if (submit) {

      submit.disabled =
        true;

      submit.textContent =
        "Working…";
    }

    try {

      if (
        config.mode ===
        "request-close"
      ) {

        await api(
          "/api/v1/pharmaco/accounting/periods/"
          +
          config.periodId
          +
          "/close-requests",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                reason:
                  note
              })
          }
        );

        state.message =
          "Close request created. A different authorized Finance checker must review it.";
      }

      else if (
        config.mode ===
        "request-reopen"
      ) {

        await api(
          "/api/v1/pharmaco/accounting/periods/"
          +
          config.periodId
          +
          "/reopen-requests",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                reason:
                  note
              })
          }
        );

        state.message =
          "Reopen request created. Independent checker approval is required.";
      }

      else if (
        config.mode ===
        "approve"
      ) {

        await api(
          "/api/v1/pharmaco/accounting/period-close-actions/"
          +
          encodeURIComponent(
            config.uuid
          )
          +
          "/approve",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                comment:
                  note || null
              })
          }
        );

        state.message =
          "Accounting-period request approved and executed.";
      }

      else if (
        config.mode ===
        "reject"
      ) {

        await api(
          "/api/v1/pharmaco/accounting/period-close-actions/"
          +
          encodeURIComponent(
            config.uuid
          )
          +
          "/reject",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                comment:
                  note
              })
          }
        );

        state.message =
          "Accounting-period request rejected.";
      }

      state.error = "";

      closeModal();

      await load();

    } catch (error) {

      state.error =
        error instanceof Error
          ? error.message
          : "The accounting action could not be completed.";

      closeModal();

      render();

    } finally {

      state.busy = false;
    }
  }

  function click(event) {

    const target =
      event.target instanceof Element
        ? event.target
        : null;

    if (!target) {
      return;
    }

    if (
      target.closest(
        "#aquila-f2r31-open"
      )
    ) {

      event.preventDefault();

      openWorkspace();

      return;
    }

    const button =
      target.closest(
        "[data-f2r31-action]"
      );

    if (button) {

      const action =
        button.getAttribute(
          "data-f2r31-action"
        );

      if (
        action === "close"
      ) {

        closeWorkspace();

        return;
      }

      if (
        action === "refresh"
      ) {

        load();

        return;
      }

      if (
        action ===
        "cancel-modal"
      ) {

        closeModal();

        return;
      }

      if (
        action ===
        "submit-modal"
      ) {

        submitModal();

        return;
      }

      if (
        action ===
        "request-close"
      ) {

        openModal({
          mode:
            "request-close",

          periodId:
            Number(
              button.getAttribute(
                "data-period-id"
              )
            ),

          title:
            "Request close — "
            +
            (
              button.getAttribute(
                "data-period-name"
              )
              ||
              "accounting period"
            ),

          subtitle:
            "This creates a close request only. The period remains open until an independent checker approves it.",

          submitLabel:
            "Create close request"
        });

        return;
      }

      if (
        action ===
        "request-reopen"
      ) {

        openModal({
          mode:
            "request-reopen",

          periodId:
            Number(
              button.getAttribute(
                "data-period-id"
              )
            ),

          title:
            "Request reopen — "
            +
            (
              button.getAttribute(
                "data-period-name"
              )
              ||
              "accounting period"
            ),

          subtitle:
            "Reopening closed books is a governed accounting exception and requires independent approval.",

          submitLabel:
            "Create reopen request"
        });

        return;
      }

      if (
        action === "approve"
      ) {

        openModal({
          mode:
            "approve",

          uuid:
            button.getAttribute(
              "data-action-uuid"
            ),

          title:
            "Approve request — "
            +
            (
              button.getAttribute(
                "data-period-name"
              )
              ||
              "accounting period"
            ),

          subtitle:
            "Approval executes the requested accounting-period action. Self-approval remains prohibited by the backend.",

          submitLabel:
            "Approve and execute"
        });

        return;
      }

      if (
        action === "reject"
      ) {

        openModal({
          mode:
            "reject",

          uuid:
            button.getAttribute(
              "data-action-uuid"
            ),

          title:
            "Reject request — "
            +
            (
              button.getAttribute(
                "data-period-name"
              )
              ||
              "accounting period"
            ),

          subtitle:
            "Record a clear rejection reason. The accounting period itself will remain unchanged.",

          submitLabel:
            "Reject request"
        });

        return;
      }
    }

    const navigation =
      target.closest(
        "button,a,[role='button']"
      );

    if (!navigation) {
      return;
    }

    const label =
      text(
        navigation.textContent
      ).toLowerCase();

    if (
      label === "finance"
      ||
      label === "accounting"
      ||
      label.indexOf(
        "finance & accounting"
      ) >= 0
    ) {
      scheduleMount();
    }
  }

  function diagnose() {

    const root =
      document.getElementById(
        "aquila-finance-close-books-f2-r3-1"
      );

    const launcher =
      document.getElementById(
        "aquila-finance-close-books-launcher-r3-1"
      );

    return {
      release:
        RELEASE,

      accountingVisible:
        isAccounting(),

      launcherMounted:
        Boolean(
          launcher
          &&
          launcher.isConnected
        ),

      workspaceMounted:
        Boolean(
          root
          &&
          root.isConnected
        ),

      workspaceOpen:
        Boolean(
          root
          &&
          root.classList.contains(
            "is-open"
          )
        ),

      periodCount:
        state.periods.length,

      actionCount:
        state.actions.length,

      permanentMutationObserver:
        false,

      backgroundPolling:
        false,

      backgroundInterval:
        false,

      globalFetchOverride:
        false
    };
  }

  window.__AQUILA_FINANCE_CLOSE_BOOKS_F2_R3_1__ = {
    release:
      RELEASE,

    mount:
      ensureLauncher,

    open:
      openWorkspace,

    close:
      closeWorkspace,

    refresh:
      load,

    diagnose:
      diagnose
  };

  document.addEventListener(
    "click",
    click,
    false
  );

  document.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key === "Escape"
      ) {

        if (state.modal) {
          closeModal();
        } else {
          closeWorkspace();
        }
      }
    },
    false
  );

  window.addEventListener(
    "hashchange",
    scheduleMount
  );

  window.addEventListener(
    "popstate",
    scheduleMount
  );

  window.addEventListener(
    "pageshow",
    scheduleMount
  );

  window.addEventListener(
    "focus",
    scheduleMount
  );

  document.addEventListener(
    "ubuzima:app-ready",
    scheduleMount
  );

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      scheduleMount,
      {
        once:
          true
      }
    );

  } else {

    scheduleMount();
  }
})();

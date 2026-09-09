(function () {
  "use strict";

  const RELEASE =
    "2026.08.finance-r32-r3-balance-sheet-nav-persistence";

  const MARKER =
    "data-aquila-finance-balance-sheet-r32-r3";

  let generation = 0;

  function clean(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

    function params() {
      const queryParams =
        new URLSearchParams(
          String(
            window.location.search || ""
          ).replace(
            /^\?/,
            ""
          )
        );

      let compatibleHash =
        String(
          window.location.hash || ""
        );

      try {
        const routeOwner =
          window.__AQUILA_FINANCE_BALANCE_R35_ROUTE__;

        if (
          routeOwner
          &&
          typeof routeOwner.compatHash === "function"
        ) {
          compatibleHash =
            String(
              routeOwner.compatHash()
              || compatibleHash
            );
        }
      } catch (_) {
        /*
         * Native hash remains the safe fallback.
         */
      }

      const hashParams =
        new URLSearchParams(
          compatibleHash.replace(
            /^#/,
            ""
          )
        );

      const routeKeys = [
        "section",
        "finance",
        "statement",
      ];

      const hashOwnsRoute =
        routeKeys.some(
          key =>
            hashParams.has(key)
        );

      const merged =
        new URLSearchParams(
          queryParams
        );

      /*
       * Critical isolation rule:
       *
       * The query string is allowed to seed a direct Balance
       * entry only while the Finance SPA has no explicit hash
       * route.
       *
       * Once the hash contains any workspace routing state,
       * the entire query-route tuple is discarded so a stale
       * Balance query cannot leak statement=balance-sheet into
       * Overview, P&L, Payables, Receivables, Accounting, etc.
       */
      if (hashOwnsRoute) {
        for (
          const key
          of routeKeys
        ) {
          merged.delete(key);
        }
      }

      for (
        const [key, value]
        of hashParams.entries()
      ) {
        merged.set(
          key,
          value
        );
      }

      return merged;
    }

    function syncCanonicalQueryRoute() {
      const query =
        new URLSearchParams(
          String(
            window.location.search || ""
          ).replace(
            /^\?/,
            ""
          )
        );

      const canonicalBalance =
        query.get("section") === "finance"
        &&
        query.get("finance") === "financial-statements"
        &&
        query.get("statement") === "balance-sheet";

      if (!canonicalBalance) {
        return;
      }

      const hash =
        new URLSearchParams(
          String(
            window.location.hash || ""
          ).replace(
            /^#/,
            ""
          )
        );

      const hashOwnsRoute =
        [
          "section",
          "finance",
          "statement",
        ].some(
          key =>
            hash.has(key)
        );

      /*
       * Never overwrite an explicit SPA route.
       *
       * Examples protected here:
       * Finance Overview
       * Profit & Loss
       * Payables
       * Receivables
       * Accounting
       * Chart of Accounts
       */
      if (hashOwnsRoute) {
        return;
      }

      hash.set(
        "section",
        "finance"
      );

      hash.set(
        "finance",
        "financial-statements"
      );

      hash.set(
        "statement",
        "balance-sheet"
      );

      hash.set(
        "scrollY",
        "0"
      );

      const oldURL =
        window.location.href;

      const nextURL =
        window.location.pathname
        +
        window.location.search
        +
        "#"
        +
        hash.toString();

      window.history.replaceState(
        window.history.state,
        "",
        nextURL
      );

      /*
       * Wake the already-loaded canonical Balance UI owner.
       */
      try {
        window.dispatchEvent(
          new HashChangeEvent(
            "hashchange",
            {
              oldURL:
                oldURL,
              newURL:
                window.location.href,
            }
          )
        );
      } catch (_) {
        window.dispatchEvent(
          new Event(
            "hashchange"
          )
        );
      }
    }

    syncCanonicalQueryRoute();

  function isFinance() {
    return (
      params().get(
        "section"
      ) === "finance"
    );
  }

  function visible(node) {
    if (!node) {
      return false;
    }

    const style =
      getComputedStyle(node);

    const rect =
      node.getBoundingClientRect();

    return (
      style.display !== "none"
      &&
      style.visibility !== "hidden"
      &&
      Number(
        style.opacity || 1
      ) !== 0
      &&
      rect.width > 0
      &&
      rect.height > 0
    );
  }

  function exactNodes(
    root,
    label
  ) {
    return [
      ...root.querySelectorAll(
        "button,a,[role='tab']"
      )
    ].filter(
      node =>
        visible(node)
        &&
        clean(
          node.textContent
        ) === label
    );
  }

  function findFinanceNav() {
    const profits =
      exactNodes(
        document,
        "Profit & Loss"
      );

    for (
      const profit
      of profits
    ) {
      let parent =
        profit.parentElement;

      for (
        let depth = 0;
        parent && depth < 6;
        depth += 1
      ) {
        const overview =
          exactNodes(
            parent,
            "Overview"
          )[0];

        const cash =
          exactNodes(
            parent,
            "Cash Flow"
          )[0];

        if (
          overview
          &&
          cash
        ) {
          return {
            root: parent,
            cash
          };
        }

        parent =
          parent.parentElement;
      }
    }

    return null;
  }

  function balanceHash() {
    const p = params();

    p.set(
      "section",
      "finance"
    );

    p.set(
      "finance",
      "financial-statements"
    );

    p.set(
      "statement",
      "balance-sheet"
    );

    p.set(
      "scrollY",
      "0"
    );

    return (
      "#"
      +
      p.toString()
    );
  }

  function openBalanceSheet(
    event
  ) {
    event.preventDefault();
    event.stopPropagation();

    window.__AQUILA_FINANCE_BALANCE_R35_ROUTE__.setHash(balanceHash());
  }

  function makeBalanceTab(
    source
  ) {
    const node =
      source.cloneNode(true);

    node.removeAttribute(
      "id"
    );

    node.removeAttribute(
      "aria-current"
    );

    node.setAttribute(
      "aria-selected",
      "false"
    );

    /*
     * Remove source-specific metadata.
     */
    for (
      const attribute
      of [...node.attributes]
    ) {
      if (
        attribute.name.startsWith(
          "data-"
        )
      ) {
        node.removeAttribute(
          attribute.name
        );
      }
    }

    /*
     * Do not inherit an active/current visual
     * state if Cash Flow happens to be active.
     */
    const classes =
      String(
        node.className || ""
      )
        .split(/\s+/)
        .filter(Boolean)
        .filter(
          token =>
            !/active|selected|current/i
              .test(token)
        );

    if (
      typeof node.className ===
        "string"
    ) {
      node.className =
        classes.join(" ");
    }

    node.setAttribute(
      MARKER,
      "1"
    );

    node.textContent =
      "Balance Sheet";

    if (
      node instanceof
        HTMLAnchorElement
    ) {
      node.href =
        balanceHash();
    }

    if (
      node instanceof
        HTMLButtonElement
    ) {
      node.type =
        "button";
    }

    node.addEventListener(
      "click",
      openBalanceSheet,
      true
    );

    return node;
  }

  function ensureBalanceSheetTab() {
    if (!isFinance()) {
      return false;
    }

    const nav =
      findFinanceNav();

    if (!nav) {
      return false;
    }

    /*
     * Native/R23 tab already present.
     * Leave it alone.
     */
    const existing =
      exactNodes(
        nav.root,
        "Balance Sheet"
      )[0];

    if (existing) {
      return true;
    }

    const tab =
      makeBalanceTab(
        nav.cash
      );

    nav.cash.parentNode
      .insertBefore(
        tab,
        nav.cash
      );

    return true;
  }

  /*
   * Bounded post-navigation reconciliation.
   * It terminates automatically.
   */
  function reconcile() {
    const ticket =
      ++generation;

    let frame = 0;

    function step() {
      if (
        ticket !== generation
      ) {
        return;
      }

      if (
        frame % 6 === 0
      ) {
        ensureBalanceSheetTab();
      }

      frame += 1;

      if (
        frame < 360
      ) {
        requestAnimationFrame(
          step
        );
      }
    }

    requestAnimationFrame(
      step
    );
  }

  document.addEventListener(
    "click",
    function (event) {
      if (
        !(
          event.target
          instanceof Element
        )
      ) {
        return;
      }

      const tab =
        event.target.closest(
          "button,a,[role='tab']"
        );

      if (!tab) {
        return;
      }

      if (
        tab.hasAttribute(
          MARKER
        )
      ) {
        return;
      }

      const label =
        clean(
          tab.textContent
        );

      if (
        [
          "Overview",
          "Profit & Loss",
          "Cash Flow",
          "Sales",
          "Receivables",
          "Payables",
          "Expenses",
          "Inventory Finance",
          "Banking",
          "Reports",
          "Accounting"
        ].includes(label)
      ) {
        reconcile();
      }
    },
    true
  );

  window.addEventListener(
    "hashchange",
    reconcile,
    {
      passive: true
    }
  );

  window.addEventListener(
    "pageshow",
    reconcile,
    {
      passive: true
    }
  );

  window
    .__AQUILA_FINANCE_BALANCE_NAV_R32_R3__ = {
      release:
        RELEASE,

      ensure:
        ensureBalanceSheetTab
    };

  if (
    document.readyState ===
      "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      reconcile,
      {
        once: true
      }
    );
  } else {
    reconcile();
  }
})();

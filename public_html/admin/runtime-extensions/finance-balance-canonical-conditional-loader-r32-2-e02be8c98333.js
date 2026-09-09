(() => {
  "use strict";

  const RELEASE =
    "AQUILA-FINANCE-BALANCE-CANONICAL-CONDITIONAL-R32-2";

  const TARGET_RELEASE =
    "2026.08.finance-balance-canonical-ui-r1";

  const TARGET_FILE =
    "finance-balance-sheet-canonical-ui-c63c01fd50d3.js";

  const TARGET_SRC =
    "/admin/runtime-extensions/" +
    TARGET_FILE +
    "?v=535a44dca2c5";

  const CLOAK_ATTR =
    "data-aquila-balance-canonical-pending";

  const CLOAK_STYLE_ID =
    "aquila-balance-canonical-transition-r32-2";

  if (
    window.__AQUILA_FINANCE_BALANCE_CANONICAL_LOADER__
      ?.release === RELEASE
  ) {
    return;
  }

  let loadingPromise = null;
  let handoffTimer = null;
  let failSafeTimer = null;

  function target() {
    return (
      window.__AQUILA_FINANCE_BALANCE_CANONICAL_UI__
      || null
    );
  }

  function ready() {
    const mod = target();

    return Boolean(
      mod
      &&
      mod.release === TARGET_RELEASE
      &&
      typeof mod.refresh === "function"
      &&
      typeof mod.diagnose === "function"
    );
  }

  function hashParams() {
    try {
      return new URLSearchParams(
        String(
          location.hash
          || ""
        ).replace(/^#/, "")
      );
    } catch (_) {
      return new URLSearchParams();
    }
  }

  function exactBalanceRoute() {
    const params = hashParams();

    return (
      params.get("section") === "finance"
      &&
      params.get("finance") === "financial-statements"
      &&
      params.get("statement") === "balance-sheet"
    );
  }

  function explicitHashExists() {
    const value =
      String(
        location.hash
        || ""
      )
        .replace(/^#/, "")
        .trim();

    return Boolean(
      value
      &&
      value !== "/"
    );
  }

  function queryDeepLink() {
    try {
      return (
        String(
          new URLSearchParams(
            location.search
            || ""
          ).get("statement")
          || ""
        )
          .trim()
          .toLowerCase()
        === "balance-sheet"
      );
    } catch (_) {
      return false;
    }
  }

  function shouldLoad() {
    return (
      exactBalanceRoute()
      ||
      (
        queryDeepLink()
        &&
        !explicitHashExists()
      )
    );
  }

  function ensureCloakStyle() {
    if (
      document.getElementById(
        CLOAK_STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      CLOAK_STYLE_ID;

    style.textContent = `
      html[${CLOAK_ATTR}="1"]
      .module-section-stage[data-finance-module-stage="active"] {
        display: none !important;
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function engageCloak() {
    ensureCloakStyle();

    document.documentElement
      .setAttribute(
        CLOAK_ATTR,
        "1"
      );
  }

  function releaseCloak() {
    document.documentElement
      .removeAttribute(
        CLOAK_ATTR
      );
  }

  function clearHandoffTimers() {
    if (handoffTimer !== null) {
      clearTimeout(handoffTimer);
      handoffTimer = null;
    }

    if (failSafeTimer !== null) {
      clearTimeout(failSafeTimer);
      failSafeTimer = null;
    }
  }

  function canonicalOwnsRoute() {
    const mod = target();

    if (
      !mod
      ||
      typeof mod.diagnose !== "function"
    ) {
      return false;
    }

    try {
      const state = mod.diagnose();

      return Boolean(
        state
        &&
        state.route
        &&
        state.root
      );
    } catch (_) {
      return false;
    }
  }

  function watchCanonicalHandoff() {
    clearHandoffTimers();

    const check = () => {
      if (!shouldLoad()) {
        releaseCloak();
        clearHandoffTimers();
        return;
      }

      if (canonicalOwnsRoute()) {
        releaseCloak();
        clearHandoffTimers();
        return;
      }

      handoffTimer =
        setTimeout(
          check,
          32
        );
    };

    check();

    failSafeTimer =
      setTimeout(
        () => {
          if (
            !canonicalOwnsRoute()
          ) {
            releaseCloak();
          }

          clearHandoffTimers();
        },
        4000
      );
  }

  function existingScript() {
    return (
      Array
        .from(document.scripts)
        .find(
          script =>
            String(
              script.src
              || ""
            ).includes(
              "/" + TARGET_FILE
            )
        )
      || null
    );
  }

  function load() {
    if (ready()) {
      watchCanonicalHandoff();

      return Promise.resolve(
        target()
      );
    }

    if (loadingPromise) {
      return loadingPromise;
    }

    loadingPromise =
      new Promise(
        (resolve, reject) => {
          const verify = () => {
            if (!ready()) {
              reject(
                new Error(
                  "Balance Sheet canonical runtime loaded without expected contract."
                )
              );

              return;
            }

            watchCanonicalHandoff();

            resolve(
              target()
            );
          };

          const existing =
            existingScript();

          if (existing) {
            if (ready()) {
              verify();
              return;
            }

            existing.addEventListener(
              "load",
              verify,
              {
                once: true,
              }
            );

            existing.addEventListener(
              "error",
              () => {
                releaseCloak();

                reject(
                  new Error(
                    "Balance Sheet canonical runtime failed to load."
                  )
                );
              },
              {
                once: true,
              }
            );

            return;
          }

          const script =
            document.createElement(
              "script"
            );

          script.src =
            TARGET_SRC;

          script.async =
            false;

          script.dataset
            .aquilaFinanceBalanceCanonicalLazy =
              "r32-2";

          script.addEventListener(
            "load",
            verify,
            {
              once: true,
            }
          );

          script.addEventListener(
            "error",
            () => {
              releaseCloak();

              reject(
                new Error(
                  "Balance Sheet canonical runtime failed to load."
                )
              );
            },
            {
              once: true,
            }
          );

          document.head.appendChild(
            script
          );
        }
      );

    loadingPromise =
      loadingPromise.catch(
        error => {
          loadingPromise = null;
          releaseCloak();
          throw error;
        }
      );

    return loadingPromise;
  }

  function maybeLoad() {
    if (!shouldLoad()) {
      releaseCloak();
      clearHandoffTimers();
      return false;
    }

    engageCloak();
    watchCanonicalHandoff();

    void load().catch(
      error => {
        console.error(
          "[Ubuzima+] Balance Sheet conditional load failed.",
          error
        );
      }
    );

    return true;
  }

  window.addEventListener(
    "ubuzima:finance-balance-canonical-rendered",
    () => {
      if (shouldLoad()) {
        releaseCloak();
        clearHandoffTimers();
      }
    }
  );

  window.addEventListener(
    "hashchange",
    maybeLoad,
    {
      passive: true,
    }
  );

  window.addEventListener(
    "pageshow",
    maybeLoad,
    {
      passive: true,
    }
  );

  window.addEventListener(
    "popstate",
    maybeLoad,
    {
      passive: true,
    }
  );

  if (
    document.readyState
    === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      maybeLoad,
      {
        once: true,
      }
    );
  } else {
    queueMicrotask(
      maybeLoad
    );
  }

  window.__AQUILA_FINANCE_BALANCE_CANONICAL_LOADER__ =
    Object.freeze({
      release: RELEASE,
      targetRelease: TARGET_RELEASE,
      load,
      shouldLoad,
      status() {
        return {
          loaded: ready(),
          loading:
            Boolean(
              loadingPromise
            ),
          routeActive:
            shouldLoad(),
          transitionCloaked:
            document.documentElement
              .hasAttribute(
                CLOAK_ATTR
              ),
          canonicalOwnsRoute:
            canonicalOwnsRoute(),
          navigationOwnerPresent:
            Boolean(
              window.__AQUILA_FINANCE_BALANCE_NAV_R32_R3__
            ),
        };
      },
    });
})();

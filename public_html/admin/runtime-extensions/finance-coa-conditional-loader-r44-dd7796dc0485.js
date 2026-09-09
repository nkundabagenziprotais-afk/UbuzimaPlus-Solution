(() => {
    "use strict";

    const RELEASE =
        "AQUILA_FINANCE_COA_CONDITIONAL_LOADER_R44";

    const TARGET_GLOBAL =
        "__AQUILA_FINANCE_COA_F3_R4_3__";

    const TARGET_SRC =
        "/admin/runtime-extensions/" +
        "finance-coa-f3-r4-3-r4-native-de92a95cc357.js" +
        "?v=de92a95cc357";

    const TARGET_ID =
        "aquila-finance-coa-r44-target";

    if (
        window.__AQUILA_FINANCE_COA_CONDITIONAL_LOADER_R44__
        ?.release === RELEASE
    ) {
        return;
    }

    const state = {
        requests: 0,
        loads: 0,
        failures: 0,
        loading: false,
        loaded: Boolean(
            window[TARGET_GLOBAL]
        ),
        lastReason: null,
        lastError: null,
        lastRoute: null,
    };

    let promise = null;

    function params() {
        try {
            return new URLSearchParams(
                String(
                    location.hash || ""
                ).replace(
                    /^#/,
                    ""
                )
            );
        } catch (_) {
            return new URLSearchParams();
        }
    }

    function routeState() {
        const p = params();

        return {
            section:
                p.get("section") || "",

            finance:
                p.get("finance") || "",
        };
    }

    function isAccountingRoute() {
        const route =
            routeState();

        state.lastRoute =
            route;

        return (
            route.section === "finance"
            &&
            route.finance === "accounting"
        );
    }

    function existingTargetTag() {
        return (
            document.getElementById(
                TARGET_ID
            )
            ||
            document.querySelector(
                'script[src*="' +
                'finance-coa-f3-r4-3-r4-native-de92a95cc357.js' +
                '"]'
            )
        );
    }

    function load(reason = "route") {
        state.requests += 1;
        state.lastReason =
            reason;

        if (
            window[TARGET_GLOBAL]
        ) {
            state.loaded = true;
            state.loading = false;

            return Promise.resolve(
                window[TARGET_GLOBAL]
            );
        }

        if (promise) {
            return promise;
        }

        const existing =
            existingTargetTag();

        if (existing) {
            promise =
                new Promise(
                    (resolve, reject) => {
                        if (
                            window[TARGET_GLOBAL]
                        ) {
                            state.loaded = true;
                            resolve(
                                window[TARGET_GLOBAL]
                            );
                            return;
                        }

                        existing.addEventListener(
                            "load",
                            () => {
                                if (
                                    window[TARGET_GLOBAL]
                                ) {
                                    state.loaded = true;
                                    state.loading = false;
                                    state.loads += 1;

                                    resolve(
                                        window[TARGET_GLOBAL]
                                    );
                                } else {
                                    const error =
                                        new Error(
                                            "COA target loaded without expected global"
                                        );

                                    state.failures += 1;
                                    state.lastError =
                                        error.message;

                                    state.loading = false;

                                    reject(error);
                                }
                            },
                            {
                                once: true,
                            }
                        );

                        existing.addEventListener(
                            "error",
                            () => {
                                const error =
                                    new Error(
                                        "COA target script failed to load"
                                    );

                                state.failures += 1;
                                state.lastError =
                                    error.message;

                                state.loading = false;

                                reject(error);
                            },
                            {
                                once: true,
                            }
                        );
                    }
                );

            return promise;
        }

        state.loading = true;
        state.lastError = null;

        promise =
            new Promise(
                (resolve, reject) => {
                    const script =
                        document.createElement(
                            "script"
                        );

                    script.id =
                        TARGET_ID;

                    script.src =
                        TARGET_SRC;

                    /*
                     * Preserve ordered classic-script semantics for
                     * this dynamically inserted legacy runtime.
                     */
                    script.async = false;

                    script.setAttribute(
                        "data-aquila-finance-f3-r4-3-r4",
                        "js"
                    );

                    script.onload =
                        () => {
                            state.loading = false;

                            if (
                                !window[TARGET_GLOBAL]
                            ) {
                                const error =
                                    new Error(
                                        "COA target loaded without expected global"
                                    );

                                state.failures += 1;
                                state.lastError =
                                    error.message;

                                promise = null;

                                reject(error);
                                return;
                            }

                            state.loaded = true;
                            state.loads += 1;

                            resolve(
                                window[TARGET_GLOBAL]
                            );
                        };

                    script.onerror =
                        () => {
                            const error =
                                new Error(
                                    "COA target script failed to load"
                                );

                            state.loading = false;
                            state.failures += 1;
                            state.lastError =
                                error.message;

                            script.remove();

                            promise = null;

                            reject(error);
                        };

                    (
                        document.head
                        ||
                        document.documentElement
                    ).appendChild(
                        script
                    );
                }
            );

        return promise;
    }

    function maybeLoad(reason) {
        if (!isAccountingRoute()) {
            return false;
        }

        void load(reason)
            .catch(
                error => {
                    state.lastError =
                        String(
                            error?.message
                            ??
                            error
                        );
                }
            );

        return true;
    }

    /*
     * Route lifecycle.
     */
    window.addEventListener(
        "hashchange",
        () => {
            maybeLoad(
                "hashchange"
            );
        },
        {
            passive: true,
        }
    );

    window.addEventListener(
        "popstate",
        () => {
            maybeLoad(
                "popstate"
            );
        },
        {
            passive: true,
        }
    );

    window.addEventListener(
        "pageshow",
        () => {
            maybeLoad(
                "pageshow"
            );
        },
        {
            passive: true,
        }
    );

    /*
     * After a Finance-nav click, re-check on the next frame.
     * The route remains the authority; text alone never loads it.
     */
    document.addEventListener(
        "click",
        event => {
            const target =
                event.target instanceof Element
                    ? event.target.closest(
                        'button,a,[role="button"],[role="tab"]'
                    )
                    : null;

            if (!target) {
                return;
            }

            requestAnimationFrame(
                () => {
                    maybeLoad(
                        "navigation-click-settle"
                    );
                }
            );
        },
        true
    );

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            () => {
                maybeLoad(
                    "dom-ready"
                );
            },
            {
                once: true,
            }
        );
    } else {
        maybeLoad(
            "runtime-load"
        );
    }

    window.__AQUILA_FINANCE_COA_CONDITIONAL_LOADER_R44__ =
        Object.freeze({
            release:
                RELEASE,

            load:
                () =>
                    load(
                        "manual"
                    ),

            diagnose() {
                return {
                    release:
                        RELEASE,

                    route:
                        routeState(),

                    accountingRoute:
                        isAccountingRoute(),

                    targetGlobal:
                        Boolean(
                            window[
                                TARGET_GLOBAL
                            ]
                        ),

                    targetTag:
                        Boolean(
                            existingTargetTag()
                        ),

                    ...state,
                };
            },
        });
})();

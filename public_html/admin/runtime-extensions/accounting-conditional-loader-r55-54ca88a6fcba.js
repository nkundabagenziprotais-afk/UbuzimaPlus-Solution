(() => {
    "use strict";

    const RELEASE =
        "AQUILA_ACCOUNTING_CONDITIONAL_LOADING_R55";

    const TARGET_NAME =
        "accounting-control-centre-r55-hardened-b1e100a8038c.js";

    const TARGET_SRC =
        "/admin/runtime-extensions/"
        + TARGET_NAME
        + "?v=b1e100a8038c";

    const TARGET_ATTR =
        "data-aquila-accounting-target-r55";

    const ROUTE_EVENT =
        "aquila:accounting-route-refresh";

    if (
        window.__AQUILA_ACCOUNTING_CONDITIONAL_LOADER_R55__
        ?.release === RELEASE
    ) {
        return;
    }

    let frame = 0;
    let loading = false;
    let loaded = false;
    let lastReason = null;
    let lastAccountingRoute = null;

    const state = {
        checks: 0,
        injections: 0,
        loadSuccesses: 0,
        loadErrors: 0,
        routeRefreshes: 0,
        teardownRefreshes: 0,
        coalesced: 0,
    };

    function lower(value) {
        return String(
            value || ""
        )
            .trim()
            .toLowerCase();
    }

    function routeParams() {
        const url =
            new URL(
                window.location.href
            );

        const merged =
            new URLSearchParams(
                url.search
            );

        const hash =
            new URLSearchParams(
                String(
                    url.hash || ""
                ).replace(
                    /^#/,
                    ""
                )
            );

        for (
            const [key, value]
            of hash.entries()
        ) {
            merged.set(
                key,
                value
            );
        }

        return merged;
    }

    function routeIsAccounting() {
        const params =
            routeParams();

        const section =
            lower(
                params.get(
                    "section"
                )
            );

        const finance =
            lower(
                params.get(
                    "finance"
                )
                ||
                params.get(
                    "workspace"
                )
                ||
                params.get(
                    "page"
                )
            );

        return (
            section === "finance"
            &&
            finance === "accounting"
        );
    }

    function targetElement() {
        return document.querySelector(
            "script["
            + TARGET_ATTR
            + '="1"]'
        );
    }

    function wakeLoadedTarget(
        teardown = false
    ) {
        if (!loaded) {
            return;
        }

        state.routeRefreshes += 1;

        if (teardown) {
            state.teardownRefreshes += 1;
        }

        window.dispatchEvent(
            new Event(
                ROUTE_EVENT
            )
        );
    }

    function inject() {
        if (
            loaded
            ||
            loading
        ) {
            return;
        }

        const existing =
            targetElement();

        if (existing) {
            if (
                existing.dataset
                    .aquilaAccountingLoaded
                ===
                "1"
            ) {
                loaded = true;

                wakeLoadedTarget();
            }

            return;
        }

        loading = true;
        state.injections += 1;

        const script =
            document.createElement(
                "script"
            );

        script.src =
            TARGET_SRC;

        script.async =
            true;

        script.setAttribute(
            TARGET_ATTR,
            "1"
        );

        script.addEventListener(
            "load",
            () => {
                loading = false;
                loaded = true;

                script.dataset
                    .aquilaAccountingLoaded =
                    "1";

                state.loadSuccesses += 1;

                const accounting =
                    routeIsAccounting();

                lastAccountingRoute =
                    accounting;

                wakeLoadedTarget(
                    !accounting
                );
            },
            {
                once: true,
            }
        );

        script.addEventListener(
            "error",
            () => {
                loading = false;
                loaded = false;

                state.loadErrors += 1;

                script.remove();
            },
            {
                once: true,
            }
        );

        (
            document.head
            ||
            document.documentElement
        ).appendChild(
            script
        );
    }

    function check(reason) {
        state.checks += 1;
        lastReason = reason;

        const accounting =
            routeIsAccounting();

        if (!loaded) {
            lastAccountingRoute =
                accounting;

            if (accounting) {
                inject();
            }

            return;
        }

        const routeChanged =
            lastAccountingRoute
            !==
            accounting;

        if (accounting) {
            wakeLoadedTarget();
        } else if (
            routeChanged
            &&
            lastAccountingRoute === true
        ) {
            wakeLoadedTarget(
                true
            );
        }

        lastAccountingRoute =
            accounting;
    }

    function schedule(reason) {
        lastReason = reason;

        if (frame) {
            state.coalesced += 1;
            return;
        }

        frame =
            requestAnimationFrame(
                () => {
                    frame = 0;

                    check(
                        lastReason
                        ||
                        "coalesced"
                    );
                }
            );
    }

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

            schedule(
                "control-click"
            );
        },
        true
    );

    window.addEventListener(
        "hashchange",
        () => {
            schedule(
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
            schedule(
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
            schedule(
                "pageshow"
            );
        },
        {
            passive: true,
        }
    );

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            () => {
                schedule(
                    "dom-ready"
                );
            },
            {
                once: true,
            }
        );
    } else {
        schedule(
            "runtime-load"
        );
    }

    window.__AQUILA_ACCOUNTING_CONDITIONAL_LOADER_R55__ =
        Object.freeze({
            release:
                RELEASE,

            refresh:
                () => {
                    schedule(
                        "manual"
                    );
                },

            diagnose() {
                return {
                    release:
                        RELEASE,

                    routeAccounting:
                        routeIsAccounting(),

                    targetName:
                        TARGET_NAME,

                    targetPresent:
                        Boolean(
                            targetElement()
                        ),

                    loading,
                    loaded,
                    lastReason,
                    lastAccountingRoute,

                    framePending:
                        Boolean(
                            frame
                        ),

                    ...state,
                };
            },
        });
})();

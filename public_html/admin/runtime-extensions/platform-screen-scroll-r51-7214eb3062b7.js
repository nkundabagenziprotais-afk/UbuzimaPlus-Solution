(() => {
    "use strict";

    const RELEASE =
        "AQUILA_PLATFORM_SCREEN_SCROLL_R51";

    const ROOT_ATTR =
        "data-aquila-screen-scroll-r51";

    const SURFACE_ATTR =
        "data-aquila-screen-scroll-surface-r51";

    const HEIGHT_VAR =
        "--aquila-r51-main-height";

    if (
        window.__AQUILA_PLATFORM_SCREEN_SCROLL_R51__
        ?.release === RELEASE
    ) {
        return;
    }

    const html =
        document.documentElement;

    let frameOne = 0;
    let frameTwo = 0;
    let pendingReason = null;

    const state = {
        runs: 0,
        schedules: 0,
        coalesced: 0,

        staleCloseBooksClears: 0,
        staleCoaClears: 0,

        active: false,
        heightPx: null,

        lastReason: null,
        lastExcludedReason: null,
    };

    function route() {
        try {
            const params =
                new URLSearchParams(
                    String(
                        location.hash || ""
                    ).replace(
                        /^#/,
                        ""
                    )
                );

            return {
                section:
                    params.get(
                        "section"
                    ) || "",

                finance:
                    params.get(
                        "finance"
                    ) || "",
            };
        } catch (_) {
            return {
                section: "",
                finance: "",
            };
        }
    }

    function closeBooksOpen() {
        const owner =
            document.getElementById(
                "aquila-finance-close-books-f2-r3-1"
            );

        return Boolean(
            owner
            &&
            owner.classList.contains(
                "is-open"
            )
            &&
            owner.getAttribute(
                "aria-hidden"
            ) !== "true"
        );
    }

    function coaOpen() {
        const owner =
            document.getElementById(
                "aquila-finance-f3-r4-overlay"
            );

        return Boolean(
            owner
            &&
            owner.classList.contains(
                "is-open"
            )
            &&
            owner.getAttribute(
                "aria-hidden"
            ) !== "true"
        );
    }

    function repairStaleLocks() {
        if (
            html.classList.contains(
                "aquila-f2r31-open"
            )
            &&
            !closeBooksOpen()
        ) {
            html.classList.remove(
                "aquila-f2r31-open"
            );

            document.body
                ?.classList.remove(
                    "aquila-f2r31-open"
                );

            state.staleCloseBooksClears += 1;
        }

        if (
            (
                html.classList.contains(
                    "aquila-f3-lock"
                )
                ||
                document.body
                    ?.classList.contains(
                        "aquila-f3-lock"
                    )
            )
            &&
            !coaOpen()
        ) {
            html.classList.remove(
                "aquila-f3-lock"
            );

            document.body
                ?.classList.remove(
                    "aquila-f3-lock"
                );

            state.staleCoaClears += 1;
        }
    }

    function excludedReason() {
        if (window.innerWidth <= 860) {
            return "mobile-viewport";
        }

        const shell =
            document.querySelector(
                ".dashboard-shell"
            );

        if (
            shell
            ?.classList.contains(
                "dashboard-shell--native-workflow-open"
            )
        ) {
            return "native-workflow";
        }

        if (
            shell
            ?.classList.contains(
                "dashboard-shell--native-pos-products"
            )
        ) {
            return "native-pos-products";
        }

        const current =
            route();

        if (
            current.section === "pos"
            ||
            current.section === "pharmacy-pos"
        ) {
            return "pos-route";
        }

        if (closeBooksOpen()) {
            return "close-books-open";
        }

        if (coaOpen()) {
            return "coa-open";
        }

        return null;
    }

    function main() {
        const element =
            document.querySelector(
                ".dashboard-main"
            );

        if (!element) {
            return null;
        }

        const style =
            getComputedStyle(
                element
            );

        const rect =
            element.getBoundingClientRect();

        if (
            style.display === "none"
            ||
            style.visibility === "hidden"
            ||
            rect.width <= 40
        ) {
            return null;
        }

        return element;
    }

    function deactivate(reason) {
        const element =
            main();

        if (element) {
            element.removeAttribute(
                SURFACE_ATTR
            );
        }

        document
            .querySelectorAll(
                "[" +
                SURFACE_ATTR +
                '="1"]'
            )
            .forEach(
                node => {
                    node.removeAttribute(
                        SURFACE_ATTR
                    );
                }
            );

        html.removeAttribute(
            ROOT_ATTR
        );

        html.style.removeProperty(
            HEIGHT_VAR
        );

        state.active =
            false;

        state.heightPx =
            null;

        state.lastExcludedReason =
            reason;
    }

    function refresh(
        reason = "manual"
    ) {
        state.runs += 1;
        state.lastReason =
            reason;

        repairStaleLocks();

        const excluded =
            excludedReason();

        if (excluded) {
            deactivate(
                excluded
            );

            return false;
        }

        const element =
            main();

        if (!element) {
            deactivate(
                "dashboard-main-not-found"
            );

            return false;
        }

        /*
         * Remove legacy R48 scroll-surface ownership.
         * R51 owns only .dashboard-main.
         */
        document
            .querySelectorAll(
                '[data-aquila-main-scroll-surface-r48="1"]'
            )
            .forEach(
                node => {
                    node.removeAttribute(
                        "data-aquila-main-scroll-surface-r48"
                    );
                }
            );

        html.removeAttribute(
            "data-aquila-main-scroll-owner-r48"
        );

        html.style.removeProperty(
            "--aquila-r48-main-scroll-height"
        );

        document
            .querySelectorAll(
                "[" +
                SURFACE_ATTR +
                '="1"]'
            )
            .forEach(
                node => {
                    if (node !== element) {
                        node.removeAttribute(
                            SURFACE_ATTR
                        );
                    }
                }
            );

        const rect =
            element.getBoundingClientRect();

        const available =
            Math.max(
                220,
                Math.floor(
                    window.innerHeight
                    -
                    Math.max(
                        0,
                        rect.top
                    )
                    -
                    10
                )
            );

        html.style.setProperty(
            HEIGHT_VAR,
            available + "px"
        );

        element.setAttribute(
            SURFACE_ATTR,
            "1"
        );

        html.setAttribute(
            ROOT_ATTR,
            "1"
        );

        state.active =
            true;

        state.heightPx =
            available;

        state.lastExcludedReason =
            null;

        return true;
    }

    function cancelFrames() {
        if (frameOne) {
            cancelAnimationFrame(
                frameOne
            );
        }

        if (frameTwo) {
            cancelAnimationFrame(
                frameTwo
            );
        }

        frameOne = 0;
        frameTwo = 0;
    }

    function schedule(reason) {
        state.schedules += 1;

        pendingReason =
            reason;

        if (
            frameOne
            ||
            frameTwo
        ) {
            state.coalesced += 1;
            return;
        }

        frameOne =
            requestAnimationFrame(
                () => {
                    frameOne = 0;

                    frameTwo =
                        requestAnimationFrame(
                            () => {
                                frameTwo = 0;

                                const finalReason =
                                    pendingReason
                                    ||
                                    "coalesced";

                                pendingReason =
                                    null;

                                refresh(
                                    finalReason
                                );
                            }
                        );
                }
            );
    }

    function relevantClick(event) {
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
    }

    document.addEventListener(
        "click",
        relevantClick,
        true
    );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape"
            ) {
                schedule(
                    "escape"
                );
            }
        }
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

    window.addEventListener(
        "resize",
        () => {
            cancelFrames();

            schedule(
                "resize"
            );
        },
        {
            passive: true,
        }
    );

    window.addEventListener(
        "orientationchange",
        () => {
            cancelFrames();

            schedule(
                "orientationchange"
            );
        },
        {
            passive: true,
        }
    );

    if (
        document.readyState
        ===
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

    window.__AQUILA_PLATFORM_SCREEN_SCROLL_R51__ =
        Object.freeze({
            release:
                RELEASE,

            refresh:
                () => {
                    cancelFrames();

                    schedule(
                        "manual"
                    );
                },

            diagnose() {
                const element =
                    main();

                const style =
                    element
                        ? getComputedStyle(
                            element
                        )
                        : null;

                return {
                    release:
                        RELEASE,

                    active:
                        html.hasAttribute(
                            ROOT_ATTR
                        ),

                    route:
                        route(),

                    excluded:
                        excludedReason(),

                    mainPresent:
                        Boolean(
                            element
                        ),

                    mainMarked:
                        Boolean(
                            element
                            ?.getAttribute(
                                SURFACE_ATTR
                            )
                            ===
                            "1"
                        ),

                    overflowY:
                        style
                            ?.overflowY
                            ??
                            null,

                    clientHeight:
                        element
                            ?.clientHeight
                            ??
                            null,

                    scrollHeight:
                        element
                            ?.scrollHeight
                            ??
                            null,

                    scrollTop:
                        element
                            ?.scrollTop
                            ??
                            null,

                    scrollable:
                        Boolean(
                            element
                            &&
                            element.scrollHeight
                            >
                            element.clientHeight
                            +
                            2
                        ),

                    closeBooksOpen:
                        closeBooksOpen(),

                    coaOpen:
                        coaOpen(),

                    frameOnePending:
                        Boolean(
                            frameOne
                        ),

                    frameTwoPending:
                        Boolean(
                            frameTwo
                        ),

                    ...state,
                };
            },
        });
})();

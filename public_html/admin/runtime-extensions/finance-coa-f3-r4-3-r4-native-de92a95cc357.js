(function () {
    'use strict';

    const RELEASE =
        'AQUILA_FINANCE_F3_R4_3_R4_NATIVE';

    const NATIVE_ID =
        'aquila-finance-f3-r4-3-r4-native-launcher';

    const BADGE_CLASS =
        'aquila-f3-r4-3-r4-badge';

    if (
        window.__AQUILA_FINANCE_COA_F3_R4_3__
    ) {
        return;
    }

    const state = {
        generation: 0,
        attempts: 0,
        target: null
    };

    function normalizedText(element) {

        return String(
            element &&
            element.textContent
                ? element.textContent
                : ''
        )
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function controls() {

        return Array.from(
            document.querySelectorAll(
                'button,a,[role="button"]'
            )
        );
    }

    function findControl(label) {

        const needle =
            String(label)
                .trim()
                .toLowerCase();

        return controls().find(
            function (element) {

                return (
                    normalizedText(element)
                        .indexOf(needle)
                    !==
                    -1
                );
            }
        ) || null;
    }

    function findChartTab() {

        return controls().find(
            function (element) {

                const value =
                    normalizedText(element);

                return (
                    value ===
                        'chart of accounts'
                    ||
                    value.indexOf(
                        'chart of accounts '
                    ) === 0
                );
            }
        ) || null;
    }

    function visible(element) {

        if (!element) {
            return false;
        }

        const style =
            window.getComputedStyle(
                element
            );

        const rect =
            element
                .getBoundingClientRect();

        return (
            style.display !== 'none'
            &&
            style.visibility !== 'hidden'
            &&
            Number(
                style.opacity || '1'
            ) > 0
            &&
            rect.width > 20
            &&
            rect.height > 20
            &&
            rect.right > 0
            &&
            rect.bottom > 0
            &&
            rect.left < window.innerWidth
            &&
            rect.top < window.innerHeight
        );
    }

    function baseRuntime() {

        return (
            window
                .__AQUILA_FINANCE_COA_F3_R4__
            ||
            null
        );
    }

    function findTarget() {

        const journal =
            findControl(
                'new journal entry'
            );

        const dashboard =
            findControl(
                'main dashboard'
            );

        if (
            journal
            &&
            dashboard
            &&
            journal.parentElement
            &&
            journal.parentElement ===
                dashboard.parentElement
        ) {

            return {
                parent:
                    journal.parentElement,

                before:
                    journal,

                name:
                    'ACCOUNTING_HEADER_ACTIONS'
            };
        }

        if (
            journal
            &&
            journal.parentElement
        ) {

            return {
                parent:
                    journal.parentElement,

                before:
                    journal,

                name:
                    'NEW_JOURNAL_ACTION_GROUP'
            };
        }

        if (
            dashboard
            &&
            dashboard.parentElement
        ) {

            return {
                parent:
                    dashboard.parentElement,

                before:
                    dashboard,

                name:
                    'MAIN_DASHBOARD_ACTION_GROUP'
            };
        }

        const closeBooks =
            findControl(
                'open close books'
            );

        if (
            closeBooks
            &&
            closeBooks.parentElement
        ) {

            return {
                parent:
                    closeBooks.parentElement,

                before:
                    closeBooks,

                name:
                    'CLOSE_BOOKS_ACTION_GROUP'
            };
        }

        return null;
    }

    function createLauncher() {

        const button =
            document.createElement(
                'button'
            );

        button.id =
            NATIVE_ID;

        button.type =
            'button';

        button.className =
            'aquila-f3-r4-3-r4-native-launcher';

        button.setAttribute(
            'aria-label',
            'Open Pharmacy Advanced Chart of Accounts'
        );

        button.innerHTML =
            '<span class="aquila-f3-r4-3-r4-icon" aria-hidden="true">COA</span>' +
            '<span class="aquila-f3-r4-3-r4-copy">' +
                '<strong>Pharmacy Advanced COA</strong>' +
                '<small>75 accounts &middot; 74 mappings</small>' +
            '</span>';

        button.addEventListener(
            'click',
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                const runtime =
                    baseRuntime();

                if (
                    runtime
                    &&
                    typeof runtime.open ===
                        'function'
                ) {

                    runtime.open();
                }
            }
        );

        return button;
    }

    function mountLauncher() {

        state.attempts += 1;

        const destination =
            findTarget();

        if (!destination) {

            state.target =
                null;

            return false;
        }

        let launcher =
            document.getElementById(
                NATIVE_ID
            );

        if (!launcher) {

            launcher =
                createLauncher();
        }

        if (
            launcher.parentElement !==
                destination.parent
            ||
            launcher.nextElementSibling !==
                destination.before
        ) {

            destination.parent.insertBefore(
                launcher,
                destination.before
            );
        }

        state.target =
            destination.name;

        return true;
    }

    function mountBadge() {

        const tab =
            findChartTab();

        if (!tab) {
            return false;
        }

        let badge =
            tab.querySelector(
                '.' +
                BADGE_CLASS
            );

        if (!badge) {

            badge =
                document.createElement(
                    'span'
                );

            badge.className =
                BADGE_CLASS;

            badge.textContent =
                'Advanced';

            badge.setAttribute(
                'aria-hidden',
                'true'
            );

            tab.appendChild(
                badge
            );
        }

        return true;
    }

    function integrate() {

        mountLauncher();
        mountBadge();
    }

    function schedule() {

        state.generation += 1;

        const generation =
            state.generation;

        [
            0,
            120,
            350,
            800,
            1600,
            3200,
            6500
        ].forEach(
            function (delay) {

                window.setTimeout(
                    function () {

                        if (
                            generation !==
                            state.generation
                        ) {
                            return;
                        }

                        integrate();
                    },
                    delay
                );
            }
        );
    }

    document.addEventListener(
        'click',
        schedule,
        true
    );

    window.addEventListener(
        'popstate',
        schedule
    );

    window.addEventListener(
        'hashchange',
        schedule
    );

    window.addEventListener(
        'pageshow',
        schedule
    );

    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            schedule,
            {
                once: true
            }
        );

    } else {

        schedule();
    }

    window.__AQUILA_FINANCE_COA_F3_R4_3__ = {

        release:
            RELEASE,

        refresh:
            function () {

                integrate();

                return this.diagnose();
            },

        open:
            function () {

                integrate();

                const runtime =
                    baseRuntime();

                if (
                    runtime
                    &&
                    typeof runtime.open ===
                        'function'
                ) {

                    runtime.open();

                    return true;
                }

                return false;
            },

        diagnose:
            function () {

                const launcher =
                    document.getElementById(
                        NATIVE_ID
                    );

                const runtime =
                    baseRuntime();

                const base =
                    (
                        runtime
                        &&
                        typeof runtime.diagnose ===
                            'function'
                    )
                        ? runtime.diagnose()
                        : null;

                return {

                    release:
                        RELEASE,

                    baseRuntimeLoaded:
                        Boolean(runtime),

                    accountingVisible:
                        base
                            ? base.accountingVisible
                            : null,

                    nativeLauncherMounted:
                        Boolean(launcher),

                    nativeLauncherVisible:
                        visible(launcher),

                    nativeLauncherTarget:
                        state.target,

                    badgeMounted:
                        Boolean(
                            document.querySelector(
                                '.' +
                                BADGE_CLASS
                            )
                        ),

                    workspaceMounted:
                        base
                            ? base.workspaceMounted
                            : false,

                    workspaceOpen:
                        base
                            ? base.workspaceOpen
                            : false,

                    accountCount:
                        base
                            ? base.accountCount
                            : 0,

                    mappingCount:
                        base
                            ? base.mappingCount
                            : 0,

                    loadError:
                        base
                            ? base.loadError
                            : null,

                    integrationAttempts:
                        state.attempts,

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
    };
})();

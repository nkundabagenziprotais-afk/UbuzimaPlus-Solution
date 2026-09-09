/*
 * AQUILA_MENU_DECK_V7_FLOW_BOUNDARY_R9
 *
 * Exact browser-proven Deck owner:
 *
 * nav.ubuzima-workspace-dock-v5
 * [data-ubuzima-workspace-dock-v5=
 *  "UBIZIMA_CONTINUOUS_MAC_WORKSPACE_DOCK_V7"]
 *
 * Responsibility:
 *   1. Keep the actual V7 Deck top-center.
 *   2. Reserve Header space outside the React application root.
 *
 * It does NOT:
 *   - query Payroll
 *   - query HRM
 *   - query Finance
 *   - query Dashboard
 *   - move module surfaces
 *   - add margins to module pages
 *   - style body/html/#root
 */

(() => {
    'use strict';

    const RELEASE =
        'AQUILA-MENU-DECK-V7-FLOW-BOUNDARY-R9';

    const BUILD =
        'UBIZIMA_CONTINUOUS_MAC_WORKSPACE_DOCK_V7';

    const PREFERRED_SELECTOR =
        'nav.ubuzima-workspace-dock-v5' +
        '[data-ubuzima-workspace-dock-v5="' +
        BUILD +
        '"]';

    const FALLBACK_SELECTOR =
        'nav.ubuzima-workspace-dock-v5' +
        '[data-ubuzima-workspace-dock-v5]';

    const DECK_SELECTOR =
        PREFERRED_SELECTOR +
        ',' +
        FALLBACK_SELECTOR;

    const LANE_ID =
        'aquila-menu-deck-header-lane-r9';

    const GAP_PX = 16;
    const MAX_LANE_PX = 240;

    let frame = 0;

    let activeDeck = null;

    let deckAttributeObserver = null;
    let deckResizeObserver = null;
    let mountObserver = null;

    const API = {
        release: RELEASE,
        last: null,
        apply,
        diagnose
    };


    function applicationRoot() {
        return document.getElementById(
            'root'
        );
    }


    function findDeck() {
        return (
            document.querySelector(
                PREFERRED_SELECTOR
            )
            ||
            document.querySelector(
                FALLBACK_SELECTOR
            )
        );
    }


    function visible(element) {
        if (!(element instanceof Element)) {
            return false;
        }

        const rect =
            element.getBoundingClientRect();

        if (
            rect.width <= 0
            ||
            rect.height <= 0
        ) {
            return false;
        }

        const style =
            window.getComputedStyle(
                element
            );

        return (
            style.display !== 'none'
            &&
            style.visibility !== 'hidden'
            &&
            Number(
                style.opacity || '1'
            ) > 0
        );
    }


    function desiredTop() {
        return (
            window.innerWidth <= 767
                ? 6
                : 10
        );
    }


    function setImportant(
        element,
        property,
        value
    ) {
        const style =
            element.style;

        if (
            style.getPropertyValue(
                property
            ) === value
            &&
            style.getPropertyPriority(
                property
            ) === 'important'
        ) {
            return;
        }

        style.setProperty(
            property,
            value,
            'important'
        );
    }


    function enforceDeckGeometry(
        deck
    ) {
        if (!(deck instanceof Element)) {
            return;
        }

        if (
            deck.getAttribute(
                'data-aquila-deck-r9'
            ) !== '1'
        ) {
            deck.setAttribute(
                'data-aquila-deck-r9',
                '1'
            );
        }

        /*
         * Set shorthand first.
         * Longhands afterwards are authoritative.
         */
        setImportant(
            deck,
            'position',
            'fixed'
        );

        setImportant(
            deck,
            'inset',
            'auto'
        );

        setImportant(
            deck,
            'top',
            `${desiredTop()}px`
        );

        setImportant(
            deck,
            'right',
            'auto'
        );

        setImportant(
            deck,
            'bottom',
            'auto'
        );

        setImportant(
            deck,
            'left',
            '50%'
        );

        setImportant(
            deck,
            'transform',
            'translateX(-50%)'
        );
    }


    function ensureLane() {
        const root =
            applicationRoot();

        if (
            !root
            ||
            !root.parentNode
        ) {
            return null;
        }

        let lane =
            document.getElementById(
                LANE_ID
            );

        if (!lane) {
            lane =
                document.createElement(
                    'div'
                );

            lane.id =
                LANE_ID;

            lane.setAttribute(
                'aria-hidden',
                'true'
            );

            lane.setAttribute(
                'data-aquila-deck-lane',
                'r9'
            );
        }

        /*
         * The lane must be immediately before the app root.
         *
         * We do not style or reposition #root itself.
         */
        if (
            lane.parentNode !==
                root.parentNode
            ||
            lane.nextSibling !== root
        ) {
            root.parentNode.insertBefore(
                lane,
                root
            );
        }

        return lane;
    }


    function currentLaneHeight(
        lane
    ) {
        const value =
            Number.parseFloat(
                window
                    .getComputedStyle(
                        lane
                    )
                    .height
                ||
                '0'
            );

        return Number.isFinite(value)
            ? value
            : 0;
    }


    function setLaneHeight(
        lane,
        value
    ) {
        const bounded =
            Math.max(
                0,
                Math.min(
                    MAX_LANE_PX,
                    Math.ceil(value)
                )
            );

        const px =
            `${bounded}px`;

        setImportant(
            lane,
            'height',
            px
        );

        setImportant(
            lane,
            'min-height',
            px
        );

        setImportant(
            lane,
            'flex-basis',
            px
        );

        lane.setAttribute(
            'data-aquila-deck-lane-height',
            String(bounded)
        );

        return bounded;
    }


    function reserveHeaderFlow(
        deck,
        lane,
        root
    ) {
        if (
            !deck
            ||
            !visible(deck)
        ) {
            const laneHeight =
                setLaneHeight(
                    lane,
                    0
                );

            return {
                deckVisible: false,
                laneHeight,
                deckTop: null,
                deckBottom: null,
                rootDocumentTop:
                    root
                        .getBoundingClientRect()
                        .top
                    +
                    window.scrollY,
                gap: null
            };
        }

        const deckRect =
            deck.getBoundingClientRect();

        const previousLaneHeight =
            currentLaneHeight(
                lane
            );

        /*
         * Convert #root's current viewport position
         * to a stable document coordinate.
         *
         * Subtract the current lane height to recover
         * the application's natural starting point.
         *
         * This prevents scrolling from inflating the
         * lane on later route/navigation events.
         */
        const rootDocumentTop =
            root
                .getBoundingClientRect()
                .top
            +
            window.scrollY;

        const baseRootDocumentTop =
            rootDocumentTop
            -
            previousLaneHeight;

        const requiredRootTop =
            deckRect.bottom
            +
            GAP_PX;

        const requiredLaneHeight =
            Math.max(
                0,
                requiredRootTop
                -
                baseRootDocumentTop
            );

        const laneHeight =
            setLaneHeight(
                lane,
                requiredLaneHeight
            );

        /*
         * Force layout once after lane adjustment
         * so diagnostics report browser reality.
         */
        const finalRootDocumentTop =
            root
                .getBoundingClientRect()
                .top
            +
            window.scrollY;

        return {
            deckVisible: true,

            laneHeight,

            deckTop:
                Math.round(
                    deckRect.top
                ),

            deckBottom:
                Math.round(
                    deckRect.bottom
                ),

            rootDocumentTop:
                Math.round(
                    finalRootDocumentTop
                ),

            gap:
                Math.round(
                    finalRootDocumentTop
                    -
                    deckRect.bottom
                )
        };
    }


    function geometryIsCorrect(
        deck
    ) {
        if (
            !deck
            ||
            !visible(deck)
        ) {
            return true;
        }

        const style =
            window.getComputedStyle(
                deck
            );

        const rect =
            deck.getBoundingClientRect();

        return (
            style.position === 'fixed'
            &&
            Math.abs(
                rect.top
                -
                desiredTop()
            ) <= 2
            &&
            Math.abs(
                (
                    rect.left
                    +
                    rect.width / 2
                )
                -
                window.innerWidth / 2
            ) <= 3
        );
    }


    function disconnectDeckObservers() {
        if (
            deckAttributeObserver
        ) {
            deckAttributeObserver
                .disconnect();

            deckAttributeObserver =
                null;
        }

        if (
            deckResizeObserver
        ) {
            deckResizeObserver
                .disconnect();

            deckResizeObserver =
                null;
        }
    }


    function observeDeck(
        deck
    ) {
        if (
            activeDeck === deck
            &&
            deckAttributeObserver
        ) {
            return;
        }

        disconnectDeckObservers();

        activeDeck =
            deck || null;

        if (!activeDeck) {
            return;
        }

        /*
         * Only observe the actual Deck element.
         *
         * If another runtime later writes bottom/top
         * positioning to the Deck itself, R9 reasserts
         * Deck ownership without touching that module.
         */
        deckAttributeObserver =
            new MutationObserver(
                () => {
                    schedule();
                }
            );

        deckAttributeObserver
            .observe(
                activeDeck,
                {
                    attributes: true,
                    attributeFilter: [
                        'style',
                        'class',
                        'data-ubuzima-workspace-dock-v5'
                    ]
                }
            );

        if (
            typeof ResizeObserver !==
            'undefined'
        ) {
            deckResizeObserver =
                new ResizeObserver(
                    () => {
                        schedule();
                    }
                );

            deckResizeObserver
                .observe(
                    activeDeck
                );
        }
    }


    function nodeTouchesDeck(
        node
    ) {
        if (
            !(node instanceof Element)
        ) {
            return false;
        }

        if (
            node.matches(
                DECK_SELECTOR
            )
        ) {
            return true;
        }

        return Boolean(
            node.querySelector(
                DECK_SELECTOR
            )
        );
    }


    function installMountObserver() {
        if (mountObserver) {
            return;
        }

        mountObserver =
            new MutationObserver(
                mutations => {
                    let relevant = false;

                    for (
                        const mutation
                        of mutations
                    ) {
                        for (
                            const node
                            of mutation.addedNodes
                        ) {
                            if (
                                nodeTouchesDeck(
                                    node
                                )
                            ) {
                                relevant = true;
                                break;
                            }
                        }

                        if (relevant) {
                            break;
                        }

                        for (
                            const node
                            of mutation.removedNodes
                        ) {
                            if (
                                activeDeck
                                &&
                                node instanceof Element
                                &&
                                (
                                    node === activeDeck
                                    ||
                                    node.contains(
                                        activeDeck
                                    )
                                )
                            ) {
                                relevant = true;
                                break;
                            }
                        }

                        if (relevant) {
                            break;
                        }
                    }

                    if (relevant) {
                        schedule();
                    }
                }
            );

        mountObserver.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );
    }


    function apply() {
        const root =
            applicationRoot();

        if (!root) {
            API.last = {
                release: RELEASE,
                applied: false,
                reason:
                    'application-root-not-found',
                at:
                    new Date()
                        .toISOString()
            };

            return false;
        }

        const lane =
            ensureLane();

        if (!lane) {
            API.last = {
                release: RELEASE,
                applied: false,
                reason:
                    'header-lane-not-available',
                at:
                    new Date()
                        .toISOString()
            };

            return false;
        }

        const deck =
            findDeck();

        if (
            deck !== activeDeck
        ) {
            observeDeck(
                deck
            );
        }

        if (!deck) {
            const laneHeight =
                setLaneHeight(
                    lane,
                    0
                );

            API.last = {
                release: RELEASE,
                applied: false,
                deckFound: false,
                laneHeight,
                reason:
                    'exact-v5-v7-deck-not-found',
                at:
                    new Date()
                        .toISOString()
            };

            return false;
        }

        enforceDeckGeometry(
            deck
        );

        const flow =
            reserveHeaderFlow(
                deck,
                lane,
                root
            );

        API.last = {
            release: RELEASE,

            applied: true,

            deckFound: true,

            deckBuild:
                deck.getAttribute(
                    'data-ubuzima-workspace-dock-v5'
                ),

            desiredTop:
                desiredTop(),

            ...flow,

            at:
                new Date()
                    .toISOString()
        };

        return true;
    }


    function diagnose() {
        apply();

        const root =
            applicationRoot();

        const lane =
            document.getElementById(
                LANE_ID
            );

        const deck =
            findDeck();

        const out = {
            release: RELEASE,

            exactSelector:
                PREFERRED_SELECTOR,

            deckFound:
                Boolean(deck),

            deckVisible:
                Boolean(
                    deck
                    &&
                    visible(deck)
                ),

            deckBuild:
                deck
                    ? deck.getAttribute(
                        'data-ubuzima-workspace-dock-v5'
                    )
                    : null,

            laneFound:
                Boolean(lane),

            laneHeight:
                lane
                    ? Math.round(
                        currentLaneHeight(
                            lane
                        )
                    )
                    : null,

            rootFound:
                Boolean(root),

            last:
                API.last
        };

        if (
            deck
            &&
            visible(deck)
        ) {
            const style =
                window.getComputedStyle(
                    deck
                );

            const rect =
                deck.getBoundingClientRect();

            const rootDocumentTop =
                root
                    ? (
                        root
                            .getBoundingClientRect()
                            .top
                        +
                        window.scrollY
                    )
                    : null;

            out.deckPosition =
                style.position;

            out.deckComputedTop =
                style.top;

            out.deckComputedBottom =
                style.bottom;

            out.deckRect = {
                top:
                    Math.round(
                        rect.top
                    ),

                right:
                    Math.round(
                        rect.right
                    ),

                bottom:
                    Math.round(
                        rect.bottom
                    ),

                left:
                    Math.round(
                        rect.left
                    ),

                width:
                    Math.round(
                        rect.width
                    ),

                height:
                    Math.round(
                        rect.height
                    )
            };

            out.rootDocumentTop =
                rootDocumentTop === null
                    ? null
                    : Math.round(
                        rootDocumentTop
                    );

            out.clearanceGap =
                rootDocumentTop === null
                    ? null
                    : Math.round(
                        rootDocumentTop
                        -
                        rect.bottom
                    );

            out.geometryCorrect =
                geometryIsCorrect(
                    deck
                );

            out.clearanceStatus =
                (
                    out.geometryCorrect
                    &&
                    out.clearanceGap !== null
                    &&
                    out.clearanceGap >= 12
                )
                    ? 'PASS'
                    : 'FAIL';
        } else {
            /*
             * On device classes where the application
             * intentionally suppresses this Deck,
             * R9 must not force it visible.
             */
            out.clearanceStatus =
                deck
                    ? 'DECK_HIDDEN_BY_APPLICATION'
                    : 'DECK_NOT_FOUND';
        }

        return out;
    }


    function schedule() {
        if (frame) {
            cancelAnimationFrame(
                frame
            );
        }

        frame =
            requestAnimationFrame(
                () => {
                    frame =
                        requestAnimationFrame(
                            () => {
                                frame = 0;
                                apply();
                            }
                        );
                }
            );
    }


    window.__AQUILA_DECK_R9__ =
        API;


    installMountObserver();


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


    window.addEventListener(
        'load',
        schedule,
        {
            once: true
        }
    );


    window.addEventListener(
        'pageshow',
        schedule
    );


    window.addEventListener(
        'hashchange',
        schedule
    );


    window.addEventListener(
        'popstate',
        schedule
    );


    window.addEventListener(
        'resize',
        schedule,
        {
            passive: true
        }
    );


    window.addEventListener(
        'orientationchange',
        schedule,
        {
            passive: true
        }
    );


    /*
     * Recheck after actual Deck navigation only.
     * Module clicks are not globally monitored.
     */
    document.addEventListener(
        'click',
        event => {
            const target =
                event.target instanceof Element
                    ? event.target
                    : null;

            if (
                target
                &&
                target.closest(
                    DECK_SELECTOR
                )
            ) {
                schedule();
            }
        },
        true
    );
})();

/* ==========================================================================
 * AQUILA R64 — EXPENSE MOBILE FUNCTIONAL ROUTING + APP FORM PRESENTATION
 *
 * Scope:
 * - Mobile Expense actions only.
 * - No loading changes.
 * - No scrolling ownership changes.
 * - No backend/API changes.
 * - Existing R218 controlled Expense form remains system truth.
 * ========================================================================== */
(() => {
    "use strict";

    const RELEASE =
        "AQUILA_EXPENSE_MOBILE_REPAIR_R64";

    if (
        window.__AQUILA_EXPENSE_MOBILE_REPAIR_R64__
        ?.release === RELEASE
    ) {
        return;
    }

    const ROOT_ATTR =
        "data-aquila-expense-mobile-r64";

    const state = {
        recordRoutes: 0,
        approvalRoutes: 0,
        itemSurfaceMarks: 0,
        bridgeMisses: 0,
    };

    function normalize(value) {
        return String(
            value || ""
        )
            .replace(
                /\u00a0/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    function mobile() {
        return Boolean(
            window.matchMedia
            &&
            window.matchMedia(
                "(max-width: 900px)"
            ).matches
        );
    }

    function controlFromEvent(event) {
        const target =
            event.target instanceof Element
                ? event.target
                : null;

        if (!target) {
            return null;
        }

        return target.closest(
            "button,a,[role='button'],[role='tab']"
        );
    }

    function actionOf(control) {
        if (!control) {
            return "";
        }

        const explicit =
            normalize(
                control.getAttribute(
                    "data-expense-mode"
                )
                ||
                control.getAttribute(
                    "data-expense-action"
                )
                ||
                control.getAttribute(
                    "data-action"
                )
            ).toLowerCase();

        if (
            explicit === "record"
            ||
            explicit === "create-expense"
            ||
            explicit === "record-expense"
        ) {
            return "record";
        }

        if (
            explicit === "approve"
            ||
            explicit === "approve-expense"
            ||
            explicit === "expense-approval"
        ) {
            return "approve";
        }

        const text =
            normalize(
                control.textContent
            );

        if (
            /^(record|new|create)\s+expense$/i
                .test(
                    text
                )
        ) {
            return "record";
        }

        if (
            /^(approve\s+expense|expense\s+approvals?|approval\s+queue)$/i
                .test(
                    text
                )
        ) {
            return "approve";
        }

        if (
            /^(expense\s+item|expense\s+items)$/i
                .test(
                    text
                )
        ) {
            return "items";
        }

        return "";
    }

    function markExpenseSurface() {
        document.documentElement
            .setAttribute(
                ROOT_ATTR,
                "1"
            );
    }

    function openRecordExpense() {
        const bridge =
            window
                .__AQUILA_FINANCE_EXPENSES_R18__;

        if (
            bridge
            &&
            typeof bridge.openRecordExpense
                === "function"
        ) {
            markExpenseSurface();
            state.recordRoutes += 1;
            bridge.openRecordExpense();
            return true;
        }

        state.bridgeMisses += 1;
        return false;
    }

    function openApprovalQueue() {
        const bridge =
            window
                .__AQUILA_FINANCE_EXPENSES_R4B1_1__;

        if (
            bridge
            &&
            typeof bridge.openQueue
                === "function"
        ) {
            markExpenseSurface();
            state.approvalRoutes += 1;
            bridge.openQueue();
            return true;
        }

        state.bridgeMisses += 1;
        return false;
    }

    document.addEventListener(
        "click",
        event => {
            if (!mobile()) {
                return;
            }

            const control =
                controlFromEvent(
                    event
                );

            const action =
                actionOf(
                    control
                );

            if (!action) {
                return;
            }

            if (action === "items") {
                markExpenseSurface();
                state.itemSurfaceMarks += 1;
                return;
            }

            let succeeded = false;

            if (action === "record") {
                succeeded =
                    openRecordExpense();
            } else if (
                action === "approve"
            ) {
                succeeded =
                    openApprovalQueue();
            }

            if (!succeeded) {
                return;
            }

            /*
             * Only the matched Expense action is intercepted.
             * No scroll/touch/wheel event is affected.
             */
            event.preventDefault();
            event.stopImmediatePropagation();
        },
        true
    );

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "aquila-expense-mobile-r64-style";

    style.textContent = `
@media (max-width: 900px) {
  html[${ROOT_ATTR}="1"] [class*="r217-"] form,
  html[${ROOT_ATTR}="1"] form[class*="r217-"],
  html[${ROOT_ATTR}="1"] [class*="r218-"] form,
  html[${ROOT_ATTR}="1"] form[class*="r218-"],
  html[${ROOT_ATTR}="1"] [data-expense-item-form] {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 16px 16px calc(104px + env(safe-area-inset-bottom));
    box-sizing: border-box;
  }

  html[${ROOT_ATTR}="1"] [class*="r217-"] input,
  html[${ROOT_ATTR}="1"] [class*="r217-"] select,
  html[${ROOT_ATTR}="1"] [class*="r217-"] textarea,
  html[${ROOT_ATTR}="1"] [class*="r218-"] input,
  html[${ROOT_ATTR}="1"] [class*="r218-"] select,
  html[${ROOT_ATTR}="1"] [class*="r218-"] textarea,
  html[${ROOT_ATTR}="1"] [data-expense-item-form] input,
  html[${ROOT_ATTR}="1"] [data-expense-item-form] select,
  html[${ROOT_ATTR}="1"] [data-expense-item-form] textarea {
    width: 100%;
    min-height: 52px;
    box-sizing: border-box;
    border-radius: 14px;
    font-size: 16px;
  }

  html[${ROOT_ATTR}="1"] [class*="r217-"] textarea,
  html[${ROOT_ATTR}="1"] [class*="r218-"] textarea,
  html[${ROOT_ATTR}="1"] [data-expense-item-form] textarea {
    min-height: 104px;
    resize: vertical;
  }

  html[${ROOT_ATTR}="1"] .r217-help {
    line-height: 1.45;
    margin: 4px 0 16px;
  }

  html[${ROOT_ATTR}="1"] .r217-kv {
    padding: 13px 0;
  }

  html[${ROOT_ATTR}="1"] [class*="r218-item"] {
    box-sizing: border-box;
  }

  html[${ROOT_ATTR}="1"] button[class*="r217-"],
  html[${ROOT_ATTR}="1"] button[class*="r218-"],
  html[${ROOT_ATTR}="1"] [data-expense-item-form] button {
    min-height: 48px;
    border-radius: 14px;
    touch-action: manipulation;
  }

  html[${ROOT_ATTR}="1"] .r218-item-category {
    display: block;
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.3;
  }
}
`;

    (
        document.head
        ||
        document.documentElement
    ).appendChild(
        style
    );

    window.__AQUILA_EXPENSE_MOBILE_REPAIR_R64__ =
        Object.freeze({
            release:
                RELEASE,

            diagnose() {
                return {
                    release:
                        RELEASE,

                    mobile:
                        mobile(),

                    recordBridge:
                        Boolean(
                            window
                                .__AQUILA_FINANCE_EXPENSES_R18__
                            &&
                            typeof window
                                .__AQUILA_FINANCE_EXPENSES_R18__
                                .openRecordExpense
                                ===
                                "function"
                        ),

                    approvalBridge:
                        Boolean(
                            window
                                .__AQUILA_FINANCE_EXPENSES_R4B1_1__
                            &&
                            typeof window
                                .__AQUILA_FINANCE_EXPENSES_R4B1_1__
                                .openQueue
                                ===
                                "function"
                        ),

                    surfaceMarked:
                        document.documentElement
                            .getAttribute(
                                ROOT_ATTR
                            )
                            ===
                            "1",

                    ...state,
                };
            },
        });
})();

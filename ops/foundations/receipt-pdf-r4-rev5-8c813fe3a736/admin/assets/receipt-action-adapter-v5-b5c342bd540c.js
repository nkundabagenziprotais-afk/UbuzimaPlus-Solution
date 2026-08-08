(() => {
    "use strict";

    const VERSION =
        "2026.08.receipt-isolated-adapter-v5-live-context";

    if (
        window.__ubuzimaReceiptIsolatedAdapterV5
    ) {
        return;
    }

    window.__ubuzimaReceiptIsolatedAdapterV5 =
        VERSION;

    function getReactHandler(element) {
        const key =
            element &&
            Object.keys(element).find(
                name =>
                    name.startsWith(
                        "__reactProps$"
                    )
            );

        if (!key) {
            return null;
        }

        const props = element[key];

        return (
            typeof props?.onClick === "function"
        )
            ? props.onClick
            : null;
    }

    function parseJson(raw) {
        if (!raw) {
            return null;
        }

        try {
            return JSON.parse(raw);
        } catch (_) {
            return null;
        }
    }

    function storageValue(storage, key) {
        try {
            return storage.getItem(key);
        } catch (_) {
            return null;
        }
    }

    function first(...values) {
        for (const value of values) {
            if (
                value !== undefined &&
                value !== null &&
                String(value).trim() !== ""
            ) {
                return value;
            }
        }

        return null;
    }

    function authSession() {
        for (const storage of [
            window.localStorage,
            window.sessionStorage,
        ]) {
            const parsed =
                parseJson(
                    storageValue(
                        storage,
                        "ubuzima_admin_session"
                    )
                );

            if (parsed) {
                return parsed;
            }
        }

        return null;
    }

    function authToken() {
        const session = authSession();

        return first(
            session?.token,
            session?.access_token,
            session?.accessToken,

            storageValue(
                window.localStorage,
                "ubuzima.token"
            ),

            storageValue(
                window.sessionStorage,
                "ubuzima.token"
            ),

            storageValue(
                window.localStorage,
                "access_token"
            ),

            storageValue(
                window.sessionStorage,
                "access_token"
            )
        );
    }

    function slugFromProfile(profile) {
        return first(
            profile
                ?.tenant_assignments
                ?.[0]
                ?.tenant
                ?.slug,

            profile
                ?.tenant
                ?.slug,

            profile
                ?.scope
                ?.tenant_slug
        );
    }

    function existingTenantSlug() {
        const session = authSession();

        return first(
            storageValue(
                window.sessionStorage,
                "ubuzima.currentTenantSlug"
            ),

            storageValue(
                window.localStorage,
                "ubuzima.currentTenantSlug"
            ),

            storageValue(
                window.sessionStorage,
                "pharmaco.tenantSlug"
            ),

            storageValue(
                window.localStorage,
                "pharmaco.tenantSlug"
            ),

            slugFromProfile(
                session?.profile
            ),

            slugFromProfile(
                session?.user
            )
        );
    }

    function persistTenantSlug(slug) {
        if (!slug) {
            return;
        }

        /*
         * These are the exact keys the
         * existing receipt helper understands.
         */
        try {
            window.sessionStorage.setItem(
                "ubuzima.currentTenantSlug",
                String(slug)
            );

            window.sessionStorage.setItem(
                "pharmaco.tenantSlug",
                String(slug)
            );
        } catch (_) {}

        console.log(
            "Ubuzima receipt tenant ready:",
            slug
        );
    }

    async function ensureTenantSlug() {
        const existing =
            existingTenantSlug();

        if (existing) {
            persistTenantSlug(existing);

            return String(existing);
        }

        const token =
            authToken();

        if (!token) {
            throw new Error(
                "Authenticated session is unavailable."
            );
        }

        /*
         * Ask the existing authenticated profile
         * endpoint for the same tenant used by POS.
         */
        const response =
            await fetch(
                "/api/v1/auth/me",
                {
                    method: "GET",

                    headers: {
                        Accept:
                            "application/json",

                        Authorization:
                            `Bearer ${token}`
                    },

                    credentials:
                        "same-origin",

                    cache:
                        "no-store"
                }
            );

        let payload = null;

        try {
            payload =
                await response.json();
        } catch (_) {
            payload = null;
        }

        if (!response.ok) {
            throw new Error(
                payload?.message ||
                "Unable to resolve receipt tenant."
            );
        }

        const profile =
            payload?.profile ??
            payload;

        const slug =
            slugFromProfile(profile);

        if (!slug) {
            throw new Error(
                "Authenticated tenant could not be resolved."
            );
        }

        persistTenantSlug(slug);

        return String(slug);
    }

    function scalar(value) {
        return (
            typeof value === "string" ||
            typeof value === "number"
        )
            ? value
            : null;
    }

    function cleanContext(context) {
        const saleId =
            scalar(
                context?.saleMeta?.id
            ) ??
            scalar(
                context?.saleMeta?.sale_id
            ) ??
            scalar(
                context?.payment?.sale_id
            ) ??
            scalar(
                context?.payment?.sale?.id
            );

        const saleNumber =
            scalar(
                context
                    ?.saleMeta
                    ?.sale_number
            ) ??
            scalar(
                context
                    ?.payment
                    ?.sale_number
            );

        const receiptNumber =
            scalar(
                context
                    ?.payment
                    ?.receipt_number
            );

        return {
            sale: {
                id: saleId
            },

            saleMeta: {
                id: saleId,
                sale_id: saleId,
                sale_number:
                    saleNumber
            },

            payment: {
                sale_id: saleId,
                receipt_number:
                    receiptNumber
            }
        };
    }

    async function openReceipt(
        handler
    ) {
        const realApi =
            window.UbuzimaReceipt;

        if (
            !realApi ||
            typeof realApi.openReceipt !==
                "function"
        ) {
            throw new Error(
                "Receipt popup API is unavailable."
            );
        }

        let captured = null;

        const captureApi = {
            ...realApi,

            openReceipt(context) {
                captured = context;

                return true;
            }
        };

        /*
         * Preserve the already-working V3
         * workaround for the bad minified `it`
         * reference.
         */
        const hadIt =
            Object.prototype
                .hasOwnProperty
                .call(window, "it");

        const previousIt =
            window.it;

        const dummySale = {};

        window.it =
            dummySale;

        try {
            window.__ubuzimaReceiptDummySale =
                dummySale;

            window.eval(
                "var it = " +
                "window.__ubuzimaReceiptDummySale;"
            );
        } catch (_) {}

        window.UbuzimaReceipt =
            captureApi;

        try {
            handler();
        } finally {
            window.UbuzimaReceipt =
                realApi;

            if (hadIt) {
                window.it =
                    previousIt;
            } else {
                window.it =
                    undefined;
            }

            try {
                delete window
                    .__ubuzimaReceiptDummySale;
            } catch (_) {}
        }

        if (!captured) {
            throw new Error(
                "Completed-sale context was not captured."
            );
        }

        const context =
            cleanContext(captured);

        if (!context.sale.id) {
            throw new Error(
                "Completed sale ID is missing."
            );
        }

        /*
         * THIS IS THE V4 FIX:
         *
         * make the real authenticated POS tenant
         * available to the existing receipt helper
         * before its invoice fetch executes.
         */
        const tenantSlug =
            await ensureTenantSlug();

        console.log(
            "Ubuzima receipt V5:",
            {
                saleId:
                    context.sale.id,

                saleNumber:
                    context
                        .saleMeta
                        .sale_number,

                receiptNumber:
                    context
                        .payment
                        .receipt_number,

                tenantSlug
            }
        );

        return realApi.openReceipt(
            context
        );
    }

    function bind() {
        document
            .querySelectorAll(
                ".pos-print-receipt-button"
            )
            .forEach(original => {
                if (
                    original.dataset
                        .ubuzimaReceiptV5Source
                    === "1"
                ) {
                    return;
                }

                const handler =
                    getReactHandler(
                        original
                    );

                if (
                    typeof handler !==
                    "function"
                ) {
                    return;
                }

                original.dataset
                    .ubuzimaReceiptV5Source =
                    "1";

                const button =
                    original.cloneNode(true);

                button.removeAttribute(
                    "disabled"
                );

                button.disabled = false;

                button.dataset
                    .ubuzimaReceiptSafeButton =
                    "v4";

                button.style.pointerEvents =
                    "auto";

                button.style.cursor =
                    "pointer";

                button.addEventListener(
                    "click",
                    async event => {
                        event.preventDefault();

                        try {
                            const liveSource =
                                (
                                    original.isConnected &&
                                    typeof getReactHandler(
                                        original
                                    ) === "function"
                                )
                                    ? original
                                    : Array.from(
                                        document.querySelectorAll(
                                            ".pos-print-receipt-button"
                                        )
                                    ).find(
                                        candidate =>
                                            !candidate.dataset
                                                .ubuzimaReceiptSafeButton &&
                                            typeof getReactHandler(
                                                candidate
                                            ) === "function"
                                    );

                            const liveHandler =
                                getReactHandler(
                                    liveSource
                                );

                            if (
                                typeof liveHandler !==
                                    "function"
                            ) {
                                throw new Error(
                                    "Current completed-sale handler is unavailable."
                                );
                            }

                            await openReceipt(
                                liveHandler
                            );
                        } catch (error) {
                            console.error(
                                "Ubuzima receipt V5:",
                                error
                            );

                            window.alert(
                                "Receipt could not be opened: "
                                + (
                                    error?.message ||
                                    "unknown error"
                                )
                            );
                        }
                    }
                );

                original.style.display =
                    "none";

                original
                    .insertAdjacentElement(
                        "afterend",
                        button
                    );
            });
    }

    bind();

    const timer =
        window.setInterval(
            bind,
            300
        );

    window.addEventListener(
        "beforeunload",
        () => {
            window.clearInterval(
                timer
            );
        },
        {
            once: true
        }
    );

    console.log(
        "Ubuzima+ receipt adapter V5 active",
        VERSION
    );
})();

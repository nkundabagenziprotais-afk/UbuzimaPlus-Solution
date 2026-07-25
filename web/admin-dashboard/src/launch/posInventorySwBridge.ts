type PosHydrationStats = {
  endpoint: string;
  pagesLoaded: number;
  productCount: number;
  completedAt: string;
};

declare global {
  interface Window {
    __ubuzimaPosInventoryHydrator?: {
      version: string;
      lastHydration: PosHydrationStats | null;
      clearCache: () => void;
      ping: () => void;
    };
  }
}

let lastHydration: PosHydrationStats | null = null;

function looksLikePosWorkspace(): boolean {
  return Boolean(
    document.querySelector(".pos-counter-page") ||
      document.querySelector(".pos-product-stock-section") ||
      document.querySelector(".pos-drug-list") ||
      document.querySelector(".pos-drug-list--ten") ||
      document.querySelector(".retail-pos-grid"),
  );
}

function postToSw(message: Record<string, unknown>): void {
  try {
    navigator.serviceWorker?.controller?.postMessage(message);
    navigator.serviceWorker?.ready
      ?.then((registration) => registration.active?.postMessage(message))
      .catch(() => {});
  } catch {
    // ignore
  }
}

function pingPosState(): void {
  if (!("serviceWorker" in navigator)) return;

  if (looksLikePosWorkspace()) {
    postToSw({
      type: "UBUZIMA_POS_ACTIVE",
      activeUntil: Date.now() + 10 * 60 * 1000,
    });
  }
}

function bootBridge(): void {
  window.__ubuzimaPosInventoryHydrator = {
    version: "sw-permanent-20260724",
    get lastHydration() {
      return lastHydration;
    },
    clearCache() {
      postToSw({ type: "UBUZIMA_POS_INVENTORY_CLEAR_CACHE" });
    },
    ping() {
      pingPosState();
    },
  };

  navigator.serviceWorker?.addEventListener("message", (event) => {
    const data = event.data || {};

    if (data.type === "UBUZIMA_POS_INVENTORY_HYDRATED") {
      lastHydration = data.detail || null;
      window.dispatchEvent(
        new CustomEvent("ubuzima:pos-inventory-hydrated", {
          detail: lastHydration,
        }),
      );
    }
  });

  pingPosState();

  let timer = 0;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(pingPosState, 200);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.setInterval(pingPosState, 30000);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootBridge);
  } else {
    bootBridge();
  }
}

export {};

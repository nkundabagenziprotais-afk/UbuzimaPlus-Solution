/**
 * POS-only web interface restore.
 * Keeps current taskbar and all non-POS modules unchanged.
 */

function safeRun(callback: () => void): void {
  try {
    callback();
  } catch (error) {
    console.warn("[Ubuzima POS restore]", error);
  }
}

function textOf(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function looksLikePosWorkspace(): boolean {
  return Boolean(
    document.querySelector(".pos-counter-page") ||
      document.querySelector(".pos-dedicated-counter-shell") ||
      document.querySelector(".pos-terminal-main-scroll") ||
      document.querySelector(".pos-scroll-body-v16") ||
      document.querySelector(".pos-product-stock-section") ||
      document.querySelector(".pos-drug-list") ||
      document.querySelector(".pos-drug-list--ten")
  );
}

function restorePosWebInterface(): void {
  safeRun(() => {
    const root = document.documentElement;
    const isPos = looksLikePosWorkspace();

    root.classList.toggle("ubuzima-pos-web-restored", isPos);

    if (!isPos) return;

    document
      .querySelectorAll<HTMLElement>(
        ".dashboard-shell--native-pos-products, .dashboard-shell--native-workflow-open"
      )
      .forEach((node) => {
        node.classList.remove("dashboard-shell--native-pos-products");
        node.classList.remove("dashboard-shell--native-workflow-open");
        node.setAttribute("data-ubuzima-pos-web-restored", "true");
      });

    document
      .querySelectorAll<HTMLElement>(
        ".pos-mobile-step--products, .pos-mobile-sequence-header, .pos-mobile-step-actions"
      )
      .forEach((node) => {
        node.setAttribute("data-ubuzima-pos-mobile-neutralized", "true");
      });

    // Legacy source taskbar ownership removed by
    // UBIZIMA_MAIN_ADMIN_TASKBAR_REMOVAL_V1.
  });
}

function bootPosRestore(): void {
  restorePosWebInterface();

  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(restorePosWebInterface, 160);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPosRestore);
  } else {
    bootPosRestore();
  }
}

export {};

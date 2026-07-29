function ubuzimaScrollText(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function ubuzimaIsLoginScreen(): boolean {
  return Boolean(
    document.querySelector("input[type='password']") &&
      (document.querySelector("form") ||
        ubuzimaScrollText(document.body).includes("login") ||
        ubuzimaScrollText(document.body).includes("pin")),
  );
}

function ubuzimaIsAuthenticatedSurface(): boolean {
  if (ubuzimaIsLoginScreen()) return false;

  return Boolean(
    document.querySelector(".dashboard-shell") ||
      document.querySelector(".dashboard-main") ||
      document.querySelector(".dashboard-scroll-panel") ||
      document.querySelector(".section-page") ||
      document.querySelector("[data-admin-sidebar='true']") ||
      document.querySelector("aside") ||
      document.querySelector("nav"),
  );
}

function ubuzimaUnlockHomeScroll(): void {
  if (!ubuzimaIsAuthenticatedSurface()) return;

  document.documentElement.classList.add("ubuzima-home-scroll-unlocked");
  document.body.classList.add("ubuzima-home-scroll-unlocked-body");

  [document.documentElement, document.body].forEach((node) => {
    node.style.setProperty("height", "auto", "important");
    node.style.setProperty("max-height", "none", "important");
    node.style.setProperty("overflow-y", "auto", "important");
  });
}

function bootUbuzimaHomeScrollUnlock(): void {
  ubuzimaUnlockHomeScroll();

  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(ubuzimaUnlockHomeScroll, 120);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden"],
  });

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("pageshow", schedule);
  window.setInterval(ubuzimaUnlockHomeScroll, 1200);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootUbuzimaHomeScrollUnlock);
  } else {
    bootUbuzimaHomeScrollUnlock();
  }
}

export {};

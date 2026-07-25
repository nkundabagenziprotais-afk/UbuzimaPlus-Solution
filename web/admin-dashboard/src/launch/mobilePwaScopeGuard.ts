/**
 * UbuzimaPlus mobile/PWA scope guard.
 *
 * Rule:
 * - Native/PWA mobile interface is allowed only on installed phone app.
 * - Desktop and tablet must keep the normal web interface.
 * - Taskbar remains untouched.
 */

const HTML_MOBILE_APP_CLASSES = [
  "ubuzima-mobile-web",
  "ubuzima-standalone-webapp",
  "ubuzima-native-mobile-v2",
  "ubuzima-app-shell-mobile",
];

const ELEMENT_MOBILE_APP_CLASSES = [
  "dashboard-shell--fresh-mobile-app",
  "dashboard-shell--native-workflow-open",
  "dashboard-shell--native-pos-products",
  "auth-shell--mobile-app-ready",
];

function safeRun(callback: () => void): void {
  try {
    callback();
  } catch (error) {
    console.warn("[Ubuzima mobile scope guard]", error);
  }
}

function isInstalledPhoneApp(): boolean {
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  const height = window.innerHeight || document.documentElement.clientHeight || 0;
  const shortestSide = Math.min(width, height);

  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  const coarsePointer =
    window.matchMedia?.("(pointer: coarse)").matches === true;

  return Boolean(standalone && coarsePointer && shortestSide <= 767);
}

function removeMobileShellFromWebAndTablet(): void {
  const root = document.documentElement;

  HTML_MOBILE_APP_CLASSES.forEach((className) => {
    root.classList.remove(className);
  });

  document
    .querySelectorAll<HTMLElement>(
      ".dashboard-shell--fresh-mobile-app, .dashboard-shell--native-workflow-open, .dashboard-shell--native-pos-products, .auth-shell--mobile-app-ready"
    )
    .forEach((node) => {
      ELEMENT_MOBILE_APP_CLASSES.forEach((className) => {
        node.classList.remove(className);
      });

      node.setAttribute("data-ubuzima-mobile-pwa-removed-for-web", "true");
    });

  root.classList.add("ubuzima-web-interface-restored");
  root.classList.remove("ubuzima-mobile-pwa-active");
}

function allowMobilePwaOnlyOnPhoneApp(): void {
  safeRun(() => {
    const root = document.documentElement;

    if (isInstalledPhoneApp()) {
      root.classList.add("ubuzima-mobile-pwa-active");
      root.classList.remove("ubuzima-web-interface-restored");
      return;
    }

    removeMobileShellFromWebAndTablet();

    const dock = document.getElementById("ubuzimaSourceDock");
    if (dock) {
      dock.style.display = "";
      dock.style.visibility = "visible";
      dock.style.opacity = "1";
    }
  });
}

function bootMobileScopeGuard(): void {
  allowMobilePwaOnlyOnPhoneApp();

  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(allowMobilePwaOnlyOnPhoneApp, 160);
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
  window.addEventListener("pageshow", schedule);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootMobileScopeGuard);
  } else {
    bootMobileScopeGuard();
  }
}

export {};

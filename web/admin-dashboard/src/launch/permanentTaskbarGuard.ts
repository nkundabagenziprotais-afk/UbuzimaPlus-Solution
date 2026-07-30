/**
 * Permanent taskbar guard.
 * Keeps the source dock present after login on every page.
 * Does not show on login screens.
 */

type CachedModule = {
  label: string;
  icon: string;
};

const MODULE_CACHE_KEY = "ubuzima.taskbar.cachedModules.v1";
const DOCK_ID = "ubuzimaSourceDock";
const TIP_ID = "ubuzimaSourceDockTip";

function taskbarText(node: Element | null | undefined): string {
  return ((node && node.textContent) || "").replace(/\s+/g, " ").trim();
}

function cleanLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}

function isLoginScreen(): boolean {
  return Boolean(
    document.querySelector("input[type='password']") &&
      (document.querySelector("form") || taskbarText(document.body).toLowerCase().includes("pin")),
  );
}

function isAuthenticatedSurface(): boolean {
  if (isLoginScreen()) return false;

  return Boolean(
    document.querySelector(".dashboard-shell") ||
      document.querySelector(".dashboard-main") ||
      document.querySelector(".sidebar") ||
      document.querySelector("[data-admin-sidebar='true']") ||
      document.querySelector("aside") ||
      document.querySelector("nav") ||
      document.getElementById(DOCK_ID),
  );
}

function iconForLabel(label: string): string {
  const value = label.toLowerCase();

  if (value.includes("pos") || value.includes("counter")) return "./dock-icons/pos.svg";
  if (value.includes("sales")) return "./dock-icons/sales.svg";
  if (value.includes("general stock")) return "./dock-icons/general-stock.svg";
  if (value.includes("inventory") || value.includes("stock") || value.includes("product")) return "./dock-icons/inventory.svg";
  if (value.includes("procurement") || value.includes("purchase")) return "./dock-icons/procurement.svg";
  if (value.includes("insurance")) return "./dock-icons/insurance.svg";
  if (value.includes("supplier")) return "./dock-icons/suppliers.svg";
  if (value.includes("finance") || value.includes("payment") || value.includes("cash")) return "./dock-icons/finance.svg";
  if (value.includes("report") || value.includes("analytics")) return "./dock-icons/reports.svg";
  if (value.includes("admin") || value.includes("security") || value.includes("access")) return "./dock-icons/admin.svg";
  if (value.includes("home") || value.includes("dashboard") || value.includes("overview")) return "./dock-icons/dashboard.svg";

  return "./dock-icons/module.svg";
}

function findSidebar(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>("[data-admin-sidebar='true']") ||
    document.querySelector<HTMLElement>(".sidebar") ||
    document.querySelector<HTMLElement>("[class*='sidebar']") ||
    document.querySelector<HTMLElement>("aside") ||
    document.querySelector<HTMLElement>("nav")
  );
}

function collectLiveModules(): CachedModule[] {
  const sidebar = findSidebar();
  if (!sidebar) return [];

  const controls = Array.from(
    sidebar.querySelectorAll<HTMLElement>("button, a, [role='button']"),
  );

  const seen = new Set<string>();
  const modules: CachedModule[] = [];

  controls.forEach((node) => {
    const label = cleanLabel(taskbarText(node));

    if (!label || label.length < 2) return;
    if (/toggle|collapse|expand|logout|sign out|language|profile|sync/i.test(label)) return;

    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    modules.push({
      label,
      icon: iconForLabel(label),
    });
  });

  return modules.slice(0, 50);
}

function readCachedModules(): CachedModule[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(MODULE_CACHE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed
          .filter((item) => item && typeof item.label === "string")
          .map((item) => ({
            label: cleanLabel(item.label),
            icon: typeof item.icon === "string" ? item.icon : iconForLabel(item.label),
          }))
          .filter((item) => item.label)
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}

function writeCachedModules(modules: CachedModule[]): void {
  if (!modules.length) return;

  try {
    localStorage.setItem(MODULE_CACHE_KEY, JSON.stringify(modules));
  } catch {
    // ignore
  }
}

function resolveLiveModule(label: string): HTMLElement | null {
  const sidebar = findSidebar();
  if (!sidebar) return null;

  const key = label.toLowerCase();

  return (
    Array.from(sidebar.querySelectorAll<HTMLElement>("button, a, [role='button']")).find(
      (node) => cleanLabel(taskbarText(node)).toLowerCase() === key,
    ) || null
  );
}

function ensureTip(): HTMLElement {
  let tip = document.getElementById(TIP_ID) as HTMLElement | null;

  if (!tip) {
    tip = document.createElement("div");
    tip.id = TIP_ID;
    tip.className = "ubuzima-source-dock__tip";
    document.body.appendChild(tip);
  }

  return tip;
}

function showTip(label: string, button: HTMLElement): void {
  const tip = ensureTip();
  const rect = button.getBoundingClientRect();

  tip.textContent = label;
  tip.style.left = `${rect.left + rect.width / 2}px`;
  tip.classList.add("is-visible");
}

function hideTip(): void {
  document.getElementById(TIP_ID)?.classList.remove("is-visible");
}

function normalizeExistingDock(dock: HTMLElement): void {
  dock.style.display = "";
  dock.style.visibility = "visible";
  dock.style.opacity = "1";

  dock.querySelectorAll<HTMLElement>(".ubuzima-source-dock__app, .ubuzima-source-dock__task").forEach((button) => {
    const label = cleanLabel(button.getAttribute("aria-label") || taskbarText(button));
    if (label) button.setAttribute("aria-label", label);

    const icon = button.querySelector<HTMLElement>(".ubuzima-source-dock__glass-icon");
    if (icon && !icon.querySelector("img")) {
      icon.textContent = "";
      const image = document.createElement("img");
      image.src = iconForLabel(label);
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      icon.appendChild(image);
    }
  });
}

function createFallbackDock(modules: CachedModule[]): void {
  if (!modules.length) return;
  if (document.getElementById(DOCK_ID)) return;

  const dock = document.createElement("div");
  dock.id = DOCK_ID;
  dock.className = "ubuzima-source-dock ubuzima-permanent-taskbar-fallback";
  dock.innerHTML = `
    <div class="ubuzima-source-dock__main" aria-label="Modules"></div>
    <div class="ubuzima-source-dock__divider"></div>
    <div class="ubuzima-source-dock__tasks" aria-label="Open tasks"></div>
  `;

  const main = dock.querySelector(".ubuzima-source-dock__main");

  modules.forEach((module) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ubuzima-source-dock__app";
    button.setAttribute("aria-label", module.label);
    button.innerHTML = `
      <span class="ubuzima-source-dock__glass-icon" aria-hidden="true">
        <img src="${module.icon}" alt="" loading="lazy" decoding="async" />
      </span>
    `;

    button.addEventListener("mouseenter", () => showTip(module.label, button));
    button.addEventListener("mouseleave", hideTip);
    button.addEventListener("focus", () => showTip(module.label, button));
    button.addEventListener("blur", hideTip);

    button.addEventListener("click", () => {
      const live = resolveLiveModule(module.label);
      if (live) {
        live.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
      }
    });

    main?.appendChild(button);
  });

  document.body.appendChild(dock);
  ensureTip();
}

function keepTaskbarPermanent(): void {
  if (!isAuthenticatedSurface()) return;

  const liveModules = collectLiveModules();
  if (liveModules.length) writeCachedModules(liveModules);

  const modules = liveModules.length ? liveModules : readCachedModules();
  const dock = document.getElementById(DOCK_ID) as HTMLElement | null;

  if (dock) {
    normalizeExistingDock(dock);
    return;
  }

  createFallbackDock(modules);
}

function bootPermanentTaskbarGuard(): void {
  keepTaskbarPermanent();

  let timer = 0;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(keepTaskbarPermanent, 120);
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
  window.setInterval(keepTaskbarPermanent, 1500);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPermanentTaskbarGuard);
  } else {
    bootPermanentTaskbarGuard();
  }
}

export {};
